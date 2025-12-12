'use client'

import { useEffect, useState } from 'react'
import { supabase } from '@/lib/supabase'
import ProtectedRoute from '@/components/ProtectedRoute'
import Sidebar from '@/components/Sidebar'

interface Team {
  id: string
  nome: string
  created_at: string
}

interface TeamStats {
  nome: string
  total_obras: number
  obras_com_atipicidade: number
  total_fotos: number
}

export default function TeamsPage() {
  const [teams, setTeams] = useState<Team[]>([])
  const [teamStats, setTeamStats] = useState<TeamStats[]>([])
  const [loading, setLoading] = useState(true)
  const [showModal, setShowModal] = useState(false)
  const [editingTeam, setEditingTeam] = useState<Team | null>(null)
  const [teamName, setTeamName] = useState('')
  const [error, setError] = useState('')

  useEffect(() => {
    loadTeamsAndStats()
  }, [])

  async function loadTeamsAndStats() {
    try {
      // Carregar equipes
      const { data: teamsData, error: teamsError } = await supabase
        .from('equipes')
        .select('*')
        .order('nome')

      if (teamsError) throw teamsError
      setTeams(teamsData || [])

      // Carregar estatísticas de obras por equipe
      const { data: obrasData, error: obrasError } = await supabase
        .from('obras')
        .select('equipe, tem_atipicidade, fotos_antes, fotos_durante, fotos_depois')

      if (obrasError) throw obrasError

      // Calcular estatísticas
      const stats: { [key: string]: TeamStats } = {}

      obrasData?.forEach((obra) => {
        if (!stats[obra.equipe]) {
          stats[obra.equipe] = {
            nome: obra.equipe,
            total_obras: 0,
            obras_com_atipicidade: 0,
            total_fotos: 0,
          }
        }

        stats[obra.equipe].total_obras++
        if (obra.tem_atipicidade) stats[obra.equipe].obras_com_atipicidade++

        const fotosCount =
          (obra.fotos_antes?.length || 0) +
          (obra.fotos_durante?.length || 0) +
          (obra.fotos_depois?.length || 0)
        stats[obra.equipe].total_fotos += fotosCount
      })

      setTeamStats(Object.values(stats).sort((a, b) => b.total_obras - a.total_obras))
    } catch (error) {
      console.error('Erro ao carregar equipes:', error)
    } finally {
      setLoading(false)
    }
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError('')

    if (!teamName.trim()) {
      setError('Digite o nome da equipe')
      return
    }

    try {
      if (editingTeam) {
        // Atualizar equipe
        const { error } = await supabase
          .from('equipes')
          .update({ nome: teamName.trim() })
          .eq('id', editingTeam.id)

        if (error) throw error
      } else {
        // Criar nova equipe
        const { error } = await supabase
          .from('equipes')
          .insert([{ nome: teamName.trim() }])

        if (error) throw error
      }

      await loadTeamsAndStats()
      closeModal()
    } catch (error: any) {
      setError(error.message || 'Erro ao salvar equipe')
    }
  }

  async function handleDelete(teamId: string) {
    if (!confirm('Tem certeza que deseja excluir esta equipe?')) return

    try {
      const { error } = await supabase
        .from('equipes')
        .delete()
        .eq('id', teamId)

      if (error) throw error
      await loadTeamsAndStats()
    } catch (error: any) {
      alert('Erro ao excluir equipe: ' + error.message)
    }
  }

  function openModal(team?: Team) {
    if (team) {
      setEditingTeam(team)
      setTeamName(team.nome)
    } else {
      setEditingTeam(null)
      setTeamName('')
    }
    setError('')
    setShowModal(true)
  }

  function closeModal() {
    setShowModal(false)
    setEditingTeam(null)
    setTeamName('')
    setError('')
  }

  if (loading) {
    return (
      <ProtectedRoute requireAdmin>
        <div className="min-h-screen flex items-center justify-center">
          <p className="text-xl text-gray-600">Carregando equipes...</p>
        </div>
      </ProtectedRoute>
    )
  }

  return (
    <ProtectedRoute requireAdmin>
      <div className="min-h-screen bg-gray-50 flex">
        <Sidebar />

        <div className="flex-1 px-4 sm:px-6 lg:px-8 py-8">
          {/* Header */}
          <div className="flex flex-col sm:flex-row sm:justify-between sm:items-center gap-4 mb-8">
            <div>
              <h1 className="text-3xl font-bold text-gray-900">Gerenciamento de Equipes</h1>
              <p className="text-gray-600 mt-1 flex items-center gap-2">
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z" />
                </svg>
                Criar e gerenciar equipes de trabalho
              </p>
            </div>
            <button
              onClick={() => openModal()}
              className="px-5 py-2.5 bg-primary text-white rounded-xl hover:bg-primary-dark transition-all shadow-lg hover:shadow-xl flex items-center gap-2 font-semibold"
            >
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
              </svg>
              Nova Equipe
            </button>
          </div>

          {/* Stats Cards */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
            <div className="bg-gradient-to-br from-blue-500 to-blue-600 p-6 rounded-xl shadow-lg text-white">
              <h3 className="text-blue-100 text-sm font-medium">Total de Equipes</h3>
              <p className="text-4xl font-bold mt-2">{teams.length}</p>
            </div>
            <div className="bg-gradient-to-br from-green-500 to-green-600 p-6 rounded-xl shadow-lg text-white">
              <h3 className="text-green-100 text-sm font-medium">Equipes Ativas</h3>
              <p className="text-4xl font-bold mt-2">{teamStats.filter(t => t.total_obras > 0).length}</p>
              <p className="text-green-100 text-xs mt-1">com obras registradas</p>
            </div>
            <div className="bg-gradient-to-br from-purple-500 to-purple-600 p-6 rounded-xl shadow-lg text-white">
              <h3 className="text-purple-100 text-sm font-medium">Total de Obras</h3>
              <p className="text-4xl font-bold mt-2">{teamStats.reduce((acc, t) => acc + t.total_obras, 0)}</p>
            </div>
          </div>

          {/* Teams Performance Table */}
          <div className="bg-white rounded-xl shadow-md border border-gray-100 mb-8 overflow-hidden">
            <div className="px-6 py-4 border-b border-gray-200 bg-gray-50">
              <h2 className="text-lg font-semibold text-gray-900">Desempenho por Equipe</h2>
            </div>
            <div className="overflow-x-auto">
              <table className="min-w-full divide-y divide-gray-200">
                <thead className="bg-gray-50">
                  <tr>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Equipe
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Total de Obras
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Com Atipicidades
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Total de Fotos
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Média de Fotos
                    </th>
                  </tr>
                </thead>
                <tbody className="bg-white divide-y divide-gray-200">
                  {teamStats.map((team) => (
                    <tr key={team.nome} className="hover:bg-gray-50">
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div className="flex items-center">
                          <div className="flex-shrink-0 h-10 w-10 bg-primary text-white rounded-full flex items-center justify-center font-semibold">
                            {team.nome[0].toUpperCase()}
                          </div>
                          <div className="ml-4">
                            <div className="text-sm font-medium text-gray-900">{team.nome}</div>
                          </div>
                        </div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <span className="text-sm font-semibold text-gray-900">{team.total_obras}</span>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <span className="text-sm text-gray-900">{team.obras_com_atipicidade}</span>
                        <span className="text-xs text-gray-500 ml-1">
                          ({team.total_obras > 0 ? Math.round((team.obras_com_atipicidade / team.total_obras) * 100) : 0}%)
                        </span>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                        {team.total_fotos}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                        {team.total_obras > 0 ? Math.round(team.total_fotos / team.total_obras) : 0}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {teamStats.length === 0 && (
              <div className="text-center py-12">
                <p className="text-gray-500">Nenhuma equipe com obras registradas</p>
              </div>
            )}
          </div>

          {/* Teams List */}
          <div className="bg-white rounded-xl shadow-md border border-gray-100 overflow-hidden">
            <div className="px-6 py-4 border-b border-gray-200 bg-gray-50">
              <h2 className="text-lg font-semibold text-gray-900">Todas as Equipes</h2>
            </div>
            <div className="p-6">
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                {teams.map((team) => (
                  <div
                    key={team.id}
                    className="p-4 border border-gray-200 rounded-lg hover:border-primary hover:shadow-md transition-all"
                  >
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-3">
                        <div className="w-10 h-10 bg-gradient-to-br from-primary to-primary-dark rounded-full flex items-center justify-center text-white font-semibold">
                          {team.nome[0].toUpperCase()}
                        </div>
                        <div>
                          <h3 className="font-semibold text-gray-900">{team.nome}</h3>
                          <p className="text-xs text-gray-500">
                            {teamStats.find(s => s.nome === team.nome)?.total_obras || 0} obras
                          </p>
                        </div>
                      </div>
                      <div className="flex gap-2">
                        <button
                          onClick={() => openModal(team)}
                          className="p-2 text-blue-600 hover:bg-blue-50 rounded-lg transition-colors"
                          title="Editar"
                        >
                          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                          </svg>
                        </button>
                        <button
                          onClick={() => handleDelete(team.id)}
                          className="p-2 text-red-600 hover:bg-red-50 rounded-lg transition-colors"
                          title="Excluir"
                        >
                          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                          </svg>
                        </button>
                      </div>
                    </div>
                  </div>
                ))}
              </div>

              {teams.length === 0 && (
                <div className="text-center py-12">
                  <p className="text-gray-500">Nenhuma equipe cadastrada</p>
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Modal */}
        {showModal && (
          <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
            <div className="bg-white rounded-xl max-w-md w-full p-6">
              <div className="flex justify-between items-center mb-4">
                <h2 className="text-xl font-bold text-gray-900">
                  {editingTeam ? 'Editar Equipe' : 'Nova Equipe'}
                </h2>
                <button
                  onClick={closeModal}
                  className="text-gray-500 hover:text-gray-700"
                >
                  <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </button>
              </div>

              <form onSubmit={handleSubmit} className="space-y-4">
                <div>
                  <label className="block text-sm font-semibold text-gray-700 mb-2">
                    Nome da Equipe
                  </label>
                  <input
                    type="text"
                    required
                    value={teamName}
                    onChange={(e) => setTeamName(e.target.value)}
                    className="w-full px-4 py-3 border border-gray-300 rounded-xl focus:ring-2 focus:ring-primary focus:border-transparent"
                    placeholder="Ex: Equipe A"
                  />
                </div>

                {error && (
                  <div className="p-3 bg-red-50 border border-red-200 rounded-xl">
                    <p className="text-sm text-red-800">{error}</p>
                  </div>
                )}

                <div className="flex gap-3 pt-4">
                  <button
                    type="button"
                    onClick={closeModal}
                    className="flex-1 px-4 py-2 border border-gray-300 text-gray-700 rounded-xl hover:bg-gray-50 transition-colors"
                  >
                    Cancelar
                  </button>
                  <button
                    type="submit"
                    className="flex-1 px-4 py-2 bg-primary text-white rounded-xl hover:bg-primary-dark transition-colors"
                  >
                    {editingTeam ? 'Salvar' : 'Criar'}
                  </button>
                </div>
              </form>
            </div>
          </div>
        )}
      </div>
    </ProtectedRoute>
  )
}
