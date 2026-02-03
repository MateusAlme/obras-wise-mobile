import AsyncStorage from '@react-native-async-storage/async-storage';
import NetInfo from '@react-native-community/netinfo';
import { supabase } from './supabase';
import { Alert } from 'react-native';
import { backupPhoto, PhotoMetadata, getPendingPhotos, updatePhotosObraId, getAllPhotoMetadata } from './photo-backup';
import { processObraPhotos, UploadProgress } from './photo-queue';

const PENDING_OBRAS_KEY = '@obras_pending_sync';
const SYNC_STATUS_KEY = '@sync_status';
const LOCAL_OBRAS_KEY = '@obras_local'; // Nova chave para todas as obras locais
let syncInProgress = false;

export interface PendingObra {
  id: string;
  data: string;
  obra: string;
  responsavel: string;
  equipe: string;
  tipo_servico: string;
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
  // Cava em Rocha - Dados dos postes
  postes_data?: Array<{
    id: string;
    numero: number;
    fotos_antes: string[];
    fotos_durante: string[];
    fotos_depois: string[];
    observacao?: string;
  }>;
  // Identificação do criador
  creator_role?: 'compressor' | 'equipe'; // Identificador permanente de quem criou
  created_at: string;
  sync_status: 'pending' | 'syncing' | 'failed';
  error_message?: string;
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

/**
 * Verifica se há conexão com a internet
 */
export const checkInternetConnection = async (): Promise<boolean> => {
  const state = await NetInfo.fetch();
  return state.isConnected === true && state.isInternetReachable === true;
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

    // Se tem ID existente, atualizar; senão, criar novo
    const obraId = existingId || obra.id || `local_${Date.now()}_${Math.random().toString(36).substring(2, 11)}`;

    const obraIndex = localObras.findIndex(o => o.id === obraId);
    const now = new Date().toISOString();

    // ✅ CRÍTICO: Preservar serverId da obra existente se não vier no parâmetro
    // Isso evita perder o link com o servidor após re-edição
    const existingObra = obraIndex !== -1 ? localObras[obraIndex] : null;
    const serverId = (obra as any).serverId || existingObra?.serverId || null;

    console.log(`💾 saveObraLocal - obraId: ${obraId}, serverId existente: ${existingObra?.serverId}, serverId no param: ${(obra as any).serverId}, final: ${serverId}`);

    const savedObra: LocalObra = {
      ...obra,
      id: obraId,
      // ✅ CRÍTICO: Preservar serverId para identificar obra no servidor
      ...(serverId && { serverId }),
      synced: false, // Sempre marca como não sincronizado (nova modificação)
      locallyModified: obraIndex !== -1 || !!serverId, // Modificada se já existia ou se já foi para o servidor
      last_modified: now,
      created_at: obraIndex !== -1 ? (existingObra?.created_at || obra.created_at || now) : (obra.created_at || now),
    };

    if (obraIndex !== -1) {
      // Atualizar obra existente
      localObras[obraIndex] = savedObra;
      console.log(`📝 Obra local atualizada: ${obraId} (serverId: ${serverId || 'none'})`);
    } else {
      // Adicionar nova obra
      localObras.push(savedObra);
      console.log(`✅ Nova obra local criada: ${obraId} (serverId: ${serverId || 'none'})`);
    }

    await AsyncStorage.setItem(LOCAL_OBRAS_KEY, JSON.stringify(localObras));

    // NÃO sincroniza automaticamente - apenas salva local
    // Usuário decide quando sincronizar via botão manual

    return obraId;
  } catch (error) {
    console.error('❌ Erro ao salvar obra local:', error);
    throw error;
  }
};

/**
 * Obtém todas as obras armazenadas localmente
 */
export const getLocalObras = async (): Promise<LocalObra[]> => {
  try {
    const data = await AsyncStorage.getItem(LOCAL_OBRAS_KEY);
    return data ? JSON.parse(data) : [];
  } catch (error) {
    console.error('Erro ao obter obras locais:', error);
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
    console.error('Erro ao obter obra local por ID:', error);
    return null;
  }
};

/**
 * 🔧 RECUPERAÇÃO: Restaura fotos de uma obra buscando no photo-backup
 * Útil quando fotos sumiram após sync ou edição
 */
