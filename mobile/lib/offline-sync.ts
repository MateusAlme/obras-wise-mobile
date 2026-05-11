import AsyncStorage from '@react-native-async-storage/async-storage';
import NetInfo from '@react-native-community/netinfo';
import { supabase } from './supabase';
import { Alert } from 'react-native';
import { backupPhoto, PhotoMetadata, getPendingPhotos, updatePhotosObraId, getAllPhotoMetadata, pruneArchivedPhotoMetadata } from './photo-backup';
import { processObraPhotos, UploadProgress } from './photo-queue';
import { captureError } from './sentry';
import { logger } from '../utils/logger';
import { createEmergencyBackup, shouldCreateEmergencyBackup } from './emergency-backup';

const PENDING_OBRAS_KEY = '@obras_pending_sync';
const SYNC_STATUS_KEY = '@sync_status';
const LOCAL_OBRAS_KEY = '@obras_local';
// Chunked storage para @obras_local — evita o erro "Row too big" do SQLite Android (limite ~2MB por linha)
const LOCAL_OBRAS_CHUNK_KEY = '@obras_local_c';
const LOCAL_OBRAS_CHUNK_COUNT = '@obras_local_n';
const OBRAS_CHUNK_MAX_BYTES = 1_400_000; // 1.4MB por chunk, bem abaixo do limite de 2MB

/** Lê todas as obras locais independente do formato (chave única ou chunks). */
async function readObrasRaw(): Promise<LocalObra[]> {
  const nRaw = await AsyncStorage.getItem(LOCAL_OBRAS_CHUNK_COUNT);
  if (nRaw) {
    const n = parseInt(nRaw, 10);
    if (n > 0) {
      const keys = Array.from({ length: n }, (_, i) => `${LOCAL_OBRAS_CHUNK_KEY}${i}`);
      const pairs = await AsyncStorage.multiGet(keys);
      const all: LocalObra[] = [];
      for (const [, chunk] of pairs) {
        if (chunk) all.push(...(JSON.parse(chunk) as LocalObra[]));
      }
      return all;
    }
  }
  const raw = await AsyncStorage.getItem(LOCAL_OBRAS_KEY);
  return raw ? (JSON.parse(raw) as LocalObra[]) : [];
}

/** Escreve obras locais, dividindo em chunks se necessário. */
async function writeObrasRaw(obras: LocalObra[]): Promise<void> {
  const json = JSON.stringify(obras);
  if (json.length <= OBRAS_CHUNK_MAX_BYTES) {
    const nRaw = await AsyncStorage.getItem(LOCAL_OBRAS_CHUNK_COUNT);
    if (nRaw) {
      const oldN = parseInt(nRaw, 10);
      const toRemove = [LOCAL_OBRAS_CHUNK_COUNT, ...Array.from({ length: oldN }, (_, i) => `${LOCAL_OBRAS_CHUNK_KEY}${i}`)];
      await AsyncStorage.multiRemove(toRemove);
    }
    await AsyncStorage.setItem(LOCAL_OBRAS_KEY, json);
    return;
  }
  const chunks: LocalObra[][] = [[]];
  let used = 0;
  for (const obra of obras) {
    const s = JSON.stringify(obra);
    if (used + s.length > OBRAS_CHUNK_MAX_BYTES && chunks[chunks.length - 1].length > 0) {
      chunks.push([]);
      used = 0;
    }
    chunks[chunks.length - 1].push(obra);
    used += s.length;
  }
  const nRaw = await AsyncStorage.getItem(LOCAL_OBRAS_CHUNK_COUNT);
  const oldN = nRaw ? parseInt(nRaw, 10) : 0;
  const writes: [string, string][] = [
    [LOCAL_OBRAS_CHUNK_COUNT, String(chunks.length)],
    ...chunks.map((c, i) => [`${LOCAL_OBRAS_CHUNK_KEY}${i}`, JSON.stringify(c)] as [string, string]),
  ];
  await AsyncStorage.multiSet(writes);
  const toRemove = [LOCAL_OBRAS_KEY, ...Array.from({ length: Math.max(0, oldN - chunks.length) }, (_, i) => `${LOCAL_OBRAS_CHUNK_KEY}${chunks.length + i}`)];
  await AsyncStorage.multiRemove(toRemove);
}

/** Exportado para módulos externos que precisam salvar a lista completa de obras. */
export const saveLocalObras = writeObrasRaw;

let syncInProgress = false;
// Debounce global para evitar múltiplos triggers simultâneos do auto-sync
// (vários screens registram startAutoSync ao mesmo tempo)
let autoSyncDebounceTimer: ReturnType<typeof setTimeout> | null = null;

export interface PendingObra {
  id: string;
  data: string;
  obra: string;
  responsavel: string;
  equipe: string;
  tipo_servico: string;
  legacy_servico_id?: string | null; // Isola rascunhos por card de servico legado
  status?: 'em_aberto' | 'rascunho' | 'finalizada'; // Status da obra
  finalizada_em?: string | null; // Data de finalização
  origem?: 'online' | 'offline'; // Origem da obra
  fotos_antes: string[]; // Array de photoIds
  fotos_durante: string[];
  fotos_depois: string[];
  fotos_abertura: string[];
  fotos_fechamento: string[];
  fotos_ditais_abertura: string[];
  fotos_ditais_impedir: string[];
  fotos_ditais_testar: string[];
  fotos_ditais_aterrar: string[];
  fotos_ditais_sinalizar: string[];
  fotos_aterramento_vala_aberta: string[];
  fotos_aterramento_hastes: string[];
  fotos_aterramento_vala_fechada: string[];
  fotos_aterramento_medicao: string[];
  transformador_status?: string | null;
  fotos_transformador_laudo: string[];
  fotos_transformador_componente_instalado: string[];
  fotos_transformador_tombamento_instalado: string[];
  fotos_transformador_tape: string[];
  fotos_transformador_placa_instalado: string[];
  fotos_transformador_instalado: string[];
  fotos_transformador_antes_retirar: string[];
  fotos_transformador_laudo_retirado: string[];
  fotos_transformador_tombamento_retirado: string[];
  fotos_transformador_placa_retirado: string[];
  fotos_transformador_conexoes_primarias_instalado: string[];
  fotos_transformador_conexoes_secundarias_instalado: string[];
  fotos_transformador_conexoes_primarias_retirado: string[];
  fotos_transformador_conexoes_secundarias_retirado: string[];
  fotos_medidor_padrao: string[];
  fotos_medidor_leitura: string[];
  fotos_medidor_selo_born: string[];
  fotos_medidor_selo_caixa: string[];
  fotos_medidor_identificador_fase: string[];
  // Checklist de Fiscalização
  fotos_checklist_croqui: string[];
  fotos_checklist_panoramica_inicial: string[];
  fotos_checklist_chede: string[];
  fotos_checklist_aterramento_cerca: string[];
  fotos_checklist_padrao_geral: string[];
  fotos_checklist_padrao_interno: string[];
  fotos_checklist_panoramica_final: string[];
  fotos_checklist_postes: string[]; // Todas fotos de postes em um array flat
  fotos_checklist_seccionamentos: string[]; // Todas fotos de seccionamento em um array flat
  // Documentação (PDFs)
  doc_cadastro_medidor: string[];
  doc_laudo_transformador: string[];
  doc_laudo_regulador: string[];
  doc_laudo_religador: string[];
  doc_apr: string[];
  doc_fvbt: string[];
  doc_termo_desistencia_lpt: string[];
  doc_autorizacao_passagem: string[];
  doc_materiais_previsto: string[];
  doc_materiais_realizado: string[];
  // Altimetria - 4 fotos
  fotos_altimetria_lado_fonte: string[];
  fotos_altimetria_medicao_fonte: string[];
  fotos_altimetria_lado_carga: string[];
  fotos_altimetria_medicao_carga: string[];
  // Vazamento e Limpeza de Transformador - 7 fotos
  fotos_vazamento_evidencia: string[];
  fotos_vazamento_equipamentos_limpeza: string[];
  fotos_vazamento_tombamento_retirado: string[];
  fotos_vazamento_placa_retirado: string[];
  fotos_vazamento_tombamento_instalado: string[];
  fotos_vazamento_placa_instalado: string[];
  fotos_vazamento_instalacao: string[];
  // Linha Viva / Cava em Rocha - Dados dos postes
  postes_data?: Array<{
    id: string;
    numero: number;
    isAditivo?: boolean;
    fotos_antes: string[];
    fotos_durante: string[];
    fotos_depois: string[];
    fotos_medicao?: string[];
    observacao?: string;
  }>;
  // Checklist de Fiscalização - Dados estruturados dos postes e seccionamentos
  checklist_postes_data?: Array<{
    id: string;
    numero: string;
    status: string;
    isAditivo?: boolean; // Indica se é um poste aditivo (não previsto no croqui)
    posteInteiro: string[];
    engaste: string[];
    conexao1: string[];
    conexao2: string[];
    maiorEsforco: string[];
    menorEsforco: string[];
  }>;
  checklist_seccionamentos_data?: Array<{
    id: string;
    numero: number; // Número do seccionamento (1, 2, 3...) para mostrar como S1, S2, S3...
    tipo?: 'seccionamento' | 'emenda' | 'poda';
    posteInicio?: number | null;
    posteFim?: number | null;
    poste_inicio?: number | null;
    poste_fim?: number | null;
    fotos: string[];
  }>;
  checklist_aterramentos_cerca_data?: Array<{
    id: string;
    numero: number; // Número do aterramento (1, 2, 3...) para mostrar como A1, A2, A3...
    fotos: string[];
  }>;
  checklist_hastes_termometros_data?: Array<{
    id: string;
    numero: string; // Número do ponto (pode ser texto: P1, P2, etc.)
    isAditivo?: boolean; // Indica se é aditivo
    fotoHaste: string[]; // Fotos das hastes aplicadas
    fotoTermometro: string[]; // Fotos da medição do termômetro
  }>;
  // Novos campos opcionais do Checklist de Fiscalização
  fotos_checklist_frying?: string[];
  fotos_checklist_abertura_fechamento_pulo?: string[];
  // Identificação do criador
  creator_role?: 'compressor' | 'admin' | 'equipe'; // Identificador permanente de quem criou
  created_by_admin?: string | null; // Código do admin que criou (ex: Admin-Pereira, Coord-Silva)
  created_at: string;
  sync_status?: 'pending' | 'syncing' | 'failed' | 'partial';
  error_message?: string;
  sync_attempts?: number; // Número de tentativas de sync falhadas (para backup de emergência)
  photos_uploaded: boolean; // Nova flag
  isEdited?: boolean; // Flag para indicar se é uma edição
  originalId?: string; // ID original da obra no servidor (se for edição)
  last_modified?: string; // Timestamp da última modificação
}

export interface SyncStatus {
  lastSyncAt: string | null;
  pendingCount: number;
  failedCount: number;
}

// Interface para obra armazenada localmente (offline-first)
export interface LocalObra extends PendingObra {
  synced: boolean; // Se já foi sincronizada com servidor
  serverId?: string; // ID no servidor (após sync)
  locallyModified: boolean; // Se foi modificada localmente após sync
}

const hasPendingPhotosForObra = (
  obra: { id: string; serverId?: string },
  pendingPhotos: PhotoMetadata[]
): boolean => {
  if (!pendingPhotos.length) return false;
  return pendingPhotos.some(
    (photo) => photo.obraId === obra.id || (!!obra.serverId && photo.obraId === obra.serverId)
  );
};

const extractPhotoIdFromItem = (item: unknown): string | null => {
  if (typeof item === 'string') {
    if (
      item.startsWith('http://') ||
      item.startsWith('https://') ||
      item.startsWith('file://')
    ) {
      return null;
    }
    return item;
  }

  if (
    typeof item === 'object' &&
    item !== null &&
    'id' in item &&
    typeof (item as any).id === 'string'
  ) {
    const candidate = (item as any).id as string;
    if (
      candidate.startsWith('http://') ||
      candidate.startsWith('https://') ||
      candidate.startsWith('file://')
    ) {
      return null;
    }
    return candidate;
  }

  return null;
};

const collectObraReferencedPhotoIds = (obra: PendingObra): string[] => {
  const ids = new Set<string>();

  const isPhotoArrayKey = (key: string) =>
    key.startsWith('fotos_') || key.startsWith('doc_') || key.startsWith('foto');

  const visit = (value: unknown, key = ''): void => {
    if (!value) return;

    if (Array.isArray(value)) {
      if (isPhotoArrayKey(key)) {
        value.forEach((item) => {
          const photoId = extractPhotoIdFromItem(item);
          if (photoId) {
            ids.add(photoId);
          }
        });
        return;
      }

      if (key.endsWith('_data')) {
        value.forEach((item) => {
          if (item && typeof item === 'object') {
            visit(item, key);
          }
        });
      }
      return;
    }

    if (typeof value !== 'object') return;

    Object.entries(value as Record<string, unknown>).forEach(([nestedKey, nestedValue]) => {
      if (Array.isArray(nestedValue) || (nestedValue && typeof nestedValue === 'object')) {
        visit(nestedValue, nestedKey);
      }
    });
  };

  visit(obra as unknown as Record<string, unknown>);
  return Array.from(ids);
};

type PhotoGroupIds = {
  antes: string[];
  durante: string[];
  depois: string[];
  abertura: string[];
  fechamento: string[];
  ditais_abertura: string[];
  ditais_impedir: string[];
  ditais_testar: string[];
  ditais_aterrar: string[];
  ditais_sinalizar: string[];
  aterramento_vala_aberta: string[];
  aterramento_hastes: string[];
  aterramento_vala_fechada: string[];
  aterramento_medicao: string[];
  transformador_laudo: string[];
  transformador_componente_instalado: string[];
  transformador_tombamento_instalado: string[];
  transformador_tape: string[];
  transformador_placa_instalado: string[];
  transformador_instalado: string[];
  transformador_conexoes_primarias_instalado: string[];
  transformador_conexoes_secundarias_instalado: string[];
  transformador_antes_retirar: string[];
  transformador_laudo_retirado: string[];
  transformador_tombamento_retirado: string[];
  transformador_placa_retirado: string[];
  transformador_conexoes_primarias_retirado: string[];
  transformador_conexoes_secundarias_retirado: string[];
  medidor_padrao: string[];
  medidor_leitura: string[];
  medidor_selo_born: string[];
  medidor_selo_caixa: string[];
  medidor_identificador_fase: string[];
  // Checklist de Fiscalização
  checklist_croqui: string[];
  checklist_panoramica_inicial: string[];
  checklist_chede: string[];
  checklist_aterramento_cerca: string[];
  checklist_padrao_geral: string[];
  checklist_padrao_interno: string[];
  checklist_panoramica_final: string[];
  checklist_postes: string[];
  checklist_seccionamentos: string[];
  // Documentação (PDFs)
  doc_cadastro_medidor: string[];
  doc_laudo_transformador: string[];
  doc_laudo_regulador: string[];
  doc_laudo_religador: string[];
  doc_apr: string[];
  doc_fvbt: string[];
  doc_termo_desistencia_lpt: string[];
  doc_autorizacao_passagem: string[];
  doc_materiais_previsto: string[];
  doc_materiais_realizado: string[];
  // Altimetria - 4 fotos
  altimetria_lado_fonte: string[];
  altimetria_medicao_fonte: string[];
  altimetria_lado_carga: string[];
  altimetria_medicao_carga: string[];
  // Vazamento e Limpeza de Transformador - 7 fotos
  vazamento_evidencia: string[];
  vazamento_equipamentos_limpeza: string[];
  vazamento_tombamento_retirado: string[];
  vazamento_placa_retirado: string[];
  vazamento_tombamento_instalado: string[];
  vazamento_placa_instalado: string[];
  vazamento_instalacao: string[];
};

const sanitizeObrasPayload = <T extends Record<string, any>>(payload: T): T => {
  const sanitized = { ...payload } as Record<string, any>;
  // Compatibilidade com ambientes sem a coluna ainda migrada no Supabase.
  delete sanitized.fotos_transformador_laudo_retirado;
  return sanitized as T;
};

/**
 * Verifica se há conexão com a internet
 */
export const checkInternetConnection = async (): Promise<boolean> => {
  const state = await NetInfo.fetch();
  return state.isConnected === true && state.isInternetReachable !== false;
};

// ============================
// FUNÇÕES OFFLINE-FIRST
// ============================

/**
 * Salva ou atualiza uma obra localmente (offline-first)
 * Esta é a fonte primária de dados - TODAS as obras passam por aqui primeiro
 */
export const saveObraLocal = async (
  obra: Omit<LocalObra, 'synced' | 'locallyModified'>,
  existingId?: string
): Promise<string> => {
  try {
    const localObras = await getLocalObras();

    // ✅ CORREÇÃO: Deduplicar somente rascunhos da MESMA obra/equipe/tipo
    // Isso evita sobrescrever books diferentes que compartilham o mesmo número.
    let finalExistingId = existingId;
    const hasExplicitObraId = typeof (obra as any).id === 'string' && String((obra as any).id).trim().length > 0;
    const incomingLegacyServicoId = String((obra as any).legacy_servico_id || '').trim();
    const canAutoDeduplicateDraft = !existingId && !hasExplicitObraId && incomingLegacyServicoId.length > 0;
    const existingDraft = canAutoDeduplicateDraft
      ? localObras.find(o =>
          o.obra === obra.obra &&
          o.equipe === obra.equipe &&
          o.tipo_servico === obra.tipo_servico &&
          String((o as any).legacy_servico_id || '').trim() === incomingLegacyServicoId &&
          o.status === 'rascunho' &&
          obra.status === 'rascunho' &&
          !o.synced
        )
      : null;

    if (existingDraft && canAutoDeduplicateDraft) {
      finalExistingId = existingDraft.id; // Forçar atualização do rascunho
    }

    // Se tem ID existente, atualizar; senão, criar novo
    const obraId = finalExistingId || obra.id || `local_${Date.now()}_${Math.random().toString(36).substring(2, 11)}`;

    const obraIndex = localObras.findIndex(o => o.id === obraId);
    const now = new Date().toISOString();

    // ✅ CRÍTICO: Preservar serverId da obra existente se não vier no parâmetro
    // Isso evita perder o link com o servidor após re-edição
    const existingObra = obraIndex !== -1 ? localObras[obraIndex] : null;
    const serverId = (obra as any).serverId || existingObra?.serverId || null;

    logger.sync(`💾 saveObraLocal - obraId: ${obraId}, serverId existente: ${existingObra?.serverId}, serverId no param: ${(obra as any).serverId}, final: ${serverId}`);

    const savedObra: LocalObra = {
      ...obra,
      id: obraId,
      // ✅ CRÍTICO: Preservar serverId para identificar obra no servidor
      ...(serverId && { serverId }),
      synced: false, // Sempre marca como não sincronizado (nova modificação)
      locallyModified: obraIndex !== -1 || !!serverId, // Modificada se já existia ou se já foi para o servidor
      last_modified: now,
      created_at: obraIndex !== -1 ? (existingObra?.created_at || obra.created_at || now) : (obra.created_at || now),
      // ✅ CRÍTICO: Preservar data original da obra (não sobrescrever com data atual)
      data: obraIndex !== -1 ? (existingObra?.data || obra.data) : obra.data,
    };

    if (obraIndex !== -1) {
      // Atualizar obra existente
      localObras[obraIndex] = savedObra;
      logger.sync(`📝 Obra local atualizada: ${obraId} (serverId: ${serverId || 'none'})`);
    } else {
      // Adicionar nova obra
      localObras.push(savedObra);
      logger.sync(`✅ Nova obra local criada: ${obraId} (serverId: ${serverId || 'none'})`);
    }

    await writeObrasRaw(localObras);

    // NÃO sincroniza automaticamente - apenas salva local
    // Usuário decide quando sincronizar via botão manual

    return obraId;
  } catch (error) {
    logger.error('❌ Erro ao salvar obra local:', error);
    throw error;
  }
};

/**
 * Obtém todas as obras armazenadas localmente
 */
export const getLocalObras = async (): Promise<LocalObra[]> => {
  try {
    const localObras: LocalObra[] = await readObrasRaw();

    if (!localObras.length) {
      return [];
    }

    const pendingPhotos = await getPendingPhotos();
    if (!pendingPhotos.length) {
      return localObras;
    }

    let changed = false;
    const normalized = localObras.map((obra) => {
      if (!hasPendingPhotosForObra(obra, pendingPhotos)) {
        return obra;
      }

      if (obra.synced === false && obra.locallyModified && obra.sync_status === 'partial') {
        return obra;
      }

      changed = true;
      logger.warn(
        `⚠️ [getLocalObras] Obra ${obra.obra} estava marcada como sincronizada, mas ainda tem fotos pendentes. Ajustando status para parcial.`
      );

      return {
        ...obra,
        synced: false,
        locallyModified: true,
        sync_status: 'partial',
      } as LocalObra;
    });

    if (changed) {
      await writeObrasRaw(normalized);
    }

    return normalized;
  } catch (error) {
    logger.error('Erro ao obter obras locais:', error);
    return [];
  }
};

/**
 * Obtém uma obra local específica por ID
 */
