import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
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
  AlertDialogTrigger,
} from '@/components/ui/alert-dialog';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { useToast } from '@/hooks/use-toast';
import { Plus, Pencil, Trash2, Loader2 } from 'lucide-react';

interface AgendaSemanalTabProps {
  doctorId: string;
}

interface DoctorRule {
  id: string;
  dia_semana: number;
  hora_inicio: string;
  hora_fim: string;
  tipo_atendimento: string;
}

const DIAS_SEMANA = [
  { value: 0, label: 'Domingo' },
  { value: 1, label: 'Segunda-feira' },
  { value: 2, label: 'Terça-feira' },
  { value: 3, label: 'Quarta-feira' },
  { value: 4, label: 'Quinta-feira' },
  { value: 5, label: 'Sexta-feira' },
  { value: 6, label: 'Sábado' },
];

const TIPOS_ATENDIMENTO = [
  { value: 'consulta', label: 'Consultas' },
  { value: 'ultrassom', label: 'Ultrassom' },
  { value: 'ambos', label: 'Ambos' },
];

const generateTimeOptions = () => {
  const options: string[] = [];
  for (let h = 6; h <= 22; h++) {
    for (let m = 0; m < 60; m += 30) {
      options.push(`${h.toString().padStart(2, '0')}:${m.toString().padStart(2, '0')}`);
    }
  }
  return options;
};

const TIME_OPTIONS = generateTimeOptions();

