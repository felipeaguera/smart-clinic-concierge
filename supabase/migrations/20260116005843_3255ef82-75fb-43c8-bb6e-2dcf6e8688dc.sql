-- 1. Remove a política pública de SELECT da tabela appointments
DROP POLICY IF EXISTS "Appointments são visíveis publicamente" ON public.appointments;

-- 2. Cria nova política de SELECT apenas para admins
CREATE POLICY "Admins podem visualizar appointments"
ON public.appointments
FOR SELECT
USING (has_role(auth.uid(), 'admin'::app_role));

-- 3. Cria VIEW pública com apenas dados não sensíveis para a agenda visual
-- Esta view mostra apenas ocupação de horários, sem dados de pacientes
CREATE VIEW public.agenda_publica
WITH (security_invoker = off)
AS
SELECT 
  a.id,
  a.data,
  a.hora_inicio,
  a.hora_fim,
  a.doctor_id,
  a.status,
  a.is_encaixe,
  et.categoria as tipo_atendimento,
  et.duracao_minutos
FROM public.appointments a
LEFT JOIN public.exam_types et ON a.exam_type_id = et.id;

-- 4. Concede acesso de leitura à view para usuários anônimos e autenticados
GRANT SELECT ON public.agenda_publica TO anon;
GRANT SELECT ON public.agenda_publica TO authenticated;