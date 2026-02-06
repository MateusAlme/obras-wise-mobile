/**
 * Listar TODOS os arquivos do storage com nomes completos
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
  const { data: files, error } = await supabase.storage
    .from('obra-photos')
    .list('', {
      limit: 10000,
      sortBy: { column: 'created_at', order: 'desc' }
    })

  if (error || !files) {
    console.error('❌ Erro:', error)
    return
  }

  console.log(`\n📁 TODOS OS ${files.length} ARQUIVOS NO STORAGE:\n`)

  files.forEach((f, i) => {
    console.log(`${i + 1}. ${f.name}`)
    console.log(`   Criado: ${f.created_at}`)
    console.log(`   Tamanho: ${(f.metadata?.size || 0 / 1024).toFixed(2)} KB`)
    console.log('')
  })
}

listar()
  .then(() => process.exit(0))
  .catch(err => {
    console.error('❌ Erro:', err)
    process.exit(1)
  })
