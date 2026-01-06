/**
 * Script para corrigir campo 'origem' e 'status' de obras já salvas no AsyncStorage
 *
 * USAR APENAS UMA VEZ para migrar obras antigas
 */

import AsyncStorage from '@react-native-async-storage/async-storage';
import { supabase } from './supabase';
import type { LocalObra } from './offline-sync';

const LOCAL_OBRAS_KEY = '@obras-wise:obras';

/**
 * Corrige obra comparando com dados do Supabase
 */
export const fixObraOrigemStatus = async (): Promise<{
  total: number;
  corrigidas: number;
  erros: number;
}> => {
  try {
    console.log('🔧 Iniciando correção de obras...');

    // 1. Buscar todas as obras locais
    const localObrasStr = await AsyncStorage.getItem(LOCAL_OBRAS_KEY);
    if (!localObrasStr) {
      console.log('⚠️ Nenhuma obra local encontrada');
      return { total: 0, corrigidas: 0, erros: 0 };
    }

    const localObras: LocalObra[] = JSON.parse(localObrasStr);
    console.log(`📊 Total de obras locais: ${localObras.length}`);

    let corrigidas = 0;
    let erros = 0;

    // 2. Para cada obra, verificar se precisa correção
    for (let i = 0; i < localObras.length; i++) {
      const obra = localObras[i];
      console.log(`\n🔍 Verificando obra ${i + 1}/${localObras.length}: ${obra.obra}`);

      try {
        // Pular se origem já está definida corretamente E status existe
        if (obra.origem && obra.status) {
          console.log(`  ✅ Obra ${obra.obra} já está OK (origem: ${obra.origem}, status: ${obra.status})`);
          continue;
        }

        // Buscar obra no Supabase pelo número
        console.log(`  🔍 Buscando obra ${obra.obra} no Supabase...`);

        let supabaseObra = null;

        // Tentar buscar por ID primeiro (se não for temp_)
        if (obra.id && !obra.id.startsWith('temp_')) {
          const { data, error } = await supabase
            .from('obras')
            .select('*')
            .eq('id', obra.id)
            .single();

          if (!error && data) {
            supabaseObra = data;
            console.log(`  ✅ Encontrada por ID: ${obra.id}`);
          }
        }

        // Se não encontrou por ID, tentar por número + equipe
        if (!supabaseObra) {
          const { data, error } = await supabase
            .from('obras')
            .select('*')
            .eq('obra', obra.obra)
            .eq('equipe', obra.equipe)
            .single();

          if (!error && data) {
            supabaseObra = data;
            console.log(`  ✅ Encontrada por número: ${obra.obra}`);
          } else {
            console.log(`  ⚠️ Obra ${obra.obra} não encontrada no Supabase - será marcada como offline`);
          }
        }

        // Aplicar correções
        let modificada = false;

        if (supabaseObra) {
          // Obra existe no Supabase - marcar como online e atualizar campos
          console.log(`  📝 Corrigindo obra ${obra.obra}:`);

          if (!obra.origem || obra.origem !== 'online') {
            obra.origem = 'online';
            console.log(`    - origem: ${obra.origem || 'undefined'} → 'online'`);
            modificada = true;
          }

          if (!obra.status || obra.status !== supabaseObra.status) {
            const statusAntes = obra.status || 'undefined';
            obra.status = supabaseObra.status;
            console.log(`    - status: ${statusAntes} → '${supabaseObra.status}'`);
            modificada = true;
          }

          if (!obra.synced) {
            obra.synced = true;
            console.log(`    - synced: false → true`);
            modificada = true;
          }

          if (obra.locallyModified) {
            obra.locallyModified = false;
            console.log(`    - locallyModified: true → false`);
            modificada = true;
          }

          // Atualizar ID se for temp_
          if (obra.id.startsWith('temp_') && supabaseObra.id) {
            console.log(`    - ID: ${obra.id} → ${supabaseObra.id}`);
            obra.id = supabaseObra.id;
            obra.serverId = supabaseObra.id;
            modificada = true;
          }

          // Atualizar finalizada_em se existir
          if (supabaseObra.finalizada_em && obra.finalizada_em !== supabaseObra.finalizada_em) {
            obra.finalizada_em = supabaseObra.finalizada_em;
            console.log(`    - finalizada_em: ${obra.finalizada_em || 'undefined'} → '${supabaseObra.finalizada_em}'`);
            modificada = true;
          }

        } else {
          // Obra NÃO existe no Supabase - marcar como offline
          console.log(`  📝 Obra ${obra.obra} não está no Supabase:`);

          if (!obra.origem) {
            obra.origem = 'offline';
            console.log(`    - origem: undefined → 'offline'`);
            modificada = true;
          }

          if (!obra.status) {
            obra.status = 'em_aberto';
            console.log(`    - status: undefined → 'em_aberto'`);
            modificada = true;
          }
        }

        if (modificada) {
          corrigidas++;
          console.log(`  ✅ Obra ${obra.obra} corrigida!`);
        } else {
          console.log(`  ℹ️ Obra ${obra.obra} não precisou de correção`);
        }

      } catch (error) {
        console.error(`  ❌ Erro ao corrigir obra ${obra.obra}:`, error);
        erros++;
      }
    }

    // 3. Salvar todas as obras corrigidas
    if (corrigidas > 0) {
      await AsyncStorage.setItem(LOCAL_OBRAS_KEY, JSON.stringify(localObras));
      console.log(`\n💾 ${corrigidas} obra(s) corrigida(s) e salvas no AsyncStorage`);
    } else {
      console.log(`\n✅ Nenhuma obra precisou de correção`);
    }

    console.log('\n📊 Resumo:');
    console.log(`  - Total: ${localObras.length}`);
    console.log(`  - Corrigidas: ${corrigidas}`);
    console.log(`  - Erros: ${erros}`);

    return { total: localObras.length, corrigidas, erros };

  } catch (error) {
    console.error('❌ Erro fatal ao corrigir obras:', error);
    throw error;
  }
};

