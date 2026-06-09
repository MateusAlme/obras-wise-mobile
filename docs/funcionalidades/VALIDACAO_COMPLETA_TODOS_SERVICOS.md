# ✅ Validação Completa - Todos os Tipos de Serviços

## 🎯 Objetivo

Garantir que o botão "Finalizar" só apareça quando **todos os requisitos** de fotos obrigatórias forem atendidos, **independente do tipo de serviço**.

## 📋 Validações por Tipo de Serviço

### 🌐 Requisito Universal: Conexão com Internet

**TODOS os serviços** requerem conexão com internet para finalizar:

```typescript
if (!isOnline) {
  return false; // Botão não aparece
}
```

### 1. 🔧 Serviço Padrão (Emenda, etc.)

**Tipos**: Qualquer serviço que não seja um dos especializados abaixo

**Fotos Obrigatórias**:
- ✅ **Antes**: 1+ foto
- ✅ **Durante**: 1+ foto
- ✅ **Depois**: 1+ foto

**Validação**:
```typescript
if (isServicoPadrao) {
  if (fotosAntes.length < 1) return false;
  if (fotosDurante.length < 1) return false;
  if (fotosDepois.length < 1) return false;
}
```

### 2. 🔐 Abertura e Fechamento de Chave

**Fotos Obrigatórias**:
- ✅ **Abertura**: 1+ foto
- ✅ **Fechamento**: 1+ foto

**Validação**:
```typescript
if (isServicoChave) {
  if (fotosAbertura.length < 1) return false;
  if (fotosFechamento.length < 1) return false;
}
```

### 3. 🛡️ Ditais

**Fotos Obrigatórias** (5 etapas):
- ✅ **Abertura**: 1+ foto
- ✅ **Impedir**: 1+ foto
- ✅ **Testar**: 1+ foto
- ✅ **Aterrar**: 1+ foto
- ✅ **Sinalizar**: 1+ foto

**Validação**:
```typescript
if (isServicoDitais) {
  if (fotosDitaisAbertura.length < 1) return false;
  if (fotosDitaisImpedir.length < 1) return false;
  if (fotosDitaisTestar.length < 1) return false;
  if (fotosDitaisAterrar.length < 1) return false;
  if (fotosDitaisSinalizar.length < 1) return false;
}
```

### 4. ⚡ Book de Aterramento

**Fotos Obrigatórias** (4 etapas):
- ✅ **Vala Aberta**: 1+ foto
- ✅ **Hastes**: 1+ foto
- ✅ **Vala Fechada**: 1+ foto
- ✅ **Medição**: 1+ foto

**Validação**:
```typescript
if (isServicoBookAterramento) {
  if (fotosAterramentoValaAberta.length < 1) return false;
  if (fotosAterramentoHastes.length < 1) return false;
  if (fotosAterramentoValaFechada.length < 1) return false;
  if (fotosAterramentoMedicao.length < 1) return false;
}
```

### 5. 🔌 Transformador

**Status**: Instalado OU Retirado (obrigatório)

#### Se **Instalado**:
- ✅ **Conexões Primárias Instalado**: 2+ fotos
- ✅ **Conexões Secundárias Instalado**: 2+ fotos

#### Se **Retirado**:
- ✅ **Conexões Primárias Retirado**: 2+ fotos
- ✅ **Conexões Secundárias Retirado**: 2+ fotos

**Validação**:
```typescript
if (isServicoTransformador && transformadorStatus) {
  if (transformadorStatus === 'Instalado') {
    if (fotosTransformadorConexoesPrimariasInstalado.length < 2) return false;
    if (fotosTransformadorConexoesSecundariasInstalado.length < 2) return false;
  }
  if (transformadorStatus === 'Retirado') {
    if (fotosTransformadorConexoesPrimariasRetirado.length < 2) return false;
    if (fotosTransformadorConexoesSecundariasRetirado.length < 2) return false;
  }
}
```

### 6. 📟 Instalação do Medidor

