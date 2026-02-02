import { useMemo } from 'react';
import { AgendaAppointmentCard } from './AgendaAppointmentCard';
import { Loader2, Plus } from 'lucide-react';
import { cn } from '@/lib/utils';

interface DoctorRule {
  id: string;
  hora_inicio: string;
  hora_fim: string;
  dia_semana: number;
  tipo_atendimento: string;
}

interface ScheduleOpening {
  id: string;
  data: string;
  hora_inicio: string;
  hora_fim: string;
  tipo_atendimento: string;
}

interface Appointment {
  id: string;
  hora_inicio: string;
  hora_fim: string;
  status: string;
  paciente_nome?: string | null;
  paciente_telefone?: string | null;
  is_encaixe?: boolean;
  exam_types?: { id: string; nome: string; duracao_minutos: number };
}

interface AgendaTimeGridProps {
  doctorRules: DoctorRule[];
  scheduleOpenings: ScheduleOpening[];
  appointments: Appointment[];
  selectedDate: Date;
  tipoAtendimento: 'consulta' | 'ultrassom';
  onSlotClick: (time: string, availableMinutes: number, endTime: string) => void;
  onAppointmentClick: (appointment: Appointment) => void;
  isLoading?: boolean;
}

function timeToMinutes(time: string): number {
  const [hours, minutes] = time.split(':').map(Number);
  return hours * 60 + minutes;
}

function minutesToTime(minutes: number): string {
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  return `${h.toString().padStart(2, '0')}:${m.toString().padStart(2, '0')}`;
}

interface TimeSlotRow {
  time: string;
  minutes: number;
  isWithinWorkHours: boolean;
  appointments: Appointment[]; // All appointments that START at this slot
  continuingAppointments: Appointment[]; // All appointments that CONTINUE through this slot (excluding encaixes)
  isOccupied: boolean;
  isFree: boolean;
  freeUntil?: string;
  availableMinutes?: number;
}

