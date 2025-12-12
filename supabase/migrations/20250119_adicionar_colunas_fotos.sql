-- Adicionar colunas de fotos que estão faltando na tabela obras
-- Fotos de Abertura/Fechamento de Chave, DITAIS e Book de Aterramento

DO $$
BEGIN
  -- Fotos Abertura Chave
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='obras' AND column_name='fotos_abertura') THEN
    ALTER TABLE obras ADD COLUMN fotos_abertura JSONB DEFAULT '[]'::jsonb;
  END IF;

  -- Fotos Fechamento Chave
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='obras' AND column_name='fotos_fechamento') THEN
    ALTER TABLE obras ADD COLUMN fotos_fechamento JSONB DEFAULT '[]'::jsonb;
  END IF;

  -- DITAIS - 5 campos
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='obras' AND column_name='fotos_ditais_abertura') THEN
    ALTER TABLE obras ADD COLUMN fotos_ditais_abertura JSONB DEFAULT '[]'::jsonb;
  END IF;

  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='obras' AND column_name='fotos_ditais_impedir') THEN
    ALTER TABLE obras ADD COLUMN fotos_ditais_impedir JSONB DEFAULT '[]'::jsonb;
  END IF;

  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='obras' AND column_name='fotos_ditais_testar') THEN
    ALTER TABLE obras ADD COLUMN fotos_ditais_testar JSONB DEFAULT '[]'::jsonb;
  END IF;

  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='obras' AND column_name='fotos_ditais_aterrar') THEN
    ALTER TABLE obras ADD COLUMN fotos_ditais_aterrar JSONB DEFAULT '[]'::jsonb;
  END IF;

  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='obras' AND column_name='fotos_ditais_sinalizar') THEN
    ALTER TABLE obras ADD COLUMN fotos_ditais_sinalizar JSONB DEFAULT '[]'::jsonb;
  END IF;

  -- BOOK ATERRAMENTO - 4 campos
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='obras' AND column_name='fotos_aterramento_vala_aberta') THEN
    ALTER TABLE obras ADD COLUMN fotos_aterramento_vala_aberta JSONB DEFAULT '[]'::jsonb;
  END IF;

  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='obras' AND column_name='fotos_aterramento_hastes') THEN
    ALTER TABLE obras ADD COLUMN fotos_aterramento_hastes JSONB DEFAULT '[]'::jsonb;
  END IF;

  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='obras' AND column_name='fotos_aterramento_vala_fechada') THEN
    ALTER TABLE obras ADD COLUMN fotos_aterramento_vala_fechada JSONB DEFAULT '[]'::jsonb;
  END IF;

  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='obras' AND column_name='fotos_aterramento_medicao') THEN
    ALTER TABLE obras ADD COLUMN fotos_aterramento_medicao JSONB DEFAULT '[]'::jsonb;
  END IF;
END $$;

-- Verificar resultado
SELECT
  column_name,
  data_type,
  column_default
FROM information_schema.columns
WHERE table_name = 'obras'
  AND column_name LIKE 'fotos_%'
ORDER BY column_name;
