import AsyncStorage from '@react-native-async-storage/async-storage';
import { supabase } from './supabase';
import {
  PhotoMetadata,
  getAllPhotoMetadata,
  getPendingPhotos,
  markPhotoAsUploaded,
  incrementPhotoRetries,
  deletePhotoBackup,
  photoExists
} from './photo-backup';
import * as FileSystem from 'expo-file-system/legacy';
// import { captureError, addBreadcrumb, startTransaction } from './sentry';

const UPLOAD_QUEUE_KEY = '@photo_upload_queue';
const MAX_RETRIES = 3; // Reduzido de 5 para 3
const RETRY_DELAYS = [1000, 3000, 5000]; // Reduzido: 1s, 3s, 5s (total 9s)

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
    await AsyncStorage.setItem(UPLOAD_QUEUE_KEY, JSON.stringify(queue));
  } catch (error) {
    console.error('Erro ao adicionar foto à fila:', error);
    throw error;
  }
};

/**
 * Obtém a fila de upload
 */
export const getUploadQueue = async (): Promise<UploadQueueItem[]> => {
  try {
    const data = await AsyncStorage.getItem(UPLOAD_QUEUE_KEY);
    return data ? JSON.parse(data) : [];
  } catch (error) {
    console.error('Erro ao obter fila de upload:', error);
    return [];
  }
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

      await AsyncStorage.setItem(UPLOAD_QUEUE_KEY, JSON.stringify(queue));
    }
  } catch (error) {
    console.error('Erro ao atualizar status na fila:', error);
  }
};

/**
 * Remove item da fila após upload bem-sucedido
 */
const removeFromQueue = async (photoId: string): Promise<void> => {
  try {
    const queue = await getUploadQueue();
    const filtered = queue.filter(item => item.photoId !== photoId);
    await AsyncStorage.setItem(UPLOAD_QUEUE_KEY, JSON.stringify(filtered));
  } catch (error) {
    console.error('Erro ao remover da fila:', error);
  }
};

/**
 * Faz upload de uma foto para o Supabase Storage
 */
