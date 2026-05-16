/**
 * Sistema de Backup de Emergência
 *
 * Cria backups completos de obras quando sincronização falha repetidamente.
 * As fotos e dados são salvos em uma pasta permanente que não é apagada pelo sistema.
 */

import * as FileSystem from 'expo-file-system/legacy';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { getAllPhotoMetadata, type PhotoMetadata } from './photo-backup';
import { captureError, addBreadcrumb } from './sentry';

// Pasta de backups de emergência (permanente, não é limpa pelo sistema)
const EMERGENCY_BACKUP_DIR = `${FileSystem.documentDirectory}emergency_backups/`;
const EMERGENCY_BACKUP_INDEX_KEY = '@emergency_backup_index';

export interface EmergencyBackup {
  id: string;
  obraNumero: string;
  obraId: string;
  createdAt: string;
  folderPath: string;
  totalPhotos: number;
  dataFile: string;
  reason: 'sync_failed' | 'manual' | 'crash_detected';
  syncAttempts?: number;
}

/**
 * Garante que a pasta de backups de emergência existe
 */
const ensureEmergencyBackupDirExists = async (): Promise<void> => {
  try {
    const dirInfo = await FileSystem.getInfoAsync(EMERGENCY_BACKUP_DIR);
    if (!dirInfo.exists) {
      await FileSystem.makeDirectoryAsync(EMERGENCY_BACKUP_DIR, { intermediates: true });
      console.log('✅ Pasta de backups de emergência criada:', EMERGENCY_BACKUP_DIR);
    }
  } catch (error) {
    console.error('❌ Erro ao criar pasta de backups de emergência:', error);
    throw error;
  }
};

/**
 * Cria backup de emergência de uma obra
 */
export const createEmergencyBackup = async (
  obraId: string,
  obraData: any,
  reason: 'sync_failed' | 'manual' | 'crash_detected' = 'sync_failed'
): Promise<EmergencyBackup> => {
  try {
    console.log(`🚨 Criando backup de emergência para obra ${obraId}...`);

    addBreadcrumb('Iniciando backup de emergência', 'storage', {
      obraId,
      reason,
    });

    await ensureEmergencyBackupDirExists();

    // Criar ID único para este backup
    const backupId = `backup_${obraId}_${Date.now()}`;
    const backupFolder = `${EMERGENCY_BACKUP_DIR}${backupId}/`;
    const photosFolder = `${backupFolder}fotos/`;

    // Criar pastas do backup
    await FileSystem.makeDirectoryAsync(backupFolder, { intermediates: true });
    await FileSystem.makeDirectoryAsync(photosFolder, { intermediates: true });

    // 1. Buscar todas as fotos da obra
    const allPhotos = await getAllPhotoMetadata();
    const obraPhotos = allPhotos.filter(p => p.obraId === obraId);

    console.log(`📸 Copiando ${obraPhotos.length} fotos para backup de emergência...`);

    let copiedPhotos = 0;
    const photoManifest: Record<string, string> = {};

    // 2. Copiar cada foto para o backup
    for (const photo of obraPhotos) {
      try {
        // Verificar qual arquivo usar (comprimido ou backup original)
        let sourceFile = photo.compressedPath;
        let sourceInfo = await FileSystem.getInfoAsync(sourceFile);

        if (!sourceInfo.exists) {
          sourceFile = photo.backupPath;
          sourceInfo = await FileSystem.getInfoAsync(sourceFile);
        }

        if (!sourceInfo.exists) {
          console.warn(`⚠️ Foto ${photo.id} não encontrada, pulando...`);
          continue;
        }

        // Nome do arquivo no backup: tipo_index_timestamp.jpg
        const fileName = `${photo.type}_${photo.index}_${photo.timestamp.replace(/[:.]/g, '-')}.jpg`;
        const destPath = `${photosFolder}${fileName}`;

        // Copiar foto
        await FileSystem.copyAsync({
          from: sourceFile,
          to: destPath,
        });

        photoManifest[photo.id] = fileName;
        copiedPhotos++;

      } catch (error) {
        console.error(`❌ Erro ao copiar foto ${photo.id}:`, error);
        // Continuar mesmo se uma foto falhar
      }
    }

    console.log(`✅ ${copiedPhotos}/${obraPhotos.length} fotos copiadas`);

    // 3. Criar arquivo JSON com dados da obra
    const backupData = {
      backupId,
      createdAt: new Date().toISOString(),
      reason,
      obra: {
        ...obraData,
        id: obraId,
      },
      photos: obraPhotos.map(p => ({
        id: p.id,
        type: p.type,
        index: p.index,
        timestamp: p.timestamp,
        latitude: p.latitude,
        longitude: p.longitude,
        utmX: p.utmX,
        utmY: p.utmY,
        utmZone: p.utmZone,
        fileName: photoManifest[p.id] || null,
        uploaded: p.uploaded,
      })),
      totalPhotos: copiedPhotos,
      photosFailed: obraPhotos.length - copiedPhotos,
    };

    const dataFilePath = `${backupFolder}obra_data.json`;
    await FileSystem.writeAsStringAsync(
      dataFilePath,
      JSON.stringify(backupData, null, 2)
    );

    // 4. Criar arquivo README.txt com instruções
    const readmePath = `${backupFolder}README.txt`;
    const readmeContent = `
BACKUP DE EMERGÊNCIA - OBRA ${obraData.obra || 'N/A'}
=========================================

Data de criação: ${new Date().toISOString()}
Motivo: ${reason === 'sync_failed' ? 'Falha na sincronização' : reason}
Total de fotos: ${copiedPhotos}

IMPORTANTE:
- Este backup foi criado automaticamente pelo app
- As fotos estão na pasta "fotos/"
- Os dados estão em "obra_data.json"
- NÃO APAGUE esta pasta manualmente
- Entre em contato com o suporte se precisar recuperar estes dados

Localização: ${backupFolder}
    `.trim();

    await FileSystem.writeAsStringAsync(readmePath, readmeContent);

    // 5. Registrar backup no índice
    const backup: EmergencyBackup = {
      id: backupId,
      obraNumero: obraData.obra || 'N/A',
      obraId,
      createdAt: new Date().toISOString(),
      folderPath: backupFolder,
      totalPhotos: copiedPhotos,
      dataFile: dataFilePath,
      reason,
      syncAttempts: obraData.sync_attempts || 0,
    };

    await addBackupToIndex(backup);

    console.log(`✅ Backup de emergência criado: ${backupId}`);
    console.log(`   Pasta: ${backupFolder}`);
    console.log(`   Fotos: ${copiedPhotos}`);

    addBreadcrumb('Backup de emergência criado', 'storage', {
      backupId,
      totalPhotos: copiedPhotos,
    });

    return backup;

  } catch (error) {
    console.error('❌ Erro ao criar backup de emergência:', error);

    captureError(error as Error, {
      type: 'storage',
      obraId,
      metadata: {
        operation: 'createEmergencyBackup',
        reason,
      },
    });

    throw error;
  }
};

