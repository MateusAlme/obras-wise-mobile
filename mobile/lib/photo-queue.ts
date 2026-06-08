import AsyncStorage from '@react-native-async-storage/async-storage';
import NetInfo from '@react-native-community/netinfo';
import {
  PhotoMetadata,
  getPhotoMetadatasByIds,
  getPendingPhotos,
  markPhotoAsUploaded,
  markPhotoAsLost,
  incrementPhotoRetries,
  deletePhotoBackup,
  photoExists,
  updatePhotoPaths
} from './photo-backup';
import * as FileSystem from 'expo-file-system/legacy';
import { captureError } from './sentry';
import { logger } from '../utils/logger';

const UPLOAD_QUEUE_KEY = '@photo_upload_queue';
const MAX_RETRIES = 3; // Reduzido de 5 para 3
const RETRY_DELAYS = [1000, 3000, 5000]; // Reduzido: 1s, 3s, 5s (total 9s)
const UPLOAD_TIMEOUT_MS = 90_000; // 90 segundos por foto antes de timeout
const STALE_UPLOADING_MS = 150_000; // "uploading" sem atualizacao por 2m30s volta para pending
const SUPABASE_STORAGE_URL = 'https://hiuagpzaelcocyxutgdt.supabase.co';
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImhpdWFncHphZWxjb2N5eHV0Z2R0Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjE3NDE1ODAsImV4cCI6MjA3NzMxNzU4MH0.sEp1yx9p_RGPWUIQ1bzE2aYx1YdPiKHFZJ-GnG4a-N8';

interface UploadToSupabaseResult {
  success: boolean;
  url?: string;
  error?: string;
  skipRetry?: boolean;
  deferRetry?: boolean;
}

export interface UploadQueueItem {
  photoId: string;
  obraId: string;
  status: 'pending' | 'uploading' | 'success' | 'failed';
  error?: string;
  addedAt: string;
  lastAttemptAt?: string;
}

export interface UploadResult {
  photoId: string;
  success: boolean;
  url?: string;
  error?: string;
  permanent?: boolean; // Indica erro permanente (ex: arquivo perdido)
}

export interface UploadProgress {
  total: number;
  completed: number;
  failed: number;
  pending: number;
  currentPhotoId?: string;
}

// Chunked storage para a fila de upload — evita o erro "Row too big" do SQLite Android
// (limite ~2MB por linha) quando a equipe fica offline acumulando centenas de fotos.
const UPLOAD_QUEUE_CHUNK_KEY = '@photo_upload_queue_c';
const UPLOAD_QUEUE_CHUNK_COUNT = '@photo_upload_queue_n';
const QUEUE_CHUNK_MAX_BYTES = 1_400_000; // 1.4MB por chunk, bem abaixo do limite de 2MB

/** Lê a fila independente do formato (chave única legada ou chunks). */
async function readQueueRaw(): Promise<UploadQueueItem[]> {
  const nRaw = await AsyncStorage.getItem(UPLOAD_QUEUE_CHUNK_COUNT);
  if (nRaw) {
    const n = parseInt(nRaw, 10);
    if (n > 0) {
      const keys = Array.from({ length: n }, (_, i) => `${UPLOAD_QUEUE_CHUNK_KEY}${i}`);
      const pairs = await AsyncStorage.multiGet(keys);
      const all: UploadQueueItem[] = [];
      for (const [, chunk] of pairs) {
        if (chunk) all.push(...(JSON.parse(chunk) as UploadQueueItem[]));
      }
      return all;
    }
  }
  const raw = await AsyncStorage.getItem(UPLOAD_QUEUE_KEY);
  return raw ? (JSON.parse(raw) as UploadQueueItem[]) : [];
}

