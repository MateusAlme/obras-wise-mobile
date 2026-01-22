-- Migração: Unificar doc_materiais_previsto e doc_materiais_realizado
-- Data: 2026-01-22
-- Descrição: Move todos os documentos de doc_materiais_realizado para doc_materiais_previsto
--            e remove a coluna doc_materiais_realizado

-- 1. Verificar quantas obras têm doc_materiais_realizado
DO $$
DECLARE
  count_realizado INTEGER;
BEGIN
  SELECT COUNT(*) INTO count_realizado
  FROM obras
  WHERE doc_materiais_realizado IS NOT NULL
    AND jsonb_array_length(doc_materiais_realizado) > 0;

  RAISE NOTICE 'Obras com doc_materiais_realizado: %', count_realizado;
END $$;

-- 2. Unificar: Mesclar doc_materiais_realizado em doc_materiais_previsto
UPDATE obras
SET doc_materiais_previsto = (
  COALESCE(doc_materiais_previsto, '[]'::jsonb) ||
  COALESCE(doc_materiais_realizado, '[]'::jsonb)
)
WHERE doc_materiais_realizado IS NOT NULL
  AND jsonb_array_length(doc_materiais_realizado) > 0;

-- 3. Verificar resultado
DO $$
DECLARE
  count_unificado INTEGER;
BEGIN
  SELECT COUNT(*) INTO count_unificado
  FROM obras
  WHERE doc_materiais_previsto IS NOT NULL
    AND jsonb_array_length(doc_materiais_previsto) > 0;

  RAISE NOTICE 'Obras com doc_materiais_previsto após migração: %', count_unificado;
END $$;

-- 4. Limpar coluna doc_materiais_realizado (opcional - pode ser removida depois)
-- NOTA: Não removemos a coluna para manter compatibilidade com apps antigos
-- Apenas limpamos os dados
UPDATE obras
SET doc_materiais_realizado = '[]'::jsonb
WHERE doc_materiais_realizado IS NOT NULL;

COMMENT ON COLUMN obras.doc_materiais_realizado IS 'DEPRECATED: Use doc_materiais_previsto. Esta coluna será removida em versão futura.';
