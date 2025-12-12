# Fluxos de Fotos por Tipo de Serviço

Este documento define quais fotos são obrigatórias para cada tipo de serviço.

## 📋 Tipos de Serviço

### 1. Emenda
**Fotos Obrigatórias:**
- ✅ Antes (mínimo 1 foto)
- ✅ Durante (mínimo 1 foto)
- ✅ Depois (mínimo 1 foto)

**Total mínimo:** 3 fotos

---

### 2. Bandolamento
**Fotos Obrigatórias:**
- ✅ Antes (mínimo 1 foto)
- ✅ Durante (mínimo 1 foto)
- ✅ Depois (mínimo 1 foto)

**Total mínimo:** 3 fotos

---

### 3. Aterramento
**Fotos Obrigatórias:**
- ✅ Antes (mínimo 1 foto)
- ✅ Durante (mínimo 1 foto)
- ✅ Depois (mínimo 1 foto)

**Total mínimo:** 3 fotos

---

### 4. Linha Viva
**Fotos Obrigatórias:**
- ✅ Antes (mínimo 1 foto)
- ✅ Durante (mínimo 1 foto)
- ✅ Depois (mínimo 1 foto)

**Total mínimo:** 3 fotos

---

### 5. Abertura e Fechamento de Chave
**Fotos Obrigatórias:**
- ✅ Abertura da Chave (mínimo 1 foto)
- ✅ Fechamento da Chave (mínimo 1 foto)

**Fotos NÃO utilizadas:** Antes, Durante, Depois

**Total mínimo:** 2 fotos

---

### 6. Ditais
**Fotos Obrigatórias (método DITAIS):**
- ✅ D - Desligar/Abertura (mínimo 1 foto)
- ✅ I - Impedir Religamento (mínimo 1 foto)
- ✅ T - Testar Ausência de Tensão (mínimo 1 foto)
- ✅ A - Aterrar (mínimo 1 foto)
- ✅ IS - Sinalizar/Isolar (mínimo 1 foto)

**Fotos NÃO utilizadas:** Antes, Durante, Depois

**Total mínimo:** 5 fotos

---

### 7. Book de Aterramento
**Fotos Obrigatórias:**
- ✅ Vala Aberta (mínimo 1 foto)
- ✅ Hastes Aplicadas (mínimo 1 foto)
- ✅ Vala Fechada (mínimo 1 foto)
- ✅ Medição com Terrômetro (mínimo 1 foto)

**Fotos NÃO utilizadas:** Antes, Durante, Depois

**Total mínimo:** 4 fotos

---

## 🔒 Regras de Validação

### Validação no momento de salvar obra:

1. **Verificar tipo de serviço selecionado**
2. **Validar que TODAS as fotos obrigatórias do serviço foram tiradas**
3. **Bloquear salvamento se alguma foto obrigatória estiver faltando**
4. **Mostrar mensagem específica indicando qual(is) foto(s) falta(m)**

### Exemplos de mensagens de erro:

- "Para o serviço 'Emenda', você precisa tirar pelo menos 1 foto Antes, 1 Durante e 1 Depois"
- "Para o serviço 'Ditais', você precisa tirar todas as 5 fotos do método DITAIS"
- "Para o serviço 'Book de Aterramento', faltam fotos: Vala Aberta, Medição"

---

## 💾 Estrutura de Dados no Banco

Todas as fotos são salvas como JSONB com o seguinte formato:

```json
[
  {
    "url": "https://...",
    "latitude": -23.550520,
    "longitude": -46.633308
  }
]
```

### Colunas na tabela `obras`:

**Serviços padrão (Emenda, Bandolamento, Aterramento, Linha Viva):**
- `fotos_antes` (JSONB)
- `fotos_durante` (JSONB)
- `fotos_depois` (JSONB)

**Abertura e Fechamento de Chave:**
- `fotos_abertura` (JSONB)
- `fotos_fechamento` (JSONB)

**Ditais:**
- `fotos_ditais_abertura` (JSONB)
- `fotos_ditais_impedir` (JSONB)
- `fotos_ditais_testar` (JSONB)
- `fotos_ditais_aterrar` (JSONB)
- `fotos_ditais_sinalizar` (JSONB)

**Book de Aterramento:**
- `fotos_aterramento_vala_aberta` (JSONB)
- `fotos_aterramento_hastes` (JSONB)
- `fotos_aterramento_vala_fechada` (JSONB)
- `fotos_aterramento_medicao` (JSONB)
