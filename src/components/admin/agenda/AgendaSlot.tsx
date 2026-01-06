import { cn } from '@/lib/utils';
import { Badge } from '@/components/ui/badge';

interface Appointment {
  id: string;
  hora_inicio: string;
  hora_fim: string;
  status: string;
  paciente_nome?: string | null;
  exam_types?: { nome: string };
}

interface AgendaSlotProps {
  time: string;
  isAvailable: boolean;
  appointment?: Appointment;
  onClick?: () => void;
  onAppointmentClick?: (appointment: Appointment) => void;
  disabled?: boolean;
}

const STATUS_STYLES = {
  reservado: 'bg-amber-50 border-amber-400 hover:bg-amber-100 dark:bg-amber-900/30 dark:border-amber-600 dark:hover:bg-amber-900/50',
  confirmado: 'bg-blue-50 border-blue-400 hover:bg-blue-100 dark:bg-blue-900/30 dark:border-blue-600 dark:hover:bg-blue-900/50',
  cancelado: 'bg-red-50 border-red-400 hover:bg-red-100 dark:bg-red-900/30 dark:border-red-600 dark:hover:bg-red-900/50 opacity-60',
};

const STATUS_TEXT_STYLES = {
  reservado: 'text-amber-700 dark:text-amber-300',
  confirmado: 'text-blue-700 dark:text-blue-300',
  cancelado: 'text-red-700 dark:text-red-300 line-through',
};

export function AgendaSlot({ 
  time, 
  isAvailable, 
  appointment, 
  onClick, 
  onAppointmentClick,
  disabled 
}: AgendaSlotProps) {
  if (!isAvailable && appointment) {
    const statusStyle = STATUS_STYLES[appointment.status as keyof typeof STATUS_STYLES] || STATUS_STYLES.reservado;
    const textStyle = STATUS_TEXT_STYLES[appointment.status as keyof typeof STATUS_TEXT_STYLES] || STATUS_TEXT_STYLES.reservado;
    
    return (
      <button
        onClick={() => onAppointmentClick?.(appointment)}
        className={cn(
          'w-full p-3 border-l-4 rounded-r-md transition-all text-left cursor-pointer',
          statusStyle
        )}
      >
        <div className="flex items-center justify-between">
          <div className="flex flex-col">
            <span className={cn('font-semibold text-sm', textStyle)}>
              {appointment.paciente_nome || 'Paciente não informado'}
            </span>
            <span className={cn('text-xs mt-0.5', textStyle)}>
              {appointment.hora_inicio} - {appointment.hora_fim} • {appointment.exam_types?.nome || 'Sem exame'}
            </span>
          </div>
          <Badge 
            variant={
              appointment.status === 'confirmado' ? 'default' : 
              appointment.status === 'cancelado' ? 'destructive' : 'secondary'
            }
            className="text-xs"
          >
            {appointment.status}
          </Badge>
        </div>
      </button>
    );
  }

  return (
    <button
      onClick={onClick}
      disabled={disabled}
      className={cn(
        'w-full p-3 border-l-4 rounded-r-md transition-all text-left',
        'bg-emerald-50 border-emerald-400 text-emerald-700',
        'dark:bg-emerald-900/20 dark:border-emerald-500 dark:text-emerald-300',
        'hover:bg-emerald-100 hover:border-emerald-500 dark:hover:bg-emerald-900/40',
        'focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:ring-offset-1',
        disabled && 'opacity-50 cursor-not-allowed'
      )}
    >
      <span className="font-medium text-sm">{time}</span>
      <span className="text-xs ml-2 opacity-75">Disponível</span>
    </button>
  );
}