/** Escreve a fila, dividindo em chunks se ultrapassar o limite seguro. */
async function writeQueueRaw(queue: UploadQueueItem[]): Promise<void> {
  const json = JSON.stringify(queue);
  if (json.length <= QUEUE_CHUNK_MAX_BYTES) {
    const nRaw = await AsyncStorage.getItem(UPLOAD_QUEUE_CHUNK_COUNT);
    if (nRaw) {
      const oldN = parseInt(nRaw, 10);
      const toRemove = [UPLOAD_QUEUE_CHUNK_COUNT, ...Array.from({ length: oldN }, (_, i) => `${UPLOAD_QUEUE_CHUNK_KEY}${i}`)];
      await AsyncStorage.multiRemove(toRemove);
    }
    await AsyncStorage.setItem(UPLOAD_QUEUE_KEY, json);
    return;
  }
  const chunks: UploadQueueItem[][] = [[]];
  let used = 0;
  for (const item of queue) {
    const s = JSON.stringify(item);
    if (used + s.length > QUEUE_CHUNK_MAX_BYTES && chunks[chunks.length - 1].length > 0) {
      chunks.push([]);
      used = 0;
    }
    chunks[chunks.length - 1].push(item);
    used += s.length;
  }
  const nRaw = await AsyncStorage.getItem(UPLOAD_QUEUE_CHUNK_COUNT);
  const oldN = nRaw ? parseInt(nRaw, 10) : 0;
  const writes: [string, string][] = [
    [UPLOAD_QUEUE_CHUNK_COUNT, String(chunks.length)],
    ...chunks.map((c, i) => [`${UPLOAD_QUEUE_CHUNK_KEY}${i}`, JSON.stringify(c)] as [string, string]),
  ];
  await AsyncStorage.multiSet(writes);
  const toRemove = [UPLOAD_QUEUE_KEY, ...Array.from({ length: Math.max(0, oldN - chunks.length) }, (_, i) => `${UPLOAD_QUEUE_CHUNK_KEY}${chunks.length + i}`)];
  await AsyncStorage.multiRemove(toRemove);
}

const NETWORK_ERROR_PATTERNS = [
  'unable to resolve host',
  'no address associated with hostname',
  'network request failed',
  'failed to fetch',
  'failed to connect',
  'network is unreachable',
  'software caused connection abort',
  'connection timed out',
  'timeout',
];

const isExpectedNetworkError = (message?: string): boolean => {
  if (!message) return false;
  const normalized = message.toLowerCase();
  return NETWORK_ERROR_PATTERNS.some((pattern) => normalized.includes(pattern));
};

const isMissingLocalFileError = (message?: string): boolean => {
  if (!message) return false;
  const normalized = message.toLowerCase();
  return (
    normalized.includes('photo-backup') ||
    (normalized.includes('arquivo') && normalized.includes('encontrad')) ||
    normalized.includes('enoent') ||
    normalized.includes('no such file or directory') ||
    normalized.includes('open failed') ||
    normalized.includes('directory for') // Android: "Directory for '...' doesn't exist"
  );
};

const isZombiePhoto = (photoMetadata: PhotoMetadata): boolean => {
  const hasRemoteUrl = !!(photoMetadata.uploadUrl || photoMetadata.supabaseUrl);
  return photoMetadata.uploaded && !hasRemoteUrl;
};

const hasRemoteUrl = (photoMetadata: PhotoMetadata): boolean =>
  !!(photoMetadata.uploadUrl || photoMetadata.supabaseUrl);

const PHOTO_BACKUP_DIR = `${FileSystem.documentDirectory}obra_photos_backup/`;

const normalizeFileUri = (uri?: string): string | null => {
  if (!uri || typeof uri !== 'string') return null;
  const trimmed = uri.trim();
  if (!trimmed) return null;
  if (trimmed.startsWith('file://')) return trimmed;
  return `file://${trimmed}`;
};

const getFileNameFromUri = (uri?: string): string | null => {
  const normalized = normalizeFileUri(uri);
  if (!normalized) return null;
  const clean = normalized.split('?')[0].replace(/\/+$/, '');
  const parts = clean.split('/');
  return parts.length > 0 ? parts[parts.length - 1] : null;
};

