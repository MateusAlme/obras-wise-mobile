# 🔐 Sistema de Persistência de Autenticação - Expo React Native

## 📋 Visão Geral

Este documento explica **como implementar um sistema de autenticação persistente** em apps Expo/React Native que mantém o usuário logado mesmo após reloads, fechamento do app, ou reinicializações.

**Funcionalidades Principais:**
- ✅ Usuário faz login **uma vez**
- ✅ Permanece logado **mesmo após reload** (Fast Refresh)
- ✅ Permanece logado **após fechar o app**
- ✅ Permanece logado **após reiniciar o dispositivo**
- ✅ Logout manual limpa todas as credenciais
- ✅ Funciona **100% offline** (após primeiro login)

## 🎯 Como Funciona

### Arquitetura Geral

```
┌─────────────────────────────────────────────────────────────┐
│                    APP INICIALIZA (index.tsx)               │
│                                                             │
│  1. Verifica AsyncStorage                                  │
│     - @equipe_logada existe?                               │
│     - @user_logado existe?                                 │
│     - @user_role existe?                                   │
│                                                             │
│  2. SE EXISTEM → Redireciona para tela principal          │
│     SE NÃO → Redireciona para /login                       │
└─────────────────────────────────────────────────────────────┘
                           │
                           ▼
        ┌──────────────────────────────────┐
        │  USUÁRIO FAZ LOGIN (login.tsx)   │
        │                                  │
        │  1. Valida credenciais           │
        │  2. Salva no AsyncStorage:       │
        │     - @equipe_logada             │
        │     - @user_logado               │
        │     - @user_role                 │
        │     - @login_timestamp           │
        │     - @cached_credentials        │
        │  3. Redireciona para app         │
        └──────────────────────────────────┘
                           │
                           ▼
        ┌──────────────────────────────────┐
        │   APP RECARREGA (Fast Refresh)   │
        │                                  │
        │  1. index.tsx verifica storage   │
        │  2. Encontra credenciais salvas  │
        │  3. Redireciona direto para app  │
        │  4. USUÁRIO NÃO PRECISA RELOGAR  │
        └──────────────────────────────────┘
```

## 📁 Estrutura de Arquivos

```
mobile/
├── app/
│   ├── index.tsx              # ⭐ Verificação inicial de sessão
│   ├── login.tsx              # ⭐ Tela de login e persistência
│   ├── (tabs)/
│   │   └── profile.tsx        # ⭐ Exibição de dados e logout
│   └── (comp)/
│       └── profile.tsx        # Perfil alternativo (COMP)
└── lib/
    └── crypto-utils.ts        # Hash de senhas (opcional)
```

## 🔑 Implementação Detalhada

### 1️⃣ Tela Inicial - Verificação de Sessão

**Arquivo**: `app/index.tsx`

Este é o **ponto de entrada** do app. Verifica se há sessão salva antes de decidir para onde redirecionar.

```typescript
import { useEffect, useState } from 'react';
import { useRouter } from 'expo-router';
import { View, ActivityIndicator } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';

export default function Index() {
  const router = useRouter();
  const [checking, setChecking] = useState(true);

  useEffect(() => {
    checkLoginStatus();
  }, []);

  const checkLoginStatus = async () => {
    try {
      // ⭐ PASSO 1: Verificar se há login salvo no AsyncStorage
      const equipeLogada = await AsyncStorage.getItem('@equipe_logada');
      const userLogado = await AsyncStorage.getItem('@user_logado');
      const userRole = await AsyncStorage.getItem('@user_role');

      if (equipeLogada && userLogado) {
        // ⭐ PASSO 2: Há sessão salva - redirecionar para app

        // Exemplo: Verificar role para redirecionar para tela específica
        if (userRole === 'compressor' && equipeLogada === 'COMP') {
          router.replace('/(comp)'); // Rota especial para usuário COMP
        } else {
          router.replace('/(tabs)'); // Rota padrão para equipes normais
        }
      } else {
        // ⭐ PASSO 3: Não há sessão - redirecionar para login
        router.replace('/login');
      }
    } catch (error) {
      console.error('Erro ao verificar login:', error);
      // Em caso de erro, redirecionar para login por segurança
      router.replace('/login');
    } finally {
      setChecking(false);
    }
  };

  // ⭐ Mostrar loading enquanto verifica sessão
  return (
    <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: '#f5f5f5' }}>
      <ActivityIndicator size="large" color="#0066cc" />
    </View>
  );
}
```

