-- =====================================================
-- Migration: Adicionar coluna doc_autorizacao_passagem
-- Data: 2025-02-14
-- Descrição: Adiciona suporte para documentos de Autorização de Passagem
-- =====================================================

-- Adicionar coluna doc_autorizacao_passagem na tabela obras
ALTER TABLE obras
ADD COLUMN IF NOT EXISTS doc_autorizacao_passagem jsonb DEFAULT '[]'::jsonb;

-- Adicionar comentário para documentação
COMMENT ON COLUMN obras.doc_autorizacao_passagem IS 'Array JSONB contendo documentos PDF de Autorização de Passagem com URLs do Supabase Storage';

-- Verificar se a coluna foi criada
DO $$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM information_schema.columns
    WHERE table_name = 'obras'
    AND column_name = 'doc_autorizacao_passagem'
  ) THEN
    RAISE NOTICE '✅ Coluna doc_autorizacao_passagem criada com sucesso!';
  ELSE
    RAISE EXCEPTION '❌ Falha ao criar coluna doc_autorizacao_passagem';
  END IF;
END $$;
