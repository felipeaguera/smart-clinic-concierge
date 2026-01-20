-- Corrigir search_path na função de validação
CREATE OR REPLACE FUNCTION public.validate_exam_type_doctor()
RETURNS TRIGGER 
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  -- Se a categoria for 'consulta', doctor_id é obrigatório
  IF NEW.categoria = 'consulta' AND NEW.doctor_id IS NULL THEN
    RAISE EXCEPTION 'Consultas devem estar vinculadas a um médico';
  END IF;
  RETURN NEW;
END;
$$;