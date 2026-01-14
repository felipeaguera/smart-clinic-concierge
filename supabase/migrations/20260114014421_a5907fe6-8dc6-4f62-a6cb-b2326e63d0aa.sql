-- Adiciona campo is_encaixe na tabela appointments para identificar encaixes
ALTER TABLE public.appointments 
ADD COLUMN is_encaixe BOOLEAN NOT NULL DEFAULT false;

-- Cria tabela para datas extras de agenda (agendas abertas manualmente)
CREATE TABLE public.schedule_openings (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  doctor_id UUID NOT NULL REFERENCES public.doctors(id) ON DELETE CASCADE,
  data DATE NOT NULL,
  hora_inicio TIME NOT NULL,
  hora_fim TIME NOT NULL,
  tipo_atendimento TEXT NOT NULL DEFAULT 'ambos' CHECK (tipo_atendimento IN ('consulta', 'ultrassom', 'ambos')),
  motivo TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  UNIQUE(doctor_id, data, hora_inicio, hora_fim)
);

-- Habilita RLS
ALTER TABLE public.schedule_openings ENABLE ROW LEVEL SECURITY;

-- Políticas RLS para schedule_openings (apenas admins)
CREATE POLICY "Admins can view schedule_openings"
ON public.schedule_openings
FOR SELECT
USING (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Admins can create schedule_openings"
ON public.schedule_openings
FOR INSERT
WITH CHECK (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Admins can update schedule_openings"
ON public.schedule_openings
FOR UPDATE
USING (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Admins can delete schedule_openings"
ON public.schedule_openings
FOR DELETE
USING (public.has_role(auth.uid(), 'admin'));

-- Comentários
COMMENT ON COLUMN public.appointments.is_encaixe IS 'Indica se é um encaixe (sobrepõe horários ou ultrapassa limite da agenda)';
COMMENT ON TABLE public.schedule_openings IS 'Datas extras de atendimento para médicos sem agenda fixa ou agendas extras';