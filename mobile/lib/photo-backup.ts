import * as FileSystem from 'expo-file-system/legacy';
import * as ImageManipulator from 'expo-image-manipulator';
import AsyncStorage from '@react-native-async-storage/async-storage';
import * as utm from 'utm';
import { captureError } from './sentry';
import { savePhotoToGallery } from './save-to-gallery';
import { logger } from '../utils/logger';


const PHOTO_BACKUP_DIR = `${FileSystem.documentDirectory}obra_photos_backup/`;
const PHOTO_METADATA_KEY = '@photo_metadata';
// Fotos já enviadas (uploaded=true + supabaseUrl) ficam aqui; só pendentes ficam em PHOTO_METADATA_KEY
const PHOTO_METADATA_ARCHIVED_KEY = '@photo_metadata:archived';
const ARCHIVED_PRUNED_AT_KEY = '@photo_metadata:archived_pruned_at';
const ARCHIVED_PRUNE_INTERVAL_MS = 24 * 60 * 60 * 1000; // 1 dia
const ARCHIVED_MAX_AGE_MS = 90 * 24 * 60 * 60 * 1000; // 90 dias
const MIN_FREE_STORAGE_BYTES = 80 * 1024 * 1024; // 80MB
const STORAGE_SAFETY_MARGIN_BYTES = 20 * 1024 * 1024; // 20MB

/**
 * Verifica espaço livre antes de copiar/comprimir arquivos para reduzir risco de falha por disco cheio.
 */
const ensureEnoughStorageForBackup = async (uri: string): Promise<void> => {
  try {
    const fileInfo = await FileSystem.getInfoAsync(uri);
    const originalSize = fileInfo.exists ? (fileInfo.size || 0) : 0;
    const estimatedRequiredBytes = Math.max(
      MIN_FREE_STORAGE_BYTES,
      (originalSize * 2) + STORAGE_SAFETY_MARGIN_BYTES
    );

    const freeDiskBytes = await FileSystem.getFreeDiskStorageAsync();
    if (freeDiskBytes < estimatedRequiredBytes) {
      const freeMb = Math.floor(freeDiskBytes / 1024 / 1024);
      const requiredMb = Math.floor(estimatedRequiredBytes / 1024 / 1024);
      throw new Error(`Espaço insuficiente no dispositivo (${freeMb}MB livres, mínimo ${requiredMb}MB).`);
    }
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    if (message.toLowerCase().includes('espaço insuficiente')) {
      throw error;
    }
    logger.warn('Não foi possível validar espaço livre antes do backup. Prosseguindo:', message);
  }
};

export interface PhotoMetadata {
  id: string;
  obraId: string;
  type: 'apr' | 'antes' | 'durante' | 'depois' | 'abertura' | 'fechamento' |
    'ditais_abertura' | 'ditais_impedir' | 'ditais_testar' | 'ditais_aterrar' | 'ditais_sinalizar' |
    'aterramento_vala_aberta' | 'aterramento_hastes' | 'aterramento_vala_fechada' | 'aterramento_medicao' |
    'transformador_laudo' | 'transformador_componente_instalado' | 'transformador_tombamento_instalado' |
    'transformador_tape' | 'transformador_placa_instalado' | 'transformador_instalado' |
    'transformador_antes_retirar' | 'transformador_laudo_retirado' | 'transformador_tombamento_retirado' | 'transformador_placa_retirado' |
    'transformador_conexoes_primarias_instalado' | 'transformador_conexoes_secundarias_instalado' |
    'transformador_conexoes_primarias_retirado' | 'transformador_conexoes_secundarias_retirado' |
    'medidor_padrao' | 'medidor_leitura' | 'medidor_selo_born' | 'medidor_selo_caixa' | 'medidor_identificador_fase' |
    'checklist_croqui' | 'checklist_panoramica_inicial' | 'checklist_chede' | 'checklist_aterramento_cerca' |
    'checklist_padrao_geral' | 'checklist_padrao_interno' | 'checklist_frying' | 'checklist_abertura_fechamento_pulo' |
    'checklist_postes' | 'checklist_seccionamentos' |
    'checklist_ponto_haste' | 'checklist_ponto_termometro' | 'checklist_panoramica_final' |
    'checklist_poste_inteiro' | 'checklist_poste_engaste' | 'checklist_poste_descricao' | 'checklist_poste_conexao1' | 'checklist_poste_conexao2' |
    'checklist_poste_maior_esforco' | 'checklist_poste_menor_esforco' |
    'checklist_seccionamento' | 'checklist_emenda' | 'checklist_poda' |
    'doc_cadastro_medidor' | 'doc_laudo_transformador' | 'doc_laudo_regulador' |
    'doc_laudo_religador' | 'doc_apr' | 'doc_fvbt' | 'doc_termo_desistencia_lpt' | 'doc_autorizacao_passagem' |
    'doc_materiais_previsto' | 'doc_materiais_realizado' |
    'altimetria_lado_fonte' | 'altimetria_medicao_fonte' | 'altimetria_lado_carga' | 'altimetria_medicao_carga' |
    'vazamento_evidencia' | 'vazamento_equipamentos_limpeza' | 'vazamento_tombamento_retirado' |
    'vazamento_placa_retirado' | 'vazamento_tombamento_instalado' | 'vazamento_placa_instalado' |
    'vazamento_instalacao';
  index: number;
  originalUri: string;
  backupPath: string;
  compressedPath: string;
  latitude: number | null;
  longitude: number | null;
  utmX: number | null;
  utmY: number | null;
  utmZone: string | null;
  timestamp: string;
  uploaded: boolean;
  uploadUrl?: string;
  lost?: boolean; // true quando o arquivo local foi perdido e nao pode mais subir
  lostAt?: string;
  lostReason?: string;
  supabaseUrl?: string; // URL pública após upload para o Supabase
  retries: number;
  lastRetryAt?: string;
  mimeType?: string; // MIME type do arquivo (padrão: 'image/jpeg', PDFs: 'application/pdf')
}

/**
 * Garante que o diretório de backup existe
 */
