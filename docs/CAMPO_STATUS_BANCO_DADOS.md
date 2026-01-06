# 📊 Campo Status no Banco de Dados

## 🎯 O Que Foi Feito

Adicionado campo `status` na tabela `obras` do Supabase para controle explícito do estado das obras.

## ❌ Problema Anterior

### Banco de Dados Limitado

Antes, a tabela `obras` tinha apenas:
- `data_fechamento` (TIMESTAMPTZ)
- `finalizada_em` (TIMESTAMPTZ)

```sql
-- Consulta complicada para saber se obra estava finalizada
SELECT * FROM obras
WHERE data_fechamento IS NOT NULL
   OR finalizada_em IS NOT NULL;
```

### Problemas:
- ❌ Query complexa para filtrar obras finalizadas
- ❌ Sem distinção entre "em_aberto" e "rascunho"
- ❌ App mobile e backend precisavam de lógica extra
- ❌ Inconsistência entre app e banco

## ✅ Solução Implementada

### Novo Campo: `status`

```sql
ALTER TABLE obras ADD COLUMN status TEXT DEFAULT 'em_aberto';
```

### Valores Possíveis:

| Status | Significado | Quando usar |
|--------|-------------|-------------|
| `em_aberto` | Obra iniciada mas não finalizada | Obra em andamento |
| `finalizada` | Obra concluída | data_fechamento preenchida |
| `rascunho` | Obra salva parcialmente | Botão "Pausar" clicado |

### Constraint de Validação:

```sql
ALTER TABLE obras ADD CONSTRAINT obras_status_check
CHECK (status IN ('em_aberto', 'finalizada', 'rascunho'));
```

**Benefício**: Banco rejeita valores inválidos automaticamente.

## 🔄 Sincronização Automática

### Trigger Criado:

```sql
CREATE OR REPLACE FUNCTION sync_obra_status()
RETURNS TRIGGER AS $$
BEGIN
  -- Se data_fechamento ou finalizada_em foi preenchida, marcar como finalizada
  IF NEW.data_fechamento IS NOT NULL OR NEW.finalizada_em IS NOT NULL THEN
    NEW.status := 'finalizada';
  -- Se data_fechamento e finalizada_em foram removidas, voltar para em_aberto
  ELSIF NEW.data_fechamento IS NULL AND NEW.finalizada_em IS NULL AND OLD.status = 'finalizada' THEN
    NEW.status := 'em_aberto';
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_sync_obra_status
  BEFORE INSERT OR UPDATE ON obras
  FOR EACH ROW
  EXECUTE FUNCTION sync_obra_status();
```

### Como Funciona:

#### Cenário 1: Finalizar Obra
```sql
UPDATE obras SET data_fechamento = NOW() WHERE obra = '36523625';
-- Trigger automaticamente define: status = 'finalizada' ✅
```

#### Cenário 2: Reabrir Obra
```sql
UPDATE obras SET data_fechamento = NULL WHERE obra = '36523625';
-- Trigger automaticamente define: status = 'em_aberto' ✅
```

#### Cenário 3: Criar Nova Obra
```sql
INSERT INTO obras (obra, equipe, data) VALUES ('99999999', 'CNT 01', '2026-01-06');
-- Campo status recebe default: 'em_aberto' ✅
```

## 📝 Migration

### Arquivo:
`supabase/migrations/20250306_adicionar_campo_status.sql`

### O Que a Migration Faz:

1. ✅ **Adiciona coluna** `status` com default `'em_aberto'`
2. ✅ **Atualiza obras existentes** baseado em data_fechamento/finalizada_em
3. ✅ **Cria índice** para performance
4. ✅ **Adiciona constraint** de validação
5. ✅ **Cria trigger** para sincronização automática
6. ✅ **Mostra estatísticas** após aplicar

### Atualização de Obras Existentes:

```sql
UPDATE obras
SET status = CASE
  WHEN data_fechamento IS NOT NULL OR finalizada_em IS NOT NULL THEN 'finalizada'
  ELSE 'em_aberto'
END;
```

**Resultado**: Todas as obras antigas recebem status correto automaticamente.

## 🚀 Como Aplicar

### Método 1: Script Batch (Recomendado)

```bash
scripts\database\aplicar-campo-status.bat
```

### Método 2: Supabase CLI

```bash
supabase db push
```

### Método 3: SQL Editor (Manual)

1. Abrir Supabase Dashboard
2. Ir em **SQL Editor**
3. Copiar conteúdo de `supabase/migrations/20250306_adicionar_campo_status.sql`
4. Colar e executar

## 📊 Verificar Resultado

### Query para Ver Status das Obras:

```sql
SELECT
  obra,
  equipe,
  status,
  data_fechamento IS NOT NULL as tem_data_fechamento,
  finalizada_em IS NOT NULL as tem_finalizada_em,
  created_at
FROM obras
ORDER BY created_at DESC
LIMIT 10;
```

### Estatísticas por Status:

```sql
SELECT
  status,
  COUNT(*) as total
FROM obras
GROUP BY status
ORDER BY status;
```

Resultado esperado:
```
 status     | total
------------+-------
 em_aberto  |   180
 finalizada |    56
 rascunho   |     0
```

## 💻 Uso no App Mobile

### Consulta Simples:

**Antes**:
```typescript
const { data } = await supabase
  .from('obras')
  .select('*')
  .not('data_fechamento', 'is', null);
```

**Depois**:
```typescript
const { data } = await supabase
  .from('obras')
  .select('*')
  .eq('status', 'finalizada');
```

### Filtros Múltiplos:

```typescript
// Apenas obras em aberto
.eq('status', 'em_aberto')

// Apenas obras finalizadas
.eq('status', 'finalizada')

// Obras em aberto OU rascunho
.in('status', ['em_aberto', 'rascunho'])
```

## 🔧 Botão Corrigir Atualizado

O botão "🔧 Corrigir" agora:

1. ✅ Remove duplicatas do AsyncStorage
2. ✅ **Busca status correto do Supabase**
3. ✅ **Atualiza AsyncStorage com status do banco**
4. ✅ Sincroniza origem (online/offline)

### Antes da Correção:

```
AsyncStorage: status = 'em_aberto' (desatualizado)
Supabase: status = 'finalizada' (correto)
```

### Depois de Clicar "Corrigir":

```
AsyncStorage: status = 'finalizada' (atualizado do Supabase) ✅
Supabase: status = 'finalizada' (correto)
```

## 🎯 Benefícios

### 1. Queries Mais Simples
```sql
-- Antes
WHERE data_fechamento IS NOT NULL OR finalizada_em IS NOT NULL

-- Depois
WHERE status = 'finalizada'
```

### 2. Validação Automática
```sql
-- Rejeitado automaticamente pelo constraint
UPDATE obras SET status = 'invalido';
-- ERROR: new row violates check constraint "obras_status_check"
```

### 3. Sincronização Automática
```sql
-- Não precisa atualizar manualmente
UPDATE obras SET data_fechamento = NOW();
-- status automaticamente vira 'finalizada' via trigger ✅
```

### 4. Consistência Garantida
- App mobile lê `status` do banco
- Web dashboard lê `status` do banco
- Sempre sincronizados

### 5. Performance
- Índice criado: `obras_status_idx`
- Queries filtradas por status são muito rápidas

## ⚠️ Importante

### O Trigger NÃO Substitui o Código do App

O trigger apenas **sincroniza** `status` com `data_fechamento/finalizada_em`.

**O app AINDA PRECISA**:
- Atualizar `data_fechamento` ao finalizar
- Atualizar `finalizada_em` ao finalizar
- O trigger cuida do `status` automaticamente

### Exemplo:

```typescript
// ✅ CORRETO: App atualiza data_fechamento
await supabase
  .from('obras')
  .update({
    data_fechamento: new Date().toISOString(),
    finalizada_em: new Date().toISOString()
  })
  .eq('id', obraId);

// Trigger automaticamente define: status = 'finalizada' ✅
```

```typescript
// ❌ ERRADO: Tentar atualizar apenas status
await supabase
  .from('obras')
  .update({ status: 'finalizada' })
  .eq('id', obraId);

// data_fechamento continua NULL ❌
// Inconsistência de dados!
```

## 🧪 Como Testar

### Teste 1: Aplicar Migration

1. Executar `scripts\database\aplicar-campo-status.bat`
2. Verificar que não há erros
3. Ver estatísticas de status no final

### Teste 2: Verificar Trigger

```sql
-- Criar obra de teste
INSERT INTO obras (obra, equipe, data)
VALUES ('TEST001', 'CNT 01', '2026-01-06')
RETURNING obra, status;
-- Deve retornar: status = 'em_aberto' ✅

-- Finalizar obra
UPDATE obras
SET data_fechamento = NOW()
WHERE obra = 'TEST001'
RETURNING obra, status;
-- Deve retornar: status = 'finalizada' ✅

-- Reabrir obra
UPDATE obras
SET data_fechamento = NULL
WHERE obra = 'TEST001'
RETURNING obra, status;
-- Deve retornar: status = 'em_aberto' ✅

-- Limpar teste
DELETE FROM obras WHERE obra = 'TEST001';
```

### Teste 3: App Mobile

1. **Aplicar migration** no banco
2. **Recarregar app** mobile
3. **Clicar "🔧 Corrigir"**
4. **Verificar logs**:
   ```
   LOG  🔧 PASSO 2: Corrigindo status das obras...
   LOG  🔍 Verificando obra 1/59: 36523625
   LOG    🔍 Buscando obra 36523625 no Supabase...
   LOG    ✅ Encontrada: status = 'finalizada'
   LOG    📝 Corrigindo:
   LOG      - status: em_aberto → 'finalizada'
   ```
5. **Verificar app**: Obra aparece com status correto

## 📚 Arquivos Relacionados

### Migration:
- `supabase/migrations/20250306_adicionar_campo_status.sql`

### Scripts:
- `scripts/database/aplicar-campo-status.bat`

### Código App:
- `mobile/lib/fix-origem-status.ts` - Busca status do Supabase
- `mobile/app/obra-detalhe.tsx` - Atualiza status ao finalizar
- `mobile/lib/offline-sync.ts` - Sincroniza status

### Documentação:
- `docs/CAMPO_STATUS_BANCO_DADOS.md` - Este arquivo
- `docs/BOTAO_CORRIGIR_STATUS.md` - Como usar botão Corrigir
- `docs/CORRECAO_FINALIZACAO_OBRA.md` - Problema de finalização

## 🎉 Conclusão

A adição do campo `status` traz:

- ✅ **Simplicidade**: Queries mais fáceis
- ✅ **Validação**: Constraint garante valores válidos
- ✅ **Automação**: Trigger sincroniza automaticamente
- ✅ **Performance**: Índice otimiza consultas
- ✅ **Consistência**: App e banco sempre sincronizados
- ✅ **Backward Compatible**: Obras antigas atualizadas automaticamente

**Status agora é a fonte única de verdade para o estado das obras!**
