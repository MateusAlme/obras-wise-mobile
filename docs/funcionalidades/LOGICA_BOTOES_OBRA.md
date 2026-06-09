# 🔘 Lógica dos Botões na Tela de Obra

## 📋 Visão Geral

Sistema de botões inteligente que adapta o texto e comportamento de acordo com o estado da obra (nova, rascunho, editando existente).

## 🎯 Três Botões Principais

### 1️⃣ Botão "Pausar"

**Quando aparece:** Sempre visível em qualquer modo

**O que faz:**
- Salva obra como rascunho em `AsyncStorage`
- Funciona **100% offline**
- Não envia para Supabase
- Fotos ficam no cache local

**Status da obra:** `rascunho` (local)

**Texto do botão:**
- Normal: **"Pausar"**
- Durante operação: **"Salvando..."**

**Código:** [nova-obra.tsx:6123-6129](mobile/app/nova-obra.tsx#L6123-L6129)

---

### 2️⃣ Botão "Finalizar / Criar Obra / Adicionar Fotos"

**Texto dinâmico baseado no contexto:**

#### Caso 1: Nova Obra
**Quando:** Criando obra pela primeira vez (não é edição)

**Texto:**
- Normal: **"Finalizar"**
- Durante operação: **"Finalizando..."**

**O que faz:**
1. Valida campos obrigatórios
2. Valida fotos obrigatórias (com opção de salvar parcial)
3. Faz upload das fotos para Supabase
4. Cria registro no banco de dados
5. Marca obra como finalizada

---

#### Caso 2: Rascunho Local
**Quando:** Editando rascunho salvo offline (obraId começa com `local_`)

**Texto:**
- Normal: **"Criar Obra"**
- Durante operação: **"Criando..."**

**O que faz:**
1. Valida campos obrigatórios
2. Valida fotos obrigatórias (com opção de salvar parcial)
3. Faz upload das fotos para Supabase
4. Cria registro no banco de dados (transforma rascunho em obra finalizada)
5. Remove rascunho local

---

#### Caso 3: Obra Existente (Adicionar Fotos)
**Quando:** Editando obra já finalizada no Supabase (obraId NÃO começa com `local_`)

**Texto:**
- Normal: **"Adicionar Fotos"**
- Durante operação: **"Adicionando..."**

**O que faz:**
1. Faz upload das novas fotos para Supabase
2. Atualiza registro da obra com as novas fotos
3. Mescla fotos antigas + novas fotos
4. Mantém status "finalizada"

---

### 3️⃣ Botão "Cancelar"

**Quando aparece:** Sempre visível

**O que faz:**
- Volta para tela anterior
- NÃO salva alterações
- Fotos tiradas permanecem no cache (não são deletadas)

---

## ⚙️ Lógica de Habilitação do Botão "Finalizar"

### Validações MÍNIMAS (Botão Habilitado)

Botão **"Finalizar/Criar Obra/Adicionar Fotos"** fica **HABILITADO** quando:

1. ✅ **Data** preenchida
2. ✅ **Número da Obra** preenchido (8 ou 10 dígitos)
3. ✅ **Responsável** selecionado
4. ✅ **Tipo de Serviço** selecionado
5. ✅ **Status do Transformador** selecionado (se serviço = Transformador)
6. ✅ **Status dos Postes** selecionados (se serviço = Checklist)

**Código:** [nova-obra.tsx:2693-2720](mobile/app/nova-obra.tsx#L2693-L2720)

```typescript
const calcularPodeFinalizar = (): boolean => {
  // Campos básicos
  if (!data || !obra || !responsavel || !tipoServico) {
    return false;
  }

  // Transformador: exigir status
  if (isServicoTransformador && !transformadorStatus) {
    return false;
  }

  // Checklist: exigir status de todos os postes
  if (isServicoChecklist && numPostes > 0) {
    for (const poste of fotosPostes) {
      if (!poste.status) {
        return false;
      }
    }
  }

  return true; // ✅ Habilitado
};
```

### Validações COMPLETAS (Ao Clicar)

Quando o usuário clica em **"Finalizar"**, são feitas validações adicionais:

#### Para Transformador:

**Se status = "Instalado":**
- 🔴 **Obrigatório:** 2 fotos de Conexões Primárias Instalado
- 🔴 **Obrigatório:** 2 fotos de Conexões Secundárias Instalado

**Se status = "Retirado":**
- 🔴 **Obrigatório:** 2 fotos de Conexões Primárias Retirado
- 🔴 **Obrigatório:** 2 fotos de Conexões Secundárias Retirado

**Comportamento:** Se faltam fotos, mostra alerta com opção **"Salvar Mesmo Assim"** (obra parcial).

---

#### Para Checklist de Fiscalização:

**Se poste status = "Instalado":**
- 🔴 **Obrigatório:** 1 foto Poste Inteiro
- 🔴 **Obrigatório:** 1 foto Engaste
- 🔴 **Obrigatório:** 1 foto Conexão 1
- 🔴 **Obrigatório:** 1 foto Conexão 2
- 🔴 **Obrigatório:** 2 fotos Maior Esforço
- 🔴 **Obrigatório:** 2 fotos Menor Esforço

**Se poste status = "Retirado":**
- 🔴 **Obrigatório:** 2 fotos Poste Inteiro

**Comportamento:** Se faltam fotos, mostra alerta com opção **"Salvar Mesmo Assim"** (obra parcial).

---

#### Para Outros Serviços:

- 🟡 **Opcional:** Todas as fotos (pode salvar sem fotos)
- ⚠️ **Aviso:** Se não houver nenhuma foto, mostra alerta perguntando se deseja continuar

---

## 🔄 Fluxos Completos

### Fluxo 1: Nova Obra Offline → Online

```
1. OFFLINE: Criar nova obra
   → Preencher campos
   → Tirar fotos
   → Clicar "Pausar"
   → ✅ Salvo como rascunho local

2. Fechar app / Continuar offline

3. ONLINE: Abrir rascunho
   → Adicionar mais fotos (opcional)
   → Clicar "Criar Obra"
   → ✅ Upload de fotos
   → ✅ Criada no Supabase
   → ✅ Rascunho removido
```

---

### Fluxo 2: Nova Obra Diretamente Online

```
1. ONLINE: Criar nova obra
   → Preencher campos
   → Tirar fotos
   → Clicar "Finalizar"
   → ✅ Upload de fotos
   → ✅ Salva no Supabase
```

---

### Fluxo 3: Adicionar Fotos em Obra Existente

```
1. ONLINE: Listar obras
   → Clicar em obra finalizada
   → Abrir tela de edição

2. ONLINE: Adicionar fotos
   → Tirar novas fotos
   → Botão mostra "Adicionar Fotos" ✅
   → Clicar "Adicionar Fotos"
   → ✅ Upload apenas das novas fotos
   → ✅ Atualiza obra no Supabase (mescla fotos antigas + novas)
```

---

## 🚦 Estados do Botão "Finalizar"

### Habilitado (Azul)
```
Condições:
✅ Campos básicos preenchidos
✅ Status selecionados (transformador/postes)
```

### Desabilitado (Cinza)
```
Condições:
❌ Falta data/obra/responsável/tipo
❌ Transformador sem status
❌ Checklist com postes sem status
```

### Durante Operação (Azul claro + Spinner)
```
Mostra:
- "Finalizando..." (nova obra)
- "Criando..." (rascunho)
- "Adicionando..." (obra existente)

Comportamento:
🔒 Botão bloqueado
🔒 Outros botões bloqueados
```

---

## 📊 Código Completo da Lógica

**Localização:** [nova-obra.tsx:6131-6174](mobile/app/nova-obra.tsx#L6131-L6174)

```typescript
{/* Botão Finalizar/Adicionar Fotos/Criar Obra - CONDICIONAL */}
{(() => {
  const podeFinalizarObra = calcularPodeFinalizar();
  const isRascunhoLocal = isEditMode && obraId?.startsWith('local_');
  const isObraExistente = isEditMode && !isRascunhoLocal;

  // Determinar texto do botão
  let botaoTexto = 'Finalizar';
  let botaoTextLoading = 'Finalizando...';

  if (isRascunhoLocal) {
    botaoTexto = 'Criar Obra';
    botaoTextLoading = 'Criando...';
  } else if (isObraExistente) {
    botaoTexto = 'Adicionar Fotos';
    botaoTextLoading = 'Adicionando...';
  }

  // Só mostra botão se validações básicas passaram
  if (podeFinalizarObra) {
    return (
      <TouchableOpacity
        style={[styles.finalizarButton, loading && styles.buttonDisabled]}
        onPress={handleSalvarObra}
        disabled={loading}
      >
        <Text style={styles.buttonText}>
          {loading ? botaoTextLoading : botaoTexto}
        </Text>
      </TouchableOpacity>
    );
  }
  return null;
})()}
```

---

## 🎯 Resumo Rápido

| Contexto | Botão Mostra | O Que Faz |
|----------|-------------|-----------|
| Nova obra | **"Finalizar"** | Cria no Supabase |
| Rascunho local | **"Criar Obra"** | Transforma rascunho em obra finalizada |
| Obra existente | **"Adicionar Fotos"** | Atualiza obra com novas fotos |
| Qualquer | **"Pausar"** | Salva rascunho offline |
| Qualquer | **"Cancelar"** | Volta sem salvar |

---

## ✅ Melhorias Implementadas

1. ✅ Botão "Finalizar" não exige mais todas as fotos obrigatórias antecipadamente
2. ✅ Validações ocorrem ao clicar (com opção de salvar parcial)
3. ✅ Texto do botão mudado para "Adicionar Fotos" ao editar obra existente
4. ✅ Lógica simplificada e mais intuitiva
5. ✅ Suporte a obras parciais (com avisos)

---

**Criado em:** 2025-01-08
**Última atualização:** 2025-01-08