const getCandidateUris = async (photoMetadata: PhotoMetadata): Promise<string[]> => {
  const candidates: string[] = [];
  const pushCandidate = (uri?: string) => {
    const normalized = normalizeFileUri(uri);
    if (normalized && !candidates.includes(normalized)) {
      candidates.push(normalized);
    }
  };

  pushCandidate(photoMetadata.compressedPath);
  pushCandidate(photoMetadata.backupPath);
  pushCandidate(photoMetadata.originalUri);

  const compressedName = getFileNameFromUri(photoMetadata.compressedPath);
  const backupName = getFileNameFromUri(photoMetadata.backupPath);
  if (compressedName) pushCandidate(`${PHOTO_BACKUP_DIR}${compressedName}`);
  if (backupName) pushCandidate(`${PHOTO_BACKUP_DIR}${backupName}`);

  const exts = ['jpg', 'jpeg', 'png', 'heic', 'webp', 'pdf'];
  for (const ext of exts) {
    pushCandidate(`${PHOTO_BACKUP_DIR}${photoMetadata.id}_compressed.${ext}`);
    pushCandidate(`${PHOTO_BACKUP_DIR}${photoMetadata.id}.${ext}`);
  }

  try {
    const fileNames = await FileSystem.readDirectoryAsync(PHOTO_BACKUP_DIR);
    const compressedMatch = fileNames.find(name => name.startsWith(`${photoMetadata.id}_compressed.`));
    const backupMatch = fileNames.find(name => name.startsWith(`${photoMetadata.id}.`));

    if (compressedMatch) pushCandidate(`${PHOTO_BACKUP_DIR}${compressedMatch}`);
    if (backupMatch) pushCandidate(`${PHOTO_BACKUP_DIR}${backupMatch}`);
  } catch {
    // diretorio pode nao existir; ignora
  }

  return candidates;
};

const resolveLocalPhotoForUpload = async (
  photoMetadata: PhotoMetadata
): Promise<{ uri: string; existsInfo: FileSystem.FileInfo }> => {
  const candidates = await getCandidateUris(photoMetadata);

  for (const candidate of candidates) {
    try {
      const info = await FileSystem.getInfoAsync(candidate);
      if (info.exists) {
        return {
          uri: candidate,
          existsInfo: info,
        };
      }
    } catch {
      // tenta proximo candidato
    }
  }

  throw new Error('Arquivo físico não encontrado (comprimido e backup)');
};

const healPhotoMetadataPaths = async (photoMetadata: PhotoMetadata, resolvedUri: string): Promise<void> => {
  const updates: Partial<Pick<PhotoMetadata, 'compressedPath' | 'backupPath' | 'originalUri'>> = {};
  const isCompressed = resolvedUri.includes('_compressed.');

  if (isCompressed && photoMetadata.compressedPath !== resolvedUri) {
    updates.compressedPath = resolvedUri;
  }
  if (!isCompressed && photoMetadata.backupPath !== resolvedUri) {
    updates.backupPath = resolvedUri;
  }
  if (photoMetadata.originalUri !== resolvedUri) {
    updates.originalUri = resolvedUri;
  }

  if (Object.keys(updates).length > 0) {
    await updatePhotoPaths(photoMetadata.id, updates);
  }
};

/**
 * Adiciona uma foto à fila de upload
 */
export const addToUploadQueue = async (photoId: string, obraId: string): Promise<void> => {
  try {
    const queue = await getUploadQueue();

    // Verificar se já existe
    const exists = queue.find(item => item.photoId === photoId);
    if (exists) return;

    const newItem: UploadQueueItem = {
      photoId,
      obraId,
      status: 'pending',
      addedAt: new Date().toISOString()
    };

    queue.push(newItem);
    await writeQueueRaw(queue);
  } catch (error) {
    logger.error('Erro ao adicionar foto à fila:', error);
    throw error;
  }
};

/**
 * Obtém a fila de upload
 */
export const getUploadQueue = async (): Promise<UploadQueueItem[]> => {
  try {
    return await readQueueRaw();
  } catch (error) {
    logger.error('Erro ao obter fila de upload:', error);
    return [];
  }
};

