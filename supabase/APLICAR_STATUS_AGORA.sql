-- ========================================
-- APLICAR CAMPO STATUS NA TABELA OBRAS
-- ========================================
-- Copie e cole este SQL no Supabase SQL Editor
-- Dashboard > SQL Editor > New Query

-- 1. Adicionar coluna status
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'obras' AND column_name = 'status'
  ) THEN
    ALTER TABLE obras ADD COLUMN status TEXT DEFAULT 'em_aberto';
    COMMENT ON COLUMN obras.status IS 'Status da obra: em_aberto (iniciada mas não finalizada), finalizada (concluída), rascunho (salva parcialmente)';
    RAISE NOTICE 'Coluna status adicionada com sucesso!';
  ELSE
    RAISE NOTICE 'Coluna status já existe.';
  END IF;
END $$;

-- 2. Atualizar status das obras existentes baseado em data_fechamento e finalizada_em
UPDATE obras
SET status = CASE
  WHEN data_fechamento IS NOT NULL OR finalizada_em IS NOT NULL THEN 'finalizada'
  ELSE 'em_aberto'
END
WHERE status IS NULL OR status = 'em_aberto';

-- 3. Criar índice para melhor performance
CREATE INDEX IF NOT EXISTS obras_status_idx ON obras(status);

-- 4. Criar constraint para validar valores de status
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.constraint_column_usage
    WHERE table_name = 'obras' AND constraint_name = 'obras_status_check'
  ) THEN
    ALTER TABLE obras ADD CONSTRAINT obras_status_check
    CHECK (status IN ('em_aberto', 'finalizada', 'rascunho'));
    RAISE NOTICE 'Constraint obras_status_check criado com sucesso!';
  ELSE
    RAISE NOTICE 'Constraint obras_status_check já existe.';
  END IF;
END $$;

-- 5. Criar função para sincronizar status automaticamente
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

-- 6. Criar trigger
DROP TRIGGER IF EXISTS trigger_sync_obra_status ON obras;
CREATE TRIGGER trigger_sync_obra_status
  BEFORE INSERT OR UPDATE ON obras
  FOR EACH ROW
  EXECUTE FUNCTION sync_obra_status();

-- ========================================
-- VERIFICAR RESULTADO
-- ========================================

-- Ver primeiras 10 obras com status
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

-- Estatísticas por status
SELECT
  status,
  COUNT(*) as total
FROM obras
GROUP BY status
ORDER BY status;

-- ========================================
-- SUCESSO!
-- ========================================
-- Se você vê as estatísticas acima, o campo status foi adicionado com sucesso!
-- Todas as obras com data_fechamento ou finalizada_em agora têm status = 'finalizada'
-- Todas as outras obras têm status = 'em_aberto'
