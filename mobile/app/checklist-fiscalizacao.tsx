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
  TextInput,
  Platform,
  ToastAndroid,
  useWindowDimensions,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useLocalSearchParams, useRouter } from 'expo-router';
import * as ImagePicker from 'expo-image-picker';
import * as Location from 'expo-location';
import {
  type Servico,
  type FotoInfo,
  type PosteData,
  type SeccionamentoData,
  type AterramentoCercaData,
  type HasteTermometroData,
} from '../types/servico';
import NetInfo from '@react-native-community/netinfo';
import { fetchServicosForObra, saveServicoLocal, syncServico } from '../lib/servico-sync';
import { backupPhoto, getPhotoMetadatasByIds, type PhotoMetadata } from '../lib/photo-backup';

const { width: SCREEN_WIDTH } = Dimensions.get('window');
const THUMB_SIZE = (SCREEN_WIDTH - 32 - 12) / 4;

type SimpleChecklistField =
  | 'fotos_checklist_croqui'
  | 'fotos_checklist_panoramica_inicial'
  | 'fotos_checklist_chede'
  | 'fotos_checklist_padrao_geral'
  | 'fotos_checklist_padrao_interno'
  | 'fotos_checklist_frying'
  | 'fotos_checklist_abertura_fechamento_pulo'
  | 'fotos_checklist_panoramica_final';

type ChecklistPosteStatus = 'instalado' | 'retirado' | 'existente';
type ChecklistPostePhotoField =
  | 'posteInteiro'
  | 'descricao'
  | 'engaste'
  | 'conexao1'
  | 'conexao2'
  | 'maiorEsforco'
  | 'menorEsforco';

type ChecklistPosteLocal = {
  id: string;
  numero: string;
  isAditivo: boolean;
  status: ChecklistPosteStatus;
  posteInteiro: FotoInfo[];
  descricao: FotoInfo[];
  engaste: FotoInfo[];
  conexao1: FotoInfo[];
  conexao2: FotoInfo[];
  maiorEsforco: FotoInfo[];
  menorEsforco: FotoInfo[];
};

type TrechoItemLocal = {
  id: string;
  numero: string;
  posteInicio: string;
  posteFim: string;
  fotos: FotoInfo[];
};

type ReferenciaItemLocal = {
  id: string;
  referencia: string;
  fotos: FotoInfo[];
};

type HasteItemLocal = {
  id: string;
  numero: string;
  isAditivo: boolean;
  fotoHaste: FotoInfo[];
  fotoTermometro: FotoInfo[];
};

type CaptureTarget =
  | { kind: 'simple'; field: SimpleChecklistField }
  | { kind: 'poste'; posteId: string; field: ChecklistPostePhotoField }
  | { kind: 'emenda'; itemId: string }
  | { kind: 'poda'; itemId: string }
  | { kind: 'seccionamento'; itemId: string }
  | { kind: 'aterramento'; itemId: string }
  | { kind: 'haste'; itemId: string; field: 'fotoHaste' | 'fotoTermometro' };

type SimpleSectionConfig = {
  field: SimpleChecklistField;
  label: string;
};

const SIMPLE_SECTIONS_TOP: SimpleSectionConfig[] = [
  { field: 'fotos_checklist_croqui', label: 'Croqui da Obra' },
  { field: 'fotos_checklist_panoramica_inicial', label: 'Panorâmica Inicial' },
  { field: 'fotos_checklist_chede', label: 'Fotos da Chave com Componente' },
];

const SIMPLE_SECTIONS_MIDDLE: SimpleSectionConfig[] = [
  { field: 'fotos_checklist_padrao_geral', label: 'Padrão de Ligação - Vista Geral' },
  { field: 'fotos_checklist_padrao_interno', label: 'Padrão de Ligação - Interno' },
  { field: 'fotos_checklist_frying', label: 'Flying' },
  { field: 'fotos_checklist_abertura_fechamento_pulo', label: 'Abertura e Fechamento de Pulo' },
];

const SIMPLE_SECTION_FINAL: SimpleSectionConfig = {
  field: 'fotos_checklist_panoramica_final',
  label: 'Panorâmica Final',
};

const EMPTY_SIMPLE_PHOTOS: Record<SimpleChecklistField, FotoInfo[]> = {
  fotos_checklist_croqui: [],
  fotos_checklist_panoramica_inicial: [],
  fotos_checklist_chede: [],
  fotos_checklist_padrao_geral: [],
  fotos_checklist_padrao_interno: [],
  fotos_checklist_frying: [],
  fotos_checklist_abertura_fechamento_pulo: [],
  fotos_checklist_panoramica_final: [],
};

const POSTE_FIELDS_BY_STATUS: Record<ChecklistPosteStatus, Array<{ key: ChecklistPostePhotoField; label: string }>> = {
  instalado: [
    { key: 'posteInteiro', label: 'Poste Inteiro' },
    { key: 'descricao', label: 'Descrição' },
    { key: 'engaste', label: 'Engaste' },
    { key: 'conexao1', label: 'Conexão 1' },
    { key: 'conexao2', label: 'Conexão 2' },
    { key: 'maiorEsforco', label: 'Maior Esforço' },
    { key: 'menorEsforco', label: 'Menor Esforço' },
  ],
  retirado: [
    { key: 'posteInteiro', label: 'Poste Inteiro' },
  ],
  existente: [
    { key: 'posteInteiro', label: 'Poste Inteiro' },
    { key: 'conexao1', label: 'Conexão 1' },
    { key: 'conexao2', label: 'Conexão 2' },
  ],
};

const SIMPLE_FIELD_TO_PHOTO_TYPE: Record<SimpleChecklistField, string> = {
  fotos_checklist_croqui: 'checklist_croqui',
  fotos_checklist_panoramica_inicial: 'checklist_panoramica_inicial',
  fotos_checklist_chede: 'checklist_chede',
  fotos_checklist_padrao_geral: 'checklist_padrao_geral',
  fotos_checklist_padrao_interno: 'checklist_padrao_interno',
  fotos_checklist_frying: 'checklist_frying',
  fotos_checklist_abertura_fechamento_pulo: 'checklist_abertura_fechamento_pulo',
  fotos_checklist_panoramica_final: 'checklist_panoramica_final',
};

const createPoste = (index: number): ChecklistPosteLocal => ({
  id: `chk_poste_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
  numero: String(index + 1),
  isAditivo: false,
  status: 'instalado',
  posteInteiro: [],
  descricao: [],
  engaste: [],
  conexao1: [],
  conexao2: [],
  maiorEsforco: [],
  menorEsforco: [],
});

const createTrechoItem = (prefix: 'E' | 'PD', index: number): TrechoItemLocal => ({
  id: `chk_${prefix.toLowerCase()}_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
  numero: String(index + 1),
  posteInicio: '',
  posteFim: '',
  fotos: [],
});

const createReferenciaItem = (prefix: 'SE' | 'AC', index: number): ReferenciaItemLocal => ({
  id: `chk_${prefix.toLowerCase()}_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
  referencia: String(index + 1),
  fotos: [],
});

const createHasteItem = (index: number): HasteItemLocal => ({
  id: `chk_haste_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
  numero: String(index + 1),
  isAditivo: false,
  fotoHaste: [],
  fotoTermometro: [],
});

const getPreferredPhotoUri = (photo?: FotoInfo | null): string | null => {
  if (!photo) return null;
  if (typeof photo.url === 'string' && photo.url.startsWith('http')) return photo.url;
  if (typeof photo.uri === 'string' && photo.uri.trim().length > 0) return photo.uri;
  if (typeof photo.url === 'string' && photo.url.trim().length > 0) return photo.url;
  return null;
};

const toNumericText = (value: string): string => value.replace(/\D/g, '');

const toPhotoIds = (photos: FotoInfo[]): string[] =>
  photos
    .map((photo) => (typeof photo?.id === 'string' ? photo.id.trim() : ''))
    .filter((id): id is string => id.length > 0);

const collectPendingIdsFromEntries = (entries: any[]): string[] => {
  if (!Array.isArray(entries)) return [];
  return entries
    .map((entry) => {
      if (typeof entry === 'string') return entry;
      if (!entry || typeof entry !== 'object') return null;
      if (typeof entry.id === 'string' && !getPreferredPhotoUri(entry as FotoInfo)) {
        return entry.id;
      }
      return null;
    })
    .filter((id): id is string => typeof id === 'string' && id.length > 0);
};

const resolvePhotoEntries = (entries: any[], metaById: Map<string, PhotoMetadata>): FotoInfo[] => {
  const normalized = Array.isArray(entries) ? entries : [];
  return normalized
    .map((entry: any): FotoInfo | null => {
      if (!entry) return null;

      if (typeof entry === 'string') {
        const metadata = metaById.get(entry);
        if (!metadata) return null;
        const localUri = metadata.compressedPath || metadata.originalUri || undefined;
        const remoteUrl = metadata.uploadUrl || metadata.supabaseUrl || undefined;
        if (!localUri && !remoteUrl) return null;
        return {
          id: entry,
          uri: localUri ?? remoteUrl,
          url: remoteUrl,
          latitude: metadata.latitude ?? undefined,
          longitude: metadata.longitude ?? undefined,
        } as FotoInfo;
      }

      if (typeof entry === 'object') {
        const directUri = getPreferredPhotoUri(entry as FotoInfo);
        if (directUri) {
          return {
            ...(entry as FotoInfo),
            uri: typeof entry.uri === 'string' ? entry.uri : directUri,
            url: typeof entry.url === 'string' ? entry.url : undefined,
          };
        }

        if (typeof entry.id === 'string') {
          const metadata = metaById.get(entry.id);
          if (!metadata) return null;
          const localUri = metadata.compressedPath || metadata.originalUri || undefined;
          const remoteUrl = metadata.uploadUrl || metadata.supabaseUrl || undefined;
          if (!localUri && !remoteUrl) return null;
          return {
            id: entry.id,
            uri: localUri ?? remoteUrl,
            url: remoteUrl,
            latitude: metadata.latitude ?? undefined,
            longitude: metadata.longitude ?? undefined,
          } as FotoInfo;
        }
      }

      return null;
    })
    .filter((photo): photo is FotoInfo => photo !== null);
};

