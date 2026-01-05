# 🐛 Problema: Edição de Obras em Modo Offline

## 📋 Resumo do Problema

Quando o usuário edita uma obra **offline** e tenta salvar:
1. ❌ Sistema tenta fazer `supabase.update()` mesmo offline
2. ❌ Gera erro: **"Network request failed"**
3. ❌ Mudanças **não são salvas localmente**
4. ❌ Dados são perdidos ao fechar o app

## 🔍 Análise Técnica

### Fluxo Atual (Problema)

```
Usuário clica "Salvar Obra"
  ↓
handleSalvarObra() - validações
  ↓
prosseguirSalvamento()
  ↓
const isConnected = await checkInternetConnection()
  ↓
if (!isConnected) → APENAS PARA OBRAS NOVAS
  ↓ salva offline
  ↓
MODO ONLINE (linha 1808+)
  ↓
Adiciona fotos à fila de upload
  ↓
Processa uploads
  ↓
if (isEditMode && obraId) ← PROBLEMA ESTÁ AQUI
  ↓ tenta buscar obra: supabase.from('obras').select()
  ↓ ❌ ERRO: Network request failed (offline)
  ↓
updateError → Não salva nada
```

### Código Problemático

**[nova-obra.tsx:2310-2384](../mobile/app/nova-obra.tsx:2310-2384)**

```typescript
if (isEditMode && obraId) {
  // PROBLEMA: Não verifica se está online antes de fazer requisição
  const { data: obraAtual, error: fetchError } = await supabase
    .from('obras')
    .select('*')
    .eq('id', obraId)
    .single(); // ❌ FALHA SE OFFLINE

  if (fetchError) {
    console.error('Erro ao buscar obra atual:', fetchError);
    Alert.alert('Erro', 'Não foi possível carregar a obra para atualização.');
    return; // ❌ SAI SEM SALVAR
  }

  // Mesclar fotos antigas com novas
  const { error: updateError } = await supabase
    .from('obras')
    .update({...}) // ❌ FALHA SE OFFLINE
    .eq('id', obraId);

  error = updateError;
}
```

---

## ✅ Solução Proposta

### Opção 1: Salvar Edições Offline (Recomendada)

Modificar o fluxo para salvar edições localmente quando offline:

```typescript
// Em prosseguirSalvamento(), ANTES da linha 1808
if (isEditMode && obraId) {
  if (!isConnected) {
    // MODO OFFLINE: Atualizar obra localmente
    await updateObraOffline(obraId, obraData, photoIds);
    await loadPendingObras();

    Alert.alert(
      '📱 Alterações Salvas Offline',
      `Obra atualizada localmente.\n\n` +
      `🔄 Será sincronizada automaticamente quando houver internet`,
      [{ text: 'OK', onPress: () => router.back() }]
    );
    return;
  }

  // MODO ONLINE: Buscar e atualizar no servidor
  const { data: obraAtual, error: fetchError } = await supabase
    .from('obras')
    .select('*')
    .eq('id', obraId)
    .single();

  // ... resto do código online
}
```

### Função Nova: `updateObraOffline()`

Criar em [mobile/lib/offline-sync.ts](../mobile/lib/offline-sync.ts):

```typescript
/**
 * Atualiza uma obra offline existente
 */
export async function updateObraOffline(
  obraId: string,
  updatedData: Partial<ObraData>,
  updatedPhotoIds: PhotoIds
): Promise<void> {
  try {
    const key = `@pending_obra_${obraId}`;
    const existing = await AsyncStorage.getItem(key);

    if (!existing) {
      throw new Error('Obra não encontrada no armazenamento local');
    }

    const obra: PendingObra = JSON.parse(existing);

    // Mesclar dados atualizados
    const updatedObra: PendingObra = {
      ...obra,
      ...updatedData,
      photoIds: {
        // Mesclar IDs de fotos antigas com novas
        ...obra.photoIds,
        ...updatedPhotoIds,
      },
      sync_status: 'pending',
      last_modified: new Date().toISOString(),
    };

    await AsyncStorage.setItem(key, JSON.stringify(updatedObra));
    console.log('✅ Obra atualizada offline:', obraId);
  } catch (error) {
    console.error('❌ Erro ao atualizar obra offline:', error);
    throw error;
  }
}
```

---

## 🔄 Sincronização Bidirecional

### Problema Atual

- ✅ Obras **criadas offline** são sincronizadas quando voltam online
- ❌ Obras **editadas offline** **NÃO são sincronizadas**

### Solução

Modificar `syncAllPendingObras()` para detectar edições:

```typescript
// Em offline-sync.ts
export async function syncAllPendingObras(): Promise<void> {
  const pendingObras = await getPendingObras();

  for (const obra of pendingObras) {
    try {
      if (obra.id && obra.id.startsWith('temp-')) {
        // Obra NOVA (criada offline)
        await syncNovaObra(obra);
      } else if (obra.id) {
        // Obra EDITADA (modificada offline)
        await syncObraEditada(obra);
      }
    } catch (error) {
      console.error('Erro ao sincronizar obra:', error);
    }
  }
}

async function syncObraEditada(obra: PendingObra): Promise<void> {
  // 1. Buscar obra no servidor
  const { data: obraServidor } = await supabase
    .from('obras')
    .select('*')
    .eq('id', obra.id)
    .single();

  // 2. Upload de fotos novas
  await uploadNewPhotos(obra.photoIds);

  // 3. Mesclar dados locais com servidor
  const { error } = await supabase
    .from('obras')
    .update({
      ...obra,
      // Mesclar fotos antigas do servidor com novas locais
      fotos_antes: [...(obraServidor.fotos_antes || []), ...obra.fotos_antes],
      // ... outros campos
    })
    .eq('id', obra.id);

  if (!error) {
    // 4. Remover da fila offline
    await AsyncStorage.removeItem(`@pending_obra_${obra.id}`);
    console.log('✅ Obra editada sincronizada:', obra.id);
  }
}
```

