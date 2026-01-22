import { useParams, useNavigate } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { AdminLayout } from '@/components/admin/AdminLayout';
import { Button } from '@/components/ui/button';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Badge } from '@/components/ui/badge';
import { ArrowLeft, Loader2, User, Stethoscope, Calendar, CalendarOff, CalendarPlus, Sparkles } from 'lucide-react';
import { DadosBasicosTab } from '@/components/admin/medico/DadosBasicosTab';
import { ConsultasTab } from '@/components/admin/medico/ConsultasTab';
import { AgendaSemanalTab } from '@/components/admin/medico/AgendaSemanalTab';
import { ExcecoesTab } from '@/components/admin/medico/ExcecoesTab';
import { DatasExtrasTab } from '@/components/admin/medico/DatasExtrasTab';
import { PromptIATab } from '@/components/admin/medico/PromptIATab';

export default function MedicoPerfil() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();

  const { data: doctor, isLoading } = useQuery({
    queryKey: ['doctor', id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('doctors')
        .select('*')
        .eq('id', id)
        .single();
      if (error) throw error;
      return data;
    },
    enabled: !!id,
  });

  if (isLoading) {
    return (
      <AdminLayout title="Carregando...">
        <div className="flex justify-center py-16">
          <Loader2 className="h-8 w-8 animate-spin text-primary" />
        </div>
      </AdminLayout>
    );
  }

  if (!doctor) {
    return (
      <AdminLayout title="Médico não encontrado">
        <div className="text-center py-16">
          <p className="text-muted-foreground mb-4">O médico solicitado não foi encontrado.</p>
          <Button onClick={() => navigate('/admin/medicos')}>Voltar para Lista</Button>
        </div>
      </AdminLayout>
    );
  }

  return (
    <AdminLayout title="">
      <div className="space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-4">
            <Button variant="ghost" size="icon" onClick={() => navigate('/admin/medicos')}>
              <ArrowLeft className="h-5 w-5" />
            </Button>
            <div>
              <div className="flex items-center gap-3">
                <h1 className="text-2xl font-bold">{doctor.nome}</h1>
                <Badge variant={doctor.ativo ? 'default' : 'secondary'}>
                  {doctor.ativo ? 'Ativo' : 'Inativo'}
                </Badge>
              </div>
              <p className="text-muted-foreground">{doctor.especialidade}</p>
            </div>
          </div>
        </div>

        {/* Tabs */}
        <Tabs defaultValue="dados" className="w-full">
          <TabsList className="grid w-full grid-cols-6">
            <TabsTrigger value="dados" className="flex items-center gap-2">
              <User className="h-4 w-4" />
              Dados
            </TabsTrigger>
            <TabsTrigger value="consultas" className="flex items-center gap-2">
              <Stethoscope className="h-4 w-4" />
              Consultas
            </TabsTrigger>
            <TabsTrigger value="agenda" className="flex items-center gap-2">
              <Calendar className="h-4 w-4" />
              Agenda
            </TabsTrigger>
            <TabsTrigger value="excecoes" className="flex items-center gap-2">
              <CalendarOff className="h-4 w-4" />
              Exceções
            </TabsTrigger>
            <TabsTrigger value="extras" className="flex items-center gap-2">
              <CalendarPlus className="h-4 w-4" />
              Extras
            </TabsTrigger>
            <TabsTrigger value="prompt" className="flex items-center gap-2">
              <Sparkles className="h-4 w-4" />
              Prompt IA
            </TabsTrigger>
          </TabsList>

          <TabsContent value="dados" className="mt-6">
            <DadosBasicosTab doctor={doctor} />
          </TabsContent>

          <TabsContent value="consultas" className="mt-6">
            <ConsultasTab doctorId={doctor.id} />
          </TabsContent>

          <TabsContent value="agenda" className="mt-6">
            <AgendaSemanalTab doctorId={doctor.id} />
          </TabsContent>

          <TabsContent value="excecoes" className="mt-6">
            <ExcecoesTab doctorId={doctor.id} />
          </TabsContent>

          <TabsContent value="extras" className="mt-6">
            <DatasExtrasTab doctorId={doctor.id} />
          </TabsContent>

          <TabsContent value="prompt" className="mt-6">
            <PromptIATab 
              doctorId={doctor.id} 
              doctorName={doctor.nome}
              promptIA={doctor.prompt_ia} 
            />
          </TabsContent>
        </Tabs>
      </div>
    </AdminLayout>
  );
}
