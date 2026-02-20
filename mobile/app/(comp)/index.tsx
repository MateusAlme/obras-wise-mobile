import { useState, useEffect, useCallback, useMemo } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  RefreshControl,
  ActivityIndicator,
  Alert,
  ScrollView,
  TextInput,
  useWindowDimensions,
} from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { useRouter, useFocusEffect } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { supabase } from '../../lib/supabase';
import {
  getPendingObras,
  syncAllPendingObras,
  startAutoSync,
  getLocalObras,
  checkInternetConnection,
} from '../../lib/offline-sync';
import AsyncStorage from '@react-native-async-storage/async-storage';

type ObraStatus = 'em_aberto' | 'finalizada' | 'rascunho';
type ObraFilter = 'todas' | 'em_aberto' | 'finalizada';
type SyncStatus = 'pending' | 'syncing' | 'failed' | 'partial';

type Obra = {
  id: string;
  data: string;
  obra: string;
  responsavel: string;
  equipe: string;
  status: ObraStatus;
  created_at: string;
  tipo_servico?: string;
  created_by?: string;
  sync_status?: SyncStatus;
  origem?: 'online' | 'offline';
  serverId?: string;
};

export default function CompIndex() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { width } = useWindowDimensions();
  const [obras, setObras] = useState<Obra[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [filter, setFilter] = useState<ObraFilter>('todas');
  const [searchTerm, setSearchTerm] = useState('');
  const [isOnline, setIsOnline] = useState(false);
  const [pendingCount, setPendingCount] = useState(0);
  const [syncingPending, setSyncingPending] = useState(false);
  const [equipeLogada, setEquipeLogada] = useState('');

  const horizontalPadding = width < 360 ? 14 : width < 430 ? 18 : 22;
  const isSmallScreen = width < 380;

  useEffect(() => {
    loadCompSession();
    checkCompAccess();
    loadObras();
    checkConnection();

    const unsubscribe = startAutoSync(async (result) => {
      if (result.success > 0) {
        Alert.alert('Sincronizacao concluida', `${result.success} obra(s) sincronizada(s).`);
        await loadObras();
      }
      if (result.failed > 0) {
        Alert.alert('Atencao', `${result.failed} obra(s) nao puderam ser sincronizadas.`);
      }
    });

    return () => {
      unsubscribe?.();
    };
  }, []);

  useFocusEffect(
    useCallback(() => {
      loadCompSession();
      loadObras();
      checkConnection();
    }, [])
  );

  const filteredObras = useMemo(() => {
    const byStatus = filter === 'todas' ? obras : obras.filter((o) => o.status === filter);
    const term = searchTerm.trim().toLowerCase();
    if (!term) return byStatus;

    return byStatus.filter((obra) => {
      const target = `${obra.obra} ${obra.responsavel} ${obra.equipe}`.toLowerCase();
      return target.includes(term);
    });
  }, [obras, filter, searchTerm]);

  const openCount = useMemo(() => obras.filter((o) => o.status === 'em_aberto').length, [obras]);
  const doneCount = useMemo(() => obras.filter((o) => o.status === 'finalizada').length, [obras]);

  const loadCompSession = async () => {
    try {
      const equipe = await AsyncStorage.getItem('@equipe_logada');
      setEquipeLogada(equipe || '');
    } catch (error) {
      console.error('Erro ao carregar equipe do compressor:', error);
    }
  };

  const checkCompAccess = async () => {
    try {
      const role = await AsyncStorage.getItem('@user_role');
      if (role !== 'compressor') {
        router.replace('/login');
      }
    } catch (error) {
      console.error('Erro ao validar perfil compressor:', error);
      router.replace('/login');
    }
  };

  const checkConnection = async () => {
    const online = await checkInternetConnection();
    setIsOnline(online);
  };

  const handleSyncPendingObras = async () => {
    try {
      setSyncingPending(true);
      const result = await syncAllPendingObras();

      if (result.success > 0) {
        Alert.alert('Sucesso', `${result.success} obra(s) sincronizada(s).`);
        await loadObras();
      }

      if (result.failed > 0) {
        Alert.alert('Atencao', `${result.failed} obra(s) nao puderam ser sincronizadas.`);
      }

      if (result.success === 0 && result.failed === 0) {
        Alert.alert('Info', 'Nao ha obras pendentes para sincronizar.');
      }
    } catch (error) {
      Alert.alert('Erro', 'Erro ao sincronizar obras. Tente novamente.');
    } finally {
      setSyncingPending(false);
    }
  };

  const parseStatus = (status: unknown): ObraStatus => {
    if (status === 'finalizada' || status === 'rascunho' || status === 'em_aberto') {
      return status;
    }
    return 'em_aberto';
  };

  const sortByCreatedAt = (items: Obra[]) => {
    return [...items].sort((a, b) => {
      const aTs = new Date(a.created_at || a.data).getTime() || 0;
      const bTs = new Date(b.created_at || b.data).getTime() || 0;
      return bTs - aTs;
    });
  };

  const mergeObras = (online: Obra[], local: Obra[], pending: Obra[]) => {
    const merged = new Map<string, Obra>();
    for (const obra of online) merged.set(obra.id, obra);
    for (const obra of local) merged.set(obra.id, obra);
    for (const obra of pending) merged.set(obra.id, obra);
    return sortByCreatedAt(Array.from(merged.values()));
  };

  const loadObras = async () => {
    try {
      setLoading(true);

      const online = await checkInternetConnection();
      setIsOnline(online);

      let obrasOnline: Obra[] = [];
      let obrasPendentes: Obra[] = [];
      let obrasLocais: Obra[] = [];

      if (online) {
        try {
          const { data, error } = await supabase
            .from('obras')
            .select('*')
            .or('tipo_servico.eq.Cava em Rocha,creator_role.eq.compressor')
            .order('created_at', { ascending: false });

          if (error) {
            console.error('Erro ao carregar obras online do compressor:', error);
          } else if (data) {
            obrasOnline = data.map((obra) => ({
              ...obra,
              status: parseStatus(obra.status),
              origem: 'online' as const,
            }));
          }
        } catch (error) {
          console.error('Erro ao buscar obras online do compressor:', error);
        }
      }

      try {
        const pendentes = await getPendingObras();
        const pendentesComp = pendentes.filter((p) => p.tipo_servico === 'Cava em Rocha');

        obrasPendentes = pendentesComp.map((p) => ({
          id: p.id,
          data: p.data,
          obra: p.obra,
          responsavel: p.responsavel || equipeLogada,
          equipe: p.equipe || equipeLogada,
          status: 'em_aberto',
          created_at: p.created_at || p.data,
          sync_status: (p.sync_status || 'pending') as SyncStatus,
          origem: 'offline',
        }));
      } catch (error) {
        console.error('Erro ao carregar obras pendentes do compressor:', error);
      }

      try {
        const locais = await getLocalObras();
        const locaisComp = locais.filter((l) => l.tipo_servico === 'Cava em Rocha');

        obrasLocais = locaisComp.map((l) => ({
          id: l.id,
          data: l.data,
          obra: l.obra,
          responsavel: l.responsavel || equipeLogada,
          equipe: l.equipe || equipeLogada,
          status: parseStatus(l.status),
          created_at: l.created_at || l.data,
          sync_status: (l.sync_status ?? (l.synced ? undefined : 'pending')) as SyncStatus | undefined,
          origem: 'offline',
          serverId: l.serverId,
        }));
      } catch (error) {
        console.error('Erro ao carregar obras locais do compressor:', error);
      }

      const todasObras = mergeObras(obrasOnline, obrasLocais, obrasPendentes);
      setObras(todasObras);

      const pendingTotal = todasObras.filter(
        (obra) =>
          obra.origem === 'offline' &&
          (obra.sync_status === 'pending' ||
            obra.sync_status === 'syncing' ||
            obra.sync_status === 'failed' ||
            obra.sync_status === 'partial')
      ).length;
      setPendingCount(pendingTotal);
    } catch (error) {
      console.error('Erro ao carregar obras do compressor:', error);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  const onRefresh = () => {
    setRefreshing(true);
    loadObras();
  };

  const formatDate = (dateString: string) => {
    try {
      if (/^\d{4}-\d{2}-\d{2}$/.test(dateString)) {
        const [year, month, day] = dateString.split('-').map(Number);
        return new Date(year, month - 1, day).toLocaleDateString('pt-BR');
      }
      return new Date(dateString).toLocaleDateString('pt-BR');
    } catch {
      return dateString;
    }
  };

  const openObra = (item: Obra) => {
    router.push({
      pathname: '/obra-detalhe',
      params: { data: encodeURIComponent(JSON.stringify({ ...item, origem: item.origem || 'online' })) },
    });
  };

  const renderSyncBadge = (obra: Obra) => {
    if (obra.origem !== 'offline') return null;
    if (!obra.sync_status && obra.serverId) return null;

    const label =
      obra.sync_status === 'partial'
        ? 'Sync parcial'
        : obra.sync_status === 'failed'
        ? 'Falha no sync'
        : obra.sync_status === 'syncing'
        ? 'Sincronizando'
        : 'Pendente';

    const style =
      obra.sync_status === 'partial'
        ? styles.syncIndicatorPartial
        : obra.sync_status === 'failed'
        ? styles.syncIndicatorFailed
        : obra.sync_status === 'syncing'
        ? styles.syncIndicatorSyncing
        : styles.syncIndicatorPending;

    const textStyle =
      obra.sync_status === 'partial'
        ? styles.syncIndicatorTextPartial
        : obra.sync_status === 'failed'
        ? styles.syncIndicatorTextFailed
        : obra.sync_status === 'syncing'
        ? styles.syncIndicatorTextSyncing
        : styles.syncIndicatorTextPending;

    return (
      <View style={[styles.syncIndicator, style]}>
        <Text style={textStyle}>{label}</Text>
      </View>
    );
  };

  const renderStatusBadge = (status: ObraStatus) => {
    const isFinalizada = status === 'finalizada';
    const isRascunho = status === 'rascunho';

    return (
      <View
        style={[
          styles.statusBadge,
          isFinalizada
            ? styles.statusBadgeFinalizada
            : isRascunho
            ? styles.statusBadgeRascunho
            : styles.statusBadgeAberta,
        ]}
      >
        <Text style={styles.statusBadgeText}>
          {isFinalizada ? 'Finalizada' : isRascunho ? 'Rascunho' : 'Em aberto'}
        </Text>
      </View>
    );
  };

  if (loading && obras.length === 0) {
    return (
      <SafeAreaView style={styles.safeArea} edges={['top', 'bottom']}>
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color="#dc3545" />
          <Text style={styles.loadingText}>Carregando obras...</Text>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.safeArea} edges={['top', 'bottom']}>
      <ScrollView
        style={styles.container}
        contentContainerStyle={[styles.scrollContent, { paddingBottom: 120 + insets.bottom }]}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
      >
        <View style={[styles.content, { paddingHorizontal: horizontalPadding }]}>
          <View style={styles.equipeBanner}>
            <View style={styles.equipeInfo}>
              <Text style={styles.equipeLabel}>Perfil compressor</Text>
              <Text style={styles.equipeNome}>{equipeLogada || 'Compressor'}</Text>
            </View>
            <View style={[styles.onlinePill, !isOnline && styles.offlinePill]}>
              <Text style={[styles.onlinePillText, !isOnline && styles.offlinePillText]}>
                {isOnline ? 'Online' : 'Offline'}
              </Text>
            </View>
          </View>

          <View style={styles.header}>
            <Text style={[styles.title, isSmallScreen && styles.titleSmall]}>Cava em Rocha</Text>
            <Text style={[styles.subtitle, isSmallScreen && styles.subtitleSmall]}>
              {filteredObras.length} de {obras.length} obra(s)
            </Text>
          </View>

          <View style={[styles.metricsRow, isSmallScreen && styles.metricsRowStacked]}>
            <View style={[styles.metricCard, isSmallScreen && styles.metricCardStacked]}>
              <Text style={styles.metricLabel}>Total</Text>
              <Text style={styles.metricValue}>{obras.length}</Text>
            </View>
            <View style={[styles.metricCard, isSmallScreen && styles.metricCardStacked]}>
              <Text style={styles.metricLabel}>Em aberto</Text>
              <Text style={styles.metricValue}>{openCount}</Text>
            </View>
            <View style={[styles.metricCard, isSmallScreen && styles.metricCardStacked]}>
              <Text style={styles.metricLabel}>Finalizadas</Text>
              <Text style={styles.metricValue}>{doneCount}</Text>
            </View>
          </View>

          <View style={styles.filterContainer}>
            <TouchableOpacity
              style={[styles.filterButton, filter === 'todas' && styles.filterButtonActive]}
              onPress={() => setFilter('todas')}
            >
              <Text style={[styles.filterButtonText, filter === 'todas' && styles.filterButtonTextActive]}>
                Todas ({obras.length})
              </Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.filterButton, filter === 'em_aberto' && styles.filterButtonActive]}
              onPress={() => setFilter('em_aberto')}
            >
              <Text style={[styles.filterButtonText, filter === 'em_aberto' && styles.filterButtonTextActive]}>
                Em aberto ({openCount})
              </Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.filterButton, filter === 'finalizada' && styles.filterButtonActive]}
              onPress={() => setFilter('finalizada')}
            >
              <Text style={[styles.filterButtonText, filter === 'finalizada' && styles.filterButtonTextActive]}>
                Finalizadas ({doneCount})
              </Text>
            </TouchableOpacity>
          </View>

          <View style={styles.searchContainer}>
            <Text style={styles.searchPrefix}>Buscar</Text>
            <TextInput
              style={styles.searchInput}
              placeholder="Numero da obra, responsavel ou equipe"
              value={searchTerm}
              onChangeText={setSearchTerm}
              autoCorrect={false}
              autoCapitalize="none"
            />
          </View>

          {pendingCount > 0 && (
            <View style={styles.syncBanner}>
              <View style={styles.syncBannerInfo}>
                <Ionicons name="cloud-upload-outline" size={18} color="#d97706" />
                <View style={styles.syncBannerTextContainer}>
                  <Text style={styles.syncBannerTitle}>{pendingCount} obra(s) aguardando sincronizacao</Text>
                  <Text style={styles.syncBannerSubtitle}>
                    {isOnline ? 'Envie agora para concluir o upload.' : 'Conecte-se para enviar as obras.'}
                  </Text>
                </View>
              </View>
              <TouchableOpacity
                style={[
                  styles.syncBannerButton,
                  (!isOnline || syncingPending) && styles.syncBannerButtonDisabled,
                ]}
                onPress={handleSyncPendingObras}
                disabled={!isOnline || syncingPending}
              >
                {syncingPending ? (
                  <ActivityIndicator size="small" color="#fff" />
                ) : (
                  <Text style={styles.syncBannerButtonText}>Sincronizar</Text>
                )}
              </TouchableOpacity>
            </View>
          )}

          {filteredObras.length === 0 ? (
            <View style={styles.emptyCard}>
              <Ionicons name="construct-outline" size={48} color="#94a3b8" />
              <Text style={styles.emptyTitle}>Nenhuma obra registrada</Text>
              <Text style={styles.emptySubtitle}>Toque no botao + para iniciar o book de Cava em Rocha.</Text>
            </View>
          ) : (
            filteredObras.map((item) => (
              <TouchableOpacity
                key={`${item.origem || 'online'}_${item.id}`}
                style={[
                  styles.obraCard,
                  item.status === 'finalizada' && styles.obraCardFinalizada,
                  item.status === 'rascunho' && styles.obraCardRascunho,
                ]}
                onPress={() => openObra(item)}
                activeOpacity={0.8}
              >
                <View style={styles.obraHeader}>
                  <View style={styles.obraHeaderLeft}>
                    <Text style={styles.obraNumero}>Obra {item.obra}</Text>
                    <Text style={styles.obraData}>{formatDate(item.data || item.created_at)}</Text>
                  </View>
                  {renderStatusBadge(item.status)}
                </View>

                <View style={styles.obraInfo}>
                  <Text style={styles.obraLabel}>Equipe</Text>
                  <Text style={styles.obraValue}>{item.equipe || equipeLogada}</Text>
                </View>

                <View style={styles.obraInfo}>
                  <Text style={styles.obraLabel}>Responsavel</Text>
                  <Text style={styles.obraValue}>{item.responsavel || equipeLogada}</Text>
                </View>

                {renderSyncBadge(item)}

                <Text style={styles.verMais}>Ver detalhes</Text>
              </TouchableOpacity>
            ))
          )}
        </View>
      </ScrollView>

      <TouchableOpacity style={[styles.fab, { bottom: 22 + insets.bottom }]} onPress={() => router.push('/nova-obra')}>
        <Ionicons name="add" size={30} color="#fff" />
      </TouchableOpacity>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: '#f6f8fb',
  },
  container: {
    flex: 1,
  },
  scrollContent: {
    paddingTop: 14,
  },
  content: {
    width: '100%',
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 20,
  },
  loadingText: {
    marginTop: 12,
    fontSize: 15,
    color: '#475569',
  },
  equipeBanner: {
    backgroundColor: '#dc3545',
    borderRadius: 12,
    padding: 14,
    marginBottom: 14,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  equipeInfo: {
    flex: 1,
    paddingRight: 8,
  },
  equipeLabel: {
    fontSize: 12,
    color: 'rgba(255,255,255,0.85)',
  },
  equipeNome: {
    fontSize: 18,
    fontWeight: '800',
    color: '#fff',
    marginTop: 2,
  },
  onlinePill: {
    backgroundColor: 'rgba(255,255,255,0.22)',
    borderRadius: 999,
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.35)',
  },
  onlinePillText: {
    color: '#fff',
    fontSize: 12,
    fontWeight: '700',
  },
  offlinePill: {
    backgroundColor: '#fef3c7',
    borderColor: '#fde68a',
  },
  offlinePillText: {
    color: '#92400e',
  },
  header: {
    marginBottom: 10,
  },
  title: {
    fontSize: 28,
    fontWeight: '800',
    color: '#0f172a',
    lineHeight: 32,
  },
  titleSmall: {
    fontSize: 24,
    lineHeight: 28,
  },
  subtitle: {
    marginTop: 4,
    fontSize: 14,
    color: '#64748b',
  },
  subtitleSmall: {
    fontSize: 13,
  },
  metricsRow: {
    flexDirection: 'row',
    gap: 10,
    marginBottom: 12,
  },
  metricsRowStacked: {
    flexWrap: 'wrap',
  },
  metricCard: {
    flex: 1,
    minWidth: 90,
    backgroundColor: '#fff',
    borderRadius: 12,
    paddingVertical: 12,
    paddingHorizontal: 12,
    borderWidth: 1,
    borderColor: '#e2e8f0',
  },
  metricCardStacked: {
    minWidth: '48%',
  },
  metricLabel: {
    fontSize: 12,
    color: '#64748b',
  },
  metricValue: {
    marginTop: 4,
    fontSize: 20,
    fontWeight: '800',
    color: '#0f172a',
  },
  filterContainer: {
    flexDirection: 'row',
    gap: 8,
    marginBottom: 12,
  },
  filterButton: {
    flex: 1,
    backgroundColor: '#fff',
    borderRadius: 10,
    paddingVertical: 10,
    paddingHorizontal: 8,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#dbe2ea',
  },
  filterButtonActive: {
    backgroundColor: '#dc3545',
    borderColor: '#dc3545',
  },
  filterButtonText: {
    fontSize: 12,
    color: '#475569',
    fontWeight: '700',
    textAlign: 'center',
  },
  filterButtonTextActive: {
    color: '#fff',
  },
  searchContainer: {
    marginBottom: 12,
    backgroundColor: '#fff',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#dbe2ea',
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 12,
    paddingVertical: 2,
  },
  searchPrefix: {
    fontSize: 12,
    color: '#64748b',
    marginRight: 8,
    fontWeight: '700',
    textTransform: 'uppercase',
  },
  searchInput: {
    flex: 1,
    backgroundColor: '#fff',
    borderRadius: 10,
    paddingHorizontal: 6,
    paddingVertical: 12,
    fontSize: 14,
    color: '#0f172a',
  },
  syncBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: '#fff7ed',
    borderLeftWidth: 4,
    borderLeftColor: '#fb923c',
    borderRadius: 12,
    padding: 12,
    marginBottom: 12,
    gap: 10,
  },
  syncBannerInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    flex: 1,
  },
  syncBannerTextContainer: {
    flex: 1,
  },
  syncBannerTitle: {
    fontSize: 13,
    fontWeight: '700',
    color: '#9a3412',
  },
  syncBannerSubtitle: {
    marginTop: 2,
    fontSize: 12,
    color: '#7c2d12',
  },
  syncBannerButton: {
    backgroundColor: '#f97316',
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 8,
    minWidth: 102,
    alignItems: 'center',
    justifyContent: 'center',
  },
  syncBannerButtonDisabled: {
    backgroundColor: '#cbd5e1',
  },
  syncBannerButtonText: {
    color: '#fff',
    fontSize: 13,
    fontWeight: '700',
  },
  emptyCard: {
    backgroundColor: '#fff',
    borderRadius: 14,
    borderWidth: 1,
    borderColor: '#e2e8f0',
    paddingVertical: 30,
    paddingHorizontal: 20,
    alignItems: 'center',
    justifyContent: 'center',
  },
  emptyTitle: {
    marginTop: 10,
    fontSize: 17,
    fontWeight: '700',
    color: '#334155',
    textAlign: 'center',
  },
  emptySubtitle: {
    marginTop: 6,
    fontSize: 13,
    color: '#64748b',
    textAlign: 'center',
    lineHeight: 18,
  },
  obraCard: {
    backgroundColor: '#fff',
    borderRadius: 14,
    padding: 16,
    marginBottom: 12,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.08,
    shadowRadius: 5,
    elevation: 2,
    borderLeftWidth: 4,
    borderLeftColor: '#dc3545',
    borderWidth: 1,
    borderColor: '#e2e8f0',
  },
  obraCardFinalizada: {
    borderLeftColor: '#16a34a',
  },
  obraCardRascunho: {
    borderLeftColor: '#f59e0b',
  },
  obraHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 10,
    paddingBottom: 10,
    borderBottomWidth: 1,
    borderBottomColor: '#eef2f7',
    gap: 8,
  },
  obraHeaderLeft: {
    flex: 1,
    minWidth: 0,
    gap: 6,
  },
  obraNumero: {
    fontSize: 16,
    fontWeight: '800',
    color: '#0f172a',
  },
  obraData: {
    alignSelf: 'flex-start',
    fontSize: 12,
    color: '#475569',
    backgroundColor: '#eef2f7',
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 10,
  },
  obraInfo: {
    marginBottom: 6,
  },
  obraLabel: {
    fontSize: 12,
    color: '#94a3b8',
    marginBottom: 2,
  },
  obraValue: {
    fontSize: 14,
    color: '#1f2937',
    fontWeight: '700',
  },
  statusBadge: {
    borderRadius: 8,
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderWidth: 1,
  },
  statusBadgeFinalizada: {
    backgroundColor: '#e8f7ed',
    borderColor: '#bbf7d0',
  },
  statusBadgeAberta: {
    backgroundColor: '#fff7ed',
    borderColor: '#fdba74',
  },
  statusBadgeRascunho: {
    backgroundColor: '#fef3c7',
    borderColor: '#fcd34d',
  },
  statusBadgeText: {
    fontSize: 11,
    fontWeight: '700',
    color: '#155724',
  },
  syncIndicator: {
    alignSelf: 'flex-start',
    borderRadius: 8,
    paddingHorizontal: 10,
    paddingVertical: 6,
    marginTop: 6,
    borderWidth: 1,
  },
  syncIndicatorPending: {
    backgroundColor: '#fff7ed',
    borderColor: '#fdba74',
  },
  syncIndicatorSyncing: {
    backgroundColor: '#e0f2fe',
    borderColor: '#7dd3fc',
  },
  syncIndicatorPartial: {
    backgroundColor: '#fff7ed',
    borderColor: '#fb923c',
  },
  syncIndicatorFailed: {
    backgroundColor: '#fee2e2',
    borderColor: '#fca5a5',
  },
  syncIndicatorTextPending: {
    fontSize: 11,
    fontWeight: '700',
    color: '#b45309',
  },
  syncIndicatorTextSyncing: {
    fontSize: 11,
    fontWeight: '700',
    color: '#0369a1',
  },
  syncIndicatorTextPartial: {
    fontSize: 11,
    fontWeight: '700',
    color: '#c2410c',
  },
  syncIndicatorTextFailed: {
    fontSize: 11,
    fontWeight: '700',
    color: '#b91c1c',
  },
  verMais: {
    marginTop: 10,
    fontSize: 12,
    color: '#2563eb',
    textAlign: 'right',
    fontWeight: '700',
  },
  fab: {
    position: 'absolute',
    right: 20,
    width: 58,
    height: 58,
    borderRadius: 29,
    backgroundColor: '#dc3545',
    justifyContent: 'center',
    alignItems: 'center',
    shadowColor: '#dc3545',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.35,
    shadowRadius: 8,
    elevation: 8,
  },
});
