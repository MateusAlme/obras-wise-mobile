import AsyncStorage from '@react-native-async-storage/async-storage';
import { supabase } from './supabase';

const LOCAL_OBRAS_KEY = '@obras-wise:obras';

interface LocalObra {
  id: string;
  obra: string;
  synced: boolean;
  [key: string]: any;
}

/**
 * Remove obras duplicadas do AsyncStorage
 * Mantém apenas a obra com synced=true (versão do Supabase)
 */
export const removeDuplicateObras = async (): Promise<{
  total: number;
  duplicadas: number;
  removidas: number;
}> => {
  try {
    console.log('🔧 Iniciando limpeza de obras duplicadas...');

    const obrasJson = await AsyncStorage.getItem(LOCAL_OBRAS_KEY);
    if (!obrasJson) {
      console.log('📭 Nenhuma obra local encontrada');
      return { total: 0, duplicadas: 0, removidas: 0 };
    }

    const obras: LocalObra[] = JSON.parse(obrasJson);
    console.log(`📊 Total de obras: ${obras.length}`);

    // Agrupar por número da obra
    const obrasPorNumero = new Map<string, LocalObra[]>();

    for (const obra of obras) {
      const numero = obra.obra;
      if (!obrasPorNumero.has(numero)) {
        obrasPorNumero.set(numero, []);
      }
      obrasPorNumero.get(numero)!.push(obra);
    }

    // Encontrar duplicatas
    const duplicadas = Array.from(obrasPorNumero.entries()).filter(
      ([_, obras]) => obras.length > 1
    );

    console.log(`🔍 Encontradas ${duplicadas.length} obra(s) duplicada(s)`);

    if (duplicadas.length === 0) {
      console.log('✅ Nenhuma duplicata encontrada');
      return { total: obras.length, duplicadas: 0, removidas: 0 };
    }

    // Para cada obra duplicada, manter apenas a versão sincronizada
    const obrasParaManter: LocalObra[] = [];
    let removidas = 0;

    for (const obra of obras) {
      const duplicatasDestaObra = obrasPorNumero.get(obra.obra) || [];

      if (duplicatasDestaObra.length === 1) {
        // Não é duplicata, manter
        obrasParaManter.push(obra);
      } else {
        // É duplicata - manter apenas se for a versão sincronizada
        const obraSincronizada = duplicatasDestaObra.find(o => o.synced === true);
        const obraNaoSincronizada = duplicatasDestaObra.find(o => o.synced === false);

        if (obraSincronizada && obra.id === obraSincronizada.id) {
          // É a versão sincronizada, manter
          console.log(`  ✅ Mantendo obra ${obra.obra} (ID: ${obra.id}, synced: true)`);
          obrasParaManter.push(obra);
        } else if (obraNaoSincronizada && obra.id === obraNaoSincronizada.id) {
          // É a versão não sincronizada, remover
          console.log(`  ❌ Removendo obra ${obra.obra} (ID: ${obra.id}, synced: false)`);
          removidas++;
        } else {
          // Caso especial: múltiplas versões sincronizadas
          // Manter a mais recente
          const maisRecente = duplicatasDestaObra.sort((a, b) => {
            const dateA = new Date(a.last_modified || a.created_at || 0).getTime();
            const dateB = new Date(b.last_modified || b.created_at || 0).getTime();
            return dateB - dateA;
          })[0];

          if (obra.id === maisRecente.id) {
            console.log(`  ✅ Mantendo versão mais recente: ${obra.obra} (${obra.id})`);
            obrasParaManter.push(obra);
          } else {
            console.log(`  ❌ Removendo versão antiga: ${obra.obra} (${obra.id})`);
            removidas++;
          }
        }
      }
    }

    // Remover duplicatas do array (garantir que cada obra apareça apenas uma vez)
    const obrasUnicas = obrasParaManter.filter((obra, index, self) =>
      index === self.findIndex(o => o.id === obra.id)
    );

    // Salvar obras limpas
    await AsyncStorage.setItem(LOCAL_OBRAS_KEY, JSON.stringify(obrasUnicas));

    console.log(`💾 ${removidas} obra(s) duplicada(s) removida(s)`);
    console.log(`✅ ${obrasUnicas.length} obra(s) mantida(s)`);

    return {
      total: obras.length,
      duplicadas: duplicadas.length,
      removidas
    };
  } catch (error) {
    console.error('❌ Erro ao remover duplicatas:', error);
    throw error;
  }
};

/**
 * Sincroniza status das obras com Supabase
 * Atualiza AsyncStorage com dados corretos do servidor
 */
export const syncObraStatus = async (obraNumero: string): Promise<boolean> => {
  try {
    console.log(`🔄 Sincronizando status da obra ${obraNumero}...`);

    // Buscar obra no Supabase
    const { data: supabaseObra, error } = await supabase
      .from('obras')
      .select('*')
      .eq('obra', obraNumero)
      .single();

    if (error || !supabaseObra) {
      console.error(`❌ Obra ${obraNumero} não encontrada no Supabase`);
      return false;
    }

    console.log(`📊 Obra encontrada: ${supabaseObra.obra}`);
    console.log(`   - Status: ${supabaseObra.status}`);
    console.log(`   - ID: ${supabaseObra.id}`);

    // Atualizar no AsyncStorage
    const obrasJson = await AsyncStorage.getItem(LOCAL_OBRAS_KEY);
    if (!obrasJson) return false;

    const obras: LocalObra[] = JSON.parse(obrasJson);
    const index = obras.findIndex(o => o.obra === obraNumero);

    if (index === -1) {
      console.log(`⚠️ Obra ${obraNumero} não encontrada no AsyncStorage`);
      return false;
    }

    // Atualizar com dados do Supabase
    obras[index] = {
      ...supabaseObra,
      synced: true,
      locallyModified: false,
      origem: 'online',
      last_modified: supabaseObra.updated_at || supabaseObra.created_at,
      created_at: supabaseObra.created_at,
    };

    await AsyncStorage.setItem(LOCAL_OBRAS_KEY, JSON.stringify(obras));

    console.log(`✅ Obra ${obraNumero} atualizada com sucesso`);
    return true;
  } catch (error) {
    console.error('❌ Erro ao sincronizar status:', error);
    return false;
  }
};
