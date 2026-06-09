# 🎬 Exemplo Prático Passo a Passo: Criando e Sincronizando um Serviço Teste

Este documento mostra **exatamente o que acontece** em cada etapa enquanto você cria, edita e sincroniza um serviço Teste no celular.

---

## 🎯 Cenário Completo

**Usuário**: Técnico de campo
**Objetivo**: Criar um serviço de "Teste" em uma obra, tirar fotos, e sincronizar com o servidor
**Ambiente**: Celular Android offline → depois conecta WiFi para sincronizar

---

## 📱 PASSO 1: Abre o App

### O que você vê:
```
┌─────────────────────────────────┐
│    📱 OBRAS WISE MOBILE          │
│                                  │
│  ✓ Obra #001 - POSTE 123        │
│    ├─ 3 Serviços                │
│    ├─ 15 Fotos                  │
│    └─ Status: Em andamento       │
│                                  │
│  [➕ Novo Serviço] ◄─ TAP AQUI   │
└─────────────────────────────────┘
```

### O que acontece nos bastidores:

```javascript
// _layout.tsx → AuthProvider → useEffect
const unsubscribe = NetInfo.addEventListener(state => {
  if (state.isConnected === true) {
    // Se voltou online, sincroniza
    syncAllPendingServicos();
  }
});

// Carrega serviços existentes
const servicos = await fetchServicosForObra('obra-001');
// Retorna: [ServiçoA, ServiçoB, ServiçoC]

// Mostra na tela
setServicos(servicos);
```

**Status no AsyncStorage**:
```javascript
AsyncStorage.getItem('@servicos_pending_sync')
// Retorna: null (nenhum serviço offline ainda)
```

---

## 🎨 PASSO 2: Seleciona "Novo Serviço" → Escolhe "Teste"

### O que você vê:
```
┌─────────────────────────────────┐
│  Tipo de Serviço                │
│  ─────────────────────────────  │
│                                  │
│  ▢ APR                           │
│  ▢ Abertura e Fechamento        │
│  ▢ Altimetria                   │
│  ▢ Teste           ◄─ TAP AQUI   │
│  ▢ Transformador                │
│  ...                             │
└─────────────────────────────────┘
```

### O que acontece:

```typescript
// servico-detalhe.tsx
const handleCreateTesteServico = async () => {
  // Chama a função de criar
  const novoServico = await createTesteServico('obra-001');
  
  // Retorna:
  // {
  //   id: "temp_teste_1704067200000_abc123",
  //   obra_id: "obra-001",
  //   tipo_servico: "Teste",
  //   status: "rascunho",
  //   sync_status: "offline",
  //   fotos_teste_observacao: [],
  //   fotos_teste_comprovacao: [],
  //   created_at: "2024-01-01T10:00:00.000Z",
  //   updated_at: "2024-01-01T10:00:00.000Z"
  // }
};

// servico-sync.ts
export const createTesteServico = async (obraId: string) => {
  const now = new Date().toISOString();
  const servicoId = `temp_teste_${Date.now()}_${Math.random()...}`;
  
  const novoServico: ServicoLocal = {
    id: servicoId,
    obra_id: obraId,
    tipo_servico: 'Teste',
    status: 'rascunho',
    sync_status: 'offline',
    created_at: now,
    updated_at: now,
    fotos_antes: [],
    fotos_durante: [],
    fotos_depois: [],
    fotos_teste_observacao: [],
    fotos_teste_comprovacao: [],
  };

  // Salva no AsyncStorage
  const pendingStr = await AsyncStorage.getItem('@servicos_pending_sync');
  const list = pendingStr ? JSON.parse(pendingStr) : [];
  list.push(novoServico);  // ← Adiciona à lista
  
  await AsyncStorage.setItem('@servicos_pending_sync', JSON.stringify(list));
  // ✅ Agora está persistido no celular
  
  return novoServico;
};
```

**Status no AsyncStorage APÓS CRIAR**:
```javascript
AsyncStorage.getItem('@servicos_pending_sync')
// Retorna:
[
  {
    id: "temp_teste_1704067200000_abc123",
    obra_id: "obra-001",
    tipo_servico: "Teste",
    status: "rascunho",
    sync_status: "offline",
    fotos_teste_observacao: [],
    fotos_teste_comprovacao: [],
    created_at: "2024-01-01T10:00:00.000Z",
    updated_at: "2024-01-01T10:00:00.000Z"
  }
]

// ✅ Serviço salvo localmente
```

