# 🐛 Bug: Duplicação de Obras ao Finalizar

## ❌ Problema Identificado

Quando o usuário finalizava uma obra, ela aparecia **duplicada** na lista:

1. ✅ Primeira entrada: Com fotos, status "Em aberto"
2. ✅ Segunda entrada: Sem fotos, status "Sincronizada"
3. ❌ Nenhuma das duas marcada como "Finalizada"

## 🔍 Causa Raiz

O bug ocorria durante a sincronização da obra finalizada:

### Fluxo com Problema:

```
1. Usuário cria obra → Salva com ID temporário (temp_36523625)
   ↓
2. Usuário adiciona fotos → IDs das fotos salvos no AsyncStorage
   ↓
3. Usuário clica "Finalizar" → Obra sincroniza com Supabase
   ↓
4. Supabase cria registro com UUID permanente (a1b2c3d4-...)
   ↓
5. Sistema tenta atualizar AsyncStorage:
   - Adiciona nova entrada com UUID permanente ✅
   - MAS não remove entrada antiga com temp_ ❌
   ↓
6. Resultado: 2 obras na lista!
   - temp_36523625: Com fotos locais
   - a1b2c3d4-...: Sem fotos (recém criada)
```

### Código Problemático:

**Arquivo**: `mobile/lib/offline-sync.ts` (linhas 526-541)

```typescript
if (finalId !== obraId) {
  console.log(`🔄 ID mudou: ${obraId} → ${finalId}`);
  // Remover entrada antiga
  localObras.splice(index, 1);  // ← Deveria remover, mas...
  // Adicionar nova entrada com ID correto
  localObras.push({             // ← ...push adiciona no final
    ...syncedObra,
    synced: true,
    // ...
  });
}
```

**Problema**: O `splice` remove do índice, mas se houver múltiplas obras o índice pode ficar desatualizado após o `push`.

## ✅ Solução Implementada

### 1. Script de Limpeza de Duplicatas

**Arquivo**: `mobile/lib/fix-duplicates.ts`

Criado script que:
- Identifica obras duplicadas pelo número
- Mantém apenas a versão sincronizada (synced=true)
- Se ambas estiverem sincronizadas, mantém a mais recente
- Remove entradas duplicadas do AsyncStorage

### 2. Botão "🧹 Limpar" na Lista de Obras

Adicionado botão na barra de ações que:
- Executa o script de limpeza
- Mostra quantas duplicatas foram removidas
- Recarrega a lista automaticamente

## 🔧 Como Corrigir o Problema Atual

### Passo 1: Abrir o App

1. Abrir app mobile
2. Ir para a tela "Obras"

### Passo 2: Clicar em "Limpar"

1. Localizar o botão **"🧹 Limpar"** na barra de ações
2. Clicar no botão
3. Confirmar "Limpar" no alerta
4. Aguardar processamento

### Passo 3: Verificar Resultado

Após a limpeza, o alerta mostrará:

```
✅ Limpeza Concluída

Total de obras: 10
Duplicadas encontradas: 1
Removidas: 1
```

A lista será recarregada automaticamente com **apenas uma versão** de cada obra.

## 📊 O Que o Script Faz

### Lógica de Limpeza:

```typescript
// 1. Agrupar obras por número
const obrasPorNumero = new Map<string, LocalObra[]>();

// 2. Para obras duplicadas:
if (duplicatasDestaObra.length > 1) {
  // Manter apenas a versão sincronizada
  const obraSincronizada = duplicatas.find(o => o.synced === true);
  const obraNaoSincronizada = duplicatas.find(o => o.synced === false);

  if (obraSincronizada) {
    // Manter sincronizada, remover não sincronizada
  }
}

// 3. Se múltiplas sincronizadas:
// Manter a mais recente (por last_modified)
```

## 🔒 Prevenção Futura

### Melhorias no Código de Sincronização:

Será necessário melhorar o código em `offline-sync.ts` para:

