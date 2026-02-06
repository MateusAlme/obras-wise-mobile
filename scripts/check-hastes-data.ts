/**
 * Script para verificar dados de hastes/termômetros de uma obra
 */

import { createClient } from '@supabase/supabase-js'

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || ''
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY || ''

if (!supabaseUrl || !supabaseServiceKey) {
  console.error('❌ Faltam variáveis de ambiente')
  process.exit(1)
}

const supabase = createClient(supabaseUrl, supabaseServiceKey)

async function checkHastesData() {
  const obraNumero = process.argv[2] || '74747400'

  console.log(`\n🔍 Verificando dados de hastes/termômetros da obra ${obraNumero}...\n`)

  const { data: obra, error } = await supabase
    .from('obras')
    .select('id, obra, checklist_hastes_termometros_data')
    .eq('obra', obraNumero)
    .single()

  if (error || !obra) {
    console.error('❌ Erro ao buscar obra:', error)
    return
  }

  console.log('✅ Obra encontrada:', obra.id)
  console.log('\n📊 checklist_hastes_termometros_data:')
  console.log(JSON.stringify(obra.checklist_hastes_termometros_data, null, 2))
}

checkHastesData()
  .then(() => process.exit(0))
  .catch(err => {
    console.error('❌ Erro:', err)
    process.exit(1)
  })
