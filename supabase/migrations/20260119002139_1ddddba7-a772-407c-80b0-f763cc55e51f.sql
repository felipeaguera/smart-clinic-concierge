-- Recriar view agenda_publica com security_invoker para respeitar RLS
DROP VIEW IF EXISTS public.agenda_publica;

CREATE VIEW public.agenda_publica 
WITH (security_invoker = true) AS
SELECT 
  a.id,
  a.data,
  a.hora_inicio,
  a.hora_fim,
  a.doctor_id,
  a.status,
  a.is_encaixe,
  et.categoria AS tipo_atendimento,
  et.duracao_minutos
FROM public.appointments a
LEFT JOIN public.exam_types et ON a.exam_type_id = et.id;