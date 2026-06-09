# Finalizar Todas as Obras Automaticamente

## Problema
No app mobile, as obras são finalizadas automaticamente quando salvas. Porém, o campo `data_fechamento` não estava sendo preenchido, fazendo com que todas as obras apareçam como "Parcial" no sistema web.

## Solução

### Execute este SQL no Supabase Dashboard (SQL Editor)

Acesse: https://supabase.com/dashboard → Seu Projeto → SQL Editor

Cole e execute este SQL:

```sql
-- 1. Criar as colunas se não existirem
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

-- 3. Finalizar TODAS as obras existentes
-- (no mobile, as obras são finalizadas automaticamente ao salvar)
UPDATE obras
SET data_fechamento = created_at
WHERE data_fechamento IS NULL;

-- 4. Criar índices para performance
CREATE INDEX IF NOT EXISTS obras_data_abertura_idx ON obras(data_abertura);
CREATE INDEX IF NOT EXISTS obras_data_fechamento_idx ON obras(data_fechamento);

-- 5. Verificar resultado
SELECT
  COUNT(*) as total_obras,
  COUNT(data_fechamento) as finalizadas,
  COUNT(*) - COUNT(data_fechamento) as em_aberto
FROM obras;
```

### Verificar no Sistema Web

Após executar o SQL:

1. Acesse a página de **Relatórios** ou **Acompanhamento**
2. TODAS as obras devem aparecer com badge verde "✓ Concluída"
3. A obra `2222222222` e todas as outras devem estar finalizadas

## Como Funciona Agora

### No App Mobile
- Quando uma obra é salva, `data_abertura` = `data_fechamento` = hora atual
- Isso significa que a obra foi iniciada e finalizada no mesmo momento
- Todas as obras criadas/salvas no mobile são automaticamente finalizadas

### No Sistema Web
- Se `data_fechamento` existe → Badge verde "Concluída"
- Se `data_fechamento` é NULL → Badge amarelo "Parcial"
- A página de Acompanhamento mostra:
  - Data de Abertura
  - Data de Fechamento
  - Dias em Aberto (diferença entre as datas)

## Código Atualizado

O arquivo `mobile/app/nova-obra.tsx` já foi atualizado:

```typescript
const obraData: any = {
  data,
  obra,
  responsavel: isCompUser ? 'COMP' : responsavel,
  equipe: isCompUser ? equipeExecutora : equipe,
  tipo_servico: tipoServico,
  transformador_status: isServicoTransformador ? transformadorStatus : null,
  created_at: createdAt,
  data_abertura: createdAt,  // Data de início
  data_fechamento: createdAt, // Finalizada automaticamente
};
```

## Próximos Passos

Depois de executar o SQL acima, todas as obras (antigas e novas) estarão finalizadas automaticamente.

Se no futuro houver necessidade de ter obras "em aberto" (não finalizadas), você precisará:
1. Adicionar um checkbox/botão no mobile para marcar se a obra foi finalizada ou não
2. Modificar o código para só preencher `data_fechamento` se a obra foi marcada como finalizada
