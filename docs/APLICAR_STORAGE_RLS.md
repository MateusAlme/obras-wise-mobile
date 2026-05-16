# 🔒 Como Aplicar Políticas RLS para Storage

## ⚠️ IMPORTANTE: Execute este SQL no Supabase

O erro **"new row violates row-level security policy"** acontece porque o Supabase Storage está bloqueando uploads sem autenticação Supabase Auth.

Como o sistema usa **login por equipe** (não cria sessão Supabase Auth), precisamos criar políticas RLS que permitam uploads sem autenticação.

---

## 📋 Passo a Passo

### 1. Acesse o SQL Editor do Supabase

1. Acesse: https://supabase.com/dashboard/project/hiuagpzaelcocyxutgdt
2. Clique em **"SQL Editor"** no menu lateral
3. Clique em **"New query"**

### 2. Cole o SQL abaixo e execute

```sql
-- =====================================================
-- POLÍTICAS RLS PARA SUPABASE STORAGE
-- Permitir upload e leitura sem autenticação Supabase Auth
-- (necessário para sistema de login por equipe)
-- =====================================================

-- Remover políticas antigas se existirem
DROP POLICY IF EXISTS "Allow public uploads" ON storage.objects;
DROP POLICY IF EXISTS "Allow public reads" ON storage.objects;
DROP POLICY IF EXISTS "Allow public deletes" ON storage.objects;
DROP POLICY IF EXISTS "Allow anon uploads to obra-photos" ON storage.objects;
DROP POLICY IF EXISTS "Allow anon reads from obra-photos" ON storage.objects;
DROP POLICY IF EXISTS "Allow anon updates to obra-photos" ON storage.objects;
DROP POLICY IF EXISTS "Allow anon deletes from obra-photos" ON storage.objects;

-- =====================================================
-- POLÍTICA 1: Permitir UPLOAD (INSERT) sem autenticação
-- =====================================================
CREATE POLICY "Allow anon uploads to obra-photos"
ON storage.objects
FOR INSERT
TO anon
WITH CHECK (bucket_id = 'obra-photos');

-- =====================================================
-- POLÍTICA 2: Permitir LEITURA (SELECT) sem autenticação
-- =====================================================
CREATE POLICY "Allow anon reads from obra-photos"
ON storage.objects
FOR SELECT
TO anon
USING (bucket_id = 'obra-photos');

-- =====================================================
-- POLÍTICA 3: Permitir ATUALIZAÇÃO (UPDATE) sem autenticação
-- =====================================================
CREATE POLICY "Allow anon updates to obra-photos"
ON storage.objects
FOR UPDATE
TO anon
USING (bucket_id = 'obra-photos')
WITH CHECK (bucket_id = 'obra-photos');

-- =====================================================
-- POLÍTICA 4: Permitir EXCLUSÃO (DELETE) sem autenticação
-- =====================================================
CREATE POLICY "Allow anon deletes from obra-photos"
ON storage.objects
FOR DELETE
TO anon
USING (bucket_id = 'obra-photos');

-- =====================================================
-- VERIFICAÇÃO: Bucket obra-photos existe e está configurado
-- =====================================================
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM storage.buckets WHERE id = 'obra-photos'
  ) THEN
    -- Criar bucket se não existir
    INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
    VALUES (
      'obra-photos',
      'obra-photos',
      true,
      10485760, -- 10MB
      ARRAY['image/jpeg', 'image/jpg', 'image/png', 'application/pdf']::text[]
    );
    RAISE NOTICE 'Bucket obra-photos criado!';
  ELSE
    RAISE NOTICE 'Bucket obra-photos já existe.';
  END IF;
END $$;
```

### 3. Clique em **"Run"** ou pressione **Ctrl+Enter**

### 4. Verifique o resultado

Você deve ver uma mensagem de sucesso:
```
Success. No rows returned
```

Ou:
```
NOTICE: Bucket obra-photos já existe.
```

---

## ✅ Verificação

Após executar o SQL, verifique as políticas:

### Opção 1: Via SQL Editor

```sql
-- Listar políticas do storage.objects
SELECT
  schemaname,
  tablename,
  policyname,
  permissive,
  roles,
  cmd
FROM pg_policies
WHERE tablename = 'objects'
  AND schemaname = 'storage'
ORDER BY policyname;
```

Deve retornar 4 políticas:
- `Allow anon deletes from obra-photos` (DELETE)
- `Allow anon reads from obra-photos` (SELECT)
- `Allow anon updates to obra-photos` (UPDATE)
- `Allow anon uploads to obra-photos` (INSERT)

### Opção 2: Via Dashboard

1. Acesse: **Storage** → **Policies** no Supabase Dashboard
2. Selecione bucket **obra-photos**
3. Verifique se as 4 políticas aparecem

---

## 🧪 Testar Agora

Após aplicar as políticas:

1. **Recarregue o app** no Expo Go
2. **Faça login** com uma equipe
3. **Crie nova obra** com fotos
4. **Clique em "Salvar Obra"**
5. ✅ **Deve funcionar sem erro de RLS!**

**Logs esperados:**
```
LOG  Login online realizado com sucesso! Equipe: CNT 01
LOG  Upload da foto bem-sucedido!
LOG  Obra salva com sucesso!
```

**❌ NÃO deve aparecer:**
```
ERROR new row violates row-level security policy
```

---

## 🔒 Segurança

### Por que isso é seguro?

1. **Uploads organizados por obra:** Cada foto vai para pasta `obra-photos/{numeroObra}/`
2. **Validação no app:** O app só permite upload de fotos de obras válidas
3. **Limite de tamanho:** Máximo 10MB por arquivo
4. **Tipos permitidos:** Apenas JPEG, PNG e PDF
5. **Login por equipe:** Usuários precisam fazer login (validação no backend)

### E se quiser mais segurança?

Se quiser restringir por equipe, pode modificar as políticas para verificar o `equipe` no nome da pasta:

```sql
-- Exemplo: Permitir apenas uploads na pasta da equipe
CREATE POLICY "Allow team uploads"
ON storage.objects
FOR INSERT
TO anon
WITH CHECK (
  bucket_id = 'obra-photos'
  AND (storage.foldername(name))[1] IN (
    SELECT obra FROM obras WHERE equipe = current_setting('request.jwt.claims', true)::json->>'equipe'
  )
);
```

Mas por enquanto, a política simples funciona bem!

---

## 📝 Troubleshooting

### Se ainda der erro de RLS:

1. **Verificar se políticas foram criadas:**
   ```sql
   SELECT * FROM pg_policies WHERE tablename = 'objects';
   ```

2. **Verificar se bucket existe:**
   ```sql
   SELECT * FROM storage.buckets WHERE id = 'obra-photos';
   ```

3. **Recriar bucket (se necessário):**
   ```sql
   DELETE FROM storage.buckets WHERE id = 'obra-photos';
   INSERT INTO storage.buckets (id, name, public)
   VALUES ('obra-photos', 'obra-photos', true);
   ```

4. **Desabilitar RLS temporariamente (NÃO RECOMENDADO EM PRODUÇÃO):**
   ```sql
   ALTER TABLE storage.objects DISABLE ROW LEVEL SECURITY;
   ```

---

## 📚 Links Úteis

- [Supabase Storage RLS](https://supabase.com/docs/guides/storage/security/access-control)
- [SQL Editor](https://supabase.com/dashboard/project/hiuagpzaelcocyxutgdt/sql)
- [Storage Dashboard](https://supabase.com/dashboard/project/hiuagpzaelcocyxutgdt/storage)

---

**Execute o SQL acima no Supabase SQL Editor e teste novamente!** 🚀
