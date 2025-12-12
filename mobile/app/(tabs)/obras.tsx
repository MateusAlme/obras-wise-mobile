import { View, Text, StyleSheet, ScrollView, TouchableOpacity, RefreshControl, ActivityIndicator, Alert, TextInput } from 'react-native';
import { useState, useEffect, useMemo, useCallback } from 'react';
import { useRouter, useFocusEffect } from 'expo-router';
import { supabase } from '../../lib/supabase';
import AsyncStorage from '@react-native-async-storage/async-storage';
import NetInfo from '@react-native-community/netinfo';
import { checkInternetConnection, getPendingObras, startAutoSync, syncAllPendingObras } from '../../lib/offline-sync';
import type { PendingObra } from '../../lib/offline-sync';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';

interface FotoInfo {
  uri?: string;
  url?: string;
  latitude?: number | null;
  longitude?: number | null;
}

interface Obra {
  id: string;
  data: string;
  obra: string;
  responsavel: string;
  equipe: string;
  tipo_servico: string;
  created_at: string;
  status?: 'em_aberto' | 'finalizada';
  finalizada_em?: string | null;
  fotos_antes?: FotoInfo[];
  fotos_durante?: FotoInfo[];
  fotos_depois?: FotoInfo[];
  fotos_abertura?: FotoInfo[];
  fotos_fechamento?: FotoInfo[];
  fotos_ditais_abertura?: FotoInfo[];
  fotos_ditais_impedir?: FotoInfo[];
  fotos_ditais_testar?: FotoInfo[];
  fotos_ditais_aterrar?: FotoInfo[];
  fotos_ditais_sinalizar?: FotoInfo[];
  fotos_aterramento_vala_aberta?: FotoInfo[];
  fotos_aterramento_hastes?: FotoInfo[];
  fotos_aterramento_vala_fechada?: FotoInfo[];
  fotos_aterramento_medicao?: FotoInfo[];
}

type ObraListItem =
  | (Obra & { origem: 'online'; sync_status?: undefined })
  | ((PendingObra & { origem: 'offline' }) & Obra);

const HISTORY_CACHE_KEY = '@obras_history_cache';

