/**
 * Verificar estado da obra ef1054b1-0ebf-409d-be78-deaa156d024f
 */

const { createClient } = require('@supabase/supabase-js')

const supabaseUrl = 'https://hiuagpzaelcocyxutgdt.supabase.co'
const supabaseServiceKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImhpdWFncHphZWxjb2N5eHV0Z2R0Iiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc2MTc0MTU4MCwiZXhwIjoyMDc3MzE3NTgwfQ.4zXWa-0XcdMF5Zcavc8IKdwOz5TjnMr4blefiiyQWfU'

const supabase = createClient(supabaseUrl, supabaseServiceKey)

async function verificar() {
  const obraId = 'ef1054b1-0ebf-409d-be78-deaa156d024f'

  console.log('\n🔍 Verificando obra ef1054b1...\n')

  const { data: obra, error } = await supabase
    .from('obras')
    .select(`
      id,
      obra,
      tipo_servico,
      fotos_checklist_croqui,
      fotos_checklist_panoramica_inicial,
      fotos_checklist_chede,
      fotos_checklist_aterramento_cerca,
      fotos_checklist_padrao_geral,
      fotos_checklist_padrao_interno,
      fotos_checklist_panoramica_final,
      fotos_checklist_postes,
      fotos_checklist_seccionamentos,
      fotos_checklist_hastes_aplicadas,
      fotos_checklist_medicao_termometro,
      checklist_postes_data,
      checklist_seccionamentos_data,
      checklist_aterramentos_cerca_data,
      checklist_hastes_termometros_data,
      checklist_hastes_aplicadas_data,
      checklist_medicao_termometro_data
    `)
    .eq('id', obraId)
    .single()

  if (error || !obra) {
    console.error('❌ Erro ao buscar obra:', error)
    return
  }

  console.log('✅ Obra encontrada:', obra.obra)
  console.log('📋 Tipo de serviço:', obra.tipo_servico)
  console.log('\n' + '='.repeat(80))
  console.log('CAMPOS FLAT (antigos):')
  console.log('='.repeat(80))

  const checkFlat = (field, name) => {
    const value = obra[field]
    const count = Array.isArray(value) ? value.length : 0
    console.log(`  ${name}:`, count, 'item(s)')
    if (count > 0) {
      console.log('    Dados:', JSON.stringify(value, null, 2).substring(0, 200))
    }
  }

  checkFlat('fotos_checklist_croqui', 'Croqui (flat)')
  checkFlat('fotos_checklist_panoramica_inicial', 'Panorâmica Inicial (flat)')
  checkFlat('fotos_checklist_chede', 'CHEDE (flat)')
  checkFlat('fotos_checklist_aterramento_cerca', 'Aterramento Cerca (flat)')
  checkFlat('fotos_checklist_padrao_geral', 'Padrão Geral (flat)')
  checkFlat('fotos_checklist_padrao_interno', 'Padrão Interno (flat)')
  checkFlat('fotos_checklist_panoramica_final', 'Panorâmica Final (flat)')
  checkFlat('fotos_checklist_postes', 'Postes (flat)')
  checkFlat('fotos_checklist_seccionamentos', 'Seccionamentos (flat)')
  checkFlat('fotos_checklist_hastes_aplicadas', 'Hastes Aplicadas (flat)')
  checkFlat('fotos_checklist_medicao_termometro', 'Medição Termômetro (flat)')

  console.log('\n' + '='.repeat(80))
  console.log('CAMPOS ESTRUTURADOS (novos):')
  console.log('='.repeat(80))

  const checkStructured = (field, name) => {
    const value = obra[field]
    const count = Array.isArray(value) ? value.length : 0
    console.log(`  ${name}:`, count, 'item(s)')
    if (count > 0) {
      console.log('    Estrutura:', JSON.stringify(value, null, 2).substring(0, 400))
    }
  }

  checkStructured('checklist_postes_data', 'Postes (estruturado)')
  checkStructured('checklist_seccionamentos_data', 'Seccionamentos (estruturado)')
  checkStructured('checklist_aterramentos_cerca_data', 'Aterramentos (estruturado)')
  checkStructured('checklist_hastes_termometros_data', 'Hastes/Termômetros (estruturado)')
  checkStructured('checklist_hastes_aplicadas_data', 'Hastes Aplicadas OLD (estruturado)')
  checkStructured('checklist_medicao_termometro_data', 'Medição Termômetro OLD (estruturado)')

  console.log('\n' + '='.repeat(80))
}

verificar()
  .then(() => process.exit(0))
  .catch(err => {
    console.error('❌ Erro:', err)
    process.exit(1)
  })
