# Como Gerar APK do Obras Teccel

## Opção 1: Build Local (⚠️ NÃO FUNCIONA NO WINDOWS)

### ⚠️ IMPORTANTE: Limitação do EAS Build Local

O comando `eas build --local` **NÃO funciona no Windows**. Erro:
```
Unsupported platform, macOS or Linux is required to build apps for Android
```

**Build local só funciona em:**
- ✅ macOS
- ✅ Linux (Ubuntu, Debian, etc.)
- ❌ Windows (não suportado)

### Alternativa no Windows: WSL2 (Avançado)

Se você realmente precisa de build local no Windows, pode usar WSL2:

1. Instalar WSL2 (Windows Subsystem for Linux)
2. Instalar Ubuntu no WSL2
3. Configurar Android SDK no Linux
4. Executar `eas build --local` dentro do WSL2

**Complexidade:** Alta - não recomendado para iniciantes

### Recomendação para Windows

**Use build na nuvem** (Opção 2 abaixo) - é mais simples e confiável no Windows.

---

## Opção 2: Build na Nuvem (Mais Simples - COM Fila)

### Gerar APK Preview (Instalável)
```bash
cd mobile
eas build --profile preview --platform android
```

**Vantagens:**
- ✅ Não precisa instalar nada
- ✅ Build roda nos servidores do Expo
- ✅ Funciona em qualquer computador

**Desvantagens:**
- ❌ Fila de espera no plano free (pode demorar 30-60 minutos)
- ❌ Limite de builds por mês no plano free

### Ver Status do Build
```bash
eas build:list
```

### Cancelar Build Atual (se necessário)
Se você quiser cancelar o build que está na fila para tentar local:
1. Pressione `Ctrl+C` no terminal
2. Acesse: https://expo.dev/accounts/mateus_almeida/projects/obras-wise-mobile/builds
3. Cancele o build manualmente se necessário

---

## Opção 3: Usar Expo Go (Sem Build - Mais Rápido para Testar)

Para **testes rápidos**, não precisa gerar APK! Use o Expo Go:

```bash
cd mobile
npx expo start --tunnel
```

Escaneie o QR Code com o app Expo Go. O app carrega instantaneamente!

**Quando usar cada opção:**
- 🧪 **Desenvolvimento/Testes**: Use Expo Go (instantâneo)
- 📦 **Distribuição Interna**: Gere APK preview
- 🚀 **Produção**: Use build production

---

## Diferenças Entre os Perfis

### Development
```bash
eas build --profile development --platform android
```
- Build para desenvolvimento com expo-dev-client
- Hot reload e debug tools incluídos
- Mais pesado (maior tamanho)

### Preview (Recomendado para Distribuição)
```bash
eas build --profile preview --platform android
```
- APK instalável (não precisa Google Play)
- Versão otimizada mas ainda em teste
- **Ideal para compartilhar com testadores**

### Production
```bash
eas build --profile production --platform android
```
- App Bundle (AAB) para publicar na Play Store
- Versão final otimizada
- Não pode instalar diretamente (precisa Google Play)

---

## Comandos Úteis

### Ver builds anteriores
```bash
eas build:list
```

### Baixar APK de um build
```bash
eas build:download --id [BUILD_ID]
```

### Ver logs de um build
```bash
eas build:view [BUILD_ID]
```

### Cancelar build
Pressione `Ctrl+C` e confirme

---

## Instalar Android Studio (se não tiver)

### Windows
1. Baixar: https://developer.android.com/studio
2. Instalar Android Studio
3. Abrir SDK Manager e instalar:
   - Android SDK Platform 34
   - Android SDK Build-Tools
   - Android Emulator
4. Configurar variáveis de ambiente:
   ```powershell
   # Adicionar ao PATH do sistema
   C:\Users\[SEU_USUARIO]\AppData\Local\Android\Sdk\platform-tools
   C:\Users\[SEU_USUARIO]\AppData\Local\Android\Sdk\tools
   ```
