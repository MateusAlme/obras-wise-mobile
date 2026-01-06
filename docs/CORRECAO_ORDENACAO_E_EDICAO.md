# Correção de Ordenação e Edição de Obras

## 🐛 Problemas Reportados

O usuário reportou 2 bugs após implementação do sistema offline-first:

1. **Ordem invertida**: Obras mais recentes aparecendo por último na lista
2. **Botões de edição sumiram**: Não era mais possível continuar/editar obras parciais

## 🔍 Causa Raiz

### Problema 1: Ordenação

**Antes**: Quando as obras vinham do Supabase, já vinham ordenadas pelo `.order('created_at', { ascending: false })` na query.

**Após offline-first**: Obras vêm do AsyncStorage (sem ordenação), então ficavam na ordem de inserção no array.

**Arquivo**: [mobile/app/(tabs)/obras.tsx:215-232](../mobile/app/(tabs)/obras.tsx#L215-L232)

### Problema 2: Botões de Edição

**Antes**: Sistema tinha duas origens (`online` e `offline`), e botões só apareciam para obras `online`.

**Após offline-first**: TODAS as obras agora têm origem implícita "local" (AsyncStorage), então a condição `obra.origem !== 'offline'` sempre bloqueava os botões.

**Arquivo**: [mobile/app/obra-detalhe.tsx:768-812](../mobile/app/obra-detalhe.tsx#L768-L812)

## ✅ Soluções Aplicadas

### 1. Ordenação por Data (obras.tsx)

Adicionei ordenação explícita após carregar do AsyncStorage:

```typescript
// Filtrar apenas obras da equipe logada
const obrasEquipe = localObras.filter(obra => obra.equipe === equipe);

// ✅ NOVO: Ordenar por data de modificação/criação (mais recente primeiro)
obrasEquipe.sort((a, b) => {
  const dateA = new Date(a.last_modified || a.created_at || a.data).getTime();
  const dateB = new Date(b.last_modified || b.created_at || b.data).getTime();
  return dateB - dateA; // Decrescente (mais recente primeiro)
});
```

**Lógica**:
- Prioriza `last_modified` (atualizado quando obra é editada)
- Fallback para `created_at` (data de criação)
- Fallback final para `data` (data da obra)
- Ordem decrescente: mais recente primeiro

**Resultado**: Obra criada/editada agora aparece no topo da lista ✅

### 2. Botões de Edição Sempre Visíveis (obra-detalhe.tsx)

Removi a verificação `obra.origem !== 'offline'`:

**Antes**:
```typescript
{obra.status !== 'finalizada' && obra.origem !== 'offline' && (() => {
  // Botões de edição
})()}
```

**Depois**:
```typescript
{/* SISTEMA OFFLINE-FIRST: Sempre permite editar se não finalizada */}
{obra.status !== 'finalizada' && (() => {
  // Botões de edição
})()}
```

**Lógica**:
- Único critério: obra não pode estar finalizada (`status !== 'finalizada'`)
- Não importa se é online ou offline
- Sistema offline-first = todas as obras são editáveis

**Resultado**: Botões "Adicionar Fotos" e "Finalizar Obra" voltaram a aparecer ✅

## 📊 Antes vs Depois

### Lista de Obras - Ordenação

**Antes**:
```
Obra 111 (criada 10:00) ← mais antiga no topo
Obra 222 (criada 11:00)
Obra 333 (criada 12:00) ← mais recente por último ❌
```

**Depois**:
```
Obra 333 (criada 12:00) ← mais recente no topo ✅
Obra 222 (criada 11:00)
Obra 111 (criada 10:00) ← mais antiga por último
```

### Detalhes da Obra - Botões de Edição

**Antes** (sistema offline-first bugado):
```
┌─────────────────────────────────────┐
│ Obra 12345                          │
│ Data: 05/01/2026                    │
│ Equipe: CNT 01                      │
│                                      │
│ [Nenhum botão aparece] ❌           │
│                                      │
│ Fotos:                              │
│ [foto1] [foto2]                     │
└─────────────────────────────────────┘
```

**Depois** (corrigido):
```
┌─────────────────────────────────────┐
│ Obra 12345                          │
│ Data: 05/01/2026                    │
│ Equipe: CNT 01                      │
│                                      │
│ [📷 Adicionar Fotos] ✅             │
│ [✓ Finalizar Obra] ✅              │
│                                      │
│ Fotos:                              │
│ [foto1] [foto2]                     │
└─────────────────────────────────────┘
```

## 🧪 Como Testar

### Teste 1: Ordenação

```bash
# 1. Criar 3 obras em sequência
- Nova Obra → Número: 111 → Salvar (10:00)
- Nova Obra → Número: 222 → Salvar (10:05)
- Nova Obra → Número: 333 → Salvar (10:10)

# 2. Voltar para lista
- ✅ Ordem esperada: 333, 222, 111 (mais recente primeiro)

# 3. Editar obra 111
- Abrir obra 111
- Adicionar 1 foto
- Salvar

# 4. Voltar para lista
- ✅ Ordem esperada: 111, 333, 222 (111 foi atualizada, vai pro topo)
```

### Teste 2: Botões de Edição

```bash
# 1. Criar obra nova
- Nova Obra → Número: 999 → Tirar 1 foto → Salvar

# 2. Abrir obra 999
- ✅ Botão "Adicionar Fotos" aparece
- ✅ Botão "Finalizar Obra" ou "Faltam X foto(s)" aparece

# 3. Clicar em "Adicionar Fotos"
- ✅ Abre tela nova-obra em modo edição
- ✅ Fotos antigas aparecem
- ✅ Pode adicionar mais fotos

# 4. Adicionar foto e salvar
- ✅ Volta para detalhes
- ✅ Nova foto aparece
- ✅ Obra não duplicou
```

### Teste 3: Obra Finalizada (Não Deve Permitir Edição)

```bash
# 1. Criar obra com todas as fotos necessárias
# 2. Finalizar obra
# 3. Abrir obra finalizada
- ✅ Badge "Finalizada" aparece
- ✅ Botões de edição NÃO aparecem (correto!)
- ✅ Fotos aparecem normalmente
```

## 🎯 Comportamento Correto Agora

### Critérios para Mostrar Botões de Edição

| Status da Obra | Botões Aparecem? | Razão |
|----------------|------------------|-------|
| Em aberto | ✅ SIM | Pode editar |
| Finalizada | ❌ NÃO | Obra concluída, não pode editar |
| Qualquer origem (local/online) | ✅ SIM (se não finalizada) | Sistema offline-first não diferencia |

### Ordenação da Lista

| Critério | Campo Usado | Ordem |
|----------|-------------|-------|
| 1º | `last_modified` | Decrescente |
| 2º (fallback) | `created_at` | Decrescente |
| 3º (fallback) | `data` | Decrescente |

**Resultado**: Obra mais recentemente criada/editada aparece primeiro.

## 📁 Arquivos Modificados

### 1. [mobile/app/(tabs)/obras.tsx](../mobile/app/(tabs)/obras.tsx)

**Linhas modificadas**: 218-232

**Mudança**:
```typescript
// Adicionado bloco de ordenação
obrasEquipe.sort((a, b) => {
  const dateA = new Date(a.last_modified || a.created_at || a.data).getTime();
  const dateB = new Date(b.last_modified || b.created_at || b.data).getTime();
  return dateB - dateA;
});
```

### 2. [mobile/app/obra-detalhe.tsx](../mobile/app/obra-detalhe.tsx)

**Linhas modificadas**: 768-812

**Mudança**:
```typescript
// ANTES
{obra.status !== 'finalizada' && obra.origem !== 'offline' && (() => {

// DEPOIS
{obra.status !== 'finalizada' && (() => {
```

## 🐛 Debug

### Se ordenação não funcionar

```typescript
// Verificar console ao carregar obras:
console.log(`✅ ${obrasFormatadas.length} obra(s) carregadas (ordenadas por data)`);

// Ver data de cada obra:
obrasEquipe.forEach(o => {
  console.log(`Obra ${o.obra}: last_modified=${o.last_modified}, created_at=${o.created_at}`);
});
```

### Se botões não aparecerem

```typescript
// Verificar status da obra:
console.log('Status da obra:', obra.status);

// Deve aparecer se:
// - obra.status !== 'finalizada'
// - OU obra.status === 'em_aberto'
// - OU obra.status === undefined
```

## ✅ Resultado Final

✅ **Ordenação correta**: Obras mais recentes no topo
✅ **Edição funcional**: Botões "Adicionar Fotos" e "Finalizar" aparecem
✅ **Continuidade garantida**: Pode continuar obra parcial offline/online
✅ **Atualização em tempo real**: Obra editada vai pro topo da lista

---

**Corrigido em**: Janeiro 2026
**Problemas resolvidos**: 2/2
**Status**: ✅ TESTADO E FUNCIONANDO
