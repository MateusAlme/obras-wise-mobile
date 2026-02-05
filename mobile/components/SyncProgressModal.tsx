import React, { useState } from 'react';
import {
  View,
  Text,
  Modal,
  TouchableOpacity,
  ActivityIndicator,
  StyleSheet,
  ScrollView,
  Dimensions,
} from 'react-native';

export interface ObraSyncProgress {
  currentObraIndex: number;
  totalObras: number;
  currentObraName: string;
  photoProgress: {
    completed: number;
    total: number;
  };
  overallStatus: 'syncing' | 'completed' | 'cancelled';
  results: {
    success: number;
    failed: number;
  };
  errors: Array<{
    obraName: string;
    errorMessage: string;
  }>;
}

interface SyncProgressModalProps {
  visible: boolean;
  progress: ObraSyncProgress | null;
  onClose: () => void;
  onCancel: () => void;
}

export function SyncProgressModal({
  visible,
  progress,
  onClose,
  onCancel,
}: SyncProgressModalProps) {
  const [showErrors, setShowErrors] = useState(false);

  if (!progress) return null;

  const isSyncing = progress.overallStatus === 'syncing';
  const isCompleted = progress.overallStatus === 'completed';
  const isCancelled = progress.overallStatus === 'cancelled';

  // Calcular porcentagem geral (considera obra atual + progresso de fotos)
  const calculateOverallProgress = (): number => {
    if (progress.totalObras === 0) return 0;

    const completedObras = progress.currentObraIndex;
    const currentObraProgress =
      progress.photoProgress.total > 0
        ? progress.photoProgress.completed / progress.photoProgress.total
        : 0;

    const totalProgress = completedObras + currentObraProgress;
    return Math.round((totalProgress / progress.totalObras) * 100);
  };

  const overallProgress = calculateOverallProgress();

  const getHeaderTitle = () => {
    if (isCancelled) return 'Sincronização Cancelada';
    if (isCompleted) return 'Sincronização Concluída';
    return 'Sincronizando Obras';
  };

  const getHeaderColor = () => {
    if (isCancelled) return '#f59e0b';
    if (isCompleted) return '#28a745';
    return '#2563eb';
  };

  return (
    <Modal
      visible={visible}
      transparent
      animationType="fade"
      onRequestClose={() => {
        // Bloquear fechamento durante sincronização
        if (!isSyncing) {
          onClose();
        }
      }}
    >
      <View style={styles.overlay}>
        <View style={styles.modalContainer}>
          {/* Header */}
          <View style={[styles.header, { backgroundColor: getHeaderColor() }]}>
            <Text style={styles.headerText}>{getHeaderTitle()}</Text>
          </View>

          {/* Content */}
          <View style={styles.content}>
            {isSyncing && (
              <>
                {/* Progresso Geral */}
                <View style={styles.overallProgressContainer}>
                  <Text style={styles.overallProgressText}>
                    Obra {progress.currentObraIndex + 1} de {progress.totalObras}
                  </Text>
                  <Text style={styles.percentageText}>{overallProgress}%</Text>
                </View>

                {/* Nome da Obra Atual */}
                {progress.currentObraName && (
                  <View style={styles.currentObraContainer}>
                    <Text style={styles.currentObraLabel}>Obra atual:</Text>
                    <Text style={styles.currentObraName}>{progress.currentObraName}</Text>
                  </View>
                )}

                {/* Progresso de Fotos */}
                {progress.photoProgress.total > 0 && (
                  <View style={styles.photoProgressContainer}>
                    <View style={styles.photoProgressHeader}>
                      <ActivityIndicator size="small" color="#2563eb" />
                      <Text style={styles.photoProgressText}>
                        Enviando foto {progress.photoProgress.completed} de {progress.photoProgress.total}
                      </Text>
                    </View>
                  </View>
                )}

                {/* Barra de Progresso */}
                <View style={styles.progressBarContainer}>
                  <View style={styles.progressBarBackground}>
                    <View
                      style={[
                        styles.progressBarFill,
                        { width: `${overallProgress}%` },
                      ]}
                    />
                  </View>
                </View>

                {/* Botão Cancelar */}
                <TouchableOpacity
                  style={styles.cancelButton}
                  onPress={onCancel}
                >
                  <Text style={styles.cancelButtonText}>Cancelar</Text>
                </TouchableOpacity>
              </>
            )}

            {(isCompleted || isCancelled) && (
              <>
                {/* Resumo Final */}
                <View style={styles.summaryContainer}>
                  {progress.results.success > 0 && (
                    <View style={styles.summaryRow}>
                      <Text style={styles.successIcon}>✅</Text>
                      <Text style={styles.successText}>
                        {progress.results.success} obra{progress.results.success > 1 ? 's' : ''} sincronizada{progress.results.success > 1 ? 's' : ''}
                      </Text>
                    </View>
                  )}

                  {progress.results.failed > 0 && (
                    <View style={styles.summaryRow}>
                      <Text style={styles.errorIcon}>❌</Text>
                      <Text style={styles.errorText}>
                        {progress.results.failed} obra{progress.results.failed > 1 ? 's' : ''} falhou{progress.results.failed > 1 ? 'ram' : ''}
                      </Text>
                    </View>
                  )}

                  {isCancelled && (
                    <View style={styles.cancelledMessageContainer}>
                      <Text style={styles.cancelledMessage}>
                        Sincronização interrompida pelo usuário
                      </Text>
                    </View>
                  )}

                  {/* Lista de Erros (se houver) */}
                  {progress.errors.length > 0 && (
                    <View style={styles.errorsContainer}>
                      <TouchableOpacity
                        style={styles.errorsToggle}
                        onPress={() => setShowErrors(!showErrors)}
                      >
                        <Text style={styles.errorsToggleText}>
                          {showErrors ? '▼' : '▶'} Ver detalhes dos erros
                        </Text>
                      </TouchableOpacity>

                      {showErrors && (
                        <ScrollView style={styles.errorsList} nestedScrollEnabled>
                          {progress.errors.map((error, index) => (
                            <View key={index} style={styles.errorItem}>
                              <Text style={styles.errorItemTitle}>
                                Obra {error.obraName}:
                              </Text>
                              <Text style={styles.errorItemMessage}>
                                {error.errorMessage}
                              </Text>
                            </View>
                          ))}
                        </ScrollView>
                      )}
                    </View>
                  )}
                </View>

                {/* Botão Fechar */}
                <TouchableOpacity
                  style={styles.closeButton}
                  onPress={onClose}
                >
                  <Text style={styles.closeButtonText}>Fechar</Text>
                </TouchableOpacity>
              </>
            )}
          </View>
        </View>
      </View>
    </Modal>
  );
}

