# Documentação ObrasWise

Índice navegável da documentação. Organizado por categoria semântica — todos os arquivos `.md` ficam em uma das subpastas abaixo.

> Estrutura do repositório: ver [ORGANIZACAO.md](ORGANIZACAO.md).

---

## Arquitetura

Visão geral do código, estrutura de pastas, modelos de dados e armazenamento de fotos.

- [ARCHITECTURE.md](arquitetura/ARCHITECTURE.md) — visão de alto nível
- [ESTRUTURA_PROJETO.md](arquitetura/ESTRUTURA_PROJETO.md)
- [ESTRUTURA_SISTEMA_WEB.md](arquitetura/ESTRUTURA_SISTEMA_WEB.md)
- [ARQUITETURA_ARMAZENAMENTO_FOTOS.md](arquitetura/ARQUITETURA_ARMAZENAMENTO_FOTOS.md)
- [ARQUITETURA_VISUAL_SERVICO.md](arquitetura/ARQUITETURA_VISUAL_SERVICO.md)
- [MOBILE_FILE_MAP.md](arquitetura/MOBILE_FILE_MAP.md) · [MOBILE_LIB_MAP.md](arquitetura/MOBILE_LIB_MAP.md) · [PROJECT_FILE_MAP.md](arquitetura/PROJECT_FILE_MAP.md)
- [auditoria-colunas-obras.md](arquitetura/auditoria-colunas-obras.md)
- [COMP_IMPLEMENTATION.md](arquitetura/COMP_IMPLEMENTATION.md)

---

## Funcionalidades

Como cada recurso do sistema funciona: offline, sync, fluxos, UI, botões, cache, etc.

**Destaques:**
- [FUNCIONALIDADE_OFFLINE.md](funcionalidades/FUNCIONALIDADE_OFFLINE.md)
- [SISTEMA_100_OFFLINE.md](funcionalidades/SISTEMA_100_OFFLINE.md)
- [SISTEMA_CACHE_FOTOS_SINCRONIZACAO.md](funcionalidades/SISTEMA_CACHE_FOTOS_SINCRONIZACAO.md)
- [PROTECAO_FOTOS.md](funcionalidades/PROTECAO_FOTOS.md)
- [PROTECAO_CONTRA_CRASHES.md](funcionalidades/PROTECAO_CONTRA_CRASHES.md)
- [GARANTIA_ZERO_CRASHES.md](funcionalidades/GARANTIA_ZERO_CRASHES.md)
- [FLUXO_COMPLETO_USUARIO.md](funcionalidades/FLUXO_COMPLETO_USUARIO.md)

Ver [pasta completa](funcionalidades/) (51 docs).

---

## Guias

Passo-a-passo para tarefas específicas: como usar, testar, debugar, adicionar usuário, etc.

**Destaques:**
- [GUIA_DE_TESTE.md](guias/GUIA_DE_TESTE.md)
- [INSTRUCOES_LOGIN_POR_EQUIPE.md](guias/INSTRUCOES_LOGIN_POR_EQUIPE.md)
- [INSTRUCOES_ADICIONAR_USUARIO.md](guias/INSTRUCOES_ADICIONAR_USUARIO.md)
- [COMO_USAR_EXPO_GO.md](guias/COMO_USAR_EXPO_GO.md)
- [GUIA_RAPIDO_SINCRONIZACAO.md](guias/GUIA_RAPIDO_SINCRONIZACAO.md)
- [COMO_DEBUGAR_FOTOS_SYNC.md](guias/COMO_DEBUGAR_FOTOS_SYNC.md)

Ver [pasta completa](guias/) (21 docs).

---

## Correções

Histórico de bugs corrigidos, fixes, debug, resoluções de erro. Útil pra entender por que algo foi feito de uma forma específica.

**Destaques:**
- [RESUMO_FINAL_CORRECOES.md](correcoes/RESUMO_FINAL_CORRECOES.md)
- [RESUMO_ANTI_CRASH.md](correcoes/RESUMO_ANTI_CRASH.md)
- [SOLUCAO_FINAL_FOTOS.md](correcoes/SOLUCAO_FINAL_FOTOS.md)
- [SOLUCAO_FINAL_STATUS_OBRAS.md](correcoes/SOLUCAO_FINAL_STATUS_OBRAS.md)
- [CORRECAO_FOTOS_SUMINDO_DEFINITIVO.md](correcoes/CORRECAO_FOTOS_SUMINDO_DEFINITIVO.md)
- [CORRECAO_SYNC_STATUS_FOTOS_DUPLICADAS.md](correcoes/CORRECAO_SYNC_STATUS_FOTOS_DUPLICADAS.md)

