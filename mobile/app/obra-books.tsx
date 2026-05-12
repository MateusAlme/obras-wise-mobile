import { useEffect, useMemo, useState, useCallback, useRef } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, ScrollView, Alert, ActivityIndicator, LayoutAnimation, Platform, UIManager, Modal, Image, Animated, TextInput, KeyboardAvoidingView, Keyboard } from 'react-native';
import { useLocalSearchParams, useRouter, useFocusEffect } from 'expo-router';
import AsyncStorage from '@react-native-async-storage/async-storage';
import * as ImagePicker from 'expo-image-picker';
import * as Location from 'expo-location';
import NetInfo from '@react-native-community/netinfo';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { supabase } from '../lib/supabase';
import { ServiceCard, ServiceTypeSelector } from '../components/ServicosComponents';
import { SERVICO_PHOTO_MAP, type Servico, type TipoServico, type FotoInfo as ServicoFotoInfo } from '../types/servico';
import { appendPhotoToServicoLocal, createServico, fetchServicosForObra, getLocalServicos, markServicoComplete, saveServicoLocal, syncAllPendingServicos } from '../lib/servico-sync';
import { getPendingObras, getLocalObras, syncObra, syncAllPendingObras, checkInternetConnection, markObraFinalizada, type PendingObra } from '../lib/offline-sync';
import { backupPhoto, getPhotoMetadatasByIds, getPhotosByObraWithFallback, type PhotoMetadata } from '../lib/photo-backup';
import { processObraPhotos } from '../lib/photo-queue';
import { validateServicoCompletion } from '../lib/servico-rules';
import { logger } from '../utils/logger';
import {
  getAllowedServiceTypesForProfile,
  isObraVisibleForProfile,
  isServiceTypeAllowedForProfile,
  isAdminOrSupervisor,
} from '../lib/profile-rules';

