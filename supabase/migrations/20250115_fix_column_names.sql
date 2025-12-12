-- CORREÇÃO: Remover coluna duplicada codigo_obra
-- O app envia "obra" e ela já existe, mas existe uma "codigo_obra" duplicada

-- Remover coluna codigo_obra se existir (é a duplicada)
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='obras' AND column_name='codigo_obra') THEN
    ALTER TABLE obras DROP COLUMN codigo_obra;
  END IF;
END $$;

-- Remover NOT NULL de colunas problemáticas temporariamente
DO $$
BEGIN
  -- Remover NOT NULL de data
  IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='obras' AND column_name='data' AND is_nullable='NO') THEN
    ALTER TABLE obras ALTER COLUMN data DROP NOT NULL;
  END IF;

  -- Remover NOT NULL de obra
  IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='obras' AND column_name='obra' AND is_nullable='NO') THEN
    ALTER TABLE obras ALTER COLUMN obra DROP NOT NULL;
  END IF;

  -- Remover NOT NULL de responsavel
  IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='obras' AND column_name='responsavel' AND is_nullable='NO') THEN
    ALTER TABLE obras ALTER COLUMN responsavel DROP NOT NULL;
  END IF;

  -- Remover NOT NULL de equipe
  IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='obras' AND column_name='equipe' AND is_nullable='NO') THEN
    ALTER TABLE obras ALTER COLUMN equipe DROP NOT NULL;
  END IF;

  -- Remover NOT NULL de tipo_servico
  IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='obras' AND column_name='tipo_servico' AND is_nullable='NO') THEN
    ALTER TABLE obras ALTER COLUMN tipo_servico DROP NOT NULL;
  END IF;

  -- Remover NOT NULL de tem_atipicidade
  IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='obras' AND column_name='tem_atipicidade' AND is_nullable='NO') THEN
    ALTER TABLE obras ALTER COLUMN tem_atipicidade DROP NOT NULL;
  END IF;

  -- Remover colunas extras não usadas pelo app
  IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='obras' AND column_name='nome') THEN
    ALTER TABLE obras DROP COLUMN nome;
  END IF;

  IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='obras' AND column_name='data_inicio') THEN
    ALTER TABLE obras DROP COLUMN data_inicio;
  END IF;

  IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='obras' AND column_name='data_fim') THEN
    ALTER TABLE obras DROP COLUMN data_fim;
  END IF;

  IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='obras' AND column_name='descricao') THEN
    ALTER TABLE obras DROP COLUMN descricao;
  END IF;

  IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='obras' AND column_name='status') THEN
    ALTER TABLE obras DROP COLUMN status;
  END IF;
END $$;

-- Verificar resultado
SELECT column_name, data_type, is_nullable, column_default
FROM information_schema.columns
WHERE table_name = 'obras'
ORDER BY ordinal_position;
