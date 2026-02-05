-- =====================================================
-- Migration: Adicionar campos Frying e Abertura/Fechamento de Pulo
-- Data: 2026-02-06
-- Autor: Sistema
-- =====================================================

-- 1. Adicionar coluna Frying (opcional, 2 fotos)
ALTER TABLE public.obras
ADD COLUMN IF NOT EXISTS fotos_checklist_frying JSONB DEFAULT '[]';

COMMENT ON COLUMN public.obras.fotos_checklist_frying IS
'Checklist de Fiscalização - Frying (opcional, 2 fotos recomendadas)';

-- 2. Adicionar coluna Abertura e Fechamento de Pulo (opcional, 2 fotos)
ALTER TABLE public.obras
ADD COLUMN IF NOT EXISTS fotos_checklist_abertura_fechamento_pulo JSONB DEFAULT '[]';

COMMENT ON COLUMN public.obras.fotos_checklist_abertura_fechamento_pulo IS
'Checklist de Fiscalização - Abertura e Fechamento de Pulo (opcional, 2 fotos recomendadas)';

-- 3. Verificar criação
SELECT
  column_name,
  data_type,
  column_default
FROM information_schema.columns
WHERE table_name = 'obras'
  AND column_name IN ('fotos_checklist_frying', 'fotos_checklist_abertura_fechamento_pulo')
ORDER BY column_name;
