ALTER TABLE public.whatsapp_messages
ADD COLUMN source text NOT NULL DEFAULT 'patient';