---

## 📷 PASSO 3: Tira Foto de Observação

### O que você vê:
```
┌─────────────────────────────────┐
│  Serviço Teste - Rascunho       │
│  ─────────────────────────────  │
│                                  │
│  Foto de Observação              │
│  ┌─────────────────────────────┐ │
│  │                              │ │
│  │   [Câmera se abre]           │ │
│  │   Você tira a foto           │ │
│  │                              │ │
│  └─────────────────────────────┘ │
│                                  │
│  [📷 Adicionar Foto] ◄─ TAP      │
│  [Foto com preview depois]       │
└─────────────────────────────────┘
```

### O que acontece (PASSO A PASSO):

#### A. ImagePicker abre câmera
```typescript
const result = await ImagePicker.launchCameraAsync({
  aspect: [4, 3],
  quality: 0.8,
});

// Usuário tira a foto
// Resultado:
// {
//   assets: [{
//     uri: "file:///data/user/0/com.app/cache/IMG_001.jpg"
//   }]
// }
```

#### B. Foto é salva em backup
```typescript
const photoId = await backupPhoto({
  uri: "file:///data/user/0/com.app/cache/IMG_001.jpg",
  latitude: -22.9068,      // ← De Location.getCurrentPositionAsync()
  longitude: -51.4613,
  timestamp: 1704067200000,
  takenAt: "2024-01-01T10:05:00.000Z"
});

// Dentro de backupPhoto():
// 1. Gera photoId: "photo_1704067200000_xyz789"
// 2. Copia arquivo para diretório seguro (expo-file-system)
// 3. Salva metadados em AsyncStorage
// 4. Retorna: "photo_1704067200000_xyz789"
```

**Status no AsyncStorage APÓS BACKUP**:
```javascript
AsyncStorage.getItem('@photo_1704067200000_xyz789')
// Retorna:
{
  uri: "file:///data/user/0/com.app/safe-storage/photo_1704067200000_xyz789.jpg",
  latitude: -22.9068,
  longitude: -51.4613,
  timestamp: 1704067200000,
  takenAt: "2024-01-01T10:05:00.000Z",
  equipamento: "Samsung Galaxy A20",
  synced: false
}
```

#### C. PhotoId é adicionado ao Serviço
```typescript
const servicoAtualizado = await appendPhotoToServicoLocal(
  servico,
  'fotos_teste_observacao',  // Campo específico
  'photo_1704067200000_xyz789'  // PhotoId
);

// Dentro de appendPhotoToServicoLocal():
servico.fotos_teste_observacao.push('photo_1704067200000_xyz789');
// Array agora: ["photo_1704067200000_xyz789"]

servico.updated_at = new Date().toISOString();
servico.sync_status = 'offline';

// Salva no AsyncStorage
await saveServicoLocal(servico);
```

**Status no AsyncStorage APÓS ADICIONAR FOTO**:
```javascript
AsyncStorage.getItem('@servicos_pending_sync')
// Retorna:
[
  {
    id: "temp_teste_1704067200000_abc123",
    obra_id: "obra-001",
    tipo_servico: "Teste",
    status: "rascunho",
    sync_status: "offline",
    fotos_teste_observacao: ["photo_1704067200000_xyz789"],  // ← NOVA FOTO
    fotos_teste_comprovacao: [],
    updated_at: "2024-01-01T10:05:01.000Z"
  }
]
```

#### D. UI Atualiza
```typescript
setServico(servicoAtualizado);  // ← Força re-render

// JSX renderiza:
<ScrollView horizontal>
  {(servico.fotos_teste_observacao || []).map((fotoId, idx) => (
    <Image 
      key={idx}
      source={{ uri: getFotoUri(fotoId) }}  // ← Busca URI local
      style={{ width: 100, height: 100 }}
    />
  ))}
</ScrollView>

// Aparece na tela:
// ┌─────────┐
// │ [Foto]  │ ← Preview da foto tirada
// └─────────┘
```

---