const normalizeQueueState = async (queue: UploadQueueItem[]): Promise<UploadQueueItem[]> => {
  if (queue.length === 0) return queue;

  const now = Date.now();
  const photoIds = queue.map((item) => item.photoId);
  const metadata = await getPhotoMetadatasByIds(photoIds);
  const metadataById = new Map(metadata.map((item) => [item.id, item]));
  let changed = false;
  const normalized: UploadQueueItem[] = [];

  for (const item of queue) {
    const metadata = metadataById.get(item.photoId);

    // Item sem metadata local nao pode ser reenviado; remover evita contador preso na UI.
    if (!metadata) {
      changed = true;
      continue;
    }

    // Foto ja enviada com URL remota nao deve continuar na fila.
    if (metadata.uploaded && hasRemoteUrl(metadata)) {
      changed = true;
      continue;
    }

    if (item.status === 'uploading') {
      const lastAttemptTs = item.lastAttemptAt ? Date.parse(item.lastAttemptAt) : NaN;
      const isStale = Number.isNaN(lastAttemptTs) || now - lastAttemptTs > STALE_UPLOADING_MS;

      if (isStale) {
        normalized.push({
          ...item,
          status: 'pending',
          error: 'Upload interrompido anteriormente; reenfileirado automaticamente.',
          lastAttemptAt: new Date().toISOString(),
        });
        changed = true;
        continue;
      }
    }

    normalized.push(item);
  }

  if (changed) {
    await writeQueueRaw(normalized);
  }

  return normalized;
};

/**
 * Atualiza status de um item na fila
 */
const updateQueueItemStatus = async (
  photoId: string,
  status: UploadQueueItem['status'],
  error?: string
): Promise<void> => {
  try {
    const queue = await getUploadQueue();
    const item = queue.find(i => i.photoId === photoId);

    if (item) {
      item.status = status;
      item.lastAttemptAt = new Date().toISOString();
      if (error) {
        item.error = error;
      } else {
        delete item.error;
      }

      await writeQueueRaw(queue);
    }
  } catch (error) {
    logger.error('Erro ao atualizar status na fila:', error);
  }
};

/**
 * Remove item da fila após upload bem-sucedido
 */
const removeFromQueue = async (photoId: string): Promise<void> => {
  try {
    const queue = await getUploadQueue();
    const filtered = queue.filter(item => item.photoId !== photoId);
    await writeQueueRaw(filtered);
  } catch (error) {
    logger.error('Erro ao remover da fila:', error);
  }
};

/**
 * Faz upload de uma foto para o Supabase Storage
 */
