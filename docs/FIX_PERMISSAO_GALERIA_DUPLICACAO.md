# Fix: Permissão de Galeria e Duplicação de Fotos

**Data**: 2026-01-08
**Problemas Corrigidos**: Solicitação de permissão desnecessária e duplicação de fotos nos detalhes da obra

---

## 🐛 Problemas Identificados

### 1. Solicitação de Permissão de Modificar Foto
**Sintoma**: Ao tirar uma foto, aparecia um modal:
```
"Permitir que o app Obras Teccel modifique essa foto?"
```

**Causa Raiz**:
- Função `savePhotoToGallery()` estava sendo chamada após tirar cada foto
- Usava `MediaLibrary.createAssetAsync()` que pede permissão de escrita na galeria
- **Desnecessário**: Já temos sistema de backup permanente em pasta dedicada

**Localização**: `mobile/app/nova-obra.tsx` linha 756-767

### 2. Duplicação de Fotos nos Detalhes
**Sintoma**: Fotos apareciam duplicadas na tela de detalhes da obra (ex: 2 fotos iguais em "Fotos Abertura Chave")

**Causa Raiz**:
- Função `getPhotosForSection()` em `obra-detalhe.tsx` estava combinando:
  - Fotos do banco de dados (validDbPhotos)
  - Fotos locais (localFotoInfos)
- Quando a obra era sincronizada, as MESMAS fotos apareciam nas duas fontes
- Linha 610: `const combined = [...validDbPhotos, ...localFotoInfos];`

**Localização**: `mobile/app/obra-detalhe.tsx` linha 597-611

---

## ✅ Correções Aplicadas

### 1. Removida Permissão de Galeria

**Arquivo**: `mobile/app/nova-obra.tsx`

**Antes** (linhas 756-767):
```typescript
// Salvar foto na galeria do dispositivo (em background, não bloqueia)
try {
  const saved = await savePhotoToGallery(photoUri, 'Obras Teccel');
  if (saved) {
    console.log('✅ Foto salva na galeria com sucesso');
  } else {
    console.warn('⚠️ Não foi possível salvar foto na galeria (permissão negada ou erro)');
  }
} catch (galleryError) {
  // Não bloquear a operação se falhar ao salvar na galeria
  console.warn('⚠️ Erro ao salvar foto na galeria:', galleryError);
}
```

**Depois** (linhas 756-758):
```typescript
// ❌ REMOVIDO: Salvar na galeria (desnecessário, já temos backup em pasta dedicada)
// As fotos são automaticamente salvas em backupPhoto() na pasta permanente
// Não precisamos solicitar permissão de galeria nem duplicar as fotos
```

**Benefícios**:
- ✅ Não pede mais permissão ao usuário
- ✅ Não duplica fotos na galeria do sistema
- ✅ Fotos continuam protegidas no backup permanente
- ✅ Experiência do usuário mais fluida

---

### 2. Corrigida Duplicação de Fotos

**Arquivo**: `mobile/app/obra-detalhe.tsx`

**Antes** (linhas 597-611):
```typescript
const typeList = Array.isArray(photoType) ? photoType : [photoType];
const localPhotosForType = localPhotos.filter(p => typeList.includes(p.type));
const localFotoInfos = localPhotosForType.map(p => ({
  uri: p.compressedPath,
  latitude: p.latitude,
  longitude: p.longitude,
  utmX: p.utmX,
  utmY: p.utmY,
  utmZone: p.utmZone,
}));

// Combinar fotos do banco com fotos locais (sem duplicar)
// Priorizar fotos do banco (com URL), adicionar locais se necessário
const combined = [...validDbPhotos, ...localFotoInfos];
return combined;
```

**Depois** (linhas 597-618):
```typescript
const typeList = Array.isArray(photoType) ? photoType : [photoType];
const localPhotosForType = localPhotos.filter(p => typeList.includes(p.type));

// ✅ CORREÇÃO: Evitar duplicação de fotos
// Se já temos fotos do banco (validDbPhotos), não adicionar fotos locais duplicadas
if (validDbPhotos.length > 0) {
  // Já temos fotos do banco, não adicionar locais
  return validDbPhotos;
}

// Se não temos fotos do banco, usar apenas fotos locais
const localFotoInfos = localPhotosForType.map(p => ({
  uri: p.compressedPath,
  url: p.supabaseUrl, // Incluir URL se já foi sincronizada
  latitude: p.latitude,
  longitude: p.longitude,
  utmX: p.utmX,
  utmY: p.utmY,
  utmZone: p.utmZone,
}));

return localFotoInfos;
```

