-- MIGRAÇÃO COMPLETA: Criar ou atualizar tabela obras
-- Execute este SQL no Supabase SQL Editor

-- 1. CRIAR TABELA (se não existir) - SEM constraints complexas
CREATE TABLE IF NOT EXISTS obras (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY
);

-- 2. ADICIONAR COLUNAS que podem estar faltando (se tabela já existia)
DO $$
BEGIN
  -- Adicionar data
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='obras' AND column_name='data') THEN
    ALTER TABLE obras ADD COLUMN data DATE NOT NULL DEFAULT CURRENT_DATE;
  END IF;

  -- Adicionar obra
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='obras' AND column_name='obra') THEN
    ALTER TABLE obras ADD COLUMN obra TEXT NOT NULL DEFAULT '';
  END IF;

  -- Adicionar responsavel
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='obras' AND column_name='responsavel') THEN
    ALTER TABLE obras ADD COLUMN responsavel TEXT NOT NULL DEFAULT '';
  END IF;

  -- Adicionar equipe
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='obras' AND column_name='equipe') THEN
    ALTER TABLE obras ADD COLUMN equipe TEXT NOT NULL DEFAULT '';
  END IF;

  -- Adicionar tipo_servico
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='obras' AND column_name='tipo_servico') THEN
    ALTER TABLE obras ADD COLUMN tipo_servico TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[];
  END IF;

  -- Adicionar tem_atipicidade
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='obras' AND column_name='tem_atipicidade') THEN
    ALTER TABLE obras ADD COLUMN tem_atipicidade BOOLEAN NOT NULL DEFAULT false;
  END IF;

  -- Adicionar atipicidades
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='obras' AND column_name='atipicidades') THEN
    ALTER TABLE obras ADD COLUMN atipicidades INTEGER[] DEFAULT ARRAY[]::INTEGER[];
  END IF;

  -- Adicionar descricao_atipicidade
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='obras' AND column_name='descricao_atipicidade') THEN
    ALTER TABLE obras ADD COLUMN descricao_atipicidade TEXT;
  END IF;

  -- Adicionar fotos_antes
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='obras' AND column_name='fotos_antes') THEN
    ALTER TABLE obras ADD COLUMN fotos_antes JSONB DEFAULT '[]'::jsonb;
  END IF;

  -- Adicionar fotos_durante
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='obras' AND column_name='fotos_durante') THEN
    ALTER TABLE obras ADD COLUMN fotos_durante JSONB DEFAULT '[]'::jsonb;
  END IF;

  -- Adicionar fotos_depois
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='obras' AND column_name='fotos_depois') THEN
    ALTER TABLE obras ADD COLUMN fotos_depois JSONB DEFAULT '[]'::jsonb;
  END IF;

  -- Adicionar user_id
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='obras' AND column_name='user_id') THEN
    ALTER TABLE obras ADD COLUMN user_id UUID;
  END IF;

  -- Adicionar created_at
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='obras' AND column_name='created_at') THEN
    ALTER TABLE obras ADD COLUMN created_at TIMESTAMPTZ DEFAULT NOW();
  END IF;

  -- Adicionar updated_at
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='obras' AND column_name='updated_at') THEN
    ALTER TABLE obras ADD COLUMN updated_at TIMESTAMPTZ DEFAULT NOW();
  END IF;
END $$;

-- 2.5. ADICIONAR CONSTRAINTS (depois que colunas existem)
DO $$
BEGIN
  -- Adicionar NOT NULL em user_id (se tiver dados, precisa preencher antes)
  IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='obras' AND column_name='user_id' AND is_nullable='YES') THEN
    -- Só adiciona NOT NULL se não houver linhas ou se todas tiverem user_id
    IF NOT EXISTS (SELECT 1 FROM obras WHERE user_id IS NULL LIMIT 1) THEN
      ALTER TABLE obras ALTER COLUMN user_id SET NOT NULL;
    END IF;
  END IF;

  -- Adicionar foreign key se não existir
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.table_constraints
    WHERE constraint_name = 'obras_user_id_fkey' AND table_name = 'obras'
  ) THEN
    ALTER TABLE obras ADD CONSTRAINT obras_user_id_fkey
      FOREIGN KEY (user_id) REFERENCES auth.users(id);
  END IF;
END $$;

-- 3. CRIAR ÍNDICES (se não existirem)
CREATE INDEX IF NOT EXISTS obras_user_id_idx ON obras(user_id);
CREATE INDEX IF NOT EXISTS obras_created_at_idx ON obras(created_at DESC);

-- 4. HABILITAR RLS
ALTER TABLE obras ENABLE ROW LEVEL SECURITY;

-- 5. CRIAR POLÍTICAS (se não existirem)
DO $$
BEGIN
  -- Política de SELECT
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename='obras' AND policyname='Users can view their own obras') THEN
    CREATE POLICY "Users can view their own obras"
      ON obras FOR SELECT
      USING (auth.uid() = user_id);
  END IF;

  -- Política de INSERT
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename='obras' AND policyname='Users can create their own obras') THEN
    CREATE POLICY "Users can create their own obras"
      ON obras FOR INSERT
      WITH CHECK (auth.uid() = user_id);
  END IF;

  -- Política de UPDATE
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename='obras' AND policyname='Users can update their own obras') THEN
    CREATE POLICY "Users can update their own obras"
      ON obras FOR UPDATE
      USING (auth.uid() = user_id)
      WITH CHECK (auth.uid() = user_id);
  END IF;

  -- Política de DELETE
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename='obras' AND policyname='Users can delete their own obras') THEN
    CREATE POLICY "Users can delete their own obras"
      ON obras FOR DELETE
      USING (auth.uid() = user_id);
  END IF;
END $$;

-- 6. CRIAR TRIGGER para updated_at
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ language 'plpgsql';

DROP TRIGGER IF EXISTS update_obras_updated_at ON obras;
CREATE TRIGGER update_obras_updated_at
  BEFORE UPDATE ON obras
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

-- 7. VERIFICAR RESULTADO
SELECT
  column_name,
  data_type,
  column_default,
  is_nullable
FROM information_schema.columns
WHERE table_name = 'obras'
ORDER BY ordinal_position;
