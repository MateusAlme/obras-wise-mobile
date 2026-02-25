'use client'

import { useEffect, useState } from 'react'
import { supabase } from '@/lib/supabase'
import ProtectedRoute from '@/components/ProtectedRoute'
import AppShell from '@/components/AppShell'

interface TeamCredential {
  id: string
  equipe_codigo: string
  role: string
  ativo: boolean
  created_at: string
  updated_at: string
}

interface TeamStats {
  equipe_codigo: string
  total_obras: number
}

type TeamRole = 'equipe' | 'admin' | 'compressor'

function normalizeTeamRole(role?: string | null): TeamRole {
  switch ((role || '').trim().toLowerCase()) {
    case 'admin':
      return 'admin'
    case 'compressor':
      return 'compressor'
    default:
      return 'equipe'
  }
}

const ROLE_OPTIONS = [
  { value: 'equipe', label: 'Equipe (padrão)' },
  { value: 'admin', label: 'Admin' },
  { value: 'compressor', label: 'Compressor' },
]

function getRoleBadge(role: string) {
  switch (role) {
    case 'admin':
      return { label: 'Admin', color: 'bg-purple-100 text-purple-700' }
    case 'linha_viva':
      return { label: 'Linha Viva (legado)', color: 'bg-yellow-100 text-yellow-700' }
    case 'compressor':
      return { label: 'Compressor', color: 'bg-blue-100 text-blue-700' }
    case 'supervisor':
      return { label: 'Supervisor (legado)', color: 'bg-orange-100 text-orange-700' }
    default:
      return { label: 'Equipe', color: 'bg-slate-100 text-slate-600' }
  }
}

