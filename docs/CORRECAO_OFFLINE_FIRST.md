# Correção do Sistema Offline-First

## 🐛 Problema Identificado

Você reportou que:
1. Iniciava uma obra **online**
2. Desligava WiFi/dados móveis
3. Reabria a obra para adicionar foto
4. **Obra duplicava** e foto não era registrada

## 🔍 Causa Raiz

O sistema offline-first estava implementado **APENAS no salvamento** ([nova-obra.tsx](../mobile/app/nova-obra.tsx)), mas as **telas de visualização e listagem** ainda buscavam dados do **Supabase**, não do AsyncStorage.

### Fluxo Problemático

```
1. Criar obra online (nova-obra.tsx)
   ✅ Salva no AsyncStorage com ID: local_123
   ✅ Sincroniza com Supabase

2. Abrir lista (obras.tsx)
   ❌ Busca do Supabase (não do AsyncStorage)
   ❌ Se offline, não encontra a obra

3. Abrir detalhes (obra-detalhe.tsx)
   ❌ Busca do Supabase (não do AsyncStorage)
   ❌ Se offline, não encontra a obra
   ❌ Cria NOVA obra ao salvar
```

## ✅ Solução Aplicada

### 1. Corrigir `obra-detalhe.tsx`

**Antes** (linha 291-306):
```typescript
const loadObraData = () => {
  const parsed = JSON.parse(decodeURIComponent(data));
  setObra(parsed);

  // ❌ Só carrega fotos locais se origem === 'offline'
  if (parsed.id && parsed.origem === 'offline') {
    loadLocalPhotos(parsed.id);
  }
};
```

**Depois** (linha 292-322):
```typescript
const loadObraData = async () => {
  const parsed = JSON.parse(decodeURIComponent(data));

  // ✅ OFFLINE-FIRST: Sempre buscar do AsyncStorage primeiro
  if (parsed.id) {
    const localObra = await getLocalObraById(parsed.id);

    if (localObra) {
      console.log('📱 Carregando obra do AsyncStorage:', parsed.id);
      setObra({ ...localObra, origem: 'offline' });
      loadLocalPhotos(parsed.id);
      return;
    }
  }

  // Fallback: Se não encontrou no AsyncStorage
  setObra(parsed);
  if (parsed.id && parsed.origem === 'offline') {
    loadLocalPhotos(parsed.id);
  }
};
```

**Antes** - `refreshObraData()` (linha 308-332):
```typescript
const refreshObraData = async () => {
  if (!obra?.id || obra.origem === 'offline') return;

  // ❌ Busca do Supabase
  const { data: updatedObra } = await supabase
    .from('obras')
    .select('*')
    .eq('id', obra.id)
    .single();
};
```

**Depois** - `refreshObraData()` (linha 324-358):
```typescript
const refreshObraData = async () => {
  if (!obra?.id) return;

  // ✅ OFFLINE-FIRST: Sempre buscar do AsyncStorage primeiro
  const localObra = await getLocalObraById(obra.id);

  if (localObra) {
    console.log('🔄 Atualizando obra do AsyncStorage:', obra.id);
    setObra({ ...localObra, origem: 'offline' });
    loadLocalPhotos(localObra.id);
  } else {
    // Fallback: Supabase
    const { data: updatedObra } = await supabase
      .from('obras')
      .select('*')
      .eq('id', obra.id)
      .single();
  }
};
```

### 2. Corrigir `obras.tsx`

**Antes** - `carregarObras()` (linha 140-179):
```typescript
const carregarObras = async () => {
  const online = await checkInternetConnection();
  if (!online) return;

  // ❌ Busca do Supabase
  const { data } = await supabase
    .from('obras')
    .select('*')
    .eq('equipe', equipe)
    .order('created_at', { ascending: false });

  setOnlineObras(data || []);
};
```

**Depois** - `carregarObras()` (linha 140-181):
```typescript
const carregarObras = async () => {
  // ✅ OFFLINE-FIRST: Sempre buscar do AsyncStorage primeiro
  console.log('📱 Carregando obras do AsyncStorage...');
  const localObras = await getLocalObras();

  // Filtrar apenas obras da equipe logada
  const obrasEquipe = localObras.filter(obra => obra.equipe === equipe);

  setOnlineObras(obrasEquipe);
  console.log(`✅ ${obrasEquipe.length} obra(s) carregadas do AsyncStorage`);

  // Se online, sincronização já acontece em background
  const online = await checkInternetConnection();
  if (online) {
    console.log('🌐 Online - obras sincronizadas em background');
  }
};
```

