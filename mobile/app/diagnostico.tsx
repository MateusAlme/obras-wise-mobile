import { useEffect, useMemo, useState } from 'react';
import {
  Alert,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import {
  clearOldCrashLogs,
  clearOldPhotoCache,
  getDeviceDiagnostics,
} from '../lib/memory-monitor';
import { getPendingObras } from '../lib/offline-sync';
import { getAllPhotoMetadata } from '../lib/photo-backup';

type DiagnosticsResult = Awaited<ReturnType<typeof getDeviceDiagnostics>>;

export default function Diagnostico() {
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [clearing, setClearing] = useState(false);
  const [diagnostics, setDiagnostics] = useState<DiagnosticsResult | null>(null);
  const [lastUpdated, setLastUpdated] = useState('');
  const [stats, setStats] = useState({
    pendingObras: 0,
    totalPhotos: 0,
  });

  const loadDiagnostics = async () => {
    try {
      const [diag, pendingObras, photos] = await Promise.all([
        getDeviceDiagnostics(),
        getPendingObras(),
        getAllPhotoMetadata(),
      ]);

      setDiagnostics(diag);
      setStats({
        pendingObras: pendingObras.length,
        totalPhotos: photos.length,
      });
      setLastUpdated(new Date().toLocaleString('pt-BR'));
    } catch (error) {
      console.error('Erro ao carregar diagnostico:', error);
      Alert.alert('Erro', 'Nao foi possivel carregar informacoes de diagnostico');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  useEffect(() => {
    loadDiagnostics();
  }, []);

  const handleRefresh = () => {
    setRefreshing(true);
    loadDiagnostics();
  };

  const handleClearCache = async () => {
    Alert.alert(
      'Limpar Cache',
      'Deseja remover arquivos de cache com mais de 30 dias e manter apenas os 10 logs de crash mais recentes?',
      [
        { text: 'Cancelar', style: 'cancel' },
        {
          text: 'Limpar',
          style: 'destructive',
          onPress: async () => {
            try {
              setClearing(true);
              const deleted = await clearOldPhotoCache(30);
              await clearOldCrashLogs(10);
              Alert.alert('Concluido', `${deleted} arquivo(s) de cache removido(s).`);
              handleRefresh();
            } catch (error) {
              console.error('Erro ao limpar cache:', error);
              Alert.alert('Erro', 'Nao foi possivel limpar o cache.');
            } finally {
              setClearing(false);
            }
          },
        },
      ]
    );
  };

  const storageStatus = useMemo(() => {
    if (!diagnostics) {
      return { color: '#6b7280', icon: '•', label: 'N/A' };
    }

    if (diagnostics.storage.hasEnough) {
      return { color: '#059669', icon: 'OK', label: diagnostics.storage.free };
    }

    return { color: '#dc2626', icon: 'ALERTA', label: diagnostics.storage.free };
  }, [diagnostics]);

  if (loading && !diagnostics) {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.loadingContainer}>
          <Text style={styles.loadingText}>Carregando diagnostico...</Text>
        </View>
      </SafeAreaView>
    );
  }

  if (!diagnostics) {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.loadingContainer}>
          <Text style={styles.loadingText}>Nao foi possivel carregar o diagnostico.</Text>
          <TouchableOpacity style={styles.primaryButton} onPress={handleRefresh}>
            <Text style={styles.primaryButtonText}>Tentar novamente</Text>
          </TouchableOpacity>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container}>
      <ScrollView
        style={styles.scrollView}
        contentContainerStyle={styles.scrollContent}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={handleRefresh} />}
      >
        <View style={styles.hero}>
          <TouchableOpacity onPress={() => router.back()} style={styles.backButton}>
            <Text style={styles.backButtonText}>Voltar</Text>
          </TouchableOpacity>
          <Text style={styles.title}>Diagnostico do Sistema</Text>
          <Text style={styles.subtitle}>
            Painel para verificar estabilidade, armazenamento e sinais de falha no dispositivo.
          </Text>
          <Text style={styles.updatedAt}>Ultima atualizacao: {lastUpdated || '-'}</Text>
        </View>

        <View style={styles.metricsGrid}>
          <View style={styles.metricCard}>
            <Text style={styles.metricLabel}>Espaco Livre</Text>
            <Text style={[styles.metricValue, { color: storageStatus.color }]}>
              {storageStatus.icon} {storageStatus.label}
            </Text>
          </View>

          <View style={styles.metricCard}>
            <Text style={styles.metricLabel}>Obras Pendentes</Text>
            <Text style={styles.metricValue}>{stats.pendingObras}</Text>
          </View>

          <View style={styles.metricCard}>
            <Text style={styles.metricLabel}>Fotos Locais</Text>
            <Text style={styles.metricValue}>{stats.totalPhotos}</Text>
          </View>

          <View style={styles.metricCard}>
            <Text style={styles.metricLabel}>Crashes</Text>
            <Text style={[styles.metricValue, diagnostics.crashes.count > 0 && styles.dangerValue]}>
              {diagnostics.crashes.count}
            </Text>
          </View>
        </View>

        <View style={styles.panel}>
          <Text style={styles.panelTitle}>Dispositivo</Text>
          <View style={styles.infoRow}>
            <Text style={styles.infoLabel}>Plataforma</Text>
            <Text style={styles.infoValue}>{diagnostics.device.platform}</Text>
          </View>
          <View style={styles.infoRow}>
            <Text style={styles.infoLabel}>Versao</Text>
            <Text style={styles.infoValue}>{diagnostics.device.version}</Text>
          </View>
          <View style={styles.infoRow}>
            <Text style={styles.infoLabel}>Dados locais</Text>
            <Text style={styles.infoValue}>{diagnostics.storage.asyncStorageSize}</Text>
          </View>

          {diagnostics.device.isOldAndroid && (
            <View style={styles.warningBox}>
              <Text style={styles.warningText}>
                Android antigo detectado. Recomendado Android 8.0 (API 26) ou superior.
              </Text>
            </View>
          )}
        </View>

        {diagnostics.crashes.count > 0 && (
          <View style={styles.panel}>
            <Text style={styles.panelTitle}>Crashes Recentes</Text>
            {diagnostics.crashes.recent.map((crash: any, index: number) => (
              <View key={index} style={styles.crashItem}>
                <Text style={styles.crashText}>
                  Data: {new Date(crash.crashTime).toLocaleString('pt-BR')}
                </Text>
                <Text style={styles.crashText}>
                  Espaco livre: {crash.storageFree ? `${Math.round(crash.storageFree / 1024 / 1024)} MB` : 'N/A'}
                </Text>
              </View>
            ))}
          </View>
        )}

        <View style={styles.panel}>
          <Text style={styles.panelTitle}>Recomendacoes</Text>
          {diagnostics.recommendations.length === 0 ? (
            <View style={styles.goodBox}>
              <Text style={styles.goodText}>Sem alertas criticos no momento.</Text>
            </View>
          ) : (
            diagnostics.recommendations.map((rec: string, index: number) => (
              <View key={index} style={styles.recommendationItem}>
                <Text style={styles.recommendationText}>{rec}</Text>
              </View>
            ))
          )}
        </View>

        <View style={styles.panel}>
          <Text style={styles.panelTitle}>Acoes de Manutencao</Text>
          <TouchableOpacity
            style={[styles.primaryButton, clearing && styles.buttonDisabled]}
            onPress={handleClearCache}
            disabled={clearing}
          >
            <Text style={styles.primaryButtonText}>
              {clearing ? 'Limpando cache...' : 'Limpar Cache Antigo'}
            </Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={[styles.secondaryButton, refreshing && styles.buttonDisabled]}
            onPress={handleRefresh}
            disabled={refreshing}
          >
            <Text style={styles.secondaryButtonText}>
              {refreshing ? 'Atualizando...' : 'Atualizar Informacoes'}
            </Text>
          </TouchableOpacity>
        </View>

        <Text style={styles.footerText}>
          Use este painel para diagnosticar performance e armazenamento antes de abrir chamado no suporte.
        </Text>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f3f4f8',
  },
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    padding: 16,
    paddingBottom: 32,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 24,
  },
  loadingText: {
    fontSize: 15,
    color: '#4b5563',
    marginBottom: 12,
  },
  hero: {
    backgroundColor: '#111827',
    borderRadius: 16,
    padding: 16,
    marginBottom: 16,
  },
  backButton: {
    alignSelf: 'flex-start',
    backgroundColor: 'rgba(255, 255, 255, 0.15)',
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 999,
    marginBottom: 12,
  },
  backButtonText: {
    color: '#e5e7eb',
    fontSize: 13,
    fontWeight: '600',
  },
  title: {
    color: '#ffffff',
    fontSize: 24,
    fontWeight: '700',
    marginBottom: 6,
  },
  subtitle: {
    color: '#cbd5e1',
    fontSize: 13,
    lineHeight: 18,
  },
  updatedAt: {
    marginTop: 10,
    color: '#93c5fd',
    fontSize: 12,
    fontWeight: '600',
  },
  metricsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    marginHorizontal: -4,
    marginBottom: 8,
  },
  metricCard: {
    width: '50%',
    paddingHorizontal: 4,
    marginBottom: 8,
  },
  metricLabel: {
    fontSize: 12,
    color: '#6b7280',
    marginBottom: 6,
  },
  metricValue: {
    backgroundColor: '#ffffff',
    borderRadius: 12,
    paddingVertical: 14,
    paddingHorizontal: 12,
    fontSize: 18,
    fontWeight: '700',
    color: '#111827',
  },
  dangerValue: {
    color: '#dc2626',
  },
  panel: {
    backgroundColor: '#ffffff',
    borderRadius: 14,
    padding: 14,
    marginTop: 10,
    shadowColor: '#000',
    shadowOpacity: 0.04,
    shadowRadius: 6,
    shadowOffset: { width: 0, height: 2 },
    elevation: 2,
  },
  panelTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: '#111827',
    marginBottom: 10,
  },
  infoRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 8,
    borderBottomWidth: 1,
    borderBottomColor: '#f1f5f9',
  },
  infoLabel: {
    fontSize: 13,
    color: '#6b7280',
    fontWeight: '500',
  },
  infoValue: {
    fontSize: 13,
    color: '#111827',
    fontWeight: '700',
  },
  warningBox: {
    marginTop: 12,
    backgroundColor: '#fff7ed',
    borderRadius: 10,
    borderLeftWidth: 4,
    borderLeftColor: '#f97316',
    padding: 10,
  },
  warningText: {
    fontSize: 13,
    color: '#9a3412',
    lineHeight: 18,
  },
  crashItem: {
    backgroundColor: '#fef2f2',
    borderRadius: 10,
    borderLeftWidth: 4,
    borderLeftColor: '#ef4444',
    padding: 10,
    marginTop: 8,
  },
  crashText: {
    fontSize: 12,
    color: '#991b1b',
    marginBottom: 2,
  },
  goodBox: {
    backgroundColor: '#ecfdf5',
    borderRadius: 10,
    borderLeftWidth: 4,
    borderLeftColor: '#10b981',
    padding: 10,
  },
  goodText: {
    fontSize: 13,
    color: '#065f46',
    fontWeight: '600',
  },
  recommendationItem: {
    backgroundColor: '#eff6ff',
    borderRadius: 10,
    borderLeftWidth: 4,
    borderLeftColor: '#3b82f6',
    padding: 10,
    marginTop: 8,
  },
  recommendationText: {
    fontSize: 13,
    color: '#1e3a8a',
    lineHeight: 18,
  },
  primaryButton: {
    backgroundColor: '#2563eb',
    borderRadius: 10,
    paddingVertical: 12,
    alignItems: 'center',
  },
  primaryButtonText: {
    color: '#ffffff',
    fontSize: 14,
    fontWeight: '700',
  },
  secondaryButton: {
    marginTop: 10,
    backgroundColor: '#f8fafc',
    borderWidth: 1,
    borderColor: '#cbd5e1',
    borderRadius: 10,
    paddingVertical: 12,
    alignItems: 'center',
  },
  secondaryButtonText: {
    color: '#334155',
    fontSize: 14,
    fontWeight: '700',
  },
  buttonDisabled: {
    opacity: 0.65,
  },
  footerText: {
    marginTop: 16,
    fontSize: 12,
    color: '#6b7280',
    textAlign: 'center',
    lineHeight: 18,
    paddingHorizontal: 6,
  },
});
