# Mapa de Arquivos — projeto obras-wise-mobile

Este documento resume os arquivos e pastas principais do repositório e o propósito de cada um, para facilitar suporte e manutenção.

> Observação: Enumera os itens mais relevantes — a pasta `docs/` contém guias detalhados para muitos fluxos.

---

## Raiz do repositório
- `README.md` — Visão geral do projeto e instruções principais.
- `docs/` — Documentação operacional, troubleshooting, guias de implementação e fluxos (muitos arquivos úteis para suporte).
- `mobile/` — Aplicativo mobile (React Native / Expo). Principal foco de suporte de campo.
- `web/` — Dashboard / painel web (Next.js). Endpoints e ferramentas administrativas.
- `photo-server/` — pequeno servidor Node para suporte a uploads/transformações locais.
- `scripts/` — Scripts utilitários e migrações para DB, manutenção e reparos (usados por devs e ops).
- `supabase/` — SQL, migrations e scripts para aplicar no Supabase (DB/schema/rls).

---

## `mobile/` (App React Native)
Estrutura geral: código do app, tipos, libs e telas.

- `mobile/package.json` — dependências e scripts do app.
- `mobile/app/` — telas e rotas do app (Expo Router):
  - `_layout.tsx` — layout raiz, inicialização (Sentry, AuthProvider, sincronização automática).
  - `index.tsx` — tela inicial/landing.
  - `servico-detalhe.tsx` — UI para ver/editar um serviço (photos, dados, completar, sync).
  - `obra-detalhe.tsx`, `obra-books.tsx`, `obras-pendentes.tsx` — telas principais de obra/listagens.
  - `nova-obra.tsx`, `nova-obra-rapida.tsx` — criação de obras.
  - `fotos-pendentes.tsx` — gerenciamento de fotos pendentes/uploads.

- `mobile/lib/` — lógica de negócio e serviços (módulos singleton):
  - `supabase.ts` — cliente supabase configurado (autenticação, headers customizados).
  - `servico-sync.ts` — CRUD e sincronização offline/online de serviços; lógica de upsert, resolve de fotos locais.
  - `servico-rules.ts` — regras/validações de serviço (quais fotos são obrigatórias, categorias visíveis).
  - `photo-backup.ts` — gerenciamento de metadados de fotos, backup local, marcação de sincronizado.
  - `photo-queue.ts` — fila de upload/gestão de retries e timeouts de upload.
  - `offline-sync.ts` — helpers gerais para sincronização offline (obras, estados, locks).
  - `sentry.ts` — inicialização e captura de erros.
  - `photo-with-placa.ts`, `photo-with-placa-web.ts`, `photo-watermark.ts` — manipulação de placas/watermark.
  - `geocoding.ts`, `placa-parser.ts`, utilitários varios.

- `mobile/types/servico.ts` — tipos TypeScript para `Servico` e `ServicoLocal`, `SERVICO_PHOTO_MAP` (mapa de categorias de foto por tipo de serviço).
- `mobile/contexts/` — providers (AuthContext, etc) — onde a autenticação e escuta de conexão são implementadas.
- `mobile/components/` — componentes reutilizáveis da UI.
- `mobile/assets/` — imagens, ícones e recursos estáticos.

Observações operacionais:
- AsyncStorage keys: `@servicos_pending_sync`, `@servicos_local`, `@photo_*` — ver `photo-backup.ts` e `servico-sync.ts`.
- Padrão: `ServicoLocal` armazena apenas `string[]` (photoIds) para reduzir tamanho; `Servico` (sincronizado) tem `FotoInfo[]` com URLs.

---

## `web/` (Next.js)
- `web/src/lib/` — helpers server-side e utilitários para o painel:
  - `supabase-admin.ts` — client com Service Role Key para operações administrativas.
  - `supabase.ts` — client front-end (public).
  - `pdf-generator.ts` — geração de relatórios/PDFs.
  - `obra-delete.ts` — lógicas de deleção/limpeza de obras.
  - `geocoding.ts` — utilitários de geocoding.
