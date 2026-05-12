/**
 * Fun?fAaAaaAaAaAaaAAAAaAaaAAAasAAaAA?f??s?,?es para sincroniza?fAaAaaAaAaAaaAAAAaAaaAAAasAAaAA?f??s?,?o de servicos
 * Sincroniza?fAaAaaAaAaAaaAAAAaAaaAAAasAAaAA?f??s?,?o isolada por servico  falha em um nao afeta outros
 */

import { supabase } from './supabase';
import { Servico, ServicoLocal, SyncStatusServico, SERVICO_PHOTO_MAP, TipoServico } from '../types/servico';
import AsyncStorage from '@react-native-async-storage/async-storage';
import NetInfo from '@react-native-community/netinfo';
import { captureError } from './sentry';
import { logger } from '../utils/logger';
import { processObraPhotos } from './photo-queue';
import { getAllPhotoMetadata, getPhotoMetadatasByIds, deletePhotoBackup, resetLostPhotosByIds, ensurePhotoMetadataFromUri, ensurePhotoMetadataById, type PhotoMetadata } from './photo-backup';
import { getLocalObras } from './offline-sync';

const PENDING_SERVICOS_KEY = '@servicos_pending_sync';
const PENDING_SERVICOS_MAP_KEY = '@servicos_pending_map'; // Maps servicoId -> obraId
const LOCAL_SERVICOS_KEY = '@servicos_local';
// Ãndice de obraIds que tÃªm dados em @servicos_local:* â€” evita getAllKeys() O(n) ao buscar serviÃ§os
const SERVICOS_OBRA_IDS_KEY = '@servicos_obra_ids';
const SERVICO_POSTES_STORAGE_TIPOS = new Set(['Linha Viva', 'Cava em Rocha', 'Book de Aterramento', 'FundaÃ§Ã£o Especial']);
const getServicoPostesStorageKey = (servicoId: string): string => `@servico_postes_data:${servicoId}`;
const SERVICO_RETRY_COUNTS_KEY = '@servicos_retry_counts'; // Maps servicoId -> nmero de falhas permanentes
const SERVICO_ID_REMAP_KEY = '@servico_id_remap'; // Maps temp-xxx -> uuid após sync

// Lock de sincroniza?fAaAaaAaAaAaaAAAAaAaaAAAasAAaAA?f??s?,?o: Map de servicoId  timestamp de incio
// Auto-expira apos SYNC_LOCK_TIMEOUT_MS para evitar bloqueio permanente em caso de crash
const currentlySyncingIds = new Map<string, number>();
const SYNC_LOCK_TIMEOUT_MS = 5 * 60 * 1000; // 5 minutos
const MAX_SERVICO_RETRIES = 5; // Mximo de tentativas antes de desistir

// Lock global para syncAllPendingServicos a evita execuAAes concorrentes (timers + telas)
// que causam INSERT duplicado quando client_pk ainda nÃ£o estÃ¡ na DB
let syncAllPendingServicosInProgress = false;

const isUuid = (value: string): boolean => {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(value);
};

const generateClientPk = (): string =>
  `svc_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 10)}${Math.random().toString(36).slice(2, 6)}`;

const ensureServicoClientPk = (servico: ServicoLocal): string => {
  const existing = String((servico as any).client_pk || '').trim();
  if (existing) return existing;
  const next = generateClientPk();
  (servico as any).client_pk = next;
  return next;
};

const dedupeStrings = (values: Array<string | null | undefined>): string[] => {
  const seen = new Set<string>();
  const out: string[] = [];
  for (const value of values) {
    if (!value) continue;
    if (seen.has(value)) continue;
    seen.add(value);
    out.push(value);
  }
  return out;
};

const toTimestampMs = (value: unknown): number | null => {
  if (!value) return null;
  const parsed = new Date(String(value)).getTime();
  return Number.isFinite(parsed) ? parsed : null;
};

const normalizeServicoTipoKey = (value: unknown): string =>
  String(value || '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .trim()
    .toLowerCase();

const countArrayEntries = (value: unknown): number =>
  Array.isArray(value) ? value.filter((item) => item !== null && item !== undefined).length : 0;

const pickFirstArray = (obj: any, keys: string[]): any[] => {
  let best: any[] = [];
  for (const key of keys) {
    const value = obj?.[key];
    if (!Array.isArray(value)) continue;
    if (value.length > best.length) {
      best = value;
    }
  }
  return best;
};

const getNestedFieldPhotoCount = (key: string, value: unknown): number => {
  if (!Array.isArray(value)) return 0;

  if (key === 'postes_data') {
    return value.reduce((sum: number, poste: any) => (
      sum +
      countArrayEntries(pickFirstArray(poste, ['fotos_antes', 'fotosAntes'])) +
      countArrayEntries(pickFirstArray(poste, ['fotos_durante', 'fotosDurante'])) +
      countArrayEntries(pickFirstArray(poste, ['fotos_depois', 'fotosDepois'])) +
      countArrayEntries(pickFirstArray(poste, ['fotos_medicao', 'fotosMedicao']))
    ), 0);
  }

  if (key === 'checklist_postes_data') {
    return value.reduce((sum: number, poste: any) => (
      sum +
      countArrayEntries(poste?.posteInteiro) +
      countArrayEntries(poste?.descricao) +
      countArrayEntries(poste?.engaste) +
      countArrayEntries(poste?.conexao1) +
      countArrayEntries(poste?.conexao2) +
      countArrayEntries(poste?.maiorEsforco) +
      countArrayEntries(poste?.menorEsforco)
    ), 0);
  }

  if (key === 'checklist_seccionamentos_data' || key === 'checklist_aterramentos_cerca_data') {
    return value.reduce((sum: number, item: any) => sum + countArrayEntries(item?.fotos), 0);
  }

  if (key === 'checklist_hastes_termometros_data') {
    return value.reduce((sum: number, item: any) => (
      sum + countArrayEntries(item?.fotoHaste) + countArrayEntries(item?.fotoTermometro)
    ), 0);
  }

  return 0;
};

const getChecklistSeccionamentosCountByTipo = (value: unknown): Record<string, number> => {
  if (!Array.isArray(value)) return {};
  const counts: Record<string, number> = {};
  for (const item of value as any[]) {
    const tipo = String(item?.tipo || '').trim().toLowerCase() || 'seccionamento';
    const fotos = Array.isArray(item?.fotos) ? item.fotos.length : 0;
    counts[tipo] = (counts[tipo] || 0) + fotos;
  }
  return counts;
};

const shouldKeepLocalNestedField = (field: string, localValue: any, remoteValue: any): boolean => {
  const localCount = getNestedFieldPhotoCount(field, localValue);
  const remoteCount = getNestedFieldPhotoCount(field, remoteValue);
  if (localCount === 0) return false;
  if (localCount >= remoteCount) return true;

  if (field === 'checklist_seccionamentos_data') {
    const localByTipo = getChecklistSeccionamentosCountByTipo(localValue);
    const remoteByTipo = getChecklistSeccionamentosCountByTipo(remoteValue);
    const tipos = new Set([...Object.keys(localByTipo), ...Object.keys(remoteByTipo)]);
    for (const tipo of tipos) {
      if ((localByTipo[tipo] || 0) > (remoteByTipo[tipo] || 0)) {
        return true;
      }
    }
  }

  return false;
};

const getServicoPhotoCount = (servico: any): number => {
  if (!servico || typeof servico !== 'object') return 0;
  let count = 0;
  for (const [key, value] of Object.entries(servico)) {
    if ((key.startsWith('fotos_') || key.startsWith('doc_')) && Array.isArray(value)) {
      count += value.length;
      continue;
    }
    if (
      key === 'postes_data' ||
      key === 'checklist_postes_data' ||
      key === 'checklist_seccionamentos_data' ||
      key === 'checklist_aterramentos_cerca_data' ||
      key === 'checklist_hastes_termometros_data'
    ) {
      count += getNestedFieldPhotoCount(key, value);
    }
  }
  return count;
};

const KNOWN_DOC_FIELDS = new Set<string>(
  Object.values(SERVICO_PHOTO_MAP)
    .flatMap((items) => items.map((item) => String(item.field)))
    .filter((field) => field.startsWith('doc_'))
);

const normalizePhotoFieldFromType = (rawType: unknown): string | null => {
  const type = String(rawType || '').trim();
  if (!type) return null;
  if (type.startsWith('fotos_') || type.startsWith('doc_')) return type;
  if (KNOWN_DOC_FIELDS.has(`doc_${type}`)) return `doc_${type}`;
  return `fotos_${type}`;
};

const extractPhotoEntryId = (entry: any): string | null => {
  if (!entry) return null;
  if (typeof entry === 'string') {
    const trimmed = entry.trim();
    return trimmed.length > 0 ? trimmed : null;
  }
  if (typeof entry === 'object') {
    const id = typeof entry.id === 'string' ? entry.id.trim() : '';
    if (id) return id;
    const photoId = typeof entry.photoId === 'string' ? entry.photoId.trim() : '';
    if (photoId) return photoId;
  }
  return null;
};

const normalizePhotoArray = (value: unknown): any[] => {
  if (Array.isArray(value)) return [...value];
  if (typeof value === 'string') {
    try {
      const parsed = JSON.parse(value);
      return Array.isArray(parsed) ? parsed : [];
    } catch {
      return [];
    }
  }
  return [];
};

const getAllowedPhotoFieldsForServico = (servico: ServicoLocal): Set<string> => {
  const allowed = new Set<string>();

  const byType = SERVICO_PHOTO_MAP[servico.tipo_servico as TipoServico] || [];
  for (const item of byType) {
    allowed.add(String(item.field));
  }

  for (const key of Object.keys(servico as any)) {
    if (!(key.startsWith('fotos_') || key.startsWith('doc_'))) continue;
    allowed.add(key);
  }

  if (allowed.size === 0) {
    allowed.add('fotos_antes');
    allowed.add('fotos_durante');
    allowed.add('fotos_depois');
  }

  return allowed;
};

const pickBestServicoRecord = (current: any, candidate: any): any => {
  if (!current) return candidate;
  if (!candidate) return current;

  const currentSync = String(current.sync_status || '');
  const candidateSync = String(candidate.sync_status || '');
  const currentIsUnsynced = currentSync === 'offline' || currentSync === 'error' || currentSync === 'syncing';
  const candidateIsUnsynced = candidateSync === 'offline' || candidateSync === 'error' || candidateSync === 'syncing';
  const currentTime = new Date(current.updated_at || current.created_at || 0).getTime();
  const candidateTime = new Date(candidate.updated_at || candidate.created_at || 0).getTime();

  // Alteracao offline/local deve prevalecer sobre snapshot remoto "synced"
  // para evitar que o status volte ao estado antigo apos reload.
  // PorÃ©m, se o snapshot "synced" for mais novo, o offline antigo Ã© stale e nÃ£o
  // deve permanecer travando a UI em pendente.
  if (currentIsUnsynced && !candidateIsUnsynced) {
    if (Number.isFinite(currentTime) && Number.isFinite(candidateTime) && candidateTime > currentTime) {
      return candidate;
    }
    return current;
  }
  if (candidateIsUnsynced && !currentIsUnsynced) {
    if (Number.isFinite(currentTime) && Number.isFinite(candidateTime) && currentTime > candidateTime) {
      return current;
    }
    return candidate;
  }

  if (candidateTime > currentTime) return candidate;
  if (candidateTime < currentTime) return current;

  const currentPhotos = getServicoPhotoCount(current);
  const candidatePhotos = getServicoPhotoCount(candidate);
  if (candidatePhotos > currentPhotos) return candidate;
  if (candidatePhotos < currentPhotos) return current;

  // Em empate (mesmo timestamp/fotos), preferir "synced" para evitar card travado
  // em pendente por snapshot offline stale.
  if (currentSync === 'synced' && candidateSync !== 'synced') return current;
  if (candidateSync === 'synced' && currentSync !== 'synced') return candidate;

  return current;
};

const getServicoFingerprint = (servico: any): string | null => {
  if (!servico || typeof servico !== 'object') return null;

  const clientPk = String(servico.client_pk || '').trim();
  if (clientPk) return `pk|${clientPk}`;

  const obraId = String(servico.obra_id || '').trim();
  const tipo = String(servico.tipo_servico || '').trim().toLowerCase();
  const createdAtMs = toTimestampMs(servico.created_at);
  if (!obraId || !tipo || createdAtMs === null) return null;

  return `${obraId}|${tipo}|${createdAtMs}`;
};

const dedupeServicosByFingerprint = <T extends Record<string, any>>(servicos: T[]): T[] => {
  if (!Array.isArray(servicos) || servicos.length <= 1) return servicos;

  const byId = new Map<string, T>();
  for (const servico of servicos) {
    const id = String((servico as any)?.id || '').trim();
    if (!id) continue;
    const current = byId.get(id);
    byId.set(id, pickBestServicoRecord(current, servico));
  }

  const byFingerprint = new Map<string, T>();
  const withoutFingerprint: T[] = [];

  for (const servico of byId.values()) {
    const fingerprint = getServicoFingerprint(servico);
    if (!fingerprint) {
      withoutFingerprint.push(servico);
      continue;
    }
    const current = byFingerprint.get(fingerprint);
    byFingerprint.set(fingerprint, pickBestServicoRecord(current, servico));
  }

  return [...withoutFingerprint, ...byFingerprint.values()].sort((a, b) => {
    const ta = new Date((a as any)?.created_at || 0).getTime();
    const tb = new Date((b as any)?.created_at || 0).getTime();
    return ta - tb;
  });
};

const getDadosAdicionais = (value: any): Record<string, any> | null => {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return null;
  return value as Record<string, any>;
};

const mergeDadosAdicionaisPreservingLocal = (localValue: any, remoteValue: any): Record<string, any> | null => {
  const local = getDadosAdicionais(localValue);
  const remote = getDadosAdicionais(remoteValue);
  if (!local && !remote) return null;
  if (!local) return remote;
  if (!remote) return local;
  return { ...local, ...remote };
};

async function resolveRelatedObraIds(obraId: string): Promise<string[]> {
  const base = dedupeStrings([obraId]);
  try {
    const localObras = await getLocalObras();
    const related = localObras.filter((obra: any) => obra?.id === obraId || obra?.serverId === obraId);
    for (const obra of related) {
      base.push(...dedupeStrings([obra.serverId, obra.id]));
    }
  } catch {
    // Falha ao carregar obras locais nao pode bloquear fluxo dos servicos.
  }

  return dedupeStrings(base);
}

const extractMissingColumnFromSchemaError = (error: any): string | null => {
  const code = error?.code;
  const message: string = error?.message || '';
  if (code !== 'PGRST204') return null;

  const match = message.match(/Could not find the '([^']+)' column/i);
  return match?.[1] || null;
};