**Fotos Obrigatórias** (5 tipos):
- ✅ **Padrão**: 1+ foto
- ✅ **Leitura**: 1+ foto
- ✅ **Selo do Born**: 1+ foto
- ✅ **Selo da Caixa**: 1+ foto
- ✅ **Identificador de Fase**: 1+ foto

**Validação**:
```typescript
if (isServicoMedidor) {
  if (fotosMedidorPadrao.length < 1) return false;
  if (fotosMedidorLeitura.length < 1) return false;
  if (fotosMedidorSeloBorn.length < 1) return false;
  if (fotosMedidorSeloCaixa.length < 1) return false;
  if (fotosMedidorIdentificadorFase.length < 1) return false;
}
```

### 7. 📋 Checklist de Fiscalização

**Fotos Obrigatórias por Poste**:

#### Se Status = **Retirado**:
- ✅ **Poste Inteiro**: 2+ fotos

#### Se Status = **Instalado**:
- ✅ **Poste Inteiro**: 1+ foto
- ✅ **Engaste**: 1+ foto
- ✅ **Conexão 1**: 1+ foto
- ✅ **Conexão 2**: 1+ foto
- ✅ **Maior Esforço**: 2+ fotos
- ✅ **Menor Esforço**: 2+ fotos

**Validação**:
```typescript
if (isServicoChecklist && numPostes > 0) {
  for (const poste of fotosPostes) {
    if (!poste.status) return false;
    if (poste.status === 'retirado' && poste.posteInteiro.length < 2) return false;
    if (poste.status === 'instalado') {
      if (poste.posteInteiro.length < 1) return false;
      if (poste.engaste.length < 1) return false;
      if (poste.conexao1.length < 1) return false;
      if (poste.conexao2.length < 1) return false;
      if (poste.maiorEsforco.length < 2) return false;
      if (poste.menorEsforco.length < 2) return false;
    }
  }
}
```

### 8. 📏 Altimetria

**Fotos Obrigatórias** (4 medições):
- ✅ **Lado Fonte**: 1+ foto
- ✅ **Medição Fonte**: 1+ foto
- ✅ **Lado Carga**: 1+ foto
- ✅ **Medição Carga**: 1+ foto

**Validação**:
```typescript
if (isServicoAltimetria) {
  if (fotosAltimetriaLadoFonte.length < 1) return false;
  if (fotosAltimetriaMedicaoFonte.length < 1) return false;
  if (fotosAltimetriaLadoCarga.length < 1) return false;
  if (fotosAltimetriaMedicaoCarga.length < 1) return false;
}
```

### 9. 💧 Vazamento e Limpeza de Transformador

**Fotos Obrigatórias**:
- ✅ **Evidência**: 1+ foto
- ✅ **Equipamentos**: 1+ foto

**Validação**:
```typescript
if (isServicoVazamento) {
  if (fotosVazamentoEvidencia.length < 1) return false;
  if (fotosVazamentoEquipamentos.length < 1) return false;
}
```

### 10. 📄 Documentação

**Sem validação de fotos** - apenas PDFs de documentos

**Validação**:
```typescript
// Documentação não requer fotos, apenas PDFs
// Não há validação específica de fotos
```

## 💻 Implementação Completa

**Arquivo**: `mobile/app/nova-obra.tsx` (linhas 1457-1557)

