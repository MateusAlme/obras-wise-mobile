# 🐛 Correção: Sync Revertendo Status e Duplicando Fotos

## 📋 Problemas Relatados

### Problema 1: Status Revertido Após Sync
**Sintoma**:
- Obra finalizada (status: 'finalizada') ✅
- Ao clicar em "Sincronizar" 🔄
- Card volta para "Em Aberto" ❌
- Botão "Finalizar" volta a aparecer ❌

### Problema 2: Fotos Duplicadas Após Sync
**Sintoma**:
- Ao sincronizar obra, fotos duplicam
- Cada foto aparece 2x, 3x ou mais vezes
- Quanto mais sincroniza, mais duplica

## 🔍 Causas Raiz

### Causa do Problema 1: Status Hard-coded no INSERT

**Arquivo**: `mobile/lib/offline-sync.ts` (linha 1342 - ANTES)

```typescript
const { data: insertedObra, error } = await supabase
  .from('obras')
  .insert([
    {
      data: obra.data,
      obra: obra.obra,
      // ...
      status: 'em_aberto', // ❌ SEMPRE em_aberto, ignora obra.status!
```

**Problema**: Ao inserir nova obra no Supabase, o código **sempre usava** `status: 'em_aberto'`, ignorando completamente o `obra.status` que vinha do app.

**Cenário**:
```
1. App finaliza obra → obra.status = 'finalizada' ✅
2. Sync insere no Supabase → status: 'em_aberto' ❌
3. Supabase retorna obra com status 'em_aberto'
4. Card mostra "Em Aberto" ❌
5. Botão "Finalizar" aparece novamente ❌
```

### Causa do Problema 2: Função `merged()` Concatenando Fotos

**Arquivo**: `mobile/lib/offline-sync.ts` (linha 1246 - ANTES)

```typescript
// ❌ ANTES: Concatenava arrays (duplicação)
const merged = (fieldData: any[], existingField: any[]) => ([
  ...(existingField || []),  // Fotos antigas
  ...(fieldData || [])       // + Fotos novas
]);

// Exemplo de uso:
fotos_antes: merged(fotosAntesData, existingObra.fotos_antes),
```

**Problema**: Ao fazer UPDATE de uma obra existente no Supabase, a função `merged()` **concatenava** as fotos antigas com as novas, causando duplicação.

**Cenário**:
```
1. Primeira sincronização:
   - Obra no Supabase: fotos_antes = []
   - Fotos locais: ["photo1", "photo2"]
   - merged() → [...[], ...["photo1", "photo2"]] = ["photo1", "photo2"] ✅

2. Segunda sincronização (mesma obra):
   - Obra no Supabase: fotos_antes = ["photo1", "photo2"]
   - Fotos locais: ["photo1", "photo2"] (as mesmas)
   - merged() → [...["photo1", "photo2"], ...["photo1", "photo2"]]
   - Resultado: ["photo1", "photo2", "photo1", "photo2"] ❌ DUPLICAÇÃO!

3. Terceira sincronização:
   - Obra no Supabase: fotos_antes = ["photo1", "photo2", "photo1", "photo2"]
   - Fotos locais: ["photo1", "photo2"]
   - merged() → [...["photo1", "photo2", "photo1", "photo2"], ...["photo1", "photo2"]]
   - Resultado: ["photo1", "photo2", "photo1", "photo2", "photo1", "photo2"] ❌ 3x DUPLICADAS!
```

**Pior ainda**: No UPDATE, o código também **não atualizava o status**:
```typescript
// ❌ ANTES: Linha 1254 (comentário enganoso)
// manter status atual do servidor
```

O comentário dizia "manter status", mas na verdade **não havia linha alguma** setando o status no `updatePayload`! Isso causava:
1. Status da obra local (ex: 'finalizada') sendo IGNORADO
2. Status do Supabase (ex: 'em_aberto') sendo MANTIDO

## ✅ Soluções Implementadas

### Solução 1: Usar `obra.status` no INSERT

**Arquivo**: `mobile/lib/offline-sync.ts` (linha 1342)

```typescript
// ✅ DEPOIS: Usa status da obra, com fallback
const { data: insertedObra, error } = await supabase
  .from('obras')
  .insert([
    {
      data: obra.data,
      obra: obra.obra,
      // ...
      status: obra.status || 'em_aberto', // ✅ Usa obra.status, ou 'em_aberto' como fallback
```

**Mudança**: Agora o código **respeita** o `obra.status` ao inserir no Supabase. Se por algum motivo `obra.status` for `undefined`, usa 'em_aberto' como fallback (seguro).

### Solução 2: Substituir `merged()` por `replaceOrKeep()`

**Arquivo**: `mobile/lib/offline-sync.ts` (linhas 1247-1254 e 1262-1319)

