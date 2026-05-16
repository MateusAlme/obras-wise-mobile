# Placa Gravada no Mobile - Limitação Técnica do Expo Go

## O Problema

Você quer que a placa fique **GRAVADA PERMANENTEMENTE** na foto no **app mobile**, mas está testando no **Expo Go**.

## Por Que Não Funciona no Expo Go?

O Expo Go **NÃO CONSEGUE** gravar texto/desenhos permanentemente em imagens porque:

### Limitações Técnicas

1. **Expo Go não tem bibliotecas nativas de processamento de imagem**
   - Não inclui Skia (biblioteca C++ para desenhar)
   - Não inclui Canvas nativo
   - Não inclui libraries de manipulação de imagem com texto

2. **APIs disponíveis no Expo Go**:
   - ✅ `expo-image-picker` - Tirar foto
   - ✅ `expo-image-manipulator` - Crop, rotate, resize, flip
   - ❌ `expo-image-manipulator` - **NÃO** suporta adicionar texto
   - ❌ `@shopify/react-native-skia` - **NÃO** funciona (precisa build nativo)
   - ❌ `react-native-canvas` - **NÃO** funciona (precisa build nativo)
   - ❌ `react-native-view-shot` - Funciona mas **precisa componente já renderizado** (não serve para async)

3. **O que tentamos**:
   - ✅ Canvas API (funciona APENAS em WEB)
   - ❌ Skia (precisa build nativo)
   - ❌ expo-image-manipulator (não suporta texto)
   - ❌ react-native-view-shot (limitações de async)

---

## Soluções Disponíveis

### Opção 1: Build Nativo (RECOMENDADO) 🚀

**O que é**: Compilar um APK nativo que inclui todas as bibliotecas necessárias.

**Vantagens**:
- ✅ Placa GRAVADA PERMANENTEMENTE na foto
- ✅ Funciona offline
- ✅ Rápido (< 1 segundo por foto)
- ✅ Privado (tudo local)
- ✅ Hot reload continua funcionando normalmente

**Desvantagens**:
- ⏰ Demora 10-15 minutos (primeira vez)
- 📱 Precisa Android Studio instalado
- 🔌 Precisa conectar celular via USB

**Como fazer**:

1. **Instalar Android Studio**: https://developer.android.com/studio

2. **Conectar celular via USB**:
   - Ativar "Depuração USB" no celular
   - Conectar cabo USB
   - Autorizar computador

3. **Build e instalar**:
```bash
cd "C:\Users\Mateus Almeida\obras-wise-mobile\mobile"
npx expo run:android
```

4. **Aguardar** 10-15 minutos (primeira vez)

5. **App instala automaticamente** no celular

6. **Testar**: Tirar foto → Placa GRAVADA PERMANENTEMENTE ✅

**Após primeira build**:
- Mudanças no código recarregam automaticamente (hot reload)
- Não precisa recompilar (apenas se adicionar bibliotecas nativas novas)

---

### Opção 2: Usar WEB no Navegador ✅

**O que é**: Acessar o app pelo navegador ao invés do Expo Go.

**Vantagens**:
- ✅ Placa GRAVADA PERMANENTEMENTE na foto
- ✅ Funciona AGORA (não precisa build)
- ✅ Funciona offline (exceto endereço)
- ✅ Rápido

**Desvantagens**:
- 🌐 Não é app nativo (é web)
- 📱 Não tem ícone no celular
- 📸 Câmera web pode ter qualidade menor

**Como fazer**:

1. **Iniciar servidor** (se não estiver rodando):
```bash
cd "C:\Users\Mateus Almeida\obras-wise-mobile\mobile"
npm start
```

2. **Abrir no navegador** do celular:
   - http://SEU_IP:8081
   - Exemplo: http://192.168.1.100:8081

3. **Tirar foto** → Placa GRAVADA PERMANENTEMENTE ✅

**Para descobrir seu IP**:
```bash
ipconfig
```
Procure por "Endereço IPv4" (ex: 192.168.1.100)

---

### Opção 3: EAS Build (Cloud) ☁️

**O que é**: Expo compila o APK na nuvem e você baixa pronto.

