-- Adicionar campos de preço à tabela exam_types
ALTER TABLE public.exam_types
ADD COLUMN has_price boolean NOT NULL DEFAULT false,
ADD COLUMN price_private numeric(10,2) DEFAULT NULL,
ADD COLUMN currency text NOT NULL DEFAULT 'BRL';

-- Adicionar constraint para validar que price_private é positivo quando has_price = true
ALTER TABLE public.exam_types
ADD CONSTRAINT check_price_when_has_price 
CHECK (
  (has_price = false) OR 
  (has_price = true AND price_private IS NOT NULL AND price_private > 0)
);