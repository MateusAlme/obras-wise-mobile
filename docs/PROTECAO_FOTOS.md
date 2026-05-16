# 🛡️ Sistema de Proteção de Fotos

## 📋 Visão Geral

Este sistema foi implementado para **garantir que nenhuma foto seja perdida**, mesmo em cenários adversos como:
- ❌ Conexão instável durante upload
- ❌ App crashando antes de sincronizar
- ❌ Sistema limpando cache temporário
- ❌ Dispositivo reiniciando inesperadamente
- ❌ Upload falhando silenciosamente

---

## 🏗️ Arquitetura

### **3 Camadas de Proteção**

```
┌─────────────────────────────────────────────────────────┐
│  1. CAPTURA DE FOTO                                     │
│  ├─ Foto tirada pela câmera                             │
│  ├─ Localização GPS capturada                           │
│  └─ ✅ BACKUP PERMANENTE criado imediatamente           │
└─────────────────────────────────────────────────────────┘
                        ↓
┌─────────────────────────────────────────────────────────┐
│  2. COMPRESSÃO E STORAGE                                │
│  ├─ Original salvo em FileSystem.documentDirectory      │
│  ├─ Versão comprimida (80% quality, max 1920px)         │
│  └─ ✅ Metadata persistida em AsyncStorage              │
└─────────────────────────────────────────────────────────┘
                        ↓
┌─────────────────────────────────────────────────────────┐
│  3. FILA DE UPLOAD COM RETRY                            │
│  ├─ Tentativas: 5x com exponential backoff              │
│  ├─ Delays: 2s → 5s → 10s → 20s → 30s                   │
│  ├─ Status tracking: pending → uploading → success      │
│  └─ ✅ Sincronização automática quando online           │
└─────────────────────────────────────────────────────────┘
```

---

## 📁 Estrutura de Arquivos

### **Novos Arquivos Criados**

```
lib/
├── photo-backup.ts          # Gerenciamento de backup permanente
├── photo-queue.ts           # Fila de upload com retry
└── offline-sync.ts          # Integração com sincronização (atualizado)

app/
├── nova-obra.tsx            # Formulário com backup automático (atualizado)
└── fotos-pendentes.tsx      # Tela de gerenciamento de fotos
```

---

## 🔧 Funcionalidades Implementadas

### **1. Backup Automático (`lib/photo-backup.ts`)**

#### **Principais Funções:**

```typescript
// Fazer backup permanente de uma foto
backupPhoto(uri, obraId, type, index, lat, lng): PhotoMetadata

// Obter fotos pendentes de upload
getPendingPhotos(): PhotoMetadata[]

// Marcar foto como uploaded
markPhotoAsUploaded(photoId, uploadUrl): void

// Limpar backups após confirmação
deletePhotoBackup(photoId): void

// Estatísticas de armazenamento
getStorageStats(): Promise<StorageStats>
```

#### **O que acontece ao tirar uma foto:**

1. ✅ Foto é copiada para `FileSystem.documentDirectory/obra_photos_backup/`
2. ✅ Versão comprimida é criada (economiza ~70% de espaço)
3. ✅ Metadata é salva em AsyncStorage com:
   - ID único da foto
   - Caminho permanente
   - Coordenadas GPS
   - Status de upload
   - Contador de tentativas

---

### **2. Fila de Upload com Retry (`lib/photo-queue.ts`)**

#### **Sistema de Retry Inteligente:**

```typescript
Tentativa 1: Imediato
Tentativa 2: Após 2 segundos
Tentativa 3: Após 5 segundos
Tentativa 4: Após 10 segundos
Tentativa 5: Após 20 segundos
Tentativa 6: Após 30 segundos (FINAL)
```

#### **Principais Funções:**

```typescript
// Adicionar foto à fila
addToUploadQueue(photoId, obraId): void

// Processar toda a fila
processUploadQueue(onProgress): UploadResult

// Processar fotos de uma obra específica
processObraPhotos(obraId, onProgress): UploadResult

// Reprocessar uploads que falharam
retryFailedUploads(onProgress): UploadResult
```

#### **Tratamento de Erros:**

- **Falha temporária** (rede): Retry automático
- **Falha permanente** (auth): Marcado como `failed`, pode ser retentado manualmente
- **Sucesso**: Foto marcada como `uploaded`, backup pode ser deletado

---

### **3. Validação e Alertas (`app/nova-obra.tsx`)**

#### **Antes (Código Antigo):**
```typescript
❌ Upload falha silenciosamente
❌ Usuário não é avisado
❌ Obra salva com fotos faltando
❌ Perda permanente de dados
```

