-- Adicionar campos preparo e orientacoes à tabela exam_types
ALTER TABLE public.exam_types
ADD COLUMN preparo TEXT,
ADD COLUMN orientacoes TEXT;