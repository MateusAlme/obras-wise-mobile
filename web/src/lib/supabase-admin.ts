// Supabase Admin Client para operações administrativas
// Este cliente usa o Service Role Key e tem permissões elevadas

import { createClient } from '@supabase/supabase-js'

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!
const supabaseServiceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY!

// Cliente admin com Service Role Key (apenas para operações server-side)
export const supabaseAdmin = createClient(supabaseUrl, supabaseServiceRoleKey, {
  auth: {
    autoRefreshToken: false,
    persistSession: false
  }
})

// Tipos
export interface AdminUser {
  id: string
  email: string
  full_name: string | null
  role: 'admin' | 'viewer'
  created_at: string
  updated_at: string
  last_sign_in_at: string | null
  email_confirmed_at: string | null
}

// =====================================================
// CRUD de Usuários Admin
// =====================================================

/**
 * Listar todos os usuários do sistema web (admin/viewer)
 */
export async function listAdminUsers(): Promise<AdminUser[]> {
  const { data, error } = await supabaseAdmin
    .from('vw_usuarios_sistema')
    .select('*')
    .order('created_at', { ascending: false })

  if (error) {
    console.error('Erro ao listar usuários admin:', error)
    throw error
  }

  return data || []
}

/**
 * Criar novo usuário admin
 */
export async function createAdminUser(email: string, password: string, fullName?: string, role: 'admin' | 'viewer' = 'admin') {
  // Validações
  if (!email || email.trim() === '') {
    throw new Error('Email é obrigatório')
  }
  if (!password || password.length < 6) {
    throw new Error('Senha deve ter no mínimo 6 caracteres')
  }

  // Criar usuário usando Admin API
  const { data: authData, error: authError } = await supabaseAdmin.auth.admin.createUser({
    email,
    password,
    email_confirm: true, // Confirmar email automaticamente
    user_metadata: {
      full_name: fullName || email
    }
  })

  if (authError) {
    console.error('Erro ao criar usuário no auth:', authError)
    throw authError
  }

  // Criar profile
  const { error: profileError } = await supabaseAdmin
    .from('profiles')
    .insert({
      id: authData.user.id,
      email,
      full_name: fullName || email,
      role,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString()
    })

  if (profileError) {
    // Se falhar ao criar profile, deletar usuário criado
    await supabaseAdmin.auth.admin.deleteUser(authData.user.id)
    console.error('Erro ao criar profile:', profileError)
    throw profileError
  }

  return authData.user
}

/**
 * Atualizar usuário admin
 */
export async function updateAdminUser(userId: string, updates: {
  full_name?: string
  role?: 'admin' | 'viewer'
}) {
  // Atualizar profile
  const { error: profileError } = await supabaseAdmin
    .from('profiles')
    .update({
      full_name: updates.full_name,
      role: updates.role,
      updated_at: new Date().toISOString()
    })
    .eq('id', userId)

  if (profileError) {
    console.error('Erro ao atualizar profile:', profileError)
    throw profileError
  }

  // Atualizar user_metadata se full_name foi alterado
  if (updates.full_name) {
    const { error: authError } = await supabaseAdmin.auth.admin.updateUserById(userId, {
      user_metadata: { full_name: updates.full_name }
    })

    if (authError) {
      console.error('Erro ao atualizar user metadata:', authError)
      throw authError
    }
  }

  return true
}

/**
 * Alterar senha de usuário admin
 */
export async function changeAdminUserPassword(userId: string, newPassword: string) {
  if (!newPassword || newPassword.length < 6) {
    throw new Error('Senha deve ter no mínimo 6 caracteres')
  }

  const { error } = await supabaseAdmin.auth.admin.updateUserById(userId, {
    password: newPassword
  })

  if (error) {
    console.error('Erro ao alterar senha:', error)
    throw error
  }

  return true
}

/**
 * Excluir usuário admin
 */
export async function deleteAdminUser(userId: string) {
  // Verificar se não é o super admin
  const { data: profile } = await supabaseAdmin
    .from('profiles')
    .select('email')
    .eq('id', userId)
    .single()

  if (profile?.email === 'mateusalmeidacz@gmail.com') {
    throw new Error('Não é permitido excluir o super administrador')
  }

  // Deletar do auth.users (CASCADE irá deletar o profile)
  const { error } = await supabaseAdmin.auth.admin.deleteUser(userId)

  if (error) {
    console.error('Erro ao excluir usuário:', error)
    throw error
  }

  return true
}