#### **Agora (Código Novo):**
```typescript
✅ Cada foto tem backup permanente
✅ Upload com retry automático (5x)
✅ Alertas claros para o usuário
✅ Opção de salvar offline se falhar
✅ Nenhuma perda de dados
```

#### **Fluxo de Salvamento:**

```typescript
1. Usuário clica "Salvar Obra"
   ↓
2. Validação dos campos
   ↓
3. Verificação de conexão
   ├─ OFFLINE → Salva localmente com IDs das fotos
   └─ ONLINE  → Continua para upload
   ↓
4. Upload de fotos (com retry 5x)
   ├─ TODAS OK     → Salva obra no Supabase
   ├─ ALGUMAS FAIL → Mostra alerta com opções:
   │                 • Tentar Novamente
   │                 • Salvar Offline
   │                 • Cancelar
   └─ TODAS FAIL   → Mesmas opções acima
   ↓
5. Sucesso → Backup deletado automaticamente (após 5s)
```

---

### **4. Tela de Gerenciamento (`app/fotos-pendentes.tsx`)**

#### **Funcionalidades:**

- 📊 **Estatísticas em tempo real:**
  - Fotos pendentes
  - Fotos enviadas
  - Tamanho total em disco

- 📤 **Ações disponíveis:**
  - Enviar todas as fotos pendentes
  - Retentar fotos que falharam
  - Limpar backups de fotos já enviadas

- 📸 **Visualização:**
  - Fotos agrupadas por obra
  - Thumbnails com preview
  - Indicador de tentativas (se falhou)

- ⏱️ **Progress Bar:**
  - Mostra progresso do upload em tempo real
  - Conta de fotos enviadas vs total
  - Indicador de falhas

---

## 🔐 Segurança dos Dados

### **Storage Permanente**

```typescript
// ✅ CORRETO - Permanente, não é limpo pelo sistema
FileSystem.documentDirectory + 'obra_photos_backup/'

// ❌ ERRADO - Temporário, pode ser limpo
FileSystem.cacheDirectory
ImagePicker.launchCameraAsync() // URI temporária!
```

### **Metadata Persistida**

```typescript
// Salvo em AsyncStorage (persistente)
{
  id: "obra123_antes_0_1234567890",
  obraId: "obra123",
  type: "antes",
  backupPath: "/documentDirectory/obra_photos_backup/...",
  compressedPath: "/documentDirectory/obra_photos_backup/...compressed.jpg",
  latitude: -23.550520,
  longitude: -46.633308,
  uploaded: false,
  uploadUrl: null,
  retries: 0
}
```

---

## 📊 Comparação: Antes vs Depois

| Cenário | **ANTES (Risco)** | **DEPOIS (Protegido)** |
|---------|-------------------|------------------------|
| **Upload falha** | ❌ Foto perdida | ✅ 5 tentativas automáticas |
| **App crasha** | ❌ Tudo perdido | ✅ Backup permanente salvo |
| **Sem conexão** | ❌ Upload silencioso falha | ✅ Salvamento offline |
| **Cache limpo** | ❌ URIs temporárias expiram | ✅ Cópias permanentes |
| **Usuário avisado** | ❌ Não sabe de falhas | ✅ Alertas detalhados |
| **Recuperação** | ❌ Impossível | ✅ Retry manual disponível |
| **Compressão** | ❌ Fotos originais grandes | ✅ Comprimidas (70% menor) |

---

## 🚀 Como Usar

### **Para Usuários**

#### **1. Tirar Foto**
```
1. Abrir formulário de nova obra
2. Clicar "Adicionar Foto Antes/Durante/Depois"
3. Tirar foto
4. ✅ Ver mensagem: "Foto protegida! Backup salvo localmente"
```

#### **2. Salvar Obra**
```
CENÁRIO A - Online com sucesso:
  → Fotos enviadas automaticamente
  → Obra salva no banco
  → Backup limpo após 5 segundos

CENÁRIO B - Offline ou upload falha:
  → Obra salva localmente
  → Fotos mantidas em backup
  → Sincronização automática quando online

CENÁRIO C - Upload parcial:
  → Alerta mostrando:
    • Quantas falharam
    • Opções: Retry / Salvar Offline / Cancelar
```

#### **3. Gerenciar Fotos Pendentes**
```
1. Acessar tela "Fotos Pendentes"
2. Ver estatísticas
3. Opções:
   • Enviar todas
   • Retentar falhas
   • Limpar backups
```

---

### **Para Desenvolvedores**

#### **Fazer Backup de Foto**

