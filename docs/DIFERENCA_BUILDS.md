# ⚠️ IMPORTANTE: Diferença Entre Expo Go e Development Build

## 🔴 O Problema que Você Teve

Você fez o build **development** (APK), baixou e instalou no celular, mas o app não funciona sozinho porque:

**Development Build ≠ Expo Go**

## 📱 Existem 3 Formas de Rodar seu App

### 1️⃣ Expo Go (Recomendado para Desenvolvimento)

**O que é:**
- App GENÉRICO da Expo na Play Store
- Roda QUALQUER projeto Expo
- Não precisa gerar APK
- Conecta via QR Code ao servidor de desenvolvimento

**Como usar:**
```bash
# No computador
cd mobile
npx expo start --tunnel

# No celular
1. Baixar "Expo Go" da Play Store
2. Escanear QR Code que aparece no terminal
3. App carrega automaticamente
```

**Vantagens:**
✅ Instantâneo (sem build)
✅ Hot reload (mudanças aparecem ao vivo)
✅ Perfeito para desenvolvimento
✅ Não ocupa espaço permanente no celular

**Desvantagens:**
❌ Precisa estar conectado ao servidor
❌ Precisa do app "Expo Go" instalado

---

### 2️⃣ Development Build (O que Você Fez)

**O que é:**
- APK CUSTOMIZADO do seu projeto
- Precisa do **servidor rodando** para funcionar
- É como um "Expo Go personalizado" só para seu app
- Tem `expo-dev-client` incluído

**Como usar:**
```bash
# Gerar o APK (você já fez isso)
eas build --profile development --platform android

# Baixar e instalar APK no celular
# Depois, no computador:
cd mobile
npx expo start --dev-client --tunnel

# No celular:
# Abrir o app instalado
# Escanear o QR Code que aparece
```

**Vantagens:**
✅ Pode incluir módulos nativos que Expo Go não tem
✅ Mais próximo do app final
✅ Ícone e nome personalizados

**Desvantagens:**
❌ AINDA PRECISA do servidor rodando
❌ Precisa gerar build (demora)
❌ Precisa escanear QR Code para conectar

---

### 3️⃣ Preview/Production Build (APK Standalone)

**O que é:**
- APK COMPLETO e INDEPENDENTE
- **NÃO** precisa de servidor
- Funciona offline como app normal
- Versão final para distribuição

**Como usar:**
```bash
# Gerar APK preview (para testes)
eas build --profile preview --platform android

# Ou APK production (para Play Store)
eas build --profile production --platform android

# Baixar e instalar
# Pronto! Funciona sozinho, sem servidor
```

**Vantagens:**
✅ Funciona offline
✅ Não precisa servidor rodando
✅ App final completo
✅ Pode compartilhar APK com clientes

**Desvantagens:**
❌ Demora para gerar (~30-60 min)
❌ Cada mudança precisa novo build
❌ Não tem hot reload

---

## 🎯 Qual Usar Quando?

| Situação | Use | Comando |
|----------|-----|---------|
| **Desenvolvendo diariamente** | Expo Go | `npx expo start --tunnel` |
| **Testando módulos nativos** | Development Build | Build + `npx expo start --dev-client` |
| **Compartilhar com clientes** | Preview Build | `eas build --profile preview --platform android` |
| **Publicar na Play Store** | Production Build | `eas build --profile production --platform android` |

---

## ✅ Como Resolver Seu Problema AGORA

Você tem 2 opções:

### Opção A: Usar o Development Build que Você Gerou

1. **Baixe e instale o APK** (link que apareceu):
   https://expo.dev/accounts/mateus_almeida/projects/obras-wise-mobile/builds/9a137170-ea7b-4634-912f-e1b65c963454

2. **No computador, inicie o servidor para development client:**
   ```bash
   cd mobile
   npx expo start --dev-client --tunnel
   ```

3. **No celular:**
   - Abra o app "Obras Teccel" que você instalou
   - Vai aparecer uma tela pedindo para escanear QR Code
   - Escaneie o QR Code que aparece no terminal do computador
   - Pronto! App vai conectar e funcionar

**IMPORTANTE:** O servidor precisa ficar rodando enquanto você usa o app!

---

### Opção B: Usar Expo Go (Mais Simples - Recomendado)

1. **Baixe o "Expo Go"** da Play Store:
   https://play.google.com/store/apps/details?id=host.exp.exponent

2. **No computador:**
   ```bash
   cd mobile
   npx expo start --tunnel
   ```

3. **No celular:**
   - Abra o app "Expo Go"
   - Clique em "Scan QR Code"
   - Escaneie o QR Code que aparece no terminal
   - Pronto! App carrega automaticamente

**IMPORTANTE:** Não precisa gerar build! É instantâneo!

---

## 🚀 Minha Recomendação

### Para AGORA (testar/desenvolver):
**Use Expo Go** (Opção B) - É mais simples e rápido!

### Para DEPOIS (distribuir para clientes):
Gere um build **preview** que funciona sozinho:
```bash
cd mobile
eas build --profile preview --platform android
```

Aguarde ~40 minutos, baixe o APK e distribua. Esse APK funciona offline, sem precisar de servidor!

---

## 📊 Comparação Visual

```
┌─────────────────────────────────────────────────────────┐
│                     EXPO GO                              │
├─────────────────────────────────────────────────────────┤
│ Celular (Expo Go app) ←──────→ Servidor (seu PC)       │
│                                                          │
│ ✅ Instantâneo                                          │
│ ✅ Hot reload                                           │
│ ❌ Precisa servidor rodando                             │
└─────────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────┐
│                 DEVELOPMENT BUILD                        │
├─────────────────────────────────────────────────────────┤
│ Celular (seu app.apk) ←──────→ Servidor (seu PC)       │
│                                                          │
│ ✅ App customizado                                      │
│ ✅ Módulos nativos                                      │
│ ❌ Precisa servidor rodando                             │
│ ❌ Precisa gerar build primeiro                         │
└─────────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────┐
│               PREVIEW/PRODUCTION BUILD                   │
├─────────────────────────────────────────────────────────┤
│ Celular (app completo) ──────────────────────           │
│                        SEM SERVIDOR                      │
│                                                          │
│ ✅ Funciona offline                                     │
│ ✅ App final completo                                   │
│ ✅ Pode distribuir livremente                           │
│ ❌ Demora para gerar (~40 min)                          │
│ ❌ Sem hot reload                                       │
└─────────────────────────────────────────────────────────┘
```

---

## 🎬 PRÓXIMO PASSO PARA VOCÊ

Execute agora:

```bash
cd mobile
npx expo start --tunnel
```

E baixe o **Expo Go** no celular para testar instantaneamente!

Ou se preferir usar o Development Build que você já gerou, execute:

```bash
cd mobile
npx expo start --dev-client --tunnel
```

E abra o app "Obras Teccel" que você instalou no celular.
