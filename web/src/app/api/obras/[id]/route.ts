import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase-admin'

// DELETE: Excluir obra (apenas admin)
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id: obraId } = await params

    // 1. Buscar obra para obter informações das fotos
    const { data: obra, error: fetchError } = await supabaseAdmin
      .from('obras')
      .select('*')
      .eq('id', obraId)
      .single()

    if (fetchError) {
      console.error('Erro ao buscar obra:', fetchError)
      return NextResponse.json(
        { success: false, error: 'Obra não encontrada' },
        { status: 404 }
      )
    }

    // 2. Coletar todas as URLs de fotos para deletar do storage
    const photoFields = [
      'fotos_antes', 'fotos_durante', 'fotos_depois', 'fotos_abertura', 'fotos_fechamento',
      'fotos_ditais_abertura', 'fotos_ditais_impedir', 'fotos_ditais_testar', 'fotos_ditais_aterrar', 'fotos_ditais_sinalizar',
      'fotos_aterramento_vala_aberta', 'fotos_aterramento_hastes', 'fotos_aterramento_vala_fechada', 'fotos_aterramento_medicao',
      'fotos_checklist_croqui', 'fotos_checklist_panoramica_inicial', 'fotos_checklist_chede', 'fotos_checklist_aterramento_cerca',
      'fotos_checklist_padrao_geral', 'fotos_checklist_padrao_interno', 'fotos_checklist_panoramica_final',
      'fotos_checklist_postes', 'fotos_checklist_seccionamentos',
      'fotos_altimetria_lado_fonte', 'fotos_altimetria_medicao_fonte', 'fotos_altimetria_lado_carga', 'fotos_altimetria_medicao_carga',
      'fotos_vazamento_evidencia', 'fotos_vazamento_equipamentos_limpeza', 'fotos_vazamento_tombamento_retirado',
      'fotos_vazamento_placa_retirado', 'fotos_vazamento_tombamento_instalado', 'fotos_vazamento_placa_instalado', 'fotos_vazamento_instalacao',
      'fotos_medidor_padrao', 'fotos_medidor_leitura', 'fotos_medidor_selo_born', 'fotos_medidor_selo_caixa', 'fotos_medidor_identificador_fase',
      'fotos_transformador_laudo', 'fotos_transformador_componente_instalado', 'fotos_transformador_tombamento_instalado',
      'fotos_transformador_tape', 'fotos_transformador_placa_instalado', 'fotos_transformador_instalado',
      'fotos_transformador_antes_retirar', 'fotos_transformador_tombamento_retirado', 'fotos_transformador_placa_retirado',
      'fotos_transformador_conexoes_primarias_instalado', 'fotos_transformador_conexoes_secundarias_instalado',
      'fotos_transformador_conexoes_primarias_retirado', 'fotos_transformador_conexoes_secundarias_retirado',
      'doc_cadastro_medidor', 'doc_laudo_transformador', 'doc_laudo_regulador', 'doc_laudo_religador',
      'doc_apr', 'doc_fvbt', 'doc_termo_desistencia_lpt', 'doc_autorizacao_passagem'
    ]

    const photosToDelete: string[] = []

    for (const field of photoFields) {
      const photos = obra[field]
      if (Array.isArray(photos)) {
        for (const photo of photos) {
          // photo pode ser string (URL) ou objeto com url
          const url = typeof photo === 'string' ? photo : photo?.url
          if (url && url.includes('supabase')) {
            // Extrair o path do storage da URL
            const match = url.match(/\/storage\/v1\/object\/public\/([^?]+)/)
            if (match) {
              photosToDelete.push(match[1])
            }
          }
        }
      }
    }

    // 3. Deletar fotos do storage (em lotes de 100)
    if (photosToDelete.length > 0) {
      console.log(`Deletando ${photosToDelete.length} fotos do storage...`)

      // Agrupar por bucket
      const photosByBucket: Record<string, string[]> = {}
      for (const path of photosToDelete) {
        const [bucket, ...rest] = path.split('/')
        if (!photosByBucket[bucket]) {
          photosByBucket[bucket] = []
        }
        photosByBucket[bucket].push(rest.join('/'))
      }

      for (const [bucket, paths] of Object.entries(photosByBucket)) {
        // Deletar em lotes de 100
        for (let i = 0; i < paths.length; i += 100) {
          const batch = paths.slice(i, i + 100)
          const { error: storageError } = await supabaseAdmin.storage
            .from(bucket)
            .remove(batch)

          if (storageError) {
            console.error(`Erro ao deletar fotos do bucket ${bucket}:`, storageError)
            // Continua mesmo com erro - fotos órfãs podem ser limpas depois
          }
        }
      }
    }

    // 4. Deletar a obra do banco
    const { error: deleteError } = await supabaseAdmin
      .from('obras')
      .delete()
      .eq('id', obraId)

    if (deleteError) {
      console.error('Erro ao deletar obra:', deleteError)
      return NextResponse.json(
        { success: false, error: 'Erro ao deletar obra do banco de dados' },
        { status: 500 }
      )
    }

    console.log(`Obra ${obraId} deletada com sucesso (${photosToDelete.length} fotos removidas)`)

    return NextResponse.json({
      success: true,
      message: 'Obra excluída com sucesso',
      photosDeleted: photosToDelete.length
    })
  } catch (error: any) {
    console.error('Erro ao excluir obra:', error)
    return NextResponse.json(
      { success: false, error: error.message || 'Erro ao excluir obra' },
      { status: 500 }
    )
  }
}