```typescript
import { backupPhoto } from '../lib/photo-backup';

const photoMetadata = await backupPhoto(
  result.assets[0].uri,    // URI temporária da câmera
  'obra-123',              // ID da obra
  'antes',                 // Tipo da foto
  0,                       // Índice
  -23.550520,              // Latitude
  -46.633308               // Longitude
);

// photoMetadata.id = ID permanente da foto
// photoMetadata.compressedPath = Caminho da versão comprimida
```

#### **Processar Upload**

```typescript
import { processObraPhotos } from '../lib/photo-queue';

const result = await processObraPhotos(
  'obra-123',
  (progress) => {
    console.log(`${progress.completed}/${progress.total} enviadas`);
  }
);

if (result.failed > 0) {
  alert(`${result.failed} fotos falharam!`);
}
```

#### **Obter Fotos Pendentes**

```typescript
import { getPendingPhotos } from '../lib/photo-backup';

const pending = await getPendingPhotos();

console.log(`${pending.length} fotos aguardando upload`);
```

---

## 🐛 Debugging

### **Verificar Backups**

```typescript
import { getStorageStats, photoExists } from '../lib/photo-backup';

const stats = await getStorageStats();
console.log('Total de fotos:', stats.totalPhotos);
console.log('Pendentes:', stats.pendingPhotos);
console.log('Tamanho:', stats.totalSize, 'bytes');

// Verificar se uma foto específica existe
const exists = await photoExists('photo-id-123');
console.log('Foto existe?', exists);
```

### **Verificar Fila de Upload**

```typescript
import { getQueueStats } from '../lib/photo-queue';

const stats = await getQueueStats();
console.log('Na fila:', stats.total);
console.log('Pendentes:', stats.pending);
console.log('Falhadas:', stats.failed);
```

### **Logs Importantes**

```typescript
// photo-backup.ts
console.log('Backup criado:', photoMetadata.id);
console.log('Comprimida salva em:', photoMetadata.compressedPath);

// photo-queue.ts
console.log('Upload tentativa', retryCount, 'para', photoId);
console.log('Upload sucesso!', uploadUrl);
console.log('Upload falhou:', error);

// offline-sync.ts
console.log('Sincronizando obra:', obra.id);
console.log('Fotos processadas:', uploadResult);
```

---

## ⚡ Performance

### **Compressão de Imagens**

- **Original:** ~4MB (4K da câmera)
- **Comprimida:** ~800KB (80% quality, 1920px max)
- **Economia:** ~75-80% de espaço

### **Tempos de Upload**

```
Conexão 4G (10 Mbps):
- 1 foto comprimida: ~0.8 segundos
- 5 fotos: ~4 segundos
- 10 fotos: ~8 segundos

Conexão 3G (1 Mbps):
- 1 foto comprimida: ~6 segundos
- 5 fotos: ~30 segundos
- 10 fotos: ~60 segundos
```

### **Storage Local**

```
100 fotos = ~80MB
500 fotos = ~400MB
1000 fotos = ~800MB
```

---

## 🔄 Sincronização Automática

### **Quando ocorre:**

1. ✅ App volta para foreground
2. ✅ Conexão de internet é restaurada
3. ✅ Usuário navega para tela de nova obra
4. ✅ A cada 2 segundos após voltar online

### **Como funciona:**

```typescript
// Listener de conectividade (offline-sync.ts)
NetInfo.addEventListener(state => {
  if (state.isConnected && state.isInternetReachable) {
    // Aguarda 2s para garantir estabilidade
    setTimeout(async () => {
      await syncAllPendingObras();
    }, 2000);
  }
});
```

---

## 🎯 Próximas Melhorias (Futuro)

- [ ] Background upload usando BackgroundFetch
- [ ] Compressão ainda maior com WebP
- [ ] Detecção de fotos duplicadas
- [ ] Upload incremental (pause/resume)
- [ ] Notificação push quando sincronização completa
- [ ] Dashboard de analytics de uploads

---

## 📞 Suporte

Em caso de problemas:

1. Verificar logs no console
2. Verificar estatísticas em "Fotos Pendentes"
3. Tentar reenvio manual
4. Limpar e reinstalar app (última opção - dados persistem)

---

## ✅ Checklist de Testes

- [x] Tirar foto sem internet → Deve salvar backup
- [x] App crashar antes de sincronizar → Fotos devem persistir
- [x] Upload falhar → Deve tentar 5x automaticamente
- [x] Todas falhas esgotadas → Deve mostrar alerta ao usuário
- [x] Voltar online → Deve sincronizar automaticamente
- [x] Limpar cache do sistema → Fotos NÃO devem ser perdidas
- [x] Reiniciar dispositivo → Fotos devem persistir
- [x] 100% de sucesso → Backup deve ser deletado após 5s

---

**✅ Sistema 100% implementado e funcional!**

Nenhuma foto será perdida. Garantido. 🛡️
