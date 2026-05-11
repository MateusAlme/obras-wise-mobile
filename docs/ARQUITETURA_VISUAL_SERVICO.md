# 🗺️ Arquitetura Visual: Fluxo de Dados do Novo Serviço

Este documento mostra visualmente como os dados fluem desde a criação até o Supabase.

---

## 📊 Diagrama Geral do Fluxo

```
┌─────────────────────────────────────────────────────────────────────┐
│                        🎬 USER ACTIONS                              │
│                    (Interações na Tela)                             │
└─────────────────────────────────────────────────────────────────────┘
                              │
                ┌─────────────┼─────────────┐
                │             │             │
                ▼             ▼             ▼
        ┌──────────────┐ ┌──────────┐ ┌─────────────┐
        │ Criar Novo   │ │Tirar     │ │ Marcar      │
        │ Serviço      │ │ Foto     │ │ Completo    │
        └──────────────┘ └──────────┘ └─────────────┘
                │             │             │
                └─────────────┼─────────────┘
                              │
                ▼──────────────────────────────▼
        ┌──────────────────────────────────────┐
        │   📱 MOBILE APP LAYER                │
        │  (servico-detalhe.tsx)               │
        │  ├─ createTesteServico()             │
        │  ├─ appendPhotoToServicoLocal()      │
        │  └─ markServicoComplete()            │
        └──────────────────────────────────────┘
                              │
                              ▼
        ┌──────────────────────────────────────┐
        │   🔧 SERVICE LAYER                   │
        │  (servico-sync.ts)                   │
        │  ├─ Valida dados                     │
        │  ├─ Gera IDs                         │
        │  └─ Gerencia estado                  │
        └──────────────────────────────────────┘
                              │
                    ┌─────────┼─────────┐
                    │         │         │
                    ▼         ▼         ▼
        ┌──────────────┐ ┌──────────┐ ┌───────────┐
        │  AsyncStorage│ │Photo     │ │ Sentry    │
        │  @servicos_  │ │Backup    │ │ (logs)    │
        │  pending_sync│ │@photo_*  │ │           │
        └──────────────┘ └──────────┘ └───────────┘
        (LOCAL/OFFLINE)    (LOCAL)      (REMOTE)
                    │         │         │
                    └─────────┼─────────┘
                              │
                    ┌─────────▼─────────┐
                    │  NET AVAILABLE?   │
                    └─────────┬─────────┘
                         │    │
                      YES│    │NO
                         │    │
                    ┌────▼─┐  └──► WAIT FOR
                    │SYNC! │       CONNECTION
                    └────┬─┘
                         │
                         ▼
        ┌──────────────────────────────────────┐
        │   🌐 SUPABASE CLOUD                  │
        │  (Backend - Database)                │
        │  ├─ servicos table                   │
        │  │  ├─ id (UUID)                     │
        │  │  ├─ tipo_servico: 'Teste'         │
        │  │  ├─ status, sync_status           │
        │  │  ├─ fotos_teste_observacao[] ────┐│
        │  │  ├─ fotos_teste_comprovacao[]  ──┼┼──┐
        │  │  └─ created_at, updated_at        ││  │
        │  └─ servicos_fotos table             ││  │
        │     ├─ id, servico_id                ││  │
        │     ├─ photo_id, url                 ││  │
        │     └─ metadata                      ││  │
        └──────────────────────────────────────┘│  │
                         │                       │  │
                    ┌────▼───────────────────────┘  │
                    │                               │
                    ▼                               ▼
        ┌──────────────────────────────┐ ┌────────────────────┐
        │  Supabase Storage            │ │ Supabase Storage   │
        │  /obras/{obraId}/            │ │ Buckets            │
        │  ├─ {photoId1}.jpg           │ │                    │
        │  ├─ {photoId2}.jpg           │ │ Armazena as fotos  │
        │  └─ ...                      │ │ com URLs:          │
        │                              │ │ https://...        │
        └──────────────────────────────┘ │ .supabase.co...    │
                                         └────────────────────┘
```

---

## 🔄 Fluxo Detalhado por Ação

### 1️⃣ CRIAR NOVO SERVIÇO TESTE