const ensureBackupDirectoryExists = async (): Promise<void> => {
  const dirInfo = await FileSystem.getInfoAsync(PHOTO_BACKUP_DIR);

  if (!dirInfo.exists) {
    await FileSystem.makeDirectoryAsync(PHOTO_BACKUP_DIR, { intermediates: true });
  }
};

/**
 * Converte coordenadas geográficas (lat/long) para UTM
 */
const convertToUTM = (latitude: number | null, longitude: number | null): {
  utmX: number | null;
  utmY: number | null;
  utmZone: string | null;
} => {
  if (latitude === null || longitude === null) {
    return { utmX: null, utmY: null, utmZone: null };
  }

  try {
    const utmCoords = utm.fromLatLon(latitude, longitude);
    return {
      utmX: utmCoords.easting,
      utmY: utmCoords.northing,
      utmZone: `${utmCoords.zoneNum}${utmCoords.zoneLetter}`
    };
  } catch (error) {
    logger.error('Erro ao converter para UTM:', error);
    return { utmX: null, utmY: null, utmZone: null };
  }
};

/**
 * Comprime uma foto para economizar espaço
 * Redimensiona para largura máxima de 1920px e aplica compressão JPEG de 70%
 */
const compressPhoto = async (uri: string): Promise<string> => {
  try {
    // Comprimir foto: resize para 1920px de largura máxima e qualidade 70%
    const manipResult = await ImageManipulator.manipulateAsync(
      uri,
      [{ resize: { width: 1920 } }], // Mantém aspect ratio
      {
        compress: 0.7, // 70% de qualidade
        format: ImageManipulator.SaveFormat.JPEG,
      }
    );

    return manipResult.uri;
  } catch (error) {
    logger.error('Erro ao comprimir foto:', error);
    // Se falhar, retorna URI original
    return uri;
  }
};

/**
 * Faz backup de uma foto no storage permanente
 */
export const backupPhoto = async (
  uri: string,
  obraId: string,
  type: 'apr' | 'antes' | 'durante' | 'depois' | 'abertura' | 'fechamento' |
    'ditais_abertura' | 'ditais_impedir' | 'ditais_testar' | 'ditais_aterrar' | 'ditais_sinalizar' |
    'aterramento_vala_aberta' | 'aterramento_hastes' | 'aterramento_vala_fechada' | 'aterramento_medicao' |
    'transformador_laudo' | 'transformador_componente_instalado' | 'transformador_tombamento_instalado' |
    'transformador_tape' | 'transformador_placa_instalado' | 'transformador_instalado' |
    'transformador_antes_retirar' | 'transformador_laudo_retirado' | 'transformador_tombamento_retirado' | 'transformador_placa_retirado' |
    'transformador_conexoes_primarias_instalado' | 'transformador_conexoes_secundarias_instalado' |
    'transformador_conexoes_primarias_retirado' | 'transformador_conexoes_secundarias_retirado' |
    'medidor_padrao' | 'medidor_leitura' | 'medidor_selo_born' | 'medidor_selo_caixa' | 'medidor_identificador_fase' |
    'checklist_croqui' | 'checklist_panoramica_inicial' | 'checklist_chede' | 'checklist_aterramento_cerca' |
    'checklist_padrao_geral' | 'checklist_padrao_interno' | 'checklist_frying' | 'checklist_abertura_fechamento_pulo' |
    'checklist_postes' | 'checklist_seccionamentos' |
    'checklist_ponto_haste' | 'checklist_ponto_termometro' | 'checklist_panoramica_final' |
    'checklist_poste_inteiro' | 'checklist_poste_engaste' | 'checklist_poste_descricao' | 'checklist_poste_conexao1' | 'checklist_poste_conexao2' |
    'checklist_poste_maior_esforco' | 'checklist_poste_menor_esforco' |
    'checklist_seccionamento' | 'checklist_emenda' | 'checklist_poda' |
    'doc_cadastro_medidor' | 'doc_laudo_transformador' | 'doc_laudo_regulador' |
    'doc_laudo_religador' | 'doc_apr' | 'doc_fvbt' | 'doc_termo_desistencia_lpt' | 'doc_autorizacao_passagem' |
    'doc_materiais_previsto' | 'doc_materiais_realizado' |
    'altimetria_lado_fonte' | 'altimetria_medicao_fonte' | 'altimetria_lado_carga' | 'altimetria_medicao_carga' |
    'vazamento_evidencia' | 'vazamento_equipamentos_limpeza' | 'vazamento_tombamento_retirado' |
    'vazamento_placa_retirado' | 'vazamento_tombamento_instalado' | 'vazamento_placa_instalado' |
    'vazamento_instalacao',
  index: number,
  latitude: number | null,
  longitude: number | null,
  mimeType: string = 'image/jpeg',
  source: 'camera' | 'gallery' = 'camera'
): Promise<PhotoMetadata> => {
  let photoId = '';
  let backupPath = '';
  let compressedPath = '';
  let metadataSaved = false;

  try {
    await ensureEnoughStorageForBackup(uri);
    await ensureBackupDirectoryExists();

    const isPdf = mimeType === 'application/pdf';
    const ext = isPdf ? 'pdf' : 'jpg';
    photoId = `${obraId}_${type}_${index}_${Date.now()}`;
    const filename = `${photoId}.${ext}`;
    backupPath = `${PHOTO_BACKUP_DIR}${filename}`;
    const compressedFilename = `${photoId}_compressed.${ext}`;
    compressedPath = `${PHOTO_BACKUP_DIR}${compressedFilename}`;

    const sourceInfo = await FileSystem.getInfoAsync(uri);
    if (!sourceInfo.exists) {
      throw new Error('Arquivo de origem nao encontrado para backup');
    }
    const sourceSize = (sourceInfo as any).size ?? 0;
    const MIN_VALID_SIZE = isPdf ? 512 : 1024;
    if (sourceSize < MIN_VALID_SIZE) {
      throw new Error(`Arquivo de origem invalido: ${sourceSize} bytes (minimo: ${MIN_VALID_SIZE}B)`);
    }

    // 1. Converter coordenadas para UTM e persistir metadata primeiro.
    // Se falhar antes da copia, nada e escrito em disco.
    const utmCoords = convertToUTM(latitude, longitude);
    const metadata: PhotoMetadata = {
      id: photoId,
      obraId,
      type,
      index,
      originalUri: uri,
      backupPath,
      compressedPath,
      latitude,
      longitude,
      utmX: utmCoords.utmX,
      utmY: utmCoords.utmY,
      utmZone: utmCoords.utmZone,
      timestamp: new Date().toISOString(),
      uploaded: false,
      retries: 0,
      mimeType,
    };
    await savePhotoMetadata(metadata);
    metadataSaved = true;

    // 2. Copiar arquivo original para backup
    await FileSystem.copyAsync({
      from: uri,
      to: backupPath
    });

    // 3. Criar versão comprimida (apenas para imagens; PDFs sao copiados sem compressao)
    let compressedUri = uri;
    if (!isPdf) {
      try {
        compressedUri = await compressPhoto(uri);

        // ✅ Verificar se a compressão gerou um arquivo válido
        const compressedInfo = await FileSystem.getInfoAsync(compressedUri);
        if (!compressedInfo.exists) {
          logger.warn('Arquivo comprimido não existe, usando original');
          compressedUri = uri;
        }
      } catch (error) {
        logger.warn('Compressão falhou, usando arquivo original:', error);
      }
    }

    // ✅ Tentar copiar arquivo comprimido (ou original para PDFs)
    try {
      await FileSystem.copyAsync({
        from: compressedUri,
        to: compressedPath
      });
    } catch (copyError) {
      // Se falhar, tentar usar o backup original
      logger.warn('Falha ao copiar arquivo comprimido, tentando usar backup original:', copyError);
      await FileSystem.copyAsync({
        from: backupPath,
        to: compressedPath
      });
    }

    // ✅ Verificar se o arquivo foi salvo corretamente
    const finalCompressedInfo = await FileSystem.getInfoAsync(compressedPath);
    if (!finalCompressedInfo.exists) {
      throw new Error('Falha ao salvar arquivo - nao existe apos copia');
    }
    const savedSize = (finalCompressedInfo as any).size ?? 0;
    const MIN_SAVED_VALID_SIZE = isPdf ? 512 : 1024; // PDFs validos >= 512B, imagens >= 1KB
    if (savedSize < MIN_SAVED_VALID_SIZE) {
      throw new Error(`Arquivo corrompido ou vazio apos copia: ${savedSize} bytes (minimo: ${MIN_SAVED_VALID_SIZE}B)`);
    }
    logger.photos(`✅ Arquivo verificado (${isPdf ? 'PDF' : 'imagem'}): ${Math.round(savedSize / 1024)}KB`);

    // ✅ SEGURANÇA: Salvar na galeria pública do dispositivo imediatamente na captura.
    // Isso garante que a foto existe mesmo que o sync falhe, o app seja apagado ou o
    // armazenamento interno seja corrompido. Fire-and-forget: falha silenciosa.
    if (!isPdf && source === 'camera') {
      savePhotoToGallery(backupPath, 'Obras Teccel').catch((galleryErr) => {
        logger.warn('[backupPhoto] Falha ao salvar na galeria (não crítico):', galleryErr);
      });
    }

    return metadata;
  } catch (error) {
    if (metadataSaved && photoId) {
      await removePhotoMetadata(photoId);
    }

    if (backupPath) {
      try {
        const backupInfo = await FileSystem.getInfoAsync(backupPath);
        if (backupInfo.exists) await FileSystem.deleteAsync(backupPath, { idempotent: true });
      } catch {
        // ignora cleanup
      }
    }
    if (compressedPath) {
      try {
        const compressedInfo = await FileSystem.getInfoAsync(compressedPath);
        if (compressedInfo.exists) await FileSystem.deleteAsync(compressedPath, { idempotent: true });
      } catch {
        // ignora cleanup
      }
    }

    logger.error('Erro ao fazer backup da foto:', error);

    // 🔍 Capturar erro no Sentry com contexto
    captureError(error as Error, {
      type: 'photo',
      obraId,
      metadata: {
        photoType: type,
        photoIndex: index,
        hasLocation: latitude !== null && longitude !== null,
        operation: 'backup',
      },
    });

    throw error;
  }
};

