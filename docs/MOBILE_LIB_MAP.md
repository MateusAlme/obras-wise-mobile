# Mapa Detalhado: pasta `mobile/lib/`

Este documento descreve arquivo-a-arquivo os módulos em `mobile/lib/`, com pontos-chave, funções/exportações importantes, constantes (AsyncStorage keys, timeouts, limites), locais onde são usados e dicas rápidas de debug.

Use este guia para localizar a lógica de negócio, sincronização e pipeline de fotos.

---

## Sumário rápido
- `supabase.ts` — cliente e configuração do Supabase
- `servico-sync.ts` — CRUD local + sincronização (principal)
- `servico-rules.ts` — regras/validações por tipo de serviço
- `photo-backup.ts` — salvar/ler metadados de fotos locais
- `photo-queue.ts` — fila de upload, retries, timeouts
- `offline-sync.ts` — helpers de sync offline/batch
- `sentry.ts` — inicialização e wrapper de captura de erros
- `photo-with-placa.ts` / `photo-with-placa-web.ts` / `photo-watermark.ts` — manipulação e carimbo de fotos
- `placa-parser.ts` — parsing / validação de placas
- `geocoding.ts` — serviços de localização / reverse geocode
- utilitários: `crypto-utils.ts`, `safe-operations.ts`, `save-to-gallery.ts`, `memory-monitor.ts`, `emergency-backup.ts`, `fix-*` scripts

---

## Arquivo por arquivo

### `supabase.ts`
- Propósito: criar e exportar o cliente Supabase usado pelo app.
- Exportações principais: `supabaseClient`, `createSupabaseClient()` (se presente).
- Configurações importantes: `SUPABASE_URL`, `SUPABASE_ANON_KEY`, cabeçalhos extras (ex: `x-team-id`, `x-role`).
- Onde é usado: chamadas de rede em `servico-sync.ts`, telas que fazem fetch e upload.
- Debug: verificar valores das env vars, tokens em `AuthContext`, e chamadas no DevTools (network).

### `servico-sync.ts`
- Propósito: gerencia `ServicoLocal` (offline) e sincronização com o servidor (`Servico`).
- Keys AsyncStorage: `@servicos_local`, `@servicos_pending_sync`, possivelmente `@servicos_retry_counts`.
- Funções/chaves (nomes aproximados):
  - `fetchServicosForObra(obraId)` — retorna serviços locais/online para uma obra.
  - `saveServicoLocal(servicoLocal)` — persiste localmente (cria `client_pk` se necessário).
  - `appendPhotoToServicoLocal(servicoId, photoId, categoria)` — adiciona photoId ao `ServicoLocal`.
  - `syncAllPendingServicos()` — varre `@servicos_pending_sync` e chama `syncServico`.
  - `syncServico(servicoLocal)` — processa uploads de fotos (delegando a `photo-queue`), cria/atualiza registo no Supabase e reconcilia `client_pk` -> `server_id`.
  - `generateClientPk()` — cria ID temporário do cliente para evitar collisions.
- Concorrência/locks: variáveis como `currentlySyncingIds`, `syncAllPendingServicosInProgress` para evitar duplicação de requests.
- Tratamento de fotos: converte `string[]` (photoIds) em `FotoInfo[]` ao compor payload após uploads.
- Pontos de falha comuns: retries mal contados, perda de associação client->server, fotos não marcadas como `synced`.
- Debug: checar `@servicos_pending_sync` e entradas com `client_pk`, usar Sentry logs emitidos por este módulo.

### `servico-rules.ts`
- Propósito: regras de negócio para cada `TipoServico` (quais categorias de foto mostrar/obrigatórias, campos extras, transformador especial-case).
- Exportações: `getVisiblePhotoCategories(tipoServico)`, `getRequiredRules(tipoServico)` ou objetos `SERVICE_RULES`.
- Uso: UI (`servico-detalhe.tsx`) para montar formulários dinâmicos e validação antes de finalizar.
- Atenção: ao adicionar novo `TipoServico` (ex: `Teste`), atualizar este arquivo para incluir categorias e obrigatoriedade.

### `photo-backup.ts`
- Propósito: gerar `photoId`, salvar arquivo localmente (expo-file-system), e persistir metadados de foto (path, status, retries) no AsyncStorage.
- Keys AsyncStorage: `@photo_<photoId>` para metadado individual, possivelmente `@photo_index` ou `@photo_queue`.
- Funções típicas:
  - `createLocalPhoto(fileUri, meta)` — retorna `photoId` e salva metadados.
  - `getPhotoMeta(photoId)` — retorna metadados.
  - `markPhotoSynced(photoId, remoteUrl)` — marca metadado como `synced` e anexa `url`.
  - `markPhotoLost(photoId)` / `incrementRetry(photoId)`.
- Dicas debug: verificar se o arquivo físico existe (`FileSystem.getInfoAsync(path)`), e se metadado contém `localUri`.

### `photo-queue.ts`
- Propósito: gerenciar uploads em background/foreground com limites de retry e delays exponenciais.
- Constantes importantes: `MAX_RETRIES`, `RETRY_DELAYS`, `UPLOAD_TIMEOUT_MS`, `CONCURRENT_UPLOADS`.
- Fluxo:
  - Enfileirar fotos pendentes em `UPLOAD_QUEUE_KEY`.
  - `processQueue()` pega itens e usa `supabase.storage.from(bucket).upload()` ou `fetch` para enviar.
  - Em caso de sucesso, chama `photo-backup.markPhotoSynced()`; em erro, incrementa retry e re-enfileira ou marca `failed`.