**🔑 Conceitos-Chave:**

1. **`useEffect(() => {}, [])`**: Executa `checkLoginStatus` assim que o app abre
2. **`AsyncStorage.getItem()`**: Lê dados persistidos localmente
3. **`router.replace()`**: Redireciona sem adicionar à pilha de navegação (não pode voltar)
4. **Loading state**: Mostra spinner enquanto verifica (evita flash de tela de login)

### 2️⃣ Tela de Login - Salvar Sessão

**Arquivo**: `app/login.tsx`

Após validar as credenciais, **salva a sessão no AsyncStorage**.

```typescript
import { useState, useEffect } from 'react';
import { View, Text, TextInput, TouchableOpacity, Alert } from 'react-native';
import { useRouter } from 'expo-router';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { hashPassword } from '../lib/crypto-utils'; // Opcional: hash de senha

export default function Login() {
  const router = useRouter();
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);

  const handleLogin = async () => {
    if (!username || !password) {
      Alert.alert('Erro', 'Preencha usuário e senha');
      return;
    }

    setLoading(true);

    try {
      // ⭐ PASSO 1: Validar credenciais (API, banco local, etc.)
      const isValid = await validateCredentials(username, password);

      if (!isValid) {
        Alert.alert('Erro', 'Credenciais inválidas');
        setLoading(false);
        return;
      }

      // ⭐ PASSO 2: Login bem-sucedido - SALVAR NO ASYNCSTORAGE
      await AsyncStorage.setItem('@user_logado', username);
      await AsyncStorage.setItem('@user_role', 'equipe'); // ou role retornado pela API
      await AsyncStorage.setItem('@login_timestamp', new Date().toISOString());

      // ⭐ PASSO 3 (Opcional): Salvar credenciais em cache para login offline
      const passwordHash = await hashPassword(password);
      await AsyncStorage.setItem('@cached_credentials', JSON.stringify({
        username: username,
        password_hash: passwordHash,
        role: 'equipe',
        last_validated: new Date().toISOString(),
      }));

      // ⭐ PASSO 4: Redirecionar para app
      console.log('Login realizado com sucesso!');
      router.replace('/(tabs)'); // Redireciona para tela principal

      setLoading(false);
    } catch (error) {
      console.error('Erro ao fazer login:', error);
      Alert.alert('Erro', 'Não foi possível fazer login');
      setLoading(false);
    }
  };

  // Função de validação (exemplo simplificado)
  const validateCredentials = async (username: string, password: string) => {
    // Validar com API (online)
    // OU validar com cache local (offline)
    // Retornar true/false
    return true; // Exemplo
  };

  return (
    <View style={{ flex: 1, padding: 20, justifyContent: 'center' }}>
      <Text style={{ fontSize: 24, marginBottom: 20 }}>Login</Text>

      <TextInput
        placeholder="Usuário"
        value={username}
        onChangeText={setUsername}
        style={{ borderWidth: 1, padding: 10, marginBottom: 10 }}
      />

      <TextInput
        placeholder="Senha"
        value={password}
        onChangeText={setPassword}
        secureTextEntry
        style={{ borderWidth: 1, padding: 10, marginBottom: 20 }}
      />

      <TouchableOpacity
        onPress={handleLogin}
        disabled={loading}
        style={{ backgroundColor: '#0066cc', padding: 15, borderRadius: 5 }}
      >
        <Text style={{ color: 'white', textAlign: 'center' }}>
          {loading ? 'Entrando...' : 'Entrar'}
        </Text>
      </TouchableOpacity>
    </View>
  );
}
```

**🔑 Dados Salvos no AsyncStorage:**

| Chave | Descrição | Exemplo |
|-------|-----------|---------|
| `@user_logado` | Nome do usuário/equipe logado | `"CNT 01"`, `"COMP"` |
| `@user_role` | Perfil/role do usuário | `"equipe"`, `"compressor"`, `"admin"` |
| `@login_timestamp` | Data/hora do login | `"2025-01-07T10:30:00.000Z"` |
| `@cached_credentials` | Credenciais em cache (hash) para login offline | `{ username, password_hash, role }` |

