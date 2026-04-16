import { useEffect, useMemo, useState } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, ScrollView, Alert, ActivityIndicator, LayoutAnimation, Platform, UIManager, Modal, Image } from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import AsyncStorage from '@react-native-async-storage/async-storage';
import * as ImagePicker from 'expo-image-picker';
import NetInfo from '@react-native-community/netinfo';
import { SafeAreaView } from 'react-native-safe-area-context';
import { supabase } from '../lib/supabase';
import { ServiceCard, ServiceTypeSelector } from '../components/ServicosComponents';
import { SERVICO_PHOTO_MAP, type Servico, type TipoServico, type FotoInfo as ServicoFotoInfo } from '../types/servico';
import { createServico, fetchServicosForObra, markServicoComplete, syncAllPendingServicos, appendPhotoToServicoLocal } from '../lib/servico-sync';
import { getPendingObras, getLocalObras, syncObra, syncAllPendingObras, checkInternetConnection, type PendingObra } from '../lib/offline-sync';
import { backupPhoto, getPhotoMetadatasByIds } from '../lib/photo-backup';
import { processObraPhotos } from '../lib/photo-queue';

type ObraListItem = {
  id: string;
  data: string;
  obra: string;
  responsavel: string;
  equipe: string;
  tipo_servico: string;
  created_at: string;
  status?: 'em_aberto' | 'finalizada' | 'rascunho';
  synced?: boolean;
  serverId?: string;
  origem?: 'online' | 'offline';
  sync_status?: string;
  error_message?: string;
  creator_role?: string;
  fotos_antes?: unknown[];
  fotos_durante?: unknown[];
  fotos_depois?: unknown[];
};

type FilterType = 'todos' | 'andamento' | 'concluidos' | 'pendentes';

const isUuid = (value: string): boolean => {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(value);
};

