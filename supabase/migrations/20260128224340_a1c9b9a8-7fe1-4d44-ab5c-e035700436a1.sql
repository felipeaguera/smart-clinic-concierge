-- Adicionar coluna auto_pause_until para pausas automáticas
ALTER TABLE public.human_handoff_queue 
ADD COLUMN auto_pause_until timestamp with time zone DEFAULT NULL;

-- Comentário explicativo
COMMENT ON COLUMN public.human_handoff_queue.auto_pause_until IS 'Até quando a Clara deve ficar em silêncio (pausa automática de 1 hora quando secretária envia mensagem)';