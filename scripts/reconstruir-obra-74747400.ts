/**
 * Reconstruir obra 74747400 com fotos do storage
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
  const obraNumero = '74747400'
  const obraId = '40f6b891-e1b7-46e7-b277-2adf295a7887'

  console.log(`\n🔧 Reconstruindo obra ${obraNumero}...\n`)

  // Listar TODAS as fotos do storage
  const { data: files, error: filesError } = await supabase.storage
    .from('obra-photos')
    .list('', {
      limit: 10000,
      sortBy: { column: 'created_at', order: 'asc' }
    })

  if (filesError || !files) {
    console.error('❌ Erro ao listar storage:', filesError)
    return
  }

  console.log(`📁 Total de arquivos no storage: ${files.length}`)

  // Buscar fotos por padrão de nome (timestamp próximo)
  const timestamp = '1770343' // Parte do timestamp visto no screenshot

  const fotosHaste = files.filter(f => f.name.includes('checklist_ponto_haste') && f.name.includes(timestamp))
  const fotosTermometro = files.filter(f => f.name.includes('checklist_ponto_termometro') && f.name.includes(timestamp))
  const fotosPoste = files.filter(f => f.name.includes('checklist_poste_inteiro') && f.name.includes(timestamp))
  const fotosSeccionamento = files.filter(f => f.name.includes('checklist_seccionamento') && f.name.includes(timestamp))
  const fotosAterramento = files.filter(f => f.name.includes('checklist_aterramento') && f.name.includes(timestamp))

  console.log(`\n📸 Fotos encontradas:`)
  console.log(`   Hastes: ${fotosHaste.length}`)
  console.log(`   Termômetros: ${fotosTermometro.length}`)
  console.log(`   Postes: ${fotosPoste.length}`)
  console.log(`   Seccionamentos: ${fotosSeccionamento.length}`)
  console.log(`   Aterramentos: ${fotosAterramento.length}`)

  // Reconstruir estruturas JSONB
  const updates: any = {}

  // POSTES
  if (fotosPoste.length > 0) {
    updates.checklist_postes_data = [{
      id: 'poste_1',
      numero: '1',
      status: 'Retirado',
      isAditivo: false,
      posteInteiro: fotosPoste.map(f => ({
        id: f.name,
        url: supabase.storage.from('obra-photos').getPublicUrl(f.name).data.publicUrl,
        latitude: null,
        longitude: null
      })),
      engaste: [],
      conexao1: [],
      conexao2: [],
      maiorEsforco: [],
      menorEsforco: []
    }]
    console.log(`\n✅ Postes reconstruídos (${fotosPoste.length} fotos)`)
  }

  // SECCIONAMENTOS
  if (fotosSeccionamento.length > 0) {
    updates.checklist_seccionamentos_data = [{
      id: 'seccionamento_1',
      numero: 1,
      fotos: fotosSeccionamento.map(f => ({
        id: f.name,
        url: supabase.storage.from('obra-photos').getPublicUrl(f.name).data.publicUrl,
        latitude: null,
        longitude: null
      }))
    }]
    console.log(`✅ Seccionamentos reconstruídos (${fotosSeccionamento.length} fotos)`)
  }

  // ATERRAMENTOS
  if (fotosAterramento.length > 0) {
    updates.checklist_aterramentos_cerca_data = [{
      id: 'aterramento_1',
      numero: 1,
      fotos: fotosAterramento.map(f => ({
        id: f.name,
        url: supabase.storage.from('obra-photos').getPublicUrl(f.name).data.publicUrl,
        latitude: null,
        longitude: null
      }))
    }]
    console.log(`✅ Aterramentos reconstruídos (${fotosAterramento.length} fotos)`)
  }

  // HASTES E TERMÔMETROS
  if (fotosHaste.length > 0 || fotosTermometro.length > 0) {
    updates.checklist_hastes_termometros_data = [{
      id: 'ponto_1',
      numero: '1',
      isAditivo: false,
      fotoHaste: fotosHaste.map(f => ({
        id: f.name,
        url: supabase.storage.from('obra-photos').getPublicUrl(f.name).data.publicUrl,
        latitude: null,
        longitude: null
      })),
      fotoTermometro: fotosTermometro.map(f => ({
        id: f.name,
        url: supabase.storage.from('obra-photos').getPublicUrl(f.name).data.publicUrl,
        latitude: null,
        longitude: null
      }))
    }]
    console.log(`✅ Hastes/Termômetros reconstruídos (${fotosHaste.length + fotosTermometro.length} fotos)`)
  }

  if (Object.keys(updates).length === 0) {
    console.log('\n⚠️  Nenhuma foto encontrada para reconstruir')
    return
  }

  // Atualizar no banco
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
}

reconstruir()
  .then(() => process.exit(0))
  .catch(err => {
    console.error('❌ Erro:', err)
    process.exit(1)
  })