export function AgendaTimeGrid({
  doctorRules,
  scheduleOpenings,
  appointments,
  selectedDate,
  tipoAtendimento,
  onSlotClick,
  onAppointmentClick,
  isLoading,
}: AgendaTimeGridProps) {
  const rows = useMemo(() => {
    const dayOfWeek = selectedDate.getDay();
    
    // Filter weekly rules for the day
    const rulesForDay = doctorRules.filter(
      (rule) =>
        rule.dia_semana === dayOfWeek &&
        (rule.tipo_atendimento === 'ambos' || rule.tipo_atendimento === tipoAtendimento)
    );

    // Filter schedule openings (extra schedules) for the day
    const openingsForDay = scheduleOpenings.filter(
      (opening) =>
        opening.tipo_atendimento === 'ambos' || opening.tipo_atendimento === tipoAtendimento
    );

    // If no rules and no openings, no schedule available
    if (rulesForDay.length === 0 && openingsForDay.length === 0) {
      return [];
    }

    // Valid appointments (not cancelled)
    const validApts = appointments.filter(apt => apt.status !== 'cancelado');

    // Find day range (combining rules, openings, AND existing appointments)
    // This ensures encaixes outside work hours are still visible
    let dayStart = Infinity;
    let dayEnd = 0;
    
    for (const rule of rulesForDay) {
      const start = timeToMinutes(rule.hora_inicio);
      const end = timeToMinutes(rule.hora_fim);
      if (start < dayStart) dayStart = start;
      if (end > dayEnd) dayEnd = end;
    }
    
    for (const opening of openingsForDay) {
      const start = timeToMinutes(opening.hora_inicio);
      const end = timeToMinutes(opening.hora_fim);
      if (start < dayStart) dayStart = start;
      if (end > dayEnd) dayEnd = end;
    }

    // IMPORTANT: Expand range to include any appointments (especially encaixes) outside work hours
    for (const apt of validApts) {
      const aptStart = timeToMinutes(apt.hora_inicio);
      const aptEnd = timeToMinutes(apt.hora_fim);
      if (aptStart < dayStart) dayStart = aptStart;
      if (aptEnd > dayEnd) dayEnd = aptEnd;
    }

    // Round to 10 min intervals
    dayStart = Math.floor(dayStart / 10) * 10;
    dayEnd = Math.ceil(dayEnd / 10) * 10;

    // Generate rows every 10 minutes
    // IMPORTANT: hora_fim defines the LAST possible START time for an appointment
    // So we include dayEnd (<=) to show the final slot
    const timeRows: TimeSlotRow[] = [];
    
    for (let min = dayStart; min <= dayEnd; min += 10) {
      const time = minutesToTime(min);
      
      // Check if this time is within work hours (rules OR openings)
      // hora_fim is the last valid START time, so we use <= for ruleEnd
      const isWithinRules = rulesForDay.some(rule => {
        const ruleStart = timeToMinutes(rule.hora_inicio);
        const ruleEnd = timeToMinutes(rule.hora_fim);
        // Slot can START at any time from ruleStart up to AND INCLUDING ruleEnd
        return min >= ruleStart && min <= ruleEnd;
      });
      
      const isWithinOpenings = openingsForDay.some(opening => {
        const openingStart = timeToMinutes(opening.hora_inicio);
        const openingEnd = timeToMinutes(opening.hora_fim);
        return min >= openingStart && min <= openingEnd;
      });
      
      const isWithinWork = isWithinRules || isWithinOpenings;

      // Find ALL appointments that START at this slot
      const aptsStarting = validApts.filter(apt => {
        const aptStart = timeToMinutes(apt.hora_inicio);
        return aptStart === min;
      });

      // Find ALL appointments that CONTINUE through this slot (started earlier, still running)
      // IMPORTANT: Encaixes do NOT show continuation - they only appear in their starting slot
      const continuingApts = validApts.filter(apt => {
        const aptStart = timeToMinutes(apt.hora_inicio);
        const aptEnd = timeToMinutes(apt.hora_fim);
        // Encaixes don't show continuation
        if (apt.is_encaixe) return false;
        return aptStart < min && aptEnd > min;
      });

      // Check if slot is occupied by non-encaixe appointments only (for free slot logic)
      const hasRegularAppointment = aptsStarting.some(apt => !apt.is_encaixe) || continuingApts.length > 0;
      const isOccupied = hasRegularAppointment;

      // Calculate free time until next appointment or end of day
      let freeUntil: string | undefined;
      let availableMinutes: number | undefined;
      
      if (!isOccupied && isWithinWork) {
        // Find next regular (non-encaixe) appointment or end of work hours
        let endOfFree = dayEnd;
        
        for (const apt of validApts) {
          // Only consider non-encaixe appointments for blocking
          if (apt.is_encaixe) continue;
          const aptStart = timeToMinutes(apt.hora_inicio);
          if (aptStart > min && aptStart < endOfFree) {
            endOfFree = aptStart;
          }
        }
        
        // Check rule boundaries
        for (const rule of rulesForDay) {
          const ruleEnd = timeToMinutes(rule.hora_fim);
          if (ruleEnd > min && ruleEnd < endOfFree) {
            endOfFree = ruleEnd;
          }
        }
        
        // Also check opening boundaries
        for (const opening of openingsForDay) {
          const openingEnd = timeToMinutes(opening.hora_fim);
          if (openingEnd > min && openingEnd < endOfFree) {
            endOfFree = openingEnd;
          }
        }
        
        freeUntil = minutesToTime(endOfFree);
        availableMinutes = endOfFree - min;
      }

      timeRows.push({
        time,
        minutes: min,
        isWithinWorkHours: isWithinWork,
        appointments: aptsStarting,
        continuingAppointments: continuingApts,
        isOccupied,
        isFree: !isOccupied && isWithinWork,
        freeUntil,
        availableMinutes,
      });
    }

    return timeRows;
  }, [doctorRules, scheduleOpenings, appointments, selectedDate, tipoAtendimento]);

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  if (rows.length === 0) {
    return (
      <div className="text-center py-12 text-muted-foreground">
        <p className="text-lg font-medium">Sem horários disponíveis</p>
        <p className="text-sm mt-1">
          O médico não possui regras de atendimento para este dia da semana.
        </p>
      </div>
    );
  }

  // Helper to check if this is a "full hour" row (for visual emphasis)
  const isFullHour = (minutes: number) => minutes % 60 === 0;

  // Calculate grid columns based on max simultaneous appointments
  const getGridCols = (count: number) => {
    if (count <= 1) return 'grid-cols-1';
    if (count === 2) return 'grid-cols-2';
    return 'grid-cols-3';
  };

  return (
    <div className="border rounded-lg overflow-hidden">
      {rows.map((row) => {
        const allAppointments = [...row.appointments, ...row.continuingAppointments];
        const hasMultiple = allAppointments.length > 1 || row.appointments.length > 1;
        
        return (
          <div
            key={row.time}
            className={cn(
              'flex border-b last:border-b-0 min-h-[44px]',
              !row.isWithinWorkHours && 'bg-muted/30',
              isFullHour(row.minutes) && 'border-t-2 border-t-muted'
            )}
          >
            {/* Time column */}
            <div className={cn(
              'w-16 shrink-0 px-2 py-1 border-r bg-muted/50 flex items-center justify-end',
              isFullHour(row.minutes) ? 'font-semibold text-foreground' : 'text-muted-foreground'
            )}>
              <span className="text-xs">
                {row.time}
              </span>
            </div>

            {/* Content column */}
            <div className="flex-1 p-0.5">
              {/* Has appointments starting at this slot */}
              {row.appointments.length > 0 ? (
                <div className={cn(
                  'grid gap-0.5',
                  getGridCols(row.appointments.length)
                )}>
                  {row.appointments.map(apt => (
                    <AgendaAppointmentCard
                      key={apt.id}
                      appointment={apt}
                      onClick={() => onAppointmentClick(apt)}
                      compact={row.appointments.length > 1}
                    />
                  ))}
                </div>
              ) : row.continuingAppointments.length > 0 ? (
                // Slots with continuing appointments (non-encaixe only)
                <div className={cn(
                  'grid gap-0.5',
                  getGridCols(row.continuingAppointments.length)
                )}>
                  {row.continuingAppointments.map(apt => (
                    <button
                      key={apt.id}
                      onClick={() => onAppointmentClick(apt)}
                      className="w-full h-full min-h-[40px] border-l-4 hover:opacity-80 transition-colors flex items-center px-2 cursor-pointer bg-blue-50/80 border-l-blue-400 hover:bg-blue-100"
                    >
                      <span className="text-xs font-medium truncate text-blue-600">
                        ↑ {apt.paciente_nome?.split(' ')[0] || 'Ocupado'}
                      </span>
                    </button>
                  ))}
                </div>
              ) : row.isFree ? (
                <button
                  onClick={() => onSlotClick(row.time, row.availableMinutes || 10, row.freeUntil || row.time)}
                  className="w-full h-full min-h-[40px] rounded border border-dashed border-emerald-300 bg-emerald-50/30 hover:bg-emerald-100 hover:border-emerald-400 transition-colors flex items-center justify-center gap-1 text-emerald-600"
                >
                  <Plus className="h-3 w-3" />
                  <span className="text-xs font-medium">Livre</span>
                </button>
              ) : null}
            </div>
          </div>
        );
      })}
    </div>
  );
}
