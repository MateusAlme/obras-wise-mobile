# 📋 Melhorias Futuras - Sistema Offline

Este documento lista melhorias importantes para implementação futura no sistema de acesso offline.

---

## 🚀 Prioridade 2 - Importante (fazer depois)

### 1. ⚡ Upload Paralelo de Fotos

**Objetivo:** Aumentar velocidade de sincronização

**Status:** ⏳ Pendente

**Descrição:**
Atualmente fotos são enviadas sequencialmente (uma por vez). Implementar upload paralelo para enviar múltiplas fotos simultaneamente.

**Implementação sugerida:**
```typescript
// Arquivo: mobile/lib/photo-queue.ts

const PARALLEL_UPLOADS = 3; // Enviar 3 fotos ao mesmo tempo

// Substituir loop sequencial por Promise.allSettled()
const uploadBatch = async (photos: PhotoMetadata[]) => {
  const batches = [];
  for (let i = 0; i < photos.length; i += PARALLEL_UPLOADS) {
    const batch = photos.slice(i, i + PARALLEL_UPLOADS);
    const results = await Promise.allSettled(
      batch.map(photo => uploadPhoto(photo))
    );
    batches.push(...results);
  }
  return batches;
};
```

**Benefício esperado:**
- Redução de 50-60% no tempo total de sincronização
- 100 fotos: de ~10 minutos para ~4 minutos

**Estimativa:** 4-6 horas de desenvolvimento

---

### 2. 📊 Tela de Status de Sincronização Detalhada

**Objetivo:** Dar visibilidade total sobre o processo de sync

**Status:** ⏳ Pendente

**Descrição:**
Criar uma tela dedicada mostrando status detalhado de todas operações de sincronização em tempo real.

**Features:**
- Lista de obras com status individual:
  - ✅ Sincronizada
  - 🔄 Sincronizando (com % de progresso)
  - ⏳ Na fila
  - ❌ Falhou (com motivo do erro)
- Progresso de upload por obra:
  - Fotos: 15/20 enviadas
  - Barra de progresso visual
- Botões de ação:
  - "Pausar Sincronização"
  - "Cancelar Upload"
  - "Tentar Novamente" (para falhas)
- Estatísticas gerais:
  - Tempo estimado restante
  - Velocidade de upload (MB/s)
  - Dados enviados / Total

**Telas a criar:**
```
mobile/app/sync-status.tsx         # Tela principal
mobile/components/SyncProgress.tsx # Componente de progresso
mobile/components/SyncHistory.tsx  # Histórico de syncs
```

**Mockup da UI:**
```
┌─────────────────────────────────┐
│ ← Status de Sincronização       │
├─────────────────────────────────┤
│ 📊 Progresso Geral              │
│ ▓▓▓▓▓▓▓▓▓▓▓▓▓░░░ 65%           │
│ 13 de 20 obras sincronizadas    │
│                                  │
│ ⏱️ Tempo estimado: 8 min         │
│ 📶 Velocidade: 1.2 MB/s         │
├─────────────────────────────────┤
│ Obras:                           │
│                                  │
│ ✅ Obra 123 - CNT 01            │
│    20/20 fotos • Concluída       │
│                                  │
│ 🔄 Obra 124 - MNT 03            │
│    ▓▓▓▓▓░░░░░ 45% (9/20 fotos)  │
│                                  │
│ ❌ Obra 125 - CNT 02            │
│    Erro: Conexão perdida         │
│    [🔄 Tentar Novamente]        │
│                                  │
│ ⏳ Obra 126 - APG 01            │
│    Na fila de sincronização      │
└─────────────────────────────────┘
```

**Estimativa:** 8-10 horas de desenvolvimento

---

### 3. 💾 Limite de Armazenamento (Alertar quando celular enchendo)

**Objetivo:** Prevenir que o app encha o celular do usuário

**Status:** ⏳ Pendente

**Descrição:**
Implementar sistema de monitoramento de armazenamento com alertas e limpeza automática.

**Features:**

**3.1 Monitoramento:**
```typescript
// mobile/lib/storage-monitor.ts

interface StorageStatus {
  totalSpace: number;        // Espaço total do dispositivo
  freeSpace: number;         // Espaço livre
  appUsage: number;          // Espaço usado pelo app
  photoStorage: number;      // Espaço usado por fotos
  cacheStorage: number;      // Espaço usado por cache
  warningLevel: 'safe' | 'warning' | 'critical';
}

// Limites sugeridos:
// - Safe: < 500 MB usado pelo app
// - Warning: 500 MB - 1 GB
// - Critical: > 1 GB
```