**Vantagens**:
- ✅ Placa GRAVADA PERMANENTEMENTE na foto
- ✅ Não precisa Android Studio
- ✅ APK pronto para distribuir

**Desvantagens**:
- ⏰ Demora 20-30 minutos
- 🌐 Precisa internet
- 📧 Precisa conta Expo (grátis)

**Como fazer**:

1. **Instalar EAS CLI**:
```bash
npm install -g eas-cli
```

2. **Login**:
```bash
eas login
```

3. **Configurar**:
```bash
cd "C:\Users\Mateus Almeida\obras-wise-mobile\mobile"
eas build:configure
```

4. **Build**:
```bash
eas build --profile development --platform android
```

5. **Aguardar** 20-30 minutos

6. **Baixar APK** do link fornecido

7. **Instalar** manualmente no celular

---

### Opção 4: Servidor Backend (NÃO RECOMENDADO) ❌

**O que é**: Enviar foto para servidor que adiciona a placa e retorna.

**Vantagens**:
- ✅ Funciona no Expo Go

**Desvantagens**:
- ❌ Precisa internet (app deve funcionar offline)
- ❌ Lento (3-5 segundos por foto)
- ❌ Privacidade (fotos vão para servidor externo)
- ❌ Custo ($49-89/mês para APIs como Cloudinary, ImageKit)
- ❌ Complexidade (precisa configurar servidor)

---

## Comparação

| Aspecto | Expo Go | WEB | Build Nativo | EAS Build |
|---------|---------|-----|--------------|-----------|
| **Placa gravada** | ❌ Não | ✅ Sim | ✅ Sim | ✅ Sim |
| **Tempo setup** | ⚡ 0min | ⚡ 0min | 🐌 10-15min | 🐌 20-30min |
| **É app nativo** | ✅ Sim | ❌ Não | ✅ Sim | ✅ Sim |
| **Funciona offline** | ✅ Sim | ✅ Sim (exceto endereço) | ✅ Sim (exceto endereço) | ✅ Sim (exceto endereço) |
| **Hot reload** | ✅ Sim | ✅ Sim | ✅ Sim | ✅ Sim |
| **Requisitos** | Expo Go | Navegador | Android Studio | Internet + Conta Expo |
| **Distribuição** | QR Code | URL | USB/Manual | APK download |

---

## Recomendação

### Para Desenvolvimento (Agora)

**Use WEB no navegador do celular**:
- Placa gravada funcionando
- Não precisa esperar build
- Teste todas as funcionalidades

### Para Produção (Final)

**Faça Build Nativo Local ou EAS Build**:
- App nativo completo
- Placa gravada permanentemente
- Distribuir para usuários

---

## Status Atual

### ✅ O Que Funciona

**WEB (Navegador)**:
- http://localhost:8081 ou http://SEU_IP:8081
- Placa GRAVADA PERMANENTEMENTE ✅
- Canvas API do HTML5
- Logs: `✅ [PLACA WEB] Foto com placa gravada!`

### ⚠️ O Que NÃO Funciona

**MOBILE (Expo Go)**:
- Placa NÃO fica gravada (apenas overlay visual)
- Logs: `💡 Para placa burned-in permanente no mobile...`
- **Limitação técnica do Expo Go** (não é bug!)

---

## Conclusão

**Expo Go** é excelente para desenvolvimento rápido, mas **não consegue** gravar texto/desenhos em imagens.

**Para placa PERMANENTE no mobile, você TEM que escolher uma das opções**:

1. 🚀 **Build Nativo** (npx expo run:android) - MELHOR para produção
2. 🌐 **WEB** (navegador) - MELHOR para testar agora
3. ☁️ **EAS Build** (cloud) - ALTERNATIVA ao build local

Não existe "mágica" que faça funcionar no Expo Go. É uma limitação de arquitetura.

---

## Próximos Passos

**Escolha uma opção acima** e me avise qual você quer seguir:

1. "Quero fazer build nativo" → Te guio no processo
2. "Quero testar no navegador" → Te dou o IP e instruções
3. "Quero EAS Build" → Te ajudo a configurar
4. "Quero servidor backend" → Explico por que não recomendo mas te ajudo se insistir
