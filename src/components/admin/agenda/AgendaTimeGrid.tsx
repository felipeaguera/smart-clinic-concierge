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

interface Appointment {
  id: string;
  hora_inicio: string;
  hora_fim: string;
  status: string;
  paciente_nome?: string | null;
  paciente_telefone?: string | null;
  exam_types?: { id: string; nome: string; duracao_minutos: number };
}

interface AgendaTimeGridProps {
  doctorRules: DoctorRule[];
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
  appointmentsStarting: Appointment[];
  appointmentsContinuing: Appointment[];
  isFree: boolean;
  hasPartialFreeTime?: boolean;
  freeStartTime?: string;
  freeUntil?: string;
  availableMinutes?: number;
}

export function AgendaTimeGrid({
  doctorRules,
  appointments,
  selectedDate,
  tipoAtendimento,
  onSlotClick,
  onAppointmentClick,
  isLoading,
}: AgendaTimeGridProps) {
  const rows = useMemo(() => {
    const dayOfWeek = selectedDate.getDay();
    
    // Filter rules for the day
    const rulesForDay = doctorRules.filter(
      (rule) =>
        rule.dia_semana === dayOfWeek &&
        (rule.tipo_atendimento === 'ambos' || rule.tipo_atendimento === tipoAtendimento)
    );

    if (rulesForDay.length === 0) {
      return [];
    }

    // Find day range
    let dayStart = Infinity;
    let dayEnd = 0;
    for (const rule of rulesForDay) {
      const start = timeToMinutes(rule.hora_inicio);
      const end = timeToMinutes(rule.hora_fim);
      if (start < dayStart) dayStart = start;
      if (end > dayEnd) dayEnd = end;
    }

    // Round to 30 min intervals
    dayStart = Math.floor(dayStart / 30) * 30;
    dayEnd = Math.ceil(dayEnd / 30) * 30;

    // Valid appointments (not cancelled)
    const validApts = appointments.filter(apt => apt.status !== 'cancelado');

    // Generate rows every 30 minutes
    const timeRows: TimeSlotRow[] = [];
    
    for (let min = dayStart; min < dayEnd; min += 30) {
      const time = minutesToTime(min);
      const slotEnd = min + 30;
      
      // Check if this time is within work hours
      const isWithinWork = rulesForDay.some(rule => {
        const ruleStart = timeToMinutes(rule.hora_inicio);
        const ruleEnd = timeToMinutes(rule.hora_fim);
        return min >= ruleStart && min < ruleEnd;
      });

      // Find appointments that START in this slot
      const aptsStartingInSlot = validApts.filter(apt => {
        const aptStart = timeToMinutes(apt.hora_inicio);
        return aptStart >= min && aptStart < slotEnd;
      });

      // Find appointments that CONTINUE through this slot (started before but still running)
      const aptsContinuingInSlot = validApts.filter(apt => {
        const aptStart = timeToMinutes(apt.hora_inicio);
        const aptEnd = timeToMinutes(apt.hora_fim);
        // Appointment continues if: started before this slot AND ends after this slot starts
        return aptStart < min && aptEnd > min;
      });

      // Check if the slot is COMPLETELY occupied (appointment spans entire slot)
      const isCompletelyOccupied = validApts.some(apt => {
        const aptStart = timeToMinutes(apt.hora_inicio);
        const aptEnd = timeToMinutes(apt.hora_fim);
        // Slot is completely occupied if appointment covers entire 30min
        return aptStart <= min && aptEnd >= slotEnd;
      });

      // Check if slot is partially occupied (has some free time after appointment ends)
      const continuingApt = aptsContinuingInSlot[0];
      let partialFreeStart: number | undefined;
      if (continuingApt && !isCompletelyOccupied) {
        const aptEnd = timeToMinutes(continuingApt.hora_fim);
        if (aptEnd > min && aptEnd < slotEnd) {
          partialFreeStart = aptEnd;
        }
      }

      // Check if there's any appointment in this slot (for determining if it's completely free)
      const hasAnyAppointment = aptsStartingInSlot.length > 0 || aptsContinuingInSlot.length > 0;

      // Calculate free time until next appointment or end of day
      let freeUntil: string | undefined;
      let availableMinutes: number | undefined;
      let freeStartTime: string | undefined;
      
      // Determine the actual free start time in this slot
      const actualFreeStart = partialFreeStart ?? min;
      
      if (isWithinWork && (!hasAnyAppointment || partialFreeStart !== undefined)) {
        // Find next appointment or end of work hours
        let endOfFree = dayEnd;
        
        for (const apt of validApts) {
          const aptStart = timeToMinutes(apt.hora_inicio);
          if (aptStart > actualFreeStart && aptStart < endOfFree) {
            endOfFree = aptStart;
          }
        }
        
        // Also check rule boundaries
        for (const rule of rulesForDay) {
          const ruleEnd = timeToMinutes(rule.hora_fim);
          if (ruleEnd > actualFreeStart && ruleEnd < endOfFree) {
            endOfFree = ruleEnd;
          }
        }
        
        freeUntil = minutesToTime(endOfFree);
        availableMinutes = endOfFree - actualFreeStart;
        freeStartTime = minutesToTime(actualFreeStart);
      }

      const isCompletelyFree = !hasAnyAppointment && isWithinWork;
      const hasPartialFreeTime = partialFreeStart !== undefined && availableMinutes !== undefined && availableMinutes > 0;

      timeRows.push({
        time,
        minutes: min,
        isWithinWorkHours: isWithinWork,
        appointmentsStarting: aptsStartingInSlot,
        appointmentsContinuing: aptsContinuingInSlot,
        isFree: isCompletelyFree,
        hasPartialFreeTime,
        freeStartTime,
        freeUntil,
        availableMinutes,
      });
    }

    return timeRows;
  }, [doctorRules, appointments, selectedDate, tipoAtendimento]);

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

  return (
    <div className="border rounded-lg overflow-hidden">
      {rows.map((row, idx) => (
        <div
          key={row.time}
          className={cn(
            'flex border-b last:border-b-0 min-h-[56px]',
            !row.isWithinWorkHours && 'bg-muted/30'
          )}
        >
          {/* Time column */}
          <div className="w-20 shrink-0 px-3 py-2 border-r bg-muted/50 flex items-start justify-end">
            <span className="text-sm font-medium text-muted-foreground">
              {row.time}
            </span>
          </div>

          {/* Content column */}
          <div className="flex-1 p-1">
            {row.appointmentsStarting.length > 0 ? (
              <div className="flex gap-1 flex-wrap">
                {row.appointmentsStarting.map((apt) => (
                  <div key={apt.id} className="flex-1 min-w-[150px]">
                    <AgendaAppointmentCard
                      appointment={apt}
                      onClick={() => onAppointmentClick(apt)}
                    />
                  </div>
                ))}
              </div>
            ) : row.appointmentsContinuing.length > 0 ? (
              <div className="flex gap-1 flex-wrap">
                {row.appointmentsContinuing.map((apt) => (
                  <div key={apt.id} className="flex-1 min-w-[150px]">
                    <div 
                      onClick={() => onAppointmentClick(apt)}
                      className="h-full min-h-[48px] rounded-lg bg-blue-100/50 border border-blue-200 border-dashed flex items-center justify-center cursor-pointer hover:bg-blue-100 transition-colors"
                    >
                      <span className="text-xs text-blue-500 font-medium">
                        ↑ {apt.paciente_nome?.split(' ')[0] || 'Continuação'}
                      </span>
                    </div>
                  </div>
                ))}
                {/* Show partial free time button if available */}
                {row.hasPartialFreeTime && row.freeStartTime && (
                  <div className="flex-1 min-w-[150px]">
                    <button
                      onClick={() => onSlotClick(row.freeStartTime!, row.availableMinutes || 30, row.freeUntil || row.freeStartTime!)}
                      className="w-full h-full min-h-[48px] rounded-lg border-2 border-dashed border-amber-300 bg-amber-50/50 hover:bg-amber-100 hover:border-amber-400 transition-colors flex items-center justify-center gap-2 text-amber-600"
                    >
                      <Plus className="h-4 w-4" />
                      <span className="text-sm font-medium">
                        {row.freeStartTime} - {row.availableMinutes}min
                      </span>
                    </button>
                  </div>
                )}
              </div>
            ) : row.isFree ? (
              <button
                onClick={() => onSlotClick(row.time, row.availableMinutes || 30, row.freeUntil || row.time)}
                className="w-full h-full min-h-[48px] rounded-lg border-2 border-dashed border-emerald-300 bg-emerald-50/50 hover:bg-emerald-100 hover:border-emerald-400 transition-colors flex items-center justify-center gap-2 text-emerald-600"
              >
                <Plus className="h-4 w-4" />
                <span className="text-sm font-medium">Livre</span>
              </button>
            ) : null}
          </div>
        </div>
      ))}
    </div>
  );
}
