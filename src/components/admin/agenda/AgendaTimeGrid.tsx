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
  appointments: Appointment[];
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
      const aptsInSlot = validApts.filter(apt => {
        const aptStart = timeToMinutes(apt.hora_inicio);
        return aptStart >= min && aptStart < slotEnd;
      });

      // Check if slot is free (no appointment occupying this time)
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
        appointments: aptsInSlot,
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
            {row.appointments.length > 0 ? (
              <div className="flex gap-1 flex-wrap">
                {row.appointments.map((apt) => (
                  <div key={apt.id} className="flex-1 min-w-[150px]">
                    <AgendaAppointmentCard
                      appointment={apt}
                      onClick={() => onAppointmentClick(apt)}
                    />
                  </div>
                ))}
              </div>
            ) : row.isFree ? (
              <button
                onClick={() => onSlotClick(row.time, row.availableMinutes || 30, row.freeUntil || row.time)}
                className="w-full h-full min-h-[48px] rounded-lg border-2 border-dashed border-emerald-300 bg-emerald-50/50 hover:bg-emerald-100 hover:border-emerald-400 transition-colors flex items-center justify-center gap-2 text-emerald-600"
              >
                <Plus className="h-4 w-4" />
                <span className="text-sm font-medium">
                  {row.availableMinutes && row.availableMinutes > 30
                    ? `${row.availableMinutes} min disponíveis`
                    : 'Livre'}
                </span>
              </button>
            ) : null}
          </div>
        </div>
      ))}
    </div>
  );
}
