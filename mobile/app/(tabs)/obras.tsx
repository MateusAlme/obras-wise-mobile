import { View, Text, StyleSheet, ScrollView, TouchableOpacity, RefreshControl, ActivityIndicator, Alert, TextInput, useWindowDimensions } from 'react-native';
import { useState, useEffect, useMemo, useCallback, useRef } from 'react';
import { useRouter, useFocusEffect } from 'expo-router';
import { supabase } from '../../lib/supabase';
import AsyncStorage from '@react-native-async-storage/async-storage';
import NetInfo from '@react-native-community/netinfo';
import { checkInternetConnection, getPendingObras, startAutoSync, syncAllPendingObras, getLocalObras, syncAllPendingObrasWithProgress, type CancellationToken } from '../../lib/offline-sync';
import type { PendingObra, LocalObra } from '../../lib/offline-sync';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { SyncProgressModal, type ObraSyncProgress } from '../../components/SyncProgressModal';

const LOCAL_OBRAS_KEY = '@obras_local';

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
  status?: 'em_aberto' | 'finalizada' | 'rascunho';
  finalizada_em?: string | null;
  synced?: boolean;
  serverId?: string;
  origem?: 'online' | 'offline';
  fotos_antes?: string[] | FotoInfo[];
  fotos_durante?: string[] | FotoInfo[];
  fotos_depois?: string[] | FotoInfo[];
  fotos_abertura?: string[] | FotoInfo[];
  fotos_fechamento?: string[] | FotoInfo[];
  fotos_ditais_abertura?: string[] | FotoInfo[];
  fotos_ditais_impedir?: string[] | FotoInfo[];
  fotos_ditais_testar?: string[] | FotoInfo[];
  fotos_ditais_aterrar?: string[] | FotoInfo[];
  fotos_ditais_sinalizar?: string[] | FotoInfo[];
  fotos_aterramento_vala_aberta?: string[] | FotoInfo[];
  fotos_aterramento_hastes?: string[] | FotoInfo[];
  fotos_aterramento_vala_fechada?: string[] | FotoInfo[];
  fotos_aterramento_medicao?: string[] | FotoInfo[];
}

type ObraListItem = (Obra & { origem: 'online' | 'offline'; sync_status?: string; error_message?: string });

const HISTORY_CACHE_KEY = '@obras_history_cache';

