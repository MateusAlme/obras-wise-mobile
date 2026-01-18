# 📄 Modo Scanner para Documentos

## 📋 Visão Geral

Sistema de captura de fotos em **modo scanner** para documentação de materiais, com qualidade máxima e sem overlays de placa de obra.

## 🎯 Diferenças Entre Modos

### 📷 Modo Foto Normal
**Usado em:** Fotos Antes, Durante, Depois, Ditais, Transformador, etc.

- ✅ Qualidade: **40%** (processamento rápido)
- ✅ Placa de obra: **SIM** (dados queimados na foto)
- ✅ GPS/UTM: **SIM** (localização registrada)
- ✅ Edição: **NÃO** (captura direta)
- ✅ Aspecto: **4:3** (fixo)
- ✅ EXIF: **NÃO** (removido)

### 📄 Modo Scanner (Documentos)
**Usado em:** Cadastro de Medidor, Laudo de Transformador, Laudo de Regulador, Laudo de Religador, Materiais Previsto, Materiais Realizado

- ✅ Qualidade: **100%** (máxima qualidade - scanner)
- ❌ Placa de obra: **NÃO** (sem overlay)
- ❌ GPS/UTM: **NÃO** (não rastreia localização)
- ✅ Edição: **SIM** (crop/ajuste disponível)
- ✅ Aspecto: **Livre** (sem restrição)
- ✅ EXIF: **SIM** (metadados mantidos)

## 📱 Como Funciona

### Detecção Automática
O sistema detecta automaticamente quando a foto é de documento:

```typescript
const isDocument =
  tipo === 'doc_materiais_previsto' ||
  tipo === 'doc_materiais_realizado' ||
  tipo === 'doc_cadastro_medidor' ||
  tipo === 'doc_laudo_transformador' ||
  tipo === 'doc_laudo_regulador' ||
  tipo === 'doc_laudo_religador';
```

### Configuração de Câmera

#### Modo Scanner (Documentos)
```typescript
{
  mediaTypes: ['images'],
  quality: 1.0,              // 100% de qualidade
  allowsEditing: true,       // Permitir crop/ajuste
  aspect: undefined,         // Aspecto livre
  exif: true,               // Manter EXIF
}
```

#### Modo Normal (Fotos)
```typescript
{
  mediaTypes: ['images'],
  quality: 0.4,             // 40% de qualidade
  allowsEditing: false,     // Sem edição
  aspect: [4, 3],          // Aspecto fixo
  exif: false,             // Sem EXIF
}
```

## 🔄 Fluxo de Captura

### Documentos (Scanner Mode)
```
1. Usuário clica em "Adicionar Foto" em Materiais Previsto/Realizado
   ↓
2. Sistema detecta tipo de documento
   ↓
3. Abre câmera com qualidade 100%
   ↓
4. Usuário captura foto
   ↓
5. Sistema permite edição/crop
   ↓
6. Foto salva SEM placa, SEM GPS
   ↓
7. Backup com metadata básica
```

### Fotos Normais (Normal Mode)
```
1. Usuário clica em "Adicionar Foto" em seção normal
   ↓
2. Sistema detecta tipo de foto normal
   ↓
3. Abre câmera com qualidade 40%
   ↓
4. Usuário captura foto
   ↓
5. Sistema obtém GPS/UTM
   ↓
6. Sistema adiciona placa de obra
   ↓
7. Foto salva COM placa e GPS
   ↓
8. Backup com metadata completa
```

## 🎨 Experiência do Usuário

### Materiais Previsto/Realizado
```
┌─────────────────────────────────┐
│ 📄 Materiais Previsto          │
├─────────────────────────────────┤
│ [+ Adicionar Foto]              │
│                                 │
│ Clica no botão                  │
│   ↓                             │
│ Câmera abre (qualidade máxima)  │
│   ↓                             │
│ Captura documento               │
│   ↓                             │
│ Tela de edição (crop/ajuste)    │
│   ↓                             │
│ Confirma                        │
│   ↓                             │
│ ✅ Foto salva sem placa         │
│                                 │
│ [Miniatura da foto...]          │
└─────────────────────────────────┘
```

### Fotos Normais (ex: Antes)
```
┌─────────────────────────────────┐
│ 📷 Fotos Antes                  │
├─────────────────────────────────┤
│ [+ Adicionar Foto]              │
│                                 │
│ Clica no botão                  │
│   ↓                             │
│ Câmera abre (qualidade 40%)     │
│   ↓                             │
│ Captura foto                    │
│   ↓                             │
│ Sistema obtém GPS               │
│   ↓                             │
│ Sistema adiciona placa          │
│   ↓                             │
│ ✅ Foto salva com placa e GPS   │
│                                 │
│ [Miniatura com placa...]        │
└─────────────────────────────────┘
```

