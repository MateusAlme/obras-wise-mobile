import { View, Text, StyleSheet, ScrollView, TouchableOpacity, RefreshControl, ActivityIndicator, Alert, TextInput, useWindowDimensions } from 'react-native';
import { useState, useEffect, useMemo, useCallback, useRef } from 'react';
import { useRouter, useFocusEffect } from 'expo-router';
import * as ImagePicker from 'expo-image-picker';
import { supabase } from '../../lib/supabase';
import AsyncStorage from '@react-native-async-storage/async-storage';
import NetInfo from '@react-native-community/netinfo';
import { checkInternetConnection, getPendingObras, startAutoSync, syncAllPendingObras, getLocalObras, syncAllPendingObrasWithProgress, removePendingObra, removeLocalObra, syncObra, type CancellationToken } from '../../lib/offline-sync';
import type { PendingObra, LocalObra } from '../../lib/offline-sync';
import { getQueueStats, retryFailedUploads, processObraPhotos } from '../../lib/photo-queue';
import { backupPhoto, getPhotoMetadatasByIds } from '../../lib/photo-backup';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { SyncProgressModal, type ObraSyncProgress } from '../../components/SyncProgressModal';
import { ObraContainer, ServiceCard, ServiceTypeSelector } from '../../components/ServicosComponents';
import type { Servico, SyncStatusServico, TipoServico, FotoInfo as ServicoFotoInfo } from '../../types/servico';
import { fetchServicosForObra, createServico, markServicoComplete, appendPhotoToServicoLocal } from '../../lib/servico-sync';