type ObraListItem = {
  id: string;
  data: string;
  obra: string;
  responsavel: string;
  equipe: string;
  tipo_servico: string;
  created_at: string;
  updated_at?: string;
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
type PontoReferenciaDraft = {
  id: string;
  tipo: 'poste' | 'emenda' | 'poda' | 'seccionamento' | 'outro';
  identificador_item: string;
  referencia_poste_inicio: string;
  referencia_poste_fim: string;
  observacao: string;
};

type DadosAdicionaisDraft = {
  transformador_modo: 'instalado' | 'retirado' | 'ambos' | '';
  identificador_item: string;
  referencia_poste_inicio: string;
  referencia_poste_fim: string;
  observacao: string;
  pontos_referencia: PontoReferenciaDraft[];
};

const createEmptyPonto = (): PontoReferenciaDraft => ({
  id: `ponto-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
  tipo: 'poste',
  identificador_item: '',
  referencia_poste_inicio: '',
  referencia_poste_fim: '',
  observacao: '',
});

const createEmptyDadosAdicionais = (): DadosAdicionaisDraft => ({
  transformador_modo: '',
  identificador_item: '',
  referencia_poste_inicio: '',
  referencia_poste_fim: '',
  observacao: '',
  pontos_referencia: [],
});

const isChecklistServico = (tipoServico?: string) => tipoServico === 'Checklist de Fiscalização';
const isTransformadorServico = (tipoServico?: string) => tipoServico === 'Transformador';
const isMultiPointServico = (tipoServico?: string) =>
  tipoServico === 'Checklist de Fiscalização' ||
  tipoServico === 'Emenda' ||
  tipoServico === 'Cava em Rocha' ||
  tipoServico === 'Linha Viva';

const normalizeServiceTypeKey = (value?: string): string => {
  if (!value) return '';
  const base = value
    .replace(/ç/gi, 'c')
    .replace(/ã/gi, 'a')
    .replace(/á/gi, 'a')
    .replace(/é/gi, 'e')
    .replace(/ê/gi, 'e')
    .replace(/ó/gi, 'o')
    .replace(/ú/gi, 'u')
    .replace(/õ/gi, 'o')
    .replace(/í/gi, 'i');

  return base
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .trim()
    .toLowerCase();
};

const LEGACY_DETALHE_SERVICOS = new Set<string>([
  normalizeServiceTypeKey('Linha Viva'),
  normalizeServiceTypeKey('Cava em Rocha'),
  normalizeServiceTypeKey('Emenda'),
]);

const usesLegacyDetalheFlow = (tipoServico?: string, clientPk?: string | null): boolean => {
  // Serviços do novo sistema (client_pk com prefixo svc_) sempre usam o novo fluxo,
  // independente do tipo de serviço
  if (clientPk && String(clientPk).startsWith('svc_')) return false;

  const key = normalizeServiceTypeKey(tipoServico);
  if (!key) return false;
  if (LEGACY_DETALHE_SERVICOS.has(key)) return true;

  // Fallback tolerante para variações de escrita/codificação
  return (
    key.includes('cava em rocha') ||
    key.includes('linha viva') ||
    key.includes('book de aterramento') ||
    key.includes('fundacao especial') ||
    key.includes('emenda')
  );
};

const CODE_FIELDS = new Set(['identificador_item', 'referencia_poste_inicio', 'referencia_poste_fim']);
const BASE_REFERENCE_PREFIX_OPTIONS = ['P', 'SE'];
const BASE_IDENTIFIER_PREFIX_OPTIONS = ['P', 'E', 'PD', 'SE', 'CR'];

const getServicePrimaryPrefix = (tipoServico?: string): string => {
  switch (tipoServico) {
    case 'Emenda':
      return 'E';
    case 'Poda':
      return 'PD';
    case 'Cava em Rocha':
      return 'CR';
    case 'Checklist de Fiscalização':
    case 'Linha Viva':
      return 'P';
    case 'Transformador':
      return 'TR';
    default:
      return 'P';
  }
};

const getIdentifierPrefixOptions = (tipoServico?: string): string[] => {
  const primary = getServicePrimaryPrefix(tipoServico);
  return [primary, ...BASE_IDENTIFIER_PREFIX_OPTIONS.filter((option) => option !== primary)];
};

const normalizeCodeInput = (value: string): string => {
  return value
    .normalize('NFKC')
    .toUpperCase()
    .replace(/\s+/g, '')
    .replace(/[^A-Z0-9_-]/g, '');
};

const applyCodePrefix = (value: string, prefix: string): string => {
  const normalizedPrefix = normalizeCodeInput(prefix);
  const normalizedValue = normalizeCodeInput(value);
  if (!normalizedPrefix) return normalizedValue;
  if (!normalizedValue) return normalizedPrefix;
  const suffix = normalizedValue.replace(/^[A-Z]+[-_]?/, '');
  return suffix ? `${normalizedPrefix}${suffix}` : normalizedPrefix;
};

const toDadosAdicionaisDraft = (servico?: Servico | null): DadosAdicionaisDraft => {
  const dados = ((servico as any)?.dados_adicionais || {}) as any;
  const pontos = Array.isArray(dados.pontos_referencia) ? dados.pontos_referencia : [];

  return {
    transformador_modo: ['instalado', 'retirado', 'ambos'].includes(String(dados.transformador_modo || '').toLowerCase())
      ? String(dados.transformador_modo).toLowerCase() as any
      : '',
    identificador_item: dados.identificador_item || '',
    referencia_poste_inicio: dados.referencia_poste_inicio || '',
    referencia_poste_fim: dados.referencia_poste_fim || '',
    observacao: dados.observacao || '',
    pontos_referencia: pontos.map((p: any, index: number) => ({
      id: p.id || `ponto-${index}-${Date.now()}`,
      tipo: p.tipo || 'poste',
      identificador_item: p.identificador_item || '',
      referencia_poste_inicio: p.referencia_poste_inicio || '',
      referencia_poste_fim: p.referencia_poste_fim || '',
      observacao: p.observacao || '',
    })),
  };
};

const sanitizeDadosAdicionais = (draft: DadosAdicionaisDraft, tipoServico?: string) => {
  const base = {
    transformador_modo: draft.transformador_modo,
    identificador_item: draft.identificador_item.trim(),
    referencia_poste_inicio: draft.referencia_poste_inicio.trim(),
    referencia_poste_fim: draft.referencia_poste_fim.trim(),
    observacao: draft.observacao.trim(),
  } as Record<string, any>;

  if (isMultiPointServico(tipoServico)) {
    const pontos = draft.pontos_referencia
      .map((p) => ({
        id: p.id,
        tipo: p.tipo,
        identificador_item: p.identificador_item.trim(),
        referencia_poste_inicio: p.referencia_poste_inicio.trim(),
        referencia_poste_fim: p.referencia_poste_fim.trim(),
        observacao: p.observacao.trim(),
      }))
      .filter((p) => p.identificador_item || p.referencia_poste_inicio || p.referencia_poste_fim || p.observacao);

    if (pontos.length > 0) {
      base.pontos_referencia = pontos;
    }
  }

  return Object.fromEntries(
    Object.entries(base).filter(([, value]) => {
      if (Array.isArray(value)) return value.length > 0;
      return typeof value === 'string' ? value.length > 0 : !!value;
    })
  );
};

const isUuid = (value: string): boolean => {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(value);
};

const getLegacyValueScore = (value: unknown): number => {
  if (value === null || value === undefined) return 0;

  const isRenderableUri = (text: string): boolean =>
    text.startsWith('http://') ||
    text.startsWith('https://') ||
    text.startsWith('file://') ||
    text.startsWith('content://') ||
    text.startsWith('/');

  if (typeof value === 'string') {
    const trimmed = value.trim();
    if (!trimmed) return 0;
    // URL/URI vale mais que um ID textual simples.
    return isRenderableUri(trimmed) ? 10 : 1;
  }
  if (typeof value === 'number' || typeof value === 'boolean') return 1;

  if (Array.isArray(value)) {
    if (value.length === 0) return 0;
    return value.reduce<number>((acc, item) => acc + getLegacyValueScore(item), 0);
  }

  if (typeof value === 'object') {
    const obj = value as Record<string, unknown>;
    const urlValue = typeof obj.url === 'string' ? obj.url.trim() : '';
    const uriValue = typeof obj.uri === 'string' ? obj.uri.trim() : '';
    const idValue = typeof obj.id === 'string' ? obj.id.trim() : '';

    const hasUrl = !!urlValue && isRenderableUri(urlValue);
    const hasUri = !!uriValue && isRenderableUri(uriValue);

    // Para estruturas de foto, prioriza fortemente URL/URI renderizável.
    if (hasUrl || hasUri || idValue) {
      let score = 0;
      if (hasUrl) score += 30;
      if (hasUri) score += 20;
      if (idValue) score += 2;

      score += Object.entries(obj).reduce<number>((acc, [key, item]) => {
        if (key === 'url' || key === 'uri' || key === 'id') return acc;
        return acc + getLegacyValueScore(item);
      }, 0);

      return score;
    }

    return Object.values(obj).reduce<number>((acc, item) => acc + getLegacyValueScore(item), 0);
  }

  return 0;
};

const hasAnyLegacyRegistro = (source: Record<string, any> | null | undefined): boolean => {
  if (!source || typeof source !== 'object') return false;

  const structuredKeys = new Set([
    'postes_data',
    'checklist_postes_data',
    'checklist_seccionamentos_data',
    'checklist_aterramentos_cerca_data',
    'checklist_hastes_termometros_data',
  ]);

  for (const [key, value] of Object.entries(source)) {
    if (!Array.isArray(value) || value.length === 0) continue;
    if (structuredKeys.has(key)) return true;
    if (key.startsWith('fotos_') || key.startsWith('doc_')) return true;

    const hasMediaLike = value.some((item) => {
      if (typeof item === 'string') return item.trim().length > 0;
      if (!item || typeof item !== 'object') return false;
      const obj = item as Record<string, any>;
      return Boolean(obj.id || obj.url || obj.uri || obj.photoId);
    });
    if (hasMediaLike) return true;
  }

  const dadosAdicionais = (source as any).dados_adicionais;
  if (dadosAdicionais && typeof dadosAdicionais === 'object') {
    const hasDados =
      typeof dadosAdicionais.identificador_item === 'string' && dadosAdicionais.identificador_item.trim().length > 0 ||
      typeof dadosAdicionais.referencia_poste_inicio === 'string' && dadosAdicionais.referencia_poste_inicio.trim().length > 0 ||
      typeof dadosAdicionais.referencia_poste_fim === 'string' && dadosAdicionais.referencia_poste_fim.trim().length > 0 ||
      typeof dadosAdicionais.observacao === 'string' && dadosAdicionais.observacao.trim().length > 0 ||
      (Array.isArray(dadosAdicionais.pontos_referencia) && dadosAdicionais.pontos_referencia.length > 0);
    if (hasDados) return true;
  }

  return false;
};

const getLegacyRelevantKeysForTipo = (tipoServico?: string): Set<string> => {
  const keys = new Set<string>();
  if (tipoServico) {
    const mapped = SERVICO_PHOTO_MAP[tipoServico as TipoServico] || [];
    mapped.forEach((item) => keys.add(String(item.field)));
  }

  if (tipoServico === 'Transformador') {
    keys.add('doc_laudo_transformador');
    keys.add('transformador_status');
  }

  if (tipoServico === 'Checklist de Fiscalização') {
    keys.add('checklist_postes_data');
    keys.add('checklist_seccionamentos_data');
    keys.add('checklist_aterramentos_cerca_data');
    keys.add('checklist_hastes_termometros_data');
  }

  if (
    tipoServico === 'Linha Viva' ||
    tipoServico === 'Cava em Rocha' ||
    tipoServico === 'Book de Aterramento' ||
    tipoServico === 'Fundação Especial'
  ) {
    keys.add('postes_data');
  }

  keys.add('dados_adicionais');
  return keys;
};

const getLegacyObraScoreForServico = (obra: ObraListItem, servico: Servico): number => {
  const keys = getLegacyRelevantKeysForTipo(servico.tipo_servico);
  let score = 0;
  keys.forEach((key) => {
    score += getLegacyValueScore((obra as any)?.[key]);
  });

  if (String(obra.tipo_servico || '') === String(servico.tipo_servico || '')) {
    score += 20;
  }

  return score;
};

const buildScopedLegacyDataForServico = (servico: Servico, legacyObra?: ObraListItem | null): Record<string, any> => {
  const scoped: Record<string, any> = {};
  const keys = getLegacyRelevantKeysForTipo(servico.tipo_servico);

  const pickPreferredLegacyValue = (servicoValue: unknown, obraValue: unknown): unknown => {
    const servicoArray = Array.isArray(servicoValue) ? servicoValue : null;
    const obraArray = Array.isArray(obraValue) ? obraValue : null;

    // Em arrays (fotos/postes/checklists), prioriza completude para evitar "sumir foto" no formulário.
    if (servicoArray || obraArray) {
      const servicoLen = servicoArray?.length || 0;
      const obraLen = obraArray?.length || 0;
      if (servicoLen !== obraLen) {
        return servicoLen > obraLen ? servicoValue : obraValue;
      }
    }

    const servicoScore = getLegacyValueScore(servicoValue);
    const obraScore = getLegacyValueScore(obraValue);
    return servicoScore >= obraScore ? servicoValue : obraValue;
  };

  keys.forEach((key) => {
    const servicoValue = (servico as any)?.[key];
    const obraValue = (legacyObra as any)?.[key];
    scoped[key] = pickPreferredLegacyValue(servicoValue, obraValue);
  });

  scoped.tipo_servico = servico.tipo_servico;
  return scoped;
};

const shouldHydrateFromLegacyObra = (servico: Servico): boolean =>
  String(servico.id || '').startsWith('legacy-');

const isRenderableMediaUri = (value: string): boolean =>
  value.startsWith('http://') ||
  value.startsWith('https://') ||
  value.startsWith('file://') ||
  value.startsWith('content://') ||
  value.startsWith('/');

const belongsToServicoContext = (
  entry: unknown,
  servicoId: string,
  strictContextMatch = true
): boolean => {
  if (!servicoId) return true;

  if (typeof entry === 'string') {
    const text = entry.trim();
    if (!text) return false;
    if (!strictContextMatch) return true;
    if (isRenderableMediaUri(text)) return false;
    return text.startsWith(`${servicoId}_`) || text.startsWith('synced_');
  }

  if (entry && typeof entry === 'object') {
    const obj = entry as Record<string, any>;
    const idValue = typeof obj.id === 'string' ? obj.id.trim() : '';
    const urlValue = typeof obj.url === 'string' ? obj.url.trim() : '';
    const uriValue = typeof obj.uri === 'string' ? obj.uri.trim() : '';
    if (!strictContextMatch) return true;
    if (urlValue || uriValue) {
      if (!idValue) return false;
      return idValue.startsWith(`${servicoId}_`) || idValue.startsWith('synced_');
    }
    if (!idValue) return false;
    return idValue.startsWith(`${servicoId}_`) || idValue.startsWith('synced_');
  }

  return false;
};

const sanitizePostesDataForServico = (
  rawPostesData: unknown,
  servicoId: string,
  strictContextMatch = true
): any[] => {
  if (!Array.isArray(rawPostesData)) return [];

  const pickPostePhotoArray = (poste: any, keys: string[]): unknown[] => {
    let best: unknown[] = [];
    for (const key of keys) {
      const value = poste?.[key];
      if (!Array.isArray(value)) continue;
      if (value.length > best.length) {
        best = value;
      }
    }
    return best;
  };

  return rawPostesData.map((poste: any) => ({
    ...poste,
    fotos_antes: pickPostePhotoArray(poste, ['fotos_antes', 'fotosAntes']).filter(
      (item: unknown) => belongsToServicoContext(item, servicoId, strictContextMatch)
    ),
    fotos_durante: pickPostePhotoArray(poste, ['fotos_durante', 'fotosDurante']).filter(
      (item: unknown) => belongsToServicoContext(item, servicoId, strictContextMatch)
    ),
    fotos_depois: pickPostePhotoArray(poste, ['fotos_depois', 'fotosDepois']).filter(
      (item: unknown) => belongsToServicoContext(item, servicoId, strictContextMatch)
    ),
    fotos_medicao: pickPostePhotoArray(poste, ['fotos_medicao', 'fotosMedicao']).filter(
      (item: unknown) => belongsToServicoContext(item, servicoId, strictContextMatch)
    ),
  }));
};

const hasAnyPostePhotos = (postes: any[]): boolean => {
  return postes.some((poste: any) => {
    return (
      (Array.isArray(poste?.fotos_antes) && poste.fotos_antes.length > 0) ||
      (Array.isArray(poste?.fotos_durante) && poste.fotos_durante.length > 0) ||
      (Array.isArray(poste?.fotos_depois) && poste.fotos_depois.length > 0) ||
      (Array.isArray(poste?.fotos_medicao) && poste.fotos_medicao.length > 0)
    );
  });
};

const mapPhotoMetadataToInfo = (photo: PhotoMetadata): ServicoFotoInfo => ({
  id: photo.id,
  url: photo.supabaseUrl || photo.uploadUrl || undefined,
  uri: photo.compressedPath || photo.originalUri,
  latitude: photo.latitude ?? undefined,
  longitude: photo.longitude ?? undefined,
  utm_x: photo.utmX ?? undefined,
  utm_y: photo.utmY ?? undefined,
  utm_zone: photo.utmZone ?? undefined,
});

const normalizeLegacyPhotoEntries = (
  entries: unknown[] | undefined,
  metadataMap: Map<string, PhotoMetadata>
): ServicoFotoInfo[] => {
  if (!Array.isArray(entries) || entries.length === 0) {
    return [];
  }

  const normalized: ServicoFotoInfo[] = [];
  const seen = new Set<string>();

  const pushPhoto = (photo: ServicoFotoInfo | null | undefined, fallbackKey: string) => {
    if (!photo || (!photo.url && !photo.uri)) {
      return;
    }

    const key = photo.id || photo.url || photo.uri || fallbackKey;
    if (seen.has(key)) {
      return;
    }

    seen.add(key);
    normalized.push(photo);
  };

  entries.forEach((entry, index) => {
    if (!entry) {
      return;
    }

    if (typeof entry === 'string') {
      const metadata = metadataMap.get(entry);
      if (metadata) {
        pushPhoto(mapPhotoMetadataToInfo(metadata), `meta:${entry}`);
        return;
      }

      if (entry.startsWith('http')) {
        pushPhoto({ url: entry }, `url:${entry}`);
        return;
      }

      if (entry.startsWith('file://') || entry.startsWith('content://') || entry.startsWith('/')) {
        pushPhoto({ uri: entry }, `uri:${entry}`);
      }
      return;
    }

    if (typeof entry === 'object') {
      const photo = entry as ServicoFotoInfo;
      if (photo.id && metadataMap.has(photo.id)) {
        const metadataPhoto = mapPhotoMetadataToInfo(metadataMap.get(photo.id)!);
        pushPhoto({ ...metadataPhoto, ...photo, uri: photo.uri || metadataPhoto.uri }, `obj:${photo.id}`);
        return;
      }

      pushPhoto(photo, `obj:${index}`);
    }
  });

  return normalized;
};

const hydrateLegacyObras = async (items: ObraListItem[]): Promise<ObraListItem[]> => {
  return Promise.all(
    items.map(async (item) => {
      const rawEntries = [
        ...(Array.isArray(item.fotos_antes) ? item.fotos_antes : []),
        ...(Array.isArray(item.fotos_durante) ? item.fotos_durante : []),
        ...(Array.isArray(item.fotos_depois) ? item.fotos_depois : []),
      ];

      const photoIds = rawEntries.filter(
        (entry): entry is string =>
          typeof entry === 'string' &&
          !entry.startsWith('http') &&
          !entry.startsWith('file://') &&
          !entry.startsWith('content://') &&
          !entry.startsWith('/')
      );

      const localPhotos = await getPhotosByObraWithFallback(item.id, photoIds, item.serverId);
      const metadataMap = new Map(localPhotos.map((photo) => [photo.id, photo]));

      return {
        ...item,
        fotos_antes: normalizeLegacyPhotoEntries(item.fotos_antes, metadataMap),
        fotos_durante: normalizeLegacyPhotoEntries(item.fotos_durante, metadataMap),
        fotos_depois: normalizeLegacyPhotoEntries(item.fotos_depois, metadataMap),
      };
    })
  );
};

export default function ObraBooksPage() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const params = useLocalSearchParams<{ obraNumero?: string }>();
  const obraNumero = String(params.obraNumero || '').trim();

  const [loading, setLoading] = useState(true);
  const [syncingDraftId, setSyncingDraftId] = useState<string | null>(null);
  const [syncingAllDrafts, setSyncingAllDrafts] = useState(false);
  const [isOnline, setIsOnline] = useState(true);
  const [sessionRole, setSessionRole] = useState<string>('equipe');
  const [sessionEquipe, setSessionEquipe] = useState<string>('');
  const [obras, setObras] = useState<ObraListItem[]>([]);
  const [pendingDrafts, setPendingDrafts] = useState<PendingObra[]>([]);
  const [servicosPorItemId, setServicosPorItemId] = useState<Record<string, Servico[]>>({});
  const [expandedServicoId, setExpandedServicoId] = useState<string | null>(null);
  const [filter, setFilter] = useState<FilterType>('todos');
  const [serviceSelectorVisible, setServiceSelectorVisible] = useState(false);
  const [selectedObraIdForService, setSelectedObraIdForService] = useState<string | null>(null);
  const [creatingService, setCreatingService] = useState(false);
  const [equipePickerVisible, setEquipePickerVisible] = useState(false);
  const [equipeForService, setEquipeForService] = useState('');
  const [equipesDisponiveis, setEquipesDisponiveis] = useState<string[]>([]);
  const [equipePickerSearch, setEquipePickerSearch] = useState('');
  const [pendingNewServiceFocus, setPendingNewServiceFocus] = useState<{
    serviceId: string;
    createdAt: string;
    tipo: TipoServico;
    obraId: string;
    existingIds: string[];
    allowExistingFallback: boolean;
    retries: number;
  } | null>(null);
  const [createdServiceToast, setCreatedServiceToast] = useState<string | null>(null);
  const [recentlyCreatedServicoId, setRecentlyCreatedServicoId] = useState<string | null>(null);
  const [shouldScrollToEnd, setShouldScrollToEnd] = useState(false);
  const [captureLoading, setCaptureLoading] = useState(false);
  const [capturingPhotoForServico, setCapturingPhotoForServico] = useState<{
    servicoId: string;
    category: keyof Servico;
    obraId: string;
  } | null>(null);
  const [photoViewerUri, setPhotoViewerUri] = useState<string | null>(null);
  const [photoViewerScale, setPhotoViewerScale] = useState(1);
  const [dadosModalVisible, setDadosModalVisible] = useState(false);
  const [dadosModalSaving, setDadosModalSaving] = useState(false);
  const [dadosModalServico, setDadosModalServico] = useState<Servico | null>(null);
  const [dadosModalDraft, setDadosModalDraft] = useState<DadosAdicionaisDraft>(createEmptyDadosAdicionais());
  const [detailsKeyboardHeight, setDetailsKeyboardHeight] = useState(0);
  const [lastSyncTime, setLastSyncTime] = useState<number>(0);
  const skipNextFocusRefreshRef = useRef(true);
  const listScrollRef = useRef<ScrollView | null>(null);
  const createServiceLockRef = useRef(false);
  const onlineTransitionRef = useRef<boolean | null>(null);
  const createdToastOpacity = useRef(new Animated.Value(0)).current;

  // Animação de sucesso ao marcar completo
  const [successLabel, setSuccessLabel] = useState<string | null>(null);
  const successOpacity = useRef(new Animated.Value(0)).current;

  const showSuccessAnimation = useCallback((tipoServico: string) => {
    setSuccessLabel(tipoServico);
    successOpacity.setValue(0);
    Animated.sequence([
      Animated.timing(successOpacity, { toValue: 1, duration: 200, useNativeDriver: true }),
      Animated.delay(1600),
      Animated.timing(successOpacity, { toValue: 0, duration: 300, useNativeDriver: true }),
    ]).start(() => setSuccessLabel(null));
  }, [successOpacity]);

  const showCreatedServiceToast = useCallback((message: string) => {
    setCreatedServiceToast(message);
    createdToastOpacity.setValue(0);
    Animated.sequence([
      Animated.timing(createdToastOpacity, { toValue: 1, duration: 220, useNativeDriver: true }),
      Animated.delay(2200),
      Animated.timing(createdToastOpacity, { toValue: 0, duration: 260, useNativeDriver: true }),
    ]).start(() => setCreatedServiceToast(null));
  }, [createdToastOpacity]);

  const allowedServiceTypesForProfile = useMemo<TipoServico[] | undefined>(() => {
    return getAllowedServiceTypesForProfile(sessionRole, sessionEquipe);
  }, [sessionRole, sessionEquipe]);
  const isServiceTypeVisibleForProfile = useCallback((tipoServico?: string): boolean => {
    return isServiceTypeAllowedForProfile(tipoServico, sessionRole, sessionEquipe);
  }, [sessionRole, sessionEquipe]);

  useEffect(() => {
    if (Platform.OS === 'android' && UIManager.setLayoutAnimationEnabledExperimental) {
      UIManager.setLayoutAnimationEnabledExperimental(true);
    }
  }, []);

  // Solicitar permissão de localização silenciosamente (necessária para UTM nas fotos)
  useEffect(() => {
    Location.requestForegroundPermissionsAsync().catch(() => {});
  }, []);

  // Captura GPS silenciosa (última posição conhecida → fallback rápido com timeout)
  const getLocationSilent = async (): Promise<{ latitude: number | null; longitude: number | null }> => {
    try {
      const { status } = await Location.getForegroundPermissionsAsync();
      if (status !== 'granted') return { latitude: null, longitude: null };
      const last = await Location.getLastKnownPositionAsync({ maxAge: 5 * 60 * 1000, requiredAccuracy: 150 });
      if (last?.coords?.latitude && last?.coords?.longitude) {
        return { latitude: last.coords.latitude, longitude: last.coords.longitude };
      }
      const pos = await Promise.race([
        Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.Balanced }),
        new Promise<never>((_, reject) => setTimeout(() => reject(new Error('timeout')), 3500)),
      ]);
      return { latitude: (pos as any).coords.latitude, longitude: (pos as any).coords.longitude };
    } catch {
      return { latitude: null, longitude: null };
    }
  };

  useEffect(() => {
    const showEvent = Platform.OS === 'ios' ? 'keyboardWillShow' : 'keyboardDidShow';
    const hideEvent = Platform.OS === 'ios' ? 'keyboardWillHide' : 'keyboardDidHide';

    const showSub = Keyboard.addListener(showEvent, (event) => {
      setDetailsKeyboardHeight(event?.endCoordinates?.height || 0);
    });
    const hideSub = Keyboard.addListener(hideEvent, () => {
      setDetailsKeyboardHeight(0);
    });

    return () => {
      showSub.remove();
      hideSub.remove();
    };
  }, []);

  const getSyncedObraId = (obra: ObraListItem) => obra.serverId || (isUuid(obra.id) ? obra.id : null);

  const loadServicosForItems = async (items: ObraListItem[]) => {
    const entries = await Promise.all(
      items.map(async (item) => {
        // Prioriza UUID/serverId para evitar abrir versão stale salva no ID local antigo.
        const targetIds = Array.from(new Set([item.serverId, item.id].filter(Boolean) as string[]));
        if (targetIds.length === 0) return [item.id, [] as Servico[]] as const;

        const list = await Promise.all(targetIds.map((targetId) => fetchServicosForObra(targetId)));
        const merged = list.flat().filter((servico, index, arr) => arr.findIndex((s) => s.id === servico.id) === index);

        return [item.id, merged] as const;
      })
    );

    setServicosPorItemId(Object.fromEntries(entries));
  };

  const loadData = useCallback(async (options?: { showSpinner?: boolean }) => {
    const showSpinner = options?.showSpinner ?? true;
    if (!obraNumero) {
      if (showSpinner) {
        setLoading(false);
      }
      return;
    }

    if (showSpinner) {
      setLoading(true);
    }
    try {
      const [equipe, role, pending, localObras] = await Promise.all([
        AsyncStorage.getItem('@equipe_logada'),
        AsyncStorage.getItem('@user_role'),
        getPendingObras(),
        getLocalObras(),
      ]);

      const userRole = role || 'equipe';
      const isAdmin = isAdminOrSupervisor(userRole);
      setSessionRole(userRole);
      setSessionEquipe(equipe || '');

      if (isAdmin) {
        try {
          const cached = await AsyncStorage.getItem('@equipes_cache');
          if (cached) setEquipesDisponiveis(JSON.parse(cached));
          const { data: equipesData } = await supabase
            .from('equipe_credenciais')
            .select('equipe_codigo')
            .eq('ativo', true);
          if (equipesData && equipesData.length > 0) {
            const lista = Array.from(new Set(
              equipesData.map((x: any) => String(x.equipe_codigo || '').trim()).filter(Boolean)
            )).sort() as string[];
            setEquipesDisponiveis(lista);
            await AsyncStorage.setItem('@equipes_cache', JSON.stringify(lista));
          }
        } catch { /* usa cache */ }
      }

      const pendingFiltered: ObraListItem[] = pending
        .filter((obra) => {
          if (String(obra.obra || '').trim() !== obraNumero) return false;
          if (!isAdmin && (!equipe || obra.equipe !== equipe)) return false;
          return isObraVisibleForProfile(obra as any, userRole, equipe);
        })
        .map((obra) => ({ ...obra, origem: 'offline' as const }));

      const pendingDraftsFiltered = pending.filter((obra) => {
        if (String(obra.obra || '').trim() !== obraNumero) return false;
        if (!isAdmin && (!equipe || obra.equipe !== equipe)) return false;
        return isObraVisibleForProfile(obra as any, userRole, equipe);
      });

      setPendingDrafts(pendingDraftsFiltered);

      const localFiltered: ObraListItem[] = (localObras || [])
        .filter((obra) => {
          if (String(obra.obra || '').trim() !== obraNumero) return false;
          if (!isAdmin && (!equipe || obra.equipe !== equipe)) return false;
          return isObraVisibleForProfile(obra as any, userRole, equipe);
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
              return isObraVisibleForProfile(obra as any, userRole, equipe);
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
          // Rascunho sem UUID real -> deduplica pelo id local
          return arr.findIndex((x) => x.id === item.id) === index;
        }
        // Tem UUID real -> mantem apenas a primeira ocorrencia desse UUID
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

      const hydrated = await hydrateLegacyObras(deduped);
      setObras(hydrated);
      await loadServicosForItems(hydrated);
    } catch (error) {
      console.error('Erro ao carregar books da obra:', error);
      Alert.alert('Erro', 'Não foi possível carregar os books desta obra.');
    } finally {
      if (showSpinner) {
        setLoading(false);
      }
    }
  }, [obraNumero, isOnline]);

  useEffect(() => {
    loadData({ showSpinner: true });
  }, [loadData]);

  // Recarrega serviços ao voltar de servico-detalhe (fotos adicionadas lá aparecem aqui)

  useFocusEffect(
    useCallback(() => {
      if (skipNextFocusRefreshRef.current) {
        skipNextFocusRefreshRef.current = false;
        return;
      }

      loadData({ showSpinner: false });
    }, [loadData])
  );

  useEffect(() => {
    let mounted = true;

    checkInternetConnection().then((online) => {
      if (mounted) setIsOnline(online);
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

  const allServicos = useMemo(() => {
    const servicosDb = obras.flatMap((item) => servicosPorItemId[item.id] || []);

    const legacyServicos = obras.map((item) => ({
      ...(item as any),
      id: `legacy-${item.id}-servico`,
      obra_id: item.id,
      legacy_origin_id: String(item.id || ''),
      legacy_server_id: String((item as any).serverId || ''),
      tipo_servico: (item.tipo_servico || 'Documentacao') as TipoServico,
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

    // Hidratacao de snapshots legados no servico real.
    // Faz match exato por servico.id e fallback por escopo/tipo para cobrir casos
    // em que o servico troca de temp-id para UUID apos sync.
    const legacySnapshots = obras.filter((item) => hasAnyLegacyRegistro(item as any));
    const scopedLegacyByServicoId = legacySnapshots.reduce<Map<string, ObraListItem>>((acc, item) => {
      const id = String(item.id || '').trim();
      const serverId = String((item as any).serverId || '').trim();
      if (id) acc.set(id, item);
      if (serverId) acc.set(serverId, item);
      return acc;
    }, new Map<string, ObraListItem>());
    const consumedLegacyOriginIds = new Set<string>();

    const isLegacySnapshotInServicoScope = (snapshot: ObraListItem, servico: Servico): boolean => {
      const snapshotId = String(snapshot.id || '').trim();
      const snapshotServerId = String((snapshot as any).serverId || '').trim();
      const snapshotObraNumero = String(snapshot.obra || '').trim();

      const servicoId = String(servico.id || '').trim();
      const servicoObraId = String(servico.obra_id || '').trim();
      const servicoObraNumero = String(servico.obra_numero || obraNumero || '').trim();

      if (snapshotId && servicoId && snapshotId === servicoId) return true;
      if (snapshotServerId && servicoObraId && snapshotServerId === servicoObraId) return true;
      if (snapshotId && servicoObraId && snapshotId === servicoObraId) return true;
      if (snapshotObraNumero && servicoObraNumero && snapshotObraNumero === servicoObraNumero) return true;
      return false;
    };

    const pickBestLegacySnapshotForServico = (servico: Servico): ObraListItem | null => {
      const exact = scopedLegacyByServicoId.get(String(servico.id || ''));
      if (exact) return exact;

      const tipoNorm = normalizeServiceTypeKey(servico.tipo_servico);
      const candidates = legacySnapshots.filter((snapshot) => {
        const snapshotId = String(snapshot.id || '').trim();
        if (snapshotId && consumedLegacyOriginIds.has(snapshotId)) return false;
        if (normalizeServiceTypeKey(String(snapshot.tipo_servico || '')) !== tipoNorm) return false;
        return isLegacySnapshotInServicoScope(snapshot, servico);
      });

      if (candidates.length === 0) return null;

      return candidates.sort((a, b) => {
        const servicoCreated = new Date(servico.created_at || 0).getTime();
        const diffA = Math.abs(new Date(a.created_at || 0).getTime() - servicoCreated);
        const diffB = Math.abs(new Date(b.created_at || 0).getTime() - servicoCreated);
        if (diffA !== diffB) return diffA - diffB;
        return getLegacyObraScoreForServico(b, servico) - getLegacyObraScoreForServico(a, servico);
      })[0];
    };

    const dbHydrated = dbUnique.map((servico) => {
      if (!usesLegacyDetalheFlow(servico.tipo_servico, (servico as any).client_pk)) {
        return servico;
      }

      // Serviços criados pelo novo sistema têm client_pk com prefixo 'svc_' (generateClientPk).
      // Esses são serviços independentes — nunca devem ser hidratados com dados de obras legadas,
      // pois não são migrações do sistema antigo.
      const clientPk = String((servico as any).client_pk || '').trim();
      if (clientPk.startsWith('svc_')) {
        return servico;
      }

      const scopedSnapshot = pickBestLegacySnapshotForServico(servico);
      if (!scopedSnapshot) {
        return servico;
      }

      const scopedData = buildScopedLegacyDataForServico(servico, scopedSnapshot);
      if (!hasAnyLegacyRegistro(scopedData)) {
        return servico;
      }

      const snapshotId = String(scopedSnapshot.id || '').trim();
      if (snapshotId) consumedLegacyOriginIds.add(snapshotId);

      return {
        ...servico,
        ...scopedData,
      };
    });

    const hasRealServicoForLegacy = (legacyServico: Servico) => {
      const legacyTipo = normalizeServiceTypeKey(legacyServico.tipo_servico);
      const legacyOriginId = String((legacyServico as any).legacy_origin_id || '').trim()
        || (String((legacyServico as any).id || '').match(/^legacy-(.+)-servico$/)?.[1] || '');
      const legacyObraId = String(legacyServico.obra_id || '').trim();
      const legacyServerId = String((legacyServico as any).legacy_server_id || (legacyServico as any).serverId || '').trim();
      const legacyObraNumero = String((legacyServico as any).obra || '').trim();

      if (legacyOriginId && consumedLegacyOriginIds.has(legacyOriginId)) {
        return true;
      }

      return dbHydrated.some((realServico) => {
        const realTipo = normalizeServiceTypeKey(realServico.tipo_servico);
        if (realTipo !== legacyTipo) return false;

        const realServicoId = String(realServico.id || '').trim();
        const realObraId = String(realServico.obra_id || '').trim();
        const realObraNumero = String(realServico.obra_numero || obraNumero || '').trim();

        if (legacyOriginId && realServicoId && legacyOriginId === realServicoId) return true;
        if (legacyObraId && realObraId && legacyObraId === realObraId) return true;
        if (legacyServerId && realObraId && legacyServerId === realObraId) return true;
        if (legacyObraNumero && realObraNumero && legacyObraNumero === realObraNumero) return true;
        return false;
      });
    };

    const legacyUnique = legacyServicos
      .filter((servico, index, lista) => {
        return lista.findIndex((x) => x.id === servico.id) === index;
      })
      .filter((servico) => !hasRealServicoForLegacy(servico));

    const merged = [...legacyUnique, ...dbHydrated]
      .filter((servico) => isServiceTypeVisibleForProfile(servico.tipo_servico));

    return merged.sort((a, b) => {
      const ta = new Date(a.created_at || 0).getTime();
      const tb = new Date(b.created_at || 0).getTime();
      return ta - tb;
    });
  }, [obras, servicosPorItemId, obraNumero, isServiceTypeVisibleForProfile]);

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

  // Conta serviços reais (não-legacy) com sync pendente
  const pendingServicosCount = useMemo(() => {
    return allServicos.filter((s) => {
      if (s.id.startsWith('legacy-')) return false;
      const status = (s as any).sync_status;
      return status === 'offline' || status === 'pending' || status === 'error';
    }).length;
  }, [allServicos]);

  const totalPendingCount = pendingDrafts.length + pendingServicosCount;

  const getTargetObraForNewService = useCallback(() => {
    const sorted = [...obras].sort((a, b) => {
      const countA = servicosPorItemId[a.id]?.length || 0;
      const countB = servicosPorItemId[b.id]?.length || 0;
      if (countA !== countB) return countB - countA;
      return new Date(b.created_at || 0).getTime() - new Date(a.created_at || 0).getTime();
    });

    const synced = sorted.find((obra) => !!getSyncedObraId(obra));
    if (synced) return synced;
    return sorted[0] || null;
  }, [obras, servicosPorItemId]);

  const handleStartAddService = () => {
    const target = getTargetObraForNewService();
    if (!target) {
      Alert.alert('Sem book disponível', 'Não há book disponível para adicionar serviço.');
      return;
    }

    const targetObraId = getSyncedObraId(target) || target.id;
    setSelectedObraIdForService(targetObraId);

    if (isAdminOrSupervisor(sessionRole)) {
      setEquipeForService('');
      setEquipePickerVisible(true);
    } else {
      setServiceSelectorVisible(true);
    }
  };

  const handleCreateService = async (tipo: TipoServico) => {
    if (creatingService || createServiceLockRef.current) return;
    if (allowedServiceTypesForProfile && !allowedServiceTypesForProfile.includes(tipo)) {
      Alert.alert('Serviço não permitido', `Este perfil só pode criar: ${allowedServiceTypesForProfile.join(', ')}`);
      return;
    }
    createServiceLockRef.current = true;
    const fallbackTarget = getTargetObraForNewService();
    const targetObraId = selectedObraIdForService || getSyncedObraId(fallbackTarget as any) || fallbackTarget?.id || null;
    if (!targetObraId) {
      Alert.alert('Erro', 'Não foi possível identificar a obra para criar o serviço.');
      createServiceLockRef.current = false;
      return;
    }

    setCreatingService(true);
    try {
      const targetObra =
        obras.find((item) => item.id === targetObraId || item.serverId === targetObraId) || fallbackTarget || null;
      const existingSameTypeIds = allServicos
        .filter(
          (s) =>
            s.tipo_servico === tipo &&
            (s.obra_id === targetObraId || s.obra_numero === obraNumero)
        )
        .map((s) => s.id);

      const servicoEquipe = isAdminOrSupervisor(sessionRole) ? equipeForService : sessionEquipe;
      const result = await createServico(targetObraId, tipo, targetObra?.responsavel, obraNumero, servicoEquipe || undefined);
      if (!result.success || !result.servico) {
        Alert.alert('Erro', result.error || 'Não foi possível criar o serviço.');
        return;
      }

      const syncErrorText = String(result.syncError || '');
      const duplicateConflict = /duplicate key|unique constraint|already exists|violates unique/i.test(syncErrorText);

      setFilter('todos');
      setPendingNewServiceFocus({
        serviceId: result.servico.id,
        createdAt: result.servico.created_at,
        tipo,
        obraId: targetObraId,
        existingIds: existingSameTypeIds,
        allowExistingFallback: duplicateConflict,
        retries: 0,
      });
      setServiceSelectorVisible(false);
      setSelectedObraIdForService(null);

      await loadData({ showSpinner: false });
    } finally {
      setCreatingService(false);
      createServiceLockRef.current = false;
    }
  };

  const findCreatedServiceCandidate = useCallback((pending: NonNullable<typeof pendingNewServiceFocus>) => {
    const sameScope = allServicos.filter(
      (s) =>
        s.tipo_servico === pending.tipo &&
        (s.obra_id === pending.obraId || s.obra_numero === obraNumero)
    );
    if (sameScope.length === 0) return null;

    const byId = sameScope.find((s) => s.id === pending.serviceId);
    if (byId) return byId;

    const minCreatedAt = new Date(pending.createdAt || 0).getTime() - 60000;
    const newlyAdded = sameScope
      .filter((s) => !pending.existingIds.includes(s.id))
      .sort((a, b) => new Date(b.created_at || 0).getTime() - new Date(a.created_at || 0).getTime())
      .find((s) => new Date(s.created_at || 0).getTime() >= minCreatedAt);
    if (newlyAdded) return newlyAdded;

    if (!pending.allowExistingFallback) return null;

    return [...sameScope].sort(
      (a, b) =>
        new Date(b.updated_at || b.created_at || 0).getTime() -
        new Date(a.updated_at || a.created_at || 0).getTime()
    )[0] || null;
  }, [allServicos, obraNumero]);

  useEffect(() => {
    if (!pendingNewServiceFocus || allServicos.length === 0) return;

    const created = findCreatedServiceCandidate(pendingNewServiceFocus);
    if (!created) return;

    const reusedExisting = pendingNewServiceFocus.existingIds.includes(created.id);
    LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
    setExpandedServicoId(created.id);
    setShouldScrollToEnd(true);
    setRecentlyCreatedServicoId(reusedExisting ? null : created.id);
    setPendingNewServiceFocus(null);
    showCreatedServiceToast(
      reusedExisting
        ? `Servico ja existente aberto: ${created.tipo_servico}`
        : `Novo servico aberto: ${created.tipo_servico}`
    );

    if (reusedExisting) return;
    const timer = setTimeout(() => setRecentlyCreatedServicoId(null), 4200);
    return () => clearTimeout(timer);
  }, [findCreatedServiceCandidate, pendingNewServiceFocus, showCreatedServiceToast]);

  useEffect(() => {
    if (!pendingNewServiceFocus) return;

    const timer = setTimeout(async () => {
      const found = !!findCreatedServiceCandidate(pendingNewServiceFocus);
      if (found) return;

      if (pendingNewServiceFocus.retries >= 2) {
        setPendingNewServiceFocus(null);
        Alert.alert(
          'Criação pendente',
          'O serviço foi solicitado, mas ainda não apareceu na lista. Verifique conexão e tente novamente.'
        );
        return;
      }

      setPendingNewServiceFocus((prev) => (
        prev ? { ...prev, retries: prev.retries + 1 } : prev
      ));
      await loadData({ showSpinner: false });
    }, 1200);

    return () => clearTimeout(timer);
  }, [findCreatedServiceCandidate, loadData, pendingNewServiceFocus]);

  const handleMarkServiceComplete = async (servico: Servico) => {
    // Serviços com postes (Cava em Rocha, Linha Viva, etc.) → redireciona para a tela de postes
    if (SERVICOS_COM_POSTES_SCREEN.has(servico.tipo_servico) && !usesLegacyDetalheFlow(servico.tipo_servico, (servico as any).client_pk)) {
      void openPostesRegistro(servico);
      return;
    }
    // Transformador → tela dedicada
    if (servico.tipo_servico === 'Transformador' && !usesLegacyDetalheFlow(servico.tipo_servico, (servico as any).client_pk)) {
      void openTransformador(servico);
      return;
    }
    // Checklist de Fiscalização → tela dedicada
    if (servico.tipo_servico === 'Checklist de Fiscalização' && !usesLegacyDetalheFlow(servico.tipo_servico, (servico as any).client_pk)) {
      void openChecklistFiscalizacao(servico);
      return;
    }

    if (servico.id.startsWith('legacy-')) {
      // Serviço legado: marca a obra original como finalizada diretamente
      const ok = await markObraFinalizada(servico.obra_id);
      if (!ok) {
        Alert.alert('Erro', 'Não foi possível marcar este serviço como concluído.');
        return;
      }
      showSuccessAnimation(servico.tipo_servico);
      await loadData({ showSpinner: false });
      return;
    }

    // Re-busca do cache local para garantir que fotos offline são consideradas,
    // mesmo que o fetchServicosForObra anterior tenha retornado dados do Supabase sem elas.
    let servicoParaValidar: Servico = servico;
    try {
      const localList = await getLocalServicos(servico.obra_id);
      const targetTipoNorm = normalizeServiceTypeKey(servico.tipo_servico);
      const localSvc = localList.find((s) =>
        s.id === servico.id &&
        normalizeServiceTypeKey(String(s.tipo_servico || '')) === targetTipoNorm
      );
      if (localSvc) {
        // Usa a versão local apenas se tiver mais fotos (protege contra race com sync)
        const localPhotoCount = Object.keys(localSvc).reduce((sum, k) => {
          if ((k.startsWith('fotos_') || k.startsWith('doc_')) && Array.isArray((localSvc as any)[k])) {
            return sum + (localSvc as any)[k].filter((p: any) => p && (p.uri || p.url || p.id)).length;
          }
          return sum;
        }, 0);
        const currentPhotoCount = Object.keys(servicoParaValidar).reduce((sum, k) => {
          if ((k.startsWith('fotos_') || k.startsWith('doc_')) && Array.isArray((servicoParaValidar as any)[k])) {
            return sum + (servicoParaValidar as any)[k].filter((p: any) => p && (p.uri || p.url || p.id)).length;
          }
          return sum;
        }, 0);
        if (localPhotoCount >= currentPhotoCount) {
          servicoParaValidar = localSvc as unknown as Servico;
        }
      }
    } catch {
      // fallback: usa o servico recebido
    }

    const legacyFlowByCard = usesLegacyDetalheFlow(servico.tipo_servico, (servico as any).client_pk);
    const legacyFlowByResolved = usesLegacyDetalheFlow(servicoParaValidar.tipo_servico, (servicoParaValidar as any).client_pk);
    if (legacyFlowByCard || legacyFlowByResolved) {
      const legacyObra = findLegacyObraForServico(servico);
      const scopedLegacyData = buildScopedLegacyDataForServico(
        servicoParaValidar,
        legacyObra || (servico.id.startsWith('legacy-') ? (servico as any as ObraListItem) : null)
      );
      const legacyContext = legacyObra
        ? { ...legacyObra, ...scopedLegacyData }
        : scopedLegacyData;

      if (!hasAnyLegacyRegistro(legacyContext)) {
        Alert.alert(
          'Sem registros',
          'Este serviço ainda não possui registros de formulário/fotos para concluir.'
        );
        return;
      }
      const ok = await markServicoComplete(servico.id, servico.obra_id, servico as any);
      if (!ok) {
        Alert.alert('Erro', 'Não foi possível marcar este serviço como concluído.');
        return;
      }
      showSuccessAnimation(servico.tipo_servico);
      await loadData({ showSpinner: false });
      return;
    }

    const validation = validateServicoCompletion(servicoParaValidar);
    if (validation.configErrors.length > 0) {
      Alert.alert('Ajuste necessário', validation.configErrors.join('\n'));
      return;
    }
    if (validation.missingRules.length > 0) {
      const details = validation.missingRules
        .map((rule) => `- ${rule.label}: ${rule.currentCount}/${rule.minCount}`)
        .join('\n');
      Alert.alert('Fotos obrigatórias faltando', details);
      return;
    }

    const ok = await markServicoComplete(servico.id, servico.obra_id, servico as any);
    if (!ok) {
      Alert.alert('Erro', 'Não foi possível marcar este serviço como concluído.');
      return;
    }

    showSuccessAnimation(servico.tipo_servico);
    await loadData({ showSpinner: false });
  };

  const handleCapturePhoto = (servico: Servico, category: keyof Servico) => {
    if (servico.id.startsWith('legacy-')) {
      const obraLegada = obras.find((item) => item.id === servico.obra_id);
      if (obraLegada) {
        handleOpenLegacyObraEditor(obraLegada);
      } else {
        Alert.alert('Atenção', 'Abra este book no formulário original para adicionar fotos.');
      }
      return;
    }

    openServicoPhotoCapture(servico, category);
  };

  const openServicoPhotoCapture = (servico: Servico, category: keyof Servico) => {
    if (servico.id.startsWith('legacy-')) {
      const obraLegada = obras.find((item) => item.id === servico.obra_id);
      if (obraLegada) {
        handleOpenLegacyObraEditor(obraLegada);
      } else {
        Alert.alert('Atenção', 'Abra este book no formulário original para adicionar fotos.');
      }
      return;
    }

    // Serviços com postes (Cava em Rocha, Linha Viva, etc.) → vai direto para a tela de postes
    if (!usesLegacyDetalheFlow(servico.tipo_servico, (servico as any).client_pk) && SERVICOS_COM_POSTES_SCREEN.has(servico.tipo_servico)) {
      void openPostesRegistro(servico);
      return;
    }
    // Transformador → tela dedicada
    if (servico.tipo_servico === 'Transformador' && !usesLegacyDetalheFlow(servico.tipo_servico, (servico as any).client_pk)) {
      void openTransformador(servico);
      return;
    }
    // Checklist de Fiscalização → tela dedicada
    if (servico.tipo_servico === 'Checklist de Fiscalização' && !usesLegacyDetalheFlow(servico.tipo_servico, (servico as any).client_pk)) {
      void openChecklistFiscalizacao(servico);
      return;
    }

    if (usesLegacyDetalheFlow(servico.tipo_servico, (servico as any).client_pk)) {
      Alert.alert(
        'Fluxo legado obrigatório',
        'Este serviço usa o formulário antigo (pontos/aditivos/status do poste). Vou abrir agora.',
        [{ text: 'Continuar', onPress: () => openLegacyServicoDetalhe(servico, category) }]
      );
      return;
    }

    setCapturingPhotoForServico({
      servicoId: servico.id,
      category,
      obraId: servico.obra_id,
    });
  };

  const addPhotoToServico = async (
    photoUri: string,
    coords: { latitude: number | null; longitude: number | null } = { latitude: null, longitude: null },
    source: 'camera' | 'gallery' = 'camera',
  ) => {
    if (!capturingPhotoForServico) return;

    try {
      const { servicoId, category, obraId } = capturingPhotoForServico;

      logger.servico('INÍCIO addPhtoToServico',{
        servicoId,
        obraId,
        category,
        isOnline,
      });

      const photoType = String(category).replace(/^fotos_/, '').replace(/^doc_/, '') as any;
      const photoMetadata = await backupPhoto(photoUri, obraId, photoType, 0, coords.latitude, coords.longitude, 'image/jpeg', source);

      logger.photos('backupPhoto concluído',{
        photoId: photoMetadata.id,
        compressedPath: photoMetadata.compressedPath,
        uploadUrl: photoMetadata.uploadUrl,
        supabaseUrl: photoMetadata.supabaseUrl,
      });

      const localSaved = await appendPhotoToServicoLocal(
        servicoId,
        obraId,
        category as any,
        photoMetadata.id,
        photoMetadata.compressedPath,
        {
          latitude: photoMetadata.latitude,
          longitude: photoMetadata.longitude,
          utmX: photoMetadata.utmX,
          utmY: photoMetadata.utmY,
          utmZone: photoMetadata.utmZone,
        }
      );

      logger.servico('appendPhotoToServicoLocal resultado',{
        localSaved,
        servicoId,
        obraId,
        category,
        photoId: photoMetadata.id,
      });

      if (!localSaved) {
        Alert.alert('Erro', 'Não foi possível salvar a foto localmente neste serviço.');
        return;
      }

      setCapturingPhotoForServico(null);
      await loadData({ showSpinner: false });

      if (isOnline && isUuid(servicoId) && isUuid(obraId)) {
        try {

          logger.sync('Tentando upload imediato da foto',{
            obraId,
            photoId: photoMetadata.id,
        });

          await processObraPhotos(obraId, undefined, [photoMetadata.id]);
          const [uploadedMetadata] = await getPhotoMetadatasByIds([photoMetadata.id]);
          const publicUrl = uploadedMetadata?.uploadUrl || uploadedMetadata?.supabaseUrl;

          logger.sync('Resultado publicUrl',{
            publicUrl,
            photoId: photoMetadata.id,
          });

          if (publicUrl) {
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
                id: photoMetadata.id,
                url: publicUrl,
                latitude: photoMetadata.latitude ?? undefined,
                longitude: photoMetadata.longitude ?? undefined,
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

                logger.sync('Update Supabase executado',{
                  servicoId,
                  fieldName,
                });

              await loadData({ showSpinner: false });
            }
          }
        } catch {
          // Mantém a foto local e deixa a fila concluir depois
        }
      }
    } catch (error) {
      console.error('Erro ao adicionar foto:', error);
      Alert.alert('Erro', 'Não foi possível adicionar a foto.');
    }
  };

  const capturePhotoFromCamera = async () => {
    if (!capturingPhotoForServico) return;

    try {
      setCaptureLoading(true);
      const permissionResult = await ImagePicker.requestCameraPermissionsAsync();
      if (!permissionResult.granted) {
        Alert.alert('Permissao negada', 'E necessario permitir acesso a camera.');
        return;
      }

      // GPS em paralelo com a camera (silencioso)
      const locationPromise = getLocationSilent();
      const result = await ImagePicker.launchCameraAsync({
        mediaTypes: ['images'],
        allowsEditing: false,
        quality: 0.8,
      });

      if (!result.canceled && result.assets[0]) {
        const coords = await locationPromise;
        await addPhotoToServico(result.assets[0].uri, coords, 'camera');
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

      // GPS em paralelo com a galeria (silencioso)
      const locationPromise = getLocationSilent();
      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ['images'],
        allowsEditing: false,
        quality: 0.8,
      });

      if (!result.canceled && result.assets[0]) {
        const coords = await locationPromise;
        await addPhotoToServico(result.assets[0].uri, coords, 'gallery');
      }
    } catch (error) {
      console.error('Erro ao selecionar foto:', error);
      Alert.alert('Erro', 'Não foi possível selecionar a foto.');
    } finally {
      setCaptureLoading(false);
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

      await loadData({ showSpinner: false });
      Alert.alert('Pronto', 'Book sincronizado com sucesso.');
    } catch (error) {
      console.error('Erro ao sincronizar rascunho:', error);
      Alert.alert('Erro', 'Não foi possível sincronizar este rascunho.');
    } finally {
      setSyncingDraftId(null);
    }
  };

  const handleOpenLegacyObraEditor = (obra: ObraListItem) => {
    try {
      const payload = encodeURIComponent(JSON.stringify(obra));
      router.push({
        pathname: '/nova-obra',
        params: { editMode: 'true', obraData: payload },
      });
    } catch (error) {
      console.error('Erro ao abrir formulário original da obra:', error);
      Alert.alert('Erro', 'Não foi possível abrir o formulário original deste book.');
    }
  };

  const findLegacyObraForServico = (servico: Servico): ObraListItem | null => {
    const targetNumero = String(servico.obra_numero || obraNumero || '').trim();
    const pool = targetNumero
      ? obras.filter((obra) => String(obra.obra || '').trim() === targetNumero)
      : obras;
    const serviceTipoNorm = normalizeServiceTypeKey(servico.tipo_servico);

    const serviceObraId = String(servico.obra_id || '').trim();
    if (serviceObraId) {
      const byExactId = pool.find(
        (obra) =>
          obra.id === serviceObraId ||
          obra.serverId === serviceObraId ||
          (isUuid(obra.id) && isUuid(serviceObraId) && obra.id === serviceObraId)
      );
      if (byExactId) return byExactId;

      const byDirectIdSameType = pool.find(
        (obra) =>
          (
            obra.id === serviceObraId ||
            obra.serverId === serviceObraId ||
            (isUuid(obra.id) && isUuid(serviceObraId) && obra.id === serviceObraId)
          ) &&
          normalizeServiceTypeKey(String(obra.tipo_servico || '')) === serviceTipoNorm
      );
      if (byDirectIdSameType) return byDirectIdSameType;
    }

    const byServicoMap = pool
      .filter((obra) =>
        (servicosPorItemId[obra.id] || []).some((item) => item.id === servico.id)
      )
      .sort((a, b) => {
        const aTipo = normalizeServiceTypeKey(String(a.tipo_servico || '')) === serviceTipoNorm ? 1 : 0;
        const bTipo = normalizeServiceTypeKey(String(b.tipo_servico || '')) === serviceTipoNorm ? 1 : 0;
        if (aTipo !== bTipo) return bTipo - aTipo;
        const scoreDiff = getLegacyObraScoreForServico(b, servico) - getLegacyObraScoreForServico(a, servico);
        if (scoreDiff !== 0) return scoreDiff;
        const ta = new Date(a.updated_at || a.created_at || 0).getTime();
        const tb = new Date(b.updated_at || b.created_at || 0).getTime();
        return tb - ta;
      })[0];
    if (byServicoMap) return byServicoMap;

    const byTipo = pool
      .filter((obra) => normalizeServiceTypeKey(String(obra.tipo_servico || '')) === serviceTipoNorm)
      .sort((a, b) => {
        const scoreDiff = getLegacyObraScoreForServico(b, servico) - getLegacyObraScoreForServico(a, servico);
        if (scoreDiff !== 0) return scoreDiff;
        const ta = new Date(a.updated_at || a.created_at || 0).getTime();
        const tb = new Date(b.updated_at || b.created_at || 0).getTime();
        return tb - ta;
      })[0];
    if (byTipo) return byTipo;

    const obraNumeroServico = String(servico.obra_numero || '').trim();
    if (obraNumeroServico) {
      const byNumero = obras.find((obra) => String(obra.obra || '').trim() === obraNumeroServico);
      if (byNumero) return byNumero;
    }

    return null;
  };

  const openLegacyServicoDetalhe = async (
    servico: Servico,
    _category?: keyof Servico,
    preferredLegacyObra?: ObraListItem | null,
    preferredScopedData?: Record<string, any> | null
  ) => {
    try {
      const pickNonEmptyArray = (...candidates: unknown[]): any[] => {
        for (const candidate of candidates) {
          if (Array.isArray(candidate) && candidate.length > 0) {
            return candidate as any[];
          }
        }
        return [];
      };

      const allowLegacyFallback = shouldHydrateFromLegacyObra(servico);
      const obraLegada = allowLegacyFallback
        ? (preferredLegacyObra || findLegacyObraForServico(servico))
        : null;
      const obraNumeroFallback = String(servico.obra_numero || obraNumero || '').trim();
      const scopedLegacyData = preferredScopedData || buildScopedLegacyDataForServico(servico, obraLegada);
      const servicoId = String(servico.id || '').trim();
      const candidateObraIds = Array.from(
        new Set(
          [
            String(servico.obra_id || '').trim(),
            String((servico as any).serverId || '').trim(),
            String((servico as any).legacy_server_id || '').trim(),
          ].filter(Boolean)
        )
      );
      const localServicosByScope = (
        await Promise.all(candidateObraIds.map((candidateObraId) => getLocalServicos(candidateObraId)))
      ).flat();

      const scopedPostesFromServicoRaw = sanitizePostesDataForServico(
        (servico as any).postes_data,
        servicoId,
        false
      );
      const getEntryRenderScore = (entry: any): number => {
        if (!entry) return 0;
        if (typeof entry === 'string') {
          const value = entry.trim();
          if (!value) return 0;
          if (
            value.startsWith('http://') ||
            value.startsWith('https://') ||
            value.startsWith('file://') ||
            value.startsWith('content://') ||
            value.startsWith('/')
          ) {
            return 10;
          }
          return 1;
        }
        if (typeof entry === 'object') {
          let score = 0;
          const id = String(entry.id || entry.photoId || '').trim();
          const url = String(entry.url || '').trim();
          const uri = String(entry.uri || '').trim();
          if (id) score += 2;
          if (url.startsWith('http://') || url.startsWith('https://')) score += 10;
          if (uri.startsWith('file://') || uri.startsWith('content://') || uri.startsWith('/')) score += 12;
          return score;
        }
        return 0;
      };
      const getPostesScore = (postes: any[]): number => {
        if (!Array.isArray(postes) || postes.length === 0) return 0;
        const photoScore = postes.reduce((acc: number, poste: any) => {
          const before = Array.isArray(poste?.fotos_antes) ? poste.fotos_antes : [];
          const during = Array.isArray(poste?.fotos_durante) ? poste.fotos_durante : [];
          const after = Array.isArray(poste?.fotos_depois) ? poste.fotos_depois : [];
          const measure = Array.isArray(poste?.fotos_medicao) ? poste.fotos_medicao : [];
          const totalEntries = before.length + during.length + after.length + measure.length;
          const qualityScore =
            before.reduce((s: number, item: any) => s + getEntryRenderScore(item), 0) +
            during.reduce((s: number, item: any) => s + getEntryRenderScore(item), 0) +
            after.reduce((s: number, item: any) => s + getEntryRenderScore(item), 0) +
            measure.reduce((s: number, item: any) => s + getEntryRenderScore(item), 0);
          // Prioriza fortemente snapshots com fotos válidas.
          // Isso evita que um snapshot com mais postes porém sem foto
          // vença um snapshot com menos postes, mas com fotos reais.
          return acc + (totalEntries * 500) + qualityScore;
        }, 0);
        // Quantidade de postes ajuda no desempate, mas não pode superar fotos.
        return postes.length * 25 + photoScore;
      };
      const localSnapshotsByServicoId = localServicosByScope.filter(
        (localSvc: any) => String(localSvc?.id || '').trim() === servicoId
      );

      // Fallback robusto: alguns snapshots do servico podem estar salvos em buckets
      // diferentes de obra_id (temp/local/server). Quando isso ocorre, buscar em todos
      // os @servicos_local:* evita perder fotos por poste ao reabrir offline.
      const globalLocalSnapshotsByServicoId: any[] = [];
      try {
        const allKeys = await AsyncStorage.getAllKeys();
        const servicoKeys = allKeys.filter((key) => key.startsWith('@servicos_local:'));
        const entries = await AsyncStorage.multiGet(servicoKeys);
        for (const [, raw] of entries) {
          if (!raw) continue;
          let parsed: any[] = [];
          try {
            parsed = JSON.parse(raw);
          } catch {
            continue;
          }
          if (!Array.isArray(parsed) || parsed.length === 0) continue;
          for (const entry of parsed) {
            if (String(entry?.id || '').trim() !== servicoId) continue;
            globalLocalSnapshotsByServicoId.push(entry);
          }
        }
      } catch (scanErr) {
        console.warn('[openLegacyServicoDetalhe] Falha ao varrer snapshots locais globais do servico:', scanErr);
      }

      const snapshotsPoolByServico = [...localSnapshotsByServicoId, ...globalLocalSnapshotsByServicoId];
      const uniqueSnapshotsByServico = snapshotsPoolByServico.filter((snapshot, index, arr) => {
        const snapshotUpdatedAt = String(snapshot?.updated_at || '').trim();
        const snapshotObraId = String(snapshot?.obra_id || '').trim();
        return arr.findIndex((item) => {
          const itemUpdatedAt = String(item?.updated_at || '').trim();
          const itemObraId = String(item?.obra_id || '').trim();
          return itemUpdatedAt === snapshotUpdatedAt && itemObraId === snapshotObraId;
        }) === index;
      });

      const scopedPostesFromBestLocalSnapshotRaw = uniqueSnapshotsByServico
        .map((snapshot: any) => sanitizePostesDataForServico(snapshot?.postes_data, servicoId, false))
        .sort((a, b) => getPostesScore(b) - getPostesScore(a))[0] || [];

      let scopedPostesFromIsolatedBucketRaw: any[] = [];
      try {
        const isolatedBucketRaw = await AsyncStorage.getItem(`@servico_postes_data:${servicoId}`);
        if (isolatedBucketRaw) {
          scopedPostesFromIsolatedBucketRaw = sanitizePostesDataForServico(
            JSON.parse(isolatedBucketRaw),
            servicoId,
            false
          );
        }
      } catch (bucketErr) {
        console.warn('[openLegacyServicoDetalhe] Falha ao ler bucket isolado de postes do servico:', bucketErr);
      }

      const pickBestPostesCandidate = (candidates: any[][]): any[] => {
        const valid = candidates.filter((candidate) => Array.isArray(candidate) && candidate.length > 0);
        if (valid.length === 0) return [];

        const withPhotos = valid.filter((candidate) => hasAnyPostePhotos(candidate));
        const basePool = withPhotos.length > 0 ? withPhotos : valid;

        // Regra anti-colapso:
        // se existir snapshot com 2+ postes com fotos, nunca usar snapshot de 1 poste.
        const multiPostePool = basePool.filter((candidate) => candidate.length > 1 && hasAnyPostePhotos(candidate));
        const finalPool = multiPostePool.length > 0 ? multiPostePool : basePool;

        return finalPool.sort((a, b) => getPostesScore(b) - getPostesScore(a))[0] || [];
      };

      const scopedPostesFromServicoCandidates = [
        scopedPostesFromServicoRaw,
        scopedPostesFromBestLocalSnapshotRaw,
        scopedPostesFromIsolatedBucketRaw,
      ];
      const scopedPostesFromServico = pickBestPostesCandidate(scopedPostesFromServicoCandidates);
      const scopedPostesFromLegacy = sanitizePostesDataForServico(
        (allowLegacyFallback ? (scopedLegacyData as any)?.postes_data : null),
        servicoId,
        false
      );
      const isPosteScopedServico = ['Linha Viva', 'Cava em Rocha', 'Book de Aterramento', 'Fundação Especial']
        .includes(String(servico.tipo_servico || '').trim());

      const flatFallbackAntes = pickNonEmptyArray(
        (servico as any).fotos_antes,
        (scopedLegacyData as any)?.fotos_antes,
        (servico as any).fotos_aterramento_vala_aberta,
        (scopedLegacyData as any)?.fotos_aterramento_vala_aberta
      );
      const flatFallbackDurante = pickNonEmptyArray(
        (servico as any).fotos_durante,
        (scopedLegacyData as any)?.fotos_durante,
        (servico as any).fotos_aterramento_hastes,
        (scopedLegacyData as any)?.fotos_aterramento_hastes
      );
      const flatFallbackDepois = pickNonEmptyArray(
        (servico as any).fotos_depois,
        (scopedLegacyData as any)?.fotos_depois,
        (servico as any).fotos_aterramento_vala_fechada,
        (scopedLegacyData as any)?.fotos_aterramento_vala_fechada
      );
      const flatFallbackMedicao = pickNonEmptyArray(
        (servico as any).fotos_medicao,
        (scopedLegacyData as any)?.fotos_medicao,
        (servico as any).fotos_aterramento_medicao,
        (scopedLegacyData as any)?.fotos_aterramento_medicao
      );

      const hasFlatFallbackPhotos =
        flatFallbackAntes.length > 0 ||
        flatFallbackDurante.length > 0 ||
        flatFallbackDepois.length > 0 ||
        flatFallbackMedicao.length > 0;

      const scopedServicoHasPhotos = hasAnyPostePhotos(scopedPostesFromServico);
      const scopedLegacyHasPhotos = hasAnyPostePhotos(scopedPostesFromLegacy);

      const buildFallbackPostesDataFromFlat = (): any[] | null => {
        if (!isPosteScopedServico || !hasFlatFallbackPhotos) return null;

        const basePostes =
          scopedPostesFromServico.length > 0
            ? scopedPostesFromServico
            : scopedPostesFromLegacy.length > 0
              ? scopedPostesFromLegacy
              : [{ id: `poste_fallback_${String(servico.id || Date.now())}`, numero: 1, isAditivo: false }];

        // Nunca redistribuir fallback flat em serviços com múltiplos postes,
        // para evitar concentrar todas as fotos no Poste 1.
        if (basePostes.length > 1) return null;

        const [firstPoste, ...restPostes] = basePostes;
        const mergedFirstPoste = {
          ...firstPoste,
          fotos_antes:
            Array.isArray(firstPoste?.fotos_antes) && firstPoste.fotos_antes.length > 0
              ? firstPoste.fotos_antes
              : flatFallbackAntes,
          fotos_durante:
            Array.isArray(firstPoste?.fotos_durante) && firstPoste.fotos_durante.length > 0
              ? firstPoste.fotos_durante
              : flatFallbackDurante,
          fotos_depois:
            Array.isArray(firstPoste?.fotos_depois) && firstPoste.fotos_depois.length > 0
              ? firstPoste.fotos_depois
              : flatFallbackDepois,
          fotos_medicao:
            Array.isArray(firstPoste?.fotos_medicao) && firstPoste.fotos_medicao.length > 0
              ? firstPoste.fotos_medicao
              : flatFallbackMedicao,
        };

        return [mergedFirstPoste, ...restPostes];
      };

      const fallbackPostesFromFlat = buildFallbackPostesDataFromFlat();
      const payloadPostesData = pickBestPostesCandidate([
        scopedServicoHasPhotos ? scopedPostesFromServico : [],
        scopedLegacyHasPhotos ? scopedPostesFromLegacy : [],
        fallbackPostesFromFlat || [],
        scopedPostesFromServico,
        scopedPostesFromLegacy,
      ]);

      const payloadObj: Record<string, any> = {
        ...(allowLegacyFallback ? (obraLegada || {}) : {}),
        ...(scopedLegacyData || {}),
        // Usar servico.id como chave de storage para isolar dados entre serviços do mesmo tipo na mesma obra
        id: servico.id,
        serverId: (isUuid(servico.obra_id) ? servico.obra_id : undefined) || obraLegada?.serverId,
        data: obraLegada?.data || new Date().toISOString().slice(0, 10),
        obra: obraLegada?.obra || obraNumeroFallback,
        responsavel: servico.responsavel || obraLegada?.responsavel || '',
        equipe: obraLegada?.equipe || '',
        tipo_servico: servico.tipo_servico,
        // Para servicos por poste, envia fallback do proprio servico.
        // nova-obra prioriza bucket isolado e so usa este dado se o bucket ainda nao existir.
        postes_data:
          (Array.isArray(payloadPostesData) && payloadPostesData.length > 0 ? payloadPostesData : null) ??
          null,
        ...(isPosteScopedServico && {
          fotos_antes: [],
          fotos_durante: [],
          fotos_depois: [],
        }),
      };

      const payload = encodeURIComponent(JSON.stringify(payloadObj));
      router.push({
        pathname: '/nova-obra',
        params: {
          editMode: 'true',
          obraData: payload,
          contextServicoId: servico.id,
          skipLocalReconcile: '1',
        },
      });
    } catch (error) {
      console.error('Erro ao abrir formulario legado do servico:', error);
      Alert.alert('Erro', 'Nao foi possivel abrir o formulario antigo para este servico.');
    }
  };

  const openDadosServicoModal = (servico: Servico) => {
    setDadosModalServico(servico);
    setDadosModalDraft(toDadosAdicionaisDraft(servico));
    setDadosModalVisible(true);
  };

  // Navega para a tela genérica de postes (Cava em Rocha, Linha Viva, etc.)
  const SERVICOS_COM_POSTES_SCREEN = new Set(['Cava em Rocha', 'Linha Viva', 'Book de Aterramento', 'Fundação Especial']);

  const openPostesRegistro = async (servico: Servico) => {
    try {
      const allowLegacyFallback =
        usesLegacyDetalheFlow(servico.tipo_servico, (servico as any).client_pk) ||
        String(servico.id || '').startsWith('legacy-');

      const getPostesPhotoCount = (value: unknown): number => {
        if (!Array.isArray(value)) return 0;
        return value.reduce((sum: number, poste: any) => {
          const before = Array.isArray(poste?.fotos_antes)
            ? poste.fotos_antes.length
            : (Array.isArray(poste?.fotosAntes) ? poste.fotosAntes.length : 0);
          const during = Array.isArray(poste?.fotos_durante)
            ? poste.fotos_durante.length
            : (Array.isArray(poste?.fotosDurante) ? poste.fotosDurante.length : 0);
          const after = Array.isArray(poste?.fotos_depois)
            ? poste.fotos_depois.length
            : (Array.isArray(poste?.fotosDepois) ? poste.fotosDepois.length : 0);
          const measure = Array.isArray(poste?.fotos_medicao)
            ? poste.fotos_medicao.length
            : (Array.isArray(poste?.fotosMedicao) ? poste.fotosMedicao.length : 0);
          return sum + before + during + after + measure;
        }, 0);
      };

      let payloadServico: any = { ...servico };

      try {
        const localList = await getLocalServicos(servico.obra_id);
        const servicoClientPk = String((servico as any)?.client_pk || '').trim();
        const localByIdOrPk = localList.find((s) => {
          if (s.id === servico.id) return true;
          const candidatePk = String((s as any)?.client_pk || '').trim();
          return !!servicoClientPk && candidatePk === servicoClientPk;
        });
        if (localByIdOrPk) {
          const currentCount = getPostesPhotoCount(payloadServico?.postes_data);
          const localCount = getPostesPhotoCount((localByIdOrPk as any)?.postes_data);
          if (localCount >= currentCount) {
            payloadServico = { ...payloadServico, ...(localByIdOrPk as any) };
          }

          const bucketKeys = new Set<string>([String(servico.id)]);
          if ((localByIdOrPk as any)?.id) bucketKeys.add(String((localByIdOrPk as any).id));

          for (const bucketServicoId of bucketKeys) {
            const isolatedRaw = await AsyncStorage.getItem(`@servico_postes_data:${bucketServicoId}`);
            if (!isolatedRaw) continue;
            let isolatedParsed: any;
            try {
              isolatedParsed = JSON.parse(isolatedRaw);
            } catch {
              continue;
            }
            if (!Array.isArray(isolatedParsed)) continue;

            const currentBestCount = getPostesPhotoCount(payloadServico?.postes_data);
            const isolatedCount = getPostesPhotoCount(isolatedParsed);
            if (isolatedCount > currentBestCount) {
              payloadServico = { ...payloadServico, postes_data: isolatedParsed };
            }
          }
        }

        const fallbackBucketRaw = await AsyncStorage.getItem(`@servico_postes_data:${String(servico.id)}`);
        if (fallbackBucketRaw) {
          try {
            const fallbackBucket = JSON.parse(fallbackBucketRaw);
            if (Array.isArray(fallbackBucket)) {
              const currentBestCount = getPostesPhotoCount(payloadServico?.postes_data);
              const fallbackCount = getPostesPhotoCount(fallbackBucket);
              if (fallbackCount > currentBestCount) {
                payloadServico = { ...payloadServico, postes_data: fallbackBucket };
              }
            }
          } catch {
            // ignora bucket inválido
          }
        }
      } catch {
        // segue com payload atual
      }

      if (allowLegacyFallback) {
        try {
          const legacyObra = findLegacyObraForServico(servico);
          const scopedLegacyData = buildScopedLegacyDataForServico(payloadServico as Servico, legacyObra || null);
          const currentCount = getPostesPhotoCount(payloadServico?.postes_data);
          const legacyCount = getPostesPhotoCount((scopedLegacyData as any)?.postes_data);
          if (legacyCount > currentCount) {
            payloadServico = { ...payloadServico, ...(scopedLegacyData as any) };
          }
        } catch {
          // segue sem fallback legado
        }

        // Fallback extra: buscar nas obras locais (apenas legado).
        try {
          const localObras = await getLocalObras();
          const serviceObraId = String(servico.obra_id || '').trim();
          const serviceObraNumero = String(servico.obra_numero || obraNumero || '').trim();
          const candidateObra = localObras.find((obra: any) => {
            const obraId = String(obra?.id || '').trim();
            const obraServerId = String(obra?.serverId || '').trim();
            const obraNumeroItem = String(obra?.obra || '').trim();
            if (serviceObraId && (obraId === serviceObraId || obraServerId === serviceObraId)) return true;
            if (serviceObraNumero && obraNumeroItem && obraNumeroItem === serviceObraNumero) return true;
            return false;
          });
          if (candidateObra) {
            const currentCount = getPostesPhotoCount(payloadServico?.postes_data);
            const obraCount = getPostesPhotoCount((candidateObra as any)?.postes_data);
            if (obraCount > currentCount) {
              payloadServico = { ...payloadServico, postes_data: (candidateObra as any)?.postes_data };
            }
          }
        } catch {
          // segue sem fallback de obras locais
        }

        // Fallback remoto (apenas legado): tabela obras do Supabase.
        try {
          const currentCount = getPostesPhotoCount(payloadServico?.postes_data);
          if (currentCount === 0) {
            const serviceObraId = String(servico.obra_id || '').trim();
            if (serviceObraId && isUuid(serviceObraId)) {
              const { data: obraRemote } = await supabase
                .from('obras')
                .select('postes_data,fotos_antes,fotos_durante,fotos_depois')
                .eq('id', serviceObraId)
                .maybeSingle();
              const remoteCount = getPostesPhotoCount((obraRemote as any)?.postes_data);
              if (remoteCount > 0) {
                payloadServico = { ...payloadServico, ...(obraRemote as any) };
              } else if (obraRemote) {
                payloadServico = {
                  ...payloadServico,
                  fotos_antes: Array.isArray((obraRemote as any).fotos_antes) ? (obraRemote as any).fotos_antes : (payloadServico as any).fotos_antes,
                  fotos_durante: Array.isArray((obraRemote as any).fotos_durante) ? (obraRemote as any).fotos_durante : (payloadServico as any).fotos_durante,
                  fotos_depois: Array.isArray((obraRemote as any).fotos_depois) ? (obraRemote as any).fotos_depois : (payloadServico as any).fotos_depois,
                };
              }
            }
          }
        } catch {
          // segue sem fallback remoto
        }
      }

      let normalizedPostes = sanitizePostesDataForServico(
        (payloadServico as any)?.postes_data,
        String(servico.id),
        false
      );

      if (allowLegacyFallback && (!Array.isArray(normalizedPostes) || normalizedPostes.length === 0) &&
        (
          Array.isArray((payloadServico as any)?.fotos_antes) ||
          Array.isArray((payloadServico as any)?.fotos_durante) ||
          Array.isArray((payloadServico as any)?.fotos_depois)
        )) {
        normalizedPostes = [{
          id: 'poste_legacy_1',
          numero: 1,
          isAditivo: false,
          fotos_antes: Array.isArray((payloadServico as any)?.fotos_antes) ? (payloadServico as any).fotos_antes : [],
          fotos_durante: Array.isArray((payloadServico as any)?.fotos_durante) ? (payloadServico as any).fotos_durante : [],
          fotos_depois: Array.isArray((payloadServico as any)?.fotos_depois) ? (payloadServico as any).fotos_depois : [],
          fotos_medicao: [],
        }];
      }

      const minimizedPayload = {
        id: payloadServico.id,
        obra_id: payloadServico.obra_id,
        obra_numero: payloadServico.obra_numero,
        tipo_servico: payloadServico.tipo_servico,
        status: payloadServico.status,
        responsavel: payloadServico.responsavel,
        // client_pk é obrigatório para upsert idempotente no sync — deve ser preservado
        // para evitar race condition se o usuário tirar foto antes de fetchServicosForObra completar
        client_pk: (payloadServico as any).client_pk ?? null,
        postes_data: normalizedPostes,
        fotos_antes: Array.isArray((payloadServico as any)?.fotos_antes) ? (payloadServico as any).fotos_antes : [],
        fotos_durante: Array.isArray((payloadServico as any)?.fotos_durante) ? (payloadServico as any).fotos_durante : [],
        fotos_depois: Array.isArray((payloadServico as any)?.fotos_depois) ? (payloadServico as any).fotos_depois : [],
      };

      const payload = encodeURIComponent(JSON.stringify(minimizedPayload));
      const title = encodeURIComponent(servico.tipo_servico);
      router.push({
        pathname: '/postes-registro',
        params: { data: payload, title },
      });
    } catch (error) {
      console.error('Erro ao abrir registro de postes:', error);
      Alert.alert('Erro', 'Não foi possível abrir o registro de postes.');
    }
  };

  // Navega para a tela dedicada de Transformador
  const openTransformador = async (servico: Servico) => {
    try {
      let payloadServico: any = { ...servico };
      try {
        const localList = await getLocalServicos(servico.obra_id);
        const servicoClientPk = String((servico as any)?.client_pk || '').trim();
        const localMatch = localList.find((s) => {
          if (s.id === servico.id) return true;
          const candidatePk = String((s as any)?.client_pk || '').trim();
          return !!servicoClientPk && candidatePk === servicoClientPk;
        });
        if (localMatch) payloadServico = { ...payloadServico, ...(localMatch as any) };
      } catch {
        // usa versão dos params
      }
      const payload = encodeURIComponent(JSON.stringify(payloadServico));
      router.push({ pathname: '/transformador', params: { data: payload } });
    } catch (error) {
      console.error('Erro ao abrir Transformador:', error);
      Alert.alert('Erro', 'Não foi possível abrir o registro do transformador.');
    }
  };

  // Navega para a tela dedicada de Checklist de Fiscalização
  const openChecklistFiscalizacao = async (servico: Servico) => {
    try {
      let payloadServico: any = { ...servico };
      try {
        const localList = await getLocalServicos(servico.obra_id);
        const servicoClientPk = String((servico as any)?.client_pk || '').trim();
        const localMatch = localList.find((s) => {
          if (s.id === servico.id) return true;
          const candidatePk = String((s as any)?.client_pk || '').trim();
          return !!servicoClientPk && candidatePk === servicoClientPk;
        });
        if (localMatch) payloadServico = { ...payloadServico, ...(localMatch as any) };
      } catch {
        // usa versão dos params
      }
      const payload = encodeURIComponent(JSON.stringify(payloadServico));
      router.push({ pathname: '/checklist-fiscalizacao', params: { data: payload } });
    } catch (error) {
      console.error('Erro ao abrir Checklist de Fiscalização:', error);
      Alert.alert('Erro', 'Não foi possível abrir o checklist de fiscalização.');
    }
  };

  const closeDadosServicoModal = () => {
    setDadosModalVisible(false);
    setDadosModalServico(null);
    setDadosModalDraft(createEmptyDadosAdicionais());
  };

  const updateDadosModalField = (
    field: Exclude<keyof DadosAdicionaisDraft, 'pontos_referencia'>,
    value: string
  ) => {
    setDadosModalDraft((prev) => ({ ...prev, [field]: value }));
  };

  const updatePontoField = (id: string, field: keyof PontoReferenciaDraft, value: string) => {
    setDadosModalDraft((prev) => ({
      ...prev,
      pontos_referencia: prev.pontos_referencia.map((ponto) =>
        ponto.id === id ? { ...ponto, [field]: value } : ponto
      ),
    }));
  };

  const addPontoReferencia = () => {
    setDadosModalDraft((prev) => ({
      ...prev,
      pontos_referencia: [...prev.pontos_referencia, createEmptyPonto()],
    }));
  };

  const removePontoReferencia = (id: string) => {
    setDadosModalDraft((prev) => ({
      ...prev,
      pontos_referencia: prev.pontos_referencia.filter((ponto) => ponto.id !== id),
    }));
  };

  const handleSaveDadosServico = async () => {
    if (!dadosModalServico) return;

    const payload = sanitizeDadosAdicionais(dadosModalDraft, dadosModalServico.tipo_servico);
    const now = new Date().toISOString();

    setDadosModalSaving(true);
    try {
      const localUpdated: Servico = {
        ...dadosModalServico,
        dados_adicionais: payload,
        updated_at: now,
        sync_status: 'offline',
        error_message: null,
      };

      await saveServicoLocal(localUpdated as any);

      if (isOnline && isUuid(dadosModalServico.id) && isUuid(dadosModalServico.obra_id)) {
        const { error } = await supabase
          .from('servicos')
          .update({
            dados_adicionais: payload,
            updated_at: now,
            sync_status: 'synced',
            error_message: null,
          })
          .eq('id', dadosModalServico.id);

        if (!error) {
          await saveServicoLocal({
            ...localUpdated,
            sync_status: 'synced',
          } as any);
        }
      }

      closeDadosServicoModal();
      await loadData({ showSpinner: false });
      Alert.alert('Pronto', 'Dados do serviço salvos.');
    } catch (error) {
      console.error('Erro ao salvar dados do serviço:', error);
      Alert.alert('Erro', 'Não foi possível salvar os dados do serviço.');
    } finally {
      setDadosModalSaving(false);
    }
  };

  const handleSyncAllDrafts = useCallback(async (silent = false) => {
    const withTimeout = async <T,>(promise: Promise<T>, timeoutMs: number, message: string): Promise<T> => {
      let timer: ReturnType<typeof setTimeout> | null = null;
      try {
        return await Promise.race<T>([
          promise,
          new Promise<T>((_, reject) => {
            timer = setTimeout(() => reject(new Error(message)), timeoutMs);
          }),
        ]);
      } finally {
        if (timer) clearTimeout(timer);
      }
    };

    // Evitar sincronização repetida em menos de 5 segundos
    const now = Date.now();
    if (now - lastSyncTime < 5000) {
      logger.sync(`[sync-cooldown] Aguardando cooldown de sync (${5000 - (now - lastSyncTime)}ms)`);
      return;
    }

    if (!isOnline || syncingAllDrafts) {
      return;
    }

    setLastSyncTime(now);
    setSyncingAllDrafts(true);
    try {
      const [obrasResult, servicosResult] = await withTimeout(
        Promise.all([
          syncAllPendingObras(),
          syncAllPendingServicos(),
        ]),
        120000,
        'Tempo limite excedido na sincronização dos pendentes.'
      );

      const successCount = (obrasResult?.success || 0) + (servicosResult?.success || 0);
      const failedCount = (obrasResult?.failed || 0) + (servicosResult?.failed || 0);

      await loadData({ showSpinner: false });

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
  }, [isOnline, syncingAllDrafts, lastSyncTime, loadData]);

  useEffect(() => {
    if (onlineTransitionRef.current === null) {
      onlineTransitionRef.current = isOnline;
      return;
    }

    const cameBackOnline = onlineTransitionRef.current === false && isOnline === true;
    onlineTransitionRef.current = isOnline;

    if (cameBackOnline) {
      logger.sync('[net] Conexao restaurada: iniciando sync automatico dos pendentes');
      if (totalPendingCount > 0) {
        void handleSyncAllDrafts(true);
      }
    }
  }, [isOnline, totalPendingCount, handleSyncAllDrafts]);

  const filterButton = (value: FilterType, label: string) => (
    <TouchableOpacity
      key={value}
      style={[styles.filterChip, filter === value && styles.filterChipActive]}
      onPress={() => setFilter(value)}
    >
      <Text style={[styles.filterChipText, filter === value && styles.filterChipTextActive]}>{label}</Text>
    </TouchableOpacity>
  );

  const dadosModalMultiPontos = isMultiPointServico(dadosModalServico?.tipo_servico);
  const dadosModalTransformador = isTransformadorServico(dadosModalServico?.tipo_servico);
  const dadosModalModoSalvoRaw = String((dadosModalServico as any)?.dados_adicionais?.transformador_modo || '').toLowerCase();
  const dadosModalModoSalvo =
    dadosModalModoSalvoRaw === 'instalado' || dadosModalModoSalvoRaw === 'retirado' || dadosModalModoSalvoRaw === 'ambos'
      ? dadosModalModoSalvoRaw
      : '';
  const dadosModalModoBloqueado = !!dadosModalModoSalvo;

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

        {!isOnline && (
          <View style={styles.offlineBanner}>
            <Ionicons name="cloud-offline-outline" size={22} color="#F8FAFC" />
            <View style={styles.offlineBannerTexts}>
              <Text style={styles.offlineBannerTitle}>SEM CONEXAO</Text>
              <Text style={styles.offlineBannerSub}>Fotos salvas no celular - enviadas quando tiver sinal</Text>
            </View>
          </View>
        )}

        <View style={styles.topActions}>
          <TouchableOpacity style={styles.primaryAction} onPress={handleStartAddService}>
            <Text style={styles.primaryActionText}>+ Novo Serviço</Text>
          </TouchableOpacity>
          {totalPendingCount > 0 && (
            <TouchableOpacity
              style={[styles.secondaryAction, (!isOnline || syncingAllDrafts) && styles.secondaryActionDisabled]}
              onPress={() => void handleSyncAllDrafts(false)}
              disabled={!isOnline || syncingAllDrafts}
            >
              <Text style={styles.secondaryActionText}>
                {syncingAllDrafts
                  ? 'Sincronizando...'
                  : `Sincronizar Pendências (${totalPendingCount})`}
              </Text>
            </TouchableOpacity>
          )}
        </View>

        <View style={styles.filtersWrapper}>
          {filterButton('todos', 'Todos')}
          {filterButton('andamento', 'Em andamento')}
          {filterButton('concluidos', 'Concluídos')}
          {filterButton('pendentes', 'Sem foto')}
        </View>

        {createdServiceToast && (
          <Animated.View style={[styles.createdToast, { opacity: createdToastOpacity }]}>
            <Text style={styles.createdToastText}>{createdServiceToast}</Text>
          </Animated.View>
        )}

        {loading ? (
          <View style={styles.centered}><ActivityIndicator size="large" color="#1d4ed8" /></View>
        ) : (
          <ScrollView
            ref={listScrollRef}
            style={styles.listScroll}
            contentContainerStyle={[
              styles.content,
              { paddingBottom: Math.max(insets.bottom + 96, 120) },
            ]}
            onContentSizeChange={() => {
              if (!shouldScrollToEnd) return;
              requestAnimationFrame(() => {
                listScrollRef.current?.scrollToEnd({ animated: true });
              });
              setShouldScrollToEnd(false);
            }}
          >

            {filteredServicos.length === 0 ? (
              <View style={[styles.emptyCard, styles.listItemSpacing]}>
                <Text style={styles.emptyTitle}>Nenhum book para este filtro</Text>
              </View>
            ) : (
              filteredServicos.map((servico, index) => {
                const isLegacyFlow = servico.id.startsWith('legacy-') || usesLegacyDetalheFlow(servico.tipo_servico, (servico as any).client_pk);
                const allowLegacyFallback = shouldHydrateFromLegacyObra(servico);
                const legacyObra = isLegacyFlow && allowLegacyFallback ? findLegacyObraForServico(servico) : null;
                const scopedLegacyDataRaw = buildScopedLegacyDataForServico(
                  servico,
                  allowLegacyFallback
                    ? (legacyObra || (servico.id.startsWith('legacy-') ? (servico as any as ObraListItem) : null))
                    : null
                );
                const isPosteScopedServico = ['Linha Viva', 'Cava em Rocha', 'Book de Aterramento', 'Fundação Especial']
                  .includes(String(servico.tipo_servico || '').trim());
                const scopedLegacyData = isPosteScopedServico
                  ? {
                      ...scopedLegacyDataRaw,
                      postes_data: sanitizePostesDataForServico(
                        (scopedLegacyDataRaw as any).postes_data,
                        String(servico.id || ''),
                        false
                      ),
                    }
                  : scopedLegacyDataRaw;
                const legacyData = legacyObra
                  ? { ...legacyObra, ...scopedLegacyData }
                  : scopedLegacyData;

                return (
                  <View
                    key={`${servico.obra_id}-${servico.id}-${index}`}
                    style={[
                      styles.serviceItemSpacing,
                      recentlyCreatedServicoId === servico.id && styles.serviceItemNewlyCreated,
                    ]}
                  >
                    <ServiceCard
                      service={servico}
                      isExpanded={expandedServicoId === servico.id}
                      usesLegacyFlow={isLegacyFlow}
                      legacyData={legacyData}
                      onToggleExpand={() => {
                        LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
                        setExpandedServicoId(expandedServicoId === servico.id ? null : servico.id);
                      }}
                      onOpenDetails={
                        () => {
                          if (isLegacyFlow) {
                            openLegacyServicoDetalhe(servico, undefined, legacyObra, scopedLegacyData);
                            return;
                          }
                          if (SERVICOS_COM_POSTES_SCREEN.has(servico.tipo_servico)) {
                            void openPostesRegistro(servico);
                            return;
                          }
                          if (servico.tipo_servico === 'Transformador' && !usesLegacyDetalheFlow(servico.tipo_servico, (servico as any).client_pk)) {
                            void openTransformador(servico);
                            return;
                          }
                          if (servico.tipo_servico === 'Checklist de Fiscalização' && !usesLegacyDetalheFlow(servico.tipo_servico, (servico as any).client_pk)) {
                            void openChecklistFiscalizacao(servico);
                            return;
                          }
                          openDadosServicoModal(servico);
                        }
                      }
                      onCapturePhoto={(servicoId, category) => {
                        void servicoId; // o card já está no contexto de `servico`
                        openServicoPhotoCapture(servico, category);
                      }}
                      onPhotoViewer={(photo) => {
                        if (photo.uri || photo.url) {
                          setPhotoViewerScale(1);
                          setPhotoViewerUri(photo.uri || photo.url || null);
                        }
                      }}
                      onMarkComplete={(servicoId) => {
                        void servicoId; // evita lookup por id que pode conflitar em listas mistas
                        handleMarkServiceComplete(servico);
                      }}
                    />
                  </View>
                );
              })
            )}
          </ScrollView>
        )}

        {/* Equipe picker — exibido antes do ServiceTypeSelector para admin/supervisor */}
        <Modal
          visible={equipePickerVisible}
          animationType="slide"
          transparent
          statusBarTranslucent
          onRequestClose={() => { setEquipePickerVisible(false); setEquipePickerSearch(''); }}
        >
          <TouchableOpacity
            style={styles.detailsOverlay}
            onPress={() => { setEquipePickerVisible(false); setEquipePickerSearch(''); }}
            activeOpacity={1}
          >
            <TouchableOpacity activeOpacity={1} style={styles.detailsModal}>
              <View style={{ width: 36, height: 4, borderRadius: 2, backgroundColor: '#CBD5E1', alignSelf: 'center', marginBottom: 14 }} />
              <Text style={styles.detailsTitle}>Equipe do Serviço</Text>
              <Text style={styles.detailsSubtitle}>Selecione a equipe que executará este serviço</Text>

              {/* Busca */}
              <View style={styles.equipeSearchBox}>
                <Ionicons name="search-outline" size={16} color="#94A3B8" />
                <TextInput
                  style={styles.equipeSearchInput}
                  placeholder="Buscar equipe..."
                  placeholderTextColor="#94A3B8"
                  value={equipePickerSearch}
                  onChangeText={setEquipePickerSearch}
                  autoCapitalize="characters"
                  returnKeyType="done"
                />
                {equipePickerSearch.length > 0 && (
                  <TouchableOpacity onPress={() => setEquipePickerSearch('')} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
                    <Ionicons name="close-circle" size={16} color="#CBD5E1" />
                  </TouchableOpacity>
                )}
              </View>

              <ScrollView showsVerticalScrollIndicator={false} style={{ maxHeight: 320 }} keyboardShouldPersistTaps="handled">
                {(() => {
                  const busca = equipePickerSearch.trim().toUpperCase();
                  const filtradas = equipesDisponiveis.filter(e => e.toUpperCase().includes(busca));
                  if (filtradas.length === 0) {
                    return (
                      <Text style={{ textAlign: 'center', color: '#94A3B8', paddingVertical: 24, fontSize: 14 }}>
                        Nenhuma equipe encontrada
                      </Text>
                    );
                  }
                  const grupos: Record<string, string[]> = {};
                  for (const e of filtradas) {
                    const prefixo = (e.match(/^[A-Za-z]+/) || [''])[0].toUpperCase();
                    if (!grupos[prefixo]) grupos[prefixo] = [];
                    grupos[prefixo].push(e);
                  }
                  return Object.keys(grupos).sort().map((grupo) => (
                    <View key={grupo}>
                      <View style={styles.equipeGrupoHeader}>
                        <Text style={styles.equipeGrupoLabel}>{grupo}</Text>
                      </View>
                      {grupos[grupo].map((item, idx) => {
                        const selected = equipeForService === item;
                        const isLast = idx === grupos[grupo].length - 1;
                        return (
                          <TouchableOpacity
                            key={item}
                            style={[
                              styles.equipePickerItem,
                              !isLast && styles.equipePickerItemBorder,
                              selected && styles.equipePickerItemSelected,
                            ]}
                            onPress={() => {
                              setEquipeForService(item);
                              setEquipePickerVisible(false);
                              setEquipePickerSearch('');
                              setServiceSelectorVisible(true);
                            }}
                            activeOpacity={0.7}
                          >
                            <View style={[styles.equipePickerDot, selected && styles.equipePickerDotSelected]}>
                              {selected && <View style={styles.equipePickerDotInner} />}
                            </View>
                            <Text style={[styles.equipePickerItemText, selected && styles.equipePickerItemTextSelected]}>
                              {item}
                            </Text>
                            {selected && <Ionicons name="checkmark-circle" size={18} color="#2563EB" />}
                          </TouchableOpacity>
                        );
                      })}
                    </View>
                  ));
                })()}
              </ScrollView>
              <TouchableOpacity
                style={{ marginTop: 12, paddingVertical: 10, alignItems: 'center' }}
                onPress={() => { setEquipePickerVisible(false); setEquipePickerSearch(''); }}
              >
                <Text style={{ color: '#64748B', fontSize: 14, fontWeight: '600' }}>Cancelar</Text>
              </TouchableOpacity>
            </TouchableOpacity>
          </TouchableOpacity>
        </Modal>

        <ServiceTypeSelector
          visible={serviceSelectorVisible}
          onClose={() => {
            if (creatingService) return;
            setServiceSelectorVisible(false);
            setSelectedObraIdForService(null);
          }}
          onSelect={handleCreateService}
          loading={creatingService}
          allowedTypes={allowedServiceTypesForProfile}
        />

        <Modal
          transparent
          animationType="slide"
          visible={dadosModalVisible}
          onRequestClose={closeDadosServicoModal}
        >
          <View style={styles.detailsOverlay}>
            <View style={styles.detailsModal}>
              <Text style={styles.detailsTitle}>Dados do servico</Text>
              <Text style={styles.detailsSubtitle}>{dadosModalServico?.tipo_servico || ''}</Text>

              <ScrollView style={styles.detailsForm} contentContainerStyle={styles.detailsFormContent}>
                {dadosModalTransformador && (
                  <>
                    <Text style={styles.detailsLabel}>Modo do transformador *</Text>
                    <View style={styles.modeRow}>
                      {[
                        { value: 'instalado', label: 'Instalado' },
                        { value: 'retirado', label: 'Retirado' },
                        { value: 'ambos', label: 'Ambos' },
                      ].map((option) => {
                        const active = dadosModalDraft.transformador_modo === option.value;
                        const optionDisabled = dadosModalModoBloqueado && option.value !== dadosModalModoSalvo;
                        return (
                          <TouchableOpacity
                            key={option.value}
                            style={[styles.modeChip, active && styles.modeChipActive, optionDisabled && { opacity: 0.45 }]}
                            onPress={() => {
                              if (optionDisabled) return;
                              updateDadosModalField('transformador_modo', option.value);
                            }}
                            disabled={optionDisabled}
                            activeOpacity={0.8}
                          >
                            <Text style={[styles.modeChipText, active && styles.modeChipTextActive]}>{option.label}</Text>
                          </TouchableOpacity>
                        );
                      })}
                    </View>
                    {dadosModalModoBloqueado && (
                      <Text style={styles.modeHintText}>Modo bloqueado apos salvamento inicial.</Text>
                    )}
                    {!dadosModalDraft.transformador_modo && (
                      <Text style={styles.modeHintText}>Selecione o modo para aplicar as regras corretas de fotos.</Text>
                    )}
                  </>
                )}

                <Text style={styles.detailsLabel}>Identificador</Text>
                <TextInput
                  style={styles.detailsInput}
                  value={dadosModalDraft.identificador_item}
                  onChangeText={(text) => updateDadosModalField('identificador_item', text)}
                  placeholder="Ex.: E12, PD3"
                  placeholderTextColor="#94A3B8"
                  autoCapitalize="characters"
                />

                <Text style={styles.detailsLabel}>Referencia de poste</Text>
                <View style={styles.detailsInlineRow}>
                  <TextInput
                    style={[styles.detailsInput, styles.detailsHalfInput]}
                    value={dadosModalDraft.referencia_poste_inicio}
                    onChangeText={(text) => updateDadosModalField('referencia_poste_inicio', text)}
                    placeholder="P1"
                    placeholderTextColor="#94A3B8"
                    autoCapitalize="characters"
                  />
                  <TextInput
                    style={[styles.detailsInput, styles.detailsHalfInput]}
                    value={dadosModalDraft.referencia_poste_fim}
                    onChangeText={(text) => updateDadosModalField('referencia_poste_fim', text)}
                    placeholder="P2"
                    placeholderTextColor="#94A3B8"
                    autoCapitalize="characters"
                  />
                </View>

                <Text style={styles.detailsLabel}>Observacao</Text>
                <TextInput
                  style={[styles.detailsInput, styles.detailsTextarea]}
                  value={dadosModalDraft.observacao}
                  onChangeText={(text) => updateDadosModalField('observacao', text)}
                  placeholder="Detalhes complementares"
                  placeholderTextColor="#94A3B8"
                  multiline
                  textAlignVertical="top"
                />

                {dadosModalMultiPontos && (
                  <View style={styles.pointsSection}>
                    <View style={styles.pointsHeader}>
                      <Text style={styles.pointsTitle}>Pontos e referencias</Text>
                      <TouchableOpacity style={styles.pointsAddButton} onPress={addPontoReferencia} activeOpacity={0.8}>
                        <Text style={styles.pointsAddButtonText}>+ Adicionar ponto</Text>
                      </TouchableOpacity>
                    </View>

                    {dadosModalDraft.pontos_referencia.length === 0 && (
                      <Text style={styles.pointsEmptyText}>Adicione postes/pontos para manter a mesma lógica de registro do campo.</Text>
                    )}

                    {dadosModalDraft.pontos_referencia.map((ponto, index) => (
                      <View key={ponto.id} style={styles.pointCard}>
                        <View style={styles.pointCardHeader}>
                          <Text style={styles.pointCardTitle}>Ponto {index + 1}</Text>
                          <TouchableOpacity onPress={() => removePontoReferencia(ponto.id)}>
                            <Text style={styles.pointCardRemove}>Remover</Text>
                          </TouchableOpacity>
                        </View>

                        <TextInput
                          style={styles.detailsInput}
                          value={ponto.identificador_item}
                          onChangeText={(text) => updatePontoField(ponto.id, 'identificador_item', text)}
                          placeholder="Identificador do ponto (ex.: P7, E2)"
                          placeholderTextColor="#94A3B8"
                          autoCapitalize="characters"
                        />

                        <View style={styles.detailsInlineRow}>
                          <TextInput
                            style={[styles.detailsInput, styles.detailsHalfInput]}
                            value={ponto.referencia_poste_inicio}
                            onChangeText={(text) => updatePontoField(ponto.id, 'referencia_poste_inicio', text)}
                            placeholder="Inicio"
                            placeholderTextColor="#94A3B8"
                            autoCapitalize="characters"
                          />
                          <TextInput
                            style={[styles.detailsInput, styles.detailsHalfInput]}
                            value={ponto.referencia_poste_fim}
                            onChangeText={(text) => updatePontoField(ponto.id, 'referencia_poste_fim', text)}
                            placeholder="Fim"
                            placeholderTextColor="#94A3B8"
                            autoCapitalize="characters"
                          />
                        </View>

                        <TextInput
                          style={[styles.detailsInput, styles.detailsPointTextarea]}
                          value={ponto.observacao}
                          onChangeText={(text) => updatePontoField(ponto.id, 'observacao', text)}
                          placeholder="Observacao do ponto"
                          placeholderTextColor="#94A3B8"
                          multiline
                          textAlignVertical="top"
                        />
                      </View>
                    ))}
                  </View>
                )}
              </ScrollView>

              <View style={styles.detailsActions}>
                <TouchableOpacity
                  style={[styles.detailsActionButton, styles.detailsCancelButton]}
                  onPress={closeDadosServicoModal}
                  disabled={dadosModalSaving}
                >
                  <Text style={styles.detailsCancelButtonText}>Cancelar</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={[styles.detailsActionButton, styles.detailsSaveButton, dadosModalSaving && styles.detailsSaveButtonDisabled]}
                  onPress={handleSaveDadosServico}
                  disabled={dadosModalSaving}
                >
                  {dadosModalSaving ? (
                    <ActivityIndicator size="small" color="#fff" />
                  ) : (
                    <Text style={styles.detailsSaveButtonText}>Salvar</Text>
                  )}
                </TouchableOpacity>
              </View>
            </View>
          </View>
        </Modal>

        {capturingPhotoForServico && (
          <View style={styles.photoSourceOverlay}>
            <TouchableOpacity
              style={styles.photoSourceBackdrop}
              onPress={() => setCapturingPhotoForServico(null)}
              activeOpacity={1}
            />
            <View style={styles.photoSourceModal}>
              <View style={styles.photoSourceHandle} />
              <Text style={styles.photoSourceTitle}>Como adicionar a foto?</Text>
              <TouchableOpacity style={styles.photoSourceButton} onPress={capturePhotoFromCamera} disabled={captureLoading}>
                <Ionicons name="camera" size={38} color="#fff" />
                <Text style={styles.photoSourceButtonText}>TIRAR FOTO</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.photoSourceButton, styles.photoSourceButtonGallery]}
                onPress={selectPhotoFromGallery}
                disabled={captureLoading}
              >
                <Ionicons name="images" size={38} color="#DC2626" />
                <Text style={[styles.photoSourceButtonText, styles.photoSourceButtonTextGallery]}>DA GALERIA</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={styles.photoSourceButtonCancel}
                onPress={() => setCapturingPhotoForServico(null)}
                disabled={captureLoading}
              >
                <Text style={styles.photoSourceButtonTextCancel}>Cancelar</Text>
              </TouchableOpacity>
              {captureLoading && <ActivityIndicator size="large" color="#DC2626" style={{ marginTop: 12 }} />}
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

        {/* Overlay de sucesso ao marcar completo */}
        {successLabel !== null && (
          <Animated.View style={[styles.successOverlay, { opacity: successOpacity }]} pointerEvents="none">
            <View style={styles.successBox}>
              <Ionicons name="checkmark-circle" size={56} color="#059669" style={styles.successIcon} />
              <Text style={styles.successTitle}>Concluido!</Text>
              <Text style={styles.successSub} numberOfLines={2}>{successLabel}</Text>
            </View>
          </Animated.View>
        )}
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: { flex: 1, backgroundColor: '#eef2f6' },
  container: { flex: 1, backgroundColor: '#eef2f6' },
  offlineBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#1E293B',
    marginHorizontal: 14,
    marginTop: 4,
    marginBottom: 6,
    borderRadius: 12,
    paddingVertical: 10,
    paddingHorizontal: 14,
    gap: 10,
  },
  offlineBannerIcon: { fontSize: 22 },
  offlineBannerTexts: { flex: 1 },
  offlineBannerTitle: { color: '#F8FAFC', fontWeight: '800', fontSize: 13, letterSpacing: 0.5 },
  offlineBannerSub: { color: '#94A3B8', fontSize: 12, marginTop: 1 },
  successOverlay: {
    position: 'absolute',
    top: 0, left: 0, right: 0, bottom: 0,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: 'rgba(0,0,0,0.45)',
    zIndex: 999,
  },
  successBox: {
    backgroundColor: '#fff',
    borderRadius: 24,
    paddingVertical: 36,
    paddingHorizontal: 48,
    alignItems: 'center',
    shadowColor: '#000',
    shadowOpacity: 0.25,
    shadowRadius: 20,
    elevation: 12,
    minWidth: 200,
  },
  successIcon: { marginBottom: 12 },
  successTitle: { fontSize: 24, fontWeight: '800', color: '#059669', marginBottom: 6 },
  successSub: { fontSize: 14, color: '#6B7280', textAlign: 'center', maxWidth: 200 },
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
  content: { paddingHorizontal: 14, paddingTop: 0, paddingBottom: 120 },
  listItemSpacing: { marginBottom: 8 },
  serviceItemSpacing: { marginBottom: 10 },
  serviceItemNewlyCreated: {
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#22c55e',
    backgroundColor: '#f0fdf4',
    padding: 2,
  },
  createdToast: {
    marginHorizontal: 14,
    marginBottom: 10,
    borderRadius: 12,
    backgroundColor: '#0f172a',
    paddingHorizontal: 12,
    paddingVertical: 10,
    borderWidth: 1,
    borderColor: '#1d4ed8',
    shadowColor: '#000',
    shadowOpacity: 0.15,
    shadowRadius: 8,
    elevation: 5,
  },
  createdToastText: {
    color: '#F8FAFC',
    fontWeight: '700',
    fontSize: 13,
    textAlign: 'center',
  },
  centered: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  syncHintCard: { backgroundColor: '#fff3cd', borderRadius: 10, padding: 12, borderWidth: 1, borderColor: '#fde68a' },
  syncHintText: { color: '#7c4a03', fontWeight: '600', marginBottom: 8 },
  syncHintButton: { backgroundColor: '#d97706', borderRadius: 8, paddingVertical: 10, alignItems: 'center' },
  syncHintButtonText: { color: '#fff', fontWeight: '700' },
  emptyCard: { backgroundColor: '#fff', borderRadius: 12, padding: 16 },
  emptyTitle: { fontSize: 16, fontWeight: '700', color: '#111827' },
  detailsOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'flex-end',
  },
  detailsModal: {
    backgroundColor: '#FFF',
    borderTopLeftRadius: 18,
    borderTopRightRadius: 18,
    paddingHorizontal: 16,
    paddingTop: 18,
    paddingBottom: 16,
    maxHeight: '88%',
  },
  detailsTitle: {
    fontSize: 18,
    fontWeight: '800',
    color: '#0F172A',
    textAlign: 'center',
  },
  detailsSubtitle: {
    marginTop: 4,
    marginBottom: 12,
    textAlign: 'center',
    color: '#475569',
    fontSize: 13,
    fontWeight: '600',
  },
  detailsForm: {
    maxHeight: '75%',
  },
  detailsFormContent: {
    paddingBottom: 8,
  },
  detailsLabel: {
    fontSize: 12,
    fontWeight: '700',
    color: '#475569',
    marginTop: 6,
    marginBottom: 6,
  },
  modeRow: {
    flexDirection: 'row',
    gap: 8,
    marginBottom: 6,
  },
  modeChip: {
    flex: 1,
    minHeight: 38,
    borderRadius: 999,
    borderWidth: 1,
    borderColor: '#cbd5e1',
    backgroundColor: '#f8fafc',
    alignItems: 'center',
    justifyContent: 'center',
  },
  modeChipActive: {
    backgroundColor: '#dbeafe',
    borderColor: '#1d4ed8',
  },
  modeChipText: {
    fontSize: 12,
    color: '#334155',
    fontWeight: '700',
  },
  modeChipTextActive: {
    color: '#1d4ed8',
  },
  modeHintText: {
    color: '#92400E',
    fontSize: 12,
    fontWeight: '600',
    marginBottom: 4,
  },
  detailsInput: {
    borderWidth: 1,
    borderColor: '#dbe2ea',
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 10,
    fontSize: 14,
    color: '#0f172a',
    backgroundColor: '#fff',
  },
  detailsInlineRow: {
    flexDirection: 'row',
    gap: 8,
  },
  detailsHalfInput: {
    flex: 1,
  },
  detailsTextarea: {
    minHeight: 84,
  },
  pointsSection: {
    marginTop: 14,
    paddingTop: 10,
    borderTopWidth: 1,
    borderTopColor: '#e5e7eb',
  },
  pointsHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  pointsTitle: {
    fontSize: 13,
    color: '#334155',
    fontWeight: '800',
  },
  pointsAddButton: {
    backgroundColor: '#e0e7ff',
    borderRadius: 999,
    paddingHorizontal: 10,
    paddingVertical: 6,
  },
  pointsAddButtonText: {
    color: '#1d4ed8',
    fontSize: 12,
    fontWeight: '700',
  },
  pointsEmptyText: {
    fontSize: 12,
    color: '#64748b',
    fontStyle: 'italic',
  },
  pointCard: {
    marginTop: 8,
    borderWidth: 1,
    borderColor: '#e2e8f0',
    borderRadius: 10,
    padding: 10,
    gap: 8,
    backgroundColor: '#f8fafc',
  },
  pointCardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  pointCardTitle: {
    fontSize: 13,
    fontWeight: '800',
    color: '#1e293b',
  },
  pointCardRemove: {
    color: '#dc2626',
    fontSize: 12,
    fontWeight: '700',
  },
  detailsPointTextarea: {
    minHeight: 68,
  },
  detailsActions: {
    flexDirection: 'row',
    gap: 8,
    marginTop: 12,
  },
  detailsActionButton: {
    flex: 1,
    minHeight: 44,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
  },
  detailsCancelButton: {
    backgroundColor: '#e5e7eb',
  },
  detailsCancelButtonText: {
    color: '#334155',
    fontWeight: '700',
    fontSize: 14,
  },
  detailsSaveButton: {
    backgroundColor: '#1d4ed8',
  },
  detailsSaveButtonDisabled: {
    backgroundColor: '#93c5fd',
  },
  detailsSaveButtonText: {
    color: '#fff',
    fontWeight: '700',
    fontSize: 14,
  },
  photoSourceOverlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    justifyContent: 'flex-end',
    zIndex: 1000,
  },
  photoSourceBackdrop: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(0,0,0,0.4)',
  },
  photoSourceModal: {
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
  photoSourceButton: {
    backgroundColor: '#DC2626',
    borderRadius: 14,
    minHeight: 80,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
  },
  photoSourceButtonText: {
    color: '#fff',
    fontWeight: '800',
    fontSize: 13,
    letterSpacing: 0.4,
  },
  photoSourceButtonGallery: {
    backgroundColor: '#fff',
    borderWidth: 1,
    borderColor: '#FCA5A5',
  },
  photoSourceButtonCancel: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 10,
  },
  photoSourceButtonTextGallery: {
    color: '#DC2626',
  },
  photoSourceButtonTextCancel: {
    color: '#64748B',
    fontWeight: '700',
    fontSize: 14,
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

  // Equipe picker
  equipeSearchBox: {
    flexDirection: 'row', alignItems: 'center', gap: 8,
    backgroundColor: '#F1F5F9', borderRadius: 10,
    paddingHorizontal: 12, paddingVertical: 9,
    marginBottom: 12,
  },
  equipeSearchInput: {
    flex: 1, fontSize: 14, color: '#0F172A', padding: 0,
  },
  equipeGrupoHeader: {
    paddingTop: 12, paddingBottom: 4, paddingHorizontal: 2,
  },
  equipeGrupoLabel: {
    fontSize: 11, fontWeight: '700', color: '#94A3B8',
    letterSpacing: 0.8, textTransform: 'uppercase',
  },
  equipePickerItem: {
    flexDirection: 'row', alignItems: 'center', gap: 12,
    paddingVertical: 13, paddingHorizontal: 4,
  },
  equipePickerItemBorder: {
    borderBottomWidth: 1, borderBottomColor: '#F1F5F9',
  },
  equipePickerItemSelected: {
    backgroundColor: '#EFF6FF', borderRadius: 10,
    paddingHorizontal: 10, marginHorizontal: -4,
  },
  equipePickerDot: {
    width: 18, height: 18, borderRadius: 9, borderWidth: 2,
    borderColor: '#CBD5E1', backgroundColor: 'transparent',
    alignItems: 'center', justifyContent: 'center',
  },
  equipePickerDotSelected: {
    borderColor: '#2563EB', backgroundColor: '#2563EB',
  },
  equipePickerDotInner: {
    width: 8, height: 8, borderRadius: 4, backgroundColor: '#FFF',
  },
  equipePickerItemText: {
    flex: 1, fontSize: 15, fontWeight: '500', color: '#1E293B',
  },
  equipePickerItemTextSelected: {
    color: '#1E40AF', fontWeight: '700',
  },
});
