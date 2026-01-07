# ⚡ Guia Rápido - Persistência de Login no Expo

## 🎯 Objetivo

Fazer o usuário **permanecer logado** mesmo após reload, fechar app, ou reiniciar dispositivo.

## 🚀 Implementação em 3 Passos

### 1️⃣ Tela Inicial - Verificar Sessão

**`app/index.tsx`**

```typescript
import { useEffect } from 'react';
import { useRouter } from 'expo-router';
import AsyncStorage from '@react-native-async-storage/async-storage';

export default function Index() {
  const router = useRouter();

  useEffect(() => {
    checkLogin();
  }, []);

  const checkLogin = async () => {
    const user = await AsyncStorage.getItem('@user');

    if (user) {
      router.replace('/(tabs)'); // Tem sessão → App
    } else {
      router.replace('/login');  // Sem sessão → Login
    }
  };

  return <LoadingScreen />;
}
```

### 2️⃣ Tela de Login - Salvar Sessão

**`app/login.tsx`**

```typescript
const handleLogin = async () => {
  // Validar credenciais...

  if (loginSucesso) {
    // ⭐ SALVAR NO ASYNCSTORAGE
    await AsyncStorage.setItem('@user', username);
    await AsyncStorage.setItem('@role', 'admin');

    router.replace('/(tabs)');
  }
};
```

### 3️⃣ Logout - Limpar Sessão

**`app/(tabs)/profile.tsx`**

```typescript
const handleLogout = async () => {
  // ⭐ LIMPAR ASYNCSTORAGE
  await AsyncStorage.clear();

  router.replace('/login');
};
```

## ✅ Resultado

- ✅ Login 1x → Permanece logado forever
- ✅ Reload (Fast Refresh) → Continua logado
- ✅ Fechar app → Continua logado
- ✅ Logout → Volta para login

## 📦 Instalação

```bash
npm install @react-native-async-storage/async-storage
```

## 🔐 Versão Segura (para tokens)

```typescript
import * as SecureStore from 'expo-secure-store';

// Salvar
await SecureStore.setItemAsync('token', userToken);

// Ler
const token = await SecureStore.getItemAsync('token');

// Deletar
await SecureStore.deleteItemAsync('token');
```

---

**Para mais detalhes**: Ver [SISTEMA_PERSISTENCIA_AUTENTICACAO.md](./SISTEMA_PERSISTENCIA_AUTENTICACAO.md)