const pickClosestServicoByCreatedAt = (rows: any[], targetCreatedAt: string): any | null => {
  if (!Array.isArray(rows) || rows.length === 0) return null;
  const targetMs = toTimestampMs(targetCreatedAt);
  if (targetMs === null) return rows[0] || null;

  return [...rows].sort((a, b) => {
    const diffA = Math.abs((toTimestampMs((a as any)?.created_at) ?? Number.MAX_SAFE_INTEGER) - targetMs);
    const diffB = Math.abs((toTimestampMs((b as any)?.created_at) ?? Number.MAX_SAFE_INTEGER) - targetMs);
    if (diffA !== diffB) return diffA - diffB;
    return getServicoPhotoCount(b) - getServicoPhotoCount(a);
  })[0] || null;
};

async function findExistingServicoByTemporalFingerprint(servicoLocal: ServicoLocal): Promise<any | null> {
  const createdAtMs = toTimestampMs(servicoLocal.created_at);
  if (!servicoLocal.obra_id || !servicoLocal.tipo_servico || createdAtMs === null) {
    return null;
  }

  const windowStart = new Date(createdAtMs - 12000).toISOString();
  const windowEnd = new Date(createdAtMs + 12000).toISOString();

  try {
    let query = supabase
      .from('servicos')
      .select('*')
      .eq('obra_id', servicoLocal.obra_id)
      .eq('tipo_servico', servicoLocal.tipo_servico)
      .gte('created_at', windowStart)
      .lte('created_at', windowEnd)
      .order('created_at', { ascending: true })
      .limit(10);

    if (servicoLocal.responsavel && String(servicoLocal.responsavel).trim().length > 0) {
      query = query.eq('responsavel', servicoLocal.responsavel);
    }

    const { data, error } = await query;
    if (error) {
      logger.warn('[syncServico] Falha ao buscar servico existente por janela temporal:', error);
      return null;
    }

    // Filtra resultados: exclui registros que jÃ¡ possuem um client_pk diferente do serviÃ§o local.
    // Esses sÃ£o serviÃ§os DISTINTOS (criados separadamente) que sÃ³ coincidiram na janela temporal.
    // Sem este filtro, dois serviÃ§os do mesmo tipo criados em <12s sobreescrevem um ao outro.
    const localClientPk = String(servicoLocal.client_pk || '').trim();
    const filtered = (data || []).filter((row: any) => {
      const rowClientPk = String(row.client_pk || '').trim();
      if (!rowClientPk) return true; // sem client_pk: registro prÃ©-migraÃ§Ã£o, pode ser o mesmo
      return rowClientPk === localClientPk; // sÃ³ considera match se for o mesmo client_pk
    });

    return pickClosestServicoByCreatedAt(filtered, servicoLocal.created_at);
  } catch (error) {
    logger.warn('[syncServico] Excecao ao buscar servico existente por janela temporal:', error);
    return null;
  }
}

/**
 * Status de sincroniza?fAaAaaAaAaAaaAAAAaAaaAAAasAAaAA?f??s?,?o global de servicos
 */
export interface SyncStatusServicos {
  totalServicos: number;
  syncedServicos: number;
  pendingServicos: number;
  errorServicos: number;
}

/**
 * Obtm todos os servicos locais de uma obra
 */
export async function getLocalServicos(obraId: string): Promise<ServicoLocal[]> {
  try {
    const relatedObraIds = await resolveRelatedObraIds(obraId);
    const keys = relatedObraIds.map((id) => `${LOCAL_SERVICOS_KEY}:${id}`);
    const entries = await AsyncStorage.multiGet(keys);

    const mergedById = new Map<string, ServicoLocal>();

    for (const [, raw] of entries) {
      if (!raw) continue;
      const parsed: ServicoLocal[] = JSON.parse(raw);
      for (const servico of parsed) {
        const current = mergedById.get(servico.id);
        mergedById.set(servico.id, pickBestServicoRecord(current, servico));
      }
    }

    return dedupeServicosByFingerprint(Array.from(mergedById.values()));
  } catch (error) {
    logger.error('Erro ao buscar servicos locais:', error);
    return [];
  }
}

/**
 * Salva servico localmente (offline)
 */
export async function saveServicoLocal(servico: ServicoLocal): Promise<void> {
  try {
    const pendingKey = PENDING_SERVICOS_KEY;
    const mapKey = PENDING_SERVICOS_MAP_KEY;
    const localKey = `${LOCAL_SERVICOS_KEY}:${servico.obra_id}`;

    const [[, pendingRaw], [, mapRaw], [, storedRaw], [, obraIdsRaw]] = await AsyncStorage.multiGet([
      pendingKey,
      mapKey,
      localKey,
      SERVICOS_OBRA_IDS_KEY,
    ]);

    const pendingList: string[] = pendingRaw ? JSON.parse(pendingRaw) : [];
    const mapObj: Record<string, string> = mapRaw ? JSON.parse(mapRaw) : {};
    const shouldBePending = servico.sync_status !== 'synced';
    if (shouldBePending) {
      if (!pendingList.includes(servico.id)) {
        pendingList.push(servico.id);
      }
      mapObj[servico.id] = servico.obra_id;
    } else {
      const filteredPending = pendingList.filter((id) => id !== servico.id);
      pendingList.length = 0;
      pendingList.push(...filteredPending);
      delete mapObj[servico.id];
    }

    const servicos: ServicoLocal[] = storedRaw ? JSON.parse(storedRaw) : [];
    const idx = servicos.findIndex((s) => s.id === servico.id);
    if (idx >= 0) {
      servicos[idx] = servico;
    } else {
      servicos.push(servico);
    }

    const obraIds: string[] = obraIdsRaw ? JSON.parse(obraIdsRaw) : [];
    const needsIndexUpdate = !obraIds.includes(servico.obra_id);
    if (needsIndexUpdate) obraIds.push(servico.obra_id);

    const multiSetPairs: [string, string][] = [
      [pendingKey, JSON.stringify(pendingList)],
      [mapKey, JSON.stringify(mapObj)],
      [localKey, JSON.stringify(servicos)],
    ];
    if (needsIndexUpdate) multiSetPairs.push([SERVICOS_OBRA_IDS_KEY, JSON.stringify(obraIds)]);
    await AsyncStorage.multiSet(multiSetPairs);
  } catch (error) {
    logger.error('Erro ao salvar servico localmente:', error);
    captureError(error);
  }
}

/**
 * Resolve fotos salvas localmente para FotoInfo com url publica.
 * Suporta dois formatos de entrada:
 *  - string (photoId puro  formato legado do cdigo anterior)
 *  - objeto { id, uri, ... } (formato novo  salvo apos a corre?fAaAaaAaAaAaaAAAAaAaaAAAasAAaAA?f??s?,?o de appendPhotoToServicoLocal)
 * Itens que ja possuem { url } so retornados sem altera?fAaAaaAaAaAaaAAAAaAaaAAAasAAaAA?f??s?,?o.
 */
async function resolveLocalPhotosToUrls(
  fotosField: any[],
  obraId: string
): Promise<any[]> {
  if (!fotosField || fotosField.length === 0) return fotosField;

  // Itens que precisam de upload: strings, objetos com id sem url, ou url nao-HTTP (caminho local)
  const needsUpload = fotosField.filter((item: any) => {
    if (typeof item === 'string') return item.length > 0;
    if (!item || typeof item !== 'object' || (!item.id && !item.photoId)) return false;
    if (!item.url) return true; // sem url  precisa upload
    // url que  caminho local (nao comea com http)  precisa re-upload para URL real
    return !String(item.url).startsWith('http');
  });

  if (needsUpload.length === 0) return fotosField;

  // processObraPhotos e getPhotoMetadatasByIds ja importados no topo do arquivo

  const localPhotoIds: string[] = needsUpload.map((item: any) =>
    typeof item === 'string' ? item : (item.id || item.photoId)
  ).filter(Boolean);

  // Garante que cada foto com `uri` local está no metadata ativo.
  // Cria entrada nova se não existir (metadata perdido) ou reseta flag `lost`
  // (fotos que atingiram MAX_RETRIES mas cujo arquivo físico ainda existe).
  try {
    for (const item of needsUpload) {
      if (typeof item === 'string' && item.length > 0) {
        // Plain string ID (old format): scan backup dir to discover file and create metadata
        await ensurePhotoMetadataById(item, obraId);
        continue;
      }
      if (typeof item !== 'object' || !item) continue;
      const photoId = item.id || item.photoId;
      const uri = item.uri || item.compressedPath;
      if (!photoId || !uri || !String(uri).startsWith('file:')) continue;
      await ensurePhotoMetadataFromUri(photoId, uri, obraId, item.latitude ?? null, item.longitude ?? null);
    }
  } catch {
    // nao critico
  }

  // Reseta fotos marcadas como "lost" que possam ter URI valido
  try {
    const resetCount = await resetLostPhotosByIds(localPhotoIds);
    if (resetCount > 0) {
      logger.photos(`[resolveLocalPhotosToUrls] ${resetCount} foto(s) "lost" resetadas para re-tentativa`);
    }
  } catch {
    // nao critico
  }

  // Tenta fazer upload dos arquivos locais (falha silenciosa se o arquivo nao existir)
  try {
    await processObraPhotos(obraId, undefined, localPhotoIds);
  } catch {
    // Ignora erro de upload e mantem URI local para exibicao offline
  }

  // Busca metadados apenas dos IDs relevantes para montar o mapa (URL + geo)
  const allMetadata = await getPhotoMetadatasByIds(localPhotoIds);

  type ResolvedMeta = { url: string; latitude?: number | null; longitude?: number | null; utmX?: number | null; utmY?: number | null; utmZone?: string | null };
  const metaMap: Record<string, ResolvedMeta> = {};

  for (const photoId of localPhotoIds) {
    // Estrategia 1: ID exato com URL disponivel
    const exact = allMetadata.find(
      (m) => m.id === photoId && (m.uploadUrl || m.supabaseUrl)
    );
    if (exact) {
      metaMap[photoId] = {
        url: (exact.uploadUrl || exact.supabaseUrl)!,
        latitude: exact.latitude,
        longitude: exact.longitude,
        utmX: exact.utmX,
        utmY: exact.utmY,
        utmZone: exact.utmZone,
      };
      continue;
    }

    // Estrategia 2: extrai obraId e tipo do formato {obraId}_{tipo}_{idx}_{ts}
    // e busca qualquer foto desse obraId + tipo que tenha URL.
    // O tipo pode ser multi-segmento (ex: transformador_tape, transformador_conexoes_primarias_instalado).
    // Removendo os 2 ultimos segmentos (idx e timestamp) recuperamos o tipo completo.
    const uuidMatch = photoId.match(
      /^([0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12})/i
    );
    if (uuidMatch) {
      const extractedObraId = uuidMatch[1];
      const afterUuid = photoId.slice(extractedObraId.length + 1);
      const parts = afterUuid.split('_');
      const extractedType = parts.length >= 3 ? parts.slice(0, -2).join('_') : parts[0];

      const byObraAndType = allMetadata.find(
        (m) =>
          (m.obraId === extractedObraId || m.obraId === obraId) &&
          m.type === extractedType &&
          (m.uploadUrl || m.supabaseUrl)
      );
      if (byObraAndType) {
        metaMap[photoId] = {
          url: (byObraAndType.uploadUrl || byObraAndType.supabaseUrl)!,
          latitude: byObraAndType.latitude,
          longitude: byObraAndType.longitude,
          utmX: byObraAndType.utmX,
          utmY: byObraAndType.utmY,
          utmZone: byObraAndType.utmZone,
        };
      }
    }
  }

  return fotosField.map((item: any) => {
    const photoId = typeof item === 'string' ? item : (item?.id || item?.photoId);
    const resolved = photoId ? metaMap[photoId] : null;

    if (resolved) {
      // Monta FotoInfo completo: url publica + geolocaliza?fAaAaaAaAaAaaAAAAaAaaAAAasAAaAA?f??s?,?o UTM da metadata
      // Mantm `id` para permitir matching na recupera?fAaAaaAaAaAaaAAAAaAaaAAAasAAaAA?f??s?,?o, remove apenas `uri` local
      const baseObj = typeof item === 'object' ? item : {};
      const { uri, ...rest } = baseObj; // preserva id, descarta apenas caminho local
      return {
        id: rest.id || rest.photoId || photoId,
        ...rest,
        url: resolved.url,
        // Geo: prefere o do objeto local (salvo pelo geoData), fallback para metadata
        latitude: rest.latitude ?? resolved.latitude ?? null,
        longitude: rest.longitude ?? resolved.longitude ?? null,
        utm_x: rest.utm_x ?? resolved.utmX ?? null,
        utm_y: rest.utm_y ?? resolved.utmY ?? null,
        utm_zone: rest.utm_zone ?? resolved.utmZone ?? null,
      };
    }
    // Upload falhou  manter URI local para o preview continuar funcionando
    return item;
  });
}

async function resolveNestedServicoPhotosToUrls(servicoLocal: ServicoLocal, obraId: string): Promise<{
  postes_data: any;
  checklist_postes_data: any;
  checklist_seccionamentos_data: any;
  checklist_aterramentos_cerca_data: any;
  checklist_hastes_termometros_data: any;
}> {
  // Preserva fotos com URI mesmo se upload falhar — elas ainda podem ser exibidas offline
  const resolveArrayFieldPreservingLocal = async (value: any) => {
    if (!Array.isArray(value)) return value;
    const resolved = await resolveLocalPhotosToUrls(value, obraId);
    // Se a resolução retornou vazio, significa upload falhou - manter original com URI
    if (Array.isArray(resolved) && resolved.length === 0 && value.length > 0) {
      logger.warn(`[resolveNestedServicoPhotosToUrls] Upload falhou, mantendo fotos com URI local`);
      return value;
    }
    return resolved;
  };

  const postes_data = Array.isArray(servicoLocal.postes_data)
    ? await Promise.all(
        servicoLocal.postes_data.map(async (poste: any) => ({
          ...poste,
          fotos_antes: await resolveArrayFieldPreservingLocal(poste?.fotos_antes),
          fotos_durante: await resolveArrayFieldPreservingLocal(poste?.fotos_durante),
          fotos_depois: await resolveArrayFieldPreservingLocal(poste?.fotos_depois),
          fotos_medicao: await resolveArrayFieldPreservingLocal(poste?.fotos_medicao),
        }))
      )
    : servicoLocal.postes_data;

  const checklist_postes_data = Array.isArray(servicoLocal.checklist_postes_data)
    ? await Promise.all(
        servicoLocal.checklist_postes_data.map(async (poste: any) => ({
          ...poste,
          posteInteiro: await resolveArrayFieldPreservingLocal(poste?.posteInteiro),
          descricao: await resolveArrayFieldPreservingLocal(poste?.descricao),
          engaste: await resolveArrayFieldPreservingLocal(poste?.engaste),
          conexao1: await resolveArrayFieldPreservingLocal(poste?.conexao1),
          conexao2: await resolveArrayFieldPreservingLocal(poste?.conexao2),
          maiorEsforco: await resolveArrayFieldPreservingLocal(poste?.maiorEsforco),
          menorEsforco: await resolveArrayFieldPreservingLocal(poste?.menorEsforco),
        }))
      )
    : servicoLocal.checklist_postes_data;

  const checklist_seccionamentos_data = Array.isArray(servicoLocal.checklist_seccionamentos_data)
    ? await Promise.all(
        servicoLocal.checklist_seccionamentos_data.map(async (item: any) => ({
          ...item,
          fotos: await resolveArrayFieldPreservingLocal(item?.fotos),
        }))
      )
    : servicoLocal.checklist_seccionamentos_data;

  const checklist_aterramentos_cerca_data = Array.isArray(servicoLocal.checklist_aterramentos_cerca_data)
    ? await Promise.all(
        servicoLocal.checklist_aterramentos_cerca_data.map(async (item: any) => ({
          ...item,
          fotos: await resolveArrayFieldPreservingLocal(item?.fotos),
        }))
      )
    : servicoLocal.checklist_aterramentos_cerca_data;

  const checklist_hastes_termometros_data = Array.isArray(servicoLocal.checklist_hastes_termometros_data)
    ? await Promise.all(
        servicoLocal.checklist_hastes_termometros_data.map(async (item: any) => ({
          ...item,
          fotoHaste: await resolveArrayFieldPreservingLocal(item?.fotoHaste),
          fotoTermometro: await resolveArrayFieldPreservingLocal(item?.fotoTermometro),
        }))
      )
    : servicoLocal.checklist_hastes_termometros_data;

  return {
    postes_data,
    checklist_postes_data,
    checklist_seccionamentos_data,
    checklist_aterramentos_cerca_data,
    checklist_hastes_termometros_data,
  };
}

