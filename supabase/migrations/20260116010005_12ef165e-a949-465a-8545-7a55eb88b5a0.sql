-- Abordagem correta: Manter a view com security_invoker=off mas apenas com campos não sensíveis
-- A tabela appointments continua protegida, mas a view expõe apenas dados públicos

DROP VIEW IF EXISTS public.agenda_publica;

-- View pública SEM security_invoker para permitir acesso anônimo
-- Esta é segura porque NÃO expõe dados sensíveis (nome, telefone)
CREATE VIEW public.agenda_publica AS
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

-- Concede acesso de leitura à view
GRANT SELECT ON public.agenda_publica TO anon;
GRANT SELECT ON public.agenda_publica TO authenticated;