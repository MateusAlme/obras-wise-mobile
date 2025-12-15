-- =====================================================
-- Migration: Adicionar colunas de Materiais (Previsto/Realizado)
-- Data: 2025-02-16
-- Descrição: Adiciona suporte para documentos de Materiais Previsto e Realizado
-- =====================================================

-- Adicionar coluna doc_materiais_previsto na tabela obras
ALTER TABLE obras
ADD COLUMN IF NOT EXISTS doc_materiais_previsto jsonb DEFAULT '[]'::jsonb;

-- Adicionar coluna doc_materiais_realizado na tabela obras
ALTER TABLE obras
ADD COLUMN IF NOT EXISTS doc_materiais_realizado jsonb DEFAULT '[]'::jsonb;

-- Adicionar comentários para documentação
COMMENT ON COLUMN obras.doc_materiais_previsto IS 'Array JSONB contendo documentos PDF de Materiais Previsto com URLs do Supabase Storage';
COMMENT ON COLUMN obras.doc_materiais_realizado IS 'Array JSONB contendo documentos PDF de Materiais Realizado com URLs do Supabase Storage';

-- Verificar se as colunas foram criadas
DO $$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM information_schema.columns
    WHERE table_name = 'obras'
    AND column_name = 'doc_materiais_previsto'
  ) THEN
    RAISE NOTICE '✅ Coluna doc_materiais_previsto criada com sucesso!';
  ELSE
    RAISE EXCEPTION '❌ Falha ao criar coluna doc_materiais_previsto';
  END IF;

  IF EXISTS (
    SELECT 1
    FROM information_schema.columns
    WHERE table_name = 'obras'
    AND column_name = 'doc_materiais_realizado'
  ) THEN
    RAISE NOTICE '✅ Coluna doc_materiais_realizado criada com sucesso!';
  ELSE
    RAISE EXCEPTION '❌ Falha ao criar coluna doc_materiais_realizado';
  END IF;
END $$;
