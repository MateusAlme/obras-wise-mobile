# Fluxo Pausar/Finalizar - Simplificado

## 🎯 Conceito

Sistema simplificado com apenas **2 botões**:

| Botão | Cor | Função | Validações |
|-------|-----|--------|------------|
| **⏸️ Pausar** | 🟠 Laranja | Salva rascunho para continuar depois | Mínimas |
| **✅ Finalizar** | 🟢 Verde | Finaliza obra completa | Completas |

## ❌ O Que Mudou

**Antes** (3 botões confusos):
```
[Pausar] [Salvar Obra] [Cancelar]
   ↓          ↓             ↓
Rascunho  Em Aberto     Descarta
```

**Depois** (2 botões claros):
```
[⏸️ Pausar] [✅ Finalizar] [Cancelar]
      ↓            ↓            ↓
  Rascunho    Finalizada    Descarta
```

**Razão**: O botão "Salvar Obra" era redundante. Se o usuário quer salvar sem finalizar, usa "Pausar". Se quer finalizar, usa "Finalizar".

## 📱 Interface

```
┌─────────────────────────────────────┐
│  Nova Obra                          │
│                                      │
│  Data: [05/01/2026]                 │
│  Número: [12345678]                 │
│  Responsável: [João Silva]          │
│  Tipo: [Emenda]                     │
│                                      │
│  Fotos:                             │
│  [📷 Tirar Foto]                    │
│  [foto1] [foto2]                    │
│                                      │
│  ┌──────────────┬─────────────────┐ │
│  │ ⏸️ Pausar    │ ✅ Finalizar    │ │
│  │   (Laranja)  │   (Verde)       │ │
│  └──────────────┴─────────────────┘ │
│                                      │
│  [Cancelar]                         │
└─────────────────────────────────────┘
```

## 🔄 Fluxos de Uso

### Fluxo 1: Pausar e Continuar Depois

```
DIA 1 - INÍCIO (16:00)
├─ Nova Obra
├─ Preenche: Data, Número, Responsável, Tipo
├─ Tira 2 fotos
├─ Precisa parar (fim do expediente)
└─ Clica "⏸️ Pausar"
   ├─ Validações mínimas ✅
   ├─ Salva status: 'rascunho'
   └─ Alerta: "⏸️ Rascunho Salvo
               Continue mais tarde clicando na obra"

LISTA
└─ Obra 12345678 [⏸️ Rascunho] 🟠 (borda laranja)

DIA 2 - CONTINUAÇÃO (08:00)
├─ Abre app
├─ Clica obra 12345678
├─ Vê badge "⏸️ Rascunho"
├─ Clica "Adicionar Fotos"
├─ Tira mais 3 fotos
├─ Agora está completa
└─ Clica "✅ Finalizar"
   ├─ Validações completas ✅
   ├─ Status: 'rascunho' → 'finalizada'
   └─ Alerta: "✅ Obra Finalizada"

LISTA
└─ Obra 12345678 [✓ Finalizada] 🟢 (não pode mais editar)
```

### Fluxo 2: Finalizar Direto (Sem Pausar)

```
MESMO DIA - OBRA COMPLETA
├─ Nova Obra
├─ Preenche TUDO
├─ Tira TODAS as fotos
└─ Clica "✅ Finalizar"
   ├─ Validações completas ✅
   ├─ Status: 'finalizada'
   └─ Alerta: "✅ Obra Finalizada"

LISTA
└─ Obra 87654321 [✓ Finalizada] 🟢
```

### Fluxo 3: Pausar Várias Vezes

```
DIA 1
├─ Cria obra → Pausa (2 fotos)
└─ Status: 'rascunho'

DIA 2
├─ Abre obra → Adiciona 1 foto → Pausa
└─ Status: 'rascunho' (ainda!)

DIA 3
├─ Abre obra → Adiciona 2 fotos → Pausa
└─ Status: 'rascunho' (ainda!)

DIA 4
├─ Abre obra → Adiciona fotos finais
└─ Clica "✅ Finalizar"
   └─ Status: 'finalizada'
```

## ✅ Validações

### Botão "⏸️ Pausar"

