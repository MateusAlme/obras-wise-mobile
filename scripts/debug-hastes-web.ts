/**
 * Debug: verificar dados de hastes/termômetros
 */

import { createClient } from '@supabase/supabase-js'

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || ''
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY || ''

if (!supabaseUrl || !supabaseServiceKey) {
  console.error('❌ Faltam variáveis de ambiente')
  process.exit(1)
}

const supabase = createClient(supabaseUrl, supabaseServiceKey)

async function debug() {
  const obraNumero = '74747400'

  const { data: obra, error } = await supabase
    .from('obras')
    .select('id, obra, checklist_hastes_termometros_data')
    .eq('obra', obraNumero)
    .single()

  if (error || !obra) {
    console.error('❌ Erro:', error)
    return
  }

  console.log('\n📊 DADOS RAW DO BANCO:\n')
  console.log(JSON.stringify(obra.checklist_hastes_termometros_data, null, 2))

  console.log('\n📊 ANÁLISE:\n')

  const data = obra.checklist_hastes_termometros_data
  if (!data || !Array.isArray(data) || data.length === 0) {
    console.log('❌ VAZIO ou INVÁLIDO')
    return
  }

  console.log(`✅ ${data.length} ponto(s) encontrado(s)\n`)

  data.forEach((ponto: any, i: number) => {
    console.log(`Ponto ${i + 1}:`)
    console.log(`  - Número: ${ponto.numero}`)
    console.log(`  - Aditivo: ${ponto.isAditivo}`)
    console.log(`  - Hastes: ${ponto.fotoHaste?.length || 0} foto(s)`)
    console.log(`  - Termômetros: ${ponto.fotoTermometro?.length || 0} foto(s)`)

    if (ponto.fotoHaste && ponto.fotoHaste.length > 0) {
      console.log(`\n  Detalhes das hastes:`)
      ponto.fotoHaste.forEach((foto: any, j: number) => {
        console.log(`    [${j}] Tipo: ${typeof foto}`)
        if (typeof foto === 'object') {
          console.log(`        ID: ${foto.id}`)
          console.log(`        URL: ${foto.url?.substring(0, 80)}...`)
        } else {
          console.log(`        Valor: ${foto}`)
        }
      })
    }

    if (ponto.fotoTermometro && ponto.fotoTermometro.length > 0) {
      console.log(`\n  Detalhes dos termômetros:`)
      ponto.fotoTermometro.forEach((foto: any, j: number) => {
        console.log(`    [${j}] Tipo: ${typeof foto}`)
        if (typeof foto === 'object') {
          console.log(`        ID: ${foto.id}`)
          console.log(`        URL: ${foto.url?.substring(0, 80)}...`)
        } else {
          console.log(`        Valor: ${foto}`)
        }
      })
    }
    console.log('')
  })
}

debug()
  .then(() => process.exit(0))
  .catch(err => {
    console.error('❌ Erro:', err)
    process.exit(1)
  })
