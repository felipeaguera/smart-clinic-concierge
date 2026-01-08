import { cn } from '@/lib/utils';

interface Appointment {
  id: string;
  hora_inicio: string;
  hora_fim: string;
  status: string;
  paciente_nome?: string | null;
  paciente_telefone?: string | null;
  exam_types?: { id: string; nome: string; duracao_minutos: number };
}

interface AgendaAppointmentCardProps {
  appointment: Appointment;
  onClick: () => void;
}

const STATUS_COLORS: Record<string, { bg: string; text: string }> = {
  reservado: { bg: 'bg-sky-700', text: 'text-sky-50' },
  confirmado: { bg: 'bg-emerald-700', text: 'text-emerald-50' },
  em_atendimento: { bg: 'bg-violet-700', text: 'text-violet-50' },
  finalizado: { bg: 'bg-slate-500', text: 'text-slate-50' },
  cancelado: { bg: 'bg-red-600', text: 'text-red-50' },
};

export function AgendaAppointmentCard({ appointment, onClick }: AgendaAppointmentCardProps) {
  const colors = STATUS_COLORS[appointment.status] || STATUS_COLORS.reservado;
  const patientName = appointment.paciente_nome || 'PACIENTE NÃO INFORMADO';
  const examName = appointment.exam_types?.nome || '';

  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        'w-full rounded-lg px-3 py-2 text-left transition-all hover:opacity-90 cursor-pointer',
        colors.bg,
        colors.text
      )}
    >
      <div className="font-bold uppercase text-sm truncate">
        {patientName}
      </div>
      {examName && (
        <div className="text-xs opacity-90 truncate mt-0.5">
          {examName}
        </div>
      )}
    </button>
  );
}