const getPhotoMergeKey = (item: any, index: number): string => {
  if (typeof item === 'string') {
    return item;
  }
  if (item && typeof item === 'object') {
    return item.id || item.url || item.uri || `idx:${index}`;
  }
  return `idx:${index}`;
};

const mergePhotoArraysPreservingLocal = (localPhotos: any[] = [], remotePhotos: any[] = []): any[] => {
  if (localPhotos.length === 0) return remotePhotos;
  if (remotePhotos.length === 0) return localPhotos;

  const localPhotoMap = new Map<string, any>();
  localPhotos.forEach((photo, index) => {
    localPhotoMap.set(getPhotoMergeKey(photo, index), photo);
  });

  const usedLocalKeys = new Set<string>();
  const mergedRemote = remotePhotos.map((remotePhoto, index) => {
    const key = getPhotoMergeKey(remotePhoto, index);
    const localPhoto = localPhotoMap.get(key);
    usedLocalKeys.add(key);

    if (!localPhoto || !remotePhoto || typeof remotePhoto !== 'object') {
      return remotePhoto;
    }

    const mergedPhoto = { ...localPhoto, ...remotePhoto };
    if (localPhoto.uri && !mergedPhoto.uri) {
      mergedPhoto.uri = localPhoto.uri;
    }
    return mergedPhoto;
  });

  const pendingLocalPhotos = localPhotos.filter((photo, index) => {
    const key = getPhotoMergeKey(photo, index);
    return !usedLocalKeys.has(key);
  });

  return [...mergedRemote, ...pendingLocalPhotos];
};

const isHttpPhotoUrl = (value: unknown): value is string =>
  typeof value === 'string' && /^https?:\/\//i.test(value);

const isLocalPhotoUri = (value: unknown): value is string =>
  typeof value === 'string' &&
  (value.startsWith('file://') || value.startsWith('content://') || value.startsWith('/'));

const toRenderablePhotoRef = (value: unknown): { url?: string; uri?: string } => {
  if (isHttpPhotoUrl(value)) return { url: value };
  if (isLocalPhotoUri(value)) return { uri: value };
  return {};
};

const mapPhotoMetadataToServicoPhoto = (meta: PhotoMetadata): Record<string, any> => ({
  id: meta.id,
  url: meta.uploadUrl || meta.supabaseUrl || undefined,
  uri: meta.compressedPath || meta.originalUri || undefined,
  latitude: meta.latitude ?? undefined,
  longitude: meta.longitude ?? undefined,
  utm_x: meta.utmX ?? undefined,
  utm_y: meta.utmY ?? undefined,
  utm_zone: meta.utmZone ?? undefined,
});

const hydratePhotoArrayEntry = (entry: any, metadataMap: Map<string, PhotoMetadata>): any => {
  if (!entry) return entry;

  if (typeof entry === 'string') {
    const ref = toRenderablePhotoRef(entry);
    if (ref.url || ref.uri) return ref;
    const meta = metadataMap.get(entry);
    return meta ? mapPhotoMetadataToServicoPhoto(meta) : entry;
  }

  if (typeof entry !== 'object') return entry;

  const id = typeof entry.id === 'string' && entry.id
    ? entry.id
    : (typeof entry.photoId === 'string' && entry.photoId ? entry.photoId : undefined);
  const meta = id ? metadataMap.get(id) : undefined;
  const base: Record<string, any> = { ...entry };
  if (id && !base.id) base.id = id;

  const baseUrlRef = toRenderablePhotoRef(base.url);
  const baseUriRef = toRenderablePhotoRef(base.uri);

  if (!base.url && baseUriRef.url) {
    base.url = base.uri;
  }
  if (!base.uri && baseUrlRef.uri) {
    base.uri = base.url;
  }

  if (meta) {
    const metaRef = mapPhotoMetadataToServicoPhoto(meta);
    if (!isHttpPhotoUrl(base.url) && isHttpPhotoUrl(metaRef.url)) {
      base.url = metaRef.url;
    }
    if (!isLocalPhotoUri(base.uri) && isLocalPhotoUri(metaRef.uri)) {
      base.uri = metaRef.uri;
    }
    if (base.latitude == null && metaRef.latitude != null) base.latitude = metaRef.latitude;
    if (base.longitude == null && metaRef.longitude != null) base.longitude = metaRef.longitude;
    if (base.utm_x == null && metaRef.utm_x != null) base.utm_x = metaRef.utm_x;
    if (base.utm_y == null && metaRef.utm_y != null) base.utm_y = metaRef.utm_y;
    if (!base.utm_zone && metaRef.utm_zone) base.utm_zone = metaRef.utm_zone;
  }

  return base;
};

async function hydrateServicosPhotoFields(servicos: Servico[]): Promise<Servico[]> {
  if (!Array.isArray(servicos) || servicos.length === 0) {
    return servicos;
  }

  const candidateIds = new Set<string>();

  for (const servico of servicos as any[]) {
    for (const [key, rawValue] of Object.entries(servico || {})) {
      // Hidrata campos fotos_* e doc_* diretos
      if ((key.startsWith('fotos_') || key.startsWith('doc_')) && Array.isArray(rawValue)) {
        for (const entry of rawValue as any[]) {
          if (!entry) continue;
          if (typeof entry === 'string') {
            const ref = toRenderablePhotoRef(entry);
            if (!ref.url && !ref.uri) {
              candidateIds.add(entry);
            }
            continue;
          }
          if (typeof entry === 'object') {
            const id = typeof entry.id === 'string' && entry.id
              ? entry.id
              : (typeof entry.photoId === 'string' ? entry.photoId : undefined);
            const hasRenderableUrl = !!toRenderablePhotoRef(entry.url).url;
            const hasRenderableUri = !!toRenderablePhotoRef(entry.uri).uri;
            if (id && (!hasRenderableUrl || !hasRenderableUri)) {
              candidateIds.add(id);
            }
          }
        }
      }
      // Hidrata campos aninhados (postes_data, checklist_*, etc)
      if (key === 'postes_data' && Array.isArray(rawValue)) {
        for (const poste of rawValue as any[]) {
          for (const fotoField of ['fotos_antes', 'fotos_durante', 'fotos_depois', 'fotos_medicao']) {
            const arr = poste?.[fotoField];
            if (!Array.isArray(arr)) continue;
            for (const entry of arr) {
              if (!entry) continue;
              if (typeof entry === 'string') {
                const ref = toRenderablePhotoRef(entry);
                if (!ref.url && !ref.uri) {
                  candidateIds.add(entry);
                }
              } else if (typeof entry === 'object') {
                const id = typeof entry.id === 'string' && entry.id
                  ? entry.id
                  : (typeof entry.photoId === 'string' ? entry.photoId : undefined);
                const hasRenderableUrl = !!toRenderablePhotoRef(entry.url).url;
                const hasRenderableUri = !!toRenderablePhotoRef(entry.uri).uri;
                if (id && (!hasRenderableUrl || !hasRenderableUri)) {
                  candidateIds.add(id);
                }
              }
            }
          }
        }
      }
      if (key === 'checklist_postes_data' && Array.isArray(rawValue)) {
        for (const poste of rawValue as any[]) {
          for (const fotoField of ['posteInteiro', 'descricao', 'engaste', 'conexao1', 'conexao2', 'maiorEsforco', 'menorEsforco']) {
            const arr = poste?.[fotoField];
            if (!Array.isArray(arr)) continue;
            for (const entry of arr) {
              if (!entry) continue;
              if (typeof entry === 'string') {
                const ref = toRenderablePhotoRef(entry);
                if (!ref.url && !ref.uri) candidateIds.add(entry);
              } else if (typeof entry === 'object') {
                const id = typeof entry.id === 'string' && entry.id
                  ? entry.id
                  : (typeof entry.photoId === 'string' ? entry.photoId : undefined);
                const hasRenderableUrl = !!toRenderablePhotoRef(entry.url).url;
                const hasRenderableUri = !!toRenderablePhotoRef(entry.uri).uri;
                if (id && (!hasRenderableUrl || !hasRenderableUri)) {
                  candidateIds.add(id);
                }
              }
            }
          }
        }
      }
      if ((key === 'checklist_seccionamentos_data' || key === 'checklist_aterramentos_cerca_data') && Array.isArray(rawValue)) {
        for (const item of rawValue as any[]) {
          const arr = item?.fotos;
          if (!Array.isArray(arr)) continue;
          for (const entry of arr) {
            if (!entry) continue;
            if (typeof entry === 'string') {
              const ref = toRenderablePhotoRef(entry);
              if (!ref.url && !ref.uri) candidateIds.add(entry);
            } else if (typeof entry === 'object') {
              const id = typeof entry.id === 'string' && entry.id
                ? entry.id
                : (typeof entry.photoId === 'string' ? entry.photoId : undefined);
              const hasRenderableUrl = !!toRenderablePhotoRef(entry.url).url;
              const hasRenderableUri = !!toRenderablePhotoRef(entry.uri).uri;
              if (id && (!hasRenderableUrl || !hasRenderableUri)) {
                candidateIds.add(id);
              }
            }
          }
        }
      }
      if (key === 'checklist_hastes_termometros_data' && Array.isArray(rawValue)) {
        for (const item of rawValue as any[]) {
          for (const fotoField of ['fotoHaste', 'fotoTermometro']) {
            const arr = item?.[fotoField];
            if (!Array.isArray(arr)) continue;
            for (const entry of arr) {
              if (!entry) continue;
              if (typeof entry === 'string') {
                const ref = toRenderablePhotoRef(entry);
                if (!ref.url && !ref.uri) candidateIds.add(entry);
              } else if (typeof entry === 'object') {
                const id = typeof entry.id === 'string' && entry.id
                  ? entry.id
                  : (typeof entry.photoId === 'string' ? entry.photoId : undefined);
                const hasRenderableUrl = !!toRenderablePhotoRef(entry.url).url;
                const hasRenderableUri = !!toRenderablePhotoRef(entry.uri).uri;
                if (id && (!hasRenderableUrl || !hasRenderableUri)) {
                  candidateIds.add(id);
                }
              }
            }
          }
        }
      }
    }
  }

  if (candidateIds.size === 0) return servicos;

  const allMetadata = await getPhotoMetadatasByIds([...candidateIds]);
  const metadataMap = new Map(allMetadata.map((meta) => [meta.id, meta]));

  return servicos.map((servico) => {
    let changed = false;
    const nextServico: Record<string, any> = { ...(servico as any) };

    // Hidrata campos fotos_* e doc_* diretos
    for (const [key, rawValue] of Object.entries(nextServico)) {
      if (!(key.startsWith('fotos_') || key.startsWith('doc_')) || !Array.isArray(rawValue)) continue;

      const hydratedField = (rawValue as any[]).map((entry) => hydratePhotoArrayEntry(entry, metadataMap));
      const fieldChanged = hydratedField.length !== rawValue.length ||
        hydratedField.some((entry, idx) => entry !== rawValue[idx]);
      if (fieldChanged) {
        nextServico[key] = hydratedField;
        changed = true;
      }
    }

    // Hidrata campos aninhados (postes_data, checklist_*, etc)
    if (Array.isArray(nextServico.postes_data)) {
      const hydratedPostes = nextServico.postes_data.map((poste: any) => ({
        ...poste,
        fotos_antes: Array.isArray(poste?.fotos_antes)
          ? (poste.fotos_antes as any[]).map((e) => hydratePhotoArrayEntry(e, metadataMap))
          : poste?.fotos_antes,
        fotos_durante: Array.isArray(poste?.fotos_durante)
          ? (poste.fotos_durante as any[]).map((e) => hydratePhotoArrayEntry(e, metadataMap))
          : poste?.fotos_durante,
        fotos_depois: Array.isArray(poste?.fotos_depois)
          ? (poste.fotos_depois as any[]).map((e) => hydratePhotoArrayEntry(e, metadataMap))
          : poste?.fotos_depois,
        fotos_medicao: Array.isArray(poste?.fotos_medicao)
          ? (poste.fotos_medicao as any[]).map((e) => hydratePhotoArrayEntry(e, metadataMap))
          : poste?.fotos_medicao,
      }));
      if (JSON.stringify(hydratedPostes) !== JSON.stringify(nextServico.postes_data)) {
        nextServico.postes_data = hydratedPostes;
        changed = true;
      }
    }

    if (Array.isArray(nextServico.checklist_postes_data)) {
      const hydratedPostes = nextServico.checklist_postes_data.map((poste: any) => ({
        ...poste,
        posteInteiro: Array.isArray(poste?.posteInteiro)
          ? (poste.posteInteiro as any[]).map((e) => hydratePhotoArrayEntry(e, metadataMap))
          : poste?.posteInteiro,
        descricao: Array.isArray(poste?.descricao)
          ? (poste.descricao as any[]).map((e) => hydratePhotoArrayEntry(e, metadataMap))
          : poste?.descricao,
        engaste: Array.isArray(poste?.engaste)
          ? (poste.engaste as any[]).map((e) => hydratePhotoArrayEntry(e, metadataMap))
          : poste?.engaste,
        conexao1: Array.isArray(poste?.conexao1)
          ? (poste.conexao1 as any[]).map((e) => hydratePhotoArrayEntry(e, metadataMap))
          : poste?.conexao1,
        conexao2: Array.isArray(poste?.conexao2)
          ? (poste.conexao2 as any[]).map((e) => hydratePhotoArrayEntry(e, metadataMap))
          : poste?.conexao2,
        maiorEsforco: Array.isArray(poste?.maiorEsforco)
          ? (poste.maiorEsforco as any[]).map((e) => hydratePhotoArrayEntry(e, metadataMap))
          : poste?.maiorEsforco,
        menorEsforco: Array.isArray(poste?.menorEsforco)
          ? (poste.menorEsforco as any[]).map((e) => hydratePhotoArrayEntry(e, metadataMap))
          : poste?.menorEsforco,
      }));
      if (JSON.stringify(hydratedPostes) !== JSON.stringify(nextServico.checklist_postes_data)) {
        nextServico.checklist_postes_data = hydratedPostes;
        changed = true;
      }
    }

    if (Array.isArray(nextServico.checklist_seccionamentos_data)) {
      const hydratedItems = nextServico.checklist_seccionamentos_data.map((item: any) => ({
        ...item,
        fotos: Array.isArray(item?.fotos)
          ? (item.fotos as any[]).map((e) => hydratePhotoArrayEntry(e, metadataMap))
          : item?.fotos,
      }));
      if (JSON.stringify(hydratedItems) !== JSON.stringify(nextServico.checklist_seccionamentos_data)) {
        nextServico.checklist_seccionamentos_data = hydratedItems;
        changed = true;
      }
    }

    if (Array.isArray(nextServico.checklist_aterramentos_cerca_data)) {
      const hydratedItems = nextServico.checklist_aterramentos_cerca_data.map((item: any) => ({
        ...item,
        fotos: Array.isArray(item?.fotos)
          ? (item.fotos as any[]).map((e) => hydratePhotoArrayEntry(e, metadataMap))
          : item?.fotos,
      }));
      if (JSON.stringify(hydratedItems) !== JSON.stringify(nextServico.checklist_aterramentos_cerca_data)) {
        nextServico.checklist_aterramentos_cerca_data = hydratedItems;
        changed = true;
      }
    }

    if (Array.isArray(nextServico.checklist_hastes_termometros_data)) {
      const hydratedItems = nextServico.checklist_hastes_termometros_data.map((item: any) => ({
        ...item,
        fotoHaste: Array.isArray(item?.fotoHaste)
          ? (item.fotoHaste as any[]).map((e) => hydratePhotoArrayEntry(e, metadataMap))
          : item?.fotoHaste,
        fotoTermometro: Array.isArray(item?.fotoTermometro)
          ? (item.fotoTermometro as any[]).map((e) => hydratePhotoArrayEntry(e, metadataMap))
          : item?.fotoTermometro,
      }));
      if (JSON.stringify(hydratedItems) !== JSON.stringify(nextServico.checklist_hastes_termometros_data)) {
        nextServico.checklist_hastes_termometros_data = hydratedItems;
        changed = true;
      }
    }

    return changed ? (nextServico as Servico) : servico;
  });
}