export const restoreObraPhotos = async (obraId: string): Promise<boolean> => {
  try {
    console.log(`🔧 Iniciando recuperação de fotos para obra: ${obraId}`);

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

    console.log(`🔍 Buscando fotos para IDs: ${possibleIds.join(', ')}`);
    const obraPhotos = allPhotos.filter(p => possibleIds.includes(p.obraId));

    if (obraPhotos.length === 0) {
      console.warn(`⚠️ Nenhuma foto encontrada no backup para obra ${obraId}`);
      console.warn(`   IDs pesquisados: ${possibleIds.join(', ')}`);
      return false;
    }

    console.log(`📸 Encontradas ${obraPhotos.length} fotos no backup`);

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
      console.log(`  - ${type}: ${ids.length} foto(s)`);
    });

    // 3. Atualizar obra no AsyncStorage (reutilizar localObras já carregado)
    const obraIndex = localObras.findIndex(o => o.id === obraId);

    if (obraIndex === -1) {
      console.error(`❌ Obra ${obraId} não encontrada no AsyncStorage`);
      return false;
    }

    // Atualizar todos os arrays de fotos
    const updatedObra = {
      ...localObras[obraIndex],
      ...photosByType, // Mescla todos os arrays de fotos
      locallyModified: true, // Marca como modificada para resincronizar se necessário
    };

    localObras[obraIndex] = updatedObra;
    await AsyncStorage.setItem(LOCAL_OBRAS_KEY, JSON.stringify(localObras));

    console.log(`✅ Fotos restauradas com sucesso para obra ${obraId}`);
    console.log(`   Total: ${obraPhotos.length} fotos reconectadas`);

    return true;
  } catch (error) {
    console.error('❌ Erro ao restaurar fotos da obra:', error);
    return false;
  }
};

/**
 * 🔄 Força atualização de obra do Supabase para AsyncStorage local
 * Útil para recuperar fotos que não foram atualizadas após sync
 */
