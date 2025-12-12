-- LIMPEZA COMPLETA: Remover TODAS as colunas extras
-- Este SQL remove TODAS as colunas que não são usadas pelo app

-- 1. Remover NOT NULL de TODAS as colunas primeiro
ALTER TABLE obras ALTER COLUMN data DROP NOT NULL;
ALTER TABLE obras ALTER COLUMN obra DROP NOT NULL;
ALTER TABLE obras ALTER COLUMN responsavel DROP NOT NULL;
ALTER TABLE obras ALTER COLUMN equipe DROP NOT NULL;
ALTER TABLE obras ALTER COLUMN tipo_servico DROP NOT NULL;
ALTER TABLE obras ALTER COLUMN tem_atipicidade DROP NOT NULL;

-- 2. Remover colunas extras (ignorar erros se não existirem)
DO $$
BEGIN
  -- Remover nome
  BEGIN
    ALTER TABLE obras DROP COLUMN IF EXISTS nome;
  EXCEPTION WHEN OTHERS THEN NULL;
  END;

  -- Remover codigo_obra
  BEGIN
    ALTER TABLE obras DROP COLUMN IF EXISTS codigo_obra;
  EXCEPTION WHEN OTHERS THEN NULL;
  END;

  -- Remover data_inicio
  BEGIN
    ALTER TABLE obras DROP COLUMN IF EXISTS data_inicio;
  EXCEPTION WHEN OTHERS THEN NULL;
  END;

  -- Remover data_fim
  BEGIN
    ALTER TABLE obras DROP COLUMN IF EXISTS data_fim;
  EXCEPTION WHEN OTHERS THEN NULL;
  END;

  -- Remover descricao
  BEGIN
    ALTER TABLE obras DROP COLUMN IF EXISTS descricao;
  EXCEPTION WHEN OTHERS THEN NULL;
  END;

  -- Remover status
  BEGIN
    ALTER TABLE obras DROP COLUMN IF EXISTS status;
  EXCEPTION WHEN OTHERS THEN NULL;
  END;

  -- Remover endereco
  BEGIN
    ALTER TABLE obras DROP COLUMN IF EXISTS endereco;
  EXCEPTION WHEN OTHERS THEN NULL;
  END;

  -- Remover cliente
  BEGIN
    ALTER TABLE obras DROP COLUMN IF EXISTS cliente;
  EXCEPTION WHEN OTHERS THEN NULL;
  END;

  -- Remover valor
  BEGIN
    ALTER TABLE obras DROP COLUMN IF EXISTS valor;
  EXCEPTION WHEN OTHERS THEN NULL;
  END;

  -- Remover observacoes
  BEGIN
    ALTER TABLE obras DROP COLUMN IF EXISTS observacoes;
  EXCEPTION WHEN OTHERS THEN NULL;
  END;
END $$;

-- 3. Verificar colunas restantes
SELECT
  column_name,
  data_type,
  is_nullable,
  column_default
FROM information_schema.columns
WHERE table_name = 'obras'
ORDER BY ordinal_position;
