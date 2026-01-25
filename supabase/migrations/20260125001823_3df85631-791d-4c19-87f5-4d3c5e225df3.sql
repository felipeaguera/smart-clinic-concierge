-- Tabela de perfis para armazenar nome das secretárias
CREATE TABLE public.profiles (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  nome TEXT,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- Habilitar RLS
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;

-- Usuários podem ver seu próprio perfil
CREATE POLICY "Usuarios podem ver seu perfil"
ON public.profiles FOR SELECT TO authenticated
USING (id = auth.uid());

-- Usuários podem atualizar seu próprio perfil
CREATE POLICY "Usuarios podem atualizar seu perfil"
ON public.profiles FOR UPDATE TO authenticated
USING (id = auth.uid());

-- Usuários podem inserir seu próprio perfil (para o signup)
CREATE POLICY "Usuarios podem inserir seu perfil"
ON public.profiles FOR INSERT TO authenticated
WITH CHECK (id = auth.uid());

-- Admins podem ver todos os perfis
CREATE POLICY "Admins podem ver todos perfis"
ON public.profiles FOR SELECT TO authenticated
USING (has_role(auth.uid(), 'admin'::app_role));

-- Trigger para criar perfil automaticamente quando usuário é criado
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO public.profiles (id)
  VALUES (NEW.id);
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

-- Trigger no auth.users
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();