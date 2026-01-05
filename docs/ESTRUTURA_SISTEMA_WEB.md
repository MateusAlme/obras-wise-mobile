# 📚 Estrutura do Sistema Web - Obras Wise

> Guia completo de navegação e organização do projeto web Next.js

## 📁 Estrutura de Pastas Principal

```
web/
├── src/                          # Código fonte
│   ├── app/                      # App Router (Next.js 13+)
│   │   ├── (tabs)/              # Rotas autenticadas (layout com sidebar)
│   │   │   ├── dashboard/       # 📊 Dashboard principal
│   │   │   ├── obras/           # 🏗️ Listagem de obras
│   │   │   └── layout.tsx       # Layout com Sidebar
│   │   ├── api/                 # 🔌 API Routes (Backend Next.js)
│   │   │   ├── admin/           # Endpoints administrativos
│   │   │   │   ├── users/       # CRUD de usuários admin
│   │   │   │   └── equipes/     # CRUD de equipes
│   │   │   ├── obras/           # CRUD de obras
│   │   │   └── auth/            # Autenticação (login/logout)
│   │   ├── acompanhamento/      # 📋 Página de acompanhamento
│   │   ├── equipes/             # 👥 Gerenciamento de equipes
│   │   ├── reports/             # 📄 Relatórios e exportação
│   │   ├── users/               # 👤 Gerenciamento de usuários
│   │   ├── login/               # 🔐 Página de login
│   │   ├── layout.tsx           # Layout raiz
│   │   └── globals.css          # Estilos globais (Tailwind)
│   ├── components/              # 🧩 Componentes reutilizáveis
│   │   ├── ProtectedRoute.tsx   # HOC de proteção de rotas
│   │   ├── Sidebar.tsx          # Menu lateral
│   │   └── PhotoGallery.tsx     # Galeria de fotos
│   ├── contexts/                # 🔄 Context API (React)
│   │   └── AuthContext.tsx      # Contexto de autenticação
│   └── lib/                     # 📚 Bibliotecas e utilitários
│       ├── supabase.ts          # Cliente Supabase (frontend)
│       ├── supabase-admin.ts    # Admin Supabase (backend)
│       ├── pdf-generator.ts     # Geração de PDFs
│       └── excel-generator.ts   # Geração de Excel
├── public/                      # Arquivos estáticos
├── .env.local                   # Variáveis de ambiente (NÃO COMMITAR)
├── next.config.js               # Configuração Next.js
├── tailwind.config.ts           # Configuração Tailwind CSS
├── tsconfig.json                # Configuração TypeScript
└── package.json                 # Dependências do projeto
```

---

## 🗂️ Detalhamento por Funcionalidade

### 1️⃣ **Autenticação** (`src/app/login/`)

**Onde encontrar:**
- **Página de Login:** `src/app/login/page.tsx`
- **API de Login:** `src/app/api/auth/login/route.ts`
- **Contexto de Auth:** `src/contexts/AuthContext.tsx`
- **Proteção de Rotas:** `src/components/ProtectedRoute.tsx`

**Como funciona:**
1. Usuário faz login em `/login`
2. API valida credenciais no Supabase
3. Token JWT armazenado no `localStorage`
4. `AuthContext` gerencia estado global do usuário
5. `ProtectedRoute` bloqueia acesso sem autenticação

**Editar:**
- Mudar layout de login → `src/app/login/page.tsx`
- Adicionar campos → `src/app/login/page.tsx` (linha ~50)
- Alterar lógica de autenticação → `src/app/api/auth/login/route.ts`

---

### 2️⃣ **Dashboard** (`src/app/(tabs)/dashboard/`)

**Onde encontrar:**
- **Página Principal:** `src/app/(tabs)/dashboard/page.tsx`
- **API de Estatísticas:** `src/app/api/dashboard/stats/route.ts`

**Componentes:**
- Cards de estatísticas (Total, Completas, Parciais, Taxa)
- Gráficos (Chart.js ou Recharts)
- Resumo por equipe
- Obras recentes

**Editar:**
- Adicionar novo card → `src/app/(tabs)/dashboard/page.tsx` (seção de stats)
- Mudar cores/estilos → Tailwind classes inline
- Alterar query de dados → `src/app/api/dashboard/stats/route.ts`

---

### 3️⃣ **Listagem de Obras** (`src/app/(tabs)/obras/`)

**Onde encontrar:**
- **Página:** `src/app/(tabs)/obras/page.tsx`
- **API:** `src/app/api/obras/route.ts`

**Funcionalidades:**
- Filtros (período, equipe, serviço)
- Busca por número de obra
- Tabela paginada
- Modal de detalhes (Book da Obra)

**Editar:**
- Adicionar filtro → `page.tsx` (seção de filtros)
- Mudar colunas da tabela → `page.tsx` (linha da `<table>`)
- Alterar query do banco → `src/app/api/obras/route.ts`

---

### 4️⃣ **Acompanhamento** (`src/app/acompanhamento/`)

**Onde encontrar:**
- **Página:** `src/app/acompanhamento/page.tsx`

