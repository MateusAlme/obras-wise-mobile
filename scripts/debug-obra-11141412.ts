/**
 * Debug obra 11141412
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
  const obraNumero = '11141412'

  const { data: obra, error } = await supabase
    .from('obras')
    .select('id, obra, checklist_seccionamentos_data, checklist_hastes_termometros_data')
    .eq('obra', obraNumero)
    .single()

  if (error || !obra) {
    console.error('❌ Erro:', error)
    return
  }

  console.log(`\n📊 OBRA ${obraNumero}:\n`)

  console.log('🔷 SECCIONAMENTOS:')
  if (obra.checklist_seccionamentos_data && Array.isArray(obra.checklist_seccionamentos_data)) {
    console.log(`Total: ${obra.checklist_seccionamentos_data.length} seccionamentos`)
    obra.checklist_seccionamentos_data.forEach((sec: any, i: number) => {
      console.log(`\nSeccionamento ${i + 1}:`)
      console.log(`  ID: ${sec.id}`)
      console.log(`  Número: ${sec.numero}`)
      console.log(`  Fotos: ${sec.fotos?.length || 0}`)

      if (sec.fotos && sec.fotos.length > 0) {
        sec.fotos.forEach((foto: any, j: number) => {
          console.log(`    [${j}] Tipo: ${typeof foto}`)
          if (typeof foto === 'object' && foto !== null) {
            console.log(`        ID: ${foto.id}`)
            console.log(`        URL: ${foto.url?.substring(0, 100)}`)
            console.log(`        URL começa com file: ${foto.url?.startsWith('file:///')}`)
          } else if (typeof foto === 'string') {
            console.log(`        String: ${foto.substring(0, 100)}`)
          }
        })
      }
    })
  } else {
    console.log('VAZIO ou INVÁLIDO')
  }

  console.log('\n\n🔷 HASTES E TERMÔMETROS:')
  if (obra.checklist_hastes_termometros_data && Array.isArray(obra.checklist_hastes_termometros_data)) {
    console.log(`Total: ${obra.checklist_hastes_termometros_data.length} pontos`)
    obra.checklist_hastes_termometros_data.forEach((ponto: any, i: number) => {
      console.log(`\nPonto ${i + 1}:`)
      console.log(`  Número: ${ponto.numero}`)
      console.log(`  Hastes: ${ponto.fotoHaste?.length || 0} fotos`)
      console.log(`  Termômetros: ${ponto.fotoTermometro?.length || 0} fotos`)
    })
  } else {
    console.log('VAZIO ou INVÁLIDO')
  }
}

debug()
  .then(() => process.exit(0))
  .catch(err => {
    console.error('❌ Erro:', err)
    process.exit(1)
  })