/**
 * Salva metadata de uma foto nova (pendente de upload) na chave ativa.
 * Fotos já enviadas são movidas para a chave archived em markPhotoAsUploaded.
 */
const savePhotoMetadata = async (metadata: PhotoMetadata): Promise<void> => {
  try {
    const raw = await AsyncStorage.getItem(PHOTO_METADATA_KEY);
    const allMetadata: PhotoMetadata[] = raw ? JSON.parse(raw) : [];
    const index = allMetadata.findIndex(m => m.id === metadata.id);
    if (index !== -1) {
      allMetadata[index] = metadata;
    } else {
      allMetadata.push(metadata);
    }
    await AsyncStorage.setItem(PHOTO_METADATA_KEY, JSON.stringify(allMetadata));
  } catch (error) {
    logger.error('Erro ao salvar metadata da foto:', error);
    throw error;
  }
};

const removePhotoMetadata = async (photoId: string): Promise<void> => {
  try {
    const results = await AsyncStorage.multiGet([PHOTO_METADATA_KEY, PHOTO_METADATA_ARCHIVED_KEY]);
    const active: PhotoMetadata[] = results[0][1] ? JSON.parse(results[0][1]) : [];
    const archived: PhotoMetadata[] = results[1][1] ? JSON.parse(results[1][1]) : [];
    const nextActive = active.filter((m) => m.id !== photoId);
    const nextArchived = archived.filter((m) => m.id !== photoId);

    await AsyncStorage.setItem(PHOTO_METADATA_KEY, JSON.stringify(nextActive));
    await AsyncStorage.setItem(PHOTO_METADATA_ARCHIVED_KEY, JSON.stringify(nextArchived));
  } catch (error) {
    logger.warn('[removePhotoMetadata] Falha ao remover metadata durante rollback:', error);
  }
};

/**
 * Obtém todas as metadatas de fotos (ativas + arquivadas).
 * Para operações de sync que precisam de fotos já enviadas.
 */
