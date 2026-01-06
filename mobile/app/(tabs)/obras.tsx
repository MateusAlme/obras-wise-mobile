import { View, Text, StyleSheet, ScrollView, TouchableOpacity, RefreshControl, ActivityIndicator, Alert, TextInput } from 'react-native';
import { useState, useEffect, useMemo, useCallback } from 'react';
import { useRouter, useFocusEffect } from 'expo-router';
import { supabase } from '../../lib/supabase';
import AsyncStorage from '@react-native-async-storage/async-storage';
import NetInfo from '@react-native-community/netinfo';
import { checkInternetConnection, getPendingObras, startAutoSync, syncAllPendingObras, getLocalObras, saveObraLocal, syncAllLocalObras } from '../../lib/offline-sync';
import type { PendingObra, LocalObra } from '../../lib/offline-sync';
import { removeDuplicateObras } from '../../lib/fix-duplicates';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';

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
  const [syncingLocal, setSyncingLocal] = useState(false);
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
    // ✅ CORREÇÃO: Preservar origem que já está salva em cada obra
    const pendentes: ObraListItem[] = pendingObrasState.map((obra) => ({
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

      // OFFLINE-FIRST: Buscar do AsyncStorage primeiro
      console.log('📱 Carregando obras do AsyncStorage...');
      let localObras = await getLocalObras();

      // Se AsyncStorage vazio, buscar do Supabase (migração)
      if (localObras.length === 0) {
        console.log('⚠️ AsyncStorage vazio - buscando do Supabase para migração inicial...');
        console.log(`🔍 Equipe logada: "${equipe}"`);
        const online = await checkInternetConnection();

        if (online) {
          // Buscar TODAS as obras primeiro para debug
          const { data: todasObras, error: erroTodas } = await supabase
            .from('obras')
            .select('*')
            .order('created_at', { ascending: false });

          console.log(`📊 Total de obras no Supabase: ${todasObras?.length || 0}`);

          if (todasObras && todasObras.length > 0) {
            // Mostrar equipes únicas
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
          }

          if (!error && data) {
            console.log(`📥 Migrando ${data.length} obra(s) do Supabase para AsyncStorage...`);

            // Salvar cada obra no AsyncStorage
            for (const obra of data) {
              // Obras do Supabase já estão sincronizadas
              const localObras = await getLocalObras();
              const existingLocal = localObras.find(o => o.id === obra.id);

              // Se já existe local, preservar dados locais (pode ter edições não sincronizadas)
              if (existingLocal) {
                console.log(`⚠️ Obra ${obra.id} já existe localmente - preservando versão local`);
                continue;
              }

              // Salvar obra do Supabase como já sincronizada
              const savedObra: LocalObra = {
                ...obra,
                id: obra.id,
                synced: true,  // ✅ Já está no banco
                locallyModified: false,
                serverId: obra.id,
                origem: 'online', // ✅ CRÍTICO: Obra vem do Supabase
                last_modified: obra.updated_at || obra.created_at,
                created_at: obra.created_at,
              } as LocalObra;

              localObras.push(savedObra);
              await AsyncStorage.setItem(LOCAL_OBRAS_KEY, JSON.stringify(localObras));
              console.log(`✅ Obra ${obra.id} migrada e marcada como sincronizada`);
            }

            // Recarregar do AsyncStorage
            localObras = await getLocalObras();
            console.log(`✅ Migração completa: ${localObras.length} obra(s)`);
          } else {
            console.log('⚠️ Nenhuma obra encontrada para esta equipe');
          }
        } else {
          // Se offline e AsyncStorage vazio, não há obras
          console.log('📴 Offline e AsyncStorage vazio - nenhuma obra disponível');
        }
      }

      // ✅ AUTO-CORREÇÃO: Corrigir obras sincronizadas que faltam campos
      console.log(`📊 Debug: Total de obras locais: ${localObras.length}`);
      localObras.forEach((obra, index) => {
        console.log(`  Obra ${index + 1}: ${obra.obra} - synced:${obra.synced}, origem:${obra.origem}, status:${obra.status}`);
      });

      const obrasComCamposFaltando = localObras.filter(
        obra => obra.synced && (!obra.origem || !obra.status)
      );

      console.log(`🔍 Obras que precisam correção: ${obrasComCamposFaltando.length}`);

      if (obrasComCamposFaltando.length > 0) {
        console.log(`🔧 Auto-correção: ${obrasComCamposFaltando.length} obra(s) sincronizada(s) sem origem/status`);
        obrasComCamposFaltando.forEach(obra => {
          console.log(`  - Obra ${obra.obra}: origem=${obra.origem}, status=${obra.status}`);
        });

        try {
          // Importar função de correção dinamicamente
          const { fixObraOrigemStatus } = await import('../../lib/fix-origem-status');

          // Executar correção silenciosamente
          const resultado = await fixObraOrigemStatus();

          console.log(`📊 Resultado da correção: total=${resultado.total}, corrigidas=${resultado.corrigidas}, erros=${resultado.erros}`);

          if (resultado.corrigidas > 0) {
            console.log(`✅ Auto-correção: ${resultado.corrigidas} obra(s) corrigida(s) automaticamente`);
            // Recarregar obras após correção
            localObras = await getLocalObras();
          }
        } catch (error) {
          console.error('❌ Erro na auto-correção:', error);
        }
      }

      // Filtrar apenas obras da equipe logada
      const obrasEquipe = localObras.filter(obra => obra.equipe === equipe);

      // Ordenar por timestamp de criação (mais recente primeiro)
      obrasEquipe.sort((a, b) => {
        // Usar created_at como prioridade (timestamp ISO)
        // Fallback para data da obra se created_at não existir
        const getTimestamp = (obra: LocalObra) => {
          if (obra.created_at) {
            return new Date(obra.created_at).getTime();
          }
          if (obra.data) {
            return new Date(obra.data).getTime();
          }
          return 0;
        };

        const timestampA = getTimestamp(a);
        const timestampB = getTimestamp(b);

        return timestampB - timestampA; // Decrescente (mais recente primeiro)
      });

      console.log('🔍 ORDENAÇÃO - Primeiras 3 obras:');
      obrasEquipe.slice(0, 3).forEach((obra, index) => {
        console.log(`  ${index + 1}. Obra ${obra.obra} - Data: ${obra.data} - Created: ${obra.created_at || 'N/A'}`);
      });

      // Converter para formato compatível
      const obrasFormatadas = obrasEquipe.map(obra => ({
        ...obra,
        status: obra.status || 'em_aberto',
      })) as Obra[];

      setOnlineObras(obrasFormatadas);
      console.log(`✅ ${obrasFormatadas.length} obra(s) carregadas (ordenadas por data)`);
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
    try {
      setLoading(true);
      console.log('🔄 Atualizando lista de obras...');

      // OFFLINE-FIRST: Apenas recarregar do AsyncStorage
      // NÃO deletar nada, NÃO buscar do Supabase
      // Simplesmente atualizar a visualização dos dados locais
      await carregarObras();

      console.log('✅ Lista atualizada com sucesso');
    } catch (error) {
      console.error('❌ Erro ao atualizar lista:', error);
      Alert.alert('Erro', 'Não foi possível atualizar a lista de obras');
    } finally {
      setLoading(false);
    }
  };

  const handleLimparDuplicatas = async () => {
    try {
      Alert.alert(
        '🧹 Limpar Duplicatas',
        'Deseja remover obras duplicadas do dispositivo?\n\nSerá mantida apenas a versão mais recente de cada obra.',
        [
          { text: 'Cancelar', style: 'cancel' },
          {
            text: 'Limpar',
            style: 'destructive',
            onPress: async () => {
              setLoading(true);
              try {
                console.log('🧹 Iniciando limpeza de duplicatas...');
                const resultado = await removeDuplicateObras();

                await carregarObras(); // Recarregar lista

                Alert.alert(
                  '✅ Limpeza Concluída',
                  `Total de obras: ${resultado.total}\nDuplicadas encontradas: ${resultado.duplicadas}\nRemovidas: ${resultado.removidas}`
                );
              } catch (error) {
                console.error('❌ Erro ao limpar duplicatas:', error);
                Alert.alert('Erro', 'Não foi possível limpar as duplicatas');
              } finally {
                setLoading(false);
              }
            }
          }
        ]
      );
    } catch (error) {
      console.error('❌ Erro:', error);
    }
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

  const handleSyncLocalObras = async () => {
    // Verificar conexão
    const online = await checkInternetConnection();
    if (!online) {
      Alert.alert('Sem Conexão', 'Conecte-se à internet para sincronizar as obras.');
      return;
    }

    // Verificar quantas obras não sincronizadas existem
    const localObras = await getLocalObras();
    const obrasNaoSincronizadas = localObras.filter(o => !o.synced || o.locallyModified);

    if (obrasNaoSincronizadas.length === 0) {
      Alert.alert('✅ Tudo Sincronizado', 'Todas as obras já estão sincronizadas com a nuvem.');
      return;
    }

    // Confirmar com usuário
    Alert.alert(
      '☁️ Sincronizar com Nuvem',
      `Deseja enviar ${obrasNaoSincronizadas.length} obra(s) para a nuvem?\n\nIsso pode consumir dados móveis.`,
      [
        { text: 'Cancelar', style: 'cancel' },
        {
          text: 'Sincronizar',
          onPress: async () => {
            setSyncingLocal(true);
            try {
              console.log(`🔄 Iniciando sincronização de ${obrasNaoSincronizadas.length} obra(s)...`);
              const result = await syncAllLocalObras();

              if (result.success > 0) {
                // Recarregar lista após sync
                await carregarObras();
              }

              if (result.success === 0 && result.failed === 0) {
                Alert.alert('Sem Conexão', 'Não foi possível conectar ao servidor.');
              } else if (result.failed > 0) {
                Alert.alert(
                  'Sincronização Parcial',
                  `✅ ${result.success} obra(s) sincronizada(s)\n❌ ${result.failed} falha(s)\n\nTente novamente para enviar as obras restantes.`
                );
              } else {
                Alert.alert(
                  '✅ Sincronização Completa',
                  `${result.success} obra(s) enviada(s) para a nuvem com sucesso!`
                );
              }
            } catch (error) {
              console.error('❌ Erro ao sincronizar obras locais:', error);
              Alert.alert('Erro', 'Falha na sincronização. Tente novamente mais tarde.');
            } finally {
              setSyncingLocal(false);
            }
          }
        }
      ]
    );
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
          <View style={styles.headerTop}>
            <Text style={styles.title}>Obras</Text>
            <Text style={styles.subtitle}>{subtitleText}</Text>
            {!isOnline && (
              <Text style={styles.offlineHint}>📴 Modo Offline</Text>
            )}
          </View>
        </View>

        {/* Barra de Ações */}
        <View style={styles.actionsBar}>
          <TouchableOpacity
            style={styles.actionButton}
            onPress={() => router.push('/nova-obra')}
          >
            <Text style={styles.actionButtonIcon}>➕</Text>
            <Text style={styles.actionButtonLabel}>Nova Obra</Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={[
              styles.actionButton,
              (!isOnline || syncingLocal) && styles.actionButtonDisabled
            ]}
            onPress={handleSyncLocalObras}
            disabled={!isOnline || syncingLocal}
          >
            {syncingLocal ? (
              <ActivityIndicator size="small" color="#3b82f6" />
            ) : (
              <Text style={styles.actionButtonIcon}>☁️</Text>
            )}
            <Text style={styles.actionButtonLabel}>Sincronizar</Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={styles.actionButton}
            onPress={limparCacheERecarregar}
          >
            <Text style={styles.actionButtonIcon}>🔄</Text>
            <Text style={styles.actionButtonLabel}>Atualizar</Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={styles.actionButton}
            onPress={handleLimparDuplicatas}
          >
            <Text style={styles.actionButtonIcon}>🧹</Text>
            <Text style={styles.actionButtonLabel}>Limpar</Text>
          </TouchableOpacity>
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
            const isRascunho = obra.status === 'rascunho';
            const isSynced = obra.synced === true;

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
    fontSize: 11,
    color: '#f59e0b',
    marginTop: 4,
    fontWeight: '600',
  },
  headerTop: {
    marginBottom: 4,
  },
  actionsBar: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    gap: 12,
    marginBottom: 16,
    paddingHorizontal: 4,
  },
  actionButton: {
    flex: 1,
    backgroundColor: '#fff',
    borderRadius: 12,
    paddingVertical: 14,
    paddingHorizontal: 8,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: '#e5e7eb',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 2,
    elevation: 1,
    minHeight: 70,
  },
  actionButtonDisabled: {
    opacity: 0.5,
  },
  actionButtonIcon: {
    fontSize: 24,
    marginBottom: 4,
  },
  actionButtonLabel: {
    fontSize: 11,
    color: '#374151',
    fontWeight: '600',
    textAlign: 'center',
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
  statusBadgeRascunho: {
    backgroundColor: '#fef3c7',
    borderRadius: 8,
    paddingHorizontal: 10,
    paddingVertical: 4,
  },
  obraCardRascunho: {
    borderLeftWidth: 4,
    borderLeftColor: '#f59e0b',
  },
  statusBadgeText: {
    fontSize: 12,
    fontWeight: '600',
    color: '#155724',
  },
  syncIndicatorContainer: {
    position: 'absolute',
    top: 12,
    right: 12,
    zIndex: 10,
  },
  syncIndicatorSynced: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#d1f4e0',
    borderRadius: 8,
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderWidth: 1,
    borderColor: '#10b981',
  },
  syncIndicatorPending: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#fff3cd',
    borderRadius: 8,
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderWidth: 1,
    borderColor: '#ffc107',
  },
  syncIndicatorIcon: {
    fontSize: 14,
    marginRight: 4,
  },
  syncIndicatorTextSynced: {
    fontSize: 11,
    fontWeight: '600',
    color: '#059669',
  },
  syncIndicatorTextPending: {
    fontSize: 11,
    fontWeight: '600',
    color: '#d97706',
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
