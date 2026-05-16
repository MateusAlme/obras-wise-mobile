# Mapa Detalhado: pasta `mobile/`

Este documento descreve, arquivo a arquivo, a pasta `mobile/` do projeto — objetivo: dar contexto para suporte e manutenção.

Uso: pesquisar o arquivo no workspace e abrir para ver implementação. Os caminhos são relativos à raiz do repositório.

---

## Visão geral da pasta `mobile/`
- `mobile/` é o aplicativo React Native (Expo) usado por técnicos em campo.
- Estrutura principal:
  - `app/` — telas (Expo Router)
  - `lib/` — lógica de negócio, serviços, sincronização e manipulação de fotos
  - `types/` — tipos TypeScript (Serviço, FotoInfo, etc.)
  - `contexts/` — providers (Auth, sincronização automática)
  - `components/` — componentes reutilizáveis da UI
  - `utils/` — utilitários e helpers específicos
  - `assets/` — recursos estáticos (ícones, imagens)
  - `package.json`, `tsconfig.json`, `index.ts`/`index.js` — config e entrypoints

---

## Arquivos raiz importantes
- `package.json` — scripts (`start`, `build`, `eas`, etc.) e dependências. Use para rodar o app localmente.
- `index.ts` / `index.js` — ponto de entrada que inicializa o app Expo.
- `app.json` — configuração do app (nome, slug, ícones) usado pelo Expo.
- `.env.local` — variáveis de ambiente (API keys) — NÃO comitar em production.
- `build_log.txt`, `build_log_page.html` — logs de build (úteis para troubleshooting de builds).

---

## `mobile/app/` — telas e rotas
Cada arquivo é uma rota/tela do app. Principais arquivos:

- `_layout.tsx`
  - Layout raiz do aplicativo.
  - Inicializa Sentry, providers (AuthProvider), e possivelmente a sincronização automática ao reconectar.
  - Ponto para adicionar listeners de NetInfo.

- `index.tsx`
  - Tela inicial/home do app.

- `login.tsx`
  - Tela de autenticação (login por equipe/usuario). Usa `supabase` para autenticar.

- `obra-books.tsx`, `obra-detalhe.tsx`, `obras-pendentes.tsx`, `obras-com-servicos-exemplo.tsx`
  - Telas que listam obras, mostram detalhes e navegação entre obras e serviços.

- `nova-obra.tsx`, `nova-obra-rapida.tsx`
  - Telas para criar uma nova obra (formulários, fotos iniciais).

- `servico-detalhe.tsx`
  - Tela central para visualizar/editar um serviço (fotos, dados, marcar completo, sincronizar).
  - Importante: usa `servico-sync.ts`, `photo-backup.ts`, `servico-rules.ts` e `photo-queue.ts`.

- `fotos-pendentes.tsx`
  - Gerencia fotos que ficaram pendentes (uploads falharam ou aguardam sync).

- `cava-rocha.tsx`, `diagnostico.tsx` (e outras)
  - Telas específicas por tipo de serviço. Consulte `SERVICO_PHOTO_MAP` em `types/servico.ts`.

Observação: a pasta `app/(comp)/` e `(tabs)/` contém composições de rotas/abas (estruturas reuseáveis).

---

## `mobile/lib/` — lógica e serviços (mapa detalhado)
Arquivos chave e propósito resumido. Abra cada arquivo para entender implementações específicas.

- `supabase.ts`
  - Cria o cliente Supabase com configuração do app.
  - Configura headers adicionais (equipe, role, session-token) e interceptores quando necessário.
  - Use ao debugar autenticação e chamadas ao backend.

- `servico-sync.ts`
  - Lógica de criação, leitura, atualização e sincronização de `Servico` / `ServicoLocal`.
  - Keys importantes do AsyncStorage: `@servicos_pending_sync`, `@servicos_local`, `@servicos_retry_counts`.
  - Funções principais: `fetchServicosForObra`, `saveServicoLocal`, `appendPhotoToServicoLocal`, `syncAllPendingServicos`, `syncServico`.
  - Trata IDs temporários (client_pk / temp_) e reconciliação com UUIDs do servidor.
  - Travações (locks) para evitar duplicação em sync concorrente.

- `servico-rules.ts`
  - Regras de negócio e validações para serviços.
  - Define quais categorias de fotos são visíveis por tipo (`getVisiblePhotoCategories`) e regras obrigatórias (`getRequiredRules`).
  - Usado na UI para exibir campos e validar antes de finalizar.

- `photo-backup.ts`
  - Gerencia metadados de fotos e backup local.
  - Cria `photoId`, salva arquivo em storage local (expo-file-system), e grava metadados em AsyncStorage (`@photo_<id>`).
  - Funções para marcar fotos como `synced`, `lost`, incrementar retries, e recuperar metadados.

- `photo-queue.ts`
  - Fila de upload de fotos; gerencia retries, delays e timeouts por foto.
  - Variáveis: `UPLOAD_QUEUE_KEY`, `MAX_RETRIES`, `RETRY_DELAYS`, `UPLOAD_TIMEOUT_MS`.
  - Retenta uploads, marca fotos como `failed`/`success` e comunica com `photo-backup`.

- `offline-sync.ts`
  - Helpers para sincronização offline (locks, pedidos em batch, manipulação de obras pendentes).
  - Pode conter rotinas para `getLocalObras`, `saveLocalObra` e utilitários de merge.

