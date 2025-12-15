import AsyncStorage from '@react-native-async-storage/async-storage';
import NetInfo from '@react-native-community/netinfo';
import { supabase } from './supabase';
import { Alert } from 'react-native';
import { backupPhoto, PhotoMetadata, getPendingPhotos, updatePhotosObraId, getAllPhotoMetadata } from './photo-backup';
import { processObraPhotos, UploadProgress } from './photo-queue';

const PENDING_OBRAS_KEY = '@obras_pending_sync';
const SYNC_STATUS_KEY = '@sync_status';
let syncInProgress = false;

export interface PendingObra {
  id: string;
  data: string;
  obra: string;
  responsavel: string;
  equipe: string;
  tipo_servico: string;
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
  created_at: string;
  sync_status: 'pending' | 'syncing' | 'failed';
  error_message?: string;
  photos_uploaded: boolean; // Nova flag
}

export interface SyncStatus {
  lastSyncAt: string | null;
  pendingCount: number;
  failedCount: number;
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
  transformador_antes_retirar: string[];
  transformador_tombamento_retirado: string[];
  transformador_placa_retirado: string[];
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
    const pendingObras = await getPendingObras();
    const obraId =
      existingObraId || `offline_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;

    const newObra: PendingObra = {
      ...obra,
      id: obraId,
      sync_status: 'pending',
      photos_uploaded: false,
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
      fotos_transformador_antes_retirar: photoIds.transformador_antes_retirar ?? [],
      fotos_transformador_tombamento_retirado: photoIds.transformador_tombamento_retirado ?? [],
      fotos_transformador_placa_retirado: photoIds.transformador_placa_retirado ?? [],
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
  return allMetadata.filter(p => photoIds.includes(p.id));
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
 */
export const syncObra = async (
  obra: PendingObra,
  onProgress?: (progress: UploadProgress) => void
): Promise<boolean> => {
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
      console.warn(
        `⚠️ Sync parcial: ${uploadResult.failed} de ${totalPhotos} foto(s) falharam no upload. ` +
        `Obra será sincronizada com ${uploadResult.success} foto(s).`
      );
      // Não lança erro - continua com as fotos que subiram com sucesso
    }

    // Obter URLs das fotos uploadadas
    console.log(`📥 [syncObra] Obtendo metadados das fotos uploadadas...`);
    console.log(`   - fotos_antes: ${obra.fotos_antes.length} IDs`);
    console.log(`   - fotos_durante: ${obra.fotos_durante.length} IDs`);
    console.log(`   - fotos_depois: ${obra.fotos_depois.length} IDs`);

    const fotosAntesMetadata = await getPhotoMetadatasByIds(obra.fotos_antes);
    const fotosDuranteMetadata = await getPhotoMetadatasByIds(obra.fotos_durante);
    const fotosDepoisMetadata = await getPhotoMetadatasByIds(obra.fotos_depois);
    const fotosAberturaMetadata = await getPhotoMetadatasByIds(obra.fotos_abertura);
    const fotosFechamentoMetadata = await getPhotoMetadatasByIds(obra.fotos_fechamento);
    const fotosDitaisAberturaMetadata = await getPhotoMetadatasByIds(obra.fotos_ditais_abertura || []);
    const fotosDitaisImpedirMetadata = await getPhotoMetadatasByIds(obra.fotos_ditais_impedir || []);
    const fotosDitaisTestarMetadata = await getPhotoMetadatasByIds(obra.fotos_ditais_testar || []);
    const fotosDitaisAterrarMetadata = await getPhotoMetadatasByIds(obra.fotos_ditais_aterrar || []);
    const fotosDitaisSinalizarMetadata = await getPhotoMetadatasByIds(obra.fotos_ditais_sinalizar || []);
    const fotosAterramentoValaAbertaMetadata = await getPhotoMetadatasByIds(obra.fotos_aterramento_vala_aberta || []);
    const fotosAterramentoHastesMetadata = await getPhotoMetadatasByIds(obra.fotos_aterramento_hastes || []);
    const fotosAterramentoValaFechadaMetadata = await getPhotoMetadatasByIds(obra.fotos_aterramento_vala_fechada || []);
    const fotosAterramentoMedicaoMetadata = await getPhotoMetadatasByIds(obra.fotos_aterramento_medicao || []);
    const fotosTransformadorLaudoMetadata = await getPhotoMetadatasByIds(obra.fotos_transformador_laudo || []);
    const fotosTransformadorComponenteInstaladoMetadata = await getPhotoMetadatasByIds(obra.fotos_transformador_componente_instalado || []);
    const fotosTransformadorTombamentoInstaladoMetadata = await getPhotoMetadatasByIds(obra.fotos_transformador_tombamento_instalado || []);
    const fotosTransformadorTapeMetadata = await getPhotoMetadatasByIds(obra.fotos_transformador_tape || []);
    const fotosTransformadorPlacaInstaladoMetadata = await getPhotoMetadatasByIds(obra.fotos_transformador_placa_instalado || []);
    const fotosTransformadorInstaladoMetadata = await getPhotoMetadatasByIds(obra.fotos_transformador_instalado || []);
    const fotosTransformadorAntesRetirarMetadata = await getPhotoMetadatasByIds(obra.fotos_transformador_antes_retirar || []);
    const fotosTransformadorTombamentoRetiradoMetadata = await getPhotoMetadatasByIds(obra.fotos_transformador_tombamento_retirado || []);
    const fotosTransformadorPlacaRetiradoMetadata = await getPhotoMetadatasByIds(obra.fotos_transformador_placa_retirado || []);
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
    // Documentação (PDFs)
    const docCadastroMedidorMetadata = await getPhotoMetadatasByIds(obra.doc_cadastro_medidor || []);
    const docLaudoTransformadorMetadata = await getPhotoMetadatasByIds(obra.doc_laudo_transformador || []);
    const docLaudoReguladorMetadata = await getPhotoMetadatasByIds(obra.doc_laudo_regulador || []);
    const docLaudoReligadorMetadata = await getPhotoMetadatasByIds(obra.doc_laudo_religador || []);
    const docAprMetadata = await getPhotoMetadatasByIds(obra.doc_apr || []);
    const docFvbtMetadata = await getPhotoMetadatasByIds(obra.doc_fvbt || []);
    const docTermoDesistenciaLptMetadata = await getPhotoMetadatasByIds(obra.doc_termo_desistencia_lpt || []);
    const docAutorizacaoPassagemMetadata = await getPhotoMetadatasByIds(obra.doc_autorizacao_passagem || []);
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

    // Salvar obra no Supabase e obter o ID gerado
    const { data: insertedObra, error } = await supabase
      .from('obras')
      .insert([
        {
          data: obra.data,
          obra: obra.obra,
          responsavel: obra.responsavel,
          equipe: obra.equipe,
          tipo_servico: obra.tipo_servico,
          status: 'em_aberto', // Status inicial da obra
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
          // user_id removido - Login por equipe não usa Supabase Auth
          created_at: obra.created_at,
        },
      ])
      .select('id')
      .single();

    if (error) {
      throw error;
    }

    // Atualizar obraId das fotos locais para o novo ID do banco
    if (insertedObra && insertedObra.id) {
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
    return true;

  } catch (error: any) {
    console.error('Erro ao sincronizar obra:', error);
    const friendlyMessage = translateErrorMessage(error?.message);
    await updatePendingObraStatus(obra.id, 'failed', friendlyMessage);
    return false;
  }
};

/**
 * Sincroniza todas as obras pendentes
 */
export const syncAllPendingObras = async (): Promise<{ success: number; failed: number }> => {
  if (syncInProgress) {
    return { success: 0, failed: 0 };
  }

  syncInProgress = true;

  try {
    const isOnline = await checkInternetConnection();

    if (!isOnline) {
      return { success: 0, failed: 0 };
    }

    const pendingObras = await getPendingObras();
    const obrasToSync = pendingObras.filter(o => o.sync_status === 'pending' || o.sync_status === 'failed');

    let success = 0;
    let failed = 0;

    for (const obra of obrasToSync) {
      const result = await syncObra(obra);
      if (result) {
        success++;
      } else {
        failed++;
      }
    }

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