**Campos obrigatórios**:
- ✅ Data
- ✅ Número da Obra
- ✅ Responsável
- ✅ Tipo de Serviço

**NÃO exige**:
- ❌ Fotos (pode pausar com 0 fotos)
- ❌ Formato do número (não valida 8/10 dígitos)
- ❌ Campos específicos do tipo de serviço

**Mensagem de erro**:
```
Dados Incompletos

Para pausar, preencha pelo menos:
• Data
• Número da Obra
• Responsável
• Tipo de Serviço
```

### Botão "✅ Finalizar"

**Validações completas**:
- ✅ Todos os campos do pausar
- ✅ Número da obra: EXATAMENTE 8 ou 10 dígitos numéricos
- ✅ Equipe executora (se usuário COMP)
- ✅ Status do transformador (se serviço Transformador)
- ✅ Fotos de conexões (aviso se incompleto)
- ✅ Todas as fotos obrigatórias do tipo de serviço

**Mensagens de erro** (exemplos):
```
Número da Obra Inválido

O número deve ter EXATAMENTE 8 ou 10 dígitos.
Exemplos:
• 8 dígitos: 12345678
• 10 dígitos: 0032401637
```

```
Obra Incompleta

Faltam fotos obrigatórias:
- Conexões Primárias: 1/2 fotos

Você pode:
[Cancelar] [Salvar Mesmo Assim]
```

## 📊 Status da Obra

### 3 Estados Possíveis

```
┌─────────────┐
│  rascunho   │  ← Clicou "⏸️ Pausar"
│             │    Badge: ⏸️ Rascunho
│             │    Cor: 🟠 Laranja
└──────┬──────┘
       │
       │ Editar e clicar "✅ Finalizar"
       ↓
┌─────────────┐
│ finalizada  │  ← Clicou "✅ Finalizar"
│             │    Badge: ✓ Finalizada
│             │    Cor: 🟢 Verde
└─────────────┘
```

**Observação**: Não existe mais o status `em_aberto`. Apenas `rascunho` ou `finalizada`.

### Comportamentos por Status

| Status | Pode Editar? | Pode Finalizar? | Badge | Borda |
|--------|--------------|-----------------|-------|-------|
| 🟠 **rascunho** | ✅ Sim | ✅ Sim | ⏸️ Rascunho | Laranja |
| 🟢 **finalizada** | ❌ Não | ❌ Não | ✓ Finalizada | - |

## 💬 Mensagens ao Usuário

### Ao Pausar

```
⏸️ Rascunho Salvo

Obra pausada com 3 foto(s) protegida(s).

✅ Backup permanente no dispositivo
📝 Continue mais tarde clicando na obra

[OK]
```

### Ao Finalizar

```
✅ Obra Finalizada

Obra finalizada com 12 foto(s) protegida(s).

✅ Todos os arquivos têm backup permanente no dispositivo
☁️ Use o botão "Sincronizar" para enviar para a nuvem

[OK]
```

### Tentativa de Pausar sem Dados Mínimos

```
Dados Incompletos

Para pausar, preencha pelo menos:
• Data
• Número da Obra
• Responsável
• Tipo de Serviço

[OK]
```

### Tentativa de Finalizar com Número Inválido

```
Número da Obra Inválido

O número da obra deve conter EXATAMENTE 8 ou 10 dígitos numéricos.

Exemplos:
• 8 dígitos: 12345678
• 10 dígitos: 0032401637

[OK]
```

## 🎨 Cores e Ícones

| Botão | Cor | Código | Ícone | Significado |
|-------|-----|--------|-------|-------------|
| **Pausar** | 🟠 Laranja | #f59e0b | ⏸️ | Pausa temporária, pode continuar |
| **Finalizar** | 🟢 Verde | #10b981 | ✅ | Completo, pronto para sincronizar |
| **Cancelar** | ⚪ Cinza | #666 | - | Descartar mudanças |

**Desabilitado**: Opacidade 0.5 (50% transparente)

## 📁 Arquivos Modificados

### [mobile/app/nova-obra.tsx](../mobile/app/nova-obra.tsx)