## 📷 PASSO 4: Tira Foto de Comprovação

### O que você vê:
```
┌─────────────────────────────────┐
│  Serviço Teste - Rascunho       │
│  ─────────────────────────────  │
│                                  │
│  Foto de Observação              │
│  ┌─────────┐                     │
│  │ [Foto1] │                     │
│  └─────────┘                     │
│                                  │
│  Foto de Comprovação             │
│  [📷 Adicionar Foto] ◄─ TAP      │
│                                  │
│  [🔄 Sincronizar] [✅ Completo]  │
└─────────────────────────────────┘
```

### O que acontece:

**Mesma sequência que PASSO 3**, mas para `fotos_teste_comprovacao`:

```typescript
const photoId2 = await backupPhoto({
  uri: "file:///data/user/0/com.app/cache/IMG_002.jpg",
  latitude: -22.9068,
  longitude: -51.4613,
  timestamp: 1704067200500,
  takenAt: "2024-01-01T10:06:00.000Z"
});
// Retorna: "photo_1704067200500_xyz790"

const servicoAtualizado = await appendPhotoToServicoLocal(
  servico,
  'fotos_teste_comprovacao',  // ← Campo diferente
  'photo_1704067200500_xyz790'
);
```

**Status no AsyncStorage APÓS 2ª FOTO**:
```javascript
AsyncStorage.getItem('@servicos_pending_sync')
// Retorna:
[
  {
    id: "temp_teste_1704067200000_abc123",
    tipo_servico: "Teste",
    fotos_teste_observacao: ["photo_1704067200000_xyz789"],
    fotos_teste_comprovacao: ["photo_1704067200500_xyz790"],  // ← 2ª FOTO
    updated_at: "2024-01-01T10:06:01.000Z"
  }
]
```

---

## ✅ PASSO 5: Marca como Completo

### O que você vê:
```
┌─────────────────────────────────┐
│  Serviço Teste                  │
│  Status: Rascunho → Completo    │
│  ─────────────────────────────  │
│  [✅ Marcar como Completo]       │
│      ↓                           │
│  Status muda para "Completo"    │
│                                  │
│  [🔄 Sincronizar]                │
└─────────────────────────────────┘
```

### O que acontece:

```typescript
const handleMarkComplete = async () => {
  const servicoCompleto = await markServicoComplete(servico);
  // Retorna:
  // {
  //   ...servico,
  //   status: "completo",
  //   sync_status: "offline",
  //   updated_at: "2024-01-01T10:07:00.000Z"
  // }
  
  setServico(servicoCompleto);
};

// servico-sync.ts
export const markServicoComplete = async (servico: ServicoLocal) => {
  servico.status = 'completo';  // ← Muda status
  servico.updated_at = new Date().toISOString();
  servico.sync_status = 'offline';
  
  await saveServicoLocal(servico);  // ← Persiste
  
  return servico;
};
```

**Status no AsyncStorage APÓS MARCAR COMPLETO**:
```javascript
AsyncStorage.getItem('@servicos_pending_sync')
// Retorna:
[
  {
    id: "temp_teste_1704067200000_abc123",
    tipo_servico: "Teste",
    status: "completo",  // ← MUDA AQUI
    sync_status: "offline",
    fotos_teste_observacao: ["photo_1704067200000_xyz789"],
    fotos_teste_comprovacao: ["photo_1704067200500_xyz790"],
    updated_at: "2024-01-01T10:07:00.000Z"
  }
]
```

---

## 🌐 PASSO 6: Conecta WiFi e Sincroniza

### O que você vê:

**Antes** (offline):
```
📡 Offline    ← Badge vermelha
─────────────
⚠️ 1 Serviço pendente
```

**Depois de conectar** (NetInfo detecta):
```
📡 Online     ← Badge verde
─────────────
🔄 Sincronizando...
```

**Depois de sincronizar**:
```
📡 Online     ← Badge verde
─────────────
✅ Tudo sincronizado!
```

### O que acontece nos bastidores:

#### A. NetInfo detecta conexão
```typescript
// AuthContext.tsx
useEffect(() => {
  const unsubscribe = NetInfo.addEventListener(state => {
    if (state.isConnected === true) {
      console.log('📡 Conexão restaurada!');
      
      // ← DISPARA AUTOMÁTICO
      syncAllPendingServicos()
        .then(() => console.log('✅ Sincronização completa'))
        .catch(err => console.error('❌ Erro:', err));
    }
  });
  
  return () => unsubscribe();
}, []);
```