- `photo-with-placa.ts`, `photo-with-placa-web.ts`, `photo-watermark.ts`, `placa-parser.ts`
  - Funções e transformações relacionadas a placas nas fotos (overlay, OCR, parsing de placa de obra).
  - Usado quando é necessário carimbar a foto com identificação da obra.

- `geocoding.ts`
  - Funções de geocoding (conversão de coord -> endereço, UTM, etc.).

- `sentry.ts`
  - Inicialização do Sentry e wrappers (`captureError`) usados por outros módulos.

- `crypto-utils.ts`, `safe-operations.ts`, `save-to-gallery.ts`, `memory-monitor.ts`, `emergency-backup.ts`
  - Utilitários diversos: manipulação segura de dados, backups, monitoramento de memória, salvar fotos na galeria.

- `fix-*` scripts (ex: `fix-duplicates.ts`, `fix-origem-status.ts`) dentro de `lib/`
  - Pequenas rotinas de correção de dados que podem ser executadas no app em casos especiais.

---

## `mobile/types/` — tipos TypeScript
- `servico.ts`
  - Tipos `Servico`, `ServicoLocal`, `FotoInfo`, `PosteData`, `SeccionamentoData`, `SERVICO_PHOTO_MAP`.
  - Regras: `ServicoLocal` armazena `string[]` (photoIds) enquanto `Servico` usa `FotoInfo[]` (URLs/metadados) após sync.
  - Atualize ambos (`Servico` e `ServicoLocal`) ao adicionar novos campos de foto.

- `utm.d.ts` — tipos para UTM se necessário.

---

## `mobile/contexts/`
- `AuthContext.tsx`
  - Provider de autenticação e estado do usuário/equipe.
  - Também escuta `NetInfo` e dispara `syncAllPendingServicos()` quando a conexão é restaurada.
  - Importante: configuração de tokens/refresh e integração com `supabase`.

---

## `mobile/components/` — UI reutilizável
- `ErrorBoundary.tsx` — captura erros na UI.
- `OnlinePhotoPlaceholder.tsx` — placeholder para fotos quando online/offline.
- `PhotoWithPlaca.tsx` — componente que mostra foto com placa/carimbo.
- `PlacaObraOverlay.tsx`, `PlacaScanner.tsx` — componentes para captura e leitura de placa.
- `ServicosComponents.tsx` — conjuntos de componentes usados nas telas de serviços.
- `SyncProgressModal.tsx` — modal que exibe progresso de sincronização; útil ao debugar UX de sync.
- `Toast.tsx` — componente de notificações locais.

---

## `mobile/utils/` — utilitários e helpers
- `debug-obras.ts` — scripts para debug de obras.
- `migrate-photo-fields.ts` — migrações de campos de foto (quando houve mudança de schema).
- `nova-obra/` — helpers específicos para a tela `nova-obra`:
  - `buttons-ui.tsx`, `functions.tsx`, `styles.ts` — modularizam UI e lógica de criação de obra.

---

## `mobile/assets/` — recursos estáticos
- Ícones, imagens de splash e outros assets usados pelo app. (Abra a pasta para ver os arquivos exatos.)

---

## Procedimentos e pontos de verificação para suporte
Abaixo, passos e locais de verificação para problemas comuns.

### Fotos não aparecem / não sincronizam
1. Verificar AsyncStorage local (use `AsyncStorage.getItem('@photo_<id>')` e `@servicos_pending_sync`).
2. Conferir `photo-backup.ts` (salvamento, paths locais) e `photo-queue.ts` (fila, retries, logs).
3. Verificar logs de upload e erros em Sentry (arquivo `sentry.ts`) — `docs/SENTRY_SETUP.md`.
4. Checar bucket do Supabase (Storage) e tabelas `servicos` / `servicos_fotos` no painel do Supabase.

### Serviços duplicados / IDs temporários
1. Verificar `servico-sync.ts` — locks (`currentlySyncingIds`, `syncAllPendingServicosInProgress`) e lógica de `upsert`.
2. Conferir se o cliente criou `client_pk`/`temp_` IDs e não houve retry duplicado.
3. Usar scripts em `scripts/` para detectar e corrigir duplicatas se necessário.

### Erros de build ou dependências
1. Ver logs em `mobile/build_log.txt`.
2. Ver `package.json` para versões e `node_modules` instaladas.
3. Rodar localmente:

```bash
cd mobile
npm install
npm run start
```

ou via EAS

```bash
cd mobile
eas build --platform android
```

### Sincronização automática ao reconectar
- Ver `AuthContext.tsx` e `_layout.tsx` para ver onde `NetInfo` é escutado e `syncAllPendingServicos()` é chamado.
- Conferir `servico-sync.ts` e `offline-sync.ts` para limites de retry e tempo.

---

## Documentação e guias úteis (já presentes em `docs/`)
- `COMO_DEBUGAR_FOTOS_SYNC.md` — debug de sync de fotos
- `CORRECAO_UPLOAD_FOTOS.md` — correções frequentes de upload
- `GUIA_CRIACAO_NOVO_SERVICO.md`, `CODIGO_PRONTO_SERVICO_TESTE.md` — guias para adicionar novos serviços
- `SENTRY_SETUP.md` — como revisar erros no Sentry

---

## Próximo passo (opções)
- Gerar um documento detalhado linha-a-linha para `mobile/lib/` (recomendo como próximo passo).
- Criar checklist de diagnóstico (com comandos e trechos para rodar localmente).

Diga qual pasta quer que eu detalhe primeiro (recomendo `mobile/lib/`).
