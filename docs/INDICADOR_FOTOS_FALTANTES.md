# 📸 Indicador de Fotos Faltantes

## 📋 Visão Geral

Sistema visual que mostra em **tempo real** quais fotos ainda precisam ser adicionadas em cada seção do formulário de obra e na tela de detalhes, **antes mesmo** de tentar salvar ou finalizar.

## 📱 Onde Funciona

1. **Formulário de Nova Obra** (`nova-obra.tsx`)
2. **Tela de Detalhes da Obra** (`obra-detalhe.tsx`)

## ✨ Funcionalidades

### 1. Card de Resumo no Topo
Logo após selecionar o tipo de serviço, aparece um **card amarelo** mostrando todas as fotos faltantes:

```
⚠️ Fotos Faltando:
• Antes
• Durante
• Depois
```

- **Cor**: Fundo amarelo claro (`#fff8e1`)
- **Borda**: Laranja à esquerda (4px, `#ff6f00`)
- **Visibilidade**: Aparece apenas quando há fotos faltando
- **Desaparece**: Automaticamente quando todas as fotos são adicionadas

### 2. Indicadores Inline nas Seções
Cada seção de foto mostra se está faltando ou não:

#### ✅ Quando tem foto:
```
📷 Fotos Antes (2)
```

#### ⚠️ Quando está faltando:
```
📷 Fotos Antes (0) ⚠️ Faltando
```

- **Indicador**: `⚠️ Faltando` em laranja itálico
- **Aparece**: Apenas quando contador = 0
- **Some**: Automaticamente ao adicionar primeira foto

## 🎯 Tipos de Serviço Cobertos

### Serviço Padrão (Obras Gerais)
- Antes
- Durante
- Depois

### Abertura e Fechamento de Chave
- Abertura
- Fechamento

### Ditais (5 fotos)
- Desligar
- Impedir
- Testar
- Aterrar
- Sinalizar

## 🎨 Estilos Aplicados

### Card de Resumo
```typescript
missingPhotosCard: {
  backgroundColor: '#fff8e1',      // Amarelo claro
  borderLeftWidth: 4,              // Borda esquerda grossa
  borderLeftColor: '#ff6f00',      // Laranja
  borderRadius: 8,
  padding: 12,
  marginTop: 12,
  marginBottom: 8,
}
```

### Título do Card
```typescript
missingPhotosTitle: {
  fontSize: 14,
  fontWeight: '600',
  color: '#ff6f00',  // Laranja
  marginBottom: 6,
}
```

### Item de Foto Faltante
```typescript
missingPhotoItem: {
  fontSize: 13,
  color: '#4a4a4a',  // Cinza escuro
  marginLeft: 4,
  marginTop: 2,
}
```

### Indicador Inline
```typescript
missingPhotoIndicator: {
  fontSize: 13,
  fontWeight: '500',
  color: '#ff6f00',   // Laranja
  fontStyle: 'italic',
}
```

## 🔄 Comportamento Dinâmico

### Atualização em Tempo Real
```typescript
// Verifica se há fotos faltantes
{fotosAntes.length === 0 || fotosDurante.length === 0 || fotosDepois.length === 0}

// Mostra indicador inline
{fotosAntes.length === 0 && <Text style={styles.missingPhotoIndicator}> ⚠️ Faltando</Text>}
```

### Exemplo de Fluxo
1. **Inicial**: Usuário seleciona "Serviço Padrão"
   - Card mostra: `⚠️ Fotos Faltando: • Antes • Durante • Depois`
   - Todos labels mostram: `⚠️ Faltando`

2. **Adiciona foto "Antes"**:
   - Card atualiza: `⚠️ Fotos Faltando: • Durante • Depois`
   - Label "Antes" remove indicador
   - Labels "Durante" e "Depois" mantêm `⚠️ Faltando`

3. **Adiciona fotos "Durante" e "Depois"**:
   - Card **desaparece completamente** ✅
   - Todos indicadores `⚠️ Faltando` somem

## 📱 Experiência do Usuário

### Antes (sem indicadores)
```
📷 Fotos Antes (0)
[+ Adicionar Foto]

📷 Fotos Durante (0)
[+ Adicionar Foto]
```
❌ Usuário não sabe o que está faltando até tentar salvar

### Depois (com indicadores)
```
⚠️ Fotos Faltando:
• Durante
• Depois

📷 Fotos Antes (1) ✅
[Miniaturas das fotos...]

📷 Fotos Durante (0) ⚠️ Faltando
[+ Adicionar Foto]

📷 Fotos Depois (0) ⚠️ Faltando
[+ Adicionar Foto]
```
✅ Usuário vê instantaneamente o que falta

## 🎯 Benefícios

1. **Visibilidade Imediata**: Usuário sabe o que falta sem precisar tentar salvar
2. **Reduz Erros**: Menos alertas de validação ao finalizar obra
3. **Guia Visual**: Card de resumo funciona como checklist
4. **Feedback em Tempo Real**: Indicadores aparecem/somem dinamicamente
5. **Específico por Serviço**: Cada tipo de obra tem seus requisitos próprios

## 🔧 Implementação Técnica

### Arquivos Modificados

#### 1. Nova Obra (`mobile/app/nova-obra.tsx`)
- Adicionados cards de resumo para cada tipo de serviço
- Adicionados indicadores inline em todos os labels
- Adicionados 3 novos estilos CSS

#### 2. Detalhes da Obra (`mobile/app/obra-detalhe.tsx`)
- **Filtro inteligente**: Mostra apenas seções relevantes ao tipo de serviço
- **Card de resumo no topo**: Lista todas as fotos faltantes com contador
- **Indicador inline**: Cada seção mostra `⚠️ Faltando` quando vazia
- **Contador visual**: Exibe `(0)` quando não há fotos, `(X)` quando há
- **Texto hint**: "Nenhuma foto adicionada" quando seção está vazia
- Adicionados 4 novos estilos CSS

### Componentes Adicionados
1. Card de resumo de fotos faltantes
2. Indicador inline em cada label
3. Estilos CSS específicos

### Lógica de Validação
```typescript
// Para serviço padrão
{isServicoPadrao && (
  fotosAntes.length === 0 ||
  fotosDurante.length === 0 ||
  fotosDepois.length === 0
) && (
  <View style={styles.missingPhotosCard}>
    {/* Card com lista de fotos faltantes */}
  </View>
)}
```

## 🚀 Próximos Passos (Opcional)

- [ ] Adicionar indicadores para outros tipos de serviço (Transformador, Medidor, etc.)
- [ ] Badge no topo mostrando "X fotos faltando" de forma compacta
- [ ] Animação ao adicionar/remover fotos
- [ ] Scroll automático para próxima seção faltante

## 📝 Notas

- **Não bloqueia salvamento**: Indicadores são informativos, não impeditivos
- **Funciona offline**: Validação 100% local
- **Zero impacto em performance**: Cálculos simples de array.length
- **Mantém UX consistente**: Mesmo estilo visual em todo o app
