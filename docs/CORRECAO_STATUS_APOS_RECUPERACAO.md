# 🔧 Correção: Status e Sincronização Após Recuperação

## ❌ Problema

Após usar o botão "Recuperar Fotos" do Supabase na tela de detalhes da obra, a obra ainda aparecia como:
- ❌ "Aguardando sincronização" (mesmo já estando sincronizada)
- ❌ Botão "Finalizar Obra" visível (mesmo já estando finalizada)

### Exemplo do Bug

**Obra 99998888:**
- No Supabase: `status = 'finalizada'`, fotos presentes
- No Mobile após recuperação:
  - ❌ Mostrava "Aguardando sincronização"
  - ❌ Mostrava botão "Finalizar Obra"
  - ✅ Fotos foram recuperadas corretamente

## 🔍 Causa Raiz

A função `updateObraInAsyncStorage()` estava copiando todos os campos do Supabase, mas **não estava definindo explicitamente** os campos críticos de controle:

### Campos Problemáticos:

1. **`status`**: Determina se o botão "Finalizar Obra" aparece
   - Verificação na UI: `obra.status !== 'finalizada'` (linha 863 de obra-detalhe.tsx)

2. **`origem`**: Determina se mostra indicador de sincronização
   - Verificação na UI: `obra.origem !== 'offline'` (linha 713 de obra-detalhe.tsx)

3. **`sync_status`**: Status da sincronização pendente
   - Se definido, mostra "Aguardando sincronização"

### Código Problemático (ANTES):

```typescript
const updateObraInAsyncStorage = async (
  syncedObra: any,
  originalObraId: string,
  localObras: LocalObra[]
): Promise<boolean> => {
  const index = localObras.findIndex(o => o.id === originalObraId || o.serverId === originalObraId);

  if (index !== -1) {
    localObras[index] = {
      ...syncedObra,              // ❌ Espalhamento pode não incluir todos os campos
      synced: true,
      locallyModified: false,
      serverId: syncedObra.id,
      last_modified: syncedObra.updated_at || syncedObra.created_at,
      created_at: syncedObra.created_at,
      // ❌ FALTAVA: origem, status, sync_status não eram definidos explicitamente
    } as LocalObra;
  }

  await AsyncStorage.setItem(LOCAL_OBRAS_KEY, JSON.stringify(localObras));
  return true;
};
```

## ✅ Solução

### 1. Atualizar Interfaces TypeScript

Adicionados campos `status`, `origem`, e `finalizada_em` à interface `PendingObra`:

**Arquivo:** `mobile/lib/offline-sync.ts` (linhas 13-22)

```typescript
export interface PendingObra {
  id: string;
  data: string;
  obra: string;
  responsavel: string;
  equipe: string;
  tipo_servico: string;
  status?: 'em_aberto' | 'rascunho' | 'finalizada'; // ✅ NOVO
  finalizada_em?: string | null;                    // ✅ NOVO
  origem?: 'online' | 'offline';                    // ✅ NOVO
  // ... outros campos ...
}
```

### 2. Atualizar `updateObraInAsyncStorage`

Definir explicitamente todos os campos críticos:

**Arquivo:** `mobile/lib/offline-sync.ts` (linhas 404-448)

```typescript
const updateObraInAsyncStorage = async (
  syncedObra: any,
  originalObraId: string,
  localObras: LocalObra[]
): Promise<boolean> => {
  try {
    const index = localObras.findIndex(o => o.id === originalObraId || o.serverId === originalObraId);

    // ✅ Criar objeto com campos explícitos
    const updatedObra = {
      ...syncedObra,
      id: syncedObra.id,                    // ✅ UUID do Supabase
      synced: true,                         // ✅ Marcar como sincronizado
      locallyModified: false,               // ✅ Sem modificações locais
      serverId: syncedObra.id,              // ✅ Referência ao servidor
      origem: 'online',                     // ✅ CRÍTICO: Mudar para 'online'
      sync_status: undefined,               // ✅ CRÍTICO: Remover status pendente
      status: syncedObra.status,            // ✅ CRÍTICO: Preservar 'finalizada'
      finalizada_em: syncedObra.finalizada_em,
      last_modified: syncedObra.updated_at || syncedObra.created_at,
      created_at: syncedObra.created_at,
    } as LocalObra;

    // ✅ Log para debug
    console.log(`📊 Atualizando obra no AsyncStorage:`);
    console.log(`   - ID: ${updatedObra.id}`);
    console.log(`   - Status: ${updatedObra.status}`);
    console.log(`   - Origem: ${updatedObra.origem}`);
    console.log(`   - Synced: ${updatedObra.synced}`);

    if (index !== -1) {
      localObras[index] = updatedObra;
    } else {
      localObras.push(updatedObra);
    }

    await AsyncStorage.setItem(LOCAL_OBRAS_KEY, JSON.stringify(localObras));
    console.log(`✅ Obra atualizada com sucesso no AsyncStorage`);

    return true;
  } catch (error) {
    console.error('❌ Erro ao forçar atualização:', error);
    return false;
  }
};
```