const isUuid = (value: string): boolean =>
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(value);

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
type GroupedObra = {
  groupKey: string;
  obraNumero: string;
  principal: ObraListItem;
  itens: ObraListItem[];
};

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
  const [userRole, setUserRole] = useState<string>('equipe');
  const insets = useSafeAreaInsets();
  const isSmallScreen = width < 380;
  const horizontalPadding = width < 360 ? 14 : width < 430 ? 18 : 22;
  const isCompressor = userRole === 'compressor';
  const isAdmin = userRole === 'admin';

  // Estado para modal de progresso de sincronização
  const [syncModalVisible, setSyncModalVisible] = useState(false);
  const [syncProgress, setSyncProgress] = useState<ObraSyncProgress | null>(null);
  const cancellationTokenRef = useRef<CancellationToken>({ cancelled: false });

  // Estado de status das fotos na fila de upload
  const [photoStats, setPhotoStats] = useState({ pending: 0, uploading: 0, failed: 0 });
  const [syncingPhotos, setSyncingPhotos] = useState(false);
  const [expandedObraId, setExpandedObraId] = useState<string | null>(null);
  const [expandedServicoId, setExpandedServicoId] = useState<string | null>(null);
  const [servicosPorObra, setServicosPorObra] = useState<Record<string, Servico[]>>({});
  const [serviceSelectorVisible, setServiceSelectorVisible] = useState(false);
  const [selectedObraIdForService, setSelectedObraIdForService] = useState<string | null>(null);
  const [selectedObraGroupKeyForService, setSelectedObraGroupKeyForService] = useState<string | null>(null);
  const [capturingPhotoForServico, setCapturingPhotoForServico] = useState<{
    servicoId: string;
    category: string;
    obraId: string;
  } | null>(null);
  const [captureLoading, setCaptureLoading] = useState(false);

  const isCompressorBook = (obra: { tipo_servico?: string; creator_role?: string }) => {
    return obra?.tipo_servico === 'Cava em Rocha' || obra?.creator_role === 'compressor';
  };

  // Carregar sessao do AsyncStorage
  useEffect(() => {
    const loadSessionData = async () => {
      try {
        const equipe = await AsyncStorage.getItem('@equipe_logada');
        const role = await AsyncStorage.getItem('@user_role');
        if (equipe) {
          setEquipeLogada(equipe);
        }
        setUserRole(role || 'equipe');
      } catch (error) {
        console.error('Erro ao carregar sessao:', error);
      }
    };
    loadSessionData();
  }, []);

  const combinedObras = useMemo<ObraListItem[]>(() => {
    // ✅ CORREÇÃO: Preservar origem que já está salva em cada obra
    const pendentes: ObraListItem[] = pendingObrasState
      .filter((obra) => {
        if (!isAdmin && (!equipeLogada || obra.equipe !== equipeLogada)) return false;
        if (!isCompressor) return true;
        return isCompressorBook(obra as any);
      })
      .map((obra) => ({
      ...obra,
      origem: obra.origem || 'offline', // Usar origem salva, ou 'offline' como fallback
    }));

    // Garantir que onlineObras é sempre um array
    const obrasOnlineArray = Array.isArray(onlineObras)
      ? onlineObras.filter((obra) => !isCompressor || isCompressorBook(obra as any))
      : [];
    const sincronizadas: ObraListItem[] = obrasOnlineArray.map((obra) => ({
      ...obra,
      origem: obra.origem || 'online', // Usar origem salva, ou 'online' como fallback
    }));

    return [...pendentes, ...sincronizadas];
  }, [pendingObrasState, onlineObras, equipeLogada, isCompressor, isAdmin]);

  const filteredObras = useMemo(() => {
    const term = searchTerm.trim().toLowerCase();
    if (!term) return combinedObras;

    return combinedObras.filter((obra) => {
      const texto = `${obra.obra} ${obra.responsavel} ${obra.equipe} ${obra.tipo_servico}`.toLowerCase();
      return texto.includes(term);
    });
  }, [combinedObras, searchTerm]);

  const groupObrasByNumero = useCallback((lista: ObraListItem[]): GroupedObra[] => {
    const groups = new Map<string, GroupedObra>();

    for (const obra of lista) {
      const obraNumero = String(obra.obra || '').trim();
      const key = obraNumero.toLowerCase();
      const existente = groups.get(key);

      if (!existente) {
        groups.set(key, {
          groupKey: key,
          obraNumero,
          principal: obra,
          itens: [obra],
        });
        continue;
      }

      existente.itens.push(obra);

      const dataAtual = new Date(existente.principal.created_at || existente.principal.data || 0).getTime();
      const dataNova = new Date(obra.created_at || obra.data || 0).getTime();
      if (dataNova > dataAtual) {
        existente.principal = obra;
      }
    }

    return Array.from(groups.values()).sort((a, b) => {
      const ta = new Date(a.principal.created_at || a.principal.data || 0).getTime();
      const tb = new Date(b.principal.created_at || b.principal.data || 0).getTime();
      return tb - ta;
    });
  }, []);

  const groupedCombinedObras = useMemo(() => groupObrasByNumero(combinedObras), [combinedObras, groupObrasByNumero]);
  const groupedFilteredObras = useMemo(() => groupObrasByNumero(filteredObras), [filteredObras, groupObrasByNumero]);

  // ✅ Filtrar obras pendentes apenas da equipe logada para contadores
  const pendingObrasDaEquipe = useMemo(() => {
    if (isAdmin) return pendingObrasState;
    if (!equipeLogada) return [];

    return pendingObrasState.filter((obra) => {
      if (obra.equipe !== equipeLogada) return false;
      if (!isCompressor) return true;
      return isCompressorBook(obra as any);
    });
  }, [pendingObrasState, equipeLogada, isCompressor, isAdmin]);

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
      const online = state.isConnected === true && state.isInternetReachable !== false;
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
  }, [equipeLogada, userRole]);

  useEffect(() => {
    if (!equipeLogada && !isAdmin) return;
    loadPendingObras();
  }, [equipeLogada, userRole, isAdmin]);

  /**
   * Busca e sincroniza obras do Supabase para AsyncStorage (migração)
   */
  const migrateObrasDeSupabase = async (equipe: string, role?: string) => {
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

      // Buscar obras visiveis para o perfil logado
      const roleAtual = role || userRole;
      let query = supabase
        .from('obras')
        .select('*');

      if (roleAtual !== 'admin') {
        query = query.eq('equipe', equipe);
      }

      if (roleAtual === 'compressor') {
        query = query.or('tipo_servico.eq.Cava em Rocha,creator_role.eq.compressor');
      }

      query = query.order('created_at', { ascending: false });

      const { data, error } = await query;

      const contextoBusca = roleAtual === 'admin' ? 'todas as equipes' : `equipe "${equipe}"`;
      console.log(`🎯 Obras visiveis para ${contextoBusca}: ${data?.length || 0}`);

      if (error) {
        console.error('❌ Erro ao buscar obras:', error);
        return;
      }

      if (!data || data.length === 0) {
        console.log(roleAtual === 'admin'
          ? '⚠️ Nenhuma obra encontrada para o admin'
          : '⚠️ Nenhuma obra encontrada para esta equipe');
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
      const role = (await AsyncStorage.getItem('@user_role')) || userRole || 'equipe';
      const roleIsCompressor = role === 'compressor';
      const roleIsAdmin = role === 'admin';
      if (role !== userRole) {
        setUserRole(role);
      }
      if (!equipe && !roleIsAdmin) {
        console.log('Nenhuma equipe logada, redirecionando para login');
        router.replace('/login');
        return;
      }

      console.log('📱 Carregando obras do AsyncStorage...');
      let localObras = await getLocalObras();

      // Sempre tentar sincronizar com Supabase quando online
      // (migrateObrasDeSupabase verifica conectividade internamente e pula se offline)
      console.log(`🔄 Sincronizando obras do Supabase para ${roleIsAdmin ? 'todas as equipes' : `"${equipe}"`}...`);
      await migrateObrasDeSupabase(equipe || '', role);
      localObras = await getLocalObras();

      // Auto-corrigir campos faltando
      await autoFixObraFields();

      // Filtrar, ordenar e formatar
      const obrasEquipe = sortObrasByDate(
        localObras.filter((obra) => {
          if (!roleIsAdmin && obra.equipe !== equipe) return false;
          if (!roleIsCompressor) return true;
          return isCompressorBook(obra as any);
        })
      );
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
        const role = (await AsyncStorage.getItem('@user_role')) || userRole || 'equipe';
        const lista: Obra[] = JSON.parse(cache);
        const listaFiltrada = role === 'compressor'
          ? lista.filter((obra) => isCompressorBook(obra as any))
          : lista;
        setOnlineObras(listaFiltrada);
      }
    } catch (error) {
      console.error('Erro ao carregar cache de obras:', error);
    }
  };

  const loadPendingObras = async () => {
    try {
      const role = (await AsyncStorage.getItem('@user_role')) || userRole || 'equipe';
      const roleIsAdmin = role === 'admin';
      const roleIsCompressor = role === 'compressor';
      const equipeAtual = (await AsyncStorage.getItem('@equipe_logada')) || equipeLogada;
      const pendentes = await getPendingObras();
      const pendentesFiltrados = pendentes.filter((obra) => {
        if (!roleIsAdmin) {
          if (!equipeAtual || obra.equipe !== equipeAtual) return false;
        }
        if (!roleIsCompressor) return true;
        return isCompressorBook(obra as any);
      });
      setPendingObrasState(pendentesFiltrados);
    } catch (error) {
      console.error('Erro ao carregar obras pendentes:', error);
    }
  };

  const loadPhotoStats = async () => {
    try {
      const stats = await getQueueStats();
      setPhotoStats({ pending: stats.pending, uploading: stats.uploading, failed: stats.failed });
    } catch (error) {
      console.error('Erro ao carregar status das fotos:', error);
    }
  };

  const reloadAllObras = async () => {
    await Promise.all([loadPendingObras(), loadCachedObras(), loadPhotoStats()]);
    // ✅ CORREÇÃO: Sempre carregar obras locais, independente do estado online/offline
    // Rascunhos e obras offline devem aparecer imediatamente
    await carregarObras();
  };

  useFocusEffect(
    useCallback(() => {
      reloadAllObras();
    }, [isOnline, equipeLogada, userRole])
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
    ? `${groupedFilteredObras.length} de ${groupedCombinedObras.length} obra(s) cadastrada(s)`
    : `${groupedFilteredObras.length} de ${groupedCombinedObras.length} obra(s) disponiveis offline`;

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
        : obra.sync_status === 'partial'
        ? styles.syncBadgePartial
        : styles.syncBadgePending;

    const label =
      obra.sync_status === 'failed'
        ? 'Falha ao sincronizar'
        : obra.sync_status === 'syncing'
        ? 'Sincronizando...'
        : obra.sync_status === 'partial'
        ? 'Sincronizacao parcial: fotos pendentes'
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

  const handleOpenObraBooksPage = (grupo: GroupedObra) => {
    try {
      router.push({
        pathname: '/obra-books',
        params: { obraNumero: grupo.obraNumero },
      });
    } catch (error) {
      console.error('Erro ao abrir página de books da obra:', error);
    }
  };

  const toSyncStatusServico = (obra: ObraListItem): SyncStatusServico => {
    if (obra.sync_status === 'syncing') return 'syncing';
    if (obra.sync_status === 'failed') return 'error';
    if (obra.sync_status === 'partial') return 'error';
    if (obra.serverId && obra.synced !== false) return 'synced';
    return 'offline';
  };

  const loadServicosForObra = async (obraId: string) => {
    try {
      const servicos = await fetchServicosForObra(obraId);
      setServicosPorObra((prev) => ({ ...prev, [obraId]: servicos }));
    } catch (error) {
      console.error('Erro ao carregar serviços da obra:', error);
    }
  };

  const handleToggleExpandObra = async (obraId: string) => {
    if (expandedObraId === obraId) {
      setExpandedObraId(null);
      setExpandedServicoId(null);
      return;
    }

    setExpandedObraId(obraId);
    if (!servicosPorObra[obraId]) {
      await loadServicosForObra(obraId);
    }
  };

  const handleAddService = (obraId: string, groupKey?: string) => {
    setSelectedObraIdForService(obraId);
    setSelectedObraGroupKeyForService(groupKey || null);
    setServiceSelectorVisible(true);
  };

  const handleCreateServiceForObra = async (tipo: TipoServico) => {
    if (!selectedObraIdForService) return;

    const obra = combinedObras.find((o) => o.id === selectedObraIdForService);
    const responsavel = obra?.responsavel;

    const result = await createServico(selectedObraIdForService, tipo, responsavel);
    if (!result.success) {
      Alert.alert('Erro', result.error || 'Não foi possível criar o serviço.');
      return;
    }

    await loadServicosForObra(selectedObraIdForService);
    setExpandedObraId(selectedObraGroupKeyForService || selectedObraIdForService);
  };

  const handleMarkServiceComplete = async (obraId: string, servicoId: string) => {
    const ok = await markServicoComplete(servicoId, obraId);
    if (!ok) {
      Alert.alert('Erro', 'Não foi possível atualizar o status do serviço.');
      return;
    }
    await loadServicosForObra(obraId);
  };

  const handleCapturePhoto = async (servicoId: string, category: string, obraId: string) => {
    setCapturingPhotoForServico({ servicoId, category, obraId });
  };

  const capturePhotoFromCamera = async () => {
    if (!capturingPhotoForServico) return;

    try {
      setCaptureLoading(true);
      const permissionResult = await ImagePicker.requestCameraPermissionsAsync();

      if (!permissionResult.granted) {
        Alert.alert('Permissão negada', 'É necessário permitir acesso à câmera.');
        return;
      }

      const result = await ImagePicker.launchCameraAsync({
        mediaTypes: ['images'],
        allowsEditing: false,
        quality: 0.8,
      });

      if (!result.canceled && result.assets[0]) {
        await addPhotoToServico(result.assets[0].uri);
      }
    } catch (error) {
      console.error('Erro ao tirar foto:', error);
      Alert.alert('Erro', 'Não foi possível tirar a foto. Tente novamente.');
    } finally {
      setCaptureLoading(false);
    }
  };

  const selectPhotoFromGallery = async () => {
    if (!capturingPhotoForServico) return;

    try {
      setCaptureLoading(true);
      const permissionResult = await ImagePicker.requestMediaLibraryPermissionsAsync();

      if (!permissionResult.granted) {
        Alert.alert('Permissão negada', 'É necessário permitir acesso à galeria.');
        return;
      }

      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ['images'],
        allowsEditing: false,
        quality: 0.8,
      });

      if (!result.canceled && result.assets[0]) {
        await addPhotoToServico(result.assets[0].uri);
      }
    } catch (error) {
      console.error('Erro ao selecionar imagem:', error);
      Alert.alert('Erro', 'Não foi possível selecionar a imagem. Tente novamente.');
    } finally {
      setCaptureLoading(false);
    }
  };

  const addPhotoToServico = async (photoUri: string) => {
    if (!capturingPhotoForServico) return;

    try {
      const { servicoId, category, obraId } = capturingPhotoForServico;

      // Backup da foto
      const photoMetadata = await backupPhoto(
        photoUri,
        obraId,
        category as any,
        0, // index
        null, // latitude
        null, // longitude
        'image/jpeg'
      );

      // Atualizar serviço com a nova foto
      const servicos = servicosPorObra[obraId] || [];
      const servicoIdx = servicos.findIndex((s) => s.id === servicoId);

      if (servicoIdx >= 0) {
        const servico = servicos[servicoIdx];
        const fieldName = category as keyof Servico;
        const rawPhotos = (servico[fieldName] as unknown[]) || [];
        const photos = rawPhotos as ServicoFotoInfo[];

        const isServicoLocal = !isUuid(servicoId) || !isUuid(obraId);

        if (isServicoLocal || !isOnline) {
          const updatedLocal = [...rawPhotos];
          const alreadyExists = updatedLocal.some((item: any) => {
            if (typeof item === 'string') return item === photoMetadata.id;
            if (item && item.id) return item.id === photoMetadata.id;
            return false;
          });

          if (!alreadyExists) {
            updatedLocal.push(photoMetadata.id);
          }

          const localSaved = await appendPhotoToServicoLocal(servicoId, obraId, fieldName as any, photoMetadata.id, photoMetadata.compressedPath, { latitude: photoMetadata.latitude, longitude: photoMetadata.longitude, utmX: photoMetadata.utmX, utmY: photoMetadata.utmY, utmZone: photoMetadata.utmZone });
          if (!localSaved) {
            Alert.alert('Erro', 'Não foi possível salvar a foto localmente neste serviço.');
            return;
          }

          const updatedServicos = [...servicos];
          updatedServicos[servicoIdx] = {
            ...servico,
            [fieldName]: updatedLocal,
          } as Servico;
          setServicosPorObra((prev) => ({ ...prev, [obraId]: updatedServicos }));

          Alert.alert('Sucesso', isOnline ? 'Foto salva localmente e pendente de sincronização.' : 'Foto salva localmente.');
          setCapturingPhotoForServico(null);
          return;
        }

        let publicUrl: string | undefined;
        if (isOnline) {
          await processObraPhotos(obraId, undefined, [photoMetadata.id]);
          const [uploadedMetadata] = await getPhotoMetadatasByIds([photoMetadata.id]);
          publicUrl = uploadedMetadata?.uploadUrl || uploadedMetadata?.supabaseUrl;
        }

        const normalizedPhotos: ServicoFotoInfo[] = photos.map((photo) => {
          const { uri, ...rest } = photo;
          return {
            ...rest,
            url: rest.url || uri,
            utm_x: rest.utm_x ?? (rest.utmX ? Number(rest.utmX) : undefined),
            utm_y: rest.utm_y ?? (rest.utmY ? Number(rest.utmY) : undefined),
          };
        });

        // Adicionar nova foto
        const novaFoto: ServicoFotoInfo = {
          url: publicUrl || photoMetadata.compressedPath,
          latitude: photoMetadata.latitude,
          longitude: photoMetadata.longitude,
          utm_x: photoMetadata.utmX ?? undefined,
          utm_y: photoMetadata.utmY ?? undefined,
          utm_zone: photoMetadata.utmZone || undefined,
          timestamp: new Date().getTime(),
          takenAt: new Date().toISOString(),
        };

        const updatedPhotos = [...normalizedPhotos, novaFoto];

        // Atualizar no Supabase e AsyncStorage
        const { error } = await supabase
          .from('servicos')
          .update({ [fieldName]: updatedPhotos, updated_at: new Date().toISOString() })
          .eq('id', servicoId);

        if (!error) {
          // Atualizar cache local
          const updatedServicos = [...servicos];
          updatedServicos[servicoIdx] = {
            ...servico,
            [fieldName]: updatedPhotos,
          } as Servico;
          setServicosPorObra((prev) => ({ ...prev, [obraId]: updatedServicos }));

          Alert.alert('Sucesso', 'Foto adicionada!');
        } else {
          Alert.alert('Upload pendente', 'Foto salva no dispositivo. Sincronize quando houver conexão para enviar o link público.');
        }
      }

      setCapturingPhotoForServico(null);
    } catch (error) {
      console.error('Erro ao adicionar foto:', error);
      Alert.alert('Erro', 'Não foi possível adicionar a foto.');
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

  const handleSyncSingleObra = async (obra: ObraListItem) => {
    if (!isOnline) {
      Alert.alert('Sem conexão', 'Conecte-se à internet para sincronizar este rascunho.');
      return;
    }

    const pendingObra = pendingObrasState.find((item) => item.id === obra.id) || pendingObrasState.find((item) => item.obra === obra.obra);
    if (!pendingObra) {
      Alert.alert('Não encontrado', 'Não foi possível localizar o rascunho para sincronização.');
      return;
    }

    setSyncModalVisible(true);
    setSyncProgress({
      currentObraIndex: 0,
      totalObras: 1,
      currentObraName: pendingObra.obra,
      photoProgress: { completed: 0, total: 0 },
      overallStatus: 'syncing',
      results: { success: 0, failed: 0 },
      errors: [],
    });

    try {
      const result = await syncObra(pendingObra);
      setSyncProgress((prev) => ({
        ...prev!,
        overallStatus: 'completed',
        results: { success: result.success ? 1 : 0, failed: result.success ? 0 : 1 },
        errors: result.success ? [] : [{ obraName: pendingObra.obra, errorMessage: 'Falha ao sincronizar este rascunho.' }],
      }));

      if (result.success) {
        await loadPendingObras();
        await carregarObras();
        Alert.alert('Sincronizado', 'A obra foi sincronizada com sucesso.');
      } else {
        Alert.alert('Falha', 'Não foi possível sincronizar esta obra.');
      }
    } catch (error) {
      console.error('Erro ao sincronizar obra individual:', error);
      Alert.alert('Erro', 'Não foi possível sincronizar esta obra.');
    }
  };

  const handleCancelSync = () => {
    cancellationTokenRef.current.cancelled = true;
  };

  const handleSyncPhotos = async () => {
    if (syncingPhotos || !isOnline) return;
    setSyncingPhotos(true);
    try {
      if (photoStats.failed > 0) {
        await retryFailedUploads();
      } else {
        await syncAllPendingObras();
      }
      await loadPhotoStats();
      await loadPendingObras();
    } catch (error) {
      console.error('Erro ao sincronizar fotos:', error);
    } finally {
      setSyncingPhotos(false);
    }
  };

  const handleDeleteObra = (obra: ObraListItem) => {
    const obraLabel = obra.obra ? `Obra ${obra.obra}` : 'este rascunho';
    Alert.alert(
      'Remover rascunho',
      `Deseja remover ${obraLabel}? Esta ação não pode ser desfeita.`,
      [
        { text: 'Cancelar', style: 'cancel' },
        {
          text: 'Remover',
          style: 'destructive',
          onPress: async () => {
            try {
              // Rascunhos podem estar em @obras_local (saveObraLocal) ou
              // em @obras_pending_sync (addObraOffline). Remove das duas para garantir.
              await Promise.all([
                removePendingObra(obra.id),
                removeLocalObra(obra.id),
              ]);
              // Recarrega ambas as fontes que alimentam combinedObras
              await Promise.all([loadPendingObras(), carregarObras()]);
            } catch (error) {
              console.error('Erro ao remover obra:', error);
              Alert.alert('Erro', 'Não foi possível remover o rascunho. Tente novamente.');
            }
          },
        },
      ]
    );
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
            await AsyncStorage.removeItem('@session_token');
            await AsyncStorage.removeItem('@session_expires_at');
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

        <View style={[styles.header, isSmallScreen && styles.headerSmall]}>
          <View style={styles.headerTop}>
            <Text style={[styles.title, isSmallScreen && styles.titleSmall]}>Obras</Text>
            <Text style={[styles.subtitle, isSmallScreen && styles.subtitleSmall]}>{subtitleText}</Text>
          </View>
          {!isOnline && (
            <View style={[styles.offlinePill, isSmallScreen && styles.offlinePillSmall]}>
              <Text style={styles.offlineHint}>Modo Offline</Text>
            </View>
          )}
        </View>

        <View style={[styles.metricsRow, isSmallScreen && styles.metricsRowStacked]}>
          <View style={[styles.metricCard, isSmallScreen && styles.metricCardStacked]}>
            <Text style={styles.metricLabel}>{isAdmin ? 'Total geral' : 'Total da equipe'}</Text>
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
            placeholder="Buscar por obra, responsavel ou equipe"
            value={searchTerm}
            onChangeText={setSearchTerm}
            autoCorrect={false}
            autoCapitalize="none"
          />
        </View>

        {/* Banner de status de fotos */}
        {(photoStats.failed > 0 || photoStats.pending > 0 || photoStats.uploading > 0) ? (
          <View style={[
            styles.photoSyncBanner,
            photoStats.failed > 0 ? styles.photoSyncBannerFailed
              : photoStats.uploading > 0 ? styles.photoSyncBannerUploading
              : styles.photoSyncBannerPending,
          ]}>
            <View style={styles.photoSyncBannerInfo}>
              {photoStats.uploading > 0 ? (
                <Text style={styles.photoSyncBannerTitle}>
                  Enviando {photoStats.uploading} foto(s)...
                </Text>
              ) : photoStats.failed > 0 ? (
                <>
                  <Text style={styles.photoSyncBannerTitle}>
                    {photoStats.failed} foto(s) com falha no envio
                  </Text>
                  <Text style={styles.photoSyncBannerSubtitle}>
                    Toque em "Tentar novamente" para reenviar
                  </Text>
                </>
              ) : (
                <>
                  <Text style={styles.photoSyncBannerTitle}>
                    {photoStats.pending} foto(s) aguardando envio
                  </Text>
                  <Text style={styles.photoSyncBannerSubtitle}>
                    {isOnline ? 'Conectado — toque para enviar agora' : 'Aguardando conexao com a internet'}
                  </Text>
                </>
              )}
            </View>
            {photoStats.uploading === 0 && (
              <TouchableOpacity
                style={[
                  styles.photoSyncBannerButton,
                  (!isOnline || syncingPhotos) && styles.photoSyncBannerButtonDisabled,
                ]}
                onPress={handleSyncPhotos}
                disabled={!isOnline || syncingPhotos}
              >
                {syncingPhotos ? (
                  <ActivityIndicator size="small" color="#fff" />
                ) : (
                  <Text style={styles.photoSyncBannerButtonText}>
                    {photoStats.failed > 0 ? 'Tentar novamente' : 'Enviar'}
                  </Text>
                )}
              </TouchableOpacity>
            )}
          </View>
        ) : combinedObras.length > 0 ? (
          <View style={styles.photoSyncBannerAll}>
            <Text style={styles.photoSyncBannerAllText}>Todas as fotos sincronizadas</Text>
          </View>
        ) : null}

        {pendingObrasDaEquipe.length > 0 && (
          <View style={styles.syncBanner}>
            <View style={styles.syncBannerInfo}>
              <Text style={styles.syncBannerTitle}>
                {pendingObrasDaEquipe.length} obra(s) {isAdmin ? 'aguardando sincronizacao' : 'da sua equipe aguardando sincronizacao'}
              </Text>
              <Text style={styles.syncBannerSubtitle}>
                {isOnline ? 'Envie agora para liberar espaco.' : 'Conecte-se para finalizar o envio.'}
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
        ) : groupedFilteredObras.length === 0 ? (
          <View style={styles.card}>
            <Text style={styles.cardTitle}>Nenhum resultado</Text>
            <Text style={styles.cardText}>
              Ajuste o termo de busca para encontrar uma obra.
            </Text>
          </View>
        ) : (
          groupedFilteredObras.map((grupo) => {
            const obra = grupo.principal;
            const obraIds = grupo.itens.map((item) => item.id);

            const servicosDb = obraIds.flatMap((id) => servicosPorObra[id] || []);
            const servicosDbUnicos = servicosDb.filter((servico, index, lista) => {
              return lista.findIndex((item) => item.id === servico.id) === index;
            });
            const legacyServicos = grupo.itens
              .map((item) => ({
                ...(item as any), // inclui todos os campos de fotos da obra
                id: `legacy-${item.id}-servico`,
                obra_id: item.id,
                tipo_servico: (item.tipo_servico || 'Documentação') as TipoServico,
                responsavel: item.responsavel,
                status: item.status === 'finalizada' ? 'completo' : 'rascunho',
                sync_status: toSyncStatusServico(item),
                created_at: item.created_at,
                updated_at: item.created_at,
                fotos_antes: (item as any).fotos_antes || [],
                fotos_durante: (item as any).fotos_durante || [],
                fotos_depois: (item as any).fotos_depois || [],
              } as Servico));

            const legacyServicosUnicos = legacyServicos.filter((servico, index, lista) => {
              return lista.findIndex((item) => item.id === servico.id) === index;
            });

            const servicosRender = [...servicosDbUnicos, ...legacyServicosUnicos];

            // Calcular status da obra baseado nos serviços novos
            // Se há serviços DB, considera-los. Se não, usa status original.
            let displayStatus: 'em_aberto' | 'rascunho' | 'finalizada' = obra.status || 'em_aberto';
            if (servicosDbUnicos.length > 0) {
              // Há serviços novos: calcular status baseado neles
              const todosCompletos = servicosDbUnicos.every((s) => s.status === 'completo');
              displayStatus = todosCompletos ? 'finalizada' : 'em_aberto';
            }

            return (
              <View key={grupo.groupKey} style={{ marginBottom: 12 }}>
                <ObraContainer
                  obraId={grupo.groupKey}
                  obraData={formatarData(obra.data)}
                  obraTitle={grupo.obraNumero}
                  responsavel={obra.responsavel}
                  equipe={obra.equipe}
                  status={displayStatus}
                  servicos={servicosRender}
                  isExpanded={false}
                  onToggleExpand={() => handleOpenObraBooksPage(grupo)}
                  onAddService={() => handleOpenObraBooksPage(grupo)}
                />

                {renderStatusBadge(obra)}

                {obra.origem === 'offline' && !obra.serverId && (
                  <View style={styles.cardFooter}>
                    <TouchableOpacity style={styles.syncObraButton} onPress={() => handleSyncSingleObra(obra)}>
                      <Text style={styles.syncObraButtonText}>Sincronizar obra</Text>
                    </TouchableOpacity>
                    <TouchableOpacity style={styles.deleteObraButton} onPress={() => handleDeleteObra(obra)}>
                      <Text style={styles.deleteObraButtonText}>Remover rascunho</Text>
                    </TouchableOpacity>
                  </View>
                )}
              </View>
            );
          })
        )}
      </View>
      </ScrollView>

      <ServiceTypeSelector
        visible={serviceSelectorVisible}
        onClose={() => {
          setServiceSelectorVisible(false);
          setSelectedObraIdForService(null);
        }}
        onSelect={handleCreateServiceForObra}
      />

      {/* Modal de Progresso de Sincronização */}
      <SyncProgressModal
        visible={syncModalVisible}
        progress={syncProgress}
        onClose={() => setSyncModalVisible(false)}
        onCancel={handleCancelSync}
      />

      {/* Modal para Selecionar Câmera ou Galeria */}
      {capturingPhotoForServico && (
        <View style={styles.photoSourceOverlay}>
          <View style={styles.photoSourceModal}>
            <Text style={styles.photoSourceTitle}>Adicionar Foto</Text>
            <TouchableOpacity
              style={styles.photoSourceButton}
              onPress={capturePhotoFromCamera}
              disabled={captureLoading}
            >
              <Text style={styles.photoSourceButtonText}>📷 Tirar Foto</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={styles.photoSourceButton}
              onPress={selectPhotoFromGallery}
              disabled={captureLoading}
            >
              <Text style={styles.photoSourceButtonText}>🖼️ Selecionar da Galeria</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.photoSourceButton, styles.photoSourceButtonCancel]}
              onPress={() => setCapturingPhotoForServico(null)}
              disabled={captureLoading}
            >
              <Text style={styles.photoSourceButtonTextCancel}>Cancelar</Text>
            </TouchableOpacity>
            {captureLoading && (
              <ActivityIndicator size="large" color="#0066cc" style={{ marginTop: 16 }} />
            )}
          </View>
        </View>
      )}
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
  headerSmall: {
    alignItems: 'flex-start',
    gap: 8,
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
  offlinePillSmall: {
    marginLeft: 0,
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
    textAlign: 'center',
    flexShrink: 1,
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
    textAlign: 'center',
    flexShrink: 1,
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
  obraHeaderSmall: {
    paddingRight: 78,
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
  syncBadgePartial: {
    backgroundColor: '#fff3cd',
    borderWidth: 1,
    borderColor: '#ffe08a',
  },
  syncBadgeFailed: {
    backgroundColor: '#ffebee',
  },
  photoSyncBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    borderRadius: 10,
    padding: 12,
    marginBottom: 10,
  },
  photoSyncBannerFailed: {
    backgroundColor: '#ffebee',
    borderLeftWidth: 4,
    borderLeftColor: '#e53935',
  },
  photoSyncBannerPending: {
    backgroundColor: '#fff3e0',
    borderLeftWidth: 4,
    borderLeftColor: '#ff9800',
  },
  photoSyncBannerUploading: {
    backgroundColor: '#e3f2fd',
    borderLeftWidth: 4,
    borderLeftColor: '#1976d2',
  },
  photoSyncBannerInfo: {
    flex: 1,
    marginRight: 8,
  },
  photoSyncBannerTitle: {
    fontSize: 13,
    fontWeight: '600',
    color: '#333',
  },
  photoSyncBannerSubtitle: {
    fontSize: 11,
    color: '#666',
    marginTop: 2,
  },
  photoSyncBannerButton: {
    backgroundColor: '#1565c0',
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 6,
    minWidth: 80,
    alignItems: 'center',
  },
  photoSyncBannerButtonDisabled: {
    backgroundColor: '#aaa',
  },
  photoSyncBannerButtonText: {
    color: '#fff',
    fontSize: 12,
    fontWeight: '600',
  },
  photoSyncBannerAll: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#e8f5e9',
    borderRadius: 10,
    padding: 10,
    marginBottom: 10,
    borderLeftWidth: 4,
    borderLeftColor: '#43a047',
  },
  photoSyncBannerAllText: {
    color: '#2e7d32',
    fontSize: 13,
    fontWeight: '500',
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
  syncIndicatorContainerSmall: {
    right: 8,
    maxWidth: 86,
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
  syncIndicatorPartial: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#fff3cd',
    borderRadius: 8,
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderWidth: 1,
    borderColor: '#ff9800',
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
  syncIndicatorTextPartial: {
    fontSize: 10,
    fontWeight: '700',
    color: '#b45309',
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
  cardFooter: {
    borderTopWidth: 1,
    borderTopColor: '#f0f0f0',
    marginTop: 10,
    paddingTop: 8,
    alignItems: 'flex-start',
  },
  syncObraButton: {
    paddingVertical: 4,
    marginBottom: 6,
  },
  syncObraButtonText: {
    fontSize: 13,
    color: '#0066cc',
    fontWeight: '700',
  },
  deleteObraButton: {
    paddingVertical: 4,
  },
  deleteObraButtonText: {
    fontSize: 13,
    color: '#dc3545',
    fontWeight: '600',
  },
  photoSourceOverlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'flex-end',
    zIndex: 1000,
  },
  photoSourceModal: {
    backgroundColor: '#FFF',
    borderTopLeftRadius: 16,
    borderTopRightRadius: 16,
    paddingHorizontal: 20,
    paddingVertical: 24,
    paddingBottom: 32,
  },
  photoSourceTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: '#111827',
    marginBottom: 16,
    textAlign: 'center',
  },
  photoSourceButton: {
    backgroundColor: '#0066cc',
    borderRadius: 8,
    paddingVertical: 12,
    paddingHorizontal: 16,
    marginBottom: 10,
    justifyContent: 'center',
    alignItems: 'center',
  },
  photoSourceButtonText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#FFF',
  },
  photoSourceButtonCancel: {
    backgroundColor: '#E5E7EB',
  },
  photoSourceButtonTextCancel: {
    fontSize: 16,
    fontWeight: '600',
    color: '#6B7280',
  },
});


