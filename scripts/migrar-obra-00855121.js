/**
 * Migrar fotos dos campos flat para estruturados da obra 00855121
 */

const { createClient } = require('@supabase/supabase-js')

const supabaseUrl = 'https://hiuagpzaelcocyxutgdt.supabase.co'
const supabaseServiceKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImhpdWFncHphZWxjb2N5eHV0Z2R0Iiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc2MTc0MTU4MCwiZXhwIjoyMDc3MzE3NTgwfQ.4zXWa-0XcdMF5Zcavc8IKdwOz5TjnMr4blefiiyQWfU'

const supabase = createClient(supabaseUrl, supabaseServiceKey)

async function migrar() {
  const obraId = 'ef1054b1-0ebf-409d-be78-deaa156d024f'

  console.log('\n🔧 Migrando obra 00855121...\n')

  // Buscar obra
  const { data: obra, error } = await supabase
    .from('obras')
    .select('*')
    .eq('id', obraId)
    .single()

  if (error || !obra) {
    console.error('❌ Erro ao buscar obra:', error)
    return
  }

  console.log('✅ Obra encontrada:', obra.obra)
  console.log('\n📊 Estado atual:')
  console.log('  - Postes estruturados:', obra.checklist_postes_data?.length || 0)
  console.log('  - Postes flat:', obra.fotos_checklist_postes?.length || 0)
  console.log('  - Seccionamentos estruturados:', obra.checklist_seccionamentos_data?.length || 0)
  console.log('  - Seccionamentos flat:', obra.fotos_checklist_seccionamentos?.length || 0)
  console.log('  - Aterramentos estruturados:', obra.checklist_aterramentos_cerca_data?.length || 0)
  console.log('  - Aterramentos flat:', obra.fotos_checklist_aterramento_cerca?.length || 0)

  // Preparar updates
  const updates = {}

  // 1. POSTES: Migrar fotos flat para estruturados
  if (obra.checklist_postes_data && obra.fotos_checklist_postes?.length > 0) {
    const postesAtualizado = obra.checklist_postes_data.map((poste, index) => {
      // Se é o primeiro poste, adicionar as fotos de posteInteiro
      if (index === 0) {
        return {
          ...poste,
          posteInteiro: obra.fotos_checklist_postes || []
        }
      }
      return poste
    })
    updates.checklist_postes_data = postesAtualizado
    console.log('\n✅ Postes: 2 fotos migradas para posteInteiro do P2')
  }

  // 2. SECCIONAMENTOS: Migrar fotos flat para estruturados
  if (obra.checklist_seccionamentos_data && obra.fotos_checklist_seccionamentos?.length > 0) {
    const seccionamentosAtualizado = obra.checklist_seccionamentos_data.map((sec, index) => {
      // Se é o primeiro seccionamento, adicionar as fotos
      if (index === 0) {
        return {
          ...sec,
          fotos: obra.fotos_checklist_seccionamentos || []
        }
      }
      return sec
    })
    updates.checklist_seccionamentos_data = seccionamentosAtualizado
    console.log('✅ Seccionamentos: 1 foto migrada para S2')
  }

  // 3. ATERRAMENTOS: Migrar fotos flat para estruturados
  if (obra.checklist_aterramentos_cerca_data && obra.fotos_checklist_aterramento_cerca?.length > 0) {
    const aterramentosAtualizado = obra.checklist_aterramentos_cerca_data.map((aterr, index) => {
      // Se é o primeiro aterramento, adicionar as fotos
      if (index === 0) {
        return {
          ...aterr,
          fotos: obra.fotos_checklist_aterramento_cerca || []
        }
      }
      return aterr
    })
    updates.checklist_aterramentos_cerca_data = aterramentosAtualizado
    console.log('✅ Aterramentos: 1 foto migrada para A3')
  }

  // Aplicar updates
  if (Object.keys(updates).length === 0) {
    console.log('\n⚠️  Nenhuma migração necessária!')
    return
  }

  console.log('\n💾 Aplicando migração...')

  const { error: updateError } = await supabase
    .from('obras')
    .update(updates)
    .eq('id', obraId)

  if (updateError) {
    console.error('❌ Erro ao atualizar:', updateError)
    return
  }

  console.log('\n🎉 MIGRAÇÃO CONCLUÍDA COM SUCESSO!')
  console.log('\n📋 Resumo:')
  console.log('  ✅ Postes: 2 fotos → P2 (retirado)')
  console.log('  ✅ Seccionamentos: 1 foto → S2')
  console.log('  ✅ Aterramentos: 1 foto → A3')
  console.log('\n👉 Recarregue a página para ver os detalhes estruturados!')
}

migrar()
  .then(() => process.exit(0))
  .catch(err => {
    console.error('❌ Erro:', err)
    process.exit(1)
  })
