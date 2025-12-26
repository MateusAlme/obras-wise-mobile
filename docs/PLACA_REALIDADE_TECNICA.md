# Placa em Fotos - Realidade Técnica

## A Situação Atual

Você quer que a placa apareça **FIXA/GRAVADA** nas fotos, mas está testando no **Expo Go**.

## Por Que NÃO Funciona no Expo Go?

### Código Atual

O código em `photo-with-placa.ts` (linhas 125-239) usa:

```javascript
const img = new Image()  // ❌ NÃO EXISTE no React Native
const canvas = document.createElement('canvas')  // ❌ NÃO EXISTE no React Native
const ctx = canvas.getContext('2d')  // ❌ NÃO EXISTE no React Native
ctx.drawImage(img, 0, 0)  // ❌ NÃO EXISTE no React Native
ctx.fillText('Obra:', x, y)  // ❌ NÃO EXISTE no React Native
canvas.toBlob(...)  // ❌ NÃO EXISTE no React Native
```

Essas APIs são **exclusivas do navegador** (DOM APIs). React Native **NÃO TEM** essas APIs.

### O Que o React Native TEM

```javascript
✅ Image (componente visual)
✅ View (componente visual)
✅ Text (componente visual)
❌ Canvas para manipular imagens
❌ Desenhar texto em imagens
❌ APIs de processamento de imagem com texto
```

### Bibliotecas Testadas

1. **@shopify/react-native-skia** ✅ FUNCIONA
   - ❌ NÃO funciona no Expo Go (precisa build nativo)
   - ✅ Funciona em build nativo

2. **expo-image-manipulator** ✅ FUNCIONA no Expo Go
   - ❌ NÃO suporta adicionar texto
   - ✅ Apenas crop, rotate, resize, flip

3. **react-native-view-shot** ✅ FUNCIONA no Expo Go
   - ❌ Precisa componente JÁ renderizado na tela
   - ❌ NÃO funciona em função async

4. **Canvas do Node.js** ❌ NÃO FUNCIONA
   - Precisa Visual Studio Build Tools
   - Precisa C++ compiler
   - Muito complexo

## 3 ÚNICAS Soluções Possíveis

### Solução 1: Usar WEB ✅ FUNCIONA AGORA

**O QUE FAZ**:
- Abre o app no navegador ao invés do Expo Go
- Placa é GRAVADA PERMANENTEMENTE usando Canvas API
- Funciona offline (exceto endereço)

**COMO FAZER**:
1. No celular, abra navegador (Chrome/Safari)
2. Digite: `http://10.0.0.116:8081`
3. Tire foto
4. Placa aparece **FIXA** na foto ✅

**PRÓS**:
- ✅ Funciona AGORA (não precisa esperar)
- ✅ Placa FIXA/GRAVADA
- ✅ Rápido
- ✅ Grátis
- ✅ Offline

**CONTRAS**:
- ❌ Não é app nativo (é web)
- ❌ Não tem ícone no celular
- ❌ Qualidade de câmera pode ser menor

---

### Solução 2: Build Nativo ✅ FUNCIONA (mas demora)

**O QUE FAZ**:
- Compila APK nativo com todas bibliotecas
- Inclui Skia para desenhar texto
- Placa é GRAVADA PERMANENTEMENTE

**COMO FAZER**:
```bash
npx expo run:android
```

**PRÓS**:
- ✅ App nativo completo
- ✅ Placa FIXA/GRAVADA
- ✅ Offline
- ✅ Hot reload continua funcionando

**CONTRAS**:
- ⏰ Demora 10-15 minutos (primeira vez)
- 📱 Precisa Android Studio
- 🔌 Precisa USB

---

### Solução 3: Aceitar Limitação do Expo Go ⚠️

**O QUE FAZ**:
- Continua usando Expo Go
- Placa aparece apenas como OVERLAY visual
- Foto salva SEM placa

**COMO FICA**:
- Dentro do app: ✅ Placa visível
- Ao compartilhar foto: ❌ Placa NÃO aparece
- Ao abrir foto no celular: ❌ Placa NÃO aparece

**PRÓS**:
- ✅ Funciona AGORA
- ✅ Não precisa configurar nada

**CONTRAS**:
- ❌ Placa NÃO fica gravada na foto
- ❌ É apenas visual/temporário

---

## Comparação

| Aspecto | WEB | Build Nativo | Expo Go |
|---------|-----|--------------|---------|
| **Placa gravada** | ✅ Sim | ✅ Sim | ❌ Não |
| **Tempo para ter** | ⚡ Agora | 🐌 15min | ⚡ Agora |
| **É app nativo** | ❌ Não | ✅ Sim | ✅ Sim |
| **Precisa instalar** | ❌ Não | ✅ Sim | ❌ Não |
| **Funciona offline** | ✅ Sim | ✅ Sim | ✅ Sim |
| **Distribuir APK** | ❌ Não | ✅ Sim | ❌ Não |

---

## Recomendação

### Para TESTAR AGORA com placa GRAVADA:
👉 **Use WEB no navegador**: `http://10.0.0.116:8081`

### Para PRODUÇÃO FINAL com app nativo:
👉 **Faça build nativo**: `npx expo run:android`

---

## Por Que Não Existe "Solução Mágica"?

Gravar texto em imagens requer uma das seguintes:

1. **Canvas API** (só existe no navegador)
2. **Skia** (precisa build nativo)
3. **Servidor externo** (precisa internet, caro, lento)

Expo Go **NÃO TEM** nenhuma dessas opções porque:
- Não é navegador (sem Canvas)
- Não é build nativo (sem Skia)
- App precisa funcionar offline (sem servidor)

**É uma limitação de arquitetura, não um bug!**

---

## Próximos Passos

**Escolha UMA das opções**:

1. ✅ **Testar WEB agora**: `http://10.0.0.116:8081` no navegador do celular
2. 🚀 **Fazer build nativo**: `npx expo run:android` (me avisa que te guio)
3. ⚠️ **Aceitar limitação**: Continuar com Expo Go (placa apenas visual)

**Me diga qual você escolhe!**