#### B. syncAllPendingServicos() começa
```typescript
export const syncAllPendingServicos = async () => {
  const { isConnected } = await NetInfo.fetch();
  
  if (!isConnected) {
    console.log('⚠️ Sem conexão, aguardando...');
    return;
  }
  
  // Lê serviços offline
  const pendingStr = await AsyncStorage.getItem('@servicos_pending_sync');
  const pendingServicos = JSON.parse(pendingStr);
  // Retorna: [{id: "temp_teste_...", fotos_teste_observacao: [...], ...}]
  
  // Sincroniza cada um
  for (const servico of pendingServicos) {
    await syncServico(servico);
  }
};
```

#### C. Resolve fotos locais para URLs
```typescript
async function syncServico(servico: ServicoLocal) {
  // 1. Transforma fotos locais em URLs cloud
  const servicoComFotos = await resolveLocalPhotosToUrls(servico);
  // Processo:
  // fotos_teste_observacao: ["photo_1704067200000_xyz789"]
  //   ↓
  // 1. Lê arquivo local: FileSystem.readAsStringAsync(uri)
  // 2. Faz upload para Supabase Storage:
  //    supabase.storage.from('obras').upload(...)
  // 3. Recebe URL pública:
  //    "https://...supabase.co/storage/v1/object/..."
  // 4. Cria FotoInfo:
  //    { id: "photo_...", url: "https://...", lat, lon, ... }
  //   ↓
  // fotos_teste_observacao: [
  //   {
  //     id: "photo_1704067200000_xyz789",
  //     url: "https://...supabase.co/storage/v1/object/...",
  //     latitude: -22.9068,
  //     longitude: -51.4613,
  //     timestamp: 1704067200000
  //   }
  // ]
  
  console.log('📤 Sincronizando serviço:', servico.id);
  
  // 2. Faz UPSERT no banco de dados
  const { data, error } = await supabase
    .from('servicos')
    .upsert([servicoComFotos], { onConflict: 'id' })
    .select();
  
  if (error) {
    console.error('❌ Erro ao sincronizar:', error);
    servico.sync_status = 'error';
    servico.error_message = error.message;
  } else {
    console.log('✅ Sincronizado com sucesso!');
    // Servidor retorna:
    // {
    //   id: "550e8400-e29b-41d4-a716-446655440000",  ← UUID!
    //   tipo_servico: "Teste",
    //   status: "completo",
    //   sync_status: "synced",
    //   fotos_teste_observacao: [{url: "https://...", ...}],
    //   fotos_teste_comprovacao: [{url: "https://...", ...}],
    //   created_at: "2024-01-01...",
    //   updated_at: "2024-01-01..."
    // }
    
    servico.sync_status = 'synced';
    servico.error_message = null;
    servico.id = data[0].id;  // ← Atualiza ID de temp para UUID
  }
  
  // 3. Persiste resultado
  await saveServicoLocal(servico);
}
```

**Status no AsyncStorage APÓS SYNC BEM-SUCEDIDO**:

```javascript
// A lista de PENDING é limpa (ou removido o serviço selecionado)
AsyncStorage.getItem('@servicos_pending_sync')
// Agora vazio: [] ou sem o serviço Teste

// Mas o serviço agora está em @servicos_local
AsyncStorage.getItem('@servicos_local')
// Retorna:
{
  "550e8400-e29b-41d4-a716-446655440000": {
    id: "550e8400-e29b-41d4-a716-446655440000",  // ← UUID
    obra_id: "obra-001",
    tipo_servico: "Teste",
    status: "completo",
    sync_status: "synced",  // ← Sincronizado!
    fotos_teste_observacao: [
      {
        id: "photo_1704067200000_xyz789",
        url: "https://hiuagpzaelcocyxutgdt.supabase.co/storage/v1/object/public/obras/obra-001/photo_1704067200000_xyz789.jpg",
        latitude: -22.9068,
        longitude: -51.4613,
        timestamp: 1704067200000,
        takenAt: "2024-01-01T10:05:00.000Z"
      }
    ],
    fotos_teste_comprovacao: [
      {
        id: "photo_1704067200500_xyz790",
        url: "https://hiuagpzaelcocyxutgdt.supabase.co/storage/v1/object/public/obras/obra-001/photo_1704067200500_xyz790.jpg",
        latitude: -22.9068,
        longitude: -51.4613,
        timestamp: 1704067200500,
        takenAt: "2024-01-01T10:06:00.000Z"
      }
    ],
    created_at: "2024-01-01T10:00:00.000Z",
    updated_at: "2024-01-01T10:07:00.000Z"
  }
}
```