const countChecklistPhotos = (servicoLike: any): number => {
  const countField = (value: any): number => (Array.isArray(value) ? value.length : 0);

  let total = 0;

  const simpleFields = Object.keys(EMPTY_SIMPLE_PHOTOS) as SimpleChecklistField[];
  total += simpleFields.reduce((sum, field) => sum + countField(servicoLike?.[field]), 0);

  const postes = Array.isArray(servicoLike?.checklist_postes_data) ? servicoLike.checklist_postes_data : [];
  total += postes.reduce((sum: number, poste: any) => (
    sum +
    countField(poste?.posteInteiro) +
    countField(poste?.descricao) +
    countField(poste?.engaste) +
    countField(poste?.conexao1) +
    countField(poste?.conexao2) +
    countField(poste?.maiorEsforco) +
    countField(poste?.menorEsforco)
  ), 0);

  const seccionamentos = Array.isArray(servicoLike?.checklist_seccionamentos_data) ? servicoLike.checklist_seccionamentos_data : [];
  total += seccionamentos.reduce((sum: number, item: any) => sum + countField(item?.fotos), 0);

  const aterramentos = Array.isArray(servicoLike?.checklist_aterramentos_cerca_data) ? servicoLike.checklist_aterramentos_cerca_data : [];
  total += aterramentos.reduce((sum: number, item: any) => sum + countField(item?.fotos), 0);

  const hastes = Array.isArray(servicoLike?.checklist_hastes_termometros_data) ? servicoLike.checklist_hastes_termometros_data : [];
  total += hastes.reduce((sum: number, item: any) => (
    sum + countField(item?.fotoHaste) + countField(item?.fotoTermometro)
  ), 0);

  return total;
};

