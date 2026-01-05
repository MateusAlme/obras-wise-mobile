import * as MediaLibrary from 'expo-media-library';
import * as FileSystem from 'expo-file-system';
import { Platform, Alert } from 'react-native';

/**
 * Solicita permissão para salvar fotos na galeria
 * Retorna true se a permissão for concedida
 */
export async function requestGalleryPermission(): Promise<boolean> {
  try {
    const { status } = await MediaLibrary.requestPermissionsAsync();
    return status === 'granted';
  } catch (error) {
    console.error('Erro ao solicitar permissão da galeria:', error);
    return false;
  }
}

/**
 * Salva uma foto na galeria do dispositivo
 * @param photoUri - URI da foto a ser salva
 * @param albumName - Nome do álbum onde salvar (opcional, padrão: 'Obras Teccel')
 * @returns true se a foto foi salva com sucesso
 */
export async function savePhotoToGallery(
  photoUri: string,
  albumName: string = 'Obras Teccel'
): Promise<boolean> {
  try {
    // Verificar permissão
    const hasPermission = await requestGalleryPermission();
    if (!hasPermission) {
      console.warn('Permissão para salvar na galeria não concedida');
      return false;
    }

    // Criar asset na galeria
    const asset = await MediaLibrary.createAssetAsync(photoUri);

    // Tentar criar/buscar álbum e adicionar a foto
    try {
      const album = await MediaLibrary.getAlbumAsync(albumName);
      if (album) {
        await MediaLibrary.addAssetsToAlbumAsync([asset], album, false);
      } else {
        await MediaLibrary.createAlbumAsync(albumName, asset, false);
      }
    } catch (albumError) {
      // Se falhar ao criar álbum, a foto ainda foi salva na galeria principal
      console.warn('Foto salva na galeria, mas não foi possível criar álbum:', albumError);
    }

    return true;
  } catch (error) {
    console.error('Erro ao salvar foto na galeria:', error);
    return false;
  }
}

/**
 * Salva uma foto renderizada (com placa queimada) na galeria
 * @param renderedUri - URI da foto já renderizada com placa
 * @param albumName - Nome do álbum onde salvar
 */
export async function saveRenderedPhotoToGallery(
  renderedUri: string,
  albumName: string = 'Obras Teccel'
): Promise<boolean> {
  try {
    // A foto renderizada já está salva no cache do FileSystem
    // Podemos salvá-la diretamente na galeria
    return await savePhotoToGallery(renderedUri, albumName);
  } catch (error) {
    console.error('Erro ao salvar foto renderizada na galeria:', error);
    return false;
  }
}

/**
 * Salva múltiplas fotos na galeria em batch
 * @param photoUris - Array de URIs das fotos
 * @param albumName - Nome do álbum
 * @returns Número de fotos salvas com sucesso
 */
export async function saveMultiplePhotosToGallery(
  photoUris: string[],
  albumName: string = 'Obras Teccel'
): Promise<number> {
  let successCount = 0;

  for (const uri of photoUris) {
    const success = await savePhotoToGallery(uri, albumName);
    if (success) {
      successCount++;
    }
  }

  return successCount;
}

/**
 * Verifica se o app tem permissão para salvar na galeria
 */
export async function hasGalleryPermission(): Promise<boolean> {
  try {
    const { status } = await MediaLibrary.getPermissionsAsync();
    return status === 'granted';
  } catch (error) {
    return false;
  }
}
