# 🎨 Configuração do Logo e Splash Screen

## ✨ Visão Geral

O app agora usa o **logo vermelho com "t" branco** (`t_logo.png`) como:
- ✅ Ícone do app (Android e iOS)
- ✅ Splash screen (tela de carregamento)
- ✅ Adaptive icon (Android)
- ✅ Favicon (Web)

---

## 📁 Estrutura de Arquivos

### Mobile ([mobile/assets/](../mobile/assets/))
```
mobile/assets/
├── icon.png              # Ícone do app (1024x1024)
├── adaptive-icon.png     # Ícone adaptativo Android (1024x1024)
├── splash-icon.png       # Imagem do splash screen (1024x1024)
└── favicon.png           # Favicon para web (192x192)
```

### Web ([web/public/](../web/public/))
```
web/public/
├── t_logo.png           # Logo original
└── favicon.ico          # Favicon (convertido do PNG)
```

---

## 🎨 Especificações do Logo

### Cores
- **Fundo:** `#FF0000` (vermelho vivo)
- **Letra "t":** `#FFFFFF` (branco)
- **Formato:** PNG com cantos arredondados

### Dimensões
- **Original:** 360x360 pixels
- **Recomendado para icon:** 1024x1024 (será redimensionado automaticamente)
- **Tamanho do arquivo:** ~3.2 KB

---

## ⚙️ Configuração no app.json

### Ícone Principal
```json
"icon": "./assets/icon.png"
```

### Splash Screen
```json
"splash": {
  "image": "./assets/splash-icon.png",
  "resizeMode": "contain",
  "backgroundColor": "#FF0000"
}
```

### Android Adaptive Icon
```json
"android": {
  "adaptiveIcon": {
    "foregroundImage": "./assets/adaptive-icon.png",
    "backgroundColor": "#FF0000"
  }
}
```

### Web Favicon
```json
"web": {
  "favicon": "./assets/favicon.png"
}
```

---

## 🚀 Como Atualizar o Logo

### 1. Preparar o arquivo
- Criar um PNG quadrado (recomendado: 1024x1024)
- Garantir boa qualidade e contraste
- Salvar como PNG com transparência (se aplicável)

### 2. Substituir arquivos
```bash
# No diretório mobile/assets/
cp novo_logo.png icon.png
cp novo_logo.png adaptive-icon.png
cp novo_logo.png splash-icon.png
cp novo_logo.png favicon.png
```

### 3. Atualizar cores no app.json
```json
{
  "splash": {
    "backgroundColor": "#SUA_COR"
  },
  "android": {
    "adaptiveIcon": {
      "backgroundColor": "#SUA_COR"
    }
  }
}
```

### 4. Limpar cache e rebuild
```bash
cd mobile
rm -rf .expo node_modules/.cache
npm start -- --clear

# Para produção
npx eas build --platform all
```

---

## 📱 Resultado Esperado

### Android
- **Ícone:** Logo vermelho com "t" branco em forma arredondada
- **Splash:** Logo centralizado com fundo vermelho
- **Adaptive Icon:** Logo se adapta ao formato do launcher (circular, quadrado, etc.)

### iOS
- **Ícone:** Logo vermelho com "t" branco (iOS adiciona cantos arredondados automaticamente)
- **Splash:** Logo centralizado com fundo vermelho

### Web
- **Favicon:** Logo vermelho com "t" branco na aba do navegador

---

## 🎯 Testes Recomendados

### Mobile
1. Instalar app em dispositivo físico
2. Verificar ícone na lista de apps
3. Abrir app e verificar splash screen
4. Testar em diferentes launchers Android (se aplicável)

### Web
1. Abrir navegador
2. Acessar dashboard
3. Verificar favicon na aba

---

## 📝 Histórico de Mudanças

### 2025-01-05
- ✅ Substituído logo antigo por `t_logo.png`
- ✅ Atualizado background do splash para vermelho (`#FF0000`)
- ✅ Configurado adaptive icon do Android
- ✅ Movido `t_logo.png` do diretório raiz para `mobile/assets/`
- ✅ Criado favicon para web

---

## 🔍 Troubleshooting

### Logo não aparece após atualização

**Causa:** Cache do Expo ou do dispositivo

**Solução:**
```bash
# Limpar cache do Expo
cd mobile
rm -rf .expo node_modules/.cache
npm start -- --clear

# Desinstalar app do dispositivo
# Reinstalar app
```

### Splash screen ainda mostra logo antigo

**Causa:** Build antigo ou cache

**Solução:**
```bash
# Gerar novo build
npx eas build --platform android --profile preview --clear-cache
```

### Ícone aparece distorcido

**Causa:** Imagem não é quadrada ou tem qualidade baixa

**Solução:**
1. Garantir que o PNG é **quadrado** (mesma largura e altura)
2. Usar dimensão mínima de 1024x1024 pixels
3. Usar formato PNG de alta qualidade

---

## 🎨 Recursos Adicionais

### Geradores de Ícones
- [App Icon Generator](https://www.appicon.co/) - Gera ícones em todos os tamanhos
- [Expo Icon Maker](https://buildicon.netlify.app/) - Específico para Expo

### Especificações Oficiais
- [Expo App Icons](https://docs.expo.dev/develop/user-interface/app-icons/)
- [Expo Splash Screens](https://docs.expo.dev/develop/user-interface/splash-screen/)
- [Android Adaptive Icons](https://developer.android.com/guide/practices/ui_guidelines/icon_design_adaptive)

---

**Documentação criada em:** 2025-01-05
**Última atualização:** 2025-01-05
