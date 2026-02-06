/**
 * Script para verificar estado completo da obra
 */

import { createClient } from '@supabase/supabase-js'

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || ''
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY || ''

if (!supabaseUrl || !supabaseServiceKey) {
  console.error('❌ Faltam variáveis de ambiente')
  process.exit(1)
}

const supabase = createClient(supabaseUrl, supabaseServiceKey)

async function verificarEstado() {
  const obraNumero = '74747400'

  console.log(`\n🔍 Estado completo da obra ${obraNumero}...\n`)

  const { data: obra, error } = await supabase
    .from('obras')
    .select('id, obra, checklist_postes_data, checklist_seccionamentos_data, checklist_aterramentos_cerca_data, checklist_hastes_termometros_data')
    .eq('obra', obraNumero)
    .single()

  if (error || !obra) {
    console.error('❌ Erro ao buscar obra:', error)
    return
  }

  console.log('✅ Obra encontrada:', obra.id)

  console.log('\n📊 POSTES:')
  if (obra.checklist_postes_data && Array.isArray(obra.checklist_postes_data)) {
    console.log(`  Total: ${obra.checklist_postes_data.length} postes`)
    obra.checklist_postes_data.forEach((poste: any, i: number) => {
      console.log(`  Poste ${i + 1}:`)
      console.log(`    - Número: ${poste.numero}`)
      console.log(`    - Status: ${poste.status}`)
      console.log(`    - Inteiro: ${poste.posteInteiro?.length || 0} fotos`)
      console.log(`    - Engaste: ${poste.engaste?.length || 0} fotos`)

      if (poste.posteInteiro && poste.posteInteiro.length > 0) {
        poste.posteInteiro.forEach((foto: any, j: number) => {
          const url = foto.url || foto.id || foto
          const isLocal = typeof url === 'string' && url.startsWith('file:///')
          console.log(`      [${j}] ${isLocal ? '❌ LOCAL' : '✅'}: ${typeof url === 'string' ? url.substring(0, 60) : JSON.stringify(url).substring(0, 60)}...`)
        })
      }
    })
  } else {
    console.log('  Vazio ou inválido')
  }

  console.log('\n📊 SECCIONAMENTOS:')
  if (obra.checklist_seccionamentos_data && Array.isArray(obra.checklist_seccionamentos_data)) {
    console.log(`  Total: ${obra.checklist_seccionamentos_data.length} seccionamentos`)
    obra.checklist_seccionamentos_data.forEach((sec: any, i: number) => {
      console.log(`  S${sec.numero || (i + 1)}: ${sec.fotos?.length || 0} fotos`)
      if (sec.fotos && sec.fotos.length > 0) {
        sec.fotos.forEach((foto: any, j: number) => {
          const url = foto.url || foto.id || foto
          const isLocal = typeof url === 'string' && url.startsWith('file:///')
          console.log(`    [${j}] ${isLocal ? '❌ LOCAL' : '✅'}: ${typeof url === 'string' ? url.substring(0, 60) : JSON.stringify(url).substring(0, 60)}...`)
        })
      }
    })
  } else {
    console.log('  Vazio ou inválido')
  }

  console.log('\n📊 ATERRAMENTOS:')
  if (obra.checklist_aterramentos_cerca_data && Array.isArray(obra.checklist_aterramentos_cerca_data)) {
    console.log(`  Total: ${obra.checklist_aterramentos_cerca_data.length} aterramentos`)
    obra.checklist_aterramentos_cerca_data.forEach((aterr: any, i: number) => {
      console.log(`  A${aterr.numero || (i + 1)}: ${aterr.fotos?.length || 0} fotos`)
      if (aterr.fotos && aterr.fotos.length > 0) {
        aterr.fotos.forEach((foto: any, j: number) => {
          const url = foto.url || foto.id || foto
          const isLocal = typeof url === 'string' && url.startsWith('file:///')
          console.log(`    [${j}] ${isLocal ? '❌ LOCAL' : '✅'}: ${typeof url === 'string' ? url.substring(0, 60) : JSON.stringify(url).substring(0, 60)}...`)
        })
      }
    })
  } else {
    console.log('  Vazio ou inválido')
  }

  console.log('\n📊 HASTES E TERMÔMETROS:')
  if (obra.checklist_hastes_termometros_data && Array.isArray(obra.checklist_hastes_termometros_data)) {
    console.log(`  Total: ${obra.checklist_hastes_termometros_data.length} pontos`)
    obra.checklist_hastes_termometros_data.forEach((ponto: any, i: number) => {
      console.log(`  P${ponto.numero || (i + 1)}:`)
      console.log(`    - Hastes: ${ponto.fotoHaste?.length || 0} fotos`)
      console.log(`    - Termômetros: ${ponto.fotoTermometro?.length || 0} fotos`)
    })
  } else {
    console.log('  Vazio ou inválido')
  }
}

verificarEstado()
  .then(() => process.exit(0))
  .catch(err => {
    console.error('❌ Erro:', err)
    process.exit(1)
  })
