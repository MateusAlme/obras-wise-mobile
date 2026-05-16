import { useState, useEffect, useCallback, useRef, memo } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
  Image,
  Modal,
  Dimensions,
  StatusBar,
  ActivityIndicator,
  Alert,
  BackHandler,
  TextInput,
  Platform,
  ToastAndroid,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useLocalSearchParams, useRouter } from 'expo-router';
import * as ImagePicker from 'expo-image-picker';
import * as Location from 'expo-location';
import { type Servico, type FotoInfo, type PosteData } from '../types/servico';
import NetInfo from '@react-native-community/netinfo';
import { fetchServicosForObra, saveServicoLocal, syncServico } from '../lib/servico-sync';
import { backupPhoto, getPhotoMetadatasByIds, type PhotoMetadata } from '../lib/photo-backup';

const { width: SCREEN_WIDTH } = Dimensions.get('window');

type PosteLocal = {
  id: string;
  numero: string;
  isAditivo: boolean;
  fotosAntes: FotoInfo[];
  fotosDurante: FotoInfo[];
  fotosDepois: FotoInfo[];
  fotosMedicao: FotoInfo[]; // 4ª seção — Medição Terrômetro (Book de Aterramento)
};

type CaptureTarget = {
  posteId: string;
  section: 'antes' | 'durante' | 'depois' | 'medicao';
};

type SectionConfig = {
  key: 'antes' | 'durante' | 'depois' | 'medicao';
  label: string;
};

const SECTIONS_BY_TIPO: Record<string, SectionConfig[]> = {
  'Book de Aterramento': [
    { key: 'antes',   label: 'Vala Aberta' },
    { key: 'durante', label: 'Hastes' },
    { key: 'depois',  label: 'Vala Fechada' },
    { key: 'medicao', label: 'Medição Terrômetro' },
  ],
};

const DEFAULT_SECTIONS: SectionConfig[] = [
  { key: 'antes',   label: 'Antes' },
  { key: 'durante', label: 'Durante' },
  { key: 'depois',  label: 'Depois' },
];

const THUMB_SIZE = (SCREEN_WIDTH - 32 - 12) / 4;

const getPreferredPhotoUri = (photo?: FotoInfo | null): string | null => {
  if (!photo) return null;
  if (typeof photo.url === 'string' && photo.url.startsWith('http')) return photo.url;
  if (typeof photo.uri === 'string' && photo.uri.trim().length > 0) return photo.uri;
  if (typeof photo.url === 'string' && photo.url.trim().length > 0) return photo.url;
  return null;
};

const getServicoPostesPhotoCount = (servicoLike: any): number => {
  const postes = Array.isArray(servicoLike?.postes_data) ? servicoLike.postes_data : [];
  const byPostes = postes.reduce((sum: number, poste: any) => {
    const before = Array.isArray(poste?.fotos_antes) ? poste.fotos_antes.length : 0;
    const during = Array.isArray(poste?.fotos_durante) ? poste.fotos_durante.length : 0;
    const after = Array.isArray(poste?.fotos_depois) ? poste.fotos_depois.length : 0;
    const measure = Array.isArray(poste?.fotos_medicao) ? poste.fotos_medicao.length : 0;
    return sum + before + during + after + measure;
  }, 0);

  const byFlat =
    (Array.isArray(servicoLike?.fotos_antes) ? servicoLike.fotos_antes.length : 0) +
    (Array.isArray(servicoLike?.fotos_durante) ? servicoLike.fotos_durante.length : 0) +
    (Array.isArray(servicoLike?.fotos_depois) ? servicoLike.fotos_depois.length : 0);

  return Math.max(byPostes, byFlat);
};

type PosteCardProps = {
  poste: PosteLocal;
  posteNumber: number;
  activeSections: SectionConfig[];
  isCompleto: boolean;
  captureTarget: CaptureTarget | null;
  captureLoading: boolean;
  onRemove: (id: string) => void;
  onNumeroChange: (id: string, val: string) => void;
  onNumeroBlur: (id: string) => void;
  onAditivoToggle: (id: string, val: boolean) => void;
  onAddPhoto: (id: string, section: SectionConfig['key']) => void;
  onOpenViewer: (photos: FotoInfo[], index: number) => void;
};

