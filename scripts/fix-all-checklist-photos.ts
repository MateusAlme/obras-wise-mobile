/**
 * Script para corrigir TODAS as obras com URLs locais nos campos JSONB
 *
 * Problema: Obras têm "file:///data/user/..." ao invés de URLs públicas do storage
 * Solução: Buscar fotos no storage e atualizar com URLs públicas
 *
 * Uso: npx tsx scripts/fix-all-checklist-photos.ts
 */

import { createClient } from '@supabase/supabase-js'

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || ''
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY || ''

if (!supabaseUrl || !supabaseServiceKey) {
  console.error('❌ Faltam variáveis de ambiente: NEXT_PUBLIC_SUPABASE_URL e SUPABASE_SERVICE_ROLE_KEY')
  process.exit(1)
}

const supabase = createClient(supabaseUrl, supabaseServiceKey)

// Helper: Verificar se URL é local
function isLocalUrl(url: string): boolean {
  return url.startsWith('file:///') || url.startsWith('/data/user/')
}

// Helper: Extrair nome do arquivo do ID
function extractFileName(photoId: string): string {
  // IDs têm formato: temp_timestamp_type_index_timestamp ou local_timestamp_type_index_timestamp
  // O nome do arquivo no storage geralmente é: type_timestamp_hash_index.jpg
  return photoId.replace(/^(temp_|local_)/, '')
}

// Helper: Corrigir um array de fotos
async function fixPhotosArray(photos: any[], storageFiles: any[]): Promise<any[]> {
  if (!Array.isArray(photos) || photos.length === 0) return photos

  return photos.map(photo => {
    // Se já é objeto com URL pública, manter
    if (photo.url && !isLocalUrl(photo.url)) {
      return photo
    }

    // Tentar encontrar arquivo no storage pelo ID
    const photoId = photo.id || ''
    let matchedFile = storageFiles.find(f => f.name.includes(photoId))

    // Se não encontrou, tentar por padrão aproximado
    if (!matchedFile && photoId) {
      const fileName = extractFileName(photoId)
      matchedFile = storageFiles.find(f => f.name.includes(fileName))
    }

    if (matchedFile) {
      const publicUrl = supabase.storage.from('obra-photos').getPublicUrl(matchedFile.name).data.publicUrl
      console.log(`  ✅ Corrigido: ${photoId.substring(0, 50)}...`)
      console.log(`     → ${publicUrl}`)

      return {
        ...photo,
        url: publicUrl
      }
    }

    // Se não encontrou, manter como está (mas avisar)
    console.warn(`  ⚠️  Foto não encontrada no storage: ${photoId}`)
    return photo
  })
}

