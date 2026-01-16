-- Recria a view com security_invoker = ON para usar as permissões do usuário que consulta
DROP VIEW IF EXISTS public.agenda_publica;

CREATE VIEW public.agenda_publica
WITH (security_invoker = on)
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

-- Mantém o acesso de leitura
GRANT SELECT ON public.agenda_publica TO anon;
GRANT SELECT ON public.agenda_publica TO authenticated;