const uploadPhotoToSupabase = async (
  photoMetadata: PhotoMetadata
): Promise<UploadToSupabaseResult> => {
  try {
    // Login por equipe - usar obraId como pasta ao invés de user.id
    const folderName = photoMetadata.obraId || 'temp';

    // Verificar se foto existe
    const exists = await photoExists(photoMetadata.id);
    if (!exists) {
      logger.warn(`[uploadPhotoToSupabase] Foto ${photoMetadata.id} nao encontrada no photo-backup`);
      return { success: false, error: 'Foto nao encontrada no photo-backup', skipRetry: true };
    }

    // ✅ Resolver o melhor caminho local disponivel antes do upload
    let resolvedPhoto: { uri: string; existsInfo: FileSystem.FileInfo };
    try {
      resolvedPhoto = await resolveLocalPhotoForUpload(photoMetadata);
    } catch (resolveError: any) {
      const resolveMessage =
        resolveError?.message || 'Arquivo fisico nao encontrado (comprimido e backup)';
      logger.warn(
        `[uploadPhotoToSupabase] Foto ${photoMetadata.id} sem arquivo local para upload: ${resolveMessage}`
      );
      return { success: false, error: resolveMessage, skipRetry: true };
    }
    let photoUri = resolvedPhoto.uri;
    let fileInfo = resolvedPhoto.existsInfo;

    // Se os caminhos mudaram, atualizar metadata para as proximas sincronizacoes
    await healPhotoMetadataPaths(photoMetadata, photoUri);

    // Determinar MIME type e extensão (suporta PDFs e imagens)
    const contentType = photoMetadata.mimeType || 'image/jpeg';
    const fileExt = contentType === 'application/pdf' ? 'pdf' : 'jpg';

    // Criar nome único do arquivo com timestamp e random ID para evitar conflitos
    const timestamp = Date.now();
    const randomId = Math.random().toString(36).substr(2, 9);
    const fileName = `${photoMetadata.type}_${timestamp}_${randomId}_${photoMetadata.index}.${fileExt}`;
    // Usar obraId como pasta para organizar as fotos
    const filePath = `${folderName}/${fileName}`;

    if (photoUri !== photoMetadata.compressedPath) {
      logger.warn(`⚠️ Caminho comprimido original indisponível para ${photoMetadata.id}; usando: ${photoUri}`);
    }

    if (!fileInfo.exists) {
      logger.warn(
        `[uploadPhotoToSupabase] Arquivo fisico ausente para ${photoMetadata.id}: ${photoUri}`
      );
      return { success: false, error: 'Arquivo fisico nao encontrado (comprimido e backup)', skipRetry: true };
    }

    logger.photos(`📤 Enviando para Supabase via uploadAsync: ${filePath} (${Math.round((fileInfo.size || 0) / 1024)}KB, ${contentType})`);

    // Upload nativo sem carregar arquivo na memória JS (evita pico de memória com base64)
    const uploadUrl = `${SUPABASE_STORAGE_URL}/storage/v1/object/obra-photos/${filePath}`;

    const uploadPromise = FileSystem.uploadAsync(uploadUrl, photoUri, {
      httpMethod: 'POST',
      uploadType: FileSystem.FileSystemUploadType.BINARY_CONTENT,
      headers: {
        'Content-Type': contentType,
        Authorization: `Bearer ${SUPABASE_ANON_KEY}`,
        apikey: SUPABASE_ANON_KEY,
        'x-upsert': 'true',
      },
    });

    const timeoutPromise = new Promise<never>((_, reject) =>
      setTimeout(() => reject(new Error(`Upload timeout após ${UPLOAD_TIMEOUT_MS / 1000}s`)), UPLOAD_TIMEOUT_MS)
    );

    const uploadResult = await Promise.race([uploadPromise, timeoutPromise]);

    if (uploadResult.status < 200 || uploadResult.status >= 300) {
      let errorMessage = `HTTP ${uploadResult.status}`;
      try {
        const errorBody = JSON.parse(uploadResult.body || '{}');
        errorMessage = errorBody.error || errorBody.message || errorMessage;
      } catch {}
      logger.error(`❌ Erro no upload para ${filePath}: ${errorMessage}`);
      return { success: false, error: `Upload falhou: ${errorMessage}` };
    }

    logger.photos(`✅ Upload bem-sucedido: ${filePath}`);

    const publicUrl = `${SUPABASE_STORAGE_URL}/storage/v1/object/public/obra-photos/${filePath}`;
    return { success: true, url: publicUrl };

  } catch (error: any) {
    const errorMessage = error?.message || 'Erro desconhecido';

    if (isExpectedNetworkError(errorMessage)) {
      logger.warn(`📴 Upload adiado para quando voltar conexão (${photoMetadata.id}): ${errorMessage}`);
      return { success: false, error: errorMessage, deferRetry: true };
    }

    if (isMissingLocalFileError(errorMessage)) {
      logger.warn(
        `[uploadPhotoToSupabase] Erro permanente de arquivo local para ${photoMetadata.id}: ${errorMessage}`
      );
      return { success: false, error: errorMessage, skipRetry: true };
    }

    logger.error('Erro ao fazer upload da foto:', errorMessage);

    // 🔍 Capturar erro no Sentry
    captureError(new Error(errorMessage), {
      type: 'upload',
      photoId: photoMetadata.id,
      obraId: photoMetadata.obraId,
      metadata: {
        photoType: photoMetadata.type,
        photoIndex: photoMetadata.index,
        retries: photoMetadata.retries,
        operation: 'uploadPhotoToSupabase',
      },
    });

    return { success: false, error: errorMessage };
  }
};

/**
 * Processa upload de uma foto com retry
 */
