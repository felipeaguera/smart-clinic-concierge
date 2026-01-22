-- Adicionar campo prompt_ia para instruções personalizadas da IA por médico
ALTER TABLE doctors ADD COLUMN prompt_ia text;

COMMENT ON COLUMN doctors.prompt_ia IS 'Instruções personalizadas para a IA Clara usar ao lidar com este médico';