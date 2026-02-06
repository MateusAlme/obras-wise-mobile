/**
 * Listar TODAS as fotos no storage
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
      sortBy: { column: 'name', order: 'asc' }
    })

  if (error || !files) {
    console.error('❌ Erro:', error)
    return
  }

  console.log(`\n📁 Total: ${files.length} arquivos\n`)

  // Agrupar por tipo
  const grupos: Record<string, string[]> = {}

  files.forEach(f => {
    const parts = f.name.split('_')
    const tipo = parts.slice(0, -2).join('_') // Remove timestamp e index
    if (!grupos[tipo]) grupos[tipo] = []
    grupos[tipo].push(f.name)
  })

  Object.keys(grupos).sort().forEach(tipo => {
    console.log(`\n${tipo}: ${grupos[tipo].length} arquivo(s)`)
    if (grupos[tipo].length <= 5) {
      grupos[tipo].forEach(nome => console.log(`  - ${nome}`))
    } else {
      grupos[tipo].slice(0, 3).forEach(nome => console.log(`  - ${nome}`))
      console.log(`  ... e mais ${grupos[tipo].length - 3} arquivo(s)`)
    }
  })
}

listar()
  .then(() => process.exit(0))
  .catch(err => {
    console.error('❌ Erro:', err)
    process.exit(1)
  })
