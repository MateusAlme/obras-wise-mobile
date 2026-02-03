import { useState, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  TouchableOpacity,
  RefreshControl,
  ActivityIndicator,
  Alert,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter, useFocusEffect } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { supabase } from '../../lib/supabase';
import { getPendingObras, PendingObra, syncAllPendingObras, startAutoSync, getLocalObras } from '../../lib/offline-sync';
import { checkInternetConnection } from '../../lib/offline-sync';
import AsyncStorage from '@react-native-async-storage/async-storage';

type Obra = {
  id: string;
  data: string;
  obra: string;
  responsavel: string;
  equipe: string;
  status: 'em_aberto' | 'finalizada';
  created_at: string;
  created_by?: string;
  sync_status?: 'pending' | 'syncing' | 'failed'; // Para obras offline
  origem?: 'online' | 'offline'; // Para identificar origem
};

export default function CompIndex() {
  const router = useRouter();
  const [obras, setObras] = useState<Obra[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [filter, setFilter] = useState<'todas' | 'em_aberto' | 'finalizada'>('todas');
  const [isOnline, setIsOnline] = useState(false);
  const [pendingCount, setPendingCount] = useState(0);
  const [syncingPending, setSyncingPending] = useState(false);

  useEffect(() => {
    checkCompAccess();
    loadObras();
    checkConnection();

    // Auto-sync quando conectar à internet
    const unsubscribe = startAutoSync(async (result) => {
      if (result.success > 0) {
        Alert.alert(
          'Sincronização Concluída',
          `${result.success} obra(s) sincronizada(s) com sucesso!`
        );
        await loadObras();
      }
      if (result.failed > 0) {
        Alert.alert(
          'Atenção',
          `${result.failed} obra(s) não puderam ser sincronizadas. Tente novamente.`
        );
      }
    });

    return () => {
      unsubscribe?.();
    };
  }, []);

  // Recarregar quando a tela recebe foco
  useFocusEffect(
    useCallback(() => {
      loadObras();
      checkConnection();
    }, [])
  );

  const checkCompAccess = async () => {
    const role = await AsyncStorage.getItem('@user_role');
    if (role !== 'compressor') {
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
        Alert.alert(
          'Sucesso',
          `${result.success} obra(s) sincronizada(s) com sucesso!`
        );
        await loadObras();
      }

      if (result.failed > 0) {
        Alert.alert(
          'Atenção',
          `${result.failed} obra(s) não puderam ser sincronizadas. Verifique a conexão e tente novamente.`
        );
      }

      if (result.success === 0 && result.failed === 0) {
        Alert.alert('Info', 'Não há obras pendentes para sincronizar.');
      }
    } catch (error) {
      Alert.alert('Erro', 'Erro ao sincronizar obras. Tente novamente.');
    } finally {
      setSyncingPending(false);
    }
  };

  const loadObras = async () => {
    try {
      setLoading(true);

      const isOnline = await checkInternetConnection();
      let obrasOnline: Obra[] = [];
      let obrasPendentes: Obra[] = [];

      // Carregar obras online se houver internet
      if (isOnline) {
        try {
          // DEBUG: Primeiro buscar TODAS as obras para ver o que tem
          const { data: todasObras, error: debugError } = await supabase
            .from('obras')
            .select('id, obra, tipo_servico, creator_role, responsavel, created_at')
            .order('created_at', { ascending: false })
            .limit(10);

          console.log('🔍 [COMP DEBUG] Últimas 10 obras no banco:', todasObras?.map(o => ({
            id: o.id?.substring(0, 8),
            obra: o.obra,
            tipo: o.tipo_servico,
            creator: o.creator_role,
            resp: o.responsavel
          })));

          if (debugError) {
            console.error('❌ [COMP DEBUG] Erro:', debugError.message);
          }

          // Buscar apenas obras de Cava em Rocha (serviço exclusivo do COMP)
          // Também buscar por creator_role = 'compressor' como fallback
          const { data, error } = await supabase
            .from('obras')
            .select('*')
            .or('tipo_servico.eq.Cava em Rocha,creator_role.eq.compressor')
            .order('created_at', { ascending: false });

          console.log('🌐 [COMP] Obras encontradas (Cava em Rocha OU creator_role=compressor):', data?.length || 0);

          if (error) {
            console.error('❌ [COMP] Erro na query:', error);
          }

          if (!error && data) {
            obrasOnline = data.map(obra => ({ ...obra, origem: 'online' as const }));
          }
        } catch (error) {
          console.error('Erro ao carregar obras online:', error);
        }
      }

      // Carregar obras pendentes (offline - sincronização)
      try {
        const pendentes = await getPendingObras();
        console.log('📊 [COMP] Total de obras pendentes:', pendentes.length);

        // Filtrar apenas obras de Cava em Rocha
        // NOTA: Cava em Rocha é serviço EXCLUSIVO do COMP, não precisa verificar responsavel/creator_role
        const pendentesCOMP = pendentes.filter(p => {
          const isCavaRocha = p.tipo_servico === 'Cava em Rocha';

          // Log para debug
          if (isCavaRocha) {
            console.log('🔍 [COMP] Obra pendente Cava em Rocha:', {
              id: p.id,
              obra: p.obra,
              responsavel: p.responsavel,
              status: p.sync_status,
            });
          }

          return isCavaRocha; // Cava em Rocha = COMP (exclusivo)
        });

        console.log('✅ [COMP] Obras pendentes do COMP:', pendentesCOMP.length);

        obrasPendentes = pendentesCOMP.map(p => ({
          id: p.id,
          data: p.data,
          obra: p.obra,
          responsavel: p.responsavel,
          equipe: p.equipe,
          status: 'em_aberto' as const,
          created_at: p.created_at,
          sync_status: p.sync_status,
          origem: 'offline' as const,
        }));
      } catch (error) {
        console.error('Erro ao carregar obras pendentes:', error);
      }

      // Carregar obras locais (rascunhos e não sincronizadas)
      let obrasLocais: Obra[] = [];
      try {
        const locais = await getLocalObras();
        console.log('📊 [COMP] Total de obras locais:', locais.length);

        // Filtrar apenas obras de Cava em Rocha
        // NOTA: Cava em Rocha é serviço EXCLUSIVO do COMP, não precisa verificar responsavel/creator_role
        const locaisCOMP = locais.filter(l => {
          const isCavaRocha = l.tipo_servico === 'Cava em Rocha';

          // Log para debug
          if (isCavaRocha) {
            console.log('🔍 [COMP] Obra local Cava em Rocha:', {
              id: l.id,
              obra: l.obra,
              responsavel: l.responsavel,
              status: l.status,
              synced: l.synced,
            });
          }

          return isCavaRocha; // Cava em Rocha = COMP (exclusivo)
        });

        console.log('✅ [COMP] Obras locais do COMP:', locaisCOMP.length);

        obrasLocais = locaisCOMP.map(l => ({
          id: l.id,
          data: l.data,
          obra: l.obra,
          responsavel: l.responsavel || 'COMP',
          equipe: l.equipe,
          status: (l.status || 'em_aberto') as 'em_aberto' | 'finalizada',
          created_at: l.created_at,
          sync_status: l.synced ? undefined : 'pending',
          origem: 'offline' as const,
        }));
      } catch (error) {
        console.error('Erro ao carregar obras locais:', error);
      }

      // Combinar obras: pendentes primeiro, depois locais, depois online
      // Remover duplicatas (obras que estão tanto em pendentes quanto em locais)
      const localIds = new Set(obrasLocais.map(o => o.id));
      const obrasLocaisUnicas = obrasLocais.filter(l => !obrasPendentes.some(p => p.id === l.id));

      const todasObras = [...obrasPendentes, ...obrasLocaisUnicas, ...obrasOnline];
      setObras(todasObras);
      setPendingCount(obrasPendentes.length + obrasLocaisUnicas.length);
    } catch (error) {
      console.error('Erro ao carregar obras:', error);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  const onRefresh = () => {
    setRefreshing(true);
    loadObras();
  };

  const getFilteredObras = () => {
    if (filter === 'todas') return obras;
    return obras.filter(o => o.status === filter);
  };

  const formatDate = (dateString: string) => {
    try {
      const date = new Date(dateString);
      return date.toLocaleDateString('pt-BR');
    } catch {
      return dateString;
    }
  };

  const renderObraCard = ({ item }: { item: Obra }) => (
    <TouchableOpacity
      style={styles.card}
      onPress={() => {
        router.push({
          pathname: '/obra-detalhe',
          params: { data: encodeURIComponent(JSON.stringify({ ...item, origem: item.origem || 'online' })) },
        });
      }}
      activeOpacity={0.7}
    >
      <View style={styles.cardHeader}>
        <View style={styles.cardHeaderLeft}>
          <Ionicons name="construct" size={20} color="#dc3545" />
          <Text style={styles.cardTitle}>Obra {item.obra}</Text>
          {item.origem === 'offline' && (
            <View style={styles.offlineBadge}>
              <Ionicons name="cloud-offline-outline" size={14} color="#ff9800" />
              <Text style={styles.offlineBadgeText}>Pendente</Text>
            </View>
          )}
        </View>
        <View
          style={[
            styles.statusBadge,
            item.status === 'finalizada' ? styles.statusFinalizada : styles.statusAberta,
          ]}
        >
          <Text style={styles.statusText}>
            {item.status === 'finalizada' ? 'Finalizada' : 'Em Aberto'}
          </Text>
        </View>
      </View>

      <View style={styles.cardBody}>
        <View style={styles.infoRow}>
          <Ionicons name="calendar-outline" size={16} color="#666" />
          <Text style={styles.infoText}>{formatDate(item.data)}</Text>
        </View>

        <View style={styles.infoRow}>
          <Ionicons name="people-outline" size={16} color="#666" />
          <Text style={styles.infoText}>Equipe: {item.equipe}</Text>
        </View>

        <View style={styles.infoRow}>
          <Ionicons name="person-outline" size={16} color="#666" />
          <Text style={styles.infoText}>{item.responsavel}</Text>
        </View>
      </View>

      <View style={styles.cardFooter}>
        <Text style={styles.cardDate}>
          Lançado em {formatDate(item.created_at)}
        </Text>
        <Ionicons name="chevron-forward" size={20} color="#999" />
      </View>
    </TouchableOpacity>
  );

  const renderEmptyState = () => (
    <View style={styles.emptyState}>
      <Ionicons name="construct-outline" size={64} color="#ccc" />
      <Text style={styles.emptyTitle}>Nenhuma obra registrada</Text>
      <Text style={styles.emptySubtitle}>
        Toque no botão + para registrar um serviço de Cava em Rocha
      </Text>
    </View>
  );

  if (loading) {
    return (
      <SafeAreaView style={styles.safeArea} edges={['top', 'bottom']}>
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color="#dc3545" />
          <Text style={styles.loadingText}>Carregando obras...</Text>
        </View>
      </SafeAreaView>
    );
  }

  const filteredObras = getFilteredObras();

  return (
    <SafeAreaView style={styles.safeArea} edges={['top', 'bottom']}>
      <View style={styles.container}>
        {/* Header */}
        <View style={styles.header}>
          <View>
            <Text style={styles.headerTitle}>Cava em Rocha</Text>
            <Text style={styles.headerSubtitle}>
              {obras.length} registro(s) • COMP
            </Text>
          </View>
        </View>

        {/* Filtros */}
        <View style={styles.filterContainer}>
          <TouchableOpacity
            style={[styles.filterButton, filter === 'todas' && styles.filterButtonActive]}
            onPress={() => setFilter('todas')}
          >
            <Text
              style={[
                styles.filterButtonText,
                filter === 'todas' && styles.filterButtonTextActive,
              ]}
            >
              Todas ({obras.length})
            </Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={[styles.filterButton, filter === 'em_aberto' && styles.filterButtonActive]}
            onPress={() => setFilter('em_aberto')}
          >
            <Text
              style={[
                styles.filterButtonText,
                filter === 'em_aberto' && styles.filterButtonTextActive,
              ]}
            >
              Em Aberto ({obras.filter(o => o.status === 'em_aberto').length})
            </Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={[styles.filterButton, filter === 'finalizada' && styles.filterButtonActive]}
            onPress={() => setFilter('finalizada')}
          >
            <Text
              style={[
                styles.filterButtonText,
                filter === 'finalizada' && styles.filterButtonTextActive,
              ]}
            >
              Finalizadas ({obras.filter(o => o.status === 'finalizada').length})
            </Text>
          </TouchableOpacity>
        </View>

        {/* Banner de Sincronização */}
        {pendingCount > 0 && (
          <View style={styles.syncBanner}>
            <View style={styles.syncBannerInfo}>
              <Ionicons name="cloud-upload-outline" size={20} color="#ff9800" />
              <View style={styles.syncBannerTextContainer}>
                <Text style={styles.syncBannerTitle}>
                  {pendingCount} obra(s) aguardando sincronização
                </Text>
                <Text style={styles.syncBannerSubtitle}>
                  {isOnline ? 'Envie agora para liberar espaço.' : 'Conecte-se para finalizar o envio.'}
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

        {/* Lista */}
        <FlatList
          data={filteredObras}
          renderItem={renderObraCard}
          keyExtractor={(item) => item.id}
          contentContainerStyle={styles.listContent}
          refreshControl={
            <RefreshControl
              refreshing={refreshing}
              onRefresh={onRefresh}
              tintColor="#dc3545"
              colors={['#dc3545']}
            />
          }
          ListEmptyComponent={renderEmptyState}
        />

        {/* Botão Flutuante */}
        <TouchableOpacity
          style={styles.fab}
          onPress={() => router.push('/nova-obra')}
          activeOpacity={0.8}
        >
          <Ionicons name="add" size={32} color="#fff" />
        </TouchableOpacity>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: '#f5f5f5',
  },
  container: {
    flex: 1,
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
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 20,
    backgroundColor: '#fff',
    borderBottomWidth: 1,
    borderBottomColor: '#e5e7eb',
  },
  headerTitle: {
    fontSize: 24,
    fontWeight: '700',
    color: '#1a1a1a',
  },
  headerSubtitle: {
    fontSize: 14,
    color: '#666',
    marginTop: 4,
  },
  filterContainer: {
    flexDirection: 'row',
    padding: 16,
    gap: 8,
    backgroundColor: '#fff',
    borderBottomWidth: 1,
    borderBottomColor: '#e5e7eb',
  },
  filterButton: {
    flex: 1,
    paddingVertical: 8,
    paddingHorizontal: 12,
    borderRadius: 8,
    backgroundColor: '#f5f5f5',
    alignItems: 'center',
  },
  filterButtonActive: {
    backgroundColor: '#dc3545',
  },
  filterButtonText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#666',
  },
  filterButtonTextActive: {
    color: '#fff',
  },
  listContent: {
    padding: 16,
  },
  card: {
    backgroundColor: '#fff',
    borderRadius: 12,
    padding: 16,
    marginBottom: 12,
    shadowColor: '#000',
    shadowOpacity: 0.05,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 2 },
    elevation: 2,
  },
  cardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  cardHeaderLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    flex: 1,
    flexWrap: 'wrap',
  },
  offlineBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: '#fff3cd',
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#ff9800',
  },
  offlineBadgeText: {
    fontSize: 10,
    fontWeight: '600',
    color: '#ff9800',
  },
  cardTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: '#1a1a1a',
  },
  statusBadge: {
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 12,
  },
  statusFinalizada: {
    backgroundColor: '#d4edda',
  },
  statusAberta: {
    backgroundColor: '#fff3cd',
  },
  statusText: {
    fontSize: 12,
    fontWeight: '600',
    color: '#1a1a1a',
  },
  cardBody: {
    gap: 8,
    marginBottom: 12,
  },
  infoRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  infoText: {
    fontSize: 14,
    color: '#666',
  },
  cardFooter: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingTop: 12,
    borderTopWidth: 1,
    borderTopColor: '#f0f0f0',
  },
  cardDate: {
    fontSize: 12,
    color: '#999',
  },
  emptyState: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingVertical: 60,
  },
  emptyTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#666',
    marginTop: 16,
  },
  emptySubtitle: {
    fontSize: 14,
    color: '#999',
    marginTop: 8,
    textAlign: 'center',
    paddingHorizontal: 40,
  },
  fab: {
    position: 'absolute',
    right: 20,
    bottom: 20,
    width: 60,
    height: 60,
    borderRadius: 30,
    backgroundColor: '#dc3545',
    justifyContent: 'center',
    alignItems: 'center',
    shadowColor: '#000',
    shadowOpacity: 0.3,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 4 },
    elevation: 8,
  },
  syncBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: '#fff3cd',
    borderLeftWidth: 4,
    borderLeftColor: '#ff9800',
    padding: 16,
    marginHorizontal: 16,
    marginTop: 12,
    marginBottom: 8,
    borderRadius: 8,
    gap: 12,
  },
  syncBannerInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    flex: 1,
  },
  syncBannerTextContainer: {
    flex: 1,
  },
  syncBannerTitle: {
    fontSize: 14,
    fontWeight: '600',
    color: '#1a1a1a',
    marginBottom: 2,
  },
  syncBannerSubtitle: {
    fontSize: 12,
    color: '#666',
  },
  syncBannerButton: {
    backgroundColor: '#ff9800',
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 8,
    minWidth: 100,
    alignItems: 'center',
  },
  syncBannerButtonDisabled: {
    backgroundColor: '#ccc',
    opacity: 0.6,
  },
  syncBannerButtonText: {
    color: '#fff',
    fontSize: 14,
    fontWeight: '600',
  },
});
