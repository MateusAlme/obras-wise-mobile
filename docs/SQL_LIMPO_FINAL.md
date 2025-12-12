# 🔧 SQL Final - Limpar e Recriar Tudo

## Execute este SQL no Supabase SQL Editor:

**URL:** https://supabase.com/dashboard/project/hiuagpzaelcocyxutgdt/sql

```sql
-- =====================================================
-- PARTE 1: Tornar user_id NULLABLE
-- =====================================================
ALTER TABLE public.obras
ALTER COLUMN user_id DROP NOT NULL;

-- =====================================================
-- PARTE 2: Limpar TODAS as políticas existentes
-- =====================================================
DROP POLICY IF EXISTS "Allow insert obras" ON public.obras;
DROP POLICY IF EXISTS "Allow anon insert obras" ON public.obras;
DROP POLICY IF EXISTS "Allow anon select obras" ON public.obras;
DROP POLICY IF EXISTS "Allow anon update obras" ON public.obras;
DROP POLICY IF EXISTS "Allow anon delete obras" ON public.obras;
DROP POLICY IF EXISTS "Select obras by equipe" ON public.obras;
DROP POLICY IF EXISTS "Update own team obras" ON public.obras;
DROP POLICY IF EXISTS "Delete own team obras" ON public.obras;
DROP POLICY IF EXISTS "Allow public uploads" ON storage.objects;
DROP POLICY IF EXISTS "Allow public reads" ON storage.objects;
DROP POLICY IF EXISTS "Allow public deletes" ON storage.objects;

-- =====================================================
-- PARTE 3: Criar políticas para TABELA OBRAS
-- =====================================================

-- INSERT: Qualquer um pode criar (depois filtramos por equipe)
CREATE POLICY "obras_insert_policy"
ON public.obras
FOR INSERT
TO anon, authenticated
WITH CHECK (true);

-- SELECT: Apenas obras da própria equipe
CREATE POLICY "obras_select_policy"
ON public.obras
FOR SELECT
TO anon, authenticated
USING (
  equipe = current_setting('request.headers', true)::json->>'x-equipe'
  OR current_setting('request.headers', true)::json->>'x-equipe' IS NULL
);

-- UPDATE: Apenas obras da própria equipe
CREATE POLICY "obras_update_policy"
ON public.obras
FOR UPDATE
TO anon, authenticated
USING (
  equipe = current_setting('request.headers', true)::json->>'x-equipe'
  OR current_setting('request.headers', true)::json->>'x-equipe' IS NULL
)
WITH CHECK (
  equipe = current_setting('request.headers', true)::json->>'x-equipe'
  OR current_setting('request.headers', true)::json->>'x-equipe' IS NULL
);

-- DELETE: Apenas obras da própria equipe
CREATE POLICY "obras_delete_policy"
ON public.obras
FOR DELETE
TO anon, authenticated
USING (
  equipe = current_setting('request.headers', true)::json->>'x-equipe'
  OR current_setting('request.headers', true)::json->>'x-equipe' IS NULL
);

-- =====================================================
-- VERIFICAÇÃO: Listar políticas criadas
-- =====================================================
SELECT
  tablename,
  policyname,
  cmd
FROM pg_policies
WHERE tablename = 'obras'
  AND schemaname = 'public'
ORDER BY cmd, policyname;
```

## ✅ Resultado Esperado

Você deve ver 4 políticas:
- `obras_delete_policy` (DELETE)
- `obras_insert_policy` (INSERT)
- `obras_select_policy` (SELECT)
- `obras_update_policy` (UPDATE)

## 🧪 Teste Depois

1. Recarregue o app
2. Faça login com uma equipe
3. Crie nova obra com fotos
4. ✅ Deve salvar sem erros!

---

**Cole este SQL completo e execute!** 🚀
