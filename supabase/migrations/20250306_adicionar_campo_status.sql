-- Adicionar campo status para controle visual do estado das obras
-- Status possíveis: 'em_aberto', 'finalizada', 'rascunho'
-- Execute este SQL no Supabase SQL Editor

-- Adicionar coluna status
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'obras' AND column_name = 'status'
  ) THEN
    ALTER TABLE obras ADD COLUMN status TEXT DEFAULT 'em_aberto';

    COMMENT ON COLUMN obras.status IS 'Status da obra: em_aberto (iniciada mas não finalizada), finalizada (concluída), rascunho (salva parcialmente)';
  END IF;
END $$;

-- Atualizar status das obras existentes baseado em data_fechamento e finalizada_em
UPDATE obras
SET status = CASE
  WHEN data_fechamento IS NOT NULL OR finalizada_em IS NOT NULL THEN 'finalizada'
  ELSE 'em_aberto'
END
WHERE status IS NULL OR status = 'em_aberto';

-- Criar índice para melhor performance
CREATE INDEX IF NOT EXISTS obras_status_idx ON obras(status);

-- Criar constraint para validar valores de status
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.constraint_column_usage
    WHERE table_name = 'obras' AND constraint_name = 'obras_status_check'
  ) THEN
    ALTER TABLE obras ADD CONSTRAINT obras_status_check
    CHECK (status IN ('em_aberto', 'finalizada', 'rascunho'));
  END IF;
END $$;

-- Criar trigger para sincronizar status automaticamente
CREATE OR REPLACE FUNCTION sync_obra_status()
RETURNS TRIGGER AS $$
BEGIN
  -- Se data_fechamento ou finalizada_em foi preenchida, marcar como finalizada
  IF NEW.data_fechamento IS NOT NULL OR NEW.finalizada_em IS NOT NULL THEN
    NEW.status := 'finalizada';
  -- Se data_fechamento e finalizada_em foram removidas, voltar para em_aberto
  ELSIF NEW.data_fechamento IS NULL AND NEW.finalizada_em IS NULL AND OLD.status = 'finalizada' THEN
    NEW.status := 'em_aberto';
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Criar trigger (remover antes se já existir)
DROP TRIGGER IF EXISTS trigger_sync_obra_status ON obras;
CREATE TRIGGER trigger_sync_obra_status
  BEFORE INSERT OR UPDATE ON obras
  FOR EACH ROW
  EXECUTE FUNCTION sync_obra_status();

-- Verificar resultado
SELECT
  obra,
  equipe,
  status,
  data_fechamento IS NOT NULL as tem_data_fechamento,
  finalizada_em IS NOT NULL as tem_finalizada_em,
  created_at
FROM obras
ORDER BY created_at DESC
LIMIT 10;

-- Estatísticas
SELECT
  status,
  COUNT(*) as total
FROM obras
GROUP BY status
ORDER BY status;
