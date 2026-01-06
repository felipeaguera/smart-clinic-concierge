import { Badge } from '@/components/ui/badge';
import { Clock, User } from 'lucide-react';
import { cn } from '@/lib/utils';

interface Appointment {
  id: string;
  hora_inicio: string;
  hora_fim: string;
  status: string;
  paciente_nome?: string | null;
  exam_types?: { id: string; nome: string; duracao_minutos: number };
}

interface AgendaSlotProps {
  time: string;
  endTime: string;
  availableMinutes: number;
  isAvailable: boolean;
  appointment?: Appointment;
  onClick: () => void;
  onAppointmentClick: (appointment: Appointment) => void;
  disabled?: boolean;
}

const STATUS_STYLES: Record<string, string> = {
  reservado: 'bg-amber-50 border-amber-300 hover:bg-amber-100',
  confirmado: 'bg-green-50 border-green-300 hover:bg-green-100',
  em_atendimento: 'bg-blue-50 border-blue-300 hover:bg-blue-100',
  finalizado: 'bg-gray-50 border-gray-300 hover:bg-gray-100',
  cancelado: 'bg-red-50 border-red-300 hover:bg-red-100',
};

const STATUS_BADGE_STYLES: Record<string, string> = {
  reservado: 'bg-amber-100 text-amber-800 border-amber-200',
  confirmado: 'bg-green-100 text-green-800 border-green-200',
  em_atendimento: 'bg-blue-100 text-blue-800 border-blue-200',
  finalizado: 'bg-gray-100 text-gray-800 border-gray-200',
  cancelado: 'bg-red-100 text-red-800 border-red-200',
};

const STATUS_LABELS: Record<string, string> = {
  reservado: 'Reservado',
  confirmado: 'Confirmado',
  em_atendimento: 'Em Atendimento',
  finalizado: 'Finalizado',
  cancelado: 'Cancelado',
};

function formatDuration(minutes: number): string {
  if (minutes >= 60) {
    const hours = Math.floor(minutes / 60);
    const mins = minutes % 60;
    return mins > 0 ? `${hours}h ${mins}min` : `${hours}h`;
  }
  return `${minutes} min`;
}

export function AgendaSlot({
  time,
  endTime,
  availableMinutes,
  isAvailable,
  appointment,
  onClick,
  onAppointmentClick,
  disabled,
}: AgendaSlotProps) {
  if (!isAvailable && appointment) {
    // Calcula duração real a partir de hora_inicio e hora_fim
    const [startH, startM] = time.split(':').map(Number);
    const [endH, endM] = endTime.split(':').map(Number);
    const durationMinutes = (endH * 60 + endM) - (startH * 60 + startM);
    
    return (
      <button
        type="button"
        onClick={() => onAppointmentClick(appointment)}
        disabled={disabled}
        className={cn(
          'w-full p-4 rounded-lg border-2 text-left transition-all',
          STATUS_STYLES[appointment.status] || STATUS_STYLES.reservado,
          disabled && 'opacity-50 cursor-not-allowed'
        )}
      >
        <div className="flex items-start justify-between gap-4">
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 mb-2">
              <Clock className="h-4 w-4 text-muted-foreground shrink-0" />
              <span className="font-semibold text-foreground">
                {time} - {endTime}
              </span>
              <span className="text-sm text-muted-foreground">
                ({formatDuration(durationMinutes)})
              </span>
            </div>
            
            <div className="flex items-center gap-2 mb-1">
              <User className="h-4 w-4 text-muted-foreground shrink-0" />
              <span className="font-medium text-foreground truncate">
                {appointment.paciente_nome || 'Paciente não informado'}
              </span>
            </div>
            
            {appointment.exam_types && (
              <p className="text-sm text-muted-foreground ml-6">
                {appointment.exam_types.nome}
              </p>
            )}
          </div>
          
          <Badge 
            variant="outline" 
            className={cn(
              'shrink-0',
              STATUS_BADGE_STYLES[appointment.status] || STATUS_BADGE_STYLES.reservado
            )}
          >
            {STATUS_LABELS[appointment.status] || appointment.status}
          </Badge>
        </div>
      </button>
    );
  }

  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      className={cn(
        'w-full p-4 rounded-lg border-2 border-dashed text-left transition-all',
        'bg-emerald-50/50 border-emerald-300 hover:bg-emerald-100 hover:border-emerald-400',
        disabled && 'opacity-50 cursor-not-allowed'
      )}
    >
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Clock className="h-4 w-4 text-emerald-600" />
          <span className="font-semibold text-emerald-700">
            {time} - {endTime}
          </span>
        </div>
        
        <div className="flex items-center gap-2">
          <Badge variant="outline" className="bg-emerald-100 text-emerald-800 border-emerald-300">
            {formatDuration(availableMinutes)} disponíveis
          </Badge>
          <span className="text-sm text-emerald-600 font-medium">
            Clique para agendar
          </span>
        </div>
      </div>
    </button>
  );
}