const PosteCard = memo(({
  poste, posteNumber, activeSections, isCompleto,
  captureTarget, captureLoading,
  onRemove, onNumeroChange, onNumeroBlur, onAditivoToggle, onAddPhoto, onOpenViewer,
}: PosteCardProps) => {
  const totalPoste = poste.fotosAntes.length + poste.fotosDurante.length + poste.fotosDepois.length + poste.fotosMedicao.length;
  const posteCompleto = activeSections.every(({ key }) => {
    if (key === 'antes')   return poste.fotosAntes.length > 0;
    if (key === 'durante') return poste.fotosDurante.length > 0;
    if (key === 'depois')  return poste.fotosDepois.length > 0;
    if (key === 'medicao') return poste.fotosMedicao.length > 0;
    return true;
  });

  return (
    <View style={[styles.posteCard, poste.isAditivo && styles.posteCardAditivo]}>
      <View style={styles.posteCardHeader}>
        <View style={styles.posteCardHeaderLeft}>
          <View style={[styles.posteStatusDot, posteCompleto ? styles.dotCompleto : styles.dotPendente]} />
          <Text style={styles.posteCardTitle}>Poste {posteNumber}</Text>
          <View style={styles.fotosCountBadge}>
            <Text style={styles.fotosCountText}>{totalPoste} fotos</Text>
          </View>
        </View>
        {!isCompleto && (
          <TouchableOpacity style={styles.removeButton} onPress={() => onRemove(poste.id)} activeOpacity={0.7}>
            <Ionicons name="trash-outline" size={16} color="#EF4444" />
            <Text style={styles.removeButtonText}>Remover</Text>
          </TouchableOpacity>
        )}
      </View>

      <View style={styles.posteIdentRow}>
        <Text style={styles.posteIdentLabel}>Número do poste:</Text>
        <View style={styles.posteIdentInputWrapper}>
          <Text style={styles.posteIdentPrefix}>P</Text>
          <TextInput
            style={styles.posteIdentInput}
            value={poste.numero}
            onChangeText={(v) => onNumeroChange(poste.id, v.replace(/[^0-9]/g, ''))}
            onEndEditing={() => onNumeroBlur(poste.id)}
            keyboardType="numeric"
            placeholder="1"
            placeholderTextColor="#94A3B8"
            returnKeyType="done"
            editable={!isCompleto}
            maxLength={4}
          />
        </View>
      </View>

      <TouchableOpacity
        style={[styles.aditivoRow, poste.isAditivo && styles.aditivoRowActive]}
        onPress={() => !isCompleto && onAditivoToggle(poste.id, !poste.isAditivo)}
        activeOpacity={0.8}
        disabled={isCompleto}
      >
        <View style={[styles.checkbox, poste.isAditivo && styles.checkboxActive]}>
          {poste.isAditivo && <Ionicons name="checkmark" size={13} color="#fff" />}
        </View>
        <Text style={[styles.aditivoLabel, poste.isAditivo && styles.aditivoLabelActive]}>
          Poste aditivo (não previsto no croqui)
        </Text>
      </TouchableOpacity>

      {activeSections.map(({ key, label }) => {
        const sectionPhotos =
          key === 'antes'   ? poste.fotosAntes   :
          key === 'durante' ? poste.fotosDurante :
          key === 'depois'  ? poste.fotosDepois  :
                             poste.fotosMedicao;
        return (
          <View key={key} style={styles.photoSection}>
            <View style={styles.photoSectionHeader}>
              <Text style={styles.photoSectionTitle}>{label}</Text>
              <Text style={styles.photoSectionCount}>
                {sectionPhotos.length} foto{sectionPhotos.length !== 1 ? 's' : ''}
              </Text>
            </View>
            <View style={styles.photoRow}>
              {sectionPhotos.map((photo, pIdx) => {
                const displayUri = getPreferredPhotoUri(photo);
                if (!displayUri) return null;
                return (
                  <TouchableOpacity key={pIdx} onPress={() => onOpenViewer(sectionPhotos, pIdx)} activeOpacity={0.85}>
                    <Image source={{ uri: displayUri }} style={styles.photoThumb} resizeMode="cover" />
                  </TouchableOpacity>
                );
              })}
              {!isCompleto && (
                <TouchableOpacity
                  style={[styles.addPhotoBtn, captureLoading && styles.addPhotoBtnDisabled]}
                  onPress={() => onAddPhoto(poste.id, key)}
                  disabled={captureLoading}
                  activeOpacity={0.8}
                >
                  {captureLoading && captureTarget?.posteId === poste.id && captureTarget?.section === key ? (
                    <ActivityIndicator size="small" color="#DC2626" />
                  ) : (
                    <>
                      <Ionicons name="camera" size={22} color="#DC2626" />
                      <Text style={styles.addPhotoBtnText}>Adicionar</Text>
                    </>
                  )}
                </TouchableOpacity>
              )}
            </View>
          </View>
        );
      })}
    </View>
  );
});

