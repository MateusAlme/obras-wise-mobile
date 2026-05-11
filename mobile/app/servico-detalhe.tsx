import { useState, useEffect, useCallback, useRef } from 'react';
import {
  View, Text, StyleSheet, TouchableOpacity, ScrollView,
  Image, Modal, Dimensions, StatusBar, ActivityIndicator, Alert, BackHandler, TextInput, useWindowDimensions,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useLocalSearchParams, useRouter } from 'expo-router';
import * as ImagePicker from 'expo-image-picker';
import * as Location from 'expo-location';
import NetInfo from '@react-native-community/netinfo';
import { supabase } from '../lib/supabase';
import { type Servico, type FotoInfo, type PosteData } from '../types/servico';
import { appendPhotoToServicoLocal, fetchServicosForObra, markServicoComplete, saveServicoLocal, syncAllPendingServicos } from '../lib/servico-sync';
import { backupPhoto, getPhotoMetadatasByIds, type PhotoMetadata } from '../lib/photo-backup';
import { processObraPhotos } from '../lib/photo-queue';
import { getVisiblePhotoCategories, validateServicoCompletion } from '../lib/servico-rules';

const { width: SCREEN_WIDTH, height: SCREEN_HEIGHT } = Dimensions.get('window');

// Serviços que usam postes_data em vez de fotos flat (Antes/Durante/Depois)
const SERVICOS_COM_POSTES = new Set<string>(['Cava em Rocha', 'Linha Viva']);

type PosteLocal = {
  id: string;
  numero: string; // string para TextInput
  isAditivo: boolean;
  fotosAntes: FotoInfo[];
  fotosDurante: FotoInfo[];
  fotosDepois: FotoInfo[];
};

const getPreferredPhotoUri = (photo?: FotoInfo | null): string | null => {
  if (!photo) return null;
  if (typeof photo.url === 'string' && photo.url.startsWith('http')) return photo.url;
  if (typeof photo.uri === 'string' && photo.uri.trim().length > 0) return photo.uri;
  if (typeof photo.url === 'string' && photo.url.trim().length > 0) return photo.url;
  return null;
};

const isUuid = (v: string) =>
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(v);

const formatDate = (dateStr?: string | null) => {
  if (!dateStr) return '-';
  try {
    return new Date(dateStr).toLocaleDateString('pt-BR');
  } catch {
    return '-';
  }
};

const STATUS_LABEL: Record<string, string> = {
  rascunho: 'Rascunho',
  em_progresso: 'Em andamento',
  completo: 'Concluído',
};

const STATUS_BADGE_BG: Record<string, string> = {
  rascunho: '#fff3cd',
  em_progresso: '#d1ecf1',
  completo: '#e0f7e9',
};

type DadosAdicionaisDraft = {
  transformador_modo: 'instalado' | 'retirado' | 'ambos' | '';
  identificador_item: string;
  referencia_poste_inicio: string;
  referencia_poste_fim: string;
  observacao: string;
};

const EMPTY_DADOS_ADICIONAIS: DadosAdicionaisDraft = {
  transformador_modo: '',
  identificador_item: '',
  referencia_poste_inicio: '',
  referencia_poste_fim: '',
  observacao: '',
};

const TIPOS_COM_DADOS_ADICIONAIS = new Set([
  'Transformador',
  'Emenda',
  'Poda',
  'Linha Viva',
  'Cava em Rocha',
  'Checklist de Fiscalização',
]);

const shouldShowDadosAdicionais = (tipoServico?: string) => !!tipoServico && TIPOS_COM_DADOS_ADICIONAIS.has(tipoServico);
const isTransformadorServico = (tipoServico?: string) => tipoServico === 'Transformador';

const toDraftDadosAdicionais = (servico?: Servico | null): DadosAdicionaisDraft => {
  const dados = (servico as any)?.dados_adicionais || {};
  return {
    transformador_modo: ['instalado', 'retirado', 'ambos'].includes(String(dados.transformador_modo || '').toLowerCase())
      ? String(dados.transformador_modo).toLowerCase() as any
      : '',
    identificador_item: dados.identificador_item || '',
    referencia_poste_inicio: dados.referencia_poste_inicio || '',
    referencia_poste_fim: dados.referencia_poste_fim || '',
    observacao: dados.observacao || '',
  };
};

type InfoRowProps = { label: string; value: string };
function InfoRow({ label, value }: InfoRowProps) {
  return (
    <View style={styles.infoRow}>
      <Text style={styles.infoLabel}>{label}</Text>
      <Text style={styles.infoValue}>{value || '-'}</Text>
    </View>
  );
}

