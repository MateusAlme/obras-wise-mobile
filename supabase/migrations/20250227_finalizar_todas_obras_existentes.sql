-- Atualizar TODAS as obras existentes para definir data_fechamento
-- No app mobile, as obras são finalizadas automaticamente ao serem salvas
-- Então data_fechamento = created_at para obras antigas

-- Primeiro, garantir que as colunas existem
DO $$
BEGIN
  -- Adicionar data_abertura se não existir
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'obras' AND column_name = 'data_abertura'
  ) THEN
    ALTER TABLE obras ADD COLUMN data_abertura TIMESTAMPTZ;
    COMMENT ON COLUMN obras.data_abertura IS 'Data e hora em que a obra foi iniciada/aberta';
  END IF;

  -- Adicionar data_fechamento se não existir
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'obras' AND column_name = 'data_fechamento'
  ) THEN
    ALTER TABLE obras ADD COLUMN data_fechamento TIMESTAMPTZ;
    COMMENT ON COLUMN obras.data_fechamento IS 'Data e hora em que a obra foi finalizada. NULL = obra parcial/em andamento';
  END IF;
END $$;

-- Atualizar obras existentes que não têm data_abertura
UPDATE obras
SET data_abertura = created_at
WHERE data_abertura IS NULL;

-- Atualizar obras existentes que não têm data_fechamento
-- No mobile, todas as obras são finalizadas ao serem salvas
UPDATE obras
SET data_fechamento = created_at
WHERE data_fechamento IS NULL;

-- Criar índices para performance
CREATE INDEX IF NOT EXISTS obras_data_abertura_idx ON obras(data_abertura);
CREATE INDEX IF NOT EXISTS obras_data_fechamento_idx ON obras(data_fechamento);

-- Mostrar resultado
SELECT
  COUNT(*) as total_obras,
  COUNT(data_abertura) as com_data_abertura,
  COUNT(data_fechamento) as finalizadas,
  COUNT(*) - COUNT(data_fechamento) as em_aberto
FROM obras;

-- Mostrar algumas obras atualizadas
SELECT
  obra,
  equipe,
  tipo_servico,
  created_at,
  data_abertura,
  data_fechamento,
  CASE
    WHEN data_fechamento IS NOT NULL THEN 'Concluída'
    ELSE 'Parcial'
  END as status
FROM obras
ORDER BY created_at DESC
LIMIT 10;
