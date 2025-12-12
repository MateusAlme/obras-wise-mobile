-- ========================================
-- Migration: Adicionar colunas para fotos de abertura e fechamento de chave
-- Data: 2025-01-13
-- ========================================

-- Adicionar colunas para fotos de abertura e fechamento de chave
ALTER TABLE obras ADD COLUMN IF NOT EXISTS fotos_abertura JSONB DEFAULT '[]'::jsonb;
ALTER TABLE obras ADD COLUMN IF NOT EXISTS fotos_fechamento JSONB DEFAULT '[]'::jsonb;

-- Adicionar comentários para documentação
COMMENT ON COLUMN obras.fotos_abertura IS 'Array de fotos da abertura da chave com GPS (formato: [{url, latitude, longitude}])';
COMMENT ON COLUMN obras.fotos_fechamento IS 'Array de fotos do fechamento da chave com GPS (formato: [{url, latitude, longitude}])';

-- Verificar se as colunas foram criadas com sucesso
DO $$
DECLARE
  col_abertura_exists BOOLEAN;
  col_fechamento_exists BOOLEAN;
BEGIN
  SELECT EXISTS (
    SELECT 1
    FROM information_schema.columns
    WHERE table_name = 'obras'
    AND column_name = 'fotos_abertura'
  ) INTO col_abertura_exists;

  SELECT EXISTS (
    SELECT 1
    FROM information_schema.columns
    WHERE table_name = 'obras'
    AND column_name = 'fotos_fechamento'
  ) INTO col_fechamento_exists;

  IF col_abertura_exists AND col_fechamento_exists THEN
    RAISE NOTICE 'Migration executada com sucesso! Colunas fotos_abertura e fotos_fechamento criadas.';
  ELSE
    RAISE EXCEPTION 'Erro na migration: Uma ou mais colunas não foram criadas';
  END IF;
END $$;
