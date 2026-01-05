-- LIMPAR finalizações incorretas
-- Este SQL remove data_fechamento de TODAS as obras
-- porque não sabemos quais foram realmente finalizadas

-- 1. Criar colunas se não existirem
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'obras' AND column_name = 'data_abertura'
  ) THEN
    ALTER TABLE obras ADD COLUMN data_abertura TIMESTAMPTZ;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'obras' AND column_name = 'data_fechamento'
  ) THEN
    ALTER TABLE obras ADD COLUMN data_fechamento TIMESTAMPTZ;
  END IF;
END $$;

-- 2. Preencher data_abertura para obras existentes (se vazio)
UPDATE obras
SET data_abertura = created_at
WHERE data_abertura IS NULL;

-- 3. LIMPAR data_fechamento (marcar todas como "Em aberto")
-- Porque não sabemos quais foram realmente finalizadas
UPDATE obras
SET data_fechamento = NULL;

-- 4. Criar índices
CREATE INDEX IF NOT EXISTS obras_data_abertura_idx ON obras(data_abertura);
CREATE INDEX IF NOT EXISTS obras_data_fechamento_idx ON obras(data_fechamento);

-- 5. Verificar resultado
SELECT
  COUNT(*) as total_obras,
  COUNT(data_fechamento) as finalizadas,
  COUNT(*) - COUNT(data_fechamento) as em_aberto
FROM obras;

-- Resultado esperado: todas as obras devem estar "em_aberto" (data_fechamento = NULL)