export default function TeamsPage() {
  const [teams, setTeams] = useState<TeamCredential[]>([])
  const [teamStats, setTeamStats] = useState<TeamStats[]>([])
  const [loading, setLoading] = useState(true)

  // Modal: criar
  const [showModal, setShowModal] = useState(false)
  const [teamCode, setTeamCode] = useState('')
  const [teamRole, setTeamRole] = useState<TeamRole>('equipe')
  const [password, setPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')

  // Modal: editar (nome + tipo)
  const [showEditModal, setShowEditModal] = useState(false)
  const [editingTeamData, setEditingTeamData] = useState<TeamCredential | null>(null)
  const [editTeamCode, setEditTeamCode] = useState('')
  const [editTeamRole, setEditTeamRole] = useState<TeamRole>('equipe')

  // Modal: alterar senha
  const [showPasswordModal, setShowPasswordModal] = useState(false)
  const [editingTeam, setEditingTeam] = useState<TeamCredential | null>(null)
  const [newPassword, setNewPassword] = useState('')
  const [confirmPasswordPwd, setConfirmPasswordPwd] = useState('')

  const [error, setError] = useState('')
  const [searchTerm, setSearchTerm] = useState('')

  useEffect(() => {
    loadTeamsAndStats()
  }, [])

  async function loadTeamsAndStats() {
    try {
      const { data: teamsData, error: teamsError } = await supabase
        .from('equipe_credenciais')
        .select('*')
        .order('equipe_codigo')

      if (teamsError) throw teamsError
      setTeams(teamsData || [])

      const { data: obrasData, error: obrasError } = await supabase
        .from('obras')
        .select('equipe')

      if (obrasError) throw obrasError

      const stats: { [key: string]: number } = {}
      obrasData?.forEach((obra) => {
        if (!stats[obra.equipe]) stats[obra.equipe] = 0
        stats[obra.equipe]++
      })

      setTeamStats(
        Object.entries(stats).map(([equipe_codigo, total_obras]) => ({ equipe_codigo, total_obras }))
      )
    } catch (error) {
      console.error('Erro ao carregar equipes:', error)
    } finally {
      setLoading(false)
    }
  }

  // --- Criar equipe ---
  async function handleCreateTeam(e: React.FormEvent) {
    e.preventDefault()
    setError('')

    if (!teamCode.trim()) {
      setError('Digite o código da equipe')
      return
    }
    if (!password.trim() || password.length < 6) {
      setError('A senha deve ter pelo menos 6 caracteres')
      return
    }
    if (password !== confirmPassword) {
      setError('As senhas não coincidem')
      return
    }

    try {
      const { error } = await supabase.rpc('criar_equipe_com_senha', {
        p_equipe_codigo: teamCode.trim().toUpperCase(),
        p_senha: password,
      })

      if (error) throw error
      const normalizedTeamRole = normalizeTeamRole(teamRole)

      // Definir role se diferente do padrão
      if (normalizedTeamRole !== 'equipe') {
        const { error: roleError } = await supabase
          .from('equipe_credenciais')
          .update({ role: normalizedTeamRole })
          .eq('equipe_codigo', teamCode.trim().toUpperCase())

        if (roleError) throw roleError
      }

      await loadTeamsAndStats()
      closeModal()
    } catch (error: any) {
      console.error('Erro ao criar equipe:', error)
      setError(error.message || 'Erro ao criar equipe')
    }
  }

  function openModal() {
    setTeamCode('')
    setTeamRole('equipe')
    setPassword('')
    setConfirmPassword('')
    setError('')
    setShowModal(true)
  }

  function closeModal() {
    setShowModal(false)
    setTeamCode('')
    setTeamRole('equipe')
    setPassword('')
    setConfirmPassword('')
    setError('')
  }

  // --- Editar equipe (nome + tipo) ---
  function openEditModal(team: TeamCredential) {
    setEditingTeamData(team)
    setEditTeamCode(team.equipe_codigo)
    setEditTeamRole(normalizeTeamRole(team.role))
    setError('')
    setShowEditModal(true)
  }

  function closeEditModal() {
    setShowEditModal(false)
    setEditingTeamData(null)
    setEditTeamCode('')
    setEditTeamRole('equipe')
    setError('')
  }

  async function handleEditTeam(e: React.FormEvent) {
    e.preventDefault()
    setError('')

    if (!editTeamCode.trim()) {
      setError('Digite o código da equipe')
      return
    }
    if (!editingTeamData) return

    try {
      const normalizedTeamRole = normalizeTeamRole(editTeamRole)

      const { error } = await supabase
        .from('equipe_credenciais')
        .update({ equipe_codigo: editTeamCode.trim().toUpperCase(), role: normalizedTeamRole })
        .eq('id', editingTeamData.id)

      if (error) throw error

      await loadTeamsAndStats()
      closeEditModal()
    } catch (error: any) {
      console.error('Erro ao editar equipe:', error)
      setError(error.message || 'Erro ao editar equipe')
    }
  }

  // --- Alterar senha ---
  function openPasswordModal(team: TeamCredential) {
    setEditingTeam(team)
    setNewPassword('')
    setConfirmPasswordPwd('')
    setError('')
    setShowPasswordModal(true)
  }

  function closePasswordModal() {
    setShowPasswordModal(false)
    setEditingTeam(null)
    setNewPassword('')
    setConfirmPasswordPwd('')
    setError('')
  }

  async function handleChangePassword(e: React.FormEvent) {
    e.preventDefault()
    setError('')

    if (!newPassword.trim() || newPassword.length < 6) {
      setError('A senha deve ter pelo menos 6 caracteres')
      return
    }
    if (newPassword !== confirmPasswordPwd) {
      setError('As senhas não coincidem')
      return
    }
    if (!editingTeam) return

    try {
      const { error } = await supabase.rpc('admin_resetar_senha_equipe', {
        p_equipe_codigo: editingTeam.equipe_codigo,
        p_senha_nova: newPassword,
      })

      if (error) throw error

      await loadTeamsAndStats()
      closePasswordModal()
    } catch (error: any) {
      console.error('Erro ao alterar senha:', error)
      setError(error.message || 'Erro ao alterar senha')
    }
  }

  // --- Toggle / Delete ---
  async function handleToggleStatus(team: TeamCredential) {
    try {
      const { error } = await supabase
        .from('equipe_credenciais')
        .update({ ativo: !team.ativo })
        .eq('id', team.id)

      if (error) throw error
      await loadTeamsAndStats()
    } catch (error: any) {
      alert('Erro ao alterar status: ' + error.message)
    }
  }

  async function handleDelete(teamId: string) {
    if (!confirm('Tem certeza que deseja excluir esta equipe?')) return

    try {
      const { error } = await supabase.from('equipe_credenciais').delete().eq('id', teamId)
      if (error) throw error
      await loadTeamsAndStats()
    } catch (error: any) {
      alert('Erro ao excluir equipe: ' + error.message)
    }
  }

  const filteredTeams = teams.filter((team) =>
    team.equipe_codigo.toLowerCase().includes(searchTerm.toLowerCase())
  )

  const activeTeams = teams.filter((t) => t.ativo).length
  const inactiveTeams = teams.filter((t) => !t.ativo).length

  if (loading) {
    return (
      <ProtectedRoute requireAdmin>
        <div className="min-h-screen flex items-center justify-center">
          <div className="text-center">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary mx-auto"></div>
            <p className="text-xl text-gray-600 mt-4">Carregando equipes...</p>
          </div>
        </div>
      </ProtectedRoute>
    )
  }

  return (
    <ProtectedRoute requireAdmin>
      <AppShell>
        {/* Header */}
        <div className="flex flex-col sm:flex-row sm:justify-between sm:items-start gap-4 mb-8">
          <div>
            <h1 className="text-3xl lg:text-4xl font-semibold text-slate-900 tracking-tight mb-2">Gerenciar Equipes</h1>
            <p className="text-sm sm:text-base text-slate-600">
              Criar, editar e gerenciar equipes do sistema
            </p>
          </div>
          <button
            onClick={openModal}
            className="px-6 py-3.5 bg-gradient-to-r from-primary to-primary-dark text-white rounded-2xl hover:shadow-xl hover:scale-105 transition-all flex items-center gap-3 font-bold text-lg shadow-lg shadow-primary/30"
          >
            <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
            </svg>
            Nova Equipe
          </button>
        </div>

        {/* Stats Cards */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
          <div className="bg-white rounded-2xl shadow-lg border border-slate-200 p-6 hover:shadow-xl transition-shadow">
            <div className="flex items-center justify-between mb-4">
              <div className="w-14 h-14 bg-blue-100 rounded-2xl flex items-center justify-center">
                <svg className="w-8 h-8 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z" />
                </svg>
              </div>
            </div>
            <h3 className="text-slate-600 text-sm font-semibold uppercase tracking-wide mb-1">Total de Equipes</h3>
            <p className="text-4xl font-bold text-slate-900">{teams.length}</p>
          </div>

          <div className="bg-white rounded-2xl shadow-lg border border-slate-200 p-6 hover:shadow-xl transition-shadow">
            <div className="flex items-center justify-between mb-4">
              <div className="w-14 h-14 bg-green-100 rounded-2xl flex items-center justify-center">
                <svg className="w-8 h-8 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
              </div>
            </div>
            <h3 className="text-slate-600 text-sm font-semibold uppercase tracking-wide mb-1">Equipes Ativas</h3>
            <p className="text-4xl font-bold text-green-600">{activeTeams}</p>
          </div>

          <div className="bg-white rounded-2xl shadow-lg border border-slate-200 p-6 hover:shadow-xl transition-shadow">
            <div className="flex items-center justify-between mb-4">
              <div className="w-14 h-14 bg-slate-100 rounded-2xl flex items-center justify-center">
                <svg className="w-8 h-8 text-slate-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M18.364 18.364A9 9 0 005.636 5.636m12.728 12.728A9 9 0 015.636 5.636m12.728 12.728L5.636 5.636" />
                </svg>
              </div>
            </div>
            <h3 className="text-slate-600 text-sm font-semibold uppercase tracking-wide mb-1">Equipes Inativas</h3>
            <p className="text-4xl font-bold text-slate-600">{inactiveTeams}</p>
          </div>
        </div>

        {/* Search Bar */}
        <div className="bg-white rounded-2xl shadow-lg border border-slate-200 p-6 mb-6">
          <div className="relative">
            <svg className="absolute left-4 top-1/2 transform -translate-y-1/2 w-6 h-6 text-slate-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
            </svg>
            <input
              type="text"
              placeholder="Buscar equipe..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full pl-14 pr-4 py-4 text-lg border-2 border-slate-200 rounded-2xl focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/20 transition-all"
            />
          </div>
        </div>

        {/* Teams Table */}
        <div className="bg-white rounded-2xl shadow-lg border border-slate-200 overflow-hidden">
          <div className="overflow-x-auto">
            <table className="min-w-full">
              <thead className="bg-slate-50 border-b-2 border-slate-200">
                <tr>
                  <th className="px-6 py-4 text-left text-sm font-bold text-slate-700 uppercase tracking-wider">Equipe</th>
                  <th className="px-6 py-4 text-left text-sm font-bold text-slate-700 uppercase tracking-wider">Tipo</th>
                  <th className="px-6 py-4 text-left text-sm font-bold text-slate-700 uppercase tracking-wider">Status</th>
                  <th className="px-6 py-4 text-left text-sm font-bold text-slate-700 uppercase tracking-wider">Total de Obras</th>
                  <th className="px-6 py-4 text-left text-sm font-bold text-slate-700 uppercase tracking-wider">Criado em</th>
                  <th className="px-6 py-4 text-center text-sm font-bold text-slate-700 uppercase tracking-wider">Ações</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-200">
                {filteredTeams.map((team) => {
                  const stats = teamStats.find((s) => s.equipe_codigo === team.equipe_codigo)
                  const totalObras = stats?.total_obras || 0
                  const badge = getRoleBadge(team.role)

                  return (
                    <tr key={team.id} className="hover:bg-slate-50 transition-colors">
                      <td className="px-6 py-5">
                        <div className="flex items-center gap-4">
                          <div className="w-12 h-12 bg-gradient-to-br from-primary to-primary-dark rounded-xl flex items-center justify-center text-white font-bold text-lg shadow-md">
                            {team.equipe_codigo.substring(0, 2)}
                          </div>
                          <div className="text-base font-bold text-slate-900">{team.equipe_codigo}</div>
                        </div>
                      </td>
                      <td className="px-6 py-5">
                        <span className={`inline-flex items-center px-3 py-1 rounded-full text-sm font-semibold ${badge.color}`}>
                          {badge.label}
                        </span>
                      </td>
                      <td className="px-6 py-5">
                        {team.ativo ? (
                          <span className="inline-flex items-center gap-2 px-4 py-2 bg-green-100 text-green-700 rounded-full text-sm font-semibold">
                            <span className="w-2 h-2 bg-green-500 rounded-full"></span>
                            Ativo
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-2 px-4 py-2 bg-slate-100 text-slate-600 rounded-full text-sm font-semibold">
                            <span className="w-2 h-2 bg-slate-400 rounded-full"></span>
                            Inativo
                          </span>
                        )}
                      </td>
                      <td className="px-6 py-5">
                        <span className="text-base font-bold text-slate-900">{totalObras}</span>
                      </td>
                      <td className="px-6 py-5">
                        <span className="text-sm text-slate-600">
                          {new Date(team.created_at).toLocaleDateString('pt-BR')}
                        </span>
                      </td>
                      <td className="px-6 py-5">
                        <div className="flex items-center justify-center gap-2">
                          {/* Editar nome + tipo */}
                          <button
                            onClick={() => openEditModal(team)}
                            className="p-2.5 text-slate-600 hover:bg-slate-100 rounded-xl transition-colors"
                            title="Editar Equipe"
                          >
                            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                            </svg>
                          </button>
                          {/* Alterar senha */}
                          <button
                            onClick={() => openPasswordModal(team)}
                            className="p-2.5 text-blue-600 hover:bg-blue-50 rounded-xl transition-colors"
                            title="Alterar Senha"
                          >
                            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 7a2 2 0 012 2m4 0a6 6 0 01-7.743 5.743L11 17H9v2H7v2H4a1 1 0 01-1-1v-2.586a1 1 0 01.293-.707l5.964-5.964A6 6 0 1121 9z" />
                            </svg>
                          </button>
                          {/* Ativar/Desativar */}
                          <button
                            onClick={() => handleToggleStatus(team)}
                            className={`p-2.5 rounded-xl transition-colors ${team.ativo ? 'text-orange-600 hover:bg-orange-50' : 'text-green-600 hover:bg-green-50'}`}
                            title={team.ativo ? 'Desativar' : 'Ativar'}
                          >
                            {team.ativo ? (
                              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M18.364 18.364A9 9 0 005.636 5.636m12.728 12.728A9 9 0 015.636 5.636m12.728 12.728L5.636 5.636" />
                              </svg>
                            ) : (
                              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                              </svg>
                            )}
                          </button>
                          {/* Excluir */}
                          <button
                            onClick={() => handleDelete(team.id)}
                            className="p-2.5 text-red-600 hover:bg-red-50 rounded-xl transition-colors"
                            title="Excluir"
                          >
                            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                            </svg>
                          </button>
                        </div>
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>

          {filteredTeams.length === 0 && (
            <div className="text-center py-16">
              <svg className="w-20 h-20 text-slate-300 mx-auto mb-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z" />
              </svg>
              <p className="text-xl text-slate-500 font-medium">Nenhuma equipe encontrada</p>
            </div>
          )}
        </div>

        {/* Modal - Nova Equipe */}
        {showModal && (
          <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4 z-50 animate-fadeIn">
            <div className="bg-white rounded-3xl max-w-lg w-full p-8 shadow-2xl animate-slideUp">
              <div className="flex justify-between items-center mb-6">
                <h2 className="text-3xl font-bold text-slate-900">Nova Equipe</h2>
                <button onClick={closeModal} className="text-slate-400 hover:text-slate-600 transition-colors">
                  <svg className="w-7 h-7" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </button>
              </div>

              <form onSubmit={handleCreateTeam} className="space-y-5">
                <div>
                  <label className="block text-base font-bold text-slate-900 mb-3">Código da Equipe</label>
                  <input
                    type="text"
                    required
                    value={teamCode}
                    onChange={(e) => setTeamCode(e.target.value.toUpperCase())}
                    className="w-full px-5 py-4 text-lg border-2 border-slate-200 rounded-2xl focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/20"
                    placeholder="Ex: CNT 01"
                    autoComplete="off"
                    autoCorrect="off"
                    spellCheck={false}
                  />
                </div>

                <div>
                  <label className="block text-base font-bold text-slate-900 mb-3">Tipo de Acesso Mobile</label>
                  <select
                    value={teamRole}
                    onChange={(e) => setTeamRole(normalizeTeamRole(e.target.value))}
                    className="w-full px-5 py-4 text-lg border-2 border-slate-200 rounded-2xl focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/20 bg-white"
                  >
                    {ROLE_OPTIONS.map((opt) => (
                      <option key={opt.value} value={opt.value}>{opt.label}</option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-base font-bold text-slate-900 mb-3">Senha</label>
                  <input
                    type="password"
                    required
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    className="w-full px-5 py-4 text-lg border-2 border-slate-200 rounded-2xl focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/20"
                    placeholder="Mínimo 6 caracteres"
                  />
                </div>

                <div>
                  <label className="block text-base font-bold text-slate-900 mb-3">Confirmar Senha</label>
                  <input
                    type="password"
                    required
                    value={confirmPassword}
                    onChange={(e) => setConfirmPassword(e.target.value)}
                    className="w-full px-5 py-4 text-lg border-2 border-slate-200 rounded-2xl focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/20"
                    placeholder="Digite a senha novamente"
                  />
                </div>

                {error && (
                  <div className="p-4 bg-red-50 border-2 border-red-200 rounded-2xl">
                    <p className="text-base text-red-800 font-medium">{error}</p>
                  </div>
                )}

                <div className="flex gap-4 pt-2">
                  <button type="button" onClick={closeModal} className="flex-1 px-6 py-4 border-2 border-slate-300 text-slate-700 rounded-2xl hover:bg-slate-50 transition-colors font-bold text-lg">
                    Cancelar
                  </button>
                  <button type="submit" className="flex-1 px-6 py-4 bg-gradient-to-r from-primary to-primary-dark text-white rounded-2xl hover:shadow-xl transition-all font-bold text-lg">
                    Criar Equipe
                  </button>
                </div>
              </form>
            </div>
          </div>
        )}

        {/* Modal - Editar Equipe (nome + tipo) */}
        {showEditModal && editingTeamData && (
          <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4 z-50 animate-fadeIn">
            <div className="bg-white rounded-3xl max-w-lg w-full p-8 shadow-2xl animate-slideUp">
              <div className="flex justify-between items-center mb-6">
                <h2 className="text-3xl font-bold text-slate-900">Editar Equipe</h2>
                <button onClick={closeEditModal} className="text-slate-400 hover:text-slate-600 transition-colors">
                  <svg className="w-7 h-7" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </button>
              </div>

              <form onSubmit={handleEditTeam} className="space-y-5">
                <div>
                  <label className="block text-base font-bold text-slate-900 mb-3">Código da Equipe</label>
                  <input
                    type="text"
                    required
                    value={editTeamCode}
                    onChange={(e) => setEditTeamCode(e.target.value.toUpperCase())}
                    className="w-full px-5 py-4 text-lg border-2 border-slate-200 rounded-2xl focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/20"
                    autoComplete="off"
                    autoCorrect="off"
                    spellCheck={false}
                  />
                </div>

                <div>
                  <label className="block text-base font-bold text-slate-900 mb-3">Tipo de Acesso Mobile</label>
                  <select
                    value={editTeamRole}
                    onChange={(e) => setEditTeamRole(normalizeTeamRole(e.target.value))}
                    className="w-full px-5 py-4 text-lg border-2 border-slate-200 rounded-2xl focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/20 bg-white"
                  >
                    {ROLE_OPTIONS.map((opt) => (
                      <option key={opt.value} value={opt.value}>{opt.label}</option>
                    ))}
                  </select>
                </div>

                {error && (
                  <div className="p-4 bg-red-50 border-2 border-red-200 rounded-2xl">
                    <p className="text-base text-red-800 font-medium">{error}</p>
                  </div>
                )}

                <div className="flex gap-4 pt-2">
                  <button type="button" onClick={closeEditModal} className="flex-1 px-6 py-4 border-2 border-slate-300 text-slate-700 rounded-2xl hover:bg-slate-50 transition-colors font-bold text-lg">
                    Cancelar
                  </button>
                  <button type="submit" className="flex-1 px-6 py-4 bg-gradient-to-r from-primary to-primary-dark text-white rounded-2xl hover:shadow-xl transition-all font-bold text-lg">
                    Salvar
                  </button>
                </div>
              </form>
            </div>
          </div>
        )}

        {/* Modal - Alterar Senha */}
        {showPasswordModal && editingTeam && (
          <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4 z-50 animate-fadeIn">
            <div className="bg-white rounded-3xl max-w-lg w-full p-8 shadow-2xl animate-slideUp">
              <div className="flex justify-between items-center mb-6">
                <h2 className="text-3xl font-bold text-slate-900">Alterar Senha</h2>
                <button onClick={closePasswordModal} className="text-slate-400 hover:text-slate-600 transition-colors">
                  <svg className="w-7 h-7" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </button>
              </div>

              <div className="mb-6 p-4 bg-slate-50 rounded-2xl">
                <p className="text-base text-slate-600">
                  Equipe: <span className="font-bold text-slate-900">{editingTeam.equipe_codigo}</span>
                </p>
              </div>

              <form onSubmit={handleChangePassword} className="space-y-5">
                <div>
                  <label className="block text-base font-bold text-slate-900 mb-3">Nova Senha</label>
                  <input
                    type="password"
                    required
                    value={newPassword}
                    onChange={(e) => setNewPassword(e.target.value)}
                    className="w-full px-5 py-4 text-lg border-2 border-slate-200 rounded-2xl focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/20"
                    placeholder="Mínimo 6 caracteres"
                  />
                </div>

                <div>
                  <label className="block text-base font-bold text-slate-900 mb-3">Confirmar Nova Senha</label>
                  <input
                    type="password"
                    required
                    value={confirmPasswordPwd}
                    onChange={(e) => setConfirmPasswordPwd(e.target.value)}
                    className="w-full px-5 py-4 text-lg border-2 border-slate-200 rounded-2xl focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/20"
                    placeholder="Digite a senha novamente"
                  />
                </div>

                {error && (
                  <div className="p-4 bg-red-50 border-2 border-red-200 rounded-2xl">
                    <p className="text-base text-red-800 font-medium">{error}</p>
                  </div>
                )}

                <div className="flex gap-4 pt-2">
                  <button type="button" onClick={closePasswordModal} className="flex-1 px-6 py-4 border-2 border-slate-300 text-slate-700 rounded-2xl hover:bg-slate-50 transition-colors font-bold text-lg">
                    Cancelar
                  </button>
                  <button type="submit" className="flex-1 px-6 py-4 bg-gradient-to-r from-blue-500 to-blue-600 text-white rounded-2xl hover:shadow-xl transition-all font-bold text-lg">
                    Alterar Senha
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
