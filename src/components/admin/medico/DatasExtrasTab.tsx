import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
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
import { Plus, Trash2, Loader2, CalendarPlus } from 'lucide-react';
import { format, parseISO } from 'date-fns';
import { ptBR } from 'date-fns/locale';

interface DatasExtrasTabProps {
  doctorId: string;
}

interface ScheduleOpening {
  id: string;
  data: string;
  hora_inicio: string;
  hora_fim: string;
  tipo_atendimento: string;
  motivo: string | null;
}

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

export function DatasExtrasTab({ doctorId }: DatasExtrasTabProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [data, setData] = useState('');
  const [horaInicio, setHoraInicio] = useState('');
  const [horaFim, setHoraFim] = useState('');
  const [tipoAtendimento, setTipoAtendimento] = useState('ambos');
  const [motivo, setMotivo] = useState('');
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const { data: openings, isLoading } = useQuery({
    queryKey: ['doctor-openings', doctorId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('schedule_openings')
        .select('*')
        .eq('doctor_id', doctorId)
        .order('data', { ascending: false });
      if (error) throw error;
      return data as ScheduleOpening[];
    },
  });

  const mutation = useMutation({
    mutationFn: async (payload: {
      data: string;
      hora_inicio: string;
      hora_fim: string;
      tipo_atendimento: string;
      motivo: string | null;
    }) => {
      // Check for overlaps
      const { data: existing } = await supabase
        .from('schedule_openings')
        .select('*')
        .eq('doctor_id', doctorId)
        .eq('data', payload.data);

      if (existing && existing.length > 0) {
        const hasOverlap = existing.some((e) => {
          const newStart = payload.hora_inicio;
          const newEnd = payload.hora_fim;
          const existStart = e.hora_inicio.slice(0, 5);
          const existEnd = e.hora_fim.slice(0, 5);
          return newStart < existEnd && newEnd > existStart;
        });
        if (hasOverlap) {
          throw new Error('Já existe uma abertura que conflita com este horário');
        }
      }

      const { error } = await supabase.from('schedule_openings').insert({
        doctor_id: doctorId,
        data: payload.data,
        hora_inicio: payload.hora_inicio,
        hora_fim: payload.hora_fim,
        tipo_atendimento: payload.tipo_atendimento,
        motivo: payload.motivo,
      });
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['doctor-openings', doctorId] });
      toast({ title: 'Data extra criada!' });
      handleClose();
    },
    onError: (error: Error) => {
      toast({ title: 'Erro', description: error.message, variant: 'destructive' });
    },
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from('schedule_openings').delete().eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['doctor-openings', doctorId] });
      toast({ title: 'Data extra excluída!' });
    },
    onError: (error: Error) => {
      toast({ title: 'Erro', description: error.message, variant: 'destructive' });
    },
  });

  const handleClose = () => {
    setIsOpen(false);
    setData('');
    setHoraInicio('');
    setHoraFim('');
    setTipoAtendimento('ambos');
    setMotivo('');
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!data || !horaInicio || !horaFim) {
      toast({ title: 'Erro', description: 'Preencha todos os campos obrigatórios', variant: 'destructive' });
      return;
    }
    if (horaFim <= horaInicio) {
      toast({ title: 'Erro', description: 'Hora fim deve ser maior que hora início', variant: 'destructive' });
      return;
    }
    mutation.mutate({
      data,
      hora_inicio: horaInicio,
      hora_fim: horaFim,
      tipo_atendimento: tipoAtendimento,
      motivo: motivo.trim() || null,
    });
  };

  const formatDate = (dateStr: string) => {
    try {
      return format(parseISO(dateStr), "dd/MM/yyyy (EEEE)", { locale: ptBR });
    } catch {
      return dateStr;
    }
  };

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
          <CardTitle className="flex items-center gap-2">
            <CalendarPlus className="h-5 w-5" />
            Datas Extras
          </CardTitle>
          <CardDescription>Aberturas especiais fora da agenda regular</CardDescription>
        </div>
        <Dialog open={isOpen} onOpenChange={setIsOpen}>
          <DialogTrigger asChild>
            <Button onClick={() => { handleClose(); setIsOpen(true); }}>
              <Plus className="h-4 w-4 mr-2" />
              Nova Data Extra
            </Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Nova Data Extra</DialogTitle>
            </DialogHeader>
            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="data">Data</Label>
                <Input
                  id="data"
                  type="date"
                  value={data}
                  onChange={(e) => setData(e.target.value)}
                />
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
              <div className="space-y-2">
                <Label htmlFor="motivo">Motivo (opcional)</Label>
                <Input
                  id="motivo"
                  value={motivo}
                  onChange={(e) => setMotivo(e.target.value)}
                  placeholder="Plantão extra, reposição, etc."
                />
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
                  <TableHead>Data</TableHead>
                  <TableHead>Horário</TableHead>
                  <TableHead>Tipo</TableHead>
                  <TableHead>Motivo</TableHead>
                  <TableHead className="w-[80px]">Ações</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {openings?.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={5} className="text-center text-muted-foreground py-8">
                      Nenhuma data extra cadastrada
                    </TableCell>
                  </TableRow>
                ) : (
                  openings?.map((opening) => (
                    <TableRow key={opening.id}>
                      <TableCell className="font-medium">{formatDate(opening.data)}</TableCell>
                      <TableCell>
                        {opening.hora_inicio.slice(0, 5)} - {opening.hora_fim.slice(0, 5)}
                      </TableCell>
                      <TableCell>
                        <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium ${getTipoBadgeClass(opening.tipo_atendimento)}`}>
                          {getTipoLabel(opening.tipo_atendimento)}
                        </span>
                      </TableCell>
                      <TableCell className="text-muted-foreground">{opening.motivo || '-'}</TableCell>
                      <TableCell>
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
                                Tem certeza que deseja excluir esta data extra?
                              </AlertDialogDescription>
                            </AlertDialogHeader>
                            <AlertDialogFooter>
                              <AlertDialogCancel>Cancelar</AlertDialogCancel>
                              <AlertDialogAction
                                onClick={() => deleteMutation.mutate(opening.id)}
                                className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                              >
                                Excluir
                              </AlertDialogAction>
                            </AlertDialogFooter>
                          </AlertDialogContent>
                        </AlertDialog>
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