- `web/src/app/api/` — rotas API (handlers) que expõem endpoints usados internamente pelo web app ou ops.
- `web/package.json` — scripts para rodar o painel e deploy.

---

## `photo-server/`
- `server.js` — servidor Node simples (ver `photo-server/package.json`) utilizado para testes/transformações de imagem locais.

---

## `scripts/` (ferramentas de manutenção)
Principais utilidades para debugging, correção e migrações:
- `fix-*`, `reconstruir-*`, `verificar-*` — scripts TypeScript/JS que corrigem dados, reconstroem entradas, identificam fotos, verificam consistência.
- `.sql` arquivos — queries e migrações que podem ser executadas no banco.
- Use estes scripts com cuidado (normalmente run em ambiente dev ou ops).

---

## `supabase/`
- SQLs para aplicar no Supabase (migrations, RLS, funções administrativas).
- `APLICAR_*` — instruções para aplicar mudanças no banco.

---

## `docs/` (onde procurar respostas rapidamente)
A pasta `docs/` contém guias práticos para suporte e resolução de problemas:
- `COMO_DEBUGAR_FOTOS_SYNC.md`, `CORRECAO_UPLOAD_FOTOS.md`, `SISTEMA_100_OFFLINE.md`, `PLACA_BURNED_IN_MOBILE.md`, entre muitos outros.
- `GUIA_CRIACAO_NOVO_SERVICO.md` e `CODIGO_PRONTO_SERVICO_TESTE.md` — guias que criei para adicionar serviços novos.
- `README_GUIAS_SERVICOS.md` — índice com roteiros de leitura.

Recomendação: antes de alterar lógica de sincronização, consulte `COMO_DEBUGAR_FOTOS_SYNC.md` e `SENTRY_SETUP.md`.

---

## Pontos críticos para suporte (onde checar primeiro em casos comuns)
1. Problemas de fotos não aparecendo: checar `photo-backup.ts`, storage local `@photo_*`, `photo-queue.ts` e `servico-sync.ts` para uploads.
2. Serviços duplicados/IDs temp: checar `servico-sync.ts` (locks e upsert), `offline-sync.ts` e logs do Sentry.
3. Erros de autorização no painel: checar `web/src/lib/supabase-admin.ts` e variáveis de ambiente em `web/.env.local`.
4. Falhas de build mobile: ver `mobile/package.json`, `tsconfig.json`, e logs em `mobile/build_log.txt`.

---

## Como usar este mapa (passos rápidos para suporte)
1. Identifique o problema do usuário (fotos, sync, auth, UI).
2. Consulte o(s) guia(s) relevante(s) em `docs/`.
3. Reproduza localmente: use `mobile` em Expo (`npm run start` dentro de `mobile/`) e verifique logs e Sentry.
4. Para correções rápidas, prefira usar os scripts em `scripts/` que já existem para reconstituir dados.

---

## Links rápidos (na árvore do workspace)
- Mobile app: `mobile/`
- Mobile libs: `mobile/lib/` (supabase, servico-sync, servico-rules, photo-backup, photo-queue)
- Mobile screens: `mobile/app/` (servico-detalhe.tsx, obra-detalhe.tsx, nova-obra.tsx)
- Web helpers: `web/src/lib/` (supabase-admin.ts, pdf-generator.ts)
- Scripts ops: `scripts/`
- DB migrations: `supabase/`
- Documentação: `docs/`

---

Se quiser, eu posso:
- Gerar um arquivo mais detalhado por pasta (lista linha a linha com descrições).
- Criar um fluxo de diagnóstico rápido com comandos e pontos de verificação para suporte (cheklist passo-a-passo).

Diga qual formato prefere: resumo (este), lista detalhada por arquivo, ou checklist de diagnóstico.
