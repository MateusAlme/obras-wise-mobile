# 🔧 Resolver: Expo Carrega Mas Não Entra

## 🚨 Problema

O Expo inicia mas fica travado em "Waiting on http://localhost:8081" e nunca carrega completamente.

## 🎯 Causas Comuns

1. ✅ **Porta bloqueada** - Processo travado na porta 8081
2. ✅ **Cache corrompido** - Cache do Metro Bundler com problemas
3. ⚠️ **Firewall/Antivírus** - Bloqueando conexões locais
4. ⚠️ **node_modules corrompidos** - Dependências quebradas
5. ⚠️ **Watchman travado** (macOS/Linux)
6. ⚠️ **Problemas de rede** - Adaptadores VPN interferindo

---

## 🔥 Soluções Rápidas (Tente Nesta Ordem)

### ✅ Solução 1: Matar Processos e Limpar Cache

```bash
# 1. Encontrar processos na porta 8081
netstat -ano | findstr :8081

# 2. Matar o processo (substitua 12345 pelo PID)
taskkill //F //PID 12345

# 3. Limpar cache e reiniciar
cd mobile
npx expo start --clear
```

**Status**: ✅ Já tentamos isso

---

### ✅ Solução 2: Usar Porta Diferente

```bash
cd mobile
npx expo start --port 8082
```

**Status**: ✅ Já tentamos, mas ainda travou

---

### ⚠️ Solução 3: Deletar node_modules e Reinstalar

```bash
cd mobile

# Deletar node_modules e cache
rm -rf node_modules
rm -rf .expo
del package-lock.json

# Reinstalar tudo
npm install

# Iniciar limpo
npx expo start --clear
```

**Tempo estimado**: 5-10 minutos

---

### ⚠️ Solução 4: Verificar Firewall/Antivírus

#### Windows Defender Firewall

1. Pressione **Win + R**
2. Digite: `firewall.cpl`
3. Clique em **"Permitir um aplicativo através do Firewall do Windows"**
4. Procure por **"Node.js"** e **"Expo"**
5. Marque **"Privada"** e **"Pública"**
6. Se não estiver na lista, clique **"Permitir outro aplicativo"**
7. Adicione:
   - `C:\Program Files\nodejs\node.exe`
   - `C:\Users\SEU_USUARIO\AppData\Roaming\npm\node_modules\expo-cli\bin\expo.js`

#### Kaspersky / Avast / AVG

1. Abra o antivírus
2. Vá em **Configurações > Exceções**
3. Adicione a pasta do projeto:
   - `C:\Users\Mateus Almeida\obras-wise-mobile\mobile`
4. Adicione o Node.js às exceções
5. Reinicie o Expo

---

### ⚠️ Solução 5: Desabilitar Adaptadores de Rede VPN

```bash
# Listar adaptadores de rede
ipconfig /all

# Se houver VPN, desconecte temporariamente
# Exemplo: NordVPN, Hamachi, Cisco AnyConnect
```

**Por quê?** VPNs podem interferir com conexões localhost.

---

### ⚠️ Solução 6: Resetar Configurações de Rede

```bash
# Execute como Administrador
ipconfig /flushdns
netsh winsock reset
netsh int ip reset
```

**⚠️ CUIDADO**: Isso vai resetar todas as configurações de rede. Reinicie o PC depois.

---

### ⚠️ Solução 7: Verificar Hosts File

```bash
# Abrir bloco de notas como Administrador
notepad C:\Windows\System32\drivers\etc\hosts
```

**Verificar se existe**:
```
127.0.0.1 localhost
::1 localhost
```

**Se NÃO existir**, adicione essas linhas e salve.

---

### 🔬 Solução 8: Diagnóstico Avançado

#### Testar se localhost funciona:

```bash
# Testar conexão local
curl http://localhost:8082

# Ou abra no navegador:
http://localhost:8082
```

**Resultado esperado**: Deve mostrar página do Metro Bundler

**Se der erro**: Problema é de rede/firewall, não do Expo

---

#### Verificar logs detalhados:

```bash
cd mobile

# Modo verbose
EXPO_DEBUG=true npx expo start --clear
```

---

### 🚀 Solução 9: Modo LAN (Recomendado)

```bash
cd mobile
npx expo start --lan
```

**Vantagens**:
- Não depende de localhost
- Funciona melhor com firewall
- Permite testar em dispositivo físico

---

### 🧪 Solução 10: Usar Expo Go sem Metro Bundler

```bash
# Criar build de desenvolvimento
cd mobile
npx expo export

# Servir com http-server simples
npx http-server dist -p 8081
```

---

## 🎯 Solução Específica para Seu Caso

Baseado no que testamos, o problema é que o Metro Bundler trava em "Waiting on http://localhost:8082".