const uploadPhotoWithRetry = async (
  photoMetadata: PhotoMetadata,
  onProgress?: (progress: UploadProgress) => void
): Promise<UploadResult> => {
  if (photoMetadata.uploaded && hasRemoteUrl(photoMetadata)) {
    const existingUrl = photoMetadata.uploadUrl || photoMetadata.supabaseUrl;
    await updateQueueItemStatus(photoMetadata.id, 'success');
    await removeFromQueue(photoMetadata.id);
    return {
      photoId: photoMetadata.id,
      success: true,
      url: existingUrl,
    };
  }

  let retries = 0;

  while (retries <= MAX_RETRIES) {
    // Atualizar status
    await updateQueueItemStatus(photoMetadata.id, 'uploading');

    // Tentar upload
    const result = await uploadPhotoToSupabase(photoMetadata);

    // Log detalhado do resultado
    if (!result.success) {
      const errorMessage = result.error || 'Erro desconhecido';
      if (result.deferRetry || isExpectedNetworkError(errorMessage)) {
        logger.warn(`⚠️ Upload adiado (tentativa ${retries + 1}/${MAX_RETRIES + 1}): ${errorMessage}`);
      } else if (result.skipRetry || isMissingLocalFileError(errorMessage)) {
        logger.warn(`⚠️ Upload sem retry (${photoMetadata.id}): ${errorMessage}`);
      } else {
        logger.error(`❌ Upload falhou (tentativa ${retries + 1}/${MAX_RETRIES + 1}): ${errorMessage}`);
      }
    }

    if (result.success && result.url) {
      // Sucesso!
      await markPhotoAsUploaded(photoMetadata.id, result.url);
      await updateQueueItemStatus(photoMetadata.id, 'success');
      await removeFromQueue(photoMetadata.id);

      // Deletar backup local após upload confirmado (sem await para não bloquear progresso)
      deletePhotoBackup(photoMetadata.id).catch(err => logger.warn('⚠️ Falha ao deletar backup local:', err));

      return {
        photoId: photoMetadata.id,
        success: true,
        url: result.url
      };
    }

    // Falha temporária de rede (offline/DNS): não consome retries agora.
    // Mantém pendente para próxima sincronização quando a internet estabilizar.
    if (result.deferRetry) {
      await updateQueueItemStatus(
        photoMetadata.id,
        'pending',
        result.error || 'Sem conexão com internet'
      );
      return {
        photoId: photoMetadata.id,
        success: false,
        error: result.error || 'Sem conexão com internet'
      };
    }

    // ⚠️ Se erro não deve fazer retry (arquivo não encontrado), parar imediatamente
    if ((result as any).skipRetry) {
      logger.warn(`⚠️ Pulando retry para foto ${photoMetadata.id}: ${result.error}`);
      await markPhotoAsLost(photoMetadata.id, result.error);
      await updateQueueItemStatus(
        photoMetadata.id,
        'failed',
        `Arquivo perdido: ${result.error}`
      );

      // ✅ CORREÇÃO: NÃO marcar como uploaded se falhou
      // Manter a foto como pendente mas com status 'lost' para permitir diagnóstico
      // A foto ainda pode ser recuperada se o arquivo for encontrado novamente
      await removeFromQueue(photoMetadata.id);

      return {
        photoId: photoMetadata.id,
        success: false,
        error: result.error,
        permanent: true // Indica que é um erro permanente (arquivo perdido)
      };
    }

    // Falhou - incrementar retries
    retries++;
    await incrementPhotoRetries(photoMetadata.id);

    const totalRetries = (photoMetadata.retries || 0) + retries;
    if (isZombiePhoto(photoMetadata) && totalRetries >= MAX_RETRIES) {
      const lostReason = `Foto zombie sem URL remota apos ${totalRetries} tentativas`;
      await markPhotoAsLost(photoMetadata.id, lostReason);
      await updateQueueItemStatus(photoMetadata.id, 'failed', lostReason);
      await removeFromQueue(photoMetadata.id);
      return {
        photoId: photoMetadata.id,
        success: false,
        error: lostReason,
        permanent: true,
      };
    }

    if (retries > MAX_RETRIES) {
      // Esgotou tentativas
      await updateQueueItemStatus(
        photoMetadata.id,
        'failed',
        `Falhou após ${MAX_RETRIES} tentativas: ${result.error}`
      );

      return {
        photoId: photoMetadata.id,
        success: false,
        error: result.error
      };
    }

    // Aguardar antes de tentar novamente (exponential backoff)
    const delay = RETRY_DELAYS[retries - 1] || 30000;
    logger.photos(`Retry ${retries}/${MAX_RETRIES} para foto ${photoMetadata.id} em ${delay}ms`);
    await new Promise(resolve => setTimeout(resolve, delay));
  }

  return {
    photoId: photoMetadata.id,
    success: false,
    error: 'Número máximo de tentativas excedido'
  };
};