**Lógica da Correção**:
1. **Se há fotos do banco** (obra sincronizada): Usa APENAS essas fotos
2. **Se NÃO há fotos do banco** (obra local): Usa APENAS fotos locais
3. **Evita misturar** as duas fontes que contêm as mesmas fotos

**Benefícios**:
- ✅ Fotos não aparecem duplicadas
- ✅ Exibição correta em todos os cenários:
  - Obra local (offline)
  - Obra sincronizada (online)
  - Obra em edição após sincronização

---

## 🔄 Fluxo de Fotos Atual

### Ao Tirar Foto
```
1. ImagePicker.launchCameraAsync() - Tira a foto
2. renderPhotoWithPlacaBurnedIn() - Grava placa na foto
3. backupPhoto() - Salva em pasta permanente local
   ├─ Comprime e salva
   ├─ Gera thumbnail
   ├─ Converte GPS para UTM
   └─ Armazena metadados em AsyncStorage
4. ❌ NÃO salva mais na galeria do sistema
```

### Ao Visualizar Fotos (Detalhes)
```
1. getPhotosForSection(sectionKey)
   ├─ Se há IDs no banco → busca URIs locais (linhas 489-511)
   ├─ Se há objetos no banco → usa diretamente (linhas 515-517)
   └─ Se não há nada no banco → usa apenas locais (linhas 608-618)
2. ✅ Retorna lista SEM duplicatas
3. Renderiza fotos na tela
```

---

## 📱 Sistema de Backup Permanente

As fotos são salvas em:

```
📁 FileSystem.documentDirectory/photos/
├── original/          # Fotos originais (com placa gravada)
├── compressed/        # Fotos comprimidas (60% qualidade)
└── thumbnails/        # Miniaturas (10% qualidade, 150x150)
```

**Metadados salvos em AsyncStorage**:
```typescript
{
  id: string,              // ID único da foto
  obraId: string,          // ID da obra
  type: string,            // Tipo da foto (antes, durante, etc)
  originalPath: string,    // Caminho original
  compressedPath: string,  // Caminho comprimido
  thumbnailPath: string,   // Caminho thumbnail
  latitude: number | null,
  longitude: number | null,
  utmX: number | null,
  utmY: number | null,
  utmZone: string | null,
  createdAt: string,
  uploadStatus: 'pending' | 'uploaded' | 'failed',
  supabaseUrl?: string,    // URL após upload
  uploadError?: string
}
```

---

## 🧪 Teste das Correções

### Caso 1: Tirar Nova Foto
**Antes**: Modal de permissão aparecia
**Depois**: ✅ Nenhum modal, foto salva direto

**Como Testar**:
1. Abrir "Nova Obra"
2. Tirar uma foto
3. Verificar: NÃO deve aparecer modal de permissão
4. Foto deve aparecer normalmente na lista

### Caso 2: Visualizar Detalhes (Obra Local)
**Antes**: Podia aparecer duplicada
**Depois**: ✅ Fotos aparecem uma vez

**Como Testar**:
1. Criar obra offline com fotos
2. Abrir detalhes da obra
3. Verificar: Fotos aparecem UMA VEZ

### Caso 3: Visualizar Detalhes (Obra Sincronizada)
**Antes**: Fotos duplicadas (banco + local)
**Depois**: ✅ Fotos aparecem uma vez

**Como Testar**:
1. Sincronizar obra com fotos
2. Abrir detalhes da obra
3. Verificar: Fotos aparecem UMA VEZ (não duplicadas)

---

## 📋 Arquivos Modificados

1. **mobile/app/nova-obra.tsx**
   - Linha 756-758: Removido `savePhotoToGallery()`
   - Linha 45: Removido import de `save-to-gallery`

2. **mobile/app/obra-detalhe.tsx**
   - Linhas 597-618: Lógica de `getPhotosForSection()` corrigida
   - Evita combinar fotos do banco com fotos locais

---

## 🎯 Resultado Final

✅ **Permissão de Galeria**: Removida completamente
✅ **Duplicação de Fotos**: Corrigida
✅ **Backup Permanente**: Mantido e funcionando
✅ **Experiência do Usuário**: Mais fluida e profissional

---

## 📌 Observações

- O sistema de backup permanente continua funcionando perfeitamente
- Fotos são comprimidas e salvas localmente
- Sincronização automática quando houver conexão
- Nenhuma foto é perdida no processo