/**
 * Adiciona backup ao índice
 */
const addBackupToIndex = async (backup: EmergencyBackup): Promise<void> => {
  try {
    const existingIndex = await AsyncStorage.getItem(EMERGENCY_BACKUP_INDEX_KEY);
    const backups: EmergencyBackup[] = existingIndex ? JSON.parse(existingIndex) : [];

    backups.push(backup);

    await AsyncStorage.setItem(EMERGENCY_BACKUP_INDEX_KEY, JSON.stringify(backups));
  } catch (error) {
    console.error('❌ Erro ao adicionar backup ao índice:', error);
  }
};

/**
 * Lista todos os backups de emergência
 */
export const getAllEmergencyBackups = async (): Promise<EmergencyBackup[]> => {
  try {
    const indexData = await AsyncStorage.getItem(EMERGENCY_BACKUP_INDEX_KEY);
    return indexData ? JSON.parse(indexData) : [];
  } catch (error) {
    console.error('❌ Erro ao listar backups:', error);
    return [];
  }
};

/**
 * Obtém backup específico
 */
export const getEmergencyBackup = async (backupId: string): Promise<EmergencyBackup | null> => {
  try {
    const backups = await getAllEmergencyBackups();
    return backups.find(b => b.id === backupId) || null;
  } catch (error) {
    console.error('❌ Erro ao buscar backup:', error);
    return null;
  }
};

/**
 * Remove backup de emergência
 */
export const deleteEmergencyBackup = async (backupId: string): Promise<boolean> => {
  try {
    const backup = await getEmergencyBackup(backupId);

    if (!backup) {
      console.warn(`⚠️ Backup ${backupId} não encontrado`);
      return false;
    }

    // Deletar pasta do backup
    const dirInfo = await FileSystem.getInfoAsync(backup.folderPath);
    if (dirInfo.exists) {
      await FileSystem.deleteAsync(backup.folderPath, { idempotent: true });
    }

    // Remover do índice
    const backups = await getAllEmergencyBackups();
    const updatedBackups = backups.filter(b => b.id !== backupId);
    await AsyncStorage.setItem(EMERGENCY_BACKUP_INDEX_KEY, JSON.stringify(updatedBackups));

    console.log(`✅ Backup ${backupId} removido`);
    return true;

  } catch (error) {
    console.error('❌ Erro ao deletar backup:', error);
    return false;
  }
};

/**
 * Limpa backups antigos (mantém apenas os últimos 10)
 */
export const cleanupOldBackups = async (maxBackups: number = 10): Promise<number> => {
  try {
    const backups = await getAllEmergencyBackups();

    if (backups.length <= maxBackups) {
      return 0;
    }

    // Ordenar por data (mais antigos primeiro)
    backups.sort((a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime());

    // Remover backups mais antigos
    const toDelete = backups.slice(0, backups.length - maxBackups);

    let deleted = 0;
    for (const backup of toDelete) {
      const success = await deleteEmergencyBackup(backup.id);
      if (success) deleted++;
    }

    console.log(`🧹 ${deleted} backup(s) antigo(s) removido(s)`);
    return deleted;

  } catch (error) {
    console.error('❌ Erro ao limpar backups antigos:', error);
    return 0;
  }
};

/**
 * Calcula tamanho total dos backups
 */
export const getBackupsStorageSize = async (): Promise<number> => {
  try {
    const dirInfo = await FileSystem.getInfoAsync(EMERGENCY_BACKUP_DIR);

    if (!dirInfo.exists) {
      return 0;
    }

    // Aproximação: contar arquivos
    const backups = await getAllEmergencyBackups();
    const totalPhotos = backups.reduce((sum, b) => sum + b.totalPhotos, 0);

    // Estimativa: ~200KB por foto comprimida
    return totalPhotos * 200 * 1024;

  } catch (error) {
    console.error('❌ Erro ao calcular tamanho dos backups:', error);
    return 0;
  }
};

/**
 * Verifica se obra deve criar backup de emergência
 * (baseado em número de tentativas de sync falhadas)
 */
export const shouldCreateEmergencyBackup = (syncAttempts: number): boolean => {
  // Criar backup após 3 tentativas falhadas
  return syncAttempts >= 3;
};