```typescript
// ✅ DEPOIS: Substituir fotos se houver novas, caso contrário manter existentes
const replaceOrKeep = (newData: any[], existingData: any[]) => {
  // Se há novas fotos, usa elas (substituição completa)
  if (newData && newData.length > 0) {
    return newData;
  }
  // Caso contrário, mantém as existentes
  return existingData || [];
};

const updatePayload: any = {
  data: obra.data ?? existingObra.data,
  obra: obra.obra ?? existingObra.obra,
  // ...
  status: obra.status ?? existingObra.status, // ✅ NOVO: Manter status da obra local ou do servidor
  fotos_antes: replaceOrKeep(fotosAntesData, existingObra.fotos_antes), // ✅ Substituir, não concatenar
  fotos_durante: replaceOrKeep(fotosDuranteData, existingObra.fotos_durante),
  fotos_depois: replaceOrKeep(fotosDepoisData, existingObra.fotos_depois),
  // ... todos os 54 campos de fotos atualizados
};
```

**Mudanças**:
1. ✅ **Nova função `replaceOrKeep()`**: Substitui fotos se houver novas, mantém existentes caso contrário
2. ✅ **Adicionada linha de status**: `status: obra.status ?? existingObra.status`
3. ✅ **Substituídas TODAS as 54 ocorrências** de `merged()` por `replaceOrKeep()`

**Lógica de `replaceOrKeep()`**:
- **Se há novas fotos** (`newData.length > 0`): Usa elas (substituição completa) ✅
- **Se não há novas fotos** (`newData.length === 0` ou `undefined`): Mantém as existentes ✅
- **Resultado**: ZERO duplicação, mesmo sincronizando múltiplas vezes

## 🔄 Fluxos Corrigidos

### Cenário 1: Finalizar Obra Nova e Sincronizar

**Fluxo ANTES (❌ Status revertido)**:
```
1. App: Criar obra → Finalizar
   - obra.status = 'finalizada' ✅

2. Sync: INSERT no Supabase
   - status: 'em_aberto' ❌ (hard-coded)
   - Supabase retorna obra com status 'em_aberto'

3. App recarrega lista
   - Card mostra "Em Aberto" ❌
   - Botão "Finalizar" aparece ❌
```

**Fluxo DEPOIS (✅ Status mantido)**:
```
1. App: Criar obra → Finalizar
   - obra.status = 'finalizada' ✅

2. Sync: INSERT no Supabase
   - status: obra.status || 'em_aberto' → 'finalizada' ✅
   - Supabase retorna obra com status 'finalizada' ✅

3. App recarrega lista
   - Card mostra "Finalizada" ✅
   - Botão "Finalizar" NÃO aparece ✅
```

### Cenário 2: Sincronizar Obra Múltiplas Vezes

**Fluxo ANTES (❌ Fotos duplicadas)**:
```
1. Primeira sync:
   - Supabase: fotos_antes = []
   - App: ["photo1", "photo2"]
   - merged() → ["photo1", "photo2"] ✅

2. Segunda sync (mesma obra):
   - Supabase: fotos_antes = ["photo1", "photo2"]
   - App: ["photo1", "photo2"]
   - merged() → ["photo1", "photo2"] + ["photo1", "photo2"]
   - Resultado: ["photo1", "photo2", "photo1", "photo2"] ❌ DUPLICADAS!

3. Terceira sync:
   - Supabase: ["photo1", "photo2", "photo1", "photo2"]
   - App: ["photo1", "photo2"]
   - merged() → 4 + 2 = 6 fotos ❌ TRIPLICADAS!
```

**Fluxo DEPOIS (✅ Sem duplicação)**:
```
1. Primeira sync:
   - Supabase: fotos_antes = []
   - App: ["photo1", "photo2"]
   - replaceOrKeep() → newData.length > 0 → ["photo1", "photo2"] ✅

2. Segunda sync (mesma obra):
   - Supabase: fotos_antes = ["photo1", "photo2"]
   - App: ["photo1", "photo2"]
   - replaceOrKeep() → newData.length > 0 → ["photo1", "photo2"] ✅ SUBSTITUIÇÃO!

3. Terceira sync:
   - Supabase: fotos_antes = ["photo1", "photo2"]
   - App: ["photo1", "photo2"]
   - replaceOrKeep() → ["photo1", "photo2"] ✅ SEMPRE 2 FOTOS!
```

### Cenário 3: Sync de Obra com Status Alterado

**Fluxo ANTES (❌ Status não atualizado)**:
```
1. Obra no Supabase: status = 'em_aberto'
2. App finaliza obra: obra.status = 'finalizada'
3. Sync: UPDATE no Supabase
   - updatePayload NÃO tinha campo status ❌
   - Supabase mantém status = 'em_aberto' ❌
4. Card mostra "Em Aberto" ❌
```

