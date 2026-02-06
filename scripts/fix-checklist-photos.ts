/**
 * Script para corrigir estruturas JSONB do checklist com IDs temporários
 *
 * Problema: Obras criadas após reversão do commit têm IDs temp_* nos campos JSONB
 * Solução: Buscar fotos reais no storage e reconstruir os arrays JSONB
 *
 * Uso: npx tsx scripts/fix-checklist-photos.ts <obra_id>
 */

import { createClient } from '@supabase/supabase-js'

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || ''
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY || ''

if (!supabaseUrl || !supabaseServiceKey) {
  console.error('❌ Faltam variáveis de ambiente: NEXT_PUBLIC_SUPABASE_URL e SUPABASE_SERVICE_ROLE_KEY')
  process.exit(1)
}

const supabase = createClient(supabaseUrl, supabaseServiceKey)

interface PhotoFile {
  name: string
  id: string
  created_at: string
  metadata: any
}

async function fixObraChecklistPhotos(obraNumero: string) {
  console.log(`\n🔧 Corrigindo fotos da obra ${obraNumero}...\n`)

  // 1. Buscar a obra no banco
  const { data: obra, error: obraError } = await supabase
    .from('obras')
    .select('id, obra, checklist_postes_data, checklist_seccionamentos_data, checklist_aterramentos_cerca_data')
    .eq('obra', obraNumero)
    .single()

  if (obraError || !obra) {
    console.error('❌ Erro ao buscar obra:', obraError)
    return
  }

  console.log('✅ Obra encontrada:', obra.id)

  // 2. Listar todas as fotos no storage
  const { data: files, error: filesError } = await supabase.storage
    .from('obra-photos')
    .list('', {
      limit: 1000,
      sortBy: { column: 'created_at', order: 'asc' }
    })

  if (filesError || !files) {
    console.error('❌ Erro ao listar fotos:', filesError)
    return
  }

  console.log(`📁 Total de arquivos no storage: ${files.length}`)

  // Filtrar fotos da obra (que contenham o número da obra no nome)
  const obraFiles = files.filter(f =>
    f.name.includes(obraNumero) ||
    f.name.includes(`_${obra.id}_`) ||
    f.name.startsWith('checklist_')
  )

  console.log(`📸 Fotos da obra ${obraNumero}: ${obraFiles.length}\n`)

  // 3. Agrupar fotos por tipo
  const postesFotos: { [key: string]: PhotoFile[] } = {}
  const seccionamentosFotos: PhotoFile[] = []
  const aterramentosFotos: PhotoFile[] = []

  for (const file of obraFiles) {
    const publicUrl = supabase.storage.from('obra-photos').getPublicUrl(file.name).data.publicUrl

    const photoObj: PhotoFile = {
      name: file.name,
      id: file.name,
      created_at: file.created_at || '',
      metadata: file.metadata
    }

    // Postes
    if (file.name.includes('checklist_poste_')) {
      const match = file.name.match(/checklist_poste_(\w+)_/)
      const tipo = match ? match[1] : 'unknown'

      if (!postesFotos[tipo]) postesFotos[tipo] = []
      postesFotos[tipo].push(photoObj)
    }
    // Seccionamentos
    else if (file.name.includes('checklist_seccionamento')) {
      seccionamentosFotos.push(photoObj)
    }
    // Aterramentos
    else if (file.name.includes('checklist_aterramento')) {
      aterramentosFotos.push(photoObj)
    }
  }

  console.log('📊 Fotos agrupadas:')
  console.log('  Postes:', Object.keys(postesFotos).map(k => `${k}: ${postesFotos[k].length}`).join(', '))
  console.log('  Seccionamentos:', seccionamentosFotos.length)
  console.log('  Aterramentos:', aterramentosFotos.length)
  console.log('')

  // 4. Reconstruir JSONB structures
  const updates: any = {}

  // Postes
  if (obra.checklist_postes_data && Array.isArray(obra.checklist_postes_data)) {
    const postesData = obra.checklist_postes_data.map((poste: any, index: number) => {
      const createPhotoArray = (tipo: string) => {
        const fotos = postesFotos[tipo] || []
        return fotos.map(f => ({
          id: f.name,
          url: supabase.storage.from('obra-photos').getPublicUrl(f.name).data.publicUrl,
          latitude: null,
          longitude: null,
        }))
      }

      return {
        ...poste,
        posteInteiro: createPhotoArray('inteiro'),
        engaste: createPhotoArray('engaste'),
        conexao1: createPhotoArray('conexao1'),
        conexao2: createPhotoArray('conexao2'),
        maiorEsforco: createPhotoArray('maior'),
        menorEsforco: createPhotoArray('menor'),
      }
    })

    updates.checklist_postes_data = postesData
    console.log('✅ checklist_postes_data reconstruído')
  }

  // Seccionamentos
  if (obra.checklist_seccionamentos_data && Array.isArray(obra.checklist_seccionamentos_data)) {
    const seccionamentosData = obra.checklist_seccionamentos_data.map((sec: any) => ({
      ...sec,
      fotos: seccionamentosFotos.map(f => ({
        id: f.name,
        url: supabase.storage.from('obra-photos').getPublicUrl(f.name).data.publicUrl,
        latitude: null,
        longitude: null,
      }))
    }))

    updates.checklist_seccionamentos_data = seccionamentosData
    console.log('✅ checklist_seccionamentos_data reconstruído')
  }

  // Aterramentos
  if (obra.checklist_aterramentos_cerca_data && Array.isArray(obra.checklist_aterramentos_cerca_data)) {
    const aterramentosData = obra.checklist_aterramentos_cerca_data.map((aterr: any) => ({
      ...aterr,
      fotos: aterramentosFotos.map(f => ({
        id: f.name,
        url: supabase.storage.from('obra-photos').getPublicUrl(f.name).data.publicUrl,
        latitude: null,
        longitude: null,
      }))
    }))

    updates.checklist_aterramentos_cerca_data = aterramentosData
    console.log('✅ checklist_aterramentos_cerca_data reconstruído')
  }

  // 5. Atualizar no banco
  if (Object.keys(updates).length > 0) {
    console.log('\n💾 Atualizando banco de dados...')

    const { error: updateError } = await supabase
      .from('obras')
      .update(updates)
      .eq('id', obra.id)

    if (updateError) {
      console.error('❌ Erro ao atualizar:', updateError)
    } else {
      console.log('✅ Obra atualizada com sucesso!')
      console.log('\n🎉 Correção concluída! Recarregue a página do relatório.')
    }
  } else {
    console.log('⚠️ Nenhuma atualização necessária')
  }
}

// Executar
const obraNumero = process.argv[2]

if (!obraNumero) {
  console.error('❌ Uso: npx tsx scripts/fix-checklist-photos.ts <numero_obra>')
  console.error('   Exemplo: npx tsx scripts/fix-checklist-photos.ts 00858521')
  process.exit(1)
}

fixObraChecklistPhotos(obraNumero)
  .then(() => process.exit(0))
  .catch(err => {
    console.error('❌ Erro fatal:', err)
    process.exit(1)
  })