### 3️⃣ Tela de Perfil - Exibir Dados e Logout

**Arquivo**: `app/(tabs)/profile.tsx`

Carrega dados do AsyncStorage para exibir e permite logout.

```typescript
import { View, Text, TouchableOpacity, Alert } from 'react-native';
import { useRouter } from 'expo-router';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useState, useEffect } from 'react';

export default function Profile() {
  const router = useRouter();
  const [user, setUser] = useState<string>('');
  const [loginDate, setLoginDate] = useState<string>('');
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    loadUserData();
  }, []);

  // ⭐ PASSO 1: Carregar dados do usuário do AsyncStorage
  const loadUserData = async () => {
    try {
      const userLogado = await AsyncStorage.getItem('@user_logado');
      const loginTimestamp = await AsyncStorage.getItem('@login_timestamp');

      setUser(userLogado || 'Usuário');

      if (loginTimestamp) {
        const date = new Date(loginTimestamp);
        setLoginDate(date.toLocaleDateString('pt-BR'));
      }
    } catch (error) {
      console.error('Erro ao carregar dados do usuário:', error);
    }
  };

  // ⭐ PASSO 2: Logout - Limpar AsyncStorage e redirecionar
  const handleLogout = async () => {
    Alert.alert(
      'Sair',
      'Tem certeza que deseja sair?',
      [
        { text: 'Cancelar', style: 'cancel' },
        {
          text: 'Sair',
          style: 'destructive',
          onPress: async () => {
            try {
              setLoading(true);

              // ⭐ Limpar TUDO do AsyncStorage
              await AsyncStorage.clear();

              // ⭐ Redirecionar para login
              setTimeout(() => {
                router.replace('/login');
              }, 100);
            } catch (error) {
              console.error('Erro ao fazer logout:', error);
              Alert.alert('Erro', 'Não foi possível sair');
              setLoading(false);
            }
          },
        },
      ]
    );
  };

  return (
    <View style={{ flex: 1, padding: 20 }}>
      <Text style={{ fontSize: 24, marginBottom: 10 }}>Perfil</Text>

      <Text style={{ fontSize: 18 }}>Usuário: {user}</Text>
      <Text style={{ fontSize: 14, color: 'gray' }}>Login em: {loginDate}</Text>

      <TouchableOpacity
        onPress={handleLogout}
        disabled={loading}
        style={{
          backgroundColor: '#dc2626',
          padding: 15,
          borderRadius: 5,
          marginTop: 30
        }}
      >
        <Text style={{ color: 'white', textAlign: 'center' }}>
          {loading ? 'Saindo...' : 'Sair'}
        </Text>
      </TouchableOpacity>
    </View>
  );
}
```

## 🔐 Sistema de Login Offline (Opcional)

Para permitir login offline usando credenciais em cache:

**Arquivo**: `lib/crypto-utils.ts`

```typescript
import * as Crypto from 'expo-crypto';

// ⭐ Hash de senha usando SHA-256
export async function hashPassword(password: string): Promise<string> {
  return await Crypto.digestStringAsync(
    Crypto.CryptoDigestAlgorithm.SHA256,
    password
  );
}

// ⭐ Verificar senha comparando hashes
export async function verifyPassword(
  inputPassword: string,
  storedHash: string
): Promise<boolean> {
  const inputHash = await hashPassword(inputPassword);
  return inputHash === storedHash;
}
```

**No login.tsx**, adicione verificação offline:

