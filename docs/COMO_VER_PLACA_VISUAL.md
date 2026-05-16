# Como Ver a Placa Visual (Overlay) nas Fotos

## O Que Você Quer

Uma **caixa com informações** aparecendo **SOBRE a foto**, como um overlay visual.

## Status Atual

✅ **JÁ ESTÁ IMPLEMENTADO!**

O componente `PhotoWithPlaca` está sendo usado em **52 lugares** no código e mostra uma caixa com:
- 📅 Data/Hora
- 🏗️ Número da Obra
- 🔧 Tipo de Serviço
- 👥 Equipe
- 📍 UTM
- 📌 Endereço

---

## Como a Placa Aparece

### Na Lista de Fotos (Miniaturas)

Quando você tira uma foto e volta para a lista, você DEVERIA ver:

```
┌──────────────────┐
│                  │
│   [FOTO AQUI]    │
│                  │
│ ┌──────────────┐ │ ← CAIXA DA PLACA
│ │REGISTRO DE   │ │
│ │   OBRA       │ │
│ ├──────────────┤ │
│ │Data: 26/12   │ │
│ │Obra: 12345   │ │
│ │Serviço: ...  │ │
│ │Equipe: A     │ │
│ │UTM: 24M ...  │ │
│ │Local: Rua... │ │
│ └──────────────┘ │
└──────────────────┘
```

A caixa fica **no canto inferior esquerdo** da foto.

---

## Se Você NÃO Está Vendo a Placa

### Passo 1: Limpar Cache

Execute no terminal:

```bash
cd "C:\Users\Mateus Almeida\obras-wise-mobile\mobile"
npx expo start --clear
```

### Passo 2: Reabrir App

1. **Feche o app completamente** (force close)
2. **Reabra o app**
3. **Escaneie o QR Code novamente**

### Passo 3: Tirar Nova Foto

1. Crie uma nova obra
2. Tire **UMA foto nova**
3. Veja a miniatura da foto na lista
4. A placa DEVERIA aparecer

---

## Características da Placa Visual

| Aspecto | Detalhes |
|---------|----------|
| **Posição** | Canto inferior esquerdo |
| **Cor de fundo** | Preto semi-transparente |
| **Borda** | Azul |
| **Onde aparece** | Em TODAS as fotos |
| **É permanente?** | ❌ Não (apenas visual) |
| **Aparece ao compartilhar?** | ❌ Não |
| **Aparece na galeria?** | ❌ Não |

---

## Teste Rápido

Para verificar se está funcionando:

1. **Abra o app**
2. **Navegue até qualquer foto existente**
3. **Olhe o canto inferior esquerdo**
4. **Você vê uma caixa preta com informações?**

### ✅ Se SIM:
A placa está funcionando! Ela aparece como overlay visual.

### ❌ Se NÃO:
Execute `npx expo start --clear` e tente novamente.

---

## Código do Componente

O componente está em: `mobile/components/PhotoWithPlaca.tsx`

**O que ele faz**:
```tsx
<View style={container}>
  <Image source={{ uri }} />  {/* Foto */}

  <View style={placa}>  {/* Caixa da placa */}
    <View style={placaHeader}>
      <Text>REGISTRO DE OBRA</Text>
    </View>

    <View style={placaContent}>
      <Text>Data: {dateTime}</Text>
      <Text>Obra: {obraNumero}</Text>
      <Text>Serviço: {tipoServico}</Text>
      <Text>Equipe: {equipe}</Text>
      <Text>UTM: {utm}</Text>
      <Text>Local: {endereco}</Text>
    </View>
  </View>
</View>
```

---

## Diferença: Visual vs Gravada

### Placa VISUAL (O que você tem AGORA) 👁️

```
[FOTO.JPG]
    ↓
App mostra: [FOTO + CAIXA PLACA]
    ↓
Arquivo real: [FOTO.JPG] ← SEM placa
```

**Características**:
- ✅ Aparece NO APP
- ❌ NÃO está no arquivo da foto
- ❌ NÃO aparece ao compartilhar
- ❌ NÃO aparece na galeria

### Placa GRAVADA (Para ter no futuro) 🔨

```
[FOTO.JPG]
    ↓
Processa: [FOTO + PLACA] → [FOTO_COM_PLACA.JPG]
    ↓
Arquivo real: [FOTO_COM_PLACA.JPG] ← COM placa
```

**Características**:
- ✅ Aparece NO APP
- ✅ Está no arquivo da foto
- ✅ Aparece ao compartilhar
- ✅ Aparece na galeria

---

## Conclusão

A **placa visual (overlay)** JÁ ESTÁ FUNCIONANDO!

Se você não está vendo:
1. Limpe o cache: `npx expo start --clear`
2. Reabra o app
3. Tire nova foto
4. Verifique se a caixa aparece no canto inferior esquerdo

**A placa DEVERIA estar aparecendo!** 🎉

Se ainda não aparecer, me avise e vou investigar mais profundamente.