export default function Obras() {
  const router = useRouter();
  const { width } = useWindowDimensions();
  const [onlineObras, setOnlineObras] = useState<Obra[]>([]);
  const [pendingObrasState, setPendingObrasState] = useState<PendingObra[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [isOnline, setIsOnline] = useState(true);
  const [syncingPending, setSyncingPending] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [equipeLogada, setEquipeLogada] = useState<string>('');
  const insets = useSafeAreaInsets();
  const isSmallScreen = width < 380;
  const horizontalPadding = width < 360 ? 14 : width < 430 ? 18 : 22;

  // Estado para modal de progresso de sincronização
  const [syncModalVisible, setSyncModalVisible] = useState(false);
  const [syncProgress, setSyncProgress] = useState<ObraSyncProgress | null>(null);
  const cancellationTokenRef = useRef<CancellationToken>({ cancelled: false });

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
    // ✅ CORREÇÃO: Preservar origem que já está salva em cada obra
    const pendentes: ObraListItem[] = pendingObrasState
      .filter((obra) => !!equipeLogada && obra.equipe === equipeLogada)
      .map((obra) => ({
      ...obra,
      origem: obra.origem || 'offline', // Usar origem salva, ou 'offline' como fallback
    }));

    // Garantir que onlineObras é sempre um array
    const obrasOnlineArray = Array.isArray(onlineObras) ? onlineObras : [];
    const sincronizadas: ObraListItem[] = obrasOnlineArray.map((obra) => ({
      ...obra,
      origem: obra.origem || 'online', // Usar origem salva, ou 'online' como fallback
    }));

    return [...pendentes, ...sincronizadas];
  }, [pendingObrasState, onlineObras, equipeLogada]);

  const filteredObras = useMemo(() => {
    const term = searchTerm.trim().toLowerCase();
    if (!term) return combinedObras;

    return combinedObras.filter((obra) => {
      const texto = `${obra.obra} ${obra.responsavel} ${obra.equipe} ${obra.tipo_servico}`.toLowerCase();
      return texto.includes(term);
    });
  }, [combinedObras, searchTerm]);

  // ✅ Filtrar obras pendentes apenas da equipe logada para contadores
  const pendingObrasDaEquipe = useMemo(() => {
    if (!equipeLogada) return [];

    return pendingObrasState.filter((obra) => {
      // Comparar equipe da obra com equipe logada
      return obra.equipe === equipeLogada;
    });
  }, [pendingObrasState, equipeLogada]);

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
  }, [equipeLogada]);

  useEffect(() => {
    if (!equipeLogada) return;
    loadPendingObras();
  }, [equipeLogada]);

  /**
   * Busca e sincroniza obras do Supabase para AsyncStorage (migração)
   */
  const migrateObrasDeSupabase = async (equipe: string) => {
    const online = await checkInternetConnection();
    if (!online) {
      console.log('📴 Offline - pulando busca do Supabase');
      return;
    }

    try {
      // Buscar TODAS as obras para debug
      const { data: todasObras } = await supabase
        .from('obras')
        .select('*')
        .order('created_at', { ascending: false });

      console.log(`📊 Total de obras no Supabase: ${todasObras?.length || 0}`);

      if (todasObras && todasObras.length > 0) {
        const equipesUnicas = [...new Set(todasObras.map(o => o.equipe))];
        console.log(`👥 Equipes encontradas: ${equipesUnicas.join(', ')}`);
      }

      // Buscar obras da equipe logada
      const { data, error } = await supabase
        .from('obras')
        .select('*')
        .eq('equipe', equipe)
        .order('created_at', { ascending: false });

      console.log(`🎯 Obras da equipe "${equipe}": ${data?.length || 0}`);

      if (error) {
        console.error('❌ Erro ao buscar obras:', error);
        return;
      }

      if (!data || data.length === 0) {
        console.log('⚠️ Nenhuma obra encontrada para esta equipe');
        return;
      }

      console.log(`📥 Migrando ${data.length} obra(s) do Supabase para AsyncStorage...`);

      let obrasLocais = await getLocalObras();
      for (const obra of data) {
        if (obrasLocais.find(o => o.id === obra.id)) {
          console.log(`⚠️ Obra ${obra.id} já existe localmente - preservando versão local`);
          continue;
        }

        const savedObra: LocalObra = {
          ...obra,
          id: obra.id,
          synced: true,
          locallyModified: false,
          serverId: obra.id,
          origem: 'online',
          last_modified: obra.updated_at || obra.created_at,
          created_at: obra.created_at,
        } as LocalObra;

        obrasLocais.push(savedObra);
        await AsyncStorage.setItem(LOCAL_OBRAS_KEY, JSON.stringify(obrasLocais));
      }

      console.log(`✅ Migração completa: ${obrasLocais.length} obra(s)`);
    } catch (error) {
      console.error('Erro ao migrar obras do Supabase:', error);
    }
  };

  /**
   * Corrige automaticamente obras sincronizadas com campos faltando
   */
  const autoFixObraFields = async () => {
    try {
      let localObras = await getLocalObras();
      console.log(`📊 Debug: Total de obras locais: ${localObras.length}`);

      const obrasComCamposFaltando = localObras.filter(
        obra => obra.synced && (!obra.origem || !obra.status)
      );

      if (obrasComCamposFaltando.length === 0) return;

      console.log(`🔧 Auto-correção: ${obrasComCamposFaltando.length} obra(s) precisa(m) correção`);

      const { fixObraOrigemStatus } = await import('../../lib/fix-origem-status');
      const resultado = await fixObraOrigemStatus();

      console.log(`📊 Resultado: total=${resultado.total}, corrigidas=${resultado.corrigidas}, erros=${resultado.erros}`);

      if (resultado.corrigidas > 0) {
        console.log(`✅ ${resultado.corrigidas} obra(s) corrigida(s) automaticamente`);
      }
    } catch (error) {
      console.error('Erro na auto-correção:', error);
    }
  };

  /**
   * Ordena obras por data/timestamp
   */
  const sortObrasByDate = (obras: LocalObra[]): LocalObra[] => {
    return [...obras].sort((a, b) => {
      const getTimestamp = (obra: LocalObra) => {
        if (obra.created_at) return new Date(obra.created_at).getTime();
        if (obra.data) return new Date(obra.data).getTime();
        return 0;
      };
      return getTimestamp(b) - getTimestamp(a);
    });
  };

  /**
   * Carrega todas as obras para a equipe logada
   */
  const carregarObras = async () => {
    try {
      const equipe = await AsyncStorage.getItem('@equipe_logada');
      if (!equipe) {
        console.log('Nenhuma equipe logada, redirecionando para login');
        router.replace('/login');
        return;
      }

      console.log('📱 Carregando obras do AsyncStorage...');
      let localObras = await getLocalObras();

      // Se vazio, tentar migrar do Supabase
      if (localObras.length === 0) {
        console.log(`⚠️ AsyncStorage vazio - migrando de Supabase para "${equipe}"...`);
        await migrateObrasDeSupabase(equipe);
        localObras = await getLocalObras();
      }

      // Auto-corrigir campos faltando
      await autoFixObraFields();

      // Filtrar, ordenar e formatar
      const obrasEquipe = sortObrasByDate(localObras.filter(obra => obra.equipe === equipe));
      const obrasFormatadas = obrasEquipe.map(obra => ({
        ...obra,
        status: obra.status || 'em_aberto',
      })) as Obra[];

      setOnlineObras(obrasFormatadas);
      console.log(`✅ ${obrasFormatadas.length} obra(s) carregadas`);
    } catch (err) {
      console.error('Erro ao carregar obras:', err);
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
      const pendentesDaEquipe = equipeLogada
        ? pendentes.filter((obra) => obra.equipe === equipeLogada)
         : [];
      setPendingObrasState(pendentesDaEquipe);
    } catch (error) {
      console.error('Erro ao carregar obras pendentes:', error);
    }
  };

  const reloadAllObras = async () => {
    await Promise.all([loadPendingObras(), loadCachedObras()]);
    // ✅ CORREÇÃO: Sempre carregar obras locais, independente do estado online/offline
    // Rascunhos e obras offline devem aparecer imediatamente
    await carregarObras();
  };

  useFocusEffect(
    useCallback(() => {
      reloadAllObras();
    }, [isOnline, equipeLogada])
  );

  const onRefresh = () => {
    setRefreshing(true);
    reloadAllObras().finally(() => setRefreshing(false));
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

    // ✅ CORREÇÃO: Não mostrar badge se já foi sincronizada (tem serverId)
    if (obra.serverId && obra.synced !== false) {
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

  // ========== HELPERS PARA CONSOLIDAR CÓDIGO REPETITIVO ==========

  /**
   * Helper para mostrar alertas de sincronização com resultado comum
   */
  const showSyncAlert = (result: { success: number; failed: number }, context: 'pending' | 'local') => {
    if (result.success === 0 && result.failed === 0) {
      const message = context === 'pending'
        ? 'Conecte-se à internet para sincronizar as obras pendentes.'
        : 'Não foi possível conectar ao servidor.';
      Alert.alert('Sem Conexão', message);
    } else if (result.failed > 0) {
      if (context === 'pending') {
        Alert.alert(
          'Atenção',
          `${result.failed} obra(s) ainda aguardam sincronização. Verifique a conexão e tente novamente.`
        );
      } else {
        Alert.alert(
          'Sincronização Parcial',
          `✅ ${result.success} obra(s) sincronizada(s)\n❌ ${result.failed} falha(s)\n\nTente novamente para enviar as obras restantes.`
        );
      }
    } else {
      const message = context === 'pending'
        ? `${result.success} obra(s) sincronizadas.`
        : `${result.success} obra(s) enviada(s) para a nuvem com sucesso!`;
      const title = context === 'pending' ? 'Pronto!' : '✅ Sincronização Completa';
      Alert.alert(title, message);
    }
  };

  /**
   * Helper para mostrar alertas de erro
   */
  const showErrorAlert = (message: string, context?: string) => {
    Alert.alert('Erro', message);
    if (context) {
      console.error(`❌ ${context}:`, message);
    }
  };

  /**
   * Helper para executar operação com loading state
   */
  const executeWithLoading = async <T,>(
    operation: () => Promise<T>,
    setState: (value: boolean) => void,
    onSuccess?: (result: T) => Promise<void>
  ): Promise<T | null> => {
    setState(true);
    try {
      const result = await operation();
      if (onSuccess) {
        await onSuccess(result);
      }
      return result;
    } catch (error) {
      console.error('Erro durante operação:', error);
      return null;
    } finally {
      setState(false);
    }
  };

  // ========== HANDLERS ==========

  // ========== HANDLERS ==========

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
    if (pendingObrasState.length === 0 || syncingPending) return;

    await executeWithLoading(
      async () => {
        const result = await syncAllPendingObras();
        await loadPendingObras();
        if (result.success > 0) await carregarObras();
        showSyncAlert(result, 'pending');
        return result;
      },
      setSyncingPending
    );
  };

  const handleManualSync = async () => {
    if (pendingObrasState.length === 0) return;

    // Resetar token de cancelamento
    cancellationTokenRef.current = { cancelled: false };

    // Inicializar estado de progresso
    setSyncProgress({
      currentObraIndex: 0,
      totalObras: pendingObrasState.length,
      currentObraName: '',
      photoProgress: { completed: 0, total: 0 },
      overallStatus: 'syncing',
      results: { success: 0, failed: 0 },
      errors: [],
    });

    // Mostrar modal
    setSyncModalVisible(true);

    // Iniciar sincronização com progresso
    const result = await syncAllPendingObrasWithProgress(
      (progress) => {
        setSyncProgress(prev => ({
          ...prev!,
          currentObraIndex: progress.currentObraIndex,
          currentObraName: progress.currentObraName,
          photoProgress: progress.photoProgress,
          overallStatus: progress.status === 'completed' ? 'completed' : 'syncing',
        }));
      },
      cancellationTokenRef.current
    );

    // Atualizar com resultados finais
    setSyncProgress(prev => ({
      ...prev!,
      overallStatus: cancellationTokenRef.current.cancelled ? 'cancelled' : 'completed',
      results: { success: result.success, failed: result.failed },
      errors: result.errors.map(e => ({ obraName: e.obraName, errorMessage: e.error })),
    }));

    // Recarregar dados
    await loadPendingObras();
    if (result.success > 0) await carregarObras();
  };

  const handleCancelSync = () => {
    cancellationTokenRef.current.cancelled = true;
  };

  const handleLogout = async () => {
    Alert.alert('Sair', 'Deseja sair do aplicativo?', [
      { text: 'Cancelar', style: 'cancel' },
      {
        text: 'Sair',
        onPress: async () => {
          try {
            await AsyncStorage.removeItem('@equipe_logada');
            await AsyncStorage.removeItem('@equipe_id');
            await AsyncStorage.removeItem('@login_timestamp');
            router.replace('/login');
          } catch (error) {
            showErrorAlert('Não foi possível sair. Tente novamente.', 'handleLogout');
          }
        },
        style: 'destructive',
      },
    ]);
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
      <View style={[styles.content, { paddingHorizontal: horizontalPadding }]}>
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
          <View style={styles.headerTop}>
            <Text style={[styles.title, isSmallScreen && styles.titleSmall]}>Obras</Text>
            <Text style={[styles.subtitle, isSmallScreen && styles.subtitleSmall]}>{subtitleText}</Text>
          </View>
          {!isOnline && (
            <View style={styles.offlinePill}>
              <Text style={styles.offlineHint}>Modo Offline</Text>
            </View>
          )}
        </View>

        <View style={[styles.metricsRow, isSmallScreen && styles.metricsRowStacked]}>
          <View style={[styles.metricCard, isSmallScreen && styles.metricCardStacked]}>
            <Text style={styles.metricLabel}>Total da equipe</Text>
            <Text style={styles.metricValue}>{combinedObras.length}</Text>
          </View>
          <View style={[styles.metricCard, isSmallScreen && styles.metricCardStacked]}>
            <Text style={styles.metricLabel}>Pendentes</Text>
            <Text style={[styles.metricValue, pendingObrasDaEquipe.length > 0 && styles.metricValueAlert]}>
              {pendingObrasDaEquipe.length}
            </Text>
          </View>
        </View>

        {/* Botão Nova Obra */}
        <TouchableOpacity
          style={styles.novaObraButton}
          onPress={() => router.push('/nova-obra')}
        >
          <Text style={styles.novaObraButtonIcon}>+</Text>
          <Text style={styles.novaObraButtonLabel}>Nova Obra</Text>
        </TouchableOpacity>

        {/* Botão Sincronizar Obras (só aparece quando há obras pendentes da equipe) */}
        {pendingObrasDaEquipe.length > 0 && (
          <TouchableOpacity
            style={[
              styles.syncManualButton,
              !isOnline && styles.syncManualButtonDisabled
            ]}
            onPress={handleManualSync}
            disabled={!isOnline}
          >
            <Text style={styles.syncManualButtonLabel}>
              Sincronizar {pendingObrasDaEquipe.length} obra{pendingObrasDaEquipe.length > 1 ? 's' : ''}
            </Text>
          </TouchableOpacity>
        )}

        <View style={styles.searchContainer}>
          <Text style={styles.searchPrefix}>Buscar</Text>
          <TextInput
            style={styles.searchInput}
            placeholder="Buscar por obra, responsável ou equipe"
            value={searchTerm}
            onChangeText={setSearchTerm}
            autoCorrect={false}
            autoCapitalize="none"
          />
        </View>

        {pendingObrasDaEquipe.length > 0 && (
          <View style={styles.syncBanner}>
            <View style={styles.syncBannerInfo}>
              <Text style={styles.syncBannerTitle}>
                {pendingObrasDaEquipe.length} obra(s) da sua equipe aguardando sincronização
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
              onPress={handleManualSync}
              disabled={!isOnline || syncingPending}
            >
              {syncingPending ? (
                <ActivityIndicator size="small" color="#fff" />
              ) : (
                <Text style={styles.syncBannerButtonText}>
                  Sincronizar ({pendingObrasDaEquipe.length})
                </Text>
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
            const isRascunho = obra.status === 'rascunho';
            // ✅ CORREÇÃO: Considerar sincronizada se tem serverId
            const isSynced = obra.serverId && obra.synced !== false;

            return (
              <TouchableOpacity
                key={`${obra.origem}_${obra.id}`}
                style={[
                  styles.obraCard,
                  isFinalizada && styles.obraCardFinalizada,
                  isRascunho && styles.obraCardRascunho
                ]}
                onPress={() => handleOpenObra(obra)}
              >
                {/* Indicador de Sincronização */}
                <View style={styles.syncIndicatorContainer}>
                  {isSynced ? (
                    <View style={styles.syncIndicatorSynced}>
                      <Text style={styles.syncIndicatorIcon}>☁️</Text>
                      <Text style={styles.syncIndicatorTextSynced}>Sincronizada</Text>
                    </View>
                  ) : (
                    <View style={styles.syncIndicatorPending}>
                      <Text style={styles.syncIndicatorIcon}>📤</Text>
                      <Text style={styles.syncIndicatorTextPending}>Aguardando sync</Text>
                    </View>
                  )}
                </View>

                <View style={styles.obraHeader}>
                  <View style={styles.obraHeaderLeft}>
                    <Text style={styles.obraNumero}>Obra {obra.obra}</Text>
                    <Text style={styles.obraData}>{formatarData(obra.data)}</Text>
                  </View>
                </View>

                {/* Status badges abaixo do header */}
                <View style={{ flexDirection: 'row', gap: 8, marginBottom: 12, flexWrap: 'wrap' }}>
                  {isFinalizada && (
                    <View style={styles.statusBadgeFinalizada}>
                      <Text style={styles.statusBadgeText}>✓ Finalizada</Text>
                    </View>
                  )}
                  {isRascunho && (
                    <View style={styles.statusBadgeRascunho}>
                      <Text style={styles.statusBadgeText}>⏸️ Rascunho</Text>
                    </View>
                  )}
                  {isAberta && !isRascunho && (
                    <View style={styles.statusBadgeAberta}>
                      <Text style={styles.statusBadgeText}>⚠ Em aberto</Text>
                    </View>
                  )}
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

      {/* Modal de Progresso de Sincronização */}
      <SyncProgressModal
        visible={syncModalVisible}
        progress={syncProgress}
        onClose={() => setSyncModalVisible(false)}
        onCancel={handleCancelSync}
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: '#eef2f6',
  },
  container: {
    flex: 1,
    backgroundColor: '#eef2f6',
  },
  scrollContent: {
    paddingBottom: 110,
  },
  content: {
    paddingVertical: 18,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 14,
  },
  title: {
    fontSize: 30,
    fontWeight: '800',
    color: '#111827',
    marginBottom: 4,
  },
  titleSmall: {
    fontSize: 26,
  },
  subtitle: {
    fontSize: 14,
    color: '#6b7280',
    fontWeight: '500',
  },
  subtitleSmall: {
    fontSize: 13,
  },
  offlinePill: {
    backgroundColor: '#fff7ed',
    borderWidth: 1,
    borderColor: '#fed7aa',
    borderRadius: 999,
    paddingHorizontal: 10,
    paddingVertical: 6,
    marginLeft: 10,
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
    backgroundColor: '#fff',
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
    fontWeight: '600',
    marginBottom: 6,
  },
  metricValue: {
    fontSize: 24,
    fontWeight: '800',
    color: '#111827',
  },
  metricValueAlert: {
    color: '#dc2626',
  },
  syncBanner: {
    backgroundColor: '#ffffff',
    borderRadius: 16,
    borderWidth: 1,
    borderColor: '#fde68a',
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
    color: '#92400e',
  },
  syncBannerSubtitle: {
    fontSize: 13,
    color: '#6b7280',
  },
  syncBannerButton: {
    backgroundColor: '#dc3545',
    borderRadius: 12,
    paddingVertical: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  syncBannerButtonDisabled: {
    opacity: 0.55,
  },
  syncBannerButtonText: {
    color: '#fff',
    fontWeight: '600',
    fontSize: 15,
  },
  offlineHint: {
    fontSize: 11,
    color: '#c2410c',
    fontWeight: '700',
  },
  headerTop: {
    marginBottom: 4,
  },
  novaObraButton: {
    backgroundColor: '#dc3545',
    borderRadius: 14,
    paddingVertical: 15,
    paddingHorizontal: 20,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 14,
    shadowColor: '#dc3545',
    shadowOffset: { width: 0, height: 5 },
    shadowOpacity: 0.22,
    shadowRadius: 7,
    elevation: 5,
  },
  novaObraButtonIcon: {
    fontSize: 24,
    marginRight: 8,
    color: '#fff',
    fontWeight: '700',
  },
  novaObraButtonLabel: {
    fontSize: 16,
    color: '#fff',
    fontWeight: '800',
  },
  syncManualButton: {
    backgroundColor: '#2563eb',
    borderRadius: 14,
    paddingVertical: 14,
    paddingHorizontal: 20,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 14,
    shadowColor: '#2563eb',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.2,
    shadowRadius: 6,
    elevation: 4,
  },
  syncManualButtonDisabled: {
    backgroundColor: '#94a3b8',
    opacity: 0.6,
  },
  syncManualButtonLabel: {
    fontSize: 15,
    color: '#fff',
    fontWeight: '700',
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
  syncButton: {
    backgroundColor: '#3b82f6',
    width: 50,
    height: 50,
    borderRadius: 25,
    justifyContent: 'center',
    alignItems: 'center',
    shadowColor: '#3b82f6',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.3,
    shadowRadius: 4,
    elevation: 4,
  },
  syncButtonDisabled: {
    backgroundColor: '#94a3b8',
    opacity: 0.6,
  },
  syncButtonText: {
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
  card: {
    backgroundColor: '#fff',
    borderRadius: 14,
    padding: 18,
    marginBottom: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.08,
    shadowRadius: 6,
    elevation: 2,
  },
  cardTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: '#111827',
    marginBottom: 8,
  },
  cardText: {
    fontSize: 14,
    color: '#4b5563',
    lineHeight: 20,
  },
  emptyText: {
    fontSize: 16,
    color: '#999',
    textAlign: 'center',
  },
  obraCard: {
    backgroundColor: '#fff',
    borderRadius: 14,
    padding: 16,
    marginBottom: 12,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.08,
    shadowRadius: 5,
    elevation: 2,
    borderLeftWidth: 4,
    borderLeftColor: '#dc3545',
    borderWidth: 1,
    borderColor: '#eef2f7',
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
    paddingRight: 98,
    borderBottomWidth: 1,
    borderBottomColor: '#eef2f7',
  },
  obraHeaderLeft: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    flexWrap: 'wrap',
    gap: 6,
    minWidth: 0,
  },
  obraNumero: {
    fontSize: 16,
    fontWeight: '800',
    color: '#0f172a',
    flexShrink: 1,
  },
  obraData: {
    fontSize: 12,
    color: '#475569',
    backgroundColor: '#eef2f7',
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 10,
    flexShrink: 1,
  },
  obraInfo: {
    marginBottom: 6,
    flexShrink: 1,
  },
  obraLabel: {
    fontSize: 12,
    color: '#94a3b8',
    marginBottom: 2,
  },
  obraValue: {
    fontSize: 13,
    color: '#1f2937',
    fontWeight: '600',
    flexShrink: 1,
  },
  verMais: {
    fontSize: 12,
    color: '#2563eb',
    marginTop: 12,
    textAlign: 'right',
    fontWeight: '700',
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
    borderRadius: 6,
    paddingHorizontal: 8,
    paddingVertical: 3,
  },
  statusBadgeAberta: {
    backgroundColor: '#fff3cd',
    borderRadius: 6,
    paddingHorizontal: 8,
    paddingVertical: 3,
  },
  statusBadgeRascunho: {
    backgroundColor: '#fef3c7',
    borderRadius: 6,
    paddingHorizontal: 8,
    paddingVertical: 3,
  },
  obraCardRascunho: {
    borderLeftWidth: 4,
    borderLeftColor: '#f59e0b',
  },
  statusBadgeText: {
    fontSize: 11,
    fontWeight: '600',
    color: '#155724',
    flexShrink: 1,
  },
  syncIndicatorContainer: {
    position: 'absolute',
    top: 12,
    right: 12,
    zIndex: 10,
    maxWidth: 100,
  },
  syncIndicatorSynced: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#d1f4e0',
    borderRadius: 8,
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderWidth: 1,
    borderColor: '#10b981',
  },
  syncIndicatorPending: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#fff3cd',
    borderRadius: 8,
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderWidth: 1,
    borderColor: '#ffc107',
  },
  syncIndicatorIcon: {
    fontSize: 12,
    marginRight: 3,
  },
  syncIndicatorTextSynced: {
    fontSize: 10,
    fontWeight: '600',
    color: '#059669',
    flexShrink: 1,
  },
  syncIndicatorTextPending: {
    fontSize: 10,
    fontWeight: '600',
    color: '#d97706',
    flexShrink: 1,
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
    fontSize: 12,
    fontWeight: '600',
    color: '#8d5300',
    flexShrink: 1,
  },
  infoFinalizacao: {
    backgroundColor: '#e8f5e9',
    borderRadius: 6,
    flexShrink: 1,
    padding: 10,
    marginBottom: 12,
  },
  infoFinalizacaoText: {
    fontSize: 12,
    fontWeight: '500',
    color: '#2e7d32',
    flexShrink: 1,
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
