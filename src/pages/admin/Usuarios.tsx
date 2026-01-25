import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { AdminLayout } from '@/components/admin/AdminLayout';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { useToast } from '@/hooks/use-toast';
import { Loader2, UserCheck, UserX, Clock, Shield, Users } from 'lucide-react';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';
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

interface Usuario {
  id: string;
  email: string;
  created_at: string;
  role: string | null;
  is_super_admin: boolean;
}

interface UsuariosResponse {
  pendentes: Usuario[];
  ativos: Usuario[];
}

export default function Usuarios() {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [loadingUserId, setLoadingUserId] = useState<string | null>(null);

  // Buscar usuários via Edge Function
  const { data, isLoading, error } = useQuery({
    queryKey: ['usuarios'],
    queryFn: async (): Promise<UsuariosResponse> => {
      const { data: sessionData } = await supabase.auth.getSession();
      
      if (!sessionData.session) {
        throw new Error('Não autenticado');
      }

      const response = await fetch(
        `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/listar-usuarios`,
        {
          method: 'GET',
          headers: {
            'Authorization': `Bearer ${sessionData.session.access_token}`,
            'Content-Type': 'application/json',
          },
        }
      );

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Erro ao carregar usuários');
      }

      return response.json();
    },
  });

  // Aprovar usuário (adicionar role admin)
  const aprovarMutation = useMutation({
    mutationFn: async (userId: string) => {
      const { error } = await supabase
        .from('user_roles')
        .insert({ user_id: userId, role: 'admin' });
      
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['usuarios'] });
      toast({
        title: 'Usuário aprovado!',
        description: 'A secretária agora tem acesso ao sistema.',
      });
      setLoadingUserId(null);
    },
    onError: (error: Error) => {
      toast({
        title: 'Erro ao aprovar',
        description: error.message,
        variant: 'destructive',
      });
      setLoadingUserId(null);
    },
  });

  // Remover acesso (deletar role)
  const removerMutation = useMutation({
    mutationFn: async (userId: string) => {
      const { error } = await supabase
        .from('user_roles')
        .delete()
        .eq('user_id', userId);
      
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['usuarios'] });
      toast({
        title: 'Acesso removido',
        description: 'O usuário não terá mais acesso ao sistema.',
      });
      setLoadingUserId(null);
    },
    onError: (error: Error) => {
      toast({
        title: 'Erro ao remover',
        description: error.message,
        variant: 'destructive',
      });
      setLoadingUserId(null);
    },
  });

  // Recusar/Deletar usuário pendente completamente
  const recusarMutation = useMutation({
    mutationFn: async (userId: string) => {
      const { data: sessionData } = await supabase.auth.getSession();
      
      if (!sessionData.session) {
        throw new Error('Não autenticado');
      }

      const response = await fetch(
        `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/listar-usuarios`,
        {
          method: 'DELETE',
          headers: {
            'Authorization': `Bearer ${sessionData.session.access_token}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({ userId }),
        }
      );

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Erro ao recusar usuário');
      }

      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['usuarios'] });
      toast({
        title: 'Usuário removido',
        description: 'A solicitação foi recusada e o usuário foi removido.',
      });
      setLoadingUserId(null);
    },
    onError: (error: Error) => {
      toast({
        title: 'Erro ao recusar',
        description: error.message,
        variant: 'destructive',
      });
      setLoadingUserId(null);
    },
  });

  const handleAprovar = (userId: string) => {
    setLoadingUserId(userId);
    aprovarMutation.mutate(userId);
  };

  const handleRemover = (userId: string) => {
    setLoadingUserId(userId);
    removerMutation.mutate(userId);
  };

  const handleRecusar = (userId: string) => {
    setLoadingUserId(userId);
    recusarMutation.mutate(userId);
  };

  if (error) {
    return (
      <AdminLayout title="Usuários">
        <div className="flex items-center justify-center h-64">
          <div className="text-center">
            <p className="text-destructive mb-2">Erro ao carregar usuários</p>
            <p className="text-sm text-muted-foreground">{(error as Error).message}</p>
          </div>
        </div>
      </AdminLayout>
    );
  }

  return (
    <AdminLayout title="Usuários">
      <div className="space-y-6">
        {/* Header */}
        <div>
          <h1 className="text-2xl font-bold text-foreground flex items-center gap-2">
            <Users className="h-6 w-6" />
            Gestão de Usuários
          </h1>
          <p className="text-muted-foreground mt-1">
            Gerencie o acesso das secretárias ao sistema
          </p>
        </div>

        {isLoading ? (
          <div className="flex items-center justify-center h-64">
            <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
          </div>
        ) : (
          <div className="grid gap-6">
            {/* Pendentes */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2 text-lg">
                  <Clock className="h-5 w-5 text-amber-500" />
                  Aguardando Aprovação
                </CardTitle>
                <CardDescription>
                  Usuários que criaram conta e aguardam liberação de acesso
                </CardDescription>
              </CardHeader>
              <CardContent>
                {data?.pendentes && data.pendentes.length > 0 ? (
                  <div className="space-y-3">
                    {data.pendentes.map((usuario) => (
                      <div
                        key={usuario.id}
                        className="flex items-center justify-between p-4 rounded-lg bg-muted/50 border"
                      >
                        <div>
                          <p className="font-medium">{usuario.email}</p>
                          <p className="text-sm text-muted-foreground">
                            Criado em {format(new Date(usuario.created_at), "dd/MM/yyyy 'às' HH:mm", { locale: ptBR })}
                          </p>
                        </div>
                        <div className="flex gap-2">
                          <AlertDialog>
                            <AlertDialogTrigger asChild>
                              <Button
                                variant="outline"
                                size="sm"
                                className="text-destructive hover:text-destructive hover:bg-destructive/10"
                                disabled={loadingUserId === usuario.id}
                              >
                                {loadingUserId === usuario.id && recusarMutation.isPending ? (
                                  <Loader2 className="h-4 w-4 animate-spin" />
                                ) : (
                                  <>
                                    <UserX className="h-4 w-4 mr-1" />
                                    Recusar
                                  </>
                                )}
                              </Button>
                            </AlertDialogTrigger>
                            <AlertDialogContent>
                              <AlertDialogHeader>
                                <AlertDialogTitle>Recusar solicitação?</AlertDialogTitle>
                                <AlertDialogDescription>
                                  O usuário <strong>{usuario.email}</strong> será removido permanentemente do sistema.
                                  Essa ação não pode ser desfeita.
                                </AlertDialogDescription>
                              </AlertDialogHeader>
                              <AlertDialogFooter>
                                <AlertDialogCancel>Cancelar</AlertDialogCancel>
                                <AlertDialogAction
                                  onClick={() => handleRecusar(usuario.id)}
                                  className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                                >
                                  Recusar e remover
                                </AlertDialogAction>
                              </AlertDialogFooter>
                            </AlertDialogContent>
                          </AlertDialog>
                          <Button
                            onClick={() => handleAprovar(usuario.id)}
                            disabled={loadingUserId === usuario.id}
                            className="bg-primary hover:bg-primary/90"
                          >
                            {loadingUserId === usuario.id && aprovarMutation.isPending ? (
                              <Loader2 className="h-4 w-4 animate-spin" />
                            ) : (
                              <>
                                <UserCheck className="h-4 w-4 mr-2" />
                                Aprovar
                              </>
                            )}
                          </Button>
                        </div>
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="text-center py-8 text-muted-foreground">
                    <Clock className="h-12 w-12 mx-auto mb-3 opacity-20" />
                    <p>Nenhum usuário aguardando aprovação</p>
                  </div>
                )}
              </CardContent>
            </Card>

            {/* Ativos */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2 text-lg">
                  <Shield className="h-5 w-5 text-emerald-500" />
                  Usuários Ativos
                </CardTitle>
                <CardDescription>
                  Usuários com acesso ao sistema
                </CardDescription>
              </CardHeader>
              <CardContent>
                {data?.ativos && data.ativos.length > 0 ? (
                  <div className="space-y-3">
                    {data.ativos.map((usuario) => (
                      <div
                        key={usuario.id}
                        className="flex items-center justify-between p-4 rounded-lg bg-muted/50 border"
                      >
                        <div className="flex items-center gap-3">
                          <div>
                            <p className="font-medium flex items-center gap-2">
                              {usuario.email}
                              {usuario.is_super_admin && (
                                <span className="text-xs bg-primary/10 text-primary px-2 py-0.5 rounded-full">
                                  Super Admin
                                </span>
                              )}
                            </p>
                            <p className="text-sm text-muted-foreground">
                              {usuario.is_super_admin ? 'Administrador principal' : 'Secretária'}
                            </p>
                          </div>
                        </div>
                        
                        {!usuario.is_super_admin && (
                          <AlertDialog>
                            <AlertDialogTrigger asChild>
                              <Button
                                variant="outline"
                                size="sm"
                                className="text-destructive hover:text-destructive hover:bg-destructive/10"
                                disabled={loadingUserId === usuario.id}
                              >
                                {loadingUserId === usuario.id ? (
                                  <Loader2 className="h-4 w-4 animate-spin" />
                                ) : (
                                  <>
                                    <UserX className="h-4 w-4 mr-2" />
                                    Remover
                                  </>
                                )}
                              </Button>
                            </AlertDialogTrigger>
                            <AlertDialogContent>
                              <AlertDialogHeader>
                                <AlertDialogTitle>Remover acesso?</AlertDialogTitle>
                                <AlertDialogDescription>
                                  O usuário <strong>{usuario.email}</strong> perderá acesso ao sistema. 
                                  Essa ação pode ser revertida aprovando o usuário novamente.
                                </AlertDialogDescription>
                              </AlertDialogHeader>
                              <AlertDialogFooter>
                                <AlertDialogCancel>Cancelar</AlertDialogCancel>
                                <AlertDialogAction
                                  onClick={() => handleRemover(usuario.id)}
                                  className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                                >
                                  Remover acesso
                                </AlertDialogAction>
                              </AlertDialogFooter>
                            </AlertDialogContent>
                          </AlertDialog>
                        )}
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="text-center py-8 text-muted-foreground">
                    <Shield className="h-12 w-12 mx-auto mb-3 opacity-20" />
                    <p>Nenhum usuário ativo</p>
                  </div>
                )}
              </CardContent>
            </Card>

            {/* Instruções */}
            <Card className="bg-muted/30">
              <CardContent className="pt-6">
                <h3 className="font-medium mb-3 flex items-center gap-2">
                  <span className="text-lg">📝</span>
                  Como adicionar uma nova secretária
                </h3>
                <ol className="space-y-2 text-sm text-muted-foreground list-decimal list-inside">
                  <li>A secretária acessa a página de login (<code className="bg-muted px-1.5 py-0.5 rounded">/login</code>)</li>
                  <li>Clica em "Não tem conta? Criar uma"</li>
                  <li>Preenche e-mail e senha</li>
                  <li>A conta aparece aqui em "Aguardando Aprovação"</li>
                  <li>Você clica em "Aprovar" e ela terá acesso</li>
                </ol>
              </CardContent>
            </Card>
          </div>
        )}
      </div>
    </AdminLayout>
  );
}
