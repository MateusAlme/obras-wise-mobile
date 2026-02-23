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

export default function Dashboard() {
  const router = useRouter();
  const { width } = useWindowDimensions();
  const [equipeLogada, setEquipeLogada] = useState('');
  const [userRole, setUserRole] = useState('');
  const [totalObras, setTotalObras] = useState(0);
  const [loading, setLoading] = useState(true);
  const [pendingObras, setPendingObras] = useState<PendingObra[]>([]);
  const [isOnline, setIsOnline] = useState(true);
  const [syncingPending, setSyncingPending] = useState(false);
  const isCompressor = userRole === 'compressor';
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

      let query = supabase
        .from('obras')
        .select('*', { count: 'exact', head: true });

      if (role !== 'admin') {
        query = query.eq('equipe', equipe);
      }

      if (role === 'compressor') {
        query = query.or('tipo_servico.eq.Cava em Rocha,creator_role.eq.compressor');
      }

      const { count, error } = await query;

      if (!error && count !== null) {
        setTotalObras(count);
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
      const pendentesDaEquipe = obras.filter((obra) => {
        if (role !== 'admin') {
          const mesmaEquipe = obra.equipe === equipe;
          if (!mesmaEquipe) return false;
        }
        if (role !== 'compressor') return true;
        return obra.tipo_servico === 'Cava em Rocha' || (obra as any).creator_role === 'compressor';
      });
      setPendingObras(pendentesDaEquipe);
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
    ? pendingObras.length > 0
      ? isCompressor
        ? `${pendingObras.length} book(s) de Cava em Rocha aguardando sincronizacao`
        : isAdmin
        ? `${pendingObras.length} obra(s) aguardando sincronizacao`
        : `${pendingObras.length} obra(s) da equipe aguardando sincronizacao`
      : isCompressor
      ? 'Todos os books de Cava em Rocha estao sincronizados'
      : isAdmin
      ? 'Todas as obras estao sincronizadas'
      : 'Tudo sincronizado para a sua equipe'
    : 'Cadastros ficam locais e sincronizam quando voltar a conexao';

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.scrollContent}>
      <View style={[styles.content, { paddingHorizontal: horizontalPadding }]}>
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

          {pendingObras.length > 0 && (
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

        <View style={styles.header}>
          <Text style={styles.title}>Inicio</Text>
          <Text style={styles.subtitle}>
            {equipeLogada ? `Equipe ${equipeLogada}` : 'Equipe nao identificada'}
          </Text>
        </View>

        <View style={[styles.metricsRow, isSmallScreen && styles.metricsRowStacked]}>
          <View style={[styles.metricCard, isSmallScreen && styles.metricCardStacked]}>
            <Text style={styles.metricLabel}>Obras da equipe</Text>
            <Text style={styles.metricValue}>{loading ? '...' : totalObras}</Text>
          </View>
          <View style={[styles.metricCard, isSmallScreen && styles.metricCardStacked]}>
            <Text style={styles.metricLabel}>Pendencias</Text>
            <Text style={[styles.metricValue, pendingObras.length > 0 && styles.metricAlert]}>
              {loading ? '...' : pendingObras.length}
            </Text>
          </View>
        </View>

        <TouchableOpacity
          style={styles.primaryButton}
          onPress={() => router.push('/nova-obra')}
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

        <View style={styles.card}>
          <Text style={styles.cardTitle}>Obras Cadastradas</Text>
          <Text style={styles.statsNumber}>{loading ? '--' : totalObras}</Text>
          <Text style={styles.cardText}>
            {totalObras === 0
              ? 'Nenhuma obra da sua equipe cadastrada ainda.'
              : `${totalObras} obra${totalObras > 1 ? 's' : ''} da sua equipe registrada${totalObras > 1 ? 's' : ''}.`}
          </Text>
        </View>

        <TouchableOpacity
          style={styles.secondaryButton}
          onPress={() => router.push('/(tabs)/obras')}
        >
          <Text style={[styles.secondaryButtonText, isSmallScreen && styles.secondaryButtonTextSmall]}>
            Ver Historico Completo
          </Text>
        </TouchableOpacity>
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
  header: {
    marginBottom: 14,
  },
  title: {
    fontSize: 32,
    fontWeight: '800',
    color: '#111827',
    marginBottom: 4,
  },
  subtitle: {
    fontSize: 16,
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
  metricCardStacked: {
    marginHorizontal: 0,
    marginBottom: 10,
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
  secondaryButton: {
    backgroundColor: '#fff',
    borderRadius: 12,
    padding: 16,
    alignItems: 'center',
    marginTop: 2,
    marginBottom: 20,
    borderWidth: 1,
    borderColor: '#d1d5db',
  },
  secondaryButtonText: {
    color: '#374151',
    fontSize: 15,
    fontWeight: '700',
    textAlign: 'center',
  },
  secondaryButtonTextSmall: {
    fontSize: 14,
  },
  card: {
    backgroundColor: '#fff',
    borderRadius: 16,
    padding: 20,
    marginBottom: 8,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.08,
    shadowRadius: 6,
    elevation: 3,
  },
  cardTitle: {
    fontSize: 17,
    fontWeight: '700',
    color: '#1f2937',
    marginBottom: 6,
  },
  cardText: {
    fontSize: 14,
    color: '#6b7280',
    lineHeight: 21,
  },
  statsNumber: {
    fontSize: 50,
    fontWeight: '800',
    color: '#dc3545',
    textAlign: 'center',
    marginVertical: 8,
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
