import { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Alert,
  ActivityIndicator,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import {
  getPendingObras,
  syncObra,
  syncAllPendingObras,
  PendingObra,
} from '../lib/offline-sync';

export default function ObrasPendentes() {
  const router = useRouter();
  const [pendingObras, setPendingObras] = useState<PendingObra[]>([]);
  const [loading, setLoading] = useState(true);
  const [syncing, setSyncing] = useState(false);
  const [syncingId, setSyncingId] = useState<string | null>(null);

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    try {
      setLoading(true);
      const obras = await getPendingObras();
      setPendingObras(obras);
    } catch (error) {
      console.error('Erro ao carregar obras pendentes:', error);
      Alert.alert('Erro', 'Não foi possível carregar as obras pendentes.');
    } finally {
      setLoading(false);
    }
  };

  const handleSyncOne = async (obra: PendingObra) => {
    setSyncing(true);
    setSyncingId(obra.id);

    try {
      const success = await syncObra(obra);

      if (success) {
        Alert.alert('✅ Sucesso!', 'Obra sincronizada com sucesso!');
      } else {
        Alert.alert(
          '❌ Falha',
          obra.error_message || 'Não foi possível sincronizar a obra.'
        );
      }

      await loadData();
    } catch (error: any) {
      console.error('Erro ao sincronizar obra:', error);
      Alert.alert('Erro', error?.message || 'Erro ao sincronizar obra.');
    } finally {
      setSyncing(false);
      setSyncingId(null);
    }
  };

  const handleSyncAll = async () => {
    if (pendingObras.length === 0) {
      Alert.alert('Aviso', 'Não há obras pendentes para sincronizar.');
      return;
    }

    setSyncing(true);

    try {
      const result = await syncAllPendingObras();

      await loadData();

      if (result.failed === 0) {
        Alert.alert(
          '✅ Sincronização Completa!',
          `${result.success} obra(s) sincronizada(s) com sucesso!`
        );
      } else {
        Alert.alert(
          '⚠️ Sincronização Parcial',
          `${result.success} obra(s) sincronizada(s)\n${result.failed} obra(s) falharam\n\nAs obras que falharam podem ser reenviadas.`
        );
      }
    } catch (error) {
      console.error('Erro ao sincronizar todas:', error);
      Alert.alert('Erro', 'Não foi possível completar a sincronização.');
    } finally {
      setSyncing(false);
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'pending':
        return '#ff9800';
      case 'syncing':
        return '#2196f3';
      case 'failed':
        return '#dc3545';
      default:
        return '#999';
    }
  };

  const getStatusLabel = (status: string) => {
    switch (status) {
      case 'pending':
        return '⏳ Pendente';
      case 'syncing':
        return '🔄 Sincronizando';
      case 'failed':
        return '❌ Falhou';
      default:
        return status;
    }
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

  const pendingCount = pendingObras.filter((o) => o.sync_status === 'pending').length;
  const failedCount = pendingObras.filter((o) => o.sync_status === 'failed').length;

  return (
    <SafeAreaView style={styles.safeArea}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backButton}>
          <Text style={styles.backButtonText}>← Voltar</Text>
        </TouchableOpacity>
        <Text style={styles.title}>Obras Pendentes</Text>
      </View>

      <ScrollView style={styles.container} contentContainerStyle={styles.scrollContent}>
        {/* Cards de Estatísticas */}
        <View style={styles.statsContainer}>
          <View style={styles.statCard}>
            <Text style={styles.statValue}>{pendingCount}</Text>
            <Text style={styles.statLabel}>Pendentes</Text>
          </View>

          <View style={styles.statCard}>
            <Text style={[styles.statValue, styles.statValueError]}>{failedCount}</Text>
            <Text style={styles.statLabel}>Falharam</Text>
          </View>

          <View style={styles.statCard}>
            <Text style={styles.statValue}>{pendingObras.length}</Text>
            <Text style={styles.statLabel}>Total</Text>
          </View>
        </View>

        {/* Botão de Sincronizar Todas */}
        {pendingObras.length > 0 && (
          <TouchableOpacity
            style={[styles.syncAllButton, syncing && styles.buttonDisabled]}
            onPress={handleSyncAll}
            disabled={syncing}
          >
            {syncing ? (
              <ActivityIndicator size="small" color="#fff" />
            ) : (
              <Text style={styles.syncAllButtonText}>
                🔄 Sincronizar Todas ({pendingObras.length})
              </Text>
            )}
          </TouchableOpacity>
        )}

        {/* Lista de Obras */}
        {pendingObras.length === 0 ? (
          <View style={styles.emptyState}>
            <Text style={styles.emptyStateIcon}>✅</Text>
            <Text style={styles.emptyStateTitle}>Tudo sincronizado!</Text>
            <Text style={styles.emptyStateText}>
              Não há obras pendentes de sincronização
            </Text>
          </View>
        ) : (
          <View style={styles.obrasContainer}>
            {pendingObras.map((obra) => (
              <View key={`pending_${obra.id}`} style={styles.obraCard}>
                <View style={styles.obraHeader}>
                  <View style={styles.obraInfo}>
                    <Text style={styles.obraTitle}>{obra.obra}</Text>
                    <Text style={styles.obraDate}>{obra.data}</Text>
                  </View>
                  <View
                    style={[
                      styles.statusBadge,
                      { backgroundColor: getStatusColor(obra.sync_status) },
                    ]}
                  >
                    <Text style={styles.statusBadgeText}>
                      {getStatusLabel(obra.sync_status)}
                    </Text>
                  </View>
                </View>

                <View style={styles.obraDetails}>
                  <Text style={styles.obraDetail}>
                    👤 <Text style={styles.obraDetailBold}>{obra.responsavel}</Text>
                  </Text>
                  <Text style={styles.obraDetail}>
                    👥 <Text style={styles.obraDetailBold}>{obra.equipe}</Text>
                  </Text>
                  <Text style={styles.obraDetail}>
                    🔧 <Text style={styles.obraDetailBold}>{obra.tipo_servico}</Text>
                  </Text>
                  <Text style={styles.obraDetail}>
                    📸{' '}
                    <Text style={styles.obraDetailBold}>
                      {(obra.fotos_antes?.length || 0) +
                        (obra.fotos_durante?.length || 0) +
                        (obra.fotos_depois?.length || 0)}{' '}
                      foto(s)
                    </Text>
                  </Text>
                </View>

                {obra.error_message && (
                  <View style={styles.errorContainer}>
                    <Text style={styles.errorText}>❌ {obra.error_message}</Text>
                  </View>
                )}

                {(obra.sync_status === 'pending' || obra.sync_status === 'failed') && (
                  <TouchableOpacity
                    style={[
                      styles.retryButton,
                      (syncing && syncingId !== obra.id) && styles.buttonDisabled,
                    ]}
                    onPress={() => handleSyncOne(obra)}
                    disabled={syncing}
                  >
                    {syncing && syncingId === obra.id ? (
                      <ActivityIndicator size="small" color="#fff" />
                    ) : (
                      <Text style={styles.retryButtonText}>
                        {obra.sync_status === 'failed'
                          ? '🔄 Tentar Novamente'
                          : '📤 Sincronizar Agora'}
                      </Text>
                    )}
                  </TouchableOpacity>
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
    gap: 8,
    marginBottom: 20,
    flexWrap: 'nowrap',
  },
  statCard: {
    flex: 1,
    backgroundColor: '#fff',
    borderRadius: 12,
    padding: 12,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#e0e0e0',
    minWidth: 0, // Permite que os cards encolham proporcionalmente
  },
  statValue: {
    fontSize: 22,
    fontWeight: 'bold',
    color: '#ff9800',
    marginBottom: 2,
  },
  statValueError: {
    color: '#dc3545',
  },
  statLabel: {
    fontSize: 11,
    color: '#666',
    textAlign: 'center',
  },
  syncAllButton: {
    backgroundColor: '#dc3545',
    borderRadius: 12,
    padding: 14,
    alignItems: 'center',
    marginBottom: 20,
  },
  syncAllButtonText: {
    color: '#fff',
    fontSize: 15,
    fontWeight: '600',
    textAlign: 'center',
  },
  buttonDisabled: {
    opacity: 0.5,
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
  obrasContainer: {
    gap: 16,
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
    alignItems: 'flex-start',
    marginBottom: 12,
    flexWrap: 'nowrap',
  },
  obraInfo: {
    flex: 1,
    marginRight: 8,
    minWidth: 0, // Permite que o flex funcione corretamente
  },
  obraTitle: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#1a1a1a',
    marginBottom: 4,
    flexShrink: 1,
  },
  obraDate: {
    fontSize: 13,
    color: '#666',
    flexShrink: 1,
  },
  statusBadge: {
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 10,
    flexShrink: 0, // Impede que o badge encolha
    alignSelf: 'flex-start',
    minWidth: 85, // Garante largura mínima
  },
  statusBadgeText: {
    fontSize: 11,
    color: '#fff',
    fontWeight: '600',
    textAlign: 'center',
  },
  obraDetails: {
    gap: 6,
    marginBottom: 12,
  },
  obraDetail: {
    fontSize: 13,
    color: '#666',
    flexShrink: 1,
    flexWrap: 'wrap',
  },
  obraDetailBold: {
    fontWeight: '600',
    color: '#1a1a1a',
  },
  errorContainer: {
    backgroundColor: '#ffebee',
    borderRadius: 8,
    padding: 12,
    marginBottom: 12,
  },
  errorText: {
    fontSize: 13,
    color: '#c62828',
  },
  retryButton: {
    backgroundColor: '#ff9800',
    borderRadius: 8,
    padding: 12,
    alignItems: 'center',
  },
  retryButtonText: {
    color: '#fff',
    fontSize: 14,
    fontWeight: '600',
    textAlign: 'center',
    flexShrink: 1,
  },
});