**Fluxo DEPOIS (✅ Status atualizado)**:
```
1. Obra no Supabase: status = 'em_aberto'
2. App finaliza obra: obra.status = 'finalizada'
3. Sync: UPDATE no Supabase
   - status: obra.status ?? existingObra.status → 'finalizada' ✅
   - Supabase atualiza para 'finalizada' ✅
4. Card mostra "Finalizada" ✅
```

## 📊 Resumo das Mudanças

### Arquivo `mobile/lib/offline-sync.ts`

| Linha | Mudança | Descrição |
|-------|---------|-----------|
| 1247-1254 | Nova função `replaceOrKeep()` | Substitui fotos em vez de concatenar |
| 1262 | Adicionado `status:` no UPDATE | Mantém status da obra local/servidor |
| 1263-1319 | Substituído `merged` → `replaceOrKeep` | 54 campos de fotos atualizados |
| 1342 | `status: obra.status \|\| 'em_aberto'` | Respeita status da obra no INSERT |

## ✅ Resultado Final

### Status Correto Após Sync

- ✅ Obra finalizada permanece "Finalizada" após sync
- ✅ Obra em aberto permanece "Em Aberto" após sync
- ✅ Botão "Finalizar" só aparece quando deve
- ✅ Cards mostram status correto

### Fotos Sem Duplicação

- ✅ Sincronizar 1x: fotos corretas
- ✅ Sincronizar 2x: mesmas fotos (sem duplicar)
- ✅ Sincronizar 10x: mesmas fotos (sem duplicar)
- ✅ Adicionar novas fotos: substituição correta

## 🎯 Como Testar

### Teste 1: Status Mantido Após Finalizar e Sincronizar

1. **Criar nova obra** completa
2. **Clicar "Finalizar"**
3. **Verificar card**: Status "Finalizada" ✅
4. **Clicar "Sincronizar"**
5. **Verificar card**: AINDA "Finalizada" ✅
6. **Verificar botão**: "Finalizar" NÃO aparece ✅

### Teste 2: Fotos Sem Duplicar Após Múltiplos Syncs

1. **Criar obra** com 3 fotos
2. **Finalizar** e **Sincronizar**
3. **Abrir obra** no Supabase/Web: 3 fotos ✅
4. **Sincronizar novamente** (no app)
5. **Abrir obra** no Supabase/Web: AINDA 3 fotos (não 6) ✅
6. **Sincronizar mais 5 vezes**
7. **Abrir obra** no Supabase/Web: AINDA 3 fotos (não 18) ✅

### Teste 3: Adicionar Fotos Após Sync

1. **Criar obra** com 2 fotos
2. **Finalizar** e **Sincronizar**
3. **Editar obra** (adicionar mais 1 foto)
4. **Sincronizar**
5. **Verificar**: 3 fotos no total ✅ (não 5 = 2 + 2 + 1)

## ⚠️ Observações Importantes

### Migração de Obras Antigas com Fotos Duplicadas

Se você já tem obras no Supabase com fotos duplicadas (de antes desta correção), elas **não serão corrigidas automaticamente**.

Para limpar fotos duplicadas de obras antigas, você pode:

1. **Manualmente** via SQL:
   ```sql
   -- Ver quais obras têm fotos duplicadas
   SELECT obra, array_length(fotos_antes, 1) as qtd_fotos_antes
   FROM obras
   WHERE array_length(fotos_antes, 1) > 10
   ORDER BY qtd_fotos_antes DESC;
   ```

2. **Deletar obra e recriar** (se necessário)

### Nova Sincronização Não Duplica

A partir de agora, **TODAS as sincronizações** usarão `replaceOrKeep()`, então:
- ✅ Obras antigas: não duplicam mais ao sincronizar
- ✅ Obras novas: nunca duplicarão

## 🔗 Documentação Relacionada

- [CORRECAO_BOTOES_E_DUPLICATAS.md](./CORRECAO_BOTOES_E_DUPLICATAS.md) - Duplicação de obras ao pausar
- [CORRECAO_FOTOS_NAO_APARECEM_PAUSAR.md](./CORRECAO_FOTOS_NAO_APARECEM_PAUSAR.md) - Fotos sumindo após pausar
- [MIGRACAO_CAMPOS_FOTOS.md](./MIGRACAO_CAMPOS_FOTOS.md) - Migração de campos de fotos

## 🚀 Status

✅ **Correção Implementada e Pronta para Teste**

- ✅ Status respeitado no INSERT
- ✅ Status atualizado no UPDATE
- ✅ Fotos substituídas (não concatenadas)
- ✅ 54 campos de fotos corrigidos
- ✅ Zero duplicação em múltiplos syncs
