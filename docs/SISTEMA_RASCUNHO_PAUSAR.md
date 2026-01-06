# Sistema de Rascunho/Pausar Obras

## 🎯 Objetivo

Permitir que o usuário **pause** uma obra e **continue outro dia**, salvando o progresso parcial sem precisar preencher todos os campos obrigatórios.

## 💡 Caso de Uso

O usuário reportou:

> "o usuário pode começar a fazer o registro mais quando é quando ele pode da continuidade ainda no outro dia. Então é necessário fazer isso"

**Exemplo**:
1. Usuário começa uma obra às 16:00
2. Precisa parar (fim do expediente, falta de sinal, etc.)
3. **Pausa** a obra como rascunho
4. **Outro dia** abre o app, clica na obra e continua de onde parou

## ✅ Solução Implementada

### 3 Status de Obras

Agora as obras têm 3 status possíveis:

| Status | Descrição | Badge | Cor |
|--------|-----------|-------|-----|
| `rascunho` | Obra pausada, pode ter dados incompletos | ⏸️ Rascunho | Laranja (#f59e0b) |
| `em_aberto` | Obra salva com validações básicas | ⚠ Em aberto | Amarelo |
| `finalizada` | Obra completa e finalizada | ✓ Finalizada | Verde |

### 2 Botões na Tela de Nova Obra

**Interface**:
```
┌─────────────────────────────────────┐
│  Nova Obra                          │
│                                      │
│  [Campos do formulário...]          │
│                                      │
│  [⏸️ Pausar]  [Salvar Obra]         │
│     ↑              ↑                 │
│  Rascunho    Validações completas   │
│                                      │
│  [Cancelar]                         │
└─────────────────────────────────────┘
```

**Botão "⏸️ Pausar"**:
- Cor: Laranja (#f59e0b)
- Validações mínimas: data, número, responsável, tipo de serviço
- Salva status: `rascunho`
- Permite continuar depois

**Botão "Salvar Obra"**:
- Cor: Vermelho (#dc3545)
- Validações completas (fotos obrigatórias, etc.)
- Salva status: `em_aberto`
- Obra pronta para sincronização

## 🔄 Fluxo Completo

### Cenário 1: Pausar e Continuar

```
1️⃣ INICIAR OBRA
   ├─ Nova Obra
   ├─ Preenche: Data, Número, Responsável, Tipo
   ├─ Tira 1 foto
   └─ Clica "⏸️ Pausar"
      ├─ Alerta: "Salvar como rascunho?"
      ├─ Confirma: "Pausar"
      ├─ Status: 'rascunho'
      ├─ Console: "✅ Nova obra local criada: local_..."
      └─ Alerta: "⏸️ Rascunho Salvo
                   Obra pausada com 1 foto(s)
                   Continue mais tarde clicando na obra"

2️⃣ LISTA DE OBRAS
   ├─ Obra aparece com badge "⏸️ Rascunho"
   ├─ Borda laranja à esquerda
   └─ No topo da lista (mais recente)

3️⃣ CONTINUAR OUTRO DIA
   ├─ Abre app
   ├─ Clica na obra com badge "⏸️ Rascunho"
   ├─ Abre detalhes
   ├─ Clica "Adicionar Fotos"
   ├─ Tira mais fotos
   ├─ Agora clica "Salvar Obra" (validação completa)
   ├─ Status muda: 'rascunho' → 'em_aberto'
   └─ Badge muda: "⏸️ Rascunho" → "⚠ Em aberto"
```

### Cenário 2: Salvar Direto (Sem Pausar)

```
1️⃣ CRIAR OBRA COMPLETA
   ├─ Nova Obra
   ├─ Preenche TODOS os campos
   ├─ Tira TODAS as fotos obrigatórias
   └─ Clica "Salvar Obra"
      ├─ Validações completas passam
      ├─ Status: 'em_aberto'
      └─ Alerta: "✅ Obra Salva Localmente"

2️⃣ LISTA
   └─ Obra com badge "⚠ Em aberto"
```

## 📋 Validações

### Botão "⏸️ Pausar" (Rascunho)

**Campos obrigatórios**:
- ✅ Data
- ✅ Número da Obra
- ✅ Responsável
- ✅ Tipo de Serviço

**NÃO exige**:
- ❌ Fotos (pode ter 0 fotos)
- ❌ Validação de número de obra (formato)
- ❌ Equipe executora (COMP)
- ❌ Status do transformador
- ❌ Conexões de transformador

**Mensagem de erro** (se faltar):
```
Dados Incompletos

Para pausar, preencha pelo menos:
• Data
• Número da Obra
• Responsável
• Tipo de Serviço
```

### Botão "Salvar Obra" (Em Aberto)

**Validações completas**:
- ✅ Todos os campos do rascunho
- ✅ Número de obra: exatamente 8 ou 10 dígitos
- ✅ Equipe executora (se usuário COMP)
- ✅ Status do transformador (se serviço for Transformador)
- ✅ Fotos de conexões (aviso se incompleto, mas permite salvar)

## 🎨 Interface Visual

### Lista de Obras

**Obra em Rascunho**:
```
┌─────────────────────────────────────┐
│ Obra 12345678      05/01/2026       │
│ [⏸️ Rascunho]                       │
│                                      │
│ Responsável: João Silva             │
│ Equipe: CNT 01                      │
│ Tipo: Emenda                        │
└─────────────────────────────────────┘
  ↑
Borda laranja à esquerda (4px)
```

**Obra Em Aberto**:
```
┌─────────────────────────────────────┐
│ Obra 87654321      05/01/2026       │
│ [⚠ Em aberto]                       │
│                                      │
│ Responsável: Maria Santos           │
│ Equipe: CNT 02                      │
│ Tipo: Transformador                 │
└─────────────────────────────────────┘
```

**Obra Finalizada**:
```
┌─────────────────────────────────────┐
│ Obra 11111111      05/01/2026       │
│ [✓ Finalizada]                      │
│ Finalizada em 06/01/2026            │
│                                      │
│ Responsável: Pedro Costa            │
│ Equipe: CNT 03                      │
│ Tipo: Ditais                        │
└─────────────────────────────────────┘
```

### Tela de Detalhes

**Obra em Rascunho**:
- Badge: "⏸️ Rascunho"
- Botões aparecem: "Adicionar Fotos" e "Finalizar Obra"
- Pode editar normalmente

**Obra Em Aberto**:
- Badge: "⚠ Em aberto"
- Botões aparecem: "Adicionar Fotos" e "Finalizar Obra"
- Pode editar normalmente

**Obra Finalizada**:
- Badge: "✓ Finalizada"
- Botões NÃO aparecem
- Não pode editar (apenas visualizar)

## 💾 Estrutura de Dados

### LocalObra Interface

```typescript
interface LocalObra {
  id: string;
  status: 'rascunho' | 'em_aberto' | 'finalizada';
  data: string;
  obra: string;
  responsavel: string;
  equipe: string;
  tipo_servico: string;
  // ... outros campos
  synced: boolean;
  locallyModified: boolean;
  created_at: string;
  last_modified: string;
}
```

### Status no AsyncStorage

```json
{
  "id": "local_1736123456789_abc123",
  "status": "rascunho",
  "data": "2026-01-05",
  "obra": "12345678",
  "responsavel": "João Silva",
  "equipe": "CNT 01",
  "tipo_servico": "Emenda",
  "fotos_antes": ["photo_1"],
  "synced": false,
  "locallyModified": false,
  "created_at": "2026-01-05T14:30:00.000Z",
  "last_modified": "2026-01-05T14:30:00.000Z"
}
```

## 📁 Arquivos Modificados

### 1. [mobile/app/nova-obra.tsx](../mobile/app/nova-obra.tsx)

**Funções adicionadas**:
- `handlePausarObra()` (linhas 1676-1698): Nova função para pausar
- `prosseguirSalvamento(statusObra)` (linha 1700): Aceita parâmetro de status

**Mudanças**:
```typescript
// ANTES
const prosseguirSalvamento = async () => {
  // ...
  const localObraData = {
    ...obraData,
    id: finalObraId,
    // ...
  };
}

// DEPOIS
const prosseguirSalvamento = async (statusObra: 'em_aberto' | 'rascunho' = 'em_aberto') => {
  // ...
  const localObraData = {
    ...obraData,
    id: finalObraId,
    status: statusObra, // ✅ NOVO
    // ...
  };
}
```

**Interface** (linhas 5211-5231):
```typescript
<View style={styles.actionButtonsContainer}>
  <TouchableOpacity
    style={[styles.pauseButton, loading && styles.buttonDisabled]}
    onPress={handlePausarObra}
  >
    <Text style={styles.pauseButtonText}>⏸️ Pausar</Text>
  </TouchableOpacity>

  <TouchableOpacity
    style={[styles.button, loading && styles.buttonDisabled]}
    onPress={handleSalvarObra}
  >
    <Text style={styles.buttonText}>Salvar Obra</Text>
  </TouchableOpacity>
</View>
```

**Estilos** (linhas 6041-6072):
```typescript
actionButtonsContainer: {
  flexDirection: 'row',
  gap: 12,
  marginTop: 8,
},
pauseButton: {
  flex: 1,
  backgroundColor: '#f59e0b',
  borderRadius: 12,
  padding: 16,
  alignItems: 'center',
},
```

### 2. [mobile/app/(tabs)/obras.tsx](../mobile/app/(tabs)/obras.tsx)

**Renderização** (linhas 668-703):
```typescript
const isRascunho = obra.status === 'rascunho';

<TouchableOpacity
  style={[
    styles.obraCard,
    isFinalizada && styles.obraCardFinalizada,
    isRascunho && styles.obraCardRascunho // ✅ NOVO
  ]}
>
  {isRascunho && (
    <View style={styles.statusBadgeRascunho}>
      <Text style={styles.statusBadgeText}>⏸️ Rascunho</Text>
    </View>
  )}
</TouchableOpacity>
```

**Estilos** (linhas 1018-1027):
```typescript
statusBadgeRascunho: {
  backgroundColor: '#fef3c7',
  borderRadius: 8,
  paddingHorizontal: 10,
  paddingVertical: 4,
},
obraCardRascunho: {
  borderLeftWidth: 4,
  borderLeftColor: '#f59e0b',
},
```

## 🧪 Como Testar

### Teste 1: Pausar Obra Vazia

```bash
# 1. Nova Obra
# 2. Clica "⏸️ Pausar" SEM preencher nada
   → ❌ Alerta: "Dados Incompletos"
   → "Para pausar, preencha pelo menos..."

# 3. Preenche apenas: Data, Número, Responsável, Tipo
# 4. Clica "⏸️ Pausar"
   → ✅ Alerta: "Salvar como rascunho?"
# 5. Confirma "Pausar"
   → ✅ Salva com status='rascunho'
   → ✅ Alerta: "⏸️ Rascunho Salvo"
```

### Teste 2: Pausar e Continuar

```bash
# 1. Nova Obra
# 2. Preenche dados básicos
# 3. Tira 1 foto
# 4. Clica "⏸️ Pausar"
   → Salva como rascunho

# 5. Voltar para lista
   → ✅ Obra com badge "⏸️ Rascunho"
   → ✅ Borda laranja

# 6. Abrir obra (outro dia)
   → ✅ Badge "⏸️ Rascunho" aparece
   → ✅ Botões "Adicionar Fotos" e "Finalizar" aparecem

# 7. Adicionar mais fotos
# 8. Clica "Salvar Obra"
   → ✅ Validações completas
   → ✅ Status muda: 'rascunho' → 'em_aberto'
   → ✅ Badge muda: "⏸️" → "⚠"
```

### Teste 3: Rascunho vs Em Aberto

```bash
# 1. Criar 2 obras:
   - Obra A: Pausar (rascunho)
   - Obra B: Salvar completa (em_aberto)

# 2. Ver lista
   → Obra A: badge "⏸️ Rascunho", borda laranja
   → Obra B: badge "⚠ Em aberto", sem borda especial

# 3. Abrir ambas
   → Ambas permitem edição
   → Ambas podem ser finalizadas
```

## 🎯 Benefícios

✅ **Flexibilidade**: Usuário pode parar quando quiser
✅ **Sem perda de dados**: Rascunho salvo permanentemente
✅ **Continuidade**: Retoma de onde parou, outro dia
✅ **Visual claro**: Badge e cor mostram status
✅ **Validações inteligentes**: Menos rigorosas para rascunho
✅ **Offline-first**: Funciona sem internet

## 🔄 Transição de Status

```
┌─────────────┐
│  rascunho   │  ← Criar com "⏸️ Pausar"
└──────┬──────┘
       │
       │ Editar e "Salvar Obra" (validações completas)
       ↓
┌─────────────┐
│  em_aberto  │  ← Obra válida, aguardando finalização
└──────┬──────┘
       │
       │ Clicar "Finalizar Obra"
       ↓
┌─────────────┐
│ finalizada  │  ← Obra completa, não pode editar
└─────────────┘
```

**Observação**: Não é possível voltar de `em_aberto` para `rascunho`, nem de `finalizada` para `em_aberto`.

---

**Implementado em**: Janeiro 2026
**Status**: ✅ PRONTO PARA USAR
**Problema resolvido**: Usuário pode pausar e continuar obras em dias diferentes
