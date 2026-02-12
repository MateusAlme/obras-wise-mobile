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
    'transformador_antes_retirar' | 'transformador_laudo_retirado' | 'transformador_tombamento_retirado' | 'transformador_placa_retirado' |
    'transformador_conexoes_primarias_instalado' | 'transformador_conexoes_secundarias_instalado' |
    'transformador_conexoes_primarias_retirado' | 'transformador_conexoes_secundarias_retirado' |
    'medidor_padrao' | 'medidor_leitura' | 'medidor_selo_born' | 'medidor_selo_caixa' | 'medidor_identificador_fase' |
    'checklist_croqui' | 'checklist_panoramica_inicial' | 'checklist_chede' | 'checklist_aterramento_cerca' |
    'checklist_padrao_geral' | 'checklist_padrao_interno' | 'checklist_frying' | 'checklist_abertura_fechamento_pulo' |
    'checklist_ponto_haste' | 'checklist_ponto_termometro' | 'checklist_panoramica_final' |
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
  supabaseUrl?: string; // URL pública após upload para o Supabase
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
    'transformador_antes_retirar' | 'transformador_laudo_retirado' | 'transformador_tombamento_retirado' | 'transformador_placa_retirado' |
    'transformador_conexoes_primarias_instalado' | 'transformador_conexoes_secundarias_instalado' |
    'transformador_conexoes_primarias_retirado' | 'transformador_conexoes_secundarias_retirado' |
    'medidor_padrao' | 'medidor_leitura' | 'medidor_selo_born' | 'medidor_selo_caixa' | 'medidor_identificador_fase' |
    'checklist_croqui' | 'checklist_panoramica_inicial' | 'checklist_chede' | 'checklist_aterramento_cerca' |
    'checklist_padrao_geral' | 'checklist_padrao_interno' | 'checklist_frying' | 'checklist_abertura_fechamento_pulo' |
    'checklist_ponto_haste' | 'checklist_ponto_termometro' | 'checklist_panoramica_final' |
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
 * ✅ CORREÇÃO: Inclui fotos "zombie" (uploaded=true mas sem URL válida)
 * Essas fotos ocorrem quando um upload falhou mas foi marcado como uploaded
 */
