# 🔧 Correção: Campo `origem` Após Sincronização

## ❌ Problema Crítico

Obras que foram sincronizadas com sucesso ainda apareciam como **"Em aberto"** e **"Aguardando sincronização"** no aplicativo mobile, mesmo estando marcadas como **"Concluída"** no sistema web (Supabase).

### Exemplo Real:

**Obra 99998888:**
- ✅ **No Supabase**: `status = 'Concluída'`
- ❌ **No Mobile**:
  - Mostra "Em aberto"
  - Mostra "Aguardando sincronização"
  - Botão "Finalizar Obra" ainda visível

## 🔍 Causa Raiz

Foram identificados **5 pontos críticos** onde o campo `origem` não estava sendo preservado ou estava sendo sobrescrito incorretamente:

### 1. Tela de Detalhes da Obra (`obra-detalhe.tsx`)

**Problema**: Ao carregar obra do AsyncStorage, forçava `origem: 'offline'`

```typescript
// ❌ ANTES (linhas 304, 335)
setObra({ ...localObra, origem: 'offline' }); // Sobrescreve origem!
```

**Impacto**: Mesmo obras sincronizadas (com `origem: 'online'` no AsyncStorage) eram exibidas como offline.

### 2. Tela de Listagem de Obras (`obras.tsx`)

**Problema**: Ao combinar obras, forçava origem para todas as obras

```typescript
// ❌ ANTES (linha 83)
const pendentes: ObraListItem[] = pendingObrasState.map((obra) => ({
  ...obra,
  origem: 'offline', // Força offline para TODAS
}));
```

**Impacto**: Obras sincronizadas na lista `pendingObrasState` eram marcadas como offline.

### 3. Migração Inicial do Supabase (`obras.tsx`)

**Problema**: Ao migrar obras do Supabase para AsyncStorage, não definia `origem: 'online'`

```typescript
// ❌ ANTES (linha 210-218)
const savedObra: LocalObra = {
  ...obra,
  synced: true,
  locallyModified: false,
  serverId: obra.id,
  // ❌ FALTAVA: origem: 'online'
};
```

**Impacto**: Obras migradas do Supabase não tinham o campo `origem` definido.

### 4. Sincronização de Obras (`offline-sync.ts`)

**Problema**: Ao sincronizar obra, não atualizava `origem` para `'online'`

```typescript
// ❌ ANTES (linhas 532-549)
localObras.push({
  ...syncedObra,
  synced: true,
  locallyModified: false,
  serverId: syncedObra.id,
  // ❌ FALTAVA: origem: 'online'
});
```

**Impacto**: Obras recém-sincronizadas continuavam sem `origem: 'online'`.

### 5. Recuperação do Supabase (`offline-sync.ts`)

**Problema**: Já foi corrigido anteriormente, mas faltava em outros lugares.

## ✅ Solução Aplicada

### 1. Tela de Detalhes (`obra-detalhe.tsx`)

**Linhas 304-305, 336-337**

```typescript
// ✅ DEPOIS
// Preservar origem do AsyncStorage (pode ser 'online' ou 'offline')
setObra({ ...localObra, origem: localObra.origem || 'offline' });
```

**Resultado**: Preserva o valor de `origem` que está salvo no AsyncStorage.

### 2. Tela de Listagem (`obras.tsx`)

**Linhas 82-84, 89-91**

```typescript
// ✅ DEPOIS
const pendentes: ObraListItem[] = pendingObrasState.map((obra) => ({
  ...obra,
  origem: obra.origem || 'offline', // Usar origem salva, ou 'offline' como fallback
}));

const sincronizadas: ObraListItem[] = obrasOnlineArray.map((obra) => ({
  ...obra,
  origem: obra.origem || 'online', // Usar origem salva, ou 'online' como fallback
}));
```

**Resultado**: Cada obra mantém sua origem original.

### 3. Migração Inicial (`obras.tsx`)

**Linhas 210-219**

