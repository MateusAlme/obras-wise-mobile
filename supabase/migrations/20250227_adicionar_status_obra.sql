-- Adicionar campos de data de abertura e fechamento para controle de obras
-- A obra fica como "parcial" enquanto não tiver data_fechamento
-- Execute este SQL no Supabase SQL Editor

-- Adicionar coluna data_abertura (quando a obra foi iniciada)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'obras' AND column_name = 'data_abertura'
  ) THEN
    ALTER TABLE obras ADD COLUMN data_abertura TIMESTAMPTZ;

    -- Para obras existentes, usar created_at como data_abertura
    UPDATE obras SET data_abertura = created_at WHERE data_abertura IS NULL;

    COMMENT ON COLUMN obras.data_abertura IS 'Data e hora em que a obra foi iniciada/aberta';
  END IF;
END $$;

-- Adicionar coluna data_fechamento (quando a obra foi finalizada)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'obras' AND column_name = 'data_fechamento'
  ) THEN
    ALTER TABLE obras ADD COLUMN data_fechamento TIMESTAMPTZ;

    COMMENT ON COLUMN obras.data_fechamento IS 'Data e hora em que a obra foi finalizada. NULL = obra parcial/em andamento';
  END IF;
END $$;

-- Criar índices para melhor performance
CREATE INDEX IF NOT EXISTS obras_data_abertura_idx ON obras(data_abertura);
CREATE INDEX IF NOT EXISTS obras_data_fechamento_idx ON obras(data_fechamento);

-- Verificar resultado
SELECT column_name, data_type, is_nullable, column_default
FROM information_schema.columns
WHERE table_name = 'obras' AND column_name IN ('data_abertura', 'data_fechamento')
ORDER BY column_name;