export default function Obras() {
  const router = useRouter();
  const [onlineObras, setOnlineObras] = useState<Obra[]>([]);
  const [pendingObrasState, setPendingObrasState] = useState<PendingObra[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [isOnline, setIsOnline] = useState(true);
  const [syncingPending, setSyncingPending] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [equipeLogada, setEquipeLogada] = useState<string>('');
  const insets = useSafeAreaInsets();

  // Carregar equipe logada do AsyncStorage
  useEffect(() => {
    const loadEquipeLogada = async () => {
      try {
        const equipe = await AsyncStorage.getItem('@equipe_logada');
        if (equipe) {
          setEquipeLogada(equipe);
        }
      } catch (error) {
        console.error('Erro ao carregar equipe logada:', error);
      }
    };
    loadEquipeLogada();
  }, []);

  const combinedObras = useMemo<ObraListItem[]>(() => {
    const pendentes: ObraListItem[] = pendingObrasState.map((obra) => ({
      ...obra,
      origem: 'offline',
    }));

    const sincronizadas: ObraListItem[] = onlineObras.map((obra) => ({
      ...obra,
      origem: 'online',
    }));

    return [...pendentes, ...sincronizadas];
  }, [pendingObrasState, onlineObras]);

  const filteredObras = useMemo(() => {
    const term = searchTerm.trim().toLowerCase();
    if (!term) return combinedObras;

    return combinedObras.filter((obra) => {
      const texto = `${obra.obra} ${obra.responsavel} ${obra.equipe} ${obra.tipo_servico}`.toLowerCase();
      return texto.includes(term);
    });
  }, [combinedObras, searchTerm]);

  useEffect(() => {
    loadCachedObras();
    loadPendingObras();
    carregarObras();
  }, []);

  useEffect(() => {
    let mounted = true;

    checkInternetConnection().then((online) => {
      if (mounted) {
        setIsOnline(online);
      }
    });

    const unsubscribe = NetInfo.addEventListener((state) => {
      const online = state.isConnected === true && state.isInternetReachable === true;
      setIsOnline(online);
    });

    return () => {
      mounted = false;
      unsubscribe();
    };
  }, []);

  useEffect(() => {
    const unsubscribe = startAutoSync(async () => {
      await loadPendingObras();
      await carregarObras();
    });

    return () => {
      unsubscribe?.();
    };
  }, []);

  const carregarObras = async () => {
    try {
      // Verificar se há equipe logada
      const equipe = await AsyncStorage.getItem('@equipe_logada');
      if (!equipe) {
        console.log('Nenhuma equipe logada, redirecionando para login');
        setLoading(false);
        setRefreshing(false);
        router.replace('/login');
        return;
      }

      const online = await checkInternetConnection();
      if (!online) {
        setLoading(false);
        setRefreshing(false);
        return;
      }

      // Filtrar obras apenas da equipe logada
      const { data, error } = await supabase
        .from('obras')
        .select('*')
        .eq('equipe', equipe)
        .order('created_at', { ascending: false });

      if (error) {
        console.error('Erro ao carregar obras:', error);
      } else {
        const lista = data || [];
        setOnlineObras(lista);
        await AsyncStorage.setItem(HISTORY_CACHE_KEY, JSON.stringify(lista));
      }
    } catch (err) {
      console.error('Erro inesperado ao carregar obras:', err);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  const loadCachedObras = async () => {
    try {
      const cache = await AsyncStorage.getItem(HISTORY_CACHE_KEY);
      if (cache) {
        const lista: Obra[] = JSON.parse(cache);
        setOnlineObras(lista);
      }
    } catch (error) {
      console.error('Erro ao carregar cache de obras:', error);
    }
  };

  const loadPendingObras = async () => {
    try {
      const pendentes = await getPendingObras();
      setPendingObrasState(pendentes);
    } catch (error) {
      console.error('Erro ao carregar obras pendentes:', error);
    }
  };

  useFocusEffect(
    useCallback(() => {
      loadPendingObras();
      loadCachedObras();

      if (isOnline) {
        carregarObras();
      }
    }, [isOnline])
  );

  const onRefresh = () => {
    setRefreshing(true);
    carregarObras();
  };

  const limparCacheERecarregar = async () => {
    Alert.alert(
      'Limpar Cache',
      'Deseja limpar o cache local e recarregar todas as obras do servidor?',
      [
        {
          text: 'Cancelar',
          style: 'cancel',
        },
        {
          text: 'Sim, limpar',
          onPress: async () => {
            try {
              setLoading(true);
              // Limpar cache
              await AsyncStorage.removeItem(HISTORY_CACHE_KEY);
              setOnlineObras([]);
              // Recarregar do servidor
              await carregarObras();
              Alert.alert('Sucesso!', 'Cache limpo e obras recarregadas do servidor.');
            } catch (error) {
              console.error('Erro ao limpar cache:', error);
              Alert.alert('Erro', 'Não foi possível limpar o cache.');
            } finally {
              setLoading(false);
            }
          },
        },
      ]
    );
  };

  const formatarData = (data: string) => {
    try {
      // Se a data está no formato YYYY-MM-DD, tratamos como data local
      if (/^\d{4}-\d{2}-\d{2}$/.test(data)) {
        const [ano, mes, dia] = data.split('-').map(Number);
        const date = new Date(ano, mes - 1, dia);
        return date.toLocaleDateString('pt-BR');
      }
      // Para outros formatos (ISO com timezone), usa o construtor padrão
      const date = new Date(data);
      return date.toLocaleDateString('pt-BR');
    } catch {
      return data;
    }
  };

  // FUNÇÃO REMOVIDA: calcularFotosPendentes
  // Fotos agora são opcionais - obras parciais são permitidas
  // A função foi removida para não indicar que fotos são obrigatórias

  const subtitleText = isOnline
    ? `${filteredObras.length} de ${combinedObras.length} obra(s) cadastrada(s)`
    : `${filteredObras.length} de ${combinedObras.length} obra(s) disponiveis offline`;

  const renderStatusBadge = (obra: ObraListItem) => {
    if (obra.origem !== 'offline') {
      return null;
    }

    const badgeStyle =
      obra.sync_status === 'failed'
        ? styles.syncBadgeFailed
        : obra.sync_status === 'syncing'
        ? styles.syncBadgeSyncing
        : styles.syncBadgePending;

    const label =
      obra.sync_status === 'failed'
        ? 'Falha ao sincronizar'
        : obra.sync_status === 'syncing'
        ? 'Sincronizando...'
        : 'Aguardando sincronizacao';

    return (
      <View style={[styles.syncBadge, badgeStyle]}>
        <Text style={styles.syncBadgeText}>{label}</Text>
        {obra.error_message ? (
          <Text style={styles.syncBadgeError}>{obra.error_message}</Text>
        ) : null}
      </View>
    );
  };

  const handleOpenObra = (obra: ObraListItem) => {
    try {
      const payload = encodeURIComponent(JSON.stringify(obra));
      router.push({
        pathname: '/obra-detalhe',
        params: { data: payload },
      });
    } catch (error) {
      console.error('Erro ao abrir detalhes da obra:', error);
    }
  };

  const handleSyncPendingObras = async () => {
    if (pendingObrasState.length === 0 || syncingPending) {
      return;
    }

    setSyncingPending(true);
    try {
      const result = await syncAllPendingObras();
      await loadPendingObras();

      if (result.success > 0) {
        await carregarObras();
      }

      if (result.success === 0 && result.failed === 0) {
        Alert.alert('Sem conexão', 'Conecte-se à internet para sincronizar as obras pendentes.');
      } else if (result.failed > 0) {
        Alert.alert('Atenção', `${result.failed} obra(s) ainda aguardam sincronização. Verifique a conexão e tente novamente.`);
      } else {
        Alert.alert('Pronto!', `${result.success} obra(s) sincronizadas.`);
      }
    } catch (error) {
      console.error('Erro ao sincronizar pendências:', error);
      Alert.alert('Erro', 'Não foi possível sincronizar agora. Tente novamente em instantes.');
    } finally {
      setSyncingPending(false);
    }
  };

  const handleLogout = async () => {
    Alert.alert(
      'Sair',
      'Deseja sair do aplicativo?',
      [
        {
          text: 'Cancelar',
          style: 'cancel',
        },
        {
          text: 'Sair',
          onPress: async () => {
            try {
              // Limpar dados de sessão
              await AsyncStorage.removeItem('@equipe_logada');
              await AsyncStorage.removeItem('@equipe_id');
              await AsyncStorage.removeItem('@login_timestamp');

              // Redirecionar para login
              router.replace('/login');
            } catch (error) {
              console.error('Erro ao fazer logout:', error);
              Alert.alert('Erro', 'Não foi possível sair. Tente novamente.');
            }
          },
          style: 'destructive',
        },
      ]
    );
  };

  return (
    <SafeAreaView style={styles.safeArea} edges={['top', 'bottom']}>
      <ScrollView
        style={styles.container}
        contentContainerStyle={[styles.scrollContent, { paddingBottom: 120 + insets.bottom }]}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} />
        }
      >
      <View style={styles.content}>
        {/* Banner de Equipe Logada */}
        {equipeLogada && (
          <View style={styles.equipeBanner}>
            <View style={styles.equipeInfo}>
              <Text style={styles.equipeLabel}>Equipe logada:</Text>
              <Text style={styles.equipeNome}>{equipeLogada}</Text>
            </View>
            <TouchableOpacity
              style={styles.logoutButton}
              onPress={handleLogout}
            >
              <Text style={styles.logoutButtonText}>Sair</Text>
            </TouchableOpacity>
          </View>
        )}

        <View style={styles.header}>
          <View>
            <Text style={styles.title}>Historico de Obras</Text>
            <Text style={styles.subtitle}>{subtitleText}</Text>
            {!isOnline && (
              <Text style={styles.offlineHint}>Sem internet: exibindo dados salvos e pendentes.</Text>
            )}
          </View>
          <View style={styles.headerButtons}>
            <TouchableOpacity
              style={styles.refreshButton}
              onPress={limparCacheERecarregar}
            >
              <Text style={styles.refreshButtonText}>🔄</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={styles.addButton}
              onPress={() => router.push('/nova-obra')}
            >
              <Text style={styles.addButtonText}>+</Text>
            </TouchableOpacity>
          </View>
        </View>

        <View style={styles.searchContainer}>
          <TextInput
            style={styles.searchInput}
            placeholder="Buscar por obra, responsável ou equipe"
            value={searchTerm}
            onChangeText={setSearchTerm}
            autoCorrect={false}
            autoCapitalize="none"
          />
        </View>

        {pendingObrasState.length > 0 && (
          <View style={styles.syncBanner}>
            <View style={styles.syncBannerInfo}>
              <Text style={styles.syncBannerTitle}>
                {pendingObrasState.length} obra(s) aguardando sincronização
              </Text>
              <Text style={styles.syncBannerSubtitle}>
                {isOnline ? 'Envie agora para liberar espaço.' : 'Conecte-se para finalizar o envio.'}
              </Text>
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

        {loading && combinedObras.length === 0 ? (
          <View style={styles.card}>
            <Text style={styles.emptyText}>Carregando obras...</Text>
          </View>
        ) : combinedObras.length === 0 ? (
          <View style={styles.card}>
            <Text style={styles.cardTitle}>Nenhuma obra cadastrada</Text>
            <Text style={styles.cardText}>
              Clique no botao "+" acima ou no Dashboard para cadastrar sua primeira obra.
            </Text>
          </View>
        ) : filteredObras.length === 0 ? (
          <View style={styles.card}>
            <Text style={styles.cardTitle}>Nenhum resultado</Text>
            <Text style={styles.cardText}>
              Ajuste o termo de busca para encontrar uma obra.
            </Text>
          </View>
        ) : (
          filteredObras.map((obra) => {
            const isAberta = obra.status === 'em_aberto' || !obra.status;
            const isFinalizada = obra.status === 'finalizada';

            return (
              <TouchableOpacity
                key={obra.id}
                style={[
                  styles.obraCard,
                  isFinalizada && styles.obraCardFinalizada
                ]}
                onPress={() => handleOpenObra(obra)}
              >
                <View style={styles.obraHeader}>
                  <View style={styles.obraHeaderLeft}>
                    <Text style={styles.obraNumero}>Obra {obra.obra}</Text>
                    {isFinalizada && (
                      <View style={styles.statusBadgeFinalizada}>
                        <Text style={styles.statusBadgeText}>✓ Finalizada</Text>
                      </View>
                    )}
                    {isAberta && (
                      <View style={styles.statusBadgeAberta}>
                        <Text style={styles.statusBadgeText}>⚠ Em aberto</Text>
                      </View>
                    )}
                  </View>
                  <Text style={styles.obraData}>{formatarData(obra.data)}</Text>
                </View>

                {isFinalizada && obra.finalizada_em && (
                  <View style={styles.infoFinalizacao}>
                    <Text style={styles.infoFinalizacaoText}>
                      Finalizada em {formatarData(obra.finalizada_em)}
                    </Text>
                  </View>
                )}

                <View style={styles.obraInfo}>
                  <Text style={styles.obraLabel}>Responsavel:</Text>
                  <Text style={styles.obraValue}>{obra.responsavel}</Text>
                </View>

                <View style={styles.obraInfo}>
                  <Text style={styles.obraLabel}>Equipe:</Text>
                  <Text style={styles.obraValue}>{obra.equipe}</Text>
                </View>

                <View style={styles.obraInfo}>
                  <Text style={styles.obraLabel}>Servico:</Text>
                  <Text style={styles.obraValue}>{obra.tipo_servico || '-'}</Text>
                </View>

                {renderStatusBadge(obra)}

                <Text style={styles.verMais}>Toque para ver detalhes</Text>
              </TouchableOpacity>
            );
          })
        )}
      </View>
      </ScrollView>
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
    backgroundColor: '#f5f5f5',
  },
  scrollContent: {
    paddingBottom: 100,
  },
  content: {
    padding: 20,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 20,
  },
  title: {
    fontSize: 28,
    fontWeight: 'bold',
    color: '#1a1a1a',
    marginBottom: 4,
  },
  subtitle: {
    fontSize: 15,
    color: '#666',
  },
  syncBanner: {
    backgroundColor: '#fff',
    borderRadius: 16,
    borderWidth: 1,
    borderColor: '#ffe0b2',
    padding: 16,
    marginBottom: 16,
    flexDirection: 'column',
    gap: 12,
  },
  syncBannerInfo: {
    gap: 4,
  },
  syncBannerTitle: {
    fontSize: 15,
    fontWeight: '700',
    color: '#8d5300',
  },
  syncBannerSubtitle: {
    fontSize: 13,
    color: '#7b7b7b',
  },
  syncBannerButton: {
    backgroundColor: '#dc3545',
    borderRadius: 12,
    paddingVertical: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  syncBannerButtonDisabled: {
    opacity: 0.5,
  },
  syncBannerButtonText: {
    color: '#fff',
    fontWeight: '600',
    fontSize: 15,
  },
  offlineHint: {
    fontSize: 12,
    color: '#b26a00',
    marginTop: 4,
  },
  headerButtons: {
    flexDirection: 'row',
    gap: 10,
    alignItems: 'center',
  },
  refreshButton: {
    backgroundColor: '#28a745',
    width: 50,
    height: 50,
    borderRadius: 25,
    justifyContent: 'center',
    alignItems: 'center',
    shadowColor: '#28a745',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.3,
    shadowRadius: 4,
    elevation: 4,
  },
  refreshButtonText: {
    fontSize: 24,
    lineHeight: 28,
  },
  addButton: {
    backgroundColor: '#dc3545',
    width: 50,
    height: 50,
    borderRadius: 25,
    justifyContent: 'center',
    alignItems: 'center',
    shadowColor: '#dc3545',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.3,
    shadowRadius: 4,
    elevation: 4,
  },
  addButtonText: {
    fontSize: 32,
    color: '#fff',
    fontWeight: 'bold',
    lineHeight: 36,
  },
  searchContainer: {
    marginBottom: 12,
  },
  searchInput: {
    backgroundColor: '#fff',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#e0e0e0',
    paddingHorizontal: 14,
    paddingVertical: 12,
    fontSize: 15,
    color: '#1a1a1a',
  },
  card: {
    backgroundColor: '#fff',
    borderRadius: 12,
    padding: 20,
    marginBottom: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  cardTitle: {
    fontSize: 20,
    fontWeight: '600',
    color: '#1a1a1a',
    marginBottom: 8,
  },
  cardText: {
    fontSize: 16,
    color: '#666',
    lineHeight: 24,
  },
  emptyText: {
    fontSize: 16,
    color: '#999',
    textAlign: 'center',
  },
  obraCard: {
    backgroundColor: '#fff',
    borderRadius: 12,
    padding: 16,
    marginBottom: 12,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
    borderLeftWidth: 4,
    borderLeftColor: '#dc3545',
  },
  obraCardFinalizada: {
    borderLeftColor: '#28a745',
    opacity: 0.85,
  },
  obraHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 12,
    paddingBottom: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#f0f0f0',
  },
  obraHeaderLeft: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    flexWrap: 'wrap',
    gap: 8,
  },
  obraNumero: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#1a1a1a',
  },
  obraData: {
    fontSize: 14,
    color: '#666',
    backgroundColor: '#f5f5f5',
    paddingHorizontal: 12,
    paddingVertical: 4,
    borderRadius: 12,
  },
  obraInfo: {
    marginBottom: 8,
  },
  obraLabel: {
    fontSize: 13,
    color: '#999',
    marginBottom: 2,
  },
  obraValue: {
    fontSize: 15,
    color: '#333',
    fontWeight: '500',
  },
  verMais: {
    fontSize: 13,
    color: '#dc3545',
    marginTop: 12,
    textAlign: 'right',
    fontWeight: '500',
  },
  syncBadge: {
    borderRadius: 8,
    padding: 10,
    marginTop: 8,
  },
  syncBadgePending: {
    backgroundColor: '#fff8e1',
  },
  syncBadgeSyncing: {
    backgroundColor: '#e3f2fd',
  },
  syncBadgeFailed: {
    backgroundColor: '#ffebee',
  },
  syncBadgeText: {
    fontSize: 13,
    fontWeight: '600',
    color: '#5d4037',
  },
  syncBadgeError: {
    marginTop: 4,
    fontSize: 12,
    color: '#c62828',
  },
  statusBadgeFinalizada: {
    backgroundColor: '#d4edda',
    borderRadius: 8,
    paddingHorizontal: 10,
    paddingVertical: 4,
  },
  statusBadgeAberta: {
    backgroundColor: '#fff3cd',
    borderRadius: 8,
    paddingHorizontal: 10,
    paddingVertical: 4,
  },
  statusBadgeText: {
    fontSize: 12,
    fontWeight: '600',
    color: '#155724',
  },
  alertaFotosPendentes: {
    backgroundColor: '#fff8e1',
    borderRadius: 8,
    padding: 10,
    marginBottom: 12,
    borderLeftWidth: 3,
    borderLeftColor: '#ffc107',
  },
  alertaFotosText: {
    fontSize: 13,
    fontWeight: '600',
    color: '#8d5300',
  },
  infoFinalizacao: {
    backgroundColor: '#e8f5e9',
    borderRadius: 8,
    padding: 10,
    marginBottom: 12,
  },
  infoFinalizacaoText: {
    fontSize: 13,
    fontWeight: '500',
    color: '#2e7d32',
  },
  equipeBanner: {
    backgroundColor: '#dc3545',
    borderRadius: 12,
    padding: 14,
    marginBottom: 16,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  equipeInfo: {
    flex: 1,
  },
  equipeLabel: {
    fontSize: 12,
    color: 'rgba(255, 255, 255, 0.9)',
    marginBottom: 2,
  },
  equipeNome: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#fff',
  },
  logoutButton: {
    backgroundColor: 'rgba(255, 255, 255, 0.2)',
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.3)',
  },
  logoutButtonText: {
    color: '#fff',
    fontSize: 14,
    fontWeight: '600',
  },
});
