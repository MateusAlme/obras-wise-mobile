# ⚡ APLICAR MIGRAÇÃO AGORA - MÉTODO RÁPIDO

A Supabase CLI está travando. Use este método manual que é mais rápido e confiável.

## 🚀 Passo a Passo (2 minutos)

### 1. Acesse o Supabase SQL Editor

1. Abra: https://supabase.com/dashboard/project/hiuagpzaelcocyxutgdt/sql/new
2. Ou navegue: Dashboard → Seu Projeto → SQL Editor → New Query

### 2. Copie e Cole o SQL Abaixo

```sql
-- MIGRAÇÃO: Criar tabela obras completa
-- Este SQL cria a tabela com todas as colunas necessárias

-- 1. CRIAR TABELA (se não existir)
CREATE TABLE IF NOT EXISTS obras (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  data DATE NOT NULL,
  obra TEXT NOT NULL,
  responsavel TEXT NOT NULL,
  equipe TEXT NOT NULL,
  tipo_servico TEXT[] NOT NULL,
  tem_atipicidade BOOLEAN NOT NULL,
  atipicidades INTEGER[] DEFAULT ARRAY[]::INTEGER[],
  descricao_atipicidade TEXT,
  fotos_antes JSONB DEFAULT '[]'::jsonb,
  fotos_durante JSONB DEFAULT '[]'::jsonb,
  fotos_depois JSONB DEFAULT '[]'::jsonb,
  user_id UUID REFERENCES auth.users(id) NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
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
```

### 3. Execute (Ctrl + Enter ou botão Run)

Aguarde 5-10 segundos. Você verá uma tabela mostrando todas as colunas criadas.

### 4. Teste no App

Volte ao app e tente cadastrar uma obra. O erro "Could not find the 'equipe' column" deve sumir!

## ✅ Resultado Esperado

Você verá uma listagem com todas estas colunas:
- id
- data
- obra
- responsavel
- equipe
- tipo_servico
- tem_atipicidade
- atipicidades
- descricao_atipicidade
- **fotos_antes** (JSONB) ← NOVO!
- **fotos_durante** (JSONB) ← NOVO!
- **fotos_depois** (JSONB) ← NOVO!
- user_id
- created_at
- updated_at

## 🆘 Se der erro

- Verifique se está no projeto correto (hiuagpzaelcocyxutgdt)
- Certifique-se de copiar TODO o SQL (146 linhas)
- O SQL é seguro e pode ser executado múltiplas vezes

---

**Nota**: Este método manual é mais rápido que a CLI neste momento. Depois você pode usar `supabase migration repair` para sincronizar o histórico.