/**
 * Verifica status de uma obra específica
 */
export const debugObra = async (obraNumero: string): Promise<void> => {
  try {
    console.log(`\n🔍 Debug da obra ${obraNumero}:`);

    // Buscar no AsyncStorage
    const localObrasStr = await AsyncStorage.getItem(LOCAL_OBRAS_KEY);
    if (!localObrasStr) {
      console.log('❌ Nenhuma obra local encontrada');
      return;
    }

    const localObras: LocalObra[] = JSON.parse(localObrasStr);
    const obraLocal = localObras.find(o => o.obra === obraNumero);

    if (!obraLocal) {
      console.log(`❌ Obra ${obraNumero} não encontrada no AsyncStorage`);
      return;
    }

    console.log('\n📱 AsyncStorage:');
    console.log(`  - ID: ${obraLocal.id}`);
    console.log(`  - Origem: ${obraLocal.origem || 'undefined'}`);
    console.log(`  - Status: ${obraLocal.status || 'undefined'}`);
    console.log(`  - Synced: ${obraLocal.synced}`);
    console.log(`  - LocallyModified: ${obraLocal.locallyModified}`);
    console.log(`  - ServerID: ${obraLocal.serverId || 'undefined'}`);
    console.log(`  - Finalizada em: ${obraLocal.finalizada_em || 'undefined'}`);

    // Buscar no Supabase
    const { data: supabaseObra, error } = await supabase
      .from('obras')
      .select('*')
      .eq('obra', obraNumero)
      .single();

    if (error || !supabaseObra) {
      console.log('\n⚠️ Supabase: Obra não encontrada');
    } else {
      console.log('\n☁️ Supabase:');
      console.log(`  - ID: ${supabaseObra.id}`);
      console.log(`  - Status: ${supabaseObra.status || 'undefined'}`);
      console.log(`  - Finalizada em: ${supabaseObra.finalizada_em || 'undefined'}`);
      console.log(`  - Equipe: ${supabaseObra.equipe}`);
    }

  } catch (error) {
    console.error('❌ Erro ao debugar obra:', error);
  }
};
