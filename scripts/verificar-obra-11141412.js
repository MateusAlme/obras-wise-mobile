/**
 * Verificar estado atual da obra 11141412
 */

const { createClient } = require('@supabase/supabase-js')

const supabaseUrl = 'https://hiuagpzaelcocyxutgdt.supabase.co'
const supabaseServiceKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImhpdWFncHphZWxjb2N5eHV0Z2R0Iiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc2MTc0MTU4MCwiZXhwIjoyMDc3MzE3NTgwfQ.4zXWa-0XcdMF5Zcavc8IKdwOz5TjnMr4blefiiyQWfU'

const supabase = createClient(supabaseUrl, supabaseServiceKey)

async function verificar() {
  console.log('\n🔍 Verificando obra 11141412...\n')

  // 1. Buscar obra no banco
  const { data: obra, error: obraError } = await supabase
    .from('obras')
    .select('id, obra, checklist_seccionamentos_data, checklist_hastes_termometros_data, fotos_checklist_croqui, fotos_checklist_panoramica_inicial, fotos_checklist_panoramica_final, checklist_postes_data, checklist_aterramentos_cerca_data')
    .eq('obra', '11141412')
    .single()

  if (obraError || !obra) {
    console.error('❌ Erro ao buscar obra:', obraError)
    return
  }

  console.log('✅ Obra encontrada:', obra.id)
  console.log('\n📊 ESTADO ATUAL:\n')

  const countPhotos = (data, label) => {
    const count = Array.isArray(data) ? data.length : 0
    console.log(`  ${label}: ${count} item(s)`)
    return count
  }

  countPhotos(obra.fotos_checklist_croqui, 'Croqui')
  countPhotos(obra.fotos_checklist_panoramica_inicial, 'Panorâmica Inicial')
  countPhotos(obra.fotos_checklist_panoramica_final, 'Panorâmica Final')
  countPhotos(obra.checklist_postes_data, 'Postes')
  countPhotos(obra.checklist_seccionamentos_data, 'Seccionamentos')
  countPhotos(obra.checklist_aterramentos_cerca_data, 'Aterramentos')
  countPhotos(obra.checklist_hastes_termometros_data, 'Hastes/Termômetros')

  // 2. Listar arquivos na pasta
  const pasta = 'local_1770342637791_dcb65c99t'
  console.log(`\n📁 Listando arquivos na pasta ${pasta}...\n`)

  const { data: files, error: filesError } = await supabase.storage
    .from('obra-photos')
    .list(pasta, {
      limit: 1000,
      sortBy: { column: 'name', order: 'asc' }
    })

  if (filesError) {
    console.error('❌ Erro ao listar pasta:', filesError)
    return
  }

  console.log(`✅ ${files.length} arquivo(s) encontrado(s):\n`)

  // Agrupar por tipo
  const grupos = {}
  files.forEach(f => {
    const nome = f.name
    if (nome.includes('croqui')) {
      if (!grupos.croqui) grupos.croqui = []
      grupos.croqui.push(nome)
    } else if (nome.includes('panoramica_inicial')) {
      if (!grupos.panoramica_inicial) grupos.panoramica_inicial = []
      grupos.panoramica_inicial.push(nome)
    } else if (nome.includes('panoramica_final')) {
      if (!grupos.panoramica_final) grupos.panoramica_final = []
      grupos.panoramica_final.push(nome)
    } else if (nome.includes('poste_inteiro') || nome.includes('engaste') || nome.includes('conexao') || nome.includes('esforco')) {
      if (!grupos.postes) grupos.postes = []
      grupos.postes.push(nome)
    } else if (nome.includes('seccionamento')) {
      if (!grupos.seccionamentos) grupos.seccionamentos = []
      grupos.seccionamentos.push(nome)
    } else if (nome.includes('aterramento')) {
      if (!grupos.aterramentos) grupos.aterramentos = []
      grupos.aterramentos.push(nome)
    } else if (nome.includes('haste') || nome.includes('termometro')) {
      if (!grupos.hastes_termometros) grupos.hastes_termometros = []
      grupos.hastes_termometros.push(nome)
    }
  })

  Object.keys(grupos).forEach(tipo => {
    console.log(`\n${tipo.toUpperCase()}: ${grupos[tipo].length} foto(s)`)
    grupos[tipo].forEach(nome => console.log(`  - ${nome}`))
  })

  console.log('\n' + '='.repeat(60))
}

verificar()
  .then(() => process.exit(0))
  .catch(err => {
    console.error('❌ Erro:', err)
    process.exit(1)
  })
