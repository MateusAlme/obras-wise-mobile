import { useState, useEffect, useCallback, useRef } from 'react';
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
  Platform,
  ToastAndroid,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useLocalSearchParams, useRouter } from 'expo-router';
import * as ImagePicker from 'expo-image-picker';
import * as Location from 'expo-location';
import { type Servico, type FotoInfo } from '../types/servico';
import NetInfo from '@react-native-community/netinfo';
import { fetchServicosForObra, saveServicoLocal, syncServico } from '../lib/servico-sync';
import { backupPhoto, getPhotoMetadatasByIds, type PhotoMetadata } from '../lib/photo-backup';

const { width: SCREEN_WIDTH } = Dimensions.get('window');
const THUMB_SIZE = (SCREEN_WIDTH - 32 - 12) / 4;

// ─── Tipos ───────────────────────────────────────────────────────────────────

type TransformadorSection = {
  field: string;
  label: string;
};

type TransformadorModo = 'instalado' | 'retirado';

// ─── Config de seções por modo ───────────────────────────────────────────────

const SECTIONS_INSTALADO: TransformadorSection[] = [
  { field: 'fotos_transformador_laudo',                           label: 'Laudo do Transformador' },
  { field: 'fotos_transformador_componente_instalado',           label: 'Componente Instalado' },
  { field: 'fotos_transformador_tombamento_instalado',           label: 'Tombamento' },
  { field: 'fotos_transformador_tape',                           label: 'Tape do Transformador' },
  { field: 'fotos_transformador_placa_instalado',                label: 'Placa do Transformador' },
  { field: 'fotos_transformador_instalado',                      label: 'Transformador Instalado' },
  { field: 'fotos_transformador_conexoes_primarias_instalado',   label: 'Conexões Primárias' },
  { field: 'fotos_transformador_conexoes_secundarias_instalado', label: 'Conexões Secundárias' },
];

const SECTIONS_RETIRADO: TransformadorSection[] = [
  { field: 'fotos_transformador_antes_retirar',                 label: 'Antes de Retirar' },
  { field: 'fotos_transformador_laudo_retirado',                label: 'Laudo do Transformador Retirado' },
  { field: 'fotos_transformador_tombamento_retirado',           label: 'Tombamento' },
  { field: 'fotos_transformador_placa_retirado',                label: 'Placa do Transformador' },
  { field: 'fotos_transformador_conexoes_primarias_retirado',   label: 'Conexões Primárias' },
  { field: 'fotos_transformador_conexoes_secundarias_retirado', label: 'Conexões Secundárias' },
];

const ALL_SECTIONS = [...SECTIONS_INSTALADO, ...SECTIONS_RETIRADO];

const resolveTransformadorModo = (source: any): TransformadorModo | null => {
  const savedModo = String(source?.dados_adicionais?.transformador_modo || '').toLowerCase();
  if (savedModo === 'instalado' || savedModo === 'retirado') {
    return savedModo as TransformadorModo;
  }

  const countByFields = (fields: TransformadorSection[]) =>
    fields.reduce((acc, section) => {
      const arr = Array.isArray(source?.[section.field]) ? source[section.field] : [];
      return acc + arr.length;
    }, 0);

  const instaladoCount = countByFields(SECTIONS_INSTALADO);
  const retiradoCount = countByFields(SECTIONS_RETIRADO);

  if (instaladoCount > 0 && retiradoCount === 0) return 'instalado';
  if (retiradoCount > 0 && instaladoCount === 0) return 'retirado';
  if (instaladoCount > 0 && retiradoCount > 0) return 'instalado';
  return null;
};

// ─── Helpers ─────────────────────────────────────────────────────────────────

const getPreferredPhotoUri = (photo?: FotoInfo | null): string | null => {
  if (!photo) return null;
  if (typeof photo.url === 'string' && photo.url.startsWith('http')) return photo.url;
  if (typeof photo.uri === 'string' && photo.uri.trim().length > 0) return photo.uri;
  if (typeof photo.url === 'string' && photo.url.trim().length > 0) return photo.url;
  return null;
};

// ─── Componente ──────────────────────────────────────────────────────────────

