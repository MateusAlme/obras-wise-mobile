# 🔒 Corrigir RLS da Tabela `obras`

## 🐛 Problema

**Erro:** `new row violates row-level security policy for table "obras"`

O upload de fotos funcionou! ✅ Mas agora a tabela `obras` está bloqueando o INSERT porque:
- O RLS (Row Level Security) está ativo
- Não há política que permita INSERT sem usuário autenticado via Supabase Auth
- Login por equipe não cria sessão Supabase Auth

## ✅ Solução: Adicionar Políticas RLS para a Tabela `obras`

### Opção 1: Via SQL Editor (RECOMENDADO)

1. **Acesse o SQL Editor:**
   - https://supabase.com/dashboard/project/hiuagpzaelcocyxutgdt/sql

2. **Cole e execute este SQL:**

```sql
-- =====================================================
-- POLÍTICAS RLS PARA TABELA OBRAS
-- Permitir operações sem autenticação Supabase Auth
-- =====================================================

-- Remover políticas antigas se existirem
DROP POLICY IF EXISTS "Allow anon insert obras" ON public.obras;
DROP POLICY IF EXISTS "Allow anon select obras" ON public.obras;
DROP POLICY IF EXISTS "Allow anon update obras" ON public.obras;
DROP POLICY IF EXISTS "Allow anon delete obras" ON public.obras;

-- =====================================================
-- POLÍTICA 1: Permitir INSERT sem autenticação
-- =====================================================
CREATE POLICY "Allow anon insert obras"
ON public.obras
FOR INSERT
TO anon
WITH CHECK (true);

-- =====================================================
-- POLÍTICA 2: Permitir SELECT sem autenticação
-- =====================================================
CREATE POLICY "Allow anon select obras"
ON public.obras
FOR SELECT
TO anon
USING (true);

-- =====================================================
-- POLÍTICA 3: Permitir UPDATE sem autenticação
-- =====================================================
CREATE POLICY "Allow anon update obras"
ON public.obras
FOR UPDATE
TO anon
USING (true)
WITH CHECK (true);

-- =====================================================
-- POLÍTICA 4: Permitir DELETE sem autenticação
-- =====================================================
CREATE POLICY "Allow anon delete obras"
ON public.obras
FOR DELETE
TO anon
USING (true);
```

3. **Clique em "Run" (Ctrl+Enter)**

---

### Opção 2: Via Dashboard (Interface Gráfica)

1. **Acesse Authentication → Policies:**
   - https://supabase.com/dashboard/project/hiuagpzaelcocyxutgdt/auth/policies

2. **Procure a tabela `obras`**

3. **Clique em "New Policy"**

4. **Crie 4 políticas (uma para cada operação):**

#### Política 1: INSERT
- **Name:** `Allow anon insert obras`
- **Target roles:** `anon`
- **Policy command:** `INSERT`
- **USING expression:** (deixe vazio)
- **WITH CHECK expression:** `true`
- **Save**

#### Política 2: SELECT
- **Name:** `Allow anon select obras`
- **Target roles:** `anon`
- **Policy command:** `SELECT`
- **USING expression:** `true`
- **WITH CHECK expression:** (deixe vazio)
- **Save**

#### Política 3: UPDATE
- **Name:** `Allow anon update obras`
- **Target roles:** `anon`
- **Policy command:** `UPDATE`
- **USING expression:** `true`
- **WITH CHECK expression:** `true`
- **Save**

#### Política 4: DELETE
- **Name:** `Allow anon delete obras`
- **Target roles:** `anon`
- **Policy command:** `DELETE`
- **USING expression:** `true`
- **WITH CHECK expression:** (deixe vazio)
- **Save**

---

## 🔒 Melhorar Segurança (Opcional, depois que funcionar)

Depois que tudo funcionar, você pode restringir as políticas por equipe:

```sql
-- Exemplo: Permitir apenas SELECT de obras da própria equipe
CREATE POLICY "Select own team obras"
ON public.obras
FOR SELECT
TO anon
USING (
  equipe = current_setting('request.headers', true)::json->>'x-equipe'
);
```

Mas isso requer passar a equipe nos headers das requisições.

---

## ✅ Verificar se Funcionou

Após aplicar as políticas:

1. **Recarregue o app**
2. **Faça login** com equipe
3. **Crie nova obra** com fotos
4. **Salve**
5. ✅ **Deve funcionar!**

**Logs esperados:**
```
LOG  Login online realizado com sucesso! Equipe: CNT 01
LOG  Upload da foto bem-sucedido!
LOG  Obra salva com sucesso!
```

**❌ NÃO deve aparecer:**
```
ERROR new row violates row-level security policy for table "obras"
```

---

## 🐛 Se Ainda Houver Erro

### Verificar se RLS está ativo:

```sql
SELECT tablename, rowsecurity
FROM pg_tables
WHERE schemaname = 'public'
  AND tablename = 'obras';
```

Se `rowsecurity = true`, as políticas são obrigatórias.

### Desabilitar RLS temporariamente (NÃO RECOMENDADO):

```sql
ALTER TABLE public.obras DISABLE ROW LEVEL SECURITY;
```

⚠️ Isso remove TODA a segurança da tabela! Use apenas para testes rápidos.

### Re-habilitar RLS depois:

```sql
ALTER TABLE public.obras ENABLE ROW LEVEL SECURITY;
```

---

## 📝 Checklist

- [ ] Políticas RLS do Storage criadas ✅ (já feito!)
- [ ] Políticas RLS da tabela `obras` criadas ← **FAZER AGORA**
- [ ] Testar salvamento de obra
- [ ] Verificar fotos no Storage
- [ ] Verificar registro na tabela `obras`

---

**Execute o SQL acima no SQL Editor e teste novamente!** 🚀