**Função renomeada**:
```typescript
// ANTES
const handleSalvarObra = async () => {
  // ...
  await prosseguirSalvamento(); // status: 'em_aberto'
}

// DEPOIS
const handleFinalizarObra = async () => {
  // ...
  await prosseguirSalvamento('finalizada'); // status: 'finalizada'
}
```

**Assinatura modificada**:
```typescript
// ANTES
const prosseguirSalvamento = async (
  statusObra: 'em_aberto' | 'rascunho' = 'em_aberto'
) => {

// DEPOIS
const prosseguirSalvamento = async (
  statusObra: 'em_aberto' | 'rascunho' | 'finalizada' = 'em_aberto'
) => {
```

**Interface** (linhas 5217-5237):
```typescript
<View style={styles.actionButtonsContainer}>
  <TouchableOpacity
    style={[styles.pauseButton, loading && styles.buttonDisabled]}
    onPress={handlePausarObra}
  >
    <Text style={styles.pauseButtonText}>⏸️ Pausar</Text>
  </TouchableOpacity>

  <TouchableOpacity
    style={[styles.finalizarButton, loading && styles.buttonDisabled]}
    onPress={handleFinalizarObra}
  >
    <Text style={styles.finalizarButtonText}>
      {loading ? 'Finalizando...' : '✅ Finalizar'}
    </Text>
  </TouchableOpacity>
</View>
```

**Estilos** (linhas 6052-6075):
```typescript
pauseButton: {
  flex: 1,
  backgroundColor: '#f59e0b', // Laranja
  borderRadius: 12,
  padding: 16,
  alignItems: 'center',
},
finalizarButton: {
  flex: 1,
  backgroundColor: '#10b981', // Verde
  borderRadius: 12,
  padding: 16,
  alignItems: 'center',
},
```

## 🧪 Como Testar

### Teste 1: Pausar sem Dados

```bash
# 1. Nova Obra
# 2. Clica "⏸️ Pausar" SEM preencher nada
   → ❌ Alerta: "Dados Incompletos"

# 3. Preenche: Data, Número, Responsável, Tipo
# 4. Clica "⏸️ Pausar"
   → ✅ Alerta: "⏸️ Rascunho Salvo"
```

### Teste 2: Finalizar sem Validações

```bash
# 1. Nova Obra
# 2. Preenche dados básicos
# 3. Número: "123" (inválido)
# 4. Clica "✅ Finalizar"
   → ❌ Alerta: "Número da Obra Inválido"

# 5. Corrige número: "12345678"
# 6. Clica "✅ Finalizar"
   → ✅ Alerta: "✅ Obra Finalizada"
```

### Teste 3: Pausar → Editar → Finalizar

```bash
# 1. Nova Obra
# 2. Preenche dados
# 3. Tira 1 foto
# 4. Clica "⏸️ Pausar"
   → Status: 'rascunho'
   → Badge: ⏸️ Rascunho

# 5. Volta para lista
   → ✅ Obra com borda laranja

# 6. Abre obra
# 7. Adiciona mais fotos
# 8. Clica "✅ Finalizar"
   → Status: 'rascunho' → 'finalizada'
   → Badge: ⏸️ → ✓

# 9. Volta para lista
   → ✅ Obra com badge verde
   → ❌ Não pode mais editar
```

## 🎯 Benefícios

✅ **Mais simples**: 2 botões ao invés de 3
✅ **Mais claro**: Pausar = rascunho, Finalizar = pronto
✅ **Menos confusão**: Sem status "em_aberto" intermediário
✅ **Fluxo natural**: Pausa quantas vezes quiser, finaliza quando estiver pronto
✅ **Visual claro**: Cores indicam intenção (laranja = temporário, verde = completo)

## 📝 Resumo

| Ação | Botão | Status Resultante | Validações |
|------|-------|-------------------|------------|
| Começou mas precisa parar | ⏸️ Pausar | rascunho | Mínimas |
| Obra completa, pronta | ✅ Finalizar | finalizada | Completas |
| Desistir | Cancelar | - | - |

---

**Implementado em**: Janeiro 2026
**Status**: ✅ SIMPLIFICADO E FUNCIONAL
**Problema resolvido**: Eliminado botão "Salvar Obra" redundante