```typescript
const handleLogin = async () => {
  // ... validação de campos ...

  setLoading(true);
  const isOnline = await checkInternetConnection(); // Função customizada

  try {
    if (isOnline) {
      // ⭐ MODO ONLINE: Validar com API
      const response = await fetch('https://api.example.com/login', {
        method: 'POST',
        body: JSON.stringify({ username, password }),
      });

      const data = await response.json();

      if (data.success) {
        // Salvar credenciais
        await AsyncStorage.setItem('@user_logado', username);
        await AsyncStorage.setItem('@user_role', data.role);

        // Cache para offline
        const passwordHash = await hashPassword(password);
        await AsyncStorage.setItem('@cached_credentials', JSON.stringify({
          username,
          password_hash: passwordHash,
          role: data.role,
        }));

        router.replace('/(tabs)');
      }
    } else {
      // ⭐ MODO OFFLINE: Validar com cache
      const cachedStr = await AsyncStorage.getItem('@cached_credentials');

      if (!cachedStr) {
        Alert.alert('Erro', 'Sem conexão e sem credenciais em cache');
        return;
      }

      const cached = JSON.parse(cachedStr);

      if (cached.username !== username) {
        Alert.alert('Erro', 'Usuário não encontrado no cache');
        return;
      }

      const isPasswordValid = await verifyPassword(password, cached.password_hash);

      if (isPasswordValid) {
        // Login offline bem-sucedido
        await AsyncStorage.setItem('@user_logado', username);
        await AsyncStorage.setItem('@user_role', cached.role);
        await AsyncStorage.setItem('@login_mode', 'offline');

        router.replace('/(tabs)');
      } else {
        Alert.alert('Erro', 'Senha incorreta');
      }
    }
  } catch (error) {
    console.error('Erro ao fazer login:', error);
    Alert.alert('Erro', 'Não foi possível fazer login');
  } finally {
    setLoading(false);
  }
};
```

## 📊 Fluxo Completo

### Primeiro Acesso (Novo Usuário)

```
1. App abre → index.tsx
2. Verifica AsyncStorage → VAZIO
3. Redireciona para /login
4. Usuário digita credenciais
5. Valida com API (online)
6. Salva no AsyncStorage:
   - @user_logado: "João"
   - @user_role: "admin"
   - @login_timestamp: "2025-01-07..."
   - @cached_credentials: { hash... }
7. Redireciona para /(tabs)
8. Usuário usa o app ✅
```

### Reload/Fast Refresh

```
1. Desenvolvedor salva código (Fast Refresh)
2. App recarrega → index.tsx executa novamente
3. Verifica AsyncStorage → ENCONTRA DADOS
4. Redireciona DIRETO para /(tabs)
5. Usuário NÃO precisa fazer login novamente ✅
```

### Fechar e Reabrir App

```
1. Usuário fecha o app (swipe/home)
2. Usuário reabre o app (dias depois)
3. App inicia → index.tsx
4. Verifica AsyncStorage → DADOS AINDA LÁ
5. Redireciona DIRETO para /(tabs)
6. Usuário NÃO precisa fazer login novamente ✅
```

### Logout

```
1. Usuário clica "Sair" no perfil
2. AsyncStorage.clear() → REMOVE TUDO
3. Redireciona para /login
4. Na próxima abertura, volta para login ✅
```

## 🛠️ Dependências Necessárias

```bash
# AsyncStorage - Persistência local
npm install @react-native-async-storage/async-storage

# Expo Crypto - Hash de senhas (opcional)
npx expo install expo-crypto

# Expo Router - Navegação
npx expo install expo-router
```

## ⚙️ Configuração do Expo Router

**Arquivo**: `app/_layout.tsx`

```typescript
import { Stack } from 'expo-router';

export default function RootLayout() {
  return (
    <Stack screenOptions={{ headerShown: false }}>
      <Stack.Screen name="index" />
      <Stack.Screen name="login" />
      <Stack.Screen name="(tabs)" />
    </Stack>
  );
}
```

## 🎯 Boas Práticas

### 1. **Usar Prefixo nas Chaves**

```typescript
// ✅ BOM: Com prefixo @ para organização
await AsyncStorage.setItem('@app_user_logado', 'João');
await AsyncStorage.setItem('@app_user_role', 'admin');

// ❌ RUIM: Sem prefixo
await AsyncStorage.setItem('user', 'João');
await AsyncStorage.setItem('role', 'admin');
```

### 2. **Validar Dados ao Ler**

```typescript
const loadUserData = async () => {
  try {
    const user = await AsyncStorage.getItem('@user_logado');

    // ✅ BOM: Validar antes de usar
    if (user && user.length > 0) {
      setUser(user);
    } else {
      // Redirecionar para login se dados inválidos
      router.replace('/login');
    }
  } catch (error) {
    console.error('Erro:', error);
    router.replace('/login');
  }
};
```

### 3. **Limpar Apenas Chaves Específicas (Alternativa ao Clear)**