/**
 * Processa toda a fila de upload
 */
export const processUploadQueue = async (
  onProgress?: (progress: UploadProgress) => void
): Promise<{ success: number; failed: number; results: UploadResult[] }> => {
  try {
    const queue = await getUploadQueue();
    await normalizeQueueState(queue);

    const pendingPhotos = await getPendingPhotos();

    if (pendingPhotos.length === 0) {
      return { success: 0, failed: 0, results: [] };
    }

    const netState = await NetInfo.fetch();
    const isOnline = netState.isConnected === true && netState.isInternetReachable !== false;
    if (!isOnline) {
      logger.photos('[processUploadQueue] Sem conexão - mantendo uploads pendentes');
      return {
        success: 0,
        failed: pendingPhotos.length,
        results: pendingPhotos.map((photo) => ({
          photoId: photo.id,
          success: false,
          error: 'Sem conexão com internet',
        })),
      };
    }

    const results: UploadResult[] = [];
    let successCount = 0;
    let failedCount = 0;

    for (let i = 0; i < pendingPhotos.length; i++) {
      const photo = pendingPhotos[i];

      // Notificar progresso
      if (onProgress) {
        onProgress({
          total: pendingPhotos.length,
          completed: i,
          failed: failedCount,
          pending: pendingPhotos.length - i,
          currentPhotoId: photo.id
        });
      }

      // Adicionar à fila se não estiver
      await addToUploadQueue(photo.id, photo.obraId);

      // Fazer upload
      const result = await uploadPhotoWithRetry(photo, onProgress);
      results.push(result);

      if (result.success) {
        successCount++;
      } else {
        failedCount++;
      }
    }

    // Notificar conclusão
    if (onProgress) {
      onProgress({
        total: pendingPhotos.length,
        completed: pendingPhotos.length,
        failed: failedCount,
        pending: 0
      });
    }

    return { success: successCount, failed: failedCount, results };

  } catch (error) {
    logger.error('Erro ao processar fila de upload:', error);
    return { success: 0, failed: 0, results: [] };
  }
};

/**
 * Processa apenas fotos de uma obra específica
 * OTIMIZADO: Upload paralelo de até 3 fotos simultaneamente
 */
