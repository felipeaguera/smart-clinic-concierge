import { Button } from '@/components/ui/button';
import { Switch } from '@/components/ui/switch';
import { Label } from '@/components/ui/label';
import { format, isToday } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { ChevronLeft, ChevronRight, Plus, CalendarCheck, UserPlus, Printer, Minimize2 } from 'lucide-react';

interface AgendaHeaderProps {
  selectedDate: Date;
  onPrevDay: () => void;
  onNextDay: () => void;
  onGoToToday: () => void;
  onNewAppointment: () => void;
  onEncaixe: () => void;
  doctorName?: string;
  tipoAtendimento: 'consulta' | 'ultrassom';
  appointmentCount: number;
  compactMode?: boolean;
  onCompactModeChange?: (compact: boolean) => void;
}

export function AgendaHeader({
  selectedDate,
  onPrevDay,
  onNextDay,
  onGoToToday,
  onNewAppointment,
  onEncaixe,
  doctorName,
  tipoAtendimento,
  appointmentCount,
  compactMode = false,
  onCompactModeChange,
}: AgendaHeaderProps) {
  const todayLabel = isToday(selectedDate) ? 'Hoje, ' : '';

  const handlePrint = () => {
    window.print();
  };

  return (
    <div className="space-y-4">
      {/* Top row: buttons */}
      <div className="flex items-center justify-between no-print">
        <div className="flex items-center gap-2">
          <Button onClick={onNewAppointment} className="bg-emerald-600 hover:bg-emerald-700">
            <Plus className="h-4 w-4 mr-2" />
            Nova Consulta
          </Button>
          <Button 
            onClick={onEncaixe} 
            variant="outline"
            className="border-amber-300 text-amber-700 hover:bg-amber-50"
          >
            <UserPlus className="h-4 w-4 mr-2" />
            Encaixe
          </Button>
          {!isToday(selectedDate) && (
            <Button variant="outline" onClick={onGoToToday}>
              <CalendarCheck className="h-4 w-4 mr-2" />
              Ir para Hoje
            </Button>
          )}
        </div>
        <div className="flex items-center gap-4">
          {/* Compact Mode Toggle */}
          <div className="flex items-center gap-2">
            <Switch
              id="compact-mode"
              checked={compactMode}
              onCheckedChange={onCompactModeChange}
            />
            <Label htmlFor="compact-mode" className="text-sm text-muted-foreground flex items-center gap-1">
              <Minimize2 className="h-3.5 w-3.5" />
              Compacto
            </Label>
          </div>
          {/* Print Button */}
          <Button variant="outline" size="sm" onClick={handlePrint}>
            <Printer className="h-4 w-4 mr-2" />
            Imprimir
          </Button>
        </div>
      </div>

      {/* Appointment count - hidden during print */}
      <div className="text-sm text-muted-foreground text-right no-print">
        {appointmentCount} agendamento{appointmentCount !== 1 ? 's' : ''} no dia
      </div>

      {/* Date navigation */}
      <div className="flex items-center justify-between">
        <Button variant="ghost" size="icon" onClick={onPrevDay} className="no-print">
          <ChevronLeft className="h-5 w-5" />
        </Button>
        
        <div className="text-center">
          <h2 className="text-xl font-semibold capitalize">
            {todayLabel}
            {format(selectedDate, "EEEE", { locale: ptBR })}
          </h2>
          <p className="text-muted-foreground">
            {format(selectedDate, "dd 'de' MMMM 'de' yyyy", { locale: ptBR })}
          </p>
        </div>

        <Button variant="ghost" size="icon" onClick={onNextDay} className="no-print">
          <ChevronRight className="h-5 w-5" />
        </Button>
      </div>

      {/* Doctor and type info */}
      {doctorName && (
        <div className="text-center text-sm text-muted-foreground">
          Agenda de <span className="font-medium text-foreground">{doctorName}</span> - {tipoAtendimento === 'consulta' ? 'Consultas' : 'Ultrassom'}
        </div>
      )}
    </div>
  );
}