```typescript
// ✅ DEPOIS
const savedObra: LocalObra = {
  ...obra,
  id: obra.id,
  synced: true,
  locallyModified: false,
  serverId: obra.id,
  origem: 'online', // ✅ CRÍTICO: Obra vem do Supabase
  last_modified: obra.updated_at || obra.created_at,
  created_at: obra.created_at,
} as LocalObra;
```

**Resultado**: Obras migradas do Supabase já têm `origem: 'online'`.

### 4. Sincronização de Obras (`offline-sync.ts`)

**Linhas 532-551**

```typescript
// ✅ DEPOIS
if (finalId !== obraId) {
  localObras.push({
    ...syncedObra,
    synced: true,
    locallyModified: false,
    serverId: syncedObra.id,
    origem: 'online', // ✅ CRÍTICO: Obra foi sincronizada com sucesso
    last_modified: syncedObra.updated_at || syncedObra.created_at,
    created_at: syncedObra.created_at,
  } as LocalObra);
} else {
  localObras[index] = {
    ...syncedObra,
    synced: true,
    locallyModified: false,
    serverId: syncedObra.id,
    origem: 'online', // ✅ CRÍTICO: Obra foi sincronizada com sucesso
    last_modified: syncedObra.updated_at || syncedObra.created_at,
    created_at: syncedObra.created_at,
  } as LocalObra;
}
```

**Resultado**: Obras sincronizadas são marcadas como `origem: 'online'` no AsyncStorage.

## 🧪 Como Testar

### Teste 1: Sincronização Automática

1. **Criar obra offline** e finalizar
2. **Sincronizar** usando o botão de sincronização
3. **Verificar que**:
   - ✅ Badge "Aguardando sincronização" **desaparece**
   - ✅ Badge "Sincronizada ✓" **aparece**
   - ✅ Botão "Finalizar Obra" **desaparece** (se finalizada)

### Teste 2: Recuperação Manual

1. **Abrir obra** que está no Supabase mas mostra status incorreto
2. **Clicar em "Recuperar Fotos" → "☁️ Supabase"**
3. **Verificar que**:
   - ✅ Status muda para "Concluída" (se estava concluída no Supabase)
   - ✅ Badge "Aguardando sincronização" **desaparece**
   - ✅ Botão "Finalizar Obra" **desaparece**

### Teste 3: Migração Inicial

1. **Limpar dados do app** (desinstalar e reinstalar)
2. **Fazer login**
3. **Verificar que obras migradas do Supabase**:
   - ✅ Aparecem com status correto ("Concluída" se estavam concluídas)
   - ✅ **NÃO** mostram "Aguardando sincronização"
   - ✅ **NÃO** mostram botão "Finalizar Obra" (se já finalizadas)

## 📊 Fluxo Correto Agora

### Obra Criada Offline

```
1. Criar obra no mobile
   ↓
2. Salvar no AsyncStorage: { origem: 'offline', synced: false }
   ↓
3. UI mostra: "Aguardando sincronização"
   ↓
4. Sincronizar com Supabase
   ↓
5. Atualizar AsyncStorage: { origem: 'online', synced: true }
   ↓
6. UI mostra: "Sincronizada ✓"
```

### Obra Migrada do Supabase

```
1. Fazer login
   ↓
2. AsyncStorage vazio → buscar do Supabase
   ↓
3. Salvar no AsyncStorage: { origem: 'online', synced: true }
   ↓
4. UI mostra: "Sincronizada ✓" (sem badge de aguardando)
```

### Obra Recuperada Manualmente

```
1. Abrir obra com status incorreto
   ↓
2. Clicar "Recuperar Fotos" → "☁️ Supabase"
   ↓
3. Buscar dados do Supabase
   ↓
4. Atualizar AsyncStorage: { origem: 'online', synced: true, status: 'finalizada' }
   ↓
5. UI atualiza: Status correto, sem botão "Finalizar Obra"
```

## 🎯 Verificações da UI