export default function TransformadorPage() {
  const router = useRouter();
  const params = useLocalSearchParams<{ data?: string }>();

  const initialServico: Servico | null = (() => {
    try {
      return params.data ? JSON.parse(decodeURIComponent(params.data as string)) : null;
    } catch {
      return null;
    }
  })();

  const [servico, setServico] = useState<Servico | null>(initialServico);
  const servicoRef = useRef<Servico | null>(initialServico);
  useEffect(() => { servicoRef.current = servico; }, [servico]);

  const [modo, setModo] = useState<TransformadorModo | null>(
    resolveTransformadorModo(initialServico) ?? null
  );
  const [photos, setPhotos] = useState<Record<string, FotoInfo[]>>({});
  const [captureTarget, setCaptureTarget] = useState<string | null>(null);
  const [showPhotoSource, setShowPhotoSource] = useState(false);
  const [captureLoading, setCaptureLoading] = useState(false);
  const [completing, setCompleting] = useState(false);
  const [viewerUri, setViewerUri] = useState<string | null>(null);
  const [viewerPhotos, setViewerPhotos] = useState<FotoInfo[]>([]);
  const [viewerIndex, setViewerIndex] = useState(0);
  const [locationPermissionGranted, setLocationPermissionGranted] = useState<boolean | null>(null);

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

  // Reidrata fotos sempre que o serviço mudar
  useEffect(() => {
    if (!servico) return;
    const loadPhotos = async () => {
      const allPhotoIds: string[] = [];
      const directByField: Record<string, FotoInfo[]> = {};

      for (const { field } of ALL_SECTIONS) {
        const entries: any[] = Array.isArray((servico as any)[field])
          ? (servico as any)[field]
          : [];
        const direct: FotoInfo[] = [];
        for (const e of entries) {
          if (typeof e === 'string') {
            allPhotoIds.push(e);
          } else if (e && typeof e === 'object') {
            direct.push(e as FotoInfo);
          }
        }
        directByField[field] = direct;
      }

      if (!allPhotoIds.length) {
        setPhotos(directByField);
        return;
      }

      const metas = await getPhotoMetadatasByIds(allPhotoIds).catch(() => [] as PhotoMetadata[]);
      const metaById = new Map((metas as PhotoMetadata[]).map((m) => [m.id, m]));

      const resolved: Record<string, FotoInfo[]> = {};
      for (const { field } of ALL_SECTIONS) {
        const entries: any[] = Array.isArray((servico as any)[field])
          ? (servico as any)[field]
          : [];
        resolved[field] = entries
          .map((e: any): FotoInfo | null => {
            if (typeof e === 'string') {
              const m = metaById.get(e);
              if (!m) return null;
              const localUri = m.compressedPath || m.originalUri || undefined;
              const remoteUrl = m.uploadUrl || m.supabaseUrl || undefined;
              if (!localUri && !remoteUrl) return null;
              return { id: e, uri: localUri ?? remoteUrl, url: remoteUrl } as FotoInfo;
            }
            if (e && typeof e === 'object') return e as FotoInfo;
            return null;
          })
          .filter((f): f is FotoInfo => f !== null);
      }
      setPhotos(resolved);
    };
    loadPhotos();
  }, [servico]);

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
            // Prefere versão com mais dados (modo já selecionado)
            const prevModo = prev.dados_adicionais?.transformador_modo;
            const foundModo = found.dados_adicionais?.transformador_modo;
            if (prevModo && !foundModo) {
              return { ...found, dados_adicionais: prev.dados_adicionais };
            }
            return found;
          });
          const foundModo = resolveTransformadorModo(found);
          if (foundModo) {
            setModo(foundModo);
          }
        }
      } catch {
        // mantém versão dos params
      }
    };
    load();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // ─── Save ───────────────────────────────────────────────────────────────────

  const saveToLocal = useCallback(async (
    updatedPhotos: Record<string, FotoInfo[]>,
    currentModo: TransformadorModo,
  ) => {
    const current = servicoRef.current;
    if (!current) return;
    const photoSpread = Object.fromEntries(
      Object.entries(updatedPhotos).map(([field, fotoInfos]) => [field, fotoInfos])
    );
    const updated = {
      ...current,
      ...photoSpread,
      dados_adicionais: {
        ...(current.dados_adicionais ?? {}),
        transformador_modo: currentModo,
      },
      sync_status: 'offline' as const,
      updated_at: new Date().toISOString(),
    };
    await saveServicoLocal(updated as any);
    setServico(updated as any);
    return updated;
  }, []);

  const persistModoOnly = useCallback(async (nextModo: TransformadorModo) => {
    const current = servicoRef.current;
    if (!current) return;
    const updated = {
      ...current,
      dados_adicionais: {
        ...(current.dados_adicionais ?? {}),
        transformador_modo: nextModo,
      },
      sync_status: 'offline' as const,
      updated_at: new Date().toISOString(),
    };
    await saveServicoLocal(updated as any);
    setServico(updated as any);
  }, []);

  useEffect(() => {
    if (!servico || modo) return;
    const inferred = resolveTransformadorModo(servico);
    if (!inferred) return;
    setModo(inferred);
    void persistModoOnly(inferred);
  }, [modo, persistModoOnly, servico]);

  // ─── Modo ────────────────────────────────────────────────────────────────────

  const handleSelectModo = useCallback((selected: TransformadorModo) => {
    const modoSalvo = resolveTransformadorModo(servicoRef.current);
    if (modoSalvo && modoSalvo !== selected) {
      Alert.alert('Modo bloqueado', 'O modo do transformador ja foi salvo e nao pode ser alterado.');
      return;
    }
    setModo(selected);
    saveToLocal(photos, selected);
  }, [photos, saveToLocal]);

  // ─── Câmera / Galeria ────────────────────────────────────────────────────────

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

  const savePhotoToField = useCallback(async (
    photoUri: string,
    coords: { latitude: number | null; longitude: number | null },
    source: 'camera' | 'gallery' = 'camera',
  ) => {
    const field = captureTarget;
    const current = servicoRef.current;
    if (!field || !current || !modo) return;
    const photoType = field.startsWith('fotos_') ? field.replace(/^fotos_/, '') : field;

    const photoMeta = await backupPhoto(
      photoUri,
      current.obra_id,
      photoType as any,
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

    setPhotos((prev) => {
      const updated = { ...prev, [field]: [...(prev[field] ?? []), newFoto] };
      saveToLocal(updated, modo);
      return updated;
    });
    setCaptureTarget(null);
  }, [captureTarget, modo, saveToLocal]);

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
        await savePhotoToField(result.assets[0].uri, coords, 'camera');
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
        await savePhotoToField(result.assets[0].uri, coords, 'gallery');
      }
    } catch {
      Alert.alert('Erro', 'Não foi possível selecionar a foto.');
    } finally {
      setCaptureLoading(false);
    }
  };

  // ─── Salvar ──────────────────────────────────────────────────────────────────

  const triggerBackgroundSync = useCallback((updated: Awaited<ReturnType<typeof saveToLocal>>) => {
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
      const updated = await saveToLocal(photos, modo);
      triggerBackgroundSync(updated);
      router.back();
    } catch {
      Alert.alert('Erro', 'Não foi possível salvar o serviço.');
    } finally {
      setCompleting(false);
    }
  };

  // ─── Viewer ──────────────────────────────────────────────────────────────────

  const openViewer = (photoList: FotoInfo[], index: number) => {
    setViewerPhotos(photoList);
    setViewerIndex(index);
    setViewerUri(getPreferredPhotoUri(photoList[index]));
  };

  // ─── Back ────────────────────────────────────────────────────────────────────

  const handleBack = useCallback(async () => {
    if (completing) return;
    setCompleting(true);
    try {
      if (modo) {
        const updated = await saveToLocal(photos, modo);
        triggerBackgroundSync(updated);
      }
      router.back();
    } catch {
      Alert.alert('Erro', 'Não foi possível salvar o serviço.');
    } finally {
      setCompleting(false);
    }
  }, [completing, modo, photos, router, saveToLocal, triggerBackgroundSync]);

  useEffect(() => {
    const sub = BackHandler.addEventListener('hardwareBackPress', () => {
      void handleBack();
      return true;
    });
    return () => sub.remove();
  }, [handleBack]);

  // ─── Derivados ───────────────────────────────────────────────────────────────

  const isCompleto = servico?.status === 'completo';
  const isModoLocked = !!resolveTransformadorModo(servico);
  const activeSections = modo === 'instalado' ? SECTIONS_INSTALADO : modo === 'retirado' ? SECTIONS_RETIRADO : [];
  const totalFotos = activeSections.reduce((acc, s) => acc + (photos[s.field]?.length ?? 0), 0);

  // ─── Render ──────────────────────────────────────────────────────────────────

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
          <Text style={styles.headerTitle} numberOfLines={1}>Transformador</Text>
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
            <Text style={styles.completedBadgeText}>Concluido</Text>
          </View>
        )}
      </View>

      {/* Seletor de modo - quando modo ainda nao escolhido */}
      {!modo && (
        <ScrollView style={styles.scroll} contentContainerStyle={styles.scrollContent}>
          <Text style={styles.modoSelectorTitle}>Qual e o tipo de servico?</Text>
          <Text style={styles.modoSelectorSubtitle}>
            A selecao define quais fotos serao solicitadas
          </Text>

          <TouchableOpacity
            style={styles.modoCard}
            onPress={() => handleSelectModo('instalado')}
            activeOpacity={0.8}
          >
            <View style={styles.modoCardIcon}>
              <Ionicons name="flash" size={32} color="#DC2626" />
            </View>
            <View style={styles.modoCardContent}>
              <Text style={styles.modoCardLabel}>INSTALADO</Text>
              <Text style={styles.modoCardSub}>
                {SECTIONS_INSTALADO.length} secoes de fotos
              </Text>
              <Text style={styles.modoCardDesc}>
                {SECTIONS_INSTALADO.map((s) => s.label).join(' · ')}
              </Text>
            </View>
            <Ionicons name="chevron-forward" size={22} color="#9CA3AF" />
          </TouchableOpacity>

          <TouchableOpacity
            style={styles.modoCard}
            onPress={() => handleSelectModo('retirado')}
            activeOpacity={0.8}
          >
            <View style={styles.modoCardIcon}>
              <Ionicons name="construct" size={32} color="#DC2626" />
            </View>
            <View style={styles.modoCardContent}>
              <Text style={styles.modoCardLabel}>RETIRADO</Text>
              <Text style={styles.modoCardSub}>
                {SECTIONS_RETIRADO.length} secoes de fotos
              </Text>
              <Text style={styles.modoCardDesc}>
                {SECTIONS_RETIRADO.map((s) => s.label).join(' · ')}
              </Text>
            </View>
            <Ionicons name="chevron-forward" size={22} color="#9CA3AF" />
          </TouchableOpacity>

          <View style={{ height: 40 }} />
        </ScrollView>
      )}

      {/* Secoes de foto - quando modo selecionado */}
      {modo && (
        <>
          <View style={styles.modoBar}>
            <View style={styles.modoBarLeft}>
              <View style={styles.modoBadge}>
                <Ionicons
                  name={modo === 'instalado' ? 'flash' : 'construct'}
                  size={14}
                  color="#fff"
                />
                <Text style={styles.modoBadgeText}>
                  {modo === 'instalado' ? 'INSTALADO' : 'RETIRADO'}
                </Text>
              </View>
              <Text style={styles.modoCounter}>
                {totalFotos} foto{totalFotos !== 1 ? 's' : ''}
              </Text>
            </View>
            {!isCompleto && !isModoLocked && (
              <Text style={styles.modoAlterar}>Modo ainda nao salvo</Text>
            )}
          </View>

          <ScrollView style={styles.scroll} contentContainerStyle={styles.scrollContent}>
            {activeSections.map(({ field, label }) => {
              const sectionPhotos = photos[field] ?? [];
              return (
                <View key={field} style={styles.sectionCard}>
                  <View style={styles.sectionHeader}>
                    <Text style={styles.sectionTitle}>{label}</Text>
                    <Text style={styles.sectionCount}>
                      {sectionPhotos.length} foto{sectionPhotos.length !== 1 ? 's' : ''}
                    </Text>
                  </View>

                  <View style={styles.photoRow}>
                    {sectionPhotos.map((photo, pIdx) => {
                      const displayUri = getPreferredPhotoUri(photo);
                      if (!displayUri) return null;
                      return (
                        <TouchableOpacity
                          key={pIdx}
                          onPress={() => openViewer(sectionPhotos, pIdx)}
                          activeOpacity={0.85}
                        >
                          <Image
                            source={{ uri: displayUri }}
                            style={styles.photoThumb}
                            resizeMode="cover"
                          />
                        </TouchableOpacity>
                      );
                    })}

                    {!isCompleto && (
                      <TouchableOpacity
                        style={[styles.addPhotoBtn, captureLoading && styles.addPhotoBtnDisabled]}
                        onPress={() => { setCaptureTarget(field); setShowPhotoSource(true); }}
                        disabled={captureLoading}
                        activeOpacity={0.8}
                      >
                        {captureLoading && captureTarget === field ? (
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

            <View style={{ height: 40 }} />
          </ScrollView>
        </>
      )}

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

// ─── Estilos ─────────────────────────────────────────────────────────────────

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

  // Seletor de modo
  modoSelectorTitle: {
    fontSize: 20,
    fontWeight: '700',
    color: '#111827',
    marginBottom: 6,
    marginTop: 8,
  },
  modoSelectorSubtitle: {
    fontSize: 14,
    color: '#6B7280',
    marginBottom: 24,
    lineHeight: 20,
  },
  modoCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#fff',
    borderRadius: 14,
    padding: 16,
    marginBottom: 14,
    borderLeftWidth: 4,
    borderLeftColor: '#DC2626',
    shadowColor: '#000',
    shadowOpacity: 0.06,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 2 },
    elevation: 3,
    gap: 14,
  },
  modoCardIcon: {
    width: 52,
    height: 52,
    borderRadius: 26,
    backgroundColor: '#FEF2F2',
    alignItems: 'center',
    justifyContent: 'center',
  },
  modoCardContent: {
    flex: 1,
    gap: 2,
  },
  modoCardLabel: {
    fontSize: 17,
    fontWeight: '800',
    color: '#111827',
    letterSpacing: 0.5,
  },
  modoCardSub: {
    fontSize: 13,
    color: '#DC2626',
    fontWeight: '600',
  },
  modoCardDesc: {
    fontSize: 12,
    color: '#6B7280',
    lineHeight: 17,
    marginTop: 2,
  },

  // Barra de modo (pós-seleção)
  modoBar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 10,
    backgroundColor: '#fff',
    borderBottomWidth: 1,
    borderBottomColor: '#E5E7EB',
  },
  modoBarLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  modoBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 20,
    backgroundColor: '#DC2626',
  },
  modoBadgeText: {
    fontSize: 12,
    fontWeight: '800',
    color: '#fff',
    letterSpacing: 0.5,
  },
  modoCounter: {
    fontSize: 13,
    color: '#6B7280',
    fontWeight: '500',
  },
  modoAlterar: {
    fontSize: 13,
    color: '#DC2626',
    fontWeight: '600',
  },

  // ScrollView
  scroll: { flex: 1 },
  scrollContent: { padding: 16, paddingBottom: 32 },

  // Seção de fotos
  sectionCard: {
    backgroundColor: '#fff',
    borderRadius: 14,
    marginBottom: 12,
    borderLeftWidth: 4,
    borderLeftColor: '#DC2626',
    shadowColor: '#000',
    shadowOpacity: 0.05,
    shadowRadius: 6,
    shadowOffset: { width: 0, height: 2 },
    elevation: 2,
    overflow: 'hidden',
  },
  sectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 14,
    paddingVertical: 10,
    backgroundColor: '#F9FAFB',
    borderBottomWidth: 1,
    borderBottomColor: '#F3F4F6',
  },
  sectionTitle: {
    fontSize: 13,
    fontWeight: '700',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    color: '#374151',
    flex: 1,
  },
  sectionCount: {
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

