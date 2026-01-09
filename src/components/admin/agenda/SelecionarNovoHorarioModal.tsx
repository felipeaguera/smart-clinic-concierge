import { useState, useEffect, useMemo } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { format, addDays } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Calendar } from '@/components/ui/calendar';
import { ScrollArea } from '@/components/ui/scroll-area';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { Loader2, Clock, CheckCircle } from 'lucide-react';
import { cn } from '@/lib/utils';

interface Appointment {
  id: string;
  hora_inicio: string;
  hora_fim: string;
  status: string;
  paciente_nome?: string | null;
  exam_types?: { id: string; nome: string; duracao_minutos: number };
}

interface Doctor {
  id: string;
  nome: string;
}

interface DoctorRule {
  id: string;
  hora_inicio: string;
  hora_fim: string;
  dia_semana: number;
  tipo_atendimento: string;
}

interface SelecionarNovoHorarioModalProps {
  isOpen: boolean;
  onClose: () => void;
  appointment: Appointment | null;
  doctor: Doctor | null;
  tipoAtendimento: 'consulta' | 'ultrassom';
  onSuccess: () => void;
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

export function SelecionarNovoHorarioModal({
  isOpen,
  onClose,
  appointment,
  doctor,
  tipoAtendimento,
  onSuccess,
}: SelecionarNovoHorarioModalProps) {
  const queryClient = useQueryClient();
  const [selectedDate, setSelectedDate] = useState<Date>(new Date());
  const [selectedTime, setSelectedTime] = useState<string | null>(null);

  const examDuration = appointment?.exam_types?.duracao_minutos || 30;

  // Reset quando abre
  useEffect(() => {
    if (isOpen) {
      setSelectedDate(new Date());
      setSelectedTime(null);
    }
  }, [isOpen]);

  // Busca regras do médico
  const { data: doctorRules = [] } = useQuery({
    queryKey: ['doctor-rules', doctor?.id],
    queryFn: async () => {
      if (!doctor) return [];
      const { data, error } = await supabase
        .from('doctor_rules')
        .select('*')
        .eq('doctor_id', doctor.id);
      if (error) throw error;
      return data as DoctorRule[];
    },
    enabled: isOpen && !!doctor,
  });

  // Busca agendamentos da data selecionada
  const { data: appointments = [], isLoading: isLoadingAppointments } = useQuery({
    queryKey: ['appointments', doctor?.id, format(selectedDate, 'yyyy-MM-dd')],
    queryFn: async () => {
      if (!doctor) return [];
      const { data, error } = await supabase
        .from('appointments')
        .select('id, hora_inicio, hora_fim, status')
        .eq('doctor_id', doctor.id)
        .eq('data', format(selectedDate, 'yyyy-MM-dd'))
        .neq('status', 'cancelado');
      if (error) throw error;
      return data;
    },
    enabled: isOpen && !!doctor,
  });

  // Calcula horários disponíveis
  const availableSlots = useMemo(() => {
    const dayOfWeek = selectedDate.getDay();
    
    const rulesForDay = doctorRules.filter(
      (rule) =>
        rule.dia_semana === dayOfWeek &&
        (rule.tipo_atendimento === 'ambos' || rule.tipo_atendimento === tipoAtendimento)
    );

    if (rulesForDay.length === 0) return [];

    // Encontra range do dia
    let dayStart = Infinity;
    let dayEnd = 0;
    for (const rule of rulesForDay) {
      const start = timeToMinutes(rule.hora_inicio);
      const end = timeToMinutes(rule.hora_fim);
      if (start < dayStart) dayStart = start;
      if (end > dayEnd) dayEnd = end;
    }

    // Filtra agendamentos (exceto o atual sendo reagendado)
    const otherAppointments = appointments
      .filter(apt => apt.id !== appointment?.id)
      .sort((a, b) => timeToMinutes(a.hora_inicio) - timeToMinutes(b.hora_inicio));

    // Gera slots livres
    const slots: { time: string; endTime: string }[] = [];
    let cursor = dayStart;

    for (const apt of otherAppointments) {
      const aptStart = timeToMinutes(apt.hora_inicio);
      const aptEnd = timeToMinutes(apt.hora_fim);

      // Verifica espaço antes deste agendamento
      while (cursor + examDuration <= aptStart) {
        slots.push({
          time: minutesToTime(cursor),
          endTime: minutesToTime(cursor + examDuration),
        });
        cursor += 10; // Step de 10 min para mais opções
      }

      cursor = Math.max(cursor, aptEnd);
    }

    // Slots no final do dia
    while (cursor + examDuration <= dayEnd) {
      slots.push({
        time: minutesToTime(cursor),
        endTime: minutesToTime(cursor + examDuration),
      });
      cursor += 10;
    }

    // Remove duplicatas
    const uniqueSlots = slots.filter(
      (slot, index, self) => index === self.findIndex((s) => s.time === slot.time)
    );

    return uniqueSlots;
  }, [doctorRules, appointments, selectedDate, tipoAtendimento, examDuration, appointment?.id]);

  const rescheduleMutation = useMutation({
    mutationFn: async () => {
      if (!appointment || !selectedTime) throw new Error('Dados incompletos');

      const endTime = minutesToTime(timeToMinutes(selectedTime) + examDuration);

      const { error } = await supabase
        .from('appointments')
        .update({
          data: format(selectedDate, 'yyyy-MM-dd'),
          hora_inicio: selectedTime,
          hora_fim: endTime,
        })
        .eq('id', appointment.id);

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['appointments'] });
      toast.success('Agendamento reagendado com sucesso!');
      onSuccess();
    },
    onError: (error) => {
      console.error('Erro ao reagendar:', error);
      toast.error('Erro ao reagendar. Tente novamente.');
    },
  });

  const handleConfirm = () => {
    if (!selectedTime) {
      toast.error('Selecione um horário');
      return;
    }
    rescheduleMutation.mutate();
  };

  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="sm:max-w-2xl">
        <DialogHeader>
          <DialogTitle>Alterar Horário</DialogTitle>
        </DialogHeader>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 py-4">
          {/* Calendário */}
          <div>
            <p className="text-sm font-medium mb-2">Selecione a data:</p>
            <Calendar
              mode="single"
              selected={selectedDate}
              onSelect={(date) => {
                if (date) {
                  setSelectedDate(date);
                  setSelectedTime(null);
                }
              }}
              locale={ptBR}
              disabled={(date) => date < new Date(new Date().setHours(0, 0, 0, 0))}
              className="rounded-md border"
            />
          </div>

          {/* Lista de horários */}
          <div>
            <p className="text-sm font-medium mb-2">
              Horários disponíveis em{' '}
              {format(selectedDate, "dd 'de' MMMM", { locale: ptBR })}:
            </p>
            
            {isLoadingAppointments ? (
              <div className="flex items-center justify-center py-8">
                <Loader2 className="h-6 w-6 animate-spin text-primary" />
              </div>
            ) : availableSlots.length === 0 ? (
              <div className="text-center py-8 text-muted-foreground">
                <p>Nenhum horário disponível nesta data.</p>
                <p className="text-sm mt-1">Selecione outra data no calendário.</p>
              </div>
            ) : (
              <ScrollArea className="h-[280px] pr-4">
                <div className="space-y-2">
                  {availableSlots.map((slot) => (
                    <button
                      key={slot.time}
                      type="button"
                      onClick={() => setSelectedTime(slot.time)}
                      className={cn(
                        'w-full p-3 rounded-lg border text-left transition-all flex items-center justify-between',
                        selectedTime === slot.time
                          ? 'border-primary bg-primary/10'
                          : 'border-border hover:border-primary/50 hover:bg-muted/50'
                      )}
                    >
                      <div className="flex items-center gap-2">
                        <Clock className="h-4 w-4 text-muted-foreground" />
                        <span className="font-medium">
                          {slot.time} - {slot.endTime}
                        </span>
                      </div>
                      {selectedTime === slot.time && (
                        <CheckCircle className="h-5 w-5 text-primary" />
                      )}
                    </button>
                  ))}
                </div>
              </ScrollArea>
            )}
          </div>
        </div>

        {/* Resumo da mudança */}
        {selectedTime && (
          <div className="bg-muted/50 p-3 rounded-lg text-sm">
            <p className="font-medium mb-1">Resumo do reagendamento:</p>
            <p>
              <strong>Nova Data:</strong>{' '}
              {format(selectedDate, "EEEE, dd 'de' MMMM", { locale: ptBR })}
            </p>
            <p>
              <strong>Novo Horário:</strong> {selectedTime} -{' '}
              {minutesToTime(timeToMinutes(selectedTime) + examDuration)}
            </p>
          </div>
        )}

        <DialogFooter>
          <Button variant="outline" onClick={onClose}>
            Cancelar
          </Button>
          <Button
            onClick={handleConfirm}
            disabled={!selectedTime || rescheduleMutation.isPending}
          >
            {rescheduleMutation.isPending ? 'Salvando...' : 'Confirmar Reagendamento'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
