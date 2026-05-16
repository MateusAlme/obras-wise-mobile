# 🔧 Solução Rápida: Erro de Token Inválido

## ❌ Erro Atual:
```
[AuthApiError: Invalid Refresh Token: Refresh Token Not Found]
```

---

## ✅ Solução Imediata (2 minutos)

### Opção 1: Limpar Dados do App (Mais Rápido)

**Android:**
1. Feche o app completamente
2. Vá em: **Configurações** → **Apps** → **Expo Go** (ou seu app)
3. Clique em: **Armazenamento**
4. Clique em: **Limpar dados** e **Limpar cache**
5. Abra o app novamente
6. Faça login com:
   - Matrícula: `2025`
   - Senha: `teccel2025`

**iOS:**
1. Desinstale o app
2. Reinstale
3. Faça login novamente

---

### Opção 2: Logout Manual no App

Se o app ainda abre:
1. Vá em **Configurações** ou **Perfil**
2. Clique em **Sair** ou **Logout**
3. Faça login novamente com matrícula 2025

---

### Opção 3: Reiniciar o Servidor de Desenvolvimento

No terminal onde o app está rodando:

```bash
# Pressione Ctrl+C para parar
# Depois execute:
npx expo start --clear
```

Depois reabra o app no celular.

---

## 🔍 Por Que Aconteceu?

O **refresh token** é usado para manter você logado. Ele pode expirar ou ser invalidado se:

1. **Ficou muito tempo sem usar** o app
2. **Limpou dados** do AsyncStorage manualmente
3. **Múltiplos logins** no mesmo usuário
4. **Token expirou** (configuração do Supabase)

---

## ✨ O Que Foi Corrigido

Adicionei tratamento automático de token inválido no código:

- [mobile/contexts/AuthContext.tsx](mobile/contexts/AuthContext.tsx)
  - ✅ Detecta quando o token está inválido
  - ✅ Faz logout automático
  - ✅ Limpa o cache
  - ✅ Redireciona para tela de login

---

## 📱 Testando Após a Correção

1. **Recarregue o app** (se estiver em desenvolvimento)
2. **Faça login** com matrícula 2025
3. **Vá para a aba Obras**
4. **Clique no botão verde 🔄** (Limpar Cache)
5. **Deve ver todas as 40 obras!**

---

## 🎯 Resumo: O Que Fazer AGORA

### Passo 1: Limpar Dados do App
```
Android: Configurações → Apps → Limpar dados
iOS: Desinstalar e reinstalar
```

### Passo 2: Abrir o App e Fazer Login
```
Matrícula: 2025
Senha: teccel2025
```

### Passo 3: Limpar Cache de Obras
```
Clicar no botão verde 🔄 na tela de Obras
```

### Passo 4: Verificar
```
Deve mostrar: "40 de 40 obra(s) cadastrada(s)"
```

---

## 🆘 Se Ainda Não Funcionar

Execute este diagnóstico no Supabase SQL Editor:

```sql
-- Verificar se usuário 2025 existe e está ativo
SELECT
  u.id,
  u.email,
  u.created_at,
  ua.matricula,
  ua.ativo
FROM auth.users u
LEFT JOIN usuarios_app ua ON ua.supabase_user_id = u.id
WHERE u.email = '2025@obraswise.com';

-- Verificar total de obras
SELECT COUNT(*) as total FROM obras;

-- Verificar políticas RLS
SELECT policyname, cmd
FROM pg_policies
WHERE tablename = 'obras';
```

---

## ✅ Checklist Final

Depois de fazer login novamente:

- [ ] Login com matrícula 2025 funciona
- [ ] Sem erros de token
- [ ] Tela de obras carrega
- [ ] Botão verde 🔄 aparece
- [ ] Ao clicar, mostra diálogo de confirmação
- [ ] Após confirmar, recarrega obras
- [ ] Mostra "40 de 40 obra(s)"
- [ ] Todas as obras aparecem na lista

---

**Data:** 2025-02-07
**Status:** ⚠️ Aguardando teste após limpar dados do app
