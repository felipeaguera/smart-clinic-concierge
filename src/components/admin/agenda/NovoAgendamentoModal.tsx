import { useState, useEffect, useMemo } from 'react';
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
import { Input } from '@/components/ui/input';
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
  slotEndTime: string;
  availableMinutes: number;
  doctor: Doctor;
  tipoAtendimento: 'consulta' | 'ultrassom';
  examTypes: ExamType[];
}

const STATUS_OPTIONS = [
  { value: 'reservado', label: 'Reservado' },
  { value: 'confirmado', label: 'Confirmado' },
];

// Converte time string para minutos
function timeToMinutes(time: string): number {
  const [h, m] = time.split(':').map(Number);
  return h * 60 + m;
}

// Converte minutos para time string
function minutesToTime(minutes: number): string {
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  return `${h.toString().padStart(2, '0')}:${m.toString().padStart(2, '0')}`;
}

export function NovoAgendamentoModal({
  isOpen,
  onClose,
  selectedDate,
  selectedTime,
  slotEndTime,
  availableMinutes,
  doctor,
  tipoAtendimento,
  examTypes,
}: NovoAgendamentoModalProps) {
  const [pacienteNome, setPacienteNome] = useState('');
  const [pacienteTelefone, setPacienteTelefone] = useState('');
  const [examTypeId, setExamTypeId] = useState('');
  const [chosenTime, setChosenTime] = useState(selectedTime);
  const [status, setStatus] = useState('reservado');
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const selectedExam = examTypes.find((e) => e.id === examTypeId);

  // Filtra exames pela categoria compatível E que cabem no tempo restante
  const filteredExamTypes = examTypes.filter((exam) => {
    const categoryMatch = tipoAtendimento === 'consulta' 
      ? exam.categoria === 'consulta' 
      : exam.categoria === 'ultrassom';
    
    // Calcula quanto tempo resta a partir do horário escolhido
    const chosenMinutes = timeToMinutes(chosenTime);
    const slotEndMinutes = timeToMinutes(slotEndTime);
    const remainingMinutes = slotEndMinutes - chosenMinutes;
    
    return categoryMatch && exam.duracao_minutos <= remainingMinutes;
  });

  // Gera opções de horário dentro do slot livre (intervalos de 15 min)
  const timeOptions = useMemo(() => {
    const options: string[] = [];
    const startMinutes = timeToMinutes(selectedTime);
    const endMinutes = timeToMinutes(slotEndTime);
    
    // Gera horários de 15 em 15 minutos
    for (let m = startMinutes; m < endMinutes; m += 15) {
      options.push(minutesToTime(m));
    }
    
    return options;
  }, [selectedTime, slotEndTime]);

  // Reset form quando modal abre
  useEffect(() => {
    if (isOpen) {
      setPacienteNome('');
      setPacienteTelefone('');
      setExamTypeId('');
      setChosenTime(selectedTime);
      setStatus('reservado');
    }
  }, [isOpen, selectedTime]);

  // Calcula hora fim baseado na duração do exame e horário escolhido
  const calculateEndTime = (): string => {
    if (!selectedExam) return '';
    
    const totalMinutes = timeToMinutes(chosenTime) + selectedExam.duracao_minutos;
    return minutesToTime(totalMinutes);
  };

  const mutation = useMutation({
    mutationFn: async () => {
      const horaFim = calculateEndTime();
      
      const { error } = await supabase.from('appointments').insert({
        doctor_id: doctor.id,
        exam_type_id: examTypeId,
        data: format(selectedDate, 'yyyy-MM-dd'),
        hora_inicio: chosenTime,
        hora_fim: horaFim,
        status,
        paciente_nome: pacienteNome.trim() || null,
        paciente_telefone: pacienteTelefone.trim() || null,
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
    
    if (!pacienteNome.trim()) {
      toast({
        title: 'Erro',
        description: 'Informe o nome do paciente',
        variant: 'destructive',
      });
      return;
    }

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
          {/* Informações pré-preenchidas */}
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
              <span className="text-sm text-muted-foreground">Período Livre:</span>
              <span className="text-sm font-medium">
                {selectedTime} - {slotEndTime}
              </span>
            </div>
            <div className="flex justify-between">
              <span className="text-sm text-muted-foreground">Tipo:</span>
              <span className="text-sm font-medium capitalize">{tipoAtendimento}</span>
            </div>
          </div>

          {/* Dados do Paciente */}
          <div className="space-y-4 border-t pt-4">
            <h4 className="font-medium text-sm text-foreground">Dados do Paciente</h4>
            
            <div className="space-y-2">
              <Label htmlFor="paciente-nome">Nome Completo *</Label>
              <Input
                id="paciente-nome"
                value={pacienteNome}
                onChange={(e) => setPacienteNome(e.target.value)}
                placeholder="Nome do paciente"
                maxLength={100}
              />
            </div>
            
            <div className="space-y-2">
              <Label htmlFor="paciente-telefone">Telefone</Label>
              <Input
                id="paciente-telefone"
                value={pacienteTelefone}
                onChange={(e) => setPacienteTelefone(e.target.value)}
                placeholder="(00) 00000-0000"
                maxLength={20}
              />
            </div>
          </div>

          {/* Seletor de Horário */}
          <div className="space-y-2">
            <Label>Horário de Início</Label>
            <Select value={chosenTime} onValueChange={setChosenTime}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {timeOptions.map((time) => (
                  <SelectItem key={time} value={time}>
                    {time}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            {endTime && (
              <p className="text-sm text-muted-foreground">
                Horário final: <span className="font-medium">{endTime}</span>
              </p>
            )}
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
                {filteredExamTypes.length > 0 ? (
                  filteredExamTypes.map((exam) => (
                    <SelectItem key={exam.id} value={exam.id}>
                      {exam.nome} ({exam.duracao_minutos} min)
                    </SelectItem>
                  ))
                ) : (
                  <div className="px-2 py-4 text-sm text-muted-foreground text-center">
                    Nenhum exame cabe no tempo restante
                  </div>
                )}
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
            <Button type="submit" disabled={mutation.isPending || !examTypeId || !pacienteNome.trim()}>
              {mutation.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Confirmar Agendamento
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
