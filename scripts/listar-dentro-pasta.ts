/**
 * Listar arquivos dentro de uma pasta específica
 */

import { createClient } from '@supabase/supabase-js'

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || ''
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY || ''

if (!supabaseUrl || !supabaseServiceKey) {
  console.error('❌ Faltam variáveis de ambiente')
  process.exit(1)
}

const supabase = createClient(supabaseUrl, supabaseServiceKey)

async function listar() {
  const pasta = 'local_1770343466867_9u3iuqznc'

  console.log(`\n📁 Listando arquivos dentro de ${pasta}...\n`)

  const { data: files, error } = await supabase.storage
    .from('obra-photos')
    .list(pasta, {
      limit: 1000,
      sortBy: { column: 'name', order: 'asc' }
    })

  if (error) {
    console.error('❌ Erro:', error)
    return
  }

  if (!files || files.length === 0) {
    console.log('⚠️  Pasta vazia ou não encontrada')
    return
  }

  console.log(`✅ Encontrados ${files.length} arquivos:\n`)

  files.forEach((f, i) => {
    const url = supabase.storage
      .from('obra-photos')
      .getPublicUrl(`${pasta}/${f.name}`)
      .data.publicUrl

    console.log(`${i + 1}. ${f.name}`)
    console.log(`   URL: ${url}`)
    console.log('')
  })
}

listar()
  .then(() => process.exit(0))
  .catch(err => {
    console.error('❌ Erro:', err)
    process.exit(1)
  })