export const getPendingPhotos = async (): Promise<PhotoMetadata[]> => {
  const allMetadata = await getAllPhotoMetadata();
  return allMetadata.filter(m => {
    // Foto nunca foi uploaded
    if (!m.uploaded) return true;
    // ✅ Foto "zombie": marcada como uploaded mas sem URL válida
    // Isso acontece quando upload falhou e a foto precisa ser re-tentada
    if (m.uploaded && (!m.uploadUrl || m.uploadUrl === '')) {
      console.log(`🔄 Foto zombie encontrada: ${m.id} - será re-tentada`);
      return true;
    }
    return false;
  });
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
  const zombies = await getZombiePhotos(obraId);
  let count = 0;

  for (const zombie of zombies) {
    try {
      // Resetar o status de uploaded para false
      const allMetadata = await getAllPhotoMetadata();
      const updated = allMetadata.map(m => {
        if (m.id === zombie.id) {
          return { ...m, uploaded: false, uploadUrl: undefined, retries: 0 };
        }
        return m;
      });
      await AsyncStorage.setItem(PHOTO_METADATA_KEY, JSON.stringify(updated));
      count++;
      console.log(`✅ Foto zombie resetada: ${zombie.id}`);
    } catch (error) {
      console.error(`❌ Erro ao resetar foto zombie ${zombie.id}:`, error);
    }
  }

  return count;
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
  console.log(`🔍 [getPhotosByObraWithFallback] Total de ${allMetadata.length} foto(s) no storage`);
  console.log(`🔍 [getPhotosByObraWithFallback] ObraIds únicos no storage: ${uniqueObraIds.join(', ')}`);

  // ✅ Coletar todos os possíveis obraIds desde o início
  const allPossibleObraIds = new Set<string>([obraId]);
  if (serverId) {
    allPossibleObraIds.add(serverId);
  }

  // Extrair obraIds dos IDs das fotos
  if (photoIdsInObra && photoIdsInObra.length > 0) {
    console.log(`🔍 [getPhotosByObraWithFallback] PhotoIds na obra: ${photoIdsInObra.join(', ')}`);
    for (const photoId of photoIdsInObra) {
      // Formato: obraId_tipo_index_timestamp
      const match = photoId.match(/^(.+?)_(antes|durante|depois|abertura|fechamento|ditais_|aterramento_|transformador_|medidor_|checklist_|altimetria_|vazamento_|doc_)/);
      if (match && match[1]) {
        allPossibleObraIds.add(match[1]);
      }
    }
  }

  console.log(`🔍 [getPhotosByObraWithFallback] Buscando por obraIds: ${Array.from(allPossibleObraIds).join(', ')}`);

  // Buscar fotos por qualquer um dos possíveis obraIds
  let photos = allMetadata.filter(m => allPossibleObraIds.has(m.obraId));
  console.log(`🔍 [getPhotosByObraWithFallback] Encontradas ${photos.length} foto(s) por obraId`);

  // Se não encontrou e temos IDs específicos, buscar diretamente pelos IDs
  if (photos.length === 0 && photoIdsInObra && photoIdsInObra.length > 0) {
    console.log(`🔍 [getPhotosByObraWithFallback] Buscando diretamente pelos IDs das fotos...`);
    const stringPhotoIds = photoIdsInObra.filter(id => typeof id === 'string');
    photos = allMetadata.filter(m => stringPhotoIds.includes(m.id));

    if (photos.length > 0) {
      console.log(`✅ [getPhotosByObraWithFallback] Encontrou ${photos.length} foto(s) diretamente pelos IDs`);
    }
  } else if (photos.length < (photoIdsInObra?.length || 0)) {
    // Há menos fotos do que esperado - tentar buscar as faltantes pelos IDs
    console.log(`⚠️ [getPhotosByObraWithFallback] Encontrou ${photos.length} mas esperava ${photoIdsInObra?.length || 0}. Buscando faltantes pelos IDs...`);
    const foundIds = new Set(photos.map(p => p.id));
    const missingIds = (photoIdsInObra || []).filter(id => !foundIds.has(id));
    console.log(`🔍 [getPhotosByObraWithFallback] IDs faltantes: ${missingIds.join(', ')}`);
    
    const missingPhotos = allMetadata.filter(m => missingIds.includes(m.id));
    if (missingPhotos.length > 0) {
      console.log(`✅ [getPhotosByObraWithFallback] Encontrou ${missingPhotos.length} foto(s) faltantes pelos IDs`);
      photos = [...photos, ...missingPhotos];
    }
  }

  if (photos.length > 0) {
    console.log(`✅ [getPhotosByObraWithFallback] Total: ${photos.length} foto(s) encontradas`);
    // Mostrar IDs das fotos encontradas
    console.log(`📸 [getPhotosByObraWithFallback] IDs encontrados: ${photos.map(p => p.id).join(', ')}`);
  }

  return photos;
};

/**
 * Obtém metadatas de fotos a partir dos IDs
 */
export const getPhotoMetadatasByIds = async (photoIds: string[]): Promise<PhotoMetadata[]> => {
  const allMetadata = await getAllPhotoMetadata();
  return allMetadata.filter(p => photoIds.includes(p.id));
};

/**
 * Marca uma foto como uploaded e salva a URL do Supabase
 */
export const markPhotoAsUploaded = async (photoId: string, uploadUrl: string): Promise<void> => {
  try {
    const allMetadata = await getAllPhotoMetadata();
    const photo = allMetadata.find(m => m.id === photoId);

    if (photo) {
      photo.uploaded = true;
      photo.uploadUrl = uploadUrl;
      photo.supabaseUrl = uploadUrl; // ✅ Salvar em ambos os campos para compatibilidade
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
 * Também atualiza fotos cujo ID começa com o oldObraId (para cobrir casos de IDs compostos)
 */
export const updatePhotosObraId = async (oldObraId: string, newObraId: string): Promise<number> => {
  try {
    const allMetadata = await getAllPhotoMetadata();
    let updatedCount = 0;

    const updatedMetadata = allMetadata.map(photo => {
      // Atualizar se obraId bate exatamente
      if (photo.obraId === oldObraId) {
        updatedCount++;
        return { ...photo, obraId: newObraId };
      }
      // ✅ Também atualizar se o ID da foto começa com o oldObraId
      // Isso cobre casos onde fotos foram salvas com IDs compostos
      if (photo.id.startsWith(oldObraId + '_')) {
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
      console.log(`✅ [deletePhotoBackup] Arquivos físicos removidos, metadados mantidos para: ${photoId}`);
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