export default function ServicoDetalhePage() {
  const router = useRouter();
  const params = useLocalSearchParams<{ data?: string; category?: string }>();
  const { width: windowWidth } = useWindowDimensions();
  const isCompactLayout = windowWidth < 390;

  const initialServico: Servico | null = (() => {
    try {
      return params.data ? JSON.parse(decodeURIComponent(params.data as string)) : null;
    } catch {
      return null;
    }
  })();

  const [servico, setServico] = useState<Servico | null>(initialServico);
  const [isOnline, setIsOnline] = useState(true);
  const [syncingPending, setSyncingPending] = useState(false);
  const [captureCategory, setCaptureCategory] = useState<keyof Servico | null>(
    params.category ? (params.category as keyof Servico) : null
  );
  const [showPhotoSource, setShowPhotoSource] = useState(!!params.category);
  const [captureLoading, setCaptureLoading] = useState(false);
  const [completing, setCompleting] = useState(false);
  const [savingDadosAdicionais, setSavingDadosAdicionais] = useState(false);
  const [viewerUri, setViewerUri] = useState<string | null>(null);
  const [viewerIndex, setViewerIndex] = useState(0);
  const [viewerPhotos, setViewerPhotos] = useState<FotoInfo[]>([]);
  const [dadosAdicionais, setDadosAdicionais] = useState<DadosAdicionaisDraft>(() => toDraftDadosAdicionais(initialServico));

  // Estado para postes (Cava em Rocha e similares)
  const [postes, setPostes] = useState<PosteLocal[]>([]);
  const [capturePosteTarget, setCapturePosteTarget] = useState<{
    posteId: string;
    section: 'antes' | 'durante' | 'depois';
  } | null>(null);

  // Solicitar permissão de localização silenciosamente (necessária para UTM nas fotos)
  useEffect(() => {
    Location.requestForegroundPermissionsAsync().catch(() => {});
  }, []);

  // Ref sempre atualizada com o servico atual — evita stale closure nos effects
  const servicoRef = useRef<Servico | null>(initialServico);
  useEffect(() => { servicoRef.current = servico; }, [servico]);
  useEffect(() => { setDadosAdicionais(toDraftDadosAdicionais(servico)); }, [servico]);

  // Carrega postes a partir de postes_data quando o serviço abre (só para serviços com postes)
  useEffect(() => {
    if (!servico || !SERVICOS_COM_POSTES.has(servico.tipo_servico)) return;

    const raw = (servico as any).postes_data as PosteData[] | undefined;

    if (!raw?.length) {
      // Inicia com 1 poste vazio se não houver dados
      setPostes([{
        id: `poste_${Date.now()}`,
        numero: '1',
        isAditivo: false,
        fotosAntes: [],
        fotosDurante: [],
        fotosDepois: [],
      }]);
      return;
    }

    const allIds = raw
      .flatMap((p) => [...p.fotos_antes, ...p.fotos_durante, ...p.fotos_depois])
      .filter(Boolean);

    const buildPostes = (byId: Map<string, PhotoMetadata>): PosteLocal[] =>
      raw.map((p) => {
        const resolve = (ids: string[]): FotoInfo[] =>
          ids
            .map((id) => {
              const m = byId.get(id);
              if (!m) return null;
              const localUri = m.compressedPath || m.originalUri || undefined;
              const remoteUrl = m.uploadUrl || m.supabaseUrl || undefined;
              if (!localUri && !remoteUrl) return null;
              return {
                id,
                uri: localUri ?? remoteUrl,
                url: remoteUrl,
                latitude: m.latitude ?? undefined,
                longitude: m.longitude ?? undefined,
              } as FotoInfo;
            })
            .filter((f): f is FotoInfo => f !== null);

        return {
          id: p.id,
          numero: String(p.numero),
          isAditivo: !!p.isAditivo,
          fotosAntes: resolve(p.fotos_antes),
          fotosDurante: resolve(p.fotos_durante),
          fotosDepois: resolve(p.fotos_depois),
        };
      });

    if (!allIds.length) {
      setPostes(buildPostes(new Map()));
      return;
    }

    getPhotoMetadatasByIds(allIds)
      .then((metas) => {
        const byId = new Map((metas as PhotoMetadata[]).map((m) => [m.id, m]));
        setPostes(buildPostes(byId));
      })
      .catch(() => {
        setPostes(buildPostes(new Map()));
      });
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [servico?.id]); // Roda apenas uma vez por serviço aberto (ID não muda durante a sessão)

  // Persiste postes no AsyncStorage (converte PosteLocal → PosteData com photoIds)
  const savePostesToLocal = useCallback(async (updatedPostes: PosteLocal[]) => {
    const current = servicoRef.current;
    if (!current) return;
    const postesData: PosteData[] = updatedPostes.map((p) => ({
      id: p.id,
      numero: parseInt(p.numero, 10) || 0,
      isAditivo: p.isAditivo,
      fotos_antes: p.fotosAntes.map((f) => f.id!).filter(Boolean),
      fotos_durante: p.fotosDurante.map((f) => f.id!).filter(Boolean),
      fotos_depois: p.fotosDepois.map((f) => f.id!).filter(Boolean),
    }));
    const updated = {
      ...current,
      postes_data: postesData,
      sync_status: 'offline' as const,
      updated_at: new Date().toISOString(),
    };
    await saveServicoLocal(updated as any);
    setServico(updated as any);
  }, []); // usa servicoRef → sem dependências diretas de state

  const handleAddPoste = useCallback(() => {
    setPostes((prev) => {
      const nextNum = prev.length + 1;
      const newPoste: PosteLocal = {
        id: `poste_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`,
        numero: String(nextNum),
        isAditivo: false,
        fotosAntes: [],
        fotosDurante: [],
        fotosDepois: [],
      };
      const updated = [...prev, newPoste];
      savePostesToLocal(updated);
      return updated;
    });
  }, [savePostesToLocal]);

  const handlePosteNumeroChange = useCallback((posteId: string, value: string) => {
    setPostes((prev) => prev.map((p) => p.id === posteId ? { ...p, numero: value } : p));
  }, []);

  const handlePosteNumeroBlur = useCallback((posteId: string) => {
    setPostes((prev) => {
      const updated = prev.map((p) => p.id === posteId ? { ...p, numero: p.numero || '1' } : p);
      savePostesToLocal(updated);
      return updated;
    });
  }, [savePostesToLocal]);

  const handlePosteAditivoChange = useCallback((posteId: string, value: boolean) => {
    setPostes((prev) => {
      const updated = prev.map((p) => p.id === posteId ? { ...p, isAditivo: value } : p);
      savePostesToLocal(updated);
      return updated;
    });
  }, [savePostesToLocal]);

  const handleAddPostePhoto = useCallback((posteId: string, section: 'antes' | 'durante' | 'depois') => {
    setCaptureCategory(null);
    setCapturePosteTarget({ posteId, section });
    setShowPhotoSource(true);
  }, []);

  // reloadServico usa ref → nunca fica stale, pode ser chamado de qualquer effect
  const reloadServico = useCallback(async () => {
    const current = servicoRef.current;
    if (!current) return;
    try {
      const list = await fetchServicosForObra(current.obra_id);
      let updated = list.find((s) => s.id === current.id);
      // Se não encontrou por ID exato e o ID atual é temp-xxx (não UUID),
      // procura a versão sincronizada pelo created_at (transição temp-xxx → UUID)
      if (!updated && !isUuid(current.id)) {
        const currentTime = new Date((current as any).created_at || 0).getTime();
        updated = list.find((s) => {
          if (!isUuid(s.id)) return false;
          const sTime = new Date((s as any).created_at || 0).getTime();
          return Math.abs(sTime - currentTime) < 10000; // dentro de 10 segundos
        });
      }
      if (updated) setServico(updated);
    } catch {
      // mantém versão atual se falhar
    }
  }, []); // sem dependências — usa servicoRef internamente

  // NetInfo: detecta transição offline→online e sincroniza com debounce de 1.5s
  useEffect(() => {
    let wasOffline = false;
    let syncTimer: ReturnType<typeof setTimeout> | null = null;

    const doSync = async () => {
      setSyncingPending(true);
      try {
        await syncAllPendingServicos();
        await reloadServico();
      } catch {
        // sempre silencioso — erros de sync nunca propagam para o usuário
      } finally {
        setSyncingPending(false);
      }
    };

    const unsub = NetInfo.addEventListener((state) => {
      const online = state.isConnected === true && state.isInternetReachable !== false;
      setIsOnline(online);
      if (online && wasOffline) {
        // Aguarda 1.5s para conexão estabilizar antes de sincronizar
        if (syncTimer) clearTimeout(syncTimer);
        syncTimer = setTimeout(doSync, 1500);
      }
      wasOffline = !online;
    });

    return () => {
      unsub();
      if (syncTimer) clearTimeout(syncTimer);
    };
  }, [reloadServico]);

  // No mount: garante que o serviço está no cache local (offline-first)
  useEffect(() => {
    let isMounted = true;
    
    const ensureLocalCache = async () => {
      if (!initialServico) return;
      try {
        const list = await fetchServicosForObra(initialServico.obra_id);
        if (!isMounted) return; // não atualiza se desmontou
        
        const found = list.find((s) => s.id === initialServico.id);
        if (found) {
          setServico(found);
        } else if (!isUuid(initialServico.id)) {
          // Só adiciona à fila de sync se for serviço offline (sem UUID real)
          // UUIDs já sincronizados não entram na fila para evitar sync desnecessário
          await saveServicoLocal({ ...initialServico, sync_status: 'offline' } as any);
        }
      } catch {
        // fallback: mantém versão dos params
      }
    };
    
    ensureLocalCache();
    
    return () => {
      isMounted = false;
    };
  }, [initialServico]);

  // Intercepta voltar quando há fotos faltando
  const handleBack = useCallback(() => {
    const current = servicoRef.current;
    if (!current || current.status === 'completo') {
      router.back();
      return;
    }
    const cats = getVisiblePhotoCategories(current);
    const faltando = cats
      .filter((cat) => {
        const field = (current as any)[cat.field];
        return !Array.isArray(field) || field.filter((p: any) => p && (p.uri || p.url)).length === 0;
      })
      .map((c) => c.label);

    if (faltando.length === 0) {
      router.back();
      return;
    }

    Alert.alert(
      '⚠️ Fotos faltando',
      `Ainda faltam fotos em:\n• ${faltando.slice(0, 5).join('\n• ')}${faltando.length > 5 ? `\n• ...e mais ${faltando.length - 5}` : ''}\n\nAs fotos já tiradas estão salvas.`,
      [
        { text: 'Continuar aqui', style: 'cancel' },
        { text: 'Sair assim mesmo', style: 'destructive', onPress: () => router.back() },
      ]
    );
  }, [router]);

  // Botão físico de voltar (Android)
  useEffect(() => {
    const sub = BackHandler.addEventListener('hardwareBackPress', () => {
      handleBack();
      return true;
    });
    return () => sub.remove();
  }, [handleBack]);

  const getCurrentLocation = async () => {
    try {
      const lastKnown = await Location.getLastKnownPositionAsync({
        maxAge: 5 * 60 * 1000,
        requiredAccuracy: 100,
      });
      if (lastKnown?.coords?.latitude && lastKnown?.coords?.longitude) {
        return { latitude: lastKnown.coords.latitude, longitude: lastKnown.coords.longitude };
      }
      const location = await Promise.race([
        Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.Balanced }),
        new Promise<never>((_, reject) => setTimeout(() => reject(new Error('GPS timeout')), 3000)),
      ]);
      if (!location?.coords?.latitude || !location?.coords?.longitude) throw new Error('Coordenadas inválidas');
      return { latitude: location.coords.latitude, longitude: location.coords.longitude };
    } catch (error: any) {
      console.warn('⚠️ GPS indisponível:', error?.message || error);
      return { latitude: null, longitude: null };
    }
  };

  const handleAddPhoto = (category: keyof Servico) => {
    setCapturePosteTarget(null);
    setCaptureCategory(category);
    setShowPhotoSource(true);
  };

  const savePhotoToPoste = async (
    photoUri: string,
    coords: { latitude: number | null; longitude: number | null },
    source: 'camera' | 'gallery' = 'camera',
  ) => {
    const target = capturePosteTarget;
    const current = servicoRef.current;
    if (!target || !current) return;
    try {
      const photoMeta = await backupPhoto(
        photoUri,
        current.obra_id,
        target.section,
        0,
        coords.latitude,
        coords.longitude,
        'image/jpeg',
        source,
      );

      const newFoto: FotoInfo = {
        id: photoMeta.id,
        uri: photoMeta.compressedPath || photoMeta.originalUri,
        latitude: photoMeta.latitude ?? undefined,
        longitude: photoMeta.longitude ?? undefined,
      };

      setPostes((prev) => {
        const updated = prev.map((p) => {
          if (p.id !== target.posteId) return p;
          return {
            ...p,
            fotosAntes: target.section === 'antes' ? [...p.fotosAntes, newFoto] : p.fotosAntes,
            fotosDurante: target.section === 'durante' ? [...p.fotosDurante, newFoto] : p.fotosDurante,
            fotosDepois: target.section === 'depois' ? [...p.fotosDepois, newFoto] : p.fotosDepois,
          };
        });
        savePostesToLocal(updated);
        return updated;
      });
    } catch {
      Alert.alert('Erro', 'Não foi possível salvar a foto.');
    }
  };

  const captureFromCamera = async () => {
    if (!capturePosteTarget && !captureCategory) return;
    if (!servico) return;
    try {
      setCaptureLoading(true);
      setShowPhotoSource(false);
      const perm = await ImagePicker.requestCameraPermissionsAsync();
      if (!perm.granted) {
        Alert.alert('Permissão negada', 'Permita acesso à câmera.');
        return;
      }
      const locationPromise = getCurrentLocation();
      const result = await ImagePicker.launchCameraAsync({
        mediaTypes: ['images'],
        allowsEditing: false,
        quality: 0.8,
      });
      if (!result.canceled && result.assets[0]) {
        const coords = await locationPromise;
        if (capturePosteTarget) {
          await savePhotoToPoste(result.assets[0].uri, coords, 'camera');
        } else {
          await savePhoto(result.assets[0].uri, coords, 'camera');
        }
      }
    } catch {
      Alert.alert('Erro', 'Não foi possível tirar a foto.');
    } finally {
      setCaptureLoading(false);
    }
  };

  const captureFromGallery = async () => {
    if (!capturePosteTarget && !captureCategory) return;
    if (!servico) return;
    try {
      setCaptureLoading(true);
      setShowPhotoSource(false);
      const perm = await ImagePicker.requestMediaLibraryPermissionsAsync();
      if (!perm.granted) {
        Alert.alert('Permissão negada', 'Permita acesso à galeria.');
        return;
      }
      const locationPromise = getCurrentLocation();
      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ['images'],
        allowsEditing: false,
        quality: 0.8,
      });
      if (!result.canceled && result.assets[0]) {
        const coords = await locationPromise;
        if (capturePosteTarget) {
          await savePhotoToPoste(result.assets[0].uri, coords, 'gallery');
        } else {
          await savePhoto(result.assets[0].uri, coords, 'gallery');
        }
      }
    } catch {
      Alert.alert('Erro', 'Não foi possível selecionar a foto.');
    } finally {
      setCaptureLoading(false);
    }
  };

  const savePhoto = async (
    photoUri: string,
    coords: { latitude: number | null; longitude: number | null } = { latitude: null, longitude: null },
    source: 'camera' | 'gallery' = 'camera',
  ) => {
    if (!captureCategory || !servico) return;
    try {
      const categoryStr = String(captureCategory).replace(/^fotos_/, '') as any;
      const photoMeta = await backupPhoto(
        photoUri,
        servico.obra_id,
        categoryStr,
        0,
        coords.latitude,
        coords.longitude,
        'image/jpeg',
        source,
      );

      let ok = await appendPhotoToServicoLocal(
        servico.id,
        servico.obra_id,
        captureCategory,
        photoMeta.id,
        photoMeta.compressedPath,
        {
          latitude: photoMeta.latitude,
          longitude: photoMeta.longitude,
          utmX: photoMeta.utmX,
          utmY: photoMeta.utmY,
          utmZone: photoMeta.utmZone,
        },
      );

      // Cache miss → garante que o serviço está no AsyncStorage e tenta novamente
      if (!ok) {
        await saveServicoLocal({ ...servico, sync_status: 'offline' } as any);
        ok = await appendPhotoToServicoLocal(
          servico.id,
          servico.obra_id,
          captureCategory,
          photoMeta.id,
          photoMeta.compressedPath,
          {
            latitude: photoMeta.latitude,
            longitude: photoMeta.longitude,
            utmX: photoMeta.utmX,
            utmY: photoMeta.utmY,
            utmZone: photoMeta.utmZone,
          },
        );
      }

      if (!ok) {
        Alert.alert('Erro', 'Não foi possível salvar a foto localmente.');
        return;
      }

      await reloadServico();

      if (false && isOnline && isUuid(servico.id) && isUuid(servico.obra_id)) {
        try {
          await processObraPhotos(servico.obra_id, undefined, [photoMeta.id]);
          const [meta] = await getPhotoMetadatasByIds([photoMeta.id]);
          const publicUrl = meta?.uploadUrl || meta?.supabaseUrl;

          if (publicUrl) {
            const { data: servicoAtual } = await supabase
              .from('servicos')
              .select('*')
              .eq('id', servico.id)
              .single();

            if (servicoAtual) {
              const fieldPhotos = ((servicoAtual as any)[captureCategory] || []) as FotoInfo[];
              const normalizedPhotos = fieldPhotos.map((p: any) => {
                const { uri, ...rest } = p;
                return { ...rest, url: rest.url || uri };
              });
              const novaFoto: FotoInfo = {
                id: photoMeta.id,
                url: publicUrl,
                latitude: photoMeta.latitude,
                longitude: photoMeta.longitude,
                utm_x: photoMeta.utmX ?? undefined,
                utm_y: photoMeta.utmY ?? undefined,
                utm_zone: photoMeta.utmZone || undefined,
                timestamp: Date.now(),
                takenAt: new Date().toISOString(),
              };
              await supabase
                .from('servicos')
                .update({
                  [captureCategory]: [...normalizedPhotos, novaFoto],
                  updated_at: new Date().toISOString(),
                })
                .eq('id', servico.id);

              await reloadServico();
            }
          }
        } catch {
          // Upload falhou — foto salva localmente, sincroniza depois
        }
      }
    } catch {
      Alert.alert('Erro', 'Não foi possível salvar a foto.');
    }
  };

  const handleMarkComplete = async () => {
    if (!servico) return;

    // Validação específica para serviços com postes
    if (SERVICOS_COM_POSTES.has(servico.tipo_servico)) {
      if (postes.length === 0) {
        Alert.alert('Atenção', 'Adicione pelo menos um poste antes de concluir.');
        return;
      }
      const incompletos = postes.filter(
        (p) => !p.fotosAntes.length || !p.fotosDurante.length || !p.fotosDepois.length
      );
      if (incompletos.length > 0) {
        Alert.alert(
          'Fotos faltando',
          `${incompletos.length} poste(s) com fotos incompletas.\nCada poste precisa de pelo menos 1 foto em Antes, Durante e Depois.`
        );
        return;
      }
    }

    const validation = validateServicoCompletion(servico);
    if (validation.configErrors.length > 0 || validation.missingRules.length > 0) {
      const pendingLines: string[] = [];

      if (validation.configErrors.length > 0) {
        pendingLines.push('Configuracao pendente:');
        validation.configErrors.forEach((msg) => pendingLines.push(`- ${msg}`));
      }

      if (validation.missingRules.length > 0) {
        if (pendingLines.length > 0) pendingLines.push('');
        pendingLines.push('Fotos obrigatorias faltando:');
        validation.missingRules.forEach((rule) => {
          const detail = rule.minCount > 1
            ? `${rule.label}: ${rule.currentCount}/${rule.minCount}`
            : rule.label;
          pendingLines.push(`- ${detail}`);
        });
      }

      Alert.alert('Nao foi possivel concluir', pendingLines.join('\n'));
      return;
    }

    setCompleting(true);
    try {
      const now = new Date().toISOString();
      const localCompleted: Servico = {
        ...servico,
        status: 'completo',
        updated_at: now,
        sync_status: 'offline',
        error_message: null,
      };

      await saveServicoLocal(localCompleted as any);
      setServico(localCompleted);

      const ok = await markServicoComplete(servico.id, servico.obra_id, localCompleted as any);
      if (ok) {
        await reloadServico();
      } else {
        Alert.alert(
          'Concluido localmente',
          'Servico salvo como completo no aparelho. A sincronizacao sera feita quando a conexao estabilizar.'
        );
      }
    } catch {
      Alert.alert('Erro', 'Nao foi possivel marcar o servico como concluido.');
    } finally {
      setCompleting(false);
    }
  };

  const handleSaveDadosAdicionais = async () => {
    if (!servico) return;

    const sanitized = {
      transformador_modo: dadosAdicionais.transformador_modo,
      identificador_item: dadosAdicionais.identificador_item.trim(),
      referencia_poste_inicio: dadosAdicionais.referencia_poste_inicio.trim(),
      referencia_poste_fim: dadosAdicionais.referencia_poste_fim.trim(),
      observacao: dadosAdicionais.observacao.trim(),
    };

    const dadosToPersist = Object.fromEntries(
      Object.entries(sanitized).filter(([, value]) => value.length > 0)
    );

    setSavingDadosAdicionais(true);
    try {
      const now = new Date().toISOString();
      const localUpdated: Servico = {
        ...servico,
        dados_adicionais: dadosToPersist,
        updated_at: now,
        sync_status: 'offline',
        error_message: null,
      };

      await saveServicoLocal(localUpdated as any);
      setServico(localUpdated);

      if (isOnline && isUuid(servico.id) && isUuid(servico.obra_id)) {
        try {
          const { error } = await supabase
            .from('servicos')
            .update({
              dados_adicionais: dadosToPersist,
              updated_at: now,
              sync_status: 'synced',
              error_message: null,
            })
            .eq('id', servico.id);

          if (!error) {
            const syncedUpdated: Servico = { ...localUpdated, sync_status: 'synced' };
            await saveServicoLocal(syncedUpdated as any);
            setServico(syncedUpdated);
          }
        } catch {
          // Falha online: dado fica salvo localmente e sincroniza depois.
        }
      }

      Alert.alert('Pronto', 'Informacoes adicionais salvas.');
    } catch {
      Alert.alert('Erro', 'Nao foi possivel salvar as informacoes adicionais.');
    } finally {
      setSavingDadosAdicionais(false);
    }
  };

  const openViewer = (photos: FotoInfo[], index: number) => {
    setViewerPhotos(photos);
    setViewerIndex(index);
    setViewerUri(photos[index]?.url || photos[index]?.uri || null);
  };

  if (!servico) {
    return (
      <SafeAreaView style={styles.safeArea} edges={['top', 'bottom']}>
        <View style={styles.emptyState}>
          <Text style={styles.emptyTitle}>Serviço não encontrado.</Text>
          <TouchableOpacity onPress={() => router.back()} style={styles.emptyBackButton}>
            <Text style={styles.emptyBackButtonText}>Voltar</Text>
          </TouchableOpacity>
        </View>
      </SafeAreaView>
    );
  }

  const categories = getVisiblePhotoCategories(servico);
  const usesPostes = SERVICOS_COM_POSTES.has(servico.tipo_servico);
  const statusLabel = STATUS_LABEL[servico.status] || servico.status;
  const statusBg = STATUS_BADGE_BG[servico.status] || '#f5f5f5';
  const exibeDadosAdicionais = shouldShowDadosAdicionais(servico.tipo_servico);
  const exibeModoTransformador = isTransformadorServico(servico.tipo_servico);
  const modoTransformadorSalvoRaw = String((servico as any)?.dados_adicionais?.transformador_modo || '').toLowerCase();
  const modoTransformadorSalvo =
    modoTransformadorSalvoRaw === 'instalado' || modoTransformadorSalvoRaw === 'retirado' || modoTransformadorSalvoRaw === 'ambos'
      ? modoTransformadorSalvoRaw
      : '';
  const modoTransformadorBloqueado = !!modoTransformadorSalvo;
  const completionValidation = validateServicoCompletion(servico);
  const fotosFaltantes = completionValidation.missingRules.length;
  const fotosFaltantesDetalhes = completionValidation.missingRules.map((rule) =>
    rule.minCount > 1
      ? `${rule.label}: ${rule.currentCount}/${rule.minCount}`
      : rule.label
  );
  const podeConcluir =
    servico.status !== 'completo' &&
    completionValidation.configErrors.length === 0 &&
    completionValidation.missingRules.length === 0;

  return (
    <SafeAreaView style={styles.safeArea} edges={['top', 'bottom']}>
      <StatusBar barStyle="dark-content" backgroundColor="#fff" />

      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity style={styles.backButton} onPress={handleBack} activeOpacity={0.7}>
          <Ionicons name="chevron-back" size={20} color="#0f172a" />
          <Text style={styles.backButtonText}>Voltar</Text>
        </TouchableOpacity>
        <Text style={styles.headerTitle} numberOfLines={1}>Detalhes do Serviço</Text>
        <TouchableOpacity style={styles.refreshButton} onPress={reloadServico} activeOpacity={0.7}>
          <Ionicons name="refresh" size={20} color="#007bff" />
        </TouchableOpacity>
      </View>

      {/* Banner offline */}
      {!isOnline && (
        <View style={styles.offlineBanner}>
          <Text style={styles.offlineBannerText}>
            📴 Sem conexão — fotos serão salvas localmente e sincronizadas quando online
          </Text>
        </View>
      )}

      {/* Banner sincronizando */}
      {syncingPending && (
        <View style={styles.syncingBanner}>
          <ActivityIndicator size="small" color="#fff" />
          <Text style={styles.syncingBannerText}>Sincronizando pendentes...</Text>
        </View>
      )}

      <ScrollView
        style={styles.container}
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
      >
        {/* Card principal */}
        <View style={styles.card}>
          <Text style={styles.cardTitle}>{servico.tipo_servico}</Text>
          <Text style={styles.cardSubtitle}>
            {servico.obra_numero ? `Obra ${servico.obra_numero}` : 'Serviço'} · Criado em {formatDate(servico.created_at)}
          </Text>
          <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginTop: 12 }}>
            <View style={[styles.statusBadge, { backgroundColor: statusBg }]}>
              <Text style={styles.statusBadgeText}>{statusLabel}</Text>
            </View>
            {(servico as any).sync_status === 'offline' && (
              <View style={[styles.statusBadge, { backgroundColor: '#fff3cd' }]}>
                <Text style={styles.statusBadgeText}>⏳ Aguardando sync</Text>
              </View>
            )}
            {(servico as any).sync_status === 'synced' && (
              <View style={[styles.statusBadge, { backgroundColor: '#e0f7e9' }]}>
                <Text style={styles.statusBadgeText}>✓ Sincronizado</Text>
              </View>
            )}
            {(servico as any).sync_status === 'error' && (
              <View style={[styles.statusBadge, { backgroundColor: '#f8d7da' }]}>
                <Text style={styles.statusBadgeText}>⚠ Erro de sync</Text>
              </View>
            )}
          </View>
        </View>

        {/* InfoCard */}
        <View style={styles.infoCard}>
          <InfoRow label="Data" value={formatDate(servico.created_at)} />
          <InfoRow label="Responsável" value={servico.responsavel || '-'} />
          <InfoRow label="Tipo de serviço" value={servico.tipo_servico} />
          <InfoRow label="Status" value={statusLabel} />
        </View>

        {exibeDadosAdicionais && (
          <View style={styles.infoCard}>
            <Text style={styles.extraSectionTitle}>Informacoes adicionais</Text>

            {exibeModoTransformador && (
              <>
                <Text style={styles.extraFieldLabel}>Modo do transformador *</Text>
                <View style={[styles.extraRow, styles.extraRowWrap]}>
                  {[
                    { value: 'instalado', label: 'Instalado' },
                    { value: 'retirado', label: 'Retirado' },
                    { value: 'ambos', label: 'Ambos' },
                  ].map((option) => {
                    const active = dadosAdicionais.transformador_modo === option.value;
                    const optionDisabled = modoTransformadorBloqueado && option.value !== modoTransformadorSalvo;
                    return (
                      <TouchableOpacity
                        key={option.value}
                        style={[
                          styles.modeChip,
                          isCompactLayout && styles.modeChipCompact,
                          active && styles.modeChipActive,
                          optionDisabled && { opacity: 0.45 },
                        ]}
                        onPress={() => {
                          if (optionDisabled) return;
                          setDadosAdicionais((prev) => ({ ...prev, transformador_modo: option.value as any }));
                        }}
                        disabled={optionDisabled}
                        activeOpacity={0.85}
                      >
                        <Text style={[styles.modeChipText, active && styles.modeChipTextActive]}>{option.label}</Text>
                      </TouchableOpacity>
                    );
                  })}
                </View>
                {modoTransformadorBloqueado && (
                  <Text style={styles.fieldHint}>Modo bloqueado apos salvamento inicial.</Text>
                )}
              </>
            )}

            <Text style={styles.extraFieldLabel}>Identificador (opcional)</Text>
            <TextInput
              style={styles.extraInput}
              value={dadosAdicionais.identificador_item}
              onChangeText={(text) => setDadosAdicionais((prev) => ({ ...prev, identificador_item: text }))}
              placeholder="Ex.: E12, PD3"
              placeholderTextColor="#94A3B8"
              autoCapitalize="characters"
            />

            <Text style={styles.extraFieldLabel}>Referencia de poste (inicio/fim)</Text>
            <View style={[styles.extraRow, isCompactLayout && styles.extraRowCompact]}>
              <TextInput
                style={[styles.extraInput, styles.extraInputHalf, isCompactLayout && styles.extraInputFull]}
                value={dadosAdicionais.referencia_poste_inicio}
                onChangeText={(text) => setDadosAdicionais((prev) => ({ ...prev, referencia_poste_inicio: text }))}
                placeholder="P1"
                placeholderTextColor="#94A3B8"
                autoCapitalize="characters"
              />
              <TextInput
                style={[styles.extraInput, styles.extraInputHalf, isCompactLayout && styles.extraInputFull]}
                value={dadosAdicionais.referencia_poste_fim}
                onChangeText={(text) => setDadosAdicionais((prev) => ({ ...prev, referencia_poste_fim: text }))}
                placeholder="P2"
                placeholderTextColor="#94A3B8"
                autoCapitalize="characters"
              />
            </View>

            <Text style={styles.extraFieldLabel}>Observacoes (opcional)</Text>
            <TextInput
              style={[styles.extraInput, styles.extraTextarea]}
              value={dadosAdicionais.observacao}
              onChangeText={(text) => setDadosAdicionais((prev) => ({ ...prev, observacao: text }))}
              placeholder="Detalhes do servico, material, trecho, etc."
              placeholderTextColor="#94A3B8"
              multiline
              textAlignVertical="top"
            />

            <TouchableOpacity
              style={[styles.saveExtraButton, savingDadosAdicionais && styles.saveExtraButtonDisabled]}
              onPress={handleSaveDadosAdicionais}
              disabled={savingDadosAdicionais}
              activeOpacity={0.85}
            >
              {savingDadosAdicionais ? (
                <ActivityIndicator size="small" color="#fff" />
              ) : (
                <>
                  <Ionicons name="save-outline" size={18} color="#fff" />
                  <Text style={styles.saveExtraButtonText}>Salvar informacoes</Text>
                </>
              )}
            </TouchableOpacity>
          </View>
        )}

        {/* Botões de ação */}
        {servico.status !== 'completo' && (
          <View>
            {completionValidation.configErrors.length > 0 && (
              <View style={styles.fotosFaltantesContainer}>
                <Text style={styles.fotosFaltantesTitle}>⚠️ Configuração pendente:</Text>
                {completionValidation.configErrors.map((msg, index) => (
                  <Text key={index} style={styles.fotosFaltantesItem}>• {msg}</Text>
                ))}
              </View>
            )}
            {/* Fotos faltantes */}
            {fotosFaltantes > 0 && (
              <View style={styles.fotosFaltantesContainer}>
                <Text style={styles.fotosFaltantesTitle}>
                  📋 Fotos obrigatórias faltantes ({fotosFaltantes}):
                </Text>
                {fotosFaltantesDetalhes.map((foto, index) => (
                  <Text key={index} style={styles.fotosFaltantesItem}>• {foto}</Text>
                ))}
              </View>
            )}

            {/* Marcar como Concluído */}
            <View style={styles.actionButtons}>
              <TouchableOpacity
                style={[
                  styles.finalizarButton,
                  { flex: 1 },
                  (!podeConcluir || completing) && styles.finalizarButtonDisabled,
                ]}
                onPress={handleMarkComplete}
                disabled={completing}
                activeOpacity={completing ? 1 : 0.7}
              >
                {completing ? (
                  <ActivityIndicator size="small" color="#fff" />
                ) : (
                  <>
                    <Ionicons
                      name={podeConcluir ? 'checkmark-circle' : 'alert-circle'}
                      size={20}
                      color="#fff"
                    />
                    <Text style={styles.finalizarButtonText}>
                      {fotosFaltantes > 0
                        ? `Ver pendencias (${fotosFaltantes})`
                        : '✅ Marcar como Concluído'}
                    </Text>
                  </>
                )}
              </TouchableOpacity>
            </View>
          </View>
        )}

        {/* Seções de fotos — postes (Cava em Rocha) ou flat (demais serviços) */}
        {usesPostes ? (
          <>
            {/* Header da seção de postes */}
            <View style={styles.postesSectionHeader}>
              <View>
                <Text style={styles.postesSectionTitle}>Registro dos Postes</Text>
                <Text style={styles.postesSectionSubtitle}>
                  Recomendado: 3 fotos por poste (Antes, Durante e Depois).
                </Text>
              </View>
            </View>

            {/* Contador + botão Adicionar Poste */}
            <View style={styles.postesTopBar}>
              <Text style={styles.postesCount}>Pontos: {postes.length}</Text>
              <TouchableOpacity
                style={styles.addPosteBtn}
                onPress={handleAddPoste}
                activeOpacity={0.8}
              >
                <Ionicons name="add-circle-outline" size={18} color="#fff" />
                <Text style={styles.addPosteBtnText}>Adicionar Poste</Text>
              </TouchableOpacity>
            </View>

            {/* Cards de postes */}
            {postes.map((poste, idx) => {
              const totalFotos = poste.fotosAntes.length + poste.fotosDurante.length + poste.fotosDepois.length;
              const isCompleto = poste.fotosAntes.length > 0 && poste.fotosDurante.length > 0 && poste.fotosDepois.length > 0;

              return (
                <View key={poste.id} style={styles.posteCard}>
                  {/* Título do poste */}
                  <View style={styles.posteCardHeader}>
                    <Text style={styles.posteCardTitle}>
                      Poste {idx + 1} — P{poste.numero}
                    </Text>
                  </View>

                  {/* Número do poste */}
                  <Text style={styles.posteFieldLabel}>Número do Poste *</Text>
                  <TextInput
                    style={styles.posteNumInput}
                    value={poste.numero}
                    onChangeText={(v) => handlePosteNumeroChange(poste.id, v)}
                    onEndEditing={() => handlePosteNumeroBlur(poste.id)}
                    keyboardType="numeric"
                    placeholder="1"
                    placeholderTextColor="#94A3B8"
                    returnKeyType="done"
                  />

                  {/* Checkbox aditivo */}
                  <TouchableOpacity
                    style={[styles.aditivoRow, poste.isAditivo && styles.aditivoRowActive]}
                    onPress={() => handlePosteAditivoChange(poste.id, !poste.isAditivo)}
                    activeOpacity={0.8}
                  >
                    <View style={[styles.checkbox, poste.isAditivo && styles.checkboxActive]}>
                      {poste.isAditivo && <Ionicons name="checkmark" size={13} color="#fff" />}
                    </View>
                    <Text style={[styles.aditivoLabel, poste.isAditivo && styles.aditivoLabelActive]}>
                      Poste Aditivo (não previsto no croqui)
                    </Text>
                  </TouchableOpacity>

                  {/* Identificação resumida */}
                  <Text style={styles.posteIdentText}>
                    Identificação: P{poste.numero}{'  '}|{'  '}Fotos: {totalFotos}{'  '}|{'  '}
                    Status: {isCompleto ? '✓ Completo' : 'Pendente'}
                  </Text>

                  {/* Subsecões de foto: Antes / Durante / Depois */}
                  {(
                    [
                      { key: 'antes', label: 'Antes', emoji: '🟤', photos: poste.fotosAntes },
                      { key: 'durante', label: 'Durante', emoji: '🟡', photos: poste.fotosDurante },
                      { key: 'depois', label: 'Depois', emoji: '🟢', photos: poste.fotosDepois },
                    ] as const
                  ).map(({ key, label, emoji, photos: sectionPhotos }) => (
                    <View key={key} style={styles.postePhotoSubsection}>
                      <Text style={styles.postePhotoSubsectionTitle}>
                        {emoji} {label} ({sectionPhotos.length})
                      </Text>

                      {sectionPhotos.length > 0 && (
                        <View style={[styles.photoGrid, { marginBottom: 10 }]}>
                          {sectionPhotos.map((photo, pIdx) => (
                            (() => {
                              const displayUri = getPreferredPhotoUri(photo);
                              if (!displayUri) return null;
                              return (
                                <TouchableOpacity
                                  key={pIdx}
                                  onPress={() => openViewer(sectionPhotos, pIdx)}
                                  activeOpacity={0.8}
                                >
                                  <Image
                                    source={{ uri: displayUri }}
                                    style={styles.photoThumb}
                                    resizeMode="cover"
                                  />
                                </TouchableOpacity>
                              );
                            })()
                          ))}
                        </View>
                      )}

                      <TouchableOpacity
                        style={[styles.addPostePhotoBtn, captureLoading && styles.addPostePhotoBtnDisabled]}
                        onPress={() => handleAddPostePhoto(poste.id, key)}
                        disabled={captureLoading}
                        activeOpacity={0.8}
                      >
                        <Ionicons name="camera-outline" size={16} color="#2563EB" />
                        <Text style={styles.addPostePhotoBtnText}>+ Adicionar Foto</Text>
                      </TouchableOpacity>
                    </View>
                  ))}
                </View>
              );
            })}
          </>
        ) : (
          <>
            {categories.map((cat) => {
              const field = (servico as any)[cat.field];
              const photos: FotoInfo[] = Array.isArray(field)
                ? field.filter((p: any) => p && (p.uri || p.url))
                : [];

              return (
                <View key={cat.field} style={styles.infoCard}>
                  <Text style={styles.photoSectionTitle}>
                    {cat.label}{photos.length > 0 ? ` (${photos.length})` : ''}
                  </Text>

                  {photos.length > 0 && (
                    <View style={[styles.photoGrid, { marginBottom: 12 }]}>
                      {photos.map((photo, idx) => (
                        <TouchableOpacity
                          key={idx}
                          onPress={() => openViewer(photos, idx)}
                          activeOpacity={0.8}
                        >
                          <Image
                            source={{ uri: photo.url || photo.uri }}
                            style={styles.photoThumb}
                            resizeMode="cover"
                          />
                        </TouchableOpacity>
                      ))}
                    </View>
                  )}

                  <TouchableOpacity
                    style={[styles.bigCameraBtn, captureLoading && styles.bigCameraBtnDisabled]}
                    onPress={() => handleAddPhoto(cat.field as keyof Servico)}
                    disabled={captureLoading}
                    activeOpacity={0.8}
                  >
                    <Ionicons name="camera" size={36} color="#fff" />
                    <Text style={styles.bigCameraBtnText}>
                      {photos.length === 0 ? 'TIRAR FOTO' : 'MAIS FOTOS'}
                    </Text>
                  </TouchableOpacity>
                </View>
              );
            })}

            {categories.length === 0 && (
              <View style={styles.infoCard}>
                <Text style={styles.noPhotosTitle}>Nenhuma categoria de foto</Text>
                <Text style={styles.noPhotosText}>
                  Não há categorias de foto definidas para "{servico.tipo_servico}".
                </Text>
              </View>
            )}
          </>
        )}

        <View style={{ height: 40 }} />
      </ScrollView>

      {/* Loading overlay */}
      {captureLoading && (
        <View style={styles.loadingOverlay}>
          <ActivityIndicator size="large" color="#fff" />
          <Text style={styles.loadingText}>Salvando foto...</Text>
        </View>
      )}

      {/* Bottom sheet: Câmera ou Galeria */}
      {showPhotoSource && (
        <View style={styles.photoSourceOverlay}>
          <TouchableOpacity
            style={styles.photoSourceBackdrop}
            onPress={() => setShowPhotoSource(false)}
            activeOpacity={1}
          />
          <View style={styles.photoSourceSheet}>
            <View style={styles.photoSourceHandle} />
            <Text style={styles.photoSourceTitle}>Como adicionar a foto?</Text>
            <TouchableOpacity style={styles.photoSourceBtn} onPress={captureFromCamera}>
              <Ionicons name="camera" size={38} color="#fff" />
              <Text style={styles.photoSourceBtnText}>TIRAR FOTO</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.photoSourceBtn, styles.photoSourceBtnGallery]}
              onPress={captureFromGallery}
            >
              <Ionicons name="images" size={38} color="#DC2626" />
              <Text style={[styles.photoSourceBtnText, styles.photoSourceBtnTextGallery]}>
                DA GALERIA
              </Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={styles.photoSourceBtnCancel}
              onPress={() => setShowPhotoSource(false)}
            >
              <Text style={styles.photoSourceBtnCancelText}>Cancelar</Text>
            </TouchableOpacity>
          </View>
        </View>
      )}

      {/* Visualizador de foto em tela cheia */}
      <Modal
        visible={!!viewerUri}
        transparent
        animationType="fade"
        onRequestClose={() => setViewerUri(null)}
      >
        <View style={styles.modalContainer}>
          <TouchableOpacity style={styles.modalCloseButton} onPress={() => setViewerUri(null)}>
            <Ionicons name="close-circle" size={40} color="#fff" />
          </TouchableOpacity>

          {viewerUri && (
            <Image
              source={{ uri: viewerUri }}
              style={styles.modalPhoto}
              resizeMode="contain"
            />
          )}

          {viewerPhotos.length > 1 && (
            <View style={styles.viewerNav}>
              <TouchableOpacity
                style={[styles.viewerNavBtn, viewerIndex === 0 && styles.viewerNavBtnDisabled]}
                onPress={() => {
                  const prev = viewerIndex - 1;
                  if (prev >= 0) {
                    setViewerIndex(prev);
                    setViewerUri(viewerPhotos[prev]?.url || viewerPhotos[prev]?.uri || null);
                  }
                }}
                disabled={viewerIndex === 0}
              >
                <Ionicons name="chevron-back" size={24} color="#fff" />
              </TouchableOpacity>
              <Text style={styles.viewerCounter}>{viewerIndex + 1} / {viewerPhotos.length}</Text>
              <TouchableOpacity
                style={[styles.viewerNavBtn, viewerIndex === viewerPhotos.length - 1 && styles.viewerNavBtnDisabled]}
                onPress={() => {
                  const next = viewerIndex + 1;
                  if (next < viewerPhotos.length) {
                    setViewerIndex(next);
                    setViewerUri(viewerPhotos[next]?.url || viewerPhotos[next]?.uri || null);
                  }
                }}
                disabled={viewerIndex === viewerPhotos.length - 1}
              >
                <Ionicons name="chevron-forward" size={24} color="#fff" />
              </TouchableOpacity>
            </View>
          )}
        </View>
      </Modal>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: '#f5f5f5',
  },

  // Header (mesma estrutura do obra-detalhe)
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 14,
    borderBottomWidth: 1,
    borderBottomColor: '#f2f2f2',
    backgroundColor: '#fff',
  },
  backButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 999,
    backgroundColor: '#f9fafb',
    borderWidth: 1,
    borderColor: '#edeff5',
    shadowColor: '#000',
    shadowOpacity: 0.08,
    shadowRadius: 6,
    shadowOffset: { width: 0, height: 2 },
    elevation: 2,
  },
  backButtonText: {
    color: '#0f172a',
    fontWeight: '600',
    fontSize: 15,
  },
  headerTitle: {
    flex: 1,
    fontSize: 18,
    fontWeight: '700',
    color: '#1a1a1a',
    textAlign: 'center',
    marginHorizontal: 8,
  },
  refreshButton: {
    width: 40,
    height: 40,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 20,
    backgroundColor: '#f9fafb',
    borderWidth: 1,
    borderColor: '#edeff5',
  },

  container: { flex: 1 },
  scrollContent: {
    padding: 20,
    paddingBottom: 40,
  },

  // Card principal
  card: {
    backgroundColor: '#fff',
    borderRadius: 16,
    padding: 20,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: '#f0f0f0',
  },
  cardTitle: {
    fontSize: 22,
    fontWeight: '700',
    color: '#1a1a1a',
    marginBottom: 4,
  },
  cardSubtitle: {
    fontSize: 14,
    color: '#777',
  },
  statusBadge: {
    alignSelf: 'flex-start',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 999,
  },

  // Banners de status de rede
  offlineBanner: {
    backgroundColor: '#FEF3C7',
    borderBottomWidth: 1,
    borderBottomColor: '#FCD34D',
    paddingHorizontal: 16,
    paddingVertical: 10,
  },
  offlineBannerText: {
    fontSize: 13,
    color: '#92400E',
    fontWeight: '500',
    textAlign: 'center',
  },
  syncingBanner: {
    backgroundColor: '#2196F3',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    paddingVertical: 8,
  },
  syncingBannerText: {
    color: '#fff',
    fontSize: 13,
    fontWeight: '600',
  },
  statusBadgeText: {
    color: '#333',
    fontSize: 12,
    fontWeight: '600',
  },

  // InfoCard e InfoRow (mesma estrutura do obra-detalhe)
  infoCard: {
    backgroundColor: '#fff',
    borderRadius: 16,
    padding: 20,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: '#f0f0f0',
  },
  infoRow: {
    marginBottom: 12,
  },
  infoLabel: {
    fontSize: 13,
    color: '#777',
    marginBottom: 2,
  },
  infoValue: {
    fontSize: 16,
    fontWeight: '600',
    color: '#1a1a1a',
    flexShrink: 1,
  },
  extraSectionTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: '#1a1a1a',
    marginBottom: 12,
  },
  extraFieldLabel: {
    fontSize: 13,
    color: '#475569',
    fontWeight: '600',
    marginBottom: 6,
    marginTop: 8,
  },
  fieldHint: {
    fontSize: 12,
    color: '#64748b',
    marginTop: 6,
  },
  modeChip: {
    flexGrow: 1,
    flexBasis: '31%',
    minHeight: 38,
    minWidth: 92,
    borderWidth: 1,
    borderColor: '#cbd5e1',
    borderRadius: 999,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#f8fafc',
  },
  modeChipActive: {
    backgroundColor: '#dbeafe',
    borderColor: '#2563EB',
  },
  modeChipText: {
    color: '#334155',
    fontSize: 12,
    fontWeight: '700',
  },
  modeChipTextActive: {
    color: '#1d4ed8',
  },
  modeChipCompact: {
    flexBasis: '48%',
  },
  extraInput: {
    borderWidth: 1,
    borderColor: '#dbe2ea',
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 10,
    fontSize: 15,
    color: '#0f172a',
    backgroundColor: '#fff',
  },
  extraRow: {
    flexDirection: 'row',
    gap: 10,
  },
  extraRowWrap: {
    flexWrap: 'wrap',
  },
  extraRowCompact: {
    flexDirection: 'column',
  },
  extraInputHalf: {
    flex: 1,
  },
  extraInputFull: {
    width: '100%',
  },
  extraTextarea: {
    minHeight: 92,
  },
  saveExtraButton: {
    marginTop: 14,
    backgroundColor: '#2563EB',
    borderRadius: 10,
    minHeight: 44,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
  },
  saveExtraButtonDisabled: {
    backgroundColor: '#93C5FD',
  },
  saveExtraButtonText: {
    color: '#fff',
    fontSize: 14,
    fontWeight: '700',
  },

  // Fotos faltantes (igual ao obra-detalhe)
  fotosFaltantesContainer: {
    backgroundColor: '#fff3cd',
    borderRadius: 12,
    padding: 16,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: '#ffc107',
  },
  fotosFaltantesTitle: {
    fontSize: 15,
    fontWeight: '700',
    color: '#856404',
    marginBottom: 8,
  },
  fotosFaltantesItem: {
    fontSize: 14,
    color: '#856404',
    marginLeft: 8,
    marginBottom: 4,
  },

  // Botões de ação (igual ao obra-detalhe)
  actionButtons: {
    flexDirection: 'row',
    marginBottom: 16,
    gap: 12,
  },
  finalizarButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    backgroundColor: '#28a745',
    paddingVertical: 14,
    paddingHorizontal: 24,
    borderRadius: 12,
    shadowColor: '#000',
    shadowOpacity: 0.1,
    shadowRadius: 4,
    shadowOffset: { width: 0, height: 2 },
    elevation: 3,
  },
  finalizarButtonDisabled: {
    backgroundColor: '#9e9e9e',
    shadowOpacity: 0,
    elevation: 0,
  },
  finalizarButtonText: {
    color: '#fff',
    fontSize: 15,
    fontWeight: '600',
    flexShrink: 1,
    textAlign: 'center',
  },

  // Seções de fotos
  photoSectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 12,
  },
  photoSectionTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: '#1a1a1a',
    marginBottom: 12,
  },
  addPhotoButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: '#007bff',
    paddingHorizontal: 12,
    paddingVertical: 7,
    borderRadius: 8,
  },
  addPhotoButtonText: {
    color: '#fff',
    fontSize: 13,
    fontWeight: '600',
  },
  photoGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
  },
  photoThumb: {
    width: 100,
    height: 100,
    borderRadius: 12,
    backgroundColor: '#f0f0f0',
  },
  noPhotosHint: {
    fontSize: 14,
    color: '#999',
    fontStyle: 'italic',
    marginTop: 4,
  },
  noPhotosTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#666',
    marginBottom: 8,
  },
  noPhotosText: {
    fontSize: 14,
    color: '#999',
    lineHeight: 20,
  },

  // Empty state
  emptyState: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: 24,
  },
  emptyTitle: {
    fontSize: 16,
    color: '#666',
    marginBottom: 16,
    textAlign: 'center',
  },
  emptyBackButton: {
    backgroundColor: '#dc3545',
    paddingHorizontal: 24,
    paddingVertical: 12,
    borderRadius: 12,
  },
  emptyBackButtonText: {
    color: '#fff',
    fontWeight: '600',
  },

  // Loading overlay
  loadingOverlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'center',
    alignItems: 'center',
    gap: 12,
  },
  loadingText: { color: '#fff', fontSize: 14 },

  // Bottom sheet
  photoSourceOverlay: {
    ...StyleSheet.absoluteFillObject,
    zIndex: 100,
    justifyContent: 'flex-end',
  },
  photoSourceBackdrop: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(0,0,0,0.4)',
  },
  photoSourceSheet: {
    backgroundColor: '#fff',
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    paddingTop: 12,
    paddingHorizontal: 20,
    paddingBottom: 36,
    gap: 12,
  },
  photoSourceHandle: {
    width: 40,
    height: 4,
    backgroundColor: '#CBD5E1',
    borderRadius: 2,
    alignSelf: 'center',
  },
  photoSourceTitle: {
    textAlign: 'center',
    fontSize: 16,
    fontWeight: '700',
    color: '#1F2937',
    marginBottom: 4,
  },
  photoSourceBtn: {
    backgroundColor: '#DC2626',
    borderRadius: 14,
    minHeight: 80,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
  },
  photoSourceBtnGallery: {
    backgroundColor: '#fff',
    borderWidth: 1,
    borderColor: '#FCA5A5',
  },
  photoSourceBtnText: { color: '#fff', fontWeight: '800', fontSize: 13, letterSpacing: 0.4 },
  photoSourceBtnTextGallery: { color: '#DC2626' },
  photoSourceBtnCancel: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 10,
  },
  photoSourceBtnCancelText: { color: '#64748B', fontWeight: '700', fontSize: 14 },

  // Botão grande de câmera nas seções de foto
  bigCameraBtn: {
    backgroundColor: '#2563EB',
    borderRadius: 14,
    height: 80,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 12,
    shadowColor: '#2563EB',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.25,
    shadowRadius: 8,
    elevation: 4,
  },
  bigCameraBtnDisabled: {
    backgroundColor: '#93C5FD',
    shadowOpacity: 0,
    elevation: 0,
  },
  bigCameraBtnText: {
    fontSize: 20,
    fontWeight: '800',
    color: '#fff',
    letterSpacing: 1.5,
  },

  // Modal viewer
  modalContainer: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.95)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  modalCloseButton: {
    position: 'absolute',
    top: 50,
    right: 20,
    zIndex: 10,
    padding: 8,
  },
  modalPhoto: {
    width: SCREEN_WIDTH,
    height: SCREEN_HEIGHT * 0.8,
  },
  viewerNav: {
    position: 'absolute',
    bottom: 60,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 24,
  },
  viewerNavBtn: {
    backgroundColor: 'rgba(255,255,255,0.15)',
    borderRadius: 20,
    padding: 8,
  },
  viewerNavBtnDisabled: { opacity: 0.3 },
  viewerCounter: { color: '#fff', fontSize: 14, fontWeight: '600' },

  // ─── Postes (Cava em Rocha) ───────────────────────────────────────────────
  postesSectionHeader: {
    backgroundColor: '#fff',
    borderRadius: 16,
    padding: 20,
    marginBottom: 8,
    borderWidth: 1,
    borderColor: '#f0f0f0',
  },
  postesSectionTitle: {
    fontSize: 17,
    fontWeight: '700',
    color: '#1a1a1a',
    marginBottom: 4,
  },
  postesSectionSubtitle: {
    fontSize: 13,
    color: '#64748B',
  },
  postesTopBar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 12,
    paddingHorizontal: 4,
  },
  postesCount: {
    fontSize: 15,
    fontWeight: '700',
    color: '#334155',
  },
  addPosteBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: '#16a34a',
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderRadius: 10,
  },
  addPosteBtnText: {
    color: '#fff',
    fontSize: 14,
    fontWeight: '700',
  },
  posteCard: {
    backgroundColor: '#fff',
    borderRadius: 14,
    padding: 16,
    marginBottom: 14,
    borderWidth: 1,
    borderColor: '#e2e8f0',
    borderLeftWidth: 4,
    borderLeftColor: '#E57C23',
  },
  posteCardHeader: {
    marginBottom: 14,
    paddingBottom: 10,
    borderBottomWidth: 1,
    borderBottomColor: '#f1f5f9',
  },
  posteCardTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: '#1a1a1a',
  },
  posteFieldLabel: {
    fontSize: 13,
    color: '#475569',
    fontWeight: '600',
    marginBottom: 6,
  },
  posteNumInput: {
    borderWidth: 1,
    borderColor: '#cbd5e1',
    borderRadius: 10,
    paddingHorizontal: 14,
    paddingVertical: 10,
    fontSize: 18,
    fontWeight: '700',
    color: '#0f172a',
    textAlign: 'center',
    marginBottom: 14,
    backgroundColor: '#f8fafc',
  },
  aditivoRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    padding: 12,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: '#e2e8f0',
    marginBottom: 10,
    backgroundColor: '#f8fafc',
  },
  aditivoRowActive: {
    borderColor: '#ef4444',
    backgroundColor: '#fef2f2',
  },
  checkbox: {
    width: 20,
    height: 20,
    borderRadius: 5,
    borderWidth: 2,
    borderColor: '#94a3b8',
    backgroundColor: '#fff',
    alignItems: 'center',
    justifyContent: 'center',
  },
  checkboxActive: {
    backgroundColor: '#ef4444',
    borderColor: '#ef4444',
  },
  aditivoLabel: {
    fontSize: 13,
    color: '#334155',
    fontWeight: '500',
    flex: 1,
  },
  aditivoLabelActive: {
    color: '#b91c1c',
    fontWeight: '600',
  },
  posteIdentText: {
    fontSize: 12,
    color: '#64748B',
    marginBottom: 14,
    marginTop: 2,
  },
  postePhotoSubsection: {
    marginTop: 8,
    paddingTop: 12,
    borderTopWidth: 1,
    borderTopColor: '#f1f5f9',
  },
  postePhotoSubsectionTitle: {
    fontSize: 14,
    fontWeight: '700',
    color: '#334155',
    marginBottom: 10,
  },
  addPostePhotoBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    borderWidth: 1.5,
    borderColor: '#2563EB',
    borderRadius: 10,
    paddingVertical: 10,
    marginTop: 6,
    backgroundColor: '#EFF6FF',
  },
  addPostePhotoBtnDisabled: {
    opacity: 0.5,
  },
  addPostePhotoBtnText: {
    color: '#2563EB',
    fontSize: 14,
    fontWeight: '700',
  },
});
