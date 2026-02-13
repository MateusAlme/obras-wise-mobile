/**
 * Sistema de Monitoramento de Memória e Proteção contra Crashes
 *
 * Ajuda a prevenir crashes por falta de memória em dispositivos Android mais antigos
 */

import { Platform } from 'react-native';
import * as FileSystem from 'expo-file-system/legacy';
import AsyncStorage from '@react-native-async-storage/async-storage';

const MEMORY_CHECK_KEY = '@memory_monitor';

export interface MemoryInfo {
  timestamp: number;
  platform: string;
  platformVersion: string;
  storageUsed?: number;
  storageFree?: number;
  asyncStorageSize?: number;
}

/**
 * Coleta informações sobre uso de memória e storage
 */
export const getMemoryInfo = async (): Promise<MemoryInfo> => {
  const info: MemoryInfo = {
    timestamp: Date.now(),
    platform: Platform.OS,
    platformVersion: Platform.Version.toString(),
  };

  try {
    // Verificar espaço em disco (FileSystem)
    if (FileSystem.documentDirectory) {
      const diskInfo = await FileSystem.getFreeDiskStorageAsync();
      info.storageFree = diskInfo;
    }

    // Estimar tamanho do AsyncStorage
    const keys = await AsyncStorage.getAllKeys();
    let totalSize = 0;

    for (const key of keys) {
      const value = await AsyncStorage.getItem(key);
      if (value) {
        totalSize += value.length;
      }
    }

    info.asyncStorageSize = totalSize;

  } catch (error) {
    console.error('Erro ao coletar informações de memória:', error);
  }

  return info;
};

/**
 * Verifica se há espaço suficiente disponível
 */
export const hasEnoughStorage = async (requiredBytes: number = 100 * 1024 * 1024): Promise<boolean> => {
  try {
    const diskInfo = await FileSystem.getFreeDiskStorageAsync();
    return diskInfo > requiredBytes;
  } catch {
    return true; // Assumir que há espaço se não conseguir verificar
  }
};

/**
 * Limpa cache de fotos antigas para liberar espaço
 */
export const clearOldPhotoCache = async (daysOld: number = 30): Promise<number> => {
  try {
    const cacheDir = `${FileSystem.cacheDirectory}photos/`;
    const dirInfo = await FileSystem.getInfoAsync(cacheDir);

    if (!dirInfo.exists) {
      return 0;
    }

    const files = await FileSystem.readDirectoryAsync(cacheDir);
    const now = Date.now();
    const maxAge = daysOld * 24 * 60 * 60 * 1000;
    let deletedCount = 0;

    for (const file of files) {
      const filePath = `${cacheDir}${file}`;
      const fileInfo = await FileSystem.getInfoAsync(filePath);

      if (fileInfo.exists && fileInfo.modificationTime) {
        const age = now - fileInfo.modificationTime * 1000;

        if (age > maxAge) {
          await FileSystem.deleteAsync(filePath, { idempotent: true });
          deletedCount++;
        }
      }
    }

    console.log(`🧹 Limpeza de cache: ${deletedCount} arquivo(s) antigo(s) removido(s)`);
    return deletedCount;

  } catch (error) {
    console.error('Erro ao limpar cache de fotos:', error);
    return 0;
  }
};

/**
 * Registra informações de crash para diagnóstico
 */
export const logCrashInfo = async (errorInfo?: any): Promise<void> => {
  try {
    const memoryInfo = await getMemoryInfo();

    const crashLog = {
      ...memoryInfo,
      errorInfo: errorInfo ? JSON.stringify(errorInfo) : undefined,
      crashTime: new Date().toISOString(),
    };

    await AsyncStorage.setItem(
      `${MEMORY_CHECK_KEY}_crash_${Date.now()}`,
      JSON.stringify(crashLog)
    );

  } catch (error) {
    console.error('Erro ao registrar informações de crash:', error);
  }
};

/**
 * Obtém logs de crashes anteriores
 */
export const getCrashLogs = async (): Promise<any[]> => {
  try {
    const keys = await AsyncStorage.getAllKeys();
    const crashKeys = keys.filter(k => k.startsWith(`${MEMORY_CHECK_KEY}_crash_`));

    const logs = await Promise.all(
      crashKeys.map(async key => {
        const data = await AsyncStorage.getItem(key);
        return data ? JSON.parse(data) : null;
      })
    );

    return logs.filter(Boolean);

  } catch (error) {
    console.error('Erro ao obter logs de crash:', error);
    return [];
  }
};

/**
 * Limpa logs de crash antigos
 */
export const clearOldCrashLogs = async (maxLogs: number = 10): Promise<void> => {
  try {
    const keys = await AsyncStorage.getAllKeys();
    const crashKeys = keys.filter(k => k.startsWith(`${MEMORY_CHECK_KEY}_crash_`));

    if (crashKeys.length > maxLogs) {
      const toDelete = crashKeys.slice(0, crashKeys.length - maxLogs);
      await AsyncStorage.multiRemove(toDelete);
      console.log(`🧹 Removidos ${toDelete.length} logs de crash antigos`);
    }

  } catch (error) {
    console.error('Erro ao limpar logs de crash:', error);
  }
};

/**
 * Obtém diagnóstico completo do dispositivo
 */
export const getDeviceDiagnostics = async () => {
  const memInfo = await getMemoryInfo();
  const hasStorage = await hasEnoughStorage();
  const crashLogs = await getCrashLogs();

  const diagnostics = {
    device: {
      platform: memInfo.platform,
      version: memInfo.platformVersion,
      isOldAndroid: Platform.OS === 'android' && parseInt(Platform.Version.toString()) < 26,
    },
    storage: {
      free: memInfo.storageFree ? `${Math.round(memInfo.storageFree / 1024 / 1024)}MB` : 'N/A',
      hasEnough: hasStorage,
      asyncStorageSize: memInfo.asyncStorageSize
        ? `${Math.round(memInfo.asyncStorageSize / 1024)}KB`
        : 'N/A',
    },
    crashes: {
      count: crashLogs.length,
      recent: crashLogs.slice(-3),
    },
    recommendations: [] as string[],
  };

  // Gerar recomendações
  if (diagnostics.device.isOldAndroid) {
    diagnostics.recommendations.push('⚠️ Android antigo detectado. Recomendamos Android 8.0+');
  }

  if (!hasStorage) {
    diagnostics.recommendations.push('⚠️ Pouco espaço em disco. Libere espaço no dispositivo.');
  }

  if (memInfo.asyncStorageSize && memInfo.asyncStorageSize > 5 * 1024 * 1024) {
    diagnostics.recommendations.push('⚠️ Muitos dados locais. Sincronize e limpe obras antigas.');
  }

  if (crashLogs.length > 3) {
    diagnostics.recommendations.push('⚠️ Múltiplos crashes detectados. Contate o suporte.');
  }

  return diagnostics;
};