export default function ObraBooksPage() {
  const router = useRouter();
  const params = useLocalSearchParams<{ obraNumero?: string }>();
  const obraNumero = String(params.obraNumero || '').trim();

  const [loading, setLoading] = useState(true);
  const [syncingDraftId, setSyncingDraftId] = useState<string | null>(null);
  const [syncingAllDrafts, setSyncingAllDrafts] = useState(false);
  const [isOnline, setIsOnline] = useState(true);
  const [obras, setObras] = useState<ObraListItem[]>([]);
  const [pendingDrafts, setPendingDrafts] = useState<PendingObra[]>([]);
  const [servicosPorItemId, setServicosPorItemId] = useState<Record<string, Servico[]>>({});
  const [expandedServicoId, setExpandedServicoId] = useState<string | null>(null);
  const [filter, setFilter] = useState<FilterType>('todos');
  const [serviceSelectorVisible, setServiceSelectorVisible] = useState(false);
  const [selectedObraIdForService, setSelectedObraIdForService] = useState<string | null>(null);
  const [captureLoading, setCaptureLoading] = useState(false);
  const [capturingPhotoForServico, setCapturingPhotoForServico] = useState<{
    servicoId: string;
    category: string;
    obraId: string;
  } | null>(null);
  const [photoViewerUri, setPhotoViewerUri] = useState<string | null>(null);
  const [photoViewerScale, setPhotoViewerScale] = useState(1);
  const [lastSyncTime, setLastSyncTime] = useState<number>(0);

  const isCompressorBook = (obra: { tipo_servico?: string; creator_role?: string }) => {
    return obra?.tipo_servico === 'Cava em Rocha' || obra?.creator_role === 'compressor';
  };

  useEffect(() => {
    if (Platform.OS === 'android' && UIManager.setLayoutAnimationEnabledExperimental) {
      UIManager.setLayoutAnimationEnabledExperimental(true);
    }
  }, []);

  const getSyncedObraId = (obra: ObraListItem) => obra.serverId || (isUuid(obra.id) ? obra.id : null);

  const loadServicosForItems = async (items: ObraListItem[]) => {
    const entries = await Promise.all(
      items.map(async (item) => {
        const targetIds = Array.from(new Set([item.id, item.serverId].filter(Boolean) as string[]));
        if (targetIds.length === 0) return [item.id, [] as Servico[]] as const;

        const list = await Promise.all(targetIds.map((targetId) => fetchServicosForObra(targetId)));
        const merged = list.flat().filter((servico, index, arr) => arr.findIndex((s) => s.id === servico.id) === index);

        return [item.id, merged] as const;
      })
    );

    setServicosPorItemId(Object.fromEntries(entries));
  };

  const loadData = async () => {
    if (!obraNumero) {
      setLoading(false);
      return;
    }

    setLoading(true);
    try {
      const [equipe, role, pending, localObras] = await Promise.all([
        AsyncStorage.getItem('@equipe_logada'),
        AsyncStorage.getItem('@user_role'),
        getPendingObras(),
        getLocalObras(),
      ]);

      const userRole = role || 'equipe';
      const isAdmin = userRole === 'admin';
      const isCompressor = userRole === 'compressor';

      const pendingFiltered: ObraListItem[] = pending
        .filter((obra) => {
          if (String(obra.obra || '').trim() !== obraNumero) return false;
          if (!isAdmin && (!equipe || obra.equipe !== equipe)) return false;
          if (!isCompressor) return true;
          return isCompressorBook(obra as any);
        })
        .map((obra) => ({ ...obra, origem: 'offline' as const }));

      const pendingDraftsFiltered = pending.filter((obra) => {
        if (String(obra.obra || '').trim() !== obraNumero) return false;
        if (!isAdmin && (!equipe || obra.equipe !== equipe)) return false;
        if (!isCompressor) return true;
        return isCompressorBook(obra as any);
      });

      setPendingDrafts(pendingDraftsFiltered);

      const localFiltered: ObraListItem[] = (localObras || [])
        .filter((obra) => {
          if (String(obra.obra || '').trim() !== obraNumero) return false;
          if (!isAdmin && (!equipe || obra.equipe !== equipe)) return false;
          if (!isCompressor) return true;
          return isCompressorBook(obra as any);
        })
        .map((obra) => ({
          ...(obra as any),
          origem: (obra as any).origem || ((obra as any).synced ? 'online' : 'offline'),
        }));

      let onlineFiltered: ObraListItem[] = [];
      if (isOnline) {
        const { data: onlineData, error } = await supabase
          .from('obras')
          .select('*')
          .eq('obra', obraNumero)
          .order('created_at', { ascending: true });

        if (!error && onlineData) {
          onlineFiltered = (onlineData as any[])
            .filter((obra) => {
              if (!isAdmin && (!equipe || obra.equipe !== equipe)) return false;
              if (!isCompressor) return true;
              return isCompressorBook(obra as any);
            })
            .map((obra) => ({ ...obra, origem: 'online' as const }));
        }
      }

      // Dedup: se dois itens apontam para a mesma obra real (mesmo UUID), manter apenas o primeiro.
      // Isso evita que um obra local {id:'temp-xxx', serverId:'real-uuid'} e
      // a versão online {id:'real-uuid'} apareçam como dois cards separados.
      const deduped = [...pendingFiltered, ...localFiltered, ...onlineFiltered].filter((item, index, arr) => {
        const itemRealId = item.serverId || (isUuid(item.id) ? item.id : null);
        if (!itemRealId) {
          // Rascunho sem UUID real → deduplica pelo id local
          return arr.findIndex((x) => x.id === item.id) === index;
        }
        // Tem UUID real → mantém apenas a primeira ocorrência desse UUID
        return arr.findIndex((x) => {
          const xRealId = x.serverId || (isUuid(x.id) ? x.id : null);
          return xRealId === itemRealId;
        }) === index;
      });

      deduped.sort((a, b) => {
        const ta = new Date(a.created_at || a.data || 0).getTime();
        const tb = new Date(b.created_at || b.data || 0).getTime();
        return ta - tb;
      });

      setObras(deduped);
      await loadServicosForItems(deduped);
    } catch (error) {
      console.error('Erro ao carregar books da obra:', error);
      Alert.alert('Erro', 'Não foi possível carregar os books desta obra.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, [obraNumero, isOnline]);

  useEffect(() => {
    let mounted = true;

    checkInternetConnection().then((online) => {
      if (mounted) setIsOnline(online);
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

  const allServicos = useMemo(() => {
    const servicosDb = obras.flatMap((item) => servicosPorItemId[item.id] || []);

    const legacyServicos = obras.map((item) => ({
      ...(item as any),
      id: `legacy-${item.id}-servico`,
      obra_id: item.id,
      tipo_servico: (item.tipo_servico || 'Documentação') as TipoServico,
      responsavel: item.responsavel,
      status: item.status === 'finalizada' ? 'completo' : 'rascunho',
      sync_status:
        item.origem === 'online' || !!item.serverId || isUuid(item.id) || item.synced === true
          ? 'synced'
          : 'offline',
      created_at: item.created_at,
      updated_at: item.created_at,
      fotos_antes: (item as any).fotos_antes || [],
      fotos_durante: (item as any).fotos_durante || [],
      fotos_depois: (item as any).fotos_depois || [],
    } as Servico));

    const dbUnique = servicosDb.filter((servico, index, lista) => {
      return lista.findIndex((x) => x.id === servico.id) === index;
    });

    const legacyUnique = legacyServicos.filter((servico, index, lista) => {
      return lista.findIndex((x) => x.id === servico.id) === index;
    });

    return [...legacyUnique, ...dbUnique].sort((a, b) => {
      const ta = new Date(a.created_at || 0).getTime();
      const tb = new Date(b.created_at || 0).getTime();
      return ta - tb;
    });
  }, [obras, servicosPorItemId]);

  const hasAnyPhoto = (servico: Servico) => {
    const categories = SERVICO_PHOTO_MAP[servico.tipo_servico] || [];
    return categories.some((category) => {
      const photos = (servico[category.field] || []) as unknown[];
      return photos.length > 0;
    });
  };

  const filteredServicos = useMemo(() => {
    if (filter === 'todos') return allServicos;
    if (filter === 'andamento') return allServicos.filter((s) => s.status !== 'completo');
    if (filter === 'concluidos') return allServicos.filter((s) => s.status === 'completo');
    return allServicos.filter((s) => !hasAnyPhoto(s));
  }, [allServicos, filter]);

  const getTargetSyncedObraForNewService = () => {
    const sorted = [...obras].sort((a, b) => new Date(b.created_at || 0).getTime() - new Date(a.created_at || 0).getTime());
    return sorted.find((obra) => !!getSyncedObraId(obra));
  };

  const handleStartAddService = () => {
    const target = getTargetSyncedObraForNewService();
    if (!target) {
      Alert.alert('Sincronize primeiro', 'Sincronize pelo menos um book desta obra antes de adicionar novos serviços.');
      return;
    }

    setSelectedObraIdForService(getSyncedObraId(target));
    setServiceSelectorVisible(true);
  };

  const handleCreateService = async (tipo: TipoServico) => {
    if (!selectedObraIdForService) return;

    const result = await createServico(selectedObraIdForService, tipo, obras[0]?.responsavel, obraNumero);
    if (!result.success) {
      Alert.alert('Erro', result.error || 'Não foi possível criar o serviço.');
      return;
    }

    await loadData();
  };

  const handleMarkServiceComplete = async (servico: Servico) => {
    if (servico.id.startsWith('legacy-')) {
      const obraLegada = obras.find((item) => item.id === servico.obra_id);
      if (obraLegada) {
        handleOpenLegacyObraForm(obraLegada);
      } else {
        Alert.alert('Atenção', 'Abra este book no formulário original para concluir.');
      }
      return;
    }

    const ok = await markServicoComplete(servico.id, servico.obra_id);
    if (!ok) {
      Alert.alert('Erro', 'Não foi possível marcar este serviço como concluído.');
      return;
    }

    await loadData();
  };

  const handleCapturePhoto = (servico: Servico, category: keyof Servico) => {
    if (servico.id.startsWith('legacy-')) {
      const obraLegada = obras.find((item) => item.id === servico.obra_id);
      if (obraLegada) {
        handleOpenLegacyObraForm(obraLegada);
      } else {
        Alert.alert('Atenção', 'Abra este book no formulário original para adicionar fotos.');
      }
      return;
    }

    setCapturingPhotoForServico({
      servicoId: servico.id,
      category: String(category),
      obraId: servico.obra_id,
    });
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
      Alert.alert('Erro', 'Não foi possível tirar a foto.');
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
      console.error('Erro ao selecionar foto:', error);
      Alert.alert('Erro', 'Não foi possível selecionar a foto.');
    } finally {
      setCaptureLoading(false);
    }
  };

  const addPhotoToServico = async (photoUri: string) => {
    if (!capturingPhotoForServico) return;

    try {
      const { servicoId, category, obraId } = capturingPhotoForServico;

      const photoMetadata = await backupPhoto(photoUri, obraId, category.replace(/^fotos_/, '') as any, 0, null, null, 'image/jpeg');

      // SEMPRE salva localmente primeiro (padrão obra-detalhe):
      // garante preview imediato offline e que resolveLocalPhotosToUrls
      // consiga re-processar o upload depois via o campo id + uri.
      const localSaved = await appendPhotoToServicoLocal(
        servicoId, obraId, category as any,
        photoMetadata.id, photoMetadata.compressedPath,
        { latitude: photoMetadata.latitude, longitude: photoMetadata.longitude, utmX: photoMetadata.utmX, utmY: photoMetadata.utmY, utmZone: photoMetadata.utmZone }
      );

      if (!localSaved) {
        Alert.alert('Erro', 'Não foi possível salvar a foto localmente neste serviço.');
        return;
      }

      setCapturingPhotoForServico(null);
      await loadData(); // exibe URI local imediatamente

      // Se online E serviço já tem UUID real: tenta upload imediato e atualiza Supabase
      // (igual ao syncLocalObra de obra-detalhe que sobe fotos e salva URLs)
      if (isOnline && isUuid(servicoId) && isUuid(obraId)) {
        try {
          await processObraPhotos(obraId, undefined, [photoMetadata.id]);
          const [uploadedMetadata] = await getPhotoMetadatasByIds([photoMetadata.id]);
          const publicUrl = uploadedMetadata?.uploadUrl || uploadedMetadata?.supabaseUrl;

          if (publicUrl) {
            // Upload OK: salva no Supabase com URL real + id para reprocessamento futuro
            const { data: servicoAtual } = await supabase
              .from('servicos')
              .select('*')
              .eq('id', servicoId)
              .single();

            if (servicoAtual) {
              const fieldName = category as keyof Servico;
              const photos = ((servicoAtual as any)[fieldName] || []) as ServicoFotoInfo[];
              const normalizedPhotos: ServicoFotoInfo[] = photos.map((photo) => {
                const { uri, ...rest } = photo as any;
                return {
                  ...rest,
                  url: rest.url || uri,
                  utm_x: rest.utm_x ?? (rest.utmX ? Number(rest.utmX) : undefined),
                  utm_y: rest.utm_y ?? (rest.utmY ? Number(rest.utmY) : undefined),
                };
              });

              const novaFoto: ServicoFotoInfo = {
                id: photoMetadata.id, // necessário para resolveLocalPhotosToUrls re-processar se necessário
                url: publicUrl,
                latitude: photoMetadata.latitude,
                longitude: photoMetadata.longitude,
                utm_x: photoMetadata.utmX ?? undefined,
                utm_y: photoMetadata.utmY ?? undefined,
                utm_zone: photoMetadata.utmZone || undefined,
                timestamp: Date.now(),
                takenAt: new Date().toISOString(),
              };

              await supabase
                .from('servicos')
                .update({ [fieldName]: [...normalizedPhotos, novaFoto], updated_at: new Date().toISOString() })
                .eq('id', servicoId);

              await loadData(); // atualiza com URL real
            }
          }
          // Se upload falhou: foto já está salva localmente com {id, uri}.
          // syncAllPendingServicos vai subir via resolveLocalPhotosToUrls depois.
        } catch {
          // Erro de upload ignorado — local save já garante o dado
        }
      }

      Alert.alert('Sucesso', isOnline && isUuid(servicoId) ? 'Foto salva.' : 'Foto salva localmente.');
    } catch (error) {
      console.error('Erro ao adicionar foto:', error);
      Alert.alert('Erro', 'Não foi possível adicionar a foto.');
    }
  };

  const handleSyncDraft = async (obraId: string) => {
    const draft = pendingDrafts.find((item) => item.id === obraId);
    if (!draft) {
      Alert.alert('Não encontrado', 'Rascunho não encontrado para sincronização.');
      return;
    }

    setSyncingDraftId(obraId);
    try {
      const result = await syncObra(draft as PendingObra);
      if (!result.success) {
        Alert.alert('Falha', 'Não foi possível sincronizar este rascunho.');
        return;
      }

      await loadData();
      Alert.alert('Pronto', 'Book sincronizado com sucesso.');
    } catch (error) {
      console.error('Erro ao sincronizar rascunho:', error);
      Alert.alert('Erro', 'Não foi possível sincronizar este rascunho.');
    } finally {
      setSyncingDraftId(null);
    }
  };

  const handleOpenLegacyObraForm = (obra: ObraListItem) => {
    try {
      const payload = encodeURIComponent(JSON.stringify(obra));
      router.push({
        pathname: '/obra-detalhe',
        params: { data: payload },
      });
    } catch (error) {
      console.error('Erro ao abrir formulário original da obra:', error);
      Alert.alert('Erro', 'Não foi possível abrir o formulário original deste book.');
    }
  };

  const handleSyncAllDrafts = async (silent = false) => {
    // Evitar sincronização repetida em menos de 5 segundos
    const now = Date.now();
    if (now - lastSyncTime < 5000) {
      console.log(`⏱️ [handleSyncAllDrafts] Aguardando cooldown de sync (${5000 - (now - lastSyncTime)}ms)`);
      return;
    }

    if (!isOnline || syncingAllDrafts) {
      return;
    }

    setLastSyncTime(now);
    setSyncingAllDrafts(true);
    try {
      // Sincroniza obras pendentes
      const obrasResult = await syncAllPendingObras();

      // Sincroniza serviços pendentes
      const servicosResult = await syncAllPendingServicos();

      const successCount = (obrasResult?.success || 0) + (servicosResult?.success || 0);
      const failedCount = (obrasResult?.failed || 0) + (servicosResult?.failed || 0);

      await loadData();

      if (!silent) {
        if (successCount === 0 && failedCount === 0) {
          Alert.alert('Sem pendências', 'Não há itens pendentes para sincronizar.');
        } else if (failedCount > 0) {
          Alert.alert('Sincronização parcial', `${successCount} sincronizado(s), ${failedCount} com falha.`);
        } else if (successCount > 0) {
          Alert.alert('Pronto', `${successCount} item(s) sincronizado(s).`);
        }
      }
    } catch (error) {
      console.error('Erro ao sincronizar books pendentes:', error);
      if (!silent) {
        Alert.alert('Erro', 'Não foi possível sincronizar os books pendentes.');
      }
    } finally {
      setSyncingAllDrafts(false);
    }
  };

  useEffect(() => {
    if (!isOnline) return;
    if (syncingAllDrafts) return;

    handleSyncAllDrafts(true);
  }, [isOnline]);

  const filterButton = (value: FilterType, label: string) => (
    <TouchableOpacity
      key={value}
      style={[styles.filterChip, filter === value && styles.filterChipActive]}
      onPress={() => setFilter(value)}
    >
      <Text style={[styles.filterChipText, filter === value && styles.filterChipTextActive]}>{label}</Text>
    </TouchableOpacity>
  );

  return (
    <SafeAreaView style={styles.safeArea}>
      <View style={styles.container}>
        <View style={styles.header}>
          <TouchableOpacity style={styles.backButton} onPress={() => router.back()}>
            <Text style={styles.backButtonText}>Voltar</Text>
          </TouchableOpacity>
          <Text style={styles.title}>Obra {obraNumero}</Text>
          <Text style={styles.subtitle}>Books e serviços em sequência</Text>
        </View>

        <View style={styles.topActions}>
          <TouchableOpacity style={styles.primaryAction} onPress={handleStartAddService}>
            <Text style={styles.primaryActionText}>+ Novo Serviço</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.secondaryAction, (!isOnline || syncingAllDrafts) && styles.secondaryActionDisabled]}
            onPress={() => handleSyncAllDrafts(false)}
            disabled={!isOnline || syncingAllDrafts}
          >
            {syncingAllDrafts ? (
              <ActivityIndicator size="small" color="#fff" />
            ) : (
              <Text style={styles.secondaryActionText}>
                Sincronizar ({pendingDrafts.length})
              </Text>
            )}
          </TouchableOpacity>
        </View>

        <View style={styles.filtersWrapper}>
          {filterButton('todos', 'Todos')}
          {filterButton('andamento', 'Em andamento')}
          {filterButton('concluidos', 'Concluídos')}
          {filterButton('pendentes', 'Sem foto')}
        </View>

        {loading ? (
          <View style={styles.centered}><ActivityIndicator size="large" color="#1d4ed8" /></View>
        ) : (
          <ScrollView style={styles.listScroll} contentContainerStyle={styles.content}>
            {obras.filter((obra) => obra.origem === 'offline' && !obra.serverId).map((obra) => (
              <View key={`sync-${obra.id}`} style={[styles.syncHintCard, styles.listItemSpacing]}>
                <Text style={styles.syncHintText}>Book em rascunho local: sincronize para habilitar novos serviços.</Text>
                <TouchableOpacity style={styles.syncHintButton} onPress={() => handleSyncDraft(obra.id)} disabled={syncingDraftId === obra.id}>
                  {syncingDraftId === obra.id ? <ActivityIndicator size="small" color="#fff" /> : <Text style={styles.syncHintButtonText}>Sincronizar</Text>}
                </TouchableOpacity>
              </View>
            ))}

            {filteredServicos.length === 0 ? (
              <View style={[styles.emptyCard, styles.listItemSpacing]}>
                <Text style={styles.emptyTitle}>Nenhum book para este filtro</Text>
              </View>
            ) : (
              filteredServicos.map((servico, index) => (
                <View key={`${servico.obra_id}-${servico.id}-${index}`} style={styles.serviceItemSpacing}>
                  <ServiceCard
                    service={servico}
                    isExpanded={expandedServicoId === servico.id}
                    onToggleExpand={() => {
                      LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
                      setExpandedServicoId(expandedServicoId === servico.id ? null : servico.id);
                    }}
                    onOpenDetails={
                      servico.id.startsWith('legacy-')
                        ? () => {
                            const obraLegada = obras.find((attr) => attr.id === servico.obra_id);
                            if (obraLegada) handleOpenLegacyObraForm(obraLegada);
                          }
                        : () => {
                            try {
                              const payload = encodeURIComponent(JSON.stringify(servico));
                              router.push({ pathname: '/servico-detalhe', params: { data: payload } });
                            } catch (e) {
                              console.error('Erro ao abrir detalhes do serviço:', e);
                            }
                          }
                    }
                    onCapturePhoto={(servicoId, category) => {
                      const svc = filteredServicos.find((item) => item.id === servicoId);
                      if (!svc) return;
                      handleCapturePhoto(svc, category);
                    }}
                    onPhotoViewer={(photo) => {
                      if (photo.uri || photo.url) {
                        setPhotoViewerScale(1);
                        setPhotoViewerUri(photo.uri || photo.url || null);
                      }
                    }}
                    onMarkComplete={(servicoId) => {
                      const svc = filteredServicos.find((item) => item.id === servicoId);
                      if (!svc) return;
                      handleMarkServiceComplete(svc);
                    }}
                  />
                </View>
              ))
            )}
          </ScrollView>
        )}

        <ServiceTypeSelector
          visible={serviceSelectorVisible}
          onClose={() => {
            setServiceSelectorVisible(false);
            setSelectedObraIdForService(null);
          }}
          onSelect={handleCreateService}
        />

        {capturingPhotoForServico && (
          <View style={styles.photoSourceOverlay}>
            <View style={styles.photoSourceModal}>
              <Text style={styles.photoSourceTitle}>Adicionar Foto</Text>
              <TouchableOpacity style={styles.photoSourceButton} onPress={capturePhotoFromCamera} disabled={captureLoading}>
                <Text style={styles.photoSourceButtonText}>Tirar Foto</Text>
              </TouchableOpacity>
              <TouchableOpacity style={styles.photoSourceButton} onPress={selectPhotoFromGallery} disabled={captureLoading}>
                <Text style={styles.photoSourceButtonText}>Selecionar da Galeria</Text>
              </TouchableOpacity>
              <TouchableOpacity style={[styles.photoSourceButton, styles.photoSourceButtonCancel]} onPress={() => setCapturingPhotoForServico(null)} disabled={captureLoading}>
                <Text style={styles.photoSourceButtonTextCancel}>Cancelar</Text>
              </TouchableOpacity>
              {captureLoading && <ActivityIndicator size="large" color="#1d4ed8" style={{ marginTop: 12 }} />}
            </View>
          </View>
        )}

        {photoViewerUri && (
          <Modal transparent={true} visible={!!photoViewerUri} onRequestClose={() => setPhotoViewerUri(null)}>
            <View style={styles.photoViewerOverlay}>
              <TouchableOpacity
                style={styles.photoViewerClose}
                onPress={() => {
                  setPhotoViewerScale(1);
                  setPhotoViewerUri(null);
                }}
              >
                <Text style={styles.photoViewerCloseText}>Fechar</Text>
              </TouchableOpacity>

              <View style={styles.photoViewerControls}>
                <TouchableOpacity
                  style={styles.photoViewerControlButton}
                  onPress={() => setPhotoViewerScale((prev) => Math.max(1, Number((prev - 0.25).toFixed(2))))}
                >
                  <Text style={styles.photoViewerControlButtonText}>-</Text>
                </TouchableOpacity>
                <Text style={styles.photoViewerZoomText}>{Math.round(photoViewerScale * 100)}%</Text>
                <TouchableOpacity
                  style={styles.photoViewerControlButton}
                  onPress={() => setPhotoViewerScale((prev) => Math.min(4, Number((prev + 0.25).toFixed(2))))}
                >
                  <Text style={styles.photoViewerControlButtonText}>+</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={styles.photoViewerResetButton}
                  onPress={() => setPhotoViewerScale(1)}
                >
                  <Text style={styles.photoViewerResetButtonText}>Reset</Text>
                </TouchableOpacity>
              </View>

              <View style={styles.photoViewerImageContainer}>
                <Image
                  source={{ uri: photoViewerUri }}
                  style={[styles.photoViewerImage, { transform: [{ scale: photoViewerScale }] }]}
                  resizeMode="contain"
                />
              </View>
            </View>
          </Modal>
        )}
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: { flex: 1, backgroundColor: '#eef2f6' },
  container: { flex: 1, backgroundColor: '#eef2f6' },
  header: { paddingHorizontal: 14, paddingTop: 6, paddingBottom: 6 },
  backButton: { alignSelf: 'flex-start', paddingVertical: 6, paddingHorizontal: 10, borderRadius: 8, backgroundColor: '#dbeafe', marginBottom: 8 },
  backButtonText: { color: '#1e40af', fontWeight: '700' },
  title: { fontSize: 24, fontWeight: '800', color: '#111827' },
  subtitle: { fontSize: 12, color: '#6b7280', marginTop: 1 },
  topActions: { paddingHorizontal: 14, paddingBottom: 6 },
  primaryAction: { backgroundColor: '#0b57d0', borderRadius: 10, paddingVertical: 10, alignItems: 'center' },
  primaryActionText: { color: '#fff', fontWeight: '700', fontSize: 16 },
  secondaryAction: { backgroundColor: '#0f766e', borderRadius: 10, paddingVertical: 9, alignItems: 'center', marginTop: 6 },
  secondaryActionDisabled: { backgroundColor: '#94a3b8' },
  secondaryActionText: { color: '#fff', fontWeight: '700', fontSize: 14 },
  filtersWrapper: { paddingHorizontal: 14, flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginTop: 12, marginBottom: 12 },
  filterChip: { height: 36, paddingHorizontal: 14, borderRadius: 999, backgroundColor: '#e5e7eb', justifyContent: 'center', alignItems: 'center' },
  filterChipActive: { backgroundColor: '#1d4ed8' },
  filterChipText: { color: '#334155', fontWeight: '600' },
  filterChipTextActive: { color: '#fff' },
  listScroll: { flex: 1 },
  content: { paddingHorizontal: 14, paddingTop: 0, paddingBottom: 56 },
  listItemSpacing: { marginBottom: 8 },
  serviceItemSpacing: { marginBottom: 2 },
  centered: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  syncHintCard: { backgroundColor: '#fff3cd', borderRadius: 10, padding: 12, borderWidth: 1, borderColor: '#fde68a' },
  syncHintText: { color: '#7c4a03', fontWeight: '600', marginBottom: 8 },
  syncHintButton: { backgroundColor: '#d97706', borderRadius: 8, paddingVertical: 10, alignItems: 'center' },
  syncHintButtonText: { color: '#fff', fontWeight: '700' },
  emptyCard: { backgroundColor: '#fff', borderRadius: 12, padding: 16 },
  emptyTitle: { fontSize: 16, fontWeight: '700', color: '#111827' },
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
    backgroundColor: '#1d4ed8',
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
  photoViewerOverlay: {
    flex: 1,
    backgroundColor: '#000',
    justifyContent: 'flex-start',
    alignItems: 'center',
    paddingTop: 60,
    paddingBottom: 20,
  },
  photoViewerImageContainer: {
    flex: 1,
    width: '100%',
    justifyContent: 'center',
    alignItems: 'center',
  },
  photoViewerImage: {
    width: '100%',
    height: '100%',
  },
  photoViewerClose: {
    position: 'absolute',
    top: 40,
    right: 20,
    zIndex: 10,
    padding: 10,
    backgroundColor: 'rgba(255,255,255,0.2)',
    borderRadius: 8,
  },
  photoViewerCloseText: {
    color: '#fff',
    fontWeight: 'bold',
  },
  photoViewerControls: {
    width: '100%',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 10,
    paddingHorizontal: 16,
    marginBottom: 8,
  },
  photoViewerControlButton: {
    width: 34,
    height: 34,
    borderRadius: 17,
    backgroundColor: 'rgba(255,255,255,0.25)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  photoViewerControlButtonText: {
    color: '#fff',
    fontSize: 22,
    fontWeight: '700',
    lineHeight: 24,
  },
  photoViewerZoomText: {
    color: '#fff',
    fontSize: 14,
    fontWeight: '700',
    minWidth: 52,
    textAlign: 'center',
  },
  photoViewerResetButton: {
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 8,
    backgroundColor: 'rgba(255,255,255,0.25)',
  },
  photoViewerResetButtonText: {
    color: '#fff',
    fontWeight: '700',
    fontSize: 12,
  },
});