---

## 🗄️ PASSO 7: Verificar no Supabase

### Via Console Web (supabase.com)

#### Tabela `servicos`:
```
ID                                      | tipo_servico | status | sync_status | fotos_teste_observacao
550e8400-e29b-41d4-a716-446655440000  | Teste        | completo | synced  | [{url: "https://...", ...}]
```

#### Tabela `servicos_fotos`:
```
ID | servico_id                           | photo_id                  | url                               | latitude  | longitude
1  | 550e8400-e29b-41d4-a716-446655440000| photo_1704067200000_xyz789| https://...supabase.co/storage... | -22.9068  | -51.4613
2  | 550e8400-e29b-41d4-a716-446655440000| photo_1704067200500_xyz790| https://...supabase.co/storage... | -22.9068  | -51.4613
```

#### Storage `/obras/obra-001/`:
```
📁 obras/
└─ 📁 obra-001/
   ├─ photo_1704067200000_xyz789.jpg  (1.5 MB)
   └─ photo_1704067200500_xyz790.jpg  (1.3 MB)
```

---

## 🔄 RESUMO DO FLUXO COMPLETO

| Etapa | Local | Dados | Status |
|-------|-------|-------|--------|
| 1. Criar | AsyncStorage | `temp_teste_...` | `offline` |
| 2. Foto 1 | AsyncStorage | PhotoId + Arquivo | `offline` |
| 3. Foto 2 | AsyncStorage | PhotoId + Arquivo | `offline` |
| 4. Completo | AsyncStorage | Status = completo | `offline` |
| 5. Conecta WiFi | NetInfo | - | `online` |
| 6. Upload Fotos | Supabase Storage | Arquivos → URLs | `uploading` |
| 7. Sincronizar | Supabase DB | Registros com URLs | `synced` |
| 8. Cache Local | AsyncStorage | Cópia @servicos_local | `synced` |

---

## ✅ Checklist: Tudo Funcionou?

Verifique cada ponto:

```
✅ Serviço criado localmente?
   → AsyncStorage tem @servicos_pending_sync com tipo_servico: 'Teste'

✅ Fotos capturadas?
   → AsyncStorage tem @photo_* com metadados

✅ Fotos aparecem na UI?
   → Scrollable grid com thumbnails

✅ Status marcado como completo?
   → Texto "Completo" aparece na tela

✅ Sincronizou automaticamente ao conectar?
   → Badge mudou de "Offline" para "Online"
   → Console mostra: "✅ Sincronização completa"

✅ ID mudou de temp para UUID?
   → No Supabase, id é 550e8400-e29b...

✅ URLs das fotos são válidas?
   → Imagens carregam no Supabase, https://...supabase.co...

✅ Fotos aparecem no Supabase Storage?
   → Storage/obras/obra-001/ tem 2 arquivos

✅ Registros no banco de dados?
   → Tabela servicos tem 1 novo registro de tipo 'Teste'
   → Tabela servicos_fotos tem 2 registros
```

---

## 🚨 Se Algo Não Funcionar

| Problema | Solução |
|----------|---------|
| Serviço não aparece | Verifica se `fetchServicosForObra()` foi chamado |
| Foto não salva | Verifica permissão de câmera/storage no AndroidManifest |
| Não sincroniza | Verifica se internet está conectada (`adb logcat` mostra NetInfo) |
| Foto não aparece no Supabase Storage | Verifica tamanho do arquivo (>100MB?) |
| UUID não foi gerado | Verifica resposta do UPSERT no console |
| Status ainda é offline após sync | Verifica erro_message no localStorage |

