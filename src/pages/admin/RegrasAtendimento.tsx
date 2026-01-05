import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { AdminLayout } from '@/components/admin/AdminLayout';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
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
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { useToast } from '@/hooks/use-toast';
import { Plus, Pencil, Trash2, Loader2 } from 'lucide-react';

interface Doctor {
  id: string;
  nome: string;
}

interface DoctorRule {
  id: string;
  doctor_id: string;
  dia_semana: number;
  hora_inicio: string;
  hora_fim: string;
  tipo_atendimento: string;
}

const TIPOS_ATENDIMENTO = [
  { value: 'consulta', label: 'Consulta' },
  { value: 'ultrassom', label: 'Ultrassom' },
  { value: 'ambos', label: 'Ambos' },
];

const DIAS_SEMANA = [
  { value: 0, label: 'Domingo' },
  { value: 1, label: 'Segunda' },
  { value: 2, label: 'Terça' },
  { value: 3, label: 'Quarta' },
  { value: 4, label: 'Quinta' },
  { value: 5, label: 'Sexta' },
  { value: 6, label: 'Sábado' },
];

export default function RegrasAtendimento() {
  const [selectedDoctor, setSelectedDoctor] = useState<string>('');
  const [isOpen, setIsOpen] = useState(false);
  const [editingRule, setEditingRule] = useState<DoctorRule | null>(null);
  const [diaSemana, setDiaSemana] = useState<string>('');
  const [horaInicio, setHoraInicio] = useState('');
  const [horaFim, setHoraFim] = useState('');
  const [tipoAtendimento, setTipoAtendimento] = useState('ambos');
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const { data: doctors } = useQuery({
    queryKey: ['doctors'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('doctors')
        .select('id, nome')
        .eq('ativo', true)
        .order('nome');
      if (error) throw error;
      return data as Doctor[];
    },
  });

  const { data: rules, isLoading } = useQuery({
    queryKey: ['doctor_rules', selectedDoctor],
    queryFn: async () => {
      if (!selectedDoctor) return [];
      const { data, error } = await supabase
        .from('doctor_rules')
        .select('*')
        .eq('doctor_id', selectedDoctor)
        .order('dia_semana');
      if (error) throw error;
      return data as DoctorRule[];
    },
    enabled: !!selectedDoctor,
  });

  const mutation = useMutation({
    mutationFn: async (data: { doctor_id: string; dia_semana: number; hora_inicio: string; hora_fim: string; tipo_atendimento: string; id?: string }) => {
      if (data.id) {
        const { error } = await supabase
          .from('doctor_rules')
          .update({ dia_semana: data.dia_semana, hora_inicio: data.hora_inicio, hora_fim: data.hora_fim, tipo_atendimento: data.tipo_atendimento })
          .eq('id', data.id);
        if (error) throw error;
      } else {
        const { error } = await supabase
          .from('doctor_rules')
          .insert({ doctor_id: data.doctor_id, dia_semana: data.dia_semana, hora_inicio: data.hora_inicio, hora_fim: data.hora_fim, tipo_atendimento: data.tipo_atendimento });
        if (error) throw error;
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['doctor_rules', selectedDoctor] });
      toast({ title: 'Sucesso', description: editingRule ? 'Regra atualizada!' : 'Regra criada!' });
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
      queryClient.invalidateQueries({ queryKey: ['doctor_rules', selectedDoctor] });
      toast({ title: 'Regra removida' });
    },
    onError: (error: Error) => {
      toast({ title: 'Erro', description: error.message, variant: 'destructive' });
    },
  });

  const handleClose = () => {
    setIsOpen(false);
    setEditingRule(null);
    setDiaSemana('');
    setHoraInicio('');
    setHoraFim('');
    setTipoAtendimento('ambos');
  };

  const handleEdit = (rule: DoctorRule) => {
    setEditingRule(rule);
    setDiaSemana(String(rule.dia_semana));
    setHoraInicio(rule.hora_inicio);
    setHoraFim(rule.hora_fim);
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
      doctor_id: selectedDoctor,
      dia_semana: parseInt(diaSemana, 10),
      hora_inicio: horaInicio,
      hora_fim: horaFim,
      tipo_atendimento: tipoAtendimento,
      id: editingRule?.id,
    });
  };

  const getTipoLabel = (tipo: string) => TIPOS_ATENDIMENTO.find((t) => t.value === tipo)?.label || tipo;

  const getDiaLabel = (dia: number) => DIAS_SEMANA.find((d) => d.value === dia)?.label || '';

  return (
    <AdminLayout title="Regras de Atendimento">
      <div className="space-y-6">
        <Card className="glass-card">
          <CardHeader>
            <CardTitle className="text-lg font-medium">Selecione o Médico</CardTitle>
          </CardHeader>
          <CardContent>
            <Select value={selectedDoctor} onValueChange={setSelectedDoctor}>
              <SelectTrigger className="max-w-md">
                <SelectValue placeholder="Selecione um médico" />
              </SelectTrigger>
              <SelectContent>
                {doctors?.map((doctor) => (
                  <SelectItem key={doctor.id} value={doctor.id}>
                    {doctor.nome}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </CardContent>
        </Card>

        {selectedDoctor && (
          <Card className="glass-card">
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-4">
              <CardTitle className="text-lg font-medium">Regras de Horário</CardTitle>
              <Dialog open={isOpen} onOpenChange={setIsOpen}>
                <DialogTrigger asChild>
                  <Button onClick={() => { handleClose(); setIsOpen(true); }}>
                    <Plus className="h-4 w-4 mr-2" />
                    Adicionar Regra
                  </Button>
                </DialogTrigger>
                <DialogContent>
                  <DialogHeader>
                    <DialogTitle>{editingRule ? 'Editar Regra' : 'Nova Regra'}</DialogTitle>
                  </DialogHeader>
                  <form onSubmit={handleSubmit} className="space-y-4">
                    <div className="space-y-2">
                      <Label htmlFor="dia">Dia da Semana</Label>
                      <Select value={diaSemana} onValueChange={setDiaSemana}>
                        <SelectTrigger>
                          <SelectValue placeholder="Selecione o dia" />
                        </SelectTrigger>
                        <SelectContent>
                          {DIAS_SEMANA.map((dia) => (
                            <SelectItem key={dia.value} value={String(dia.value)}>
                              {dia.label}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                    <div className="grid grid-cols-2 gap-4">
                      <div className="space-y-2">
                        <Label htmlFor="horaInicio">Hora Início</Label>
                        <Input
                          id="horaInicio"
                          type="time"
                          value={horaInicio}
                          onChange={(e) => setHoraInicio(e.target.value)}
                        />
                      </div>
                      <div className="space-y-2">
                        <Label htmlFor="horaFim">Hora Fim</Label>
                        <Input
                          id="horaFim"
                          type="time"
                          value={horaFim}
                          onChange={(e) => setHoraFim(e.target.value)}
                        />
                      </div>
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="tipoAtendimento">Tipo de Atendimento</Label>
                      <Select value={tipoAtendimento} onValueChange={setTipoAtendimento}>
                        <SelectTrigger>
                          <SelectValue placeholder="Selecione o tipo" />
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
                        <TableHead>Dia da Semana</TableHead>
                        <TableHead>Hora Início</TableHead>
                        <TableHead>Hora Fim</TableHead>
                        <TableHead>Tipo</TableHead>
                        <TableHead className="w-[120px]">Ações</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {rules?.length === 0 ? (
                        <TableRow>
                          <TableCell colSpan={5} className="text-center text-muted-foreground py-8">
                            Nenhuma regra cadastrada para este médico
                          </TableCell>
                        </TableRow>
                      ) : (
                        rules?.map((rule) => (
                          <TableRow key={rule.id}>
                            <TableCell className="font-medium">{getDiaLabel(rule.dia_semana)}</TableCell>
                            <TableCell>{rule.hora_inicio}</TableCell>
                            <TableCell>{rule.hora_fim}</TableCell>
                            <TableCell>{getTipoLabel(rule.tipo_atendimento)}</TableCell>
                            <TableCell>
                              <div className="flex gap-1">
                                <Button variant="ghost" size="sm" onClick={() => handleEdit(rule)}>
                                  <Pencil className="h-4 w-4" />
                                </Button>
                                <Button
                                  variant="ghost"
                                  size="sm"
                                  onClick={() => deleteMutation.mutate(rule.id)}
                                  className="text-destructive hover:text-destructive"
                                >
                                  <Trash2 className="h-4 w-4" />
                                </Button>
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
        )}
      </div>
    </AdminLayout>
  );
}
