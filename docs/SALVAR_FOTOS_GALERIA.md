# 📱 Salvamento Automático de Fotos na Galeria

## ✨ Visão Geral

O app agora **salva automaticamente todas as fotos tiradas na galeria do dispositivo**, em um álbum dedicado chamado **"Obras Teccel"**.

### Características
- ✅ Salvamento automático após cada foto
- ✅ Fotos salvas **com a placa já gravada** (burned-in)
- ✅ Álbum dedicado "Obras Teccel" na galeria
- ✅ Funciona em modo offline
- ✅ Não bloqueia a operação se falhar (fail-safe)
- ✅ Permissões solicitadas automaticamente

---

## 🔧 Implementação Técnica

### 1. Biblioteca Utilizada
```bash
expo-media-library
```

### 2. Permissões Configuradas

#### iOS ([app.json](../mobile/app.json))
```json
"NSPhotoLibraryAddUsageDescription": "Este app precisa salvar fotos das obras na sua galeria."
```

#### Android ([app.json](../mobile/app.json))
```json
"android.permission.READ_MEDIA_IMAGES"
"android.permission.ACCESS_MEDIA_LOCATION"
```

### 3. Fluxo de Salvamento

1. **Usuário tira foto** → `takePicture()`
2. **Foto é capturada** → `ImagePicker.launchCameraAsync()`
3. **Placa é gravada** → `renderPhotoWithPlacaBurnedIn()`
4. **Foto é salva na galeria** → `savePhotoToGallery()` ✨ **NOVO**
5. **Backup local** → `backupPhoto()`
6. **Adiciona ao array** → `setFotosXXX()`

---

## 📁 Arquivos Modificados/Criados

### Criados
- [mobile/lib/save-to-gallery.ts](../mobile/lib/save-to-gallery.ts) - Funções utilitárias para salvar fotos

### Modificados
- [mobile/app.json](../mobile/app.json) - Adicionadas permissões e plugin expo-media-library
- [mobile/app/nova-obra.tsx](../mobile/app/nova-obra.tsx) - Integrado salvamento automático
- [mobile/package.json](../mobile/package.json) - Adicionada dependência expo-media-library

---

## 🎯 Como Funciona

### Salvamento Automático
```typescript
// Em nova-obra.tsx, após renderizar a placa
try {
  const saved = await savePhotoToGallery(photoUri, 'Obras Teccel');
  if (saved) {
    console.log('✅ Foto salva na galeria com sucesso');
  }
} catch (galleryError) {
  // Não bloqueia a operação
  console.warn('⚠️ Erro ao salvar foto na galeria:', galleryError);
}
```

### Funções Disponíveis

#### `savePhotoToGallery(photoUri, albumName?)`
Salva uma única foto na galeria.

```typescript
const success = await savePhotoToGallery(
  'file:///path/to/photo.jpg',
  'Obras Teccel' // opcional
);
```

#### `saveMultiplePhotosToGallery(photoUris, albumName?)`
Salva múltiplas fotos em batch.

```typescript
const savedCount = await saveMultiplePhotosToGallery(
  ['photo1.jpg', 'photo2.jpg'],
  'Obras Teccel'
);
console.log(`${savedCount} fotos salvas`);
```

#### `hasGalleryPermission()`
Verifica se o app tem permissão para salvar na galeria.

```typescript
const hasPermission = await hasGalleryPermission();
```

#### `requestGalleryPermission()`
Solicita permissão para salvar na galeria.

```typescript
const granted = await requestGalleryPermission();
```

---

## 📱 Comportamento no Dispositivo

### Android
- Fotos salvas em `Pictures/Obras Teccel/`
- Aparecem imediatamente na galeria
- Permissão solicitada na primeira vez

### iOS
- Fotos salvas em álbum "Obras Teccel"
- Aparecem imediatamente em Fotos
- Permissão solicitada na primeira vez

