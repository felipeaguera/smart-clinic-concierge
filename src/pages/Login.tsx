import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '@/hooks/useAuth';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent } from '@/components/ui/card';
import { useToast } from '@/hooks/use-toast';
import { Loader2, ArrowRight } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import claraIcon from '@/assets/clara-icon.png';
import atendenteImage from '@/assets/atendente-pilarmed.png';

export default function Login() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [nome, setNome] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isSignUp, setIsSignUp] = useState(false);
  const [showForm, setShowForm] = useState(false);
  const { signIn, signUp, user, isAdmin, isLoading } = useAuth();
  const navigate = useNavigate();
  const { toast } = useToast();

  // Redirecionar automaticamente se já estiver logado como admin
  useEffect(() => {
    if (!isLoading && user && isAdmin) {
      navigate('/admin/medicos');
    }
  }, [user, isAdmin, isLoading, navigate]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!email.trim() || !password.trim()) {
      toast({
        title: 'Erro',
        description: 'Preencha todos os campos',
        variant: 'destructive',
      });
      return;
    }

    if (isSignUp && !nome.trim()) {
      toast({
        title: 'Erro',
        description: 'Preencha seu nome completo',
        variant: 'destructive',
      });
      return;
    }

    setIsSubmitting(true);

    try {
      if (isSignUp) {
        const { data, error } = await signUp(email, password);

        if (error) {
          toast({
            title: 'Erro',
            description: error.message,
            variant: 'destructive',
          });
          setIsSubmitting(false);
        } else if (data?.user) {
          // Atualizar o perfil com o nome
          await supabase
            .from('profiles')
            .update({ nome: nome.trim() })
            .eq('id', data.user.id);

          toast({
            title: 'Conta criada!',
            description: 'Solicite ao administrador para ativar seu acesso.',
          });
          setIsSubmitting(false);
          setNome('');
          setEmail('');
          setPassword('');
          setIsSignUp(false);
        }
      } else {
        const { error } = await signIn(email, password);

        if (error) {
          toast({
            title: 'Erro',
            description: error.message,
            variant: 'destructive',
          });
          setIsSubmitting(false);
        }
      }
      // Se login bem-sucedido, o useEffect vai redirecionar quando isAdmin for true
    } catch {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="min-h-screen flex flex-col bg-gradient-to-br from-[#f8faf9] via-white to-[#f0f7f4]">
      {/* Header com foto da atendente */}
      <header className="w-full p-6">
        <img src={atendenteImage} alt="Atendente Pilar Med" className="h-16 w-auto rounded-full object-cover shadow-md" />
      </header>

      {/* Conteúdo principal */}
      <main className="flex-1 flex items-center justify-center px-4 pb-12">
        <div className="w-full max-w-md space-y-8">
          
          {/* Introdução Clara */}
          {!showForm ? (
            <div className="text-center space-y-8 animate-fade-in">
              {/* Avatar Clara */}
              <div className="relative mx-auto w-24 h-24">
                <div className="absolute inset-0 bg-gradient-to-br from-[#1a5c4b] to-[#2d8a6e] rounded-full animate-pulse opacity-20" />
                <img 
                  src={claraIcon} 
                  alt="Clara - Assistente de IA" 
                  className="relative w-full h-full rounded-full object-cover shadow-lg"
                />
              </div>

              {/* Texto de boas-vindas */}
              <div className="space-y-4">
                <h1 className="text-3xl font-bold text-[#1a5c4b] leading-tight">
                  Olá! Eu sou a Clara
                </h1>
                <p className="text-lg text-muted-foreground leading-relaxed">
                  A inteligência artificial da <span className="font-semibold text-[#c9a54d]">Pilar Med</span>
                </p>
                <p className="text-sm text-muted-foreground/80 max-w-sm mx-auto">
                  Estou aqui para ajudar a gerenciar agendamentos, médicos e muito mais.
                </p>
              </div>

              {/* Botão de acesso */}
              <Button 
                onClick={() => setShowForm(true)}
                className="w-full max-w-xs mx-auto h-12 text-base font-medium bg-[#1a5c4b] hover:bg-[#154a3d] text-white shadow-lg shadow-[#1a5c4b]/20 transition-all duration-300 hover:shadow-xl hover:shadow-[#1a5c4b]/30"
              >
                Acessar Painel
                <ArrowRight className="ml-2 h-5 w-5" />
              </Button>
            </div>
          ) : (
            /* Formulário de Login */
            <Card className="border-0 shadow-xl shadow-black/5 animate-fade-in">
              <CardContent className="pt-8 pb-6 px-8">
                {/* Header do form */}
                <div className="text-center mb-8">
                  <img 
                    src={claraIcon} 
                    alt="Clara" 
                    className="mx-auto w-14 h-14 rounded-full object-cover mb-4 shadow-lg"
                  />
                  <h2 className="text-xl font-semibold text-foreground">
                    {isSignUp ? 'Criar nova conta' : 'Bem-vindo de volta!'}
                  </h2>
                  <p className="text-sm text-muted-foreground mt-1">
                    {isSignUp 
                      ? 'Preencha os dados para solicitar acesso' 
                      : 'Entre com suas credenciais'}
                  </p>
                </div>

                <form onSubmit={handleSubmit} className="space-y-5">
                  {isSignUp && (
                    <div className="space-y-2">
                      <Label htmlFor="nome" className="text-sm font-medium">
                        Nome completo
                      </Label>
                      <Input
                        id="nome"
                        type="text"
                        placeholder="Seu nome completo"
                        value={nome}
                        onChange={(e) => setNome(e.target.value)}
                        disabled={isSubmitting}
                        className="h-11 bg-muted/50 border-0 focus-visible:ring-[#1a5c4b]"
                      />
                    </div>
                  )}
                  <div className="space-y-2">
                    <Label htmlFor="email" className="text-sm font-medium">
                      E-mail
                    </Label>
                    <Input
                      id="email"
                      type="email"
                      placeholder="seu@email.com"
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      disabled={isSubmitting}
                      className="h-11 bg-muted/50 border-0 focus-visible:ring-[#1a5c4b]"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="password" className="text-sm font-medium">
                      Senha
                    </Label>
                    <Input
                      id="password"
                      type="password"
                      placeholder="••••••••"
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      disabled={isSubmitting}
                      className="h-11 bg-muted/50 border-0 focus-visible:ring-[#1a5c4b]"
                    />
                  </div>
                  <Button 
                    type="submit" 
                    className="w-full h-11 text-base font-medium bg-[#1a5c4b] hover:bg-[#154a3d] text-white mt-2" 
                    disabled={isSubmitting || isLoading}
                  >
                    {(isSubmitting || isLoading) && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                    {isSignUp ? 'Solicitar acesso' : 'Entrar'}
                  </Button>
                </form>

                {/* Divisor */}
                <div className="relative my-6">
                  <div className="absolute inset-0 flex items-center">
                    <span className="w-full border-t border-muted" />
                  </div>
                  <div className="relative flex justify-center text-xs uppercase">
                    <span className="bg-card px-2 text-muted-foreground">ou</span>
                  </div>
                </div>

                {/* Toggle login/signup */}
                <button
                  type="button"
                  onClick={() => setIsSignUp(!isSignUp)}
                  className="w-full text-center text-sm text-muted-foreground hover:text-[#1a5c4b] transition-colors"
                >
                  {isSignUp ? (
                    <>Já tem conta? <span className="font-medium text-[#1a5c4b]">Fazer login</span></>
                  ) : (
                    <>Não tem conta? <span className="font-medium text-[#1a5c4b]">Criar uma</span></>
                  )}
                </button>

                {/* Voltar */}
                <button
                  type="button"
                  onClick={() => setShowForm(false)}
                  className="w-full text-center text-xs text-muted-foreground/60 hover:text-muted-foreground mt-4 transition-colors"
                >
                  ← Voltar ao início
                </button>
              </CardContent>
            </Card>
          )}
        </div>
      </main>

      {/* Footer */}
      <footer className="w-full p-6 text-center">
        <p className="text-xs text-muted-foreground/60">
          © {new Date().getFullYear()} Pilar Med — Medicina Especializada
        </p>
      </footer>
    </div>
  );
}
