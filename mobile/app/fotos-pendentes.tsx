import { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Alert,
  ActivityIndicator,
  Image,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import {
  getPendingPhotos,
  getStorageStats,
  cleanupUploadedPhotos,
  PhotoMetadata,
} from '../lib/photo-backup';
import {
  processUploadQueue,
  retryFailedUploads,
  getQueueStats,
  UploadProgress,
} from '../lib/photo-queue';

export default function FotosPendentes() {
  const router = useRouter();
  const [pendingPhotos, setPendingPhotos] = useState<PhotoMetadata[]>([]);
  const [storageStats, setStorageStats] = useState({
    totalPhotos: 0,
    pendingPhotos: 0,
    uploadedPhotos: 0,
    totalSize: 0,
    pendingSize: 0,
  });
  const [queueStats, setQueueStats] = useState({
    total: 0,
    pending: 0,
    uploading: 0,
    success: 0,
    failed: 0,
  });
  const [loading, setLoading] = useState(true);
  const [processing, setProcessing] = useState(false);
  const [uploadProgress, setUploadProgress] = useState<UploadProgress | null>(null);

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    try {
      setLoading(true);
      const [photos, storage, queue] = await Promise.all([
        getPendingPhotos(),
        getStorageStats(),
        getQueueStats(),
      ]);

      setPendingPhotos(photos);
      setStorageStats(storage);
      setQueueStats(queue);
    } catch (error) {
      console.error('Erro ao carregar dados:', error);
      Alert.alert('Erro', 'Não foi possível carregar as fotos pendentes.');
    } finally {
      setLoading(false);
    }
  };

  const handleUploadAll = async () => {
    if (pendingPhotos.length === 0) {
      Alert.alert('Aviso', 'Não há fotos pendentes para upload.');
      return;
    }

    setProcessing(true);
    setUploadProgress({ total: pendingPhotos.length, completed: 0, failed: 0, pending: pendingPhotos.length });

    try {
      const result = await processUploadQueue((progress) => {
        setUploadProgress(progress);
      });

      await loadData();
      setUploadProgress(null);

      if (result.failed === 0) {
        Alert.alert(
          '✅ Upload Completo!',
          `${result.success} foto(s) enviada(s) com sucesso!`
        );
      } else {
        Alert.alert(
          '⚠️ Upload Incompleto',
          `${result.success} foto(s) enviada(s)\n${result.failed} foto(s) falharam\n\nAs fotos que falharam podem ser reenviadas.`
        );
      }
    } catch (error) {
      console.error('Erro ao fazer upload:', error);
      Alert.alert('Erro', 'Não foi possível completar o upload das fotos.');
    } finally {
      setProcessing(false);
    }
  };

  const handleRetryFailed = async () => {
    setProcessing(true);

    try {
      const result = await retryFailedUploads((progress) => {
        setUploadProgress(progress);
      });

      await loadData();
      setUploadProgress(null);

      if (result.success > 0) {
        Alert.alert(
          '✅ Reenvio Completo!',
          `${result.success} foto(s) reenviada(s) com sucesso!`
        );
      } else if (result.failed > 0) {
        Alert.alert(
          '❌ Reenvio Falhou',
          'Não foi possível reenviar as fotos. Verifique sua conexão.'
        );
      }
    } catch (error) {
      console.error('Erro ao reenviar fotos:', error);
      Alert.alert('Erro', 'Não foi possível reenviar as fotos.');
    } finally {
      setProcessing(false);
    }
  };

  const handleCleanup = async () => {
    Alert.alert(
      'Limpar Backups',
      'Deseja limpar backups de fotos já enviadas? Isso irá liberar espaço no dispositivo.',
      [
        {
          text: 'Cancelar',
          style: 'cancel',
        },
        {
          text: 'Limpar',
          onPress: async () => {
            try {
              const deleted = await cleanupUploadedPhotos();
              await loadData();
              Alert.alert('Sucesso', `${deleted} backup(s) removido(s).`);
            } catch (error) {
              console.error('Erro ao limpar backups:', error);
              Alert.alert('Erro', 'Não foi possível limpar os backups.');
            }
          },
        },
      ]
    );
  };

  const formatBytes = (bytes: number): string => {
    if (bytes === 0) return '0 B';
    const k = 1024;
    const sizes = ['B', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return Math.round(bytes / Math.pow(k, i) * 100) / 100 + ' ' + sizes[i];
  };

  const groupPhotosByObra = (photos: PhotoMetadata[]): Record<string, PhotoMetadata[]> => {
    return photos.reduce((acc, photo) => {
      if (!acc[photo.obraId]) {
        acc[photo.obraId] = [];
      }
      acc[photo.obraId].push(photo);
      return acc;
    }, {} as Record<string, PhotoMetadata[]>);
  };

  if (loading) {
    return (
      <SafeAreaView style={styles.safeArea}>
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color="#dc3545" />
          <Text style={styles.loadingText}>Carregando...</Text>
        </View>
      </SafeAreaView>
    );
  }

  const groupedPhotos = groupPhotosByObra(pendingPhotos);

  return (
    <SafeAreaView style={styles.safeArea}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backButton}>
          <Text style={styles.backButtonText}>← Voltar</Text>
        </TouchableOpacity>
        <Text style={styles.title}>Fotos Pendentes</Text>
      </View>

      <ScrollView style={styles.container} contentContainerStyle={styles.scrollContent}>
        {/* Cards de Estatísticas */}
        <View style={styles.statsContainer}>
          <View style={styles.statCard}>
            <Text style={styles.statValue}>{storageStats.pendingPhotos}</Text>
            <Text style={styles.statLabel}>Pendentes</Text>
          </View>

          <View style={styles.statCard}>
            <Text style={[styles.statValue, styles.statValueSuccess]}>
              {storageStats.uploadedPhotos}
            </Text>
            <Text style={styles.statLabel}>Enviadas</Text>
          </View>

          <View style={styles.statCard}>
            <Text style={styles.statValue}>{formatBytes(storageStats.pendingSize)}</Text>
            <Text style={styles.statLabel}>Tamanho</Text>
          </View>
        </View>

        {/* Progress Bar */}
        {uploadProgress && (
          <View style={styles.progressContainer}>
            <View style={styles.progressHeader}>
              <Text style={styles.progressTitle}>Enviando fotos...</Text>
              <Text style={styles.progressText}>
                {uploadProgress.completed} / {uploadProgress.total}
              </Text>
            </View>
            <View style={styles.progressBarBg}>
              <View
                style={[
                  styles.progressBarFill,
                  {
                    width: `${(uploadProgress.completed / uploadProgress.total) * 100}%`,
                  },
                ]}
              />
            </View>
            {uploadProgress.failed > 0 && (
              <Text style={styles.progressError}>{uploadProgress.failed} falharam</Text>
            )}
          </View>
        )}

        {/* Botões de Ação */}
        <View style={styles.actionsContainer}>
          <TouchableOpacity
            style={[styles.actionButton, styles.primaryButton, processing && styles.buttonDisabled]}
            onPress={handleUploadAll}
            disabled={processing || pendingPhotos.length === 0}
          >
            {processing ? (
              <ActivityIndicator size="small" color="#fff" />
            ) : (
              <Text style={styles.actionButtonText}>
                📤 Enviar Todas ({pendingPhotos.length})
              </Text>
            )}
          </TouchableOpacity>

          {queueStats.failed > 0 && (
            <TouchableOpacity
              style={[styles.actionButton, styles.warningButton, processing && styles.buttonDisabled]}
              onPress={handleRetryFailed}
              disabled={processing}
            >
              <Text style={styles.actionButtonText}>
                🔄 Tentar Novamente ({queueStats.failed})
              </Text>
            </TouchableOpacity>
          )}

          {storageStats.uploadedPhotos > 0 && (
            <TouchableOpacity
              style={[styles.actionButton, styles.secondaryButton]}
              onPress={handleCleanup}
            >
              <Text style={styles.actionButtonTextSecondary}>
                🧹 Limpar Backups ({storageStats.uploadedPhotos})
              </Text>
            </TouchableOpacity>
          )}
        </View>

        {/* Lista de Fotos Agrupadas por Obra */}
        {pendingPhotos.length === 0 ? (
          <View style={styles.emptyState}>
            <Text style={styles.emptyStateIcon}>✅</Text>
            <Text style={styles.emptyStateTitle}>Tudo sincronizado!</Text>
            <Text style={styles.emptyStateText}>
              Não há fotos pendentes de upload
            </Text>
          </View>
        ) : (
          <View style={styles.photosContainer}>
            <Text style={styles.sectionTitle}>Fotos por Obra</Text>

            {Object.entries(groupedPhotos).map(([obraId, photos]) => (
              <View key={obraId} style={styles.obraCard}>
                <View style={styles.obraHeader}>
                  <Text style={styles.obraId}>📋 {obraId}</Text>
                  <Text style={styles.obraPhotoCount}>{photos.length} foto(s)</Text>
                </View>

                <View style={styles.photoGrid}>
                  {photos.slice(0, 6).map((photo) => (
                    <View key={photo.id} style={styles.photoItem}>
                      <Image
                        source={{ uri: photo.compressedPath }}
                        style={styles.photoThumbnail}
                      />
                      <View style={styles.photoOverlay}>
                        <Text style={styles.photoType}>{photo.type}</Text>
                        {photo.retries > 0 && (
                          <Text style={styles.photoRetries}>⚠️ {photo.retries}</Text>
                        )}
                      </View>
                    </View>
                  ))}
                </View>

                {photos.length > 6 && (
                  <Text style={styles.morePhotos}>
                    +{photos.length - 6} foto(s) a mais
                  </Text>
                )}
              </View>
            ))}
          </View>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: '#f5f5f5',
  },
  header: {
    backgroundColor: '#fff',
    paddingHorizontal: 20,
    paddingVertical: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#e0e0e0',
  },
  backButton: {
    marginBottom: 8,
  },
  backButtonText: {
    fontSize: 16,
    color: '#dc3545',
    fontWeight: '600',
  },
  title: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#1a1a1a',
  },
  container: {
    flex: 1,
  },
  scrollContent: {
    padding: 20,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  loadingText: {
    marginTop: 12,
    fontSize: 16,
    color: '#666',
  },
  statsContainer: {
    flexDirection: 'row',
    gap: 12,
    marginBottom: 20,
  },
  statCard: {
    flex: 1,
    backgroundColor: '#fff',
    borderRadius: 12,
    padding: 16,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#e0e0e0',
  },
  statValue: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#dc3545',
    marginBottom: 4,
  },
  statValueSuccess: {
    color: '#4caf50',
  },
  statLabel: {
    fontSize: 12,
    color: '#666',
  },
  progressContainer: {
    backgroundColor: '#fff',
    borderRadius: 12,
    padding: 16,
    marginBottom: 20,
    borderWidth: 1,
    borderColor: '#e0e0e0',
  },
  progressHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  progressTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#1a1a1a',
  },
  progressText: {
    fontSize: 14,
    color: '#666',
  },
  progressBarBg: {
    height: 8,
    backgroundColor: '#f0f0f0',
    borderRadius: 4,
    overflow: 'hidden',
  },
  progressBarFill: {
    height: '100%',
    backgroundColor: '#dc3545',
    borderRadius: 4,
  },
  progressError: {
    marginTop: 8,
    fontSize: 12,
    color: '#dc3545',
    textAlign: 'right',
  },
  actionsContainer: {
    gap: 12,
    marginBottom: 20,
  },
  actionButton: {
    borderRadius: 12,
    padding: 16,
    alignItems: 'center',
  },
  primaryButton: {
    backgroundColor: '#dc3545',
  },
  warningButton: {
    backgroundColor: '#ff9800',
  },
  secondaryButton: {
    backgroundColor: '#fff',
    borderWidth: 1,
    borderColor: '#ddd',
  },
  buttonDisabled: {
    opacity: 0.5,
  },
  actionButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
  },
  actionButtonTextSecondary: {
    color: '#666',
    fontSize: 16,
    fontWeight: '600',
  },
  emptyState: {
    alignItems: 'center',
    paddingVertical: 60,
  },
  emptyStateIcon: {
    fontSize: 64,
    marginBottom: 16,
  },
  emptyStateTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#1a1a1a',
    marginBottom: 8,
  },
  emptyStateText: {
    fontSize: 14,
    color: '#999',
  },
  photosContainer: {
    gap: 16,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#1a1a1a',
    marginBottom: 12,
  },
  obraCard: {
    backgroundColor: '#fff',
    borderRadius: 12,
    padding: 16,
    borderWidth: 1,
    borderColor: '#e0e0e0',
  },
  obraHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  obraId: {
    fontSize: 14,
    fontWeight: '600',
    color: '#1a1a1a',
  },
  obraPhotoCount: {
    fontSize: 12,
    color: '#666',
    backgroundColor: '#f0f0f0',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 12,
  },
  photoGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  photoItem: {
    width: '31%',
    aspectRatio: 1,
    borderRadius: 8,
    overflow: 'hidden',
    position: 'relative',
  },
  photoThumbnail: {
    width: '100%',
    height: '100%',
  },
  photoOverlay: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    backgroundColor: 'rgba(0, 0, 0, 0.7)',
    padding: 4,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  photoType: {
    fontSize: 10,
    color: '#fff',
    fontWeight: '600',
  },
  photoRetries: {
    fontSize: 10,
    color: '#ff9800',
  },
  morePhotos: {
    marginTop: 8,
    fontSize: 12,
    color: '#666',
    textAlign: 'center',
  },
});
