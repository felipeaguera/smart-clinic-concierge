import { useState, useEffect } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { useToast } from '@/hooks/use-toast';
import { Loader2 } from 'lucide-react';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';

interface ExamType {
  id: string;
  nome: string;
  categoria: string;
  duracao_minutos: number;
}

interface Doctor {
  id: string;
  nome: string;
}

interface NovoAgendamentoModalProps {
  isOpen: boolean;
  onClose: () => void;
  selectedDate: Date;
  selectedTime: string;
  doctor: Doctor;
  tipoAtendimento: 'consulta' | 'ultrassom';
  examTypes: ExamType[];
}

const STATUS_OPTIONS = [
  { value: 'reservado', label: 'Reservado' },
  { value: 'confirmado', label: 'Confirmado' },
];

export function NovoAgendamentoModal({
  isOpen,
  onClose,
  selectedDate,
  selectedTime,
  doctor,
  tipoAtendimento,
  examTypes,
}: NovoAgendamentoModalProps) {
  const [examTypeId, setExamTypeId] = useState('');
  const [status, setStatus] = useState('reservado');
  const { toast } = useToast();
  const queryClient = useQueryClient();

  // Filtra exames pela categoria compatível
  const filteredExamTypes = examTypes.filter((exam) => {
    if (tipoAtendimento === 'consulta') {
      return exam.categoria === 'consulta';
    }
    return exam.categoria === 'ultrassom';
  });

  // Reset form quando modal abre
  useEffect(() => {
    if (isOpen) {
      setExamTypeId('');
      setStatus('reservado');
    }
  }, [isOpen]);

  const selectedExam = examTypes.find((e) => e.id === examTypeId);

  // Calcula hora fim baseado na duração do exame
  const calculateEndTime = (): string => {
    if (!selectedExam) return '';
    
    const [hours, minutes] = selectedTime.split(':').map(Number);
    const totalMinutes = hours * 60 + minutes + selectedExam.duracao_minutos;
    const endHours = Math.floor(totalMinutes / 60);
    const endMinutes = totalMinutes % 60;
    
    return `${endHours.toString().padStart(2, '0')}:${endMinutes.toString().padStart(2, '0')}`;
  };

  const mutation = useMutation({
    mutationFn: async () => {
      const horaFim = calculateEndTime();
      
      const { error } = await supabase.from('appointments').insert({
        doctor_id: doctor.id,
        exam_type_id: examTypeId,
        data: format(selectedDate, 'yyyy-MM-dd'),
        hora_inicio: selectedTime,
        hora_fim: horaFim,
        status,
      });
      
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['appointments'] });
      toast({ title: 'Sucesso', description: 'Agendamento criado com sucesso!' });
      onClose();
    },
    onError: (error: Error) => {
      toast({
        title: 'Erro ao criar agendamento',
        description: error.message,
        variant: 'destructive',
      });
    },
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!examTypeId) {
      toast({
        title: 'Erro',
        description: 'Selecione um tipo de exame/consulta',
        variant: 'destructive',
      });
      return;
    }

    mutation.mutate();
  };

  const endTime = calculateEndTime();

  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Novo Agendamento</DialogTitle>
        </DialogHeader>
        
        <form onSubmit={handleSubmit} className="space-y-4">
          {/* Informações pré-preenchidas (não editáveis) */}
          <div className="space-y-3 p-4 bg-muted/50 rounded-lg">
            <div className="flex justify-between">
              <span className="text-sm text-muted-foreground">Médico:</span>
              <span className="text-sm font-medium">{doctor.nome}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-sm text-muted-foreground">Data:</span>
              <span className="text-sm font-medium">
                {format(selectedDate, "EEEE, dd 'de' MMMM", { locale: ptBR })}
              </span>
            </div>
            <div className="flex justify-between">
              <span className="text-sm text-muted-foreground">Horário:</span>
              <span className="text-sm font-medium">
                {selectedTime}
                {endTime && ` - ${endTime}`}
              </span>
            </div>
            <div className="flex justify-between">
              <span className="text-sm text-muted-foreground">Tipo:</span>
              <span className="text-sm font-medium capitalize">{tipoAtendimento}</span>
            </div>
          </div>

          {/* Tipo de Exame/Consulta */}
          <div className="space-y-2">
            <Label>
              {tipoAtendimento === 'consulta' ? 'Tipo de Consulta' : 'Tipo de Ultrassom'}
            </Label>
            <Select value={examTypeId} onValueChange={setExamTypeId}>
              <SelectTrigger>
                <SelectValue placeholder="Selecione..." />
              </SelectTrigger>
              <SelectContent>
                {filteredExamTypes.map((exam) => (
                  <SelectItem key={exam.id} value={exam.id}>
                    {exam.nome} ({exam.duracao_minutos} min)
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* Status */}
          <div className="space-y-2">
            <Label>Status</Label>
            <Select value={status} onValueChange={setStatus}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {STATUS_OPTIONS.map((option) => (
                  <SelectItem key={option.value} value={option.value}>
                    {option.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* Ações */}
          <div className="flex gap-2 justify-end pt-4">
            <Button type="button" variant="outline" onClick={onClose}>
              Cancelar
            </Button>
            <Button type="submit" disabled={mutation.isPending || !examTypeId}>
              {mutation.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Confirmar Agendamento
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
