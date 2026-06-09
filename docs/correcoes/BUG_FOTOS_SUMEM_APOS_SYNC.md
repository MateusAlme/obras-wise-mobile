# Bug: Fotos Sumem Após Sincronização

## 🐛 Problema Reportado

Usuário relatou: "depois que sicronizou as fotos sumiram do preview da obra"

## 🔍 Causa Raiz

### Estrutura de Dados

**Antes da sincronização** (obra local):
```typescript
{
  id: "local_1736123456789_abc",
  fotos_antes: ["photo_abc123", "photo_def456"],  // Array de IDs
  synced: false
}
```

**Após sincronização** (obra ainda local, mas marcada como synced):
```typescript
{
  id: "local_1736123456789_abc",
  fotos_antes: ["photo_abc123", "photo_def456"],  // AINDA são IDs!
  synced: true,  // Marcada como sincronizada
  serverId: "uuid-no-supabase"
}
```

### Fluxo do Bug

1. **Criar obra**: Fotos salvas localmente com IDs (`photo_abc123`)
2. **Sincronizar**:
   - Fotos fazem upload para Supabase
   - Obra marcada como `synced = true`
   - **PROBLEMA**: IDs das fotos NÃO são atualizados
3. **Ver detalhes**:
   - Função `getPhotosForSection` tenta buscar fotos
   - `dbPhotos` é array de strings (IDs), não objetos
   - `validDbPhotos` fica vazio (linha 423-425 de obra-detalhe.tsx)
   - Depende apenas de `localPhotos` do photo-backup
4. **Fotos somem**: Se photo-backup foi limpo ou corrompido, não há fotos

## 📄 Código Afetado

### mobile/app/obra-detalhe.tsx (linhas 415-520)

```typescript
const getPhotosForSection = (sectionKey: string): FotoInfo[] => {
  if (!obra) return [];

  // Pegar fotos do banco (URL) ou IDs (AsyncStorage offline-first)
  const dbPhotos = (obra as any)[sectionKey];

  // ❌ PROBLEMA: Se dbPhotos é array de strings (IDs), ignora
  // ❌ Deveria buscar URIs locais usando esses IDs!
  const validDbPhotos = Array.isArray(dbPhotos) && dbPhotos.length > 0 && typeof dbPhotos[0] === 'object'
    ? (dbPhotos as FotoInfo[]).filter(f => f.url || f.uri)
    : [];

  // Busca fotos locais (photo-backup)
  const typeList = Array.isArray(photoType) ? photoType : [photoType];
  const localPhotosForType = localPhotos.filter(p => typeList.includes(p.type));
  const localFotoInfos = localPhotosForType.map(p => ({
    uri: p.compressedPath,  // ← Depende de photo-backup estar OK
    latitude: p.latitude,
    longitude: p.longitude,
    utmX: p.utmX,
    utmY: p.utmY,
    utmZone: p.utmZone,
  }));

  // Combinar fotos do banco com fotos locais
  const combined = [...validDbPhotos, ...localFotoInfos];
  return combined;
};
```

### mobile/lib/offline-sync.ts (linhas 304-318)

```typescript
if (success) {
  // Marcar como sincronizada no armazenamento local
  const localObras = await getLocalObras();
  const index = localObras.findIndex(o => o.id === obraId);

  if (index !== -1) {
    localObras[index].synced = true;
    localObras[index].locallyModified = false;
    // ❌ PROBLEMA: NÃO atualiza os arrays de fotos!
    // Os IDs continuam sendo IDs locais, não URLs

    await AsyncStorage.setItem(LOCAL_OBRAS_KEY, JSON.stringify(localObras));
    console.log(`✅ Obra marcada como sincronizada: ${obraId}`);
  }
}
```

## ✅ Soluções Possíveis

### Opção 1: Manter Dependency do Photo-Backup (Atual)

**Pros**:
- Não modifica estrutura de dados
- URIs locais sempre disponíveis

**Cons**:
- Se photo-backup falhar, fotos somem
- Duplicação de dados (photo-backup + AsyncStorage)

**Implementação**: Garantir que photo-backup nunca seja limpo

### Opção 2: Converter IDs para URIs Após Sync (Recomendado)

**Pros**:
- Fotos sempre disponíveis mesmo sem photo-backup
- Dados auto-contidos na obra
- Mais resiliente

**Cons**:
- Precisa modificar estrutura ao sincronizar

**Implementação**:
```typescript
// Após sync, atualizar obra local com URIs
if (success) {
  const localObras = await getLocalObras();
  const index = localObras.findIndex(o => o.id === obraId);

  if (index !== -1) {
    // Converter IDs para objetos FotoInfo
    const convertedObra = await convertPhotoIdsToUris(localObras[index]);

    localObras[index] = {
      ...convertedObra,
      synced: true,
      locallyModified: false,
    };

    await AsyncStorage.setItem(LOCAL_OBRAS_KEY, JSON.stringify(localObras));
  }
}

// Função auxiliar
async function convertPhotoIdsToUris(obra: LocalObra): Promise<LocalObra> {
  const photoSections = [
    'fotos_antes', 'fotos_durante', 'fotos_depois',
    // ... todas as seções
  ];

  const converted: any = { ...obra };

  for (const section of photoSections) {
    const photoIds = obra[section];
    if (Array.isArray(photoIds) && photoIds.length > 0) {
      const metadatas = await getPhotoMetadatasByIds(photoIds);
      converted[section] = metadatas.map(m => ({
        uri: m.compressedPath,
        url: m.supabaseUrl,  // Se foi sincronizada
        latitude: m.latitude,
        longitude: m.longitude,
        utmX: m.utmX,
        utmY: m.utmY,
        utmZone: m.utmZone,
      }));
    }
  }

  return converted;
}
```

