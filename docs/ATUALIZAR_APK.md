# 📱 Guia: Atualizar e Gerar Novo APK

## ✅ Versão Atualizada!

**Versão anterior:** 1.0.0 (versionCode: 1)
**Nova versão:** 1.1.0 (versionCode: 2)

---

## 🎯 Mudanças nesta Versão (1.1.0):

### Mobile:
- ✅ Novos tipos de serviço: Ditais e Book de Aterramento
- ✅ Fotos específicas para cada tipo de serviço
- ✅ Qualidade de foto otimizada (0.6 - fotos menores)
- ✅ Upload mais rápido
- ✅ Correções de bugs

### Admin:
- ✅ Preview de todas as fotos (Ditais e Aterramento)
- ✅ Relatórios PDF personalizados por tipo de serviço
- ✅ Exportação Excel melhorada
- ✅ Mapa GPS com todas as fotos

---

## 🚀 Passo 1: Fazer Login no Expo

```powershell
cd mobile
npx eas-cli login
```

Se não tiver conta:
```powershell
npx eas-cli register
```

---

## 📦 Passo 2: Gerar APK (Preview/Teste)

### Para distribuir FORA da Play Store (instalação manual):

```powershell
npx eas build --platform android --profile preview
```

**Tempo:** 15-20 minutos

Você receberá:
- Link para download do APK
- APK pronto para instalar em qualquer Android

---

## 🏪 Passo 3: Gerar AAB (Para Play Store)

### Para PUBLICAR na Play Store:

```powershell
npx eas build --platform android --profile production
```

**Tempo:** 15-20 minutos

Você receberá:
- Arquivo .AAB (Android App Bundle)
- Pronto para upload na Play Store

---

## 📋 Changelog Completo

### Versão 1.1.0 (Build 2)

**Novos Recursos:**
- 🆕 Tipo de serviço "Ditais" com 5 fotos específicas
  - Abertura
  - Impedir
  - Testar
  - Aterrar
  - Sinalizar

- 🆕 Tipo de serviço "Book de Aterramento" com 4 fotos específicas
  - Vala Aberta
  - Hastes Aplicadas
  - Vala Fechada
  - Medição Terrômetro

**Melhorias:**
- ⚡ Fotos 60-70% menores (quality 0.6)
- ⚡ Upload 3x mais rápido
- ⚡ Economia de dados móveis
- 🎨 Interface melhorada para novos serviços

**Correções:**
- 🐛 Corrigido erro de Blob no upload de fotos
- 🐛 Corrigido import do FileSystem
- 🐛 Melhorada compatibilidade com React Native

---

## 🎯 Comandos Importantes

### Ver status do build:
```powershell
npx eas build:list
```

### Cancelar build:
```powershell
npx eas build:cancel
```

### Ver configuração:
```powershell
npx eas build:configure
```

---

## 📱 Distribuir APK

### Opção 1: Link Direto (Expo)

Quando o build terminar, você recebe um link tipo:
```
https://expo.dev/accounts/seu-usuario/projects/obras-wise-mobile/builds/...
```

Compartilhe este link com os usuários para download direto!

### Opção 2: Download Manual

1. Acesse: https://expo.dev/accounts/[seu-usuario]/projects/obras-wise-mobile/builds
2. Baixe o APK
3. Compartilhe via WhatsApp, Drive, etc.

### Opção 3: Play Store

1. Gere AAB com `--profile production`
2. Acesse: https://play.google.com/console
3. Crie nova versão
4. Upload do AAB
5. Preencha changelog
6. Enviar para revisão

---

## 🔄 Atualizar App nos Celulares

### Se instalou via APK:
1. Baixe novo APK
2. Instale por cima (não precisa desinstalar)
3. Dados são mantidos

### Se instalou via Play Store:
1. Play Store notifica automaticamente
2. Usuário clica em "Atualizar"
3. Atualização automática

---

## 📊 Monitorar Build

Enquanto o build roda, você pode:

1. Ver progresso em tempo real no terminal
2. Acessar: https://expo.dev/accounts/[usuario]/builds
3. Ver logs detalhados
4. Receber notificação quando terminar

---

## 🐛 Solução de Problemas

### Erro: "Not logged in"
```powershell
npx eas-cli login
```

### Erro: "Project not configured"
```powershell
npx eas build:configure
```

### Erro: "Build failed"
1. Ver logs no terminal ou Expo website
2. Corrigir erro
3. Tentar novamente

### Build muito lento
- Normal! Build na nuvem leva 15-25 minutos
- Você pode fechar o terminal (build continua)
- Recebe email quando terminar

---

## 📝 Checklist de Atualização

Antes de fazer build:

- [x] Versão atualizada no app.json (1.1.0)
- [x] versionCode incrementado (2)
- [x] Testado no Expo Go
- [x] Todas mudanças commitadas no git
- [ ] Login feito no EAS
- [ ] Build iniciado
- [ ] APK baixado e testado
- [ ] Distribuído para usuários

---

## 🎉 Próxima Versão (1.2.0)

Planejado para incluir:
- Templates completos Ditais e Aterramento em PDF
- Logo da empresa nos relatórios
- Melhorias de performance
- Modo offline aprimorado

---

## 💡 Dicas

1. **Sempre incremente versionCode** ao fazer novo build
2. **Use `preview` para testes** internos (APK)
3. **Use `production` para Play Store** (AAB)
4. **Teste o APK antes de distribuir**
5. **Mantenha changelog atualizado**

---

## 📞 Suporte

Se algo der errado:
- Logs do build: https://expo.dev
- Documentação EAS: https://docs.expo.dev/build/introduction/
- Issues Expo: https://github.com/expo/expo/issues

---

## ✅ Executar Agora

Para gerar o APK atualizado:

```powershell
cd mobile
npx eas-cli login
npx eas build --platform android --profile preview
```

Aguarde ~20 minutos e baixe o APK! 🚀
