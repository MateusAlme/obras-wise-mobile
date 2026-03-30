import { NextRequest, NextResponse } from 'next/server'
import { deleteObraById } from '@/lib/obra-delete'

// DELETE: Excluir obra (apenas admin)
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id: obraId } = await params
    const result = await deleteObraById(obraId)

    return NextResponse.json({
      success: true,
      message: 'Obra excluída com sucesso',
      photosDeleted: result.photosDeleted,
    })
  } catch (error: any) {
    console.error('Erro ao excluir obra:', error)

    const notFound = error?.message === 'Obra não encontrada'
    return NextResponse.json(
      { success: false, error: error.message || 'Erro ao excluir obra' },
      { status: notFound ? 404 : 500 }
    )
  }
}
