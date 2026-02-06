/**
 * Script para remover TODAS as URLs locais de TODAS as seções
 */

import { createClient } from '@supabase/supabase-js'

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || ''
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY || ''

if (!supabaseUrl || !supabaseServiceKey) {
  console.error('❌ Faltam variáveis de ambiente')
  process.exit(1)
}

const supabase = createClient(supabaseUrl, supabaseServiceKey)

function removeLocalUrls(obj: any): any {
  if (!obj) return obj

  if (typeof obj === 'string') {
    // Se é uma URL local, retornar null para remover
    if (obj.startsWith('file:///')) {
      return null
    }
    return obj
  } else if (Array.isArray(obj)) {
    // Filtrar items que resultaram em null e processar recursivamente
    return obj.map(item => removeLocalUrls(item)).filter(item => {
      // Remover nulls e objetos vazios
      if (item === null) return false
      if (typeof item === 'object' && !Array.isArray(item)) {
        // Se é um objeto, verificar se tem pelo menos url válida
        return item.url && !item.url.startsWith('file:///')
      }
      return true
    })
  } else if (typeof obj === 'object') {
    const result: any = {}
    Object.keys(obj).forEach(key => {
      const cleaned = removeLocalUrls(obj[key])
      result[key] = cleaned
    })
    return result
  }

  return obj
}

async function limparTodasUrls() {
  const obraId = '40f6b891-e1b7-46e7-b277-2adf295a7887'

  console.log(`\n🧹 Limpando todas as URLs locais da obra...\n`)

  const { data: obra, error } = await supabase
    .from('obras')
    .select('checklist_postes_data, checklist_seccionamentos_data, checklist_aterramentos_cerca_data, checklist_hastes_termometros_data')
    .eq('id', obraId)
    .single()

  if (error || !obra) {
    console.error('❌ Erro ao buscar obra:', error)
    return
  }

  console.log('📊 Dados ANTES da limpeza:')
  console.log('  Postes:', obra.checklist_postes_data?.length || 0, 'itens')
  console.log('  Seccionamentos:', obra.checklist_seccionamentos_data?.length || 0, 'itens')
  console.log('  Aterramentos:', obra.checklist_aterramentos_cerca_data?.length || 0, 'itens')
  console.log('  Hastes/Termômetros:', obra.checklist_hastes_termometros_data?.length || 0, 'itens')

  const postesLimpos = removeLocalUrls(obra.checklist_postes_data)
  const seccionamentosLimpos = removeLocalUrls(obra.checklist_seccionamentos_data)
  const aterramentosLimpos = removeLocalUrls(obra.checklist_aterramentos_cerca_data)
  const hastesLimpos = removeLocalUrls(obra.checklist_hastes_termometros_data)

  console.log('\n✨ Dados DEPOIS da limpeza:')
  console.log('  Postes:', postesLimpos?.length || 0, 'itens')
  console.log('  Seccionamentos:', seccionamentosLimpos?.length || 0, 'itens')
  console.log('  Aterramentos:', aterramentosLimpos?.length || 0, 'itens')
  console.log('  Hastes/Termômetros:', hastesLimpos?.length || 0, 'itens')

  const { error: updateError } = await supabase
    .from('obras')
    .update({
      checklist_postes_data: postesLimpos,
      checklist_seccionamentos_data: seccionamentosLimpos,
      checklist_aterramentos_cerca_data: aterramentosLimpos,
      checklist_hastes_termometros_data: hastesLimpos
    })
    .eq('id', obraId)

  if (updateError) {
    console.error('❌ Erro ao atualizar:', updateError)
    return
  }

  console.log('\n✅ URLs locais removidas com sucesso!')
  console.log('   Seções vazias não aparecerão no relatório.')
  console.log('   O usuário pode re-tirar as fotos no mobile se necessário.')
}

limparTodasUrls()
  .then(() => process.exit(0))
  .catch(err => {
    console.error('❌ Erro:', err)
    process.exit(1)
  })
