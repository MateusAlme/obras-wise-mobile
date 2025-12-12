-- ========================================
-- Migration: Corrigir tipo_servico para TEXT e adicionar colunas de fotos de chave
-- Data: 2025-01-13
-- ========================================

-- Adicionar colunas para fotos de abertura e fechamento de chave
ALTER TABLE obras ADD COLUMN IF NOT EXISTS fotos_abertura JSONB DEFAULT '[]'::jsonb;
ALTER TABLE obras ADD COLUMN IF NOT EXISTS fotos_fechamento JSONB DEFAULT '[]'::jsonb;

-- Verificar o tipo atual da coluna tipo_servico
DO $$
BEGIN
  -- Se tipo_servico for array, converter para TEXT
  IF EXISTS (
    SELECT 1
    FROM information_schema.columns
    WHERE table_name = 'obras'
    AND column_name = 'tipo_servico'
    AND data_type = 'ARRAY'
  ) THEN
    -- Criar coluna temporária
    ALTER TABLE obras ADD COLUMN tipo_servico_temp TEXT;

    -- Copiar dados convertendo array para string (pega o primeiro elemento)
    UPDATE obras SET tipo_servico_temp = (tipo_servico::text[])[1];

    -- Remover coluna antiga
    ALTER TABLE obras DROP COLUMN tipo_servico;

    -- Renomear coluna temporária
    ALTER TABLE obras RENAME COLUMN tipo_servico_temp TO tipo_servico;

    RAISE NOTICE 'Coluna tipo_servico convertida de ARRAY para TEXT';
  ELSE
    -- Se já for TEXT ou não existir, apenas garantir que existe
    ALTER TABLE obras ADD COLUMN IF NOT EXISTS tipo_servico TEXT;
    RAISE NOTICE 'Coluna tipo_servico já é TEXT ou foi criada como TEXT';
  END IF;
END $$;

-- Adicionar comentários para documentação
COMMENT ON COLUMN obras.tipo_servico IS 'Tipo de serviço (apenas um por obra)';
COMMENT ON COLUMN obras.fotos_abertura IS 'Array de fotos da abertura da chave com GPS (formato: [{url, latitude, longitude}])';
COMMENT ON COLUMN obras.fotos_fechamento IS 'Array de fotos do fechamento da chave com GPS (formato: [{url, latitude, longitude}])';

-- Verificar se tudo foi criado corretamente
DO $$
DECLARE
  col_tipo_servico_exists BOOLEAN;
  col_abertura_exists BOOLEAN;
  col_fechamento_exists BOOLEAN;
BEGIN
  SELECT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'obras' AND column_name = 'tipo_servico'
  ) INTO col_tipo_servico_exists;

  SELECT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'obras' AND column_name = 'fotos_abertura'
  ) INTO col_abertura_exists;

  SELECT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'obras' AND column_name = 'fotos_fechamento'
  ) INTO col_fechamento_exists;

  IF col_tipo_servico_exists AND col_abertura_exists AND col_fechamento_exists THEN
    RAISE NOTICE '✓ Migration executada com sucesso!';
    RAISE NOTICE '✓ tipo_servico: TEXT';
    RAISE NOTICE '✓ fotos_abertura: JSONB';
    RAISE NOTICE '✓ fotos_fechamento: JSONB';
  ELSE
    RAISE EXCEPTION 'Erro: Nem todas as colunas foram criadas corretamente';
  END IF;
END $$;
