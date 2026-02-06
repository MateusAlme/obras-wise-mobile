/**
 * Reconstruir seccionamentos com fotos do storage
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
  const obraNumero = process.argv[2] || '11141412'

  console.log(`\n🔧 Reconstruindo seccionamentos da obra ${obraNumero}...\n`)

  const { data: obra, error: obraError } = await supabase
    .from('obras')
    .select('id, obra, checklist_seccionamentos_data')
    .eq('obra', obraNumero)
    .single()

  if (obraError || !obra) {
    console.error('❌ Erro ao buscar obra:', obraError)
    return
  }

  console.log('✅ Obra encontrada:', obra.id)

  // Listar fotos no storage
  const { data: files, error: filesError } = await supabase.storage
    .from('obra-photos')
    .list('', {
      limit: 10000,
      sortBy: { column: 'created_at', order: 'asc' }
    })

  if (filesError || !files) {
    console.error('❌ Erro ao listar storage:', filesError)
    return
  }

  // Filtrar fotos de seccionamento
  const seccionamentoFiles = files.filter(f =>
    f.name.includes('checklist_seccionamento') || f.name.includes('seccionamento')
  )

  console.log(`📁 Total de arquivos no storage: ${files.length}`)
  console.log(`📸 Fotos de seccionamento encontradas: ${seccionamentoFiles.length}`)

  if (seccionamentoFiles.length === 0) {
    console.log('\n⚠️  Nenhuma foto de seccionamento encontrada no storage')
    return
  }

  console.log('\nFotos encontradas:')
  seccionamentoFiles.forEach(f => {
    console.log(`  - ${f.name}`)
  })

  // Reconstruir seccionamentos_data
  const seccionamentosData = obra.checklist_seccionamentos_data || []

  if (seccionamentosData.length === 0) {
    // Criar um seccionamento se não existir
    seccionamentosData.push({
      id: 'seccionamento_1',
      numero: 1,
      fotos: []
    })
  }

  // Adicionar fotos ao primeiro seccionamento
  const fotosReconstruidas = seccionamentoFiles.map(f => {
    const publicUrl = supabase.storage.from('obra-photos').getPublicUrl(f.name).data.publicUrl
    return {
      id: f.name,
      url: publicUrl,
      latitude: null,
      longitude: null
    }
  })

  seccionamentosData[0].fotos = fotosReconstruidas

  console.log(`\n✨ Reconstruído ${fotosReconstruidas.length} foto(s) no seccionamento 1`)

  // Atualizar no banco
  const { error: updateError } = await supabase
    .from('obras')
    .update({ checklist_seccionamentos_data: seccionamentosData })
    .eq('id', obra.id)

  if (updateError) {
    console.error('❌ Erro ao atualizar:', updateError)
    return
  }

  console.log('✅ Seccionamentos reconstruídos com sucesso!')
  console.log('   Recarregue a página do relatório para ver as fotos.')
}

reconstruir()
  .then(() => process.exit(0))
  .catch(err => {
    console.error('❌ Erro:', err)
    process.exit(1)
  })
