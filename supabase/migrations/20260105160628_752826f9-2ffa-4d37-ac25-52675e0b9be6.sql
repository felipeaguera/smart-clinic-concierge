-- Tabela: doctors
CREATE TABLE public.doctors (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  nome TEXT NOT NULL,
  especialidade TEXT NOT NULL,
  ativo BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Tabela: exam_types
CREATE TABLE public.exam_types (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  nome TEXT NOT NULL,
  categoria TEXT NOT NULL,
  duracao_minutos INTEGER NOT NULL,
  ativo BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Tabela: doctor_rules (regras de agenda por médico)
CREATE TABLE public.doctor_rules (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  doctor_id UUID NOT NULL REFERENCES public.doctors(id) ON DELETE CASCADE,
  dia_semana INTEGER NOT NULL CHECK (dia_semana >= 0 AND dia_semana <= 6),
  hora_inicio TIME NOT NULL,
  hora_fim TIME NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Tabela: schedule_exceptions (exceções de agenda)
CREATE TABLE public.schedule_exceptions (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  doctor_id UUID NOT NULL REFERENCES public.doctors(id) ON DELETE CASCADE,
  data DATE NOT NULL,
  motivo TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Tabela: appointments (agendamentos - escrita apenas pelo Motor de Agenda)
CREATE TABLE public.appointments (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  doctor_id UUID NOT NULL REFERENCES public.doctors(id) ON DELETE CASCADE,
  exam_type_id UUID NOT NULL REFERENCES public.exam_types(id) ON DELETE CASCADE,
  data DATE NOT NULL,
  hora_inicio TIME NOT NULL,
  hora_fim TIME NOT NULL,
  status TEXT NOT NULL DEFAULT 'reservado' CHECK (status IN ('reservado', 'confirmado', 'cancelado')),
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Índices para melhorar performance de buscas
CREATE INDEX idx_doctor_rules_doctor_id ON public.doctor_rules(doctor_id);
CREATE INDEX idx_doctor_rules_dia_semana ON public.doctor_rules(dia_semana);
CREATE INDEX idx_schedule_exceptions_doctor_id ON public.schedule_exceptions(doctor_id);
CREATE INDEX idx_schedule_exceptions_data ON public.schedule_exceptions(data);
CREATE INDEX idx_appointments_doctor_id ON public.appointments(doctor_id);
CREATE INDEX idx_appointments_data ON public.appointments(data);
CREATE INDEX idx_appointments_status ON public.appointments(status);

-- Enable RLS em todas as tabelas
ALTER TABLE public.doctors ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.exam_types ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.doctor_rules ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.schedule_exceptions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.appointments ENABLE ROW LEVEL SECURITY;

-- Policies de leitura pública (dados da clínica são públicos para consulta)
CREATE POLICY "Doctors são visíveis publicamente" ON public.doctors FOR SELECT USING (true);
CREATE POLICY "Exam types são visíveis publicamente" ON public.exam_types FOR SELECT USING (true);
CREATE POLICY "Doctor rules são visíveis publicamente" ON public.doctor_rules FOR SELECT USING (true);
CREATE POLICY "Schedule exceptions são visíveis publicamente" ON public.schedule_exceptions FOR SELECT USING (true);
CREATE POLICY "Appointments são visíveis publicamente" ON public.appointments FOR SELECT USING (true);

-- Policies de escrita serão adicionadas posteriormente com autenticação de admin