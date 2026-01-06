# Indicadores de Sincronização nos Cards de Obras

## 🎯 Objetivo

Mostrar visualmente se cada obra foi sincronizada com o banco de dados (Supabase) ou está aguardando sincronização, independentemente do status da obra (rascunho ou finalizada).

## 📱 Visual dos Indicadores

### Obra Sincronizada

```
┌─────────────────────────────────────────────┐
│ Obra 12345678        [☁️ Sincronizada] 🟢  │
│ [⏸️ Rascunho]               05/01/2026      │
│                                              │
│ Responsável: João Silva                     │
│ Equipe: CNT 01                              │
│ Tipo: Emenda                                │
└─────────────────────────────────────────────┘
```

**Indicador**: `☁️ Sincronizada`
- **Cor**: Verde claro (#d1f4e0)
- **Borda**: Verde (#10b981)
- **Ícone**: ☁️ (nuvem)
- **Significado**: Obra já está no banco de dados Supabase

### Obra Aguardando Sincronização

```
┌─────────────────────────────────────────────┐
│ Obra 87654321    [📤 Aguardando sync] 🟡   │
│ [✓ Finalizada]              05/01/2026      │
│                                              │
│ Responsável: Maria Santos                   │
│ Equipe: CNT 02                              │
│ Tipo: Transformador                         │
└─────────────────────────────────────────────┘
```

**Indicador**: `📤 Aguardando sync`
- **Cor**: Amarelo claro (#fff3cd)
- **Borda**: Laranja (#ffc107)
- **Ícone**: 📤 (caixa de saída)
- **Significado**: Obra ainda não foi enviada ao banco de dados

## 🔄 Fluxo Completo do Usuário

### 1️⃣ Criar Nova Obra

```
USUÁRIO → Clica "➕ Nova Obra"
       ↓
Preenche formulário
       ↓
Escolhe uma opção:
  ├─ "⏸️ Pausar" (rascunho, pode continuar depois)
  └─ "✅ Finalizar" (completa, pronta)
       ↓
Obra salva LOCALMENTE no dispositivo
       ↓
Status: synced = false
       ↓
Card mostra: [📤 Aguardando sync] 🟡
```

**Importante**: A obra é salva PRIMEIRO no dispositivo (AsyncStorage), NÃO no banco de dados!

### 2️⃣ Ver Lista de Obras

```
LISTA DE OBRAS
├─ Obra 111 [📤 Aguardando sync] 🟡  ← Não sincronizada
├─ Obra 222 [☁️ Sincronizada] 🟢      ← Já está no banco
├─ Obra 333 [📤 Aguardando sync] 🟡  ← Não sincronizada
└─ Obra 444 [☁️ Sincronizada] 🟢      ← Já está no banco
```

**Visual claro**: Usuário vê rapidamente quais obras precisam ser sincronizadas.

### 3️⃣ Sincronizar com Banco de Dados

```
USUÁRIO → Clica "☁️ Sincronizar"
       ↓
Sistema mostra confirmação:
  "Sincronizar 2 obra(s) pendente(s)?
   [Cancelar] [Sincronizar]"
       ↓
USUÁRIO → Confirma "Sincronizar"
       ↓
Sistema processa cada obra:
  ├─ Envia dados para Supabase
  ├─ Faz upload das fotos
  ├─ Marca synced = true
  └─ Atualiza serverId
       ↓
Alerta: "✅ 2 obra(s) sincronizada(s)"
       ↓
Cards atualizam:
  [📤 Aguardando sync] → [☁️ Sincronizada]
```

**Resultado**: Obras agora estão no banco de dados Supabase e podem ser acessadas de qualquer dispositivo!

## 📊 Status Combinados

### Combinação 1: Rascunho + Não Sincronizada

```
┌─────────────────────────────────────────────┐
│ Obra 12345678    [📤 Aguardando sync] 🟡   │
│ [⏸️ Rascunho]               05/01/2026      │
│ │                                            │
│ ↳ Borda laranja                             │
└─────────────────────────────────────────────┘
```

- **Badge Status**: ⏸️ Rascunho (obra parcial)
- **Badge Sync**: 📤 Aguardando sync
- **Borda**: Laranja à esquerda (indica rascunho)
- **Significado**: Obra foi pausada e ainda não foi enviada ao banco

### Combinação 2: Rascunho + Sincronizada

```
┌─────────────────────────────────────────────┐
│ Obra 12345678        [☁️ Sincronizada] 🟢  │
│ [⏸️ Rascunho]               05/01/2026      │
│ │                                            │
│ ↳ Borda laranja                             │
└─────────────────────────────────────────────┘
```

- **Badge Status**: ⏸️ Rascunho (obra parcial)
- **Badge Sync**: ☁️ Sincronizada
- **Borda**: Laranja à esquerda (indica rascunho)
- **Significado**: Obra foi pausada mas JÁ foi enviada ao banco. Pode continuar editando e sincronizar novamente.

### Combinação 3: Finalizada + Não Sincronizada

```
┌─────────────────────────────────────────────┐
│ Obra 87654321    [📤 Aguardando sync] 🟡   │
│ [✓ Finalizada]              05/01/2026      │
└─────────────────────────────────────────────┘
```

- **Badge Status**: ✓ Finalizada (obra completa)
- **Badge Sync**: 📤 Aguardando sync
- **Significado**: Obra está completa mas ainda não foi enviada ao banco. PRECISA sincronizar!

### Combinação 4: Finalizada + Sincronizada

```
┌─────────────────────────────────────────────┐
│ Obra 87654321        [☁️ Sincronizada] 🟢  │
│ [✓ Finalizada]              05/01/2026      │
└─────────────────────────────────────────────┘
```

- **Badge Status**: ✓ Finalizada (obra completa)
- **Badge Sync**: ☁️ Sincronizada
- **Significado**: Obra está completa E já está no banco de dados. Tudo certo! ✅

## 🔑 Como Enviar Obra para o Banco de Dados

### Passo a Passo Completo

**1. Verificar Conexão**

```
ANTES DE SINCRONIZAR:
├─ ✅ WiFi ou dados móveis ligados
├─ ✅ Ícone "☁️ Sincronizar" habilitado (não cinza)
└─ ✅ Sem badge "📴 Modo Offline"
```

**2. Clicar no Botão Sincronizar**

```
Tela: Obras (lista)
Barra de Ações:
┌───────────┬──────────────┬─────────┐
│    ➕     │      ☁️      │   🔄    │
│   Nova    │ Sincronizar  │Atualizar│
│   Obra    │    ← AQUI    │         │
└───────────┴──────────────┴─────────┘
```

**3. Confirmar Sincronização**

```
Alerta:
┌─────────────────────────────────────────────┐
│  Sincronizar Obras                          │
│                                              │
│  Você tem 3 obra(s) pendente(s).            │
│                                              │
│  Deseja sincronizar agora?                  │
│                                              │
│  [Cancelar]          [Sincronizar]          │
└─────────────────────────────────────────────┘
```

**4. Aguardar Processamento**

```
Durante a sincronização:
├─ Spinner aparece no botão "☁️ Sincronizar"
├─ Botão fica desabilitado (não pode clicar)
└─ Sistema processa cada obra:
    ├─ Envia dados JSON para Supabase
    ├─ Faz upload de fotos para Storage
    └─ Marca obra como sincronizada
```

**5. Sucesso!**

```
Alerta:
┌─────────────────────────────────────────────┐
│  ✅ Sincronização Concluída                 │
│                                              │
│  3 obra(s) sincronizada(s) com sucesso!     │
│                                              │
│  [OK]                                       │
└─────────────────────────────────────────────┘

Lista atualiza automaticamente:
├─ Obra 111: [📤] → [☁️] (sincronizada!)
├─ Obra 222: [📤] → [☁️] (sincronizada!)
└─ Obra 333: [📤] → [☁️] (sincronizada!)
```

## ⚠️ Situações Especiais

### Sem Internet

```
Lista mostra:
┌─────────────────────────────────────────────┐
│  Obras                                      │
│  3 de 3 obra(s) cadastrada(s)               │
│  📴 Modo Offline                            │
│                                              │
│  ┌───────────┬──────────────┬─────────┐    │
│  │    ➕     │      ☁️      │   🔄    │    │
│  │   Nova    │ Sincronizar  │Atualizar│    │
│  │   Obra    │  (CINZA)     │         │    │
│  └───────────┴──────────────┴─────────┘    │
└─────────────────────────────────────────────┘
```

**Botão "Sincronizar" desabilitado**:
- Cor: Cinza (opacidade 50%)
- Não responde ao toque
- Volta a funcionar quando houver internet

**Obras criadas offline**:
- Salvam normalmente no dispositivo
- Aparecem com badge [📤 Aguardando sync]
- Quando internet voltar, basta clicar "Sincronizar"

### Erro na Sincronização

```
Se uma obra falhar:
├─ Sistema tenta próxima obra
├─ Ao final, mostra resumo:
│   "✅ 2 obra(s) sincronizada(s)
│    ❌ 1 obra(s) com erro"
└─ Obras com erro mantêm [📤 Aguardando sync]
    (pode tentar sincronizar novamente depois)
```

## 📁 Estrutura Técnica

### Propriedade `synced`

```typescript
interface LocalObra {
  id: string;
  synced: boolean;  // ← Indica se está no banco
  serverId?: string; // ← ID no Supabase (se sincronizada)
  status: 'rascunho' | 'finalizada';
  // ... outros campos
}
```

### Estados de Sincronização

```typescript
// Obra criada agora (ainda não foi ao banco)
{
  id: "local_1736123456789_abc123",
  synced: false,
  serverId: undefined,
  status: "rascunho"
}

// Obra sincronizada (já está no banco)
{
  id: "local_1736123456789_abc123",
  synced: true,
  serverId: "550e8400-e29b-41d4-a716-446655440000",
  status: "finalizada"
}
```

### Lógica de Renderização

```typescript
const isSynced = obra.synced === true;

{isSynced ? (
  // Badge verde "☁️ Sincronizada"
  <View style={styles.syncIndicatorSynced}>
    <Text>☁️</Text>
    <Text>Sincronizada</Text>
  </View>
) : (
  // Badge amarelo "📤 Aguardando sync"
  <View style={styles.syncIndicatorPending}>
    <Text>📤</Text>
    <Text>Aguardando sync</Text>
  </View>
)}
```

## 🎨 Design System

### Cores dos Indicadores

| Estado | Fundo | Borda | Texto | Ícone |
|--------|-------|-------|-------|-------|
| **Sincronizada** | #d1f4e0 (verde claro) | #10b981 (verde) | #059669 (verde escuro) | ☁️ |
| **Aguardando** | #fff3cd (amarelo claro) | #ffc107 (laranja) | #d97706 (laranja escuro) | 📤 |

### Posicionamento

```
Card da Obra:
┌─────────────────────────────────────────────┐
│                            [Indicador] ← Aqui│
│ Número da Obra              Data             │
│ [Status Badge]                               │
│                                              │
│ Informações da obra...                      │
└─────────────────────────────────────────────┘

Position: absolute
Top: 12px
Right: 12px
Z-index: 10 (fica sobre o card)
```

### Estilos

```typescript
syncIndicatorContainer: {
  position: 'absolute',
  top: 12,
  right: 12,
  zIndex: 10,
},
syncIndicatorSynced: {
  flexDirection: 'row',
  alignItems: 'center',
  backgroundColor: '#d1f4e0',
  borderRadius: 8,
  paddingHorizontal: 10,
  paddingVertical: 6,
  borderWidth: 1,
  borderColor: '#10b981',
},
syncIndicatorPending: {
  flexDirection: 'row',
  alignItems: 'center',
  backgroundColor: '#fff3cd',
  borderRadius: 8,
  paddingHorizontal: 10,
  paddingVertical: 6,
  borderWidth: 1,
  borderColor: '#ffc107',
},
```

## 📱 Arquivos Modificados

### [mobile/app/(tabs)/obras.tsx](../mobile/app/(tabs)/obras.tsx)

**Linhas 682-707**: Adiciona lógica de renderização do indicador de sync

```typescript
const isSynced = obra.synced === true;

return (
  <TouchableOpacity style={styles.obraCard}>
    {/* Indicador de Sincronização */}
    <View style={styles.syncIndicatorContainer}>
      {isSynced ? (
        <View style={styles.syncIndicatorSynced}>
          <Text style={styles.syncIndicatorIcon}>☁️</Text>
          <Text style={styles.syncIndicatorTextSynced}>Sincronizada</Text>
        </View>
      ) : (
        <View style={styles.syncIndicatorPending}>
          <Text style={styles.syncIndicatorIcon}>📤</Text>
          <Text style={styles.syncIndicatorTextPending}>Aguardando sync</Text>
        </View>
      )}
    </View>
    {/* Resto do card... */}
  </TouchableOpacity>
);
```

**Linhas 1100-1139**: Adiciona estilos dos indicadores

## 🧪 Como Testar

### Teste 1: Criar Obra Não Sincronizada

```bash
# 1. Nova Obra
# 2. Preencher dados
# 3. Clicar "✅ Finalizar"
   → Badge aparece: [📤 Aguardando sync] 🟡

# 4. Voltar para lista
   → ✅ Obra com badge amarelo [📤 Aguardando sync]
```

### Teste 2: Sincronizar Obra

```bash
# 1. Ter internet ativa
# 2. Clicar "☁️ Sincronizar"
   → Alerta: "Sincronizar 1 obra(s) pendente(s)?"

# 3. Confirmar "Sincronizar"
   → Spinner aparece
   → Processa...
   → Alerta: "✅ 1 obra(s) sincronizada(s)"

# 4. Verificar lista
   → ✅ Badge mudou: [📤] → [☁️ Sincronizada] 🟢
```

### Teste 3: Criar Obra Offline

```bash
# 1. Desligar WiFi/dados
   → Badge "📴 Modo Offline" aparece
   → Botão "Sincronizar" fica cinza

# 2. Nova Obra → Finalizar
   → Salva localmente
   → Badge: [📤 Aguardando sync] 🟡

# 3. Ligar WiFi/dados
   → Badge "📴 Modo Offline" desaparece
   → Botão "Sincronizar" fica ativo

# 4. Clicar "Sincronizar"
   → ✅ Obra vai para banco de dados
   → Badge muda: [📤] → [☁️]
```

### Teste 4: Editar Obra Sincronizada

```bash
# 1. Obra já sincronizada: [☁️ Sincronizada]
# 2. Abrir obra → Adicionar fotos → Salvar
   → Badge muda: [☁️] → [📤 Aguardando sync]
   → (porque foi modificada localmente)

# 3. Sincronizar novamente
   → ✅ Atualiza no banco
   → Badge volta: [📤] → [☁️ Sincronizada]
```

## 🎯 Benefícios

✅ **Transparência**: Usuário vê claramente quais obras precisam ser sincronizadas
✅ **Controle**: Usuário decide quando enviar obras ao banco
✅ **Offline-first**: Funciona sem internet, sincroniza quando tiver conexão
✅ **Visual claro**: Cores e ícones indicam status de sincronização
✅ **Independente de status**: Funciona para obras em rascunho ou finalizadas
✅ **Sempre visível**: Indicador aparece em TODOS os cards

## 📝 Resumo

| Badge | Significado | Ação Necessária |
|-------|-------------|-----------------|
| [☁️ Sincronizada] 🟢 | Obra está no banco de dados Supabase | Nenhuma (já está segura na nuvem) |
| [📤 Aguardando sync] 🟡 | Obra está APENAS no dispositivo | Clicar "☁️ Sincronizar" para enviar |

---

**Implementado em**: Janeiro 2026
**Status**: ✅ IMPLEMENTADO E DOCUMENTADO
**Problema resolvido**: Usuário agora vê claramente quais obras precisam ser sincronizadas