export const getAllPhotoMetadata = async (): Promise<PhotoMetadata[]> => {
  try {
    const results = await AsyncStorage.multiGet([PHOTO_METADATA_KEY, PHOTO_METADATA_ARCHIVED_KEY]);
    const active: PhotoMetadata[] = results[0][1] ? JSON.parse(results[0][1]) : [];
    const archived: PhotoMetadata[] = results[1][1] ? JSON.parse(results[1][1]) : [];
    return [...active, ...archived];
  } catch (error) {
    logger.error('Erro ao obter metadata das fotos:', error);
    return [];
  }
};

/**
 * Remove entradas antigas da chave archived para evitar crescimento ilimitado do AsyncStorage.
 * Só executa se a última poda foi há mais de ARCHIVED_PRUNE_INTERVAL_MS.
 * Retorna o número de entradas removidas (0 se pulou ou não havia nada).
 */
export const pruneArchivedPhotoMetadata = async (): Promise<number> => {
  try {
    const lastPrunedRaw = await AsyncStorage.getItem(ARCHIVED_PRUNED_AT_KEY);
    const lastPruned = lastPrunedRaw ? Number(lastPrunedRaw) : 0;
    if (Date.now() - lastPruned < ARCHIVED_PRUNE_INTERVAL_MS) return 0;

    const raw = await AsyncStorage.getItem(PHOTO_METADATA_ARCHIVED_KEY);
    if (!raw) {
      await AsyncStorage.setItem(ARCHIVED_PRUNED_AT_KEY, String(Date.now()));
      return 0;
    }

    const archived: PhotoMetadata[] = JSON.parse(raw);
    const cutoff = Date.now() - ARCHIVED_MAX_AGE_MS;
    const kept = archived.filter((m) => {
      const ts = new Date(m.timestamp).getTime();
      return !Number.isFinite(ts) || ts > cutoff;
    });

    const removed = archived.length - kept.length;
    await AsyncStorage.multiSet([
      [PHOTO_METADATA_ARCHIVED_KEY, JSON.stringify(kept)],
      [ARCHIVED_PRUNED_AT_KEY, String(Date.now())],
    ]);

    if (removed > 0) {
      logger.storage(`[pruneArchived] Removidas ${removed} entrada(s) com mais de 90 dias da chave archived.`);
    }
    return removed;
  } catch (error) {
    logger.warn('[pruneArchived] Falha ao podar archived (não crítico):', error);
    return 0;
  }
};

/**
 * Obtém fotos pendentes de upload.
 * Lê apenas a chave ativa (pending) — não carrega fotos arquivadas para manter o parse rápido.
 * ✅ CORREÇÃO: Inclui fotos "zombie" (uploaded=true mas sem URL válida)
 */
export const getPendingPhotos = async (): Promise<PhotoMetadata[]> => {
  try {
    const raw = await AsyncStorage.getItem(PHOTO_METADATA_KEY);
    const active: PhotoMetadata[] = raw ? JSON.parse(raw) : [];
    return active.filter(m => {
      if (m.lost) return false;
      const hasRemoteUrl = !!(m.uploadUrl || m.supabaseUrl);
      if (!m.uploaded && !hasRemoteUrl) return true;
      if (!m.uploaded && hasRemoteUrl) return false;
      if (m.uploaded && !hasRemoteUrl) {
        logger.photos(`[getPendingPhotos] Foto zombie encontrada: ${m.id} - sera re-tentada`);
        return true;
      }
      return false;
    });
  } catch (error) {
    logger.error('Erro ao obter fotos pendentes:', error);
    return [];
  }
};

/**
 * Recupera fotos "zombie" de uma obra (uploaded=true mas sem URL)
 * Útil para diagnóstico e recuperação manual
 */
export const getZombiePhotos = async (obraId?: string): Promise<PhotoMetadata[]> => {
  const allMetadata = await getAllPhotoMetadata();
  return allMetadata.filter(m => {
    const isZombie = m.uploaded && (!m.uploadUrl || m.uploadUrl === '');
    if (obraId) {
      return isZombie && m.obraId === obraId;
    }
    return isZombie;
  });
};

/**
 * Reseta fotos zombie para permitir novo upload
 */
export const resetZombiePhotos = async (obraId?: string): Promise<number> => {
  try {
    const results = await AsyncStorage.multiGet([PHOTO_METADATA_KEY, PHOTO_METADATA_ARCHIVED_KEY]);
    const active: PhotoMetadata[] = results[0][1] ? JSON.parse(results[0][1]) : [];
    const archived: PhotoMetadata[] = results[1][1] ? JSON.parse(results[1][1]) : [];
    let count = 0;

    const resetIfZombie = (m: PhotoMetadata): PhotoMetadata => {
      const isZombie = m.uploaded && (!m.uploadUrl || m.uploadUrl === '');
      const matchesObra = !obraId || m.obraId === obraId;
      if (isZombie && matchesObra) {
        count++;
        logger.photos(`✅ Foto zombie resetada: ${m.id}`);
        return { ...m, uploaded: false, uploadUrl: undefined, retries: 0 };
      }
      return m;
    };

    const nextActive = active.map(resetIfZombie);
    const nextArchived = archived.map(resetIfZombie);

    if (count > 0) {
      await AsyncStorage.multiSet([
        [PHOTO_METADATA_KEY, JSON.stringify(nextActive)],
        [PHOTO_METADATA_ARCHIVED_KEY, JSON.stringify(nextArchived)],
      ]);
    }

    return count;
  } catch (error) {
    logger.error('❌ Erro ao resetar fotos zombie:', error);
    return 0;
  }
};

/**
 * Obtém fotos de uma obra específica
 */
export const getPhotosByObra = async (obraId: string): Promise<PhotoMetadata[]> => {
  const allMetadata = await getAllPhotoMetadata();
  return allMetadata.filter(m => m.obraId === obraId);
};

/**
 * Obtém fotos de uma obra específica, incluindo possíveis IDs antigos
 * Útil quando o obraId foi atualizado mas os IDs das fotos ainda contêm o obraId antigo
 */
