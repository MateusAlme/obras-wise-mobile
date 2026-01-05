# Como Aplicar o Status de Obra Manualmente

## Problema
A obra `2222222222` aparece como "Parcial" no sistema web mesmo tendo sido finalizada no app mobile, porque o campo `data_fechamento` não existe ou não foi preenchido.

## Solução - Execute no Supabase Dashboard

### Passo 1: Acesse o SQL Editor do Supabase
1. Acesse https://supabase.com/dashboard
2. Selecione seu projeto
3. Vá em "SQL Editor" no menu lateral

### Passo 2: Execute o SQL abaixo

Cole e execute este SQL:

```sql
-- PASSO 1: Verificar se as colunas existem
SELECT column_name, data_type
FROM information_schema.columns
WHERE table_name = 'obras'
  AND column_name IN ('data_abertura', 'data_fechamento');

-- PASSO 2: Criar as colunas se não existirem
DO $$
BEGIN
  -- Adicionar data_abertura
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'obras' AND column_name = 'data_abertura'
  ) THEN
    ALTER TABLE obras ADD COLUMN data_abertura TIMESTAMPTZ;
    UPDATE obras SET data_abertura = created_at WHERE data_abertura IS NULL;
    COMMENT ON COLUMN obras.data_abertura IS 'Data e hora em que a obra foi iniciada/aberta';
  END IF;

  -- Adicionar data_fechamento
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'obras' AND column_name = 'data_fechamento'
  ) THEN
    ALTER TABLE obras ADD COLUMN data_fechamento TIMESTAMPTZ;
    COMMENT ON COLUMN obras.data_fechamento IS 'Data e hora em que a obra foi finalizada. NULL = obra parcial/em andamento';
  END IF;
END $$;

-- PASSO 3: Criar índices
CREATE INDEX IF NOT EXISTS obras_data_abertura_idx ON obras(data_abertura);
CREATE INDEX IF NOT EXISTS obras_data_fechamento_idx ON obras(data_fechamento);

-- PASSO 4: Finalizar a obra 2222222222
UPDATE obras
SET data_fechamento = NOW()
WHERE obra = '2222222222'
  AND data_fechamento IS NULL;

-- PASSO 5: Verificar o resultado
SELECT
  obra,
  equipe,
  tipo_servico,
  data_abertura,
  data_fechamento,
  CASE
    WHEN data_fechamento IS NOT NULL THEN 'Concluída'
    ELSE 'Parcial'
  END as status
FROM obras
WHERE obra = '2222222222';
```

### Passo 3: Verificar no Sistema Web
1. Abra o sistema web
2. Vá para a página de Relatórios ou Acompanhamento
3. A obra `2222222222` agora deve aparecer como "Concluída" (badge verde)

## Como Finalizar Outras Obras no Futuro

### Opção 1: Usar o App Mobile (Recomendado)
1. Abra a obra em modo de edição
2. Clique no botão verde "✓ Finalizar Obra"
3. Confirme a finalização
4. A obra será automaticamente marcada como "Concluída"

### Opção 2: SQL Manual (para correções)
Execute este SQL no Supabase substituindo o número da obra:

```sql
UPDATE obras
SET data_fechamento = NOW()
WHERE obra = 'NUMERO_DA_OBRA'
  AND data_fechamento IS NULL;
```

## Verificação de Status

Para ver o status de todas as obras:

```sql
SELECT
  obra,
  equipe,
  tipo_servico,
  data_abertura,
  data_fechamento,
  CASE
    WHEN data_fechamento IS NOT NULL THEN 'Concluída'
    ELSE 'Parcial'
  END as status,
  CASE
    WHEN data_fechamento IS NOT NULL AND data_abertura IS NOT NULL
    THEN EXTRACT(DAY FROM (data_fechamento - data_abertura)) || ' dias'
    WHEN data_abertura IS NOT NULL
    THEN EXTRACT(DAY FROM (NOW() - data_abertura)) || ' dias (em aberto)'
    ELSE 'N/A'
  END as duracao
FROM obras
ORDER BY data DESC
LIMIT 20;
```

## Observações

- **data_abertura**: Preenchida automaticamente quando a obra é criada (= created_at)
- **data_fechamento**: NULL = obra parcial/em andamento | Com valor = obra concluída
- **Status**: Calculado automaticamente no sistema web baseado em data_fechamento