```typescript
// Se você tem outros dados no AsyncStorage que não quer apagar
const handleLogout = async () => {
  try {
    // ✅ Remover apenas chaves de autenticação
    await AsyncStorage.multiRemove([
      '@user_logado',
      '@user_role',
      '@login_timestamp',
      '@cached_credentials',
    ]);

    router.replace('/login');
  } catch (error) {
    console.error('Erro ao fazer logout:', error);
  }
};
```

### 4. **Timeout no Redirecinoamento**

```typescript
// ✅ BOM: Usar setTimeout para garantir que estado é limpo
setTimeout(() => {
  router.replace('/login');
}, 100);

// ❌ RUIM: Redirecionar imediatamente (pode causar race condition)
router.replace('/login');
```

### 5. **Segurança - Nunca Salvar Senha em Texto Plano**

```typescript
// ❌ NUNCA FAÇA ISSO
await AsyncStorage.setItem('@user_password', password); // Senha em texto plano!

// ✅ SEMPRE use hash
const passwordHash = await hashPassword(password);
await AsyncStorage.setItem('@cached_credentials', JSON.stringify({
  username,
  password_hash: passwordHash, // Hash seguro
}));
```

## 🔒 Considerações de Segurança

### AsyncStorage é Seguro?

**NO iOS/Android:**
- ✅ Dados armazenados no sandbox do app
- ✅ Outros apps não conseguem acessar
- ⚠️ Dados **não são criptografados** por padrão
- ⚠️ Com root/jailbreak, dados podem ser lidos

**Para dados sensíveis (tokens, senhas):**

Use **Expo SecureStore** em vez de AsyncStorage:

```bash
npx expo install expo-secure-store
```

```typescript
import * as SecureStore from 'expo-secure-store';

// Salvar
await SecureStore.setItemAsync('user_token', token);

// Ler
const token = await SecureStore.getItemAsync('user_token');

// Deletar
await SecureStore.deleteItemAsync('user_token');
```

**Comparação:**

| Recurso | AsyncStorage | SecureStore |
|---------|--------------|-------------|
| Criptografia | ❌ Não | ✅ Sim (Keychain/Keystore) |
| Tamanho máximo | ~6MB | ~2KB por item |
| Performance | Rápido | Médio |
| Plataformas | iOS, Android, Web | iOS, Android apenas |
| Uso ideal | Preferências, cache | Tokens, senhas |

## 📝 Checklist de Implementação

Use este checklist ao implementar em um novo projeto:

- [ ] Instalar `@react-native-async-storage/async-storage`
- [ ] Criar `app/index.tsx` com verificação de sessão
- [ ] Criar `app/login.tsx` com salvamento de credenciais
- [ ] Salvar dados no AsyncStorage após login bem-sucedido
- [ ] Criar tela de perfil com exibição de dados e logout
- [ ] Implementar `AsyncStorage.clear()` no logout
- [ ] Testar: Login → Reload (Fast Refresh) → Ainda logado? ✅
- [ ] Testar: Login → Fechar app → Reabrir → Ainda logado? ✅
- [ ] Testar: Logout → AsyncStorage vazio? ✅
- [ ] (Opcional) Implementar login offline com cache
- [ ] (Opcional) Usar SecureStore para tokens sensíveis

## 🎓 Resumo Executivo

**O segredo é simples:**

1. **No login**: Salve dados do usuário no `AsyncStorage`
2. **Ao abrir o app**: Verifique se há dados no `AsyncStorage`
   - Se **SIM**: Redirecione para o app
   - Se **NÃO**: Redirecione para login
3. **No logout**: Limpe o `AsyncStorage` e redirecione para login

**Por que funciona mesmo após reload?**

O `AsyncStorage` é **persistente**. Dados salvos ficam no disco do dispositivo, não na memória. Quando o app recarrega (Fast Refresh), o código executa novamente, lê os dados do disco, e redireciona automaticamente.

## 🔗 Referências

- [AsyncStorage Docs](https://react-native-async-storage.github.io/async-storage/)
- [Expo SecureStore](https://docs.expo.dev/versions/latest/sdk/securestore/)
- [Expo Router](https://docs.expo.dev/router/introduction/)
- [Expo Crypto](https://docs.expo.dev/versions/latest/sdk/crypto/)

---

**Criado para**: Replicar sistema de persistência de autenticação em outros projetos

**Baseado em**: obras-wise-mobile app (React Native + Expo)

**Última atualização**: 2025-01-07