export const forceUpdateObraFromSupabase = async (obraId: string): Promise<boolean> => {
  try {
    console.log(`🔄 Forçando atualização da obra ${obraId} do Supabase...`);

    // Primeiro, buscar obra local para obter o número da obra
    const localObras = await getLocalObras();
    const obraLocal = localObras.find(o => o.id === obraId);

    if (!obraLocal) {
      console.error(`❌ Obra ${obraId} não encontrada no AsyncStorage local`);
      return false;
    }

    const numeroObra = obraLocal.obra;
    const equipe = obraLocal.equipe;
    console.log(`📋 Buscando obra ${numeroObra} da equipe ${equipe} no Supabase...`);

    // Buscar no Supabase pelo NÚMERO da obra (não pelo ID temp_)
    const { data: syncedObra, error: fetchError } = await supabase
      .from('obras')
      .select('*')
      .eq('obra', numeroObra)
      .eq('equipe', equipe)
      .single();

    if (fetchError) {
      console.error(`❌ Erro ao buscar obra por número: ${fetchError.message}`);

      // Se falhou e ID não é temp_, tentar pelo ID direto
      if (!obraId.startsWith('temp_')) {
        console.log(`🔄 Tentando buscar pelo ID: ${obraId}`);
        const { data: retryObra, error: retryError } = await supabase
          .from('obras')
          .select('*')
          .eq('id', obraId)
          .single();

        if (!retryError && retryObra) {
          console.log(`✅ Obra encontrada na segunda tentativa (por ID)`);
          // Usar retryObra como syncedObra
          return await updateObraInAsyncStorage(retryObra, obraId, localObras);
        }
      }
      return false;
    }

    if (!syncedObra) {
      console.error(`❌ Obra ${numeroObra} não encontrada no Supabase`);
      return false;
    }

    console.log(`📊 Obra encontrada: ${syncedObra.obra} (ID: ${syncedObra.id})`);
    console.log(`   - fotos_antes: ${Array.isArray(syncedObra.fotos_antes) ? syncedObra.fotos_antes.length : 0} item(s)`);

    return await updateObraInAsyncStorage(syncedObra, obraId, localObras);
  } catch (error) {
    console.error('❌ Erro ao forçar atualização:', error);
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

    console.log(`📊 Atualizando obra no AsyncStorage:`);
    console.log(`   - ID: ${updatedObra.id}`);
    console.log(`   - Status: ${updatedObra.status}`);
    console.log(`   - Origem: ${updatedObra.origem}`);
    console.log(`   - Synced: ${updatedObra.synced}`);

    if (index !== -1) {
      localObras[index] = updatedObra;
    } else {
      // Obra não existe localmente, adicionar
      localObras.push(updatedObra);
    }

    await AsyncStorage.setItem(LOCAL_OBRAS_KEY, JSON.stringify(localObras));
    console.log(`✅ Obra atualizada com sucesso no AsyncStorage`);

    return true;
  } catch (error) {
    console.error('❌ Erro ao forçar atualização:', error);
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
    await AsyncStorage.setItem(LOCAL_OBRAS_KEY, JSON.stringify(filtered));
    console.log(`🗑️ Obra local removida: ${id}`);
  } catch (error) {
    console.error('Erro ao remover obra local:', error);
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
      console.warn(`⚠️ Obra local não encontrada: ${obraId}`);
      return false;
    }

    // Se já está sincronizada e não foi modificada, pular
    if (obra.synced && !obra.locallyModified) {
      console.log(`✅ Obra já sincronizada: ${obraId}`);
      return true;
    }

    console.log(`🔄 Sincronizando obra local: ${obraId}`);

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
      console.log(`📥 Buscando dados atualizados da obra sincronizada: ${finalId}`);

      const { data: syncedObra, error: fetchError } = await supabase
        .from('obras')
        .select('*')
        .eq('id', finalId)
        .single();

      if (fetchError) {
        console.error(`❌ Erro ao buscar obra do Supabase: ${fetchError.message}`);
      }

      if (syncedObra) {
        console.log(`📊 Obra encontrada no Supabase: ${syncedObra.obra}`);
        console.log(`   - fotos_antes: ${Array.isArray(syncedObra.fotos_antes) ? syncedObra.fotos_antes.length : 0} item(s)`);
        console.log(`   - Tipo do primeiro item fotos_antes: ${Array.isArray(syncedObra.fotos_antes) && syncedObra.fotos_antes.length > 0 ? typeof syncedObra.fotos_antes[0] : 'N/A'}`);
      }

      const localObras = await getLocalObras();
      const index = localObras.findIndex(o => o.id === obraId);

      if (index !== -1) {
        if (syncedObra && !fetchError) {
          // ✅ CRÍTICO: Manter o ID local mas adicionar serverId para futuras sincronizações
          // NÃO remover a entrada - apenas atualizar com os dados do servidor
          console.log(`🔄 Atualizando obra local ${obraId} com serverId: ${finalId}`);
          
          localObras[index] = {
            ...localObras[index], // Manter dados locais
            ...syncedObra, // Sobrescrever com dados do servidor
            id: obraId, // ✅ MANTER o ID local original
            serverId: finalId, // ✅ Guardar o UUID do Supabase
            synced: true,
            locallyModified: false,
            origem: 'online',
            last_modified: syncedObra.updated_at || syncedObra.created_at,
            created_at: syncedObra.created_at,
          } as LocalObra;
          
          console.log(`✅ Obra atualizada - ID local: ${obraId}, serverId: ${finalId}`);
        } else {
          // Fallback: apenas marcar como sincronizada (mantém IDs)
          console.warn(`⚠️ Não foi possível buscar dados atualizados, marcando apenas como sincronizada`);
          localObras[index].synced = true;
          localObras[index].locallyModified = false;
          // ✅ Ainda assim, guardar o serverId se disponível
          if (finalId && finalId !== obraId) {
            (localObras[index] as any).serverId = finalId;
          }
        }

        await AsyncStorage.setItem(LOCAL_OBRAS_KEY, JSON.stringify(localObras));
        console.log(`✅ Obra marcada como sincronizada: ${obraId} (serverId: ${finalId})`);
      }
    }

    return result.success;
  } catch (error) {
    console.error('❌ Erro ao sincronizar obra local:', error);
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
      console.log('📴 Sem conexão - sync cancelado');
      return { success: 0, failed: 0 };
    }

    const localObras = await getLocalObras();
    const obrasToSync = localObras.filter(o => !o.synced || o.locallyModified);

    console.log(`🔄 Sincronizando ${obrasToSync.length} obra(s) local(is)...`);

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

    console.log(`✅ Sync completo: ${success} sucesso, ${failed} falhas`);
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
    console.log('🪧 DEBUG saveObraOffline - obra.postes_data:', JSON.stringify((obra as any).postes_data));

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

    pendingObras.push(newObra);
    await AsyncStorage.setItem(PENDING_OBRAS_KEY, JSON.stringify(pendingObras));

    // Atualizar status de sincronização
    await updateSyncStatus();

    return newObra.id;
  } catch (error) {
    console.error('Erro ao salvar obra offline:', error);
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
    console.log('📝 Atualizando obra offline:', obraId);

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
      console.log('✅ Obra editada adicionada à fila offline:', obraId);
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
    console.log('✅ Obra offline atualizada:', obraId);
  } catch (error) {
    console.error('❌ Erro ao atualizar obra offline:', error);
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
    console.error('Erro ao obter obras pendentes:', error);
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
    console.error('Erro ao remover obra pendente:', error);
    throw error;
  }
};

/**
 * Atualiza o status de uma obra pendente
 */
