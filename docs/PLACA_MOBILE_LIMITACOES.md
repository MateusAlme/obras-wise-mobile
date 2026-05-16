# Placa Burned-in no Mobile - Limitações e Soluções

## Problema

A placa **burned-in** (gravada permanentemente) **NÃO funciona no Expo Go** porque:

1. **Expo Go** não inclui bibliotecas nativas como `@shopify/react-native-skia`
2. **Skia** precisa de código nativo compilado (C++/Java/Swift)
3. **Expo Go** é um runtime genérico que não pode incluir TODAS as bibliotecas nativas

### Erro Típico no Expo Go:
```
❌ [PLACA MOBILE] Erro ao renderizar: [TypeError: Cannot read property 'Skia' of undefined]
```

## Soluções

### Opção 1: Usar Overlay Visual (RECOMENDADO para desenvolvimento) ✅

**Como funciona:**
- Foto é salva SEM placa gravada
- Componente `PhotoWithPlaca` mostra placa como overlay visual
- Placa aparece no app mas NÃO fica na imagem salva
- **Vantagem**: Funciona no Expo Go, desenvolvimento rápido
- **Desvantagem**: Placa não fica permanente na foto

**Status atual**: ✅ JÁ IMPLEMENTADO
- Se Skia não estiver disponível, retorna foto original
- PhotoWithPlaca mostra overlay automaticamente
- Nenhuma configuração adicional necessária

**Quando usar:**
- ✅ Desenvolvimento e testes com Expo Go
- ✅ Iteração rápida de features
- ✅ Quando placa visual é suficiente

---

### Opção 2: Build Nativo (RECOMENDADO para produção) 🚀

**Como funciona:**
- Compila um APK/IPA nativo incluindo Skia
- Placa é gravada permanentemente na foto
- **Vantagem**: Placa fica FIXA na imagem
- **Desvantagem**: Build demora mais, precisa compilar

#### 2A. Development Build (Local)

**Requisitos:**
- Android Studio instalado (para Android)
- Xcode instalado (para iOS, apenas Mac)
- SDK Android configurado

**Comandos:**
```bash
# Android
npx expo run:android

# iOS (somente Mac)
npx expo run:ios
```

**Tempo:** 5-15 minutos (primeira vez), 2-5 minutos (builds seguintes)

**Resultado:**
- APK instalado automaticamente no dispositivo conectado
- Placa burned-in funcionando com Skia
- Hot reload funciona normalmente

#### 2B. EAS Build (Cloud)

**Requisitos:**
- Conta Expo (grátis)
- Internet

**Setup inicial:**
```bash
# Instalar EAS CLI
npm install -g eas-cli

# Login
eas login

# Configurar projeto
eas build:configure
```

**Build para desenvolvimento:**
```bash
# Android (APK de desenvolvimento)
eas build --profile development --platform android

# iOS (precisa de Apple Developer Account - $99/ano)
eas build --profile development --platform ios
```

**Tempo:** 10-30 minutos (na nuvem)

**Resultado:**
- Link para baixar APK/IPA
- Instalar manualmente no dispositivo
- Placa burned-in funcionando

**Build para produção:**
```bash
# Android (para Google Play)
eas build --profile production --platform android

# iOS (para App Store)
eas build --profile production --platform ios
```

---

## Comparação

| Aspecto | Overlay (Expo Go) | Build Nativo |
|---------|-------------------|--------------|
| **Tempo de setup** | ⚡ Imediato | 🐌 5-30min |
| **Placa na foto** | ❌ Não gravada | ✅ Gravada permanente |
| **Placa visível no app** | ✅ Sim (overlay) | ✅ Sim (gravada) |
| **Funciona no Expo Go** | ✅ Sim | ❌ Não |
| **Performance** | 🟢 Boa | 🟢 Ótima (nativo) |
| **Desenvolvimento** | ⚡ Muito rápido | 🐌 Mais lento |
| **Distribuição** | 📱 QR Code | 📦 APK/IPA |

## Recomendação por Fase

### Fase 1: Desenvolvimento (Agora)
✅ **Usar Expo Go com overlay visual**
- Iteração rápida
- Testes de features
- Validação de UX

### Fase 2: Testes Internos
🚀 **Fazer Development Build local**
- Testar placa burned-in real
- Validar qualidade da imagem
- Performance em dispositivos reais

### Fase 3: Beta Testing
🚀 **EAS Build (development profile)**
- Distribuir para testadores
- Coletar feedback
- Ajustes finais

### Fase 4: Produção
🚀 **EAS Build (production profile)**
- Publicar na Google Play / App Store
- Placa burned-in funcionando
- Usuários finais

## Status Atual da Implementação

### ✅ Funcionando Agora

**WEB (Navegador)**
- Placa burned-in usando Canvas API
- Funciona em http://localhost:8081
- Placa FIXA na foto

**MOBILE (Expo Go)**
- Placa como overlay visual
- Foto SEM placa gravada
- Fallback automático quando Skia não disponível

### 🚧 Precisa Build Nativo

**MOBILE (APK/IPA Nativo)**
- Placa burned-in usando Skia
- Foto COM placa gravada permanente
- Requer: `npx expo run:android` ou `eas build`

## Como Implementar Build Nativo

### Passo 1: Verificar Requisitos

**Para Android:**
```bash
# Verificar se Android SDK está instalado
adb version

# Verificar Java
java -version
```

Se não tiver, instalar [Android Studio](https://developer.android.com/studio)

### Passo 2: Conectar Dispositivo

**USB (mais rápido):**
1. Ativar "Depuração USB" no celular
2. Conectar cabo USB
3. Autorizar computador no celular

**Emulador (alternativa):**
1. Abrir Android Studio
2. AVD Manager → Criar emulador
3. Iniciar emulador

### Passo 3: Build e Instalar

```bash
cd "C:\Users\Mateus Almeida\obras-wise-mobile\mobile"

# Build e instalar (demora 5-15min na primeira vez)
npx expo run:android
```

### Passo 4: Testar Placa

1. App abre automaticamente no dispositivo
2. Tirar foto em qualquer seção
3. Verificar logs no terminal:
   ```
   [PLACA MOBILE] Iniciando renderização Skia...
   ✅ [PLACA MOBILE] Foto com placa gravada
   ```
4. Expandir foto → Placa DEVE estar FIXA na imagem

### Passo 5: Hot Reload

Após primeira build, mudanças no código recarregam automaticamente (como Expo Go):
- Salvar arquivo → App recarrega
- Não precisa recompilar

## Logs de Diagnóstico

### Expo Go (Overlay)
```
⚠️ [PLACA MOBILE] Skia não disponível. Usando overlay visual.
💡 Para placa burned-in no mobile, compile um build nativo: npx expo run:android
📸 URI COM PLACA: file:///.../original_photo.jpeg
```
→ Foto SEM placa, overlay visual funcionando

### Build Nativo (Skia)
```
📱 MOBILE: Renderizando placa com Skia...
[PLACA MOBILE] Iniciando renderização Skia...
[PLACA MOBILE] Imagem carregada: 1920 x 1080
[PLACA MOBILE] Desenhando placa...
✅ [PLACA MOBILE] Foto com placa gravada: file:///.../photo_with_placa_123.jpg
📸 URI COM PLACA: file:///.../photo_with_placa_123.jpg
```
→ Foto COM placa gravada permanente

## Conclusão

**Para desenvolvimento rápido**: Continue usando Expo Go com overlay visual ✅

**Para produção**: Faça build nativo quando estiver pronto para publicar 🚀

A implementação atual **funciona em ambos os cenários** automaticamente!
