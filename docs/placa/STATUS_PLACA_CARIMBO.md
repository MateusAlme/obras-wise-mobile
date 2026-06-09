# Status Atual - Carimbo da Placa nas Fotos

## O Que Você Disse

> "antes aparecia o carimbo no ato das fotos mesmo sendo testado no expo go"

## O Que Está Implementado

### ✅ Componente Visual JÁ EXISTE

O componente `PhotoWithPlaca.tsx` **JÁ ESTÁ FUNCIONANDO** e mostra o carimbo visual sobre as fotos.

**Localização**: `mobile/components/PhotoWithPlaca.tsx`

**O que ele faz**:
- Mostra a placa visual SOBRE a foto (overlay)
- Exibe: Obra, Data, Serviço, Equipe, UTM, Endereço
- Funciona em TODAS as seções de fotos

### ✅ Dados São Salvos Corretamente

Quando você tira uma foto, os dados são salvos:
- `latitude` ✅
- `longitude` ✅
- `utmX`, `utmY`, `utmZone` ✅
- `photoId` ✅

### ✅ Componente É Usado

O componente `PhotoWithPlaca` está sendo usado em **todas as seções** de fotos:

```tsx
<PhotoWithPlaca
  uri={foto.uri}
  obraNumero={obra}
  tipoServico={tipoServico}
  equipe={equipe}
  latitude={foto.latitude}
  longitude={foto.longitude}
  utmX={foto.utmX}
  utmY={foto.utmY}
  utmZone={foto.utmZone}
  style={styles.photoThumbnail}
/>
```

---

## Por Que Você NÃO Vê a Placa?

### Possível Causa 1: Cache do Expo Go

O Expo Go pode estar com cache antigo.

**Solução**:
1. No Expo Go, pressione `R` para recarregar
2. Ou feche e abra o Expo Go novamente
3. Escaneie o QR Code novamente

### Possível Causa 2: Servidor Metro com Cache

O servidor pode estar servindo código antigo.

**Solução**:
1. Pare o servidor (Ctrl+C)
2. Execute: `npx expo start --clear`
3. Escaneie QR Code novamente

### Possível Causa 3: Dados Faltando

Se a foto foi tirada antes, pode não ter os dados salvos.

**Solução**:
1. Tire uma NOVA foto
2. Verifique se a placa aparece na nova foto

---

## Como a Placa DEVERIA Aparecer

### Na Lista de Fotos (Miniaturas)

Quando você vê a lista de fotos, CADA foto mostra:

```
┌─────────────────┐
│                 │
│     [FOTO]      │
│                 │
│ ┌─────────────┐ │
│ │REGISTRO DE  │ │
│ │   OBRA      │ │
│ ├─────────────┤ │
│ │Data: 26/12  │ │
│ │Obra: 12345  │ │
│ │Serviço: ... │ │
│ │Equipe: A    │ │
│ │UTM: 24M ... │ │
│ │Local: Rua...│ │
│ └─────────────┘ │
└─────────────────┘
```

### Em Tela Cheia

Quando você clica na foto para ver em tela cheia, a placa TAMBÉM aparece no canto inferior esquerdo.

---

## 2 Situações Diferentes

### 1. Placa VISUAL (Expo Go) - O Que Você TEM

- ✅ Placa aparece NO APP
- ❌ Placa NÃO está gravada na imagem
- ❌ Ao compartilhar foto, placa NÃO aparece
- ❌ Ao abrir foto na galeria, placa NÃO aparece

**Como funciona**:
- Componente `PhotoWithPlaca` desenha a placa SOBRE a foto
- É visual/temporário
- Como um "papel colado" sobre a foto

### 2. Placa GRAVADA (WEB ou Build Nativo) - O Que Você QUER

- ✅ Placa aparece NO APP
- ✅ Placa ESTÁ gravada na imagem
- ✅ Ao compartilhar foto, placa APARECE
- ✅ Ao abrir foto na galeria, placa APARECE

**Como funciona**:
- Canvas API desenha a placa DENTRO da foto
- É permanente
- Como um "carimbo" que modifica a foto

---

## Ações Imediatas

### Passo 1: Verificar se Placa Visual Está Funcionando

1. Abra Expo Go
2. Escaneie QR Code
3. Crie nova obra
4. Tire UMA foto
5. Olhe a miniatura da foto
6. **A placa DEVERIA aparecer** no canto inferior esquerdo

### Passo 2: Se NÃO Aparece

Execute no terminal:

```bash
cd "C:\Users\Mateus Almeida\obras-wise-mobile\mobile"
npx expo start --clear
```

Depois:
1. Feche Expo Go completamente
2. Abra Expo Go novamente
3. Escaneie QR Code
4. Tire nova foto
5. Verifique se placa aparece

### Passo 3: Para Placa GRAVADA (Permanente)

Se você quer que a placa fique FIXA na foto:

**Opção A: WEB no navegador** (MAIS RÁPIDO):
```
http://10.0.0.116:8081
```
- Abra no navegador do celular
- Placa GRAVADA PERMANENTEMENTE

**Opção B: Build Nativo** (APP COMPLETO):
```bash
npx expo run:android
```
- Demora 15 minutos
- App nativo com placa GRAVADA

---

## Resumo

| Aspecto | Status Atual |
|---------|--------------|
| **Componente PhotoWithPlaca** | ✅ Implementado |
| **Dados salvos (GPS, UTM)** | ✅ Funcionando |
| **Placa visual no Expo Go** | ✅ DEVERIA aparecer |
| **Placa gravada permanente** | ❌ Só em WEB ou Build Nativo |

---

## O Que Fazer AGORA

**Me responda**:

1. Você consegue VER a placa visual nas fotos no Expo Go? (mesmo que não seja gravada)
2. Se NÃO, execute `npx expo start --clear` e tente novamente
3. Se SIM mas quer placa GRAVADA, escolha: WEB (rápido) ou Build Nativo (completo)

**Me avise o que está acontecendo!**