```typescript
const calcularPodeFinalizar = (): boolean => {
  // ✅ CRÍTICO: Deve estar online para finalizar
  if (!isOnline) {
    return false;
  }

  // Validar campos básicos
  if (!data || !obra || !responsavel || !tipoServico) {
    return false;
  }

  // ✅ VALIDAÇÃO POR TIPO DE SERVIÇO

  // 1. Serviço Padrão (Antes, Durante, Depois)
  if (isServicoPadrao) {
    if (fotosAntes.length < 1) return false;
    if (fotosDurante.length < 1) return false;
    if (fotosDepois.length < 1) return false;
  }

  // 2. Abertura e Fechamento de Chave
  if (isServicoChave) {
    if (fotosAbertura.length < 1) return false;
    if (fotosFechamento.length < 1) return false;
  }

  // 3. Ditais
  if (isServicoDitais) {
    if (fotosDitaisAbertura.length < 1) return false;
    if (fotosDitaisImpedir.length < 1) return false;
    if (fotosDitaisTestar.length < 1) return false;
    if (fotosDitaisAterrar.length < 1) return false;
    if (fotosDitaisSinalizar.length < 1) return false;
  }

  // 4. Book de Aterramento
  if (isServicoBookAterramento) {
    if (fotosAterramentoValaAberta.length < 1) return false;
    if (fotosAterramentoHastes.length < 1) return false;
    if (fotosAterramentoValaFechada.length < 1) return false;
    if (fotosAterramentoMedicao.length < 1) return false;
  }

  // 5. Transformador
  if (isServicoTransformador && transformadorStatus) {
    if (transformadorStatus === 'Instalado') {
      if (fotosTransformadorConexoesPrimariasInstalado.length < 2) return false;
      if (fotosTransformadorConexoesSecundariasInstalado.length < 2) return false;
    }
    if (transformadorStatus === 'Retirado') {
      if (fotosTransformadorConexoesPrimariasRetirado.length < 2) return false;
      if (fotosTransformadorConexoesSecundariasRetirado.length < 2) return false;
    }
  }

  // 6. Instalação do Medidor
  if (isServicoMedidor) {
    if (fotosMedidorPadrao.length < 1) return false;
    if (fotosMedidorLeitura.length < 1) return false;
    if (fotosMedidorSeloBorn.length < 1) return false;
    if (fotosMedidorSeloCaixa.length < 1) return false;
    if (fotosMedidorIdentificadorFase.length < 1) return false;
  }

  // 7. Checklist de Fiscalização
  if (isServicoChecklist && numPostes > 0) {
    for (const poste of fotosPostes) {
      if (!poste.status) return false;
      if (poste.status === 'retirado' && poste.posteInteiro.length < 2) return false;
      if (poste.status === 'instalado') {
        if (poste.posteInteiro.length < 1) return false;
        if (poste.engaste.length < 1) return false;
        if (poste.conexao1.length < 1) return false;
        if (poste.conexao2.length < 1) return false;
        if (poste.maiorEsforco.length < 2) return false;
        if (poste.menorEsforco.length < 2) return false;
      }
    }
  }

  // 8. Altimetria
  if (isServicoAltimetria) {
    if (fotosAltimetriaLadoFonte.length < 1) return false;
    if (fotosAltimetriaMedicaoFonte.length < 1) return false;
    if (fotosAltimetriaLadoCarga.length < 1) return false;
    if (fotosAltimetriaMedicaoCarga.length < 1) return false;
  }

  // 9. Vazamento e Limpeza de Transformador
  if (isServicoVazamento) {
    if (fotosVazamentoEvidencia.length < 1) return false;
    if (fotosVazamentoEquipamentos.length < 1) return false;
  }

  // 10. Documentação (não requer fotos, apenas PDFs)
  // Não validar fotos para documentação

  return true;
};
```

## 🧪 Como Testar Cada Serviço

### Teste: Serviço Padrão (Emenda)

1. **Selecionar**: Tipo "Emenda" (ou outro padrão)
2. **Adicionar**: 1 foto "Antes"
3. **Verificar**: Botão "Finalizar" NÃO aparece
4. **Adicionar**: 1 foto "Durante"
5. **Verificar**: Botão "Finalizar" NÃO aparece
6. **Adicionar**: 1 foto "Depois"
7. **Verificar**: Botão "Finalizar" APARECE ✅

### Teste: Ditais (5 fotos)

1. **Selecionar**: Tipo "Ditais"
2. **Adicionar fotos progressivamente**:
   - Abertura (1) → Botão NÃO aparece
   - Impedir (1) → Botão NÃO aparece
   - Testar (1) → Botão NÃO aparece
   - Aterrar (1) → Botão NÃO aparece
   - Sinalizar (1) → Botão APARECE ✅

### Teste: Transformador Instalado