---

## 🛡️ Tratamento de Erros

### Fail-Safe
Se falhar ao salvar na galeria:
- ✅ A foto **continua sendo salva no app** (backup local)
- ✅ O usuário **não é bloqueado**
- ✅ Log de warning é registrado
- ❌ Sem alerts ou interrupções

### Logs
```javascript
// Sucesso
✅ Foto salva na galeria com sucesso

// Permissão negada
⚠️ Não foi possível salvar foto na galeria (permissão negada ou erro)

// Erro genérico
⚠️ Erro ao salvar foto na galeria: [detalhes]
```

---

## 🧪 Como Testar

### 1. Primeira Vez (Permissão)
1. Abrir app e ir em "Nova Obra"
2. Tirar uma foto
3. Sistema solicitará permissão para salvar na galeria
4. Conceder permissão
5. Verificar que a foto apareceu na galeria em "Obras Teccel"

### 2. Modo Offline
1. Ativar modo avião
2. Tirar uma foto
3. Verificar que a foto foi salva na galeria mesmo sem internet

### 3. Verificar Álbum
1. Abrir app de Galeria/Fotos do dispositivo
2. Procurar álbum "Obras Teccel"
3. Verificar que todas as fotos tiradas estão lá com placa gravada

---

## 🔍 Troubleshooting

### Fotos não aparecem na galeria

**Causa:** Permissão não concedida
**Solução:**
1. Ir em Configurações do dispositivo
2. Localizar app "Obras Teccel"
3. Conceder permissão "Fotos" ou "Armazenamento"
4. Tirar uma nova foto

### Erro "Call to function 'ExpoAsset.downloadAsync' has been rejected"

**Causa:** Assets não embutidos no build offline
**Solução:**
1. Verificar que `assetBundlePatterns: ["**/*"]` está em [app.json](../mobile/app.json)
2. Limpar cache:
   ```bash
   cd mobile
   rm -rf .expo node_modules/.cache
   npm start -- --clear
   ```
3. Fazer novo build:
   ```bash
   npx eas build --platform android --profile preview
   ```

---

## 🚀 Próximos Passos (Opcional)

### Configurações de Usuário
Permitir que o usuário escolha se quer salvar na galeria automaticamente:
```typescript
// Em settings ou preferences
const [autoSaveToGallery, setAutoSaveToGallery] = useState(true);

if (autoSaveToGallery) {
  await savePhotoToGallery(photoUri);
}
```

### Notificação de Sucesso
Mostrar toast quando foto for salva:
```typescript
if (saved) {
  Toast.show('Foto salva na galeria!', { duration: Toast.durations.SHORT });
}
```

---

## 📝 Notas Técnicas

### Assets Embutidos no Build
Para evitar erro de `downloadAsync` offline, todos os assets são agora embutidos no build:

```json
// app.json
"assetBundlePatterns": [
  "**/*"
]
```

Isso garante que fontes, ícones e outros assets estejam disponíveis offline.

### Performance
- Salvamento é **assíncrono** (não bloqueia UI)
- Foto é salva **após renderizar a placa** (usuário vê versão final)
- Backup local é feito **em paralelo** (não há delay adicional)

---

## ✅ Checklist de Deploy

Antes de fazer deploy para produção:

- [x] Permissões configuradas em [app.json](../mobile/app.json)
- [x] Plugin expo-media-library adicionado
- [x] Função `savePhotoToGallery` implementada
- [x] Integração em `takePicture()` feita
- [x] Tratamento de erros fail-safe implementado
- [x] Assets embutidos com `assetBundlePatterns`
- [ ] Testado em Android físico
- [ ] Testado em iOS físico
- [ ] Testado em modo offline
- [ ] Verificado álbum "Obras Teccel" criado
- [ ] Build de produção gerado e testado

---

**Documentação criada em:** 2025-01-05
**Última atualização:** 2025-01-05
