import { NextRequest, NextResponse } from 'next/server'
import { listAdminUsers, createAdminUser } from '@/lib/supabase-admin'

// GET: Listar todos os usuários admin
export async function GET(request: NextRequest) {
  try {
    const users = await listAdminUsers()
    return NextResponse.json({ success: true, data: users })
  } catch (error: any) {
    console.error('Erro ao listar usuários:', error)
    return NextResponse.json(
      { success: false, error: error.message || 'Erro ao listar usuários' },
      { status: 500 }
    )
  }
}

// POST: Criar novo usuário admin
export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { email, password, full_name, role } = body

    if (!email || !password) {
      return NextResponse.json(
        { success: false, error: 'Email e senha são obrigatórios' },
        { status: 400 }
      )
    }

    const user = await createAdminUser(email, password, full_name, role || 'admin')

    return NextResponse.json({
      success: true,
      data: user,
      message: 'Usuário criado com sucesso'
    })
  } catch (error: any) {
    console.error('Erro ao criar usuário:', error)
    return NextResponse.json(
      { success: false, error: error.message || 'Erro ao criar usuário' },
      { status: 500 }
    )
  }
}