export const updatePendingObraStatus = async (
  id: string,
  status: 'pending' | 'syncing' | 'failed',
  errorMessage?: string
): Promise<void> => {
  try {
    const pendingObras = await getPendingObras();
    const index = pendingObras.findIndex(o => o.id === id);

    if (index !== -1) {
      pendingObras[index].sync_status = status;
      if (status === 'failed') {
        pendingObras[index].error_message = errorMessage;
      } else {
        delete pendingObras[index].error_message;
      }
      await AsyncStorage.setItem(PENDING_OBRAS_KEY, JSON.stringify(pendingObras));
      await updateSyncStatus();
    }
  } catch (error) {
    console.error('Erro ao atualizar status da obra pendente:', error);
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
    console.warn(`⚠️ [getPhotoMetadatasByIds] Buscando ${photoIds.length} IDs, encontrou ${found.length}`);
    const foundIds = found.map(p => p.id);
    const notFound = photoIds.filter(id => !foundIds.includes(id));
    if (notFound.length > 0) {
      console.warn(`   IDs não encontrados: ${JSON.stringify(notFound)}`);
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
      console.log(`🔄 [Fallback obraId+tipo] Encontrou ${byObraAndType.length} foto(s) para ${type}`);
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
            console.log(`🔄 [Fallback obraId antigo] Encontrou foto ${photo.id} com obraId ${possibleObraId}`);
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
          console.log(`🔄 [Fallback ID direto] Encontrou foto ${photoId} (uploaded: ${photo.uploaded})`);
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
  console.log(`🔍 [convertPhotosToData] Recebeu ${metadata.length} foto(s)`);

  metadata.forEach((p, idx) => {
    console.log(`📸 Foto ${idx + 1}:`, {
      id: p.id,
      type: p.type,
      uploaded: p.uploaded,
      hasUploadUrl: !!p.uploadUrl,
      uploadUrl: p.uploadUrl ? p.uploadUrl.substring(0, 50) + '...' : 'NULL',
    });
  });

  const filtered = metadata.filter(p => p.uploaded && p.uploadUrl);
  console.log(`✅ Após filtro: ${filtered.length} de ${metadata.length} foto(s) serão salvas no banco`);

  if (filtered.length < metadata.length) {
    console.warn(`⚠️ ATENÇÃO: ${metadata.length - filtered.length} foto(s) foram DESCARTADAS (uploaded=false ou uploadUrl vazio)`);
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
    // Marcar como "sincronizando"
    await updatePendingObraStatus(obra.id, 'syncing');

    // Login por equipe - não precisa verificar supabase.auth
    // O user_id será NULL no banco (definido como opcional)

    // Processar upload das fotos através da fila
    console.log(`🚀 [syncObra] Iniciando upload de fotos para obra ${obra.obra}`);
    const uploadResult = await processObraPhotos(obra.id, onProgress);
    console.log(`📊 [syncObra] Upload concluído: ${uploadResult.success} sucesso, ${uploadResult.failed} falhas`);

    // SYNC PARCIAL: Permitir salvar obra mesmo se algumas fotos falharem
    // Log de aviso se houver falhas, mas não bloqueia o sync
    if (uploadResult.failed > 0) {
      const totalPhotos = uploadResult.success + uploadResult.failed;
      const lostPhotos = uploadResult.results.filter(r => !r.success && r.error?.includes('não encontrado')).length;
      const networkFailures = uploadResult.failed - lostPhotos;

      if (lostPhotos > 0) {
        console.warn(
          `⚠️ ${lostPhotos} foto(s) foram perdidas (arquivos removidos do dispositivo antes da sincronização)`
        );
      }
      if (networkFailures > 0) {
        console.warn(
          `⚠️ ${networkFailures} foto(s) falharam no upload (problema de rede ou servidor)`
        );
      }
      console.warn(
        `✅ Obra será sincronizada com ${uploadResult.success} de ${totalPhotos} foto(s).`
      );
      // Não lança erro - continua com as fotos que subiram com sucesso
    }

    // Obter URLs das fotos uploadadas
    console.log(`📥 [syncObra] Obtendo metadados das fotos uploadadas...`);
    console.log(`   - fotos_antes: ${obra.fotos_antes?.length || 0} IDs`);
    console.log(`   - fotos_durante: ${obra.fotos_durante?.length || 0} IDs`);
    console.log(`   - fotos_depois: ${obra.fotos_depois?.length || 0} IDs`);
    console.log(`   - doc_apr: ${obra.doc_apr?.length || 0} IDs - ${JSON.stringify(obra.doc_apr || [])}`);
    console.log(`   - doc_laudo_transformador: ${obra.doc_laudo_transformador?.length || 0} IDs`);
    console.log(`   - fotos_transformador_tombamento_instalado: ${obra.fotos_transformador_tombamento_instalado?.length || 0} IDs`);

    // Debug: mostrar IDs exatos quando há IDs em campos de transformador ou documentos
    if (obra.fotos_transformador_tombamento_instalado?.length > 0) {
      console.log(`   📋 IDs em fotos_transformador_tombamento_instalado: ${JSON.stringify(obra.fotos_transformador_tombamento_instalado)}`);
    }
    if (obra.doc_laudo_transformador?.length > 0) {
      console.log(`   📋 IDs em doc_laudo_transformador: ${JSON.stringify(obra.doc_laudo_transformador)}`);
    }

    const fotosAntesMetadata = await getPhotoMetadatasByIds(obra.fotos_antes || []);
    const fotosDuranteMetadata = await getPhotoMetadatasByIds(obra.fotos_durante || []);
    const fotosDepoisMetadata = await getPhotoMetadatasByIds(obra.fotos_depois || []);
    const fotosAberturaMetadata = await getPhotoMetadatasByIds(obra.fotos_abertura || []);
    const fotosFechamentoMetadata = await getPhotoMetadatasByIds(obra.fotos_fechamento || []);
    const fotosDitaisAberturaMetadata = await getPhotoMetadatasByIds(obra.fotos_ditais_abertura || []);
    const fotosDitaisImpedirMetadata = await getPhotoMetadatasByIds(obra.fotos_ditais_impedir || []);
    const fotosDitaisTestarMetadata = await getPhotoMetadatasByIds(obra.fotos_ditais_testar || []);
    const fotosDitaisAterrarMetadata = await getPhotoMetadatasByIds(obra.fotos_ditais_aterrar || []);
    const fotosDitaisSinalizarMetadata = await getPhotoMetadatasByIds(obra.fotos_ditais_sinalizar || []);
    const fotosAterramentoValaAbertaMetadata = await getPhotoMetadatasByIds(obra.fotos_aterramento_vala_aberta || []);
    const fotosAterramentoHastesMetadata = await getPhotoMetadatasByIds(obra.fotos_aterramento_hastes || []);
    const fotosAterramentoValaFechadaMetadata = await getPhotoMetadatasByIds(obra.fotos_aterramento_vala_fechada || []);
    const fotosAterramentoMedicaoMetadata = await getPhotoMetadatasByIds(obra.fotos_aterramento_medicao || []);
    // Transformador - Usar fallback por obraId+tipo para maior robustez
    const fotosTransformadorLaudoMetadata = await getPhotoMetadatasWithFallback(obra.fotos_transformador_laudo || [], obra.id, 'transformador_laudo');
    const fotosTransformadorComponenteInstaladoMetadata = await getPhotoMetadatasWithFallback(obra.fotos_transformador_componente_instalado || [], obra.id, 'transformador_componente_instalado');
    const fotosTransformadorTombamentoInstaladoMetadata = await getPhotoMetadatasWithFallback(obra.fotos_transformador_tombamento_instalado || [], obra.id, 'transformador_tombamento_instalado');
    const fotosTransformadorTapeMetadata = await getPhotoMetadatasWithFallback(obra.fotos_transformador_tape || [], obra.id, 'transformador_tape');
    const fotosTransformadorPlacaInstaladoMetadata = await getPhotoMetadatasWithFallback(obra.fotos_transformador_placa_instalado || [], obra.id, 'transformador_placa_instalado');
    const fotosTransformadorInstaladoMetadata = await getPhotoMetadatasWithFallback(obra.fotos_transformador_instalado || [], obra.id, 'transformador_instalado');
    const fotosTransformadorAntesRetirarMetadata = await getPhotoMetadatasWithFallback(obra.fotos_transformador_antes_retirar || [], obra.id, 'transformador_antes_retirar');
    const fotosTransformadorTombamentoRetiradoMetadata = await getPhotoMetadatasWithFallback(obra.fotos_transformador_tombamento_retirado || [], obra.id, 'transformador_tombamento_retirado');
    const fotosTransformadorPlacaRetiradoMetadata = await getPhotoMetadatasWithFallback(obra.fotos_transformador_placa_retirado || [], obra.id, 'transformador_placa_retirado');
    const fotosTransformadorConexoesPrimariasInstaladoMetadata = await getPhotoMetadatasWithFallback(obra.fotos_transformador_conexoes_primarias_instalado || [], obra.id, 'transformador_conexoes_primarias_instalado');
    const fotosTransformadorConexoesSecundariasInstaladoMetadata = await getPhotoMetadatasWithFallback(obra.fotos_transformador_conexoes_secundarias_instalado || [], obra.id, 'transformador_conexoes_secundarias_instalado');
    const fotosTransformadorConexoesPrimariasRetiradoMetadata = await getPhotoMetadatasWithFallback(obra.fotos_transformador_conexoes_primarias_retirado || [], obra.id, 'transformador_conexoes_primarias_retirado');
    const fotosTransformadorConexoesSecundariasRetiradoMetadata = await getPhotoMetadatasWithFallback(obra.fotos_transformador_conexoes_secundarias_retirado || [], obra.id, 'transformador_conexoes_secundarias_retirado');
    const fotosMedidorPadraoMetadata = await getPhotoMetadatasByIds(obra.fotos_medidor_padrao || []);
    const fotosMedidorLeituraMetadata = await getPhotoMetadatasByIds(obra.fotos_medidor_leitura || []);
    const fotosMedidorSeloBornMetadata = await getPhotoMetadatasByIds(obra.fotos_medidor_selo_born || []);
    const fotosMedidorSeloCaixaMetadata = await getPhotoMetadatasByIds(obra.fotos_medidor_selo_caixa || []);
    const fotosMedidorIdentificadorFaseMetadata = await getPhotoMetadatasByIds(obra.fotos_medidor_identificador_fase || []);
    // Checklist de Fiscalização
    const fotosChecklistCroquiMetadata = await getPhotoMetadatasByIds(obra.fotos_checklist_croqui || []);
    const fotosChecklistPanoramicaInicialMetadata = await getPhotoMetadatasByIds(obra.fotos_checklist_panoramica_inicial || []);
    const fotosChecklistChedeMetadata = await getPhotoMetadatasByIds(obra.fotos_checklist_chede || []);
    const fotosChecklistAterramentoCercaMetadata = await getPhotoMetadatasByIds(obra.fotos_checklist_aterramento_cerca || []);
    const fotosChecklistPadraoGeralMetadata = await getPhotoMetadatasByIds(obra.fotos_checklist_padrao_geral || []);
    const fotosChecklistPadraoInternoMetadata = await getPhotoMetadatasByIds(obra.fotos_checklist_padrao_interno || []);
    const fotosChecklistPanoramicaFinalMetadata = await getPhotoMetadatasByIds(obra.fotos_checklist_panoramica_final || []);
    const fotosChecklistPostesMetadata = await getPhotoMetadatasByIds(obra.fotos_checklist_postes || []);
    const fotosChecklistSeccionamentosMetadata = await getPhotoMetadatasByIds(obra.fotos_checklist_seccionamentos || []);
    // Documentação (PDFs) - Usar fallback por obraId+tipo para maior robustez
    const docCadastroMedidorMetadata = await getPhotoMetadatasWithFallback(obra.doc_cadastro_medidor || [], obra.id, 'doc_cadastro_medidor');
    const docLaudoTransformadorMetadata = await getPhotoMetadatasWithFallback(obra.doc_laudo_transformador || [], obra.id, 'doc_laudo_transformador');
    const docLaudoReguladorMetadata = await getPhotoMetadatasWithFallback(obra.doc_laudo_regulador || [], obra.id, 'doc_laudo_regulador');
    const docLaudoReligadorMetadata = await getPhotoMetadatasWithFallback(obra.doc_laudo_religador || [], obra.id, 'doc_laudo_religador');
    const docAprMetadata = await getPhotoMetadatasWithFallback(obra.doc_apr || [], obra.id, 'doc_apr');
    const docFvbtMetadata = await getPhotoMetadatasWithFallback(obra.doc_fvbt || [], obra.id, 'doc_fvbt');
    const docTermoDesistenciaLptMetadata = await getPhotoMetadatasWithFallback(obra.doc_termo_desistencia_lpt || [], obra.id, 'doc_termo_desistencia_lpt');
    const docAutorizacaoPassagemMetadata = await getPhotoMetadatasWithFallback(obra.doc_autorizacao_passagem || [], obra.id, 'doc_autorizacao_passagem');
    // Altimetria
    const fotosAltimetriaLadoFonteMetadata = await getPhotoMetadatasByIds(obra.fotos_altimetria_lado_fonte || []);
    const fotosAltimetriaMedicaoFonteMetadata = await getPhotoMetadatasByIds(obra.fotos_altimetria_medicao_fonte || []);
    const fotosAltimetriaLadoCargaMetadata = await getPhotoMetadatasByIds(obra.fotos_altimetria_lado_carga || []);
    const fotosAltimetriaMedicaoCargaMetadata = await getPhotoMetadatasByIds(obra.fotos_altimetria_medicao_carga || []);
    // Vazamento e Limpeza de Transformador
    const fotosVazamentoEvidenciaMetadata = await getPhotoMetadatasByIds(obra.fotos_vazamento_evidencia || []);
    const fotosVazamentoEquipamentosLimpezaMetadata = await getPhotoMetadatasByIds(obra.fotos_vazamento_equipamentos_limpeza || []);
    const fotosVazamentoTombamentoRetiradoMetadata = await getPhotoMetadatasByIds(obra.fotos_vazamento_tombamento_retirado || []);
    const fotosVazamentoPlacaRetiradoMetadata = await getPhotoMetadatasByIds(obra.fotos_vazamento_placa_retirado || []);
    const fotosVazamentoTombamentoInstaladoMetadata = await getPhotoMetadatasByIds(obra.fotos_vazamento_tombamento_instalado || []);
    const fotosVazamentoPlacaInstaladoMetadata = await getPhotoMetadatasByIds(obra.fotos_vazamento_placa_instalado || []);
    const fotosVazamentoInstalacaoMetadata = await getPhotoMetadatasByIds(obra.fotos_vazamento_instalacao || []);

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

    console.log(`🔍 [syncObra] Decisão de sync:`);
    console.log(`   - obra.id: ${obra.id}`);
    console.log(`   - obra.serverId: ${(obra as any).serverId || 'undefined'}`);
    console.log(`   - obra.isEdited: ${obra.isEdited}`);
    console.log(`   - idToUpdate: ${idToUpdate}`);
    console.log(`   - shouldUpdate: ${shouldUpdate}`);

    if (shouldUpdate && idToUpdate) {
      console.log(`🔁 [syncObra] Atualizando obra existente no servidor: ${idToUpdate}`);

      // Buscar obra existente no servidor
      const { data: existingObra, error: fetchError } = await supabase
        .from('obras')
        .select('*')
        .eq('id', idToUpdate)
        .single();

      if (fetchError) {
        // ✅ CRÍTICO: Se não conseguiu buscar a obra, NÃO inserir nova!
        // Isso causaria duplicação. Melhor falhar e tentar novamente.
        console.error(`❌ [syncObra] Não foi possível buscar obra ${idToUpdate} para atualização:`, fetchError);
        console.error(`❌ [syncObra] Abortando para evitar duplicação. A obra pode ter sido deletada do servidor.`);
        throw new Error(`Não foi possível encontrar obra ${idToUpdate} no servidor para atualização. Verifique se a obra ainda existe.`);
      }
      
      if (existingObra) {
        // ✅ CORRIGIDO: Substituir fotos se houver novas, caso contrário manter existentes
        // Isso evita duplicação ao sincronizar múltiplas vezes
        const replaceOrKeep = (newData: any[], existingData: any[]) => {
          // Se há novas fotos, usa elas (substituição completa)
          if (newData && newData.length > 0) {
            return newData;
          }
          // Caso contrário, mantém as existentes
          return existingData || [];
        };

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
          postes_data: obra.postes_data || existingObra.postes_data || null,
          observacoes: (obra as any).observacoes || existingObra.observacoes || null,
          creator_role: (obra as any).creator_role || existingObra.creator_role || null,
        };

        // Executar update
        const { error: updateError } = await supabase
          .from('obras')
          .update(updatePayload)
          .eq('id', idToUpdate);

        if (updateError) {
          throw updateError;
        }

        console.log(`✅ Obra ${idToUpdate} atualizada no servidor via sync.`);

        // Remover da fila
        await removePendingObra(obra.id);
        return { success: true, newId: idToUpdate };
      }
      // Se existingObra é null mas não deu erro, algo estranho aconteceu
      console.error(`❌ [syncObra] existingObra é null mas fetchError não foi definido - situação inesperada`);
      throw new Error(`Situação inesperada ao atualizar obra ${idToUpdate}`);
    }

    // Se não fizemos update e chegamos aqui, inserir nova obra no servidor
    const { data: insertedObra, error } = await supabase
      .from('obras')
      .insert([
        {
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
          postes_data: obra.postes_data || null,
          observacoes: (obra as any).observacoes || null,
          creator_role: (obra as any).creator_role || null,
          // user_id removido - Login por equipe não usa Supabase Auth
          created_at: obra.created_at || new Date().toISOString(),
        },
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
        console.log(`✅ ${updatedCount} foto(s) atualizadas com novo obraId: ${insertedObra.id}`);
      } catch (photoUpdateError) {
        console.error('Erro ao atualizar obraId das fotos (não crítico):', photoUpdateError);
        // Não propaga erro - sincronização foi bem sucedida
      }
    }

    // Remover da fila
    await removePendingObra(obra.id);
    return { success: true, newId: finalObraId };

  } catch (error: any) {
    console.error('Erro ao sincronizar obra:', error);
    const friendlyMessage = translateErrorMessage(error?.message);
    await updatePendingObraStatus(obra.id, 'failed', friendlyMessage);
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
      console.log('📵 [syncAllPendingObras] Sem conexão, abortando');
      return { success: 0, failed: 0 };
    }

    let success = 0;
    let failed = 0;

    // 1. Sincronizar obras de @obras_pending_sync
    const pendingObras = await getPendingObras();
    const obrasToSync = pendingObras.filter(o => o.sync_status === 'pending' || o.sync_status === 'failed');
    console.log(`📊 [syncAllPendingObras] Obras em pending_sync: ${obrasToSync.length}`);

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
    const localObrasToSync = localObras.filter(o => !o.synced && o.sync_status !== 'syncing');
    console.log(`📊 [syncAllPendingObras] Obras locais não sincronizadas: ${localObrasToSync.length}`);

    for (const localObra of localObrasToSync) {
      try {
        // Converter LocalObra para PendingObra para usar syncObra
        const pendingObra: PendingObra = {
          ...localObra,
          sync_status: 'pending',
          photos_uploaded: false,
        };

        const result = await syncObra(pendingObra);
        if (result.success) {
          // Marcar como sincronizada em @obras_local
          const updatedLocalObras = await getLocalObras();
          const index = updatedLocalObras.findIndex(o => o.id === localObra.id);
          if (index !== -1) {
            updatedLocalObras[index].synced = true;
            updatedLocalObras[index].serverId = result.newId;
            await AsyncStorage.setItem(LOCAL_OBRAS_KEY, JSON.stringify(updatedLocalObras));
          }
          success++;
          console.log(`✅ [syncAllPendingObras] Obra local sincronizada: ${localObra.obra}`);
        } else {
          failed++;
        }
      } catch (error) {
        console.error(`❌ [syncAllPendingObras] Erro ao sincronizar obra local ${localObra.id}:`, error);
        failed++;
      }
    }

    // 🧹 LIMPEZA AUTOMÁTICA: Limpar cache após sincronização bem-sucedida
    if (success > 0) {
      try {
        console.log('🧹 Iniciando limpeza automática de cache após sincronização...');
        const { cleanupUploadedPhotos } = await import('./photo-backup');
        const deletedCount = await cleanupUploadedPhotos();
        console.log(`✅ Cache limpo automaticamente: ${deletedCount} foto(s) removida(s)`);
      } catch (error) {
        console.warn('⚠️ Erro ao limpar cache automaticamente (não crítico):', error);
      }
    }

    console.log(`📊 [syncAllPendingObras] Resultado: ${success} sucesso, ${failed} falhas`);
    return { success, failed };
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
    console.error('Erro ao obter status de sincronização:', error);
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
    console.error('Erro ao atualizar status de sincronização:', error);
  }
};

