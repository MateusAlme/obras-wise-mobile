'use client'

import { useEffect, useState } from 'react'
import { supabase } from '@/lib/supabase'
import ProtectedRoute from '@/components/ProtectedRoute'
import Sidebar from '@/components/Sidebar'
import { format } from 'date-fns'
import { ptBR } from 'date-fns/locale'

interface Equipe {
  id: string
  equipe_codigo: string
  ativo: boolean
  created_at: string
  updated_at: string
}

export default function UsersPage() {
  const [equipes, setEquipes] = useState<Equipe[]>([])
  const [loading, setLoading] = useState(true)
  const [showModal, setShowModal] = useState(false)
  const [isCreating, setIsCreating] = useState(false)
  const [selectedEquipe, setSelectedEquipe] = useState<Equipe | null>(null)

  const [formData, setFormData] = useState({
    equipe_codigo: '',
    senha: '',
    ativo: true
  })

  const [error, setError] = useState('')
  const [success, setSuccess] = useState('')
  const [searchTerm, setSearchTerm] = useState('')

  useEffect(() => {
    loadEquipes()
  }, [])

  async function loadEquipes() {
    try {
      const { data, error } = await supabase
        .from('equipe_credenciais')
        .select('*')
        .order('equipe_codigo', { ascending: true })

      if (error) throw error
      setEquipes(data || [])
    } catch (error) {
      console.error('Erro ao carregar usuários:', error)
    } finally {
      setLoading(false)
    }
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError('')
    setSuccess('')

    try {
      if (isCreating) {
        // Criar novo usuário
        if (!formData.senha || formData.senha.length < 6) {
          setError('A senha deve ter no mínimo 6 caracteres!')
          return
        }

        const { error } = await supabase.rpc('criar_equipe', {
          p_equipe_codigo: formData.equipe_codigo,
          p_senha: formData.senha
        })

        if (error) throw error

        setSuccess(`Usuário "${formData.equipe_codigo}" criado com sucesso!`)
      } else {
        // Editar usuário existente
        const updates: any = {
          equipe_codigo: formData.equipe_codigo,
          ativo: formData.ativo,
          updated_at: new Date().toISOString()
        }

        const { error } = await supabase
          .from('equipe_credenciais')
          .update(updates)
          .eq('id', selectedEquipe!.id)

        if (error) throw error

        // Se alterou senha, chamar função separada
        if (formData.senha && formData.senha.length >= 6) {
          const { error: passwordError } = await supabase.rpc('admin_alterar_senha_equipe', {
            p_equipe_codigo: formData.equipe_codigo,
            p_senha_nova: formData.senha
          })

          if (passwordError) throw passwordError
        }

        setSuccess('Usuário atualizado com sucesso!')
      }

      await loadEquipes()
      setTimeout(() => closeModal(), 1500)
    } catch (error: any) {
      setError(error.message || 'Erro ao salvar usuário')
    }
  }

  async function handleDelete(equipe: Equipe) {
    if (!confirm(`Tem certeza que deseja EXCLUIR o usuário "${equipe.equipe_codigo}"?\n\nEsta ação não pode ser desfeita!`)) return

    try {
      const { error } = await supabase
        .from('equipe_credenciais')
        .delete()
        .eq('id', equipe.id)

      if (error) throw error

      setSuccess(`Usuário "${equipe.equipe_codigo}" excluído com sucesso!`)
      await loadEquipes()
      setTimeout(() => setSuccess(''), 3000)
    } catch (error: any) {
      setError('Erro ao excluir usuário: ' + error.message)
      setTimeout(() => setError(''), 3000)
    }
  }

  function openCreateModal() {
    setIsCreating(true)
    setSelectedEquipe(null)
    setFormData({ equipe_codigo: '', senha: '', ativo: true })
    setError('')
    setSuccess('')
    setShowModal(true)
  }

  function openEditModal(equipe: Equipe) {
    setIsCreating(false)
    setSelectedEquipe(equipe)
    setFormData({
      equipe_codigo: equipe.equipe_codigo,
      senha: '',
      ativo: equipe.ativo
    })
    setError('')
    setSuccess('')
    setShowModal(true)
  }

  function closeModal() {
    setShowModal(false)
    setIsCreating(false)
    setSelectedEquipe(null)
    setFormData({ equipe_codigo: '', senha: '', ativo: true })
    setError('')
    setSuccess('')
  }

  const filteredEquipes = equipes.filter(equipe =>
    equipe.equipe_codigo.toLowerCase().includes(searchTerm.toLowerCase())
  )

  const equipesAtivas = equipes.filter(e => e.ativo).length
  const equipesInativas = equipes.length - equipesAtivas

  if (loading) {
    return (
      <ProtectedRoute requireAdmin>
        <div className="min-h-screen flex items-center justify-center">
          <div className="text-center">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto mb-4"></div>
            <p className="text-xl text-gray-600">Carregando usuários...</p>
          </div>
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
              <h1 className="text-3xl font-bold text-gray-900">Gerenciar Usuários</h1>
              <p className="text-gray-600 mt-1">Criar, editar e gerenciar usuários do sistema</p>
            </div>
            <button
              onClick={openCreateModal}
              className="px-5 py-2.5 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors shadow-md hover:shadow-lg flex items-center gap-2 font-medium"
            >
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
              </svg>
              Novo Usuário
            </button>
          </div>

          {/* Success/Error Messages */}
          {success && (
            <div className="mb-4 p-4 bg-green-50 border border-green-200 rounded-lg flex items-center gap-2">
              <svg className="w-5 h-5 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
              </svg>
              <p className="text-sm text-green-800 font-medium">{success}</p>
            </div>
          )}

          {error && (
            <div className="mb-4 p-4 bg-red-50 border border-red-200 rounded-lg flex items-center gap-2">
              <svg className="w-5 h-5 text-red-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
              <p className="text-sm text-red-800 font-medium">{error}</p>
            </div>
          )}

          {/* Stats */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
            <div className="bg-white p-6 rounded-lg shadow border border-gray-200">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-gray-600 mb-1">Total de Usuários</p>
                  <p className="text-3xl font-bold text-gray-900">{equipes.length}</p>
                </div>
                <div className="w-12 h-12 bg-blue-100 rounded-lg flex items-center justify-center">
                  <svg className="w-6 h-6 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4.354a4 4 0 110 5.292M15 21H3v-1a6 6 0 0112 0v1zm0 0h6v-1a6 6 0 00-9-5.197M13 7a4 4 0 11-8 0 4 4 0 018 0z" />
                  </svg>
                </div>
              </div>
            </div>

            <div className="bg-white p-6 rounded-lg shadow border border-gray-200">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-gray-600 mb-1">Usuários Ativos</p>
                  <p className="text-3xl font-bold text-green-600">{equipesAtivas}</p>
                </div>
                <div className="w-12 h-12 bg-green-100 rounded-lg flex items-center justify-center">
                  <svg className="w-6 h-6 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                  </svg>
                </div>
              </div>
            </div>

            <div className="bg-white p-6 rounded-lg shadow border border-gray-200">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-gray-600 mb-1">Usuários Inativos</p>
                  <p className="text-3xl font-bold text-gray-600">{equipesInativas}</p>
                </div>
                <div className="w-12 h-12 bg-gray-100 rounded-lg flex items-center justify-center">
                  <svg className="w-6 h-6 text-gray-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M18.364 18.364A9 9 0 005.636 5.636m12.728 12.728A9 9 0 015.636 5.636m12.728 12.728L5.636 5.636" />
                  </svg>
                </div>
              </div>
            </div>
          </div>

          {/* Search */}
          <div className="mb-6">
            <div className="relative">
              <input
                type="text"
                placeholder="Buscar usuário..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="w-full px-4 py-3 pl-11 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              />
              <svg className="w-5 h-5 text-gray-400 absolute left-3.5 top-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
              </svg>
            </div>
          </div>

          {/* Users Table */}
          <div className="bg-white rounded-lg shadow border border-gray-200 overflow-hidden">
            <div className="overflow-x-auto">
              <table className="min-w-full divide-y divide-gray-200">
                <thead className="bg-gray-50">
                  <tr>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Usuário
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Status
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Criado em
                    </th>
                    <th className="px-6 py-3 text-center text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Ações
                    </th>
                  </tr>
                </thead>
                <tbody className="bg-white divide-y divide-gray-200">
                  {filteredEquipes.map((equipe) => (
                    <tr key={equipe.id} className="hover:bg-gray-50 transition-colors">
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div className="flex items-center">
                          <div className={`flex-shrink-0 h-10 w-10 ${equipe.ativo ? 'bg-blue-600' : 'bg-gray-400'} text-white rounded-full flex items-center justify-center font-semibold transition-colors`}>
                            {equipe.equipe_codigo.substring(0, 2)}
                          </div>
                          <div className="ml-4">
                            <div className="text-sm font-medium text-gray-900">
                              {equipe.equipe_codigo}
                            </div>
                          </div>
                        </div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <span className={`px-3 py-1 inline-flex text-xs leading-5 font-semibold rounded-full ${
                          equipe.ativo
                            ? 'bg-green-100 text-green-800'
                            : 'bg-gray-100 text-gray-800'
                        }`}>
                          {equipe.ativo ? 'Ativo' : 'Inativo'}
                        </span>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                        {format(new Date(equipe.created_at), "dd/MM/yyyy", { locale: ptBR })}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-center">
                        <div className="flex items-center justify-center gap-2">
                          <button
                            onClick={() => openEditModal(equipe)}
                            className="p-2 text-blue-600 hover:bg-blue-50 rounded-lg transition-colors"
                            title="Editar usuário"
                          >
                            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                            </svg>
                          </button>
                          <button
                            onClick={() => handleDelete(equipe)}
                            className="p-2 text-red-600 hover:bg-red-50 rounded-lg transition-colors"
                            title="Excluir usuário"
                          >
                            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                            </svg>
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {filteredEquipes.length === 0 && (
              <div className="text-center py-12">
                <svg className="mx-auto h-12 w-12 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4.354a4 4 0 110 5.292M15 21H3v-1a6 6 0 0112 0v1zm0 0h6v-1a6 6 0 00-9-5.197M13 7a4 4 0 11-8 0 4 4 0 018 0z" />
                </svg>
                <p className="text-gray-500 mt-4">
                  {searchTerm ? 'Nenhum usuário encontrado' : 'Nenhum usuário cadastrado'}
                </p>
              </div>
            )}
          </div>
        </div>

        {/* Modal de Criar/Editar */}
        {showModal && (
          <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
            <div className="bg-white rounded-lg max-w-md w-full p-6 shadow-xl">
              <div className="flex justify-between items-center mb-6">
                <h2 className="text-xl font-bold text-gray-900">
                  {isCreating ? 'Novo Usuário' : 'Editar Usuário'}
                </h2>
                <button
                  onClick={closeModal}
                  className="text-gray-400 hover:text-gray-600 transition-colors"
                >
                  <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </button>
              </div>

              <form onSubmit={handleSubmit} className="space-y-4">
                {/* Nome de Usuário */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Nome de Usuário *
                  </label>
                  <input
                    type="text"
                    required
                    disabled={!isCreating}
                    value={formData.equipe_codigo}
                    onChange={(e) => setFormData({ ...formData, equipe_codigo: e.target.value.toUpperCase() })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent disabled:bg-gray-100 disabled:cursor-not-allowed"
                    placeholder="Ex: CNT 01, MNT 02"
                  />
                  <p className="text-xs text-gray-500 mt-1">
                    {isCreating ? 'Nome de usuário para login no sistema' : 'Nome de usuário não pode ser alterado'}
                  </p>
                </div>

                {/* Senha */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    {isCreating ? 'Senha *' : 'Nova Senha (deixe vazio para não alterar)'}
                  </label>
                  <input
                    type="password"
                    required={isCreating}
                    value={formData.senha}
                    onChange={(e) => setFormData({ ...formData, senha: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    placeholder="Mínimo 6 caracteres"
                    minLength={6}
                  />
                </div>

                {/* Status (apenas para edição) */}
                {!isCreating && (
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Status
                    </label>
                    <div className="flex items-center gap-4">
                      <label className="flex items-center cursor-pointer">
                        <input
                          type="radio"
                          name="ativo"
                          checked={formData.ativo === true}
                          onChange={() => setFormData({ ...formData, ativo: true })}
                          className="mr-2 text-blue-600 focus:ring-blue-500"
                        />
                        <span className="text-sm text-gray-700">Ativo</span>
                      </label>
                      <label className="flex items-center cursor-pointer">
                        <input
                          type="radio"
                          name="ativo"
                          checked={formData.ativo === false}
                          onChange={() => setFormData({ ...formData, ativo: false })}
                          className="mr-2 text-blue-600 focus:ring-blue-500"
                        />
                        <span className="text-sm text-gray-700">Inativo</span>
                      </label>
                    </div>
                    <p className="text-xs text-gray-500 mt-1">
                      Usuários inativos não podem fazer login
                    </p>
                  </div>
                )}

                {error && (
                  <div className="p-3 bg-red-50 border border-red-200 rounded-lg">
                    <p className="text-sm text-red-800">{error}</p>
                  </div>
                )}

                {success && (
                  <div className="p-3 bg-green-50 border border-green-200 rounded-lg">
                    <p className="text-sm text-green-800">{success}</p>
                  </div>
                )}

                <div className="flex gap-3 pt-4">
                  <button
                    type="button"
                    onClick={closeModal}
                    className="flex-1 px-4 py-2 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 transition-colors font-medium"
                  >
                    Cancelar
                  </button>
                  <button
                    type="submit"
                    className="flex-1 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors font-medium"
                  >
                    {isCreating ? 'Criar' : 'Salvar'}
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
