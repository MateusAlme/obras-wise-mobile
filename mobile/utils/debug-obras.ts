import AsyncStorage from '@react-native-async-storage/async-storage';

/**
 * Script de diagnóstico para verificar obras perdidas
 * Execute no console do app ou adicione temporariamente em alguma tela
 */

export const debugObras = async () => {
  console.log('🔍 ===== DIAGNÓSTICO DE OBRAS =====');

  try {
    // 1. Verificar obras pendentes de sincronização
    const pendingObrasStr = await AsyncStorage.getItem('@obras_pending_sync');
    const pendingObras = pendingObrasStr ? JSON.parse(pendingObrasStr) : [];
    console.log(`\n📦 Obras Pendentes de Sincronização: ${pendingObras.length}`);
    if (pendingObras.length > 0) {
      pendingObras.forEach((obra: any, index: number) => {
        console.log(`  ${index + 1}. ID: ${obra.id}`);
        console.log(`     Obra: ${obra.obra}`);
        console.log(`     Data: ${obra.data}`);
        console.log(`     Status: ${obra.status || 'N/A'}`);
        console.log(`     Responsável: ${obra.responsavel}`);
      });
    }

    // 2. Verificar obras locais (rascunhos)
    const localObrasStr = await AsyncStorage.getItem('@obras_local');
    const localObras = localObrasStr ? JSON.parse(localObrasStr) : [];
    console.log(`\n📝 Rascunhos Locais: ${localObras.length}`);
    if (localObras.length > 0) {
      localObras.forEach((obra: any, index: number) => {
        console.log(`  ${index + 1}. ID: ${obra.id}`);
        console.log(`     Obra: ${obra.obra}`);
        console.log(`     Data: ${obra.data}`);
        console.log(`     Status: ${obra.status || 'rascunho'}`);
      });
    }

    // 3. Verificar obras na lista de obras
    const obrasListStr = await AsyncStorage.getItem('@obras_list');
    const obrasList = obrasListStr ? JSON.parse(obrasListStr) : [];
    console.log(`\n📋 Lista de Obras: ${obrasList.length}`);
    if (obrasList.length > 0) {
      obrasList.forEach((obra: any, index: number) => {
        console.log(`  ${index + 1}. ID: ${obra.id}`);
        console.log(`     Obra: ${obra.obra || obra.numero_obra}`);
        console.log(`     Origem: ${obra.origem || 'N/A'}`);
        console.log(`     Sincronizado: ${obra.synced ? 'Sim' : 'Não'}`);
      });
    }

    // 4. Verificar todas as chaves do AsyncStorage
    console.log(`\n🔑 Todas as Chaves no AsyncStorage:`);
    const allKeys = await AsyncStorage.getAllKeys();
    const obraKeys = allKeys.filter(key =>
      key.includes('obra') || key.includes('pending') || key.includes('local')
    );
    console.log(`   Chaves relacionadas a obras: ${obraKeys.length}`);
    obraKeys.forEach(key => console.log(`   - ${key}`));

    // 5. Verificar metadados de fotos
    const photoMetadataStr = await AsyncStorage.getItem('@photo_metadata');
    const photoMetadata = photoMetadataStr ? JSON.parse(photoMetadataStr) : [];
    console.log(`\n📸 Metadados de Fotos: ${photoMetadata.length}`);

    // Agrupar fotos por obraId
    const fotosPorObra: { [key: string]: number } = {};
    photoMetadata.forEach((photo: any) => {
      const obraId = photo.obraId;
      fotosPorObra[obraId] = (fotosPorObra[obraId] || 0) + 1;
    });

    console.log(`   Obras com fotos:`);
    Object.entries(fotosPorObra).forEach(([obraId, count]) => {
      console.log(`   - Obra ${obraId}: ${count} foto(s)`);
    });

    console.log('\n🔍 ===== FIM DO DIAGNÓSTICO =====\n');

    return {
      pendingObras,
      localObras,
      obrasList,
      photoMetadata,
      fotosPorObra,
      allKeys: obraKeys
    };
  } catch (error) {
    console.error('❌ Erro no diagnóstico:', error);
    return null;
  }
};

/**
 * Recupera uma obra específica pelo ID
 */
export const recuperarObra = async (obraId: string) => {
  console.log(`🔎 Procurando obra ${obraId}...`);

  try {
    // Verificar em todas as fontes
    const pendingObrasStr = await AsyncStorage.getItem('@obras_pending_sync');
    const pendingObras = pendingObrasStr ? JSON.parse(pendingObrasStr) : [];
    const obraPending = pendingObras.find((o: any) => o.id === obraId);

    if (obraPending) {
      console.log('✅ Obra encontrada em @obras_pending_sync');
      return { fonte: 'pending', obra: obraPending };
    }

    const localObrasStr = await AsyncStorage.getItem('@obras_local');
    const localObras = localObrasStr ? JSON.parse(localObrasStr) : [];
    const obraLocal = localObras.find((o: any) => o.id === obraId);

    if (obraLocal) {
      console.log('✅ Obra encontrada em @obras_local');
      return { fonte: 'local', obra: obraLocal };
    }

    const obrasListStr = await AsyncStorage.getItem('@obras_list');
    const obrasList = obrasListStr ? JSON.parse(obrasListStr) : [];
    const obraList = obrasList.find((o: any) => o.id === obraId);

    if (obraList) {
      console.log('✅ Obra encontrada em @obras_list');
      return { fonte: 'list', obra: obraList };
    }

    console.log('❌ Obra não encontrada em nenhuma fonte');
    return null;
  } catch (error) {
    console.error('❌ Erro ao recuperar obra:', error);
    return null;
  }
};

/**
 * Lista obras criadas hoje
 */
export const obrasDeHoje = async () => {
  console.log('📅 Procurando obras criadas hoje...');

  const hoje = new Date().toISOString().split('T')[0]; // YYYY-MM-DD

  try {
    const debug = await debugObras();
    if (!debug) return [];

    const { pendingObras, localObras, obrasList } = debug;

    const todasObras = [
      ...pendingObras.map((o: any) => ({ ...o, fonte: 'pending' })),
      ...localObras.map((o: any) => ({ ...o, fonte: 'local' })),
      ...obrasList.map((o: any) => ({ ...o, fonte: 'list' }))
    ];

    const obrasHoje = todasObras.filter((obra: any) => {
      const obraData = obra.data?.split('T')[0] || obra.created_at?.split('T')[0];
      return obraData === hoje;
    });

    console.log(`\n✅ Encontradas ${obrasHoje.length} obra(s) criada(s) hoje:`);
    obrasHoje.forEach((obra: any, index: number) => {
      console.log(`  ${index + 1}. ID: ${obra.id}`);
      console.log(`     Obra: ${obra.obra || obra.numero_obra}`);
      console.log(`     Fonte: ${obra.fonte}`);
      console.log(`     Status: ${obra.status || 'N/A'}`);
    });

    return obrasHoje;
  } catch (error) {
    console.error('❌ Erro ao buscar obras de hoje:', error);
    return [];
  }
};