export const getPhotosByObraWithFallback = async (
  obraId: string,
  photoIdsInObra?: string[],
  serverId?: string // ✅ NOVO: Aceitar serverId da obra (UUID do banco)
): Promise<PhotoMetadata[]> => {
  const allMetadata = await getAllPhotoMetadata();

  // 🔍 DEBUG: Mostrar total de fotos no storage e seus obraIds únicos
  const uniqueObraIds = [...new Set(allMetadata.map(m => m.obraId))];
  logger.photos(`🔍 [getPhotosByObraWithFallback] Total de ${allMetadata.length} foto(s) no storage`);
  logger.photos(`🔍 [getPhotosByObraWithFallback] ObraIds únicos no storage: ${uniqueObraIds.join(', ')}`);

  // ✅ Coletar todos os possíveis obraIds desde o início
  const allPossibleObraIds = new Set<string>([obraId]);
  if (serverId) {
    allPossibleObraIds.add(serverId);
  }

  // Extrair obraIds dos IDs das fotos
  if (photoIdsInObra && photoIdsInObra.length > 0) {
    logger.photos(`🔍 [getPhotosByObraWithFallback] PhotoIds na obra: ${photoIdsInObra.join(', ')}`);
    for (const photoId of photoIdsInObra) {
      // Formato: obraId_tipo_index_timestamp
      const match = photoId.match(/^(.+?)_(antes|durante|depois|abertura|fechamento|ditais_|aterramento_|transformador_|medidor_|checklist_|altimetria_|vazamento_|doc_)/);
      if (match && match[1]) {
        allPossibleObraIds.add(match[1]);
      }
    }
  }

  logger.photos(`🔍 [getPhotosByObraWithFallback] Buscando por obraIds: ${Array.from(allPossibleObraIds).join(', ')}`);

  // Buscar fotos por qualquer um dos possíveis obraIds
  let photos = allMetadata.filter(m => allPossibleObraIds.has(m.obraId));
  logger.photos(`🔍 [getPhotosByObraWithFallback] Encontradas ${photos.length} foto(s) por obraId`);

  // Se não encontrou e temos IDs específicos, buscar diretamente pelos IDs
  if (photos.length === 0 && photoIdsInObra && photoIdsInObra.length > 0) {
    logger.photos(`🔍 [getPhotosByObraWithFallback] Buscando diretamente pelos IDs das fotos...`);
    const stringPhotoIds = photoIdsInObra.filter(id => typeof id === 'string');
    photos = allMetadata.filter(m => stringPhotoIds.includes(m.id));

    if (photos.length > 0) {
      logger.photos(`✅ [getPhotosByObraWithFallback] Encontrou ${photos.length} foto(s) diretamente pelos IDs`);
    }
  } else if (photos.length < (photoIdsInObra?.length || 0)) {
    // Há menos fotos do que esperado - tentar buscar as faltantes pelos IDs
    logger.photos(`⚠️ [getPhotosByObraWithFallback] Encontrou ${photos.length} mas esperava ${photoIdsInObra?.length || 0}. Buscando faltantes pelos IDs...`);
    const foundIds = new Set(photos.map(p => p.id));
    const missingIds = (photoIdsInObra || []).filter(id => !foundIds.has(id));
    logger.photos(`🔍 [getPhotosByObraWithFallback] IDs faltantes: ${missingIds.join(', ')}`);

    const missingPhotos = allMetadata.filter(m => missingIds.includes(m.id));
    if (missingPhotos.length > 0) {
      logger.photos(`✅ [getPhotosByObraWithFallback] Encontrou ${missingPhotos.length} foto(s) faltantes pelos IDs`);
      photos = [...photos, ...missingPhotos];
    }
  }

  if (photos.length > 0) {
    logger.photos(`✅ [getPhotosByObraWithFallback] Total: ${photos.length} foto(s) encontradas`);
    // Mostrar IDs das fotos encontradas
    logger.photos(`📸 [getPhotosByObraWithFallback] IDs encontrados: ${photos.map(p => p.id).join(', ')}`);
  }

  return photos;
};

/**
 * Obtém metadatas de fotos a partir dos IDs.
 * Escaneia a chave ativa primeiro (pequena); só abre a chave archived se ainda faltarem IDs.
 * Early-exit assim que todos os IDs forem encontrados — evita parsear 10-50MB desnecessariamente.
 */
export const getPhotoMetadatasByIds = async (photoIds: string[]): Promise<PhotoMetadata[]> => {
  const remaining = new Set(photoIds.filter(Boolean));
  if (remaining.size === 0) return [];

  const results: PhotoMetadata[] = [];

  try {
    const pairs = await AsyncStorage.multiGet([PHOTO_METADATA_KEY, PHOTO_METADATA_ARCHIVED_KEY]);
    const activeRaw = pairs[0][1];
    const archivedRaw = pairs[1][1];

    if (activeRaw) {
      for (const m of JSON.parse(activeRaw) as PhotoMetadata[]) {
        if (remaining.has(m.id)) {
          results.push(m);
          remaining.delete(m.id);
        }
      }
    }

    if (remaining.size > 0 && archivedRaw) {
      for (const m of JSON.parse(archivedRaw) as PhotoMetadata[]) {
        if (remaining.has(m.id)) {
          results.push(m);
          remaining.delete(m.id);
          if (remaining.size === 0) break;
        }
      }
    }
  } catch (error) {
    logger.error('Erro ao obter metadatas por IDs:', error);
  }

  return results;
};

/**
 * Marca uma foto como uploaded, salva a URL do Supabase e move da chave ativa para archived.
 * Isso mantém a chave ativa pequena (só pendentes), acelerando getPendingPhotos.
 */
