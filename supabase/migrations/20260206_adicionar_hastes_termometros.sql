-- =====================================================
-- Migration: Adicionar campos Hastes Aplicadas e Medição do Termômetro
-- Data: 2026-02-06
-- Autor: Sistema
-- =====================================================

-- 1. Adicionar coluna para estrutura unificada de Hastes e Termômetros (múltiplos pontos)
ALTER TABLE public.obras
ADD COLUMN IF NOT EXISTS checklist_hastes_termometros_data JSONB DEFAULT '[]';

COMMENT ON COLUMN public.obras.checklist_hastes_termometros_data IS
'Checklist de Fiscalização - Hastes Aplicadas e Medição do Termômetro (opcional, estruturado)
Cada ponto (P1, P2, etc.) contém ambas as fotos
Formato: [{ numero: string, isAditivo: boolean, fotoHaste: FotoInfo[], fotoTermometro: FotoInfo[] }]';

-- 2. Adicionar colunas flat para compatibilidade (arrays separados)
ALTER TABLE public.obras
ADD COLUMN IF NOT EXISTS fotos_checklist_hastes_aplicadas JSONB DEFAULT '[]';

COMMENT ON COLUMN public.obras.fotos_checklist_hastes_aplicadas IS
'Checklist de Fiscalização - Hastes Aplicadas - Fotos (flat array para compatibilidade)';

ALTER TABLE public.obras
ADD COLUMN IF NOT EXISTS fotos_checklist_medicao_termometro JSONB DEFAULT '[]';

COMMENT ON COLUMN public.obras.fotos_checklist_medicao_termometro IS
'Checklist de Fiscalização - Medição do Termômetro - Fotos (flat array para compatibilidade)';

-- 3. Verificar criação
SELECT
  column_name,
  data_type,
  column_default
FROM information_schema.columns
WHERE table_name = 'obras'
  AND column_name IN (
    'checklist_hastes_termometros_data',
    'fotos_checklist_hastes_aplicadas',
    'fotos_checklist_medicao_termometro'
  )
ORDER BY column_name;