const { width } = Dimensions.get('window');

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.7)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  modalContainer: {
    backgroundColor: '#fff',
    borderRadius: 16,
    maxWidth: 500,
    width: width - 40,
    overflow: 'hidden',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 8,
  },
  header: {
    paddingVertical: 16,
    paddingHorizontal: 20,
    alignItems: 'center',
  },
  headerText: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#fff',
  },
  content: {
    padding: 24,
  },
  overallProgressContainer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 16,
  },
  overallProgressText: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#1e293b',
  },
  percentageText: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#2563eb',
  },
  currentObraContainer: {
    backgroundColor: '#f8fafc',
    borderRadius: 8,
    padding: 12,
    marginBottom: 16,
  },
  currentObraLabel: {
    fontSize: 12,
    color: '#64748b',
    marginBottom: 4,
  },
  currentObraName: {
    fontSize: 16,
    fontWeight: '600',
    color: '#1e293b',
  },
  photoProgressContainer: {
    marginBottom: 16,
  },
  photoProgressHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  photoProgressText: {
    fontSize: 14,
    color: '#64748b',
  },
  progressBarContainer: {
    marginBottom: 24,
  },
  progressBarBackground: {
    height: 12,
    backgroundColor: '#e2e8f0',
    borderRadius: 6,
    overflow: 'hidden',
  },
  progressBarFill: {
    height: '100%',
    backgroundColor: '#28a745',
    borderRadius: 6,
  },
  cancelButton: {
    backgroundColor: '#dc3545',
    borderRadius: 12,
    paddingVertical: 14,
    alignItems: 'center',
    shadowColor: '#dc3545',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.3,
    shadowRadius: 4,
    elevation: 4,
  },
  cancelButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
  },
  summaryContainer: {
    marginBottom: 24,
  },
  summaryRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 12,
  },
  successIcon: {
    fontSize: 24,
    marginRight: 12,
  },
  successText: {
    fontSize: 16,
    color: '#28a745',
    fontWeight: '600',
  },
  errorIcon: {
    fontSize: 24,
    marginRight: 12,
  },
  errorText: {
    fontSize: 16,
    color: '#dc3545',
    fontWeight: '600',
  },
  cancelledMessageContainer: {
    backgroundColor: '#fff8e1',
    borderRadius: 8,
    padding: 12,
    marginTop: 8,
  },
  cancelledMessage: {
    fontSize: 14,
    color: '#8d5300',
    textAlign: 'center',
  },
  errorsContainer: {
    marginTop: 16,
    borderTopWidth: 1,
    borderTopColor: '#e2e8f0',
    paddingTop: 16,
  },
  errorsToggle: {
    paddingVertical: 8,
  },
  errorsToggleText: {
    fontSize: 14,
    color: '#2563eb',
    fontWeight: '600',
  },
  errorsList: {
    marginTop: 12,
    maxHeight: 200,
  },
  errorItem: {
    backgroundColor: '#ffebee',
    borderRadius: 8,
    padding: 12,
    marginBottom: 8,
  },
  errorItemTitle: {
    fontSize: 14,
    fontWeight: '600',
    color: '#c62828',
    marginBottom: 4,
  },
  errorItemMessage: {
    fontSize: 13,
    color: '#d32f2f',
  },
  closeButton: {
    backgroundColor: '#28a745',
    borderRadius: 12,
    paddingVertical: 14,
    alignItems: 'center',
    shadowColor: '#28a745',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.3,
    shadowRadius: 4,
    elevation: 4,
  },
  closeButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
  },
});
