# Placa como Carimbo Fixo na Foto

## Como Funciona Atualmente

A placa de informações da obra **JÁ ESTÁ IMPLEMENTADA** para ficar gravada permanentemente na foto como um "carimbo".

### Status por Plataforma

#### ✅ WEB (Navegador) - FUNCIONANDO

**Como testar:**
1. Abrir http://localhost:8081 no navegador
2. Criar nova obra
3. Tirar foto (qualquer seção)
4. A placa será **GRAVADA PERMANENTEMENTE** na foto

**Tecnologia:** Canvas API do navegador (HTML5)

**Logs esperados:**
```
[PLACA WEB] Iniciando renderização...
[PLACA WEB] UTM calculado: 24M 756234E 9276543N
[PLACA WEB] Carregando imagem...
[PLACA WEB] Imagem carregada! 1920 x 1080
[PLACA WEB] Canvas criado, desenhando imagem...
[PLACA WEB] Desenhando placa...
✅ [PLACA WEB] Foto com placa gravada! blob:http://...
```

**Resultado:** Foto com placa FIXA no canto inferior esquerdo (como carimbo permanente)

---

#### ⚠️ MOBILE (Expo Go) - OVERLAY APENAS

**Problema:**
- Expo Go **NÃO SUPORTA** bibliotecas nativas como `@shopify/react-native-skia`
- Skia é necessário para gravar a placa permanentemente na foto
- Atualmente retorna foto original + overlay visual

**Logs atuais:**
```
📱 MOBILE: Renderizando placa com Skia...
📱 [PLACA MOBILE] Expo Go detectado - usando overlay visual
💡 Para placa burned-in permanente, compile um build nativo
```

**Resultado:** Foto SEM placa gravada + overlay visual no app (placa desaparece ao compartilhar foto)

---

#### 🚀 MOBILE (Build Nativo) - SOLUÇÃO PERMANENTE

Para a placa ficar **FIXA/GRAVADA** na foto no mobile, você precisa fazer um **build nativo**.

## Como Fazer Build Nativo

### Opção 1: Build Local (Mais Rápido)

**Requisitos:**
- Android Studio instalado
- SDK Android configurado
- Dispositivo Android conectado via USB ou emulador rodando

**Passos:**

1. **Verificar Android SDK:**
```bash
adb version
```
Se não funcionar, instale: https://developer.android.com/studio

2. **Conectar dispositivo:**
   - Ativar "Depuração USB" no celular
   - Conectar cabo USB
   - Autorizar computador no celular

3. **Build e instalar:**
```bash
cd "C:\Users\Mateus Almeida\obras-wise-mobile\mobile"
npx expo run:android
```

**Tempo:** 5-15 minutos (primeira vez), 2-5 minutos (builds seguintes)

**O que acontece:**
- Metro bundler inicia automaticamente
- Gradle compila o APK nativo (inclui Skia)
- APK é instalado no dispositivo
- App abre automaticamente
- Hot reload funciona normalmente

4. **Testar placa:**
   - Tirar foto em qualquer seção
   - Logs esperados:
   ```
   📱 MOBILE: Renderizando placa com Skia...
   [PLACA MOBILE] Iniciando renderização Skia...
   [PLACA MOBILE] Imagem carregada: 1920 x 1080
   ✅ [PLACA MOBILE] Foto com placa gravada
   ```
   - Expandir foto → Placa FIXA na imagem
   - Compartilhar foto → Placa VAI JUNTO (permanente)

---

### Opção 2: EAS Build (Cloud)

**Vantagens:**
- Não precisa Android Studio
- Build na nuvem (Expo servers)
- Gera APK pronto para distribuir

**Desvantagens:**
- Demora mais (10-30 minutos)
- Precisa conta Expo (grátis)
- Precisa internet

**Passos:**

1. **Instalar EAS CLI:**
```bash
npm install -g eas-cli
```

2. **Login:**
```bash
eas login
```

3. **Configurar:**
```bash
cd "C:\Users\Mateus Almeida\obras-wise-mobile\mobile"
eas build:configure
```

