# Sistema Offline-First - Implementação

## 📋 Problema Original

O app tinha dois fluxos separados (online/offline) que causavam problemas:

1. **Duplicação de obras**: Ao iniciar uma obra online e perder conexão, uma NOVA obra era criada offline com ID diferente
2. **Perda de continuidade**: Não era possível continuar editando a mesma obra ao alternar entre online/offline
3. **Complexidade**: Código duplicado para lidar com dois cenários diferentes

## ✅ Solução: Offline-First

Implementamos um **sistema offline-first** onde:

### Princípios

1. **AsyncStorage é a fonte primária** - Todas as obras são SEMPRE salvas localmente primeiro
2. **ID único por obra** - Cada obra tem um único ID que persiste durante todo seu ciclo de vida
3. **Sincronização em background** - Upload automático quando houver internet, sem bloquear o usuário
4. **Continuidade garantida** - Sempre retoma a mesma obra, independente de conexão

### Arquitetura

```
┌─────────────────────────────────────────────────────────┐
│                    SALVAR OBRA                          │
│                         ↓                               │
│           SEMPRE salva no AsyncStorage                  │
│                    (LOCAL_OBRAS_KEY)                    │
│                         ↓                               │
│              Obra com ID único gerada                   │
│                         ↓                               │
│                  ┌──────────────┐                       │
│                  │ Tem Internet?│                       │
│                  └──────┬───────┘                       │
│                         │                               │
│         ┌───────────────┴───────────────┐               │
│         │ SIM                           │ NÃO           │
│         ↓                               ↓               │
│  syncLocalObra()                 Fica pendente          │
│  (background)                    de sincronização       │
│         │                               │               │
│         ↓                               │               │
│  Upload fotos + dados                   │               │
│  para Supabase                          │               │
│         │                               │               │
│         ↓                               ↓               │
│  Marca como synced=true      Aguarda internet           │
│                                                          │
└─────────────────────────────────────────────────────────┘
```

## 🔧 Implementação

### 1. Nova Interface `LocalObra`

```typescript
export interface LocalObra extends PendingObra {
  synced: boolean;           // Se já foi sincronizada com servidor
  serverId?: string;         // ID no servidor (após sync)
  locallyModified: boolean;  // Se foi modificada localmente após sync
}
```

### 2. Funções Principais

#### `saveObraLocal()`
- **O que faz**: Salva ou atualiza obra no AsyncStorage (`LOCAL_OBRAS_KEY`)
- **Quando usar**: SEMPRE ao salvar/editar uma obra
- **Retorno**: ID da obra (mesmo ID sempre, não muda)

```typescript
const savedObraId = await saveObraLocal(obraData, existingId);
// savedObraId será o mesmo se for edição, ou novo se for criação
```

#### `getLocalObras()`
- **O que faz**: Retorna todas as obras do AsyncStorage
- **Uso**: Listar obras (substituirá chamadas ao Supabase)

#### `syncLocalObra(obraId)`
- **O que faz**: Sincroniza uma obra específica com Supabase
- **Quando**: Automaticamente em background quando houver internet
- **Comportamento**:
  - Faz upload das fotos
  - Insere/atualiza no Supabase
  - Marca `synced=true` no AsyncStorage

#### `syncAllLocalObras()`
- **O que faz**: Sincroniza todas as obras não sincronizadas
- **Quando**: Ao conectar na internet (auto-sync listener)

### 3. Fluxo de Salvamento (nova-obra.tsx)

```typescript
// ANTES (problemático):
if (!isConnected) {
  // Salvar offline (ID temporário)
  await saveObraOffline(...);
} else {
  // Upload direto (ID do servidor)
  await supabase.from('obras').insert(...);
}

// DEPOIS (offline-first):
// 1. SEMPRE salvar localmente primeiro
const savedObraId = await saveObraLocal(obraData, existingId);

// 2. Se online, sincronizar em background (não bloqueia)
if (isConnected) {
  setTimeout(() => syncLocalObra(savedObraId), 500);
}
```

### 4. Benefícios

✅ **Elimina duplicação**: Mesmo ID sempre, online ou offline
✅ **Continuidade perfeita**: Pode parar e retomar a mesma obra
✅ **Funciona offline nativo**: AsyncStorage é rápido e sempre disponível
✅ **Sync transparente**: Usuário não percebe uploads em background
✅ **Código mais simples**: Um único fluxo, sem if/else de conexão

## 📱 Mudanças no Comportamento

### Antes
- **Online**: Salvava direto no Supabase → ID do servidor
- **Offline**: Salvava no AsyncStorage → ID temporário `offline_...`
- **Problema**: Ao alternar, criava obra nova

### Depois
- **Sempre**: Salva no AsyncStorage → ID único `local_...`
- **Background**: Se online, faz upload automático
- **Resultado**: Mesma obra, sempre

## 🔄 Próximos Passos

1. ✅ Implementar `saveObraLocal()` e funções relacionadas
2. ✅ Modificar `nova-obra.tsx` para usar sistema offline-first
3. ⏳ Modificar `obra-detalhe.tsx` para carregar de AsyncStorage
4. ⏳ Modificar `obras.tsx` para listar obras do AsyncStorage
5. ⏳ Modificar `obras-pendentes.tsx` para mostrar status de sync
6. ⏳ Implementar listener de auto-sync ao conectar
7. ⏳ Testar fluxo completo

## 🐛 Debug

### Como verificar obras locais:
```javascript
import { getLocalObras } from '../lib/offline-sync';

const obras = await getLocalObras();
console.log('Obras locais:', obras);
```

### Como forçar sincronização:
```javascript
import { syncAllLocalObras } from '../lib/offline-sync';

const result = await syncAllLocalObras();
console.log(`Sync: ${result.success} sucesso, ${result.failed} falhas`);
```

## 📝 Notas Técnicas

- **AsyncStorage Key**: `@obras_local`
- **ID Format**: `local_<timestamp>_<random>`
- **Sync Status**: `synced: boolean`, `locallyModified: boolean`
- **Backward Compatibility**: Mantém suporte às obras antigas (`@obras_pending_sync`)

---

**Implementado em**: Janeiro 2026
**Arquivos modificados**:
- `mobile/lib/offline-sync.ts`
- `mobile/app/nova-obra.tsx`
