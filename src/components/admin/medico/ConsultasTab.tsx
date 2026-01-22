import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Textarea } from '@/components/ui/textarea';
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
import { Plus, Pencil, Trash2, Loader2 } from 'lucide-react';

interface ConsultasTabProps {
  doctorId: string;
}

interface ExamType {
  id: string;
  nome: string;
  duracao_minutos: number;
  preparo: string | null;
  orientacoes: string | null;
  has_price: boolean;
  price_private: number | null;
  ativo: boolean;
}

export function ConsultasTab({ doctorId }: ConsultasTabProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [editing, setEditing] = useState<ExamType | null>(null);
  const [nome, setNome] = useState('');
  const [duracao, setDuracao] = useState('30');
  const [preparo, setPreparo] = useState('');
  const [orientacoes, setOrientacoes] = useState('');
  const [hasPrice, setHasPrice] = useState(false);
  const [price, setPrice] = useState('');
  const [ativo, setAtivo] = useState(true);
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const { data: consultas, isLoading } = useQuery({
    queryKey: ['doctor-consultas', doctorId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('exam_types')
        .select('*')
        .eq('doctor_id', doctorId)
        .eq('categoria', 'consulta')
        .order('nome');
      if (error) throw error;
      return data as ExamType[];
    },
  });

  const mutation = useMutation({
    mutationFn: async (data: {
      id?: string;
      nome: string;
      duracao_minutos: number;
      preparo: string | null;
      orientacoes: string | null;
      has_price: boolean;
      price_private: number | null;
      ativo: boolean;
    }) => {
      if (data.id) {
        const { error } = await supabase
          .from('exam_types')
          .update({
            nome: data.nome,
            duracao_minutos: data.duracao_minutos,
            preparo: data.preparo,
            orientacoes: data.orientacoes,
            has_price: data.has_price,
            price_private: data.price_private,
            ativo: data.ativo,
          })
          .eq('id', data.id);
        if (error) throw error;
      } else {
        const { error } = await supabase.from('exam_types').insert({
          nome: data.nome,
          categoria: 'consulta',
          duracao_minutos: data.duracao_minutos,
          preparo: data.preparo,
          orientacoes: data.orientacoes,
          has_price: data.has_price,
          price_private: data.price_private,
          ativo: data.ativo,
          doctor_id: doctorId,
        });
        if (error) throw error;
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['doctor-consultas', doctorId] });
      toast({ title: editing ? 'Consulta atualizada!' : 'Consulta criada!' });
      handleClose();
    },
    onError: (error: Error) => {
      toast({ title: 'Erro', description: error.message, variant: 'destructive' });
    },
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      const { data: appointments } = await supabase
        .from('appointments')
        .select('id')
        .eq('exam_type_id', id)
        .limit(1);
      
      if (appointments && appointments.length > 0) {
        throw new Error('Não é possível excluir consulta com agendamentos vinculados');
      }

      const { error } = await supabase.from('exam_types').delete().eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['doctor-consultas', doctorId] });
      toast({ title: 'Consulta excluída!' });
    },
    onError: (error: Error) => {
      toast({ title: 'Erro', description: error.message, variant: 'destructive' });
    },
  });

  const handleClose = () => {
    setIsOpen(false);
    setEditing(null);
    setNome('');
    setDuracao('30');
    setPreparo('');
    setOrientacoes('');
    setHasPrice(false);
    setPrice('');
    setAtivo(true);
  };

  const handleEdit = (consulta: ExamType) => {
    setEditing(consulta);
    setNome(consulta.nome);
    setDuracao(consulta.duracao_minutos.toString());
    setPreparo(consulta.preparo || '');
    setOrientacoes(consulta.orientacoes || '');
    setHasPrice(consulta.has_price);
    setPrice(consulta.price_private?.toString() || '');
    setAtivo(consulta.ativo);
    setIsOpen(true);
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!nome.trim()) {
      toast({ title: 'Erro', description: 'Informe o nome da consulta', variant: 'destructive' });
      return;
    }
    mutation.mutate({
      id: editing?.id,
      nome,
      duracao_minutos: parseInt(duracao) || 30,
      preparo: preparo.trim() || null,
      orientacoes: orientacoes.trim() || null,
      has_price: hasPrice,
      price_private: hasPrice && price ? parseFloat(price) : null,
      ativo,
    });
  };

  const formatPrice = (value: number | null) => {
    if (!value) return '-';
    return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(value);
  };

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between">
        <div>
          <CardTitle>Consultas</CardTitle>
          <CardDescription>Tipos de consulta oferecidos por este médico</CardDescription>
        </div>
        <Dialog open={isOpen} onOpenChange={setIsOpen}>
          <DialogTrigger asChild>
            <Button onClick={() => { handleClose(); setIsOpen(true); }}>
              <Plus className="h-4 w-4 mr-2" />
              Nova Consulta
            </Button>
          </DialogTrigger>
          <DialogContent className="max-w-lg">
            <DialogHeader>
              <DialogTitle>{editing ? 'Editar Consulta' : 'Nova Consulta'}</DialogTitle>
            </DialogHeader>
            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="nome">Nome</Label>
                <Input
                  id="nome"
                  value={nome}
                  onChange={(e) => setNome(e.target.value)}
                  placeholder="Consulta de Rotina"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="duracao">Duração (minutos)</Label>
                <Input
                  id="duracao"
                  type="number"
                  min="5"
                  step="5"
                  value={duracao}
                  onChange={(e) => setDuracao(e.target.value)}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="preparo">Preparo</Label>
                <Textarea
                  id="preparo"
                  value={preparo}
                  onChange={(e) => setPreparo(e.target.value)}
                  placeholder="Instruções de preparo..."
                  rows={2}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="orientacoes">Orientações</Label>
                <Textarea
                  id="orientacoes"
                  value={orientacoes}
                  onChange={(e) => setOrientacoes(e.target.value)}
                  placeholder="Orientações adicionais..."
                  rows={2}
                />
              </div>
              <div className="flex items-center gap-3">
                <Switch id="hasPrice" checked={hasPrice} onCheckedChange={setHasPrice} />
                <Label htmlFor="hasPrice">Possui preço particular</Label>
              </div>
              {hasPrice && (
                <div className="space-y-2">
                  <Label htmlFor="price">Preço (R$)</Label>
                  <Input
                    id="price"
                    type="number"
                    min="0"
                    step="0.01"
                    value={price}
                    onChange={(e) => setPrice(e.target.value)}
                    placeholder="150.00"
                  />
                </div>
              )}
              <div className="flex items-center gap-3">
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
                  <TableHead>Duração</TableHead>
                  <TableHead>Preço</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead className="w-[100px]">Ações</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {consultas?.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={5} className="text-center text-muted-foreground py-8">
                      Nenhuma consulta cadastrada
                    </TableCell>
                  </TableRow>
                ) : (
                  consultas?.map((consulta) => (
                    <TableRow key={consulta.id}>
                      <TableCell className="font-medium">{consulta.nome}</TableCell>
                      <TableCell>{consulta.duracao_minutos} min</TableCell>
                      <TableCell>{consulta.has_price ? formatPrice(consulta.price_private) : '-'}</TableCell>
                      <TableCell>
                        <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium ${
                          consulta.ativo ? 'bg-green-100 text-green-800' : 'bg-gray-100 text-gray-800'
                        }`}>
                          {consulta.ativo ? 'Ativo' : 'Inativo'}
                        </span>
                      </TableCell>
                      <TableCell>
                        <div className="flex gap-1">
                          <Button variant="ghost" size="sm" onClick={() => handleEdit(consulta)}>
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
                                  Tem certeza que deseja excluir "{consulta.nome}"?
                                </AlertDialogDescription>
                              </AlertDialogHeader>
                              <AlertDialogFooter>
                                <AlertDialogCancel>Cancelar</AlertDialogCancel>
                                <AlertDialogAction
                                  onClick={() => deleteMutation.mutate(consulta.id)}
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