export const markPhotoAsUploaded = async (photoId: string, uploadUrl: string): Promise<void> => {
  try {
    const results = await AsyncStorage.multiGet([PHOTO_METADATA_KEY, PHOTO_METADATA_ARCHIVED_KEY]);
    const active: PhotoMetadata[] = results[0][1] ? JSON.parse(results[0][1]) : [];
    const archived: PhotoMetadata[] = results[1][1] ? JSON.parse(results[1][1]) : [];

    const activeIdx = active.findIndex(m => m.id === photoId);
    if (activeIdx !== -1) {
      const updated: PhotoMetadata = { ...active[activeIdx], uploaded: true, uploadUrl, supabaseUrl: uploadUrl };
      const archivedIdx = archived.findIndex((m) => m.id === photoId);
      const nextArchived = archivedIdx === -1
        ? [...archived, updated]
        : archived.map((m, idx) => (idx === archivedIdx ? updated : m));
      const nextActive = active.filter((m) => m.id !== photoId);
      await AsyncStorage.multiSet([
        [PHOTO_METADATA_ARCHIVED_KEY, JSON.stringify(nextArchived)],
        [PHOTO_METADATA_KEY, JSON.stringify(nextActive)],
      ]);
      return;
    }

    // Foto já estava no archived (re-marcação)
    const archivedIdx = archived.findIndex(m => m.id === photoId);
    if (archivedIdx !== -1) {
      archived[archivedIdx] = { ...archived[archivedIdx], uploaded: true, uploadUrl, supabaseUrl: uploadUrl };
      await AsyncStorage.setItem(PHOTO_METADATA_ARCHIVED_KEY, JSON.stringify(archived));
    }
  } catch (error) {
    logger.error('Erro ao marcar foto como uploaded:', error);
    throw error;
  }
};

/**
 * Marca uma foto como perdida para impedir retries infinitos
 */
export const markPhotoAsLost = async (photoId: string, reason?: string): Promise<boolean> => {
  try {
    const results = await AsyncStorage.multiGet([PHOTO_METADATA_KEY, PHOTO_METADATA_ARCHIVED_KEY]);
    const active: PhotoMetadata[] = results[0][1] ? JSON.parse(results[0][1]) : [];
    const archived: PhotoMetadata[] = results[1][1] ? JSON.parse(results[1][1]) : [];

    const applyLost = (photo: PhotoMetadata) => {
      const hadRemoteUrl = !!(photo.uploadUrl || photo.supabaseUrl);
      photo.lost = true;
      photo.lostAt = new Date().toISOString();
      photo.lostReason = reason || 'Arquivo local nao encontrado';
      if (hadRemoteUrl) {
        photo.uploaded = true;
      } else {
        photo.uploaded = false;
        delete photo.uploadUrl;
        delete photo.supabaseUrl;
      }
    };

    const activeIdx = active.findIndex(m => m.id === photoId);
    if (activeIdx !== -1) {
      applyLost(active[activeIdx]);
      await AsyncStorage.setItem(PHOTO_METADATA_KEY, JSON.stringify(active));
      return true;
    }

    const archivedIdx = archived.findIndex(m => m.id === photoId);
    if (archivedIdx !== -1) {
      applyLost(archived[archivedIdx]);
      await AsyncStorage.setItem(PHOTO_METADATA_ARCHIVED_KEY, JSON.stringify(archived));
      return true;
    }

    return false;
  } catch (error) {
    logger.error('Erro ao marcar foto como perdida:', error);
    return false;
  }
};

/**
 * Garante que um item de foto com `uri` local está no metadata ativo para ser processado.
 * - Se já existe com URL remota → não faz nada (já está bem).
 * - Se existe como `lost` ou sem URL → reseta para pending.
 * - Se não existe → cria entrada nova com `uri` como caminho do arquivo.
 * Retorna true se uma nova entrada foi criada ou restaurada.
 */
export const ensurePhotoMetadataFromUri = async (
  photoId: string,
  localUri: string,
  obraId: string,
  latitude?: number | null,
  longitude?: number | null,
): Promise<boolean> => {
  if (!photoId || !localUri) return false;
  try {
    const results = await AsyncStorage.multiGet([PHOTO_METADATA_KEY, PHOTO_METADATA_ARCHIVED_KEY]);
    const active: PhotoMetadata[] = results[0][1] ? JSON.parse(results[0][1]) : [];
    const archived: PhotoMetadata[] = results[1][1] ? JSON.parse(results[1][1]) : [];

    // Já existe no archived com URL → OK, nada a fazer
    const inArchived = archived.find(m => m.id === photoId);
    if (inArchived && (inArchived.uploadUrl || inArchived.supabaseUrl)) return false;

    const activeIdx = active.findIndex(m => m.id === photoId);

    if (activeIdx !== -1) {
      const m = active[activeIdx];
      // Já tem URL → OK
      if (m.uploadUrl || m.supabaseUrl) return false;
      // Está como lost ou retries esgotados → resetar
      if (m.lost || (m.retries ?? 0) >= 3) {
        active[activeIdx] = {
          ...m,
          lost: false,
          lostAt: undefined,
          lostReason: undefined,
          retries: 0,
          compressedPath: localUri,
          backupPath: localUri,
        } as PhotoMetadata;
        await AsyncStorage.setItem(PHOTO_METADATA_KEY, JSON.stringify(active));
        return true;
      }
      return false;
    }

    // Não existe no metadata → criar entrada nova a partir do uri
    // Extrai tipo e index do formato {uuid}_{tipo}_{index}_{timestamp}
    const uuidMatch = photoId.match(/^([0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12})/i);
    const afterUuid = uuidMatch ? photoId.slice(uuidMatch[1].length + 1) : photoId;
    const parts = afterUuid.split('_');
    const extractedType = parts.length >= 3 ? parts.slice(0, -2).join('_') : (parts[0] || 'foto');
    const extractedIndex = parts.length >= 2 ? parseInt(parts[parts.length - 2], 10) : 0;
    const utmCoords = convertToUTM(latitude ?? null, longitude ?? null);

    const newMeta: PhotoMetadata = {
      id: photoId,
      obraId,
      type: extractedType as PhotoMetadata['type'],
      index: Number.isFinite(extractedIndex) ? extractedIndex : 0,
      originalUri: localUri,
      backupPath: localUri,
      compressedPath: localUri,
      latitude: latitude ?? null,
      longitude: longitude ?? null,
      utmX: utmCoords.utmX,
      utmY: utmCoords.utmY,
      utmZone: utmCoords.utmZone,
      timestamp: new Date().toISOString(),
      uploaded: false,
      retries: 0,
      mimeType: 'image/jpeg',
    };
    active.push(newMeta);
    await AsyncStorage.setItem(PHOTO_METADATA_KEY, JSON.stringify(active));
    return true;
  } catch (error) {
    logger.warn('[ensurePhotoMetadataFromUri] Erro:', error);
    return false;
  }
};

