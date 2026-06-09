# 📁 Estrutura do Projeto Obras-Wise Mobile

## 🎯 Organização Atual (SEM ERROS)

Este projeto usa uma estrutura **monorepo** com **múltiplos apps** separados:

```
obras-wise-mobile/              ← Raiz do projeto (NÃO É UM APP)
├── .git/                       ← Controle de versão
├── .gitignore                  ← Ignora node_modules, etc
├── README.md                   ← Documentação geral
│
├── mobile/                     ← APP MOBILE (React Native + Expo)
│   ├── package.json           ← ✅ Dependências do mobile
│   ├── node_modules/          ← ✅ Instaladas dentro de mobile/
│   ├── app/                   ← Telas (Expo Router)
│   ├── lib/                   ← Funções auxiliares
│   ├── contexts/              ← Context API (Auth, etc)
│   ├── components/            ← Componentes React Native
│   └── assets/                ← Imagens, fontes
│
├── web/                        ← APP WEB (Next.js)
│   ├── package.json           ← ✅ Dependências do web
│   ├── node_modules/          ← ✅ Instaladas dentro de web/
│   ├── src/                   ← Código fonte Next.js
│   └── public/                ← Assets estáticos
│
├── supabase/                   ← BANCO DE DADOS
│   └── migrations/            ← Scripts SQL
│
├── scripts/                    ← SCRIPTS AUXILIARES
│   └── *.sql                  ← Scripts de manutenção
│
└── docs/                       ← DOCUMENTAÇÃO
    └── *.md                   ← Guias e referências
```

---

## ✅ Por Que NÃO Tem Erro de Build

### 🎯 Estrutura Correta:

1. **Raiz do projeto = Apenas organização**
   - ❌ Não tem `package.json` próprio
   - ❌ Não tem `node_modules` na raiz
   - ✅ Apenas estrutura de pastas

2. **Cada app tem seu próprio `package.json`**
   ```
   mobile/package.json  ← App mobile
   web/package.json     ← App web
   ```

3. **Cada app tem seu próprio `node_modules`**
   ```
   mobile/node_modules/  ← Dependências mobile
   web/node_modules/     ← Dependências web
   ```

---

## ❌ Erro "package.json does not exist in /build/mobile"

### Causa do Erro:

O erro acontece quando você tenta **buildar a partir da raiz** do projeto:

```bash
# ❌ ERRADO - Tentando buildar da raiz
cd /obras-wise-mobile
npm run build  # ← Não existe package.json aqui!
```

### ✅ Solução:

**Sempre entre na pasta do app específico antes de buildar:**

```bash
# ✅ CORRETO - Buildar app mobile
cd /obras-wise-mobile/mobile
npm run start

# ✅ CORRETO - Buildar app web
cd /obras-wise-mobile/web
npm run dev
```

---

## 📋 Comandos Para Cada App

### 🚀 App Mobile (React Native + Expo)

```bash
# Entrar na pasta mobile
cd mobile

# Instalar dependências (primeira vez)
npm install

# Iniciar desenvolvimento
npm start
# ou
npx expo start

# Limpar cache e iniciar
npx expo start --clear

# Build para produção
npx expo build:android
npx expo build:ios
```

### 🌐 App Web (Next.js)

```bash
# Entrar na pasta web
cd web

# Instalar dependências (primeira vez)
npm install

# Iniciar desenvolvimento
npm run dev

# Build para produção
npm run build
npm start
```

---

## 🔧 .gitignore Configurado Corretamente

```gitignore
# Ignorar node_modules de TODOS os apps
node_modules/

# Ignorar build folders
dist/
build/
.expo/
.next/

# Arquivos de ambiente
.env
.env*.local
```

Isso garante que:
- ✅ Cada desenvolvedor instala suas próprias dependências
- ✅ Não há conflitos de versão
- ✅ O repositório fica leve (sem node_modules)

---

## 📦 Estrutura de Dependências

### Mobile (`mobile/package.json`)