- Pontos de atenção: tempo limite de upload, tratamento de erros 4xx vs 5xx, retries infinitos.
- Debug: revisar contadores de retry nos metadados e logs de Sentry para uploads falhos.

### `offline-sync.ts`
- Propósito: helpers genéricos para operações em lote quando offline (merge de arrays, resolução de conflito, marcação de flags de dirty).
- Funções úteis: `getLocalObras()`, `saveLocalObra(obra)`, `batchUpsertServicos()`.
- Uso: chamado por `servico-sync` e pelos providers que executam sync ao reconectar.

### `sentry.ts`
- Propósito: inicialização do Sentry e wrappers utilitários como `captureException`, `withScope`.
- Pontos: configurar `SENTRY_DSN`, environment, release. Verificar `beforeSend` para remover dados sensíveis.
- Uso: importado em `servico-sync`, `photo-queue`, `supabase` try/catch.

### `photo-with-placa.ts` / `photo-with-placa-web.ts`
- Propósito: gerar versões da foto com overlay/carimbo de placa de obra; pode incluir marca d'água e metadados (hora, coordenadas).
- Diferença web vs mobile: implementações específicas do ambiente (Canvas vs expo-image-manipulator).
- Funções: `applyPlacaOverlay(localUri, placa, options)` retorna `newUri`.
- Debug: verificar se transformações preservam EXIF (se necessário) e se novo arquivo é salvo corretamente.

### `photo-watermark.ts`
- Propósito: adicionar watermark textual (e.g., técnico, data/hora) às imagens.
- Uso: chamada antes de upload para certificar identidade da foto.

### `placa-parser.ts`
- Propósito: extrair/normalizar a placa de obra a partir de OCR ou formulário (remover espaços, letras maiúsculas, validar formato).
- Funções: `parsePlaca(rawString)`, `isValidPlaca(placa)`.

### `geocoding.ts`
- Propósito: reverse geocoding e utilitários de coordenadas.
- Uso: preencher campos de endereço automático ao criar serviço/obra.
- Observações: pode usar Google/Here/Mapbox — checar quotas/keys.

### `crypto-utils.ts`
- Propósito: funções utilitárias para gerar hashes, client PKs, ou ID curtos para arquivos.
- Uso: gerar `client_pk` ou token para assinaturas de requests.

### `safe-operations.ts`
- Propósito: wrappers seguros para operações que podem falhar (try/catch + fallback), helpers para leitura de AsyncStorage com parse seguro.

### `save-to-gallery.ts`
- Propósito: salvar foto para galeria do dispositivo (Android/iOS) — usado quando usuário quer manter cópia local.

### `memory-monitor.ts`
- Propósito: monitorar uso de memória e disparar `emergency-backup` ou limpeza de cache quando necessário.

### `emergency-backup.ts`
- Propósito: rotina para salvar estado crítico (metadados de serviços/fotos) em local seguro se o app estiver com memória baixa ou crash iminente.

### `fix-*.ts` (ex.: `fix-duplicates.ts`, `fix-origem-status.ts`)
- Propósito: scripts utilitários de correção de dados que podem ser executados dentro do app ou por um técnico para reparar dados locais ou server-side.
- Uso: executar via menu de admin ou por script de debug.

---

## Padrões e convenções encontradas
- `ServicoLocal` armazena referências a fotos como `string[]` (photoIds). Metadados de fotos ficam em `@photo_<id>`.
- `Servico` (server) contém `FotoInfo[]` com `url`, `width`, `height`, `placa`, etc.
- Fluxo padrão ao criar um serviço offline:
  1. `photo-backup.createLocalPhoto()` → retorna `photoId` e salva local
  2. `servico-sync.saveServicoLocal()` → adiciona `client_pk` e salva `ServicoLocal`
  3. `appendPhotoToServicoLocal()` → vincula photoIds ao serviço
  4. `photo-queue` processa uploads quando online
  5. `servico-sync.syncServico()` monta payload substituindo photoIds por FotoInfo[] (após uploads) e chama Supabase
  6. Reconciliação: remove `client_pk` e atualiza com `server_id`

---

## Dicas rápidas de debug por problema
- Fotos não enviadas: verificar arquivos físicos (FileSystem), metadados `@photo_<id>`, e `photo-queue` retries.
- Serviço não aparece no server: checar `@servicos_pending_sync` e ver se `syncServico` teve erro (Sentry) ou timeout.
- Duplicação de serviço: procurar `client_pk` duplicados e revisar locks em `servico-sync`.
- Erro de autenticação: validar tokens em `supabase.ts` e `AuthContext`.

---

## Próximo passo sugerido
- Gerar anotações linha-a-linha para os 4 módulos críticos: `servico-sync.ts`, `photo-backup.ts`, `photo-queue.ts` e `supabase.ts` (posso fazer isso em seguida).

Se quer que eu explique linha-a-linha, diga qual arquivo quer primeiro (recomendo `servico-sync.ts`).
