-- Tabela: whatsapp_messages (contexto da IA com TTL 24h)
CREATE TABLE public.whatsapp_messages (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  phone TEXT NOT NULL,
  provider_message_id TEXT UNIQUE,
  direction TEXT NOT NULL CHECK (direction IN ('inbound', 'outbound')),
  content TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  expires_at TIMESTAMPTZ NOT NULL DEFAULT (now() + interval '24 hours')
);

-- Índices para performance
CREATE INDEX idx_whatsapp_messages_phone ON public.whatsapp_messages(phone);
CREATE INDEX idx_whatsapp_messages_expires ON public.whatsapp_messages(expires_at);

-- RLS para whatsapp_messages
ALTER TABLE public.whatsapp_messages ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins podem visualizar whatsapp_messages"
ON public.whatsapp_messages FOR SELECT
USING (has_role(auth.uid(), 'admin'::app_role));

-- Tabela: human_handoff_queue (fila de atendimentos pendentes)
CREATE TABLE public.human_handoff_queue (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  phone TEXT NOT NULL,
  patient_name TEXT,
  status TEXT NOT NULL DEFAULT 'open' CHECK (status IN ('open', 'resolved')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  resolved_at TIMESTAMPTZ,
  resolved_by UUID REFERENCES auth.users(id)
);

-- Índices para performance
CREATE INDEX idx_handoff_phone_status ON public.human_handoff_queue(phone, status);
CREATE INDEX idx_handoff_status ON public.human_handoff_queue(status);

-- RLS para human_handoff_queue
ALTER TABLE public.human_handoff_queue ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins podem visualizar handoff_queue"
ON public.human_handoff_queue FOR SELECT
USING (has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Admins podem atualizar handoff_queue"
ON public.human_handoff_queue FOR UPDATE
USING (has_role(auth.uid(), 'admin'::app_role));

-- Habilitar Realtime para human_handoff_queue
ALTER PUBLICATION supabase_realtime ADD TABLE public.human_handoff_queue;

-- Tabela: whatsapp_config (status da conexão Z-API)
CREATE TABLE public.whatsapp_config (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  is_connected BOOLEAN NOT NULL DEFAULT false,
  last_check TIMESTAMPTZ,
  qr_code_base64 TEXT,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- RLS para whatsapp_config
ALTER TABLE public.whatsapp_config ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins podem visualizar whatsapp_config"
ON public.whatsapp_config FOR SELECT
USING (has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Admins podem atualizar whatsapp_config"
ON public.whatsapp_config FOR UPDATE
USING (has_role(auth.uid(), 'admin'::app_role));

-- Inserir registro inicial de configuração
INSERT INTO public.whatsapp_config (is_connected) VALUES (false);