---

## 📁 Arquivos que Precisam de Modificação

### 1. [mobile/app/nova-obra.tsx](../mobile/app/nova-obra.tsx)

**Linhas a modificar:**
- **1768-1806**: Adicionar verificação de `isEditMode` no bloco offline
- **2310-2384**: Mover para dentro de `if (isConnected)`

**Mudanças:**
```typescript
// ANTES (linha 1768)
if (!isConnected) {
  // MODO OFFLINE: Salvar obra com IDs das fotos
  await saveObraOffline(obraData, photoIds, tempObraId);
  // ...
}

// DEPOIS
if (!isConnected) {
  if (isEditMode && obraId) {
    // MODO OFFLINE: Atualizar obra existente
    await updateObraOffline(obraId, obraData, photoIds);
    await loadPendingObras();
    Alert.alert(
      '📱 Alterações Salvas Offline',
      'Obra atualizada localmente.\n\nSerá sincronizada quando houver internet',
      [{ text: 'OK', onPress: () => router.back() }]
    );
    return;
  }

  // MODO OFFLINE: Criar nova obra
  await saveObraOffline(obraData, photoIds, tempObraId);
  // ... resto do código
}
```

### 2. [mobile/lib/offline-sync.ts](../mobile/lib/offline-sync.ts)

**Funções a adicionar:**
- `updateObraOffline(obraId, updatedData, updatedPhotoIds)` - Atualizar obra offline
- `syncObraEditada(obra)` - Sincronizar obra editada com servidor
- Modificar `syncAllPendingObras()` para detectar edições

### 3. Tipos (TypeScript)

Adicionar flag `isEdited` ao tipo `PendingObra`:

```typescript
export type PendingObra = {
  id: string;
  // ... outros campos
  isEdited?: boolean; // ✨ NOVO
  originalId?: string; // ✨ NOVO (ID da obra no servidor, se for edição)
  last_modified?: string; // ✨ NOVO
};
```

---

## 🧪 Casos de Teste

### Caso 1: Criar Obra Offline
1. Desligar internet
2. Criar nova obra com fotos
3. Salvar
4. ✅ Verificar que obra aparece em "Obras Pendentes"
5. Ligar internet
6. ✅ Sincronizar automático
7. ✅ Obra aparece no servidor

### Caso 2: Editar Obra Offline (PROBLEMA ATUAL)
1. Criar obra online
2. Desligar internet
3. Abrir obra
4. Adicionar mais fotos
5. Salvar
6. ❌ **ERRO: Network request failed**
7. ❌ **Mudanças não são salvas**

### Caso 3: Editar Obra Offline (COM CORREÇÃO)
1. Criar obra online
2. Desligar internet
3. Abrir obra
4. Adicionar mais fotos
5. Salvar
6. ✅ Mensagem: "Alterações Salvas Offline"
7. ✅ Obra aparece em "Obras Pendentes" com flag de editada
8. Ligar internet
9. ✅ Sincronização automática mescla fotos novas com antigas
10. ✅ Obra no servidor tem todas as fotos

### Caso 4: Conflito de Edição (Opcional - Futuro)
1. Usuário A edita obra offline
2. Usuário B edita a mesma obra online
3. Usuário A volta online e sincroniza
4. ⚠️ Sistema detecta conflito
5. 🔍 Opções:
   - Mesclar automático (fotos são aditivas)
   - Avisar usuário sobre conflito
   - Última edição ganha (timestamp)

---

## 📊 Prioridade de Implementação

### Alta Prioridade (Urgente)
1. ✅ `updateObraOffline()` - Salvar edições localmente
2. ✅ Modificar fluxo em `nova-obra.tsx` para verificar offline antes de editar
3. ✅ Testar salvamento offline de edições

### Média Prioridade
4. ✅ `syncObraEditada()` - Sincronizar edições com servidor
5. ✅ Modificar `syncAllPendingObras()` para suportar edições
6. ✅ Indicador visual de "obra editada offline" em obra-detalhe

### Baixa Prioridade (Futuro)
7. ⏳ Detecção de conflitos de edição
8. ⏳ Merge inteligente de dados
9. ⏳ Histórico de modificações offline

---

## 🚀 Próximos Passos

1. **Implementar `updateObraOffline()`** em [offline-sync.ts](../mobile/lib/offline-sync.ts)
2. **Modificar `prosseguirSalvamento()`** em [nova-obra.tsx](../mobile/app/nova-obra.tsx)
3. **Testar** em cenários offline/online
4. **Implementar sincronização** bidirecional
5. **Documentar** comportamento para usuários

---

**Problema identificado em:** 2025-01-05
**Prioridade:** 🔴 **CRÍTICA** (Perda de dados)
**Impacto:** Todas as edições offline são perdidas
**Solução proposta:** Implementação de `updateObraOffline()` e sincronização bidirecional
