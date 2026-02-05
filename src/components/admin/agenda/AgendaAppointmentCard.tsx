import { cn } from '@/lib/utils';
import { Clock, User, Stethoscope, UserPlus } from 'lucide-react';

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

interface AgendaAppointmentCardProps {
  appointment: Appointment;
  onClick: () => void;
  compact?: boolean;
  compactMode?: boolean; // New: for agenda-wide compact mode
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

// Encaixe override styles
const ENCAIXE_CONFIG = {
  bg: 'bg-amber-50',
  border: 'border-l-amber-500',
  text: 'text-amber-900',
};

function timeToMinutes(time: string): number {
  const [hours, minutes] = time.split(':').map(Number);
  return hours * 60 + minutes;
}

export function AgendaAppointmentCard({ appointment, onClick, compact = false, compactMode = false }: AgendaAppointmentCardProps) {
  const isEncaixe = appointment.is_encaixe === true;
  
  // Use encaixe colors if it's an encaixe, otherwise use status colors
  const config = isEncaixe 
    ? { ...ENCAIXE_CONFIG, label: STATUS_CONFIG[appointment.status]?.label || 'Reservado' }
    : (STATUS_CONFIG[appointment.status] || STATUS_CONFIG.reservado);
    
  const patientName = appointment.paciente_nome || 'Paciente não informado';
  const examName = appointment.exam_types?.nome || '';
  
  // Calculate duration from hora_inicio and hora_fim
  const durationMinutes = timeToMinutes(appointment.hora_fim) - timeToMinutes(appointment.hora_inicio);

  // Ultra compact for print/compactMode - single line
  if (compactMode) {
    return (
      <button
        type="button"
        onClick={onClick}
        className={cn(
          'w-full rounded border-l-3 px-1.5 py-0.5 text-left transition-all hover:shadow cursor-pointer flex items-center gap-2',
          isEncaixe ? ENCAIXE_CONFIG.bg : config.bg,
          isEncaixe ? ENCAIXE_CONFIG.border : config.border,
          isEncaixe ? ENCAIXE_CONFIG.text : config.text
        )}
      >
        {isEncaixe && (
          <UserPlus className="h-2.5 w-2.5 text-amber-600 shrink-0" />
        )}
        <span className="font-semibold text-[11px] truncate flex-1">
          {patientName}
        </span>
        <span className="text-[10px] opacity-70 truncate max-w-[80px]">
          {examName}
        </span>
        <span className="text-[10px] opacity-60 shrink-0">
          {durationMinutes}min
        </span>
        {isEncaixe && (
          <span className="text-[8px] font-medium bg-amber-200 text-amber-800 px-0.5 rounded shrink-0">
            E
          </span>
        )}
      </button>
    );
  }

  // Compact version for side-by-side display
  if (compact) {
    return (
      <button
        type="button"
        onClick={onClick}
        className={cn(
          'w-full rounded-md border-l-4 px-1.5 py-1 text-left transition-all hover:shadow-md cursor-pointer',
          isEncaixe ? ENCAIXE_CONFIG.bg : config.bg,
          isEncaixe ? ENCAIXE_CONFIG.border : config.border,
          isEncaixe ? ENCAIXE_CONFIG.text : config.text
        )}
      >
        <div className="flex items-center gap-1">
          {isEncaixe && (
            <UserPlus className="h-3 w-3 text-amber-600 shrink-0" />
          )}
          <span className="font-semibold text-xs truncate">
            {patientName.split(' ')[0]}
          </span>
          {isEncaixe && (
            <span className="text-[9px] font-medium bg-amber-200 text-amber-800 px-0.5 rounded shrink-0">
              E
            </span>
          )}
        </div>
        <div className="flex items-center gap-1 mt-0.5 text-[10px] opacity-80">
          <Clock className="h-2.5 w-2.5 shrink-0" />
          <span>{durationMinutes}min</span>
        </div>
      </button>
    );
  }

  // Full version
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        'w-full rounded-md border-l-4 px-2.5 py-1.5 text-left transition-all hover:shadow-md cursor-pointer',
        isEncaixe ? ENCAIXE_CONFIG.bg : config.bg,
        isEncaixe ? ENCAIXE_CONFIG.border : config.border,
        isEncaixe ? ENCAIXE_CONFIG.text : config.text
      )}
    >
      {/* Header with encaixe indicator */}
      <div className="flex items-center gap-1.5">
        {isEncaixe && (
          <UserPlus className="h-3 w-3 text-amber-600 shrink-0" />
        )}
        <User className="h-3 w-3 opacity-70 shrink-0" />
        <span className="font-semibold text-sm truncate">
          {patientName}
        </span>
        {isEncaixe && (
          <span className="text-[10px] font-medium bg-amber-200 text-amber-800 px-1 py-0.5 rounded shrink-0">
            ENCAIXE
          </span>
        )}
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
