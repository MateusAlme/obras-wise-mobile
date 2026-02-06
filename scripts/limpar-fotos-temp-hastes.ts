/**
 * Script para limpar fotos temporárias de hastes/termômetros
 * Remove fotos com IDs temp_ que nunca foram enviadas para o storage
 */

import { createClient } from '@supabase/supabase-js'

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || ''
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY || ''

if (!supabaseUrl || !supabaseServiceKey) {
  console.error('❌ Faltam variáveis de ambiente')
  process.exit(1)
}

const supabase = createClient(supabaseUrl, supabaseServiceKey)

async function limparFotosTemp() {
  const obraNumero = process.argv[2] || '74747400'

  console.log(`\n🧹 Limpando fotos temporárias de hastes/termômetros da obra ${obraNumero}...\n`)

  const { data: obra, error: fetchError } = await supabase
    .from('obras')
    .select('id, obra, checklist_hastes_termometros_data')
    .eq('obra', obraNumero)
    .single()

  if (fetchError || !obra) {
    console.error('❌ Erro ao buscar obra:', fetchError)
    return
  }

  console.log('✅ Obra encontrada:', obra.id)

  const pontosData = obra.checklist_hastes_termometros_data || []

  if (!Array.isArray(pontosData) || pontosData.length === 0) {
    console.log('ℹ️  Nenhum dado de hastes/termômetros encontrado')
    return
  }

  // Filtrar fotos temporárias
  const pontosLimpos = pontosData.map((ponto: any) => {
    const hastesLimpas = (ponto.fotoHaste || []).filter((foto: any) => {
      const isTemp = typeof foto === 'object' && foto.id && foto.id.startsWith('temp_')
      const hasLocalUrl = typeof foto === 'object' && foto.url && foto.url.startsWith('file:///')
      return !(isTemp || hasLocalUrl)
    })

    const termometrosLimpos = (ponto.fotoTermometro || []).filter((foto: any) => {
      const isTemp = typeof foto === 'object' && foto.id && foto.id.startsWith('temp_')
      const hasLocalUrl = typeof foto === 'object' && foto.url && foto.url.startsWith('file:///')
      return !(isTemp || hasLocalUrl)
    })

    return {
      ...ponto,
      fotoHaste: hastesLimpas,
      fotoTermometro: termometrosLimpos
    }
  })

  console.log('\n📊 Antes:', pontosData)
  console.log('\n✨ Depois:', pontosLimpos)

  // Atualizar no banco
  const { error: updateError } = await supabase
    .from('obras')
    .update({ checklist_hastes_termometros_data: pontosLimpos })
    .eq('id', obra.id)

  if (updateError) {
    console.error('❌ Erro ao atualizar:', updateError)
    return
  }

  console.log('\n✅ Fotos temporárias removidas com sucesso!')
  console.log('   As seções de hastes/termômetros agora estão vazias e não aparecerão no relatório.')
  console.log('   O usuário pode re-tirar essas fotos no mobile app se necessário.')
}

limparFotosTemp()
  .then(() => process.exit(0))
  .catch(err => {
    console.error('❌ Erro:', err)
    process.exit(1)
  })
