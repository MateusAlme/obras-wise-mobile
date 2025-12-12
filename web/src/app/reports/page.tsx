'use client'

import { useEffect, useState, useMemo } from 'react'
import { supabase, type Obra } from '@/lib/supabase'
import ProtectedRoute from '@/components/ProtectedRoute'
import Sidebar from '@/components/Sidebar'
import { format, startOfMonth, endOfMonth } from 'date-fns'
import { ptBR } from 'date-fns/locale'
import { generatePDF } from '@/lib/pdf-generator'

export default function ReportsPage() {
  const [obras, setObras] = useState<Obra[]>([])
  const [loading, setLoading] = useState(true)
  const [selectedPeriod, setSelectedPeriod] = useState('todos')
  const [selectedTeam, setSelectedTeam] = useState('todas')
  const [selectedService, setSelectedService] = useState('todos')
  const [generatingPDFs, setGeneratingPDFs] = useState(false)

  useEffect(() => {
    loadObras()
  }, [])

  async function loadObras() {
    try {
      const { data, error } = await supabase
        .from('obras')
        .select('*')
        .order('created_at', { ascending: false })

      if (error) throw error
      setObras(data || [])
    } catch (error) {
      console.error('Erro ao carregar obras:', error)
    } finally {
      setLoading(false)
    }
  }

  const filteredObras = useMemo(() => {
    return obras.filter((obra) => {
      // Filtro por período
      if (selectedPeriod !== 'todos') {
        const obraDate = new Date(obra.created_at)
        const now = new Date()

        if (selectedPeriod === 'hoje') {
          const today = new Date(now.getFullYear(), now.getMonth(), now.getDate())
          const obraDay = new Date(obraDate.getFullYear(), obraDate.getMonth(), obraDate.getDate())
          if (obraDay.getTime() !== today.getTime()) return false
        } else if (selectedPeriod === 'semana') {
          const weekAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000)
          if (obraDate < weekAgo) return false
        } else if (selectedPeriod === 'mes') {
          const monthStart = startOfMonth(now)
          const monthEnd = endOfMonth(now)
          if (obraDate < monthStart || obraDate > monthEnd) return false
        }
      }

      // Filtro por equipe
      if (selectedTeam !== 'todas' && obra.equipe !== selectedTeam) {
        return false
      }

      // Filtro por tipo de serviço
      if (selectedService !== 'todos' && obra.tipo_servico !== selectedService) {
        return false
      }

      return true
    })
  }, [obras, selectedPeriod, selectedTeam, selectedService])

  const teams = useMemo(() => {
    return Array.from(new Set(obras.map((o) => o.equipe))).sort()
  }, [obras])

  const services = useMemo(() => {
    return Array.from(new Set(obras.map((o) => o.tipo_servico))).sort()
  }, [obras])

  const stats = useMemo(() => {
    const totalObras = filteredObras.length
    const obrasComAtipicidade = filteredObras.filter((o) => o.tem_atipicidade).length
    const totalFotos = filteredObras.reduce((acc, obra) => {
      let count = 0
      if (obra.fotos_antes?.length) count += obra.fotos_antes.length
      if (obra.fotos_durante?.length) count += obra.fotos_durante.length
      if (obra.fotos_depois?.length) count += obra.fotos_depois.length
      return acc + count
    }, 0)

    return {
      totalObras,
      obrasComAtipicidade,
      totalFotos,
      mediaFotos: totalObras > 0 ? Math.round(totalFotos / totalObras) : 0,
    }
  }, [filteredObras])

  async function downloadFilteredPDFs() {
    if (filteredObras.length === 0) {
      alert('Nenhuma obra encontrada com os filtros selecionados')
      return
    }

    if (!confirm(`Deseja gerar ${filteredObras.length} PDF(s)? Isso pode levar alguns minutos.`)) {
      return
    }

    setGeneratingPDFs(true)
    let successCount = 0
    let errorCount = 0

    for (let i = 0; i < filteredObras.length; i++) {
      try {
        await generatePDF(filteredObras[i])
        successCount++
        await new Promise((resolve) => setTimeout(resolve, 500))
      } catch (error) {
        console.error(`Erro ao gerar PDF da obra ${filteredObras[i].obra}:`, error)
        errorCount++
      }
    }

    setGeneratingPDFs(false)
    alert(`PDFs gerados!\n\nSucesso: ${successCount}\nErros: ${errorCount}`)
  }

  if (loading) {
    return (
      <ProtectedRoute>
        <div className="min-h-screen flex items-center justify-center">
          <p className="text-xl text-gray-600">Carregando relatórios...</p>
        </div>
      </ProtectedRoute>
    )
  }

  return (
    <ProtectedRoute>
      <div className="min-h-screen bg-gray-50 flex">
        <Sidebar />

        <div className="flex-1 px-4 sm:px-6 lg:px-8 py-8">
          {/* Header */}
          <div className="mb-8">
            <h1 className="text-3xl font-bold text-gray-900">Relatórios</h1>
            <p className="text-gray-600 mt-1 flex items-center gap-2">
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 17v-2m3 2v-4m3 4v-6m2 10H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
              </svg>
              Gere relatórios e exporte dados das obras
            </p>
          </div>

          {/* Filters */}
          <div className="bg-white p-6 rounded-xl shadow-md border border-gray-100 mb-8">
            <div className="flex items-center gap-2 mb-4">
              <svg className="w-5 h-5 text-gray-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 4a1 1 0 011-1h16a1 1 0 011 1v2.586a1 1 0 01-.293.707l-6.414 6.414a1 1 0 00-.293.707V17l-4 4v-6.586a1 1 0 00-.293-.707L3.293 7.293A1 1 0 013 6.586V4z" />
              </svg>
              <h3 className="text-base font-semibold text-gray-800">Filtrar Relatórios</h3>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-2">Período</label>
                <select
                  className="w-full px-4 py-2.5 border border-gray-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent shadow-sm bg-white"
                  value={selectedPeriod}
                  onChange={(e) => setSelectedPeriod(e.target.value)}
                >
                  <option value="todos">Todos os Períodos</option>
                  <option value="hoje">Hoje</option>
                  <option value="semana">Última Semana</option>
                  <option value="mes">Este Mês</option>
                </select>
              </div>

              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-2">Equipe</label>
                <select
                  className="w-full px-4 py-2.5 border border-gray-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent shadow-sm bg-white"
                  value={selectedTeam}
                  onChange={(e) => setSelectedTeam(e.target.value)}
                >
                  <option value="todas">Todas as Equipes</option>
                  {teams.map((team) => (
                    <option key={team} value={team}>
                      {team}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-2">Tipo de Serviço</label>
                <select
                  className="w-full px-4 py-2.5 border border-gray-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent shadow-sm bg-white"
                  value={selectedService}
                  onChange={(e) => setSelectedService(e.target.value)}
                >
                  <option value="todos">Todos os Serviços</option>
                  {services.map((service) => (
                    <option key={service} value={service}>
                      {service}
                    </option>
                  ))}
                </select>
              </div>
            </div>
          </div>

          {/* Stats */}
          <div className="grid grid-cols-1 md:grid-cols-4 gap-6 mb-8">
            <div className="bg-gradient-to-br from-blue-500 to-blue-600 p-6 rounded-xl shadow-lg text-white">
              <div className="flex items-center justify-between mb-2">
                <h3 className="text-blue-100 text-sm font-medium">Obras no Período</h3>
                <svg className="w-6 h-6 text-blue-200" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4" />
                </svg>
              </div>
              <p className="text-4xl font-bold">{stats.totalObras}</p>
            </div>

            <div className="bg-gradient-to-br from-orange-500 to-orange-600 p-6 rounded-xl shadow-lg text-white">
              <div className="flex items-center justify-between mb-2">
                <h3 className="text-orange-100 text-sm font-medium">Com Atipicidades</h3>
                <svg className="w-6 h-6 text-orange-200" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                </svg>
              </div>
              <p className="text-4xl font-bold">{stats.obrasComAtipicidade}</p>
              <p className="text-orange-100 text-xs mt-1">
                {stats.totalObras > 0
                  ? `${Math.round((stats.obrasComAtipicidade / stats.totalObras) * 100)}% do total`
                  : '0% do total'}
              </p>
            </div>

            <div className="bg-gradient-to-br from-green-500 to-green-600 p-6 rounded-xl shadow-lg text-white">
              <div className="flex items-center justify-between mb-2">
                <h3 className="text-green-100 text-sm font-medium">Total de Fotos</h3>
                <svg className="w-6 h-6 text-green-200" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
                </svg>
              </div>
              <p className="text-4xl font-bold">{stats.totalFotos}</p>
              <p className="text-green-100 text-xs mt-1">{stats.mediaFotos} fotos por obra</p>
            </div>

            <div className="bg-gradient-to-br from-purple-500 to-purple-600 p-6 rounded-xl shadow-lg text-white">
              <div className="flex items-center justify-between mb-2">
                <h3 className="text-purple-100 text-sm font-medium">Tipos de Serviço</h3>
                <svg className="w-6 h-6 text-purple-200" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" />
                </svg>
              </div>
              <p className="text-4xl font-bold">
                {new Set(filteredObras.map((o) => o.tipo_servico)).size}
              </p>
              <p className="text-purple-100 text-xs mt-1">serviços diferentes</p>
            </div>
          </div>

          {/* Actions */}
          <div className="bg-white p-6 rounded-xl shadow-md border border-gray-100">
            <h3 className="text-lg font-semibold text-gray-900 mb-4">Ações de Relatório</h3>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <button
                onClick={downloadFilteredPDFs}
                disabled={generatingPDFs || filteredObras.length === 0}
                className="flex items-center justify-center gap-3 px-6 py-4 bg-gradient-to-r from-green-600 to-green-700 hover:from-green-700 hover:to-green-800 text-white rounded-xl transition-all shadow-lg hover:shadow-xl disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {generatingPDFs ? (
                  <>
                    <svg className="animate-spin h-5 w-5" fill="none" viewBox="0 0 24 24">
                      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                    </svg>
                    <span className="font-semibold">Gerando PDFs...</span>
                  </>
                ) : (
                  <>
                    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 10v6m0 0l-3-3m3 3l3-3m2 8H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                    </svg>
                    <div className="text-left">
                      <div className="font-semibold">Baixar PDFs das Obras</div>
                      <div className="text-sm text-green-100">
                        {filteredObras.length} obra{filteredObras.length !== 1 ? 's' : ''} selecionada{filteredObras.length !== 1 ? 's' : ''}
                      </div>
                    </div>
                  </>
                )}
              </button>

              <button
                disabled
                className="flex items-center justify-center gap-3 px-6 py-4 bg-gray-300 text-gray-500 rounded-xl cursor-not-allowed"
              >
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                </svg>
                <div className="text-left">
                  <div className="font-semibold">Exportar para Excel</div>
                  <div className="text-sm">Em breve</div>
                </div>
              </button>
            </div>
          </div>
        </div>
      </div>
    </ProtectedRoute>
  )
}
