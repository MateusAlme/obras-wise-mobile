-- Sincronizar data_fechamento com finalizada_em
-- Para obras que já foram finalizadas no mobile mas não têm data_fechamento

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

-- 2. Preencher data_abertura para obras existentes
UPDATE obras
SET data_abertura = created_at
WHERE data_abertura IS NULL;

-- 3. Sincronizar data_fechamento com finalizada_em
-- Para obras que têm status='finalizada' mas data_fechamento=NULL
UPDATE obras
SET data_fechamento = finalizada_em
WHERE status = 'finalizada'
  AND finalizada_em IS NOT NULL
  AND data_fechamento IS NULL;

-- 4. Criar índices
CREATE INDEX IF NOT EXISTS obras_data_abertura_idx ON obras(data_abertura);
CREATE INDEX IF NOT EXISTS obras_data_fechamento_idx ON obras(data_fechamento);
CREATE INDEX IF NOT EXISTS obras_status_idx ON obras(status);

-- 5. Mostrar resultado
SELECT
  COUNT(*) as total_obras,
  COUNT(CASE WHEN status = 'finalizada' THEN 1 END) as finalizadas_status,
  COUNT(data_fechamento) as com_data_fechamento,
  COUNT(CASE WHEN status = 'finalizada' AND data_fechamento IS NULL THEN 1 END) as inconsistentes
FROM obras;

-- Mostrar obras finalizadas
SELECT
  obra,
  equipe,
  tipo_servico,
  status,
  created_at,
  finalizada_em,
  data_fechamento,
  CASE
    WHEN data_fechamento IS NOT NULL THEN 'Concluída'
    WHEN status = 'finalizada' THEN 'Inconsistente (finalizada sem data)'
    ELSE 'Parcial'
  END as status_web
FROM obras
WHERE status = 'finalizada'
ORDER BY created_at DESC
LIMIT 10;
