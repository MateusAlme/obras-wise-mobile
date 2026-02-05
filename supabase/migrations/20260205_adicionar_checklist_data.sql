-- =====================================================
-- Migration: Adicionar colunas de dados estruturados do Checklist
-- Data: 2026-02-05
-- Descrição: Permite salvar dados completos dos postes, seccionamentos
--            e aterramentos de cerca do Checklist de Fiscalização
-- =====================================================

-- 1. Adicionar coluna para dados estruturados dos postes do Checklist
ALTER TABLE public.obras
ADD COLUMN IF NOT EXISTS checklist_postes_data JSONB DEFAULT '[]'::jsonb;

-- 2. Adicionar coluna para dados estruturados dos seccionamentos
ALTER TABLE public.obras
ADD COLUMN IF NOT EXISTS checklist_seccionamentos_data JSONB DEFAULT '[]'::jsonb;

-- 3. Adicionar coluna para dados estruturados dos aterramentos de cerca
ALTER TABLE public.obras
ADD COLUMN IF NOT EXISTS checklist_aterramentos_cerca_data JSONB DEFAULT '[]'::jsonb;

-- 4. Adicionar comentários explicativos
COMMENT ON COLUMN public.obras.checklist_postes_data IS
'Dados estruturados dos postes no Checklist de Fiscalização. Formato JSON:
[{
  "id": "poste_1",
  "numero": "5",
  "status": "instalado" | "retirado",
  "posteInteiro": ["foto_id1", ...],
  "engaste": ["foto_id2", ...],
  "conexao1": [...],
  "conexao2": [...],
  "maiorEsforco": [...],
  "menorEsforco": [...]
}]';

COMMENT ON COLUMN public.obras.checklist_seccionamentos_data IS
'Dados estruturados dos seccionamentos de cerca. Formato JSON:
[{
  "id": "seccionamento_1",
  "fotos": ["foto_id1", "foto_id2", ...]
}]';

COMMENT ON COLUMN public.obras.checklist_aterramentos_cerca_data IS
'Dados estruturados dos aterramentos de cerca. Formato JSON:
[{
  "id": "aterramento_1",
  "fotos": ["foto_id1", "foto_id2", ...]
}]';

-- 5. Verificação
DO $$
DECLARE
  col_postes BOOLEAN;
  col_secc BOOLEAN;
  col_aterr BOOLEAN;
BEGIN
  SELECT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'obras' AND column_name = 'checklist_postes_data'
  ) INTO col_postes;

  SELECT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'obras' AND column_name = 'checklist_seccionamentos_data'
  ) INTO col_secc;

  SELECT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'obras' AND column_name = 'checklist_aterramentos_cerca_data'
  ) INTO col_aterr;

  IF col_postes AND col_secc AND col_aterr THEN
    RAISE NOTICE '✅ Todas as colunas de checklist_data foram criadas com sucesso!';
    RAISE NOTICE '   - checklist_postes_data: OK';
    RAISE NOTICE '   - checklist_seccionamentos_data: OK';
    RAISE NOTICE '   - checklist_aterramentos_cerca_data: OK';
  ELSE
    RAISE WARNING '⚠️ Algumas colunas não foram criadas. Verifique manualmente.';
  END IF;
END $$;
