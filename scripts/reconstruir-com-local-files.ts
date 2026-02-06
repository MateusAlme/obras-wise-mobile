/**
 * Reconstruir obra 74747400 usando arquivos local_1770343*
 */

import { createClient } from '@supabase/supabase-js'

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || ''
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY || ''

if (!supabaseUrl || !supabaseServiceKey) {
  console.error('❌ Faltam variáveis de ambiente')
  process.exit(1)
}

const supabase = createClient(supabaseUrl, supabaseServiceKey)

async function reconstruir() {
  const obraId = '40f6b891-e1b7-46e7-b277-2adf295a7887'
  const timestampPrefix = '1770343' // Timestamp da obra

  console.log('\n🔧 Reconstruindo obra 74747400 com arquivos local_...\n')

  const { data: files, error } = await supabase.storage
    .from('obra-photos')
    .list('', { limit: 10000 })

  if (error || !files) {
    console.error('❌ Erro:', error)
    return
  }

  // Filtrar arquivos da obra (por timestamp)
  const obraFiles = files.filter(f =>
    f.name.startsWith('local_') && f.name.includes(timestampPrefix)
  ).sort((a, b) => a.name.localeCompare(b.name))

  console.log(`📸 Encontrados ${obraFiles.length} arquivos da obra:\n`)
  obraFiles.forEach((f, i) => {
    console.log(`${i + 1}. ${f.name}`)
  })

  if (obraFiles.length === 0) {
    console.log('\n⚠️  Nenhum arquivo encontrado')
    return
  }

  // Como não temos metadados, vamos distribuir as fotos por seção
  // baseado na ordem e quantidade esperada
  const fotos = obraFiles.map(f => ({
    id: f.name,
    url: supabase.storage.from('obra-photos').getPublicUrl(f.name).data.publicUrl,
    latitude: null,
    longitude: null
  }))

  console.log('\n🎯 Distribuindo fotos nas seções...\n')

  // Assumindo ordem: postes → seccionamento → aterramento → haste → termômetro
  const updates: any = {}

  if (fotos.length >= 2) {
    // Primeiras 2 fotos: Postes
    updates.checklist_postes_data = [{
      id: 'poste_1',
      numero: '1',
      status: 'Retirado',
      isAditivo: false,
      posteInteiro: fotos.slice(0, 2),
      engaste: [],
      conexao1: [],
      conexao2: [],
      maiorEsforco: [],
      menorEsforco: []
    }]
    console.log(`✅ Postes: 2 fotos`)
  }

  if (fotos.length >= 3) {
    // 3ª foto: Seccionamento
    updates.checklist_seccionamentos_data = [{
      id: 'seccionamento_1',
      numero: 1,
      fotos: [fotos[2]]
    }]
    console.log(`✅ Seccionamentos: 1 foto`)
  }

  if (fotos.length >= 4) {
    // 4ª foto: Aterramento
    updates.checklist_aterramentos_cerca_data = [{
      id: 'aterramento_1',
      numero: 1,
      fotos: [fotos[3]]
    }]
    console.log(`✅ Aterramentos: 1 foto`)
  }

  if (fotos.length >= 6) {
    // 5ª e 6ª fotos: Haste e Termômetro
    updates.checklist_hastes_termometros_data = [{
      id: 'ponto_1',
      numero: '1',
      isAditivo: false,
      fotoHaste: [fotos[4]],
      fotoTermometro: [fotos[5]]
    }]
    console.log(`✅ Hastes/Termômetros: 2 fotos (1 haste + 1 termômetro)`)
  }

  console.log(`\n💾 Atualizando banco de dados...`)

  const { error: updateError } = await supabase
    .from('obras')
    .update(updates)
    .eq('id', obraId)

  if (updateError) {
    console.error('❌ Erro ao atualizar:', updateError)
    return
  }

  console.log('✅ Obra 74747400 reconstruída com sucesso!')
  console.log('\n🎉 Recarregue a página do relatório para ver as fotos.')
  console.log('\n⚠️  NOTA: As fotos foram distribuídas por ordem. Verifique se estão nas seções corretas.')
}

reconstruir()
  .then(() => process.exit(0))
  .catch(err => {
    console.error('❌ Erro:', err)
    process.exit(1)
  })