**Diferenças do `/obras`:**
- Foco em obras em andamento
- Estatísticas de conclusão
- Drawer lateral (Book da Obra)
- Duplo clique para abrir detalhes

**Editar:**
- Mudar estatísticas → `page.tsx` (seção Stats)
- Alterar drawer → `page.tsx` (componente Drawer)
- Adicionar filtros → `page.tsx` (seção de filtros)

---

### 5️⃣ **Relatórios** (`src/app/reports/`)

**Onde encontrar:**
- **Página:** `src/app/reports/page.tsx`
- **Gerador PDF:** `src/lib/pdf-generator.ts`
- **Gerador Excel:** `src/lib/excel-generator.ts`

**Funcionalidades:**
- Seleção múltipla de obras (checkbox)
- Exportar Excel (múltiplas obras)
- Exportar PDF individual (menu 3 pontos)
- Marca d'água queimada nas fotos

**Editar:**
- Adicionar campo no Excel → `src/lib/excel-generator.ts`
- Mudar template PDF → `src/lib/pdf-generator.ts`
- Alterar header Energisa → `pdf-generator.ts` (linha ~50)

---

### 6️⃣ **Gerenciamento de Equipes** (`src/app/equipes/`)

**Onde encontrar:**
- **Página:** `src/app/equipes/page.tsx`
- **API CRUD:** `src/app/api/admin/equipes/route.ts`

**Funcionalidades:**
- Criar equipe (CNT, MNT, LV, APG)
- Editar nome/tipo
- Excluir equipe
- Listar usuários por equipe

**Editar:**
- Adicionar tipo de equipe → `page.tsx` (array TIPOS_EQUIPE)
- Mudar validações → `route.ts`
- Alterar UI → `page.tsx` (seção de cards)

---

### 7️⃣ **Gerenciamento de Usuários** (`src/app/users/`)

**Onde encontrar:**
- **Página:** `src/app/users/page.tsx`
- **API CRUD:** `src/app/api/admin/users/route.ts`

**Funcionalidades:**
- **Super Admin Only:** Criar/Editar/Excluir
- Roles: `admin` | `viewer`
- Lista hardcoded de Super Admins

**Editar:**
- Adicionar Super Admin → `page.tsx` (const SUPER_ADMINS)
- Mudar roles → `route.ts` + interface AdminUser
- Alterar permissões → `page.tsx` (seção isSuperAdmin)

---

### 8️⃣ **Galeria de Fotos** (`src/components/PhotoGallery.tsx`)

**Onde encontrar:**
- **Componente:** `src/components/PhotoGallery.tsx`

**Usado em:**
- `/acompanhamento` (drawer)
- `/reports` (drawer)
- Qualquer modal de obra

**Funcionalidades:**
- Grid responsivo de fotos
- Modal em tela cheia
- Botão de download
- Marca d'água visível

**Editar:**
- Mudar layout do grid → `PhotoGallery.tsx` (grid classes)
- Adicionar zoom → Implementar biblioteca (react-zoom-pan-pinch)
- Alterar modal → `PhotoGallery.tsx` (seção Modal)

---

## 🔌 API Routes (Backend Next.js)

### Estrutura de APIs

```
src/app/api/
├── auth/
│   ├── login/route.ts           # POST: Autenticar usuário
│   └── logout/route.ts          # POST: Fazer logout
├── obras/
│   ├── route.ts                 # GET: Listar, POST: Criar
│   └── [id]/route.ts            # GET, PUT, DELETE: Obra específica
├── admin/
│   ├── users/
│   │   ├── route.ts             # GET: Listar, POST: Criar
│   │   └── [id]/route.ts        # PUT: Editar, DELETE: Excluir
│   └── equipes/
│       ├── route.ts             # GET: Listar, POST: Criar
│       └── [id]/route.ts        # PUT: Editar, DELETE: Excluir
└── dashboard/
    └── stats/route.ts           # GET: Estatísticas
```

### Padrão de Rota

```typescript
// src/app/api/exemplo/route.ts
import { NextRequest, NextResponse } from 'next/server'

export async function GET(request: NextRequest) {
  try {
    // Lógica aqui
    return NextResponse.json({ success: true, data: [] })
  } catch (error: any) {
    return NextResponse.json(
      { success: false, error: error.message },
      { status: 500 }
    )
  }
}

export async function POST(request: NextRequest) {
  const body = await request.json()
  // Lógica aqui
}
```

---

## 🎨 Estilos e UI

### Tailwind CSS

**Configuração:** `tailwind.config.ts`

**Classes mais usadas:**
- Layout: `flex`, `grid`, `gap-4`, `p-4`, `m-4`
- Cores: `bg-blue-600`, `text-white`, `border-gray-200`
- Responsivo: `sm:`, `md:`, `lg:`, `xl:`
- Sombras: `shadow-md`, `shadow-lg`
- Hover: `hover:bg-blue-700`, `hover:shadow-xl`