export const getLocalObraById = async (id: string): Promise<LocalObra | null> => {
  try {
    const localObras = await getLocalObras();
    return localObras.find(o => o.id === id) || null;
  } catch (error) {
    logger.error('Erro ao obter obra local por ID:', error);
    return null;
  }
};

/**
 * 🔧 RECUPERAÇÃO: Restaura fotos de uma obra buscando no photo-backup
 * Útil quando fotos sumiram após sync ou edição
 */
export const restoreObraPhotos = async (obraId: string): Promise<boolean> => {
  try {
    logger.sync(`🔧 Iniciando recuperação de fotos para obra: ${obraId}`);

    // 1. Buscar todas as fotos desta obra no photo-backup
    const allPhotos = await getAllPhotoMetadata();

    // ✅ CRÍTICO: Se obraId mudou após sync (temp_ → UUID), buscar pelo ID antigo também
    // Verificar se existe uma obra local com serverId = obraId (pode ser o UUID após sync)
    const localObras = await getLocalObras();
    const obraLocal = localObras.find(o => o.id === obraId || o.serverId === obraId);

    // Buscar fotos tanto pelo ID atual quanto pelo serverId (se existir)
    const possibleIds = obraLocal
      ? [obraId, obraLocal.serverId, obraLocal.id].filter(Boolean)
      : [obraId];

    logger.sync(`🔍 Buscando fotos para IDs: ${possibleIds.join(', ')}`);
    const obraPhotos = allPhotos.filter(p => possibleIds.includes(p.obraId));

    if (obraPhotos.length === 0) {
      logger.warn(`⚠️ Nenhuma foto encontrada no backup para obra ${obraId}`);
      logger.warn(`   IDs pesquisados: ${possibleIds.join(', ')}`);
      return false;
    }

    logger.sync(`📸 Encontradas ${obraPhotos.length} fotos no backup`);

    // 2. Agrupar fotos por tipo
    const photosByType: Record<string, string[]> = {};

    for (const photo of obraPhotos) {
      const typeKey = `fotos_${photo.type}`;
      if (!photosByType[typeKey]) {
        photosByType[typeKey] = [];
      }
      photosByType[typeKey].push(photo.id);
    }

    // Log de fotos encontradas por tipo
    Object.entries(photosByType).forEach(([type, ids]) => {
      logger.sync(`  - ${type}: ${ids.length} foto(s)`);
    });

    // 3. Atualizar obra no AsyncStorage (reutilizar localObras já carregado)
    const obraIndex = localObras.findIndex(o => o.id === obraId);

    if (obraIndex === -1) {
      logger.error(`❌ Obra ${obraId} não encontrada no AsyncStorage`);
      return false;
    }

    // Atualizar todos os arrays de fotos
    const updatedObra = {
      ...localObras[obraIndex],
      ...photosByType, // Mescla todos os arrays de fotos
      locallyModified: true, // Marca como modificada para resincronizar se necessário
    };

    localObras[obraIndex] = updatedObra;
    await writeObrasRaw(localObras);

    logger.sync(`✅ Fotos restauradas com sucesso para obra ${obraId}`);
    logger.sync(`   Total: ${obraPhotos.length} fotos reconectadas`);

    return true;
  } catch (error) {
    logger.error('❌ Erro ao restaurar fotos da obra:', error);
    return false;
  }
};

/**
 * 🔄 Força atualização de obra do Supabase para AsyncStorage local
 * Útil para recuperar fotos que não foram atualizadas após sync
 */
export const forceUpdateObraFromSupabase = async (obraId: string): Promise<boolean> => {
  try {
    logger.sync(`🔄 Forçando atualização da obra ${obraId} do Supabase...`);

    // Primeiro, buscar obra local para obter o número da obra
    // ✅ CORREÇÃO: Buscar por ID local OU serverId (para obras já sincronizadas)
    const localObras = await getLocalObras();
    const obraLocal = localObras.find(o => o.id === obraId || o.serverId === obraId);

    if (!obraLocal) {
      logger.error(`❌ Obra ${obraId} não encontrada no AsyncStorage local (buscou por ID e serverId)`);
      return false;
    }

    const numeroObra = obraLocal.obra;
    const equipe = obraLocal.equipe;
    const tipoServico = obraLocal.tipo_servico;
    const createdAt = obraLocal.created_at;
    const serverId = (obraLocal as any).serverId
      || (!obraId.startsWith('temp_') && !obraId.startsWith('local_') ? obraId : null);

    let syncedObra: any = null;
    let fetchError: any = null;

    if (serverId) {
      logger.sync(`📋 Buscando obra no Supabase por ID: ${serverId}`);
      const response = await supabase
        .from('obras')
        .select('*')
        .eq('id', serverId)
        .maybeSingle();
      syncedObra = response.data;
      fetchError = response.error;
    } else {
      logger.sync(`📋 Buscando obra por número/equipe/tipo/data: ${numeroObra} | ${equipe} | ${tipoServico} | ${createdAt}`);
      let query = supabase
        .from('obras')
        .select('*')
        .eq('obra', numeroObra)
        .eq('equipe', equipe);

      if (tipoServico) {
        query = query.eq('tipo_servico', tipoServico);
      }
      if (createdAt) {
        query = query.eq('created_at', createdAt);
      }

      const response = await query.maybeSingle();
      syncedObra = response.data;
      fetchError = response.error;
    }

    if ((fetchError || !syncedObra) && !obraId.startsWith('temp_') && !obraId.startsWith('local_')) {
      logger.warn(`⚠️ Busca principal falhou, tentando fallback por ID: ${obraId}`);
      const retry = await supabase
        .from('obras')
        .select('*')
        .eq('id', obraId)
        .maybeSingle();

      if (!retry.error && retry.data) {
        syncedObra = retry.data;
        fetchError = null;
      } else if (retry.error) {
        fetchError = retry.error;
      }
    }

    if (fetchError) {
      logger.error(`❌ Erro ao buscar obra no Supabase: ${fetchError.message}`);
      return false;
    }

    if (!syncedObra) {
      logger.error(`❌ Obra não encontrada no Supabase (obra=${numeroObra}, equipe=${equipe}, tipo=${tipoServico})`);
      return false;
    }

    logger.sync(`📊 Obra encontrada: ${syncedObra.obra} (ID: ${syncedObra.id})`);
    logger.sync(`   - fotos_antes: ${Array.isArray(syncedObra.fotos_antes) ? syncedObra.fotos_antes.length : 0} item(s)`);

    return await updateObraInAsyncStorage(syncedObra, obraId, localObras);
  } catch (error) {
    logger.error('❌ Erro ao forçar atualização:', error);
    return false;
  }
};

/**
 * Helper: Atualiza obra no AsyncStorage
 */
const updateObraInAsyncStorage = async (
  syncedObra: any,
  originalObraId: string,
  localObras: LocalObra[]
): Promise<boolean> => {
  try {
    // Atualizar no AsyncStorage
    const index = localObras.findIndex(o => o.id === originalObraId || o.serverId === originalObraId);

    // Criar objeto com dados do Supabase + campos de controle local
    const updatedObra = {
      ...syncedObra,
      id: syncedObra.id,                    // ✅ Usar ID do Supabase (UUID)
      synced: true,                         // ✅ Marcar como sincronizado
      locallyModified: false,               // ✅ Não tem modificações locais
      serverId: syncedObra.id,              // ✅ Referência ao ID do servidor
      origem: 'online',                     // ✅ CRÍTICO: Mudar origem para 'online'
      sync_status: undefined,               // ✅ CRÍTICO: Remover status de sync pendente
      last_modified: syncedObra.updated_at || syncedObra.created_at,
      created_at: syncedObra.created_at,
      status: syncedObra.status,            // ✅ CRÍTICO: Preservar status (finalizada, etc)
    } as LocalObra;

    logger.sync(`📊 Atualizando obra no AsyncStorage:`);
    logger.sync(`   - ID: ${updatedObra.id}`);
    logger.sync(`   - Status: ${updatedObra.status}`);
    logger.sync(`   - Origem: ${updatedObra.origem}`);
    logger.sync(`   - Synced: ${updatedObra.synced}`);

    if (index !== -1) {
      localObras[index] = updatedObra;
    } else {
      // Obra não existe localmente, adicionar
      localObras.push(updatedObra);
    }

    await writeObrasRaw(localObras);
    logger.sync(`✅ Obra atualizada com sucesso no AsyncStorage`);

    return true;
  } catch (error) {
    logger.error('❌ Erro ao forçar atualização:', error);
    return false;
  }
};

/**
 * Remove uma obra do armazenamento local
 */
export const removeLocalObra = async (id: string): Promise<void> => {
  try {
    const localObras = await getLocalObras();
    const filtered = localObras.filter(o => o.id !== id);
    await writeObrasRaw(filtered);
    logger.sync(`🗑️ Obra local removida: ${id}`);
  } catch (error) {
    logger.error('Erro ao remover obra local:', error);
    throw error;
  }
};

/**
 * Sincroniza uma obra local específica com o servidor
 */
export const syncLocalObra = async (
  obraId: string,
  onProgress?: (progress: UploadProgress) => void
): Promise<boolean> => {
  try {
    const obra = await getLocalObraById(obraId);
    if (!obra) {
      logger.warn(`⚠️ Obra local não encontrada: ${obraId}`);
      return false;
    }

    const pendingPhotosSnapshot = await getPendingPhotos();
    const hasPendingSnapshot = hasPendingPhotosForObra(obra, pendingPhotosSnapshot);

    // Se já está sincronizada, sem modificações e sem fotos pendentes, pular
    if (obra.synced && !obra.locallyModified && !hasPendingSnapshot) {
      logger.sync(`✅ Obra já sincronizada: ${obraId}`);
      return true;
    }

    if (hasPendingSnapshot) {
      logger.sync(`🔄 Obra ${obraId} possui fotos pendentes e será re-sincronizada.`);
    }

    logger.sync(`🔄 Sincronizando obra local: ${obraId}`);

    // Usar a função existente de sync
    const pendingObra: PendingObra = {
      ...obra,
      sync_status: 'pending',
      photos_uploaded: false,
    };

    const result = await syncObra(pendingObra, onProgress);

    if (result.success) {
      // ✅ CRÍTICO: Após sync, buscar obra do Supabase para obter URLs das fotos
      // Usa o newId retornado (pode ser diferente do obraId original se foi temp_)
      const finalId = result.newId || obraId;
      logger.sync(`📥 Buscando dados atualizados da obra sincronizada: ${finalId}`);

      const { data: syncedObra, error: fetchError } = await supabase
        .from('obras')
        .select('*')
        .eq('id', finalId)
        .single();

      if (fetchError) {
        logger.error(`❌ Erro ao buscar obra do Supabase: ${fetchError.message}`);
      }

      if (syncedObra) {
        logger.sync(`📊 Obra encontrada no Supabase: ${syncedObra.obra}`);
        logger.sync(`   - fotos_antes: ${Array.isArray(syncedObra.fotos_antes) ? syncedObra.fotos_antes.length : 0} item(s)`);
        logger.sync(`   - Tipo do primeiro item fotos_antes: ${Array.isArray(syncedObra.fotos_antes) && syncedObra.fotos_antes.length > 0 ? typeof syncedObra.fotos_antes[0] : 'N/A'}`);
      }

      // ✅ CORREÇÃO: Verificar se há fotos pendentes antes de marcar como synced
      const { getZombiePhotos } = await import('./photo-backup');
      const pendingPhotos = await getPendingPhotos();
      const zombiePhotos = await getZombiePhotos();
      const obraPendingPhotos = pendingPhotos.filter(p => p.obraId === obraId || p.obraId === finalId);
      const obraZombiePhotos = zombiePhotos.filter(p => p.obraId === obraId || p.obraId === finalId);

      const hasPendingPhotos = obraPendingPhotos.length > 0 || obraZombiePhotos.length > 0;
      if (hasPendingPhotos) {
        logger.warn(`⚠️ Obra ${obraId} tem ${obraPendingPhotos.length} foto(s) pendente(s) e ${obraZombiePhotos.length} foto(s) zombie`);
        logger.warn(`⚠️ Obra NÃO será marcada como totalmente sincronizada - permitindo re-sync`);
      }

      const localObras = await getLocalObras();
      const index = localObras.findIndex(o => o.id === obraId);

      if (index !== -1) {
        if (syncedObra && !fetchError) {
          // ✅ CRÍTICO: Manter o ID local mas adicionar serverId para futuras sincronizações
          // NÃO remover a entrada - apenas atualizar com os dados do servidor
          logger.sync(`🔄 Atualizando obra local ${obraId} com serverId: ${finalId}`);

          localObras[index] = {
            ...localObras[index], // Manter dados locais
            ...syncedObra, // Sobrescrever com dados do servidor
            id: obraId, // ✅ MANTER o ID local original
            serverId: finalId, // ✅ Guardar o UUID do Supabase
            // ✅ CORREÇÃO: Só marcar como synced se não houver fotos pendentes
            synced: !hasPendingPhotos,
            locallyModified: hasPendingPhotos, // Manter como modificada se há fotos pendentes
            sync_status: hasPendingPhotos ? 'partial' : undefined, // Indicar sync parcial
            origem: 'online',
            last_modified: syncedObra.updated_at || syncedObra.created_at,
            created_at: syncedObra.created_at,
          } as LocalObra;

          if (hasPendingPhotos) {
            logger.sync(`⚠️ Obra parcialmente sincronizada - ID local: ${obraId}, serverId: ${finalId}`);
            logger.sync(`   Fotos pendentes: ${obraPendingPhotos.length}, Fotos zombie: ${obraZombiePhotos.length}`);
          } else {
            logger.sync(`✅ Obra totalmente sincronizada - ID local: ${obraId}, serverId: ${finalId}`);
          }
        } else {
          // Fallback: apenas marcar como sincronizada (mantém IDs)
          logger.warn(`⚠️ Não foi possível buscar dados atualizados, marcando apenas como sincronizada`);
          localObras[index].synced = !hasPendingPhotos;
          localObras[index].locallyModified = hasPendingPhotos;
          localObras[index].sync_status = hasPendingPhotos ? 'partial' : undefined;
          // ✅ Ainda assim, guardar o serverId se disponível
          if (finalId && finalId !== obraId) {
            (localObras[index] as any).serverId = finalId;
          }
        }

        await writeObrasRaw(localObras);
        logger.sync(`✅ Obra ${hasPendingPhotos ? 'parcialmente' : 'totalmente'} sincronizada: ${obraId} (serverId: ${finalId})`);
      }
    }

    return result.success;
  } catch (error) {
    logger.error('❌ Erro ao sincronizar obra local:', error);
    return false;
  }
};

/**
 * Sincroniza todas as obras locais não sincronizadas
 */
export const syncAllLocalObras = async (): Promise<{ success: number; failed: number }> => {
  if (syncInProgress) {
    return { success: 0, failed: 0 };
  }

  syncInProgress = true;

  try {
    const isOnline = await checkInternetConnection();

    if (!isOnline) {
      logger.sync('📴 Sem conexão - sync cancelado');
      return { success: 0, failed: 0 };
    }

    const localObras = await getLocalObras();
    const obrasToSync = localObras.filter(o => !o.synced || o.locallyModified);

    logger.sync(`🔄 Sincronizando ${obrasToSync.length} obra(s) local(is)...`);

    let success = 0;
    let failed = 0;

    for (const obra of obrasToSync) {
      const result = await syncLocalObra(obra.id);
      if (result) {
        success++;
      } else {
        failed++;
      }
    }

    logger.sync(`✅ Sync completo: ${success} sucesso, ${failed} falhas`);
    return { success, failed };
  } finally {
    syncInProgress = false;
  }
};

/**
 * Salva uma obra na fila de sincronização offline
 */
