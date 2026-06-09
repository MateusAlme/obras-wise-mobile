# Como Debugar o Problema de Fotos Não Aparecendo Após Sincronização

## ✅ BUG CORRIGIDO!

**Problema identificado e resolvido em [mobile/lib/offline-sync.ts:377-380](../mobile/lib/offline-sync.ts#L377-L380)**

### O que estava acontecendo:

1. Fotos eram uploadadas com sucesso ✅
2. `markPhotoAsUploaded` marcava `uploaded=true` e salvava `uploadUrl` ✅
3. **BUG:** `getPhotoMetadatasByIds` chamava `getPendingPhotos()` que retorna **APENAS fotos com `uploaded=false`** ❌
4. Como as fotos JÁ estavam marcadas como `uploaded=true`, elas **NÃO ERAM ENCONTRADAS** ❌
5. `convertPhotosToData` recebia array vazio
6. Banco era salvo **SEM FOTOS** ❌

### A correção:

```typescript
// ANTES (errado):
const getPhotoMetadatasByIds = async (photoIds: string[]): Promise<PhotoMetadata[]> => {
  const allPending = await getPendingPhotos();  // ❌ Só retorna uploaded=false
  return allPending.filter(p => photoIds.includes(p.id));
};

// DEPOIS (correto):
const getPhotoMetadatasByIds = async (photoIds: string[]): Promise<PhotoMetadata[]> => {
  const allMetadata = await getAllPhotoMetadata();  // ✅ Retorna TODAS as fotos
  return allMetadata.filter(p => photoIds.includes(p.id));
};
```

---

## 📋 Problema (Histórico)
Fotos tiradas offline não aparecem após sincronizar a obra para online.

## 🔍 Logs de Debug Adicionados

Foram adicionados logs detalhados em `mobile/lib/offline-sync.ts` para rastrear o fluxo completo:

### 1. Logs no Início da Sincronização
```
🚀 [syncObra] Iniciando upload de fotos para obra <NOME_OBRA>
```

### 2. Logs Após Upload
```
📊 [syncObra] Upload concluído: X sucesso, Y falhas
```

### 3. Logs de Metadados
```
📥 [syncObra] Obtendo metadados das fotos uploadadas...
   - fotos_antes: X IDs
   - fotos_durante: Y IDs
   - fotos_depois: Z IDs
```

### 4. Logs em `convertPhotosToData`
Para CADA tipo de foto (antes, durante, depois, etc), você verá:

```
🔍 [convertPhotosToData] Recebeu X foto(s)
📸 Foto 1: {
  id: "photo_123...",
  type: "antes",
  uploaded: true/false,
  hasUploadUrl: true/false,
  uploadUrl: "https://..."
}
📸 Foto 2: ...
✅ Após filtro: Y de X foto(s) serão salvas no banco
```

**SE HOUVER DESCARTE:**
```
⚠️ ATENÇÃO: Z foto(s) foram DESCARTADAS (uploaded=false ou uploadUrl vazio)
```

## 🧪 Como Testar

### Passo 1: Abrir o Metro Console
1. No terminal onde o Expo está rodando, você verá todos os logs
2. Ou use React Native Debugger se estiver configurado

### Passo 2: Criar Nova Obra Offline
1. Desconecte a internet do celular/emulador
2. Crie uma nova obra com 3 fotos (antes, durante, depois)
3. Salve a obra

### Passo 3: Sincronizar
1. Reconecte a internet
2. Deixe a sincronização automática rodar OU force manualmente
3. **OBSERVE OS LOGS NO CONSOLE**

### Passo 4: Analisar os Logs

#### ✅ Cenário IDEAL (funcionando):
```
🚀 [syncObra] Iniciando upload de fotos para obra 123
📊 [syncObra] Upload concluído: 3 sucesso, 0 falhas
📥 [syncObra] Obtendo metadados das fotos uploadadas...
   - fotos_antes: 1 IDs
   - fotos_durante: 1 IDs
   - fotos_depois: 1 IDs

🔍 [convertPhotosToData] Recebeu 1 foto(s)
📸 Foto 1: { uploaded: true, hasUploadUrl: true, uploadUrl: "https://..." }
✅ Após filtro: 1 de 1 foto(s) serão salvas no banco

🔍 [convertPhotosToData] Recebeu 1 foto(s)
📸 Foto 1: { uploaded: true, hasUploadUrl: true, uploadUrl: "https://..." }
✅ Após filtro: 1 de 1 foto(s) serão salvas no banco

🔍 [convertPhotosToData] Recebeu 1 foto(s)
📸 Foto 1: { uploaded: true, hasUploadUrl: true, uploadUrl: "https://..." }
✅ Após filtro: 1 de 1 foto(s) serão salvas no banco
```

#### ❌ Cenário PROBLEMÁTICO (bug):
```
🚀 [syncObra] Iniciando upload de fotos para obra 123
📊 [syncObra] Upload concluído: 3 sucesso, 0 falhas  ← UPLOAD OK
📥 [syncObra] Obtendo metadados das fotos uploadadas...
   - fotos_antes: 1 IDs
   - fotos_durante: 1 IDs
   - fotos_depois: 1 IDs

🔍 [convertPhotosToData] Recebeu 1 foto(s)
📸 Foto 1: { uploaded: false, hasUploadUrl: false, uploadUrl: "NULL" }  ← PROBLEMA!
✅ Após filtro: 0 de 1 foto(s) serão salvas no banco  ← FOTOS DESCARTADAS!
⚠️ ATENÇÃO: 1 foto(s) foram DESCARTADAS (uploaded=false ou uploadUrl vazio)
```

## 🐛 Possíveis Causas do Bug

### Causa 1: Flag `uploaded` não está sendo atualizada
- O upload via `photo-queue.ts` sucede
- Mas a flag `uploaded` do metadata não é marcada como `true`
- **Onde corrigir:** `mobile/lib/photo-queue.ts` ou `mobile/lib/photo-backup.ts`

### Causa 2: `uploadUrl` não está sendo salva no metadata
- O upload sucede e gera uma URL
- Mas a URL não é salva no AsyncStorage
- **Onde corrigir:** `mobile/lib/photo-queue.ts` após o upload

### Causa 3: Timing - metadata lido antes do update
- Upload atualiza o metadata
- Mas `getPhotoMetadatasByIds` lê o metadata ANTIGO (antes do update)
- **Onde corrigir:** Adicionar delay ou forçar reload do AsyncStorage

## 🔧 Próximos Passos

1. **Execute o teste acima e copie TODOS os logs**
2. **Procure por linhas com `⚠️ ATENÇÃO`** - essas indicam fotos descartadas
3. **Verifique se `uploaded: false` ou `hasUploadUrl: false`**
4. **Com base nos logs, saberemos exatamente onde está o problema:**
   - Se `uploaded=false`: Bug em `photo-queue.ts` ao marcar foto como uploaded
   - Se `uploadUrl=NULL`: Bug em `photo-queue.ts` ao salvar a URL
   - Se ambos `true` mas ainda assim descartadas: Bug na lógica do filtro

## 📝 Template de Report de Bug

Quando for reportar o problema, inclua:

```
## Logs da Sincronização

[Cole aqui TODOS os logs desde "🚀 [syncObra]" até o final do sync]

## Comportamento Esperado
Fotos deveriam aparecer na tela de detalhes da obra após sync

## Comportamento Atual
Fotos não aparecem, mensagem "Faltam X fotos"

## Logs Importantes
[Destaque qualquer linha com ⚠️ ou que mostre uploaded=false]
```