/**
 * Sincroniza um servico especfico com o Supabase
 */
export interface RecoverLostServicoPhotosResult {
  recoveredServicos: number;
  recoveredPhotos: number;
  skippedAmbiguous: number;
}

/**
 * Recupera fotos perdidas em servicos locais usando o photo-backup.
 * Estrategia:
 * 1) Vinculo estrito por servico.id (photo.obraId == servico.id ou prefixo do photo.id).
 * 2) Fallback por obra apenas quando existe um unico servico candidato para o campo.
 */
export async function recoverLostServicoPhotos(obraId?: string): Promise<RecoverLostServicoPhotosResult> {
  try {
    const relatedObraIds = obraId ? await resolveRelatedObraIds(obraId) : [];
    const relatedObraIdSet = new Set(relatedObraIds);

    let keysToCheck: string[];
    if (obraId) {
      keysToCheck = relatedObraIds.map((id) => `${LOCAL_SERVICOS_KEY}:${id}`);
    } else {
      const indexRaw = await AsyncStorage.getItem(SERVICOS_OBRA_IDS_KEY);
      const indexedIds: string[] = indexRaw ? JSON.parse(indexRaw) : [];
      keysToCheck = indexedIds.map((id) => `${LOCAL_SERVICOS_KEY}:${id}`);
    }

    if (keysToCheck.length === 0) {
      return { recoveredServicos: 0, recoveredPhotos: 0, skippedAmbiguous: 0 };
    }

    const entries = await AsyncStorage.multiGet(keysToCheck);
    const keyToServicos = new Map<string, ServicoLocal[]>();
    const servicoRefsById = new Map<string, Array<{ key: string; index: number }>>();
    const bestServicoById = new Map<string, ServicoLocal>();
    const allowedFieldsByServicoId = new Map<string, Set<string>>();
    const servicoIdsByObraId = new Map<string, Set<string>>();
    const existingPhotoIds = new Set<string>();

    for (const [key, raw] of entries) {
      if (!raw) continue;

      let parsed: ServicoLocal[];
      try {
        parsed = JSON.parse(raw);
      } catch {
        continue;
      }
      if (!Array.isArray(parsed) || parsed.length === 0) continue;

      keyToServicos.set(key, parsed);

      parsed.forEach((servico, index) => {
        const servicoId = String(servico?.id || '').trim();
        if (!servicoId) return;

        const refs = servicoRefsById.get(servicoId) || [];
        refs.push({ key, index });
        servicoRefsById.set(servicoId, refs);

        const currentBest = bestServicoById.get(servicoId);
        bestServicoById.set(servicoId, pickBestServicoRecord(currentBest, servico));

        const allowed = allowedFieldsByServicoId.get(servicoId) || new Set<string>();
        getAllowedPhotoFieldsForServico(servico).forEach((field) => allowed.add(field));
        allowedFieldsByServicoId.set(servicoId, allowed);

        const obraToken = String(servico.obra_id || '').trim();
        if (obraToken) {
          const set = servicoIdsByObraId.get(obraToken) || new Set<string>();
          set.add(servicoId);
          servicoIdsByObraId.set(obraToken, set);
        }

        for (const [field, value] of Object.entries(servico as any)) {
          if (!(field.startsWith('fotos_') || field.startsWith('doc_'))) continue;
          const arr = normalizePhotoArray(value);
          arr.forEach((entry) => {
            const id = extractPhotoEntryId(entry);
            if (id) existingPhotoIds.add(id);
          });
        }
      });
    }

    if (servicoRefsById.size === 0) {
      return { recoveredServicos: 0, recoveredPhotos: 0, skippedAmbiguous: 0 };
    }

    const allMetadata = await getAllPhotoMetadata();
    if (!Array.isArray(allMetadata) || allMetadata.length === 0) {
      return { recoveredServicos: 0, recoveredPhotos: 0, skippedAmbiguous: 0 };
    }

    const metadata = obraId
      ? allMetadata.filter((photo) => relatedObraIdSet.has(String(photo.obraId || '').trim()))
      : allMetadata;

    if (metadata.length === 0) {
      return { recoveredServicos: 0, recoveredPhotos: 0, skippedAmbiguous: 0 };
    }

    const assignments = new Map<string, Map<string, PhotoMetadata[]>>();
    const assignedPhotoIds = new Set<string>();
    let skippedAmbiguous = 0;

    const queueAssignment = (servicoId: string, field: string, photo: PhotoMetadata) => {
      if (!servicoId || !field) return;
      if (assignedPhotoIds.has(photo.id) || existingPhotoIds.has(photo.id)) return;

      const byField = assignments.get(servicoId) || new Map<string, PhotoMetadata[]>();
      const list = byField.get(field) || [];
      if (!list.some((item) => item.id === photo.id)) {
        list.push(photo);
      }
      byField.set(field, list);
      assignments.set(servicoId, byField);
      assignedPhotoIds.add(photo.id);
    };

    // 1) Vinculo estrito por servico.id
    for (const photo of metadata) {
      if (!photo?.id || photo.lost) continue;
      const field = normalizePhotoFieldFromType(photo.type);
      if (!field) continue;

      const directServicoId = String(photo.obraId || '').trim();
      const prefixServicoId = String(photo.id).split('_')[0]?.trim();
      const strictCandidates = dedupeStrings([directServicoId, prefixServicoId]).filter((id) =>
        servicoRefsById.has(id)
      );

      if (strictCandidates.length === 0) continue;

      for (const servicoId of strictCandidates) {
        const allowed = allowedFieldsByServicoId.get(servicoId);
        if (allowed && !allowed.has(field)) continue;
        queueAssignment(servicoId, field, photo);
        break;
      }
    }

    // 2) Fallback por obra (somente sem ambiguidade)
    for (const photo of metadata) {
      if (!photo?.id || photo.lost) continue;
      if (assignedPhotoIds.has(photo.id) || existingPhotoIds.has(photo.id)) continue;

      const field = normalizePhotoFieldFromType(photo.type);
      if (!field) continue;

      const obraToken = String(photo.obraId || '').trim();
      if (!obraToken) continue;

      const candidateSet = servicoIdsByObraId.get(obraToken);
      if (!candidateSet || candidateSet.size === 0) continue;

      const candidates = Array.from(candidateSet).filter((servicoId) => {
        const allowed = allowedFieldsByServicoId.get(servicoId);
        return !allowed || allowed.has(field);
      });

      if (candidates.length === 1) {
        queueAssignment(candidates[0], field, photo);
      } else if (candidates.length > 1) {
        skippedAmbiguous++;
      }
    }

    if (assignments.size === 0) {
      return { recoveredServicos: 0, recoveredPhotos: 0, skippedAmbiguous };
    }

    const now = new Date().toISOString();
    const touchedServicos = new Set<string>();
    const touchedKeys = new Set<string>();
    let recoveredPhotos = 0;

    for (const [servicoId, byField] of assignments.entries()) {
      const refs = servicoRefsById.get(servicoId) || [];
      if (refs.length === 0) continue;

      const bestSnapshot = bestServicoById.get(servicoId);
      if (!bestSnapshot) continue;

      const recoveredFields: Record<string, any[]> = {};
      let changed = false;

      for (const [field, photos] of byField.entries()) {
        const currentArr = normalizePhotoArray((bestSnapshot as any)[field]);
        const currentIds = new Set<string>();
        currentArr.forEach((entry) => {
          const id = extractPhotoEntryId(entry);
          if (id) currentIds.add(id);
        });

        const toAppend = photos
          .filter((photo) => !currentIds.has(photo.id))
          .map((photo) => mapPhotoMetadataToServicoPhoto(photo));

        if (toAppend.length === 0) continue;
        recoveredFields[field] = [...currentArr, ...toAppend];
        recoveredPhotos += toAppend.length;
        changed = true;
      }

      if (!changed) continue;

      touchedServicos.add(servicoId);

      for (const ref of refs) {
        const list = keyToServicos.get(ref.key);
        if (!list || !list[ref.index]) continue;
        list[ref.index] = {
          ...list[ref.index],
          ...recoveredFields,
          updated_at: now,
          sync_status: 'offline',
          error_message: null,
        };
        touchedKeys.add(ref.key);
      }
    }

    if (touchedKeys.size > 0) {
      const payload: [string, string][] = [];
      for (const key of touchedKeys) {
        const list = keyToServicos.get(key);
        if (!list) continue;
        payload.push([key, JSON.stringify(list)]);
      }
      if (payload.length > 0) {
        await AsyncStorage.multiSet(payload);
      }
    }

    return {
      recoveredServicos: touchedServicos.size,
      recoveredPhotos,
      skippedAmbiguous,
    };
  } catch (error) {
    logger.warn('[recoverLostServicoPhotos] Falha ao recuperar fotos de servicos:', error);
    return { recoveredServicos: 0, recoveredPhotos: 0, skippedAmbiguous: 0 };
  }
}

