# Como Usar o App Mobile no Expo Go

## Mudança Importante no Expo
O comando `expo publish` foi descontinuado. Agora você usa o app diretamente via desenvolvimento ou publica via EAS.

## Opção 1: Desenvolvimento Local (Mesma Rede Wi-Fi)

### Passo 1: Iniciar o Servidor Expo
```bash
cd mobile
npx expo start
```

### Passo 2: Conectar pelo Expo Go
1. Baixe o **Expo Go** no seu celular:
   - Android: [Google Play Store](https://play.google.com/store/apps/details?id=host.exp.exponent)
   - iOS: [App Store](https://apps.apple.com/app/expo-go/id982107779)

2. Certifique-se que seu celular e computador estão na **mesma rede Wi-Fi**

3. No terminal, você verá um **QR Code**

4. Escaneie o QR Code:
   - **Android**: Abra o Expo Go e clique em "Scan QR Code"
   - **iOS**: Abra a câmera nativa do iPhone e aponte para o QR Code

5. O app vai carregar no seu celular

## Opção 2: Desenvolvimento com Tunnel (Funciona em Qualquer Rede)

### Passo 1: Iniciar com Tunnel
```bash
cd mobile
npx expo start --tunnel
```

### Passo 2: Aguardar o Tunnel Conectar
O Expo vai configurar um tunnel ngrok automaticamente. Você verá:
```
Tunnel connected.
Tunnel ready.
```

### Passo 3: Escanear QR Code
Mesmo processo da Opção 1, mas agora funciona mesmo se você estiver em redes diferentes.

## Opção 3: Publicação no EAS (Expo Application Services)

### Para publicar uma versão do app que qualquer pessoa pode acessar:

#### Passo 1: Instalar EAS CLI
```bash
npm install -g eas-cli
```

#### Passo 2: Login no Expo
```bash
eas login
```

#### Passo 3: Configurar EAS
```bash
cd mobile
eas build:configure
```

#### Passo 4: Criar uma Build
```bash
# Para Android
eas build --platform android --profile development

# Para iOS
eas build --platform ios --profile development
```

#### Passo 5: Publicar Updates (depois da primeira build)
```bash
eas update --branch production
```

## Informações do Projeto

- **Nome**: Obras Teccel
- **Slug**: obras-wise-mobile
- **Versão**: 1.1.0
- **EAS Project ID**: 22bdc367-038a-43b2-b50a-1b8133c0540b

## Problemas Comuns

### "Unable to resolve module"
```bash
cd mobile
rm -rf node_modules
npm install
npx expo start --clear
```

### "Port 8081 already in use"
```bash
npx expo start --port 8082
```

### Tunnel não conecta
1. Verifique sua conexão com internet
2. Tente sem tunnel primeiro: `npx expo start`
3. Se estiver em rede corporativa, pode haver bloqueio de firewall

## Recomendação

Para uso diário de desenvolvimento:
1. Use `npx expo start` (sem tunnel) se estiver na mesma rede
2. Use `npx expo start --tunnel` se precisar testar de redes diferentes
3. Mantenha o servidor rodando enquanto desenvolve
4. O app recarrega automaticamente quando você salva arquivos

## Comandos Úteis

```bash
# Iniciar normalmente
cd mobile && npx expo start

# Iniciar com tunnel
cd mobile && npx expo start --tunnel

# Iniciar e abrir no Android emulador
cd mobile && npx expo start --android

# Limpar cache e iniciar
cd mobile && npx expo start --clear

# Ver logs detalhados
cd mobile && npx expo start --verbose
```

## Status Atual

✅ Servidor pode ser iniciado com `npx expo start --tunnel`
✅ Pacotes atualizados para versões compatíveis
✅ App configurado no EAS
✅ Pronto para desenvolvimento e testes

Para testar agora, execute:
```bash
cd mobile
npx expo start --tunnel
```

E escaneie o QR Code que aparecer no terminal com o app Expo Go!
