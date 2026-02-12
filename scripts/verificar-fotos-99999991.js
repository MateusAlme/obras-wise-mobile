/**
 * Verificar formato das fotos da obra 99999991
 */

const { createClient } = require('@supabase/supabase-js')

const supabaseUrl = 'https://hiuagpzaelcocyxutgdt.supabase.co'
const supabaseServiceKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImhpdWFncHphZWxjb2N5eHV0Z2R0Iiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc2MTc0MTU4MCwiZXhwIjoyMDc3MzE3NTgwfQ.4zXWa-0XcdMF5Zcavc8IKdwOz5TjnMr4blefiiyQWfU'

const supabase = createClient(supabaseUrl, supabaseServiceKey)

async function verificar() {
  console.log('\n🔍 Verificando formato das fotos da obra 99999991...\n')

  // 1. Buscar obra no banco
  const { data: obra, error: obraError } = await supabase
    .from('obras')
    .select('id, obra, tipo_servico, fotos_antes, fotos_durante, fotos_depois, fotos_abertura, fotos_fechamento')
    .eq('obra', '99999991')
    .single()

  if (obraError || !obra) {
    console.error('❌ Erro ao buscar obra:', obraError)
    return
  }

  console.log('✅ Obra encontrada:', obra.id)
  console.log('   Tipo de serviço:', obra.tipo_servico)
  console.log('\n📊 DADOS DAS FOTOS:\n')

  const analisarCampo = (nome, dados) => {
    console.log(`\n--- ${nome} ---`)
    console.log('  Tipo:', typeof dados)
    console.log('  É array:', Array.isArray(dados))

    if (!dados) {
      console.log('  Valor: NULL')
      return
    }

    if (Array.isArray(dados)) {
      console.log('  Quantidade:', dados.length)
      if (dados.length > 0) {
        console.log('  Primeiro item:')
        console.log('    Tipo:', typeof dados[0])
        if (typeof dados[0] === 'object') {
          console.log('    Tem URL?:', !!dados[0]?.url)
          console.log('    Campos:', Object.keys(dados[0] || {}))
          console.log('    Valor completo:', JSON.stringify(dados[0], null, 2))
        } else if (typeof dados[0] === 'string') {
          console.log('    Valor:', dados[0].substring(0, 100) + '...')
        }
      }
    } else {
      console.log('  Valor bruto:', JSON.stringify(dados).substring(0, 200))
    }
  }

  analisarCampo('fotos_antes', obra.fotos_antes)
  analisarCampo('fotos_durante', obra.fotos_durante)
  analisarCampo('fotos_depois', obra.fotos_depois)
  analisarCampo('fotos_abertura', obra.fotos_abertura)
  analisarCampo('fotos_fechamento', obra.fotos_fechamento)

  console.log('\n\n📊 DADOS BRUTOS COMPLETOS:\n')
  console.log(JSON.stringify({
    fotos_antes: obra.fotos_antes,
    fotos_durante: obra.fotos_durante,
    fotos_depois: obra.fotos_depois,
  }, null, 2))
}

verificar().then(() => process.exit(0))
