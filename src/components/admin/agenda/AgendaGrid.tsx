import { useMemo } from 'react';
import { AgendaSlot } from './AgendaSlot';
import { Loader2 } from 'lucide-react';

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
  exam_types?: { nome: string };
}

interface AgendaGridProps {
  doctorRules: DoctorRule[];
  appointments: Appointment[];
  selectedDate: Date;
  tipoAtendimento: 'consulta' | 'ultrassom';
  onSlotClick: (time: string) => void;
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

export function AgendaGrid({
  doctorRules,
  appointments,
  selectedDate,
  tipoAtendimento,
  onSlotClick,
  onAppointmentClick,
  isLoading,
}: AgendaGridProps) {
  // Gera os slots de 30 em 30 minutos baseado nas regras do médico
  const slots = useMemo(() => {
    const dayOfWeek = selectedDate.getDay();
    
    // Filtra regras para o dia da semana e tipo de atendimento
    const rulesForDay = doctorRules.filter(
      (rule) =>
        rule.dia_semana === dayOfWeek &&
        (rule.tipo_atendimento === 'ambos' || rule.tipo_atendimento === tipoAtendimento)
    );

    if (rulesForDay.length === 0) {
      return [];
    }

    const slotsList: { time: string; endTime: string }[] = [];
    const slotDuration = 30; // minutos

    for (const rule of rulesForDay) {
      const startMinutes = timeToMinutes(rule.hora_inicio);
      const endMinutes = timeToMinutes(rule.hora_fim);

      for (let m = startMinutes; m < endMinutes; m += slotDuration) {
        const slotTime = minutesToTime(m);
        const slotEndTime = minutesToTime(m + slotDuration);
        
        // Evita duplicatas
        if (!slotsList.some((s) => s.time === slotTime)) {
          slotsList.push({ time: slotTime, endTime: slotEndTime });
        }
      }
    }

    // Ordena por horário
    slotsList.sort((a, b) => timeToMinutes(a.time) - timeToMinutes(b.time));

    return slotsList;
  }, [doctorRules, selectedDate, tipoAtendimento]);

  // Verifica se um slot está ocupado
  const getAppointmentForSlot = (slotTime: string, slotEndTime: string): Appointment | undefined => {
    const slotStart = timeToMinutes(slotTime);
    const slotEnd = timeToMinutes(slotEndTime);

    return appointments.find((apt) => {
      // Ignora cancelados na verificação de conflito visual
      if (apt.status === 'cancelado') return false;
      
      const aptStart = timeToMinutes(apt.hora_inicio);
      const aptEnd = timeToMinutes(apt.hora_fim);

      // Verifica sobreposição
      return aptStart < slotEnd && aptEnd > slotStart;
    });
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  if (slots.length === 0) {
    return (
      <div className="text-center py-12 text-muted-foreground">
        <p className="text-lg font-medium">Sem horários disponíveis</p>
        <p className="text-sm mt-1">
          O médico não possui regras de atendimento para este dia da semana ou tipo de atendimento.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-2">
      {slots.map((slot) => {
        const appointment = getAppointmentForSlot(slot.time, slot.endTime);
        const isAvailable = !appointment;

        return (
          <AgendaSlot
            key={slot.time}
            time={slot.time}
            isAvailable={isAvailable}
            appointment={appointment}
            onClick={() => isAvailable && onSlotClick(slot.time)}
            onAppointmentClick={onAppointmentClick}
          />
        );
      })}
    </div>
  );
}
