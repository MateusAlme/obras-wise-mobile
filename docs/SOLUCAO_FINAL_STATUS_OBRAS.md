# Solução Final - Status de Obras

## Problema Resolvido

O app mobile tem um botão "Finalizar Obra" que marca obras como finalizadas, mas essa informação não estava sendo refletida no sistema web. Agora está corrigido!

## O Que Foi Feito

### 1. Código Mobile Atualizado
- **Arquivo:** `mobile/app/obra-detalhe.tsx` (linha 590)
- **Mudança:** Quando o usuário clica em "Finalizar Obra", agora salva também o campo `data_fechamento`
- **Efeito:** Obras finalizadas no mobile aparecerão como "Concluída" no web automaticamente

### 2. Como Funciona Agora

**No App Mobile:**
1. Usuário abre uma obra existente
2. Adiciona todas as fotos obrigatórias
3. Clica no botão "Finalizar Obra" (verde)
4. Sistema salva:
   - `status = 'finalizada'`
   - `finalizada_em = data/hora atual`
   - `data_fechamento = data/hora atual` ← **NOVO!**

**No Sistema Web:**
- Obra com `data_fechamento` → Badge verde "✓ Concluída"
- Obra sem `data_fechamento` → Badge amarelo "⚠ Parcial"

## Execute Este SQL Agora

**Acesse:** https://supabase.com/dashboard → SQL Editor

**Cole e execute:**

```sql
-- 1. Criar colunas se não existirem
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'obras' AND column_name = 'data_abertura') THEN
    ALTER TABLE obras ADD COLUMN data_abertura TIMESTAMPTZ;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'obras' AND column_name = 'data_fechamento') THEN
    ALTER TABLE obras ADD COLUMN data_fechamento TIMESTAMPTZ;
  END IF;
END $$;

-- 2. Preencher data_abertura
UPDATE obras SET data_abertura = created_at WHERE data_abertura IS NULL;

-- 3. SINCRONIZAR obras já finalizadas
-- Copiar finalizada_em para data_fechamento (para obras que já foram finalizadas)
UPDATE obras
SET data_fechamento = finalizada_em
WHERE status = 'finalizada'
  AND finalizada_em IS NOT NULL
  AND data_fechamento IS NULL;

-- 4. Criar índices
CREATE INDEX IF NOT EXISTS obras_data_abertura_idx ON obras(data_abertura);
CREATE INDEX IF NOT EXISTS obras_data_fechamento_idx ON obras(data_fechamento);
CREATE INDEX IF NOT EXISTS obras_status_idx ON obras(status);

-- 5. Verificar resultado
SELECT
  COUNT(*) as total,
  COUNT(CASE WHEN status = 'finalizada' THEN 1 END) as finalizadas,
  COUNT(data_fechamento) as com_data_fechamento
FROM obras;
```

## Resultado Esperado

Após executar o SQL acima:

✅ **Obras finalizadas no mobile** → Aparecem como "Concluída" no web
✅ **Obras em aberto** → Aparecem como "Parcial" no web
✅ **Novas obras** → Começam como "Parcial", ficam "Concluída" quando finalizadas no mobile

## Como Finalizar Obras

### No App Mobile (Método Oficial)

1. Abra a obra na lista "Histórico de Obras"
2. Toque na obra para ver os detalhes
3. Se a obra NÃO está finalizada, você verá:
   - Botão "Adicionar Fotos" (azul)
   - Botão "Finalizar Obra" (verde) - só fica ativo quando todas as fotos obrigatórias estiverem anexadas
4. Toque em "Finalizar Obra"
5. Confirme
6. Pronto! A obra aparecerá como "Concluída" no sistema web

### Manualmente no SQL (Emergencial)

Se precisar marcar uma obra como finalizada direto no banco:

```sql
UPDATE obras
SET
  status = 'finalizada',
  finalizada_em = NOW(),
  data_fechamento = NOW()
WHERE obra = 'NUMERO_DA_OBRA';
```

## Verificar Status de Uma Obra Específica

```sql
SELECT
  obra,
  equipe,
  tipo_servico,
  status,
  finalizada_em,
  data_fechamento,
  CASE
    WHEN data_fechamento IS NOT NULL THEN 'Concluída (Web)'
    WHEN status = 'finalizada' THEN 'Finalizada (Mobile) - Inconsistente'
    ELSE 'Parcial'
  END as status_atual
FROM obras
WHERE obra = '2222222222';
```

## Solução de Problemas

### Problema: Obra finalizada no mobile mas aparece "Parcial" no web

**Causa:** SQL não foi executado ainda

**Solução:** Execute o SQL acima para sincronizar

### Problema: Obra em aberto aparece como "Concluída"

**Causa:** Obra foi marcada incorretamente como finalizada

**Solução:**
```sql
UPDATE obras
SET
  status = 'em_aberto',
  finalizada_em = NULL,
  data_fechamento = NULL
WHERE obra = 'NUMERO_DA_OBRA';
```

## Resumo Técnico

### Campos no Banco de Dados

- `data_abertura` (TIMESTAMPTZ): Quando a obra foi criada (= created_at)
- `data_fechamento` (TIMESTAMPTZ): Quando a obra foi finalizada (NULL = em aberto)
- `status` (TEXT): 'em_aberto' ou 'finalizada' (usado pelo mobile)
- `finalizada_em` (TIMESTAMPTZ): Mesma coisa que data_fechamento (legado)

### Lógica de Status

**Sistema Web:**
```typescript
function getStatus(obra) {
  return obra.data_fechamento ? 'concluida' : 'parcial';
}
```

**App Mobile:**
```typescript
const isFinalizada = obra.status === 'finalizada';
```

Agora os dois sistemas estão sincronizados! 🎉
