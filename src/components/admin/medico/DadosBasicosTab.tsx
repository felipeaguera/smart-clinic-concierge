import { useState, useEffect } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { useToast } from '@/hooks/use-toast';
import { Loader2, Save } from 'lucide-react';

interface Doctor {
  id: string;
  nome: string;
  especialidade: string;
  ativo: boolean;
}

interface DadosBasicosTabProps {
  doctor: Doctor;
}

export function DadosBasicosTab({ doctor }: DadosBasicosTabProps) {
  const [nome, setNome] = useState(doctor.nome);
  const [especialidade, setEspecialidade] = useState(doctor.especialidade);
  const [ativo, setAtivo] = useState(doctor.ativo);
  const { toast } = useToast();
  const queryClient = useQueryClient();

  useEffect(() => {
    setNome(doctor.nome);
    setEspecialidade(doctor.especialidade);
    setAtivo(doctor.ativo);
  }, [doctor]);

  const mutation = useMutation({
    mutationFn: async () => {
      const { error } = await supabase
        .from('doctors')
        .update({ nome, especialidade, ativo })
        .eq('id', doctor.id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['doctor', doctor.id] });
      queryClient.invalidateQueries({ queryKey: ['doctors'] });
      toast({ title: 'Dados atualizados com sucesso!' });
    },
    onError: (error: Error) => {
      toast({ title: 'Erro', description: error.message, variant: 'destructive' });
    },
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!nome.trim() || !especialidade.trim()) {
      toast({ title: 'Erro', description: 'Preencha todos os campos', variant: 'destructive' });
      return;
    }
    mutation.mutate();
  };

  const hasChanges = nome !== doctor.nome || especialidade !== doctor.especialidade || ativo !== doctor.ativo;

  return (
    <Card>
      <CardHeader>
        <CardTitle>Dados Básicos</CardTitle>
        <CardDescription>Informações gerais do médico</CardDescription>
      </CardHeader>
      <CardContent>
        <form onSubmit={handleSubmit} className="space-y-4 max-w-md">
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
          <div className="flex items-center gap-3">
            <Switch id="ativo" checked={ativo} onCheckedChange={setAtivo} />
            <Label htmlFor="ativo">Médico ativo</Label>
          </div>
          <Button type="submit" disabled={mutation.isPending || !hasChanges}>
            {mutation.isPending ? (
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
            ) : (
              <Save className="mr-2 h-4 w-4" />
            )}
            Salvar Alterações
          </Button>
        </form>
      </CardContent>
    </Card>
  );
}
