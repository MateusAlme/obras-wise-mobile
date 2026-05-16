# Como Resolver Erros de Migração do Supabase

## 🚨 Erro: "duplicate key value violates unique constraint"

### Causa do Erro
Esse erro acontece quando você tem múltiplos arquivos de migração com a mesma data/versão no nome.

**Exemplo:**
```
20250113_criar_storage.sql
20250113_add_fotos_chave.sql        ← Conflito!
20250113_add_fotos_chave_v2.sql     ← Conflito!
```

O Supabase usa a data como chave única e não aceita duplicatas.

---

## ✅ Solução 1: Aplicar SQL Direto (Recomendado para correções rápidas)

Ao invés de usar migrações, aplique o SQL diretamente no Dashboard:

### Passo a Passo:

1. **Abra o SQL Editor do Supabase:**
   ```
   https://supabase.com/dashboard/project/SEU_PROJECT_ID/sql
   ```

2. **Copie apenas o SQL necessário** (sem o INSERT na tabela schema_migrations)

3. **Cole e execute** no editor

### Exemplo - Para adicionar colunas de fotos:

```sql
-- Cole isso no SQL Editor do Supabase
DO $$
BEGIN
  -- Fotos Abertura Chave
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns
                 WHERE table_name='obras' AND column_name='fotos_abertura') THEN
    ALTER TABLE obras ADD COLUMN fotos_abertura JSONB DEFAULT '[]'::jsonb;
  END IF;

  -- Fotos Fechamento Chave
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns
                 WHERE table_name='obras' AND column_name='fotos_fechamento') THEN
    ALTER TABLE obras ADD COLUMN fotos_fechamento JSONB DEFAULT '[]'::jsonb;
  END IF;

  -- (continua com as outras colunas...)
END $$;
```

**Vantagens:**
- ✅ Não gera conflitos
- ✅ Funciona imediatamente
- ✅ Ideal para correções e ajustes

---

## ✅ Solução 2: Renomear Arquivos de Migração

Se você ainda não aplicou as migrações, renomeie os arquivos para ter datas únicas:

### Formato correto:
```
YYYYMMDDHHMMSS_nome_descritivo.sql
```

### Exemplo de renomeação:
```
❌ ANTES:
20250113_criar_storage.sql
20250113_add_fotos_chave.sql
20250113_add_fotos_chave_v2.sql

✅ DEPOIS:
20250113143000_criar_storage.sql
20250113150000_add_fotos_chave.sql
20250113153000_add_fotos_chave_v2.sql
```

**Como fazer:**
```bash
# No terminal
cd supabase/migrations

# Renomear arquivos
mv 20250113_add_fotos_chave.sql 20250113150000_add_fotos_chave.sql
mv 20250113_add_fotos_chave_v2.sql 20250113153000_add_fotos_chave_v2.sql
```

---

## ✅ Solução 3: Consolidar Migrações

Junte várias migrações pequenas em uma única migração maior:

### Passos:

1. **Crie um novo arquivo com timestamp único:**
   ```
   20250119160000_consolidar_colunas_fotos.sql
   ```

2. **Copie TODO o SQL relevante** dos arquivos antigos

3. **Delete ou arquive** os arquivos antigos problemáticos

4. **Aplique a nova migração:**
   ```bash
   supabase db push
   ```

---

## 🔧 Como Verificar Migrações Aplicadas

### Via SQL Editor:
```sql
SELECT version, name, applied_at
FROM supabase_migrations.schema_migrations
ORDER BY applied_at DESC;
```

Isso mostra todas as versões já aplicadas no banco.

---

## 📌 Boas Práticas para Migrações

### 1. Use timestamps completos:
```
✅ BOM:  20250119160530_add_column.sql
❌ RUIM: 20250119_add_column.sql
```

### 2. Um arquivo por dia = problemas
Se fizer várias mudanças no mesmo dia, adicione hora/minuto/segundo.

### 3. Teste localmente primeiro:
```bash
# Testar localmente
supabase db reset

# Aplicar no remoto
supabase db push
```

### 4. Para mudanças urgentes, use SQL direto
Ao invés de criar migração, aplique direto no Dashboard.

---

## 🚀 Comando para Gerar Migration com Timestamp Correto

```bash
# Linux/Mac
supabase migration new nome_da_migracao

# Windows PowerShell
$timestamp = Get-Date -Format "yyyyMMddHHmmss"
New-Item "supabase/migrations/${timestamp}_nome_da_migracao.sql"
```

---

## 📞 Quando Algo Dá Errado

### Se a migração falhou parcialmente:

1. **Verifique o que foi aplicado:**
   ```sql
   SELECT column_name
   FROM information_schema.columns
   WHERE table_name = 'obras'
   ORDER BY column_name;
   ```

2. **Crie SQL de correção** baseado no que falta

3. **Aplique direto no Dashboard** (Solução 1)

### Se precisa reverter:

```sql
-- Exemplo: remover coluna criada
ALTER TABLE obras DROP COLUMN IF EXISTS nome_da_coluna;
```

---

## 📝 Resumo Rápido

| Situação | Solução Recomendada |
|----------|-------------------|
| Múltiplos arquivos mesma data | Aplicar SQL direto no Dashboard |
| Precisa adicionar colunas urgente | SQL direto no Dashboard |
| Organizando projeto novo | Renomear arquivos com timestamps únicos |
| Muitos arquivos pequenos | Consolidar em uma migração |

---

## ✅ Para o Seu Caso Específico

Você tem 6 arquivos com `20250113`. **Recomendo:**

1. **Aplicar o SQL da migração mais recente** (`20250119_adicionar_colunas_fotos.sql`) direto no Dashboard
2. **Arquivar** as migrações antigas problemáticas em uma pasta `supabase/migrations/_old/`
3. **Continuar usando** SQL direto para mudanças futuras urgentes

Isso resolve o problema imediatamente sem mexer nas migrações já aplicadas.
