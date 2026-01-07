/**
 * Migração de campos de fotos
 *
 * Renomeia campos antigos (sem prefixo fotos_) para o formato novo (com prefixo fotos_)
 *
 * IMPORTANTE: Esta migração é necessária porque mudamos os nomes dos campos
 * para ficar consistente com a interface PendingObra.
 */

import AsyncStorage from '@react-native-async-storage/async-storage';

interface OldPhotoFields {
  // Campos antigos (SEM prefixo fotos_)
  antes?: string[];
  durante?: string[];
  depois?: string[];
  abertura?: string[];
  fechamento?: string[];
  ditais_abertura?: string[];
  ditais_impedir?: string[];
  ditais_testar?: string[];
  ditais_aterrar?: string[];
  ditais_sinalizar?: string[];
  aterramento_vala_aberta?: string[];
  aterramento_hastes?: string[];
  aterramento_vala_fechada?: string[];
  aterramento_medicao?: string[];
  transformador_laudo?: string[];
  transformador_componente_instalado?: string[];
  transformador_tombamento_instalado?: string[];
  transformador_tape?: string[];
  transformador_placa_instalado?: string[];
  transformador_instalado?: string[];
  transformador_conexoes_primarias_instalado?: string[];
  transformador_conexoes_secundarias_instalado?: string[];
  transformador_antes_retirar?: string[];
  transformador_tombamento_retirado?: string[];
  transformador_placa_retirado?: string[];
  transformador_conexoes_primarias_retirado?: string[];
  transformador_conexoes_secundarias_retirado?: string[];
  medidor_padrao?: string[];
  medidor_leitura?: string[];
  medidor_selo_born?: string[];
  medidor_selo_caixa?: string[];
  medidor_identificador_fase?: string[];
  altimetria_lado_fonte?: string[];
  altimetria_medicao_fonte?: string[];
  altimetria_lado_carga?: string[];
  altimetria_medicao_carga?: string[];
  vazamento_evidencia?: string[];
  vazamento_equipamentos_limpeza?: string[];
  vazamento_tombamento_retirado?: string[];
  vazamento_placa_retirado?: string[];
  vazamento_tombamento_instalado?: string[];
  vazamento_placa_instalado?: string[];
  vazamento_instalacao?: string[];
  checklist_croqui?: string[];
  checklist_panoramica_inicial?: string[];
  checklist_chede?: string[];
  checklist_aterramento_cerca?: string[];
  checklist_padrao_geral?: string[];
  checklist_padrao_interno?: string[];
  checklist_panoramica_final?: string[];
  checklist_postes?: string[];
  checklist_seccionamentos?: string[];
}

/**
 * Mapeia campo antigo → campo novo
 */
const FIELD_MIGRATION_MAP: Record<string, string> = {
  // Campos padrão
  'antes': 'fotos_antes',
  'durante': 'fotos_durante',
  'depois': 'fotos_depois',
  'abertura': 'fotos_abertura',
  'fechamento': 'fotos_fechamento',

  // DITAIS
  'ditais_abertura': 'fotos_ditais_abertura',
  'ditais_impedir': 'fotos_ditais_impedir',
  'ditais_testar': 'fotos_ditais_testar',
  'ditais_aterrar': 'fotos_ditais_aterrar',
  'ditais_sinalizar': 'fotos_ditais_sinalizar',

  // Aterramento
  'aterramento_vala_aberta': 'fotos_aterramento_vala_aberta',
  'aterramento_hastes': 'fotos_aterramento_hastes',
  'aterramento_vala_fechada': 'fotos_aterramento_vala_fechada',
  'aterramento_medicao': 'fotos_aterramento_medicao',

  // Transformador
  'transformador_laudo': 'fotos_transformador_laudo',
  'transformador_componente_instalado': 'fotos_transformador_componente_instalado',
  'transformador_tombamento_instalado': 'fotos_transformador_tombamento_instalado',
  'transformador_tape': 'fotos_transformador_tape',
  'transformador_placa_instalado': 'fotos_transformador_placa_instalado',
  'transformador_instalado': 'fotos_transformador_instalado',
  'transformador_conexoes_primarias_instalado': 'fotos_transformador_conexoes_primarias_instalado',
  'transformador_conexoes_secundarias_instalado': 'fotos_transformador_conexoes_secundarias_instalado',
  'transformador_antes_retirar': 'fotos_transformador_antes_retirar',
  'transformador_tombamento_retirado': 'fotos_transformador_tombamento_retirado',
  'transformador_placa_retirado': 'fotos_transformador_placa_retirado',
  'transformador_conexoes_primarias_retirado': 'fotos_transformador_conexoes_primarias_retirado',
  'transformador_conexoes_secundarias_retirado': 'fotos_transformador_conexoes_secundarias_retirado',

  // Medidor
  'medidor_padrao': 'fotos_medidor_padrao',
  'medidor_leitura': 'fotos_medidor_leitura',
  'medidor_selo_born': 'fotos_medidor_selo_born',
  'medidor_selo_caixa': 'fotos_medidor_selo_caixa',
  'medidor_identificador_fase': 'fotos_medidor_identificador_fase',

  // Altimetria
  'altimetria_lado_fonte': 'fotos_altimetria_lado_fonte',
  'altimetria_medicao_fonte': 'fotos_altimetria_medicao_fonte',
  'altimetria_lado_carga': 'fotos_altimetria_lado_carga',
  'altimetria_medicao_carga': 'fotos_altimetria_medicao_carga',

  // Vazamento
  'vazamento_evidencia': 'fotos_vazamento_evidencia',
  'vazamento_equipamentos_limpeza': 'fotos_vazamento_equipamentos_limpeza',
  'vazamento_tombamento_retirado': 'fotos_vazamento_tombamento_retirado',
  'vazamento_placa_retirado': 'fotos_vazamento_placa_retirado',
  'vazamento_tombamento_instalado': 'fotos_vazamento_tombamento_instalado',
  'vazamento_placa_instalado': 'fotos_vazamento_placa_instalado',
  'vazamento_instalacao': 'fotos_vazamento_instalacao',

  // Checklist
  'checklist_croqui': 'fotos_checklist_croqui',
  'checklist_panoramica_inicial': 'fotos_checklist_panoramica_inicial',
  'checklist_chede': 'fotos_checklist_chede',
  'checklist_aterramento_cerca': 'fotos_checklist_aterramento_cerca',
  'checklist_padrao_geral': 'fotos_checklist_padrao_geral',
  'checklist_padrao_interno': 'fotos_checklist_padrao_interno',
  'checklist_panoramica_final': 'fotos_checklist_panoramica_final',
  'checklist_postes': 'fotos_checklist_postes',
  'checklist_seccionamentos': 'fotos_checklist_seccionamentos',
};

