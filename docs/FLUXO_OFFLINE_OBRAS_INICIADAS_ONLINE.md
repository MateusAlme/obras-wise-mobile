# Fluxo Offline - Obras Iniciadas Online

## Problema Resolvido ✅

Anteriormente, quando uma obra era iniciada online e o usuário ficava offline, o sistema criava uma **nova obra** em vez de continuar editando a existente.

## Como Funciona Agora

### Cenário: Obra Iniciada Online + Edição Offline

```
1️⃣ ONLINE - Usuário cria obra
   ↓
   • Obra é enviada ao Supabase
   • Recebe um UUID único (ex: "550e8400-e29b-41d4-a716-446655440000")
   • Sistema armazena este UUID no componente

2️⃣ OFFLINE - Usuário fica sem conexão
   ↓
   • Clica em "Continuar Obra" na lista de obras
   • Abre a tela de edição (nova-obra.tsx)
   • isEditMode = true
   • obraId = UUID da obra original

3️⃣ OFFLINE - Usuário adiciona fotos e dados
   ↓
   • backupObraId = obraId (porque isEditMode && obraId são verdadeiros)
   • Fotos são salvas com backup usando o UUID original
   • updateObraOffline(obraId, ...) é chamado
   • Cria entrada em "pending works" com isEdited: true

4️⃣ ONLINE - Usuário restaura conexão
   ↓
   • syncAllPendingObras() detecta a entrada de edição
   • Sincroniza apenas as alterações (merging de fotos)
   • Atualiza a obra original no Supabase
   • Remove da fila pendente
```

## Código Técnico

### No novo-obra.tsx

```typescript
// Quando em modo de edição, usar o obraId real para salvar fotos corretamente
const backupObraId = isEditMode && obraId ? obraId : tempObraId;

// Chamadas agora usam backupObraId:
await backupPhoto(photoUri, backupObraId, tipo, ...);
await saveObraOffline(obraData, photoIds, backupObraId);
await processObraPhotos(backupObraId, undefined, allPhotoIds);
```

### No offline-sync.ts

```typescript
export const updateObraOffline = async (
  obraId: string,
  updatedData: Partial<PendingObra>,
  updatedPhotoIds: Partial<PhotoGroupIds>
): Promise<void> => {
  // Se obra não está na fila pendente (foi criada online)
  if (obraIndex === -1) {
    // Criar nova entrada com isEdited: true
    const editedObra: PendingObra = {
      ...updatedData,
      id: obraId,
      isEdited: true,
      originalId: obraId,
      // ...
    };
    pendingObras.push(editedObra);
  }
  // Se obra já está pendente, atualizar fotos
  else {
    const updatedObra = {
      ...existingObra,
      ...updatedData,
      // Mesclar IDs de fotos
      fotos_antes: [...(existingObra.fotos_antes ?? []), ...(updatedPhotoIds.antes ?? [])],
      // ... etc
    };
    pendingObras[obraIndex] = updatedObra;
  }
};
```

## Fluxo de Sincronização

Quando o usuário volta online:

1. `syncAllPendingObras()` é chamado automaticamente
2. Para obras com `isEdited: true`:
   - Identifica que é uma edição de obra existente
   - Mescla as novas fotos com as existentes
   - Faz UPDATE no lugar de INSERT
3. Apenas as alterações são sincronizadas
4. Obra é removida da fila pendente

## Exemplo Real

**Usuário A:**
- ✅ Cria obra "Troca de Transformador" (ONLINE)
- 📱 Vai pra zona sem sinal
- ✅ Adiciona 5 fotos de conexões (OFFLINE)
- 📡 Volta com sinal
- ✅ Sistema sincroniza apenas as 5 novas fotos
- ✅ Obra fica completa com todas as fotos

**Antes (bugado):**
- Criaria uma obra DUPLICADA offline
- Causaria confusão na sincronização

**Agora (corrigido):**
- Continua a mesma obra
- Fotos são organizadas corretamente
- Sincronização é limpa e eficiente

## Identificadores Importantes

- **tempObraId**: ID temporário gerado localmente para novas obras (formato: `temp_1234567890`)
- **obraId**: ID real da obra (UUID do Supabase quando criada online, ou tempObraId para novas obras offline)
- **backupObraId**: ID usado para salvamento de fotos (= obraId em modo edição, tempObraId em modo novo)
- **originalId**: Armazenado em PendingObra para rastrear edições de obras existentes