**Customizar cores:**
```typescript
// tailwind.config.ts
module.exports = {
  theme: {
    extend: {
      colors: {
        primary: '#1e40af', // Sua cor principal
        secondary: '#7c3aed',
      }
    }
  }
}
```

---

## 🗄️ Banco de Dados (Supabase)

### Conexões

**Frontend:** `src/lib/supabase.ts`
```typescript
import { createClient } from '@supabase/supabase-js'

export const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
)
```

**Backend (Admin):** `src/lib/supabase-admin.ts`
```typescript
import { createClient } from '@supabase/supabase-js'

export const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY! // Chave de serviço
)
```

### Tabelas Principais

- `obras` - Dados das obras
- `admin_users` - Usuários do sistema web
- `equipes` - Equipes cadastradas
- `users` - Usuários mobile (encarregados)

---

## 📦 Bibliotecas Importantes

```json
{
  "dependencies": {
    "next": "^15.0.0",              // Framework React
    "react": "^19.0.0",             // Biblioteca UI
    "typescript": "^5.0.0",         // Tipagem
    "@supabase/supabase-js": "^2.0.0", // Cliente Supabase
    "tailwindcss": "^3.0.0",        // CSS utility-first
    "date-fns": "^3.0.0",           // Manipulação de datas
    "jspdf": "^2.0.0",              // Geração de PDF
    "xlsx": "^0.18.0",              // Geração de Excel
    "chart.js": "^4.0.0"            // Gráficos (se usar)
  }
}
```

---

## 🔍 Como Encontrar e Editar

### 🎯 Preciso alterar a listagem de obras

1. **UI/Layout:** `src/app/(tabs)/obras/page.tsx`
2. **Dados/API:** `src/app/api/obras/route.ts`
3. **Query DB:** `src/lib/supabase-admin.ts` (função `getObras()`)

### 🎯 Preciso mudar o PDF exportado

1. **Geração:** `src/lib/pdf-generator.ts`
2. **Chamada:** `src/app/reports/page.tsx` (função handleExportPDF)
3. **Template:** `pdf-generator.ts` (seção do jsPDF)

### 🎯 Preciso adicionar um filtro novo

1. **Estado:** Adicionar `useState` na página
2. **Input:** Adicionar campo no JSX
3. **Lógica:** Adicionar condição no `useMemo` ou `filter()`
4. **API:** Se necessário, adicionar query param na rota

### 🎯 Preciso criar uma nova página

1. Criar pasta em `src/app/nova-pagina/`
2. Criar `page.tsx` dentro da pasta
3. Adicionar link no `Sidebar.tsx`
4. Se precisar API, criar `src/app/api/nova-pagina/route.ts`

### 🎯 Preciso adicionar um campo na obra

1. **Banco:** Adicionar coluna na tabela `obras` (Supabase)
2. **Interface:** Atualizar interface em `src/app/api/obras/route.ts`
3. **Formulário:** Adicionar input na página de criação/edição
4. **API:** Incluir campo no POST/PUT da API
5. **Listagem:** Adicionar coluna na tabela de listagem

---

## 🚀 Comandos Úteis

```bash
# Desenvolvimento (porta 3000)
cd web
npm run dev

# Build de produção
npm run build

# Rodar produção
npm start

# Instalar nova biblioteca
npm install nome-da-biblioteca

# Limpar cache do Next.js
rm -rf .next
npm run dev
```

---

## 🔐 Variáveis de Ambiente

**Arquivo:** `.env.local` (criar na raiz do `/web`)

```env
# Supabase
NEXT_PUBLIC_SUPABASE_URL=https://seu-projeto.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=eyJhbGc...
SUPABASE_SERVICE_ROLE_KEY=eyJhbGc... # Apenas backend

# Next.js
NEXT_PUBLIC_APP_URL=http://localhost:3000
```

⚠️ **NUNCA commitar o `.env.local`** - está no `.gitignore`

---

## 📚 Recursos de Aprendizado

- **Next.js Docs:** https://nextjs.org/docs
- **Tailwind CSS:** https://tailwindcss.com/docs
- **Supabase Docs:** https://supabase.com/docs
- **TypeScript:** https://www.typescriptlang.org/docs

---

## 💡 Dicas de Desenvolvimento

### 1. **Hot Reload**
O Next.js recarrega automaticamente. Salve o arquivo e veja as mudanças.

### 2. **Console de Erros**
- **Browser:** F12 → Console (erros de frontend)
- **Terminal:** Onde rodou `npm run dev` (erros de backend/build)

### 3. **Debugging**
```typescript
console.log('Valor:', variavel)
console.error('Erro:', error)
console.table(array) // Mostra array formatado
```

### 4. **TypeScript**
Se der erro de tipo, passe o mouse sobre o erro no VS Code para ver a sugestão.

### 5. **Git**
```bash
git status                    # Ver arquivos modificados
git add .                     # Adicionar tudo
git commit -m "mensagem"      # Commitar
git push                      # Enviar
```

---

**Criado em:** Janeiro 2025
**Autor:** Claude Code
**Projeto:** Obras Wise - Sistema Web
