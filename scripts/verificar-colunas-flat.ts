/**
 * Verificar se fotos estão nas colunas flat
 */

import { createClient } from '@supabase/supabase-js'

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || ''
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY || ''

if (!supabaseUrl || !supabaseServiceKey) {
  console.error('❌ Faltam variáveis de ambiente')
  process.exit(1)
}

const supabase = createClient(supabaseUrl, supabaseServiceKey)

async function verificar() {
  const obraNumero = '74747400'

  const { data: obra, error } = await supabase
    .from('obras')
    .select('id, obra, checklist_hastes_termometros_data, fotos_checklist_hastes_aplicadas, fotos_checklist_medicao_termometro')
    .eq('obra', obraNumero)
    .single()

  if (error || !obra) {
    console.error('❌ Erro:', error)
    return
  }

  console.log('\n📊 ESTRUTURADA (checklist_hastes_termometros_data):')
  console.log(obra.checklist_hastes_termometros_data)

  console.log('\n📊 FLAT - Hastes (fotos_checklist_hastes_aplicadas):')
  console.log(obra.fotos_checklist_hastes_aplicadas)

  console.log('\n📊 FLAT - Termômetros (fotos_checklist_medicao_termometro):')
  console.log(obra.fotos_checklist_medicao_termometro)
}

verificar()
  .then(() => process.exit(0))
  .catch(err => {
    console.error('❌ Erro:', err)
    process.exit(1)
  })
