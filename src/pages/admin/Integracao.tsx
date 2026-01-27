import { useState, useEffect } from "react";
import { AdminLayout } from "@/components/admin/AdminLayout";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Loader2, CheckCircle, XCircle, RefreshCw, Phone, Clock, User } from "lucide-react";
import { useRealtimeHandoffs } from "@/hooks/useRealtimeHandoffs";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { formatDistanceToNow } from "date-fns";
import { ptBR } from "date-fns/locale";

export default function Integracao() {
  const { toast } = useToast();
  const { handoffs, pendingCount, isLoading: handoffsLoading, resolveHandoff } = useRealtimeHandoffs();

  // WhatsApp connection state
  const [connected, setConnected] = useState(false);
  const [qrCode, setQrCode] = useState<string | null>(null);
  const [checkingStatus, setCheckingStatus] = useState(true);
  const [statusError, setStatusError] = useState<string | null>(null);

  // Resolving state
  const [resolvingId, setResolvingId] = useState<string | null>(null);

  // Check Z-API status
  const checkStatus = async () => {
    setCheckingStatus(true);
    setStatusError(null);

    try {
      const { data: session } = await supabase.auth.getSession();
      if (!session?.session?.access_token) {
        setStatusError("Sessão expirada");
        return;
      }

      const response = await supabase.functions.invoke("zapi-status", {
        headers: {
          Authorization: `Bearer ${session.session.access_token}`,
        },
      });

      if (response.error) {
        setStatusError(response.error.message);
        return;
      }

      const data = response.data;
      setConnected(data.connected || false);
      setQrCode(data.qrCodeBase64 || null);

      if (data.error) {
        setStatusError(data.error);
      }
    } catch (err) {
      console.error("Error checking status:", err);
      setStatusError("Erro ao verificar status");
    } finally {
      setCheckingStatus(false);
    }
  };

  // Initial check and polling
  useEffect(() => {
    checkStatus();

    // Poll every 15 seconds
    const interval = setInterval(checkStatus, 15000);

    return () => clearInterval(interval);
  }, []);

  // Handle resolve handoff
  const handleResolve = async (id: string) => {
    setResolvingId(id);
    try {
      await resolveHandoff(id);
      toast({
        title: "Atendimento resolvido",
        description: "O paciente voltará a ser atendido pela Clara.",
      });
    } catch (err) {
      toast({
        title: "Erro ao resolver",
        description: "Tente novamente.",
        variant: "destructive",
      });
    } finally {
      setResolvingId(null);
    }
  };

  // Format phone for display
  const formatPhone = (phone: string) => {
    // Format: +55 11 99999-9999
    const cleaned = phone.replace(/\D/g, "");
    if (cleaned.length === 13) {
      return `+${cleaned.slice(0, 2)} ${cleaned.slice(2, 4)} ${cleaned.slice(4, 9)}-${cleaned.slice(9)}`;
    }
    if (cleaned.length === 12) {
      return `+${cleaned.slice(0, 2)} ${cleaned.slice(2, 4)} ${cleaned.slice(4, 8)}-${cleaned.slice(8)}`;
    }
    return phone;
  };

  return (
    <AdminLayout title="Integração">
      <div className="space-y-6">
        <Tabs defaultValue="whatsapp" className="w-full">
          <TabsList>
            <TabsTrigger value="whatsapp">WhatsApp</TabsTrigger>
            <TabsTrigger value="pendentes" className="relative">
              Atendimentos Pendentes
              {pendingCount > 0 && (
                <Badge variant="destructive" className="ml-2 h-5 min-w-5 px-1.5">
                  {pendingCount}
                </Badge>
              )}
            </TabsTrigger>
          </TabsList>

          {/* WhatsApp Tab */}
          <TabsContent value="whatsapp" className="mt-6">
            <Card>
              <CardHeader>
                <div className="flex items-center justify-between">
                  <div>
                    <CardTitle>Conexão WhatsApp</CardTitle>
                    <CardDescription>
                      Conecte o WhatsApp da clínica para atendimento automatizado via Clara
                    </CardDescription>
                  </div>
                  <Button variant="outline" size="sm" onClick={checkStatus} disabled={checkingStatus}>
                    <RefreshCw className={`h-4 w-4 mr-2 ${checkingStatus ? "animate-spin" : ""}`} />
                    Atualizar
                  </Button>
                </div>
              </CardHeader>
              <CardContent>
                <div className="flex flex-col items-center space-y-6 py-6">
                  {/* Status Badge */}
                  <div className="flex items-center gap-2">
                    <span className="text-sm text-muted-foreground">Status:</span>
                    {checkingStatus ? (
                      <Badge variant="outline" className="gap-1">
                        <Loader2 className="h-3 w-3 animate-spin" />
                        Verificando...
                      </Badge>
                    ) : connected ? (
                      <Badge className="gap-1 bg-primary hover:bg-primary/90">
                        <CheckCircle className="h-3 w-3" />
                        Conectado
                      </Badge>
                    ) : (
                      <Badge variant="destructive" className="gap-1">
                        <XCircle className="h-3 w-3" />
                        Desconectado
                      </Badge>
                    )}
                  </div>

                  {/* QR Code */}
                  {!connected && !checkingStatus && (
                    <div className="flex flex-col items-center space-y-4">
                      {qrCode ? (
                        <>
                          <div className="border-4 border-muted rounded-lg p-2 bg-white">
                            <img src={qrCode} alt="QR Code WhatsApp" className="w-64 h-64" />
                          </div>
                          <p className="text-sm text-muted-foreground text-center max-w-md">
                            Abra o WhatsApp no celular, vá em <strong>Aparelhos conectados</strong> e escaneie o QR Code
                            acima para conectar a clínica.
                          </p>
                        </>
                      ) : statusError ? (
                        <div className="text-center space-y-2">
                          <p className="text-destructive">{statusError}</p>
                          <p className="text-sm text-muted-foreground">
                            Verifique se as credenciais Z-API estão configuradas corretamente.
                          </p>
                        </div>
                      ) : (
                        <p className="text-sm text-muted-foreground">
                          Aguardando QR Code...
                        </p>
                      )}
                    </div>
                  )}

                  {/* Connected Message */}
                  {connected && !checkingStatus && (
                    <div className="text-center space-y-2">
                      <p className="text-primary font-medium">WhatsApp conectado com sucesso!</p>
                      <p className="text-sm text-muted-foreground">
                        A assistente Clara está pronta para atender os pacientes via WhatsApp.
                      </p>
                    </div>
                  )}
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          {/* Pending Handoffs Tab */}
          <TabsContent value="pendentes" className="mt-6">
            <Card>
              <CardHeader>
                <CardTitle>Pacientes Aguardando Atendimento Humano</CardTitle>
                <CardDescription>
                  Estes pacientes foram encaminhados pela Clara para atendimento manual. Após atendê-los, clique em
                  "Marcar como Resolvido" para que a Clara volte a responder automaticamente.
                </CardDescription>
              </CardHeader>
              <CardContent>
                {handoffsLoading ? (
                  <div className="flex items-center justify-center py-8">
                    <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
                  </div>
                ) : handoffs.length === 0 ? (
                  <div className="flex flex-col items-center justify-center py-12 text-center">
                    <CheckCircle className="h-12 w-12 text-primary mb-4" />
                    <p className="font-medium text-lg">Nenhum atendimento pendente</p>
                    <p className="text-sm text-muted-foreground mt-1">
                      Todos os pacientes estão sendo atendidos pela assistente Clara.
                    </p>
                  </div>
                ) : (
                  <div className="space-y-4">
                    {handoffs.map((handoff) => (
                      <div
                        key={handoff.id}
                        className="flex items-center justify-between p-4 border rounded-lg bg-card hover:bg-muted/50 transition-colors"
                      >
                        <div className="space-y-1">
                          <div className="flex items-center gap-2">
                            <User className="h-4 w-4 text-muted-foreground" />
                            <span className="font-medium">
                              {handoff.patient_name || "(Sem nome)"}
                            </span>
                          </div>
                          <div className="flex items-center gap-4 text-sm text-muted-foreground">
                            <span className="flex items-center gap-1">
                              <Phone className="h-3 w-3" />
                              {formatPhone(handoff.phone)}
                            </span>
                            <span className="flex items-center gap-1">
                              <Clock className="h-3 w-3" />
                              Aguardando há{" "}
                              {formatDistanceToNow(new Date(handoff.created_at), {
                                locale: ptBR,
                              })}
                            </span>
                          </div>
                        </div>
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => handleResolve(handoff.id)}
                          disabled={resolvingId === handoff.id}
                        >
                          {resolvingId === handoff.id ? (
                            <Loader2 className="h-4 w-4 animate-spin mr-2" />
                          ) : (
                            <CheckCircle className="h-4 w-4 mr-2" />
                          )}
                          Marcar como Resolvido
                        </Button>
                      </div>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </div>
    </AdminLayout>
  );
}