export default function PostesRegistroPage() {
  const router = useRouter();
  const params = useLocalSearchParams<{ data?: string; title?: string }>();

  // Título dinâmico recebido via params (ex: "Cava em Rocha", "Linha Viva", "Book de Aterramento")
  const pageTitle = params.title ? decodeURIComponent(params.title as string) : 'Registro de Postes';

  // Seções de foto ativas — variam por tipo de serviço
  const activeSections = SECTIONS_BY_TIPO[pageTitle] ?? DEFAULT_SECTIONS;

  const initialServico: Servico | null = (() => {
    try {
      return params.data ? JSON.parse(decodeURIComponent(params.data as string)) : null;
    } catch {
      return null;
    }
  })();

  const [servico, setServico] = useState<Servico | null>(initialServico);
  const [postes, setPostes] = useState<PosteLocal[]>([]);
  const [captureTarget, setCaptureTarget] = useState<CaptureTarget | null>(null);
  const [showPhotoSource, setShowPhotoSource] = useState(false);
  const [captureLoading, setCaptureLoading] = useState(false);
  const [completing, setCompleting] = useState(false);
  const [viewerUri, setViewerUri] = useState<string | null>(null);
  const [viewerIndex, setViewerIndex] = useState(0);
  const [viewerPhotos, setViewerPhotos] = useState<FotoInfo[]>([]);
  const [locationPermissionGranted, setLocationPermissionGranted] = useState<boolean | null>(null);

  const servicoRef = useRef<Servico | null>(initialServico);
  useEffect(() => { servicoRef.current = servico; }, [servico]);

  const notifyPhotoSavedWithoutLocation = useCallback(() => {
    const message = 'Foto salva sem localização';
    if (Platform.OS === 'android') {
      ToastAndroid.show(message, ToastAndroid.SHORT);
      return;
    }
    Alert.alert('Localização indisponível', message);
  }, []);

  useEffect(() => {
    let active = true;
    (async () => {
      try {
        const permission = await Location.requestForegroundPermissionsAsync();
        if (!active) return;
        setLocationPermissionGranted(permission.granted);
        if (!permission.granted) {
          Alert.alert('Localização desativada', 'As fotos serão salvas sem coordenadas.');
        }
      } catch {
        if (!active) return;
        setLocationPermissionGranted(false);
        Alert.alert('Localização indisponível', 'As fotos serão salvas sem coordenadas.');
      }
    })();
    return () => {
      active = false;
    };
  }, []);

    // Reidrata postes sempre que o servico mudar (evita estado congelado do initialServico).
  useEffect(() => {
    if (!servico) return;

    const raw = (servico as any).postes_data as any[] | undefined;
    const legacyFlatPoste =
      (!raw?.length &&
        (Array.isArray((servico as any).fotos_antes) ||
          Array.isArray((servico as any).fotos_durante) ||
          Array.isArray((servico as any).fotos_depois)))
        ? [{
            id: 'poste_legacy_1',
            numero: 1,
            isAditivo: false,
            fotos_antes: Array.isArray((servico as any).fotos_antes) ? (servico as any).fotos_antes : [],
            fotos_durante: Array.isArray((servico as any).fotos_durante) ? (servico as any).fotos_durante : [],
            fotos_depois: Array.isArray((servico as any).fotos_depois) ? (servico as any).fotos_depois : [],
          }]
        : null;
    const sourcePostes = (raw?.length ? raw : legacyFlatPoste) as any[] | null;

    if (!sourcePostes?.length) {
      setPostes([{
        id: `poste_${Date.now()}`,
        numero: '1',
        isAditivo: false,
        fotosAntes: [],
        fotosDurante: [],
        fotosDepois: [],
        fotosMedicao: [],
      }]);
      return;
    }

    const normalizePhotoFromMeta = (photoId: string, metaById: Map<string, PhotoMetadata>): FotoInfo | null => {
      const m = metaById.get(photoId);
      if (!m) return null;
      const localUri = m.compressedPath || m.originalUri || undefined;
      const remoteUrl = m.uploadUrl || m.supabaseUrl || undefined;
      if (!localUri && !remoteUrl) return null;
      return {
        id: photoId,
        uri: localUri ?? remoteUrl,
        url: remoteUrl,
        latitude: m.latitude ?? undefined,
        longitude: m.longitude ?? undefined,
      } as FotoInfo;
    };

    const build = (metaById: Map<string, PhotoMetadata>): PosteLocal[] =>
      sourcePostes.map((p: any, index: number) => {
        const resolve = (entries: any[]): FotoInfo[] =>
          (Array.isArray(entries) ? entries : [])
            .map((entry: any) => {
              if (!entry) return null;

              if (typeof entry === 'string') {
                const resolved = normalizePhotoFromMeta(entry, metaById);
                // Preserve the ID reference even when no local metadata exists
                // (photo may be stored only in Supabase, on another device, or metadata pruned)
                return resolved ?? ({ id: entry, uri: undefined, url: undefined } as FotoInfo);
              }

              if (typeof entry === 'object') {
                const entryId = typeof entry.id === 'string' ? entry.id : null;
                const directUri = getPreferredPhotoUri(entry as FotoInfo);
                if (directUri) {
                  return {
                    ...entry,
                    id: entryId ?? undefined,
                    uri: typeof entry.uri === 'string' ? entry.uri : directUri,
                    url: typeof entry.url === 'string' ? entry.url : undefined,
                  } as FotoInfo;
                }
                if (entryId) {
                  const resolved = normalizePhotoFromMeta(entryId, metaById);
                  return resolved ?? ({ id: entryId, uri: undefined, url: undefined } as FotoInfo);
                }
              }

              return null;
            })
            .filter((photo): photo is FotoInfo => photo !== null);

        return {
          id: String(p?.id || `poste_${index + 1}`),
          numero: String(p?.numero ?? index + 1),
          isAditivo: !!p?.isAditivo,
          fotosAntes: resolve(p?.fotos_antes),
          fotosDurante: resolve(p?.fotos_durante),
          fotosDepois: resolve(p?.fotos_depois),
          fotosMedicao: resolve(p?.fotos_medicao ?? []),
        };
      });

    const pendingIds = sourcePostes
      .flatMap((p: any) => [
        ...(p?.fotos_antes || []),
        ...(p?.fotos_durante || []),
        ...(p?.fotos_depois || []),
        ...(p?.fotos_medicao || []),
      ])
      .map((entry: any) => {
        if (typeof entry === 'string') return entry;
        if (entry && typeof entry === 'object' && typeof entry.id === 'string' && !getPreferredPhotoUri(entry as FotoInfo)) {
          return entry.id;
        }
        return null;
      })
      .filter((id: any): id is string => typeof id === 'string' && id.length > 0);

    if (!pendingIds.length) {
      setPostes(build(new Map()));
      return;
    }

    getPhotoMetadatasByIds(pendingIds)
      .then((metas) => {
        const byId = new Map((metas as PhotoMetadata[]).map((m) => [m.id, m]));
        setPostes(build(byId));
      })
      .catch(() => setPostes(build(new Map())));
  }, [servico]); // acompanha atualizacao do servico atual

  const savePostesToLocal = useCallback(async (updatedPostes: PosteLocal[]) => {
    const current = servicoRef.current;
    if (!current) return null;
    // Serializa preservando url quando disponível — evita perder referência de fotos
    // que só existem no Supabase (sem metadata local), pois o useEffect reconstrói
    // postes a partir desses dados e descartaria fotos sem url E sem metadata.
    const serializeFoto = (f: FotoInfo): any => {
      if (!f.id && !f.url && !f.uri) return null;
      if (f.url || f.uri) {
        return { id: f.id, url: f.url, uri: f.uri, latitude: f.latitude, longitude: f.longitude };
      }
      return f.id || null;
    };
    const postesData: PosteData[] = updatedPostes.map((p) => ({
      id: p.id,
      numero: parseInt(p.numero, 10) || 0,
      isAditivo: p.isAditivo,
      fotos_antes: p.fotosAntes.map(serializeFoto).filter(Boolean),
      fotos_durante: p.fotosDurante.map(serializeFoto).filter(Boolean),
      fotos_depois: p.fotosDepois.map(serializeFoto).filter(Boolean),
      ...(p.fotosMedicao.length > 0
        ? { fotos_medicao: p.fotosMedicao.map(serializeFoto).filter(Boolean) }
        : {}),
    }));
    const updated = {
      ...current,
      postes_data: postesData,
      sync_status: 'offline' as const,
      updated_at: new Date().toISOString(),
    };
    await saveServicoLocal(updated as any);
    setServico(updated as any);
    return updated;
  }, []);

  // Adiciona novo ponto no INÍCIO da lista
  const handleAddPoste = useCallback(() => {
    setPostes((prev) => {
      const newPoste: PosteLocal = {
        id: `poste_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`,
        numero: String(prev.length + 1),
        isAditivo: false,
        fotosAntes: [],
        fotosDurante: [],
        fotosDepois: [],
        fotosMedicao: [],
      };
      const updated = [newPoste, ...prev]; // Novo fica no TOPO
      savePostesToLocal(updated);
      return updated;
    });
  }, [savePostesToLocal]);

  // Remove poste com confirmação
  const handleRemovePoste = useCallback((posteId: string) => {
    Alert.alert(
      'Remover ponto',
      'Tem certeza que deseja remover este ponto? As fotos já tiradas serão perdidas.',
      [
        { text: 'Cancelar', style: 'cancel' },
        {
          text: 'Remover',
          style: 'destructive',
          onPress: () => {
            setPostes((prev) => {
              const updated = prev.filter((p) => p.id !== posteId);
              savePostesToLocal(updated);
              return updated;
            });
          },
        },
      ]
    );
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
    setCaptureTarget({ posteId, section });
    setShowPhotoSource(true);
  }, []);

  const getCurrentLocation = async () => {
    try {
      const lastKnown = await Location.getLastKnownPositionAsync();
      if (lastKnown?.coords?.latitude && lastKnown?.coords?.longitude) {
        return { latitude: lastKnown.coords.latitude, longitude: lastKnown.coords.longitude };
      }
      if (locationPermissionGranted === false) {
        return { latitude: null, longitude: null };
      }
      const location = await Promise.race([
        Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.Balanced }),
        new Promise<never>((_, reject) => setTimeout(() => reject(new Error('timeout')), 12000)),
      ]);
      if (!location?.coords?.latitude || !location?.coords?.longitude) throw new Error('invalid');
      return { latitude: location.coords.latitude, longitude: location.coords.longitude };
    } catch {
      return { latitude: null, longitude: null };
    }
  };

  const savePhotoToPoste = useCallback(async (
    photoUri: string,
    coords: { latitude: number | null; longitude: number | null },
    source: 'camera' | 'gallery' = 'camera',
  ) => {
    const target = captureTarget;
    const current = servicoRef.current;
    if (!target || !current) return;
    const photoType = target.section === 'medicao' ? 'aterramento_medicao' : target.section;

    const photoMeta = await backupPhoto(
      photoUri,
      current.obra_id,
      photoType,
      0,
      coords.latitude,
      coords.longitude,
      'image/jpeg',
      source,
    );

    const newFoto: FotoInfo = {
      id: photoMeta.id,
      uri: photoMeta.compressedPath || photoMeta.originalUri || photoUri,
      latitude: photoMeta.latitude ?? undefined,
      longitude: photoMeta.longitude ?? undefined,
    };

    setPostes((prev) => {
      const updated = prev.map((p) => {
        if (p.id !== target.posteId) return p;
        return {
          ...p,
          fotosAntes:   target.section === 'antes'   ? [...p.fotosAntes,   newFoto] : p.fotosAntes,
          fotosDurante: target.section === 'durante' ? [...p.fotosDurante, newFoto] : p.fotosDurante,
          fotosDepois:  target.section === 'depois'  ? [...p.fotosDepois,  newFoto] : p.fotosDepois,
          fotosMedicao: target.section === 'medicao' ? [...p.fotosMedicao, newFoto] : p.fotosMedicao,
        };
      });
      savePostesToLocal(updated);
      return updated;
    });

    setCaptureTarget(null);
  }, [captureTarget, savePostesToLocal]);

  const captureFromCamera = async () => {
    setShowPhotoSource(false);
    if (!captureTarget) return;
    try {
      setCaptureLoading(true);
      const perm = await ImagePicker.requestCameraPermissionsAsync();
      if (!perm.granted) {
        Alert.alert('Permissão negada', 'Permita o acesso à câmera para tirar fotos.');
        return;
      }
      const locationPromise = getCurrentLocation();
      const result = await ImagePicker.launchCameraAsync({ mediaTypes: ['images'], allowsEditing: false, quality: 0.85 });
      if (!result.canceled && result.assets[0]) {
        const coords = await locationPromise;
        if (coords.latitude === null || coords.longitude === null) {
          notifyPhotoSavedWithoutLocation();
        }
        await savePhotoToPoste(result.assets[0].uri, coords, 'camera');
      }
    } catch {
      Alert.alert('Erro', 'Não foi possível tirar a foto.');
    } finally {
      setCaptureLoading(false);
    }
  };

  const captureFromGallery = async () => {
    setShowPhotoSource(false);
    if (!captureTarget) return;
    try {
      setCaptureLoading(true);
      const perm = await ImagePicker.requestMediaLibraryPermissionsAsync();
      if (!perm.granted) {
        Alert.alert('Permissão negada', 'Permita o acesso à galeria.');
        return;
      }
      const locationPromise = getCurrentLocation();
      const result = await ImagePicker.launchImageLibraryAsync({ mediaTypes: ['images'], allowsEditing: false, quality: 0.85 });
      if (!result.canceled && result.assets[0]) {
        const coords = await locationPromise;
        if (coords.latitude === null || coords.longitude === null) {
          notifyPhotoSavedWithoutLocation();
        }
        await savePhotoToPoste(result.assets[0].uri, coords, 'gallery');
      }
    } catch {
      Alert.alert('Erro', 'Não foi possível selecionar a foto.');
    } finally {
      setCaptureLoading(false);
    }
  };

  const triggerBackgroundSync = useCallback((updated: Awaited<ReturnType<typeof savePostesToLocal>>) => {
    if (!updated || !updated.id || updated.id.startsWith('temp-')) return;
    NetInfo.fetch().then((netState) => {
      const online = netState.isConnected === true && netState.isInternetReachable !== false;
      if (!online) return;
      void syncServico(updated as any).catch(() => {});
    }).catch(() => {});
  }, []);

  const handleSalvar = async () => {
    setCompleting(true);
    try {
      const updated = await savePostesToLocal(postes);
      triggerBackgroundSync(updated);
      router.back();
    } catch {
      Alert.alert('Erro', 'Não foi possível salvar o serviço.');
    } finally {
      setCompleting(false);
    }
  };

  const openViewer = (photos: FotoInfo[], index: number) => {
    setViewerPhotos(photos);
    setViewerIndex(index);
    setViewerUri(getPreferredPhotoUri(photos[index]));
  };

  const handleBack = useCallback(async () => {
    if (completing) return;
    setCompleting(true);
    try {
      const updated = await savePostesToLocal(postes);
      triggerBackgroundSync(updated);
      router.back();
    } catch {
      Alert.alert('Erro', 'Não foi possível salvar o serviço.');
    } finally {
      setCompleting(false);
    }
  }, [completing, postes, router, savePostesToLocal, triggerBackgroundSync]);

  useEffect(() => {
    const sub = BackHandler.addEventListener('hardwareBackPress', () => {
      void handleBack();
      return true;
    });
    return () => sub.remove();
  }, [handleBack]);

  // Sync ao montar — recarrega versão mais recente do serviço
  useEffect(() => {
    const load = async () => {
      if (!initialServico) return;
      try {
        const list = await fetchServicosForObra(initialServico.obra_id);
        const found = list.find((s) => s.id === initialServico.id);
        if (found) {
          setServico((prev) => {
            if (!prev) return found;
            const prevCount = getServicoPostesPhotoCount(prev);
            const foundCount = getServicoPostesPhotoCount(found);
            if (prevCount > foundCount) {
              return {
                ...found,
                postes_data: (prev as any).postes_data,
                fotos_antes: (prev as any).fotos_antes,
                fotos_durante: (prev as any).fotos_durante,
                fotos_depois: (prev as any).fotos_depois,
              } as any;
            }
            return found;
          });
        }
      } catch {
        // mantém versão dos params
      }
    };
    load();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const totalFotos = postes.reduce(
    (acc, p) => acc + p.fotosAntes.length + p.fotosDurante.length + p.fotosDepois.length + p.fotosMedicao.length,
    0
  );
  const isCompleto = servico?.status === 'completo';

  return (
    <SafeAreaView style={styles.safeArea} edges={['top', 'bottom']}>
      <StatusBar barStyle="dark-content" backgroundColor="#fff" />

      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity style={styles.backButton} onPress={handleBack} activeOpacity={0.7}>
          <Ionicons name="arrow-back" size={20} color="#374151" />
          <Text style={styles.backButtonText}>Voltar</Text>
        </TouchableOpacity>

        <View style={styles.headerCenter}>
          <Text style={styles.headerTitle} numberOfLines={1}>{pageTitle}</Text>
          {servico && (
            <Text style={styles.headerSubtitle} numberOfLines={1}>
              Obra {(servico as any).numero_obra || servico.obra_id?.slice(0, 8)}
            </Text>
          )}
        </View>

        {!isCompleto && (
          <TouchableOpacity
            style={[styles.completeButton, completing && styles.completeButtonDisabled]}
            onPress={handleSalvar}
            disabled={completing}
            activeOpacity={0.8}
          >
            {completing ? (
              <ActivityIndicator size="small" color="#fff" />
            ) : (
              <Text style={styles.completeButtonText}>Salvar</Text>
            )}
          </TouchableOpacity>
        )}

        {isCompleto && (
          <View style={styles.completedBadge}>
            <Ionicons name="checkmark-circle" size={16} color="#DC2626" />
            <Text style={styles.completedBadgeText}>Concluído</Text>
          </View>
        )}
      </View>

      {/* Barra de ação: Adicionar Ponto + contador */}
      {!isCompleto && (
        <View style={styles.actionBar}>
          <TouchableOpacity
            style={styles.addPosteButton}
            onPress={handleAddPoste}
            activeOpacity={0.8}
          >
            <Ionicons name="add-circle" size={20} color="#fff" />
            <Text style={styles.addPosteButtonText}>Adicionar Poste</Text>
          </TouchableOpacity>

          <View style={styles.counterBadge}>
            <Text style={styles.counterText}>
              {postes.length} {postes.length === 1 ? 'poste' : 'postes'} · {totalFotos} fotos
            </Text>
          </View>
        </View>
      )}

      <ScrollView style={styles.scroll} contentContainerStyle={styles.scrollContent}>

        {postes.length === 0 && (
          <View style={styles.emptyState}>
            <Ionicons name="camera-outline" size={48} color="#DC2626" />
            <Text style={styles.emptyStateTitle}>Nenhum poste cadastrado</Text>
            <Text style={styles.emptyStateText}>
              Toque em "Adicionar Poste" para registrar o primeiro poste.
            </Text>
          </View>
        )}

        {postes.map((poste, idx) => (
          <PosteCard
            key={poste.id}
            poste={poste}
            posteNumber={postes.length - idx}
            activeSections={activeSections}
            isCompleto={isCompleto}
            captureTarget={captureTarget}
            captureLoading={captureLoading}
            onRemove={handleRemovePoste}
            onNumeroChange={handlePosteNumeroChange}
            onNumeroBlur={handlePosteNumeroBlur}
            onAditivoToggle={handlePosteAditivoChange}
            onAddPhoto={handleAddPostePhoto}
            onOpenViewer={openViewer}
          />
        ))}

        <View style={{ height: 40 }} />
      </ScrollView>

      {/* Loading overlay geral */}
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
            onPress={() => { setShowPhotoSource(false); setCaptureTarget(null); }}
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
              <Text style={[styles.photoSourceBtnText, styles.photoSourceBtnTextGallery]}>DA GALERIA</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={styles.photoSourceBtnCancel}
              onPress={() => { setShowPhotoSource(false); setCaptureTarget(null); }}
            >
              <Text style={styles.photoSourceBtnCancelText}>Cancelar</Text>
            </TouchableOpacity>
          </View>
        </View>
      )}

      {/* Visualizador de foto em tela cheia */}
      <Modal visible={!!viewerUri} transparent animationType="fade" onRequestClose={() => setViewerUri(null)}>
        <View style={styles.viewerContainer}>
          <TouchableOpacity style={styles.viewerClose} onPress={() => setViewerUri(null)}>
            <Ionicons name="close-circle" size={40} color="#fff" />
          </TouchableOpacity>
          {viewerUri && (
            <Image source={{ uri: viewerUri }} style={styles.viewerPhoto} resizeMode="contain" />
          )}
          {viewerPhotos.length > 1 && (
            <View style={styles.viewerNav}>
              <TouchableOpacity
                style={[styles.viewerNavBtn, viewerIndex === 0 && styles.viewerNavBtnDisabled]}
                onPress={() => {
                  const prev = viewerIndex - 1;
                  if (prev >= 0) { setViewerIndex(prev); setViewerUri(getPreferredPhotoUri(viewerPhotos[prev])); }
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
                  if (next < viewerPhotos.length) { setViewerIndex(next); setViewerUri(getPreferredPhotoUri(viewerPhotos[next])); }
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
    backgroundColor: '#F3F4F6',
  },

  // Header
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 12,
    paddingVertical: 12,
    backgroundColor: '#fff',
    borderBottomWidth: 1,
    borderBottomColor: '#E5E7EB',
    gap: 8,
  },
  backButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 10,
    paddingVertical: 8,
    borderRadius: 8,
    backgroundColor: '#F9FAFB',
    borderWidth: 1,
    borderColor: '#E5E7EB',
  },
  backButtonText: {
    fontSize: 14,
    color: '#374151',
    fontWeight: '500',
  },
  headerCenter: {
    flex: 1,
    alignItems: 'center',
  },
  headerTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: '#111827',
  },
  headerSubtitle: {
    fontSize: 12,
    color: '#6B7280',
    marginTop: 1,
  },
  completeButton: {
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 8,
    backgroundColor: '#DC2626',
  },
  completeButtonDisabled: {
    backgroundColor: '#9CA3AF',
  },
  completeButtonText: {
    fontSize: 14,
    fontWeight: '700',
    color: '#fff',
  },
  completedBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 8,
    backgroundColor: '#FEF2F2',
  },
  completedBadgeText: {
    fontSize: 13,
    fontWeight: '600',
    color: '#DC2626',
  },

  // Barra de ação
  actionBar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 10,
    backgroundColor: '#fff',
    borderBottomWidth: 1,
    borderBottomColor: '#E5E7EB',
  },
  addPosteButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 10,
    backgroundColor: '#DC2626',
  },
  addPosteButtonText: {
    fontSize: 15,
    fontWeight: '700',
    color: '#fff',
  },
  counterBadge: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 20,
    backgroundColor: '#F3F4F6',
  },
  counterText: {
    fontSize: 13,
    color: '#6B7280',
    fontWeight: '500',
  },

  // ScrollView
  scroll: { flex: 1 },
  scrollContent: { padding: 16, paddingBottom: 32 },

  // Empty state
  emptyState: {
    alignItems: 'center',
    paddingVertical: 48,
    gap: 12,
  },
  emptyStateTitle: {
    fontSize: 17,
    fontWeight: '700',
    color: '#374151',
  },
  emptyStateText: {
    fontSize: 14,
    color: '#6B7280',
    textAlign: 'center',
    maxWidth: 260,
    lineHeight: 20,
  },

  // Poste card
  posteCard: {
    backgroundColor: '#fff',
    borderRadius: 14,
    marginBottom: 16,
    borderLeftWidth: 4,
    borderLeftColor: '#DC2626',
    shadowColor: '#000',
    shadowOpacity: 0.06,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 2 },
    elevation: 3,
    overflow: 'hidden',
  },
  posteCardAditivo: {
    borderLeftColor: '#991B1B',
  },

  // Cabeçalho do poste
  posteCardHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 14,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#F3F4F6',
  },
  posteCardHeaderLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  posteStatusDot: {
    width: 10,
    height: 10,
    borderRadius: 5,
  },
  dotCompleto: { backgroundColor: '#DC2626' },
  dotPendente: { backgroundColor: '#D1D5DB' },
  posteCardTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: '#111827',
  },
  fotosCountBadge: {
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 10,
    backgroundColor: '#F3F4F6',
  },
  fotosCountText: {
    fontSize: 11,
    color: '#6B7280',
    fontWeight: '500',
  },
  removeButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 8,
    backgroundColor: '#FEF2F2',
  },
  removeButtonText: {
    fontSize: 13,
    color: '#EF4444',
    fontWeight: '600',
  },

  // Identificador do poste
  posteIdentRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderBottomWidth: 1,
    borderBottomColor: '#F3F4F6',
  },
  posteIdentLabel: {
    fontSize: 13,
    color: '#6B7280',
    fontWeight: '500',
  },
  posteIdentInputWrapper: {
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#D1D5DB',
    borderRadius: 8,
    backgroundColor: '#F9FAFB',
    paddingHorizontal: 8,
    height: 36,
    minWidth: 60,
  },
  posteIdentPrefix: {
    fontSize: 16,
    fontWeight: '700',
    color: '#DC2626',
    marginRight: 2,
  },
  posteIdentInput: {
    fontSize: 16,
    fontWeight: '700',
    color: '#111827',
    minWidth: 32,
    height: 36,
    padding: 0,
  },

  // Aditivo
  aditivoRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderBottomWidth: 1,
    borderBottomColor: '#F3F4F6',
  },
  aditivoRowActive: {
    backgroundColor: '#FEF2F2',
  },
  checkbox: {
    width: 20,
    height: 20,
    borderRadius: 4,
    borderWidth: 2,
    borderColor: '#D1D5DB',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#fff',
  },
  checkboxActive: {
    borderColor: '#EF4444',
    backgroundColor: '#EF4444',
  },
  aditivoLabel: {
    fontSize: 13,
    color: '#6B7280',
    flex: 1,
  },
  aditivoLabelActive: {
    color: '#EF4444',
    fontWeight: '600',
  },

  // Seções de foto
  photoSection: {
    borderBottomWidth: 1,
    borderBottomColor: '#F3F4F6',
  },
  photoSectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 14,
    paddingVertical: 8,
    backgroundColor: '#F9FAFB',
  },
  photoSectionTitle: {
    fontSize: 13,
    fontWeight: '700',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    color: '#374151',
  },
  photoSectionCount: {
    fontSize: 12,
    fontWeight: '500',
    color: '#6B7280',
  },
  photoRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    padding: 10,
    gap: 6,
    alignItems: 'center',
  },
  photoThumb: {
    width: THUMB_SIZE,
    height: THUMB_SIZE,
    borderRadius: 8,
    backgroundColor: '#E5E7EB',
  },
  addPhotoBtn: {
    width: THUMB_SIZE,
    height: THUMB_SIZE,
    borderRadius: 8,
    borderWidth: 2,
    borderColor: '#DC2626',
    borderStyle: 'dashed',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 4,
    backgroundColor: '#FEF2F2',
  },
  addPhotoBtnDisabled: {
    borderColor: '#9CA3AF',
    backgroundColor: '#F9FAFB',
  },
  addPhotoBtnText: {
    fontSize: 11,
    color: '#DC2626',
    fontWeight: '600',
  },

  // Loading
  loadingOverlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(0,0,0,0.5)',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 12,
  },
  loadingText: {
    color: '#fff',
    fontSize: 15,
    fontWeight: '600',
  },

  // Bottom sheet câmera/galeria
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
    borderRadius: 2,
    backgroundColor: '#CBD5E1',
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
  photoSourceBtnText: {
    color: '#fff',
    fontWeight: '800',
    fontSize: 13,
    letterSpacing: 0.4,
  },
  photoSourceBtnTextGallery: {
    color: '#DC2626',
  },
  photoSourceBtnCancel: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 10,
  },
  photoSourceBtnCancelText: {
    color: '#64748B',
    fontWeight: '700',
    fontSize: 14,
  },

  // Visualizador de foto
  viewerContainer: {
    flex: 1,
    backgroundColor: '#000',
    justifyContent: 'center',
    alignItems: 'center',
  },
  viewerClose: {
    position: 'absolute',
    top: 48,
    right: 16,
    zIndex: 10,
  },
  viewerPhoto: {
    width: SCREEN_WIDTH,
    height: '100%',
  },
  viewerNav: {
    position: 'absolute',
    bottom: 40,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 24,
  },
  viewerNavBtn: {
    padding: 8,
    borderRadius: 999,
    backgroundColor: 'rgba(255,255,255,0.2)',
  },
  viewerNavBtnDisabled: {
    opacity: 0.3,
  },
  viewerCounter: {
    color: '#fff',
    fontSize: 15,
    fontWeight: '600',
  },
});


