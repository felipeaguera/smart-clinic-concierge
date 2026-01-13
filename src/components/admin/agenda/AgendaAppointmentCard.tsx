import { cn } from '@/lib/utils';
import { Clock, User, Stethoscope } from 'lucide-react';

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

const STATUS_CONFIG: Record<string, { bg: string; border: string; text: string; label: string }> = {
  reservado: { 
    bg: 'bg-blue-50', 
    border: 'border-l-blue-500', 
    text: 'text-blue-900',
    label: 'Reservado'
  },
  confirmado: { 
    bg: 'bg-emerald-50', 
    border: 'border-l-emerald-500', 
    text: 'text-emerald-900',
    label: 'Confirmado'
  },
  em_atendimento: { 
    bg: 'bg-violet-50', 
    border: 'border-l-violet-500', 
    text: 'text-violet-900',
    label: 'Em Atendimento'
  },
  finalizado: { 
    bg: 'bg-slate-100', 
    border: 'border-l-slate-400', 
    text: 'text-slate-700',
    label: 'Finalizado'
  },
  cancelado: { 
    bg: 'bg-red-50', 
    border: 'border-l-red-500', 
    text: 'text-red-900',
    label: 'Cancelado'
  },
};

function timeToMinutes(time: string): number {
  const [hours, minutes] = time.split(':').map(Number);
  return hours * 60 + minutes;
}

export function AgendaAppointmentCard({ appointment, onClick }: AgendaAppointmentCardProps) {
  const config = STATUS_CONFIG[appointment.status] || STATUS_CONFIG.reservado;
  const patientName = appointment.paciente_nome || 'Paciente não informado';
  const examName = appointment.exam_types?.nome || '';
  
  // Calculate duration from hora_inicio and hora_fim
  const durationMinutes = timeToMinutes(appointment.hora_fim) - timeToMinutes(appointment.hora_inicio);

  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        'w-full rounded-md border-l-4 px-2.5 py-1.5 text-left transition-all hover:shadow-md cursor-pointer',
        config.bg,
        config.border,
        config.text
      )}
    >
      {/* Patient name */}
      <div className="flex items-center gap-1.5">
        <User className="h-3 w-3 opacity-70 shrink-0" />
        <span className="font-semibold text-sm truncate">
          {patientName}
        </span>
      </div>
      
      {/* Exam and duration */}
      <div className="flex items-center justify-between mt-1 text-xs opacity-80">
        <div className="flex items-center gap-1 truncate">
          <Stethoscope className="h-3 w-3 shrink-0" />
          <span className="truncate">{examName || 'Exame'}</span>
        </div>
        <div className="flex items-center gap-1 shrink-0 ml-2">
          <Clock className="h-3 w-3" />
          <span>{durationMinutes}min</span>
        </div>
      </div>
    </button>
  );
}
