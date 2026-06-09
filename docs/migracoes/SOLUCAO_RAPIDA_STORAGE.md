# 🚀 Solução Rápida: Desabilitar RLS do Storage

## ⚠️ ERRO: "must be owner of relation objects"

O erro acontece porque o SQL Editor não tem permissões suficientes para modificar políticas RLS do `storage.objects`.

## ✅ SOLUÇÃO ALTERNATIVA: Via Dashboard (Mais Fácil)

### Opção 1: Tornar o Bucket Público (RECOMENDADO)

1. **Acesse o Storage:**
   - URL: https://supabase.com/dashboard/project/hiuagpzaelcocyxutgdt/storage/buckets

2. **Crie ou Configure o Bucket `obra-photos`:**
   - Se não existir, clique em **"New bucket"**
   - Nome: `obra-photos`
   - ✅ Marque: **"Public bucket"** (IMPORTANTE!)
   - Salve

3. **Configure as Políticas:**
   - Clique no bucket `obra-photos`
   - Vá para a aba **"Policies"**
   - Clique em **"New Policy"**
   - Escolha **"For full customization"**

4. **Adicione esta política:**

**Nome:** `Allow all operations for obra-photos`

**SQL:**
```sql
(bucket_id = 'obra-photos'::text)
```

**Aplique para:**
- ✅ INSERT
- ✅ SELECT
- ✅ UPDATE
- ✅ DELETE

5. **Salve a política**

---

## 🎯 Opção 2: Usar API Keys Admin (Temporário para Testes)

Se a Opção 1 não funcionar, você pode temporariamente usar a chave de serviço (service role key) que tem mais permissões:

### ⚠️ CUIDADO: Apenas para testes! Não use em produção!

1. **Abra:** `mobile/lib/supabase.ts`

2. **Localize:**
```typescript
const supabaseAnonKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...';
```

3. **Obtenha a Service Role Key:**
   - Acesse: https://supabase.com/dashboard/project/hiuagpzaelcocyxutgdt/settings/api
   - Copie a **"service_role key"** (secret)

4. **Substitua temporariamente:**
```typescript
// APENAS PARA TESTE - REMOVER DEPOIS!
const supabaseAnonKey = 'SUA_SERVICE_ROLE_KEY_AQUI';
```

5. **Teste o upload**

6. **⚠️ IMPORTANTE: Volte para anon key depois!**

---

## ✅ Opção 3: Desabilitar RLS via Supabase API

Se você tem acesso ao Terminal/PowerShell:

```bash
# Instalar Supabase CLI se ainda não tiver
npm install -g supabase

# Fazer login
supabase login

# Linkar projeto
supabase link --project-ref hiuagpzaelcocyxutgdt

# Desabilitar RLS no Storage (CUIDADO!)
supabase db execute --sql "ALTER TABLE storage.objects DISABLE ROW LEVEL SECURITY;"
```

---

## 🎯 Opção 4: Via SQL Editor com Permissões Corretas

Se você for o owner do projeto, tente este SQL simplificado:

```sql
-- Execute como usuário postgres (owner)
SET ROLE postgres;

-- Remover políticas antigas
DROP POLICY IF EXISTS "Allow anon uploads to obra-photos" ON storage.objects;
DROP POLICY IF EXISTS "Allow anon reads from obra-photos" ON storage.objects;
DROP POLICY IF EXISTS "Allow anon updates to obra-photos" ON storage.objects;
DROP POLICY IF EXISTS "Allow anon deletes from obra-photos" ON storage.objects;

-- Criar política universal para obra-photos
CREATE POLICY "obra-photos public access"
ON storage.objects
FOR ALL
TO public
USING (bucket_id = 'obra-photos')
WITH CHECK (bucket_id = 'obra-photos');
```

---

## 📊 Como Verificar se Funcionou

Após aplicar qualquer uma das soluções acima:

1. **Recarregue o app** no Expo Go
2. **Faça login** com uma equipe
3. **Crie nova obra** com 1 foto
4. **Clique em "Salvar Obra"**

**✅ Deve aparecer:**
```
LOG  Upload da foto bem-sucedido!
LOG  Obra salva com sucesso!
```

**❌ NÃO deve aparecer:**
```
ERROR new row violates row-level security policy
```

---

## 🔒 Segurança

### Por que é seguro tornar o bucket público?

1. **Apenas fotos de obras:** Bucket dedicado para fotos de trabalho
2. **URLs não adivinháveis:** Nomes de arquivos têm timestamps e IDs aleatórios
3. **Validação no app:** Usuários precisam fazer login
4. **Organização por obra:** Fácil de rastrear e auditar

### Melhorias futuras de segurança:

Depois que funcionar, você pode adicionar políticas mais restritivas:

```sql
-- Exemplo: Permitir upload apenas com token JWT válido
CREATE POLICY "Authenticated uploads only"
ON storage.objects FOR INSERT
TO authenticated
WITH CHECK (bucket_id = 'obra-photos');
```

Mas isso requer implementar autenticação Supabase Auth completa (não apenas login por equipe).

---

## 🆘 Troubleshooting

### Se ainda não funcionar:

1. **Verificar se bucket existe:**
   - Storage → Buckets → Procure `obra-photos`

2. **Verificar se bucket é público:**
   - Clique no bucket → Deve aparecer "Public" badge

3. **Verificar políticas:**
   - Clique no bucket → Aba "Policies" → Deve ter pelo menos 1 política

4. **Verificar logs do Supabase:**
   - Logs → Storage → Procure erros recentes

5. **Reiniciar o app:**
   - Feche completamente o Expo Go
   - Abra novamente e teste

---

## 📝 Recomendação

**Use a Opção 1** (Tornar bucket público via Dashboard) - é a mais segura e fácil!

1. Storage → Buckets → obra-photos
2. Marcar "Public bucket"
3. Adicionar política universal
4. Testar no app

**Resultado:** Upload deve funcionar perfeitamente! ✅

---

**Escolha uma das opções acima e teste!** 🚀