/**
 * Para um photo ID armazenado como string pura (formato antigo, sem {id, uri}),
 * tenta descobrir o arquivo físico no diretório de backup e cria entrada no metadata.
 * Retorna true se uma entrada foi criada ou restaurada.
 */
export const ensurePhotoMetadataById = async (photoId: string, obraId: string): Promise<boolean> => {
  if (!photoId) return false;
  try {
    const results = await AsyncStorage.multiGet([PHOTO_METADATA_KEY, PHOTO_METADATA_ARCHIVED_KEY]);
    const active: PhotoMetadata[] = results[0][1] ? JSON.parse(results[0][1]) : [];
    const archived: PhotoMetadata[] = results[1][1] ? JSON.parse(results[1][1]) : [];

    const inArchived = archived.find(m => m.id === photoId);
    if (inArchived && (inArchived.uploadUrl || inArchived.supabaseUrl)) return false;

    const inActive = active.find(m => m.id === photoId);
    if (inActive) {
      if (inActive.uploadUrl || inActive.supabaseUrl) return false;
      if (!inActive.lost && (inActive.retries ?? 0) < 3) return false;
    }

    // Scan backup dir for a file whose name starts with this photoId
    const exts = ['jpg', 'jpeg', 'png', 'heic', 'webp', 'pdf'];
    let foundUri: string | null = null;

    for (const ext of exts) {
      const candidate = `${PHOTO_BACKUP_DIR}${photoId}_compressed.${ext}`;
      try {
        const info = await FileSystem.getInfoAsync(candidate);
        if (info.exists) { foundUri = candidate; break; }
      } catch {}
    }

    if (!foundUri) {
      for (const ext of exts) {
        const candidate = `${PHOTO_BACKUP_DIR}${photoId}.${ext}`;
        try {
          const info = await FileSystem.getInfoAsync(candidate);
          if (info.exists) { foundUri = candidate; break; }
        } catch {}
      }
    }

    if (!foundUri) {
      try {
        const fileNames = await FileSystem.readDirectoryAsync(PHOTO_BACKUP_DIR);
        const match = fileNames.find(name => name.startsWith(photoId));
        if (match) foundUri = `${PHOTO_BACKUP_DIR}${match}`;
      } catch {}
    }

    if (!foundUri) return false;

    return await ensurePhotoMetadataFromUri(photoId, foundUri, obraId, null, null);
  } catch (error) {
    logger.warn('[ensurePhotoMetadataById] Erro:', error);
    return false;
  }
};

/**
 * Reseta o flag `lost` de fotos marcadas como perdidas para permitir nova tentativa de upload.
 * Usado quando o arquivo físico ainda existe no dispositivo mas o metadata foi marcado como lost
 * após MAX_RETRIES falhas (geralmente por problema de rede temporário).
 * Retorna o número de fotos resetadas.
 */
export const resetLostPhotosByIds = async (photoIds: string[]): Promise<number> => {
  if (!photoIds || photoIds.length === 0) return 0;
  try {
    const raw = await AsyncStorage.getItem(PHOTO_METADATA_KEY);
    const active: PhotoMetadata[] = raw ? JSON.parse(raw) : [];
    let count = 0;
    const next = active.map((m) => {
      if (!photoIds.includes(m.id)) return m;
      if (!m.lost) return m;
      if (m.uploadUrl || m.supabaseUrl) return m; // já tem URL — não precisa resetar
      count++;
      return { ...m, lost: false, retries: 0, lostAt: undefined, lostReason: undefined } as PhotoMetadata;
    });
    if (count > 0) {
      await AsyncStorage.setItem(PHOTO_METADATA_KEY, JSON.stringify(next));
    }
    return count;
  } catch (error) {
    logger.warn('[resetLostPhotosByIds] Falha ao resetar fotos perdidas:', error);
    return 0;
  }
};

/**
 * Atualiza caminhos locais de uma foto (usado para autocorrecao de metadata)
 */
export const updatePhotoPaths = async (
  photoId: string,
  updates: Partial<Pick<PhotoMetadata, 'originalUri' | 'backupPath' | 'compressedPath'>>
): Promise<boolean> => {
  try {
    const results = await AsyncStorage.multiGet([PHOTO_METADATA_KEY, PHOTO_METADATA_ARCHIVED_KEY]);
    const active: PhotoMetadata[] = results[0][1] ? JSON.parse(results[0][1]) : [];
    const archived: PhotoMetadata[] = results[1][1] ? JSON.parse(results[1][1]) : [];

    const applyUpdates = (photo: PhotoMetadata) => {
      if (typeof updates.originalUri === 'string' && updates.originalUri.length > 0) {
        photo.originalUri = updates.originalUri;
      }
      if (typeof updates.backupPath === 'string' && updates.backupPath.length > 0) {
        photo.backupPath = updates.backupPath;
      }
      if (typeof updates.compressedPath === 'string' && updates.compressedPath.length > 0) {
        photo.compressedPath = updates.compressedPath;
      }
    };

    const activeIdx = active.findIndex(m => m.id === photoId);
    if (activeIdx !== -1) {
      applyUpdates(active[activeIdx]);
      await AsyncStorage.setItem(PHOTO_METADATA_KEY, JSON.stringify(active));
      return true;
    }

    const archivedIdx = archived.findIndex(m => m.id === photoId);
    if (archivedIdx !== -1) {
      applyUpdates(archived[archivedIdx]);
      await AsyncStorage.setItem(PHOTO_METADATA_ARCHIVED_KEY, JSON.stringify(archived));
      return true;
    }

    return false;
  } catch (error) {
    logger.error('Erro ao atualizar caminhos locais da foto:', error);
    return false;
  }
};

/**
 * Atualiza o obraId de todas as fotos associadas a uma obra
 * Útil quando uma obra offline é sincronizada e recebe um novo ID do servidor
 * Também atualiza fotos cujo ID começa com o oldObraId (para cobrir casos de IDs compostos)
 */
