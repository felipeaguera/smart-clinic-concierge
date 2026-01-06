-- Adiciona campo para nome do paciente nos agendamentos
ALTER TABLE public.appointments 
ADD COLUMN paciente_nome TEXT;

-- Adiciona campo para telefone do paciente (opcional, útil para contato)
ALTER TABLE public.appointments 
ADD COLUMN paciente_telefone TEXT;

-- Cria índice para busca por nome
CREATE INDEX idx_appointments_paciente_nome ON public.appointments(paciente_nome);