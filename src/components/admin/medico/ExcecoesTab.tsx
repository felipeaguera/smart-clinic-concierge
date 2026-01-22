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
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { useToast } from '@/hooks/use-toast';
import { Plus, Pencil, Trash2, Loader2, CalendarOff } from 'lucide-react';
import { format, parseISO } from 'date-fns';
import { ptBR } from 'date-fns/locale';

interface ExcecoesTabProps {
  doctorId: string;
}

interface ScheduleException {
  id: string;
  data: string;
  motivo: string | null;
}

export function ExcecoesTab({ doctorId }: ExcecoesTabProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [editing, setEditing] = useState<ScheduleException | null>(null);
  const [data, setData] = useState('');
  const [motivo, setMotivo] = useState('');
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const { data: exceptions, isLoading } = useQuery({
    queryKey: ['doctor-exceptions', doctorId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('schedule_exceptions')
        .select('*')
        .eq('doctor_id', doctorId)
        .order('data', { ascending: false });
      if (error) throw error;
      return data as ScheduleException[];
    },
  });

  const mutation = useMutation({
    mutationFn: async (payload: { id?: string; data: string; motivo: string | null }) => {
      if (payload.id) {
        const { error } = await supabase
          .from('schedule_exceptions')
          .update({ data: payload.data, motivo: payload.motivo })
          .eq('id', payload.id);
        if (error) throw error;
      } else {
        const { error } = await supabase.from('schedule_exceptions').insert({
          doctor_id: doctorId,
          data: payload.data,
          motivo: payload.motivo,
        });
        if (error) throw error;
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['doctor-exceptions', doctorId] });
      toast({ title: editing ? 'Exceção atualizada!' : 'Exceção criada!' });
      handleClose();
    },
    onError: (error: Error) => {
      toast({ title: 'Erro', description: error.message, variant: 'destructive' });
    },
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from('schedule_exceptions').delete().eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['doctor-exceptions', doctorId] });
      toast({ title: 'Exceção excluída!' });
    },
    onError: (error: Error) => {
      toast({ title: 'Erro', description: error.message, variant: 'destructive' });
    },
  });

  const handleClose = () => {
    setIsOpen(false);
    setEditing(null);
    setData('');
    setMotivo('');
  };

  const handleEdit = (exception: ScheduleException) => {
    setEditing(exception);
    setData(exception.data);
    setMotivo(exception.motivo || '');
    setIsOpen(true);
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!data) {
      toast({ title: 'Erro', description: 'Informe a data', variant: 'destructive' });
      return;
    }
    mutation.mutate({
      id: editing?.id,
      data,
      motivo: motivo.trim() || null,
    });
  };

  const formatDate = (dateStr: string) => {
    try {
      return format(parseISO(dateStr), "dd 'de' MMMM 'de' yyyy", { locale: ptBR });
    } catch {
      return dateStr;
    }
  };

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between">
        <div>
          <CardTitle className="flex items-center gap-2">
            <CalendarOff className="h-5 w-5" />
            Exceções de Agenda
          </CardTitle>
          <CardDescription>Dias em que o médico não atende (férias, cursos, etc.)</CardDescription>
        </div>
        <Dialog open={isOpen} onOpenChange={setIsOpen}>
          <DialogTrigger asChild>
            <Button onClick={() => { handleClose(); setIsOpen(true); }}>
              <Plus className="h-4 w-4 mr-2" />
              Nova Exceção
            </Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>{editing ? 'Editar Exceção' : 'Nova Exceção'}</DialogTitle>
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
              <div className="space-y-2">
                <Label htmlFor="motivo">Motivo (opcional)</Label>
                <Input
                  id="motivo"
                  value={motivo}
                  onChange={(e) => setMotivo(e.target.value)}
                  placeholder="Férias, Congresso, etc."
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
                  <TableHead>Motivo</TableHead>
                  <TableHead className="w-[100px]">Ações</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {exceptions?.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={3} className="text-center text-muted-foreground py-8">
                      Nenhuma exceção cadastrada
                    </TableCell>
                  </TableRow>
                ) : (
                  exceptions?.map((exception) => (
                    <TableRow key={exception.id}>
                      <TableCell className="font-medium">{formatDate(exception.data)}</TableCell>
                      <TableCell className="text-muted-foreground">{exception.motivo || '-'}</TableCell>
                      <TableCell>
                        <div className="flex gap-1">
                          <Button variant="ghost" size="sm" onClick={() => handleEdit(exception)}>
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
                                  Tem certeza que deseja excluir esta exceção?
                                </AlertDialogDescription>
                              </AlertDialogHeader>
                              <AlertDialogFooter>
                                <AlertDialogCancel>Cancelar</AlertDialogCancel>
                                <AlertDialogAction
                                  onClick={() => deleteMutation.mutate(exception.id)}
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
