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
  appointment?: Appointment; // Appointment that STARTS at this slot
  isOccupied: boolean; // Slot is occupied by any appointment (starting or continuing)
  isFree: boolean;
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

    // Round to 10 min intervals
    dayStart = Math.floor(dayStart / 10) * 10;
    dayEnd = Math.ceil(dayEnd / 10) * 10;

    // Valid appointments (not cancelled)
    const validApts = appointments.filter(apt => apt.status !== 'cancelado');

    // Generate rows every 10 minutes
    const timeRows: TimeSlotRow[] = [];
    
    for (let min = dayStart; min < dayEnd; min += 10) {
      const time = minutesToTime(min);
      const slotEnd = min + 10;
      
      // Check if this time is within work hours
      const isWithinWork = rulesForDay.some(rule => {
        const ruleStart = timeToMinutes(rule.hora_inicio);
        const ruleEnd = timeToMinutes(rule.hora_fim);
        return min >= ruleStart && min < ruleEnd;
      });

      // Find appointment that STARTS at this slot
      const aptStarting = validApts.find(apt => {
        const aptStart = timeToMinutes(apt.hora_inicio);
        return aptStart === min;
      });

      // Check if slot is occupied (any appointment covers this time)
      const isOccupied = validApts.some(apt => {
        const aptStart = timeToMinutes(apt.hora_inicio);
        const aptEnd = timeToMinutes(apt.hora_fim);
        return aptStart <= min && aptEnd > min;
      });

      // Calculate free time until next appointment or end of day
      let freeUntil: string | undefined;
      let availableMinutes: number | undefined;
      
      if (!isOccupied && isWithinWork) {
        // Find next appointment or end of work hours
        let endOfFree = dayEnd;
        
        for (const apt of validApts) {
          const aptStart = timeToMinutes(apt.hora_inicio);
          if (aptStart > min && aptStart < endOfFree) {
            endOfFree = aptStart;
          }
        }
        
        // Also check rule boundaries
        for (const rule of rulesForDay) {
          const ruleEnd = timeToMinutes(rule.hora_fim);
          if (ruleEnd > min && ruleEnd < endOfFree) {
            endOfFree = ruleEnd;
          }
        }
        
        freeUntil = minutesToTime(endOfFree);
        availableMinutes = endOfFree - min;
      }

      timeRows.push({
        time,
        minutes: min,
        isWithinWorkHours: isWithinWork,
        appointment: aptStarting,
        isOccupied,
        isFree: !isOccupied && isWithinWork,
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

  // Helper to check if this is a "full hour" row (for visual emphasis)
  const isFullHour = (minutes: number) => minutes % 60 === 0;

  return (
    <div className="border rounded-lg overflow-hidden">
      {rows.map((row) => (
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
            {row.appointment ? (
              <AgendaAppointmentCard
                appointment={row.appointment}
                onClick={() => onAppointmentClick(row.appointment!)}
              />
            ) : row.isOccupied ? (
              // Slot occupied by continuing appointment - show subtle indicator
              <div className="h-full min-h-[40px] bg-blue-50/80 border-l-2 border-l-blue-300" />
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
      ))}
    </div>
  );
}
