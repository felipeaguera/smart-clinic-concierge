-- Enum para roles
CREATE TYPE public.app_role AS ENUM ('admin', 'user');

-- Tabela de roles de usuário
CREATE TABLE public.user_roles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  role app_role NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  UNIQUE (user_id, role)
);

-- Enable RLS
ALTER TABLE public.user_roles ENABLE ROW LEVEL SECURITY;

-- Função security definer para checar role
CREATE OR REPLACE FUNCTION public.has_role(_user_id UUID, _role app_role)
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.user_roles
    WHERE user_id = _user_id
      AND role = _role
  )
$$;

-- RLS para user_roles: admins podem ver todos, users veem apenas seus próprios
CREATE POLICY "Admins podem ver todas as roles"
ON public.user_roles FOR SELECT
TO authenticated
USING (public.has_role(auth.uid(), 'admin') OR user_id = auth.uid());

-- Policies de INSERT/UPDATE/DELETE para admins nas tabelas do sistema

-- doctors: admin pode tudo
CREATE POLICY "Admins podem inserir doctors"
ON public.doctors FOR INSERT
TO authenticated
WITH CHECK (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Admins podem atualizar doctors"
ON public.doctors FOR UPDATE
TO authenticated
USING (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Admins podem deletar doctors"
ON public.doctors FOR DELETE
TO authenticated
USING (public.has_role(auth.uid(), 'admin'));

-- exam_types: admin pode tudo
CREATE POLICY "Admins podem inserir exam_types"
ON public.exam_types FOR INSERT
TO authenticated
WITH CHECK (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Admins podem atualizar exam_types"
ON public.exam_types FOR UPDATE
TO authenticated
USING (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Admins podem deletar exam_types"
ON public.exam_types FOR DELETE
TO authenticated
USING (public.has_role(auth.uid(), 'admin'));

-- doctor_rules: admin pode tudo
CREATE POLICY "Admins podem inserir doctor_rules"
ON public.doctor_rules FOR INSERT
TO authenticated
WITH CHECK (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Admins podem atualizar doctor_rules"
ON public.doctor_rules FOR UPDATE
TO authenticated
USING (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Admins podem deletar doctor_rules"
ON public.doctor_rules FOR DELETE
TO authenticated
USING (public.has_role(auth.uid(), 'admin'));

-- schedule_exceptions: admin pode tudo
CREATE POLICY "Admins podem inserir schedule_exceptions"
ON public.schedule_exceptions FOR INSERT
TO authenticated
WITH CHECK (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Admins podem atualizar schedule_exceptions"
ON public.schedule_exceptions FOR UPDATE
TO authenticated
USING (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Admins podem deletar schedule_exceptions"
ON public.schedule_exceptions FOR DELETE
TO authenticated
USING (public.has_role(auth.uid(), 'admin'));

-- appointments: admin pode tudo
CREATE POLICY "Admins podem inserir appointments"
ON public.appointments FOR INSERT
TO authenticated
WITH CHECK (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Admins podem atualizar appointments"
ON public.appointments FOR UPDATE
TO authenticated
USING (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Admins podem deletar appointments"
ON public.appointments FOR DELETE
TO authenticated
USING (public.has_role(auth.uid(), 'admin'));