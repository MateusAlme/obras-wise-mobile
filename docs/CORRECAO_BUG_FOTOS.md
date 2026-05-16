# Correção do Bug: Fotos Desaparecem Após Sincronização

## 🐛 Resumo do Bug

**Sintoma:** Fotos tiradas offline não aparecem após sincronizar a obra para online. A mensagem "Faltam X foto(s)" aparece mesmo com todas as fotos tiradas.

**Causa Raiz:** Função `getPhotoMetadatasByIds` em [mobile/lib/offline-sync.ts](../mobile/lib/offline-sync.ts) buscava apenas fotos **pendentes** (`uploaded=false`) ao invés de buscar **todas** as fotos.

## 🔍 Análise Técnica

### Fluxo do Bug:

1. **Upload bem-sucedido:**
   - Fotos são uploadadas via `photo-queue.ts`
   - `markPhotoAsUploaded(photoId, url)` é chamado
   - Metadata atualizado: `uploaded=true`, `uploadUrl="https://..."`

2. **Busca de metadados (BUG AQUI):**
   ```typescript
   // offline-sync.ts linha 377 (ANTES DA CORREÇÃO)
   const getPhotoMetadatasByIds = async (photoIds: string[]): Promise<PhotoMetadata[]> => {
     const allPending = await getPendingPhotos();  // ❌ PROBLEMA!
     return allPending.filter(p => photoIds.includes(p.id));
   };
   ```

   A função `getPendingPhotos()` em `photo-backup.ts:230-233` filtra apenas fotos não-uploadadas:
   ```typescript
   export const getPendingPhotos = async (): Promise<PhotoMetadata[]> => {
     const allMetadata = await getAllPhotoMetadata();
     return allMetadata.filter(m => !m.uploaded);  // ❌ Retorna apenas uploaded=false
   };
   ```

3. **Resultado:**
   - Como as fotos JÁ foram marcadas como `uploaded=true` (passo 1)
   - `getPendingPhotos()` NÃO as retorna (passo 2)
   - `getPhotoMetadatasByIds` retorna array vazio `[]`
   - `convertPhotosToData` recebe `[]`
   - Banco de dados é salvo **SEM FOTOS**

## ✅ Solução Implementada

### Alterações em `mobile/lib/offline-sync.ts`:

1. **Linha 5** - Adicionar import de `getAllPhotoMetadata`:
   ```typescript
   import {
     backupPhoto,
     PhotoMetadata,
     getPendingPhotos,
     updatePhotosObraId,
     getAllPhotoMetadata  // ✅ NOVO
   } from './photo-backup';
   ```

2. **Linhas 377-380** - Corrigir `getPhotoMetadatasByIds`:
   ```typescript
   const getPhotoMetadatasByIds = async (photoIds: string[]): Promise<PhotoMetadata[]> => {
     const allMetadata = await getAllPhotoMetadata();  // ✅ Busca TODAS as fotos
     return allMetadata.filter(p => photoIds.includes(p.id));
   };
   ```

### Por que funciona agora:

- `getAllPhotoMetadata()` retorna **TODAS** as fotos do AsyncStorage
- Não importa se `uploaded=true` ou `uploaded=false`
- Fotos uploadadas são encontradas corretamente
- `convertPhotosToData` recebe os metadados com `uploadUrl` preenchida
- Banco é salvo **COM TODAS AS FOTOS**

## 🧪 Como Testar

1. Criar uma obra offline com 3 fotos (antes, durante, depois)
2. Salvar a obra
3. Conectar à internet e aguardar sincronização
4. Abrir a obra sincronizada
5. **Resultado esperado:** Todas as 3 fotos devem aparecer na tela de detalhes

## 📊 Logs de Debug Adicionados

Para facilitar futuras investigações, foram adicionados logs detalhados em:

- **`convertPhotosToData`** (linhas 386-413):
  - Mostra quantas fotos foram recebidas
  - Lista cada foto com `uploaded`, `hasUploadUrl`, e `uploadUrl`
  - Alerta se alguma foto for descartada

- **`syncObra`** (linhas 451-470):
  - Log de início e fim do upload
  - Contagem de sucessos e falhas
  - Número de IDs de foto para cada categoria

## 📝 Arquivos Modificados

- ✅ `mobile/lib/offline-sync.ts` - Correção principal
- ✅ `docs/COMO_DEBUGAR_FOTOS_SYNC.md` - Documentação atualizada
- ✅ `docs/CORRECAO_BUG_FOTOS.md` - Este documento

## 🔗 Referências

- Issue original: "ainda permanece o erro de quando sicronizada do off para o on as fotos não aparecer"
- Commit: [A ser preenchido após commit]
- Pull Request: [A ser preenchido se houver]