## 🧪 Como Testar

### Cenário de Teste:

1. **Criar obra offline** e sincronizar (obra terá `origem: 'offline'`)
2. **Verificar no Supabase** que a obra está com `status: 'finalizada'`
3. **No mobile**, a obra ainda mostra "Aguardando sincronização"
4. **Clicar em "Recuperar Fotos" → "☁️ Supabase"**
5. **Verificar que**:
   - ✅ Indicador "Aguardando sincronização" **desaparece**
   - ✅ Botão "Finalizar Obra" **desaparece**
   - ✅ Badge "Sincronizada ✓" aparece
   - ✅ Fotos aparecem corretamente

### Debug no Console:

Após clicar em "Recuperar Fotos", você deve ver:

```
🔄 Forçando atualização da obra temp_XXXXXX do Supabase...
📋 Buscando obra 99998888 da equipe EQUIPE_X no Supabase...
📊 Obra encontrada: 99998888 (ID: uuid-xxxxx)
   - fotos_antes: 3 item(s)
📊 Atualizando obra no AsyncStorage:
   - ID: uuid-xxxxx
   - Status: finalizada          ← ✅ Deve ser 'finalizada'
   - Origem: online              ← ✅ Deve ser 'online'
   - Synced: true                ← ✅ Deve ser true
✅ Obra atualizada com sucesso no AsyncStorage
```

## 📋 Verificações da UI

### Indicador de Sincronização

**Arquivo:** `mobile/app/obra-detalhe.tsx` (linhas 712-726)

```typescript
const statusInfo = useMemo(() => {
  if (!obra || obra.origem !== 'offline') {  // ← Verifica origem
    return null; // ✅ Não mostra indicador se origem === 'online'
  }

  if (obra.sync_status === 'failed') {
    return { label: 'Falha ao sincronizar', style: styles.statusFailed };
  }

  if (obra.sync_status === 'syncing') {
    return { label: 'Sincronizando...', style: styles.statusSyncing };
  }

  return { label: 'Aguardando sincronização', style: styles.statusPending };
}, [obra]);
```

### Botão "Finalizar Obra"

**Arquivo:** `mobile/app/obra-detalhe.tsx` (linha 863)

```typescript
{obra.status !== 'finalizada' && (() => {  // ← Verifica status
  const { total: fotosFaltantes } = calcularFotosFaltantes();
  const podeFinalizar = fotosFaltantes === 0;

  return (
    <TouchableOpacity
      style={[styles.finalizarButton, !podeFinalizar && styles.finalizarButtonDisabled]}
      onPress={handleFinalizarObra}
      disabled={!podeFinalizar}
    >
      <Text style={styles.finalizarButtonText}>
        {podeFinalizar ? 'Finalizar Obra' : `Faltam ${fotosFaltantes} foto(s)`}
      </Text>
    </TouchableOpacity>
  );
})()}
```

## 🎯 Resultado

### ANTES da Correção:
```json
{
  "id": "temp_1767705737352",
  "synced": true,
  "serverId": "uuid-xxxxx",
  "origem": "offline",      // ❌ Mantinha 'offline'
  "sync_status": "pending", // ❌ Mantinha status pendente
  "status": "em_aberto"     // ❌ Não preservava 'finalizada'
}
```

### DEPOIS da Correção:
```json
{
  "id": "uuid-xxxxx",
  "synced": true,
  "serverId": "uuid-xxxxx",
  "origem": "online",       // ✅ Mudou para 'online'
  "sync_status": undefined, // ✅ Removeu status pendente
  "status": "finalizada",   // ✅ Preservou 'finalizada'
  "finalizada_em": "2025-01-06T12:00:00Z"
}
```

## 📚 Arquivos Modificados

1. **`mobile/lib/offline-sync.ts`**:
   - Linhas 13-22: Interface `PendingObra` com novos campos
   - Linhas 404-448: Função `updateObraInAsyncStorage` corrigida

## 🔗 Relacionado

- [CORRECAO_BUGS_SINCRONIZACAO.md](./CORRECAO_BUGS_SINCRONIZACAO.md) - Correção anterior de bugs de sincronização
- [OFFLINE_FIRST_IMPLEMENTACAO.md](./OFFLINE_FIRST_IMPLEMENTACAO.md) - Arquitetura offline-first
- [BUG_FOTOS_SUMEM_APOS_SYNC.md](./BUG_FOTOS_SUMEM_APOS_SYNC.md) - Bug de fotos sumindo após sync

## ✅ Conclusão

A correção garante que após usar "Recuperar Fotos":
1. ✅ A obra é marcada como **`origem: 'online'`** → Remove indicador de sincronização
2. ✅ O **`status: 'finalizada'`** é preservado → Remove botão "Finalizar Obra"
3. ✅ O **`sync_status`** é removido → Remove status pendente
4. ✅ As **fotos são recuperadas** do Supabase
5. ✅ O **ID muda de `temp_` para UUID** do Supabase
