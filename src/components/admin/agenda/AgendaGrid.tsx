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
  exam_types?: { nome: string; duracao_minutos?: number };
}

interface DynamicSlot {
  time: string;
  endTime: string;
  availableMinutes: number;
  type: 'free' | 'occupied';
  appointment?: Appointment;
}

interface AgendaGridProps {
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

export function AgendaGrid({
  doctorRules,
  appointments,
  selectedDate,
  tipoAtendimento,
  onSlotClick,
  onAppointmentClick,
  isLoading,
}: AgendaGridProps) {
  // Gera slots dinâmicos baseados nos agendamentos reais e regras do médico
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

    // Encontra o range total de horários do dia
    let dayStart = Infinity;
    let dayEnd = 0;
    
    for (const rule of rulesForDay) {
      const start = timeToMinutes(rule.hora_inicio);
      const end = timeToMinutes(rule.hora_fim);
      if (start < dayStart) dayStart = start;
      if (end > dayEnd) dayEnd = end;
    }

    // Filtra agendamentos válidos (não cancelados) e ordena por hora_inicio
    const validAppointments = appointments
      .filter(apt => apt.status !== 'cancelado')
      .sort((a, b) => timeToMinutes(a.hora_inicio) - timeToMinutes(b.hora_inicio));

    const dynamicSlots: DynamicSlot[] = [];
    let cursor = dayStart;

    for (const apt of validAppointments) {
      const aptStart = timeToMinutes(apt.hora_inicio);
      const aptEnd = timeToMinutes(apt.hora_fim);

      // Se há um espaço livre antes deste agendamento
      if (cursor < aptStart) {
        const freeMinutes = aptStart - cursor;
        dynamicSlots.push({
          time: minutesToTime(cursor),
          endTime: minutesToTime(aptStart),
          availableMinutes: freeMinutes,
          type: 'free',
        });
      }

      // Adiciona o slot ocupado
      dynamicSlots.push({
        time: apt.hora_inicio,
        endTime: apt.hora_fim,
        availableMinutes: 0,
        type: 'occupied',
        appointment: apt,
      });

      // Move o cursor para o fim deste agendamento
      cursor = Math.max(cursor, aptEnd);
    }

    // Se sobrou tempo no final do dia
    if (cursor < dayEnd) {
      const freeMinutes = dayEnd - cursor;
      dynamicSlots.push({
        time: minutesToTime(cursor),
        endTime: minutesToTime(dayEnd),
        availableMinutes: freeMinutes,
        type: 'free',
      });
    }

    // Se não há agendamentos, todo o dia está livre
    if (validAppointments.length === 0 && dayStart < dayEnd) {
      dynamicSlots.push({
        time: minutesToTime(dayStart),
        endTime: minutesToTime(dayEnd),
        availableMinutes: dayEnd - dayStart,
        type: 'free',
      });
    }

    return dynamicSlots;
  }, [doctorRules, appointments, selectedDate, tipoAtendimento]);

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
      {slots.map((slot, index) => (
        <AgendaSlot
          key={`${slot.time}-${index}`}
          time={slot.time}
          endTime={slot.endTime}
          availableMinutes={slot.availableMinutes}
          isAvailable={slot.type === 'free'}
          appointment={slot.appointment}
          onClick={() => slot.type === 'free' && onSlotClick(slot.time, slot.availableMinutes, slot.endTime)}
          onAppointmentClick={onAppointmentClick}
        />
      ))}
    </div>
  );
}
