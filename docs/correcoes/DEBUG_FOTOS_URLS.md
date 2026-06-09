# Debug: Fotos Salvando Como IDs ao Invés de URLs

## Problema Identificado

As fotos estão sendo salvas no banco como IDs simples (`c80da8fa-c590-4a33-ab8d-b510507caa27`) ao invés de URLs completas (`https://...`).

## Debug Logs Adicionados

Foram adicionados 3 pontos de debug no fluxo de upload:

### 1. Upload para Supabase Storage (photo-queue.ts:191-194)
```
📸 UPLOAD SUCESSO:
  Photo ID: xxxxx
  File Path: user-id/filename.jpg
  Public URL: https://hiuagpzaelcocyxutgdt.supabase.co/storage/v1/object/public/obra-photos/...
```

### 2. Marcação como Uploaded (photo-backup.ts:178-186)
```
✅ MARCANDO COMO UPLOADED:
  Photo ID: xxxxx
  Upload URL: https://...
  Photo metadata: { id, type, uploaded: true, uploadUrl: "https://..." }
```

### 3. Preparação para Salvar no Banco (nova-obra.tsx:674-687)
```
🔍 DEBUG NOVA OBRA - Fotos a serem salvas:
  Total pending photos: X
  Fotos Antes (IDs): [...]
  Fotos Antes (uploaded): [{ url: "https://...", latitude, longitude }]
  PendingPhotos raw sample: [...]
```

## Como Testar

1. **Limpar dados antigos** (importante!):
   ```javascript
   // No app mobile, executar:
   import AsyncStorage from '@react-native-async-storage/async-storage';
   await AsyncStorage.clear();
   ```

2. **Criar nova obra de teste**:
   - Obra: `DEBUG-TEST-001`
   - Tirar 3 fotos (Antes, Durante, Depois)
   - Salvar a obra

3. **Verificar logs no console**:
   - Procurar pelos emojis: 📸, ✅, 🔍
   - Verificar se URLs estão completas em cada etapa
   - Identificar em qual etapa as URLs desaparecem

4. **Verificar no Supabase**:
   - Abrir Table Editor → obras
   - Encontrar obra `DEBUG-TEST-001`
   - Ver conteúdo da coluna `fotos_antes`

## Estrutura de Storage

### Estrutura Atual (Correta)
```
obra-photos/
└── {user_id}/
    ├── antes_1737XXX_abc123_0.jpg
    ├── durante_1737XXX_def456_0.jpg
    └── depois_1737XXX_ghi789_0.jpg
```

### Estrutura Antiga (Problema com "temp")
Se você vê pastas "temp" no storage, são de versões antigas do código.

**Solução**: No Supabase Dashboard → Storage → obra-photos:
- Deletar pastas antigas com "temp"
- Manter apenas pastas com UUID de usuários

## Possíveis Causas do Problema

### Hipótese 1: uploadUrl está undefined
```typescript
// Se p.uploadUrl for undefined, o map retorna:
{ url: undefined, latitude: ..., longitude: ... }
```

**Como identificar**: Ver log "🔍 DEBUG NOVA OBRA" - se `uploadUrl` estiver null/undefined

### Hipótese 2: Fotos não foram marcadas como uploaded
```typescript
// Se p.uploaded === false, foto não entra no map
pendingPhotos.filter(p => photoIds.antes.includes(p.id) && p.uploaded)
```

**Como identificar**: Ver log "✅ MARCANDO COMO UPLOADED" - se não aparecer, upload falhou

### Hipótese 3: IDs errados sendo salvos
Pode estar salvando `photoId` ao invés de `uploadUrl`.

**Como identificar**: Comparar "Photo ID" com valor salvo no banco

## Próximos Passos

1. ✅ Debug logs adicionados
2. ⏳ Testar criação de nova obra
3. ⏳ Analisar logs para identificar onde URLs desaparecem
4. ⏳ Corrigir código baseado nos logs
5. ⏳ Remover debug logs após correção

## Comandos Úteis

### Limpar AsyncStorage (React Native)
```typescript
import AsyncStorage from '@react-native-async-storage/async-storage';
await AsyncStorage.clear();
console.log('Storage limpo!');
```

### Ver todas as fotos pendentes
```typescript
import { getPendingPhotos } from './lib/photo-backup';
const pending = await getPendingPhotos();
console.log('Fotos pendentes:', JSON.stringify(pending, null, 2));
```

### Ver estrutura de uma obra
```sql
-- No Supabase SQL Editor:
SELECT
  obra,
  fotos_antes,
  fotos_durante,
  fotos_depois
FROM obras
WHERE obra LIKE 'DEBUG%'
ORDER BY created_at DESC
LIMIT 1;
```