### Causa Provável

**Firewall/Antivírus bloqueando conexões locais do Node.js**

### Teste Rápido

1. Abra **PowerShell como Administrador**
2. Execute:

```powershell
Test-NetConnection -ComputerName localhost -Port 8082
```

**Se retornar `TcpTestSucceeded : False`**: Problema é de firewall/rede

---

## ✅ Solução Recomendada (Fazer Agora)

### Passo 1: Limpar Tudo

```bash
cd "C:\Users\Mateus Almeida\obras-wise-mobile\mobile"

# Matar todos os processos Node
tasklist | findstr node
# Para cada PID listado:
taskkill //F //PID [PID_AQUI]

# Deletar cache
rmdir /s /q node_modules
rmdir /s /q .expo
del package-lock.json
```

### Passo 2: Reinstalar

```bash
npm install
```

### Passo 3: Adicionar Exceção no Firewall

```powershell
# Como Administrador
New-NetFirewallRule -DisplayName "Node.js" -Direction Inbound -Program "C:\Program Files\nodejs\node.exe" -Action Allow
New-NetFirewallRule -DisplayName "Node.js" -Direction Outbound -Program "C:\Program Files\nodejs\node.exe" -Action Allow
```

### Passo 4: Iniciar com LAN

```bash
npx expo start --lan --clear
```

---

## 🔍 Se Ainda Não Funcionar

### Verificar Antivírus

1. **Kaspersky**: Adicione `node.exe` às exceções
2. **Avast**: Adicione pasta do projeto às exceções
3. **Windows Defender**: Execute como Administrador:

```powershell
Add-MpPreference -ExclusionPath "C:\Users\Mateus Almeida\obras-wise-mobile\mobile"
Add-MpPreference -ExclusionProcess "node.exe"
```

---

### Tentar Expo Go no Dispositivo Físico

1. Instale **Expo Go** no celular (Play Store)
2. Conecte celular e PC na **mesma WiFi**
3. Execute:

```bash
npx expo start --lan
```

4. Escaneie QR Code no Expo Go

**Isso bypassa o localhost e pode funcionar mesmo com firewall**

---

## 📊 Checklist de Diagnóstico

Execute e anote os resultados:

```bash
# 1. Versão do Node
node --version
# Esperado: v18+ ou v20+

# 2. Versão do Expo
npx expo --version
# Esperado: ~54.0.0

# 3. Porta 8082 livre?
netstat -ano | findstr :8082
# Esperado: Vazio (nenhum processo)

# 4. Localhost funciona?
curl http://localhost:8082
# Esperado: Erro (mas deve tentar conectar)

# 5. Firewall permitindo Node?
netsh firewall show allowedprogram
# Deve listar node.exe
```

---

## 🎓 Explicação Técnica

### O que é Metro Bundler?

- É o **empacotador** de código JavaScript do React Native
- Converte seu código TypeScript/JSX em JavaScript puro
- Serve os arquivos via HTTP (localhost:8081)
- O app React Native se conecta a ele para baixar o código

### Por que trava em "Waiting on..."?

1. O Metro inicia o servidor HTTP
2. Tenta conectar em `http://localhost:8081`
3. **Firewall bloqueia** a conexão
4. Fica esperando infinitamente

### Solução: Permitir conexões locais

- Adicionar node.exe às exceções do firewall
- Ou usar `--lan` para conectar via IP local (192.168.x.x)

---

## 🆘 Última Opção: Reinstalar Node.js

Se nada funcionar:

1. Desinstale Node.js completamente
2. Baixe nova versão: https://nodejs.org (LTS)
3. Instale com **"Add to PATH"** marcado
4. Reinicie o PC
5. Reinstale dependências:

```bash
cd "C:\Users\Mateus Almeida\obras-wise-mobile\mobile"
npm install
npx expo start --lan
```

---

## ✅ Resultado Esperado

Quando funcionar, você verá:

```
Starting project at C:\Users\Mateus Almeida\obras-wise-mobile\mobile
Starting Metro Bundler
✓ Metro Bundler ready at http://localhost:8082

› Metro waiting on exp://192.168.1.100:8082
› Scan the QR code above with Expo Go (Android) or the Camera app (iOS)

› Press a │ open Android
› Press w │ open web

› Press r │ reload app
› Press m │ toggle menu
› Press ? │ show all commands
```

---

## 📞 Próximos Passos

1. **Tente Solução 3**: Deletar `node_modules` e reinstalar
2. **Tente Solução 4**: Adicionar exceção no firewall
3. **Tente Solução 9**: Usar `--lan` em vez de localhost
4. Me avise qual solução funcionou!

---

**Atualizado**: Janeiro 2025