export async function syncServico(servicoLocal: ServicoLocal): Promise<{
  success: boolean;
  error?: string;
  servico?: Servico;
  isNetworkError?: boolean;
  isAlreadySyncing?: boolean;
  isDeferred?: boolean;
}> {
  // Evita double-insert quando createServico e syncAllPendingServicos rodam concorrentemente
  // O lock expira automaticamente apos SYNC_LOCK_TIMEOUT_MS para evitar bloqueio permanente
  if (currentlySyncingIds.has(servicoLocal.id)) {
    const startedAt = currentlySyncingIds.get(servicoLocal.id)!;
    if (Date.now() - startedAt < SYNC_LOCK_TIMEOUT_MS) {
      logger.servico(`[syncServico] Servico ${servicoLocal.id} ja esta em sincronizacao - ignorando chamada duplicada`);
      return {
        success: false,
        error: 'Servico ja em sincronizacao',
        isAlreadySyncing: true,
      };
    }
    logger.warn(`[syncServico] Lock expirado para ${servicoLocal.id} (>${SYNC_LOCK_TIMEOUT_MS / 60000}min) - forcando liberacao`);
  }
  currentlySyncingIds.set(servicoLocal.id, Date.now());
  const originalId = servicoLocal.id;

  // Declara fora do try para que o catch possa acessar ao restaurar snapshot
  const obraId = servicoLocal.obra_id;
  const fotosDocKeys = (Object.keys(servicoLocal) as string[]).filter(
    (k) => (k.startsWith('fotos_') || k.startsWith('doc_')) && Array.isArray((servicoLocal as any)[k])
  );
  // Snapshot das fotos ANTES do upload  prote?fAaAaaAaAaAaaAAAAaAaaAAAasAAaAA?f??s?,?o contra perda se o upload deletar
  // arquivos locais e o INSERT/UPDATE no Supabase falhar em seguida.
  const fotosSnapshot: Record<string, any[]> = {};
  for (const key of fotosDocKeys) {
    fotosSnapshot[key] = JSON.parse(JSON.stringify((servicoLocal as any)[key] || []));
  }

  try {
    if (!isUuid(servicoLocal.obra_id)) {
      const localObras = await getLocalObras();
      const obraLocal = localObras.find((obra: any) =>
        obra?.id === servicoLocal.obra_id || obra?.serverId === servicoLocal.obra_id
      ) as any;
      const remoteObraId = typeof obraLocal?.serverId === 'string' && isUuid(obraLocal.serverId)
        ? obraLocal.serverId
        : null;

      if (!remoteObraId) {
        const message = `Obra local ainda sem UUID remoto (obraId: ${servicoLocal.obra_id}). Servico sera sincronizado apos a obra.`;
        logger.warn(`[syncServico] ${message}`);
        servicoLocal.sync_status = 'offline';
        servicoLocal.error_message = null;
        await saveServicoLocal(servicoLocal);
        return {
          success: false,
          error: message,
          isDeferred: true,
        };
      }

      const oldObraId = servicoLocal.obra_id;
      await remapServicosObraId(oldObraId, remoteObraId);
      servicoLocal.obra_id = remoteObraId;
      logger.servico(`[syncServico] Obra local ${oldObraId} remapeada para ${remoteObraId} antes do sync do servico`);
    }

    logger.servico(`[syncServico] Iniciando sync do servico ${servicoLocal.id} (obra: ${servicoLocal.obra_id})`);

    // Marca como "syncing"
    servicoLocal.sync_status = 'syncing';
    await saveServicoLocal(servicoLocal);

    const isNewServico = !isUuid(servicoLocal.id);
    const pendingLocalId = servicoLocal.id;
    const clientPk = ensureServicoClientPk(servicoLocal);

    // Resolve TODOS os campos fotos_* e doc_* para URLs publicas do Supabase.
    // Faz upload das fotos salvas offline ({id, uri}) e substitui pelo objeto FotoInfo completo.
    const resolvedEntries = await Promise.all(
      fotosDocKeys.map(async (key) => [
        key,
        await resolveLocalPhotosToUrls((servicoLocal as any)[key] || [], obraId),
      ])
    );
    const resolvedFotos: Record<string, any[]> = Object.fromEntries(resolvedEntries);
    const resolvedNestedPhotos = await resolveNestedServicoPhotosToUrls(servicoLocal, obraId);

    // Detecta fotos que não puderam ser resolvidas para URL (arquivo local perdido/deletado).
    // Um item é considerado "não resolvido" se ainda é string (ID não enviado) ou objeto sem url http.
    const countUnresolved = (items: any[]): number =>
      items.filter((item: any) => {
        if (typeof item === 'string') return item.length > 0;
        if (!item || typeof item !== 'object') return false;
        const url = item.url ?? item.supabaseUrl ?? item.uploadUrl;
        return !url || !String(url).startsWith('http');
      }).length;

    let lostPhotoCount = Object.values(resolvedFotos).reduce(
      (sum, arr) => sum + countUnresolved(arr),
      0
    );
    if (Array.isArray(resolvedNestedPhotos.postes_data)) {
      for (const poste of resolvedNestedPhotos.postes_data as any[]) {
        lostPhotoCount += countUnresolved(poste?.fotos_antes ?? []);
        lostPhotoCount += countUnresolved(poste?.fotos_durante ?? []);
        lostPhotoCount += countUnresolved(poste?.fotos_depois ?? []);
        lostPhotoCount += countUnresolved(poste?.fotos_medicao ?? []);
      }
    }
    const lostPhotosMessage = lostPhotoCount > 0
      ? `${lostPhotoCount} foto${lostPhotoCount > 1 ? 's' : ''} não encontrada${lostPhotoCount > 1 ? 's' : ''} no dispositivo — tire novamente`
      : null;
    if (lostPhotosMessage) {
      logger.warn(`[syncServico] ${lostPhotosMessage} (servico ${servicoLocal.id})`);
    }

    // Quando fazendo UPDATE (não é novo), não sobrescrever estruturas aninhadas vazias
    // Se a versão local tem arrays vazios mas o servidor tem dados, preserva o servidor
    let nestedPhotosToSync: Record<string, any> = {};
    const nestedFields = [
      'postes_data',
      'checklist_postes_data',
      'checklist_seccionamentos_data',
      'checklist_aterramentos_cerca_data',
      'checklist_hastes_termometros_data',
    ] as const;
    
    for (const field of nestedFields) {
      const resolved = (resolvedNestedPhotos as any)[field];
      const hasData = Array.isArray(resolved) && resolved.length > 0;
      
      // Se é novo serviço, sempre enviar (mesmo se vazio)
      // Se é UPDATE, só enviar se tiver dados (não sobrescrever com vazio)
      if (isNewServico || hasData) {
        nestedPhotosToSync[field] = resolved;
      } else if (!isNewServico && hasData === false && resolved !== servicoLocal[field as keyof ServicoLocal]) {
        logger.warn(`[syncServico] ${field} ficou vazio localmente — NÃO sobrescrevendo servidor para preservar fotos existentes`);
      }
    }

    // Prepara payload
    const payload = {
      ...(isNewServico ? {} : { id: servicoLocal.id }),
      client_pk: clientPk,
      obra_id: servicoLocal.obra_id,
      obra_numero: servicoLocal.obra_numero,
      equipe: servicoLocal.equipe,
      tipo_servico: servicoLocal.tipo_servico,
      responsavel: servicoLocal.responsavel,
      status: servicoLocal.status,
      sync_status: 'synced' as const,
      error_message: lostPhotosMessage,
      created_at: servicoLocal.created_at,
      updated_at: new Date().toISOString(),
      // Todos os campos fotos_* e doc_* ja resolvidos (uploads feitos)
      ...resolvedFotos,
      // Dados estruturados (nao so fotos) - apenas incluir se tiver dados
      ...nestedPhotosToSync,
      dados_adicionais: servicoLocal.dados_adicionais ?? {},
    };

    let result;
    let payloadToPersist: Record<string, any> = { ...payload };
    let insertedNow = false;

    const updateRemoteById = async (remoteId: string): Promise<any> => {
      let updateError: any = null;

      for (let attempt = 0; attempt < 2; attempt++) {
        // obra_id é imutável após inserção — excluí-lo evita falhas de RLS WITH CHECK
        // quando o estado local tem obra_id diferente do valor original no Supabase.
        const { obra_id: _obraIdReadonly, ...updatePayload } = payloadToPersist;
        const { data, error } = await supabase
          .from('servicos')
          .update(updatePayload)
          .eq('id', remoteId)
          .select()
          .single();

        if (!error) {
          return data;
        }

        updateError = error;
        const missingColumn = extractMissingColumnFromSchemaError(error);
        if (missingColumn && missingColumn in payloadToPersist) {
          logger.warn(`[syncServico] Coluna ausente no servidor (${missingColumn}). Reenviando sem este campo.`);
          const { [missingColumn]: _, ...sanitizedPayload } = payloadToPersist;
          payloadToPersist = sanitizedPayload;
          continue;
        }

        break;
      }

      if (updateError) {
        throw updateError;
      }
      return null;
    };

    if (isNewServico) {
      const { data: existingRows, error: existingLookupError } = await supabase
        .from('servicos')
        .select('*')
        .eq('client_pk', clientPk)
        .order('updated_at', { ascending: false })
        .limit(1);

      if (!existingLookupError && Array.isArray(existingRows) && existingRows.length > 0) {
        result = existingRows[0];
        if (result?.id) {
          servicoLocal.id = result.id;
        }
        logger.warn(`[syncServico] Servico ja existente detectado por client_pk. Reutilizando ID ${result?.id}`);
      } else if (existingLookupError) {
        logger.warn('[syncServico] Falha ao checar servico existente por client_pk:', existingLookupError);
      }

      if (!result) {
        const temporalMatch = await findExistingServicoByTemporalFingerprint(servicoLocal);
        if (temporalMatch?.id) {
          result = temporalMatch;
          servicoLocal.id = temporalMatch.id;
          logger.warn(`[syncServico] Servico existente detectado por janela temporal. Reutilizando ID ${temporalMatch.id}`);
        }
      }

      if (!result) {
        // INSERT novo servico
        logger.servico(`[syncServico] Inserindo novo servico com ID temporario: ${servicoLocal.id}`);
      }
      let insertError: any = null;
      let useClientPkUpsert = true;

      if (!result) {
        for (let attempt = 0; attempt < 2; attempt++) {
          let data: any = null;
          let error: any = null;

          if (useClientPkUpsert) {
            const upsertRes = await supabase
              .from('servicos')
              .upsert([payloadToPersist], { onConflict: 'client_pk' })
              .select()
              .single();
            data = upsertRes.data;
            error = upsertRes.error;
          } else {
            const insertRes = await supabase
              .from('servicos')
              .insert([payloadToPersist])
              .select()
              .single();
            data = insertRes.data;
            error = insertRes.error;
          }

          const onConflictUnsupported = !!error && /on conflict|unique or exclusion constraint|42P10/i.test(String(error.message || error));
          if (onConflictUnsupported && useClientPkUpsert) {
            logger.warn('[syncServico] ON CONFLICT client_pk indisponivel no servidor. Tentando INSERT simples.');
            useClientPkUpsert = false;
            continue;
          }

          if (!error) {
            insertedNow = true;
            result = data;
            break;
          }

          insertError = error;
          const missingColumn = extractMissingColumnFromSchemaError(error);
          if (missingColumn && missingColumn in payloadToPersist) {
            logger.warn(`[syncServico] Coluna ausente no servidor (${missingColumn}). Reenviando sem este campo.`);
            const { [missingColumn]: _, ...sanitizedPayload } = payloadToPersist;
            payloadToPersist = sanitizedPayload;
            if (missingColumn === 'client_pk') {
              useClientPkUpsert = false;
            }
            continue;
          }

          const errText = String(error?.message || error || '');
          const clientPkUnavailable = /client_pk/i.test(errText) && /does not exist|schema cache|PGRST204/i.test(errText);
          if (clientPkUnavailable) {
            logger.warn('[syncServico] Servidor sem coluna client_pk. Reenviando em modo legado.');
            if ('client_pk' in payloadToPersist) {
              const { client_pk: _, ...legacyPayload } = payloadToPersist;
              payloadToPersist = legacyPayload;
            }
            useClientPkUpsert = false;
            continue;
          }

          break;
        }
      }

      if (!result && insertError) {
        logger.error(`[syncServico] Erro ao inserir servico:`, insertError);
        throw insertError;
      }

      // Se o registro jÃ¡ existia, atualiza com o payload mais recente (evita perder Ãºltima foto).
      if (result?.id && !insertedNow) {
        result = await updateRemoteById(result.id);
      }

      if (result?.id) {
        servicoLocal.id = result.id;
      }

      logger.servico(
        insertedNow
          ? `[syncServico] Servico inserido com sucesso: ${result?.id}`
          : `[syncServico] Servico existente atualizado com sucesso: ${result?.id}`
      );
    } else {
      // UPDATE servico existente
      logger.servico(`[syncServico] Atualizando servico existente: ${servicoLocal.id}`);
      result = await updateRemoteById(servicoLocal.id);
      logger.servico(`[syncServico] Servico atualizado com sucesso`);
    }

    // Marca como sincronizado localmente (preserva aviso de fotos perdidas se houver)
    servicoLocal.sync_status = 'synced';
    servicoLocal.error_message = lostPhotosMessage;

    if (isNewServico && pendingLocalId !== servicoLocal.id) {
      // Persiste o mapeamento temp-id -> uuid para que appendPhotoToServicoLocal possa seguir
      // a referência caso o usuário tente adicionar foto antes da UI atualizar o estado.
      try {
        const remapRaw = await AsyncStorage.getItem(SERVICO_ID_REMAP_KEY);
        const remap: Record<string, string> = remapRaw ? JSON.parse(remapRaw) : {};
        remap[pendingLocalId] = servicoLocal.id;
        await AsyncStorage.setItem(SERVICO_ID_REMAP_KEY, JSON.stringify(remap));
      } catch {}

      // Limpa referencias do ID temporario em TODAS as chaves locais para evitar card duplicado
      // apos troca de temp-id -> uuid.
      const indexRaw = await AsyncStorage.getItem(SERVICOS_OBRA_IDS_KEY);
      const indexedIds: string[] = indexRaw ? JSON.parse(indexRaw) : [];
      const localServicoKeys = indexedIds.map((id) => `${LOCAL_SERVICOS_KEY}:${id}`);

      for (const localKey of localServicoKeys) {
        const storedLocal = await AsyncStorage.getItem(localKey);
        if (!storedLocal) continue;

        const localServicos: ServicoLocal[] = JSON.parse(storedLocal);
        const withoutTemp = localServicos.filter((item) => item.id !== pendingLocalId);
        const normalized = dedupeServicosByFingerprint(withoutTemp as any) as ServicoLocal[];

        if (normalized.length !== localServicos.length) {
          await AsyncStorage.setItem(localKey, JSON.stringify(normalized));
        }
      }

      // Remapeia bucket isolado de postes para manter resumo/fotos apos troca de ID.
      try {
        const oldPostesKey = getServicoPostesStorageKey(pendingLocalId);
        const newPostesKey = getServicoPostesStorageKey(servicoLocal.id);
        const oldPostesRaw = await AsyncStorage.getItem(oldPostesKey);
        if (oldPostesRaw) {
          const existingNewPostes = await AsyncStorage.getItem(newPostesKey);
          if (!existingNewPostes) {
            await AsyncStorage.setItem(newPostesKey, oldPostesRaw);
          }
          await AsyncStorage.removeItem(oldPostesKey);
        }
      } catch (postesRemapErr) {
        logger.warn('[syncServico] Falha ao remapear bucket de postes apos troca de ID:', postesRemapErr);
      }
    }

    // Salva localmente a versao retornada pelo Supabase (com URLs publicas nas fotos)
    // Isso garante que o preview continue funcionando mesmo sem internet apos o sync
    if (result) {
      const syncedServico: any = { ...(result as any), sync_status: 'synced', error_message: lostPhotosMessage };
      const mergedDadosAdicionais = mergeDadosAdicionaisPreservingLocal(
        (servicoLocal as any)?.dados_adicionais,
        syncedServico?.dados_adicionais
      );
      if (mergedDadosAdicionais) {
        syncedServico.dados_adicionais = mergedDadosAdicionais;
      }

      // Merge: re-associa URIs locais s fotos sincronizadas para fallback offline.
      // O arquivo local pode ter sido deletado pelo photo-queue apos upload, mas se ainda
      // existir, o preview funcionar mesmo sem acesso  URL do Supabase.
      for (const key of fotosDocKeys) {
        const remoteArr: any[] = syncedServico[key] || [];
        const localArr: any[] = (servicoLocal as any)[key] || [];
        if (remoteArr.length === 0 && localArr.length > 0) {
          syncedServico[key] = localArr;
        } else if (remoteArr.length > 0 && localArr.length > 0) {
          const localById = new Map<string, string>(
            localArr
              .filter((p: any) => p?.id && p?.uri)
              .map((p: any) => [p.id as string, p.uri as string])
          );
          syncedServico[key] = remoteArr.map((rf: any, idx: number) => {
            if (!rf || typeof rf !== 'object') return rf;
            const uriById = rf.id ? localById.get(rf.id) : undefined;
            const localAtPos = typeof localArr[idx] === 'object' ? localArr[idx] : null;
            const fallbackUri = uriById ?? localAtPos?.uri;
            return (fallbackUri && !rf.uri) ? { ...rf, uri: fallbackUri } : rf;
          });
        }
      }

      const nestedFields = [
        'postes_data',
        'checklist_postes_data',
        'checklist_seccionamentos_data',
        'checklist_aterramentos_cerca_data',
        'checklist_hastes_termometros_data',
      ] as const;
      for (const field of nestedFields) {
        if (shouldKeepLocalNestedField(field, (servicoLocal as any)?.[field], syncedServico?.[field])) {
          syncedServico[field] = (servicoLocal as any)?.[field];
        }
      }

      await saveServicoLocal(syncedServico);

      //  CLEANUP SEGURO: backups fsicos removidos SOMENTE apos confirma?fAaAaaAaAaAaaAAAAaAaaAAAasAAaAA?f??s?,?o do banco.
      // No  feito no photo-queue para evitar dele?fAaAaaAaAaAaaAAAAaAaaAAAasAAaAA?f??s?,?o antes do INSERT/UPDATE confirmar.
      try {
        const snapshotPhotoIds: string[] = [];
        for (const key of fotosDocKeys) {
          for (const item of (fotosSnapshot[key] || []) as any[]) {
            const photoId = typeof item === 'string' ? item : (item?.id || item?.photoId);
            if (photoId) snapshotPhotoIds.push(photoId);
          }
        }
        const allMeta = await getPhotoMetadatasByIds(snapshotPhotoIds);
        for (const meta of allMeta) {
          if (meta.uploaded && (meta.uploadUrl || meta.supabaseUrl)) {
            deletePhotoBackup(meta.id).catch(() => {});
          }
        }
      } catch {
        // nao critico: arquivos serao removidos na proxima limpeza de manutencao
      }
    } else {
      await saveServicoLocal(servicoLocal);
    }

    // Remove da fila de pending
    const pendingKey = PENDING_SERVICOS_KEY;
    const pending = await AsyncStorage.getItem(pendingKey);
    if (pending) {
      const pendingList: string[] = JSON.parse(pending);
      const updated = pendingList.filter((id) => id !== pendingLocalId && id !== servicoLocal.id);
      await AsyncStorage.setItem(pendingKey, JSON.stringify(updated));
    }

    // Remove do mapa auxiliar
    const mapKey = PENDING_SERVICOS_MAP_KEY;
    const map = await AsyncStorage.getItem(mapKey);
    if (map) {
      const mapObj: Record<string, string> = JSON.parse(map);
      delete mapObj[pendingLocalId];
      delete mapObj[servicoLocal.id];
      await AsyncStorage.setItem(mapKey, JSON.stringify(mapObj));
    }

    logger.servico(`[syncServico] Servico ${servicoLocal.id} sincronizado com sucesso`);
    return { success: true, servico: result };
  } catch (error: any) {
    const errorMsg: string = error?.message || '';
    const isNetworkError = /network request failed|failed to fetch|timeout|unable to resolve host|no address associated with hostname|failed to connect|network is unreachable/i.test(errorMsg);

    // RECUPERACAO DE FOTOS: o upload pode ter deletado arquivos locais antes do INSERT/UPDATE
    // falhar. Restauramos o snapshot das fotos para evitar perda permanente de dados.
    // Se a URL ainda for resolvvel via metadata, a prxima tentativa de sync vai funcionar.
    try {
      for (const key of fotosDocKeys) {
        const snapshotArr = fotosSnapshot[key];
        if (!snapshotArr || snapshotArr.length === 0) continue;

        // Verifica se dado atual no servicoLocal tem menos fotos que o snapshot (perda)
        const currentArr = (servicoLocal as any)[key] || [];
        if (currentArr.length < snapshotArr.length) {
          (servicoLocal as any)[key] = snapshotArr;
          logger.warn(`[syncServico] Restaurando ${snapshotArr.length} foto(s) do snapshot para campo ${key}`);
        }
      }
    } catch (restoreErr) {
      logger.error('[syncServico] Erro ao restaurar snapshot de fotos:', restoreErr);
    }

    if (isNetworkError) {
      // Falha de rede temporaria: manter como 'pending' para retry quando voltar online
      logger.warn(`[syncServico] Falha de rede ao sincronizar servico ${servicoLocal.id} - mantendo como pendente`);
      servicoLocal.sync_status = 'offline';
      await saveServicoLocal(servicoLocal);
      return { success: false, error: errorMsg, isNetworkError: true };
    }

    logger.error('[syncServico] Erro ao sincronizar servico:', error);

    // Marca como erro localmente
    servicoLocal.sync_status = 'error';
    servicoLocal.error_message = errorMsg || 'Erro ao sincronizar';
    await saveServicoLocal(servicoLocal);

    captureError(error);

    return {
      success: false,
      error: errorMsg || 'Erro desconhecido',
      isNetworkError: false,
    };
  } finally {
    // Libera o lock de sincroniza?fAaAaaAaAaAaaAAAAaAaaAAAasAAaAA?f??s?,?o para ambos os IDs (temp e real)
    currentlySyncingIds.delete(originalId);
    currentlySyncingIds.delete(servicoLocal.id);
  }
}