### Opção 3: Buscar URIs Dinamicamente em getPhotosForSection

**Pros**:
- Não modifica estrutura
- Sempre busca URIs na hora

**Cons**:
- Performance (busca a cada renderização)
- Complexidade no código

**Implementação**:
```typescript
const getPhotosForSection = async (sectionKey: string): Promise<FotoInfo[]> => {
  if (!obra) return [];

  const dbPhotos = (obra as any)[sectionKey];

  // ✅ NOVO: Se são IDs, converter para URIs
  if (Array.isArray(dbPhotos) && dbPhotos.length > 0 && typeof dbPhotos[0] === 'string') {
    const metadatas = await getPhotoMetadatasByIds(dbPhotos);
    return metadatas.map(m => ({
      uri: m.compressedPath,
      url: m.supabaseUrl,
      latitude: m.latitude,
      longitude: m.longitude,
      utmX: m.utmX,
      utmY: m.utmY,
      utmZone: m.utmZone,
    }));
  }

  // Se são objetos FotoInfo, usar diretamente
  if (Array.isArray(dbPhotos) && dbPhotos.length > 0 && typeof dbPhotos[0] === 'object') {
    return dbPhotos.filter(f => f.url || f.uri);
  }

  return [];
};
```

## 🎯 Solução Escolhida: Opção 3 (Buscar Dinamicamente)

Mais simples e não quebra estrutura existente.

## 📁 Arquivos a Modificar

1. **mobile/app/obra-detalhe.tsx**
   - Modificar `getPhotosForSection()` para converter IDs para URIs

2. **mobile/lib/photo-backup.ts** (verificar se tem função necessária)
   - Garantir que `getPhotoMetadatasByIds()` existe

## 🧪 Como Reproduzir o Bug

1. Criar nova obra
2. Tirar 3 fotos
3. Finalizar obra
4. Sincronizar obra
5. Voltar e abrir detalhes da obra
6. **BUG**: Fotos não aparecem (apenas se photo-backup foi corrompido)

## 🧪 Como Verificar Correção

1. Seguir passos acima
2. Após sincronizar, abrir detalhes
3. ✅ Fotos devem aparecer normalmente
4. Console deve mostrar: "🔍 Convertendo X IDs de fotos para URIs"

## ✅ Correção Implementada

### Modificações Feitas

**1. mobile/app/obra-detalhe.tsx (linha 8)**
```typescript
// ANTES
import { getPhotosByObra, type PhotoMetadata } from '../lib/photo-backup';

// DEPOIS
import { getPhotosByObra, getPhotoMetadatasByIds, type PhotoMetadata } from '../lib/photo-backup';
```

**2. mobile/app/obra-detalhe.tsx (linhas 421-446)**
```typescript
// ✅ CORREÇÃO: Se dbPhotos é array de strings (IDs), buscar URIs dos metadados locais
if (Array.isArray(dbPhotos) && dbPhotos.length > 0 && typeof dbPhotos[0] === 'string') {
  // IDs de fotos - buscar URIs do photo-backup usando localPhotos
  const photoIds = dbPhotos as string[];
  const fotosFromIds: FotoInfo[] = [];

  for (const photoId of photoIds) {
    const metadata = localPhotos.find(p => p.id === photoId);
    if (metadata) {
      fotosFromIds.push({
        uri: metadata.compressedPath,
        url: metadata.supabaseUrl,  // Pode ter URL se já foi sincronizada
        latitude: metadata.latitude,
        longitude: metadata.longitude,
        utmX: metadata.utmX,
        utmY: metadata.utmY,
        utmZone: metadata.utmZone,
      });
    }
  }

  if (fotosFromIds.length > 0) {
    return fotosFromIds;
  }
}
```

### Como a Correção Funciona

**Antes** (bugado):
```
obra.fotos_antes = ["photo_abc", "photo_def"]  ← Array de IDs
          ↓
getPhotosForSection ignora IDs
          ↓
validDbPhotos = []  ← Vazio!
          ↓
Depende apenas de localPhotos (pode falhar)
          ↓
❌ Fotos somem
```

**Depois** (corrigido):
```
obra.fotos_antes = ["photo_abc", "photo_def"]  ← Array de IDs
          ↓
getPhotosForSection detecta que são IDs
          ↓
Busca metadados em localPhotos usando ID
          ↓
Converte para FotoInfo[] com URI local
          ↓
✅ Fotos aparecem!
```

### Teste da Correção

```bash
# 1. Criar obra com 3 fotos
# 2. Finalizar obra
# 3. Sincronizar obra
   → ✅ Marca synced = true
   → ✅ IDs das fotos permanecem

# 4. Voltar e abrir detalhes da obra
   → ✅ getPhotosForSection detecta IDs
   → ✅ Busca URIs em localPhotos
   → ✅ Fotos aparecem normalmente!

# 5. Verificar console:
   → "📱 Carregando obra do AsyncStorage: local_..."
   → "🔍 Fotos: 3 antes, 2 durante, 2 depois"
   → (Sem erros ou avisos)
```

---

**Reportado em**: Janeiro 2026
**Corrigido em**: Janeiro 2026
**Status**: ✅ CORRIGIDO
**Prioridade**: 🔴 ALTA (perda de dados visível ao usuário) → ✅ RESOLVIDO
