/**
 * Script para verificar todas as URLs locais em todas as seções
 */

import { createClient } from '@supabase/supabase-js'

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || ''
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY || ''

if (!supabaseUrl || !supabaseServiceKey) {
  console.error('❌ Faltam variáveis de ambiente')
  process.exit(1)
}

const supabase = createClient(supabaseUrl, supabaseServiceKey)

function findLocalUrls(obj: any, path: string = ''): string[] {
  const localUrls: string[] = []

  if (!obj) return localUrls

  if (typeof obj === 'string') {
    if (obj.startsWith('file:///')) {
      localUrls.push(`${path}: ${obj.substring(0, 100)}...`)
    }
  } else if (Array.isArray(obj)) {
    obj.forEach((item, index) => {
      localUrls.push(...findLocalUrls(item, `${path}[${index}]`))
    })
  } else if (typeof obj === 'object') {
    Object.keys(obj).forEach(key => {
      localUrls.push(...findLocalUrls(obj[key], path ? `${path}.${key}` : key))
    })
  }

  return localUrls
}

async function verificarUrls() {
  const obraId = '40f6b891-e1b7-46e7-b277-2adf295a7887'

  console.log(`\n🔍 Verificando URLs locais na obra...\n`)

  const { data: obra, error } = await supabase
    .from('obras')
    .select('*')
    .eq('id', obraId)
    .single()

  if (error || !obra) {
    console.error('❌ Erro ao buscar obra:', error)
    return
  }

  const localUrls = findLocalUrls(obra)

  if (localUrls.length === 0) {
    console.log('✅ Nenhuma URL local encontrada!')
  } else {
    console.log(`⚠️  Encontradas ${localUrls.length} URLs locais:\n`)
    localUrls.forEach(url => console.log(`  ${url}`))
  }
}

verificarUrls()
  .then(() => process.exit(0))
  .catch(err => {
    console.error('❌ Erro:', err)
    process.exit(1)
  })