```
USER TAPS "Novo Serviço Teste"
        │
        ▼
handleCreateTesteServico()
        │
        ├─ createTesteServico(obraId)
        │  │
        │  ├─ Gera ID temp: "temp_teste_1704067200000_abc123"
        │  │
        │  ├─ Cria objeto ServicoLocal:
        │  │  {
        │  │    id: "temp_teste_...",
        │  │    obra_id: "uuid-obra",
        │  │    tipo_servico: "Teste",
        │  │    status: "rascunho",
        │  │    sync_status: "offline",
        │  │    fotos_teste_observacao: [],
        │  │    fotos_teste_comprovacao: [],
        │  │    created_at: "2024-...",
        │  │    updated_at: "2024-..."
        │  │  }
        │  │
        │  ├─ AsyncStorage.getItem("@servicos_pending_sync")
        │  │  → Lê array de serviços pendentes
        │  │
        │  ├─ Adiciona novo serviço ao array
        │  │
        │  └─ AsyncStorage.setItem("@servicos_pending_sync", [..., novo])
        │     → Persiste localmente
        │
        └─ UI atualiza e exibe novo serviço
```

---

### 2️⃣ TIRAR E ADICIONAR FOTO

```
USER TAPS "📷 Adicionar Foto - Observação"
        │
        ▼
handleAddPhoto('fotos_teste_observacao')
        │
        ├─ ImagePicker.launchCameraAsync()
        │  → Abre câmera
        │
        ├─ Captura URI local: "file:///data/photo123.jpg"
        │
        ├─ backupPhoto({
        │    uri: "file:///...",
        │    latitude: -22.xxx,
        │    longitude: -51.xxx,
        │    timestamp: 1704067200000,
        │    takenAt: "2024-01-01..."
        │  })
        │  │
        │  ├─ Gera photoId: "photo_1704067200000_xyz789"
        │  │
        │  ├─ AsyncStorage.setItem(
        │  │    "@photo_1704067200000_xyz789",
        │  │    { uri, lat, lon, timestamp, ... }
        │  │  )
        │  │  → Armazena metadados
        │  │
        │  └─ Retorna: "photo_1704067200000_xyz789"
        │
        ├─ appendPhotoToServicoLocal(
        │    servico,
        │    'fotos_teste_observacao',
        │    'photo_1704067200000_xyz789'
        │  )
        │  │
        │  ├─ servico.fotos_teste_observacao.push('photo_...')
        │  │  → Adiciona photoId ao array
        │  │
        │  ├─ servico.updated_at = now
        │  │
        │  ├─ servico.sync_status = 'offline'
        │  │
        │  └─ saveServicoLocal(servico)
        │     → Persiste em AsyncStorage
        │
        └─ UI atualiza: exibe foto nova no grid
```

---

### 3️⃣ SINCRONIZAR COM SUPABASE

