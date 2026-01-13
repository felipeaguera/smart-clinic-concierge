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
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
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
import { Loader2, Trash2, Save, X, CalendarClock } from 'lucide-react';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { SelecionarNovoHorarioModal } from './SelecionarNovoHorarioModal';

interface Appointment {
  id: string;
  hora_inicio: string;
  hora_fim: string;
  status: string;
  paciente_nome?: string | null;
  paciente_telefone?: string | null;
  exam_types?: { id: string; nome: string; duracao_minutos: number };
}

interface Doctor {
  id: string;
  nome: string;
}

interface EditarAgendamentoModalProps {
  isOpen: boolean;
  onClose: () => void;
  appointment: Appointment | null;
  doctor: Doctor;
  selectedDate: Date;
  tipoAtendimento: 'consulta' | 'ultrassom';
}

const STATUS_OPTIONS = [
  { value: 'reservado', label: 'Reservado' },
  { value: 'confirmado', label: 'Confirmado' },
  { value: 'cancelado', label: 'Cancelado' },
];

export function EditarAgendamentoModal({
  isOpen,
  onClose,
  appointment,
  doctor,
  selectedDate,
  tipoAtendimento,
}: EditarAgendamentoModalProps) {
  const [status, setStatus] = useState('');
  const [pacienteNome, setPacienteNome] = useState('');
  const [pacienteTelefone, setPacienteTelefone] = useState('');
  const [showCancelConfirm, setShowCancelConfirm] = useState(false);
  const [showRescheduleModal, setShowRescheduleModal] = useState(false);
  
  const { toast } = useToast();
  const queryClient = useQueryClient();

  // Reset form quando modal abre
  useEffect(() => {
    if (isOpen && appointment) {
      setStatus(appointment.status);
      setPacienteNome(appointment.paciente_nome || '');
      setPacienteTelefone(appointment.paciente_telefone || '');
    }
  }, [isOpen, appointment]);

  const updateMutation = useMutation({
    mutationFn: async (data: { status: string; paciente_nome: string; paciente_telefone: string }) => {
      if (!appointment) return;
      
      const { error } = await supabase
        .from('appointments')
        .update({
          status: data.status,
          paciente_nome: data.paciente_nome || null,
          paciente_telefone: data.paciente_telefone || null,
        })
        .eq('id', appointment.id);
      
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['appointments'] });
      toast({ title: 'Sucesso', description: 'Agendamento atualizado!' });
      onClose();
    },
    onError: (error: Error) => {
      toast({
        title: 'Erro ao atualizar',
        description: error.message,
        variant: 'destructive',
      });
    },
  });

  const deleteMutation = useMutation({
    mutationFn: async () => {
      if (!appointment) return;
      
      const { error } = await supabase
        .from('appointments')
        .delete()
        .eq('id', appointment.id);
      
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['appointments'] });
      toast({ title: 'Sucesso', description: 'Agendamento removido!' });
      setShowCancelConfirm(false);
      onClose();
    },
    onError: (error: Error) => {
      toast({
        title: 'Erro ao remover',
        description: error.message,
        variant: 'destructive',
      });
    },
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    updateMutation.mutate({
      status,
      paciente_nome: pacienteNome.trim(),
      paciente_telefone: pacienteTelefone.trim(),
    });
  };

  const handleDeleteAppointment = () => {
    deleteMutation.mutate();
  };

  const handleRescheduleSuccess = () => {
    setShowRescheduleModal(false);
    onClose();
  };

  if (!appointment) return null;

  return (
    <>
      <Dialog open={isOpen && !showRescheduleModal} onOpenChange={(open) => !open && onClose()}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Editar Agendamento</DialogTitle>
          </DialogHeader>
          
          <form onSubmit={handleSubmit} className="space-y-4">
            {/* Informações do agendamento */}
            <div className="space-y-3 p-4 bg-muted/50 rounded-lg">
              <div className="flex justify-between">
                <span className="text-sm text-muted-foreground">Médico:</span>
                <span className="text-sm font-medium">{doctor.nome}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-sm text-muted-foreground">Data:</span>
                <span className="text-sm font-medium">
                  {format(selectedDate, "dd 'de' MMMM", { locale: ptBR })}
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-sm text-muted-foreground">Horário:</span>
                <span className="text-sm font-medium">
                  {appointment.hora_inicio.slice(0, 5)} - {appointment.hora_fim.slice(0, 5)}
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-sm text-muted-foreground">Exame:</span>
                <span className="text-sm font-medium">
                  {appointment.exam_types?.nome || 'Não informado'}
                </span>
              </div>
            </div>

            {/* Botão para alterar data/horário */}
            <Button
              type="button"
              variant="outline"
              className="w-full"
              onClick={() => setShowRescheduleModal(true)}
            >
              <CalendarClock className="h-4 w-4 mr-2" />
              Alterar Data/Horário
            </Button>

            {/* Nome do Paciente */}
            <div className="space-y-2">
              <Label>Nome do Paciente</Label>
              <Input
                value={pacienteNome}
                onChange={(e) => setPacienteNome(e.target.value)}
                placeholder="Nome do paciente"
              />
            </div>

            {/* Telefone do Paciente */}
            <div className="space-y-2">
              <Label>Telefone do Paciente</Label>
              <Input
                value={pacienteTelefone}
                onChange={(e) => setPacienteTelefone(e.target.value)}
                placeholder="(00) 00000-0000"
              />
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
            <div className="flex gap-2 justify-between pt-4">
              <Button 
                type="button" 
                variant="destructive" 
                onClick={() => setShowCancelConfirm(true)}
              >
                <Trash2 className="h-4 w-4 mr-2" />
                Excluir
              </Button>
              
              <div className="flex gap-2">
                <Button type="button" variant="outline" onClick={onClose}>
                  <X className="h-4 w-4 mr-2" />
                  Fechar
                </Button>
                <Button type="submit" disabled={updateMutation.isPending}>
                  {updateMutation.isPending ? (
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  ) : (
                    <Save className="mr-2 h-4 w-4" />
                  )}
                  Salvar
                </Button>
              </div>
            </div>
          </form>
        </DialogContent>
      </Dialog>

      {/* Modal de reagendamento */}
      <SelecionarNovoHorarioModal
        isOpen={showRescheduleModal}
        onClose={() => setShowRescheduleModal(false)}
        appointment={appointment}
        doctor={doctor}
        tipoAtendimento={tipoAtendimento}
        onSuccess={handleRescheduleSuccess}
      />

      {/* Confirmação de exclusão */}
      <AlertDialog open={showCancelConfirm} onOpenChange={setShowCancelConfirm}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Excluir agendamento?</AlertDialogTitle>
            <AlertDialogDescription>
              Esta ação não pode ser desfeita. O agendamento de{' '}
              <strong>{pacienteNome || 'paciente não informado'}</strong> será 
              permanentemente removido do sistema.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDeleteAppointment}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              {deleteMutation.isPending ? (
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              ) : null}
              Excluir
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