export const saveObraOffline = async (
  obra: Omit<
    PendingObra,
    | 'id'
    | 'sync_status'
    | 'photos_uploaded'
    | 'fotos_antes'
    | 'fotos_durante'
    | 'fotos_depois'
    | 'fotos_abertura'
    | 'fotos_fechamento'
    | 'fotos_ditais_abertura'
    | 'fotos_ditais_impedir'
    | 'fotos_ditais_testar'
    | 'fotos_ditais_aterrar'
    | 'fotos_ditais_sinalizar'
    | 'fotos_aterramento_vala_aberta'
    | 'fotos_aterramento_hastes'
    | 'fotos_aterramento_vala_fechada'
    | 'fotos_aterramento_medicao'
    | 'fotos_transformador_laudo'
    | 'fotos_transformador_componente_instalado'
    | 'fotos_transformador_tombamento_instalado'
    | 'fotos_transformador_tape'
    | 'fotos_transformador_placa_instalado'
    | 'fotos_transformador_instalado'
    | 'fotos_transformador_antes_retirar'
    | 'fotos_transformador_tombamento_retirado'
    | 'fotos_transformador_placa_retirado'
    | 'fotos_medidor_padrao'
    | 'fotos_medidor_leitura'
    | 'fotos_medidor_selo_born'
    | 'fotos_medidor_selo_caixa'
    | 'fotos_medidor_identificador_fase'
    | 'fotos_checklist_croqui'
    | 'fotos_checklist_panoramica_inicial'
    | 'fotos_checklist_chede'
    | 'fotos_checklist_aterramento_cerca'
    | 'fotos_checklist_padrao_geral'
    | 'fotos_checklist_padrao_interno'
    | 'fotos_checklist_panoramica_final'
    | 'fotos_checklist_postes'
    | 'fotos_checklist_seccionamentos'
    | 'doc_cadastro_medidor'
    | 'doc_laudo_transformador'
    | 'doc_laudo_regulador'
    | 'doc_laudo_religador'
    | 'doc_apr'
    | 'doc_fvbt'
    | 'doc_termo_desistencia_lpt'
    | 'doc_autorizacao_passagem'
    | 'doc_materiais_previsto'
    | 'doc_materiais_realizado'
    | 'fotos_altimetria_lado_fonte'
    | 'fotos_altimetria_medicao_fonte'
    | 'fotos_altimetria_lado_carga'
    | 'fotos_altimetria_medicao_carga'
    | 'fotos_vazamento_evidencia'
    | 'fotos_vazamento_equipamentos_limpeza'
    | 'fotos_vazamento_tombamento_retirado'
    | 'fotos_vazamento_placa_retirado'
    | 'fotos_vazamento_tombamento_instalado'
    | 'fotos_vazamento_placa_instalado'
    | 'fotos_vazamento_instalacao'
  >,
  photoIds: PhotoGroupIds,
  existingObraId?: string
): Promise<string> => {
  try {
    // DEBUG: Verificar postes_data recebido

    const pendingObras = await getPendingObras();
    const obraId =
      existingObraId || `offline_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;

    const newObra: PendingObra = {
      ...obra,
      id: obraId,
      sync_status: 'pending',
      photos_uploaded: false,
      created_at: obra.created_at || new Date().toISOString(),
      fotos_antes: photoIds.antes ?? [],
      fotos_durante: photoIds.durante ?? [],
      fotos_depois: photoIds.depois ?? [],
      fotos_abertura: photoIds.abertura ?? [],
      fotos_fechamento: photoIds.fechamento ?? [],
      fotos_ditais_abertura: photoIds.ditais_abertura ?? [],
      fotos_ditais_impedir: photoIds.ditais_impedir ?? [],
      fotos_ditais_testar: photoIds.ditais_testar ?? [],
      fotos_ditais_aterrar: photoIds.ditais_aterrar ?? [],
      fotos_ditais_sinalizar: photoIds.ditais_sinalizar ?? [],
      fotos_aterramento_vala_aberta: photoIds.aterramento_vala_aberta ?? [],
      fotos_aterramento_hastes: photoIds.aterramento_hastes ?? [],
      fotos_aterramento_vala_fechada: photoIds.aterramento_vala_fechada ?? [],
      fotos_aterramento_medicao: photoIds.aterramento_medicao ?? [],
      fotos_transformador_laudo: photoIds.transformador_laudo ?? [],
      fotos_transformador_componente_instalado: photoIds.transformador_componente_instalado ?? [],
      fotos_transformador_tombamento_instalado: photoIds.transformador_tombamento_instalado ?? [],
      fotos_transformador_tape: photoIds.transformador_tape ?? [],
      fotos_transformador_placa_instalado: photoIds.transformador_placa_instalado ?? [],
      fotos_transformador_instalado: photoIds.transformador_instalado ?? [],
      fotos_transformador_conexoes_primarias_instalado: photoIds.transformador_conexoes_primarias_instalado ?? [],
      fotos_transformador_conexoes_secundarias_instalado: photoIds.transformador_conexoes_secundarias_instalado ?? [],
      fotos_transformador_antes_retirar: photoIds.transformador_antes_retirar ?? [],
      fotos_transformador_tombamento_retirado: photoIds.transformador_tombamento_retirado ?? [],
      fotos_transformador_placa_retirado: photoIds.transformador_placa_retirado ?? [],
      fotos_transformador_conexoes_primarias_retirado: photoIds.transformador_conexoes_primarias_retirado ?? [],
      fotos_transformador_conexoes_secundarias_retirado: photoIds.transformador_conexoes_secundarias_retirado ?? [],
      fotos_medidor_padrao: photoIds.medidor_padrao ?? [],
      fotos_medidor_leitura: photoIds.medidor_leitura ?? [],
      fotos_medidor_selo_born: photoIds.medidor_selo_born ?? [],
      fotos_medidor_selo_caixa: photoIds.medidor_selo_caixa ?? [],
      fotos_medidor_identificador_fase: photoIds.medidor_identificador_fase ?? [],
      // Checklist de Fiscalização
      fotos_checklist_croqui: photoIds.checklist_croqui ?? [],
      fotos_checklist_panoramica_inicial: photoIds.checklist_panoramica_inicial ?? [],
      fotos_checklist_chede: photoIds.checklist_chede ?? [],
      fotos_checklist_aterramento_cerca: photoIds.checklist_aterramento_cerca ?? [],
      fotos_checklist_padrao_geral: photoIds.checklist_padrao_geral ?? [],
      fotos_checklist_padrao_interno: photoIds.checklist_padrao_interno ?? [],
      fotos_checklist_panoramica_final: photoIds.checklist_panoramica_final ?? [],
      fotos_checklist_postes: photoIds.checklist_postes ?? [],
      fotos_checklist_seccionamentos: photoIds.checklist_seccionamentos ?? [],
      // Documentação (PDFs)
      doc_cadastro_medidor: photoIds.doc_cadastro_medidor ?? [],
      doc_laudo_transformador: photoIds.doc_laudo_transformador ?? [],
      doc_laudo_regulador: photoIds.doc_laudo_regulador ?? [],
      doc_laudo_religador: photoIds.doc_laudo_religador ?? [],
      doc_apr: photoIds.doc_apr ?? [],
      doc_fvbt: photoIds.doc_fvbt ?? [],
      doc_termo_desistencia_lpt: photoIds.doc_termo_desistencia_lpt ?? [],
      doc_autorizacao_passagem: photoIds.doc_autorizacao_passagem ?? [],
      doc_materiais_previsto: photoIds.doc_materiais_previsto ?? [],
      doc_materiais_realizado: photoIds.doc_materiais_realizado ?? [],
      // Altimetria
      fotos_altimetria_lado_fonte: photoIds.altimetria_lado_fonte ?? [],
      fotos_altimetria_medicao_fonte: photoIds.altimetria_medicao_fonte ?? [],
      fotos_altimetria_lado_carga: photoIds.altimetria_lado_carga ?? [],
      fotos_altimetria_medicao_carga: photoIds.altimetria_medicao_carga ?? [],
      // Vazamento e Limpeza de Transformador
      fotos_vazamento_evidencia: photoIds.vazamento_evidencia ?? [],
      fotos_vazamento_equipamentos_limpeza: photoIds.vazamento_equipamentos_limpeza ?? [],
      fotos_vazamento_tombamento_retirado: photoIds.vazamento_tombamento_retirado ?? [],
      fotos_vazamento_placa_retirado: photoIds.vazamento_placa_retirado ?? [],
      fotos_vazamento_tombamento_instalado: photoIds.vazamento_tombamento_instalado ?? [],
      fotos_vazamento_placa_instalado: photoIds.vazamento_placa_instalado ?? [],
      fotos_vazamento_instalacao: photoIds.vazamento_instalacao ?? [],
    };

    // Deduplicar automaticamente na fila pendente apenas com contexto de servico.
    const incomingLegacyServicoId = String((obra as any).legacy_servico_id || '').trim();
    const canAutoDeduplicatePendingDraft = !existingObraId && incomingLegacyServicoId.length > 0;
    const existingDraftIndex = canAutoDeduplicatePendingDraft
      ? pendingObras.findIndex(o =>
          o.obra === obra.obra &&
          o.equipe === obra.equipe &&
          o.tipo_servico === obra.tipo_servico &&
          String((o as any).legacy_servico_id || '').trim() === incomingLegacyServicoId &&
          o.status === 'rascunho' &&
          obra.status === 'rascunho'
        )
      : -1;
    if (existingDraftIndex !== -1 && canAutoDeduplicatePendingDraft) {
      // Ja existe um rascunho pendente compativel - atualizar em vez de criar novo
      logger.sync(`[saveObraOffline] Rascunho existente para ${obra.obra} (${obra.tipo_servico}) encontrado (ID: ${pendingObras[existingDraftIndex].id}). Atualizando rascunho.`);
      pendingObras[existingDraftIndex] = {
        ...pendingObras[existingDraftIndex],
        ...newObra,
        id: pendingObras[existingDraftIndex].id, // Manter ID original
        created_at: pendingObras[existingDraftIndex].created_at, // Manter data original
      };
    } else if (existingObraId) {
      // Atualizando obra existente pelo ID
      const existingIndex = pendingObras.findIndex(o => o.id === existingObraId);
      if (existingIndex !== -1) {
        logger.sync(`📝 [saveObraOffline] Atualizando obra existente: ${existingObraId}`);
        pendingObras[existingIndex] = {
          ...pendingObras[existingIndex],
          ...newObra,
          id: existingObraId,
          created_at: pendingObras[existingIndex].created_at,
        };
      } else {
        // ID existente não encontrado, adicionar como nova
        pendingObras.push(newObra);
      }
    } else {
      // Nova obra - adicionar
      pendingObras.push(newObra);
    }

    await AsyncStorage.setItem(PENDING_OBRAS_KEY, JSON.stringify(pendingObras));

    // Atualizar status de sincronização
    await updateSyncStatus();

    // Retornar o ID correto (existente ou novo)
    const finalId = existingDraftIndex !== -1 && !existingObraId
      ? pendingObras[existingDraftIndex].id
      : (existingObraId || newObra.id);

    return finalId;
  } catch (error) {
    logger.error('Erro ao salvar obra offline:', error);
    throw error;
  }
};

/**
 * Atualiza uma obra offline existente
 * Usado quando o usuário edita uma obra em modo offline
 */
export const updateObraOffline = async (
  obraId: string,
  updatedData: Partial<PendingObra>,
  updatedPhotoIds: Partial<PhotoGroupIds>
): Promise<void> => {
  try {
    logger.sync('📝 Atualizando obra offline:', obraId);

    // Buscar obras pendentes
    const pendingObras = await getPendingObras();
    const obraIndex = pendingObras.findIndex(o => o.id === obraId);

    if (obraIndex === -1) {
      // Obra não está na lista de pendentes
      // Criar uma nova entrada de obra editada offline
      const editedObra: PendingObra = {
        ...updatedData,
        id: obraId,
        isEdited: true,
        originalId: obraId,
        last_modified: new Date().toISOString(),
        sync_status: 'pending',
        photos_uploaded: false,
        // Mesclar IDs de fotos
        fotos_antes: updatedPhotoIds.antes ?? [],
        fotos_durante: updatedPhotoIds.durante ?? [],
        fotos_depois: updatedPhotoIds.depois ?? [],
        fotos_abertura: updatedPhotoIds.abertura ?? [],
        fotos_fechamento: updatedPhotoIds.fechamento ?? [],
        fotos_ditais_abertura: updatedPhotoIds.ditais_abertura ?? [],
        fotos_ditais_impedir: updatedPhotoIds.ditais_impedir ?? [],
        fotos_ditais_testar: updatedPhotoIds.ditais_testar ?? [],
        fotos_ditais_aterrar: updatedPhotoIds.ditais_aterrar ?? [],
        fotos_ditais_sinalizar: updatedPhotoIds.ditais_sinalizar ?? [],
        fotos_aterramento_vala_aberta: updatedPhotoIds.aterramento_vala_aberta ?? [],
        fotos_aterramento_hastes: updatedPhotoIds.aterramento_hastes ?? [],
        fotos_aterramento_vala_fechada: updatedPhotoIds.aterramento_vala_fechada ?? [],
        fotos_aterramento_medicao: updatedPhotoIds.aterramento_medicao ?? [],
        fotos_transformador_laudo: updatedPhotoIds.transformador_laudo ?? [],
        fotos_transformador_componente_instalado: updatedPhotoIds.transformador_componente_instalado ?? [],
        fotos_transformador_tombamento_instalado: updatedPhotoIds.transformador_tombamento_instalado ?? [],
        fotos_transformador_tape: updatedPhotoIds.transformador_tape ?? [],
        fotos_transformador_placa_instalado: updatedPhotoIds.transformador_placa_instalado ?? [],
        fotos_transformador_instalado: updatedPhotoIds.transformador_instalado ?? [],
        fotos_transformador_conexoes_primarias_instalado: updatedPhotoIds.transformador_conexoes_primarias_instalado ?? [],
        fotos_transformador_conexoes_secundarias_instalado: updatedPhotoIds.transformador_conexoes_secundarias_instalado ?? [],
        fotos_transformador_antes_retirar: updatedPhotoIds.transformador_antes_retirar ?? [],
        fotos_transformador_laudo_retirado: updatedPhotoIds.transformador_laudo_retirado ?? [],
        fotos_transformador_tombamento_retirado: updatedPhotoIds.transformador_tombamento_retirado ?? [],
        fotos_transformador_placa_retirado: updatedPhotoIds.transformador_placa_retirado ?? [],
        fotos_transformador_conexoes_primarias_retirado: updatedPhotoIds.transformador_conexoes_primarias_retirado ?? [],
        fotos_transformador_conexoes_secundarias_retirado: updatedPhotoIds.transformador_conexoes_secundarias_retirado ?? [],
        fotos_medidor_padrao: updatedPhotoIds.medidor_padrao ?? [],
        fotos_medidor_leitura: updatedPhotoIds.medidor_leitura ?? [],
        fotos_medidor_selo_born: updatedPhotoIds.medidor_selo_born ?? [],
        fotos_medidor_selo_caixa: updatedPhotoIds.medidor_selo_caixa ?? [],
        fotos_medidor_identificador_fase: updatedPhotoIds.medidor_identificador_fase ?? [],
        fotos_checklist_croqui: updatedPhotoIds.checklist_croqui ?? [],
        fotos_checklist_panoramica_inicial: updatedPhotoIds.checklist_panoramica_inicial ?? [],
        fotos_checklist_chede: updatedPhotoIds.checklist_chede ?? [],
        fotos_checklist_aterramento_cerca: updatedPhotoIds.checklist_aterramento_cerca ?? [],
        fotos_checklist_padrao_geral: updatedPhotoIds.checklist_padrao_geral ?? [],
        fotos_checklist_padrao_interno: updatedPhotoIds.checklist_padrao_interno ?? [],
        fotos_checklist_panoramica_final: updatedPhotoIds.checklist_panoramica_final ?? [],
        fotos_checklist_postes: updatedPhotoIds.checklist_postes ?? [],
        fotos_checklist_seccionamentos: updatedPhotoIds.checklist_seccionamentos ?? [],
        doc_cadastro_medidor: updatedPhotoIds.doc_cadastro_medidor ?? [],
        doc_laudo_transformador: updatedPhotoIds.doc_laudo_transformador ?? [],
        doc_laudo_regulador: updatedPhotoIds.doc_laudo_regulador ?? [],
        doc_laudo_religador: updatedPhotoIds.doc_laudo_religador ?? [],
        doc_apr: updatedPhotoIds.doc_apr ?? [],
        doc_fvbt: updatedPhotoIds.doc_fvbt ?? [],
        doc_termo_desistencia_lpt: updatedPhotoIds.doc_termo_desistencia_lpt ?? [],
        doc_autorizacao_passagem: updatedPhotoIds.doc_autorizacao_passagem ?? [],
        doc_materiais_previsto: updatedPhotoIds.doc_materiais_previsto ?? [],
        doc_materiais_realizado: updatedPhotoIds.doc_materiais_realizado ?? [],
        fotos_altimetria_lado_fonte: updatedPhotoIds.altimetria_lado_fonte ?? [],
        fotos_altimetria_medicao_fonte: updatedPhotoIds.altimetria_medicao_fonte ?? [],
        fotos_altimetria_lado_carga: updatedPhotoIds.altimetria_lado_carga ?? [],
        fotos_altimetria_medicao_carga: updatedPhotoIds.altimetria_medicao_carga ?? [],
        fotos_vazamento_evidencia: updatedPhotoIds.vazamento_evidencia ?? [],
        fotos_vazamento_equipamentos_limpeza: updatedPhotoIds.vazamento_equipamentos_limpeza ?? [],
        fotos_vazamento_tombamento_retirado: updatedPhotoIds.vazamento_tombamento_retirado ?? [],
        fotos_vazamento_placa_retirado: updatedPhotoIds.vazamento_placa_retirado ?? [],
        fotos_vazamento_tombamento_instalado: updatedPhotoIds.vazamento_tombamento_instalado ?? [],
        fotos_vazamento_placa_instalado: updatedPhotoIds.vazamento_placa_instalado ?? [],
        fotos_vazamento_instalacao: updatedPhotoIds.vazamento_instalacao ?? [],
      } as PendingObra;

      pendingObras.push(editedObra);
      await AsyncStorage.setItem(PENDING_OBRAS_KEY, JSON.stringify(pendingObras));
      logger.sync('✅ Obra editada adicionada à fila offline:', obraId);
      return;
    }

    // Obra já está na lista de pendentes - atualizar
    const existingObra = pendingObras[obraIndex];

    // Mesclar dados atualizados
    const updatedObra: PendingObra = {
      ...existingObra,
      ...updatedData,
      isEdited: true,
      last_modified: new Date().toISOString(),
      sync_status: 'pending',
      // Mesclar IDs de fotos (adicionar novos aos existentes)
      fotos_antes: [...(existingObra.fotos_antes ?? []), ...(updatedPhotoIds.antes ?? [])],
      fotos_durante: [...(existingObra.fotos_durante ?? []), ...(updatedPhotoIds.durante ?? [])],
      fotos_depois: [...(existingObra.fotos_depois ?? []), ...(updatedPhotoIds.depois ?? [])],
      fotos_abertura: [...(existingObra.fotos_abertura ?? []), ...(updatedPhotoIds.abertura ?? [])],
      fotos_fechamento: [...(existingObra.fotos_fechamento ?? []), ...(updatedPhotoIds.fechamento ?? [])],
      fotos_ditais_abertura: [...(existingObra.fotos_ditais_abertura ?? []), ...(updatedPhotoIds.ditais_abertura ?? [])],
      fotos_ditais_impedir: [...(existingObra.fotos_ditais_impedir ?? []), ...(updatedPhotoIds.ditais_impedir ?? [])],
      fotos_ditais_testar: [...(existingObra.fotos_ditais_testar ?? []), ...(updatedPhotoIds.ditais_testar ?? [])],
      fotos_ditais_aterrar: [...(existingObra.fotos_ditais_aterrar ?? []), ...(updatedPhotoIds.ditais_aterrar ?? [])],
      fotos_ditais_sinalizar: [...(existingObra.fotos_ditais_sinalizar ?? []), ...(updatedPhotoIds.ditais_sinalizar ?? [])],
      fotos_aterramento_vala_aberta: [...(existingObra.fotos_aterramento_vala_aberta ?? []), ...(updatedPhotoIds.aterramento_vala_aberta ?? [])],
      fotos_aterramento_hastes: [...(existingObra.fotos_aterramento_hastes ?? []), ...(updatedPhotoIds.aterramento_hastes ?? [])],
      fotos_aterramento_vala_fechada: [...(existingObra.fotos_aterramento_vala_fechada ?? []), ...(updatedPhotoIds.aterramento_vala_fechada ?? [])],
      fotos_aterramento_medicao: [...(existingObra.fotos_aterramento_medicao ?? []), ...(updatedPhotoIds.aterramento_medicao ?? [])],
      fotos_transformador_laudo: [...(existingObra.fotos_transformador_laudo ?? []), ...(updatedPhotoIds.transformador_laudo ?? [])],
      fotos_transformador_componente_instalado: [...(existingObra.fotos_transformador_componente_instalado ?? []), ...(updatedPhotoIds.transformador_componente_instalado ?? [])],
      fotos_transformador_tombamento_instalado: [...(existingObra.fotos_transformador_tombamento_instalado ?? []), ...(updatedPhotoIds.transformador_tombamento_instalado ?? [])],
      fotos_transformador_tape: [...(existingObra.fotos_transformador_tape ?? []), ...(updatedPhotoIds.transformador_tape ?? [])],
      fotos_transformador_placa_instalado: [...(existingObra.fotos_transformador_placa_instalado ?? []), ...(updatedPhotoIds.transformador_placa_instalado ?? [])],
      fotos_transformador_instalado: [...(existingObra.fotos_transformador_instalado ?? []), ...(updatedPhotoIds.transformador_instalado ?? [])],
      fotos_transformador_conexoes_primarias_instalado: [...(existingObra.fotos_transformador_conexoes_primarias_instalado ?? []), ...(updatedPhotoIds.transformador_conexoes_primarias_instalado ?? [])],
      fotos_transformador_conexoes_secundarias_instalado: [...(existingObra.fotos_transformador_conexoes_secundarias_instalado ?? []), ...(updatedPhotoIds.transformador_conexoes_secundarias_instalado ?? [])],
      fotos_transformador_antes_retirar: [...(existingObra.fotos_transformador_antes_retirar ?? []), ...(updatedPhotoIds.transformador_antes_retirar ?? [])],
      fotos_transformador_laudo_retirado: [...((existingObra as any).fotos_transformador_laudo_retirado ?? []), ...(updatedPhotoIds.transformador_laudo_retirado ?? [])],
      fotos_transformador_tombamento_retirado: [...(existingObra.fotos_transformador_tombamento_retirado ?? []), ...(updatedPhotoIds.transformador_tombamento_retirado ?? [])],
      fotos_transformador_placa_retirado: [...(existingObra.fotos_transformador_placa_retirado ?? []), ...(updatedPhotoIds.transformador_placa_retirado ?? [])],
      fotos_transformador_conexoes_primarias_retirado: [...(existingObra.fotos_transformador_conexoes_primarias_retirado ?? []), ...(updatedPhotoIds.transformador_conexoes_primarias_retirado ?? [])],
      fotos_transformador_conexoes_secundarias_retirado: [...(existingObra.fotos_transformador_conexoes_secundarias_retirado ?? []), ...(updatedPhotoIds.transformador_conexoes_secundarias_retirado ?? [])],
      fotos_medidor_padrao: [...(existingObra.fotos_medidor_padrao ?? []), ...(updatedPhotoIds.medidor_padrao ?? [])],
      fotos_medidor_leitura: [...(existingObra.fotos_medidor_leitura ?? []), ...(updatedPhotoIds.medidor_leitura ?? [])],
      fotos_medidor_selo_born: [...(existingObra.fotos_medidor_selo_born ?? []), ...(updatedPhotoIds.medidor_selo_born ?? [])],
      fotos_medidor_selo_caixa: [...(existingObra.fotos_medidor_selo_caixa ?? []), ...(updatedPhotoIds.medidor_selo_caixa ?? [])],
      fotos_medidor_identificador_fase: [...(existingObra.fotos_medidor_identificador_fase ?? []), ...(updatedPhotoIds.medidor_identificador_fase ?? [])],
      fotos_checklist_croqui: [...(existingObra.fotos_checklist_croqui ?? []), ...(updatedPhotoIds.checklist_croqui ?? [])],
      fotos_checklist_panoramica_inicial: [...(existingObra.fotos_checklist_panoramica_inicial ?? []), ...(updatedPhotoIds.checklist_panoramica_inicial ?? [])],
      fotos_checklist_chede: [...(existingObra.fotos_checklist_chede ?? []), ...(updatedPhotoIds.checklist_chede ?? [])],
      fotos_checklist_aterramento_cerca: [...(existingObra.fotos_checklist_aterramento_cerca ?? []), ...(updatedPhotoIds.checklist_aterramento_cerca ?? [])],
      fotos_checklist_padrao_geral: [...(existingObra.fotos_checklist_padrao_geral ?? []), ...(updatedPhotoIds.checklist_padrao_geral ?? [])],
      fotos_checklist_padrao_interno: [...(existingObra.fotos_checklist_padrao_interno ?? []), ...(updatedPhotoIds.checklist_padrao_interno ?? [])],
      fotos_checklist_panoramica_final: [...(existingObra.fotos_checklist_panoramica_final ?? []), ...(updatedPhotoIds.checklist_panoramica_final ?? [])],
      fotos_checklist_postes: [...(existingObra.fotos_checklist_postes ?? []), ...(updatedPhotoIds.checklist_postes ?? [])],
      fotos_checklist_seccionamentos: [...(existingObra.fotos_checklist_seccionamentos ?? []), ...(updatedPhotoIds.checklist_seccionamentos ?? [])],
      doc_cadastro_medidor: [...(existingObra.doc_cadastro_medidor ?? []), ...(updatedPhotoIds.doc_cadastro_medidor ?? [])],
      doc_laudo_transformador: [...(existingObra.doc_laudo_transformador ?? []), ...(updatedPhotoIds.doc_laudo_transformador ?? [])],
      doc_laudo_regulador: [...(existingObra.doc_laudo_regulador ?? []), ...(updatedPhotoIds.doc_laudo_regulador ?? [])],
      doc_laudo_religador: [...(existingObra.doc_laudo_religador ?? []), ...(updatedPhotoIds.doc_laudo_religador ?? [])],
      doc_apr: [...(existingObra.doc_apr ?? []), ...(updatedPhotoIds.doc_apr ?? [])],
      doc_fvbt: [...(existingObra.doc_fvbt ?? []), ...(updatedPhotoIds.doc_fvbt ?? [])],
      doc_termo_desistencia_lpt: [...(existingObra.doc_termo_desistencia_lpt ?? []), ...(updatedPhotoIds.doc_termo_desistencia_lpt ?? [])],
      doc_autorizacao_passagem: [...(existingObra.doc_autorizacao_passagem ?? []), ...(updatedPhotoIds.doc_autorizacao_passagem ?? [])],
      doc_materiais_previsto: [...(existingObra.doc_materiais_previsto ?? []), ...(updatedPhotoIds.doc_materiais_previsto ?? [])],
      doc_materiais_realizado: [...(existingObra.doc_materiais_realizado ?? []), ...(updatedPhotoIds.doc_materiais_realizado ?? [])],
      fotos_altimetria_lado_fonte: [...(existingObra.fotos_altimetria_lado_fonte ?? []), ...(updatedPhotoIds.altimetria_lado_fonte ?? [])],
      fotos_altimetria_medicao_fonte: [...(existingObra.fotos_altimetria_medicao_fonte ?? []), ...(updatedPhotoIds.altimetria_medicao_fonte ?? [])],
      fotos_altimetria_lado_carga: [...(existingObra.fotos_altimetria_lado_carga ?? []), ...(updatedPhotoIds.altimetria_lado_carga ?? [])],
      fotos_altimetria_medicao_carga: [...(existingObra.fotos_altimetria_medicao_carga ?? []), ...(updatedPhotoIds.altimetria_medicao_carga ?? [])],
      fotos_vazamento_evidencia: [...(existingObra.fotos_vazamento_evidencia ?? []), ...(updatedPhotoIds.vazamento_evidencia ?? [])],
      fotos_vazamento_equipamentos_limpeza: [...(existingObra.fotos_vazamento_equipamentos_limpeza ?? []), ...(updatedPhotoIds.vazamento_equipamentos_limpeza ?? [])],
      fotos_vazamento_tombamento_retirado: [...(existingObra.fotos_vazamento_tombamento_retirado ?? []), ...(updatedPhotoIds.vazamento_tombamento_retirado ?? [])],
      fotos_vazamento_placa_retirado: [...(existingObra.fotos_vazamento_placa_retirado ?? []), ...(updatedPhotoIds.vazamento_placa_retirado ?? [])],
      fotos_vazamento_tombamento_instalado: [...(existingObra.fotos_vazamento_tombamento_instalado ?? []), ...(updatedPhotoIds.vazamento_tombamento_instalado ?? [])],
      fotos_vazamento_placa_instalado: [...(existingObra.fotos_vazamento_placa_instalado ?? []), ...(updatedPhotoIds.vazamento_placa_instalado ?? [])],
      fotos_vazamento_instalacao: [...(existingObra.fotos_vazamento_instalacao ?? []), ...(updatedPhotoIds.vazamento_instalacao ?? [])],
    };

    pendingObras[obraIndex] = updatedObra;
    await AsyncStorage.setItem(PENDING_OBRAS_KEY, JSON.stringify(pendingObras));
    logger.sync('✅ Obra offline atualizada:', obraId);
  } catch (error) {
    logger.error('❌ Erro ao atualizar obra offline:', error);
    throw error;
  }
};

/**
 * Obtém todas as obras pendentes de sincronização
 */
export const getPendingObras = async (): Promise<PendingObra[]> => {
  try {
    const data = await AsyncStorage.getItem(PENDING_OBRAS_KEY);
    return data ? JSON.parse(data) : [];
  } catch (error) {
    logger.error('Erro ao obter obras pendentes:', error);
    return [];
  }
};

/**
 * Remove uma obra da fila de sincronização
 */
export const removePendingObra = async (id: string): Promise<void> => {
  try {
    const pendingObras = await getPendingObras();
    const filtered = pendingObras.filter(o => o.id !== id);
    await AsyncStorage.setItem(PENDING_OBRAS_KEY, JSON.stringify(filtered));
    await updateSyncStatus();
  } catch (error) {
    logger.error('Erro ao remover obra pendente:', error);
    throw error;
  }
};

/**
 * Marca uma obra como finalizada (local + remoto quando possivel).
 * Usado pelos cards legados em obra-books.
 */
export const markObraFinalizada = async (obraId: string): Promise<boolean> => {
  try {
    const now = new Date().toISOString();
    const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

    let changedLocal = false;
    let changedPending = false;
    let remoteUpdated = false;
    let remoteTargetId: string | null = uuidRegex.test(obraId) ? obraId : null;

    // 1) Atualiza obras locais
    {
      const localObras: any[] = await readObrasRaw();
      const updatedLocal = localObras.map((obra) => {
        const matches = obra?.id === obraId || obra?.serverId === obraId;
        if (!matches) return obra;

        changedLocal = true;
        const possibleRemoteId =
          (typeof obra?.serverId === 'string' && uuidRegex.test(obra.serverId)) ? obra.serverId :
          (typeof obra?.id === 'string' && uuidRegex.test(obra.id)) ? obra.id :
          null;
        if (!remoteTargetId && possibleRemoteId) {
          remoteTargetId = possibleRemoteId;
        }

        return {
          ...obra,
          status: 'finalizada',
          finalizada_em: now,
          data_fechamento: now,
          synced: false,
          locallyModified: true,
          sync_status: 'pending',
          error_message: null,
          last_modified: now,
        };
      });

      if (changedLocal) {
        await writeObrasRaw(updatedLocal);
      }
    }

    // 2) Atualiza pending obras
    const pendingRaw = await AsyncStorage.getItem(PENDING_OBRAS_KEY);
    if (pendingRaw) {
      const pendingObras: any[] = JSON.parse(pendingRaw);
      const updatedPending = pendingObras.map((obra) => {
        const matches = obra?.id === obraId || obra?.serverId === obraId;
        if (!matches) return obra;

        changedPending = true;
        const possibleRemoteId =
          (typeof obra?.serverId === 'string' && uuidRegex.test(obra.serverId)) ? obra.serverId :
          (typeof obra?.id === 'string' && uuidRegex.test(obra.id)) ? obra.id :
          null;
        if (!remoteTargetId && possibleRemoteId) {
          remoteTargetId = possibleRemoteId;
        }

        return {
          ...obra,
          status: 'finalizada',
          finalizada_em: now,
          data_fechamento: now,
          sync_status: 'pending',
          error_message: null,
          last_modified: now,
        };
      });

      if (changedPending) {
        await AsyncStorage.setItem(PENDING_OBRAS_KEY, JSON.stringify(updatedPending));
      }
    }

    // 3) Atualiza remoto quando online e com UUID valido
    if (remoteTargetId) {
      const isOnline = await checkInternetConnection();
      if (isOnline) {
        const { error } = await supabase
          .from('obras')
          .update({
            status: 'finalizada',
            finalizada_em: now,
            data_fechamento: now,
            updated_at: now,
          })
          .eq('id', remoteTargetId);

        if (!error) {
          remoteUpdated = true;

          // Marca cache local como sincronizado para evitar voltar status antigo no merge.
          {
            const localObras2: any[] = await readObrasRaw();
            const normalized = localObras2.map((obra) => {
              const matches = obra?.id === obraId || obra?.serverId === obraId || obra?.id === remoteTargetId || obra?.serverId === remoteTargetId;
              if (!matches) return obra;
              return {
                ...obra,
                status: 'finalizada',
                finalizada_em: now,
                data_fechamento: now,
                synced: true,
                locallyModified: false,
                sync_status: undefined,
                error_message: null,
              };
            });
            await writeObrasRaw(normalized);
          }
        } else {
          logger.warn('[markObraFinalizada] Falha ao atualizar obra no Supabase:', error);
        }
      }
    }

    await updateSyncStatus();
    return changedLocal || changedPending || remoteUpdated;
  } catch (error) {
    logger.error('Erro ao marcar obra como finalizada:', error);
    return false;
  }
};

/**
 * Atualiza o status de uma obra pendente
 */
export const updatePendingObraStatus = async (
  id: string,
  status: 'pending' | 'syncing' | 'failed',
  errorMessage?: string,
  syncAttempts?: number
): Promise<void> => {
  try {
    const pendingObras = await getPendingObras();
    const index = pendingObras.findIndex(o => o.id === id);

    if (index !== -1) {
      pendingObras[index].sync_status = status;
      if (status === 'failed') {
        pendingObras[index].error_message = errorMessage;
        // Incrementar tentativas de sync
        if (syncAttempts !== undefined) {
          pendingObras[index].sync_attempts = syncAttempts;
        }
      } else {
        delete pendingObras[index].error_message;
        // Reset tentativas quando volta a pending ou syncing
        if (status === 'pending') {
          pendingObras[index].sync_attempts = 0;
        }
      }
      await AsyncStorage.setItem(PENDING_OBRAS_KEY, JSON.stringify(pendingObras));
      await updateSyncStatus();
    }
  } catch (error) {
    logger.error('Erro ao atualizar status da obra pendente:', error);
    throw error;
  }
};

/**
 * Obtém metadatas de fotos a partir dos IDs
 * IMPORTANTE: Busca TODAS as fotos (uploaded ou não) para poder sincronizar corretamente
 */
const getPhotoMetadatasByIds = async (photoIds: string[]): Promise<PhotoMetadata[]> => {
  const allMetadata = await getAllPhotoMetadata();  // Busca TODAS, não só pendentes
  const found = allMetadata.filter(p => photoIds.includes(p.id));

  // Log para debug se não encontrou todas as fotos
  if (photoIds.length > 0 && found.length !== photoIds.length) {
    logger.warn(`⚠️ [getPhotoMetadatasByIds] Buscando ${photoIds.length} IDs, encontrou ${found.length}`);
    const foundIds = found.map(p => p.id);
    const notFound = photoIds.filter(id => !foundIds.includes(id));
    if (notFound.length > 0) {
      logger.warn(`   IDs não encontrados: ${JSON.stringify(notFound)}`);
    }
  }

  return found;
};

/**
 * Obtém metadatas com fallback por tipo
 * Primeiro tenta pelos IDs, se não encontrar, busca por obraId e tipo
 * Se ainda não encontrar, tenta extrair o tipo real do ID e buscar por ele
 */
const getPhotoMetadatasWithFallback = async (
  photoIds: string[],
  obraId: string,
  type: string
): Promise<PhotoMetadata[]> => {
  if (photoIds.length === 0) return [];

  const allMetadata = await getAllPhotoMetadata();
  const foundMap = new Map<string, PhotoMetadata>();

  // 1. Primeiro, tentar pelos IDs exatos
  for (const photoId of photoIds) {
    const photo = allMetadata.find(p => p.id === photoId);
    if (photo && photo.uploaded && photo.uploadUrl) {
      foundMap.set(photoId, photo);
    }
  }

  // 2. Se não encontrou todas, tentar por obraId + tipo
  if (foundMap.size < photoIds.length) {
    const byObraAndType = allMetadata.filter(p =>
      p.obraId === obraId && p.type === type && p.uploaded && p.uploadUrl
    );
    for (const photo of byObraAndType) {
      if (!foundMap.has(photo.id)) {
        foundMap.set(photo.id, photo);
      }
    }
    if (byObraAndType.length > 0) {
      logger.sync(`🔄 [Fallback obraId+tipo] Encontrou ${byObraAndType.length} foto(s) para ${type}`);
    }
  }

  // 3. Se ainda faltam, tentar extrair obraId antigo dos IDs das fotos
  if (foundMap.size < photoIds.length) {
    const possibleObraIds = new Set<string>();
    for (const photoId of photoIds) {
      // Extrair possível obraId do início do ID da foto (antes do tipo)
      const match = photoId.match(/^(.+?)_(antes|durante|depois|abertura|fechamento|ditais_|aterramento_|transformador_|medidor_|checklist_|altimetria_|vazamento_|doc_)/);
      if (match && match[1]) {
        possibleObraIds.add(match[1]);
      }
    }

    for (const possibleObraId of possibleObraIds) {
      if (possibleObraId !== obraId) {
        const byPossibleObraId = allMetadata.filter(p =>
          p.obraId === possibleObraId && p.type === type && p.uploaded && p.uploadUrl
        );
        for (const photo of byPossibleObraId) {
          if (!foundMap.has(photo.id)) {
            foundMap.set(photo.id, photo);
            logger.sync(`🔄 [Fallback obraId antigo] Encontrou foto ${photo.id} com obraId ${possibleObraId}`);
          }
        }
      }
    }
  }

  // 4. Fallback final: buscar por tipo apenas (sem uploadUrl obrigatório)
  if (foundMap.size < photoIds.length) {
    for (const photoId of photoIds) {
      if (!foundMap.has(photoId)) {
        const photo = allMetadata.find(p => p.id === photoId);
        if (photo) {
          foundMap.set(photoId, photo);
          logger.sync(`🔄 [Fallback ID direto] Encontrou foto ${photoId} (uploaded: ${photo.uploaded})`);
        }
      }
    }
  }

  return Array.from(foundMap.values());
};

/**
 * Converte metadados de fotos para o formato do banco de dados
 */
const convertPhotosToData = (metadata: PhotoMetadata[]) => {
  logger.sync(`🔍 [convertPhotosToData] Recebeu ${metadata.length} foto(s)`);

  metadata.forEach((p, idx) => {
    logger.sync(`📸 Foto ${idx + 1}:`, {
      id: p.id,
      type: p.type,
      uploaded: p.uploaded,
      hasUploadUrl: !!p.uploadUrl,
      uploadUrl: p.uploadUrl ? p.uploadUrl.substring(0, 50) + '...' : 'NULL',
    });
  });

  const filtered = metadata.filter(p => p.uploaded && p.uploadUrl);
  logger.sync(`✅ Após filtro: ${filtered.length} de ${metadata.length} foto(s) serão salvas no banco`);

  if (filtered.length < metadata.length) {
    logger.warn(`⚠️ ATENÇÃO: ${metadata.length - filtered.length} foto(s) foram DESCARTADAS (uploaded=false ou uploadUrl vazio)`);
  }

  return filtered.map(p => ({
    url: p.uploadUrl!,
    latitude: p.latitude,
    longitude: p.longitude,
    utm_x: p.utmX,
    utm_y: p.utmY,
    utm_zone: p.utmZone,
  }));
};

/**
 * Converte arrays de IDs de fotos em arrays de objetos com URLs
 * Usado para converter fotos dentro de estruturas JSONB do checklist
 */
const convertPhotoIdsToUrls = async (photoIds: any[]): Promise<any[]> => {
  if (!photoIds || !Array.isArray(photoIds) || photoIds.length === 0) {
    return [];
  }

  const result: any[] = [];

  const toPhotoPayload = (url: string, source?: any, metadata?: PhotoMetadata) => ({
    url,
    latitude: metadata?.latitude ?? source?.latitude ?? null,
    longitude: metadata?.longitude ?? source?.longitude ?? null,
    utm_x: metadata?.utmX ?? source?.utm_x ?? source?.utmX ?? null,
    utm_y: metadata?.utmY ?? source?.utm_y ?? source?.utmY ?? null,
    utm_zone: metadata?.utmZone ?? source?.utm_zone ?? source?.utmZone ?? null,
  });

  for (const item of photoIds) {
    // Se já é objeto com URL, manter como está
    if (typeof item === 'object' && item !== null && item.url) {
      result.push(toPhotoPayload(item.url, item));
      continue;
    }

    // Se veio URL direta em string
    if (typeof item === 'string' && item.startsWith('http')) {
      result.push(toPhotoPayload(item));
      continue;
    }

    // Aceitar tanto string quanto objeto com { id, ... }
    const photoId =
      typeof item === 'string'
        ? item
        : (typeof item === 'object' && item !== null && typeof item.id === 'string'
            ? item.id
            : null);

    if (!photoId) {
      continue;
    }

    const metadataList = await getPhotoMetadatasByIds([photoId]);
    const metadata = metadataList.find(m => m.uploaded && m.uploadUrl);

    if (metadata?.uploadUrl) {
      result.push(toPhotoPayload(metadata.uploadUrl, item, metadata));
    } else {
      logger.warn(`[WARN] [convertPhotoIdsToUrls] Foto ${photoId} não tem URL, será ignorada`);
    }
  }

  return result;
};

/**
 * Converte estruturas do checklist_postes_data para ter URLs nas fotos
 */
const convertChecklistPostesData = async (postesData: any[]): Promise<any[]> => {
  if (!postesData || !Array.isArray(postesData)) return postesData;

  const result = [];
  for (const poste of postesData) {
    result.push({
      ...poste,
      posteInteiro: await convertPhotoIdsToUrls(poste.posteInteiro || []),
      engaste: await convertPhotoIdsToUrls(poste.engaste || []),
      conexao1: await convertPhotoIdsToUrls(poste.conexao1 || []),
      conexao2: await convertPhotoIdsToUrls(poste.conexao2 || []),
      maiorEsforco: await convertPhotoIdsToUrls(poste.maiorEsforco || []),
      menorEsforco: await convertPhotoIdsToUrls(poste.menorEsforco || []),
    });
  }
  return result;
};

/**
 * Converte estruturas do checklist_seccionamentos_data para ter URLs nas fotos
 */
const convertChecklistSeccionamentosData = async (secData: any[]): Promise<any[]> => {
  if (!secData || !Array.isArray(secData)) return secData;

  const result = [];
  for (const sec of secData) {
    result.push({
      ...sec,
      fotos: await convertPhotoIdsToUrls(sec.fotos || []),
    });
  }
  return result;
};

/**
 * Converte estruturas do checklist_aterramentos_cerca_data para ter URLs nas fotos
 */
const convertChecklistAterramentosData = async (aterrData: any[]): Promise<any[]> => {
  if (!aterrData || !Array.isArray(aterrData)) return aterrData;

  const result = [];
  for (const aterr of aterrData) {
    result.push({
      ...aterr,
      fotos: await convertPhotoIdsToUrls(aterr.fotos || []),
    });
  }
  return result;
};

/**
 * Converte estruturas do checklist_hastes_termometros_data para ter URLs nas fotos
 */
const convertChecklistHastesTermometrosData = async (hastesData: any[]): Promise<any[]> => {
  if (!hastesData || !Array.isArray(hastesData)) return hastesData;

  const result = [];
  for (const ponto of hastesData) {
    result.push({
      ...ponto,
      fotoHaste: await convertPhotoIdsToUrls(ponto.fotoHaste || []),
      fotoTermometro: await convertPhotoIdsToUrls(ponto.fotoTermometro || []),
    });
  }
  return result;
};

/**
 * Converte estruturas de postes_data para ter URLs nas fotos (Linha Viva, Cava, Book, Fundação)
 */
const convertPostesData = async (postesData: any[]): Promise<any[]> => {
  if (!postesData || !Array.isArray(postesData)) return postesData;

  const result = [];
  for (const poste of postesData) {
    result.push({
      ...poste,
      fotos_antes: await convertPhotoIdsToUrls(poste?.fotos_antes || []),
      fotos_durante: await convertPhotoIdsToUrls(poste?.fotos_durante || []),
      fotos_depois: await convertPhotoIdsToUrls(poste?.fotos_depois || []),
      fotos_medicao: await convertPhotoIdsToUrls(poste?.fotos_medicao || []),
    });
  }
  return result;
};

const translateErrorMessage = (message?: string): string => {
  if (!message) {
    return 'Erro desconhecido. Tente novamente.';
  }

  const normalized = message.toLowerCase();

  if (normalized.includes('network request failed')) {
    return 'Falha na conexão. Verifique sua internet e tente novamente.';
  }

  if (normalized.includes('fetch failed')) {
    return 'Não foi possível contactar o servidor. Tente novamente em instantes.';
  }

  if (normalized.includes('unauthorized') || normalized.includes('not authenticated')) {
    return 'Sessão expirada. Faça login novamente para sincronizar.';
  }

  return message;
};

/**
 * Sincroniza uma obra específica com o servidor
 * @returns { success: boolean, newId?: string } - ID do Supabase se obra foi inserida
 */
export const syncObra = async (
  obra: PendingObra,
  onProgress?: (progress: UploadProgress) => void
): Promise<{ success: boolean; newId?: string }> => {
  try {
    // Validar número da obra antes de sincronizar (deve ter 8 ou 10 dígitos numéricos)
    const obraNumero = obra.obra?.trim() || '';
    if (!/^\d+$/.test(obraNumero) || (obraNumero.length !== 8 && obraNumero.length !== 10)) {
      logger.error(`❌ [syncObra] Número inválido: "${obraNumero}" (${obraNumero.length} dígitos). Deve ter 8 ou 10 dígitos. Sync bloqueado.`);
      return { success: false };
    }

    // Marcar como "sincronizando"
    await updatePendingObraStatus(obra.id, 'syncing');

    // Login por equipe - não precisa verificar supabase.auth
    // O user_id será NULL no banco (definido como opcional)

    // Processar upload das fotos através da fila
    logger.sync(`🚀 [syncObra] Iniciando upload de fotos para obra ${obra.obra}`);
    const referencedPhotoIds = collectObraReferencedPhotoIds(obra);
    logger.sync(`📌 [syncObra] IDs de fotos referenciados na obra: ${referencedPhotoIds.length}`);
    const uploadResult = await processObraPhotos(
      obra.id,
      onProgress,
      referencedPhotoIds.length > 0 ? referencedPhotoIds : undefined
    );
    logger.sync(`📊 [syncObra] Upload concluído: ${uploadResult.success} sucesso, ${uploadResult.failed} falhas`);

    // SYNC PARCIAL: Permitir salvar obra mesmo se algumas fotos falharem
    // Log de aviso se houver falhas, mas não bloqueia o sync
    if (uploadResult.failed > 0) {
      const totalPhotos = uploadResult.success + uploadResult.failed;
      const lostPhotos = uploadResult.results.filter((r) => {
        if (r.success) return false;
        const msg = (r.error || '').toLowerCase();
        return (
          msg.includes('não encontrado') ||
          msg.includes('nao encontrado') ||
          msg.includes('photo-backup') ||
          msg.includes('arquivo fisico')
        );
      }).length;
      const networkFailures = uploadResult.failed - lostPhotos;

      if (lostPhotos > 0) {
        logger.warn(
          `⚠️ ${lostPhotos} foto(s) foram perdidas (arquivos removidos do dispositivo antes da sincronização)`
        );
      }
      if (networkFailures > 0) {
        logger.warn(
          `⚠️ ${networkFailures} foto(s) falharam no upload (problema de rede ou servidor)`
        );
      }
      logger.warn(
        `✅ Obra será sincronizada com ${uploadResult.success} de ${totalPhotos} foto(s).`
      );
      // Não lança erro - continua com as fotos que subiram com sucesso
    }

    // ✅ CRÍTICO: Converter estruturas JSONB do checklist APÓS upload das fotos
    // Isso garante que as URLs públicas já estejam disponíveis no metadata
    logger.sync(`🔄 [syncObra] Convertendo estruturas JSONB com URLs das fotos...`);
    const checklistPostesDataConverted = await convertChecklistPostesData((obra as any).checklist_postes_data);
    const checklistSeccionamentosDataConverted = await convertChecklistSeccionamentosData((obra as any).checklist_seccionamentos_data);
    const checklistAterramentosDataConverted = await convertChecklistAterramentosData((obra as any).checklist_aterramentos_cerca_data);
    const checklistHastesTermometrosDataConverted = await convertChecklistHastesTermometrosData((obra as any).checklist_hastes_termometros_data);
    const postesDataConverted = await convertPostesData((obra as any).postes_data);

    // Obter URLs das fotos uploadadas — LEITURA ÚNICA + MAP (57x mais rápido) ⚡
    logger.sync(`📥 [syncObra] Obtendo metadados das fotos uploadadas (leitura única)...`);
    logger.sync(`   - fotos_antes: ${obra.fotos_antes?.length || 0} IDs`);
    logger.sync(`   - fotos_durante: ${obra.fotos_durante?.length || 0} IDs`);
    logger.sync(`   - fotos_depois: ${obra.fotos_depois?.length || 0} IDs`);

    const _allSyncMeta = await getAllPhotoMetadata();
    const _metaById = new Map<string, PhotoMetadata>(_allSyncMeta.map(m => [m.id, m]));
    const _metaByObraType = new Map<string, PhotoMetadata[]>();
    for (const m of _allSyncMeta) {
      const key = `${m.obraId}:${m.type}`;
      const arr = _metaByObraType.get(key);
      if (arr) arr.push(m); else _metaByObraType.set(key, [m]);
    }

    // Cria um PhotoMetadata sintético para entradas que já são objetos com URL
    // (fotos já enviadas ao Supabase e relidas do banco como {url, lat, lon, ...})
    const _synthFromUrlObj = (entry: any): PhotoMetadata =>
      ({
        uploaded: true,
        uploadUrl: entry.url as string,
        latitude: entry.latitude ?? null,
        longitude: entry.longitude ?? null,
        utmX: entry.utm_x ?? null,
        utmY: entry.utm_y ?? null,
        utmZone: entry.utm_zone ?? null,
      } as PhotoMetadata);

    const _lookupByIds = (ids: any[]): PhotoMetadata[] => {
      const found: PhotoMetadata[] = [];
      const missing: string[] = [];
      for (const id of ids) {
        if (typeof id === 'object' && id !== null && typeof id.url === 'string') {
          found.push(_synthFromUrlObj(id));
          continue;
        }
        if (typeof id !== 'string') continue;
        const m = _metaById.get(id);
        if (m) found.push(m); else missing.push(id);
      }
      if (missing.length > 0) {
        logger.warn(`⚠️ [lookupByIds] Buscando ${ids.length} IDs, não encontrou: ${JSON.stringify(missing)}`);
      }
      return found;
    };

    const _lookupWithFallback = (photoIds: any[], obraId: string, type: string): PhotoMetadata[] => {
      if (photoIds.length === 0) return [];
      // Objetos já com URL passam direto; strings vão pelo caminho de lookup
      const urlResolved: PhotoMetadata[] = [];
      const stringIds: string[] = [];
      for (const id of photoIds) {
        if (typeof id === 'object' && id !== null && typeof id.url === 'string') {
          urlResolved.push(_synthFromUrlObj(id));
        } else if (typeof id === 'string') {
          stringIds.push(id);
        }
      }
      const resultMap = new Map<string, PhotoMetadata>();
      for (const id of stringIds) {
        const m = _metaById.get(id);
        if (m && m.uploaded && m.uploadUrl) resultMap.set(id, m);
      }
      if (resultMap.size < stringIds.length) {
        for (const m of (_metaByObraType.get(`${obraId}:${type}`) || [])) {
          if (m.uploaded && m.uploadUrl && !resultMap.has(m.id)) {
            resultMap.set(m.id, m);
            logger.sync(`🔄 [Fallback obraId+tipo] Encontrou ${m.id} para ${type}`);
          }
        }
      }
      if (resultMap.size < stringIds.length) {
        const possibleObraIds = new Set<string>();
        for (const id of stringIds) {
          const match = id.match(/^(.+?)_(antes|durante|depois|abertura|fechamento|ditais_|aterramento_|transformador_|medidor_|checklist_|altimetria_|vazamento_|doc_)/);
          if (match && match[1] && match[1] !== obraId) possibleObraIds.add(match[1]);
        }
        for (const possObraId of possibleObraIds) {
          for (const m of (_metaByObraType.get(`${possObraId}:${type}`) || [])) {
            if (m.uploaded && m.uploadUrl && !resultMap.has(m.id)) {
              resultMap.set(m.id, m);
              logger.sync(`🔄 [Fallback obraId antigo] Encontrou foto ${m.id} com obraId ${possObraId}`);
            }
          }
        }
      }
      if (resultMap.size < stringIds.length) {
        for (const id of stringIds) {
          if (!resultMap.has(id)) {
            const m = _metaById.get(id);
            if (m) {
              resultMap.set(id, m);
              logger.sync(`🔄 [Fallback ID direto] Encontrou foto ${id} (uploaded: ${m.uploaded})`);
            }
          }
        }
      }
      return [...urlResolved, ...Array.from(resultMap.values())];
    };

    const fotosAntesMetadata = _lookupByIds(obra.fotos_antes || []);
    const fotosDuranteMetadata = _lookupByIds(obra.fotos_durante || []);
    const fotosDepoisMetadata = _lookupByIds(obra.fotos_depois || []);
    const fotosAberturaMetadata = _lookupByIds(obra.fotos_abertura || []);
    const fotosFechamentoMetadata = _lookupByIds(obra.fotos_fechamento || []);
    const fotosDitaisAberturaMetadata = _lookupByIds(obra.fotos_ditais_abertura || []);
    const fotosDitaisImpedirMetadata = _lookupByIds(obra.fotos_ditais_impedir || []);
    const fotosDitaisTestarMetadata = _lookupByIds(obra.fotos_ditais_testar || []);
    const fotosDitaisAterrarMetadata = _lookupByIds(obra.fotos_ditais_aterrar || []);
    const fotosDitaisSinalizarMetadata = _lookupByIds(obra.fotos_ditais_sinalizar || []);
    const fotosAterramentoValaAbertaMetadata = _lookupByIds(obra.fotos_aterramento_vala_aberta || []);
    const fotosAterramentoHastesMetadata = _lookupByIds(obra.fotos_aterramento_hastes || []);
    const fotosAterramentoValaFechadaMetadata = _lookupByIds(obra.fotos_aterramento_vala_fechada || []);
    const fotosAterramentoMedicaoMetadata = _lookupByIds(obra.fotos_aterramento_medicao || []);
    const fotosTransformadorLaudoMetadata = _lookupWithFallback(obra.fotos_transformador_laudo || [], obra.id, 'transformador_laudo');
    const fotosTransformadorComponenteInstaladoMetadata = _lookupWithFallback(obra.fotos_transformador_componente_instalado || [], obra.id, 'transformador_componente_instalado');
    const fotosTransformadorTombamentoInstaladoMetadata = _lookupWithFallback(obra.fotos_transformador_tombamento_instalado || [], obra.id, 'transformador_tombamento_instalado');
    const fotosTransformadorTapeMetadata = _lookupWithFallback(obra.fotos_transformador_tape || [], obra.id, 'transformador_tape');
    const fotosTransformadorPlacaInstaladoMetadata = _lookupWithFallback(obra.fotos_transformador_placa_instalado || [], obra.id, 'transformador_placa_instalado');
    const fotosTransformadorInstaladoMetadata = _lookupWithFallback(obra.fotos_transformador_instalado || [], obra.id, 'transformador_instalado');
    const fotosTransformadorAntesRetirarMetadata = _lookupWithFallback(obra.fotos_transformador_antes_retirar || [], obra.id, 'transformador_antes_retirar');
    const fotosTransformadorLaudoRetiradoMetadata = _lookupWithFallback((obra as any).fotos_transformador_laudo_retirado || [], obra.id, 'transformador_laudo_retirado');
    const fotosTransformadorTombamentoRetiradoMetadata = _lookupWithFallback(obra.fotos_transformador_tombamento_retirado || [], obra.id, 'transformador_tombamento_retirado');
    const fotosTransformadorPlacaRetiradoMetadata = _lookupWithFallback(obra.fotos_transformador_placa_retirado || [], obra.id, 'transformador_placa_retirado');
    const fotosTransformadorConexoesPrimariasInstaladoMetadata = _lookupWithFallback(obra.fotos_transformador_conexoes_primarias_instalado || [], obra.id, 'transformador_conexoes_primarias_instalado');
    const fotosTransformadorConexoesSecundariasInstaladoMetadata = _lookupWithFallback(obra.fotos_transformador_conexoes_secundarias_instalado || [], obra.id, 'transformador_conexoes_secundarias_instalado');
    const fotosTransformadorConexoesPrimariasRetiradoMetadata = _lookupWithFallback(obra.fotos_transformador_conexoes_primarias_retirado || [], obra.id, 'transformador_conexoes_primarias_retirado');
    const fotosTransformadorConexoesSecundariasRetiradoMetadata = _lookupWithFallback(obra.fotos_transformador_conexoes_secundarias_retirado || [], obra.id, 'transformador_conexoes_secundarias_retirado');
    const fotosMedidorPadraoMetadata = _lookupByIds(obra.fotos_medidor_padrao || []);
    const fotosMedidorLeituraMetadata = _lookupByIds(obra.fotos_medidor_leitura || []);
    const fotosMedidorSeloBornMetadata = _lookupByIds(obra.fotos_medidor_selo_born || []);
    const fotosMedidorSeloCaixaMetadata = _lookupByIds(obra.fotos_medidor_selo_caixa || []);
    const fotosMedidorIdentificadorFaseMetadata = _lookupByIds(obra.fotos_medidor_identificador_fase || []);
    const fotosChecklistCroquiMetadata = _lookupByIds(obra.fotos_checklist_croqui || []);
    const fotosChecklistPanoramicaInicialMetadata = _lookupByIds(obra.fotos_checklist_panoramica_inicial || []);
    const fotosChecklistChedeMetadata = _lookupByIds(obra.fotos_checklist_chede || []);
    const fotosChecklistAterramentoCercaMetadata = _lookupByIds(obra.fotos_checklist_aterramento_cerca || []);
    const fotosChecklistPadraoGeralMetadata = _lookupByIds(obra.fotos_checklist_padrao_geral || []);
    const fotosChecklistPadraoInternoMetadata = _lookupByIds(obra.fotos_checklist_padrao_interno || []);
    const fotosChecklistFryingMetadata = _lookupByIds((obra as any).fotos_checklist_frying || []);
    const fotosChecklistAberturaFechamentoPuloMetadata = _lookupByIds((obra as any).fotos_checklist_abertura_fechamento_pulo || []);
    const fotosChecklistPanoramicaFinalMetadata = _lookupByIds(obra.fotos_checklist_panoramica_final || []);
    const fotosChecklistPostesMetadata = _lookupByIds(obra.fotos_checklist_postes || []);
    const fotosChecklistSeccionamentosMetadata = _lookupByIds(obra.fotos_checklist_seccionamentos || []);
    const docCadastroMedidorMetadata = _lookupWithFallback(obra.doc_cadastro_medidor || [], obra.id, 'doc_cadastro_medidor');
    const docLaudoTransformadorMetadata = _lookupWithFallback(obra.doc_laudo_transformador || [], obra.id, 'doc_laudo_transformador');
    const docLaudoReguladorMetadata = _lookupWithFallback(obra.doc_laudo_regulador || [], obra.id, 'doc_laudo_regulador');
    const docLaudoReligadorMetadata = _lookupWithFallback(obra.doc_laudo_religador || [], obra.id, 'doc_laudo_religador');
    const docAprMetadata = _lookupWithFallback(obra.doc_apr || [], obra.id, 'doc_apr');
    const docFvbtMetadata = _lookupWithFallback(obra.doc_fvbt || [], obra.id, 'doc_fvbt');
    const docTermoDesistenciaLptMetadata = _lookupWithFallback(obra.doc_termo_desistencia_lpt || [], obra.id, 'doc_termo_desistencia_lpt');
    const docAutorizacaoPassagemMetadata = _lookupWithFallback(obra.doc_autorizacao_passagem || [], obra.id, 'doc_autorizacao_passagem');
    const docMateriaisPrevistoMetadata = _lookupWithFallback(obra.doc_materiais_previsto || [], obra.id, 'doc_materiais_previsto');
    const docMateriaisRealizadoMetadata = _lookupWithFallback(obra.doc_materiais_realizado || [], obra.id, 'doc_materiais_realizado');
    const fotosAltimetriaLadoFonteMetadata = _lookupByIds(obra.fotos_altimetria_lado_fonte || []);
    const fotosAltimetriaMedicaoFonteMetadata = _lookupByIds(obra.fotos_altimetria_medicao_fonte || []);
    const fotosAltimetriaLadoCargaMetadata = _lookupByIds(obra.fotos_altimetria_lado_carga || []);
    const fotosAltimetriaMedicaoCargaMetadata = _lookupByIds(obra.fotos_altimetria_medicao_carga || []);
    const fotosVazamentoEvidenciaMetadata = _lookupByIds(obra.fotos_vazamento_evidencia || []);
    const fotosVazamentoEquipamentosLimpezaMetadata = _lookupByIds(obra.fotos_vazamento_equipamentos_limpeza || []);
    const fotosVazamentoTombamentoRetiradoMetadata = _lookupByIds(obra.fotos_vazamento_tombamento_retirado || []);
    const fotosVazamentoPlacaRetiradoMetadata = _lookupByIds(obra.fotos_vazamento_placa_retirado || []);
    const fotosVazamentoTombamentoInstaladoMetadata = _lookupByIds(obra.fotos_vazamento_tombamento_instalado || []);
    const fotosVazamentoPlacaInstaladoMetadata = _lookupByIds(obra.fotos_vazamento_placa_instalado || []);
    const fotosVazamentoInstalacaoMetadata = _lookupByIds(obra.fotos_vazamento_instalacao || []);

    // Converter todos os metadados para o formato do banco
    const fotosAntesData = convertPhotosToData(fotosAntesMetadata);
    const fotosDuranteData = convertPhotosToData(fotosDuranteMetadata);
    const fotosDepoisData = convertPhotosToData(fotosDepoisMetadata);
    const fotosAberturaData = convertPhotosToData(fotosAberturaMetadata);
    const fotosFechamentoData = convertPhotosToData(fotosFechamentoMetadata);
    const fotosDitaisAberturaData = convertPhotosToData(fotosDitaisAberturaMetadata);
    const fotosDitaisImpedirData = convertPhotosToData(fotosDitaisImpedirMetadata);
    const fotosDitaisTestarData = convertPhotosToData(fotosDitaisTestarMetadata);
    const fotosDitaisAterrarData = convertPhotosToData(fotosDitaisAterrarMetadata);
    const fotosDitaisSinalizarData = convertPhotosToData(fotosDitaisSinalizarMetadata);
    const fotosAterramentoValaAbertaData = convertPhotosToData(fotosAterramentoValaAbertaMetadata);
    const fotosAterramentoHastesData = convertPhotosToData(fotosAterramentoHastesMetadata);
    const fotosAterramentoValaFechadaData = convertPhotosToData(fotosAterramentoValaFechadaMetadata);
    const fotosAterramentoMedicaoData = convertPhotosToData(fotosAterramentoMedicaoMetadata);
    const fotosTransformadorLaudoData = convertPhotosToData(fotosTransformadorLaudoMetadata);
    const fotosTransformadorComponenteInstaladoData = convertPhotosToData(fotosTransformadorComponenteInstaladoMetadata);
    const fotosTransformadorTombamentoInstaladoData = convertPhotosToData(fotosTransformadorTombamentoInstaladoMetadata);
    const fotosTransformadorTapeData = convertPhotosToData(fotosTransformadorTapeMetadata);
    const fotosTransformadorPlacaInstaladoData = convertPhotosToData(fotosTransformadorPlacaInstaladoMetadata);
    const fotosTransformadorInstaladoData = convertPhotosToData(fotosTransformadorInstaladoMetadata);
    const fotosTransformadorAntesRetirarData = convertPhotosToData(fotosTransformadorAntesRetirarMetadata);
    const fotosTransformadorLaudoRetiradoData = convertPhotosToData(fotosTransformadorLaudoRetiradoMetadata);
    const fotosTransformadorTombamentoRetiradoData = convertPhotosToData(fotosTransformadorTombamentoRetiradoMetadata);
    const fotosTransformadorPlacaRetiradoData = convertPhotosToData(fotosTransformadorPlacaRetiradoMetadata);
    const fotosTransformadorConexoesPrimariasInstaladoData = convertPhotosToData(fotosTransformadorConexoesPrimariasInstaladoMetadata);
    const fotosTransformadorConexoesSecundariasInstaladoData = convertPhotosToData(fotosTransformadorConexoesSecundariasInstaladoMetadata);
    const fotosTransformadorConexoesPrimariasRetiradoData = convertPhotosToData(fotosTransformadorConexoesPrimariasRetiradoMetadata);
    const fotosTransformadorConexoesSecundariasRetiradoData = convertPhotosToData(fotosTransformadorConexoesSecundariasRetiradoMetadata);
    const fotosMedidorPadraoData = convertPhotosToData(fotosMedidorPadraoMetadata);
    const fotosMedidorLeituraData = convertPhotosToData(fotosMedidorLeituraMetadata);
    const fotosMedidorSeloBornData = convertPhotosToData(fotosMedidorSeloBornMetadata);
    const fotosMedidorSeloCaixaData = convertPhotosToData(fotosMedidorSeloCaixaMetadata);
    const fotosMedidorIdentificadorFaseData = convertPhotosToData(fotosMedidorIdentificadorFaseMetadata);
    const fotosChecklistCroquiData = convertPhotosToData(fotosChecklistCroquiMetadata);
    const fotosChecklistPanoramicaInicialData = convertPhotosToData(fotosChecklistPanoramicaInicialMetadata);
    const fotosChecklistChedeData = convertPhotosToData(fotosChecklistChedeMetadata);
    const fotosChecklistAterramentoCercaData = convertPhotosToData(fotosChecklistAterramentoCercaMetadata);
    const fotosChecklistPadraoGeralData = convertPhotosToData(fotosChecklistPadraoGeralMetadata);
    const fotosChecklistPadraoInternoData = convertPhotosToData(fotosChecklistPadraoInternoMetadata);
    const fotosChecklistFryingData = convertPhotosToData(fotosChecklistFryingMetadata);
    const fotosChecklistAberturaFechamentoPuloData = convertPhotosToData(fotosChecklistAberturaFechamentoPuloMetadata);
    const fotosChecklistPanoramicaFinalData = convertPhotosToData(fotosChecklistPanoramicaFinalMetadata);
    const fotosChecklistPostesData = convertPhotosToData(fotosChecklistPostesMetadata);
    const fotosChecklistSeccionamentosData = convertPhotosToData(fotosChecklistSeccionamentosMetadata);
    const docCadastroMedidorData = convertPhotosToData(docCadastroMedidorMetadata);
    const docLaudoTransformadorData = convertPhotosToData(docLaudoTransformadorMetadata);
    const docLaudoReguladorData = convertPhotosToData(docLaudoReguladorMetadata);
    const docLaudoReligadorData = convertPhotosToData(docLaudoReligadorMetadata);
    const docAprData = convertPhotosToData(docAprMetadata);
    const docFvbtData = convertPhotosToData(docFvbtMetadata);
    const docTermoDesistenciaLptData = convertPhotosToData(docTermoDesistenciaLptMetadata);
    const docAutorizacaoPassagemData = convertPhotosToData(docAutorizacaoPassagemMetadata);
    const docMateriaisPrevistoData = convertPhotosToData(docMateriaisPrevistoMetadata);
    const docMateriaisRealizadoData = convertPhotosToData(docMateriaisRealizadoMetadata);
    const fotosAltimetriaLadoFonteData = convertPhotosToData(fotosAltimetriaLadoFonteMetadata);
    const fotosAltimetriaMedicaoFonteData = convertPhotosToData(fotosAltimetriaMedicaoFonteMetadata);
    const fotosAltimetriaLadoCargaData = convertPhotosToData(fotosAltimetriaLadoCargaMetadata);
    const fotosAltimetriaMedicaoCargaData = convertPhotosToData(fotosAltimetriaMedicaoCargaMetadata);
    const fotosVazamentoEvidenciaData = convertPhotosToData(fotosVazamentoEvidenciaMetadata);
    const fotosVazamentoEquipamentosLimpezaData = convertPhotosToData(fotosVazamentoEquipamentosLimpezaMetadata);
    const fotosVazamentoTombamentoRetiradoData = convertPhotosToData(fotosVazamentoTombamentoRetiradoMetadata);
    const fotosVazamentoPlacaRetiradoData = convertPhotosToData(fotosVazamentoPlacaRetiradoMetadata);
    const fotosVazamentoTombamentoInstaladoData = convertPhotosToData(fotosVazamentoTombamentoInstaladoMetadata);
    const fotosVazamentoPlacaInstaladoData = convertPhotosToData(fotosVazamentoPlacaInstaladoMetadata);
    const fotosVazamentoInstalacaoData = convertPhotosToData(fotosVazamentoInstalacaoMetadata);

    const getPhotoIdentity = (photo: any): string => {
      if (typeof photo === 'string') return photo;
      if (!photo || typeof photo !== 'object') return JSON.stringify(photo);
      return String(photo.url || photo.uploadUrl || photo.id || photo.path || JSON.stringify(photo));
    };

    const mergePhotoArrays = (newData?: any[] | null, existingData?: any[] | null): any[] => {
      const existing = Array.isArray(existingData) ? existingData : [];
      const incoming = Array.isArray(newData) ? newData : [];
      if (incoming.length === 0) return existing;
      if (existing.length === 0) return incoming;

      const merged = [...existing];
      const byKey = new Map<string, number>();
      merged.forEach((photo, index) => byKey.set(getPhotoIdentity(photo), index));

      for (const photo of incoming) {
        const key = getPhotoIdentity(photo);
        const existingIndex = byKey.get(key);
        if (existingIndex === undefined) {
          byKey.set(key, merged.length);
          merged.push(photo);
          continue;
        }

        const current = merged[existingIndex];
        const currentHasUrl = !!(current && typeof current === 'object' && current.url);
        const incomingHasUrl = !!(photo && typeof photo === 'object' && photo.url);
        if (!currentHasUrl && incomingHasUrl) {
          merged[existingIndex] = photo;
        }
      }

      return merged;
    };

    const mergePostesData = (newData?: any[] | null, existingData?: any[] | null): any[] | null => {
      const incoming = Array.isArray(newData) ? newData : [];
      const existing = Array.isArray(existingData) ? existingData : [];
      if (incoming.length === 0) return existing.length > 0 ? existing : null;
      if (existing.length === 0) return incoming;

      const photoFields = ['fotos_antes', 'fotos_durante', 'fotos_depois', 'fotos_medicao'];
      const merged = existing.map((poste) => ({ ...poste }));
      const getPosteKey = (poste: any, index: number) => String(poste?.numero ?? poste?.id ?? index);
      const indexByKey = new Map<string, number>();
      merged.forEach((poste, index) => indexByKey.set(getPosteKey(poste, index), index));

      incoming.forEach((poste, index) => {
        const key = getPosteKey(poste, index);
        const existingIndex = indexByKey.get(key);
        if (existingIndex === undefined) {
          indexByKey.set(key, merged.length);
          merged.push({ ...poste });
          return;
        }

        const current = merged[existingIndex];
        const next = { ...current, ...poste };
        for (const field of photoFields) {
          next[field] = mergePhotoArrays(poste?.[field], current?.[field]);
        }
        merged[existingIndex] = next;
      });

      return merged;
    };

    const countBookPhotos = (book: any): number => {
      if (!book || typeof book !== 'object') return 0;
      let count = 0;
      for (const [key, value] of Object.entries(book)) {
        if ((key.startsWith('fotos_') || key.startsWith('doc_')) && Array.isArray(value)) {
          count += value.length;
        }
      }
      if (Array.isArray(book.postes_data)) {
        for (const poste of book.postes_data) {
          count += (poste?.fotos_antes?.length || 0)
            + (poste?.fotos_durante?.length || 0)
            + (poste?.fotos_depois?.length || 0)
            + (poste?.fotos_medicao?.length || 0);
        }
      }
      return count;
    };

    const mergeObraPayloadWithExisting = (payload: any, existing: any): any => {
      const photoArrayFields = [
        'fotos_antes', 'fotos_durante', 'fotos_depois', 'fotos_abertura', 'fotos_fechamento',
        'fotos_ditais_abertura', 'fotos_ditais_impedir', 'fotos_ditais_testar', 'fotos_ditais_aterrar', 'fotos_ditais_sinalizar',
        'fotos_aterramento_vala_aberta', 'fotos_aterramento_hastes', 'fotos_aterramento_vala_fechada', 'fotos_aterramento_medicao',
        'fotos_transformador_laudo', 'fotos_transformador_componente_instalado', 'fotos_transformador_tombamento_instalado',
        'fotos_transformador_tape', 'fotos_transformador_placa_instalado', 'fotos_transformador_instalado',
        'fotos_transformador_antes_retirar', 'fotos_transformador_laudo_retirado', 'fotos_transformador_tombamento_retirado',
        'fotos_transformador_placa_retirado', 'fotos_transformador_conexoes_primarias_instalado',
        'fotos_transformador_conexoes_secundarias_instalado', 'fotos_transformador_conexoes_primarias_retirado',
        'fotos_transformador_conexoes_secundarias_retirado', 'fotos_medidor_padrao', 'fotos_medidor_leitura',
        'fotos_medidor_selo_born', 'fotos_medidor_selo_caixa', 'fotos_medidor_identificador_fase',
        'fotos_checklist_croqui', 'fotos_checklist_panoramica_inicial', 'fotos_checklist_chede',
        'fotos_checklist_aterramento_cerca', 'fotos_checklist_padrao_geral', 'fotos_checklist_padrao_interno',
        'fotos_checklist_frying', 'fotos_checklist_abertura_fechamento_pulo', 'fotos_checklist_panoramica_final',
        'fotos_checklist_postes', 'fotos_checklist_seccionamentos', 'doc_cadastro_medidor', 'doc_laudo_transformador',
        'doc_laudo_regulador', 'doc_laudo_religador', 'doc_apr', 'doc_fvbt', 'doc_termo_desistencia_lpt',
        'doc_autorizacao_passagem', 'doc_materiais_previsto', 'doc_materiais_realizado',
        'fotos_altimetria_lado_fonte', 'fotos_altimetria_medicao_fonte', 'fotos_altimetria_lado_carga',
        'fotos_altimetria_medicao_carga', 'fotos_vazamento_evidencia', 'fotos_vazamento_equipamentos_limpeza',
        'fotos_vazamento_tombamento_retirado', 'fotos_vazamento_placa_retirado', 'fotos_vazamento_tombamento_instalado',
        'fotos_vazamento_placa_instalado', 'fotos_vazamento_instalacao',
      ];

      const merged = { ...payload };
      for (const field of photoArrayFields) {
        merged[field] = mergePhotoArrays(payload?.[field], existing?.[field]);
      }
      merged.postes_data = mergePostesData(payload?.postes_data, existing?.postes_data);
      merged.checklist_postes_data = payload?.checklist_postes_data || existing?.checklist_postes_data || null;
      merged.checklist_seccionamentos_data = payload?.checklist_seccionamentos_data || existing?.checklist_seccionamentos_data || null;
      merged.checklist_aterramentos_cerca_data = payload?.checklist_aterramentos_cerca_data || existing?.checklist_aterramentos_cerca_data || null;
      merged.checklist_hastes_termometros_data = payload?.checklist_hastes_termometros_data || existing?.checklist_hastes_termometros_data || null;
      return merged;
    };

    // Se a obra pendente representa a edição de uma obra já existente no servidor,
    // devemos atualizar (UPDATE) em vez de inserir (INSERT). Detectamos isso quando:
    // 1. `obra.isEdited` é true e há um `originalId`
    // 2. ou quando o id não é um temp_/local_
    // 3. ✅ NOVO: ou quando a obra tem serverId (já foi sincronizada antes)
    const idToUpdate = obra.originalId
      ?? (obra as any).serverId  // ✅ Se tem serverId, usar para UPDATE
      ?? (obra.id && !obra.id.startsWith('temp_') && !obra.id.startsWith('local_') ? obra.id : null);

    // ✅ CORRIGIDO: Fazer UPDATE se tem serverId OU se isEdited
    const shouldUpdate = (obra.isEdited && idToUpdate) || ((obra as any).serverId && idToUpdate);
    const shouldUpdateByEdit = !!(obra.isEdited && idToUpdate);

    logger.sync(`🔍 [syncObra] Decisão de sync:`);
    logger.sync(`   - obra.id: ${obra.id}`);
    logger.sync(`   - obra.serverId: ${(obra as any).serverId || 'undefined'}`);
    logger.sync(`   - obra.isEdited: ${obra.isEdited}`);
    logger.sync(`   - idToUpdate: ${idToUpdate}`);
    logger.sync(`   - shouldUpdate: ${shouldUpdate}`);
    logger.sync(`   - shouldUpdateByEdit: ${shouldUpdateByEdit}`);

    if (shouldUpdate && idToUpdate) {
      logger.sync(`🔁 [syncObra] Atualizando obra existente no servidor: ${idToUpdate}`);

      // Buscar obra existente no servidor
      const { data: existingObra, error: fetchError } = await supabase
        .from('obras')
        .select('*')
        .eq('id', idToUpdate)
        .single();

      if (fetchError) {
        logger.error(`❌ [syncObra] Não foi possível buscar obra ${idToUpdate} para atualização:`, fetchError);

        if (shouldUpdateByEdit) {
          // Em edição explícita, manter comportamento conservador para evitar duplicatas.
          throw new Error(`Não foi possível encontrar obra ${idToUpdate} no servidor para atualização. Verifique se a obra ainda existe.`);
        }

        // Se veio apenas de serverId (possivelmente stale), continua para INSERT.
        logger.warn(`⚠️ [syncObra] serverId ${idToUpdate} inválido/stale. Continuando com INSERT para não sobrescrever book incorreto.`);
      }

      if (existingObra) {
        // ✅ PROTEÇÃO: Nunca sobrescrever outro book (tipo de serviço diferente),
        // mesmo se houver serverId reaproveitado indevidamente.
        const incomingTipoServico = (obra.tipo_servico || '').trim();
        const existingTipoServico = ((existingObra as any).tipo_servico || '').trim();
        if (incomingTipoServico && existingTipoServico && incomingTipoServico !== existingTipoServico) {
          logger.warn(
            `⚠️ [syncObra] Tipo de serviço diferente no ID ${idToUpdate} (servidor="${existingTipoServico}" vs local="${incomingTipoServico}"). Será feito INSERT de novo book.`
          );
        } else {
        // Mescla fotos do retry/offline sem apagar o que já chegou antes.
        const replaceOrKeep = (newData: any[], existingData: any[]) => mergePhotoArrays(newData, existingData);

        const updatePayload: any = {
          data: obra.data ?? existingObra.data,
          obra: obra.obra ?? existingObra.obra,
          responsavel: obra.responsavel ?? existingObra.responsavel,
          equipe: obra.equipe ?? existingObra.equipe,
          tipo_servico: obra.tipo_servico ?? existingObra.tipo_servico,
          status: obra.status ?? existingObra.status, // ✅ Manter status da obra local ou do servidor
          fotos_antes: replaceOrKeep(fotosAntesData, existingObra.fotos_antes),
          fotos_durante: replaceOrKeep(fotosDuranteData, existingObra.fotos_durante),
          fotos_depois: replaceOrKeep(fotosDepoisData, existingObra.fotos_depois),
          fotos_abertura: replaceOrKeep(fotosAberturaData, existingObra.fotos_abertura),
          fotos_fechamento: replaceOrKeep(fotosFechamentoData, existingObra.fotos_fechamento),
          fotos_ditais_abertura: replaceOrKeep(fotosDitaisAberturaData, existingObra.fotos_ditais_abertura),
          fotos_ditais_impedir: replaceOrKeep(fotosDitaisImpedirData, existingObra.fotos_ditais_impedir),
          fotos_ditais_testar: replaceOrKeep(fotosDitaisTestarData, existingObra.fotos_ditais_testar),
          fotos_ditais_aterrar: replaceOrKeep(fotosDitaisAterrarData, existingObra.fotos_ditais_aterrar),
          fotos_ditais_sinalizar: replaceOrKeep(fotosDitaisSinalizarData, existingObra.fotos_ditais_sinalizar),
          fotos_aterramento_vala_aberta: replaceOrKeep(fotosAterramentoValaAbertaData, existingObra.fotos_aterramento_vala_aberta),
          fotos_aterramento_hastes: replaceOrKeep(fotosAterramentoHastesData, existingObra.fotos_aterramento_hastes),
          fotos_aterramento_vala_fechada: replaceOrKeep(fotosAterramentoValaFechadaData, existingObra.fotos_aterramento_vala_fechada),
          fotos_aterramento_medicao: replaceOrKeep(fotosAterramentoMedicaoData, existingObra.fotos_aterramento_medicao),
          transformador_status: obra.transformador_status ?? existingObra.transformador_status,
          fotos_transformador_laudo: replaceOrKeep(fotosTransformadorLaudoData, existingObra.fotos_transformador_laudo),
          fotos_transformador_componente_instalado: replaceOrKeep(fotosTransformadorComponenteInstaladoData, existingObra.fotos_transformador_componente_instalado),
          fotos_transformador_tombamento_instalado: replaceOrKeep(fotosTransformadorTombamentoInstaladoData, existingObra.fotos_transformador_tombamento_instalado),
          fotos_transformador_tape: replaceOrKeep(fotosTransformadorTapeData, existingObra.fotos_transformador_tape),
          fotos_transformador_placa_instalado: replaceOrKeep(fotosTransformadorPlacaInstaladoData, existingObra.fotos_transformador_placa_instalado),
          fotos_transformador_instalado: replaceOrKeep(fotosTransformadorInstaladoData, existingObra.fotos_transformador_instalado),
          fotos_transformador_antes_retirar: replaceOrKeep(fotosTransformadorAntesRetirarData, existingObra.fotos_transformador_antes_retirar),
          fotos_transformador_laudo_retirado: replaceOrKeep(fotosTransformadorLaudoRetiradoData, (existingObra as any).fotos_transformador_laudo_retirado),
          fotos_transformador_tombamento_retirado: replaceOrKeep(fotosTransformadorTombamentoRetiradoData, existingObra.fotos_transformador_tombamento_retirado),
          fotos_transformador_placa_retirado: replaceOrKeep(fotosTransformadorPlacaRetiradoData, existingObra.fotos_transformador_placa_retirado),
          fotos_transformador_conexoes_primarias_instalado: replaceOrKeep(fotosTransformadorConexoesPrimariasInstaladoData, existingObra.fotos_transformador_conexoes_primarias_instalado),
          fotos_transformador_conexoes_secundarias_instalado: replaceOrKeep(fotosTransformadorConexoesSecundariasInstaladoData, existingObra.fotos_transformador_conexoes_secundarias_instalado),
          fotos_transformador_conexoes_primarias_retirado: replaceOrKeep(fotosTransformadorConexoesPrimariasRetiradoData, existingObra.fotos_transformador_conexoes_primarias_retirado),
          fotos_transformador_conexoes_secundarias_retirado: replaceOrKeep(fotosTransformadorConexoesSecundariasRetiradoData, existingObra.fotos_transformador_conexoes_secundarias_retirado),
          fotos_medidor_padrao: replaceOrKeep(fotosMedidorPadraoData, existingObra.fotos_medidor_padrao),
          fotos_medidor_leitura: replaceOrKeep(fotosMedidorLeituraData, existingObra.fotos_medidor_leitura),
          fotos_medidor_selo_born: replaceOrKeep(fotosMedidorSeloBornData, existingObra.fotos_medidor_selo_born),
          fotos_medidor_selo_caixa: replaceOrKeep(fotosMedidorSeloCaixaData, existingObra.fotos_medidor_selo_caixa),
          fotos_medidor_identificador_fase: replaceOrKeep(fotosMedidorIdentificadorFaseData, existingObra.fotos_medidor_identificador_fase),
          fotos_checklist_croqui: replaceOrKeep(fotosChecklistCroquiData, existingObra.fotos_checklist_croqui),
          fotos_checklist_panoramica_inicial: replaceOrKeep(fotosChecklistPanoramicaInicialData, existingObra.fotos_checklist_panoramica_inicial),
          fotos_checklist_chede: replaceOrKeep(fotosChecklistChedeData, existingObra.fotos_checklist_chede),
          fotos_checklist_aterramento_cerca: replaceOrKeep(fotosChecklistAterramentoCercaData, existingObra.fotos_checklist_aterramento_cerca),
          fotos_checklist_padrao_geral: replaceOrKeep(fotosChecklistPadraoGeralData, existingObra.fotos_checklist_padrao_geral),
          fotos_checklist_padrao_interno: replaceOrKeep(fotosChecklistPadraoInternoData, existingObra.fotos_checklist_padrao_interno),
          fotos_checklist_frying: replaceOrKeep(fotosChecklistFryingData, (existingObra as any).fotos_checklist_frying),
          fotos_checklist_abertura_fechamento_pulo: replaceOrKeep(fotosChecklistAberturaFechamentoPuloData, (existingObra as any).fotos_checklist_abertura_fechamento_pulo),
          fotos_checklist_panoramica_final: replaceOrKeep(fotosChecklistPanoramicaFinalData, existingObra.fotos_checklist_panoramica_final),
          fotos_checklist_postes: replaceOrKeep(fotosChecklistPostesData, existingObra.fotos_checklist_postes),
          fotos_checklist_seccionamentos: replaceOrKeep(fotosChecklistSeccionamentosData, existingObra.fotos_checklist_seccionamentos),
          doc_cadastro_medidor: replaceOrKeep(docCadastroMedidorData, existingObra.doc_cadastro_medidor),
          doc_laudo_transformador: replaceOrKeep(docLaudoTransformadorData, existingObra.doc_laudo_transformador),
          doc_laudo_regulador: replaceOrKeep(docLaudoReguladorData, existingObra.doc_laudo_regulador),
          doc_laudo_religador: replaceOrKeep(docLaudoReligadorData, existingObra.doc_laudo_religador),
          doc_apr: replaceOrKeep(docAprData, existingObra.doc_apr),
          doc_fvbt: replaceOrKeep(docFvbtData, existingObra.doc_fvbt),
          doc_termo_desistencia_lpt: replaceOrKeep(docTermoDesistenciaLptData, existingObra.doc_termo_desistencia_lpt),
          doc_autorizacao_passagem: replaceOrKeep(docAutorizacaoPassagemData, existingObra.doc_autorizacao_passagem),
          doc_materiais_previsto: replaceOrKeep(docMateriaisPrevistoData, existingObra.doc_materiais_previsto),
          doc_materiais_realizado: replaceOrKeep(docMateriaisRealizadoData, existingObra.doc_materiais_realizado),
          fotos_altimetria_lado_fonte: replaceOrKeep(fotosAltimetriaLadoFonteData, existingObra.fotos_altimetria_lado_fonte),
          fotos_altimetria_medicao_fonte: replaceOrKeep(fotosAltimetriaMedicaoFonteData, existingObra.fotos_altimetria_medicao_fonte),
          fotos_altimetria_lado_carga: replaceOrKeep(fotosAltimetriaLadoCargaData, existingObra.fotos_altimetria_lado_carga),
          fotos_altimetria_medicao_carga: replaceOrKeep(fotosAltimetriaMedicaoCargaData, existingObra.fotos_altimetria_medicao_carga),
          fotos_vazamento_evidencia: replaceOrKeep(fotosVazamentoEvidenciaData, existingObra.fotos_vazamento_evidencia),
          fotos_vazamento_equipamentos_limpeza: replaceOrKeep(fotosVazamentoEquipamentosLimpezaData, existingObra.fotos_vazamento_equipamentos_limpeza),
          fotos_vazamento_tombamento_retirado: replaceOrKeep(fotosVazamentoTombamentoRetiradoData, existingObra.fotos_vazamento_tombamento_retirado),
          fotos_vazamento_placa_retirado: replaceOrKeep(fotosVazamentoPlacaRetiradoData, existingObra.fotos_vazamento_placa_retirado),
          fotos_vazamento_tombamento_instalado: replaceOrKeep(fotosVazamentoTombamentoInstaladoData, existingObra.fotos_vazamento_tombamento_instalado),
          fotos_vazamento_placa_instalado: replaceOrKeep(fotosVazamentoPlacaInstaladoData, existingObra.fotos_vazamento_placa_instalado),
          fotos_vazamento_instalacao: replaceOrKeep(fotosVazamentoInstalacaoData, existingObra.fotos_vazamento_instalacao),
          // Cava em Rocha - Dados dos postes
          postes_data: mergePostesData(postesDataConverted, existingObra.postes_data),
          observacoes: (obra as any).observacoes || existingObra.observacoes || null,
          creator_role: (obra as any).creator_role || existingObra.creator_role || null,
          created_by_admin: (obra as any).created_by_admin || existingObra.created_by_admin || null,
          // Dados estruturados do Checklist de Fiscalização - com fotos convertidas para URLs
          checklist_postes_data: checklistPostesDataConverted || existingObra.checklist_postes_data || null,
          checklist_seccionamentos_data: checklistSeccionamentosDataConverted || existingObra.checklist_seccionamentos_data || null,
          checklist_aterramentos_cerca_data: checklistAterramentosDataConverted || existingObra.checklist_aterramentos_cerca_data || null,
          checklist_hastes_termometros_data: checklistHastesTermometrosDataConverted || existingObra.checklist_hastes_termometros_data || null,
        };

        // Executar update
        const { error: updateError } = await supabase
          .from('obras')
          .update(sanitizeObrasPayload(updatePayload))
          .eq('id', idToUpdate);

        if (updateError) {
          throw updateError;
        }

        logger.sync(`✅ Obra ${idToUpdate} atualizada no servidor via sync.`);

        // Remover da fila
        try {
          const { remapServicosObraId } = await import('./servico-sync');
          await remapServicosObraId(obra.id, idToUpdate);
        } catch (servicoRemapError) {
          logger.error('Erro ao remapear serviços da obra (não crítico):', servicoRemapError);
        }

        await removePendingObra(obra.id);
        return { success: true, newId: idToUpdate };
        }
      }

      // Se não encontrou obra válida para update, segue fluxo de INSERT.
      if (!fetchError) {
        logger.warn(`⚠️ [syncObra] Obra ${idToUpdate} não encontrada para update. Continuando com INSERT.`);
      }
    }

    // O mesmo book operacional é obra+equipe+tipo. created_at muda em retries/criações offline
    // e não pode ser usado como chave, senão duplica no servidor.
    logger.sync(`🔍 [syncObra] Verificando book existente: obra=${obra.obra}, equipe=${obra.equipe}, tipo=${obra.tipo_servico}`);

    let existingSameBook: any | null = null;
    const checkResponse = await supabase
      .from('obras')
      .select('*')
      .eq('obra', obra.obra)
      .eq('equipe', obra.equipe)
      .eq('tipo_servico', obra.tipo_servico)
      .order('created_at', { ascending: false })
      .limit(10);

    const checkError: any = checkResponse.error;
    if (!checkError && Array.isArray(checkResponse.data) && checkResponse.data.length > 0) {
      existingSameBook = [...checkResponse.data].sort((a, b) => countBookPhotos(b) - countBookPhotos(a))[0];
    }

    if (checkError) {
      logger.error(`⚠️ [syncObra] Erro ao verificar duplicata:`, checkError);
      // Continua com INSERT se não conseguiu verificar
    }

    if (existingSameBook) {
      // ✅ ENCONTROU O MESMO BOOK: fazer UPDATE para evitar duplicação do mesmo registro.
      logger.sync(`⚠️ [syncObra] Book já existe no servidor (ID: ${existingSameBook.id}). Fazendo UPDATE com merge de fotos.`);

      const duplicateUpdatePayload = mergeObraPayloadWithExisting({
          data: obra.data,
          responsavel: obra.responsavel,
          tipo_servico: obra.tipo_servico,
          status: obra.status || 'em_aberto',
          fotos_antes: fotosAntesData,
          fotos_durante: fotosDuranteData,
          fotos_depois: fotosDepoisData,
          fotos_abertura: fotosAberturaData,
          fotos_fechamento: fotosFechamentoData,
          fotos_ditais_abertura: fotosDitaisAberturaData,
          fotos_ditais_impedir: fotosDitaisImpedirData,
          fotos_ditais_testar: fotosDitaisTestarData,
          fotos_ditais_aterrar: fotosDitaisAterrarData,
          fotos_ditais_sinalizar: fotosDitaisSinalizarData,
          fotos_aterramento_vala_aberta: fotosAterramentoValaAbertaData,
          fotos_aterramento_hastes: fotosAterramentoHastesData,
          fotos_aterramento_vala_fechada: fotosAterramentoValaFechadaData,
          fotos_aterramento_medicao: fotosAterramentoMedicaoData,
          transformador_status: obra.transformador_status,
          fotos_transformador_laudo: fotosTransformadorLaudoData,
          fotos_transformador_componente_instalado: fotosTransformadorComponenteInstaladoData,
          fotos_transformador_tombamento_instalado: fotosTransformadorTombamentoInstaladoData,
          fotos_transformador_tape: fotosTransformadorTapeData,
          fotos_transformador_placa_instalado: fotosTransformadorPlacaInstaladoData,
          fotos_transformador_instalado: fotosTransformadorInstaladoData,
          fotos_transformador_antes_retirar: fotosTransformadorAntesRetirarData,
          fotos_transformador_laudo_retirado: fotosTransformadorLaudoRetiradoData,
          fotos_transformador_tombamento_retirado: fotosTransformadorTombamentoRetiradoData,
          fotos_transformador_placa_retirado: fotosTransformadorPlacaRetiradoData,
          fotos_transformador_conexoes_primarias_instalado: fotosTransformadorConexoesPrimariasInstaladoData,
          fotos_transformador_conexoes_secundarias_instalado: fotosTransformadorConexoesSecundariasInstaladoData,
          fotos_transformador_conexoes_primarias_retirado: fotosTransformadorConexoesPrimariasRetiradoData,
          fotos_transformador_conexoes_secundarias_retirado: fotosTransformadorConexoesSecundariasRetiradoData,
          fotos_medidor_padrao: fotosMedidorPadraoData,
          fotos_medidor_leitura: fotosMedidorLeituraData,
          fotos_medidor_selo_born: fotosMedidorSeloBornData,
          fotos_medidor_selo_caixa: fotosMedidorSeloCaixaData,
          fotos_medidor_identificador_fase: fotosMedidorIdentificadorFaseData,
          fotos_checklist_croqui: fotosChecklistCroquiData,
          fotos_checklist_panoramica_inicial: fotosChecklistPanoramicaInicialData,
          fotos_checklist_chede: fotosChecklistChedeData,
          fotos_checklist_aterramento_cerca: fotosChecklistAterramentoCercaData,
          fotos_checklist_padrao_geral: fotosChecklistPadraoGeralData,
          fotos_checklist_padrao_interno: fotosChecklistPadraoInternoData,
          fotos_checklist_frying: fotosChecklistFryingData,
          fotos_checklist_abertura_fechamento_pulo: fotosChecklistAberturaFechamentoPuloData,
          fotos_checklist_panoramica_final: fotosChecklistPanoramicaFinalData,
          fotos_checklist_postes: fotosChecklistPostesData,
          fotos_checklist_seccionamentos: fotosChecklistSeccionamentosData,
          doc_cadastro_medidor: docCadastroMedidorData,
          doc_laudo_transformador: docLaudoTransformadorData,
          doc_laudo_regulador: docLaudoReguladorData,
          doc_laudo_religador: docLaudoReligadorData,
          doc_apr: docAprData,
          doc_fvbt: docFvbtData,
          doc_termo_desistencia_lpt: docTermoDesistenciaLptData,
          doc_autorizacao_passagem: docAutorizacaoPassagemData,
          doc_materiais_previsto: docMateriaisPrevistoData,
          doc_materiais_realizado: docMateriaisRealizadoData,
          fotos_altimetria_lado_fonte: fotosAltimetriaLadoFonteData,
          fotos_altimetria_medicao_fonte: fotosAltimetriaMedicaoFonteData,
          fotos_altimetria_lado_carga: fotosAltimetriaLadoCargaData,
          fotos_altimetria_medicao_carga: fotosAltimetriaMedicaoCargaData,
          fotos_vazamento_evidencia: fotosVazamentoEvidenciaData,
          fotos_vazamento_equipamentos_limpeza: fotosVazamentoEquipamentosLimpezaData,
          fotos_vazamento_tombamento_retirado: fotosVazamentoTombamentoRetiradoData,
          fotos_vazamento_placa_retirado: fotosVazamentoPlacaRetiradoData,
          fotos_vazamento_tombamento_instalado: fotosVazamentoTombamentoInstaladoData,
          fotos_vazamento_placa_instalado: fotosVazamentoPlacaInstaladoData,
          fotos_vazamento_instalacao: fotosVazamentoInstalacaoData,
          postes_data: postesDataConverted ?? null,
          observacoes: (obra as any).observacoes || null,
          creator_role: (obra as any).creator_role || null,
          created_by_admin: (obra as any).created_by_admin || null,
          // Dados estruturados do Checklist de Fiscalização - com fotos convertidas para URLs
          checklist_postes_data: checklistPostesDataConverted || null,
          checklist_seccionamentos_data: checklistSeccionamentosDataConverted || null,
          checklist_aterramentos_cerca_data: checklistAterramentosDataConverted || null,
          checklist_hastes_termometros_data: checklistHastesTermometrosDataConverted || null,
        },
        existingSameBook
      );

      const { error: updateError } = await supabase
        .from('obras')
        .update(sanitizeObrasPayload(duplicateUpdatePayload))
        .eq('id', existingSameBook.id);

      if (updateError) {
        throw updateError;
      }

      logger.sync(`✅ [syncObra] Book atualizado via detecção de duplicata exata: ${existingSameBook.id}`);

      // Atualizar fotos com o ID correto do servidor
      try {
        await updatePhotosObraId(obra.id, existingSameBook.id);
      } catch (photoError) {
        logger.error('Erro ao atualizar obraId das fotos (não crítico):', photoError);
      }

      try {
        const { remapServicosObraId } = await import('./servico-sync');
        await remapServicosObraId(obra.id, existingSameBook.id);
      } catch (servicoRemapError) {
        logger.error('Erro ao atualizar obraId dos serviços (não crítico):', servicoRemapError);
      }

      // Atualizar serverId na obra local para evitar futuras duplicações
      try {
        const localObras = await getLocalObras();
        const localObraIndex = localObras.findIndex(o => o.id === obra.id);
        if (localObraIndex !== -1) {
          localObras[localObraIndex].serverId = existingSameBook.id;
          await writeObrasRaw(localObras);
          logger.sync(`✅ [syncObra] serverId atualizado na obra local: ${existingSameBook.id}`);
        }
      } catch (localUpdateError) {
        logger.error('Erro ao atualizar serverId local (não crítico):', localUpdateError);
      }

      await removePendingObra(obra.id);
      return { success: true, newId: existingSameBook.id };
    }

    // Se não existe duplicata, inserir nova obra no servidor
    const { data: insertedObra, error } = await supabase
      .from('obras')
      .insert([
        sanitizeObrasPayload({
          data: obra.data,
          obra: obra.obra,
          responsavel: obra.responsavel,
          equipe: obra.equipe,
          tipo_servico: obra.tipo_servico,
          status: obra.status || 'em_aberto', // ✅ Usar status da obra, ou 'em_aberto' como fallback
          fotos_antes: fotosAntesData,
          fotos_durante: fotosDuranteData,
          fotos_depois: fotosDepoisData,
          fotos_abertura: fotosAberturaData,
          fotos_fechamento: fotosFechamentoData,
          fotos_ditais_abertura: fotosDitaisAberturaData,
          fotos_ditais_impedir: fotosDitaisImpedirData,
          fotos_ditais_testar: fotosDitaisTestarData,
          fotos_ditais_aterrar: fotosDitaisAterrarData,
          fotos_ditais_sinalizar: fotosDitaisSinalizarData,
          fotos_aterramento_vala_aberta: fotosAterramentoValaAbertaData,
          fotos_aterramento_hastes: fotosAterramentoHastesData,
          fotos_aterramento_vala_fechada: fotosAterramentoValaFechadaData,
          fotos_aterramento_medicao: fotosAterramentoMedicaoData,
          transformador_status: obra.transformador_status,
          fotos_transformador_laudo: fotosTransformadorLaudoData,
          fotos_transformador_componente_instalado: fotosTransformadorComponenteInstaladoData,
          fotos_transformador_tombamento_instalado: fotosTransformadorTombamentoInstaladoData,
          fotos_transformador_tape: fotosTransformadorTapeData,
          fotos_transformador_placa_instalado: fotosTransformadorPlacaInstaladoData,
          fotos_transformador_instalado: fotosTransformadorInstaladoData,
          fotos_transformador_antes_retirar: fotosTransformadorAntesRetirarData,
          fotos_transformador_laudo_retirado: fotosTransformadorLaudoRetiradoData,
          fotos_transformador_tombamento_retirado: fotosTransformadorTombamentoRetiradoData,
          fotos_transformador_placa_retirado: fotosTransformadorPlacaRetiradoData,
          fotos_transformador_conexoes_primarias_instalado: fotosTransformadorConexoesPrimariasInstaladoData,
          fotos_transformador_conexoes_secundarias_instalado: fotosTransformadorConexoesSecundariasInstaladoData,
          fotos_transformador_conexoes_primarias_retirado: fotosTransformadorConexoesPrimariasRetiradoData,
          fotos_transformador_conexoes_secundarias_retirado: fotosTransformadorConexoesSecundariasRetiradoData,
          fotos_medidor_padrao: fotosMedidorPadraoData,
          fotos_medidor_leitura: fotosMedidorLeituraData,
          fotos_medidor_selo_born: fotosMedidorSeloBornData,
          fotos_medidor_selo_caixa: fotosMedidorSeloCaixaData,
          fotos_medidor_identificador_fase: fotosMedidorIdentificadorFaseData,
          fotos_checklist_croqui: fotosChecklistCroquiData,
          fotos_checklist_panoramica_inicial: fotosChecklistPanoramicaInicialData,
          fotos_checklist_chede: fotosChecklistChedeData,
          fotos_checklist_aterramento_cerca: fotosChecklistAterramentoCercaData,
          fotos_checklist_padrao_geral: fotosChecklistPadraoGeralData,
          fotos_checklist_padrao_interno: fotosChecklistPadraoInternoData,
          fotos_checklist_frying: fotosChecklistFryingData,
          fotos_checklist_abertura_fechamento_pulo: fotosChecklistAberturaFechamentoPuloData,
          fotos_checklist_panoramica_final: fotosChecklistPanoramicaFinalData,
          fotos_checklist_postes: fotosChecklistPostesData,
          fotos_checklist_seccionamentos: fotosChecklistSeccionamentosData,
          doc_cadastro_medidor: docCadastroMedidorData,
          doc_laudo_transformador: docLaudoTransformadorData,
          doc_laudo_regulador: docLaudoReguladorData,
          doc_laudo_religador: docLaudoReligadorData,
          doc_apr: docAprData,
          doc_fvbt: docFvbtData,
          doc_termo_desistencia_lpt: docTermoDesistenciaLptData,
          doc_autorizacao_passagem: docAutorizacaoPassagemData,
          doc_materiais_previsto: docMateriaisPrevistoData,
          doc_materiais_realizado: docMateriaisRealizadoData,
          fotos_altimetria_lado_fonte: fotosAltimetriaLadoFonteData,
          fotos_altimetria_medicao_fonte: fotosAltimetriaMedicaoFonteData,
          fotos_altimetria_lado_carga: fotosAltimetriaLadoCargaData,
          fotos_altimetria_medicao_carga: fotosAltimetriaMedicaoCargaData,
          fotos_vazamento_evidencia: fotosVazamentoEvidenciaData,
          fotos_vazamento_equipamentos_limpeza: fotosVazamentoEquipamentosLimpezaData,
          fotos_vazamento_tombamento_retirado: fotosVazamentoTombamentoRetiradoData,
          fotos_vazamento_placa_retirado: fotosVazamentoPlacaRetiradoData,
          fotos_vazamento_tombamento_instalado: fotosVazamentoTombamentoInstaladoData,
          fotos_vazamento_placa_instalado: fotosVazamentoPlacaInstaladoData,
          fotos_vazamento_instalacao: fotosVazamentoInstalacaoData,
          // Cava em Rocha - Dados dos postes
          postes_data: postesDataConverted ?? null,
          observacoes: (obra as any).observacoes || null,
          creator_role: (obra as any).creator_role || null,
          created_by_admin: (obra as any).created_by_admin || null,
          // Dados estruturados do Checklist de Fiscalização - com fotos convertidas para URLs
          checklist_postes_data: checklistPostesDataConverted || null,
          checklist_seccionamentos_data: checklistSeccionamentosDataConverted || null,
          checklist_aterramentos_cerca_data: checklistAterramentosDataConverted || null,
          checklist_hastes_termometros_data: checklistHastesTermometrosDataConverted || null,
          // user_id removido - Login por equipe não usa Supabase Auth
          created_at: obra.created_at || new Date().toISOString(),
        }),
      ])
      .select('id')
      .single();

    if (error) {
      throw error;
    }

    let finalObraId = obra.id; // Pode ser temp_ ou UUID

    if (insertedObra && insertedObra.id) {
      finalObraId = insertedObra.id; // ✅ Novo ID do Supabase
      try {
        const updatedCount = await updatePhotosObraId(obra.id, insertedObra.id);
        logger.sync(`✅ ${updatedCount} foto(s) atualizadas com novo obraId: ${insertedObra.id}`);
      } catch (photoUpdateError) {
        logger.error('Erro ao atualizar obraId das fotos (não crítico):', photoUpdateError);
        // Não propaga erro - sincronização foi bem sucedida
      }

      try {
        const { remapServicosObraId } = await import('./servico-sync');
        const remapped = await remapServicosObraId(obra.id, insertedObra.id);
        if (remapped > 0) {
          logger.sync(`✅ ${remapped} serviço(s) remapeado(s) para obra ${insertedObra.id}`);
        }
      } catch (servicoRemapError) {
        logger.error('Erro ao atualizar obraId dos serviços (não crítico):', servicoRemapError);
      }
    }

    // Remover da fila
    await removePendingObra(obra.id);
    return { success: true, newId: finalObraId };

  } catch (error: any) {
    const errorMessage: string = error?.message || '';
    const isNetworkError = /network request failed|failed to fetch|timeout|sem conexão/i.test(errorMessage);

    if (isNetworkError) {
      // Falha de rede temporária: manter como 'pending' para tentar novamente quando voltar online
      logger.warn(`⚠️ [syncObra] Falha de rede ao sincronizar obra ${obra.obra} - mantendo como pendente para retry`);
      await updatePendingObraStatus(obra.id, 'pending', undefined, obra.sync_attempts);
      return { success: false };
    }

    logger.error('Erro ao sincronizar obra:', error);
    const friendlyMessage = translateErrorMessage(errorMessage);

    // Incrementar contador de tentativas falhadas
    const syncAttempts = (obra.sync_attempts || 0) + 1;
    await updatePendingObraStatus(obra.id, 'failed', friendlyMessage, syncAttempts);

    // 🚨 BACKUP DE EMERGÊNCIA: Criar backup se falhou 3+ vezes
    if (shouldCreateEmergencyBackup(syncAttempts)) {
      try {
        logger.sync(`🚨 Criando backup de emergência após ${syncAttempts} tentativas falhadas...`);

        const backup = await createEmergencyBackup(obra.id, obra, 'sync_failed');

        logger.sync(`✅ Backup de emergência criado: ${backup.id}`);
        logger.sync(`   📁 Pasta: ${backup.folderPath}`);
        logger.sync(`   📸 Fotos: ${backup.totalPhotos}`);

        // Avisar usuário (não bloquear por isso)
        Alert.alert(
          '🆘 Backup de Emergência Criado',
          `A obra ${obra.obra} falhou ao sincronizar ${syncAttempts} vezes.\n\n` +
          `✅ Um backup de emergência foi criado com ${backup.totalPhotos} foto(s).\n\n` +
          `Seus dados estão protegidos! Continue usando o app normalmente e tentaremos sincronizar novamente.`,
          [{ text: 'OK' }]
        );

      } catch (backupError) {
        logger.error('❌ Erro ao criar backup de emergência:', backupError);

        // Capturar erro no Sentry
        captureError(backupError as Error, {
          type: 'storage',
          obraId: obra.id,
          metadata: {
            operation: 'createEmergencyBackup',
            syncAttempts,
            originalError: error?.message,
          },
        });
      }
    }

    // Capturar erro original no Sentry
    captureError(error, {
      type: 'sync',
      obraId: obra.id,
      metadata: {
        obraNumero: obra.obra,
        operation: 'syncObra',
        syncAttempts,
      },
    });

    return { success: false };
  }
};

/**
 * Sincroniza todas as obras pendentes (inclui @obras_pending_sync E @obras_local)
 */
export const syncAllPendingObras = async (): Promise<{ success: number; failed: number }> => {
  if (syncInProgress) {
    return { success: 0, failed: 0 };
  }

  syncInProgress = true;

  try {
    const isOnline = await checkInternetConnection();

    if (!isOnline) {
      logger.sync('📵 [syncAllPendingObras] Sem conexão, abortando');
      return { success: 0, failed: 0 };
    }

    let success = 0;
    let failed = 0;

    // 1. Sincronizar obras de @obras_pending_sync
    const pendingObras = await getPendingObras();
    const obrasToSync = pendingObras.filter(o => o.sync_status === 'pending' || o.sync_status === 'failed');
    logger.sync(`📊 [syncAllPendingObras] Obras em pending_sync: ${obrasToSync.length}`);

    for (const obra of obrasToSync) {
      const result = await syncObra(obra);
      if (result.success) {
        success++;
      } else {
        failed++;
      }
    }

    // 2. Sincronizar obras de @obras_local que não foram sincronizadas
    const localObras = await getLocalObras();
    const pendingPhotos = await getPendingPhotos();

    const localObrasToSync = localObras.filter(o => {
      // Skip se já foi sincronizada e não tem modificações locais
      if (o.synced && !o.locallyModified && o.sync_status !== 'failed') {
        return false;
      }

      // Include se tem modificações locais
      if (o.locallyModified) {
        return true;
      }

      // Include se não foi sincronizada ainda
      if (!o.synced && !o.serverId) {
        return true;
      }

      // Include apenas se tem FOTOS PENDENTES e NÃO foi sincronizada recentemente
      if (hasPendingPhotosForObra(o, pendingPhotos)) {
        // Só re-sincroniza se foi marcada como 'partial' ou 'failed'
        return o.sync_status === 'partial' || o.sync_status === 'failed';
      }

      return false;
    });

    logger.sync(`📊 [syncAllPendingObras] Obras locais não sincronizadas: ${localObrasToSync.length}`);

    for (const localObra of localObrasToSync) {
      try {
        // Pular obras que já estão sendo sincronizadas
        if (localObra.sync_status === 'syncing') {
          continue;
        }

        const result = await syncObra(localObra);
        if (result.success) {
          success++;
          logger.sync(`✅ [syncAllPendingObras] Obra local sincronizada: ${localObra.obra}`);
        } else {
          failed++;
        }
      } catch (error) {
        logger.error(`❌ [syncAllPendingObras] Erro ao sincronizar obra local ${localObra.id}:`, error);

        // 🔍 Capturar erro no Sentry
        captureError(error as Error, {
          type: 'sync',
          obraId: localObra.id,
          metadata: {
            obraNumero: localObra.obra,
            operation: 'syncLocalObra',
          },
        });

        failed++;
      }
    }

    // 🧹 LIMPEZA AUTOMÁTICA: Limpar cache após sincronização bem-sucedida
    if (success > 0) {
      try {
        logger.sync('🧹 Iniciando limpeza automática de cache após sincronização...');
        const { cleanupUploadedPhotos } = await import('./photo-backup');
        const deletedCount = await cleanupUploadedPhotos();
        logger.sync(`✅ Cache limpo automaticamente: ${deletedCount} foto(s) removida(s)`);
      } catch (error) {
        logger.warn('⚠️ Erro ao limpar cache automaticamente (não crítico):', error);
      }
    }

    logger.sync(`📊 [syncAllPendingObras] Resultado: ${success} sucesso, ${failed} falhas`);
    return { success, failed };
  } finally {
    syncInProgress = false;
  }
};

/**
 * Callback de progresso para sincronização com detalhes em tempo real
 */
export interface SyncProgressCallback {
  (progress: {
    currentObraIndex: number;
    totalObras: number;
    currentObraName: string;
    photoProgress: {
      completed: number;
      total: number;
    };
    status: 'syncing' | 'completed' | 'error';
  }): void;
}

/**
 * Token para cancelar sincronização em andamento
 */
export interface CancellationToken {
  cancelled: boolean;
}

/**
 * Sincroniza todas as obras pendentes com suporte a progresso detalhado e cancelamento
 * @param onProgress - Callback chamado a cada atualização de progresso
 * @param cancellationToken - Token para cancelar a sincronização
 * @returns Resultado com contadores e lista de erros
 */
export const syncAllPendingObrasWithProgress = async (
  onProgress?: SyncProgressCallback,
  cancellationToken?: CancellationToken
): Promise<{
  success: number;
  failed: number;
  errors: Array<{ obraName: string; error: string }>;
}> => {
  if (syncInProgress) {
    return { success: 0, failed: 0, errors: [] };
  }

  syncInProgress = true;

  try {
    const isOnline = await checkInternetConnection();

    if (!isOnline) {
      logger.sync('📵 [syncAllPendingObrasWithProgress] Sem conexão, abortando');
      return { success: 0, failed: 0, errors: [] };
    }

    let success = 0;
    let failed = 0;
    const errors: Array<{ obraName: string; error: string }> = [];

    // 1. Obter todas as obras pendentes
    const pendingObras = await getPendingObras();
    const obrasToSyncPending = pendingObras.filter(
      o => o.sync_status === 'pending' || o.sync_status === 'failed'
    );

    const localObras = await getLocalObras();
    const pendingPhotos = await getPendingPhotos();
    const obrasToSyncLocal = localObras.filter(
      o => (!o.synced || hasPendingPhotosForObra(o, pendingPhotos)) && o.sync_status !== 'syncing'
    );

    // Combinar todas as obras que precisam sincronizar
    const allObrasToSync = [
      ...obrasToSyncPending,
      ...obrasToSyncLocal.map(o => ({
        ...o,
        sync_status: 'pending' as const,
        photos_uploaded: false,
      }))
    ];

    const totalObras = allObrasToSync.length;
    logger.sync(`📊 [syncAllPendingObrasWithProgress] Total de obras para sincronizar: ${totalObras}`);

    // 2. Loop através de cada obra
    for (let i = 0; i < allObrasToSync.length; i++) {
      // Verificar se foi cancelado
      if (cancellationToken?.cancelled) {
        logger.sync('⏸️ [syncAllPendingObrasWithProgress] Sincronização cancelada pelo usuário');
        break;
      }

      const obra = allObrasToSync[i];
      const isLocalObra = obrasToSyncLocal.some(o => o.id === obra.id);

      try {
        logger.sync(`🔄 [syncAllPendingObrasWithProgress] Sincronizando obra ${i + 1}/${totalObras}: ${obra.obra}`);

        // Sincronizar obra com callback de progresso de fotos
        const progressHandler = (photoProgress: UploadProgress) => {
          // Notificar progresso ao callback principal
          onProgress?.({
            currentObraIndex: i,
            totalObras,
            currentObraName: obra.obra,
            photoProgress: {
              completed: photoProgress.completed,
              total: photoProgress.total,
            },
            status: 'syncing',
          });
        };

        const result = isLocalObra
          ? { success: await syncLocalObra(obra.id, progressHandler) }
          : await syncObra(obra, progressHandler);

        if (result.success) {
          success++;
          logger.sync(`✅ [syncAllPendingObrasWithProgress] Obra ${obra.obra} sincronizada com sucesso`);
        } else {
          failed++;
          errors.push({
            obraName: obra.obra,
            error: obra.error_message || 'Erro desconhecido ao sincronizar',
          });
          logger.error(`❌ [syncAllPendingObrasWithProgress] Falha ao sincronizar obra ${obra.obra}`);
        }
      } catch (error) {
        failed++;
        const errorMessage = error instanceof Error ? error.message : 'Erro desconhecido';
        errors.push({
          obraName: obra.obra,
          error: translateErrorMessage(errorMessage),
        });
        logger.error(`❌ [syncAllPendingObrasWithProgress] Exceção ao sincronizar obra ${obra.obra}:`, error);
      }
    }

    // 🧹 Limpeza automática de cache após sincronização bem-sucedida
    if (success > 0) {
      try {
        logger.sync('🧹 Iniciando limpeza automática de cache após sincronização...');
        const { cleanupUploadedPhotos } = await import('./photo-backup');
        const deletedCount = await cleanupUploadedPhotos();
        logger.sync(`✅ Cache limpo automaticamente: ${deletedCount} foto(s) removida(s)`);
      } catch (error) {
        logger.warn('⚠️ Erro ao limpar cache automaticamente (não crítico):', error);
      }
    }

    // Notificar conclusão
    if (onProgress && !cancellationToken?.cancelled) {
      onProgress({
        currentObraIndex: totalObras,
        totalObras,
        currentObraName: '',
        photoProgress: { completed: 0, total: 0 },
        status: 'completed',
      });
    }

    logger.sync(`📊 [syncAllPendingObrasWithProgress] Resultado: ${success} sucesso, ${failed} falhas`);
    return { success, failed, errors };
  } finally {
    syncInProgress = false;
  }
};

/**
 * Obtém o status de sincronização
 */
export const getSyncStatus = async (): Promise<SyncStatus> => {
  try {
    const data = await AsyncStorage.getItem(SYNC_STATUS_KEY);
    if (data) {
      return JSON.parse(data);
    }
    return {
      lastSyncAt: null,
      pendingCount: 0,
      failedCount: 0,
    };
  } catch (error) {
    logger.error('Erro ao obter status de sincronização:', error);
    return {
      lastSyncAt: null,
      pendingCount: 0,
      failedCount: 0,
    };
  }
};

/**
 * Atualiza o status de sincronização
 */
export const updateSyncStatus = async (): Promise<void> => {
  try {
    const pendingObras = await getPendingObras();
    const status: SyncStatus = {
      lastSyncAt: new Date().toISOString(),
      pendingCount: pendingObras.filter(o => o.sync_status === 'pending').length,
      failedCount: pendingObras.filter(o => o.sync_status === 'failed').length,
    };
    await AsyncStorage.setItem(SYNC_STATUS_KEY, JSON.stringify(status));
  } catch (error) {
    logger.error('Erro ao atualizar status de sincronização:', error);
  }
};

/**
 * Inicia um listener de conectividade para sincronização automática
 */
export const startAutoSync = (onSyncComplete?: (result: { success: number; failed: number }) => void) => {
  return NetInfo.addEventListener(state => {
    if (state.isConnected === true && state.isInternetReachable !== false) {
      // Debounce global: cancela timers anteriores e reagenda (previne múltiplos
      // listeners de screens diferentes disparando syncs simultâneos)
      if (autoSyncDebounceTimer !== null) {
        clearTimeout(autoSyncDebounceTimer);
      }
      autoSyncDebounceTimer = setTimeout(async () => {
        autoSyncDebounceTimer = null;
        // Poda diária da chave archived (fire-and-forget, nunca bloqueia o sync)
        pruneArchivedPhotoMetadata().catch(() => {});
        const result = await syncAllPendingObras();
        // Após obras, sincronizar serviços pendentes (tabela servicos)
        try {
          const { syncAllPendingServicos } = await import('./servico-sync');
          await syncAllPendingServicos();
        } catch (servicoSyncErr) {
          logger.warn('[startAutoSync] Erro ao sincronizar serviços:', servicoSyncErr);
        }
        if (result.success > 0 || result.failed > 0) {
          onSyncComplete?.(result);
        }
      }, 3000); // 3 segundos para estabilidade da rede
    }
  });
};

/**
 * Recupera fotos perdidas de obras que sumiram após sincronização
 * Reconstrói os arrays de photoIds baseado no photo-backup
 */
export const recoverLostPhotos = async (): Promise<{ recovered: number; obras: string[] }> => {
  try {
    logger.sync('🔧 Iniciando recuperação de fotos perdidas...');

    // 1. Buscar todas as fotos do backup
    const allPhotos = await getAllPhotoMetadata();
    logger.sync(`📸 Total de fotos no backup: ${allPhotos.length}`);

    // 2. Agrupar fotos por obraId
    const photosByObra = new Map<string, PhotoMetadata[]>();
    allPhotos.forEach(photo => {
      if (!photosByObra.has(photo.obraId)) {
        photosByObra.set(photo.obraId, []);
      }
      photosByObra.get(photo.obraId)!.push(photo);
    });

    logger.sync(`🏗️ Obras com fotos no backup: ${photosByObra.size}`);

    // 3. Buscar todas as obras locais
    const localObras = await getLocalObras();
    logger.sync(`📋 Obras locais: ${localObras.length}`);

    let recoveredCount = 0;
    const recoveredObras: string[] = [];

    // 4. Para cada obra, verificar se tem fotos perdidas
    for (const obra of localObras) {
      const photosForObra = photosByObra.get(obra.id) || [];

      if (photosForObra.length === 0) continue;

      // Reconstruir arrays de photoIds por tipo
      const photoIdsByType: Record<string, string[]> = {};

      photosForObra.forEach(photo => {
        // Se o tipo já começa com 'doc_', não adicionar 'fotos_'
        const typeKey = photo.type.startsWith('doc_') ? photo.type : `fotos_${photo.type}`;
        if (!photoIdsByType[typeKey]) {
          photoIdsByType[typeKey] = [];
        }
        photoIdsByType[typeKey].push(photo.id);
      });

      // Verificar se algum campo está vazio mas tem fotos no backup
      let hasLostPhotos = false;
      const updates: any = {};

      Object.entries(photoIdsByType).forEach(([typeKey, photoIds]) => {
        const currentValue = (obra as any)[typeKey];

        // Se o campo está vazio ou undefined mas temos fotos no backup
        if ((!currentValue || currentValue.length === 0) && photoIds.length > 0) {
          hasLostPhotos = true;
          updates[typeKey] = photoIds;
          logger.sync(`  ✅ Recuperando ${photoIds.length} foto(s) de ${typeKey} para obra ${obra.obra || obra.id}`);
        }
      });

      // Se encontrou fotos perdidas, atualizar a obra
      if (hasLostPhotos) {
        const updatedObra = { ...obra, ...updates };
        await saveObraLocal(updatedObra, obra.id);
        recoveredCount++;
        recoveredObras.push(obra.obra || obra.id);
        logger.sync(`✅ Obra ${obra.obra || obra.id} recuperada com sucesso!`);
      }
    }

    logger.sync(`🎉 Recuperação concluída: ${recoveredCount} obra(s) recuperada(s)`);
    return { recovered: recoveredCount, obras: recoveredObras };

  } catch (error) {
    logger.error('❌ Erro ao recuperar fotos perdidas:', error);
    throw error;
  }
};

/**
 * Remove obras duplicadas do AsyncStorage local
 * Mantém apenas uma obra por BOOK, priorizando:
 * 1. Obras com serverId (já sincronizadas)
 * 2. Obras mais recentes (last_modified)
 */
export const removeDuplicateObras = async (): Promise<{ removed: number; kept: number }> => {
  try {
    logger.sync('🧹 Iniciando limpeza de obras duplicadas...');

    // Buscar todas as obras locais
    const localObras = await getLocalObras();
    logger.sync(`📊 Total de obras no AsyncStorage: ${localObras.length}`);

    // Agrupar por chave de book (não apenas número da obra),
    // para permitir vários books na mesma obra.
    const getLocalBookKey = (obra: LocalObra): string => {
      if (obra.serverId) return `server:${obra.serverId}`;
      const numero = (obra.obra || '').trim();
      const equipe = (obra.equipe || '').trim();
      const tipoServico = (obra.tipo_servico || '').trim();
      const createdAt = (obra.created_at || '').trim();
      const fallbackId = (obra.id || '').trim();
      return `local:${numero}::${equipe}::${tipoServico}::${createdAt || fallbackId}`;
    };

    const obrasByKey = new Map<string, LocalObra[]>();
    for (const obra of localObras) {
      const key = getLocalBookKey(obra);
      if (!obrasByKey.has(key)) {
        obrasByKey.set(key, []);
      }
      obrasByKey.get(key)!.push(obra);
    }

    // Identificar duplicatas e selecionar qual manter
    const obrasToKeep: LocalObra[] = [];
    let removedCount = 0;

    for (const [bookKey, obras] of obrasByKey.entries()) {
      if (obras.length === 1) {
        // Não há duplicata, manter
        obrasToKeep.push(obras[0]);
      } else {
        // Há duplicatas - escolher qual manter
        logger.sync(`⚠️ Encontradas ${obras.length} duplicatas do mesmo book (${bookKey})`);

        // Ordenar por prioridade:
        // 1. Obras com serverId (sincronizadas) primeiro
        // 2. Depois por data de modificação (mais recente primeiro)
        const sorted = obras.sort((a, b) => {
          // Prioridade 1: tem serverId
          if (a.serverId && !b.serverId) return -1;
          if (!a.serverId && b.serverId) return 1;

          // Prioridade 2: mais recente
          const dateA = new Date(a.last_modified || a.created_at || 0).getTime();
          const dateB = new Date(b.last_modified || b.created_at || 0).getTime();
          return dateB - dateA;
        });

        // Manter a primeira (melhor prioridade)
        const toKeep = sorted[0];
        obrasToKeep.push(toKeep);
        removedCount += obras.length - 1;

        logger.sync(`   ✅ Mantendo: ID=${toKeep.id}${toKeep.serverId ? `, serverId=${toKeep.serverId}` : ''}`);
        logger.sync(`   ❌ Removendo ${obras.length - 1} duplicata(s)`);
      }
    }

    // Salvar lista limpa
    await writeObrasRaw(obrasToKeep);

    logger.sync(`✅ Limpeza concluída:`);
    logger.sync(`   - Obras mantidas: ${obrasToKeep.length}`);
    logger.sync(`   - Obras removidas: ${removedCount}`);

    return { removed: removedCount, kept: obrasToKeep.length };
  } catch (error) {
    logger.error('❌ Erro ao remover obras duplicadas:', error);
    throw error;
  }
};

/**
 * Remove obras duplicadas das pending obras também
 */
export const removeDuplicatePendingObras = async (): Promise<{ removed: number; kept: number }> => {
  try {
    logger.sync('🧹 Limpando pending obras duplicadas...');

    const pendingObras = await getPendingObras();
    logger.sync(`📊 Total de pending obras: ${pendingObras.length}`);

    // Agrupar por chave de book para não juntar books diferentes da mesma obra.
    const getPendingBookKey = (obra: PendingObra): string => {
      const numero = (obra.obra || '').trim();
      const equipe = (obra.equipe || '').trim();
      const tipoServico = (obra.tipo_servico || '').trim();
      const createdAt = (obra.created_at || '').trim();
      const fallbackId = (obra.id || '').trim();
      return `pending:${numero}::${equipe}::${tipoServico}::${createdAt || fallbackId}`;
    };

    const obrasByKey = new Map<string, PendingObra[]>();
    for (const obra of pendingObras) {
      const key = getPendingBookKey(obra);
      if (!obrasByKey.has(key)) {
        obrasByKey.set(key, []);
      }
      obrasByKey.get(key)!.push(obra);
    }

    const obrasToKeep: PendingObra[] = [];
    let removedCount = 0;

    for (const [bookKey, obras] of obrasByKey.entries()) {
      if (obras.length === 1) {
        obrasToKeep.push(obras[0]);
      } else {
        logger.sync(`⚠️ Encontradas ${obras.length} pending duplicatas do mesmo book (${bookKey})`);

        // Ordenar por data de criação (mais recente primeiro)
        const sorted = obras.sort((a, b) => {
          const dateA = new Date(a.created_at || 0).getTime();
          const dateB = new Date(b.created_at || 0).getTime();
          return dateB - dateA;
        });

        obrasToKeep.push(sorted[0]);
        removedCount += obras.length - 1;

        logger.sync(`   ✅ Mantendo: ID=${sorted[0].id}`);
        logger.sync(`   ❌ Removendo ${obras.length - 1} duplicata(s)`);
      }
    }

    await AsyncStorage.setItem(PENDING_OBRAS_KEY, JSON.stringify(obrasToKeep));

    logger.sync(`✅ Pending obras limpas:`);
    logger.sync(`   - Mantidas: ${obrasToKeep.length}`);
    logger.sync(`   - Removidas: ${removedCount}`);

    return { removed: removedCount, kept: obrasToKeep.length };
  } catch (error) {
    logger.error('❌ Erro ao limpar pending obras:', error);
    throw error;
  }
};

/**
 * Limpa todas as duplicatas (local + pending)
 */
export const cleanupAllDuplicates = async (): Promise<{
  localRemoved: number;
  pendingRemoved: number;
  totalRemoved: number;
}> => {
  try {
    logger.sync('🧹🧹 Limpeza completa de duplicatas...');

    const localResult = await removeDuplicateObras();
    const pendingResult = await removeDuplicatePendingObras();

    const totalRemoved = localResult.removed + pendingResult.removed;

    logger.sync(`✅ Limpeza completa concluída:`);
    logger.sync(`   - Local: ${localResult.removed} removida(s), ${localResult.kept} mantida(s)`);
    logger.sync(`   - Pending: ${pendingResult.removed} removida(s), ${pendingResult.kept} mantida(s)`);
    logger.sync(`   - Total removido: ${totalRemoved}`);

    return {
      localRemoved: localResult.removed,
      pendingRemoved: pendingResult.removed,
      totalRemoved
    };
  } catch (error) {
    logger.error('❌ Erro na limpeza completa:', error);
    throw error;
  }
};
