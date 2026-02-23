'use client'

import { useEffect, useState } from 'react'
import ProtectedRoute from '@/components/ProtectedRoute'
import AppShell from '@/components/AppShell'
import { useAuth } from '@/contexts/AuthContext'
import { format } from 'date-fns'
import { ptBR } from 'date-fns/locale'
import Image from 'next/image'

interface AdminUser {
  id: string
  email: string
  full_name: string | null
  role: 'admin' | 'viewer'
  avatar_url: string | null
  created_at: string
  updated_at: string
  last_sign_in_at: string | null
  email_confirmed_at: string | null
}

export default function UsersPage() {
  const { isAdmin } = useAuth()
  const [users, setUsers] = useState<AdminUser[]>([])
  const [loading, setLoading] = useState(true)
  const [showModal, setShowModal] = useState(false)
  const [isCreating, setIsCreating] = useState(false)
  const [selectedUser, setSelectedUser] = useState<AdminUser | null>(null)

  const [formData, setFormData] = useState({
    email: '',
    password: '',
    full_name: '',
    role: 'admin' as 'admin' | 'viewer'
  })

  const [error, setError] = useState('')
  const [success, setSuccess] = useState('')
  const [searchTerm, setSearchTerm] = useState('')
  const [submitting, setSubmitting] = useState(false)

  const isSuperAdmin = isAdmin

  useEffect(() => { loadUsers() }, [])

  async function loadUsers() {
    try {
      setLoading(true)
      const response = await fetch('/api/admin/users')
      const contentType = response.headers.get('content-type')
      if (!contentType || !contentType.includes('application/json')) {
        throw new Error('Resposta inválida do servidor.')
      }
      const result = await response.json()
      if (!result.success) throw new Error(result.error || 'Erro ao carregar usuários')
      setUsers(result.data || [])
    } catch (error: any) {
      setError(error.message || 'Erro ao carregar usuários')
    } finally {
      setLoading(false)
    }
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError('')
    setSuccess('')
    setSubmitting(true)

    try {
      if (isCreating) {
        if (!formData.password || formData.password.length < 6) {
          setError('A senha deve ter no mínimo 6 caracteres!')
          setSubmitting(false)
          return
        }
        const response = await fetch('/api/admin/users', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            email: formData.email,
            password: formData.password,
            full_name: formData.full_name || formData.email,
            role: formData.role
          })
        })
        const result = await response.json()
        if (!result.success) throw new Error(result.error || 'Erro ao criar usuário')
        setSuccess(`Usuário "${formData.email}" criado com sucesso!`)
      } else {
        const response = await fetch(`/api/admin/users/${selectedUser!.id}`, {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            full_name: formData.full_name,
            role: formData.role,
            ...(formData.password && formData.password.length >= 6 ? { password: formData.password } : {})
          })
        })
        const result = await response.json()
        if (!result.success) throw new Error(result.error || 'Erro ao atualizar usuário')
        setSuccess('Usuário atualizado com sucesso!')
      }

      await loadUsers()
      setTimeout(() => closeModal(), 1500)
    } catch (error: any) {
      setError(error.message || 'Erro ao salvar usuário')
    } finally {
      setSubmitting(false)
    }
  }

  async function handleDelete(user: AdminUser) {
    if (!confirm(`Excluir o usuário "${user.email}"?\n\nEsta ação não pode ser desfeita!`)) return
    try {
      const response = await fetch(`/api/admin/users/${user.id}`, { method: 'DELETE' })
      const result = await response.json()
      if (!result.success) throw new Error(result.error || 'Erro ao excluir usuário')
      setSuccess(`Usuário "${user.email}" excluído com sucesso!`)
      await loadUsers()
      setTimeout(() => setSuccess(''), 3000)
    } catch (error: any) {
      setError(error.message || 'Erro ao excluir usuário')
      setTimeout(() => setError(''), 3000)
    }
  }

  function openCreateModal() {
    setIsCreating(true)
    setSelectedUser(null)
    setFormData({ email: '', password: '', full_name: '', role: 'admin' })
    setError('')
    setSuccess('')
    setShowModal(true)
  }

  function openEditModal(user: AdminUser) {
    setIsCreating(false)
    setSelectedUser(user)
    setFormData({ email: user.email, password: '', full_name: user.full_name || '', role: user.role })
    setError('')
    setSuccess('')
    setShowModal(true)
  }

  function closeModal() {
    setShowModal(false)
    setIsCreating(false)
    setSelectedUser(null)
    setFormData({ email: '', password: '', full_name: '', role: 'admin' })
    setError('')
    setSuccess('')
  }

  const filteredUsers = users.filter(u =>
    u.email.toLowerCase().includes(searchTerm.toLowerCase()) ||
    (u.full_name && u.full_name.toLowerCase().includes(searchTerm.toLowerCase()))
  )

  const admins = users.filter(u => u.role === 'admin').length
  const viewers = users.filter(u => u.role === 'viewer').length

  if (loading) {
    return (
      <ProtectedRoute requireAdmin>
        <div className="min-h-screen flex items-center justify-center">
          <div className="text-center space-y-3">
            <div className="spinner mx-auto" />
            <p className="text-sm font-medium text-gray-500">Carregando usuários...</p>
          </div>
        </div>
      </ProtectedRoute>
    )
  }

  return (
    <ProtectedRoute requireAdmin>
      <AppShell>
        {/* Header */}
        <div className="flex flex-col sm:flex-row sm:justify-between sm:items-end gap-4 mb-8">
          <div>
            <h1 className="page-title">Usuários do Sistema</h1>
            <p className="page-subtitle">
              {isSuperAdmin
                ? 'Gerenciar administradores e usuários com acesso ao sistema'
                : 'Visualizar usuários do sistema (somente admins podem criar/editar)'}
            </p>
          </div>
          {isSuperAdmin && (
            <button onClick={openCreateModal} className="btn-primary shrink-0">
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
              </svg>
              Novo Usuário
            </button>
          )}
        </div>

        {/* Alerts */}
        {!isSuperAdmin && (
          <div className="alert-warning mb-5">
            <svg className="w-4 h-4 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
            </svg>
            <div>
              <p className="font-semibold text-sm">Modo Somente Leitura</p>
              <p className="text-xs opacity-80 mt-0.5">Apenas Super Administradores podem criar, editar ou excluir usuários.</p>
            </div>
          </div>
        )}
        {success && (
          <div className="alert-success mb-5">
            <svg className="w-4 h-4 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
            </svg>
            {success}
          </div>
        )}
        {error && (
          <div className="alert-error mb-5">
            <svg className="w-4 h-4 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
            {error}
          </div>
        )}

        {/* Stats */}
        <div className="grid grid-cols-3 gap-4 mb-8">
          <div className="stat-card">
            <div className="w-11 h-11 bg-gradient-to-br from-blue-500 to-blue-600 rounded-xl flex items-center justify-center shadow-sm shadow-blue-500/30 mb-4">
              <svg className="w-5 h-5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4.354a4 4 0 110 5.292M15 21H3v-1a6 6 0 0112 0v1zm0 0h6v-1a6 6 0 00-9-5.197M13 7a4 4 0 11-8 0 4 4 0 018 0z" />
              </svg>
            </div>
            <p className="text-3xl font-bold text-slate-900 tracking-tight">{users.length}</p>
            <p className="text-sm font-semibold text-slate-700 mt-0.5">Total</p>
          </div>
          <div className="stat-card">
            <div className="w-11 h-11 bg-gradient-to-br from-violet-500 to-violet-600 rounded-xl flex items-center justify-center shadow-sm shadow-violet-500/30 mb-4">
              <svg className="w-5 h-5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" />
              </svg>
            </div>
            <p className="text-3xl font-bold text-slate-900 tracking-tight">{admins}</p>
            <p className="text-sm font-semibold text-slate-700 mt-0.5">Admins</p>
          </div>
          <div className="stat-card">
            <div className="w-11 h-11 bg-gradient-to-br from-slate-500 to-slate-600 rounded-xl flex items-center justify-center shadow-sm shadow-slate-500/20 mb-4">
              <svg className="w-5 h-5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
              </svg>
            </div>
            <p className="text-3xl font-bold text-slate-900 tracking-tight">{viewers}</p>
            <p className="text-sm font-semibold text-slate-700 mt-0.5">Visualizadores</p>
          </div>
        </div>

        {/* Search */}
        <div className="relative mb-5">
          <svg className="w-4 h-4 text-gray-400 absolute left-3.5 top-1/2 -translate-y-1/2 pointer-events-none" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
          </svg>
          <input
            type="text"
            placeholder="Buscar por email ou nome..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="input-field pl-10"
          />
        </div>

        {/* Table */}
        <div className="table-wrapper">
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-gray-50">
              <thead className="bg-gray-50/50">
                <tr>
                  <th className="th">Usuário</th>
                  <th className="th">Perfil</th>
                  <th className="th">Último Acesso</th>
                  <th className="th">Criado em</th>
                  <th className="th-center">Ações</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-50">
                {filteredUsers.map((u) => (
                  <tr key={u.id} className="hover:bg-slate-50/60 transition-colors">
                    <td className="td">
                      <div className="flex items-center gap-3">
                        <div className="relative flex-shrink-0 h-9 w-9 rounded-lg overflow-hidden">
                          {u.avatar_url ? (
                            <Image src={u.avatar_url} alt={u.full_name || u.email} fill className="object-cover" unoptimized />
                          ) : (
                            <div className={`w-full h-full ${u.role === 'admin' ? 'bg-purple-600' : 'bg-slate-500'} text-white flex items-center justify-center text-xs font-bold`}>
                              {(u.full_name || u.email).substring(0, 2).toUpperCase()}
                            </div>
                          )}
                        </div>
                        <div>
                          <p className="text-sm font-semibold text-slate-800">{u.full_name || '—'}</p>
                          <p className="text-xs text-gray-400">{u.email}</p>
                        </div>
                      </div>
                    </td>
                    <td className="td">
                      <span className={u.role === 'admin' ? 'badge-purple' : 'badge-gray'}>
                        {u.role === 'admin' ? 'Admin' : 'Visualizador'}
                      </span>
                    </td>
                    <td className="td text-gray-400">
                      {u.last_sign_in_at
                        ? format(new Date(u.last_sign_in_at), "dd/MM/yy HH:mm", { locale: ptBR })
                        : 'Nunca'}
                    </td>
                    <td className="td text-gray-400">
                      {format(new Date(u.created_at), "dd/MM/yy", { locale: ptBR })}
                    </td>
                    <td className="td">
                      {isSuperAdmin ? (
                        <div className="flex items-center justify-center gap-1">
                          <button
                            onClick={() => openEditModal(u)}
                            className="p-2 text-gray-400 hover:text-blue-600 hover:bg-blue-50 rounded-lg transition-colors"
                            title="Editar"
                          >
                            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                            </svg>
                          </button>
                          {u.email !== 'mateusalmeidacz@gmail.com' && (
                            <button
                              onClick={() => handleDelete(u)}
                              className="p-2 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors"
                              title="Excluir"
                            >
                              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                              </svg>
                            </button>
                          )}
                        </div>
                      ) : (
                        <span className="text-xs text-gray-300 text-center block">—</span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {filteredUsers.length === 0 && (
            <div className="text-center py-16">
              <div className="w-14 h-14 bg-gray-100 rounded-2xl flex items-center justify-center mx-auto mb-3">
                <svg className="w-7 h-7 text-gray-300" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4.354a4 4 0 110 5.292M15 21H3v-1a6 6 0 0112 0v1zm0 0h6v-1a6 6 0 00-9-5.197M13 7a4 4 0 11-8 0 4 4 0 018 0z" />
                </svg>
              </div>
              <p className="text-sm font-medium text-gray-400">
                {searchTerm ? 'Nenhum usuário encontrado' : 'Nenhum usuário cadastrado'}
              </p>
            </div>
          )}
        </div>

        {/* Modal */}
        {showModal && (
          <div className="modal-overlay" onClick={(e) => { if (e.target === e.currentTarget && !submitting) closeModal() }}>
            <div className="modal-box max-w-md animate-slideUp">
              <div className="modal-header">
                <div className="flex items-center gap-3">
                  <div className="w-9 h-9 bg-gradient-to-br from-blue-500 to-blue-600 rounded-xl flex items-center justify-center shadow-sm shadow-blue-500/30">
                    <svg className="w-4 h-4 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d={isCreating
                        ? "M18 9v3m0 0v3m0-3h3m-3 0h-3m-2-5a4 4 0 11-8 0 4 4 0 018 0zM3 20a6 6 0 0112 0v1H3v-1z"
                        : "M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z"} />
                    </svg>
                  </div>
                  <h2 className="modal-title">{isCreating ? 'Novo Usuário' : 'Editar Usuário'}</h2>
                </div>
                <button onClick={closeModal} disabled={submitting} className="p-1.5 text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded-lg transition-colors">
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </button>
              </div>

              <form onSubmit={handleSubmit}>
                <div className="modal-body space-y-4">
                  <div>
                    <label className="block text-xs font-semibold text-gray-400 uppercase tracking-wider mb-1.5">Email *</label>
                    <input
                      type="email"
                      required
                      disabled={!isCreating}
                      value={formData.email}
                      onChange={(e) => setFormData({ ...formData, email: e.target.value.toLowerCase() })}
                      className="input-field"
                      placeholder="usuario@exemplo.com"
                    />
                    {!isCreating && <p className="text-xs text-gray-400 mt-1">Email não pode ser alterado</p>}
                  </div>

                  <div>
                    <label className="block text-xs font-semibold text-gray-400 uppercase tracking-wider mb-1.5">Nome Completo</label>
                    <input
                      type="text"
                      value={formData.full_name}
                      onChange={(e) => setFormData({ ...formData, full_name: e.target.value })}
                      className="input-field"
                      placeholder="Nome do usuário"
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-semibold text-gray-400 uppercase tracking-wider mb-1.5">
                      {isCreating ? 'Senha *' : 'Nova Senha'}
                    </label>
                    <input
                      type="password"
                      required={isCreating}
                      value={formData.password}
                      onChange={(e) => setFormData({ ...formData, password: e.target.value })}
                      className="input-field"
                      placeholder={isCreating ? 'Mínimo 6 caracteres' : 'Deixe em branco para não alterar'}
                      minLength={6}
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-semibold text-gray-400 uppercase tracking-wider mb-2">Perfil *</label>
                    <div className="grid grid-cols-2 gap-2">
                      {(['admin', 'viewer'] as const).map((r) => (
                        <label
                          key={r}
                          className={`flex items-center gap-2.5 p-3 rounded-xl border-2 cursor-pointer transition-all ${formData.role === r ? 'border-blue-500 bg-blue-50' : 'border-gray-100 hover:border-gray-200'}`}
                        >
                          <input
                            type="radio"
                            name="role"
                            checked={formData.role === r}
                            onChange={() => setFormData({ ...formData, role: r })}
                            className="sr-only"
                          />
                          <div className={`w-4 h-4 rounded-full border-2 flex items-center justify-center shrink-0 ${formData.role === r ? 'border-blue-500 bg-blue-500' : 'border-gray-300'}`}>
                            {formData.role === r && <div className="w-1.5 h-1.5 bg-white rounded-full" />}
                          </div>
                          <span className={`text-sm font-medium ${formData.role === r ? 'text-blue-700' : 'text-gray-600'}`}>
                            {r === 'admin' ? 'Administrador' : 'Visualizador'}
                          </span>
                        </label>
                      ))}
                    </div>
                  </div>

                  {error && (
                    <div className="alert-error text-xs">
                      <svg className="w-3.5 h-3.5 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                      </svg>
                      {error}
                    </div>
                  )}
                  {success && (
                    <div className="alert-success text-xs">
                      <svg className="w-3.5 h-3.5 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                      </svg>
                      {success}
                    </div>
                  )}
                </div>

                <div className="modal-footer">
                  <button type="button" onClick={closeModal} disabled={submitting} className="btn-ghost flex-1">
                    Cancelar
                  </button>
                  <button type="submit" disabled={submitting} className="btn-primary flex-1">
                    {submitting ? (
                      <><span className="spinner-sm" />Salvando...</>
                    ) : (
                      isCreating ? 'Criar Usuário' : 'Salvar'
                    )}
                  </button>
                </div>
              </form>
            </div>
          </div>
        )}
      </AppShell>
    </ProtectedRoute>
  )
}
