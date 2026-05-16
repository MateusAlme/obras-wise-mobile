# Obras Wise - Painel Web

Painel administrativo para gerenciamento de obras e geração de relatórios em PDF.

## 🚀 Tecnologias

- **Next.js 15** - Framework React
- **TypeScript** - Tipagem estática
- **Tailwind CSS** - Estilização
- **Supabase** - Backend (PostgreSQL + Storage)
- **jsPDF** - Geração de PDFs

## 📋 Funcionalidades

- ✅ Listagem de todas as obras
- ✅ Filtro por número, responsável ou equipe
- ✅ Visualização de fotos
- ✅ Geração de PDF com todas as informações
- ✅ Estatísticas (total de obras, atipicidades, fotos)
- ✅ Interface responsiva

## 🔧 Instalação

```bash
# Instalar dependências
npm install

# Rodar em desenvolvimento
npm run dev

# Build para produção
npm run build
npm start
```

## 🌐 Acessar

Abra [http://localhost:3000](http://localhost:3000) no navegador.

## 📝 Configuração

Crie um arquivo `.env.local` com:

```env
NEXT_PUBLIC_SUPABASE_URL=sua_url_supabase
NEXT_PUBLIC_SUPABASE_ANON_KEY=sua_chave_supabase
```

## 🚢 Deploy

Este projeto pode ser facilmente deployado no Vercel:

```bash
npm install -g vercel
vercel
```

## 📦 Estrutura

```
web/
├── src/
│   ├── app/
│   │   ├── page.tsx         # Página principal
│   │   ├── layout.tsx       # Layout global
│   │   └── globals.css      # Estilos globais
│   └── lib/
│       ├── supabase.ts      # Cliente Supabase
│       └── pdf-generator.ts # Gerador de PDF
├── public/                  # Arquivos estáticos
└── package.json
```

## 🔄 Substituindo o Django

Este painel substitui completamente o Django Admin:

1. **Antes**: Django Admin (Python)
2. **Agora**: Next.js + React (TypeScript)

### Vantagens:

- Mesma stack do mobile (JavaScript/TypeScript)
- Interface moderna e customizável
- Deploy grátis (Vercel)
- Integração direta com Supabase
- Melhor performance

## 📱 Integração com Mobile

O painel web e o app mobile compartilham o mesmo backend (Supabase):

- Mesmo banco de dados PostgreSQL
- Mesmo Supabase Storage para fotos
- Sincronização automática
# Deploy fix qui, 29 de jan de 2026 15:18:04