/**
 * Inicia um listener de conectividade para sincronização automática
 */
export const startAutoSync = (onSyncComplete?: (result: { success: number; failed: number }) => void) => {
  return NetInfo.addEventListener(state => {
    if (state.isConnected && state.isInternetReachable) {
      // Aguardar 2 segundos após conectar para garantir estabilidade
      setTimeout(async () => {
        const result = await syncAllPendingObras();
        if (result.success > 0 || result.failed > 0) {
          onSyncComplete?.(result);
        }
      }, 2000);
    }
  });
};

/**
 * Recupera fotos perdidas de obras que sumiram após sincronização
 * Reconstrói os arrays de photoIds baseado no photo-backup
 */
export const recoverLostPhotos = async (): Promise<{ recovered: number; obras: string[] }> => {
  try {
    console.log('🔧 Iniciando recuperação de fotos perdidas...');

    // 1. Buscar todas as fotos do backup
    const allPhotos = await getAllPhotoMetadata();
    console.log(`📸 Total de fotos no backup: ${allPhotos.length}`);

    // 2. Agrupar fotos por obraId
    const photosByObra = new Map<string, PhotoMetadata[]>();
    allPhotos.forEach(photo => {
      if (!photosByObra.has(photo.obraId)) {
        photosByObra.set(photo.obraId, []);
      }
      photosByObra.get(photo.obraId)!.push(photo);
    });

    console.log(`🏗️ Obras com fotos no backup: ${photosByObra.size}`);

    // 3. Buscar todas as obras locais
    const localObras = await getLocalObras();
    console.log(`📋 Obras locais: ${localObras.length}`);

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
          console.log(`  ✅ Recuperando ${photoIds.length} foto(s) de ${typeKey} para obra ${obra.obra || obra.id}`);
        }
      });

      // Se encontrou fotos perdidas, atualizar a obra
      if (hasLostPhotos) {
        const updatedObra = { ...obra, ...updates };
        await saveObraLocal(updatedObra, obra.id);
        recoveredCount++;
        recoveredObras.push(obra.obra || obra.id);
        console.log(`✅ Obra ${obra.obra || obra.id} recuperada com sucesso!`);
      }
    }

    console.log(`🎉 Recuperação concluída: ${recoveredCount} obra(s) recuperada(s)`);
    return { recovered: recoveredCount, obras: recoveredObras };

  } catch (error) {
    console.error('❌ Erro ao recuperar fotos perdidas:', error);
    throw error;
  }
};
