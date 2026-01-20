-- Adicionar coluna doctor_id na tabela exam_types
-- Esta coluna é obrigatória para categoria 'consulta' e opcional para outras categorias

ALTER TABLE public.exam_types 
ADD COLUMN doctor_id UUID REFERENCES public.doctors(id) ON DELETE SET NULL;

-- Criar índice para melhorar performance de buscas por médico
CREATE INDEX idx_exam_types_doctor_id ON public.exam_types(doctor_id);

-- Criar função de validação para garantir que consultas tenham médico vinculado
CREATE OR REPLACE FUNCTION public.validate_exam_type_doctor()
RETURNS TRIGGER AS $$
BEGIN
  -- Se a categoria for 'consulta', doctor_id é obrigatório
  IF NEW.categoria = 'consulta' AND NEW.doctor_id IS NULL THEN
    RAISE EXCEPTION 'Consultas devem estar vinculadas a um médico';
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Criar trigger para validar antes de INSERT e UPDATE
CREATE TRIGGER validate_exam_type_doctor_trigger
BEFORE INSERT OR UPDATE ON public.exam_types
FOR EACH ROW
EXECUTE FUNCTION public.validate_exam_type_doctor();

-- Comentário explicativo
COMMENT ON COLUMN public.exam_types.doctor_id IS 'Médico vinculado ao serviço. Obrigatório para consultas, opcional para ultrassom e laboratório.';