4. **Build desenvolvimento:**
```bash
eas build --profile development --platform android
```

5. **Aguardar:** 10-30 minutos

6. **Baixar APK** do link fornecido

7. **Instalar manualmente** no celular

---

## Comparação

| Aspecto | Expo Go | Build Local | EAS Build |
|---------|---------|-------------|-----------|
| **Placa gravada** | ❌ Não | ✅ Sim | ✅ Sim |
| **Tempo setup** | ⚡ 0min | 🐌 5-15min | 🐌 10-30min |
| **Hot reload** | ✅ Sim | ✅ Sim | ✅ Sim |
| **Distribuição** | QR Code | USB/Manual | APK download |
| **Requisitos** | Expo Go app | Android Studio | Internet + Conta Expo |

---

## O Que Acontece com Cada Abordagem

### Expo Go (Atual)
```
📸 Foto tirada → Foto original salva → Overlay visual no app
                                     ↓
                              Ao compartilhar: SEM placa ❌
```

### Build Nativo (Solução)
```
📸 Foto tirada → Canvas Skia renderiza placa → Foto COM placa salva
                                              ↓
                                       Ao compartilhar: COM placa ✅
```

---

## Próximos Passos

### Para Desenvolvimento Rápido (Agora)
✅ Continue usando Expo Go
- Placa aparece visualmente no app
- Ideal para testar outras features

### Para Placa Permanente (Quando pronto)
🚀 Faça build local:
```bash
npx expo run:android
```

**IMPORTANTE:** Uma vez que você fizer o build local, o hot reload continua funcionando normalmente! Você só precisa fazer o build completo na primeira vez.

---

## Verificar se está Funcionando

### No Navegador (WEB)
1. Abrir http://localhost:8081
2. Abrir Console (F12)
3. Criar obra → Tirar foto
4. Verificar logs: `✅ [PLACA WEB] Foto com placa gravada!`
5. Clicar na miniatura → Ver placa FIXA na imagem

### No Mobile (Expo Go)
1. Escanear QR Code
2. Tirar foto
3. Ver log: `📱 [PLACA MOBILE] Expo Go detectado - usando overlay visual`
4. Placa aparece NO APP mas NÃO na foto salva

### No Mobile (Build Nativo)
1. Após `npx expo run:android`
2. Tirar foto
3. Ver log: `✅ [PLACA MOBILE] Foto com placa gravada`
4. Placa aparece FIXA na foto (carimbo permanente)

---

## Perguntas Frequentes

### Por que a placa não fica gravada no Expo Go?

Expo Go é um runtime genérico que não pode incluir todas as bibliotecas nativas. Skia precisa de código nativo compilado (C++/Java), então só funciona em builds nativos.

### A placa funciona offline?

✅ **Sim!** Quase tudo funciona offline:
- Obra, Data, Serviço, Equipe: ✅ Offline
- UTM: ✅ Offline (calculado localmente)
- Endereço: ❌ Precisa internet (API Nominatim)

### Posso usar API externa para gravar a placa?

❌ **Não recomendado:**
- Todas APIs externas (Cloudinary, ImageKit, etc.) requerem internet
- Custo: $49-89/mês
- Privacidade: fotos vão para servidores externos
- Lentidão: 3-5 segundos por foto

✅ **Solução atual é melhor:**
- Grátis
- Offline
- Rápido (< 1 segundo)
- Privado (tudo local)

### Quanto tempo demora o build nativo?

**Primeira vez:** 5-15 minutos
**Builds seguintes:** 2-5 minutos
**Mudanças no código:** Hot reload instantâneo (não precisa rebuild)

---

## Resumo

✅ **WEB**: Placa gravada funcionando (Canvas API)

⚠️ **MOBILE (Expo Go)**: Overlay visual apenas (limitação do Expo Go)

🚀 **MOBILE (Build Nativo)**: Placa gravada permanente (Skia)

**Recomendação:**
- Desenvolvimento: Continue com Expo Go
- Produção: Faça build nativo quando pronto
