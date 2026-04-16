/**
 * Funções para sincronização de serviços
 * Sincronização isolada por serviço → falha em um não afeta outros
 */

import { supabase } from './supabase';
import { Servico, ServicoLocal, SyncStatusServico } from '../types/servico';
import AsyncStorage from '@react-native-async-storage/async-storage';
import NetInfo from '@react-native-community/netinfo';
import { captureError } from './sentry';

const PENDING_SERVICOS_KEY = '@servicos_pending_sync';
const PENDING_SERVICOS_MAP_KEY = '@servicos_pending_map'; // Maps servicoId -> obraId
const LOCAL_SERVICOS_KEY = '@servicos_local';

// Rastreia serviços em sincronização ativa para evitar double-insert concorrente
const currentlySyncingIds = new Set<string>();

const isUuid = (value: string): boolean => {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(value);
};

/**
 * Status de sincronização global de serviços
 */
export interface SyncStatusServicos {
  totalServicos: number;
  syncedServicos: number;
  pendingServicos: number;
  errorServicos: number;
}

/**
 * Obtém todos os serviços locais de uma obra
 */
export async function getLocalServicos(obraId: string): Promise<ServicoLocal[]> {
  try {
    const key = `${LOCAL_SERVICOS_KEY}:${obraId}`;
    const stored = await AsyncStorage.getItem(key);
    return stored ? JSON.parse(stored) : [];
  } catch (error) {
    console.error('Erro ao buscar serviços locais:', error);
    return [];
  }
}

/**
 * Salva serviço localmente (offline)
 */
export async function saveServicoLocal(servico: ServicoLocal): Promise<void> {
  try {
    // Adiciona à lista de serviços em fila de sincronização
    const pendingKey = PENDING_SERVICOS_KEY;
    const pending = await AsyncStorage.getItem(pendingKey);
    const pendingList: string[] = pending ? JSON.parse(pending) : [];

    if (!pendingList.includes(servico.id)) {
      pendingList.push(servico.id);
      await AsyncStorage.setItem(pendingKey, JSON.stringify(pendingList));
    }

    // Salva mapa auxiliar de servicoId -> obraId para busca rápida
    const mapKey = PENDING_SERVICOS_MAP_KEY;
    const map = await AsyncStorage.getItem(mapKey);
    const mapObj: Record<string, string> = map ? JSON.parse(map) : {};
    mapObj[servico.id] = servico.obra_id;
    await AsyncStorage.setItem(mapKey, JSON.stringify(mapObj));

    // Salva o serviço localmente
    const key = `${LOCAL_SERVICOS_KEY}:${servico.obra_id}`;
    const stored = await AsyncStorage.getItem(key);
    const servicos: ServicoLocal[] = stored ? JSON.parse(stored) : [];

    const index = servicos.findIndex((s) => s.id === servico.id);
    if (index >= 0) {
      servicos[index] = servico;
    } else {
      servicos.push(servico);
    }

    await AsyncStorage.setItem(key, JSON.stringify(servicos));
  } catch (error) {
    console.error('Erro ao salvar serviço localmente:', error);
    captureError(error);
  }
}

/**
 * Resolve fotos salvas localmente para FotoInfo com url pública.
 * Suporta dois formatos de entrada:
 *  - string (photoId puro — formato legado do código anterior)
 *  - objeto { id, uri, ... } (formato novo — salvo após a correção de appendPhotoToServicoLocal)
 * Itens que já possuem { url } são retornados sem alteração.
 */