const uploadPhotoToSupabase = async (
  photoMetadata: PhotoMetadata
): Promise<{ success: boolean; url?: string; error?: string }> => {
  try {
    // Login por equipe - usar obraId como pasta ao invés de user.id
    const folderName = photoMetadata.obraId || 'temp';

    // Verificar se foto existe
    const exists = await photoExists(photoMetadata.id);
    if (!exists) {
      console.error(`❌ Foto ${photoMetadata.id} não existe no photo-backup`);
      return { success: false, error: 'Foto não encontrada no photo-backup', skipRetry: true };
    }

    // ✅ Usar foto comprimida para upload, com fallback para backup original
    let photoUri = photoMetadata.compressedPath;

    // Criar nome único do arquivo com timestamp e random ID para evitar conflitos
    const timestamp = Date.now();
    const randomId = Math.random().toString(36).substr(2, 9);
    const fileName = `${photoMetadata.type}_${timestamp}_${randomId}_${photoMetadata.index}.jpg`;
    // Usar obraId como pasta para organizar as fotos
    const filePath = `${folderName}/${fileName}`;

    // ✅ Verificar se arquivo comprimido existe
    let fileInfo = await FileSystem.getInfoAsync(photoUri);
    if (!fileInfo.exists) {
      console.warn(`⚠️ Arquivo comprimido não encontrado: ${photoUri}`);
      console.log(`   Tentando usar backup original: ${photoMetadata.backupPath}`);

      // ✅ FALLBACK: Tentar usar o backup original (não comprimido)
      photoUri = photoMetadata.backupPath;
      fileInfo = await FileSystem.getInfoAsync(photoUri);

      if (!fileInfo.exists) {
        console.error(`❌ Arquivo físico não encontrado (backup também): ${photoUri}`);
        console.error(`   Foto ID: ${photoMetadata.id}`);
        console.error(`   Tipo: ${photoMetadata.type}`);
        return { success: false, error: 'Arquivo físico não encontrado (comprimido e backup)', skipRetry: true };
      }

      console.log(`✅ Usando backup original: ${Math.round((fileInfo.size || 0) / 1024)}KB`);
    }

    console.log(`📤 Lendo arquivo (${Math.round((fileInfo.size || 0) / 1024)}KB):`, photoUri);

    // Ler arquivo como base64 para upload
    const base64 = await FileSystem.readAsStringAsync(photoUri, {
      encoding: FileSystem.EncodingType.Base64,
    });

    console.log(`📤 Base64 lido, tamanho: ${Math.round(base64.length / 1024)}KB`);

    // Decodificar base64 para bytes sem usar atob (não disponível em RN)
    const base64ToBytes = (base64String: string): Uint8Array => {
      // Tabela de decodificação base64
      const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/';
      const lookup = new Uint8Array(256);
      for (let i = 0; i < chars.length; i++) {
        lookup[chars.charCodeAt(i)] = i;
      }

      const len = base64String.length;
      const bytes = new Uint8Array((len * 3) / 4);
      let p = 0;

      for (let i = 0; i < len; i += 4) {
        const encoded1 = lookup[base64String.charCodeAt(i)];
        const encoded2 = lookup[base64String.charCodeAt(i + 1)];
        const encoded3 = lookup[base64String.charCodeAt(i + 2)];
        const encoded4 = lookup[base64String.charCodeAt(i + 3)];

        bytes[p++] = (encoded1 << 2) | (encoded2 >> 4);
        bytes[p++] = ((encoded2 & 15) << 4) | (encoded3 >> 2);
        bytes[p++] = ((encoded3 & 3) << 6) | (encoded4 & 63);
      }

      return bytes;
    };

    const fileBytes = base64ToBytes(base64);

    console.log(`📤 Enviando para Supabase: ${filePath}`);

    // Upload do arquivo
    const { data, error } = await supabase.storage
      .from('obra-photos')
      .upload(filePath, fileBytes.buffer, {
        contentType: 'image/jpeg',
        upsert: false
      });

    if (error) {
      console.error(`❌ Erro no upload para ${filePath}:`, {
        message: error.message,
        statusCode: (error as any).statusCode,
        details: (error as any).details
      });
      return { success: false, error: `Upload falhou: ${error.message}` };
    }

    console.log(`✅ Upload bem-sucedido: ${filePath}`);

    // Obter URL pública
    const supabaseUrl = 'https://hiuagpzaelcocyxutgdt.supabase.co';
    const publicUrl = `${supabaseUrl}/storage/v1/object/public/obra-photos/${filePath}`;

    return { success: true, url: publicUrl };

  } catch (error: any) {
    console.error('Erro ao fazer upload da foto:', error);

    // 🔍 Capturar erro no Sentry
    captureError(error, {
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

    return { success: false, error: error.message || 'Erro desconhecido' };
  }
};

/**
 * Processa upload de uma foto com retry
 */
const uploadPhotoWithRetry = async (
  photoMetadata: PhotoMetadata,
  onProgress?: (progress: UploadProgress) => void
): Promise<UploadResult> => {
  let retries = 0;

  while (retries <= MAX_RETRIES) {
    // Atualizar status
    await updateQueueItemStatus(photoMetadata.id, 'uploading');

    // Tentar upload
    const result = await uploadPhotoToSupabase(photoMetadata);

    // Log detalhado do resultado
    if (!result.success) {
      console.error(`❌ Upload falhou (tentativa ${retries + 1}/${MAX_RETRIES + 1}):`, result.error);
    }

    if (result.success && result.url) {
      // Sucesso!
      await markPhotoAsUploaded(photoMetadata.id, result.url);
      await updateQueueItemStatus(photoMetadata.id, 'success');
      await removeFromQueue(photoMetadata.id);

      // Deletar backup após confirmação
      setTimeout(() => deletePhotoBackup(photoMetadata.id), 5000);

      return {
        photoId: photoMetadata.id,
        success: true,
        url: result.url
      };
    }

    // ⚠️ Se erro não deve fazer retry (arquivo não encontrado), parar imediatamente
    if ((result as any).skipRetry) {
      console.warn(`⚠️ Pulando retry para foto ${photoMetadata.id}: ${result.error}`);
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
    console.log(`Retry ${retries}/${MAX_RETRIES} para foto ${photoMetadata.id} em ${delay}ms`);
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
    const pendingPhotos = await getPendingPhotos();

    if (pendingPhotos.length === 0) {
      return { success: 0, failed: 0, results: [] };
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
    console.error('Erro ao processar fila de upload:', error);
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
    const allPending = await getPendingPhotos();
    const uniquePhotoIds = photoIds && photoIds.length > 0 ? Array.from(new Set(photoIds)) : null;
    const obraPhotos = uniquePhotoIds
      ? allPending.filter(p => uniquePhotoIds.includes(p.id))
      : allPending.filter(p => p.obraId === obraId);

    if (obraPhotos.length === 0) {
      return { success: 0, failed: 0, results: [] };
    }

    console.log(`[processObraPhotos] Iniciando upload paralelo de ${obraPhotos.length} foto(s)`);

    // Adicionar todas à fila primeiro
    for (const photo of obraPhotos) {
      await addToUploadQueue(photo.id, photo.obraId);
    }

    const results: UploadResult[] = [];
    let successCount = 0;
    let failedCount = 0;
    let completedCount = 0;

    // ✅ Upload paralelo: processar em lotes de 2 fotos simultaneamente
    // Reduzido de 3 para 2 para evitar pressão de memória em dispositivos com menos RAM
    const BATCH_SIZE = 2;
    for (let i = 0; i < obraPhotos.length; i += BATCH_SIZE) {
      const batch = obraPhotos.slice(i, i + BATCH_SIZE);

      console.log(`[processObraPhotos] Processando lote ${Math.floor(i/BATCH_SIZE) + 1}/${Math.ceil(obraPhotos.length/BATCH_SIZE)} (${batch.length} fotos)`);

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

    console.log(`[processObraPhotos] ✅ Concluído: ${successCount} sucesso, ${failedCount} falhas`);

    return { success: successCount, failed: failedCount, results };

  } catch (error) {
    console.error('Erro ao processar fotos da obra:', error);
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

    return {
      total: queue.length,
      pending: queue.filter(i => i.status === 'pending').length,
      uploading: queue.filter(i => i.status === 'uploading').length,
      success: queue.filter(i => i.status === 'success').length,
      failed: queue.filter(i => i.status === 'failed').length
    };
  } catch (error) {
    console.error('Erro ao obter estatísticas da fila:', error);
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
    console.error('Erro ao limpar uploads bem-sucedidos:', error);
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
    const failed = queue.filter(i => i.status === 'failed');

    if (failed.length === 0) {
      return { success: 0, failed: 0 };
    }

    const allMetadata = await getAllPhotoMetadata();
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
    console.error('Erro ao reprocessar uploads falhados:', error);
    return { success: 0, failed: 0 };
  }
};
