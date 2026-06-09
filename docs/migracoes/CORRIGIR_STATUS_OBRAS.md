# Corrigir Status das Obras - URGENTE

## Problema Identificado

Algumas obras com número `2222222222` aparecem como "Em aberto" no app mobile, mas estão mostrando "Concluída" no sistema web. Isso está INCORRETO.

## Causa

O sistema estava finalizando todas as obras automaticamente, mas isso é errado porque:
1. Nem todas as obras são finalizadas no mesmo momento
2. Algumas obras ficam "em aberto" aguardando complementação
3. O usuário deve decidir quando a obra está finalizada

## Solução Imediata - Execute este SQL

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

-- 3. LIMPAR data_fechamento (marcar TODAS como "Em aberto")
UPDATE obras SET data_fechamento = NULL;

-- 4. Criar índices
CREATE INDEX IF NOT EXISTS obras_data_abertura_idx ON obras(data_abertura);
CREATE INDEX IF NOT EXISTS obras_data_fechamento_idx ON obras(data_fechamento);

-- 5. Verificar
SELECT COUNT(*) as total_obras, COUNT(data_fechamento) as finalizadas, COUNT(*) - COUNT(data_fechamento) as em_aberto FROM obras;
```

**Resultado Esperado:** Todas as obras devem aparecer como "Em aberto" (Parcial) no sistema web.

## Como Finalizar Obras Agora

### Opção 1: Finalizar Manualmente no SQL (Temporário)

Para finalizar obras específicas que você sabe que estão concluídas:

```sql
-- Finalizar uma obra específica
UPDATE obras
SET data_fechamento = NOW()
WHERE obra = 'NUMERO_DA_OBRA';

-- Exemplo:
UPDATE obras
SET data_fechamento = NOW()
WHERE obra = '0033500222';
```

### Opção 2: Implementar Botão "Finalizar" no Mobile (Recomendado)

Precisamos adicionar uma funcionalidade no app mobile para o usuário marcar a obra como finalizada. Isso pode ser:

1. **Checkbox ao salvar:** "Marcar como finalizada?"
2. **Botão separado:** "Finalizar Obra" (aparece ao editar obra existente)
3. **Status explícito:** Dropdown com "Em andamento" / "Finalizada"

**Qual opção você prefere?** Posso implementar agora.

## Estrutura Correta

### Banco de Dados
- `data_abertura`: SEMPRE preenchida quando a obra é criada (= created_at)
- `data_fechamento`: NULL por padrão, preenchida SOMENTE quando o usuário finalizar explicitamente

### Sistema Web
- NULL = Badge amarelo "⚠ Parcial"
- Com data = Badge verde "✓ Concluída"

### App Mobile (Nova funcionalidade necessária)
- [ ] Adicionar forma de marcar obra como finalizada
- [ ] Quando finalizar, setar `data_fechamento = NOW()`

## Próximos Passos

1. **Execute o SQL acima** para limpar as finalizações incorretas
2. **Escolha como quer finalizar obras:**
   - Temporário: Finalizar manualmente no SQL
   - Permanente: Implementar botão no mobile (eu faço agora)
3. **Teste:** Verifique se as obras aparecem corretamente como "Parcial" no web

---

**IMPORTANTE:** Depois de executar o SQL, TODAS as obras estarão como "Em aberto" no web. Você precisará finalizar manualmente (via SQL) as que já foram concluídas, OU aguardar a implementação do botão "Finalizar" no mobile.
