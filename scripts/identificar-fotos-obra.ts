/**
 * Script para identificar fotos de uma obra específica no storage
 */

import { createClient } from '@supabase/supabase-js'

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || ''
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY || ''

if (!supabaseUrl || !supabaseServiceKey) {
  console.error('❌ Faltam variáveis de ambiente')
  process.exit(1)
}

const supabase = createClient(supabaseUrl, supabaseServiceKey)

async function identificarFotos() {
  const obraNumero = process.argv[2] || '74747400'

  console.log(`\n🔍 Identificando fotos da obra ${obraNumero}...\n`)

  // 1. Buscar obra no banco
  const { data: obra, error: obraError } = await supabase
    .from('obras')
    .select('id, obra, created_at')
    .eq('obra', obraNumero)
    .single()

  if (obraError || !obra) {
    console.error('❌ Erro ao buscar obra:', obraError)
    return
  }

  console.log('✅ Obra encontrada:')
  console.log(`   Número: ${obra.obra}`)
  console.log(`   UUID: ${obra.id}`)
  console.log(`   Criada em: ${obra.created_at}`)

  // 2. Listar TODAS as fotos do storage
  const { data: files, error: filesError } = await supabase.storage
    .from('obra-photos')
    .list('', {
      limit: 10000,
      sortBy: { column: 'name', order: 'asc' }
    })

  if (filesError || !files) {
    console.error('❌ Erro ao listar storage:', filesError)
    return
  }

  console.log(`\n📁 Total de arquivos no storage: ${files.length}`)

  // 3. Filtrar fotos que podem pertencer a esta obra
  const possiveisFotos = files.filter(f => {
    const nome = f.name.toLowerCase()
    // Critérios de busca:
    // 1. Nome contém o UUID da obra
    // 2. Nome contém o número da obra
    return (
      nome.includes(obra.id.toLowerCase()) ||
      nome.includes(obraNumero)
    )
  })

  console.log(`\n🎯 Fotos identificadas: ${possiveisFotos.length}\n`)

  if (possiveisFotos.length === 0) {
    console.log('⚠️  Nenhuma foto encontrada com os critérios de busca.')
    console.log('\nTentando busca mais ampla...\n')

    // Busca por data próxima
    const obraDate = new Date(obra.created_at)
    const fotasPorData = files.filter(f => {
      if (!f.created_at) return false
      const fotoDate = new Date(f.created_at)
      const diffHoras = Math.abs(fotoDate.getTime() - obraDate.getTime()) / (1000 * 60 * 60)
      return diffHoras < 24 // Fotos criadas até 24h antes/depois da obra
    })

    console.log(`📅 Fotos criadas próximo à data da obra: ${fotasPorData.length}`)
    if (fotasPorData.length > 0 && fotasPorData.length <= 20) {
      console.log('\nFotos encontradas por data:')
      fotasPorData.forEach(f => {
        const url = supabase.storage.from('obra-photos').getPublicUrl(f.name).data.publicUrl
        console.log(`  📸 ${f.name}`)
        console.log(`     Data: ${f.created_at}`)
        console.log(`     URL: ${url}`)
        console.log('')
      })
    }
  } else {
    console.log('Fotos identificadas:')
    possiveisFotos.forEach(f => {
      const url = supabase.storage.from('obra-photos').getPublicUrl(f.name).data.publicUrl
      console.log(`\n📸 ${f.name}`)
      console.log(`   Criada em: ${f.created_at}`)
      console.log(`   Tamanho: ${(f.metadata?.size || 0 / 1024).toFixed(2)} KB`)
      console.log(`   URL: ${url}`)
    })
  }

  console.log('\n' + '='.repeat(80))
  console.log('💡 PADRÕES DE NOMENCLATURA:')
  console.log('='.repeat(80))
  console.log('Fotos podem ter os seguintes formatos:')
  console.log(`  1. {obraId}_{tipo}_{index}_{timestamp}`)
  console.log(`  2. local_{timestamp}_{random}`)
  console.log(`  3. {obraNumero}_{tipo}_{timestamp}`)
  console.log('='.repeat(80))
}

identificarFotos()
  .then(() => process.exit(0))
  .catch(err => {
    console.error('❌ Erro:', err)
    process.exit(1)
  })