async function resolveLocalPhotosToUrls(
  fotosField: any[],
  obraId: string
): Promise<any[]> {
  if (!fotosField || fotosField.length === 0) return fotosField;

  // Itens que precisam de upload: strings, objetos com id sem url, ou url não-HTTP (caminho local)
  const needsUpload = fotosField.filter((item: any) => {
    if (typeof item === 'string') return item.length > 0;
    if (!item || typeof item !== 'object' || !item.id) return false;
    if (!item.url) return true; // sem url → precisa upload
    // url que é caminho local (não começa com http) → precisa re-upload para URL real
    return !String(item.url).startsWith('http');
  });

  if (needsUpload.length === 0) return fotosField;

  const { processObraPhotos } = await import('./photo-queue');
  const { getAllPhotoMetadata } = await import('./photo-backup');

  const localPhotoIds: string[] = needsUpload.map((item: any) =>
    typeof item === 'string' ? item : item.id
  );

  // Tenta fazer upload dos arquivos locais (falha silenciosa se arquivo não existe)
  try {
    await processObraPhotos(obraId, undefined, localPhotoIds);
  } catch {
    // Ignora erro de upload — mantém URI local para exibição offline
  }

  // Busca metadados de TODAS as fotos para montar o mapa completo (URL + geo)
  const allMetadata = await getAllPhotoMetadata();

  type ResolvedMeta = { url: string; latitude?: number | null; longitude?: number | null; utmX?: number | null; utmY?: number | null; utmZone?: string | null };
  const metaMap: Record<string, ResolvedMeta> = {};

  for (const photoId of localPhotoIds) {
    // Estratégia 1: ID exato com URL disponível
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

    // Estratégia 2: extrai obraId e tipo do formato {obraId}_{tipo}_{idx}_{ts}
    // e busca qualquer foto desse obraId+tipo que tenha URL
    const uuidMatch = photoId.match(
      /^([0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12})/i
    );
    if (uuidMatch) {
      const extractedObraId = uuidMatch[1];
      const afterUuid = photoId.slice(extractedObraId.length + 1);
      const extractedType = afterUuid.split('_')[0];

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
    const photoId = typeof item === 'string' ? item : item?.id;
    const resolved = photoId ? metaMap[photoId] : null;

    if (resolved) {
      // Monta FotoInfo completo: url pública + geolocalização UTM da metadata
      const baseObj = typeof item === 'object' ? item : {};
      const { id, uri, ...rest } = baseObj;
      return {
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
    // Upload falhou — manter URI local para o preview continuar funcionando
    return item;
  });
}

/**
 * Sincroniza um serviço específico com o Supabase
 */
export async function syncServico(servicoLocal: ServicoLocal): Promise<{
  success: boolean;
  error?: string;
  servico?: Servico;
}> {
  // Evita double-insert quando createServico e syncAllPendingServicos rodam concorrentemente
  if (currentlySyncingIds.has(servicoLocal.id)) {
    console.log(`[syncServico] Serviço ${servicoLocal.id} já em sincronização - ignorando chamada duplicada`);
    return { success: false, error: 'Já em sincronização' };
  }
  currentlySyncingIds.add(servicoLocal.id);
  const originalId = servicoLocal.id;

  try {
    if (!isUuid(servicoLocal.obra_id)) {
      const error = `A obra precisa estar sincronizada (obraId: ${servicoLocal.obra_id} não é UUID)`;
      console.error(`[syncServico] ${error}`);
      return {
        success: false,
        error,
      };
    }

    console.log(`[syncServico] Iniciando sync do serviço ${servicoLocal.id} (obra: ${servicoLocal.obra_id})`);

    // Marca como "syncing"
    servicoLocal.sync_status = 'syncing';
    await saveServicoLocal(servicoLocal);

    const isNewServico = !isUuid(servicoLocal.id);
    const pendingLocalId = servicoLocal.id;

    // Resolve TODOS os campos fotos_* e doc_* para URLs públicas do Supabase.
    // Faz upload das fotos salvas offline ({id, uri}) e substitui pelo objeto FotoInfo completo.
    const obraId = servicoLocal.obra_id;
    const fotosDocKeys = (Object.keys(servicoLocal) as string[]).filter(
      (k) => (k.startsWith('fotos_') || k.startsWith('doc_')) && Array.isArray((servicoLocal as any)[k])
    );
    const resolvedEntries = await Promise.all(
      fotosDocKeys.map(async (key) => [
        key,
        await resolveLocalPhotosToUrls((servicoLocal as any)[key] || [], obraId),
      ])
    );
    const resolvedFotos: Record<string, any[]> = Object.fromEntries(resolvedEntries);

    // Prepara payload
    const payload = {
      ...(isNewServico ? {} : { id: servicoLocal.id }),
      obra_id: servicoLocal.obra_id,
      obra_numero: servicoLocal.obra_numero,
      tipo_servico: servicoLocal.tipo_servico,
      responsavel: servicoLocal.responsavel,
      status: servicoLocal.status,
      sync_status: 'synced' as const,
      error_message: null,
      created_at: servicoLocal.created_at,
      updated_at: new Date().toISOString(),
      // Todos os campos fotos_* e doc_* já resolvidos (uploads feitos)
      ...resolvedFotos,
      // Dados estruturados (não são fotos)
      postes_data: servicoLocal.postes_data,
      checklist_postes_data: servicoLocal.checklist_postes_data,
      checklist_seccionamentos_data: servicoLocal.checklist_seccionamentos_data,
      checklist_aterramentos_cerca_data: servicoLocal.checklist_aterramentos_cerca_data,
      checklist_hastes_termometros_data: servicoLocal.checklist_hastes_termometros_data,
    };

    let result;

    if (isNewServico) {
      // INSERT novo serviço
      console.log(`[syncServico] Inserindo novo serviço com ID temporário: ${servicoLocal.id}`);
      const { data, error } = await supabase
        .from('servicos')
        .insert([payload])
        .select()
        .single();

      if (error) {
        console.error(`[syncServico] Erro ao inserir serviço:`, error);
        throw error;
      }

      result = data;
      console.log(`[syncServico] Serviço inserido com sucesso: ${result?.id}`);

      if (result?.id) {
        servicoLocal.id = result.id;
      }
    } else {
      // UPDATE serviço existente
      console.log(`[syncServico] Atualizando serviço existente: ${servicoLocal.id}`);
      const { data, error } = await supabase
        .from('servicos')
        .update(payload)
        .eq('id', servicoLocal.id)
        .select()
        .single();

      if (error) {
        console.error(`[syncServico] Erro ao atualizar serviço:`, error);
        throw error;
      }

      result = data;
      console.log(`[syncServico] Serviço atualizado com sucesso`);
    }

    // Marca como sincronizado localmente
    servicoLocal.sync_status = 'synced';
    servicoLocal.error_message = null;

    if (isNewServico && pendingLocalId !== servicoLocal.id) {
      const localKey = `${LOCAL_SERVICOS_KEY}:${servicoLocal.obra_id}`;
      const storedLocal = await AsyncStorage.getItem(localKey);
      if (storedLocal) {
        const localServicos: ServicoLocal[] = JSON.parse(storedLocal);
        const filteredServicos = localServicos.filter((item) => item.id !== pendingLocalId);
        await AsyncStorage.setItem(localKey, JSON.stringify(filteredServicos));
      }
    }

    // Salva localmente a versão retornada pelo Supabase (com URLs públicas nas fotos)
    // Isso garante que o preview continue funcionando mesmo sem internet após o sync
    if (result) {
      await saveServicoLocal({ ...(result as any), sync_status: 'synced', error_message: null });
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

    console.log(`✅ [syncServico] Serviço ${servicoLocal.id} sincronizado com sucesso`);
    return { success: true, servico: result };
  } catch (error: any) {
    const errorMsg: string = error?.message || '';
    const isNetworkError = /network request failed|failed to fetch|timeout/i.test(errorMsg);

    if (isNetworkError) {
      // Falha de rede temporária: manter como 'pending' para retry quando voltar online
      console.warn(`⚠️ [syncServico] Falha de rede ao sincronizar serviço ${servicoLocal.id} - mantendo como pendente`);
      servicoLocal.sync_status = 'offline';
      await saveServicoLocal(servicoLocal);
      return { success: false, error: errorMsg };
    }

    console.error('❌ [syncServico] Erro ao sincronizar serviço:', error);

    // Marca como erro localmente
    servicoLocal.sync_status = 'error';
    servicoLocal.error_message = errorMsg || 'Erro ao sincronizar';
    await saveServicoLocal(servicoLocal);

    captureError(error);

    return {
      success: false,
      error: errorMsg || 'Erro desconhecido',
    };
  } finally {
    // Libera o lock de sincronização para ambos os IDs (temp e real)
    currentlySyncingIds.delete(originalId);
    currentlySyncingIds.delete(servicoLocal.id);
  }
}

/**
 * Sincroniza todos os serviços pendentes
 */
export async function syncAllPendingServicos(): Promise<{ success: number; failed: number }> {
  try {
    const pendingKey = PENDING_SERVICOS_KEY;
    const mapKey = PENDING_SERVICOS_MAP_KEY;

    const pending = await AsyncStorage.getItem(pendingKey);
    const pendingIds: string[] = pending ? JSON.parse(pending) : [];

    if (pendingIds.length === 0) {
      console.log(`[syncAllPendingServicos] Sem serviços pendentes`);
      return { success: 0, failed: 0 };
    }

    console.log(`[syncAllPendingServicos] Sincronizando ${pendingIds.length} servico(s) pendente(s)`);

    const map = await AsyncStorage.getItem(mapKey);
    const mapObj: Record<string, string> = map ? JSON.parse(map) : {};

    let successCount = 0;
    let failedCount = 0;

    // Para cada serviço pendente, tenta sincronizar
    const servicosARemover: string[] = [];

    for (const servicoId of pendingIds) {
      try {
        let obraId = mapObj[servicoId];

        if (!obraId) {
          console.warn(`[syncAllPendingServicos] Serviço ${servicoId} sem obraId mapeado - tentando recuperar...`);

          // Tentar encontrar em todas as obras locais
          const { getLocalObras } = await import('./offline-sync');
          const localObras = await getLocalObras();

          for (const obra of localObras) {
            const key = `${LOCAL_SERVICOS_KEY}:${obra.id}`;
            const stored = await AsyncStorage.getItem(key);
            if (stored) {
              const servicos: ServicoLocal[] = JSON.parse(stored);
              const found = servicos.find((s) => s.id === servicoId);
              if (found) {
                obraId = found.obra_id;
                console.log(`[syncAllPendingServicos] Serviço ${servicoId} encontrado com obraId: ${obraId}`);
                // Atualizar mapa
                mapObj[servicoId] = obraId;
                await AsyncStorage.setItem(mapKey, JSON.stringify(mapObj));
                break;
              }
            }
          }
        }

        if (!obraId) {
          console.error(`[syncAllPendingServicos] Serviço ${servicoId} não tem obraId - removendo da fila`);
          servicosARemover.push(servicoId);
          failedCount += 1;
          continue;
        }

        // Busca o serviço local
        const key = `${LOCAL_SERVICOS_KEY}:${obraId}`;
        const stored = await AsyncStorage.getItem(key);
        if (!stored) {
          console.warn(`[syncAllPendingServicos] Serviço ${servicoId} não encontrado localmente - removendo da fila`);
          servicosARemover.push(servicoId);
          failedCount += 1;
          continue;
        }

        const servicos: ServicoLocal[] = JSON.parse(stored);
        const servico = servicos.find((s) => s.id === servicoId);

        if (!servico) {
          console.warn(`[syncAllPendingServicos] Serviço ${servicoId} não encontrado na obra - removendo da fila`);
          servicosARemover.push(servicoId);
          failedCount += 1;
          continue;
        }

        console.log(`[syncAllPendingServicos] Sincronizando serviço: ${servicoId} (obra: ${obraId})`);

        // Sincroniza
        const result = await syncServico(servico);
        if (result.success) {
          successCount += 1;
          console.log(`✅ [syncAllPendingServicos] Serviço ${servicoId} sincronizado com sucesso`);
        } else {
          failedCount += 1;
          console.error(`❌ [syncAllPendingServicos] Falha ao sincronizar serviço ${servicoId}: ${result.error}`);
        }
      } catch (error) {
        console.error(`[syncAllPendingServicos] Erro ao sincronizar ${servicoId}:`, error);
        failedCount += 1;
      }
    }

    // Remove os serviços ruins da fila para evitar loop infinito
    if (servicosARemover.length > 0) {
      const remainingPending = pendingIds.filter((id) => !servicosARemover.includes(id));
      await AsyncStorage.setItem(pendingKey, JSON.stringify(remainingPending));
      console.log(`[syncAllPendingServicos] Removidos ${servicosARemover.length} serviços inválidos da fila`);

      // Também remove do mapa
      const updatedMap = { ...mapObj };
      servicosARemover.forEach((id) => delete updatedMap[id]);
      await AsyncStorage.setItem(mapKey, JSON.stringify(updatedMap));
    }

    console.log(`📊 [syncAllPendingServicos] Resultado: ${successCount} sucesso, ${failedCount} falhas`);
    return { success: successCount, failed: failedCount };
  } catch (error) {
    console.error('Erro ao sincronizar serviços pendentes:', error);
    captureError(error);
    return { success: 0, failed: 0 };
  }
}

/**
 * Deleta um serviço (local e remoto)
 * Suas fotos também são deletadas do Supabase Storage
 */
export async function deleteServico(servicoId: string, obraId: string): Promise<boolean> {
  try {
    // Deleta remotamente (se conectado)
    const { error: deleteError } = await supabase
      .from('servicos')
      .delete()
      .eq('id', servicoId);

    if (deleteError && deleteError.code !== 'PGRST116') {
      console.warn('Erro ao deletar serviço remotamente:', deleteError);
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
    console.error('Erro ao deletar serviço:', error);
    captureError(error);
    return false;
  }
}

/**
 * Fetch serviços de uma obra do Supabase
 */
export async function fetchServicosForObra(obraId: string): Promise<Servico[]> {
  try {
    const local = await getLocalServicos(obraId);

    if (!isUuid(obraId)) {
      return local as unknown as Servico[];
    }

    const netState = await NetInfo.fetch();
    const isOnline = netState.isConnected === true && netState.isInternetReachable !== false;
    if (!isOnline) {
      return local as unknown as Servico[];
    }

    const { data, error } = await supabase
      .from('servicos')
      .select('*')
      .eq('obra_id', obraId)
      .order('created_at', { ascending: true });

    if (error) throw error;

    const remote = data || [];

    // Cachear serviços remotos localmente para suporte offline
    // Isso permite que appendPhotoToServicoLocal encontre serviços mesmo sem conexão
    // existingList é a versão mesclada que será retornada (preserva URIs locais)
    const localKey = `${LOCAL_SERVICOS_KEY}:${obraId}`;
    const existing = await AsyncStorage.getItem(localKey);
    // Começa com o cache local (ou vazio se não houver)
    const existingList: any[] = existing ? JSON.parse(existing) : [...(local as any[])];

    if (remote.length > 0) {
      let changed = false;
      for (const s of remote) {
        const idx = existingList.findIndex((l: any) => l.id === s.id);
        // Ao cachear versão remota, preservar campos de fotos locais que tenham uri
        // (foto offline ainda não sincronizada — {id,uri} local vs [] no Supabase)
        const cached: any = { ...s, sync_status: 'synced' as SyncStatusServico };
        if (idx >= 0) {
          const localItem = existingList[idx];
          // Para cada campo fotos_*, se o local tem objetos com uri mas o remote não tem URLs → manter local
          for (const key of Object.keys(localItem)) {
            if ((key.startsWith('fotos_') || key.startsWith('doc_')) && Array.isArray(localItem[key])) {
              const localPhotos: any[] = localItem[key];
              const remotePhotos: any[] = cached[key] || [];
              const localHasUri = localPhotos.some((p: any) => p && typeof p === 'object' && p.uri);
              // Preserva local se remote não tem URLs reais (vazio ou apenas strings/IDs sem url)
              const remoteHasUrl = remotePhotos.some((p: any) => p && typeof p === 'object' && p.url);
              if (localHasUri && !remoteHasUrl) {
                cached[key] = localPhotos; // Manter local até sync com URL real
              }
            }
          }
          existingList[idx] = cached;
        } else {
          existingList.push(cached);
          changed = true;
        }
      }
      if (changed || remote.length > 0) {
        await AsyncStorage.setItem(localKey, JSON.stringify(existingList));
      }
    }

    // Retorna existingList que já tem remote + local mesclados com preservação de URIs.
    // NÃO usa [...remote, ...local] pois remote teria arrays de fotos vazios que sobrescreveriam URIs locais.
    const merged = existingList.filter(
      (servico: any, index: number, arr: any[]) => arr.findIndex((item: any) => item.id === servico.id) === index
    ) as Servico[];

    return merged;
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    const isNetworkError = /network request failed|failed to fetch|timeout/i.test(message);
    if (isNetworkError) {
      console.warn('Sem conexão para buscar serviços remotos. Usando cache local.');
    } else {
      console.error('Erro ao buscar serviços da obra:', error);
      captureError(error);
    }
    const local = await getLocalServicos(obraId);
    return local as unknown as Servico[];
  }
}

/**
 * Cria um novo serviço (local e remoto)
 */
export async function createServico(
  obraId: string,
  tipoServico: string,
  responsavel?: string,
  obraNumero?: string
): Promise<{ success: boolean; servico?: ServicoLocal; error?: string }> {
  try {
    const now = new Date().toISOString();
    const servico: ServicoLocal = {
      id: `temp-${Date.now()}`, // ID temporário, será substituído pelo servidor
      obra_id: obraId,
      obra_numero: obraNumero,
      tipo_servico: tipoServico as any,
      responsavel,
      status: 'rascunho',
      sync_status: 'offline',
      created_at: now,
      updated_at: now,
      fotos_antes: [],
      fotos_durante: [],
      fotos_depois: [],
    };

    // SEMPRE salva localmente PRIMEIRO (mantém offline-first)
    // Isto também cria a mapping de servicoId -> obraId
    await saveServicoLocal(servico);

    if (!isUuid(obraId)) {
      console.log(`[createServico] Serviço ${servico.id} criado offline para obra local ${obraId}`);
      return { success: true, servico };
    }

    // Depois, tenta sincronizar imediatamente (se online)
    // Mas não bloqueia o retorno baseado no resultado da sync
    const syncResult = await syncServico(servico);
    if (syncResult.success) {
      console.log(`[createServico] Serviço ${servico.id} sincronizado com sucesso`);
    } else {
      console.log(`[createServico] Serviço ${servico.id} criado offline, será sincronizado depois`);
    }

    return { success: true, servico };
  } catch (error: any) {
    console.error('Erro ao criar serviço:', error);
    captureError(error);
    return { success: false, error: error.message };
  }
}

/**
 * Marca um serviço como completo
 */
export async function markServicoComplete(
  servicoId: string,
  obraId: string
): Promise<boolean> {
  try {
    if (!isUuid(obraId) || !isUuid(servicoId)) {
      let key = `${LOCAL_SERVICOS_KEY}:${obraId}`;
      let stored = await AsyncStorage.getItem(key);

      let servicos: ServicoLocal[] = stored ? JSON.parse(stored) : [];
      let index = servicos.findIndex((s) => s.id === servicoId);

      if (index === -1) {
        const allKeys = await AsyncStorage.getAllKeys();
        const serviceKeys = allKeys.filter((k) => k.startsWith(`${LOCAL_SERVICOS_KEY}:`));

        for (const candidateKey of serviceKeys) {
          const candidateStored = await AsyncStorage.getItem(candidateKey);
          if (!candidateStored) continue;

          const candidateServicos: ServicoLocal[] = JSON.parse(candidateStored);
          const candidateIndex = candidateServicos.findIndex((s) => s.id === servicoId);
          if (candidateIndex >= 0) {
            key = candidateKey;
            stored = candidateStored;
            servicos = candidateServicos;
            index = candidateIndex;
            break;
          }
        }
      }

      if (!stored || index === -1) return false;

      servicos[index] = {
        ...servicos[index],
        status: 'completo',
        updated_at: new Date().toISOString(),
        sync_status: 'offline',
      };

      await AsyncStorage.setItem(key, JSON.stringify(servicos));
      await saveServicoLocal(servicos[index]);
      return true;
    }

    // Tenta atualizar remotamente
    const { error } = await supabase
      .from('servicos')
      .update({ status: 'completo', updated_at: new Date().toISOString() })
      .eq('id', servicoId);

    if (error && error.code !== 'PGRST116') {
      console.warn('Erro ao marcar serviço como completo:', error);
    }

    const key = `${LOCAL_SERVICOS_KEY}:${obraId}`;
    const stored = await AsyncStorage.getItem(key);
    if (stored) {
      const servicos: ServicoLocal[] = JSON.parse(stored);
      const index = servicos.findIndex((s) => s.id === servicoId);
      if (index >= 0) {
        servicos[index] = {
          ...servicos[index],
          status: 'completo',
          updated_at: new Date().toISOString(),
          sync_status: 'synced',
          error_message: null,
        };
        await AsyncStorage.setItem(key, JSON.stringify(servicos));
      }
    }

    return true;
  } catch (error) {
    console.error('Erro ao marcar serviço como completo:', error);
    captureError(error);
    return false;
  }
}

/**
 * Adiciona foto local em um campo de fotos do serviço no AsyncStorage.
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
    const key = `${LOCAL_SERVICOS_KEY}:${obraId}`;
    const stored = await AsyncStorage.getItem(key);
    if (!stored) return false;

    const servicos: ServicoLocal[] = JSON.parse(stored);
    const index = servicos.findIndex((s) => s.id === servicoId);
    if (index === -1) return false;

    const currentRaw = (servicos[index] as any)[fieldName];
    let current = [];
    if (typeof currentRaw === 'string') {
      try { current = JSON.parse(currentRaw); } catch {}
    } else {
      current = Array.isArray(currentRaw) ? currentRaw : [];
    }

    const normalized = [...current];

    // Verifica se já existe p/ evitar duplicidade
    const alreadyExists = normalized.some((item: any) => {
      if (typeof item === 'string') return item === photoId;
      if (item && item.id) return item.id === photoId;
      if (item && item.photoId) return item.photoId === photoId;
      return false;
    });

    if (!alreadyExists) {
      // Salva FotoInfo completo com uri local + geolocalização para preview e sync correto
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

    servicos[index] = {
      ...servicos[index],
      [fieldName]: normalized,
      updated_at: new Date().toISOString(),
      sync_status: 'offline',
      error_message: null,
    };

    await AsyncStorage.setItem(key, JSON.stringify(servicos));
    await saveServicoLocal(servicos[index]);
    return true;
  } catch (error) {
    console.error('Erro ao adicionar foto local ao serviço:', error);
    captureError(error);
    return false;
  }
}

/**
 * Atualiza referência de obra nos serviços locais após sincronização da obra
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
    console.error('Erro ao remapear obra_id dos serviços:', error);
    captureError(error);
    return 0;
  }
}
