/**
 * Reconstruir obra 11141412 COMPLETA com TODAS as fotos
 */

const { createClient } = require('@supabase/supabase-js')

const supabaseUrl = 'https://hiuagpzaelcocyxutgdt.supabase.co'
const supabaseServiceKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImhpdWFncHphZWxjb2N5eHV0Z2R0Iiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc2MTc0MTU4MCwiZXhwIjoyMDc3MzE3NTgwfQ.4zXWa-0XcdMF5Zcavc8IKdwOz5TjnMr4blefiiyQWfU'

const supabase = createClient(supabaseUrl, supabaseServiceKey)

async function reconstruir() {
  const obraId = '6adf957c-9529-4ae2-9d10-26a3779dbbc9'
  const pasta = 'local_1770342637791_dcb65c99t'

  console.log('\n🔧 Reconstruindo obra 11141412 COMPLETA...\n')

  const baseUrl = `https://hiuagpzaelcocyxutgdt.supabase.co/storage/v1/object/public/obra-photos/${pasta}`

  // Definir TODAS as fotos com URLs corretas
  const updates = {
    // Croqui
    fotos_checklist_croqui: [{
      id: `${pasta}/checklist_croqui_1770342642384_xl2kwb79v_0.jpg`,
      url: `${baseUrl}/checklist_croqui_1770342642384_xl2kwb79v_0.jpg`,
      latitude: null,
      longitude: null
    }],

    // Panorâmica Inicial
    fotos_checklist_panoramica_inicial: [
      {
        id: `${pasta}/checklist_panoramica_inicial_1770342642463_0hmfwa1r5_0.jpg`,
        url: `${baseUrl}/checklist_panoramica_inicial_1770342642463_0hmfwa1r5_0.jpg`,
        latitude: null,
        longitude: null
      },
      {
        id: `${pasta}/checklist_panoramica_inicial_1770342642464_l7xu3kgkp_1.jpg`,
        url: `${baseUrl}/checklist_panoramica_inicial_1770342642464_l7xu3kgkp_1.jpg`,
        latitude: null,
        longitude: null
      }
    ],

    // Panorâmica Final (4 fotos)
    fotos_checklist_panoramica_final: [
      {
        id: `${pasta}/checklist_panoramica_final_1770342648293_eyy25ssd8_0.jpg`,
        url: `${baseUrl}/checklist_panoramica_final_1770342648293_eyy25ssd8_0.jpg`,
        latitude: null,
        longitude: null
      },
      {
        id: `${pasta}/checklist_panoramica_final_1770342648294_ltkfn00z1_1.jpg`,
        url: `${baseUrl}/checklist_panoramica_final_1770342648294_ltkfn00z1_1.jpg`,
        latitude: null,
        longitude: null
      },
      {
        id: `${pasta}/checklist_panoramica_final_1770342649352_9706izmwu_0.jpg`,
        url: `${baseUrl}/checklist_panoramica_final_1770342649352_9706izmwu_0.jpg`,
        latitude: null,
        longitude: null
      },
      {
        id: `${pasta}/checklist_panoramica_final_1770342649466_3nr4njc4n_1.jpg`,
        url: `${baseUrl}/checklist_panoramica_final_1770342649466_3nr4njc4n_1.jpg`,
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
      posteInteiro: [{
        id: `${pasta}/checklist_poste_inteiro_1770342644363_cl88v6h14_0.jpg`,
        url: `${baseUrl}/checklist_poste_inteiro_1770342644363_cl88v6h14_0.jpg`,
        latitude: null,
        longitude: null
      }],
      engaste: [],
      conexao1: [{
        id: `${pasta}/checklist_poste_conexao1_1770342644489_q72xkvyer_0.jpg`,
        url: `${baseUrl}/checklist_poste_conexao1_1770342644489_q72xkvyer_0.jpg`,
        latitude: null,
        longitude: null
      }],
      conexao2: [{
        id: `${pasta}/checklist_poste_conexao2_1770342644492_xjo5t6wdj_0.jpg`,
        url: `${baseUrl}/checklist_poste_conexao2_1770342644492_xjo5t6wdj_0.jpg`,
        latitude: null,
        longitude: null
      }],
      maiorEsforco: [],
      menorEsforco: []
    }],

    // SECCIONAMENTOS (Estruturado) - 2 seccionamentos
    checklist_seccionamentos_data: [
      {
        id: 'seccionamento_1',
        numero: 1,
        fotos: [{
          id: `${pasta}/checklist_seccionamento_1770342646055_v4ih0k907_0.jpg`,
          url: `${baseUrl}/checklist_seccionamento_1770342646055_v4ih0k907_0.jpg`,
          latitude: null,
          longitude: null
        }]
      },
      {
        id: 'seccionamento_2',
        numero: 2,
        fotos: [{
          id: `${pasta}/checklist_seccionamento_1770342647068_rh83bti0c_0.jpg`,
          url: `${baseUrl}/checklist_seccionamento_1770342647068_rh83bti0c_0.jpg`,
          latitude: null,
          longitude: null
        }]
      }
    ],

    // ATERRAMENTOS (Estruturado) - 2 aterramentos
    checklist_aterramentos_cerca_data: [
      {
        id: 'aterramento_1',
        numero: 1,
        fotos: [{
          id: `${pasta}/checklist_aterramento_cerca_1770342646057_925yxxtbs_0.jpg`,
          url: `${baseUrl}/checklist_aterramento_cerca_1770342646057_925yxxtbs_0.jpg`,
          latitude: null,
          longitude: null
        }]
      },
      {
        id: 'aterramento_2',
        numero: 2,
        fotos: [{
          id: `${pasta}/checklist_aterramento_cerca_1770342647070_h0kb33nbo_0.jpg`,
          url: `${baseUrl}/checklist_aterramento_cerca_1770342647070_h0kb33nbo_0.jpg`,
          latitude: null,
          longitude: null
        }]
      }
    ],

    // HASTES E TERMÔMETROS (Estruturado) - 2 pontos
    checklist_hastes_termometros_data: [
      {
        id: 'ponto_1',
        numero: '1',
        isAditivo: false,
        fotoHaste: [{
          id: `${pasta}/checklist_ponto_haste_1770342646064_9qqiyo0s5_0.jpg`,
          url: `${baseUrl}/checklist_ponto_haste_1770342646064_9qqiyo0s5_0.jpg`,
          latitude: null,
          longitude: null
        }],
        fotoTermometro: [{
          id: `${pasta}/checklist_ponto_termometro_1770342648159_xkqru2zhd_0.jpg`,
          url: `${baseUrl}/checklist_ponto_termometro_1770342648159_xkqru2zhd_0.jpg`,
          latitude: null,
          longitude: null
        }]
      },
      {
        id: 'ponto_2',
        numero: '2',
        isAditivo: false,
        fotoHaste: [{
          id: `${pasta}/checklist_ponto_haste_1770342647076_6faibotly_0.jpg`,
          url: `${baseUrl}/checklist_ponto_haste_1770342647076_6faibotly_0.jpg`,
          latitude: null,
          longitude: null
        }],
        fotoTermometro: [{
          id: `${pasta}/checklist_ponto_termometro_1770342649346_y7ezwuxx8_0.jpg`,
          url: `${baseUrl}/checklist_ponto_termometro_1770342649346_y7ezwuxx8_0.jpg`,
          latitude: null,
          longitude: null
        }]
      }
    ]
  }

  console.log('📸 Fotos a serem adicionadas:')
  console.log('  ✅ Croqui: 1 foto')
  console.log('  ✅ Panorâmica Inicial: 2 fotos')
  console.log('  ✅ Postes (estruturado): 3 fotos (1 inteiro + 2 conexões)')
  console.log('  ✅ Seccionamentos (estruturado): 2 seccionamentos com 1 foto cada')
  console.log('  ✅ Aterramentos (estruturado): 2 aterramentos com 1 foto cada')
  console.log('  ✅ Hastes/Termômetros (estruturado): 2 pontos com 2 fotos cada (4 total)')
  console.log('  ✅ Panorâmica Final: 4 fotos')
  console.log('\n💾 Atualizando banco de dados...')

  const { error } = await supabase
    .from('obras')
    .update(updates)
    .eq('id', obraId)

  if (error) {
    console.error('❌ Erro ao atualizar:', error)
    return
  }

  console.log('✅ Obra 11141412 reconstruída com SUCESSO!')
  console.log('\n🎉 TODAS as 18 fotos foram adicionadas aos campos corretos!')
  console.log('   Recarregue a página do relatório para ver as fotos.')
}

reconstruir()
  .then(() => process.exit(0))
  .catch(err => {
    console.error('❌ Erro:', err)
    process.exit(1)
  })