/**
 * Retorna a quantidade de servicos na fila de sincroniza?fAaAaaAaAaAaaAAAAaAaaAAAasAAaAA?f??s?,?o pendente
 */
export async function getPendingServicosCount(): Promise<number> {
  try {
    const pending = await AsyncStorage.getItem(PENDING_SERVICOS_KEY);
    const pendingIds: string[] = pending ? JSON.parse(pending) : [];
    return pendingIds.length;
  } catch {
    return 0;
  }
}

/**
 * Sincroniza todos os servicos pendentes
 */
export async function syncAllPendingServicos(): Promise<{ success: number; failed: number }> {
  if (syncAllPendingServicosInProgress) {
    logger.servico('[syncAllPendingServicos] Ja em execucao - ignorando chamada concorrente');
    return { success: 0, failed: 0 };
  }
  syncAllPendingServicosInProgress = true;
  try {
    // Verifica conectividade antes de tentar qualquer chamada ao Supabase.
    // Sem esta verifica?fAaAaaAaAaAaaAAAAaAaaAAAasAAaAA?f??s?,?o, tentativas offline causam:
    //   - "J em sincroniza?fAaAaaAaAaAaaAAAAaAaaAAAasAAaAA?f??s?,?o" (lock contention entre auto-sync e sync manual)
    //   - "Network request failed" propagado para o usurio
    const netState = await NetInfo.fetch();
    const isOnline = netState.isConnected === true && netState.isInternetReachable !== false;
    if (!isOnline) {
      logger.servico('[syncAllPendingServicos] Sem conexao, abortando');
      return { success: 0, failed: 0 };
    }

    // Detecta serviços "synced" que têm fotos salvas com URI local (file:///) em vez de URL
    // remota. Isso acontece quando o upload falhou em uma sync anterior. Re-enfileira esses
    // serviços para que o próximo ciclo tente o upload novamente.
    try {
      const indexRaw = await AsyncStorage.getItem(SERVICOS_OBRA_IDS_KEY);
      const indexedObraIds: string[] = indexRaw ? JSON.parse(indexRaw) : [];
      const pendingMapRaw = await AsyncStorage.getItem(PENDING_SERVICOS_MAP_KEY);
      const pendingMapObj: Record<string, string> = pendingMapRaw ? JSON.parse(pendingMapRaw) : {};
      const pendingSetRaw = await AsyncStorage.getItem(PENDING_SERVICOS_KEY);
      const pendingSetIds: string[] = pendingSetRaw ? JSON.parse(pendingSetRaw) : [];
      const pendingSet = new Set(pendingSetIds);
      let requeueCount = 0;

      for (const obraId of indexedObraIds) {
        const storedRaw = await AsyncStorage.getItem(`${LOCAL_SERVICOS_KEY}:${obraId}`);
        if (!storedRaw) continue;
        const servicos: ServicoLocal[] = JSON.parse(storedRaw);
        let changed = false;

        for (const servico of servicos) {
          if (servico.sync_status !== 'synced') continue;
          // Don't re-queue if error_message already set — photos are lost, user must retake
          if ((servico as any).error_message) continue;
          const hasPendingUri = (Object.keys(servico as any) as string[]).some((k) => {
            if (!(k.startsWith('fotos_') || k.startsWith('doc_'))) return false;
            const arr = (servico as any)[k];
            if (!Array.isArray(arr)) return false;
            return arr.some((item: any) => {
              if (!item || typeof item !== 'object') return false;
              const url = item.url ?? item.supabaseUrl ?? item.uploadUrl;
              if (url && String(url).startsWith('http')) return false;
              return !!(item.uri || item.id);
            });
          });

          if (hasPendingUri) {
            servico.sync_status = 'offline';
            servico.error_message = null;
            changed = true;
            if (!pendingSet.has(servico.id)) {
              pendingSet.add(servico.id);
              pendingMapObj[servico.id] = servico.obra_id;
              requeueCount++;
            }
          }
        }

        if (changed) {
          await AsyncStorage.setItem(`${LOCAL_SERVICOS_KEY}:${obraId}`, JSON.stringify(servicos));
        }
      }

      if (requeueCount > 0) {
        await AsyncStorage.setItem(PENDING_SERVICOS_KEY, JSON.stringify([...pendingSet]));
        await AsyncStorage.setItem(PENDING_SERVICOS_MAP_KEY, JSON.stringify(pendingMapObj));
        logger.servico(`[syncAllPendingServicos] ${requeueCount} servico(s) re-enfileirado(s) por fotos com URI local`);
      }
    } catch (requeueErr) {
      logger.warn('[syncAllPendingServicos] Falha ao re-enfileirar servicos com URI pendente:', requeueErr);
    }

    const pendingKey = PENDING_SERVICOS_KEY;
    const mapKey = PENDING_SERVICOS_MAP_KEY;

    const pending = await AsyncStorage.getItem(pendingKey);
    const pendingIdsRaw: string[] = pending ? JSON.parse(pending) : [];
    const pendingIds = Array.from(new Set(pendingIdsRaw));

    if (pendingIds.length === 0) {
      logger.servico('[syncAllPendingServicos] Sem servicos pendentes');
      return { success: 0, failed: 0 };
    }

    if (pendingIds.length !== pendingIdsRaw.length) {
      await AsyncStorage.setItem(pendingKey, JSON.stringify(pendingIds));
      logger.servico(`[syncAllPendingServicos] Fila deduplicada: ${pendingIdsRaw.length} -> ${pendingIds.length}`);
    }

    logger.servico(`[syncAllPendingServicos] Sincronizando ${pendingIds.length} servico(s) pendente(s)`);

    const map = await AsyncStorage.getItem(mapKey);
    const mapObj: Record<string, string> = map ? JSON.parse(map) : {};

    let successCount = 0;
    let failedCount = 0;

    // Carrega contadores de retries permanentes
    const retryCountsRaw = await AsyncStorage.getItem(SERVICO_RETRY_COUNTS_KEY);
    const retryCounts: Record<string, number> = retryCountsRaw ? JSON.parse(retryCountsRaw) : {};

    // Para cada servico pendente, tenta sincronizar
    const servicosARemover: string[] = [];

    for (const servicoId of pendingIds) {
      try {
        let obraId = mapObj[servicoId];

        if (!obraId) {
          logger.warn(`[syncAllPendingServicos] Servico ${servicoId} sem obraId mapeado - tentando recuperar...`);

          // Tentar encontrar em todas as obras locais
          // getLocalObras ja importado no topo do arquivo
          const localObras = await getLocalObras();

          for (const obra of localObras) {
            const key = `${LOCAL_SERVICOS_KEY}:${obra.id}`;
            const stored = await AsyncStorage.getItem(key);
            if (stored) {
              const servicos: ServicoLocal[] = JSON.parse(stored);
              const found = servicos.find((s) => s.id === servicoId);
              if (found) {
                obraId = found.obra_id;
                logger.servico(`[syncAllPendingServicos] Servico ${servicoId} encontrado com obraId: ${obraId}`);
                // Atualizar mapa
                mapObj[servicoId] = obraId;
                await AsyncStorage.setItem(mapKey, JSON.stringify(mapObj));
                break;
              }
            }
          }
        }

        if (!obraId) {
          logger.error(`[syncAllPendingServicos] Servico ${servicoId} nao tem obraId - removendo da fila`);
          servicosARemover.push(servicoId);
          failedCount += 1;
          continue;
        }

        // Busca o servico local
        const key = `${LOCAL_SERVICOS_KEY}:${obraId}`;
        const stored = await AsyncStorage.getItem(key);
        if (!stored) {
          logger.warn(`[syncAllPendingServicos] Servico ${servicoId} nao encontrado localmente - removendo da fila`);
          servicosARemover.push(servicoId);
          failedCount += 1;
          continue;
        }

        const servicos: ServicoLocal[] = JSON.parse(stored);
        const servico = servicos.find((s) => s.id === servicoId);

        if (!servico) {
          logger.warn(`[syncAllPendingServicos] Servico ${servicoId} nao encontrado na obra - removendo da fila`);
          servicosARemover.push(servicoId);
          failedCount += 1;
          continue;
        }

        logger.servico(`[syncAllPendingServicos] Sincronizando servico: ${servicoId} (obra: ${obraId})`);

        // Sincroniza
        const result = await syncServico(servico);
        if (result.isAlreadySyncing) {
          // Outra rotina (ex.: auto-sync) ja esta processando este servico.
          // Nao conta como falha nem incrementa retry para evitar falso negativo.
          logger.servico(`[syncAllPendingServicos] Servico ${servicoId} ja esta em sincronizacao - ignorando duplicata`);
          continue;
        }
        if (result.isDeferred) {
          // Obra local ainda nao tem UUID remoto. Mantem o servico na fila sem contar falha.
          logger.warn(`[syncAllPendingServicos] Servico ${servicoId} aguardando sincronizacao da obra antes do envio`);
          continue;
        }
        if (result.success) {
          successCount += 1;
          // Limpa contador de retries ao ter sucesso
          delete retryCounts[servicoId];
          logger.servico(`[syncAllPendingServicos] Servico ${servicoId} sincronizado com sucesso`);
        } else {
          failedCount += 1;
          logger.error(`[syncAllPendingServicos] Falha ao sincronizar servico ${servicoId}: ${result.error}`);

          // S conta retries para erros permanentes (nao de rede)
          if (!result.isNetworkError) {
            const count = (retryCounts[servicoId] || 0) + 1;
            retryCounts[servicoId] = count;
            if (count >= MAX_SERVICO_RETRIES) {
              logger.error(`[syncAllPendingServicos] Servico ${servicoId} atingiu ${MAX_SERVICO_RETRIES} falhas permanentes - removendo da fila`);
              servicosARemover.push(servicoId);
            } else {
              logger.warn(`[syncAllPendingServicos] Servico ${servicoId} falhou ${count}/${MAX_SERVICO_RETRIES} vezes`);
            }
          }
        }
      } catch (error) {
        logger.error(`[syncAllPendingServicos] Erro ao sincronizar ${servicoId}:`, error);
        failedCount += 1;
      }
    }

    // Persiste contadores de retries atualizados
    await AsyncStorage.setItem(SERVICO_RETRY_COUNTS_KEY, JSON.stringify(retryCounts));

    // Remove os servicos ruins da fila para evitar loop infinito
    if (servicosARemover.length > 0) {
      const remainingPending = pendingIds.filter((id) => !servicosARemover.includes(id));
      await AsyncStorage.setItem(pendingKey, JSON.stringify(remainingPending));
      logger.servico(`[syncAllPendingServicos] Removidos ${servicosARemover.length} servicos da fila`);

      // Tambem remove do mapa
      const updatedMap = { ...mapObj };
      servicosARemover.forEach((id) => delete updatedMap[id]);
      await AsyncStorage.setItem(mapKey, JSON.stringify(updatedMap));
    }

    logger.servico(`[syncAllPendingServicos] Resultado: ${successCount} sucesso, ${failedCount} falhas`);
    return { success: successCount, failed: failedCount };
  } catch (error) {
    logger.error('Erro ao sincronizar servicos pendentes:', error);
    captureError(error);
    return { success: 0, failed: 0 };
  } finally {
    syncAllPendingServicosInProgress = false;
  }
}