**3.2 Alertas:**
```typescript
// Alerta quando atingir 500 MB
if (storageStatus.appUsage > 500 * 1024 * 1024) {
  Alert.alert(
    '⚠️ Armazenamento Elevado',
    'O app está usando 500 MB. Considere sincronizar e limpar fotos antigas.',
    [
      { text: 'Sincronizar Agora', onPress: () => startSync() },
      { text: 'Ver Detalhes', onPress: () => router.push('/storage-details') },
      { text: 'Depois', style: 'cancel' }
    ]
  );
}

// Alerta crítico quando atingir 1 GB
if (storageStatus.appUsage > 1024 * 1024 * 1024) {
  Alert.alert(
    '🚨 Armazenamento Crítico',
    'O app está usando mais de 1 GB. É necessário liberar espaço.',
    [
      { text: 'Limpar Automaticamente', onPress: () => autoCleanup() },
      { text: 'Escolher o que Limpar', onPress: () => router.push('/cleanup') }
    ]
  );
}
```

**3.3 Tela de Gerenciamento:**
```
mobile/app/storage-details.tsx

┌─────────────────────────────────┐
│ ← Armazenamento                 │
├─────────────────────────────────┤
│ 📊 Uso do Aplicativo            │
│                                  │
│ ▓▓▓▓▓▓░░░░░░░░░░ 750 MB / 2 GB │
│                                  │
│ Detalhamento:                    │
│ 📸 Fotos pendentes: 650 MB      │
│ 💾 Cache de dados: 80 MB        │
│ 📄 Documentos: 20 MB            │
│                                  │
│ [🧹 Limpar Cache (80 MB)]       │
│                                  │
│ [🗑️ Remover Fotos Sincronizadas │
│     (650 MB)]                    │
│                                  │
│ Limpeza Automática:              │
│ ⚙️ [✓] Limpar fotos após sync   │
│ ⚙️ [✓] Limpar cache > 100 MB    │
└─────────────────────────────────┘
```

**3.4 Limpeza Automática:**
```typescript
// Após sync bem-sucedido:
const autoCleanup = async () => {
  // 1. Remover fotos já sincronizadas
  await cleanupUploadedPhotos();

  // 2. Remover cache antigo (> 7 dias)
  await clearOldCache();

  // 3. Compactar metadados
  await compactMetadata();
};
```

**Estimativa:** 6-8 horas de desenvolvimento

---

### 4. 🗄️ SQLite para Consultas Mais Rápidas

**Objetivo:** Melhorar performance e permitir consultas complexas

**Status:** ⏳ Pendente

**Descrição:**
Migrar de AsyncStorage para SQLite para armazenamento estruturado de obras e fotos.

**Problemas atuais com AsyncStorage:**
- Lento com grandes volumes de dados
- Não suporta queries complexas (filtros, ordenação)
- Carrega tudo na memória de uma vez
- Sem relacionamentos entre tabelas
- Limite de ~6 MB por chave

**Solução com SQLite:**

**4.1 Schema do Banco:**
```sql
-- mobile/lib/database/schema.sql

-- Tabela de Obras
CREATE TABLE obras (
  id TEXT PRIMARY KEY,
  data TEXT NOT NULL,
  obra TEXT NOT NULL,
  responsavel TEXT NOT NULL,
  equipe TEXT NOT NULL,
  tipo_servico TEXT NOT NULL,
  sync_status TEXT DEFAULT 'pending',
  created_at TEXT NOT NULL,
  updated_at TEXT,
  error_message TEXT,
  INDEX idx_sync_status (sync_status),
  INDEX idx_equipe (equipe),
  INDEX idx_data (data)
);

-- Tabela de Fotos
CREATE TABLE fotos (
  id TEXT PRIMARY KEY,
  obra_id TEXT NOT NULL,
  type TEXT NOT NULL,
  uri TEXT NOT NULL,
  backup_path TEXT,
  compressed_path TEXT,
  uploaded INTEGER DEFAULT 0,
  upload_url TEXT,
  latitude REAL,
  longitude REAL,
  utm_x REAL,
  utm_y REAL,
  utm_zone TEXT,
  created_at TEXT NOT NULL,
  FOREIGN KEY (obra_id) REFERENCES obras(id) ON DELETE CASCADE,
  INDEX idx_obra_id (obra_id),
  INDEX idx_uploaded (uploaded)
);

-- Tabela de Queue de Sync
CREATE TABLE sync_queue (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  obra_id TEXT NOT NULL,
  priority INTEGER DEFAULT 0,
  retry_count INTEGER DEFAULT 0,
  last_attempt_at TEXT,
  status TEXT DEFAULT 'pending',
  FOREIGN KEY (obra_id) REFERENCES obras(id) ON DELETE CASCADE
);
```

