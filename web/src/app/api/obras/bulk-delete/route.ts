import { NextRequest, NextResponse } from 'next/server'
import { deleteObrasByIds } from '@/lib/obra-delete'

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const obraIds = Array.isArray(body?.obraIds) ? body.obraIds.filter((id: unknown) => typeof id === 'string') : []

    if (obraIds.length === 0) {
      return NextResponse.json(
        { success: false, error: 'Nenhuma obra foi informada para exclusão' },
        { status: 400 }
      )
    }

    const result = await deleteObrasByIds(obraIds)
    const success = result.failed.length === 0

    return NextResponse.json({
      success,
      requested: result.requested,
      deleted: result.deleted,
      deletedIds: result.deleted.map((item) => item.id),
      failed: result.failed,
      photosDeleted: result.photosDeleted,
      message: success
        ? 'Obras excluídas com sucesso'
        : 'Parte das obras foi excluída, mas houve falhas',
    })
  } catch (error: any) {
    console.error('Erro ao excluir obras em lote:', error)
    return NextResponse.json(
      { success: false, error: error.message || 'Erro ao excluir obras em lote' },
      { status: 500 }
    )
  }
}
