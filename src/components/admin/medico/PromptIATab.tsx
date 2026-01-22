import { useState, useEffect } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { useToast } from '@/hooks/use-toast';
import { Loader2, Save, Sparkles, Info } from 'lucide-react';

interface PromptIATabProps {
  doctorId: string;
  doctorName: string;
  promptIA: string | null;
}

const EXEMPLOS = [
  "Sempre perguntar se a paciente tem plano de saúde antes de informar valores.",
  "Para consultas de pré-natal, verificar se já fez o primeiro ultrassom morfológico.",
  "Preferência por agendamentos no período da manhã.",
  "Não agendar consultas com menos de 2 dias de antecedência.",
  "Informar que o médico não realiza ultrassons às sextas-feiras.",
  "Para primeira consulta, solicitar que chegue 15 minutos antes.",
];

export function PromptIATab({ doctorId, doctorName, promptIA }: PromptIATabProps) {
  const [prompt, setPrompt] = useState(promptIA || '');
  const { toast } = useToast();
  const queryClient = useQueryClient();

  useEffect(() => {
    setPrompt(promptIA || '');
  }, [promptIA]);

  const mutation = useMutation({
    mutationFn: async () => {
      const { error } = await supabase
        .from('doctors')
        .update({ prompt_ia: prompt.trim() || null })
        .eq('id', doctorId);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['doctor', doctorId] });
      toast({ title: 'Prompt salvo com sucesso!' });
    },
    onError: (error: Error) => {
      toast({ title: 'Erro', description: error.message, variant: 'destructive' });
    },
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    mutation.mutate();
  };

  const hasChanges = prompt !== (promptIA || '');

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Sparkles className="h-5 w-5 text-primary" />
            Prompt da IA
          </CardTitle>
          <CardDescription>
            Instruções personalizadas que a assistente Clara seguirá ao atender pacientes deste médico
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="prompt">Instruções para a Clara</Label>
              <Textarea
                id="prompt"
                value={prompt}
                onChange={(e) => setPrompt(e.target.value)}
                placeholder="Digite instruções específicas para este médico..."
                rows={6}
                className="resize-none"
              />
              <p className="text-xs text-muted-foreground">
                Estas instruções serão aplicadas automaticamente quando um paciente buscar atendimento com este médico.
              </p>
            </div>
            <Button type="submit" disabled={mutation.isPending || !hasChanges}>
              {mutation.isPending ? (
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              ) : (
                <Save className="mr-2 h-4 w-4" />
              )}
              Salvar Prompt
            </Button>
          </form>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base flex items-center gap-2">
            <Info className="h-4 w-4" />
            Exemplos de Uso
          </CardTitle>
        </CardHeader>
        <CardContent>
          <ul className="space-y-2">
            {EXEMPLOS.map((exemplo, index) => (
              <li key={index} className="flex items-start gap-2 text-sm text-muted-foreground">
                <span className="text-primary mt-0.5">•</span>
                <span>{exemplo}</span>
              </li>
            ))}
          </ul>
        </CardContent>
      </Card>

      {prompt && (
        <Alert>
          <Sparkles className="h-4 w-4" />
          <AlertDescription>
            <strong>Preview:</strong> Quando um paciente buscar atendimento com {doctorName}, a Clara receberá estas instruções:
            <div className="mt-2 p-3 bg-muted rounded-md text-sm font-mono whitespace-pre-wrap">
              📋 INSTRUÇÕES ESPECÍFICAS: {prompt}
            </div>
          </AlertDescription>
        </Alert>
      )}
    </div>
  );
}