export function AgendaSemanalTab({ doctorId }: AgendaSemanalTabProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [editing, setEditing] = useState<DoctorRule | null>(null);
  const [diaSemana, setDiaSemana] = useState<string>('');
  const [horaInicio, setHoraInicio] = useState('');
  const [horaFim, setHoraFim] = useState('');
  const [tipoAtendimento, setTipoAtendimento] = useState('ambos');
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const { data: rules, isLoading } = useQuery({
    queryKey: ['doctor-rules', doctorId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('doctor_rules')
        .select('*')
        .eq('doctor_id', doctorId)
        .order('dia_semana')
        .order('hora_inicio');
      if (error) throw error;
      return data as DoctorRule[];
    },
  });

  const mutation = useMutation({
    mutationFn: async (data: {
      id?: string;
      dia_semana: number;
      hora_inicio: string;
      hora_fim: string;
      tipo_atendimento: string;
    }) => {
      if (data.id) {
        const { error } = await supabase
          .from('doctor_rules')
          .update({
            dia_semana: data.dia_semana,
            hora_inicio: data.hora_inicio,
            hora_fim: data.hora_fim,
            tipo_atendimento: data.tipo_atendimento,
          })
          .eq('id', data.id);
        if (error) throw error;
      } else {
        const { error } = await supabase.from('doctor_rules').insert({
          doctor_id: doctorId,
          dia_semana: data.dia_semana,
          hora_inicio: data.hora_inicio,
          hora_fim: data.hora_fim,
          tipo_atendimento: data.tipo_atendimento,
        });
        if (error) throw error;
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['doctor-rules', doctorId] });
      toast({ title: editing ? 'Regra atualizada!' : 'Regra criada!' });
      handleClose();
    },
    onError: (error: Error) => {
      toast({ title: 'Erro', description: error.message, variant: 'destructive' });
    },
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from('doctor_rules').delete().eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['doctor-rules', doctorId] });
      toast({ title: 'Regra excluída!' });
    },
    onError: (error: Error) => {
      toast({ title: 'Erro', description: error.message, variant: 'destructive' });
    },
  });

  const handleClose = () => {
    setIsOpen(false);
    setEditing(null);
    setDiaSemana('');
    setHoraInicio('');
    setHoraFim('');
    setTipoAtendimento('ambos');
  };

  const handleEdit = (rule: DoctorRule) => {
    setEditing(rule);
    setDiaSemana(rule.dia_semana.toString());
    setHoraInicio(rule.hora_inicio.slice(0, 5));
    setHoraFim(rule.hora_fim.slice(0, 5));
    setTipoAtendimento(rule.tipo_atendimento);
    setIsOpen(true);
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!diaSemana || !horaInicio || !horaFim) {
      toast({ title: 'Erro', description: 'Preencha todos os campos', variant: 'destructive' });
      return;
    }
    if (horaFim <= horaInicio) {
      toast({ title: 'Erro', description: 'Hora fim deve ser maior que hora início', variant: 'destructive' });
      return;
    }
    mutation.mutate({
      id: editing?.id,
      dia_semana: parseInt(diaSemana),
      hora_inicio: horaInicio,
      hora_fim: horaFim,
      tipo_atendimento: tipoAtendimento,
    });
  };

  const getDiaLabel = (dia: number) => DIAS_SEMANA.find((d) => d.value === dia)?.label || '';
  const getTipoLabel = (tipo: string) => TIPOS_ATENDIMENTO.find((t) => t.value === tipo)?.label || tipo;

  const getTipoBadgeClass = (tipo: string) => {
    switch (tipo) {
      case 'consulta':
        return 'bg-blue-100 text-blue-800';
      case 'ultrassom':
        return 'bg-purple-100 text-purple-800';
      default:
        return 'bg-green-100 text-green-800';
    }
  };

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between">
        <div>
          <CardTitle>Agenda Semanal</CardTitle>
          <CardDescription>Horários recorrentes de atendimento</CardDescription>
        </div>
        <Dialog open={isOpen} onOpenChange={setIsOpen}>
          <DialogTrigger asChild>
            <Button onClick={() => { handleClose(); setIsOpen(true); }}>
              <Plus className="h-4 w-4 mr-2" />
              Nova Regra
            </Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>{editing ? 'Editar Regra' : 'Nova Regra'}</DialogTitle>
            </DialogHeader>
            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="space-y-2">
                <Label>Dia da Semana</Label>
                <Select value={diaSemana} onValueChange={setDiaSemana}>
                  <SelectTrigger>
                    <SelectValue placeholder="Selecione o dia" />
                  </SelectTrigger>
                  <SelectContent>
                    {DIAS_SEMANA.map((dia) => (
                      <SelectItem key={dia.value} value={dia.value.toString()}>
                        {dia.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>Hora Início</Label>
                  <Select value={horaInicio} onValueChange={setHoraInicio}>
                    <SelectTrigger>
                      <SelectValue placeholder="Início" />
                    </SelectTrigger>
                    <SelectContent>
                      {TIME_OPTIONS.map((time) => (
                        <SelectItem key={time} value={time}>
                          {time}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label>Hora Fim</Label>
                  <Select value={horaFim} onValueChange={setHoraFim}>
                    <SelectTrigger>
                      <SelectValue placeholder="Fim" />
                    </SelectTrigger>
                    <SelectContent>
                      {TIME_OPTIONS.map((time) => (
                        <SelectItem key={time} value={time}>
                          {time}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>
              <div className="space-y-2">
                <Label>Tipo de Atendimento</Label>
                <Select value={tipoAtendimento} onValueChange={setTipoAtendimento}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {TIPOS_ATENDIMENTO.map((tipo) => (
                      <SelectItem key={tipo.value} value={tipo.value}>
                        {tipo.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="flex gap-2 justify-end">
                <Button type="button" variant="outline" onClick={handleClose}>
                  Cancelar
                </Button>
                <Button type="submit" disabled={mutation.isPending}>
                  {mutation.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                  Salvar
                </Button>
              </div>
            </form>
          </DialogContent>
        </Dialog>
      </CardHeader>
      <CardContent>
        {isLoading ? (
          <div className="flex justify-center py-8">
            <Loader2 className="h-6 w-6 animate-spin text-primary" />
          </div>
        ) : (
          <div className="rounded-lg border overflow-hidden">
            <Table>
              <TableHeader>
                <TableRow className="bg-muted/50">
                  <TableHead>Dia</TableHead>
                  <TableHead>Horário</TableHead>
                  <TableHead>Tipo</TableHead>
                  <TableHead className="w-[100px]">Ações</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {rules?.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={4} className="text-center text-muted-foreground py-8">
                      Nenhuma regra de agenda cadastrada
                    </TableCell>
                  </TableRow>
                ) : (
                  rules?.map((rule) => (
                    <TableRow key={rule.id}>
                      <TableCell className="font-medium">{getDiaLabel(rule.dia_semana)}</TableCell>
                      <TableCell>
                        {rule.hora_inicio.slice(0, 5)} - {rule.hora_fim.slice(0, 5)}
                      </TableCell>
                      <TableCell>
                        <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium ${getTipoBadgeClass(rule.tipo_atendimento)}`}>
                          {getTipoLabel(rule.tipo_atendimento)}
                        </span>
                      </TableCell>
                      <TableCell>
                        <div className="flex gap-1">
                          <Button variant="ghost" size="sm" onClick={() => handleEdit(rule)}>
                            <Pencil className="h-4 w-4" />
                          </Button>
                          <AlertDialog>
                            <AlertDialogTrigger asChild>
                              <Button variant="ghost" size="sm" className="text-destructive hover:text-destructive">
                                <Trash2 className="h-4 w-4" />
                              </Button>
                            </AlertDialogTrigger>
                            <AlertDialogContent>
                              <AlertDialogHeader>
                                <AlertDialogTitle>Confirmar exclusão</AlertDialogTitle>
                                <AlertDialogDescription>
                                  Tem certeza que deseja excluir esta regra de agenda?
                                </AlertDialogDescription>
                              </AlertDialogHeader>
                              <AlertDialogFooter>
                                <AlertDialogCancel>Cancelar</AlertDialogCancel>
                                <AlertDialogAction
                                  onClick={() => deleteMutation.mutate(rule.id)}
                                  className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                                >
                                  Excluir
                                </AlertDialogAction>
                              </AlertDialogFooter>
                            </AlertDialogContent>
                          </AlertDialog>
                        </div>
                      </TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