/**
 * Deleta um servico (local e remoto)
 * Suas fotos tambm so deletadas do Supabase Storage
 */
export async function deleteServico(servicoId: string, obraId: string): Promise<boolean> {
  try {
    // Deleta remotamente (se conectado)
    const { error: deleteError } = await supabase
      .from('servicos')
      .delete()
      .eq('id', servicoId);

    if (deleteError && deleteError.code !== 'PGRST116') {
      logger.warn('Erro ao deletar servico remotamente:', deleteError);
      // Continua mesmo com erro remoto
    }

    // Deleta localmente
    const key = `${LOCAL_SERVICOS_KEY}:${obraId}`;
    const stored = await AsyncStorage.getItem(key);
    if (stored) {
      const servicos: ServicoLocal[] = JSON.parse(stored);
      const updated = servicos.filter((s) => s.id !== servicoId);
      await AsyncStorage.setItem(key, JSON.stringify(updated));
    }

    // Remove da fila de pending
    const pendingKey = PENDING_SERVICOS_KEY;
    const pending = await AsyncStorage.getItem(pendingKey);
    if (pending) {
      const pendingList: string[] = JSON.parse(pending);
      const updated = pendingList.filter((id) => id !== servicoId);
      await AsyncStorage.setItem(pendingKey, JSON.stringify(updated));
    }

    // Remove do mapa auxiliar
    const mapKey = PENDING_SERVICOS_MAP_KEY;
    const map = await AsyncStorage.getItem(mapKey);
    if (map) {
      const mapObj: Record<string, string> = JSON.parse(map);
      delete mapObj[servicoId];
      await AsyncStorage.setItem(mapKey, JSON.stringify(mapObj));
    }

    return true;
  } catch (error) {
    logger.error('Erro ao deletar servico:', error);
    captureError(error);
    return false;
  }
}

/**
 * Fetch servicos de uma obra do Supabase
 */
export async function fetchServicosForObra(obraId: string): Promise<Servico[]> {
  try {
    const relatedObraIds = await resolveRelatedObraIds(obraId);
    const remoteObraId = [obraId, ...relatedObraIds].find((id) => isUuid(id)) || null;
    
    try {
      await recoverLostServicoPhotos(obraId);
    } catch (recoverErr) {
      logger.warn('[fetchServicosForObra] Falha na recuperacao local:', recoverErr);
    }
    const local = await getLocalServicos(obraId);

    const netState = await NetInfo.fetch();
    const isOnline = netState.isConnected === true && netState.isInternetReachable !== false;
    
    if (!isOnline || !remoteObraId) {
      return hydrateServicosPhotoFields(local as unknown as Servico[]);
    }

    const { data, error } = await supabase
      .from('servicos')
      .select('*')
      .eq('obra_id', remoteObraId)
      .order('created_at', { ascending: true });

    if (error) throw error;

    const remote = data || [];


    // Cachear serviAAAfAAos remotos localmente para suporte offline
    // Isso permite que appendPhotoToServicoLocal encontre serviAAAfAAos mesmo sem conexAAAfAAo
    // existingList AAAfAA a versAAAfAAo mesclada que serAAAfAA retornada (preserva URIs locais)
    const localKey = `${LOCAL_SERVICOS_KEY}:${remoteObraId}`;
    // Sempre parte dos dados locais frescos para capturar mudanÃ§as offline (ex.: fotos recÃ©m adicionadas)
    // Usar o cache existente como base causava perda de fotos quando appendPhotoToServicoLocal
    // salvava em chave diferente (temp-xxx vs uuid)
    const existingList: any[] = [...(local as any[])];
    let mergedSource: any[] = existingList;

    if (remote.length > 0) {
      let changed = false;
      for (const s of remote) {
        const idx = existingList.findIndex((l: any) => l.id === s.id);
        // Ao cachear versAAAfAAo remota, preservar campos de fotos locais que tenham uri
        // (foto offline ainda nAAAfAAo sincronizada -> {id,uri} local vs [] no Supabase)
        const cached: any = { ...s, sync_status: 'synced' as SyncStatusServico };
        if (idx >= 0) {
          const localItem = existingList[idx];
          const mergedDadosAdicionais = mergeDadosAdicionaisPreservingLocal(
            localItem?.dados_adicionais,
            cached?.dados_adicionais
          );
          if (mergedDadosAdicionais) {
            cached.dados_adicionais = mergedDadosAdicionais;
          }
          // Para cada campo fotos_*, se o local tem objetos com uri mas o remote nAAAfAAo tem URLs -> manter local
          for (const key of Object.keys(localItem)) {
            if ((key.startsWith('fotos_') || key.startsWith('doc_')) && Array.isArray(localItem[key])) {
              const localPhotos: any[] = localItem[key];
              const remotePhotos: any[] = cached[key] || [];
              const localHasUri = localPhotos.some((p: any) => p && typeof p === 'object' && p.uri);
              const remoteHasUrl = remotePhotos.some((p: any) => p && typeof p === 'object' && p.url);
              if (localPhotos.length > remotePhotos.length) {
                cached[key] = mergePhotoArraysPreservingLocal(localPhotos, remotePhotos);
              } else if (localHasUri && remoteHasUrl) {
                // Ambos tAAAfAAm dados: enriquecer fotos remotas com URIs locais para fallback offline.
                // Assim, se a URL do Supabase ficar inacessAAAfAAvel, o arquivo local ainda AAAfAA exibido.
                cached[key] = mergePhotoArraysPreservingLocal(localPhotos, remotePhotos);
              } else if (localHasUri && !remoteHasUrl) {
                cached[key] = localPhotos; // Remote sem URLs -> usar local
              }
            }
          }

          // Preserva estruturas aninhadas (postes/checklists) quando o snapshot local estiver mais completo.
          // Isso evita perder fotos de P2/P3 quando o remoto retorna payload parcial/desatualizado.
          const nestedFields = [
            'postes_data',
            'checklist_postes_data',
            'checklist_seccionamentos_data',
            'checklist_aterramentos_cerca_data',
            'checklist_hastes_termometros_data',
          ] as const;
          for (const field of nestedFields) {
            const localNested = localItem?.[field];
            const remoteNested = cached?.[field];
            if (shouldKeepLocalNestedField(field, localNested, remoteNested)) {
              cached[field] = localNested;
            }
          }

          // Mantem a versao mais confiavel entre local e remoto para nao perder mudancas
          // offline (ex.: status "completo" antes do sync remoto confirmar).
          const bestRecord = pickBestServicoRecord(localItem, cached);
          // client_pk gerado localmente (prefixo svc_) nunca deve ser perdido ao mesclar com
          // o remoto: se a coluna ainda nao existe no DB ou foi substituida pelo default UUID,
          // o registro remoto vem sem client_pk ou com UUID — preservar o valor local.
          const preservedClientPk = String(localItem.client_pk || '').startsWith('svc_')
            ? localItem.client_pk
            : (bestRecord.client_pk || localItem.client_pk || cached.client_pk);
          existingList[idx] = preservedClientPk !== bestRecord.client_pk
            ? { ...bestRecord, client_pk: preservedClientPk }
            : bestRecord;
        } else {
          existingList.push(cached);
          changed = true;
        }
      }
      // Remove entradas temp-xxx que jAAAfAA foram sincronizadas (nAAAfAAo estAAAfAAo mais na fila pendente).
      // Isso evita duplicaAAAfAAAAAfAAo quando fetchServicosForObra roda concorrentemente com syncServico:
      // o local ainda tem temp-xxx enquanto o remote jAAAfAA retornou o uuid-123.
      const pendingRaw = await AsyncStorage.getItem(PENDING_SERVICOS_KEY);
      const pendingIds: string[] = pendingRaw ? JSON.parse(pendingRaw) : [];
      const cleanedList = existingList.filter((item: any) => {
        if (isUuid(item.id)) return true; // sempre manter entradas com UUID real
        return pendingIds.includes(item.id); // manter temp-xxx sAAAfAA se ainda estiver pendente
      });
      const listToSave = cleanedList.length !== existingList.length ? cleanedList : existingList;
      mergedSource = listToSave;

      if (changed || remote.length > 0) {
        await AsyncStorage.setItem(localKey, JSON.stringify(listToSave));
      }
    }

    // Retorna existingList que jAAAfAA tem remote + local mesclados com preservaAAAfAAAAAfAAo de URIs.
    // NAO usa [...remote, ...local] pois remote teria arrays de fotos vazios que sobrescreveriam URIs locais.
    const pendingRawFinal = await AsyncStorage.getItem(PENDING_SERVICOS_KEY);
    const pendingIdsFinal: string[] = pendingRawFinal ? JSON.parse(pendingRawFinal) : [];
    const pendingFinalSet = new Set((pendingIdsFinal || []).filter((id) => typeof id === 'string' && id.trim().length > 0));
    const mapRawFinal = await AsyncStorage.getItem(PENDING_SERVICOS_MAP_KEY);
    const pendingMapFinal: Record<string, string> = mapRawFinal ? JSON.parse(mapRawFinal) : {};
    let pendingQueueChanged = false;

    // Auto-heal: se um servico local esta offline/error mas sumiu da fila, recoloca.
    for (const servico of mergedSource as any[]) {
      const servicoId = String(servico?.id || '').trim();
      if (!servicoId) continue;
      const status = String(servico?.sync_status || '').trim();
      const shouldBePending = status === 'offline' || status === 'error' || status === 'pending';
      if (!shouldBePending) continue;
      if (!pendingFinalSet.has(servicoId)) {
        pendingFinalSet.add(servicoId);
        pendingQueueChanged = true;
      }
      if (!pendingMapFinal[servicoId]) {
        const mapObraId = String(servico?.obra_id || remoteObraId || obraId || '').trim();
        if (mapObraId) {
          pendingMapFinal[servicoId] = mapObraId;
          pendingQueueChanged = true;
        }
      }
    }

    // Limpa IDs que ja estao sincronizados no snapshot atual desta obra.
    for (const servico of mergedSource as any[]) {
      const servicoId = String(servico?.id || '').trim();
      if (!servicoId || !pendingFinalSet.has(servicoId)) continue;
      const status = String(servico?.sync_status || '').trim();
      if (status === 'synced') {
        pendingFinalSet.delete(servicoId);
        delete pendingMapFinal[servicoId];
        pendingQueueChanged = true;
      }
    }

    if (pendingQueueChanged) {
      await AsyncStorage.multiSet([
        [PENDING_SERVICOS_KEY, JSON.stringify(Array.from(pendingFinalSet))],
        [PENDING_SERVICOS_MAP_KEY, JSON.stringify(pendingMapFinal)],
      ]);
    }

    const merged = mergedSource.filter(
      (servico: any, index: number, arr: any[]) => {
        if (arr.findIndex((item: any) => item.id === servico.id) !== index) return false; // dedup por ID
        if (isUuid(servico.id)) return true; // sempre manter UUID
        return pendingFinalSet.has(servico.id); // temp-xxx so se ainda pendente
      }
    ) as Servico[];

    const dedupedMerged = dedupeServicosByFingerprint(merged);
    logger.servico(`[fetchServicosForObra] Antes de hidratar: ${dedupedMerged.length} servico(s)`);
    
    // DEBUG: verificar estruturas aninhadas antes da hydração
    for (const srv of dedupedMerged) {
      if (srv.postes_data && Array.isArray(srv.postes_data) && srv.postes_data.length > 0) {
        logger.debug(`[fetchServicosForObra] Servico ${srv.id}: postes_data=${srv.postes_data.length} postes`);
      }
      if (srv.checklist_postes_data && Array.isArray(srv.checklist_postes_data) && srv.checklist_postes_data.length > 0) {
        logger.debug(`[fetchServicosForObra] Servico ${srv.id}: checklist_postes_data=${srv.checklist_postes_data.length} postes`);
      }
    }

    return hydrateServicosPhotoFields(dedupedMerged);
  } catch (error) {
    const message = error instanceof Error
      ? error.message
      : ((error as any)?.message || (typeof error === 'object' && error !== null ? JSON.stringify(error) : String(error)));
    const isNetworkError = /network request failed|failed to fetch|timeout|unable to resolve host|no address associated with hostname|failed to connect|network is unreachable/i.test(message);
    if (isNetworkError) {
      logger.warn('Sem conexao para buscar servicos remotos. Usando cache local.');
    } else {
      logger.error('Erro ao buscar servicos da obra:', error);
      captureError(error);
    }
    const local = await getLocalServicos(obraId);
    return hydrateServicosPhotoFields(local as unknown as Servico[]);
  }
}


/**
 * Cria um novo servico (local e remoto)
 */
