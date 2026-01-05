-- Adicionar coluna tipo_atendimento à tabela doctor_rules
ALTER TABLE public.doctor_rules 
ADD COLUMN tipo_atendimento TEXT NOT NULL DEFAULT 'ambos' 
CHECK (tipo_atendimento IN ('consulta', 'ultrassom', 'ambos'));