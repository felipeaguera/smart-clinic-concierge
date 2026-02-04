-- Tabela de mapeamento Lid → Telefone
-- Armazena a relação entre identificadores @lid do Z-API e telefones reais

CREATE TABLE public.whatsapp_lid_mappings (
  lid_id TEXT PRIMARY KEY,
  phone TEXT NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Índice para busca reversa por telefone
CREATE INDEX idx_whatsapp_lid_mappings_phone ON public.whatsapp_lid_mappings(phone);

-- Enable RLS
ALTER TABLE public.whatsapp_lid_mappings ENABLE ROW LEVEL SECURITY;

-- Comentário na tabela
COMMENT ON TABLE public.whatsapp_lid_mappings IS 'Mapeamento de identificadores @lid do Z-API para telefones reais';