export async function createServico(
  obraId: string,
  tipoServico: string,
  responsavel?: string,
  obraNumero?: string,
  equipe?: string
): Promise<{ success: boolean; servico?: ServicoLocal; error?: string; syncSuccess?: boolean; syncError?: string }> {
  try {
    // Idempotencia local para evitar dupla criacao em cliques/eventos repetidos.
    const nowMs = Date.now();
    const recentWindowMs = 20_000;
    const tipoKey = normalizeServicoTipoKey(tipoServico);
    const existingLocal = await getLocalServicos(obraId);
    const posteScopedTipo = SERVICO_POSTES_STORAGE_TIPOS.has(String(tipoServico || '').trim());
    const duplicateCandidates = existingLocal
      .filter((item) => {
        if (normalizeServicoTipoKey(item.tipo_servico) !== tipoKey) return false;
        if (String(item.status || '') !== 'rascunho') return false;
        if (String(item.obra_id || '') !== String(obraId || '')) return false;
        if (getServicoPhotoCount(item) > 0) return false;
        const createdAtMs = toTimestampMs(item.created_at);
        if (createdAtMs === null) return false;
        return nowMs - createdAtMs <= recentWindowMs;
      })
      .sort((a, b) => (toTimestampMs(b.created_at) || 0) - (toTimestampMs(a.created_at) || 0));

    let recentDuplicate: ServicoLocal | undefined;
    for (const candidate of duplicateCandidates) {
      if (!posteScopedTipo) {
        recentDuplicate = candidate;
        break;
      }
      try {
        const bucketRaw = await AsyncStorage.getItem(getServicoPostesStorageKey(candidate.id));
        if (!bucketRaw) {
          recentDuplicate = candidate;
          break;
        }
        const bucket = JSON.parse(bucketRaw);
        const bucketHasPhotos = Array.isArray(bucket) && getNestedFieldPhotoCount('postes_data', bucket) > 0;
        if (!bucketHasPhotos) {
          recentDuplicate = candidate;
          break;
        }
      } catch {
        recentDuplicate = candidate;
        break;
      }
    }

    if (recentDuplicate) {
      logger.warn(`[createServico] Reutilizando rascunho recente para evitar duplicacao: ${recentDuplicate.id}`);
      return {
        success: true,
        servico: recentDuplicate,
        syncSuccess: recentDuplicate.sync_status === 'synced',
      };
    }

    const now = new Date().toISOString();
    const servico: ServicoLocal = {
      id: `temp-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`, // ID temporAAaAaa????T?f??s?,??fAaAaaAAAasAAaAA?f??s?,??fAaAaaAAAasAAaAA?f??s?,?rio, serAAaAaa????T?f??s?,??fAaAaaAAAasAAaAA?f??s?,??fAaAaaAAAasAAaAA?f??s?,? substituAAaAaa????T?f??s?,??fAaAaaAAAasAAaAA?f??s?,??fAaAaaAAAasAAaAA?f??s?,?do pelo servidor
      client_pk: generateClientPk(),
      obra_id: obraId,
      obra_numero: obraNumero,
      equipe,
      tipo_servico: tipoServico as any,
      responsavel,
      status: 'rascunho',
      sync_status: 'offline',
      created_at: now,
      updated_at: now,
      fotos_antes: [],
      fotos_durante: [],
      fotos_depois: [],
      dados_adicionais: {},
    };

    // SEMPRE salva localmente PRIMEIRO (mantm offline-first)
    // Isto tambm cria a mapping de servicoId -> obraId
    await saveServicoLocal(servico);

    if (SERVICO_POSTES_STORAGE_TIPOS.has(String(servico.tipo_servico || '').trim())) {
      try {
        await AsyncStorage.setItem(getServicoPostesStorageKey(servico.id), JSON.stringify([]));
      } catch (storageErr) {
        logger.warn('[createServico] Falha ao inicializar bucket isolado de postes:', storageErr);
      }
    }

    if (!isUuid(obraId)) {
      logger.servico(`[createServico] Servico ${servico.id} criado offline para obra local ${obraId}`);
      return { success: true, servico };
    }

    // Retorna imediatamente apÃ³s salvar localmente â€” sync acontece em background
    // para nÃ£o bloquear a UI (~4s de roundtrip com Supabase quando online)
    NetInfo.fetch().then((netState) => {
      const isOnlineNow = netState.isConnected === true && netState.isInternetReachable !== false;
      if (!isOnlineNow) return;
      void syncServico(servico).catch((err) => {
        logger.warn(`[createServico] Sync background falhou para ${servico.id}:`, err);
      });
    }).catch(() => {});

    return { success: true, servico, syncSuccess: false };
  } catch (error: any) {
    logger.error('Erro ao criar servico:', error);
    captureError(error);
    return { success: false, error: error.message };
  }
}

/**
 * Marca um servico como completo
 */
export async function markServicoComplete(
  servicoId: string,
  obraId: string,
  fallbackServico?: Partial<ServicoLocal>
): Promise<boolean> {
  try {
    const now = new Date().toISOString();

    const findServicoInAnyLocalKey = async (): Promise<{
      key: string;
      servicos: ServicoLocal[];
      index: number;
    } | null> => {
      const preferredKey = `${LOCAL_SERVICOS_KEY}:${obraId}`;
      const preferredStored = await AsyncStorage.getItem(preferredKey);
      if (preferredStored) {
        const preferredServicos: ServicoLocal[] = JSON.parse(preferredStored);
        const preferredIndex = preferredServicos.findIndex((s) => s.id === servicoId);
        if (preferredIndex >= 0) {
          return { key: preferredKey, servicos: preferredServicos, index: preferredIndex };
        }
      }

      const indexRaw = await AsyncStorage.getItem(SERVICOS_OBRA_IDS_KEY);
      const indexedIds: string[] = indexRaw ? JSON.parse(indexRaw) : [];
      const serviceKeys = indexedIds.map((id) => `${LOCAL_SERVICOS_KEY}:${id}`);
      for (const candidateKey of serviceKeys) {
        if (candidateKey === preferredKey) continue;
        const candidateStored = await AsyncStorage.getItem(candidateKey);
        if (!candidateStored) continue;

        const candidateServicos: ServicoLocal[] = JSON.parse(candidateStored);
        const candidateIndex = candidateServicos.findIndex((s) => s.id === servicoId);
        if (candidateIndex >= 0) {
          return { key: candidateKey, servicos: candidateServicos, index: candidateIndex };
        }
      }

      return null;
    };

    const localFound = await findServicoInAnyLocalKey();
    let localSaved = false;
    let localUpdatedServico: ServicoLocal | null = null;

    if (localFound) {
      const { key, servicos, index } = localFound;
      servicos[index] = {
        ...servicos[index],
        status: 'completo',
        updated_at: now,
        sync_status: 'offline',
        error_message: null,
      };
      localUpdatedServico = servicos[index];
      await AsyncStorage.setItem(key, JSON.stringify(servicos));
      await saveServicoLocal(localUpdatedServico);
      localSaved = true;
    } else if (fallbackServico) {
      // Fallback: garante persistencia local mesmo quando o cache da obra/servico
      // ainda nao foi montado no AsyncStorage.
      const synthesized: ServicoLocal = {
        id: servicoId,
        obra_id: obraId,
        obra_numero: fallbackServico.obra_numero,
        tipo_servico: (fallbackServico.tipo_servico as any) || 'DocumentaÃ§Ã£o',
        responsavel: fallbackServico.responsavel,
        status: 'completo',
        sync_status: 'offline',
        error_message: null,
        created_at: fallbackServico.created_at || now,
        updated_at: now,
        fotos_antes: Array.isArray((fallbackServico as any).fotos_antes) ? (fallbackServico as any).fotos_antes : [],
        fotos_durante: Array.isArray((fallbackServico as any).fotos_durante) ? (fallbackServico as any).fotos_durante : [],
        fotos_depois: Array.isArray((fallbackServico as any).fotos_depois) ? (fallbackServico as any).fotos_depois : [],
        dados_adicionais: (fallbackServico as any).dados_adicionais || {},
      };

      localUpdatedServico = synthesized;
      await saveServicoLocal(synthesized);
      localSaved = true;
    }

    // Para IDs nao definitivos, somente cache local.
    if (!isUuid(obraId) || !isUuid(servicoId)) {
      return localSaved;
    }

    // Tenta atualizar remoto; se falhar, o item ja ficou em offline para subir na fila.
    let remoteUpdated = false;
    try {
      const { error } = await supabase
        .from('servicos')
        .update({ status: 'completo', updated_at: now })
        .eq('id', servicoId);

      if (!error) {
        remoteUpdated = true;
        if (localUpdatedServico) {
          await saveServicoLocal({
            ...localUpdatedServico,
            sync_status: 'synced',
            error_message: null,
            updated_at: now,
          });
        }
      } else {
        logger.warn(`[markServicoComplete] Falha ao atualizar remoto ${servicoId}:`, error);
      }
    } catch (error) {
      logger.warn(`[markServicoComplete] Erro de rede ao atualizar remoto ${servicoId}:`, error);
    }

    return localSaved || remoteUpdated;
  } catch (error) {
    logger.error('Erro ao marcar servico como completo:', error);
    captureError(error);
    return false;
  }
}

/**
 * Adiciona foto local em um campo de fotos do servico no AsyncStorage.
 * Salva um objeto FotoInfo (com uri) para que o preview seja exibido corretamente offline.
 */
export async function appendPhotoToServicoLocal(
  servicoId: string,
  obraId: string,
  fieldName: keyof ServicoLocal,
  photoId: string,
  localUri?: string,
  geoData?: {
    latitude?: number | null;
    longitude?: number | null;
    utmX?: number | null;
    utmY?: number | null;
    utmZone?: string | null;
  }
): Promise<boolean> {
  try {
    const relatedObraIds = await resolveRelatedObraIds(obraId);
    const prioritizedObraIds = dedupeStrings([
      ...relatedObraIds.filter((id) => isUuid(id)),
      ...relatedObraIds.filter((id) => !isUuid(id)),
    ]);

    let targetKey: string | null = null;
    let targetObraId = obraId;
    let servicos: ServicoLocal[] = [];
    let index = -1;

    for (const candidateObraId of prioritizedObraIds) {
      const candidateKey = `${LOCAL_SERVICOS_KEY}:${candidateObraId}`;
      const candidateStored = await AsyncStorage.getItem(candidateKey);
      if (!candidateStored) continue;

      const candidateServicos: ServicoLocal[] = JSON.parse(candidateStored);
      const candidateIndex = candidateServicos.findIndex((s) => s.id === servicoId);
      if (candidateIndex >= 0) {
        targetKey = candidateKey;
        targetObraId = candidateObraId;
        servicos = candidateServicos;
        index = candidateIndex;
        break;
      }
    }

    if (!targetKey || index < 0) {
      // Fallback: procura em qualquer cache de serviÃ§o para evitar reset do fluxo offline
      const indexRaw = await AsyncStorage.getItem(SERVICOS_OBRA_IDS_KEY);
      const indexedIds: string[] = indexRaw ? JSON.parse(indexRaw) : [];
      const serviceKeys = indexedIds.map((id) => `${LOCAL_SERVICOS_KEY}:${id}`);

      for (const candidateKey of serviceKeys) {
        const candidateStored = await AsyncStorage.getItem(candidateKey);
        if (!candidateStored) continue;

        const candidateServicos: ServicoLocal[] = JSON.parse(candidateStored);
        const candidateIndex = candidateServicos.findIndex((s) => s.id === servicoId);
        if (candidateIndex >= 0) {
          targetKey = candidateKey;
          targetObraId = candidateKey.replace(`${LOCAL_SERVICOS_KEY}:`, '');
          servicos = candidateServicos;
          index = candidateIndex;
          break;
        }
      }
    }

    if (!targetKey || index < 0) {
      // Fallback: o serviço pode ter sido sincronizado e o ID temp-xxx substituído por UUID
      // enquanto a UI ainda mostrava o ID antigo (race condition background sync vs. foto).
      try {
        const remapRaw = await AsyncStorage.getItem(SERVICO_ID_REMAP_KEY);
        if (remapRaw) {
          const remap: Record<string, string> = JSON.parse(remapRaw);
          const remappedId = remap[servicoId];
          if (remappedId && remappedId !== servicoId) {
            return appendPhotoToServicoLocal(remappedId, obraId, fieldName, photoId, localUri, geoData);
          }
        }
      } catch {}
      return false;
    }

    const currentRaw = (servicos[index] as any)[fieldName];
    let current: any[] = [];
    if (typeof currentRaw === 'string') {
      try { current = JSON.parse(currentRaw); } catch {}
    } else {
      current = Array.isArray(currentRaw) ? currentRaw : [];
    }

    const normalized = [...current];

    // Verifica se jÃ’Â¡ existe p/ evitar duplicidade
    const alreadyExists = normalized.some((item: any) => {
      if (typeof item === 'string') return item === photoId;
      if (item && item.id) return item.id === photoId;
      if (item && item.photoId) return item.photoId === photoId;
      return false;
    });

    if (!alreadyExists) {
      // Salva FotoInfo completo com uri local + geolocalizaÃ’Â§Ã’Â£o para preview e sync correto
      normalized.push({
        id: photoId,
        uri: localUri || photoId,
        timestamp: Date.now(),
        latitude: geoData?.latitude ?? null,
        longitude: geoData?.longitude ?? null,
        utm_x: geoData?.utmX ?? null,
        utm_y: geoData?.utmY ?? null,
        utm_zone: geoData?.utmZone ?? null,
      });
    }

    const previousServico = servicos[index] as ServicoLocal;
    const nextObraId = isUuid(targetObraId) ? targetObraId : previousServico.obra_id;
    const updatedServico: ServicoLocal = {
      ...previousServico,
      obra_id: nextObraId,
      [fieldName]: normalized,
      updated_at: new Date().toISOString(),
      sync_status: 'offline',
      error_message: null,
    };

    servicos[index] = updatedServico;

    await AsyncStorage.setItem(targetKey, JSON.stringify(servicos));
    await saveServicoLocal(updatedServico);
    return true;
  } catch (error) {
    logger.error('Erro ao adicionar foto local ao serviÃ’Â§o:', error);
    captureError(error);
    return false;
  }
}

/**
 * Atualiza referncia de obra nos servicos locais apos sincroniza?fAaAaaAaAaAaaAAAAaAaaAAAasAAaAA?f??s?,?o da obra
 */
export async function remapServicosObraId(oldObraId: string, newObraId: string): Promise<number> {
  try {
    if (!oldObraId || !newObraId || oldObraId === newObraId) return 0;

    const oldKey = `${LOCAL_SERVICOS_KEY}:${oldObraId}`;
    const newKey = `${LOCAL_SERVICOS_KEY}:${newObraId}`;
    const oldStored = await AsyncStorage.getItem(oldKey);
    const newStored = await AsyncStorage.getItem(newKey);

    const oldServicos: ServicoLocal[] = oldStored ? JSON.parse(oldStored) : [];
    const newServicos: ServicoLocal[] = newStored ? JSON.parse(newStored) : [];

    if (oldServicos.length === 0) {
      return 0;
    }

    const remappedOld = oldServicos.map((servico) => ({ ...servico, obra_id: newObraId }));
    const merged = [...newServicos];

    for (const servico of remappedOld) {
      const index = merged.findIndex((s) => s.id === servico.id);
      if (index >= 0) {
        merged[index] = servico;
      } else {
        merged.push(servico);
      }
    }

    await AsyncStorage.setItem(newKey, JSON.stringify(merged));
    await AsyncStorage.removeItem(oldKey);

    const mapStored = await AsyncStorage.getItem(PENDING_SERVICOS_MAP_KEY);
    if (mapStored) {
      const mapObj: Record<string, string> = JSON.parse(mapStored);
      let changed = false;

      Object.entries(mapObj).forEach(([servicoId, obraId]) => {
        if (obraId === oldObraId) {
          mapObj[servicoId] = newObraId;
          changed = true;
        }
      });

      if (changed) {
        await AsyncStorage.setItem(PENDING_SERVICOS_MAP_KEY, JSON.stringify(mapObj));
      }
    }

    return remappedOld.length;
  } catch (error) {
    logger.error('Erro ao remapear obra_id dos servicos:', error);
    captureError(error);
    return 0;
  }
}

