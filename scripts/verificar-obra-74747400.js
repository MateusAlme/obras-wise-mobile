/**
 * Verificar se a obra 74747400 foi reconstruída corretamente
 */

const { createClient } = require('@supabase/supabase-js')

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || 'https://hiuagpzaelcocyxutgdt.supabase.co'
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImhpdWFncHphZWxjb2N5eHV0Z2R0Iiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc2MTc0MTU4MCwiZXhwIjoyMDc3MzE3NTgwfQ.4zXWa-0XcdMF5Zcavc8IKdwOz5TjnMr4blefiiyQWfU'

if (!supabaseUrl || !supabaseServiceKey) {
  console.error('❌ Faltam variáveis de ambiente')
  process.exit(1)
}

const supabase = createClient(supabaseUrl, supabaseServiceKey)

async function verificar() {
  const obraId = '40f6b891-e1b7-46e7-b277-2adf295a7887'

  console.log('\n🔍 Verificando obra 74747400...\n')

  const { data: obra, error } = await supabase
    .from('obras')
    .select(`
      id,
      obra,
      fotos_checklist_croqui,
      fotos_checklist_panoramica_inicial,
      fotos_checklist_panoramica_final,
      checklist_postes_data,
      checklist_seccionamentos_data,
      checklist_aterramentos_cerca_data,
      checklist_hastes_termometros_data
    `)
    .eq('id', obraId)
    .single()

  if (error || !obra) {
    console.error('❌ Erro ao buscar obra:', error)
    return
  }

  console.log('✅ Obra encontrada:', obra.obra, '\n')

  // Contar fotos em cada campo
  let totalFotos = 0

  console.log('📊 CAMPOS SIMPLES:')
  console.log('─'.repeat(60))

  const countSimple = (field, name) => {
    const count = Array.isArray(field) ? field.length : 0
    console.log(`  ${name}: ${count} foto(s)`)
    if (count > 0 && Array.isArray(field)) {
      field.forEach((f, i) => {
        if (f && f.url) {
          const shortUrl = f.url.substring(f.url.lastIndexOf('/') + 1)
          console.log(`    [${i}] ${shortUrl}`)
        }
      })
    }
    return count
  }

  totalFotos += countSimple(obra.fotos_checklist_croqui, 'Croqui')
  totalFotos += countSimple(obra.fotos_checklist_panoramica_inicial, 'Panorâmica Inicial')
  totalFotos += countSimple(obra.fotos_checklist_panoramica_final, 'Panorâmica Final')

  console.log('\n📊 CAMPOS ESTRUTURADOS:')
  console.log('─'.repeat(60))

  // Postes
  if (obra.checklist_postes_data && Array.isArray(obra.checklist_postes_data)) {
    console.log(`  Postes: ${obra.checklist_postes_data.length} poste(s)`)
    obra.checklist_postes_data.forEach((poste, i) => {
      const campos = ['posteInteiro', 'engaste', 'conexao1', 'conexao2', 'maiorEsforco', 'menorEsforco']
      campos.forEach(campo => {
        if (poste[campo] && Array.isArray(poste[campo]) && poste[campo].length > 0) {
          console.log(`    [Poste ${i + 1}] ${campo}: ${poste[campo].length} foto(s)`)
          totalFotos += poste[campo].length
        }
      })
    })
  }

  // Seccionamentos
  if (obra.checklist_seccionamentos_data && Array.isArray(obra.checklist_seccionamentos_data)) {
    console.log(`  Seccionamentos: ${obra.checklist_seccionamentos_data.length} item(ns)`)
    obra.checklist_seccionamentos_data.forEach((sec, i) => {
      if (sec.fotos && Array.isArray(sec.fotos)) {
        console.log(`    [Seccionamento ${i + 1}] ${sec.fotos.length} foto(s)`)
        totalFotos += sec.fotos.length
      }
    })
  }

  // Aterramentos
  if (obra.checklist_aterramentos_cerca_data && Array.isArray(obra.checklist_aterramentos_cerca_data)) {
    console.log(`  Aterramentos: ${obra.checklist_aterramentos_cerca_data.length} item(ns)`)
    obra.checklist_aterramentos_cerca_data.forEach((aterr, i) => {
      if (aterr.fotos && Array.isArray(aterr.fotos)) {
        console.log(`    [Aterramento ${i + 1}] ${aterr.fotos.length} foto(s)`)
        totalFotos += aterr.fotos.length
      }
    })
  }

  // Hastes e Termômetros
  if (obra.checklist_hastes_termometros_data && Array.isArray(obra.checklist_hastes_termometros_data)) {
    console.log(`  Hastes/Termômetros: ${obra.checklist_hastes_termometros_data.length} ponto(s)`)
    obra.checklist_hastes_termometros_data.forEach((ponto, i) => {
      const hastes = ponto.fotoHaste && Array.isArray(ponto.fotoHaste) ? ponto.fotoHaste.length : 0
      const termos = ponto.fotoTermometro && Array.isArray(ponto.fotoTermometro) ? ponto.fotoTermometro.length : 0
      console.log(`    [Ponto ${i + 1}] Hastes: ${hastes}, Termômetros: ${termos}`)
      totalFotos += hastes + termos
    })
  }

  console.log('\n' + '═'.repeat(60))
  console.log(`📸 TOTAL DE FOTOS: ${totalFotos}`)
  console.log('═'.repeat(60))

  if (totalFotos === 11) {
    console.log('\n✅ SUCESSO! Todas as 11 fotos foram reconstruídas corretamente!')
  } else {
    console.log(`\n⚠️  ATENÇÃO: Esperado 11 fotos, encontrado ${totalFotos}`)
  }
}

verificar()
  .then(() => process.exit(0))
  .catch(err => {
    console.error('❌ Erro:', err)
    process.exit(1)
  })