export default function ChecklistFiscalizacaoPage() {
  const { width: windowWidth } = useWindowDimensions();
  const isCompact = windowWidth <= 360;
  const thumbSize = Math.max(56, Math.floor((windowWidth - 84) / (isCompact ? 3 : 4)));

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
  const debounceTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const skipNextHydrationRef = useRef(false);

  const [simplePhotos, setSimplePhotos] = useState<Record<SimpleChecklistField, FotoInfo[]>>(EMPTY_SIMPLE_PHOTOS);
  const [checklistPostes, setChecklistPostes] = useState<ChecklistPosteLocal[]>([]);
  const [emendas, setEmendas] = useState<TrechoItemLocal[]>([]);
  const [podas, setPodas] = useState<TrechoItemLocal[]>([]);
  const [seccionamentos, setSeccionamentos] = useState<ReferenciaItemLocal[]>([]);
  const [aterramentosCerca, setAterramentosCerca] = useState<ReferenciaItemLocal[]>([]);
  const [hastesTermometro, setHastesTermometro] = useState<HasteItemLocal[]>([]);

  const [captureTarget, setCaptureTarget] = useState<CaptureTarget | null>(null);
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

  useEffect(() => {
    const loadLatest = async () => {
      if (!initialServico) return;
      try {
        const list = await fetchServicosForObra(initialServico.obra_id);
        const initialClientPk = String((initialServico as any)?.client_pk || '').trim();
        const found = list.find((candidate) => {
          if (candidate.id === initialServico.id) return true;
          const candidatePk = String((candidate as any)?.client_pk || '').trim();
          return !!initialClientPk && candidatePk === initialClientPk;
        });

        if (!found) return;

        const current = servicoRef.current;
        if (!current) {
          setServico(found);
          return;
        }

        const currentCount = countChecklistPhotos(current);
        const foundCount = countChecklistPhotos(found);
        if (foundCount >= currentCount) {
          setServico(found);
        }
      } catch {
        // keep initial payload when fetch fails
      }
    };

    loadLatest();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (!servico) return;
    if (skipNextHydrationRef.current) {
      skipNextHydrationRef.current = false;
      return;
    }

    const simpleFields = Object.keys(EMPTY_SIMPLE_PHOTOS) as SimpleChecklistField[];
    const rawPostes = Array.isArray((servico as any).checklist_postes_data)
      ? (servico as any).checklist_postes_data
      : [];
    const rawSeccionamentos = Array.isArray((servico as any).checklist_seccionamentos_data)
      ? (servico as any).checklist_seccionamentos_data
      : [];
    const rawAterramentos = Array.isArray((servico as any).checklist_aterramentos_cerca_data)
      ? (servico as any).checklist_aterramentos_cerca_data
      : [];
    const rawHastes = Array.isArray((servico as any).checklist_hastes_termometros_data)
      ? (servico as any).checklist_hastes_termometros_data
      : [];

    const pendingIds = [
      ...simpleFields.flatMap((field) => collectPendingIdsFromEntries((servico as any)[field] || [])),
      ...rawPostes.flatMap((poste: any) => [
        ...collectPendingIdsFromEntries(poste?.posteInteiro || []),
        ...collectPendingIdsFromEntries(poste?.descricao || []),
        ...collectPendingIdsFromEntries(poste?.engaste || []),
        ...collectPendingIdsFromEntries(poste?.conexao1 || []),
        ...collectPendingIdsFromEntries(poste?.conexao2 || []),
        ...collectPendingIdsFromEntries(poste?.maiorEsforco || []),
        ...collectPendingIdsFromEntries(poste?.menorEsforco || []),
      ]),
      ...rawSeccionamentos.flatMap((item: any) => collectPendingIdsFromEntries(item?.fotos || [])),
      ...rawAterramentos.flatMap((item: any) => collectPendingIdsFromEntries(item?.fotos || [])),
      ...rawHastes.flatMap((item: any) => [
        ...collectPendingIdsFromEntries(item?.fotoHaste || []),
        ...collectPendingIdsFromEntries(item?.fotoTermometro || []),
      ]),
    ];

    const applyResolved = (metaById: Map<string, PhotoMetadata>) => {
      const nextSimple = { ...EMPTY_SIMPLE_PHOTOS };
      for (const field of simpleFields) {
        nextSimple[field] = resolvePhotoEntries((servico as any)[field] || [], metaById);
      }

      const nextPostes: ChecklistPosteLocal[] = rawPostes.map((poste: any, index: number) => {
        const normalizedStatus = String(poste?.status || '').trim().toLowerCase();
        const status: ChecklistPosteStatus =
          normalizedStatus === 'retirado'
            ? 'retirado'
            : normalizedStatus === 'existente'
              ? 'existente'
              : 'instalado';

        return {
          id: String(poste?.id || `chk_poste_${index + 1}`),
          numero: String(poste?.numero ?? index + 1),
          isAditivo: !!poste?.isAditivo,
          status,
          posteInteiro: resolvePhotoEntries(poste?.posteInteiro || [], metaById),
          descricao: resolvePhotoEntries(poste?.descricao || [], metaById),
          engaste: resolvePhotoEntries(poste?.engaste || [], metaById),
          conexao1: resolvePhotoEntries(poste?.conexao1 || [], metaById),
          conexao2: resolvePhotoEntries(poste?.conexao2 || [], metaById),
          maiorEsforco: resolvePhotoEntries(poste?.maiorEsforco || [], metaById),
          menorEsforco: resolvePhotoEntries(poste?.menorEsforco || [], metaById),
        };
      });

      const onlyEmendas = rawSeccionamentos.filter((item: any) => String(item?.tipo || '').toLowerCase() === 'emenda');
      const onlyPodas = rawSeccionamentos.filter((item: any) => String(item?.tipo || '').toLowerCase() === 'poda');
      const onlySeccionamentos = rawSeccionamentos.filter((item: any) => {
        const tipo = String(item?.tipo || '').toLowerCase();
        return tipo === 'seccionamento' || tipo === '';
      });

      const nextEmendas: TrechoItemLocal[] = onlyEmendas.map((item: any, index: number) => ({
        id: String(item?.id || `chk_e_${index + 1}`),
        numero: String(item?.numero ?? index + 1),
        posteInicio: String(item?.posteInicio ?? item?.poste_inicio ?? ''),
        posteFim: String(item?.posteFim ?? item?.poste_fim ?? ''),
        fotos: resolvePhotoEntries(item?.fotos || [], metaById),
      }));

      const nextPodas: TrechoItemLocal[] = onlyPodas.map((item: any, index: number) => ({
        id: String(item?.id || `chk_pd_${index + 1}`),
        numero: String(item?.numero ?? index + 1),
        posteInicio: String(item?.posteInicio ?? item?.poste_inicio ?? ''),
        posteFim: String(item?.posteFim ?? item?.poste_fim ?? ''),
        fotos: resolvePhotoEntries(item?.fotos || [], metaById),
      }));

      const nextSeccionamentos: ReferenciaItemLocal[] = onlySeccionamentos.map((item: any, index: number) => ({
        id: String(item?.id || `chk_se_${index + 1}`),
        referencia: String(item?.numero ?? index + 1),
        fotos: resolvePhotoEntries(item?.fotos || [], metaById),
      }));

      const nextAterramentos: ReferenciaItemLocal[] = rawAterramentos.map((item: any, index: number) => ({
        id: String(item?.id || `chk_ac_${index + 1}`),
        referencia: String(item?.numero ?? index + 1),
        fotos: resolvePhotoEntries(item?.fotos || [], metaById),
      }));

      const nextHastes: HasteItemLocal[] = rawHastes.map((item: any, index: number) => ({
        id: String(item?.id || `chk_haste_${index + 1}`),
        numero: String(item?.numero ?? index + 1),
        isAditivo: !!item?.isAditivo,
        fotoHaste: resolvePhotoEntries(item?.fotoHaste || [], metaById),
        fotoTermometro: resolvePhotoEntries(item?.fotoTermometro || [], metaById),
      }));

      setSimplePhotos(nextSimple);
      setChecklistPostes(nextPostes);
      setEmendas(nextEmendas);
      setPodas(nextPodas);
      setSeccionamentos(nextSeccionamentos);
      setAterramentosCerca(nextAterramentos);
      setHastesTermometro(nextHastes);
    };

    if (!pendingIds.length) {
      applyResolved(new Map());
      return;
    }

    getPhotoMetadatasByIds(pendingIds)
      .then((metas) => {
        const byId = new Map((metas as PhotoMetadata[]).map((metadata) => [metadata.id, metadata]));
        applyResolved(byId);
      })
      .catch(() => applyResolved(new Map()));
  }, [servico]);

  const saveChecklistToLocal = useCallback(async (
    nextSimplePhotos: Record<SimpleChecklistField, FotoInfo[]>,
    nextPostes: ChecklistPosteLocal[],
    nextEmendas: TrechoItemLocal[],
    nextPodas: TrechoItemLocal[],
    nextSeccionamentos: ReferenciaItemLocal[],
    nextAterramentos: ReferenciaItemLocal[],
    nextHastes: HasteItemLocal[],
  ) => {
    const current = servicoRef.current;
    if (!current) return;

    const checklistPostesData: PosteData[] = nextPostes.map((poste, index) => ({
      id: poste.id,
      numero: parseInt(poste.numero, 10) || index + 1,
      isAditivo: poste.isAditivo,
      status: poste.status as any,
      fotos_antes: [],
      fotos_durante: [],
      fotos_depois: [],
      posteInteiro: toPhotoIds(poste.posteInteiro),
      descricao: toPhotoIds(poste.descricao),
      engaste: toPhotoIds(poste.engaste),
      conexao1: toPhotoIds(poste.conexao1),
      conexao2: toPhotoIds(poste.conexao2),
      maiorEsforco: toPhotoIds(poste.maiorEsforco),
      menorEsforco: toPhotoIds(poste.menorEsforco),
    }));

    const checklistSeccionamentosData: SeccionamentoData[] = [
      ...nextEmendas.map((item, index) => ({
        id: item.id,
        numero: parseInt(item.numero, 10) || index + 1,
        tipo: 'emenda' as const,
        posteInicio: item.posteInicio ? parseInt(item.posteInicio, 10) || null : null,
        posteFim: item.posteFim ? parseInt(item.posteFim, 10) || null : null,
        fotos: toPhotoIds(item.fotos),
      })),
      ...nextPodas.map((item, index) => ({
        id: item.id,
        numero: parseInt(item.numero, 10) || index + 1,
        tipo: 'poda' as const,
        posteInicio: item.posteInicio ? parseInt(item.posteInicio, 10) || null : null,
        posteFim: item.posteFim ? parseInt(item.posteFim, 10) || null : null,
        fotos: toPhotoIds(item.fotos),
      })),
      ...nextSeccionamentos.map((item, index) => ({
        id: item.id,
        numero: parseInt(item.referencia, 10) || index + 1,
        tipo: 'seccionamento' as const,
        posteInicio: null,
        posteFim: null,
        fotos: toPhotoIds(item.fotos),
      })),
    ];

    const checklistAterramentosData: AterramentoCercaData[] = nextAterramentos.map((item, index) => ({
      id: item.id,
      numero: parseInt(item.referencia, 10) || index + 1,
      fotos: toPhotoIds(item.fotos),
    }));

    const checklistHastesData: HasteTermometroData[] = nextHastes.map((item, index) => ({
      id: item.id,
      numero: item.numero || String(index + 1),
      isAditivo: item.isAditivo,
      fotoHaste: toPhotoIds(item.fotoHaste),
      fotoTermometro: toPhotoIds(item.fotoTermometro),
    }));

    const fotosChecklistPostes = checklistPostesData.flatMap((poste: any) => [
      ...(Array.isArray(poste.posteInteiro) ? poste.posteInteiro : []),
      ...(Array.isArray(poste.descricao) ? poste.descricao : []),
      ...(Array.isArray(poste.engaste) ? poste.engaste : []),
      ...(Array.isArray(poste.conexao1) ? poste.conexao1 : []),
      ...(Array.isArray(poste.conexao2) ? poste.conexao2 : []),
      ...(Array.isArray(poste.maiorEsforco) ? poste.maiorEsforco : []),
      ...(Array.isArray(poste.menorEsforco) ? poste.menorEsforco : []),
    ]);

    const fotosChecklistSeccionamentos = checklistSeccionamentosData
      .filter((item) => item.tipo === 'seccionamento')
      .flatMap((item) => item.fotos || []);

    const fotosChecklistAterramento = checklistAterramentosData.flatMap((item) => item.fotos || []);

    const updatedServico = {
      ...current,
      ...nextSimplePhotos,
      fotos_checklist_postes: fotosChecklistPostes,
      fotos_checklist_seccionamentos: fotosChecklistSeccionamentos,
      fotos_checklist_aterramento_cerca: fotosChecklistAterramento,
      checklist_postes_data: checklistPostesData,
      checklist_seccionamentos_data: checklistSeccionamentosData,
      checklist_aterramentos_cerca_data: checklistAterramentosData,
      checklist_hastes_termometros_data: checklistHastesData,
      sync_status: 'offline' as const,
      updated_at: new Date().toISOString(),
    };

    await saveServicoLocal(updatedServico as any);
    skipNextHydrationRef.current = true;
    setServico(updatedServico as any);
    return updatedServico;
  }, []);

  // Salva imediatamente — usar em adição de fotos
  const persistSnapshotNow = useCallback((
    nextSimplePhotos: Record<SimpleChecklistField, FotoInfo[]>,
    nextPostes: ChecklistPosteLocal[],
    nextEmendas: TrechoItemLocal[],
    nextPodas: TrechoItemLocal[],
    nextSeccionamentos: ReferenciaItemLocal[],
    nextAterramentos: ReferenciaItemLocal[],
    nextHastes: HasteItemLocal[],
  ) => {
    if (debounceTimerRef.current !== null) {
      clearTimeout(debounceTimerRef.current);
      debounceTimerRef.current = null;
    }
    void saveChecklistToLocal(nextSimplePhotos, nextPostes, nextEmendas, nextPodas, nextSeccionamentos, nextAterramentos, nextHastes);
  }, [saveChecklistToLocal]);

  // Salva com debounce 500ms — usar em edição de campos de texto/toggle
  const persistSnapshot = useCallback((
    nextSimplePhotos: Record<SimpleChecklistField, FotoInfo[]>,
    nextPostes: ChecklistPosteLocal[],
    nextEmendas: TrechoItemLocal[],
    nextPodas: TrechoItemLocal[],
    nextSeccionamentos: ReferenciaItemLocal[],
    nextAterramentos: ReferenciaItemLocal[],
    nextHastes: HasteItemLocal[],
  ) => {
    if (debounceTimerRef.current !== null) clearTimeout(debounceTimerRef.current);
    debounceTimerRef.current = setTimeout(() => {
      debounceTimerRef.current = null;
      void saveChecklistToLocal(nextSimplePhotos, nextPostes, nextEmendas, nextPodas, nextSeccionamentos, nextAterramentos, nextHastes);
    }, 500);
  }, [saveChecklistToLocal]);

  const handleAddPoste = useCallback(() => {
    setChecklistPostes((prev) => {
      const updated = [...prev, createPoste(prev.length)];
      persistSnapshot(simplePhotos, updated, emendas, podas, seccionamentos, aterramentosCerca, hastesTermometro);
      return updated;
    });
  }, [aterramentosCerca, emendas, hastesTermometro, persistSnapshot, podas, seccionamentos, simplePhotos]);

  const handleRemovePoste = useCallback((posteId: string) => {
    setChecklistPostes((prev) => {
      const updated = prev.filter((poste) => poste.id !== posteId);
      persistSnapshot(simplePhotos, updated, emendas, podas, seccionamentos, aterramentosCerca, hastesTermometro);
      return updated;
    });
  }, [aterramentosCerca, emendas, hastesTermometro, persistSnapshot, podas, seccionamentos, simplePhotos]);

  const updatePoste = useCallback((posteId: string, updater: (prev: ChecklistPosteLocal) => ChecklistPosteLocal) => {
    setChecklistPostes((prev) => {
      const updated = prev.map((poste) => (poste.id === posteId ? updater(poste) : poste));
      persistSnapshot(simplePhotos, updated, emendas, podas, seccionamentos, aterramentosCerca, hastesTermometro);
      return updated;
    });
  }, [aterramentosCerca, emendas, hastesTermometro, persistSnapshot, podas, seccionamentos, simplePhotos]);

  const handleAddEmenda = useCallback(() => {
    setEmendas((prev) => {
      const updated = [...prev, createTrechoItem('E', prev.length)];
      persistSnapshot(simplePhotos, checklistPostes, updated, podas, seccionamentos, aterramentosCerca, hastesTermometro);
      return updated;
    });
  }, [aterramentosCerca, checklistPostes, hastesTermometro, persistSnapshot, podas, seccionamentos, simplePhotos]);

  const handleRemoveEmenda = useCallback((itemId: string) => {
    setEmendas((prev) => {
      const updated = prev.filter((item) => item.id !== itemId);
      persistSnapshot(simplePhotos, checklistPostes, updated, podas, seccionamentos, aterramentosCerca, hastesTermometro);
      return updated;
    });
  }, [aterramentosCerca, checklistPostes, hastesTermometro, persistSnapshot, podas, seccionamentos, simplePhotos]);

  const handleAddPoda = useCallback(() => {
    setPodas((prev) => {
      const updated = [...prev, createTrechoItem('PD', prev.length)];
      persistSnapshot(simplePhotos, checklistPostes, emendas, updated, seccionamentos, aterramentosCerca, hastesTermometro);
      return updated;
    });
  }, [aterramentosCerca, checklistPostes, emendas, hastesTermometro, persistSnapshot, seccionamentos, simplePhotos]);

  const handleRemovePoda = useCallback((itemId: string) => {
    setPodas((prev) => {
      const updated = prev.filter((item) => item.id !== itemId);
      persistSnapshot(simplePhotos, checklistPostes, emendas, updated, seccionamentos, aterramentosCerca, hastesTermometro);
      return updated;
    });
  }, [aterramentosCerca, checklistPostes, emendas, hastesTermometro, persistSnapshot, seccionamentos, simplePhotos]);

  const handleAddSeccionamento = useCallback(() => {
    setSeccionamentos((prev) => {
      const updated = [...prev, createReferenciaItem('SE', prev.length)];
      persistSnapshot(simplePhotos, checklistPostes, emendas, podas, updated, aterramentosCerca, hastesTermometro);
      return updated;
    });
  }, [aterramentosCerca, checklistPostes, emendas, hastesTermometro, persistSnapshot, podas, simplePhotos]);

  const handleRemoveSeccionamento = useCallback((itemId: string) => {
    setSeccionamentos((prev) => {
      const updated = prev.filter((item) => item.id !== itemId);
      persistSnapshot(simplePhotos, checklistPostes, emendas, podas, updated, aterramentosCerca, hastesTermometro);
      return updated;
    });
  }, [aterramentosCerca, checklistPostes, emendas, hastesTermometro, persistSnapshot, podas, simplePhotos]);

  const handleAddAterramento = useCallback(() => {
    setAterramentosCerca((prev) => {
      const updated = [...prev, createReferenciaItem('AC', prev.length)];
      persistSnapshot(simplePhotos, checklistPostes, emendas, podas, seccionamentos, updated, hastesTermometro);
      return updated;
    });
  }, [checklistPostes, emendas, hastesTermometro, persistSnapshot, podas, seccionamentos, simplePhotos]);

  const handleRemoveAterramento = useCallback((itemId: string) => {
    setAterramentosCerca((prev) => {
      const updated = prev.filter((item) => item.id !== itemId);
      persistSnapshot(simplePhotos, checklistPostes, emendas, podas, seccionamentos, updated, hastesTermometro);
      return updated;
    });
  }, [checklistPostes, emendas, hastesTermometro, persistSnapshot, podas, seccionamentos, simplePhotos]);

  const handleAddHaste = useCallback(() => {
    setHastesTermometro((prev) => {
      const updated = [...prev, createHasteItem(prev.length)];
      persistSnapshot(simplePhotos, checklistPostes, emendas, podas, seccionamentos, aterramentosCerca, updated);
      return updated;
    });
  }, [aterramentosCerca, checklistPostes, emendas, persistSnapshot, podas, seccionamentos, simplePhotos]);

  const handleRemoveHaste = useCallback((itemId: string) => {
    setHastesTermometro((prev) => {
      const updated = prev.filter((item) => item.id !== itemId);
      persistSnapshot(simplePhotos, checklistPostes, emendas, podas, seccionamentos, aterramentosCerca, updated);
      return updated;
    });
  }, [aterramentosCerca, checklistPostes, emendas, persistSnapshot, podas, seccionamentos, simplePhotos]);

  const updateTrechoItem = useCallback((
    tipo: 'emenda' | 'poda',
    itemId: string,
    updater: (prev: TrechoItemLocal) => TrechoItemLocal,
  ) => {
    const setter = tipo === 'emenda' ? setEmendas : setPodas;

    setter((prev) => {
      const updated = prev.map((item) => (item.id === itemId ? updater(item) : item));
      if (tipo === 'emenda') {
        persistSnapshot(simplePhotos, checklistPostes, updated, podas, seccionamentos, aterramentosCerca, hastesTermometro);
      } else {
        persistSnapshot(simplePhotos, checklistPostes, emendas, updated, seccionamentos, aterramentosCerca, hastesTermometro);
      }
      return updated;
    });
  }, [aterramentosCerca, checklistPostes, emendas, hastesTermometro, persistSnapshot, podas, seccionamentos, simplePhotos]);

  const updateReferenciaItem = useCallback((
    tipo: 'seccionamento' | 'aterramento',
    itemId: string,
    updater: (prev: ReferenciaItemLocal) => ReferenciaItemLocal,
  ) => {
    const setter = tipo === 'seccionamento' ? setSeccionamentos : setAterramentosCerca;

    setter((prev) => {
      const updated = prev.map((item) => (item.id === itemId ? updater(item) : item));
      if (tipo === 'seccionamento') {
        persistSnapshot(simplePhotos, checklistPostes, emendas, podas, updated, aterramentosCerca, hastesTermometro);
      } else {
        persistSnapshot(simplePhotos, checklistPostes, emendas, podas, seccionamentos, updated, hastesTermometro);
      }
      return updated;
    });
  }, [aterramentosCerca, checklistPostes, emendas, hastesTermometro, persistSnapshot, podas, seccionamentos, simplePhotos]);

  const updateHaste = useCallback((itemId: string, updater: (prev: HasteItemLocal) => HasteItemLocal) => {
    setHastesTermometro((prev) => {
      const updated = prev.map((item) => (item.id === itemId ? updater(item) : item));
      persistSnapshot(simplePhotos, checklistPostes, emendas, podas, seccionamentos, aterramentosCerca, updated);
      return updated;
    });
  }, [aterramentosCerca, checklistPostes, emendas, persistSnapshot, podas, seccionamentos, simplePhotos]);

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

  const savePhotoToTarget = useCallback(async (
    photoUri: string,
    coords: { latitude: number | null; longitude: number | null },
    source: 'camera' | 'gallery' = 'camera',
  ) => {
    const target = captureTarget;
    const current = servicoRef.current;
    if (!target || !current) return;

    const photoType = (() => {
      if (target.kind === 'simple') return SIMPLE_FIELD_TO_PHOTO_TYPE[target.field];
      if (target.kind === 'poste') {
        const byField: Record<ChecklistPostePhotoField, string> = {
          posteInteiro: 'checklist_poste_inteiro',
          descricao: 'checklist_poste_descricao',
          engaste: 'checklist_poste_engaste',
          conexao1: 'checklist_poste_conexao1',
          conexao2: 'checklist_poste_conexao2',
          maiorEsforco: 'checklist_poste_maior_esforco',
          menorEsforco: 'checklist_poste_menor_esforco',
        };
        return byField[target.field];
      }
      if (target.kind === 'emenda') return 'checklist_emenda';
      if (target.kind === 'poda') return 'checklist_poda';
      if (target.kind === 'seccionamento') return 'checklist_seccionamento';
      if (target.kind === 'aterramento') return 'checklist_aterramento_cerca';
      return target.field === 'fotoHaste' ? 'checklist_ponto_haste' : 'checklist_ponto_termometro';
    })();

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

    if (target.kind === 'simple') {
      setSimplePhotos((prev) => {
        const updated = { ...prev, [target.field]: [...(prev[target.field] || []), newFoto] };
        persistSnapshotNow(updated, checklistPostes, emendas, podas, seccionamentos, aterramentosCerca, hastesTermometro);
        return updated;
      });
      setCaptureTarget(null);
      return;
    }

    if (target.kind === 'poste') {
      setChecklistPostes((prev) => {
        const updated = prev.map((poste) => {
          if (poste.id !== target.posteId) return poste;
          return {
            ...poste,
            [target.field]: [...(poste[target.field] || []), newFoto],
          };
        });
        persistSnapshotNow(simplePhotos, updated, emendas, podas, seccionamentos, aterramentosCerca, hastesTermometro);
        return updated;
      });
      setCaptureTarget(null);
      return;
    }

    if (target.kind === 'emenda' || target.kind === 'poda') {
      const setter = target.kind === 'emenda' ? setEmendas : setPodas;
      setter((prev) => {
        const updated = prev.map((item) => (
          item.id === target.itemId
            ? { ...item, fotos: [...item.fotos, newFoto] }
            : item
        ));
        if (target.kind === 'emenda') {
          persistSnapshotNow(simplePhotos, checklistPostes, updated, podas, seccionamentos, aterramentosCerca, hastesTermometro);
        } else {
          persistSnapshotNow(simplePhotos, checklistPostes, emendas, updated, seccionamentos, aterramentosCerca, hastesTermometro);
        }
        return updated;
      });
      setCaptureTarget(null);
      return;
    }

    if (target.kind === 'seccionamento' || target.kind === 'aterramento') {
      const setter = target.kind === 'seccionamento' ? setSeccionamentos : setAterramentosCerca;
      setter((prev) => {
        const updated = prev.map((item) => (
          item.id === target.itemId
            ? { ...item, fotos: [...item.fotos, newFoto] }
            : item
        ));
        if (target.kind === 'seccionamento') {
          persistSnapshotNow(simplePhotos, checklistPostes, emendas, podas, updated, aterramentosCerca, hastesTermometro);
        } else {
          persistSnapshotNow(simplePhotos, checklistPostes, emendas, podas, seccionamentos, updated, hastesTermometro);
        }
        return updated;
      });
      setCaptureTarget(null);
      return;
    }

    if (target.kind === 'haste') {
      setHastesTermometro((prev) => {
        const updated = prev.map((item) => {
          if (item.id !== target.itemId) return item;
          return {
            ...item,
            [target.field]: [...item[target.field], newFoto],
          };
        });
        persistSnapshotNow(simplePhotos, checklistPostes, emendas, podas, seccionamentos, aterramentosCerca, updated);
        return updated;
      });
      setCaptureTarget(null);
    }
  }, [aterramentosCerca, captureTarget, checklistPostes, emendas, hastesTermometro, persistSnapshotNow, podas, seccionamentos, simplePhotos]);

  const captureFromCamera = async () => {
    setShowPhotoSource(false);
    if (!captureTarget) return;

    try {
      setCaptureLoading(true);
      const permission = await ImagePicker.requestCameraPermissionsAsync();
      if (!permission.granted) {
        Alert.alert('Permissão negada', 'Permita o acesso à câmera para tirar fotos.');
        return;
      }

      const locationPromise = getCurrentLocation();
      const result = await ImagePicker.launchCameraAsync({
        mediaTypes: ['images'],
        allowsEditing: false,
        quality: 0.85,
      });

      if (!result.canceled && result.assets[0]) {
        const coords = await locationPromise;
        if (coords.latitude === null || coords.longitude === null) {
          notifyPhotoSavedWithoutLocation();
        }
        await savePhotoToTarget(result.assets[0].uri, coords, 'camera');
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
      const permission = await ImagePicker.requestMediaLibraryPermissionsAsync();
      if (!permission.granted) {
        Alert.alert('Permissão negada', 'Permita o acesso à galeria para selecionar fotos.');
        return;
      }

      const locationPromise = getCurrentLocation();
      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ['images'],
        allowsEditing: false,
        quality: 0.85,
      });

      if (!result.canceled && result.assets[0]) {
        const coords = await locationPromise;
        if (coords.latitude === null || coords.longitude === null) {
          notifyPhotoSavedWithoutLocation();
        }
        await savePhotoToTarget(result.assets[0].uri, coords, 'gallery');
      }
    } catch {
      Alert.alert('Erro', 'Não foi possível selecionar a foto.');
    } finally {
      setCaptureLoading(false);
    }
  };

  const openViewer = (photoList: FotoInfo[], index: number) => {
    setViewerPhotos(photoList);
    setViewerIndex(index);
    setViewerUri(getPreferredPhotoUri(photoList[index]));
  };

  const validateChecklist = (): string[] => {
    const missing: string[] = [];

    const requiredSimple = [...SIMPLE_SECTIONS_TOP, ...SIMPLE_SECTIONS_MIDDLE, SIMPLE_SECTION_FINAL];
    for (const section of requiredSimple) {
      if (!simplePhotos[section.field] || simplePhotos[section.field].length === 0) {
        missing.push(section.label);
      }
    }

    if (checklistPostes.length === 0) {
      missing.push('Registros dos Postes: adicione pelo menos 1 poste');
    }

    checklistPostes.forEach((poste, index) => {
      const requiredFields = POSTE_FIELDS_BY_STATUS[poste.status];
      requiredFields.forEach((field) => {
        if ((poste[field.key] || []).length === 0) {
          missing.push(`Poste ${index + 1} (${field.label})`);
        }
      });
    });

    if (emendas.length === 0) missing.push('Emenda: adicione pelo menos 1 ponto');
    emendas.forEach((item, index) => {
      if (!item.numero.trim()) missing.push(`Emenda ${index + 1}: número`);
      if (!item.posteInicio.trim()) missing.push(`Emenda ${index + 1}: P inicial`);
      if (!item.posteFim.trim()) missing.push(`Emenda ${index + 1}: P final`);
      if (item.fotos.length === 0) missing.push(`Emenda ${index + 1}: foto`);
    });

    if (podas.length === 0) missing.push('Poda: adicione pelo menos 1 ponto');
    podas.forEach((item, index) => {
      if (!item.numero.trim()) missing.push(`Poda ${index + 1}: número`);
      if (!item.posteInicio.trim()) missing.push(`Poda ${index + 1}: P inicial`);
      if (!item.posteFim.trim()) missing.push(`Poda ${index + 1}: P final`);
      if (item.fotos.length === 0) missing.push(`Poda ${index + 1}: foto`);
    });

    if (seccionamentos.length === 0) missing.push('Seccionamento: adicione pelo menos 1 ponto');
    seccionamentos.forEach((item, index) => {
      if (!item.referencia.trim()) missing.push(`Seccionamento ${index + 1}: referência`);
      if (item.fotos.length === 0) missing.push(`Seccionamento ${index + 1}: foto`);
    });

    if (aterramentosCerca.length === 0) missing.push('Aterramento de Cerca: adicione pelo menos 1 ponto');
    aterramentosCerca.forEach((item, index) => {
      if (!item.referencia.trim()) missing.push(`Aterramento ${index + 1}: referência`);
      if (item.fotos.length === 0) missing.push(`Aterramento ${index + 1}: foto`);
    });

    if (hastesTermometro.length === 0) missing.push('Hastes e Medição: adicione pelo menos 1 ponto');
    hastesTermometro.forEach((item, index) => {
      if (!item.numero.trim()) missing.push(`Haste ${index + 1}: número`);
      if (item.fotoHaste.length === 0) missing.push(`Haste ${index + 1}: foto da haste aplicada`);
      if (item.fotoTermometro.length === 0) missing.push(`Haste ${index + 1}: foto da medição do terrômetro`);
    });

    return missing;
  };

  const triggerBackgroundSync = useCallback((updated: Awaited<ReturnType<typeof saveChecklistToLocal>>) => {
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
      const updated = await saveChecklistToLocal(simplePhotos, checklistPostes, emendas, podas, seccionamentos, aterramentosCerca, hastesTermometro);
      triggerBackgroundSync(updated);
      router.back();
    } catch {
      Alert.alert('Erro', 'Não foi possível salvar o serviço.');
    } finally {
      setCompleting(false);
    }
  };

  const handleBack = useCallback(async () => {
    if (completing) return;
    setCompleting(true);
    try {
      const updated = await saveChecklistToLocal(simplePhotos, checklistPostes, emendas, podas, seccionamentos, aterramentosCerca, hastesTermometro);
      triggerBackgroundSync(updated);
      router.back();
    } catch {
      Alert.alert('Erro', 'Não foi possível salvar o serviço.');
    } finally {
      setCompleting(false);
    }
  }, [
    aterramentosCerca,
    checklistPostes,
    completing,
    emendas,
    hastesTermometro,
    podas,
    router,
    saveChecklistToLocal,
    seccionamentos,
    simplePhotos,
    triggerBackgroundSync,
  ]);

  useEffect(() => {
    const sub = BackHandler.addEventListener('hardwareBackPress', () => {
      void handleBack();
      return true;
    });
    return () => sub.remove();
  }, [handleBack]);

  const totalPhotos = (
    Object.values(simplePhotos).reduce((sum, photos) => sum + photos.length, 0) +
    checklistPostes.reduce((sum, poste) => (
      sum +
      poste.posteInteiro.length +
      poste.descricao.length +
      poste.engaste.length +
      poste.conexao1.length +
      poste.conexao2.length +
      poste.maiorEsforco.length +
      poste.menorEsforco.length
    ), 0) +
    emendas.reduce((sum, item) => sum + item.fotos.length, 0) +
    podas.reduce((sum, item) => sum + item.fotos.length, 0) +
    seccionamentos.reduce((sum, item) => sum + item.fotos.length, 0) +
    aterramentosCerca.reduce((sum, item) => sum + item.fotos.length, 0) +
    hastesTermometro.reduce((sum, item) => sum + item.fotoHaste.length + item.fotoTermometro.length, 0)
  );
  const totalPontos =
    checklistPostes.length +
    emendas.length +
    podas.length +
    seccionamentos.length +
    aterramentosCerca.length +
    hastesTermometro.length;

  const isCompleto = servico?.status === 'completo';

  const renderPhotoStrip = (
    photos: FotoInfo[],
    onAdd: () => void,
  ) => (
    <View style={styles.photoRow}>
      {photos.map((photo, index) => {
        const displayUri = getPreferredPhotoUri(photo);
        if (!displayUri) return null;
        return (
          <TouchableOpacity key={index} onPress={() => openViewer(photos, index)} activeOpacity={0.8}>
            <Image source={{ uri: displayUri }} style={[styles.photoThumb, { width: thumbSize, height: thumbSize }]} resizeMode="cover" />
          </TouchableOpacity>
        );
      })}

      {!isCompleto && (
        <TouchableOpacity
          style={[
            styles.addPhotoBtn,
            { width: thumbSize, height: thumbSize },
            captureLoading && styles.addPhotoBtnDisabled,
          ]}
          onPress={onAdd}
          disabled={captureLoading}
          activeOpacity={0.8}
        >
          <Ionicons name="camera" size={22} color="#DC2626" />
          <Text style={styles.addPhotoBtnText}>Adicionar</Text>
        </TouchableOpacity>
      )}
    </View>
  );

  return (
    <SafeAreaView style={styles.safeArea} edges={['top', 'bottom']}>
      <StatusBar barStyle="dark-content" backgroundColor="#fff" />

      <View style={styles.header}>
        <TouchableOpacity style={styles.backButton} onPress={handleBack} activeOpacity={0.7}>
          <Ionicons name="arrow-back" size={20} color="#374151" />
          <Text style={styles.backButtonText}>Voltar</Text>
        </TouchableOpacity>

        <View style={styles.headerCenter}>
          <Text style={styles.headerTitle} numberOfLines={1}>Checklist de Fiscalização</Text>
          {servico && (
            <Text style={styles.headerSubtitle} numberOfLines={1}>
              Obra {(servico as any).obra_numero || servico.obra_id?.slice(0, 8)}
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

      <View style={[styles.actionBar, isCompact && styles.actionBarCompact]}>
        {!isCompleto && (
          <TouchableOpacity style={[styles.addPosteButton, isCompact && styles.addPosteButtonCompact]} onPress={handleAddPoste} activeOpacity={0.8}>
            <Ionicons name="add-circle" size={isCompact ? 18 : 20} color="#fff" />
            <Text style={[styles.addPosteButtonText, isCompact && styles.addPosteButtonTextCompact]}>Adicionar Poste</Text>
          </TouchableOpacity>
        )}
        <View style={[styles.counterBadge, isCompact && styles.counterBadgeCompact]}>
          <Text style={[styles.counterText, isCompact && styles.counterTextCompact]} numberOfLines={1}>
            {totalPontos} pontos · {totalPhotos} foto{totalPhotos !== 1 ? 's' : ''}
          </Text>
        </View>
      </View>

      <ScrollView style={styles.scroll} contentContainerStyle={styles.scrollContent}>
        {SIMPLE_SECTIONS_TOP.map((section) => (
          <View key={section.field} style={styles.sectionCard}>
            <View style={[styles.sectionHeader, isCompact && styles.sectionHeaderCompact]}>
              <Text style={styles.sectionTitle}>{section.label}</Text>
              <Text style={[styles.sectionCount, isCompact && styles.sectionCountCompact]}>{simplePhotos[section.field].length} foto{simplePhotos[section.field].length !== 1 ? 's' : ''}</Text>
            </View>
            {renderPhotoStrip(simplePhotos[section.field], () => {
              setCaptureTarget({ kind: 'simple', field: section.field });
              setShowPhotoSource(true);
            })}
          </View>
        ))}

        <View style={styles.sectionCard}>
          <View style={[styles.sectionHeaderBetween, isCompact && styles.sectionHeaderBetweenCompact]}>
            <View style={styles.sectionHeaderTextBlock}>
              <Text style={styles.sectionTitle}>Registros dos Postes</Text>
              <Text style={styles.sectionHint}>Status por poste: instalado, retirado ou existente</Text>
            </View>
            {!isCompleto && (
              <TouchableOpacity style={[styles.addTopButton, isCompact && styles.addTopButtonCompact]} onPress={handleAddPoste} activeOpacity={0.8}>
                <Ionicons name="add" size={isCompact ? 14 : 16} color="#fff" />
                <Text style={[styles.addTopButtonText, isCompact && styles.addTopButtonTextCompact]}>Adicionar</Text>
              </TouchableOpacity>
            )}
          </View>

          {checklistPostes.length === 0 && (
            <Text style={styles.emptySectionText}>Nenhum poste adicionado.</Text>
          )}

          {checklistPostes.map((poste, index) => {
            const fieldsForStatus = POSTE_FIELDS_BY_STATUS[poste.status];
            const postePhotoCount = fieldsForStatus.reduce((sum, field) => sum + (poste[field.key]?.length || 0), 0);
            const posteCompleto = fieldsForStatus.every((field) => (poste[field.key] || []).length > 0);

            return (
              <View key={poste.id} style={styles.itemCard}>
                <View style={[styles.itemHeaderRow, isCompact && styles.itemHeaderRowCompact]}>
                  <View style={[styles.itemHeaderLeft, isCompact && styles.itemHeaderLeftCompact]}>
                    <View style={[styles.itemStatusDot, posteCompleto ? styles.dotCompleto : styles.dotPendente]} />
                    <Text style={styles.itemTitle}>Poste {poste.numero || index + 1}</Text>
                    <View style={styles.itemCountBadge}>
                      <Text style={styles.itemCount}>{postePhotoCount} foto{postePhotoCount !== 1 ? 's' : ''}</Text>
                    </View>
                  </View>
                  {!isCompleto && (
                    <TouchableOpacity
                      style={[styles.removeButton, isCompact && styles.removeButtonCompact]}
                      onPress={() => handleRemovePoste(poste.id)}
                      activeOpacity={0.7}
                    >
                      <Ionicons name="trash-outline" size={16} color="#EF4444" />
                      <Text style={styles.removeButtonText}>Remover</Text>
                    </TouchableOpacity>
                  )}
                </View>

                <Text style={styles.fieldLabel}>Número do poste</Text>
                <TextInput
                  style={styles.textInput}
                  value={poste.numero}
                  onChangeText={(text) => updatePoste(poste.id, (prev) => ({ ...prev, numero: toNumericText(text) }))}
                  keyboardType="numeric"
                  placeholder="1"
                  placeholderTextColor="#9CA3AF"
                />

                <TouchableOpacity
                  style={[styles.checkboxRow, poste.isAditivo && styles.checkboxRowActive]}
                  onPress={() => updatePoste(poste.id, (prev) => ({ ...prev, isAditivo: !prev.isAditivo }))}
                  activeOpacity={0.8}
                >
                  <View style={[styles.checkboxSquare, poste.isAditivo && styles.checkboxSquareActive]}>
                    {poste.isAditivo && <Ionicons name="checkmark" size={12} color="#fff" />}
                  </View>
                  <Text style={[styles.checkboxLabel, poste.isAditivo && styles.checkboxLabelActive]}>
                    Poste aditivo
                  </Text>
                </TouchableOpacity>

                <View style={styles.statusRow}>
                  {(['instalado', 'retirado', 'existente'] as ChecklistPosteStatus[]).map((statusOption) => {
                    const active = poste.status === statusOption;
                    return (
                      <TouchableOpacity
                        key={statusOption}
                        style={[styles.statusChip, active && styles.statusChipActive]}
                        onPress={() => updatePoste(poste.id, (prev) => ({ ...prev, status: statusOption }))}
                        activeOpacity={0.8}
                      >
                        <Text style={[styles.statusChipText, active && styles.statusChipTextActive]}>
                          {statusOption === 'instalado' ? 'Instalado' : statusOption === 'retirado' ? 'Retirado' : 'Existente'}
                        </Text>
                      </TouchableOpacity>
                    );
                  })}
                </View>

                {fieldsForStatus.map((field) => (
                  <View key={field.key} style={styles.subSectionBlock}>
                    <View style={styles.subSectionHeader}>
                      <Text style={styles.subSectionTitle}>{field.label}</Text>
                      <Text style={styles.subSectionCount}>{poste[field.key].length}</Text>
                    </View>
                    {renderPhotoStrip(poste[field.key], () => {
                      setCaptureTarget({ kind: 'poste', posteId: poste.id, field: field.key });
                      setShowPhotoSource(true);
                    })}
                  </View>
                ))}
              </View>
            );
          })}
        </View>

        <View style={styles.sectionCard}>
          <View style={[styles.sectionHeaderBetween, isCompact && styles.sectionHeaderBetweenCompact]}>
            <View style={styles.sectionHeaderTextBlock}>
              <Text style={styles.sectionTitle}>Emenda</Text>
              <Text style={styles.sectionHint}>E+número entre P inicial e P final</Text>
            </View>
            {!isCompleto && (
              <TouchableOpacity style={[styles.addTopButton, isCompact && styles.addTopButtonCompact]} onPress={handleAddEmenda} activeOpacity={0.8}>
                <Ionicons name="add" size={isCompact ? 14 : 16} color="#fff" />
                <Text style={[styles.addTopButtonText, isCompact && styles.addTopButtonTextCompact]}>Adicionar</Text>
              </TouchableOpacity>
            )}
          </View>

          {emendas.length === 0 && <Text style={styles.emptySectionText}>Nenhuma emenda adicionada.</Text>}

          {emendas.map((item, index) => (
            <View key={item.id} style={styles.itemCard}>
              <View style={[styles.itemHeaderRow, isCompact && styles.itemHeaderRowCompact]}>
                <Text style={[styles.itemTitleInline, isCompact && styles.itemTitleInlineCompact]}>
                  E{item.numero || index + 1} entre P{item.posteInicio || '?'} - P{item.posteFim || '?'}
                </Text>
                {!isCompleto && (
                  <TouchableOpacity
                    style={[styles.removeButton, isCompact && styles.removeButtonCompact]}
                    onPress={() => handleRemoveEmenda(item.id)}
                    activeOpacity={0.7}
                  >
                    <Ionicons name="trash-outline" size={16} color="#EF4444" />
                    <Text style={styles.removeButtonText}>Remover</Text>
                  </TouchableOpacity>
                )}
              </View>

              <Text style={styles.fieldLabel}>Número da emenda</Text>
              <TextInput
                style={styles.textInput}
                value={item.numero}
                onChangeText={(text) => updateTrechoItem('emenda', item.id, (prev) => ({ ...prev, numero: toNumericText(text) }))}
                keyboardType="numeric"
                placeholder="1"
                placeholderTextColor="#9CA3AF"
              />

              <View style={styles.rowInputs}>
                <View style={styles.rowInputItem}>
                  <Text style={styles.fieldLabel}>P inicial</Text>
                  <TextInput
                    style={styles.textInput}
                    value={item.posteInicio}
                    onChangeText={(text) => updateTrechoItem('emenda', item.id, (prev) => ({ ...prev, posteInicio: toNumericText(text) }))}
                    keyboardType="numeric"
                    placeholder="1"
                    placeholderTextColor="#9CA3AF"
                  />
                </View>
                <View style={styles.rowInputItem}>
                  <Text style={styles.fieldLabel}>P final</Text>
                  <TextInput
                    style={styles.textInput}
                    value={item.posteFim}
                    onChangeText={(text) => updateTrechoItem('emenda', item.id, (prev) => ({ ...prev, posteFim: toNumericText(text) }))}
                    keyboardType="numeric"
                    placeholder="2"
                    placeholderTextColor="#9CA3AF"
                  />
                </View>
              </View>

              {renderPhotoStrip(item.fotos, () => {
                setCaptureTarget({ kind: 'emenda', itemId: item.id });
                setShowPhotoSource(true);
              })}
            </View>
          ))}
        </View>

        <View style={styles.sectionCard}>
          <View style={[styles.sectionHeaderBetween, isCompact && styles.sectionHeaderBetweenCompact]}>
            <View style={styles.sectionHeaderTextBlock}>
              <Text style={styles.sectionTitle}>Poda</Text>
              <Text style={styles.sectionHint}>PD+número entre P inicial e P final</Text>
            </View>
            {!isCompleto && (
              <TouchableOpacity style={[styles.addTopButton, isCompact && styles.addTopButtonCompact]} onPress={handleAddPoda} activeOpacity={0.8}>
                <Ionicons name="add" size={isCompact ? 14 : 16} color="#fff" />
                <Text style={[styles.addTopButtonText, isCompact && styles.addTopButtonTextCompact]}>Adicionar</Text>
              </TouchableOpacity>
            )}
          </View>

          {podas.length === 0 && <Text style={styles.emptySectionText}>Nenhuma poda adicionada.</Text>}

          {podas.map((item, index) => (
            <View key={item.id} style={styles.itemCard}>
              <View style={[styles.itemHeaderRow, isCompact && styles.itemHeaderRowCompact]}>
                <Text style={[styles.itemTitleInline, isCompact && styles.itemTitleInlineCompact]}>
                  PD{item.numero || index + 1} entre P{item.posteInicio || '?'} - P{item.posteFim || '?'}
                </Text>
                {!isCompleto && (
                  <TouchableOpacity
                    style={[styles.removeButton, isCompact && styles.removeButtonCompact]}
                    onPress={() => handleRemovePoda(item.id)}
                    activeOpacity={0.7}
                  >
                    <Ionicons name="trash-outline" size={16} color="#EF4444" />
                    <Text style={styles.removeButtonText}>Remover</Text>
                  </TouchableOpacity>
                )}
              </View>

              <Text style={styles.fieldLabel}>Número da poda</Text>
              <TextInput
                style={styles.textInput}
                value={item.numero}
                onChangeText={(text) => updateTrechoItem('poda', item.id, (prev) => ({ ...prev, numero: toNumericText(text) }))}
                keyboardType="numeric"
                placeholder="1"
                placeholderTextColor="#9CA3AF"
              />

              <View style={styles.rowInputs}>
                <View style={styles.rowInputItem}>
                  <Text style={styles.fieldLabel}>P inicial</Text>
                  <TextInput
                    style={styles.textInput}
                    value={item.posteInicio}
                    onChangeText={(text) => updateTrechoItem('poda', item.id, (prev) => ({ ...prev, posteInicio: toNumericText(text) }))}
                    keyboardType="numeric"
                    placeholder="1"
                    placeholderTextColor="#9CA3AF"
                  />
                </View>
                <View style={styles.rowInputItem}>
                  <Text style={styles.fieldLabel}>P final</Text>
                  <TextInput
                    style={styles.textInput}
                    value={item.posteFim}
                    onChangeText={(text) => updateTrechoItem('poda', item.id, (prev) => ({ ...prev, posteFim: toNumericText(text) }))}
                    keyboardType="numeric"
                    placeholder="2"
                    placeholderTextColor="#9CA3AF"
                  />
                </View>
              </View>

              {renderPhotoStrip(item.fotos, () => {
                setCaptureTarget({ kind: 'poda', itemId: item.id });
                setShowPhotoSource(true);
              })}
            </View>
          ))}
        </View>

        <View style={styles.sectionCard}>
          <View style={[styles.sectionHeaderBetween, isCompact && styles.sectionHeaderBetweenCompact]}>
            <View style={styles.sectionHeaderTextBlock}>
              <Text style={styles.sectionTitle}>Seccionamento</Text>
            </View>
            {!isCompleto && (
              <TouchableOpacity style={[styles.addTopButton, isCompact && styles.addTopButtonCompact]} onPress={handleAddSeccionamento} activeOpacity={0.8}>
                <Ionicons name="add" size={isCompact ? 14 : 16} color="#fff" />
                <Text style={[styles.addTopButtonText, isCompact && styles.addTopButtonTextCompact]}>Adicionar</Text>
              </TouchableOpacity>
            )}
          </View>

          {seccionamentos.length === 0 && <Text style={styles.emptySectionText}>Nenhum seccionamento adicionado.</Text>}

          {seccionamentos.map((item) => (
            <View key={item.id} style={styles.itemCard}>
              <View style={[styles.itemHeaderRow, isCompact && styles.itemHeaderRowCompact]}>
                <Text style={styles.itemTitle}>Seccionamento</Text>
                {!isCompleto && (
                  <TouchableOpacity
                    style={[styles.removeButton, isCompact && styles.removeButtonCompact]}
                    onPress={() => handleRemoveSeccionamento(item.id)}
                    activeOpacity={0.7}
                  >
                    <Ionicons name="trash-outline" size={16} color="#EF4444" />
                    <Text style={styles.removeButtonText}>Remover</Text>
                  </TouchableOpacity>
                )}
              </View>
              <Text style={styles.fieldLabel}>Referência do ponto</Text>
              <TextInput
                style={styles.textInput}
                value={item.referencia}
                onChangeText={(text) => updateReferenciaItem('seccionamento', item.id, (prev) => ({ ...prev, referencia: toNumericText(text) }))}
                keyboardType="numeric"
                placeholder="1"
                placeholderTextColor="#9CA3AF"
              />

              {renderPhotoStrip(item.fotos, () => {
                setCaptureTarget({ kind: 'seccionamento', itemId: item.id });
                setShowPhotoSource(true);
              })}
            </View>
          ))}
        </View>

        <View style={styles.sectionCard}>
          <View style={[styles.sectionHeaderBetween, isCompact && styles.sectionHeaderBetweenCompact]}>
            <View style={styles.sectionHeaderTextBlock}>
              <Text style={styles.sectionTitle}>Aterramento de Cerca</Text>
            </View>
            {!isCompleto && (
              <TouchableOpacity style={[styles.addTopButton, isCompact && styles.addTopButtonCompact]} onPress={handleAddAterramento} activeOpacity={0.8}>
                <Ionicons name="add" size={isCompact ? 14 : 16} color="#fff" />
                <Text style={[styles.addTopButtonText, isCompact && styles.addTopButtonTextCompact]}>Adicionar</Text>
              </TouchableOpacity>
            )}
          </View>

          {aterramentosCerca.length === 0 && <Text style={styles.emptySectionText}>Nenhum aterramento adicionado.</Text>}

          {aterramentosCerca.map((item) => (
            <View key={item.id} style={styles.itemCard}>
              <View style={[styles.itemHeaderRow, isCompact && styles.itemHeaderRowCompact]}>
                <Text style={styles.itemTitle}>Aterramento</Text>
                {!isCompleto && (
                  <TouchableOpacity
                    style={[styles.removeButton, isCompact && styles.removeButtonCompact]}
                    onPress={() => handleRemoveAterramento(item.id)}
                    activeOpacity={0.7}
                  >
                    <Ionicons name="trash-outline" size={16} color="#EF4444" />
                    <Text style={styles.removeButtonText}>Remover</Text>
                  </TouchableOpacity>
                )}
              </View>
              <Text style={styles.fieldLabel}>Referência do ponto</Text>
              <TextInput
                style={styles.textInput}
                value={item.referencia}
                onChangeText={(text) => updateReferenciaItem('aterramento', item.id, (prev) => ({ ...prev, referencia: toNumericText(text) }))}
                keyboardType="numeric"
                placeholder="1"
                placeholderTextColor="#9CA3AF"
              />

              {renderPhotoStrip(item.fotos, () => {
                setCaptureTarget({ kind: 'aterramento', itemId: item.id });
                setShowPhotoSource(true);
              })}
            </View>
          ))}
        </View>

        {SIMPLE_SECTIONS_MIDDLE.map((section) => (
          <View key={section.field} style={styles.sectionCard}>
            <View style={[styles.sectionHeader, isCompact && styles.sectionHeaderCompact]}>
              <Text style={styles.sectionTitle}>{section.label}</Text>
              <Text style={[styles.sectionCount, isCompact && styles.sectionCountCompact]}>{simplePhotos[section.field].length} foto{simplePhotos[section.field].length !== 1 ? 's' : ''}</Text>
            </View>
            {renderPhotoStrip(simplePhotos[section.field], () => {
              setCaptureTarget({ kind: 'simple', field: section.field });
              setShowPhotoSource(true);
            })}
          </View>
        ))}

        <View style={styles.sectionCard}>
          <View style={[styles.sectionHeaderBetween, isCompact && styles.sectionHeaderBetweenCompact]}>
            <View style={styles.sectionHeaderTextBlock}>
              <Text style={styles.sectionTitle}>Hastes Aplicadas e Medição do Terrômetro</Text>
              <Text style={styles.sectionHint}>Número do ponto, aditivo e duas evidências</Text>
            </View>
            {!isCompleto && (
              <TouchableOpacity style={[styles.addTopButton, isCompact && styles.addTopButtonCompact]} onPress={handleAddHaste} activeOpacity={0.8}>
                <Ionicons name="add" size={isCompact ? 14 : 16} color="#fff" />
                <Text style={[styles.addTopButtonText, isCompact && styles.addTopButtonTextCompact]}>Adicionar</Text>
              </TouchableOpacity>
            )}
          </View>

          {hastesTermometro.length === 0 && <Text style={styles.emptySectionText}>Nenhum ponto adicionado.</Text>}

          {hastesTermometro.map((item, index) => (
            <View key={item.id} style={styles.itemCard}>
              <View style={[styles.itemHeaderRow, isCompact && styles.itemHeaderRowCompact]}>
                <Text style={styles.itemTitle}>Ponto {index + 1}</Text>
                {!isCompleto && (
                  <TouchableOpacity
                    style={[styles.removeButton, isCompact && styles.removeButtonCompact]}
                    onPress={() => handleRemoveHaste(item.id)}
                    activeOpacity={0.7}
                  >
                    <Ionicons name="trash-outline" size={16} color="#EF4444" />
                    <Text style={styles.removeButtonText}>Remover</Text>
                  </TouchableOpacity>
                )}
              </View>

              <Text style={styles.fieldLabel}>Número do ponto</Text>
              <TextInput
                style={styles.textInput}
                value={item.numero}
                onChangeText={(text) => updateHaste(item.id, (prev) => ({ ...prev, numero: toNumericText(text) }))}
                keyboardType="numeric"
                placeholder="1"
                placeholderTextColor="#9CA3AF"
              />

              <TouchableOpacity
                style={[styles.checkboxRow, item.isAditivo && styles.checkboxRowActive]}
                onPress={() => updateHaste(item.id, (prev) => ({ ...prev, isAditivo: !prev.isAditivo }))}
                activeOpacity={0.8}
              >
                <View style={[styles.checkboxSquare, item.isAditivo && styles.checkboxSquareActive]}>
                  {item.isAditivo && <Ionicons name="checkmark" size={12} color="#fff" />}
                </View>
                <Text style={[styles.checkboxLabel, item.isAditivo && styles.checkboxLabelActive]}>
                  Ponto aditivo
                </Text>
              </TouchableOpacity>

              <View style={styles.subSectionBlock}>
                <View style={styles.subSectionHeader}>
                  <Text style={styles.subSectionTitle}>Haste Aplicada</Text>
                  <Text style={styles.subSectionCount}>{item.fotoHaste.length}</Text>
                </View>
                {renderPhotoStrip(item.fotoHaste, () => {
                  setCaptureTarget({ kind: 'haste', itemId: item.id, field: 'fotoHaste' });
                  setShowPhotoSource(true);
                })}
              </View>

              <View style={styles.subSectionBlock}>
                <View style={styles.subSectionHeader}>
                  <Text style={styles.subSectionTitle}>Medição do Terrômetro</Text>
                  <Text style={styles.subSectionCount}>{item.fotoTermometro.length}</Text>
                </View>
                {renderPhotoStrip(item.fotoTermometro, () => {
                  setCaptureTarget({ kind: 'haste', itemId: item.id, field: 'fotoTermometro' });
                  setShowPhotoSource(true);
                })}
              </View>
            </View>
          ))}
        </View>

        <View style={styles.sectionCard}>
          <View style={[styles.sectionHeader, isCompact && styles.sectionHeaderCompact]}>
            <Text style={styles.sectionTitle}>{SIMPLE_SECTION_FINAL.label}</Text>
            <Text style={[styles.sectionCount, isCompact && styles.sectionCountCompact]}>{simplePhotos[SIMPLE_SECTION_FINAL.field].length} foto{simplePhotos[SIMPLE_SECTION_FINAL.field].length !== 1 ? 's' : ''}</Text>
          </View>
          {renderPhotoStrip(simplePhotos[SIMPLE_SECTION_FINAL.field], () => {
            setCaptureTarget({ kind: 'simple', field: SIMPLE_SECTION_FINAL.field });
            setShowPhotoSource(true);
          })}
        </View>

        <View style={{ height: 40 }} />
      </ScrollView>

      {captureLoading && (
        <View style={styles.loadingOverlay}>
          <ActivityIndicator size="large" color="#fff" />
          <Text style={styles.loadingText}>Salvando foto...</Text>
        </View>
      )}

      {showPhotoSource && (
        <View style={styles.photoSourceOverlay}>
          <TouchableOpacity
            style={styles.photoSourceBackdrop}
            onPress={() => {
              setShowPhotoSource(false);
              setCaptureTarget(null);
            }}
            activeOpacity={1}
          />
          <View style={styles.photoSourceSheet}>
            <View style={styles.photoSourceHandle} />
            <Text style={styles.photoSourceTitle}>Como adicionar a foto?</Text>
            <TouchableOpacity style={styles.photoSourceBtn} onPress={captureFromCamera}>
              <Ionicons name="camera" size={38} color="#fff" />
              <Text style={styles.photoSourceBtnText}>TIRAR FOTO</Text>
            </TouchableOpacity>
            <TouchableOpacity style={[styles.photoSourceBtn, styles.photoSourceBtnGallery]} onPress={captureFromGallery}>
              <Ionicons name="images" size={38} color="#DC2626" />
              <Text style={[styles.photoSourceBtnText, styles.photoSourceBtnTextGallery]}>DA GALERIA</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={styles.photoSourceBtnCancel}
              onPress={() => {
                setShowPhotoSource(false);
                setCaptureTarget(null);
              }}
            >
              <Text style={styles.photoSourceBtnCancelText}>Cancelar</Text>
            </TouchableOpacity>
          </View>
        </View>
      )}

      <Modal visible={!!viewerUri} transparent animationType="fade" onRequestClose={() => setViewerUri(null)}>
        <View style={styles.viewerContainer}>
          <TouchableOpacity style={styles.viewerClose} onPress={() => setViewerUri(null)}>
            <Ionicons name="close-circle" size={40} color="#fff" />
          </TouchableOpacity>

          {viewerUri && <Image source={{ uri: viewerUri }} style={styles.viewerPhoto} resizeMode="contain" />}

          {viewerPhotos.length > 1 && (
            <View style={styles.viewerNav}>
              <TouchableOpacity
                style={[styles.viewerNavBtn, viewerIndex === 0 && styles.viewerNavBtnDisabled]}
                onPress={() => {
                  const prev = viewerIndex - 1;
                  if (prev >= 0) {
                    setViewerIndex(prev);
                    setViewerUri(getPreferredPhotoUri(viewerPhotos[prev]));
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
                    setViewerUri(getPreferredPhotoUri(viewerPhotos[next]));
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
    backgroundColor: '#F3F4F6',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderBottomWidth: 1,
    borderBottomColor: '#E5E7EB',
    backgroundColor: '#fff',
  },
  backButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 10,
    paddingVertical: 8,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: '#E5E7EB',
    backgroundColor: '#F9FAFB',
  },
  backButtonText: {
    color: '#1F2937',
    fontWeight: '600',
    fontSize: 15,
  },
  headerCenter: {
    flex: 1,
    alignItems: 'center',
    paddingHorizontal: 8,
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: '#111827',
  },
  headerSubtitle: {
    marginTop: 2,
    fontSize: 12,
    color: '#6B7280',
  },
  completeButton: {
    backgroundColor: '#DC2626',
    minHeight: 34,
    minWidth: 82,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 10,
    paddingHorizontal: 12,
  },
  completeButtonDisabled: {
    backgroundColor: '#FCA5A5',
  },
  completeButtonText: {
    color: '#fff',
    fontWeight: '700',
    fontSize: 13,
  },
  completedBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: '#FEE2E2',
    borderRadius: 999,
    paddingHorizontal: 10,
    paddingVertical: 6,
  },
  completedBadgeText: {
    color: '#DC2626',
    fontSize: 12,
    fontWeight: '700',
  },
  actionBar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: '#fff',
    borderBottomWidth: 1,
    borderBottomColor: '#E5E7EB',
    paddingHorizontal: 12,
    paddingVertical: 8,
    gap: 8,
  },
  actionBarCompact: {
    flexWrap: 'wrap',
  },
  addPosteButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: '#DC2626',
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 8,
  },
  addPosteButtonCompact: {
    paddingHorizontal: 10,
    paddingVertical: 7,
  },
  addPosteButtonText: {
    color: '#fff',
    fontSize: 13,
    fontWeight: '700',
  },
  addPosteButtonTextCompact: {
    fontSize: 12,
  },
  counterBadge: {
    backgroundColor: '#F3F4F6',
    borderRadius: 999,
    paddingHorizontal: 10,
    paddingVertical: 6,
    marginLeft: 'auto',
  },
  counterBadgeCompact: {
    width: '100%',
    marginLeft: 0,
    alignItems: 'center',
  },
  counterText: {
    fontSize: 12,
    color: '#6B7280',
    fontWeight: '600',
  },
  counterTextCompact: {
    fontSize: 11,
  },
  scroll: {
    flex: 1,
  },
  scrollContent: {
    padding: 16,
    paddingBottom: 32,
  },
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
  sectionHeaderCompact: {
    flexDirection: 'column',
    alignItems: 'flex-start',
    gap: 4,
  },
  sectionHeaderBetween: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 10,
    paddingHorizontal: 14,
    paddingVertical: 10,
    backgroundColor: '#F9FAFB',
    borderBottomWidth: 1,
    borderBottomColor: '#F3F4F6',
  },
  sectionHeaderBetweenCompact: {
    flexDirection: 'column',
    alignItems: 'stretch',
  },
  sectionHeaderTextBlock: {
    flex: 1,
    minWidth: 0,
  },
  sectionTitle: {
    fontSize: 13,
    fontWeight: '700',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    color: '#374151',
    flexShrink: 1,
  },
  sectionHint: {
    marginTop: 2,
    fontSize: 12,
    color: '#6B7280',
  },
  sectionCount: {
    fontSize: 12,
    color: '#6B7280',
    fontWeight: '600',
  },
  sectionCountCompact: {
    alignSelf: 'flex-end',
  },
  addTopButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: '#DC2626',
    borderRadius: 8,
    paddingHorizontal: 10,
    paddingVertical: 7,
  },
  addTopButtonCompact: {
    alignSelf: 'flex-end',
  },
  addTopButtonText: {
    color: '#fff',
    fontSize: 12,
    fontWeight: '700',
  },
  addTopButtonTextCompact: {
    fontSize: 11,
  },
  emptySectionText: {
    fontSize: 13,
    color: '#9CA3AF',
    fontStyle: 'italic',
    paddingHorizontal: 14,
    paddingVertical: 10,
  },
  itemCard: {
    margin: 10,
    backgroundColor: '#fff',
    borderRadius: 14,
    borderLeftWidth: 4,
    borderLeftColor: '#DC2626',
    shadowColor: '#000',
    shadowOpacity: 0.05,
    shadowRadius: 6,
    shadowOffset: { width: 0, height: 2 },
    elevation: 2,
    overflow: 'hidden',
  },
  itemHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderBottomWidth: 1,
    borderBottomColor: '#F3F4F6',
  },
  itemHeaderRowCompact: {
    flexWrap: 'wrap',
    rowGap: 8,
  },
  itemHeaderLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    flexShrink: 1,
  },
  itemHeaderLeftCompact: {
    width: '100%',
  },
  itemStatusDot: {
    width: 10,
    height: 10,
    borderRadius: 5,
  },
  dotCompleto: {
    backgroundColor: '#DC2626',
  },
  dotPendente: {
    backgroundColor: '#D1D5DB',
  },
  itemTitle: {
    fontSize: 14,
    color: '#111827',
    fontWeight: '700',
  },
  itemCountBadge: {
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 10,
    backgroundColor: '#F3F4F6',
  },
  itemCount: {
    fontSize: 11,
    color: '#6B7280',
    fontWeight: '500',
  },
  itemTitleInline: {
    fontSize: 14,
    color: '#111827',
    fontWeight: '700',
    flexShrink: 1,
    marginRight: 10,
  },
  itemTitleInlineCompact: {
    width: '100%',
    marginRight: 0,
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
  removeButtonCompact: {
    marginLeft: 'auto',
  },
  removeButtonText: {
    fontSize: 13,
    color: '#EF4444',
    fontWeight: '600',
  },
  fieldLabel: {
    fontSize: 12,
    color: '#4B5563',
    fontWeight: '600',
    paddingHorizontal: 14,
    marginTop: 8,
    marginBottom: 4,
  },
  textInput: {
    borderWidth: 1,
    borderColor: '#D1D5DB',
    borderRadius: 8,
    backgroundColor: '#F9FAFB',
    paddingHorizontal: 10,
    paddingVertical: 9,
    color: '#111827',
    fontSize: 15,
  },
  rowInputs: {
    flexDirection: 'row',
    gap: 8,
    paddingHorizontal: 14,
  },
  rowInputItem: {
    flex: 1,
  },
  checkboxRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: '#F9FAFB',
    borderBottomWidth: 1,
    borderBottomColor: '#F3F4F6',
    paddingHorizontal: 14,
    paddingVertical: 10,
    marginTop: 8,
  },
  checkboxRowActive: {
    borderColor: '#DC2626',
    backgroundColor: '#FEF2F2',
  },
  checkboxSquare: {
    width: 18,
    height: 18,
    borderRadius: 4,
    borderWidth: 1,
    borderColor: '#9CA3AF',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#fff',
  },
  checkboxSquareActive: {
    borderColor: '#DC2626',
    backgroundColor: '#DC2626',
  },
  checkboxLabel: {
    color: '#4B5563',
    fontSize: 13,
    fontWeight: '600',
  },
  checkboxLabelActive: {
    color: '#DC2626',
  },
  statusRow: {
    flexDirection: 'row',
    gap: 8,
    flexWrap: 'wrap',
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderBottomWidth: 1,
    borderBottomColor: '#F3F4F6',
  },
  statusChip: {
    borderWidth: 1,
    borderColor: '#D1D5DB',
    borderRadius: 999,
    paddingHorizontal: 10,
    paddingVertical: 6,
    backgroundColor: '#fff',
  },
  statusChipActive: {
    borderColor: '#DC2626',
    backgroundColor: '#FEE2E2',
  },
  statusChipText: {
    fontSize: 12,
    color: '#4B5563',
    fontWeight: '700',
  },
  statusChipTextActive: {
    color: '#DC2626',
  },
  subSectionBlock: {
    borderTopWidth: 1,
    borderTopColor: '#F3F4F6',
  },
  subSectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 14,
    paddingVertical: 8,
    backgroundColor: '#F9FAFB',
  },
  subSectionTitle: {
    fontSize: 13,
    fontWeight: '700',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    color: '#374151',
  },
  subSectionCount: {
    fontSize: 12,
    color: '#64748B',
    fontWeight: '700',
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
    color: '#DC2626',
    fontSize: 11,
    fontWeight: '600',
  },
  loadingOverlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(0,0,0,0.45)',
    justifyContent: 'center',
    alignItems: 'center',
    gap: 10,
  },
  loadingText: {
    color: '#fff',
    fontSize: 14,
    fontWeight: '600',
  },
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
  photoSourceBtnText: {
    color: '#fff',
    fontWeight: '800',
    fontSize: 13,
    letterSpacing: 0.4,
  },
  photoSourceBtnGallery: {
    backgroundColor: '#fff',
    borderWidth: 1,
    borderColor: '#FCA5A5',
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
  viewerContainer: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.92)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  viewerClose: {
    position: 'absolute',
    top: 52,
    right: 18,
    zIndex: 10,
  },
  viewerPhoto: {
    width: SCREEN_WIDTH,
    height: '80%',
  },
  viewerNav: {
    position: 'absolute',
    bottom: 48,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  viewerNavBtn: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: 'rgba(255,255,255,0.2)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  viewerNavBtnDisabled: {
    opacity: 0.35,
  },
  viewerCounter: {
    color: '#fff',
    fontWeight: '700',
    minWidth: 70,
    textAlign: 'center',
  },
});
