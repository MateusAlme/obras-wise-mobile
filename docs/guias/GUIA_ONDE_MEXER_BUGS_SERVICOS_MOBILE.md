# Guia Rápido: Onde Mexer em Bugs de Serviços (Mobile)

Este arquivo é um mapa prático para manutenção.
Use como “problema -> arquivo/função”.

## 1) Foto some OFFLINE (resumo conta, formulário vazio)
- Arquivo principal: `mobile/app/nova-obra.tsx`
- Pontos:
  - `takePicturePoste(...)` e `recoverMissingPostePhotoFromGallery(...)` (captura/substituição)
  - `performAutoSave(...)` (auto-save local do formulário)
  - `handlePausar(...)` (salvar rascunho)
  - `persistLegacyServicoSnapshot(...)` (persistência do snapshot do serviço)
  - `loadObraDataAsync -> mapPhotos(...)` (reabertura/render)
- Apoio:
  - `mobile/lib/photo-backup.ts` (`backupPhoto`, `getPhotosByObraWithFallback`, `updatePhotosObraId`)
  - `mobile/components/PhotoWithPlaca.tsx` (erro de render da imagem)

## 2) Nuvem cortada não sai / pendência não sincroniza ao voltar online
- Arquivo principal: `mobile/app/obra-books.tsx`
- Pontos:
  - Listener de rede: `NetInfo.addEventListener(...)`
  - Transição offline->online: `onlineTransitionRef` + `handleSyncAllDrafts(true)`
  - Botão “Sincronizar Pendências”
- Apoio:
  - `mobile/lib/offline-sync.ts` (`checkInternetConnection`, `syncAllPendingObras`, `syncObra`)
  - `mobile/lib/servico-sync.ts` (`syncAllPendingServicos`)

## 3) Loop de sincronização / fica “Sincronizando...” sem limpar
- Arquivo principal: `mobile/app/obra-books.tsx`
- Pontos:
  - Guardas de reentrada: `syncingAllDrafts`, `lastSyncTime` (cooldown)
  - `handleSyncAllDrafts(...)`
- Apoio:
  - `mobile/lib/offline-sync.ts` (fila de obras pendentes)
  - `mobile/lib/servico-sync.ts` (fila de serviços pendentes)

## 4) Novo serviço abre preenchido com dados de outro
- Arquivo principal: `mobile/app/obra-books.tsx`
- Pontos:
  - `dbHydrated` e hidratação legada
  - `pickBestLegacySnapshotForServico(...)`
  - Regra de bloqueio para serviço novo (`client_pk` com prefixo `svc_`)

## 5) Fotos concentrando no Poste 1 / P2-P3 perdem vínculo
- Arquivo principal: `mobile/app/nova-obra.tsx`
- Pontos:
  - Persistência por poste em `postes_data` (`id`, `numero`, `fotos_antes/durante/depois`)
  - `getPosteIdPersistencia(...)`
  - Escolha de fonte ao reabrir (`pickBestPhotoEntriesSource` / `mapPhotos`)
- Apoio:
  - `mobile/app/obra-books.tsx` (`sanitizePostesDataForServico`, `openLegacyServicoDetalhe`)

## 6) Foto não renderiza (ENOENT file://... obra_photos_backup)
- Causa comum: metadado existe, arquivo local foi removido.
- Arquivos:
  - `mobile/components/PhotoWithPlaca.tsx` (fallback visual e ação de recuperação)
  - `mobile/lib/photo-backup.ts` (`photoExists`, caminhos `compressedPath/backupPath/originalUri`)
  - `mobile/app/nova-obra.tsx` (`onRecoverMissingPhoto` para substituir pela galeria)

## 7) Erro `PGRST116` ao buscar obra atual (0 rows com `.single()`)
- Arquivos:
  - `mobile/lib/offline-sync.ts`
  - `mobile/lib/servico-sync.ts`
  - Qualquer query com `.single()` em edição/sync
- Ajuste típico:
  - Preferir `.maybeSingle()` quando “não encontrar” é cenário válido.

## 8) Obra “não encontrada no servidor” ao editar/sincronizar
- Arquivo principal: `mobile/lib/offline-sync.ts`
- Pontos:
  - Decisão UPDATE vs INSERT em `syncObra(...)`
  - Campos `serverId`, `originalId`, `idToUpdate`
  - Fallback seguro para INSERT quando ID remoto está stale

## 9) Card mostra data/hora errada
- Arquivos:
  - `mobile/components/ServicosComponents.tsx` (formatação)
  - `mobile/app/obra-books.tsx` (fonte do timestamp `created_at/updated_at`)
- Verificar timezone local do dispositivo e conversão.

## 10) Diagnóstico visual / botões de manutenção
- Arquivo: `mobile/app/diagnostico.tsx`
- Use para melhorar ações de recuperação e mensagens operacionais.

---

## Fluxo mental de debug (ordem recomendada)
1. Reproduzir com logs: captura -> save -> reabrir -> sync.
2. Confirmar onde quebrou:
   - Estado em tela (`nova-obra.tsx`)
   - AsyncStorage/serviço local (`servico-sync.ts`)
   - Backup de foto (`photo-backup.ts`)
   - Fila/sync (`offline-sync.ts` / `servico-sync.ts`)
3. Corrigir no primeiro ponto de perda (não só no render).
4. Testar 3 cenários:
   - Offline puro
   - Online puro
   - Offline -> Online (retorno de conexão)

---

## Arquivos mais críticos (atalho)
- `mobile/app/nova-obra.tsx`
- `mobile/app/obra-books.tsx`
- `mobile/lib/offline-sync.ts`
- `mobile/lib/servico-sync.ts`
- `mobile/lib/photo-backup.ts`
- `mobile/components/PhotoWithPlaca.tsx`
- `mobile/components/ServicosComponents.tsx`