## 🔧 Implementação Técnica

### Arquivo Modificado
- `mobile/app/nova-obra.tsx` (função `takePicture()`)

### Código Principal (linhas 775-845)

```typescript
// 📄 Verificar se é foto de documento (scanner mode)
const isDocument = tipo === 'doc_materiais_previsto' || tipo === 'doc_materiais_realizado';

// Configurações de câmera baseadas no tipo
const cameraOptions = isDocument
  ? {
      // 📄 MODO SCANNER: Alta qualidade para documentos
      mediaTypes: ['images'],
      quality: 1.0,           // 100% de qualidade para documentos (scanner)
      allowsEditing: true,    // Permitir crop/ajuste para documentos
      aspect: undefined,      // Sem restrição de aspecto (livre)
      exif: true,            // Manter EXIF para documentos
    }
  : {
      // 📷 MODO FOTO NORMAL: Otimizado para rapidez
      mediaTypes: ['images'],
      quality: 0.4,          // 40% de qualidade (processamento rápido)
      allowsEditing: false,
      aspect: [4, 3],
      exif: false,
    };

const result = await ImagePicker.launchCameraAsync(cameraOptions);

// Obter GPS apenas para fotos normais (não para documentos)
const location = isDocument
  ? { latitude: null, longitude: null }
  : await getCurrentLocation();

// Para documentos, NÃO adicionar placa
if (isDocument) {
  console.log('📄 Modo Scanner: Sem placa, sem GPS, qualidade máxima (100%)');

  // Backup direto sem placa
  await backupPhoto(photoUri, {
    obra_id: obraId || 'temp',
    tipo_foto: tipo,
    latitude: null,
    longitude: null,
  });

  // Atualizar estado
  if (tipo === 'doc_materiais_previsto') {
    setDocMateriaisPrevisto([...docMateriaisPrevisto, photoUri]);
  } else if (tipo === 'doc_materiais_realizado') {
    setDocMateriaisRealizado([...docMateriaisRealizado, photoUri]);
  }
} else {
  // Para fotos normais: adicionar placa
  const placaData = {
    obra: nomeObra || 'Obra',
    servico: tipoServico || 'Serviço',
    equipe: nomeEquipe || 'Equipe',
    data: new Date().toLocaleString('pt-BR'),
    gps: location.latitude ? `${location.latitude.toFixed(6)}, ${location.longitude.toFixed(6)}` : 'N/A',
    utm: location.latitude ? convertToUTM(location.latitude, location.longitude) : 'N/A',
    endereco: enderecoFormatado || 'Buscando endereço...',
  };

  const photoWithPlaca = await renderPhotoWithPlacaBurnedIn(photoUri, placaData);

  // Backup com placa
  await backupPhoto(photoWithPlaca, {
    obra_id: obraId || 'temp',
    tipo_foto: tipo,
    latitude: location.latitude,
    longitude: location.longitude,
  });

  // Atualizar estado apropriado
  // ...
}
```

## 📊 Comparação de Qualidade

| Característica | Modo Normal | Modo Scanner |
|---|---|---|
| **Qualidade** | 40% | 100% |
| **Tamanho do arquivo** | ~200-500 KB | ~2-5 MB |
| **Velocidade** | Rápido | Mais lento |
| **Placa de obra** | Sim | Não |
| **GPS/UTM** | Sim | Não |
| **Edição** | Não | Sim (crop/ajuste) |
| **Uso ideal** | Fotos de campo | Documentos/PDFs |

## 🎯 Benefícios

1. **Alta Qualidade para Documentos**:
   - 100% de qualidade preserva texto e detalhes
   - Ideal para digitalização de documentos

2. **Sem Interferência Visual**:
   - Documentos não têm placa queimada
   - Foto "limpa" para visualização/impressão

3. **Edição Integrada**:
   - Crop/ajuste antes de salvar
   - Alinha bordas do documento

4. **Performance Otimizada**:
   - Fotos normais mantêm 40% para rapidez
   - Documentos usam 100% apenas quando necessário

5. **Detecção Automática**:
   - Zero configuração manual
   - Sistema escolhe modo correto automaticamente

## 📝 Tipos de Foto Suportados

### Modo Scanner (100% qualidade, sem placa)
- `doc_cadastro_medidor` - Cadastro de Medidor
- `doc_laudo_transformador` - Laudo de Transformador
- `doc_laudo_regulador` - Laudo de Regulador
- `doc_laudo_religador` - Laudo de Religador
- `doc_materiais_previsto` - Materiais Previsto
- `doc_materiais_realizado` - Materiais Realizado

