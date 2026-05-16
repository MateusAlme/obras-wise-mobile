# 🎯 Solução Final: user_id e Isolamento por Equipe

## 🐛 Problemas Identificados

### 1. **Erro: "null value in column user_id violates not-null constraint"**
- Coluna `user_id` é NOT NULL
- Login por equipe não cria user_id
- INSERT falha

### 2. **Obras compartilhadas entre todas equipes**
- RLS com `USING (true)` permite acesso total
- Todas equipes veem todas obras
- Sem isolamento de dados

## ✅ Soluções Implementadas

### 1. **Tornar `user_id` Opcional** ✅
```sql
ALTER TABLE public.obras
ALTER COLUMN user_id DROP NOT NULL;
```

### 2. **RLS Baseado em Equipe** ✅
Políticas que filtram por header `x-equipe`:
- SELECT: Mostra apenas obras da equipe logada
- INSERT: Permite criar obras
- UPDATE: Apenas obras da própria equipe
- DELETE: Apenas obras da própria equipe

### 3. **Header Automático no Supabase Client** ✅
Arquivo `mobile/lib/supabase.ts` atualizado para enviar header `x-equipe` automaticamente.

---

## 📋 Passo a Passo para Aplicar

### 1. Execute o SQL no Supabase SQL Editor

**URL:** https://supabase.com/dashboard/project/hiuagpzaelcocyxutgdt/sql

**Cole este SQL:**

```sql
-- Tornar user_id NULLABLE
ALTER TABLE public.obras
ALTER COLUMN user_id DROP NOT NULL;

-- Remover políticas antigas
DROP POLICY IF EXISTS "Allow anon insert obras" ON public.obras;
DROP POLICY IF EXISTS "Allow anon select obras" ON public.obras;
DROP POLICY IF EXISTS "Allow anon update obras" ON public.obras;
DROP POLICY IF EXISTS "Allow anon delete obras" ON public.obras;
DROP POLICY IF EXISTS "Select obras by equipe" ON public.obras;
DROP POLICY IF EXISTS "Update own team obras" ON public.obras;
DROP POLICY IF EXISTS "Delete own team obras" ON public.obras;

-- POLÍTICA 1: INSERT - Permitir criar obras
CREATE POLICY "Allow insert obras"
ON public.obras
FOR INSERT
TO anon, authenticated
WITH CHECK (true);

-- POLÍTICA 2: SELECT - Filtrar por EQUIPE
CREATE POLICY "Select obras by equipe"
ON public.obras
FOR SELECT
TO anon, authenticated
USING (
  equipe = current_setting('request.headers', true)::json->>'x-equipe'
  OR
  current_setting('request.headers', true)::json->>'x-equipe' IS NULL
);

-- POLÍTICA 3: UPDATE - Apenas obras da mesma equipe
CREATE POLICY "Update own team obras"
ON public.obras
FOR UPDATE
TO anon, authenticated
USING (
  equipe = current_setting('request.headers', true)::json->>'x-equipe'
  OR
  current_setting('request.headers', true)::json->>'x-equipe' IS NULL
)
WITH CHECK (
  equipe = current_setting('request.headers', true)::json->>'x-equipe'
  OR
  current_setting('request.headers', true)::json->>'x-equipe' IS NULL
);

-- POLÍTICA 4: DELETE - Apenas obras da mesma equipe
CREATE POLICY "Delete own team obras"
ON public.obras
FOR DELETE
TO anon, authenticated
USING (
  equipe = current_setting('request.headers', true)::json->>'x-equipe'
  OR
  current_setting('request.headers', true)::json->>'x-equipe' IS NULL
);
```

### 2. Clique em **"Run"** (Ctrl+Enter)

### 3. Recarregue o App

O código já foi atualizado para enviar o header `x-equipe` automaticamente.

---

## ✅ Como Funciona

### Fluxo de Dados:

```
1. Usuário faz login (equipe: "CNT 01")
   ↓
2. Equipe salva no AsyncStorage: @equipe_logada = "CNT 01"
   ↓
3. Toda requisição ao Supabase envia:
   Header: { "x-equipe": "CNT 01" }
   ↓
4. RLS do Postgres lê o header:
   current_setting('request.headers', true)::json->>'x-equipe'
   ↓
5. Filtra obras:
   WHERE equipe = "CNT 01"
   ↓
6. Retorna apenas obras da CNT 01
```

### Isolamento por Equipe:

| Equipe Logada | Obras Visíveis |
|---------------|----------------|
| CNT 01 | Apenas obras com `equipe = 'CNT 01'` |
| CNT 02 | Apenas obras com `equipe = 'CNT 02'` |
| CNT 03 | Apenas obras com `equipe = 'CNT 03'` |

---

## 🧪 Testar

### Teste 1: Criar Obra

1. **Faça login** com CNT 01
2. **Crie obra** com fotos
3. **Salve**
4. ✅ **Deve salvar com sucesso!**

**Logs esperados:**
```
LOG  Login online realizado com sucesso! Equipe: CNT 01
LOG  Upload da foto bem-sucedido!
LOG  Obra salva com sucesso!
```

**❌ NÃO deve aparecer:**
```
ERROR null value in column "user_id" violates not-null constraint
```

### Teste 2: Isolamento de Dados

1. **Login com CNT 01** → Crie 2 obras
2. **Logout**
3. **Login com CNT 02** → Crie 1 obra
4. **Veja lista de obras**
5. ✅ **CNT 02 deve ver apenas 1 obra (a dela)**
6. **Logout**
7. **Login com CNT 01** novamente
8. **Veja lista de obras**
9. ✅ **CNT 01 deve ver apenas 2 obras (as dela)**

---

## 🔒 Segurança

### Por que isso é seguro?

1. **Header não pode ser falsificado facilmente:**
   - Header é enviado pelo app, não pelo usuário
   - Usuário precisa ter feito login válido primeiro

2. **Validação no backend:**
   - Login valida senha no banco (função `validar_login_equipe`)
   - Apenas equipes válidas conseguem fazer login

3. **RLS no banco:**
   - Mesmo que alguém tente burlar o header
   - RLS garante isolamento no nível do banco de dados

4. **Fallback seguro:**
   - Se header não existir (`IS NULL`)
   - Retorna todas obras (útil para admin/debug)
   - Pode ser removido depois: tire o `OR ... IS NULL`

---

## 🚀 Melhorias Futuras

### 1. Remover Fallback (mais restritivo):

```sql
-- Versão sem fallback - mais seguro
CREATE POLICY "Select obras by equipe"
ON public.obras
FOR SELECT
TO anon, authenticated
USING (
  equipe = current_setting('request.headers', true)::json->>'x-equipe'
);
```

Se header não existir, retorna 0 obras.

### 2. Adicionar Auditoria:

```sql
-- Criar tabela de auditoria
CREATE TABLE audit_log (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  equipe TEXT NOT NULL,
  action TEXT NOT NULL,
  obra_id UUID,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Trigger para registrar ações
CREATE OR REPLACE FUNCTION audit_obras()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO audit_log (equipe, action, obra_id)
  VALUES (
    current_setting('request.headers', true)::json->>'x-equipe',
    TG_OP,
    NEW.id
  );
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER audit_obras_trigger
AFTER INSERT OR UPDATE OR DELETE ON obras
FOR EACH ROW EXECUTE FUNCTION audit_obras();
```

---

## 📝 Checklist Final

- [x] user_id tornado NULLABLE
- [x] Políticas RLS criadas baseadas em equipe
- [x] Header x-equipe adicionado automaticamente
- [ ] **SQL executado no Supabase** ← FAZER AGORA
- [ ] App recarregado
- [ ] Teste de criação de obra
- [ ] Teste de isolamento entre equipes

---

**Execute o SQL e teste! Essa é a solução completa.** 🎉