5. Reiniciar o terminal

### Verificar instalação
```bash
# Verificar se está instalado
adb --version

# Verificar ANDROID_HOME
echo $env:ANDROID_HOME
```

---

## Build Local: Passo a Passo Completo

### 1. Verificar Requisitos
```bash
# Verificar Node.js
node --version  # Deve ser v16 ou superior

# Verificar Android SDK
echo $env:ANDROID_HOME

# Verificar ADB
adb --version
```

### 2. Preparar Projeto
```bash
cd mobile

# Limpar cache
npm run start -- --clear

# Instalar dependências atualizadas
npm install
```

### 3. Gerar APK Local
```bash
# Gerar APK preview local
eas build --profile preview --platform android --local
```

### 4. Encontrar o APK
O APK será gerado em:
```
mobile/build-[TIMESTAMP].apk
```

### 5. Instalar no Celular
Conecte o celular via USB e execute:
```bash
adb install build-[TIMESTAMP].apk
```

Ou envie o APK para o celular e instale manualmente.

---

## Recomendação Final (WINDOWS)

### ⚠️ No Windows, você TEM QUE usar build na nuvem

**Build local não funciona no Windows!** Suas opções são:

### 1. Para Desenvolvimento/Testes Diários (Recomendado):
```bash
cd mobile
npx expo start --tunnel
```
✅ Use Expo Go - é instantâneo!
✅ Sem espera, sem fila
✅ Perfeito para desenvolvimento

### 2. Para Compartilhar APK com Clientes:
```bash
cd mobile
eas build --profile preview --platform android
```
⏰ Aguarde ~30-50 minutos na fila
📦 Gera APK instalável
📤 Compartilhe via WhatsApp/Email

### 3. Para Publicar na Play Store:
```bash
cd mobile
eas build --profile production --platform android
```
📱 Gera AAB para Google Play
✅ Versão otimizada final

---

## Opção Avançada: Usar WSL2 para Build Local

Se você **realmente** precisa de builds locais sem fila, pode configurar WSL2:

### Instalar WSL2
```powershell
# No PowerShell como Administrador
wsl --install
```

### Depois dentro do WSL2 (Ubuntu):
```bash
# Instalar dependências
sudo apt update
sudo apt install -y nodejs npm openjdk-17-jdk

# Instalar Android SDK
# (processo complexo - veja documentação do Expo)

# Então poderá fazer build local
cd /mnt/c/Users/Mateus\ Almeida/obras-wise-mobile/mobile
eas build --profile preview --platform android --local
```

**Complexidade:** 🔴 Alta
**Tempo de Setup:** 2-4 horas
**Recomendado:** Apenas se você faz muitos builds por dia

---

## Status Atual

✅ EAS configurado com 3 perfis (development, preview, production)
✅ Build "development" iniciado (esperando na fila)
❌ Build local não funciona no Windows (só macOS/Linux)
✅ Alternativa: Usar build na nuvem ou Expo Go

**Próximos comandos recomendados no Windows:**

### Para Testar AGORA (sem espera):
```bash
cd mobile
npx expo start --tunnel
```
Escaneie o QR Code com Expo Go!

### Para Gerar APK (com espera):
Aguardar o build atual terminar ou cancelar e fazer preview:
```bash
cd mobile
eas build --profile preview --platform android
```

---

## Comparação: Expo Go vs APK

| Característica | Expo Go | APK Build |
|----------------|---------|-----------|
| **Tempo** | Instantâneo | 30-60 min |
| **Instalação** | Precisa app Expo Go | Instala como app normal |
| **Distribuição** | QR Code/Link | Arquivo .apk |
| **Ideal para** | Desenvolvimento | Clientes/Testes |
| **Custo** | Grátis | Grátis (com fila) |
| **Limitação** | Precisa internet | Roda offline |