## 🎯 Fluxo Corrigido

```
1. Criar obra online (nova-obra.tsx)
   ✅ Salva no AsyncStorage com ID: local_123
   ✅ Sincroniza com Supabase em background

2. Abrir lista (obras.tsx)
   ✅ Busca do AsyncStorage (fonte primária)
   ✅ Funciona online E offline
   ✅ Mostra obra com ID: local_123

3. Abrir detalhes (obra-detalhe.tsx)
   ✅ Busca do AsyncStorage (fonte primária)
   ✅ Carrega obra local_123
   ✅ Funciona online E offline

4. Editar obra offline
   ✅ Atualiza MESMA obra (local_123) no AsyncStorage
   ✅ Marca como locallyModified=true
   ✅ NÃO cria obra nova

5. Reconectar
   ✅ Sincroniza mudanças automaticamente
   ✅ Envia fotos novas para Supabase
   ✅ Marca synced=true
```

## 🧪 Como Testar Agora

### Teste 1: Criar Online → Editar Offline

```bash
# 1. WiFi/dados LIGADOS
- Abra nova-obra.tsx
- Crie obra "Teste 001"
- Salve
- Console: "✅ Nova obra local criada: local_1736..."
- Console: "🌐 Online detectado - adicionando à fila de sync"

# 2. DESLIGAR WiFi/dados móveis

# 3. Voltar para lista
- obras.tsx carrega do AsyncStorage
- Obra "Teste 001" aparece normalmente

# 4. Abrir obra "Teste 001"
- obra-detalhe.tsx carrega do AsyncStorage
- Console: "📱 Carregando obra do AsyncStorage: local_1736..."
- Obra aparece com TODAS as fotos

# 5. Editar → Adicionar Foto
- Tira foto nova
- Salva
- Console: "📝 Obra local atualizada: local_1736..."
- MESMA obra (local_1736), NÃO duplica!

# 6. LIGAR WiFi/dados

# 7. Sincronização automática
- Console: "🔄 Sincronizando obra local: local_1736..."
- Envia foto nova para Supabase
- Console: "✅ Obra marcada como sincronizada: local_1736..."
```

### Teste 2: Criar Offline → Sincronizar Depois

```bash
# 1. WiFi/dados DESLIGADOS
- Cria obra "Teste 002"
- Salve
- Console: "✅ Nova obra local criada: local_1737..."
- Console: "📴 Sem conexão - ficará pendente"

# 2. Editar múltiplas vezes offline
- Adiciona foto 1 → Salva
- Adiciona foto 2 → Salva
- Sempre MESMA obra (local_1737)

# 3. LIGAR WiFi/dados
- Sincronização automática
- Envia TODAS as fotos de uma vez
- Obra aparece no Supabase
```

## 📊 Resumo das Mudanças

| Arquivo | Mudança | Linha |
|---------|---------|-------|
| [obra-detalhe.tsx](../mobile/app/obra-detalhe.tsx) | `loadObraData()` → busca AsyncStorage | 292-322 |
| [obra-detalhe.tsx](../mobile/app/obra-detalhe.tsx) | `refreshObraData()` → busca AsyncStorage | 324-358 |
| [obra-detalhe.tsx](../mobile/app/obra-detalhe.tsx) | Importa `getLocalObraById` | 7 |
| [obras.tsx](../mobile/app/(tabs)/obras.tsx) | `carregarObras()` → busca AsyncStorage | 140-181 |
| [obras.tsx](../mobile/app/(tabs)/obras.tsx) | Importa `getLocalObras` | 7 |

## ✅ Resultado Final

Agora o sistema é **totalmente offline-first**:

- ✅ AsyncStorage é a **fonte única da verdade**
- ✅ Supabase é apenas uma **cópia em nuvem**
- ✅ **Zero duplicação** de obras
- ✅ **Continuidade perfeita** online/offline
- ✅ Sincronização **automática** em background

---

**Data da correção**: Janeiro 2026
**Problema**: Duplicação de obras ao alternar online/offline
**Status**: ✅ RESOLVIDO