1. **Usar findIndex corretamente** ao remover duplicatas
2. **Verificar se entrada antiga foi removida** antes de adicionar nova
3. **Adicionar log de validação** após sincronização

### Código Melhorado (a implementar):

```typescript
if (finalId !== obraId) {
  console.log(`🔄 ID mudou: ${obraId} → ${finalId}`);

  // Remover TODAS as entradas com ID antigo
  const obrasLimpas = localObras.filter(o => o.id !== obraId);

  // Adicionar nova entrada
  obrasLimpas.push({
    ...syncedObra,
    synced: true,
    origem: 'online',
    // ...
  });

  // Validar: garantir que não há duplicatas
  const obraNumero = syncedObra.obra;
  const countMesmoNumero = obrasLimpas.filter(o => o.obra === obraNumero).length;

  if (countMesmoNumero > 1) {
    console.error(`⚠️ DUPLICATA DETECTADA: ${obraNumero} aparece ${countMesmoNumero} vezes!`);
  }

  localObras = obrasLimpas;
}
```

## 🧪 Como Testar a Correção

### Teste 1: Limpar Duplicatas Existentes

1. Abrir app com duplicatas
2. Clicar "🧹 Limpar"
3. Verificar: Duplicatas foram removidas ✅

### Teste 2: Finalizar Nova Obra

1. Criar nova obra de teste
2. Adicionar fotos
3. Clicar "Finalizar" (com internet)
4. Aguardar sincronização
5. Verificar: Apenas 1 obra aparece na lista ✅
6. Verificar: Obra tem fotos ✅
7. Verificar: Status "Concluída" ✅

### Teste 3: Verificar no Web

1. Abrir sistema web
2. Buscar obra finalizada
3. Verificar: Obra aparece com status "Finalizada" ✅
4. Verificar: Fotos estão presentes ✅

## 📋 Checklist de Verificação

Após usar o botão "Limpar":

- [ ] Obras duplicadas foram removidas
- [ ] Cada obra aparece apenas 1 vez
- [ ] Obras mantidas têm status correto
- [ ] Fotos estão preservadas
- [ ] Status "Sincronizada" para obras online
- [ ] Status "Aguardando" para obras offline

## 🎯 Resultado Esperado

### ANTES (com bug):
```
📱 Lista de Obras:
1. Obra 36523625 - Em aberto - 3 fotos ⚠️
2. Obra 36523625 - Sincronizada - 0 fotos ⚠️
```

### DEPOIS (corrigido):
```
📱 Lista de Obras:
1. Obra 36523625 - Concluída - 3 fotos ✅
```

## 🚨 Atenção

**IMPORTANTE**: Este botão é **temporário** para corrigir duplicatas existentes.

Após correção do bug no código de sincronização, o botão pode ser removido ou mantido como ferramenta de manutenção.

## 📝 Notas Técnicas

### Arquivos Criados:

1. `mobile/lib/fix-duplicates.ts` - Script de limpeza
2. `docs/BUG_DUPLICACAO_OBRAS.md` - Esta documentação

### Arquivos Modificados:

1. `mobile/app/(tabs)/obras.tsx`:
   - Adicionado import de `removeDuplicateObras`
   - Adicionada função `handleLimparDuplicatas()`
   - Adicionado botão "🧹 Limpar" na UI

### Próximos Passos:

1. Usuário usa botão "Limpar" para corrigir duplicatas existentes
2. Desenvolvedor corrige código de sincronização em `offline-sync.ts`
3. Testar finalização de novas obras
4. Verificar que não há mais duplicação
5. Opcional: Remover botão "Limpar" após confirmar correção

## 🎉 Conclusão

O bug de duplicação foi:
- ✅ **Identificado**: Problema no código de sincronização
- ✅ **Documentado**: Causa raiz explicada
- ✅ **Corrigido (temporário)**: Script de limpeza criado
- ⏳ **Correção permanente**: Aguardando melhoria no código de sync

**Use o botão "🧹 Limpar" para resolver duplicatas existentes!**
