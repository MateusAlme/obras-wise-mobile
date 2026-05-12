import { View, Text, StyleSheet, ScrollView, TouchableOpacity, ActivityIndicator, Alert, useWindowDimensions } from 'react-native';
import { useRouter } from 'expo-router';
import { useState, useEffect } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { supabase } from '../../lib/supabase';
import NetInfo from '@react-native-community/netinfo';
import {
  checkInternetConnection,
  getPendingObras,
  syncAllPendingObras,
  startAutoSync,
} from '../../lib/offline-sync';
import type { PendingObra } from '../../lib/offline-sync';
import {
  getAllowedServiceTypesForProfile,
  isCompressorProfile,
  isObraVisibleForProfile,
} from '../../lib/profile-rules';

export default function Dashboard() {
  const router = useRouter();
  const { width } = useWindowDimensions();
  const [equipeLogada, setEquipeLogada] = useState('');
  const [userRole, setUserRole] = useState('');
  const [totalObras, setTotalObras] = useState(0);
  const [loading, setLoading] = useState(true);
  const [pendingObras, setPendingObras] = useState<PendingObra[]>([]);
  const [pendingObrasUnicas, setPendingObrasUnicas] = useState(0);
  const [isOnline, setIsOnline] = useState(true);
  const [syncingPending, setSyncingPending] = useState(false);
  const isCompressor = getAllowedServiceTypesForProfile(userRole, equipeLogada)?.[0] === 'Cava em Rocha';
  const isAdmin = userRole === 'admin';
  const isSmallScreen = width < 380;
  const horizontalPadding = width < 360 ? 14 : width < 430 ? 18 : 22;

  useEffect(() => {
    initializeDashboard();
  }, []);

  useEffect(() => {
    let isMounted = true;

    checkInternetConnection().then(online => {
      if (isMounted) {
        setIsOnline(online);
      }
    });

    const unsubscribe = NetInfo.addEventListener(state => {
      const online = state.isConnected === true && state.isInternetReachable === true;
      setIsOnline(online);
    });

    return () => {
      isMounted = false;
      unsubscribe();
    };
  }, []);

  useEffect(() => {
    if (!equipeLogada && !isAdmin) return;

    const unsubscribe = startAutoSync(async result => {
      if (result.success > 0 || result.failed > 0) {
        await loadPendingObras(equipeLogada, userRole);
        await carregarEstatisticas(equipeLogada, userRole);
      }
    });

    return () => {
      unsubscribe?.();
    };
  }, [equipeLogada, userRole, isAdmin]);

  const initializeDashboard = async () => {
    try {
      const equipe = await AsyncStorage.getItem('@equipe_logada');
      const role = await AsyncStorage.getItem('@user_role');
      const equipeAtual = equipe || '';
      const roleAtual = role || '';
      setEquipeLogada(equipeAtual);
      setUserRole(roleAtual);

      if (!equipeAtual && roleAtual !== 'admin') {
        setTotalObras(0);
        setPendingObras([]);
        return;
      }

      await Promise.all([
        carregarEstatisticas(equipeAtual, roleAtual),
        loadPendingObras(equipeAtual, roleAtual),
      ]);
    } catch (error) {
      console.error('Erro ao inicializar dashboard:', error);
    } finally {
      setLoading(false);
    }
  };

  const carregarEstatisticas = async (equipeParam?: string, roleParam?: string) => {
    try {
      const equipe = equipeParam || equipeLogada;
      const role = roleParam || userRole;
      if (!equipe && role !== 'admin') {
        setTotalObras(0);
        return;
      }

      // Buscar apenas o campo 'obra' para contar obras únicas (agrupadas por número)
      let query = supabase.from('obras').select('obra');

      if (role !== 'admin') {
        query = query.eq('equipe', equipe);
      }

      if (isCompressorProfile(role, equipe)) {
        query = query.or('tipo_servico.eq.Cava em Rocha,creator_role.eq.compressor');
      } else {
        const allowed = getAllowedServiceTypesForProfile(role, equipe);
        if (allowed?.length === 1) {
          query = query.eq('tipo_servico', allowed[0]);
        }
      }

      const { data, error } = await query;

      if (!error && data) {
        // Contar números de obra únicos (mesmo critério do agrupamento em obras.tsx)
        const obrasUnicas = new Set(data.map((o) => String(o.obra || '').trim().toLowerCase()));
        setTotalObras(obrasUnicas.size);
      }
    } catch (err) {
      console.error('Erro ao carregar estatisticas:', err);
    }
  };

  const loadPendingObras = async (equipeParam?: string, roleParam?: string) => {
    try {
      const equipe = equipeParam || equipeLogada;
      const role = roleParam || userRole;
      if (!equipe && role !== 'admin') {
        setPendingObras([]);
        return;
      }

      const obras = await getPendingObras();
      const obrasSincronizaveis = obras.filter((obra) => {
        const status = obra.sync_status ?? 'pending';
        return status === 'pending' || status === 'failed';
      });
      const pendentesDaEquipe = obrasSincronizaveis.filter((obra) => {
        if (role !== 'admin') {
          const mesmaEquipe = obra.equipe === equipe;
          if (!mesmaEquipe) return false;
        }
        return isObraVisibleForProfile(obra as any, role, equipe);
      });
      setPendingObras(pendentesDaEquipe);
      // Contar obras únicas pendentes pelo número da obra
      const unicas = new Set(pendentesDaEquipe.map((o) => String((o as any).obra || o.id).trim().toLowerCase()));
      setPendingObrasUnicas(unicas.size);
    } catch (error) {
      console.error('Erro ao carregar pendencias:', error);
    }
  };

  const handleSyncPendingObras = async () => {
    if (pendingObras.length === 0) return;

    setSyncingPending(true);
    try {
      const result = await syncAllPendingObras();
      await loadPendingObras();
      await carregarEstatisticas();

      if (result.success === 0 && result.failed === 0) {
        Alert.alert('Sem conexao', 'Precisamos de internet para enviar as obras.');
        return;
      }

      if (result.failed > 0) {
        Alert.alert('Atencao', `${result.failed} item(ns) ainda estao na fila. Tente novamente.`);
      } else {
        Alert.alert('Pronto', `${result.success} item(ns) sincronizados.`);
      }
    } catch (error) {
      console.error('Erro ao sincronizar pendencias:', error);
      Alert.alert('Erro', 'Nao foi possivel sincronizar agora. Tente novamente.');
    } finally {
      setSyncingPending(false);
    }
  };

  const pendingMessage = isOnline
    ? pendingObrasUnicas > 0
      ? isCompressor
        ? `${pendingObrasUnicas} obra(s) de Cava em Rocha aguardando sincronizacao`
        : isAdmin
        ? `${pendingObrasUnicas} obra(s) aguardando sincronizacao`
        : `${pendingObrasUnicas} obra(s) da equipe aguardando sincronizacao`
      : isCompressor
      ? 'Todos os books de Cava em Rocha estao sincronizados'
      : isAdmin
      ? 'Todas as obras estao sincronizadas'
      : 'Tudo sincronizado para a sua equipe'
    : 'Cadastros ficam locais e sincronizam quando voltar a conexao';

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.scrollContent}>
      <View style={[styles.content, { paddingHorizontal: horizontalPadding }]}>

        {/* Hero Banner */}
        <View style={styles.heroBanner}>
          <View style={styles.heroLeft}>
            <Text style={styles.heroLabel}>Bem-vindo</Text>
            <Text style={styles.heroTitle} numberOfLines={1}>
              {equipeLogada ? equipeLogada : isAdmin ? 'Administrador' : 'Equipe'}
            </Text>
            <View style={styles.heroStatusPill}>
              <View style={[styles.heroDot, isOnline ? styles.heroDotOnline : styles.heroDotOffline]} />
              <Text style={styles.heroStatusText}>
                {isOnline ? 'Online' : 'Offline'}
              </Text>
            </View>
          </View>
          <View style={styles.heroRight}>
            <Text style={styles.heroStatNumber}>{loading ? '--' : totalObras}</Text>
            <Text style={styles.heroStatLabel}>obras</Text>
          </View>
        </View>

        {/* Nova Obra — ação principal em destaque */}
        <TouchableOpacity
          style={styles.primaryButton}
          onPress={() => router.push('/nova-obra-rapida')}
        >
          <View style={styles.primaryButtonContent}>
            <View style={styles.iconCircle}>
              <Text style={styles.iconText}>+</Text>
            </View>
            <Text style={[styles.primaryButtonText, isSmallScreen && styles.primaryButtonTextSmall]}>
              Iniciar Nova Obra
            </Text>
          </View>
        </TouchableOpacity>

        {/* Metrics */}
        <View style={[styles.metricsRow, isSmallScreen && styles.metricsRowStacked]}>
          <View style={[styles.metricCard, isSmallScreen && styles.metricCardStacked]}>
            <Text style={styles.metricIcon}>🏗️</Text>
            <Text style={styles.metricValue}>{loading ? '...' : totalObras}</Text>
            <Text style={styles.metricLabel}>{isAdmin ? 'Total de obras' : 'Obras da equipe'}</Text>
          </View>
          <View style={[
            styles.metricCard,
            isSmallScreen && styles.metricCardStacked,
            pendingObrasUnicas > 0 && styles.metricCardAlert,
          ]}>
            <Text style={styles.metricIcon}>{pendingObrasUnicas > 0 ? '⏳' : '✓'}</Text>
            <Text style={[styles.metricValue, pendingObrasUnicas > 0 && styles.metricAlert]}>
              {loading ? '...' : pendingObrasUnicas}
            </Text>
            <Text style={styles.metricLabel}>Pendentes de sync</Text>
          </View>
        </View>

        {/* Status Card — sincronização */}
        <View
          style={[
            styles.statusCard,
            isOnline ? styles.statusCardOnline : styles.statusCardOffline,
          ]}
        >
          <View style={styles.statusRow}>
            <View
              style={[
                styles.statusDot,
                isOnline ? styles.statusDotOnline : styles.statusDotOffline,
              ]}
            />
            <View style={styles.statusTexts}>
              <Text style={styles.statusTitle}>
                {isOnline ? 'Conectado ao servidor' : 'Modo offline ativo'}
              </Text>
              <Text style={styles.statusSubtitle}>{pendingMessage}</Text>
            </View>
          </View>

          {pendingObrasUnicas > 0 && (
            <TouchableOpacity
              style={[
                styles.statusButton,
                (!isOnline || syncingPending) && styles.statusButtonDisabled,
              ]}
              onPress={handleSyncPendingObras}
              disabled={!isOnline || syncingPending}
            >
              {syncingPending ? (
                <ActivityIndicator size="small" color="#fff" />
              ) : (
                <Text style={styles.statusButtonText}>Sincronizar agora</Text>
              )}
            </TouchableOpacity>
          )}
        </View>

      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#eef1f5',
  },
  scrollContent: {
    paddingBottom: 110,
  },
  content: {
    paddingVertical: 20,
    paddingHorizontal: 20,
  },
  heroBanner: {
    flexDirection: 'row',
    alignItems: 'stretch',
    justifyContent: 'space-between',
    borderRadius: 18,
    backgroundColor: '#dc3545',
    padding: 16,
    marginBottom: 14,
    shadowColor: '#7f1d1d',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.2,
    shadowRadius: 12,
    elevation: 5,
  },
  heroLeft: {
    flex: 1,
    paddingRight: 12,
  },
  heroLabel: {
    fontSize: 11,
    letterSpacing: 0.8,
    textTransform: 'uppercase',
    color: '#fecdd3',
    fontWeight: '700',
    marginBottom: 4,
  },
  heroTitle: {
    fontSize: 21,
    fontWeight: '900',
    color: '#fff',
    marginBottom: 10,
  },
  heroStatusPill: {
    alignSelf: 'flex-start',
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: 'rgba(255,255,255,0.18)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.26)',
    borderRadius: 999,
    paddingHorizontal: 10,
    paddingVertical: 5,
  },
  heroDot: {
    width: 7,
    height: 7,
    borderRadius: 4,
  },
  heroDotOnline: {
    backgroundColor: '#22c55e',
  },
  heroDotOffline: {
    backgroundColor: '#fbbf24',
  },
  heroStatusText: {
    color: '#fff',
    fontSize: 12,
    fontWeight: '700',
  },
  heroRight: {
    minWidth: 96,
    borderRadius: 14,
    backgroundColor: 'rgba(255,255,255,0.16)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.25)',
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 10,
    paddingVertical: 12,
  },
  heroStatNumber: {
    fontSize: 30,
    lineHeight: 34,
    color: '#fff',
    fontWeight: '900',
  },
  heroStatLabel: {
    marginTop: 2,
    fontSize: 12,
    color: '#fee2e2',
    fontWeight: '700',
    textTransform: 'uppercase',
    letterSpacing: 0.7,
  },
  header: {
    marginBottom: 16,
  },
  greeting: {
    fontSize: 13,
    fontWeight: '700',
    color: '#9ca3af',
    textTransform: 'uppercase',
    letterSpacing: 1,
    marginBottom: 2,
  },
  title: {
    fontSize: 30,
    fontWeight: '800',
    color: '#111827',
    marginBottom: 0,
  },
  subtitle: {
    fontSize: 15,
    color: '#6b7280',
    fontWeight: '500',
  },
  metricsRow: {
    flexDirection: 'row',
    marginHorizontal: -6,
    marginBottom: 14,
  },
  metricsRowStacked: {
    flexDirection: 'column',
    marginHorizontal: 0,
  },
  metricCard: {
    flex: 1,
    backgroundColor: '#ffffff',
    borderRadius: 14,
    padding: 14,
    marginHorizontal: 6,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.08,
    shadowRadius: 3,
    elevation: 2,
  },
  metricCardAlert: {
    borderWidth: 1,
    borderColor: '#fecaca',
    backgroundColor: '#fff5f5',
  },
  metricCardStacked: {
    marginHorizontal: 0,
    marginBottom: 10,
  },
  metricIcon: {
    fontSize: 18,
    marginBottom: 4,
  },
  metricLabel: {
    fontSize: 12,
    color: '#6b7280',
    marginBottom: 6,
    fontWeight: '600',
  },
  metricValue: {
    fontSize: 26,
    fontWeight: '800',
    color: '#1f2937',
  },
  metricAlert: {
    color: '#dc2626',
  },
  primaryButton: {
    backgroundColor: '#dc3545',
    borderRadius: 16,
    padding: 18,
    alignItems: 'center',
    marginBottom: 14,
    shadowColor: '#dc3545',
    shadowOffset: { width: 0, height: 5 },
    shadowOpacity: 0.25,
    shadowRadius: 8,
    elevation: 6,
  },
  primaryButtonContent: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  iconCircle: {
    width: 38,
    height: 38,
    borderRadius: 19,
    backgroundColor: '#fff',
    justifyContent: 'center',
    alignItems: 'center',
  },
  iconText: {
    fontSize: 28,
    fontWeight: '700',
    color: '#dc3545',
    lineHeight: 30,
  },
  primaryButtonText: {
    color: '#fff',
    fontSize: 19,
    fontWeight: '800',
    flexShrink: 1,
    textAlign: 'center',
  },
  primaryButtonTextSmall: {
    fontSize: 16,
  },
  statusCard: {
    backgroundColor: '#fff',
    borderRadius: 16,
    borderWidth: 1,
    padding: 16,
    marginBottom: 18,
    gap: 12,
  },
  statusCardOnline: {
    borderColor: '#bbf7d0',
    backgroundColor: '#f0fdf4',
  },
  statusCardOffline: {
    borderColor: '#fde68a',
    backgroundColor: '#fffbeb',
  },
  statusRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  statusDot: {
    width: 12,
    height: 12,
    borderRadius: 6,
  },
  statusDotOnline: {
    backgroundColor: '#16a34a',
  },
  statusDotOffline: {
    backgroundColor: '#d97706',
  },
  statusTexts: {
    flex: 1,
  },
  statusTitle: {
    fontSize: 15,
    fontWeight: '700',
    color: '#111827',
  },
  statusSubtitle: {
    fontSize: 13,
    color: '#4b5563',
    marginTop: 2,
    lineHeight: 18,
  },
  statusButton: {
    backgroundColor: '#dc3545',
    borderRadius: 10,
    paddingVertical: 12,
    alignItems: 'center',
  },
  statusButtonDisabled: {
    opacity: 0.55,
  },
  statusButtonText: {
    color: '#fff',
    fontSize: 14,
    fontWeight: '700',
  },
});
