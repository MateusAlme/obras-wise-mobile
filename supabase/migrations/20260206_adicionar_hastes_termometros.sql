-- =====================================================
-- Migration: Adicionar campos Hastes Aplicadas e Medição do Termômetro
-- Data: 2026-02-06
-- Autor: Sistema
-- =====================================================

-- 1. Adicionar coluna para estrutura de Hastes Aplicadas (múltiplas instâncias)
ALTER TABLE public.obras
ADD COLUMN IF NOT EXISTS checklist_hastes_aplicadas_data JSONB DEFAULT '[]';

COMMENT ON COLUMN public.obras.checklist_hastes_aplicadas_data IS
'Checklist de Fiscalização - Hastes Aplicadas (opcional, estruturado)
Formato: [{ numero: string, isAditivo: boolean, fotos: FotoInfo[] }]';

-- 2. Adicionar coluna flat para compatibilidade (todas as fotos juntas)
ALTER TABLE public.obras
ADD COLUMN IF NOT EXISTS fotos_checklist_hastes_aplicadas JSONB DEFAULT '[]';

COMMENT ON COLUMN public.obras.fotos_checklist_hastes_aplicadas IS
'Checklist de Fiscalização - Hastes Aplicadas - Fotos (flat array para compatibilidade)';

-- 3. Adicionar coluna para estrutura de Medição do Termômetro (múltiplas instâncias)
ALTER TABLE public.obras
ADD COLUMN IF NOT EXISTS checklist_medicao_termometro_data JSONB DEFAULT '[]';

COMMENT ON COLUMN public.obras.checklist_medicao_termometro_data IS
'Checklist de Fiscalização - Medição do Termômetro (opcional, estruturado)
Formato: [{ numero: string, isAditivo: boolean, fotos: FotoInfo[] }]';

-- 4. Adicionar coluna flat para compatibilidade (todas as fotos juntas)
ALTER TABLE public.obras
ADD COLUMN IF NOT EXISTS fotos_checklist_medicao_termometro JSONB DEFAULT '[]';

COMMENT ON COLUMN public.obras.fotos_checklist_medicao_termometro IS
'Checklist de Fiscalização - Medição do Termômetro - Fotos (flat array para compatibilidade)';

-- 5. Verificar criação
SELECT
  column_name,
  data_type,
  column_default
FROM information_schema.columns
WHERE table_name = 'obras'
  AND column_name IN (
    'checklist_hastes_aplicadas_data',
    'fotos_checklist_hastes_aplicadas',
    'checklist_medicao_termometro_data',
    'fotos_checklist_medicao_termometro'
  )
ORDER BY column_name;