export const updatePhotosObraId = async (oldObraId: string, newObraId: string): Promise<number> => {
  try {
    const results = await AsyncStorage.multiGet([PHOTO_METADATA_KEY, PHOTO_METADATA_ARCHIVED_KEY]);
    const active: PhotoMetadata[] = results[0][1] ? JSON.parse(results[0][1]) : [];
    const archived: PhotoMetadata[] = results[1][1] ? JSON.parse(results[1][1]) : [];
    let updatedCount = 0;

    const remap = (photo: PhotoMetadata): PhotoMetadata => {
      if (photo.obraId === oldObraId || photo.id.startsWith(oldObraId + '_')) {
        updatedCount++;
        return { ...photo, obraId: newObraId };
      }
      return photo;
    };

    await AsyncStorage.multiSet([
      [PHOTO_METADATA_KEY, JSON.stringify(active.map(remap))],
      [PHOTO_METADATA_ARCHIVED_KEY, JSON.stringify(archived.map(remap))],
    ]);
    return updatedCount;
  } catch (error) {
    logger.error('Erro ao atualizar obraId das fotos:', error);
    throw error;
  }
};

/**
 * Incrementa contador de retries de uma foto
 */
export const incrementPhotoRetries = async (photoId: string): Promise<void> => {
  try {
    const results = await AsyncStorage.multiGet([PHOTO_METADATA_KEY, PHOTO_METADATA_ARCHIVED_KEY]);
    const active: PhotoMetadata[] = results[0][1] ? JSON.parse(results[0][1]) : [];
    const archived: PhotoMetadata[] = results[1][1] ? JSON.parse(results[1][1]) : [];

    const activeIdx = active.findIndex(m => m.id === photoId);
    if (activeIdx !== -1) {
      active[activeIdx].retries++;
      active[activeIdx].lastRetryAt = new Date().toISOString();
      await AsyncStorage.setItem(PHOTO_METADATA_KEY, JSON.stringify(active));
      return;
    }

    const archivedIdx = archived.findIndex(m => m.id === photoId);
    if (archivedIdx !== -1) {
      archived[archivedIdx].retries++;
      archived[archivedIdx].lastRetryAt = new Date().toISOString();
      await AsyncStorage.setItem(PHOTO_METADATA_ARCHIVED_KEY, JSON.stringify(archived));
    }
  } catch (error) {
    logger.error('Erro ao incrementar retries:', error);
    throw error;
  }
};

/**
 * Deleta backup de uma foto após upload bem-sucedido
 * IMPORTANTE: Mantém os metadados para que a URL do Supabase fique disponível
 * Os metadados só são removidos quando a obra é completamente sincronizada
 */
export const deletePhotoBackup = async (photoId: string): Promise<void> => {
  try {
    const allMetadata = await getAllPhotoMetadata();
    const photo = allMetadata.find(m => m.id === photoId);

    if (photo) {
      // Deletar arquivos físicos (mas MANTER metadados com URL do Supabase)
      try {
        const backupInfo = await FileSystem.getInfoAsync(photo.backupPath);
        if (backupInfo.exists) {
          await FileSystem.deleteAsync(photo.backupPath);
        }
      } catch (e) {
        // Ignorar erros ao deletar arquivos
      }

      try {
        const compressedInfo = await FileSystem.getInfoAsync(photo.compressedPath);
        if (compressedInfo.exists) {
          await FileSystem.deleteAsync(photo.compressedPath);
        }
      } catch (e) {
        // Ignorar erros ao deletar arquivos
      }

      // ✅ NÃO remover metadados - eles contêm a URL do Supabase
      // Os metadados serão limpos posteriormente pela função cleanupUploadedPhotos
      logger.photos(`✅ [deletePhotoBackup] Arquivos físicos removidos, metadados mantidos para: ${photoId}`);
    }
  } catch (error) {
    logger.error('Erro ao deletar backup da foto:', error);
    // Não propagar erro - mesmo que delete falhe, não é crítico
  }
};

/**
 * Limpa backups de fotos já uploadadas (manutenção)
 */
export const cleanupUploadedPhotos = async (): Promise<number> => {
  try {
    const allMetadata = await getAllPhotoMetadata();
    const uploaded = allMetadata.filter(m => m.uploaded);

    let deletedCount = 0;

    for (const photo of uploaded) {
      await deletePhotoBackup(photo.id);
      deletedCount++;
    }

    return deletedCount;
  } catch (error) {
    logger.error('Erro ao limpar fotos uploadadas:', error);
    return 0;
  }
};

/**
 * Obtém estatísticas de armazenamento
 */
export const getStorageStats = async (): Promise<{
  totalPhotos: number;
  pendingPhotos: number;
  uploadedPhotos: number;
  totalSize: number;
  pendingSize: number;
}> => {
  try {
    const allMetadata = await getAllPhotoMetadata();
    const pending = allMetadata.filter(m => !m.uploaded);
    const uploaded = allMetadata.filter(m => m.uploaded);

    let totalSize = 0;
    let pendingSize = 0;

    for (const photo of allMetadata) {
      const info = await FileSystem.getInfoAsync(photo.compressedPath);
      if (info.exists) {
        const size = info.size || 0;
        totalSize += size;
        if (!photo.uploaded) {
          pendingSize += size;
        }
      }
    }

    return {
      totalPhotos: allMetadata.length,
      pendingPhotos: pending.length,
      uploadedPhotos: uploaded.length,
      totalSize,
      pendingSize
    };
  } catch (error) {
    logger.error('Erro ao obter estatísticas:', error);
    return {
      totalPhotos: 0,
      pendingPhotos: 0,
      uploadedPhotos: 0,
      totalSize: 0,
      pendingSize: 0
    };
  }
};

/**
 * Verifica se uma foto existe fisicamente
 */
export const photoExists = async (photoId: string): Promise<boolean> => {
  try {
    const allMetadata = await getAllPhotoMetadata();
    const photo = allMetadata.find(m => m.id === photoId);

    if (!photo) return false;

    const candidates = [
      photo.compressedPath,
      photo.backupPath,
      photo.originalUri,
    ].filter((value): value is string => typeof value === 'string' && value.length > 0);

    for (const candidate of candidates) {
      try {
        const info = await FileSystem.getInfoAsync(candidate);
        if (info.exists) return true;
      } catch {
        // tenta o proximo caminho
      }
    }

    return false;
  } catch (error) {
    logger.error('Erro ao verificar existencia da foto:', error);
    return false;
  }
};
