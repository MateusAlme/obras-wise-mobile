# Arquitetura do Sistema ObrasWise

## Visão Geral

O ObrasWise possui somente dois clientes (app mobile e painel web). Ambos consomem diretamente os serviços do Supabase (PostgreSQL + Auth + Storage), eliminando servidores intermediários.

`
+--------------------+     +---------------------+
¦ App Mobile (Expo)  ¦     ¦ Painel Web (Next.js)¦
¦ - Cadastro         ¦     ¦ - Dashboard & filtros¦
¦ - Offline Sync     ¦     ¦ - Gestão de usuários ¦
+--------------------+     +---------------------+
          ¦                           ¦
          +---------------------------+
                         ?
                Supabase (DB + Auth + Storage)
`

## Componentes

### Mobile (Expo / React Native)
- Fluxo 
ova-obra.tsx grava dados localmente e sincroniza via Supabase.
- Fotos são salvas no storage obra-photos com backup local (lib/photo-backup.ts).
- Offline: AsyncStorage + fila (lib/photo-queue.ts, lib/offline-sync.ts).

### Painel Web (Next.js 16)
- Rotas em web/src/app com App Router.
- Supabase client em web/src/lib/supabaseClient.ts (anon key) para leitura.
- Ações administrativas (criar usuários, exportar relatórios) utilizam rotas API privadas com SUPABASE_SERVICE_KEY.
- Tailwind + shadcn/ui para layout das tabelas, filtros e visualização de fotos.

### Supabase
- PostgreSQL: tabelas obras, equipes, usuarios_app.
- Storage: bucket obra-photos para imagens.
- Auth: controla logins do app e do painel (mesmo tenant).
- Policies (RLS): garantem que cada usuário veja apenas suas obras.

## Fluxos importantes

1. **Cadastro de obra**
   - Mobile coleta dados + fotos ? salva backup offline ? envia para Supabase quando online.
   - Painel web lê diretamente da tabela obras e monta dashboards/relatórios.

2. **Sincronização offline**
   - offline-sync.ts gerencia fila de obras pendentes.
   - photo-queue.ts envia fotos em série; após sucesso grava URL pública no registro.

3. **Gestão de usuários**
   - Painel web usa Supabase Admin API (via rota API Next) para criar/remover credenciais.
   - Dados complementares (equipe, matrícula) continuam na tabela usuarios_app.

## Estrutura simplificada do repositório

`
mobile/              App React Native
web/                 Painel Next.js
supabase/            Migrações e config (config.toml, migrations/*.sql)
docs/                Guias e diagramas
scripts/             Ferramentas (limpeza, migrations)
`

## Segurança
- Uso de service_role restrito a rotas API server-side do Next.js.
- Buckets configurados para acesso autenticado; painel gera URLs assinadas.
- Tokens Expo / mobile seguem sessão Supabase, com refresh automático.

## Próximos passos sugeridos
- Ativar Supabase Realtime para atualizar dashboards em tempo real.
- Implementar logs de auditoria diretamente no PostgreSQL para rastrear ações administrativas.
