import * as FileSystem from 'expo-file-system/legacy';
import * as ImageManipulator from 'expo-image-manipulator';
import AsyncStorage from '@react-native-async-storage/async-storage';
import * as utm from 'utm';

const PHOTO_BACKUP_DIR = `${FileSystem.documentDirectory}obra_photos_backup/`;
const PHOTO_METADATA_KEY = '@photo_metadata';

export interface PhotoMetadata {
  id: string;
  obraId: string;
  type: 'antes' | 'durante' | 'depois' | 'abertura' | 'fechamento' |
    'ditais_abertura' | 'ditais_impedir' | 'ditais_testar' | 'ditais_aterrar' | 'ditais_sinalizar' |
    'aterramento_vala_aberta' | 'aterramento_hastes' | 'aterramento_vala_fechada' | 'aterramento_medicao' |
    'transformador_laudo' | 'transformador_componente_instalado' | 'transformador_tombamento_instalado' |
    'transformador_tape' | 'transformador_placa_instalado' | 'transformador_instalado' |
    'transformador_antes_retirar' | 'transformador_tombamento_retirado' | 'transformador_placa_retirado' |
    'transformador_conexoes_primarias_instalado' | 'transformador_conexoes_secundarias_instalado' |
    'transformador_conexoes_primarias_retirado' | 'transformador_conexoes_secundarias_retirado' |
    'medidor_padrao' | 'medidor_leitura' | 'medidor_selo_born' | 'medidor_selo_caixa' | 'medidor_identificador_fase' |
    'checklist_croqui' | 'checklist_panoramica_inicial' | 'checklist_chede' | 'checklist_aterramento_cerca' |
    'checklist_padrao_geral' | 'checklist_padrao_interno' | 'checklist_panoramica_final' |
    'checklist_poste_inteiro' | 'checklist_poste_engaste' | 'checklist_poste_conexao1' | 'checklist_poste_conexao2' |
    'checklist_poste_maior_esforco' | 'checklist_poste_menor_esforco' |
    'checklist_seccionamento' |
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
  retries: number;
  lastRetryAt?: string;
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
    console.error('Erro ao converter para UTM:', error);
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
    console.error('Erro ao comprimir foto:', error);
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
  type: 'antes' | 'durante' | 'depois' | 'abertura' | 'fechamento' |
    'ditais_abertura' | 'ditais_impedir' | 'ditais_testar' | 'ditais_aterrar' | 'ditais_sinalizar' |
    'aterramento_vala_aberta' | 'aterramento_hastes' | 'aterramento_vala_fechada' | 'aterramento_medicao' |
    'transformador_laudo' | 'transformador_componente_instalado' | 'transformador_tombamento_instalado' |
    'transformador_tape' | 'transformador_placa_instalado' | 'transformador_instalado' |
    'transformador_antes_retirar' | 'transformador_tombamento_retirado' | 'transformador_placa_retirado' |
    'transformador_conexoes_primarias_instalado' | 'transformador_conexoes_secundarias_instalado' |
    'transformador_conexoes_primarias_retirado' | 'transformador_conexoes_secundarias_retirado' |
    'medidor_padrao' | 'medidor_leitura' | 'medidor_selo_born' | 'medidor_selo_caixa' | 'medidor_identificador_fase' |
    'checklist_croqui' | 'checklist_panoramica_inicial' | 'checklist_chede' | 'checklist_aterramento_cerca' |
    'checklist_padrao_geral' | 'checklist_padrao_interno' | 'checklist_panoramica_final' |
    'checklist_poste_inteiro' | 'checklist_poste_engaste' | 'checklist_poste_conexao1' | 'checklist_poste_conexao2' |
    'checklist_poste_maior_esforco' | 'checklist_poste_menor_esforco' |
    'checklist_seccionamento' |
    'doc_cadastro_medidor' | 'doc_laudo_transformador' | 'doc_laudo_regulador' |
    'doc_laudo_religador' | 'doc_apr' | 'doc_fvbt' | 'doc_termo_desistencia_lpt' | 'doc_autorizacao_passagem' |
    'doc_materiais_previsto' | 'doc_materiais_realizado' |
    'altimetria_lado_fonte' | 'altimetria_medicao_fonte' | 'altimetria_lado_carga' | 'altimetria_medicao_carga' |
    'vazamento_evidencia' | 'vazamento_equipamentos_limpeza' | 'vazamento_tombamento_retirado' |
    'vazamento_placa_retirado' | 'vazamento_tombamento_instalado' | 'vazamento_placa_instalado' |
    'vazamento_instalacao',
  index: number,
  latitude: number | null,
  longitude: number | null
): Promise<PhotoMetadata> => {
  try {
    await ensureBackupDirectoryExists();

    const photoId = `${obraId}_${type}_${index}_${Date.now()}`;
    const filename = `${photoId}.jpg`;
    const backupPath = `${PHOTO_BACKUP_DIR}${filename}`;
    const compressedFilename = `${photoId}_compressed.jpg`;
    const compressedPath = `${PHOTO_BACKUP_DIR}${compressedFilename}`;

    // 1. Copiar foto original para backup
    await FileSystem.copyAsync({
      from: uri,
      to: backupPath
    });

    // 2. Criar versão comprimida (ou usar original se falhar)
    let compressedUri = uri;
    try {
      compressedUri = await compressPhoto(uri);
    } catch (error) {
      console.warn('Compressão falhou, usando foto original:', error);
    }

    await FileSystem.copyAsync({
      from: compressedUri,
      to: compressedPath
    });

    // 3. Converter coordenadas para UTM
    const utmCoords = convertToUTM(latitude, longitude);

    // 4. Criar metadata
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
      retries: 0
    };

    // 5. Salvar metadata
    await savePhotoMetadata(metadata);

    return metadata;
  } catch (error) {
    console.error('Erro ao fazer backup da foto:', error);
    throw error;
  }
};

