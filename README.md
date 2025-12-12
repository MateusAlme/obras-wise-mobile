# ObrasWise - Sistema de Gestão de Obras

> Plataforma completa para registro de obras em campo (app mobile) e acompanhamento administrativo (painel web em Next.js).

[![React Native](https://img.shields.io/badge/React%20Native-0.81-blue)](https://reactnative.dev/)
[![Next.js](https://img.shields.io/badge/Next.js-16-black)](https://nextjs.org/)
[![Supabase](https://img.shields.io/badge/Supabase-PostgreSQL-orange)](https://supabase.com/)

## Visão Geral

O ObrasWise integra o app mobile utilizado em campo com um painel web moderno. Ambos os clientes leem e escrevem diretamente no Supabase (PostgreSQL + Storage + Auth), eliminando a necessidade do antigo backend Django.

### Principais funcionalidades

- Cadastro completo de obras, inclusive atipicidades.
- Upload de fotos com coordenadas GPS e backup local.
- Sincronização offline/online automática.
- Dashboard web com filtros avançados e visualização de fotos.
- Gestão de equipes/usuários diretamente no Supabase.

## Arquitetura

`
+------------------+        +--------------------+
¦  App Mobile       ¦        ¦  Painel Web        ¦
¦  React Native     ¦        ¦  Next.js + Tailwind¦
+------------------+        +--------------------+
          ¦                             ¦
          +-----------------------------+
                         ?
                 Supabase (DB + Auth + Storage)
`

## Estrutura do projeto

`
obras-wise-mobile/
+-- mobile/          # App React Native + Expo
+-- web/             # Painel Next.js 16
+-- supabase/        # Configurações/migrações
+-- docs/            # Documentação geral
+-- scripts/         # Scripts utilitários (SQL, limpeza, etc.)
+-- .expo/, .vscode/ # Config local
+-- README.md        # Este arquivo
`

## Requisitos

| Componente  | Requisitos |
|-------------|------------|
| Mobile      | Node 18+, npm 10+, Expo CLI |
| Web         | Node 20+, npm 10+ |
| Supabase CLI| Para executar migrações SQL |

## Como rodar

### 1. Clonar o repositório
`powershell
git clone <repo>
cd obras-wise-mobile
`

### 2. App mobile (Expo)
`powershell
cd mobile
npm install
npm run start
`
Abra o Expo Go no dispositivo ou o emulador.

### 3. Painel web (Next.js)
`powershell
cd web
npm install
copy .env.local.example .env.local  # preencha com as chaves do Supabase
npm run dev
`
Acesse http://localhost:3000.

## Banco e autenticação

- **Supabase URL**: https://hiuagpzaelcocyxutgdt.supabase.co
- **Principal tabela**: obras
- **Fotos**: bucket obra-photos
- **Auth**: Supabase Auth (row level security habilitado)

## Troubleshooting rápido

- expo start travando: limpe cache (
px expo start --clear).
- Painel web sem CSS: rode 
pm install em web/ e garanta o plugin @tailwindcss/postcss.
- Fotos não aparecem: verifique no painel se os uploads foram sincronizados e se o usuário possui permissão no bucket.

## Documentação

- docs/ARCHITECTURE.md – arquitetura detalhada.
- docs/FUNCIONALIDADE_OFFLINE.md – fluxo de sincronização offline.
- docs/GUIA_DE_TESTE.md – checklist de testes (mobile + painel web).
- docs/supabase/SETUP.md – preparo do banco e buckets.
- web/README.md – guia específico do painel Next.js.

## Changelog

### [1.1.0] - 2025-02-XX
- Remoção completa do backend Django.
- Novo painel Next.js integrado diretamente ao Supabase.

### [1.0.0] - 2025-01-15
- Lançamento inicial do app mobile + painel administrativo.

## Suporte

- Abra uma issue.
- Ou fale com a equipe Teccel.

---
Construído com ?? para o time em campo.