export const processObraPhotos = async (
  obraId: string,
  onProgress?: (progress: UploadProgress) => void,
  photoIds?: string[]
): Promise<{ success: number; failed: number; results: UploadResult[] }> => {
  try {
    const queue = await getUploadQueue();
    await normalizeQueueState(queue);

    const allPending = await getPendingPhotos();
    const uniquePhotoIds = photoIds && photoIds.length > 0 ? Array.from(new Set(photoIds)) : null;
    const obraPhotos = uniquePhotoIds
      ? allPending.filter(p => uniquePhotoIds.includes(p.id))
      : allPending.filter(p => p.obraId === obraId);

    if (obraPhotos.length === 0) {
      return { success: 0, failed: 0, results: [] };
    }

    const netState = await NetInfo.fetch();
    const isOnline = netState.isConnected === true && netState.isInternetReachable !== false;
    if (!isOnline) {
      logger.photos(`[processObraPhotos] Sem conexão - obra ${obraId} permanece pendente`);
      return {
        success: 0,
        failed: obraPhotos.length,
        results: obraPhotos.map((photo) => ({
          photoId: photo.id,
          success: false,
          error: 'Sem conexão com internet',
        })),
      };
    }

    logger.photos(`[processObraPhotos] Iniciando upload paralelo de ${obraPhotos.length} foto(s)`);

    // Adicionar todas à fila primeiro
    for (const photo of obraPhotos) {
      await addToUploadQueue(photo.id, photo.obraId);
    }

    const results: UploadResult[] = [];
    let successCount = 0;
    let failedCount = 0;
    let completedCount = 0;

    const BATCH_SIZE = 2;
    for (let i = 0; i < obraPhotos.length; i += BATCH_SIZE) {
      const batch = obraPhotos.slice(i, i + BATCH_SIZE);

      logger.photos(`[processObraPhotos] Processando lote ${Math.floor(i/BATCH_SIZE) + 1}/${Math.ceil(obraPhotos.length/BATCH_SIZE)} (${batch.length} fotos)`);

      // Upload paralelo do lote
      const batchResults = await Promise.all(
        batch.map(photo => uploadPhotoWithRetry(photo, onProgress))
      );

      // Processar resultados do lote
      for (const result of batchResults) {
        results.push(result);
        completedCount++;

        if (result.success) {
          successCount++;
        } else {
          failedCount++;
        }

        // Notificar progresso
        if (onProgress) {
          onProgress({
            total: obraPhotos.length,
            completed: completedCount,
            failed: failedCount,
            pending: obraPhotos.length - completedCount,
            currentPhotoId: result.photoId
          });
        }
      }
    }

    logger.photos(`[processObraPhotos] ✅ Concluído: ${successCount} sucesso, ${failedCount} falhas`);

    return { success: successCount, failed: failedCount, results };

  } catch (error) {
    logger.error('Erro ao processar fotos da obra:', error);
    return { success: 0, failed: 0, results: [] };
  }
};

/**
 * Obtém estatísticas da fila
 */
export const getQueueStats = async (): Promise<{
  total: number;
  pending: number;
  uploading: number;
  success: number;
  failed: number;
}> => {
  try {
    const queue = await getUploadQueue();
    const normalizedQueue = await normalizeQueueState(queue);

    return {
      total: normalizedQueue.length,
      pending: normalizedQueue.filter(i => i.status === 'pending').length,
      uploading: normalizedQueue.filter(i => i.status === 'uploading').length,
      success: normalizedQueue.filter(i => i.status === 'success').length,
      failed: normalizedQueue.filter(i => i.status === 'failed').length
    };
  } catch (error) {
    logger.error('Erro ao obter estatísticas da fila:', error);
    return { total: 0, pending: 0, uploading: 0, success: 0, failed: 0 };
  }
};

/**
 * Limpa itens bem-sucedidos da fila
 */
export const cleanupSuccessfulUploads = async (): Promise<number> => {
  try {
    const queue = await getUploadQueue();
    const successful = queue.filter(i => i.status === 'success');

    for (const item of successful) {
      await removeFromQueue(item.photoId);
    }

    return successful.length;
  } catch (error) {
    logger.error('Erro ao limpar uploads bem-sucedidos:', error);
    return 0;
  }
};

/**
 * Reprocessa fotos que falharam
 */
export const retryFailedUploads = async (
  onProgress?: (progress: UploadProgress) => void
): Promise<{ success: number; failed: number }> => {
  try {
    const queue = await getUploadQueue();
    const normalizedQueue = await normalizeQueueState(queue);
    const failed = normalizedQueue.filter(i => i.status === 'failed');

    if (failed.length === 0) {
      return { success: 0, failed: 0 };
    }

    const failedIds = failed.map((item) => item.photoId);
    const allMetadata = await getPhotoMetadatasByIds(failedIds);
    let successCount = 0;
    let failedCount = 0;

    for (let i = 0; i < failed.length; i++) {
      const item = failed[i];
      const photoMetadata = allMetadata.find(m => m.id === item.photoId);

      if (!photoMetadata) {
        await removeFromQueue(item.photoId);
        continue;
      }

      // Resetar status para retry
      await updateQueueItemStatus(item.photoId, 'pending');

      const result = await uploadPhotoWithRetry(photoMetadata, onProgress);

      if (result.success) {
        successCount++;
      } else {
        failedCount++;
      }
    }

    return { success: successCount, failed: failedCount };

  } catch (error) {
    logger.error('Erro ao reprocessar uploads falhados:', error);
    return { success: 0, failed: 0 };
  }
};