```
QUANDO: Conexão restaurada OU User clica "🔄 Sincronizar"
        │
        ▼
syncAllPendingServicos()
        │
        ├─ NetInfo.fetch() → Valida internet
        │
        ├─ AsyncStorage.getItem("@servicos_pending_sync")
        │  → Lê: [serviço Teste, ...]
        │
        ├─ PARA CADA SERVIÇO:
        │  │
        │  ├─ resolveLocalPhotosToUrls(servico)
        │  │  │
        │  │  ├─ Para cada photoId em fotos_teste_observacao[]:
        │  │  │  │
        │  │  │  ├─ AsyncStorage.getItem("@photo_1704067200000_xyz789")
        │  │  │  │  → Lê metadados locais
        │  │  │  │
        │  │  │  ├─ SE arquivo local existe:
        │  │  │  │  │
        │  │  │  │  ├─ FileSystem.readAsStringAsync(uri)
        │  │  │  │  │  → Lê arquivo como base64
        │  │  │  │  │
        │  │  │  │  ├─ supabase.storage
        │  │  │  │  │  .from('obras')
        │  │  │  │  │  .upload(`{obraId}/{photoId}.jpg`, base64)
        │  │  │  │  │  → Upload para Supabase Storage
        │  │  │  │  │
        │  │  │  │  ├─ Retorna URL:
        │  │  │  │  │  "https://...supabase.co/storage/v1/object/..."
        │  │  │  │  │
        │  │  │  │  └─ Cria FotoInfo:
        │  │  │  │     {
        │  │  │  │       id: photoId,
        │  │  │  │       url: "https://...",
        │  │  │  │       latitude, longitude,
        │  │  │  │       timestamp, takenAt
        │  │  │  │     }
        │  │  │  │
        │  │  │  └─ SE arquivo não encontrado:
        │  │  │     Retorna {url: null, error: "arquivo perdido"}
        │  │  │
        │  │  └─ Retorna servico com fotos_teste_observacao[]:
        │  │     [{url: "https://...", ...}, ...]
        │  │
        │  ├─ supabase.from('servicos').upsert([servicoComFotos])
        │  │  │
        │  │  ├─ SE id começa com "temp_":
        │  │  │  → INSERT como novo (Supabase gera UUID)
        │  │  │
        │  │  └─ SE id é UUID:
        │  │     → UPDATE existente
        │  │
        │  ├─ SE sucesso:
        │  │  │
        │  │  ├─ Novos IDs vêm do servidor:
        │  │  │  {
        │  │  │    id: "550e8400-e29b-41d4-a716-446655440000",
        │  │  │    sync_status: "synced",
        │  │  │    fotos_teste_observacao: [{url: "https://...", ...}]
        │  │  │  }
        │  │  │
        │  │  ├─ AsyncStorage.removeItem("@servicos_pending_sync")
        │  │  │  → Remove da fila de sync
        │  │  │
        │  │  └─ AsyncStorage.setItem("@servicos_local", {...})
        │  │     → Armazena versão sincronizada
        │  │
        │  └─ SE erro:
        │     servico.sync_status = 'error'
        │     servico.error_message = error.message
        │     → Mantém em AsyncStorage para retry
        │
        └─ UI atualiza: "✅ Sincronizado!" ou "❌ Erro"
```

---

## 📦 Estrutura de Dados

### No AsyncStorage (Mobile)

```javascript
// KEY: "@servicos_pending_sync"
// VALUE:
[
  {
    id: "temp_teste_1704067200000_abc123",
    obra_id: "550e8400-e29b-41d4-a716-446655440000",
    tipo_servico: "Teste",
    status: "rascunho",
    sync_status: "offline",
    created_at: "2024-01-01T10:00:00.000Z",
    updated_at: "2024-01-01T10:05:00.000Z",
    fotos_antes: [],
    fotos_durante: [],
    fotos_depois: [],
    fotos_teste_observacao: ["photo_1704067200000_xyz789", "photo_1704067201000_xyz790"],
    fotos_teste_comprovacao: []
  }
]

// KEY: "@photo_1704067200000_xyz789"
// VALUE:
{
  uri: "file:///data/user/0/com.app/photo.jpg",
  latitude: -22.9068,
  longitude: -51.4613,
  timestamp: 1704067200000,
  takenAt: "2024-01-01T10:00:00.000Z",
  equipamento: "Samsung A20",
  synced: false
}

// KEY: "@servicos_local"
// VALUE: (após sync bem-sucedido)
{
  "550e8400-e29b-41d4-a716-446655440000": {
    id: "550e8400-e29b-41d4-a716-446655440000",
    obra_id: "obra-uuid",
    tipo_servico: "Teste",
    status: "rascunho",
    sync_status: "synced",
    fotos_teste_observacao: [
      {
        id: "photo_1704067200000_xyz789",
        url: "https://...supabase.co/storage/v1/object/obras/obra-uuid/photo_1704067200000_xyz789.jpg",
        latitude: -22.9068,
        longitude: -51.4613,
        timestamp: 1704067200000,
        takenAt: "2024-01-01T10:00:00.000Z"
      }
    ],
    fotos_teste_comprovacao: []
  }
}
```

### No Supabase (Cloud)

#### Tabela: `servicos`

