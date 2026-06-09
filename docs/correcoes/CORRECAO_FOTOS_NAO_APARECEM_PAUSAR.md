# 🐛 Correção: Fotos não apareciam após pausar obra

## 📋 Problema

Quando o usuário:
1. Abria "Nova Obra"
2. Adicionava fotos
3. Clicava em "Pausar"
4. Abria a obra no histórico

**Resultado**: As fotos NÃO apareciam na tela de detalhes ❌

## 🔍 Causa Raiz

### Fluxo do Problema:

```typescript
// 1. Ao tirar foto em nova-obra.tsx (linha 701-708)
const photoMetadata = await backupPhoto(
  photoUri,
  backupObraId, // ⚠️ ID temporário: "temp_1234567890"
  tipo,
  index,
  location.latitude,
  location.longitude
);
```

```typescript
// 2. Ao clicar "Pausar" (linha 2615-2631)
const obraData: any = {
  id: `local_${Date.now()}_${Math.random().toString(36).substring(2, 11)}`, // ⚠️ NOVO ID diferente!
  obra: obra?.trim() || '',
  ...photoIds,
};

const obraId = await saveObraLocal(obraData);
// obraId = "local_1234567890_abc123def45"
```

**Problema**:
- Fotos salvas com `obraId = "temp_1234567890"`
- Obra salva com `id = "local_1234567890_abc123def45"`
- IDs DIFERENTES → fotos não encontradas! ❌

### Como funciona o carregamento de fotos:

```typescript
// obra-detalhe.tsx (linha 471-478)
const loadLocalPhotos = async (obraId: string) => {
  try {
    const photos = await getPhotosByObra(obraId); // Busca por obraId
    setLocalPhotos(photos);
  } catch (error) {
    console.error('Erro ao carregar fotos locais:', error);
  }
};
```

```typescript
// photo-backup.ts (linha 246-249)
export const getPhotosByObra = async (obraId: string): Promise<PhotoMetadata[]> => {
  const allMetadata = await getAllPhotoMetadata();
  return allMetadata.filter(m => m.obraId === obraId); // ⚠️ Filtra por obraId
};
```

**Se IDs não batem, `filter()` retorna array vazio → sem fotos!**

## ✅ Solução Implementada

### Arquivo: `mobile/app/nova-obra.tsx` (linhas 2635-2647)

```typescript
const obraId = await saveObraLocal(obraData);

console.log(`✅ Obra pausada com ID: ${obraId}`);

// ✅ CRÍTICO: Atualizar obraId das fotos no photo-backup
// As fotos foram salvas com backupObraId (tempObraId ou obraId antigo)
// Precisamos atualizar para o novo ID da obra salva
if (backupObraId !== obraId) {
  console.log(`🔄 Atualizando obraId das fotos de ${backupObraId} para ${obraId}`);
  try {
    const { updatePhotosObraId } = await import('../lib/photo-backup');
    const qtd = await updatePhotosObraId(backupObraId, obraId);
    console.log(`✅ ${qtd} foto(s) atualizadas com novo obraId`);
  } catch (error) {
    console.error('❌ Erro ao atualizar obraId das fotos:', error);
  }
}
```

### Como funciona `updatePhotosObraId`:

**Arquivo**: `mobile/lib/photo-backup.ts` (linhas 274-293)

```typescript
export const updatePhotosObraId = async (oldObraId: string, newObraId: string): Promise<number> => {
  try {
    const allMetadata = await getAllPhotoMetadata();
    let updatedCount = 0;

    const updatedMetadata = allMetadata.map(photo => {
      if (photo.obraId === oldObraId) {
        updatedCount++;
        return { ...photo, obraId: newObraId }; // ✅ Atualiza obraId
      }
      return photo;
    });

    await AsyncStorage.setItem(PHOTO_METADATA_KEY, JSON.stringify(updatedMetadata));
    return updatedCount; // Retorna quantas fotos foram atualizadas
  } catch (error) {
    console.error('Erro ao atualizar obraId das fotos:', error);
    throw error;
  }
};
```

## 🔄 Fluxo Corrigido

### Antes da Correção:

```
1. Tirar foto → Salva com obraId = "temp_1234567890"
2. Clicar "Pausar" → Obra salva com id = "local_1234567890_abc123"
3. Abrir detalhes → Busca fotos com id = "local_1234567890_abc123"
4. Resultado: 0 fotos encontradas ❌
```