// Função principal
async function fixAllChecklistPhotos() {
  console.log('\n🔧 Corrigindo URLs de fotos de Checklist de Fiscalização...\n')

  // 1. Buscar todas as obras de Checklist
  console.log('📋 Buscando obras de "Checklist de Fiscalização"...')
  const { data: obras, error: obrasError } = await supabase
    .from('obras')
    .select('id, obra, tipo_servico, checklist_postes_data, checklist_seccionamentos_data, checklist_aterramentos_cerca_data, checklist_hastes_termometros_data')
    .eq('tipo_servico', 'Checklist de Fiscalização')

  if (obrasError || !obras) {
    console.error('❌ Erro ao buscar obras:', obrasError)
    return
  }

  console.log(`✅ Encontradas ${obras.length} obras de Checklist\n`)

  // 2. Listar todos os arquivos no storage
  console.log('📁 Listando arquivos no storage...')
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

  console.log(`✅ ${files.length} arquivos no storage\n`)

  // 3. Processar cada obra
  let obrasCorrigidas = 0
  let obrasComProblema = 0

  for (const obra of obras) {
    let precisaCorrigir = false
    const updates: any = {}

    console.log(`\n📊 Processando obra ${obra.obra} (${obra.id})...`)

    // Verificar e corrigir Postes
    if (obra.checklist_postes_data && Array.isArray(obra.checklist_postes_data)) {
      for (const poste of obra.checklist_postes_data) {
        const hasLocalUrl =
          poste.posteInteiro?.some((p: any) => p.url && isLocalUrl(p.url)) ||
          poste.engaste?.some((p: any) => p.url && isLocalUrl(p.url)) ||
          poste.conexao1?.some((p: any) => p.url && isLocalUrl(p.url)) ||
          poste.conexao2?.some((p: any) => p.url && isLocalUrl(p.url)) ||
          poste.maiorEsforco?.some((p: any) => p.url && isLocalUrl(p.url)) ||
          poste.menorEsforco?.some((p: any) => p.url && isLocalUrl(p.url))

        if (hasLocalUrl) {
          precisaCorrigir = true
          break
        }
      }

      if (precisaCorrigir) {
        console.log('  🔧 Corrigindo Postes...')
        updates.checklist_postes_data = await Promise.all(
          obra.checklist_postes_data.map(async (poste: any) => ({
            ...poste,
            posteInteiro: await fixPhotosArray(poste.posteInteiro || [], files),
            engaste: await fixPhotosArray(poste.engaste || [], files),
            conexao1: await fixPhotosArray(poste.conexao1 || [], files),
            conexao2: await fixPhotosArray(poste.conexao2 || [], files),
            maiorEsforco: await fixPhotosArray(poste.maiorEsforco || [], files),
            menorEsforco: await fixPhotosArray(poste.menorEsforco || [], files),
          }))
        )
      }
    }

    // Verificar e corrigir Seccionamentos
    if (obra.checklist_seccionamentos_data && Array.isArray(obra.checklist_seccionamentos_data)) {
      const hasLocalUrl = obra.checklist_seccionamentos_data.some((sec: any) =>
        sec.fotos?.some((p: any) => p.url && isLocalUrl(p.url))
      )

      if (hasLocalUrl) {
        precisaCorrigir = true
        console.log('  🔧 Corrigindo Seccionamentos...')
        updates.checklist_seccionamentos_data = await Promise.all(
          obra.checklist_seccionamentos_data.map(async (sec: any) => ({
            ...sec,
            fotos: await fixPhotosArray(sec.fotos || [], files)
          }))
        )
      }
    }

    // Verificar e corrigir Aterramentos
    if (obra.checklist_aterramentos_cerca_data && Array.isArray(obra.checklist_aterramentos_cerca_data)) {
      const hasLocalUrl = obra.checklist_aterramentos_cerca_data.some((aterr: any) =>
        aterr.fotos?.some((p: any) => p.url && isLocalUrl(p.url))
      )

      if (hasLocalUrl) {
        precisaCorrigir = true
        console.log('  🔧 Corrigindo Aterramentos...')
        updates.checklist_aterramentos_cerca_data = await Promise.all(
          obra.checklist_aterramentos_cerca_data.map(async (aterr: any) => ({
            ...aterr,
            fotos: await fixPhotosArray(aterr.fotos || [], files)
          }))
        )
      }
    }

    // Verificar e corrigir Hastes/Termômetros
    if (obra.checklist_hastes_termometros_data && Array.isArray(obra.checklist_hastes_termometros_data)) {
      const hasLocalUrl = obra.checklist_hastes_termometros_data.some((ponto: any) =>
        ponto.fotoHaste?.some((p: any) => p.url && isLocalUrl(p.url)) ||
        ponto.fotoTermometro?.some((p: any) => p.url && isLocalUrl(p.url))
      )

      if (hasLocalUrl) {
        precisaCorrigir = true
        console.log('  🔧 Corrigindo Hastes/Termômetros...')
        updates.checklist_hastes_termometros_data = await Promise.all(
          obra.checklist_hastes_termometros_data.map(async (ponto: any) => ({
            ...ponto,
            fotoHaste: await fixPhotosArray(ponto.fotoHaste || [], files),
            fotoTermometro: await fixPhotosArray(ponto.fotoTermometro || [], files)
          }))
        )
      }
    }

    // Atualizar obra se necessário
    if (precisaCorrigir && Object.keys(updates).length > 0) {
      console.log('  💾 Salvando correções...')
      const { error: updateError } = await supabase
        .from('obras')
        .update(updates)
        .eq('id', obra.id)

      if (updateError) {
        console.error(`  ❌ Erro ao atualizar obra ${obra.obra}:`, updateError)
        obrasComProblema++
      } else {
        console.log(`  ✅ Obra ${obra.obra} corrigida com sucesso!`)
        obrasCorrigidas++
      }
    } else {
      console.log(`  ℹ️  Obra ${obra.obra} não precisa de correção`)
    }
  }

  // Resumo final
  console.log('\n' + '='.repeat(60))
  console.log('📊 RESUMO FINAL')
  console.log('='.repeat(60))
  console.log(`✅ Obras corrigidas: ${obrasCorrigidas}`)
  console.log(`⚠️  Obras com problema: ${obrasComProblema}`)
  console.log(`ℹ️  Total processadas: ${obras.length}`)
  console.log('='.repeat(60))
  console.log('\n🎉 Processo concluído!\n')
}

// Executar
fixAllChecklistPhotos()
  .then(() => process.exit(0))
  .catch(err => {
    console.error('❌ Erro fatal:', err)
    process.exit(1)
  })