```sql
id                                          | obra_id | tipo_servico | status | sync_status | fotos_teste_observacao | fotos_teste_comprovacao | created_at | updated_at
550e8400-e29b-41d4-a716-446655440000  | obra-uuid | Teste | rascunho | synced | [{url: "https://...", ...}] | [] | 2024-01-01... | 2024-01-01...
```

#### Tabela: `servicos_fotos`

```sql
id | servico_id | photo_id | url | latitude | longitude | timestamp | takenAt | synced
1  | 550e8400-... | photo_1704067200000_xyz789 | https://... | -22.9068 | -51.4613 | 1704067200000 | 2024-01-01... | true
```

#### Storage: `/obras/{obraId}/`

```
/obras/550e8400-e29b-41d4-a716-446655440000/
├─ photo_1704067200000_xyz789.jpg  (1.5 MB)
├─ photo_1704067201000_xyz790.jpg  (1.3 MB)
└─ ...
```

---

## 🔗 Mapeamento de Responsabilidades

| Componente | Responsabilidade | Local |
|------------|------------------|-------|
| **servico-detalhe.tsx** | UI/Eventos | `mobile/app/` |
| **servico-sync.ts** | CRUD, Sincronização | `mobile/lib/` |
| **servico-rules.ts** | Validação de negócio | `mobile/lib/` |
| **photo-backup.ts** | Metadados de fotos | `mobile/lib/` |
| **photo-queue.ts** | Upload paralelo | `mobile/lib/` |
| **AsyncStorage** | Cache offline | React Native |
| **Supabase Auth** | Autenticação | Cloud |
| **Supabase DB** | Serviços + metadados | Cloud/SQL |
| **Supabase Storage** | Arquivos de fotos | Cloud/S3 |

---

## 🎯 Ciclo de Vida do Serviço

```
┌─────────────────────────────────────────────────────────┐
│              CICLO DE VIDA DO SERVIÇO                   │
└─────────────────────────────────────────────────────────┘

1️⃣ CRIAÇÃO (Online ou Offline)
   status: 'rascunho'
   sync_status: 'offline'
   id: temp_teste_...
   
   ↓
   
2️⃣ EDIÇÃO (Adicionar fotos, dados)
   status: 'rascunho' ou 'em_progresso'
   sync_status: 'offline'
   fotos_teste_*: ['photo_...', ...]
   
   ↓
   
3️⃣ MARCAÇÃO COMO COMPLETO
   status: 'completo'
   sync_status: 'offline'
   (Still local, not yet in cloud)
   
   ↓
   
4️⃣ SINCRONIZAÇÃO (Quando online)
   sync_status: 'syncing'
   (Durante upload)
   
   ├─ Faz upload de fotos para Storage
   ├─ Insere/Atualiza registros no DB
   └─ Gera URLs públicas
   
   ↓
   
5️⃣ SINCRONIZADO
   sync_status: 'synced'
   id: UUID (não mais temp_)
   fotos_teste_*: [FotoInfo com URLs]
   (Agora em cloud, offline cache mantém cópia local)
```

---

## ❌ Tratamento de Erros

```
Se sincronização falhar:
├─ Erro de conexão:
│  └─ sync_status = 'offline'
│     (Tenta novamente quando conecta)
│
├─ Erro de upload de arquivo:
│  └─ sync_status = 'error'
│     error_message = 'Failed to upload photo_...'
│     (Mostra alerta, permite retry)
│
└─ Erro de validação:
   └─ sync_status = 'error'
      error_message = 'Missing required field...'
      (Mostra erro, exige correção)
```

---

## 📊 Diagrama de Estado

```
                  ONLINE
        ┌─────────────────────┐
        │                     │
        ▼                     │
    ┌────────────┐            │
    │  SYNCED    │◄───────────┘
    │ (cloud)    │   syncAllPendingServicos()
    └────────────┘
        ▲
        │
        │ (conexão volta)
        │
    ┌────────────┐           OFFLINE
    │ SYNCING    │◄──────────────────┐
    │ (upload)   │                    │
    └────────────┘                    │
        ▲                          ┌─────────┐
        │                          │OFFLINE  │
        └──────────────────────────►(local)  │
         (user edita)              └─────────┘
                                       ▲
                                       │
                                  (create/edit)
```