### Após a Correção:

```
1. Tirar foto → Salva com obraId = "temp_1234567890"
2. Clicar "Pausar":
   - Obra salva com id = "local_1234567890_abc123"
   - ✅ Atualiza obraId das fotos: "temp_1234567890" → "local_1234567890_abc123"
3. Abrir detalhes → Busca fotos com id = "local_1234567890_abc123"
4. Resultado: Fotos encontradas! ✅
```

## 📊 Variáveis Envolvidas

### `tempObraId` (linha 208)
```typescript
const [tempObraId, setTempObraId] = useState<string>(`temp_${Date.now()}`);
```
- ID temporário gerado ao abrir "Nova Obra"
- Exemplo: `"temp_1704556800000"`
- Usado para salvar fotos ANTES da obra ser persistida

### `backupObraId` (linha 213)
```typescript
const backupObraId = isEditMode && obraId ? obraId : tempObraId;
```
- Se está editando: usa `obraId` da obra existente
- Se está criando: usa `tempObraId`
- É o ID passado para `backupPhoto()`

### `obraId` retornado por `saveObraLocal` (linha 2631)
```typescript
const obraId = await saveObraLocal(obraData);
```
- ID final da obra salva no AsyncStorage
- Exemplo: `"local_1704556800000_abc123def45"`
- Pode ser diferente de `backupObraId`!

## ✅ Teste de Validação

### Cenário de Teste:

1. **Abrir "Nova Obra"**
   ```
   tempObraId = "temp_1704556800000"
   backupObraId = "temp_1704556800000"
   ```

2. **Adicionar 1 foto**
   ```
   Foto salva em photo-backup com:
   {
     id: "photo_123",
     obraId: "temp_1704556800000", ← backupObraId
     type: "antes",
     ...
   }
   ```

3. **Clicar "Pausar"**
   ```typescript
   // Obra salva com novo ID
   obraId = "local_1704556800000_abc123def45"

   // ✅ Atualiza fotos
   updatePhotosObraId("temp_1704556800000", "local_1704556800000_abc123def45")
   // Retorna: 1 (1 foto atualizada)

   // Foto agora tem:
   {
     id: "photo_123",
     obraId: "local_1704556800000_abc123def45", ← ATUALIZADO!
     type: "antes",
     ...
   }
   ```

4. **Abrir obra no histórico**
   ```typescript
   // obra-detalhe.tsx
   loadLocalPhotos("local_1704556800000_abc123def45")

   // getPhotosByObra retorna:
   [
     {
       id: "photo_123",
       obraId: "local_1704556800000_abc123def45", ← BATE!
       type: "antes",
       uri: "file:///...",
       ...
     }
   ]

   // ✅ Foto aparece no preview!
   ```

## 🎯 Resultado

- ✅ Fotos aparecem após pausar obra
- ✅ Funciona para criar nova obra
- ✅ Funciona para editar obra existente (já usava obraId correto)
- ✅ Não afeta obras já finalizadas

## 📝 Logs para Debug

Ao clicar "Pausar", você verá no console:

```
✅ Obra pausada com ID: local_1704556800000_abc123def45
🔄 Atualizando obraId das fotos de temp_1704556800000 para local_1704556800000_abc123def45
✅ 1 foto(s) atualizadas com novo obraId
```

Ao abrir a obra no histórico:

```
📱 Carregando obra do AsyncStorage: local_1704556800000_abc123def45
🔍 Encontradas 1 foto(s) locais para a obra
✅ Fotos carregadas com sucesso
```

## 🚀 Status

✅ **Correção Implementada**
- Arquivo modificado: `mobile/app/nova-obra.tsx`
- Função utilizada: `updatePhotosObraId()` (já existia em `photo-backup.ts`)
- Pronto para teste

## ⚠️ Observação Importante

Esta correção é executada APENAS quando `backupObraId !== obraId`:

- **Criando nova obra**: `backupObraId = "temp_..."`, `obraId = "local_..."` → **Atualiza** ✅
- **Editando obra existente**: `backupObraId = "local_..."`, `obraId = "local_..."` (mesmo) → **Não atualiza** (não precisa)