Ver [pasta completa](correcoes/) (38 docs).

---

## Migrações

Como aplicar migrações de banco, RLS, ajustes manuais no Supabase, correções estruturais.

- [APLICAR_MIGRACAO_URGENTE.md](migracoes/APLICAR_MIGRACAO_URGENTE.md)
- [APLICAR_MIGRATION_MANUAL.md](migracoes/APLICAR_MIGRATION_MANUAL.md)
- [APLICAR_STORAGE_RLS.md](migracoes/APLICAR_STORAGE_RLS.md)
- [MIGRACOES_PENDENTES.md](migracoes/MIGRACOES_PENDENTES.md)
- [CORRIGIR_RLS_OBRAS.md](migracoes/CORRIGIR_RLS_OBRAS.md)
- [SOLUCAO_FINAL_RLS.md](migracoes/SOLUCAO_FINAL_RLS.md)
- [VERIFICAR_STORAGE_SUPABASE.md](migracoes/VERIFICAR_STORAGE_SUPABASE.md)

Ver [pasta completa](migracoes/) (16 docs).

---

## Placa de Obra

Tudo sobre o sistema de placa (carimbo, scanner, overlay, limitações por plataforma).

- [SCANNER_PLACA_OBRA.md](placa/SCANNER_PLACA_OBRA.md)
- [PLACA_AUTOMATICA_FOTOS.md](placa/PLACA_AUTOMATICA_FOTOS.md)
- [PLACA_CARIMBO_FOTO.md](placa/PLACA_CARIMBO_FOTO.md)
- [PLACA_REALIDADE_TECNICA.md](placa/PLACA_REALIDADE_TECNICA.md)
- [SOLUCAO_FINAL_PLACA.md](placa/SOLUCAO_FINAL_PLACA.md)

Ver [pasta completa](placa/) (12 docs).

---

## Release

Build, deploy, atualização do APK, publicação na Play Store, apresentações.

- [GERAR_APK.md](release/GERAR_APK.md)
- [ATUALIZAR_APK.md](release/ATUALIZAR_APK.md)
- [COMO_ATUALIZAR_APP.md](release/COMO_ATUALIZAR_APP.md)
- [PUBLICACAO_PLAY_STORE.md](release/PUBLICACAO_PLAY_STORE.md)
- [DIFERENCA_BUILDS.md](release/DIFERENCA_BUILDS.md)
- [APRESENTACAO_APP_MOBILE.md](release/APRESENTACAO_APP_MOBILE.md)
- [CHANGELOG_ANTI_CRASH.md](release/CHANGELOG_ANTI_CRASH.md)

Ver [pasta completa](release/) (9 docs).

---

## Sentry

Configuração de monitoramento de erros em produção.

- [SENTRY_SETUP.md](sentry/SENTRY_SETUP.md)
- [README_SENTRY.md](sentry/README_SENTRY.md)

---

## Supabase

Setup, CLI e operações no banco de produção.

- [README.md](supabase/README.md)
- [SETUP.md](supabase/SETUP.md)
- [CLI_GUIDE.md](supabase/CLI_GUIDE.md)
- [APLICAR_AGORA.md](supabase/APLICAR_AGORA.md)

---

## Exemplos

Arquivos de referência (XLSX, PDF, JSON) mostrando o formato esperado dos exports e relatórios. Útil pra comparar com o output do código e detectar regressões.

- [README da pasta](exemplos/README.md) — convenções e o que colocar aqui

---

## Convenções

- **Nada é deletado** — bugs antigos ficam em `correcoes/` pra referência histórica.
- **Prefixo do nome** define a pasta: `CORRECAO_*` → `correcoes/`, `GUIA_*` → `guias/`, etc.
- **Casos ambíguos** vão pro "melhor encaixe" — se errar, é só `git mv`.
- **`README.md` e `ORGANIZACAO.md`** ficam na raiz de `docs/` por serem índices.

Voltar para o [README principal](../README.md).
