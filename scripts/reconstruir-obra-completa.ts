/**
 * Reconstruir obra 74747400 COMPLETA com TODAS as fotos
 */

import { createClient } from '@supabase/supabase-js'

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || ''
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY || ''

if (!supabaseUrl || !supabaseServiceKey) {
  console.error('❌ Faltam variáveis de ambiente')
  process.exit(1)
}

const supabase = createClient(supabaseUrl, supabaseServiceKey)

async function reconstruir() {
  const obraId = '40f6b891-e1b7-46e7-b277-2adf295a7887'
  const pasta = 'local_1770343466867_9u3iuqznc'

  console.log('\n🔧 Reconstruindo obra 74747400 COMPLETA...\n')

  const baseUrl = `https://hiuagpzaelcocyxutgdt.supabase.co/storage/v1/object/public/obra-photos/${pasta}`

  // Definir TODAS as fotos com URLs corretas
  const updates = {
    // Croqui
    fotos_checklist_croqui: [{
      id: `${pasta}/checklist_croqui_1770343471431_w78com4yn_0.jpg`,
      url: `${baseUrl}/checklist_croqui_1770343471431_w78com4yn_0.jpg`,
      latitude: null,
      longitude: null
    }],

    // Panorâmica Inicial
    fotos_checklist_panoramica_inicial: [
      {
        id: `${pasta}/checklist_panoramica_inicial_1770343471526_h5xos8lvg_0.jpg`,
        url: `${baseUrl}/checklist_panoramica_inicial_1770343471526_h5xos8lvg_0.jpg`,
        latitude: null,
        longitude: null
      },
      {
        id: `${pasta}/checklist_panoramica_inicial_1770343471527_3d4j3u91h_1.jpg`,
        url: `${baseUrl}/checklist_panoramica_inicial_1770343471527_3d4j3u91h_1.jpg`,
        latitude: null,
        longitude: null
      }
    ],

    // Panorâmica Final
    fotos_checklist_panoramica_final: [
      {
        id: `${pasta}/checklist_panoramica_final_1770343475323_sgbls26lj_0.jpg`,
        url: `${baseUrl}/checklist_panoramica_final_1770343475323_sgbls26lj_0.jpg`,
        latitude: null,
        longitude: null
      },
      {
        id: `${pasta}/checklist_panoramica_final_1770343475483_o6ny7tb2e_1.jpg`,
        url: `${baseUrl}/checklist_panoramica_final_1770343475483_o6ny7tb2e_1.jpg`,
        latitude: null,
        longitude: null
      }
    ],

    // POSTES (Estruturado)
    checklist_postes_data: [{
      id: 'poste_1',
      numero: '1',
      status: 'Retirado',
      isAditivo: false,
      posteInteiro: [
        {
          id: `${pasta}/checklist_poste_inteiro_1770343473378_2dyz2fmrx_0.jpg`,
          url: `${baseUrl}/checklist_poste_inteiro_1770343473378_2dyz2fmrx_0.jpg`,
          latitude: null,
          longitude: null
        },
        {
          id: `${pasta}/checklist_poste_inteiro_1770343473379_zn2w9wcfj_1.jpg`,
          url: `${baseUrl}/checklist_poste_inteiro_1770343473379_zn2w9wcfj_1.jpg`,
          latitude: null,
          longitude: null
        }
      ],
      engaste: [],
      conexao1: [],
      conexao2: [],
      maiorEsforco: [],
      menorEsforco: []
    }],

    // SECCIONAMENTOS (Estruturado)
    checklist_seccionamentos_data: [{
      id: 'seccionamento_1',
      numero: 1,
      fotos: [{
        id: `${pasta}/checklist_seccionamento_1770343473379_n9ykmx37z_0.jpg`,
        url: `${baseUrl}/checklist_seccionamento_1770343473379_n9ykmx37z_0.jpg`,
        latitude: null,
        longitude: null
      }]
    }],

    // ATERRAMENTOS (Estruturado)
    checklist_aterramentos_cerca_data: [{
      id: 'aterramento_1',
      numero: 1,
      fotos: [{
        id: `${pasta}/checklist_aterramento_cerca_1770343475317_vvd3vulf6_0.jpg`,
        url: `${baseUrl}/checklist_aterramento_cerca_1770343475317_vvd3vulf6_0.jpg`,
        latitude: null,
        longitude: null
      }]
    }],

    // HASTES E TERMÔMETROS (Estruturado)
    checklist_hastes_termometros_data: [{
      id: 'ponto_1',
      numero: '1',
      isAditivo: false,
      fotoHaste: [{
        id: `${pasta}/checklist_ponto_haste_1770343477219_tdh7deq05_0.jpg`,
        url: `${baseUrl}/checklist_ponto_haste_1770343477219_tdh7deq05_0.jpg`,
        latitude: null,
        longitude: null
      }],
      fotoTermometro: [{
        id: `${pasta}/checklist_ponto_termometro_1770343477225_1xm48w6c6_0.jpg`,
        url: `${baseUrl}/checklist_ponto_termometro_1770343477225_1xm48w6c6_0.jpg`,
        latitude: null,
        longitude: null
      }]
    }]
  }

  console.log('📸 Fotos a serem adicionadas:')
  console.log('  ✅ Croqui: 1 foto')
  console.log('  ✅ Panorâmica Inicial: 2 fotos')
  console.log('  ✅ Postes (estruturado): 2 fotos')
  console.log('  ✅ Seccionamentos (estruturado): 1 foto')
  console.log('  ✅ Aterramentos (estruturado): 1 foto')
  console.log('  ✅ Hastes/Termômetros (estruturado): 2 fotos (1+1)')
  console.log('  ✅ Panorâmica Final: 2 fotos')
  console.log('\n💾 Atualizando banco de dados...')

  const { error } = await supabase
    .from('obras')
    .update(updates)
    .eq('id', obraId)

  if (error) {
    console.error('❌ Erro ao atualizar:', error)
    return
  }

  console.log('✅ Obra 74747400 reconstruída com SUCESSO!')
  console.log('\n🎉 TODAS as 11 fotos foram adicionadas aos campos corretos!')
  console.log('   Recarregue a página do relatório para ver as fotos.')
}

reconstruir()
  .then(() => process.exit(0))
  .catch(err => {
    console.error('❌ Erro:', err)
    process.exit(1)
  })
