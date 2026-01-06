import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { AdminLayout } from '@/components/admin/AdminLayout';
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
import { Plus, Pencil, Search, Loader2 } from 'lucide-react';

interface ExamType {
  id: string;
  nome: string;
  categoria: string;
  duracao_minutos: number;
  ativo: boolean;
  preparo: string | null;
  orientacoes: string | null;
  has_price: boolean;
  price_private: number | null;
  currency: string;
  created_at: string;
}

const CATEGORIAS = [
  { value: 'consulta', label: 'Consulta' },
  { value: 'ultrassom', label: 'Ultrassom' },
  { value: 'laboratorio', label: 'Laboratório' },
];

export default function TiposExame() {
  const [isOpen, setIsOpen] = useState(false);
  const [editingExam, setEditingExam] = useState<ExamType | null>(null);
  const [nome, setNome] = useState('');
  const [categoria, setCategoria] = useState('');
  const [duracao, setDuracao] = useState('');
  const [preparo, setPreparo] = useState('');
  const [orientacoes, setOrientacoes] = useState('');
  const [ativo, setAtivo] = useState(true);
  const [hasPrice, setHasPrice] = useState(false);
  const [pricePrivate, setPricePrivate] = useState('');
  const [search, setSearch] = useState('');
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const { data: examTypes, isLoading } = useQuery({
    queryKey: ['exam_types'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('exam_types')
        .select('*')
        .order('nome');
      if (error) throw error;
      return data as ExamType[];
    },
  });

  const mutation = useMutation({
    mutationFn: async (data: {
      nome: string;
      categoria: string;
      duracao_minutos: number;
      ativo: boolean;
      preparo: string | null;
      orientacoes: string | null;
      has_price: boolean;
      price_private: number | null;
      id?: string;
    }) => {
      const payload = {
        nome: data.nome,
        categoria: data.categoria,
        duracao_minutos: data.duracao_minutos,
        ativo: data.ativo,
        preparo: data.preparo || null,
        orientacoes: data.orientacoes || null,
        has_price: data.has_price,
        price_private: data.has_price ? data.price_private : null,
      };

      if (data.id) {
        const { error } = await supabase
          .from('exam_types')
          .update(payload)
          .eq('id', data.id);
        if (error) throw error;
      } else {
        const { error } = await supabase
          .from('exam_types')
          .insert(payload);
        if (error) throw error;
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['exam_types'] });
      toast({ title: 'Sucesso', description: editingExam ? 'Tipo de exame atualizado!' : 'Tipo de exame criado!' });
      handleClose();
    },
    onError: (error: Error) => {
      toast({ title: 'Erro', description: error.message, variant: 'destructive' });
    },
  });

  const toggleMutation = useMutation({
    mutationFn: async ({ id, ativo }: { id: string; ativo: boolean }) => {
      const { error } = await supabase.from('exam_types').update({ ativo }).eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['exam_types'] });
      toast({ title: 'Status atualizado' });
    },
  });

  const handleClose = () => {
    setIsOpen(false);
    setEditingExam(null);
    setNome('');
    setCategoria('');
    setDuracao('');
    setPreparo('');
    setOrientacoes('');
    setAtivo(true);
    setHasPrice(false);
    setPricePrivate('');
  };

  const handleEdit = (exam: ExamType) => {
    setEditingExam(exam);
    setNome(exam.nome);
    setCategoria(exam.categoria);
    setDuracao(String(exam.duracao_minutos));
    setPreparo(exam.preparo || '');
    setOrientacoes(exam.orientacoes || '');
    setAtivo(exam.ativo);
    setHasPrice(exam.has_price);
    setPricePrivate(exam.price_private !== null ? String(exam.price_private) : '');
    setIsOpen(true);
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!nome.trim() || !categoria) {
      toast({ title: 'Erro', description: 'Preencha os campos obrigatórios', variant: 'destructive' });
      return;
    }

    // Validar duração apenas para consulta e ultrassom
    let duracaoNum = 0;
    if (categoria !== 'laboratorio') {
      if (!duracao) {
        toast({ title: 'Erro', description: 'Preencha a duração do exame', variant: 'destructive' });
        return;
      }
      duracaoNum = parseInt(duracao, 10);
      if (isNaN(duracaoNum) || duracaoNum <= 0) {
        toast({ title: 'Erro', description: 'Duração deve ser um número positivo', variant: 'destructive' });
        return;
      }
    }

    // Validar preço quando has_price = true
    let priceValue: number | null = null;
    if (hasPrice) {
      if (!pricePrivate.trim()) {
        toast({ title: 'Erro', description: 'Preencha o valor do exame', variant: 'destructive' });
        return;
      }
      priceValue = parseFloat(pricePrivate.replace(',', '.'));
      if (isNaN(priceValue) || priceValue <= 0) {
        toast({ title: 'Erro', description: 'Valor deve ser um número positivo', variant: 'destructive' });
        return;
      }
    }

    mutation.mutate({
      nome,
      categoria,
      duracao_minutos: duracaoNum,
      ativo,
      preparo: preparo.trim() || null,
      orientacoes: orientacoes.trim() || null,
      has_price: hasPrice,
      price_private: priceValue,
      id: editingExam?.id,
    });
  };

  const filteredExams = examTypes?.filter(
    (e) =>
      e.nome.toLowerCase().includes(search.toLowerCase()) ||
      e.categoria.toLowerCase().includes(search.toLowerCase())
  );

  const getCategoriaLabel = (value: string) =>
    CATEGORIAS.find((c) => c.value === value)?.label || value;

  const showDuracao = categoria !== 'laboratorio';

  return (
    <AdminLayout title="Tipos de Exame">
      <Card className="glass-card">
        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-4">
          <CardTitle className="text-lg font-medium">Lista de Tipos de Exame</CardTitle>
          <Dialog open={isOpen} onOpenChange={setIsOpen}>
            <DialogTrigger asChild>
              <Button onClick={() => { handleClose(); setIsOpen(true); }}>
                <Plus className="h-4 w-4 mr-2" />
                Novo Tipo de Exame
              </Button>
            </DialogTrigger>
            <DialogContent className="max-h-[90vh] overflow-y-auto">
              <DialogHeader>
                <DialogTitle>{editingExam ? 'Editar Tipo de Exame' : 'Novo Tipo de Exame'}</DialogTitle>
              </DialogHeader>
              <form onSubmit={handleSubmit} className="space-y-4">
                {/* 1. Nome do exame */}
                <div className="space-y-2">
                  <Label htmlFor="nome">Nome</Label>
                  <Input
                    id="nome"
                    value={nome}
                    onChange={(e) => setNome(e.target.value)}
                    placeholder="Ultrassom Abdominal"
                  />
                </div>

                {/* 2. Categoria */}
                <div className="space-y-2">
                  <Label htmlFor="categoria">Categoria</Label>
                  <Select value={categoria} onValueChange={setCategoria}>
                    <SelectTrigger>
                      <SelectValue placeholder="Selecione a categoria" />
                    </SelectTrigger>
                    <SelectContent>
                      {CATEGORIAS.map((cat) => (
                        <SelectItem key={cat.value} value={cat.value}>
                          {cat.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                {/* 3. Duração (apenas para consulta e ultrassom) */}
                {showDuracao && (
                  <div className="space-y-2">
                    <Label htmlFor="duracao">Duração (minutos)</Label>
                    <Input
                      id="duracao"
                      type="number"
                      min="1"
                      value={duracao}
                      onChange={(e) => setDuracao(e.target.value)}
                      placeholder="30"
                    />
                  </div>
                )}

                {/* 4. Preparo do exame */}
                <div className="space-y-2">
                  <Label htmlFor="preparo">Preparo do exame</Label>
                  <Textarea
                    id="preparo"
                    value={preparo}
                    onChange={(e) => setPreparo(e.target.value)}
                    placeholder="Ex: Jejum de 6 horas. Água liberada."
                    rows={3}
                  />
                </div>

                {/* 5. Orientações ao paciente */}
                <div className="space-y-2">
                  <Label htmlFor="orientacoes">Orientações ao paciente</Label>
                  <Textarea
                    id="orientacoes"
                    value={orientacoes}
                    onChange={(e) => setOrientacoes(e.target.value)}
                    placeholder="Ex: Trazer exames anteriores, se houver."
                    rows={3}
                  />
                </div>

                {/* 6. Possui valor definido */}
                <div className="space-y-3">
                  <div className="flex items-center gap-2">
                    <Switch id="hasPrice" checked={hasPrice} onCheckedChange={setHasPrice} />
                    <Label htmlFor="hasPrice">Possui valor definido?</Label>
                  </div>
                  
                  {hasPrice && (
                    <div className="space-y-2 pl-6 border-l-2 border-primary/20">
                      <Label htmlFor="pricePrivate">Valor particular (R$)</Label>
                      <Input
                        id="pricePrivate"
                        type="number"
                        min="0.01"
                        step="0.01"
                        value={pricePrivate}
                        onChange={(e) => setPricePrivate(e.target.value)}
                        placeholder="250.00"
                      />
                    </div>
                  )}
                </div>

                {/* 7. Status (Ativo/Inativo) */}
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
                placeholder="Buscar por nome ou categoria..."
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
                    <TableHead>Categoria</TableHead>
                    <TableHead>Duração</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead className="w-[100px]">Ações</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredExams?.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={5} className="text-center text-muted-foreground py-8">
                        Nenhum tipo de exame encontrado
                      </TableCell>
                    </TableRow>
                  ) : (
                    filteredExams?.map((exam) => (
                      <TableRow key={exam.id}>
                        <TableCell className="font-medium">{exam.nome}</TableCell>
                        <TableCell>{getCategoriaLabel(exam.categoria)}</TableCell>
                        <TableCell>
                          {exam.categoria === 'laboratorio' ? '-' : `${exam.duracao_minutos} min`}
                        </TableCell>
                        <TableCell>
                          <Switch
                            checked={exam.ativo}
                            onCheckedChange={(checked) =>
                              toggleMutation.mutate({ id: exam.id, ativo: checked })
                            }
                          />
                        </TableCell>
                        <TableCell>
                          <Button variant="ghost" size="sm" onClick={() => handleEdit(exam)}>
                            <Pencil className="h-4 w-4" />
                          </Button>
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
