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
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';

interface Doctor {
  id: string;
  nome: string;
}

interface ScheduleException {
  id: string;
  doctor_id: string;
  data: string;
  motivo: string | null;
}

export default function ExcecoesAgenda() {
  const [selectedDoctor, setSelectedDoctor] = useState<string>('');
  const [isOpen, setIsOpen] = useState(false);
  const [editingException, setEditingException] = useState<ScheduleException | null>(null);
  const [data, setData] = useState('');
  const [motivo, setMotivo] = useState('');
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

  const { data: exceptions, isLoading } = useQuery({
    queryKey: ['schedule_exceptions', selectedDoctor],
    queryFn: async () => {
      if (!selectedDoctor) return [];
      const { data, error } = await supabase
        .from('schedule_exceptions')
        .select('*')
        .eq('doctor_id', selectedDoctor)
        .order('data', { ascending: false });
      if (error) throw error;
      return data as ScheduleException[];
    },
    enabled: !!selectedDoctor,
  });

  const mutation = useMutation({
    mutationFn: async (input: { doctor_id: string; data: string; motivo: string; id?: string }) => {
      if (input.id) {
        const { error } = await supabase
          .from('schedule_exceptions')
          .update({ data: input.data, motivo: input.motivo || null })
          .eq('id', input.id);
        if (error) throw error;
      } else {
        const { error } = await supabase
          .from('schedule_exceptions')
          .insert({ doctor_id: input.doctor_id, data: input.data, motivo: input.motivo || null });
        if (error) throw error;
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['schedule_exceptions', selectedDoctor] });
      toast({ title: 'Sucesso', description: editingException ? 'Exceção atualizada!' : 'Exceção criada!' });
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
      queryClient.invalidateQueries({ queryKey: ['schedule_exceptions', selectedDoctor] });
      toast({ title: 'Exceção removida' });
    },
    onError: (error: Error) => {
      toast({ title: 'Erro', description: error.message, variant: 'destructive' });
    },
  });

  const handleClose = () => {
    setIsOpen(false);
    setEditingException(null);
    setData('');
    setMotivo('');
  };

  const handleEdit = (exception: ScheduleException) => {
    setEditingException(exception);
    setData(exception.data);
    setMotivo(exception.motivo || '');
    setIsOpen(true);
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!data) {
      toast({ title: 'Erro', description: 'Selecione uma data', variant: 'destructive' });
      return;
    }
    mutation.mutate({
      doctor_id: selectedDoctor,
      data,
      motivo,
      id: editingException?.id,
    });
  };

  const formatDate = (dateStr: string) => {
    try {
      return format(new Date(dateStr + 'T00:00:00'), "dd 'de' MMMM 'de' yyyy", { locale: ptBR });
    } catch {
      return dateStr;
    }
  };

  return (
    <AdminLayout title="Exceções de Agenda">
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
              <CardTitle className="text-lg font-medium">Exceções (Folgas, Férias, Cursos)</CardTitle>
              <Dialog open={isOpen} onOpenChange={setIsOpen}>
                <DialogTrigger asChild>
                  <Button onClick={() => { handleClose(); setIsOpen(true); }}>
                    <Plus className="h-4 w-4 mr-2" />
                    Nova Exceção
                  </Button>
                </DialogTrigger>
                <DialogContent>
                  <DialogHeader>
                    <DialogTitle>{editingException ? 'Editar Exceção' : 'Nova Exceção'}</DialogTitle>
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
                        placeholder="Férias, Curso, Folga..."
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
                        <TableHead className="w-[120px]">Ações</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {exceptions?.length === 0 ? (
                        <TableRow>
                          <TableCell colSpan={3} className="text-center text-muted-foreground py-8">
                            Nenhuma exceção cadastrada para este médico
                          </TableCell>
                        </TableRow>
                      ) : (
                        exceptions?.map((exception) => (
                          <TableRow key={exception.id}>
                            <TableCell className="font-medium">{formatDate(exception.data)}</TableCell>
                            <TableCell>{exception.motivo || '-'}</TableCell>
                            <TableCell>
                              <div className="flex gap-1">
                                <Button variant="ghost" size="sm" onClick={() => handleEdit(exception)}>
                                  <Pencil className="h-4 w-4" />
                                </Button>
                                <Button
                                  variant="ghost"
                                  size="sm"
                                  onClick={() => deleteMutation.mutate(exception.id)}
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
