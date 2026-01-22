import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { AdminLayout } from '@/components/admin/AdminLayout';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
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
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { useToast } from '@/hooks/use-toast';
import { Plus, Pencil, Search, Loader2, Trash2 } from 'lucide-react';

interface Doctor {
  id: string;
  nome: string;
  especialidade: string;
  ativo: boolean;
  created_at: string;
}

export default function Medicos() {
  const navigate = useNavigate();
  const [isOpen, setIsOpen] = useState(false);
  const [editingDoctor, setEditingDoctor] = useState<Doctor | null>(null);
  const [nome, setNome] = useState('');
  const [especialidade, setEspecialidade] = useState('');
  const [ativo, setAtivo] = useState(true);
  const [search, setSearch] = useState('');
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const handleRowClick = (doctor: Doctor) => {
    navigate(`/admin/medicos/${doctor.id}`);
  };

  const { data: doctors, isLoading } = useQuery({
    queryKey: ['doctors'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('doctors')
        .select('*')
        .order('nome');
      if (error) throw error;
      return data as Doctor[];
    },
  });

  const mutation = useMutation({
    mutationFn: async (data: { nome: string; especialidade: string; ativo: boolean; id?: string }) => {
      if (data.id) {
        const { error } = await supabase
          .from('doctors')
          .update({ nome: data.nome, especialidade: data.especialidade, ativo: data.ativo })
          .eq('id', data.id);
        if (error) throw error;
      } else {
        const { error } = await supabase
          .from('doctors')
          .insert({ nome: data.nome, especialidade: data.especialidade, ativo: data.ativo });
        if (error) throw error;
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['doctors'] });
      toast({ title: 'Sucesso', description: editingDoctor ? 'Médico atualizado!' : 'Médico criado!' });
      handleClose();
    },
    onError: (error: Error) => {
      toast({ title: 'Erro', description: error.message, variant: 'destructive' });
    },
  });

  const toggleMutation = useMutation({
    mutationFn: async ({ id, ativo }: { id: string; ativo: boolean }) => {
      const { error } = await supabase.from('doctors').update({ ativo }).eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['doctors'] });
      toast({ title: 'Status atualizado' });
    },
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      // Check if doctor has appointments
      const { data: appointments } = await supabase
        .from('appointments')
        .select('id')
        .eq('doctor_id', id)
        .limit(1);

      if (appointments && appointments.length > 0) {
        throw new Error('Não é possível excluir médico com agendamentos vinculados');
      }

      const { error } = await supabase.from('doctors').delete().eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['doctors'] });
      toast({ title: 'Médico excluído com sucesso' });
    },
    onError: (error: Error) => {
      toast({ title: 'Erro', description: error.message, variant: 'destructive' });
    },
  });

  const handleClose = () => {
    setIsOpen(false);
    setEditingDoctor(null);
    setNome('');
    setEspecialidade('');
    setAtivo(true);
  };

  const handleEdit = (doctor: Doctor) => {
    setEditingDoctor(doctor);
    setNome(doctor.nome);
    setEspecialidade(doctor.especialidade);
    setAtivo(doctor.ativo);
    setIsOpen(true);
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!nome.trim() || !especialidade.trim()) {
      toast({ title: 'Erro', description: 'Preencha todos os campos', variant: 'destructive' });
      return;
    }
    mutation.mutate({ nome, especialidade, ativo, id: editingDoctor?.id });
  };

  const filteredDoctors = doctors?.filter(
    (d) =>
      d.nome.toLowerCase().includes(search.toLowerCase()) ||
      d.especialidade.toLowerCase().includes(search.toLowerCase())
  );

  return (
    <AdminLayout title="Médicos">
      <Card className="glass-card">
        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-4">
          <CardTitle className="text-lg font-medium">Lista de Médicos</CardTitle>
          <Dialog open={isOpen} onOpenChange={setIsOpen}>
            <DialogTrigger asChild>
              <Button onClick={() => { handleClose(); setIsOpen(true); }}>
                <Plus className="h-4 w-4 mr-2" />
                Novo Médico
              </Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>{editingDoctor ? 'Editar Médico' : 'Novo Médico'}</DialogTitle>
              </DialogHeader>
              <form onSubmit={handleSubmit} className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="nome">Nome</Label>
                  <Input
                    id="nome"
                    value={nome}
                    onChange={(e) => setNome(e.target.value)}
                    placeholder="Dr. João Silva"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="especialidade">Especialidade</Label>
                  <Input
                    id="especialidade"
                    value={especialidade}
                    onChange={(e) => setEspecialidade(e.target.value)}
                    placeholder="Cardiologia"
                  />
                </div>
                <div className="flex items-center gap-2">
                  <Switch id="ativo" checked={ativo} onCheckedChange={setAtivo} />
                  <Label htmlFor="ativo">Ativo</Label>
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
          <div className="mb-4">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                placeholder="Buscar por nome ou especialidade..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="pl-9"
              />
            </div>
          </div>

          {isLoading ? (
            <div className="flex justify-center py-8">
              <Loader2 className="h-6 w-6 animate-spin text-primary" />
            </div>
          ) : (
            <div className="rounded-lg border overflow-hidden">
              <Table>
                <TableHeader>
                  <TableRow className="bg-muted/50">
                    <TableHead>Nome</TableHead>
                    <TableHead>Especialidade</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead className="w-[100px]">Ações</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredDoctors?.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={4} className="text-center text-muted-foreground py-8">
                        Nenhum médico encontrado
                      </TableCell>
                    </TableRow>
                  ) : (
                    filteredDoctors?.map((doctor) => (
                      <TableRow 
                        key={doctor.id} 
                        className="cursor-pointer hover:bg-muted/50"
                        onClick={() => handleRowClick(doctor)}
                      >
                        <TableCell className="font-medium">{doctor.nome}</TableCell>
                        <TableCell>
                          <Switch
                            checked={doctor.ativo}
                            onCheckedChange={(checked) =>
                              toggleMutation.mutate({ id: doctor.id, ativo: checked })
                            }
                          />
                        </TableCell>
                        <TableCell>
                          <div className="flex gap-1">
                            <Button variant="ghost" size="sm" onClick={() => handleEdit(doctor)}>
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
                                    Tem certeza que deseja excluir o médico "{doctor.nome}"? Esta ação não pode ser desfeita.
                                  </AlertDialogDescription>
                                </AlertDialogHeader>
                                <AlertDialogFooter>
                                  <AlertDialogCancel>Cancelar</AlertDialogCancel>
                                  <AlertDialogAction
                                    onClick={() => deleteMutation.mutate(doctor.id)}
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
    </AdminLayout>
  );
}