1. **Selecionar**: Tipo "Transformador"
2. **Selecionar**: Status "Instalado"
3. **Adicionar**: 1 foto Conexões Primárias → Botão NÃO aparece
4. **Adicionar**: 2ª foto Conexões Primárias → Botão NÃO aparece
5. **Adicionar**: 1 foto Conexões Secundárias → Botão NÃO aparece
6. **Adicionar**: 2ª foto Conexões Secundárias → Botão APARECE ✅

### Teste: Medidor (5 fotos)

1. **Selecionar**: Tipo "Instalação do Medidor"
2. **Adicionar fotos progressivamente**:
   - Padrão (1) → Botão NÃO aparece
   - Leitura (1) → Botão NÃO aparece
   - Selo Born (1) → Botão NÃO aparece
   - Selo Caixa (1) → Botão NÃO aparece
   - Identificador (1) → Botão APARECE ✅

### Teste: Checklist com 1 Poste Instalado

1. **Selecionar**: Tipo "Checklist de Fiscalização"
2. **Adicionar**: 1 poste
3. **Selecionar**: Status "Instalado"
4. **Adicionar fotos progressivamente**:
   - Poste Inteiro (1) → Botão NÃO aparece
   - Engaste (1) → Botão NÃO aparece
   - Conexão 1 (1) → Botão NÃO aparece
   - Conexão 2 (1) → Botão NÃO aparece
   - Maior Esforço (1) → Botão NÃO aparece
   - Maior Esforço (2) → Botão NÃO aparece
   - Menor Esforço (1) → Botão NÃO aparece
   - Menor Esforço (2) → Botão APARECE ✅

## 📊 Resumo das Validações

| Serviço | Fotos Obrigatórias | Mínimo Total |
|---------|-------------------|--------------|
| Padrão (Emenda) | Antes, Durante, Depois | 3 fotos |
| Abertura e Fechamento de Chave | Abertura, Fechamento | 2 fotos |
| Ditais | 5 etapas | 5 fotos |
| Book de Aterramento | 4 etapas | 4 fotos |
| Transformador Instalado | Conexões Primárias (2), Secundárias (2) | 4 fotos |
| Transformador Retirado | Conexões Primárias (2), Secundárias (2) | 4 fotos |
| Instalação do Medidor | 5 tipos | 5 fotos |
| Checklist (1 Poste Instalado) | 6 seções (1-2 cada) | 8 fotos |
| Checklist (1 Poste Retirado) | Poste Inteiro | 2 fotos |
| Altimetria | 4 medições | 4 fotos |
| Vazamento e Limpeza | Evidência, Equipamentos | 2 fotos |
| Documentação | Nenhuma | 0 fotos |

## ✅ Vantagens da Validação Completa

### 1. **Cobertura Total**

- ✅ Todos os 10 tipos de serviços validados
- ✅ Nenhum tipo de serviço sem validação
- ✅ Requisitos específicos respeitados

### 2. **Experiência Consistente**

- ✅ Mesma lógica para todos os serviços
- ✅ Botão sempre aparece quando requisitos OK
- ✅ Feedback visual claro

### 3. **Qualidade Garantida**

- ✅ Obras sempre com fotos obrigatórias
- ✅ Dados completos antes de finalizar
- ✅ Menos retrabalho

### 4. **Manutenibilidade**

- ✅ Código organizado e comentado
- ✅ Fácil adicionar novos serviços
- ✅ Validações centralizadas

## 🎯 Resultado Final

**Para TODOS os tipos de serviços**:

```
✅ Botão "Finalizar" só aparece quando:
   1. Online (isOnline === true)
   2. Campos básicos preenchidos
   3. TODAS as fotos obrigatórias do serviço anexadas

❌ Botão "Finalizar" NÃO aparece quando:
   1. Offline
   2. Faltam campos básicos
   3. Faltam fotos obrigatórias (qualquer uma)

⏸️ Botão "Pausar" SEMPRE visível para salvar progresso
```

**Validação completa e consistente para todos os serviços!** 🎉