**4.2 Implementação:**
```typescript
// mobile/lib/database/db.ts

import * as SQLite from 'expo-sqlite';

class DatabaseService {
  private db: SQLite.SQLiteDatabase;

  async init() {
    this.db = await SQLite.openDatabaseAsync('obras.db');
    await this.createTables();
  }

  async createTables() {
    // Executar schema.sql
  }

  // CRUD de Obras
  async saveObra(obra: Obra) {
    return await this.db.runAsync(
      'INSERT INTO obras (...) VALUES (...)',
      [obra.id, obra.data, ...]
    );
  }

  async getObrasPendentes() {
    return await this.db.getAllAsync(
      'SELECT * FROM obras WHERE sync_status = ? ORDER BY created_at DESC',
      ['pending']
    );
  }

  async getObrasByEquipe(equipe: string, limit: number = 50) {
    return await this.db.getAllAsync(
      'SELECT * FROM obras WHERE equipe = ? ORDER BY data DESC LIMIT ?',
      [equipe, limit]
    );
  }

  // Queries complexas
  async getObrasStats(equipe: string) {
    return await this.db.getFirstAsync(`
      SELECT
        COUNT(*) as total,
        SUM(CASE WHEN sync_status = 'pending' THEN 1 ELSE 0 END) as pendentes,
        SUM(CASE WHEN sync_status = 'failed' THEN 1 ELSE 0 END) as falhas
      FROM obras
      WHERE equipe = ?
    `, [equipe]);
  }
}

export const db = new DatabaseService();
```

**4.3 Migração de AsyncStorage para SQLite:**
```typescript
// mobile/lib/database/migration.ts

async function migrateFromAsyncStorage() {
  console.log('🔄 Iniciando migração AsyncStorage → SQLite...');

  // 1. Ler obras do AsyncStorage
  const obrasStr = await AsyncStorage.getItem('@obras_pending_sync');
  const obras = JSON.parse(obrasStr || '[]');

  // 2. Inserir no SQLite
  for (const obra of obras) {
    await db.saveObra(obra);
  }

  // 3. Ler fotos
  const fotosStr = await AsyncStorage.getItem('@photo_metadata');
  const fotos = JSON.parse(fotosStr || '[]');

  for (const foto of fotos) {
    await db.saveFoto(foto);
  }

  // 4. Limpar AsyncStorage antigo
  await AsyncStorage.removeItem('@obras_pending_sync');
  await AsyncStorage.removeItem('@photo_metadata');

  console.log('✅ Migração concluída!');
}
```

**Benefícios:**
- Queries 10-50x mais rápidas
- Filtros e ordenação eficientes
- Paginação nativa
- Relacionamentos entre tabelas
- Transações atômicas
- Backup/restore simplificado

**Estimativa:** 12-16 horas de desenvolvimento

---

## 📊 Resumo das Estimativas

| Melhoria | Prioridade | Tempo | Impacto |
|----------|-----------|-------|---------|
| Upload Paralelo | Alta | 4-6h | Performance |
| Tela de Sync Detalhada | Média | 8-10h | UX |
| Limite de Armazenamento | Alta | 6-8h | Estabilidade |
| SQLite | Alta | 12-16h | Performance + Escalabilidade |

**Total estimado:** 30-40 horas de desenvolvimento

---

## 🎯 Ordem Recomendada de Implementação

1. **Limite de Armazenamento** (6-8h)
   - Previne problemas imediatos
   - Independente das outras melhorias

2. **Upload Paralelo** (4-6h)
   - Melhoria rápida e com impacto imediato
   - Não requer mudanças estruturais

3. **SQLite** (12-16h)
   - Base para melhorias futuras
   - Permite queries complexas

4. **Tela de Sync Detalhada** (8-10h)
   - Aproveita melhorias anteriores
   - Última camada de polish UX

---

## 📝 Notas

- Todas as melhorias são **não-bloqueantes** - o sistema atual funciona sem elas
- Podem ser implementadas de forma **incremental**
- Mantenha **backward compatibility** durante migrações
- Teste em **dispositivos reais** com diferentes capacidades de armazenamento

---

**Documento criado em:** 2025-01-10
**Última atualização:** 2025-01-10
**Status:** Planejamento
