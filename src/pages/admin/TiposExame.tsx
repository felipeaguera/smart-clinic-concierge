import { useState, useMemo } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { AdminLayout } from '@/components/admin/AdminLayout';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Textarea } from '@/components/ui/textarea';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
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
import { Plus, Pencil, Trash2, Loader2, Stethoscope, Activity, FlaskConical } from 'lucide-react';
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
  { value: 'consulta', label: 'Consultas', icon: Stethoscope },
  { value: 'ultrassom', label: 'Ultrassom', icon: Activity },
  { value: 'laboratorio', label: 'Laboratório', icon: FlaskConical },
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
  const [activeTab, setActiveTab] = useState('consulta');
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

  // Agrupa exames por categoria
  const examsByCategory = useMemo(() => {
    if (!examTypes) return { consulta: [], ultrassom: [], laboratorio: [] };
    return {
      consulta: examTypes.filter((e) => e.categoria === 'consulta'),
      ultrassom: examTypes.filter((e) => e.categoria === 'ultrassom'),
      laboratorio: examTypes.filter((e) => e.categoria === 'laboratorio'),
    };
  }, [examTypes]);

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

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from('exam_types').delete().eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['exam_types'] });
      toast({ title: 'Sucesso', description: 'Tipo de exame excluído!' });
    },
    onError: (error: Error) => {
      toast({ title: 'Erro', description: error.message, variant: 'destructive' });
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

  const handleNewExam = (cat: string) => {
    handleClose();
    setCategoria(cat);
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

  const getCategoriaLabel = (value: string) =>
    CATEGORIAS.find((c) => c.value === value)?.label || value;

  const showDuracao = categoria !== 'laboratorio';

  const renderExamTable = (exams: ExamType[], showDuration: boolean) => (
    <div className="rounded-lg border overflow-hidden">
      <Table>
        <TableHeader>
          <TableRow className="bg-muted/50">
            <TableHead>Nome</TableHead>
            {showDuration && <TableHead>Duração</TableHead>}
            <TableHead>Status</TableHead>
            <TableHead className="w-[80px]">Ações</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {exams.length === 0 ? (
            <TableRow>
              <TableCell colSpan={showDuration ? 4 : 3} className="text-center text-muted-foreground py-8">
                Nenhum item cadastrado
              </TableCell>
            </TableRow>
          ) : (
            exams.map((exam) => (
              <TableRow key={exam.id}>
                <TableCell className="font-medium">{exam.nome}</TableCell>
                {showDuration && <TableCell>{exam.duracao_minutos} min</TableCell>}
                <TableCell>
                  <Switch
                    checked={exam.ativo}
                    onCheckedChange={(checked) =>
                      toggleMutation.mutate({ id: exam.id, ativo: checked })
                    }
                  />
                </TableCell>
                <TableCell>
                  <div className="flex items-center gap-1">
                    <Button variant="ghost" size="sm" onClick={() => handleEdit(exam)}>
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
                          <AlertDialogTitle>Excluir tipo de exame</AlertDialogTitle>
                          <AlertDialogDescription>
                            Tem certeza que deseja excluir "{exam.nome}"? Esta ação não pode ser desfeita.
                          </AlertDialogDescription>
                        </AlertDialogHeader>
                        <AlertDialogFooter>
                          <AlertDialogCancel>Cancelar</AlertDialogCancel>
                          <AlertDialogAction
                            onClick={() => deleteMutation.mutate(exam.id)}
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
  );

  return (
    <AdminLayout title="Tipos de Exame">
      <Card className="glass-card">
        <CardContent className="pt-6">
          {isLoading ? (
            <div className="flex justify-center py-12">
              <Loader2 className="h-8 w-8 animate-spin text-primary" />
            </div>
          ) : (
            <Tabs value={activeTab} onValueChange={setActiveTab}>
              <TabsList className="grid w-full grid-cols-3 mb-6">
                {CATEGORIAS.map((cat) => {
                  const Icon = cat.icon;
                  const count = examsByCategory[cat.value as keyof typeof examsByCategory]?.length || 0;
                  return (
                    <TabsTrigger key={cat.value} value={cat.value} className="flex items-center gap-2">
                      <Icon className="h-4 w-4" />
                      <span>{cat.label}</span>
                      <span className="text-xs text-muted-foreground">({count})</span>
                    </TabsTrigger>
                  );
                })}
              </TabsList>

              {CATEGORIAS.map((cat) => (
                <TabsContent key={cat.value} value={cat.value} className="space-y-4">
                  <div className="flex justify-between items-center">
                    <h3 className="text-lg font-medium">{cat.label}</h3>
                    <Button onClick={() => handleNewExam(cat.value)}>
                      <Plus className="h-4 w-4 mr-2" />
                      Novo
                    </Button>
                  </div>
                  {renderExamTable(
                    examsByCategory[cat.value as keyof typeof examsByCategory] || [],
                    cat.value !== 'laboratorio'
                  )}
                </TabsContent>
              ))}
            </Tabs>
          )}
        </CardContent>
      </Card>

      {/* Modal de Novo/Editar */}
      <Dialog open={isOpen} onOpenChange={setIsOpen}>
        <DialogContent className="max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{editingExam ? 'Editar' : 'Novo'} {getCategoriaLabel(categoria)}</DialogTitle>
          </DialogHeader>
          <form onSubmit={handleSubmit} className="space-y-4">
            {/* Nome */}
            <div className="space-y-2">
              <Label htmlFor="nome">Nome</Label>
              <Input
                id="nome"
                value={nome}
                onChange={(e) => setNome(e.target.value)}
                placeholder={categoria === 'consulta' ? 'Consulta Cardiológica' : categoria === 'ultrassom' ? 'Ultrassom Abdominal' : 'Hemograma Completo'}
              />
            </div>

            {/* Categoria (oculto se já definido, visível para edição) */}
            {editingExam && (
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
            )}

            {/* Duração (apenas para consulta e ultrassom) */}
            {showDuracao && (
              <div className="space-y-2">
                <Label htmlFor="duracao">Duração (minutos)</Label>
                <Select value={duracao} onValueChange={setDuracao}>
                  <SelectTrigger>
                    <SelectValue placeholder="Selecione a duração" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="10">10 minutos</SelectItem>
                    <SelectItem value="20">20 minutos</SelectItem>
                    <SelectItem value="30">30 minutos</SelectItem>
                    <SelectItem value="40">40 minutos</SelectItem>
                    <SelectItem value="50">50 minutos</SelectItem>
                    <SelectItem value="60">60 minutos</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            )}

            {/* Preparo */}
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

            {/* Orientações */}
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

            {/* Preço */}
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

            {/* Status */}
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
    </AdminLayout>
  );
}