### Modo Normal (40% qualidade, com placa)
- `fotos_antes` - Fotos Antes
- `fotos_durante` - Fotos Durante
- `fotos_depois` - Fotos Depois
- `fotos_abertura` - Abertura
- `fotos_fechamento` - Fechamento
- `fotos_ditais_desligar` - Desligar (Ditais)
- `fotos_ditais_impedir` - Impedir (Ditais)
- `fotos_ditais_testar` - Testar (Ditais)
- `fotos_ditais_aterrar` - Aterrar (Ditais)
- `fotos_ditais_sinalizar` - Sinalizar (Ditais)
- E todas as outras seções de fotos normais

## 🚀 Uso no App

### Interface de Documentação

Cada documento possui **duas opções lado a lado**:

```
┌────────────────────────────────────┐
│ 📋 Cadastro de Medidor          ✅ │
├────────────────────────────────────┤
│  [📷 Tirar Foto]  [📁 Selecionar PDF] │
└────────────────────────────────────┘
```

- **Botão Esquerdo (📷)**: Abre câmera em modo scanner (100% qualidade)
- **Botão Direito (📁)**: Seleciona arquivo PDF da galeria

### Para Usuário Final

1. **Capturar Documento com Foto**:
   - Navegue até tipo de serviço "Documentação"
   - Escolha uma seção (ex: "Cadastro de Medidor")
   - Clique em "📷 Tirar Foto" (botão esquerdo)
   - Aponte a câmera para o documento
   - Capture a foto
   - Ajuste/corte se necessário
   - Confirme

2. **Ou Selecionar PDF**:
   - Clique em "📁 Selecionar PDF" (botão direito)
   - Escolha arquivo da galeria
   - Confirme

3. **Resultado**:
   - Foto: Miniatura visual + "📷 Foto 1"
   - PDF: Ícone documento + "📄 Documento 1"
   - Ambos aparecem na mesma lista
   - Possível adicionar múltiplos (fotos e PDFs misturados)

### Para Fotos Normais

1. **Capturar Foto de Campo**:
   - Navegue até qualquer seção de fotos (Antes, Durante, etc.)
   - Clique em "+ Adicionar Foto"
   - Capture a foto
   - Foto salva automaticamente COM placa e GPS

## 🔍 Metadados Armazenados

### Documentos (Scanner Mode)
```json
{
  "obra_id": "uuid-da-obra",
  "tipo_foto": "doc_materiais_previsto",
  "latitude": null,
  "longitude": null,
  "timestamp": "2025-01-18T10:30:00",
  "quality": 1.0,
  "has_placa": false
}
```

### Fotos Normais
```json
{
  "obra_id": "uuid-da-obra",
  "tipo_foto": "fotos_antes",
  "latitude": -23.550520,
  "longitude": -46.633308,
  "utm": "23K 333533 7394491",
  "timestamp": "2025-01-18T10:30:00",
  "quality": 0.4,
  "has_placa": true,
  "placa_data": {
    "obra": "Nome da Obra",
    "servico": "Transformador",
    "equipe": "Equipe A",
    "endereco": "Rua Exemplo, 123"
  }
}
```

## 📸 Visualização de Documentos

### Miniatura de Foto (Scanner)
```
┌─────────────────────────────────┐
│ [🖼️]  📷 Foto 1              [×]│
└─────────────────────────────────┘
```
- Miniatura 50x50px da foto capturada
- Texto "📷 Foto X"
- Botão × para remover

### Miniatura de PDF
```
┌─────────────────────────────────┐
│ 📄 Documento 1                [×]│
└─────────────────────────────────┘
```
- Ícone de documento (sem miniatura visual)
- Texto "📄 Documento X"
- Botão × para remover

### Lista Mista
É possível ter fotos e PDFs na mesma seção:
```
┌─────────────────────────────────┐
│ [🖼️]  📷 Foto 1              [×]│
│ 📄 Documento 2                [×]│
│ [🖼️]  📷 Foto 3              [×]│
└─────────────────────────────────┘
```

## 📖 Documentação Relacionada

- [Placa Automática em Fotos](./PLACA_AUTOMATICA_FOTOS.md)
- [Sistema de Cache](./SISTEMA_CACHE_FOTOS_SINCRONIZACAO.md)
- [Materiais e Documentação](./MATERIAIS_DOCUMENTACAO.md)

## ✅ Resultado Final

O app agora possui **dois modos de captura**:

1. **Scanner Mode** (documentos): Qualidade máxima, sem placa, editável
2. **Normal Mode** (fotos): Otimizado para rapidez, com placa e GPS

A escolha entre modos é **100% automática** baseada no tipo de foto sendo capturada.