### Badge de Sincronização

**Arquivo**: `mobile/app/obra-detalhe.tsx` (linha 713)

```typescript
if (!obra || obra.origem !== 'offline') {
  return null; // ✅ Não mostra badge se origem === 'online'
}
```

**Comportamento Correto**:
- `origem: 'offline'` → Mostra "Aguardando sincronização"
- `origem: 'online'` → **NÃO** mostra badge
- `origem: undefined` → Mostra "Aguardando sincronização" (fallback)

### Botão "Finalizar Obra"

**Arquivo**: `mobile/app/obra-detalhe.tsx` (linha 863)

```typescript
{obra.status !== 'finalizada' && (() => {
  // ... renderiza botão
})()}
```

**Comportamento Correto**:
- `status: 'em_aberto'` → Mostra botão
- `status: 'finalizada'` → **NÃO** mostra botão
- `status: undefined` → Mostra botão (fallback para 'em_aberto')

## 📋 Arquivos Modificados

1. **`mobile/app/obra-detalhe.tsx`**:
   - Linhas 304-305: `loadObraData()` - preserva origem
   - Linhas 336-337: `refreshObraData()` - preserva origem

2. **`mobile/app/(tabs)/obras.tsx`**:
   - Linhas 82-84: `combinedObras` - preserva origem de pendentes
   - Linhas 89-91: `combinedObras` - preserva origem de sincronizadas
   - Linha 216: Migração inicial - define `origem: 'online'`

3. **`mobile/lib/offline-sync.ts`**:
   - Linha 537: `syncLocalObra()` - define `origem: 'online'` quando ID muda
   - Linha 548: `syncLocalObra()` - define `origem: 'online'` quando ID não muda
   - Linha 420: `updateObraInAsyncStorage()` - já estava correto

## 🔗 Relacionado

- [CORRECAO_STATUS_APOS_RECUPERACAO.md](./CORRECAO_STATUS_APOS_RECUPERACAO.md) - Correção do campo `status`
- [COMO_USAR_RECUPERAR_FOTOS.md](./COMO_USAR_RECUPERAR_FOTOS.md) - Guia de recuperação
- [OFFLINE_FIRST_IMPLEMENTACAO.md](./OFFLINE_FIRST_IMPLEMENTACAO.md) - Arquitetura offline-first

## ✅ Resultado Final

### ANTES das Correções:

```json
// AsyncStorage após sincronização
{
  "id": "uuid-xxxxx",
  "synced": true,
  "serverId": "uuid-xxxxx",
  // ❌ origem: undefined ou 'offline' (incorreto)
  "status": "finalizada"
}

// UI Mobile
- ❌ Mostra "Aguardando sincronização"
- ❌ Mostra botão "Finalizar Obra"
```

### DEPOIS das Correções:

```json
// AsyncStorage após sincronização
{
  "id": "uuid-xxxxx",
  "synced": true,
  "serverId": "uuid-xxxxx",
  "origem": "online", // ✅ CORRETO
  "status": "finalizada"
}

// UI Mobile
- ✅ Mostra "Sincronizada ✓"
- ✅ NÃO mostra botão "Finalizar Obra"
- ✅ Status "Concluída"
```

## 📝 Checklist de Verificação

Após as correções, verifique:

- [ ] Obras sincronizadas **não** mostram "Aguardando sincronização"
- [ ] Obras finalizadas **não** mostram botão "Finalizar Obra"
- [ ] Obras migradas do Supabase já vêm com status correto
- [ ] Recuperação manual atualiza status e origem corretamente
- [ ] Sincronização automática define `origem: 'online'`
- [ ] Listagem de obras mostra status correto
- [ ] Detalhes de obra mostram status correto

## 🚀 Próximos Passos

1. **Testar com obra 99998888** novamente
2. **Verificar que status está correto** após reabrir app
3. **Confirmar que sincronização automática funciona**
4. **Testar migração inicial** com novo usuário