/**
 * Migra uma obra individual, renomeando campos antigos
 */
function migrateObraFields(obra: any): { obra: any; migrated: boolean } {
  let migrated = false;
  const migratedObra = { ...obra };

  // Iterar sobre todos os campos antigos
  for (const [oldField, newField] of Object.entries(FIELD_MIGRATION_MAP)) {
    // Se obra tem o campo antigo e NÃO tem o campo novo
    if (obra[oldField] !== undefined && obra[newField] === undefined) {
      console.log(`  📝 Migrando campo: ${oldField} → ${newField}`);
      migratedObra[newField] = obra[oldField];
      delete migratedObra[oldField]; // Remove campo antigo
      migrated = true;
    }
  }

  return { obra: migratedObra, migrated };
}

/**
 * Migra todas as obras salvas no AsyncStorage
 */
export async function migrateAllPhotoFields(): Promise<{
  total: number;
  migrated: number;
  errors: number;
}> {
  console.log('🔄 Iniciando migração de campos de fotos...');

  try {
    // 1. Carregar obras locais
    const obrasJson = await AsyncStorage.getItem('@obras_local');

    if (!obrasJson) {
      console.log('ℹ️ Nenhuma obra local encontrada');
      return { total: 0, migrated: 0, errors: 0 };
    }

    const obras = JSON.parse(obrasJson);

    if (!Array.isArray(obras) || obras.length === 0) {
      console.log('ℹ️ Lista de obras vazia');
      return { total: 0, migrated: 0, errors: 0 };
    }

    console.log(`📊 Total de obras: ${obras.length}`);

    // 2. Migrar cada obra
    let migratedCount = 0;
    let errorCount = 0;

    const migratedObras = obras.map((obra: any, index: number) => {
      try {
        console.log(`\n🔍 Verificando obra ${index + 1}/${obras.length}: ${obra.obra || obra.id}`);

        const { obra: migratedObra, migrated } = migrateObraFields(obra);

        if (migrated) {
          console.log(`  ✅ Obra migrada!`);
          migratedCount++;
        } else {
          console.log(`  ⏭️ Obra já está no formato novo (nada a migrar)`);
        }

        return migratedObra;
      } catch (error) {
        console.error(`  ❌ Erro ao migrar obra ${obra.id}:`, error);
        errorCount++;
        return obra; // Mantém obra original em caso de erro
      }
    });

    // 3. Salvar obras migradas
    if (migratedCount > 0) {
      console.log(`\n💾 Salvando ${migratedCount} obra(s) migrada(s)...`);
      await AsyncStorage.setItem('@obras_local', JSON.stringify(migratedObras));
      console.log('✅ Obras migradas salvas com sucesso!');
    }

    // 4. Resultado
    console.log(`\n📊 Resultado da migração:`);
    console.log(`  - Total: ${obras.length}`);
    console.log(`  - Migradas: ${migratedCount}`);
    console.log(`  - Erros: ${errorCount}`);
    console.log(`  - Já no formato novo: ${obras.length - migratedCount - errorCount}`);

    return {
      total: obras.length,
      migrated: migratedCount,
      errors: errorCount,
    };
  } catch (error) {
    console.error('❌ Erro ao migrar campos de fotos:', error);
    throw error;
  }
}

/**
 * Verifica se há obras com campos antigos (precisa migrar)
 */
export async function needsMigration(): Promise<boolean> {
  try {
    const obrasJson = await AsyncStorage.getItem('@obras_local');

    if (!obrasJson) return false;

    const obras = JSON.parse(obrasJson);

    if (!Array.isArray(obras)) return false;

    // Verifica se alguma obra tem campos antigos
    return obras.some(obra => {
      return Object.keys(FIELD_MIGRATION_MAP).some(oldField => {
        return obra[oldField] !== undefined;
      });
    });
  } catch (error) {
    console.error('Erro ao verificar necessidade de migração:', error);
    return false;
  }
}
