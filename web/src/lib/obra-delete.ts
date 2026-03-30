import { supabaseAdmin } from '@/lib/supabase-admin'

const PHOTO_FIELDS = [
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
  'doc_apr', 'doc_fvbt', 'doc_termo_desistencia_lpt', 'doc_autorizacao_passagem',
] as const

type ObraRecord = {
  id: string
  obra?: string | null
  [key: string]: unknown
}

export interface DeleteObraResult {
  id: string
  obra: string | null
  photosDeleted: number
}

const extractStoragePath = (value: unknown) => {
  const url = typeof value === 'string' ? value : (value as { url?: string } | null)?.url
  if (!url || !url.includes('supabase')) return null

  const match = url.match(/\/storage\/v1\/object\/public\/([^?]+)/)
  return match ? match[1] : null
}

const collectPhotosToDelete = (obra: ObraRecord) => {
  const photosToDelete: string[] = []

  for (const field of PHOTO_FIELDS) {
    const photos = obra[field]
    if (!Array.isArray(photos)) continue

    for (const photo of photos) {
      const path = extractStoragePath(photo)
      if (path) {
        photosToDelete.push(path)
      }
    }
  }

  return photosToDelete
}

const deleteStorageFiles = async (storagePaths: string[]) => {
  if (storagePaths.length === 0) return

  const photosByBucket: Record<string, string[]> = {}

  for (const path of storagePaths) {
    const [bucket, ...rest] = path.split('/')
    if (!bucket || rest.length === 0) continue

    if (!photosByBucket[bucket]) {
      photosByBucket[bucket] = []
    }

    photosByBucket[bucket].push(rest.join('/'))
  }

  for (const [bucket, paths] of Object.entries(photosByBucket)) {
    for (let i = 0; i < paths.length; i += 100) {
      const batch = paths.slice(i, i + 100)
      const { error } = await supabaseAdmin.storage.from(bucket).remove(batch)

      if (error) {
        console.error(`Erro ao deletar fotos do bucket ${bucket}:`, error)
      }
    }
  }
}

export async function deleteObraById(obraId: string): Promise<DeleteObraResult> {
  const { data: obra, error: fetchError } = await supabaseAdmin
    .from('obras')
    .select('*')
    .eq('id', obraId)
    .single()

  if (fetchError || !obra) {
    throw new Error('Obra não encontrada')
  }

  const photosToDelete = collectPhotosToDelete(obra as ObraRecord)
  await deleteStorageFiles(photosToDelete)

  const { error: deleteError } = await supabaseAdmin
    .from('obras')
    .delete()
    .eq('id', obraId)

  if (deleteError) {
    console.error('Erro ao deletar obra:', deleteError)
    throw new Error('Erro ao deletar obra do banco de dados')
  }

  return {
    id: obraId,
    obra: (obra as ObraRecord).obra ?? null,
    photosDeleted: photosToDelete.length,
  }
}

export async function deleteObrasByIds(obraIds: string[]) {
  const uniqueIds = [...new Set(obraIds.filter(Boolean))]
  const deleted: DeleteObraResult[] = []
  const failed: Array<{ id: string; error: string }> = []

  for (const obraId of uniqueIds) {
    try {
      const result = await deleteObraById(obraId)
      deleted.push(result)
    } catch (error: any) {
      failed.push({
        id: obraId,
        error: error?.message || 'Erro ao excluir obra',
      })
    }
  }

  return {
    requested: uniqueIds.length,
    deleted,
    failed,
    photosDeleted: deleted.reduce((total, item) => total + item.photosDeleted, 0),
  }
}