/**
 * Salva metadata de uma foto
 */
const savePhotoMetadata = async (metadata: PhotoMetadata): Promise<void> => {
  try {
    const allMetadata = await getAllPhotoMetadata();

    // Atualizar ou adicionar
    const index = allMetadata.findIndex(m => m.id === metadata.id);
    if (index !== -1) {
      allMetadata[index] = metadata;
    } else {
      allMetadata.push(metadata);
    }

    await AsyncStorage.setItem(PHOTO_METADATA_KEY, JSON.stringify(allMetadata));
  } catch (error) {
    console.error('Erro ao salvar metadata da foto:', error);
    throw error;
  }
};

/**
 * Obtém todas as metadatas de fotos
 */
export const getAllPhotoMetadata = async (): Promise<PhotoMetadata[]> => {
  try {
    const data = await AsyncStorage.getItem(PHOTO_METADATA_KEY);
    return data ? JSON.parse(data) : [];
  } catch (error) {
    console.error('Erro ao obter metadata das fotos:', error);
    return [];
  }
};

/**
 * Obtém fotos pendentes de upload
 */
export const getPendingPhotos = async (): Promise<PhotoMetadata[]> => {
  const allMetadata = await getAllPhotoMetadata();
  return allMetadata.filter(m => !m.uploaded);
};

/**
 * Obtém fotos de uma obra específica
 */
export const getPhotosByObra = async (obraId: string): Promise<PhotoMetadata[]> => {
  const allMetadata = await getAllPhotoMetadata();
  return allMetadata.filter(m => m.obraId === obraId);
};

/**
 * Marca uma foto como uploaded
 */
export const markPhotoAsUploaded = async (photoId: string, uploadUrl: string): Promise<void> => {
  try {
    const allMetadata = await getAllPhotoMetadata();
    const photo = allMetadata.find(m => m.id === photoId);

    if (photo) {
      photo.uploaded = true;
      photo.uploadUrl = uploadUrl;
      await AsyncStorage.setItem(PHOTO_METADATA_KEY, JSON.stringify(allMetadata));
    }
  } catch (error) {
    console.error('Erro ao marcar foto como uploaded:', error);
    throw error;
  }
};

/**
 * Atualiza o obraId de todas as fotos associadas a uma obra
 * Útil quando uma obra offline é sincronizada e recebe um novo ID do servidor
 */
export const updatePhotosObraId = async (oldObraId: string, newObraId: string): Promise<number> => {
  try {
    const allMetadata = await getAllPhotoMetadata();
    let updatedCount = 0;

    const updatedMetadata = allMetadata.map(photo => {
      if (photo.obraId === oldObraId) {
        updatedCount++;
        return { ...photo, obraId: newObraId };
      }
      return photo;
    });

    await AsyncStorage.setItem(PHOTO_METADATA_KEY, JSON.stringify(updatedMetadata));
    return updatedCount;
  } catch (error) {
    console.error('Erro ao atualizar obraId das fotos:', error);
    throw error;
  }
};

/**
 * Incrementa contador de retries de uma foto
 */
export const incrementPhotoRetries = async (photoId: string): Promise<void> => {
  try {
    const allMetadata = await getAllPhotoMetadata();
    const photo = allMetadata.find(m => m.id === photoId);

    if (photo) {
      photo.retries++;
      photo.lastRetryAt = new Date().toISOString();
      await AsyncStorage.setItem(PHOTO_METADATA_KEY, JSON.stringify(allMetadata));
    }
  } catch (error) {
    console.error('Erro ao incrementar retries:', error);
    throw error;
  }
};

/**
 * Deleta backup de uma foto após upload bem-sucedido
 */
export const deletePhotoBackup = async (photoId: string): Promise<void> => {
  try {
    const allMetadata = await getAllPhotoMetadata();
    const photo = allMetadata.find(m => m.id === photoId);

    if (photo) {
      // Deletar arquivos físicos
      const backupInfo = await FileSystem.getInfoAsync(photo.backupPath);
      if (backupInfo.exists) {
        await FileSystem.deleteAsync(photo.backupPath);
      }

      const compressedInfo = await FileSystem.getInfoAsync(photo.compressedPath);
      if (compressedInfo.exists) {
        await FileSystem.deleteAsync(photo.compressedPath);
      }

      // Remover metadata
      const updatedMetadata = allMetadata.filter(m => m.id !== photoId);
      await AsyncStorage.setItem(PHOTO_METADATA_KEY, JSON.stringify(updatedMetadata));
    }
  } catch (error) {
    console.error('Erro ao deletar backup da foto:', error);
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
    console.error('Erro ao limpar fotos uploadadas:', error);
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
    console.error('Erro ao obter estatísticas:', error);
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

    const info = await FileSystem.getInfoAsync(photo.compressedPath);
    return info.exists;
  } catch (error) {
    console.error('Erro ao verificar existência da foto:', error);
    return false;
  }
};