```json
{
  "name": "obras-teccel-mobile",
  "main": "expo-router/entry",
  "scripts": {
    "start": "expo start",
    "android": "expo start --android",
    "ios": "expo start --ios"
  },
  "dependencies": {
    "expo": "~54.0.25",
    "react-native": "0.81.5",
    "@supabase/supabase-js": "^2.81.1",
    ...
  }
}
```

### Web (`web/package.json`)

```json
{
  "name": "obras-teccel-web",
  "scripts": {
    "dev": "next dev",
    "build": "next build",
    "start": "next start"
  },
  "dependencies": {
    "next": "15.2.2",
    "react": "^19.0.0",
    "@supabase/supabase-js": "^2.49.2",
    ...
  }
}
```

---

## 🎯 Fluxo de Trabalho

### Primeira Vez Clonando o Projeto:

```bash
# 1. Clonar repositório
git clone <url-do-repo>
cd obras-wise-mobile

# 2. Instalar dependências do mobile
cd mobile
npm install
cd ..

# 3. Instalar dependências do web
cd web
npm install
cd ..

# 4. Pronto!
```

### Desenvolvendo no Mobile:

```bash
cd mobile
npx expo start
```

### Desenvolvendo no Web:

```bash
cd web
npm run dev
```

---

## 🔍 Comparação: Estrutura Errada vs Correta

### ❌ Estrutura que Causa Erro:

```
projeto/
├── package.json          ← Errado: package.json na raiz
├── node_modules/         ← Errado: dependências misturadas
├── mobile/
│   ├── app/
│   └── lib/
└── web/
    └── src/
```

**Problema:** Tenta buildar tudo junto, causa conflitos.

### ✅ Estrutura Correta (Este Projeto):

```
obras-wise-mobile/
├── mobile/
│   ├── package.json      ← Correto: cada app tem seu próprio
│   ├── node_modules/     ← Correto: dependências isoladas
│   └── app/
└── web/
    ├── package.json      ← Correto: independente
    ├── node_modules/     ← Correto: isolado
    └── src/
```

**Vantagem:** Cada app é independente, sem conflitos.

---

## 📚 Vantagens Desta Estrutura

### ✅ Separação Clara
- Mobile e Web são projetos independentes
- Cada um com suas dependências específicas
- Não há conflitos de versão

### ✅ Facilidade de Manutenção
- Atualize mobile sem afetar web
- Atualize web sem afetar mobile
- Desenvolva em paralelo

### ✅ Deploy Independente
- Deploy mobile (Expo)
- Deploy web (Vercel/Netlify)
- Não precisa deployar os dois juntos

### ✅ Compartilhamento de Código
- Banco de dados comum (Supabase)
- Scripts SQL compartilhados
- Documentação unificada

---

## 🆘 Troubleshooting

### Erro: "package.json does not exist"

```bash
# Verifique em qual pasta está
pwd

# Se estiver na raiz, entre no app específico
cd mobile  # ou cd web
```

### Erro: "Cannot find module X"

```bash
# Reinstale dependências
cd mobile  # ou web
rm -rf node_modules
npm install
```

### Erro: "Port already in use"

```bash
# Mobile usa porta 8081
# Web usa porta 3000

# Mate processos antigos
npx expo start --clear  # mobile
npm run dev            # web
```

---

## 📖 Documentos Relacionados

- [README.md](README.md) - Visão geral do projeto
- [mobile/README.md](mobile/README.md) - Documentação do app mobile
- [web/README.md](web/README.md) - Documentação do app web
- [supabase/README.md](supabase/README.md) - Estrutura do banco

---

## ✅ Checklist de Verificação

Para garantir que sua estrutura está correta:

- [ ] **NÃO** existe `package.json` na raiz do projeto
- [ ] Existe `mobile/package.json`
- [ ] Existe `web/package.json`
- [ ] Existe `mobile/node_modules/`
- [ ] Existe `web/node_modules/`
- [ ] `.gitignore` ignora todos os `node_modules/`
- [ ] Sempre executa comandos **dentro** de `mobile/` ou `web/`

---

**Data:** 2025-02-07
**Status:** ✅ Estrutura validada e sem erros
