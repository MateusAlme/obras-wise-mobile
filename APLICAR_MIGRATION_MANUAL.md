# Como Aplicar a Migration Manualmente

A migration `20250227_sincronizar_data_fechamento_com_finalizada_em.sql` precisa ser aplicada no banco de dados.

## Opção 1: Via Interface Web do Supabase (RECOMENDADO)

1. Acesse: https://supabase.com/dashboard/project/xwkprmwpndaipxngjqyv/sql/new

2. Cole o SQL abaixo e clique em "Run":

```sql
-- Sincronizar data_fechamento com finalizada_em
-- Para obras que já foram finalizadas no mobile mas não têm data_fechamento

-- 1. Criar colunas se não existirem
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'obras' AND column_name = 'data_abertura'
  ) THEN
    ALTER TABLE obras ADD COLUMN data_abertura TIMESTAMPTZ;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'obras' AND column_name = 'data_fechamento'
  ) THEN
    ALTER TABLE obras ADD COLUMN data_fechamento TIMESTAMPTZ;
  END IF;
END $$;

-- 2. Preencher data_abertura para obras existentes
UPDATE obras
SET data_abertura = created_at
WHERE data_abertura IS NULL;

-- 3. Sincronizar data_fechamento com finalizada_em
-- Para obras que têm status='finalizada' mas data_fechamento=NULL
UPDATE obras
SET data_fechamento = finalizada_em
WHERE status = 'finalizada'
  AND finalizada_em IS NOT NULL
  AND data_fechamento IS NULL;

-- 4. Criar índices
CREATE INDEX IF NOT EXISTS obras_data_abertura_idx ON obras(data_abertura);
CREATE INDEX IF NOT EXISTS obras_data_fechamento_idx ON obras(data_fechamento);
CREATE INDEX IF NOT EXISTS obras_status_idx ON obras(status);

-- 5. Mostrar resultado
SELECT
  COUNT(*) as total_obras,
  COUNT(CASE WHEN status = 'finalizada' THEN 1 END) as finalizadas_status,
  COUNT(data_fechamento) as com_data_fechamento,
  COUNT(CASE WHEN status = 'finalizada' AND data_fechamento IS NULL THEN 1 END) as inconsistentes
FROM obras;
```

3. Verifique o resultado da última query:
   - `total_obras`: Total de obras no sistema
   - `finalizadas_status`: Obras com status='finalizada'
   - `com_data_fechamento`: Obras com data_fechamento preenchida
   - `inconsistentes`: Deve ser 0 (zero) após a migration

## Opção 2: Via Script .bat

Execute o arquivo:
```
scripts\database\aplicar-sincronizar-data-fechamento.bat
```

## O que essa Migration Faz?

### Problema que resolve:
- Obras finalizadas no mobile (status='finalizada') não apareciam como "Concluída" no web
- O web usa o campo `data_fechamento` para determinar status
- O mobile só preenchia `status` e `finalizada_em`

### Solução:
1. **Cria campos** `data_abertura` e `data_fechamento` se não existirem
2. **Preenche `data_abertura`** com `created_at` para todas as obras
3. **Sincroniza `data_fechamento`** com `finalizada_em` para obras já finalizadas
4. **Cria índices** para melhorar performance de queries

### Resultado Esperado:
- Obra 2222222222 (e outras finalizadas) vão aparecer como "Concluída" no web
- Novas obras criadas no mobile vão ter `data_fechamento=NULL` (Parcial)
- Ao finalizar obra no mobile, `data_fechamento` será preenchido automaticamente

## Verificar se Funcionou

Após aplicar, execute esta query:

```sql
SELECT
  obra,
  equipe,
  status,
  finalizada_em,
  data_fechamento,
  CASE
    WHEN data_fechamento IS NOT NULL THEN 'Concluída'
    WHEN status = 'finalizada' THEN 'Inconsistente'
    ELSE 'Parcial'
  END as status_web
FROM obras
WHERE status = 'finalizada'
ORDER BY created_at DESC
LIMIT 10;
```

Todas as obras finalizadas devem ter `status_web = 'Concluída'` (não 'Inconsistente').
