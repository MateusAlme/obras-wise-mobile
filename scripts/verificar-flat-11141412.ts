/**
 * Verificar campos flat da obra 11141412
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
  const obraNumero = '11141412'

  const { data: obra, error } = await supabase
    .from('obras')
    .select('id, obra, fotos_checklist_seccionamentos, checklist_seccionamentos_data')
    .eq('obra', obraNumero)
    .single()

  if (error || !obra) {
    console.error('❌ Erro:', error)
    return
  }

  console.log('\n📊 CAMPO FLAT (fotos_checklist_seccionamentos):')
  console.log('Tipo:', typeof obra.fotos_checklist_seccionamentos)
  console.log('Array:', Array.isArray(obra.fotos_checklist_seccionamentos))
  console.log('Tamanho:', obra.fotos_checklist_seccionamentos?.length || 0)
  if (obra.fotos_checklist_seccionamentos && obra.fotos_checklist_seccionamentos.length > 0) {
    console.log('Conteúdo:', JSON.stringify(obra.fotos_checklist_seccionamentos, null, 2))
  }

  console.log('\n📊 CAMPO ESTRUTURADO (checklist_seccionamentos_data):')
  console.log('Tipo:', typeof obra.checklist_seccionamentos_data)
  console.log('Array:', Array.isArray(obra.checklist_seccionamentos_data))
  console.log('Tamanho:', obra.checklist_seccionamentos_data?.length || 0)
  if (obra.checklist_seccionamentos_data && obra.checklist_seccionamentos_data.length > 0) {
    console.log('Conteúdo:', JSON.stringify(obra.checklist_seccionamentos_data, null, 2))
  }
}

verificar()
  .then(() => process.exit(0))
  .catch(err => {
    console.error('❌ Erro:', err)
    process.exit(1)
  })
