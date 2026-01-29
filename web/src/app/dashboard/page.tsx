'use client'

import { useEffect, useState, useMemo } from 'react'
import { supabase, type Obra } from '@/lib/supabase'
import { format, startOfMonth, endOfMonth, subDays } from 'date-fns'
import { ptBR } from 'date-fns/locale'
import ProtectedRoute from '@/components/ProtectedRoute'
import AppShell from '@/components/AppShell'

interface EquipeStats {
  equipe: string
  totalObras: number
  obrasHoje: number
  obrasSemana: number
  obrasMes: number
  totalFotos: number
  comAtipicidades: number
  tiposServico: string[]
}

export default function DashboardPage() {
  const [obras, setObras] = useState<Obra[]>([])
  const [loading, setLoading] = useState(true)
  const [filterEquipe, setFilterEquipe] = useState('todas')
  const [filterPeriodo, setFilterPeriodo] = useState('mes')
  const [filterTipoServico, setFilterTipoServico] = useState('todos')
  const [searchNumeroObra, setSearchNumeroObra] = useState('')

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

  // Estatísticas por equipe
  const equipesStats = useMemo(() => {
    const statsMap = new Map<string, EquipeStats>()
    const now = new Date()
    const today = new Date(now.getFullYear(), now.getMonth(), now.getDate())
    const weekAgo = subDays(now, 7)
    const monthStart = startOfMonth(now)

    obras.forEach(obra => {
      const obraDate = new Date(obra.created_at)

      if (!statsMap.has(obra.equipe)) {
        statsMap.set(obra.equipe, {
          equipe: obra.equipe,
          totalObras: 0,
          obrasHoje: 0,
          obrasSemana: 0,
          obrasMes: 0,
          totalFotos: 0,
          comAtipicidades: 0,
          tiposServico: []
        })
      }

      const stats = statsMap.get(obra.equipe)!
      stats.totalObras++

      // Contagem por período
      if (obraDate >= today) stats.obrasHoje++
      if (obraDate >= weekAgo) stats.obrasSemana++
      if (obraDate >= monthStart) stats.obrasMes++

      // Total de fotos
      stats.totalFotos += getAllPhotosCount(obra)

      // Atipicidades
      if (obra.tem_atipicidade) stats.comAtipicidades++

      // Tipos de serviço únicos
      if (!stats.tiposServico.includes(obra.tipo_servico)) {
        stats.tiposServico.push(obra.tipo_servico)
      }
    })

    return Array.from(statsMap.values()).sort((a, b) => b.totalObras - a.totalObras)
  }, [obras])

  // Filtrar obras por período, tipo de serviço e número da obra
  const filteredObras = useMemo(() => {
    const now = new Date()
    let filtered = obras

    // Filtro por número da obra (busca)
    if (searchNumeroObra.trim()) {
      const searchTerm = searchNumeroObra.toLowerCase().trim()
      filtered = filtered.filter(o =>
        o.obra?.toLowerCase().includes(searchTerm) ||
        o.placa?.toLowerCase().includes(searchTerm)
      )
    }

    // Filtro por equipe
    if (filterEquipe !== 'todas') {
      filtered = filtered.filter(o => o.equipe === filterEquipe)
    }

    // Filtro por tipo de serviço
    if (filterTipoServico !== 'todos') {
      filtered = filtered.filter(o => o.tipo_servico === filterTipoServico)
    }

    // Filtro por período
    if (filterPeriodo !== 'todos') {
      filtered = filtered.filter(o => {
        const obraDate = new Date(o.created_at)

        if (filterPeriodo === 'hoje') {
          const today = new Date(now.getFullYear(), now.getMonth(), now.getDate())
          const obraDay = new Date(obraDate.getFullYear(), obraDate.getMonth(), obraDate.getDate())
          return obraDay.getTime() === today.getTime()
        } else if (filterPeriodo === 'semana') {
          return obraDate >= subDays(now, 7)
        } else if (filterPeriodo === 'mes') {
          return obraDate >= startOfMonth(now) && obraDate <= endOfMonth(now)
        }
        return true
      })
    }

    return filtered
  }, [obras, filterEquipe, filterPeriodo, filterTipoServico, searchNumeroObra])

  // Estatísticas gerais
  const stats = useMemo(() => {
    const totalObras = filteredObras.length
    const totalFotos = filteredObras.reduce((acc, o) => acc + getAllPhotosCount(o), 0)
    const comAtipicidades = filteredObras.filter(o => o.tem_atipicidade).length
    const equipesUnicas = new Set(filteredObras.map(o => o.equipe)).size
    const tiposServicoUnicos = new Set(filteredObras.map(o => o.tipo_servico)).size

    return {
      totalObras,
      totalFotos,
      mediaFotosPorObra: totalObras > 0 ? Math.round(totalFotos / totalObras) : 0,
      comAtipicidades,
      percentualAtipicidades: totalObras > 0 ? Math.round((comAtipicidades / totalObras) * 100) : 0,
      equipesUnicas,
      tiposServicoUnicos
    }
  }, [filteredObras])

  // Top 5 equipes do período
  const topEquipes = useMemo(() => {
    const equipesMap = new Map<string, number>()

    filteredObras.forEach(obra => {
      equipesMap.set(obra.equipe, (equipesMap.get(obra.equipe) || 0) + 1)
    })

    return Array.from(equipesMap.entries())
      .sort((a, b) => b[1] - a[1])
      .slice(0, 5)
  }, [filteredObras])

  // Distribuição por tipo de serviço
  const distribuicaoServicos = useMemo(() => {
    const servicosMap = new Map<string, number>()

    filteredObras.forEach(obra => {
      servicosMap.set(obra.tipo_servico, (servicosMap.get(obra.tipo_servico) || 0) + 1)
    })

    return Array.from(servicosMap.entries())
      .sort((a, b) => b[1] - a[1])
  }, [filteredObras])

  // Listas únicas para filtros
  const equipes = useMemo(() => {
    return Array.from(new Set(obras.map(o => o.equipe))).sort()
  }, [obras])

  const tiposServico = useMemo(() => {
    return Array.from(new Set(obras.map(o => o.tipo_servico))).sort()
  }, [obras])

  function getAllPhotosCount(obra: Obra): number {
    let count = 0

    if (obra.fotos_antes?.length) count += obra.fotos_antes.length
    if (obra.fotos_durante?.length) count += obra.fotos_durante.length
    if (obra.fotos_depois?.length) count += obra.fotos_depois.length
    if (obra.fotos_abertura?.length) count += obra.fotos_abertura.length
    if (obra.fotos_fechamento?.length) count += obra.fotos_fechamento.length
    if (obra.fotos_ditais_abertura?.length) count += obra.fotos_ditais_abertura.length
    if (obra.fotos_ditais_impedir?.length) count += obra.fotos_ditais_impedir.length
    if (obra.fotos_ditais_testar?.length) count += obra.fotos_ditais_testar.length
    if (obra.fotos_ditais_aterrar?.length) count += obra.fotos_ditais_aterrar.length
    if (obra.fotos_ditais_sinalizar?.length) count += obra.fotos_ditais_sinalizar.length
    if (obra.fotos_aterramento_vala_aberta?.length) count += obra.fotos_aterramento_vala_aberta.length
    if (obra.fotos_aterramento_hastes?.length) count += obra.fotos_aterramento_hastes.length
    if (obra.fotos_aterramento_vala_fechada?.length) count += obra.fotos_aterramento_vala_fechada.length
    if (obra.fotos_aterramento_medicao?.length) count += obra.fotos_aterramento_medicao.length
    if (obra.fotos_transformador_laudo?.length) count += obra.fotos_transformador_laudo.length
    if (obra.fotos_transformador_componente_instalado?.length) count += obra.fotos_transformador_componente_instalado.length
    if (obra.fotos_transformador_tombamento_instalado?.length) count += obra.fotos_transformador_tombamento_instalado.length
    if (obra.fotos_transformador_tape?.length) count += obra.fotos_transformador_tape.length
    if (obra.fotos_transformador_placa_instalado?.length) count += obra.fotos_transformador_placa_instalado.length
    if (obra.fotos_transformador_instalado?.length) count += obra.fotos_transformador_instalado.length
    if (obra.fotos_transformador_antes_retirar?.length) count += obra.fotos_transformador_antes_retirar.length
    if (obra.fotos_transformador_tombamento_retirado?.length) count += obra.fotos_transformador_tombamento_retirado.length
    if (obra.fotos_transformador_placa_retirado?.length) count += obra.fotos_transformador_placa_retirado.length

    return count
  }

  if (loading) {
    return (
      <ProtectedRoute>
        <div className="min-h-screen flex items-center justify-center">
          <div className="text-center">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto mb-4"></div>
            <p className="text-xl text-gray-600">Carregando dashboard...</p>
          </div>
        </div>
      </ProtectedRoute>
    )
  }

  return (
    <ProtectedRoute>
      <AppShell>
          {/* Header */}
          <div className="mb-8">
            <h1 className="text-3xl lg:text-4xl font-semibold text-slate-900 tracking-tight">Dashboard Analítico</h1>
            <p className="text-sm sm:text-base text-slate-600 mt-1">Visão geral de desempenho e estatísticas por equipe</p>
          </div>

          {/* Filtros */}
          <div className="mb-8 bg-white p-6 rounded-lg shadow border border-gray-200">
            <div className="flex items-center gap-2 mb-4">
              <svg className="w-5 h-5 text-gray-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 4a1 1 0 011-1h16a1 1 0 011 1v2.586a1 1 0 01-.293.707l-6.414 6.414a1 1 0 00-.293.707V17l-4 4v-6.586a1 1 0 00-.293-.707L3.293 7.293A1 1 0 013 6.586V4z" />
              </svg>
              <h3 className="text-base font-semibold text-gray-800">Filtros</h3>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
              {/* Campo de Busca por Número da Obra */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Buscar Nº Obra</label>
                <div className="relative">
                  <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                    <svg className="h-5 w-5 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                    </svg>
                  </div>
                  <input
                    type="text"
                    placeholder="Digite o número..."
                    value={searchNumeroObra}
                    onChange={(e) => setSearchNumeroObra(e.target.value)}
                    className="w-full pl-10 pr-10 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  />
                  {searchNumeroObra && (
                    <button
                      onClick={() => setSearchNumeroObra('')}
                      className="absolute inset-y-0 right-0 pr-3 flex items-center text-gray-400 hover:text-gray-600"
                    >
                      <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                      </svg>
                    </button>
                  )}
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Período</label>
                <select
                  className="w-full px-4 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  value={filterPeriodo}
                  onChange={(e) => setFilterPeriodo(e.target.value)}
                >
                  <option value="todos">Todos os Períodos</option>
                  <option value="hoje">Hoje</option>
                  <option value="semana">Última Semana</option>
                  <option value="mes">Este Mês</option>
                </select>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Equipe</label>
                <select
                  className="w-full px-4 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  value={filterEquipe}
                  onChange={(e) => setFilterEquipe(e.target.value)}
                >
                  <option value="todas">Todas as Equipes</option>
                  {equipes.map(equipe => (
                    <option key={equipe} value={equipe}>{equipe}</option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Tipo de Serviço</label>
                <select
                  className="w-full px-4 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  value={filterTipoServico}
                  onChange={(e) => setFilterTipoServico(e.target.value)}
                >
                  <option value="todos">Todos os Serviços</option>
                  {tiposServico.map(tipo => (
                    <option key={tipo} value={tipo}>{tipo}</option>
                  ))}
                </select>
              </div>
            </div>
          </div>

          {/* Cards de Estatísticas Principais */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
            <div className="bg-white p-6 rounded-lg shadow border border-gray-200">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-gray-600 mb-1">Total de Obras</p>
                  <p className="text-3xl font-bold text-gray-900">{stats.totalObras}</p>
                  <p className="text-xs text-gray-500 mt-1">{equipes.length} equipes ativas</p>
                </div>
                <div className="w-12 h-12 bg-blue-100 rounded-lg flex items-center justify-center">
                  <svg className="w-6 h-6 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4" />
                  </svg>
                </div>
              </div>
            </div>

            <div className="bg-white p-6 rounded-lg shadow border border-gray-200">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-gray-600 mb-1">Total de Fotos</p>
                  <p className="text-3xl font-bold text-green-600">{stats.totalFotos}</p>
                  <p className="text-xs text-gray-500 mt-1">~{stats.mediaFotosPorObra} por obra</p>
                </div>
                <div className="w-12 h-12 bg-green-100 rounded-lg flex items-center justify-center">
                  <svg className="w-6 h-6 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
                  </svg>
                </div>
              </div>
            </div>

            <div className="bg-white p-6 rounded-lg shadow border border-gray-200">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-gray-600 mb-1">Atipicidades</p>
                  <p className="text-3xl font-bold text-orange-600">{stats.comAtipicidades}</p>
                  <p className="text-xs text-gray-500 mt-1">{stats.percentualAtipicidades}% do total</p>
                </div>
                <div className="w-12 h-12 bg-orange-100 rounded-lg flex items-center justify-center">
                  <svg className="w-6 h-6 text-orange-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                  </svg>
                </div>
              </div>
            </div>

            <div className="bg-white p-6 rounded-lg shadow border border-gray-200">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-gray-600 mb-1">Tipos de Serviço</p>
                  <p className="text-3xl font-bold text-purple-600">{stats.tiposServicoUnicos}</p>
                  <p className="text-xs text-gray-500 mt-1">serviços diferentes</p>
                </div>
                <div className="w-12 h-12 bg-purple-100 rounded-lg flex items-center justify-center">
                  <svg className="w-6 h-6 text-purple-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 21a4 4 0 01-4-4V5a2 2 0 012-2h4a2 2 0 012 2v12a4 4 0 01-4 4zm0 0h12a2 2 0 002-2v-4a2 2 0 00-2-2h-2.343M11 7.343l1.657-1.657a2 2 0 012.828 0l2.829 2.829a2 2 0 010 2.828l-8.486 8.485M7 17h.01" />
                  </svg>
                </div>
              </div>
            </div>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-8">
            {/* Top 5 Equipes */}
            <div className="bg-white p-6 rounded-lg shadow border border-gray-200">
              <h3 className="text-lg font-semibold text-gray-900 mb-4 flex items-center gap-2">
                <svg className="w-5 h-5 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
                </svg>
                Top 5 Equipes
              </h3>
              <div className="space-y-3">
                {topEquipes.length === 0 ? (
                  <p className="text-gray-500 text-sm">Nenhuma obra no período selecionado</p>
                ) : (
                  topEquipes.map(([equipe, count], index) => {
                    const maxCount = topEquipes[0][1]
                    const percentage = (count / maxCount) * 100

                    return (
                      <div key={equipe}>
                        <div className="flex items-center justify-between mb-1">
                          <span className="text-sm font-medium text-gray-700 flex items-center gap-2">
                            <span className={`flex items-center justify-center w-6 h-6 rounded-full text-xs font-bold ${
                              index === 0 ? 'bg-yellow-100 text-yellow-700' :
                              index === 1 ? 'bg-gray-200 text-gray-700' :
                              index === 2 ? 'bg-orange-100 text-orange-700' :
                              'bg-blue-50 text-blue-600'
                            }`}>
                              {index + 1}
                            </span>
                            {equipe}
                          </span>
                          <span className="text-sm font-semibold text-gray-900">{count} obras</span>
                        </div>
                        <div className="w-full bg-gray-200 rounded-full h-2">
                          <div
                            className="bg-blue-600 h-2 rounded-full transition-all"
                            style={{ width: `${percentage}%` }}
                          />
                        </div>
                      </div>
                    )
                  })
                )}
              </div>
            </div>

            {/* Distribuição por Tipo de Serviço */}
            <div className="bg-white p-6 rounded-lg shadow border border-gray-200">
              <h3 className="text-lg font-semibold text-gray-900 mb-4 flex items-center gap-2">
                <svg className="w-5 h-5 text-purple-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 3.055A9.001 9.001 0 1020.945 13H11V3.055z" />
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M20.488 9H15V3.512A9.025 9.025 0 0120.488 9z" />
                </svg>
                Distribuição por Serviço
              </h3>
              <div className="space-y-3">
                {distribuicaoServicos.length === 0 ? (
                  <p className="text-gray-500 text-sm">Nenhuma obra no período selecionado</p>
                ) : (
                  distribuicaoServicos.slice(0, 6).map(([servico, count]) => {
                    const total = filteredObras.length
                    const percentage = (count / total) * 100

                    return (
                      <div key={servico}>
                        <div className="flex items-center justify-between mb-1">
                          <span className="text-sm font-medium text-gray-700 truncate">{servico}</span>
                          <span className="text-sm font-semibold text-gray-900">{count} ({percentage.toFixed(0)}%)</span>
                        </div>
                        <div className="w-full bg-gray-200 rounded-full h-2">
                          <div
                            className="bg-purple-600 h-2 rounded-full transition-all"
                            style={{ width: `${percentage}%` }}
                          />
                        </div>
                      </div>
                    )
                  })
                )}
              </div>
            </div>
          </div>

          {/* Tabela de Estatísticas por Equipe */}
          <div className="bg-white rounded-lg shadow border border-gray-200 overflow-hidden">
            <div className="px-6 py-4 border-b border-gray-200">
              <h3 className="text-lg font-semibold text-gray-900">Estatísticas Detalhadas por Equipe</h3>
            </div>
            <div className="overflow-x-auto">
              <table className="min-w-full divide-y divide-gray-200">
                <thead className="bg-gray-50">
                  <tr>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Equipe
                    </th>
                    <th className="px-6 py-3 text-center text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Total
                    </th>
                    <th className="px-6 py-3 text-center text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Hoje
                    </th>
                    <th className="px-6 py-3 text-center text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Esta Semana
                    </th>
                    <th className="px-6 py-3 text-center text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Este Mês
                    </th>
                    <th className="px-6 py-3 text-center text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Fotos
                    </th>
                    <th className="px-6 py-3 text-center text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Atipicidades
                    </th>
                    <th className="px-6 py-3 text-center text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Serviços
                    </th>
                  </tr>
                </thead>
                <tbody className="bg-white divide-y divide-gray-200">
                  {equipesStats.map((stats) => (
                    <tr key={stats.equipe} className="hover:bg-gray-50 transition-colors">
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div className="flex items-center">
                          <div className="flex-shrink-0 h-10 w-10 bg-blue-600 text-white rounded-full flex items-center justify-center font-semibold">
                            {stats.equipe.substring(0, 2)}
                          </div>
                          <div className="ml-4">
                            <div className="text-sm font-medium text-gray-900">{stats.equipe}</div>
                          </div>
                        </div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-center">
                        <span className="text-sm font-semibold text-gray-900">{stats.totalObras}</span>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-center">
                        <span className="text-sm text-gray-600">{stats.obrasHoje}</span>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-center">
                        <span className="text-sm text-gray-600">{stats.obrasSemana}</span>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-center">
                        <span className="text-sm text-gray-600">{stats.obrasMes}</span>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-center">
                        <span className="text-sm text-green-600 font-medium">{stats.totalFotos}</span>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-center">
                        {stats.comAtipicidades > 0 ? (
                          <span className="px-2 py-1 text-xs font-medium bg-orange-100 text-orange-700 rounded-full">
                            {stats.comAtipicidades}
                          </span>
                        ) : (
                          <span className="text-sm text-gray-400">0</span>
                        )}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-center">
                        <span className="text-sm text-gray-600">{stats.tiposServico.length}</span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {equipesStats.length === 0 && (
              <div className="text-center py-12">
                <svg className="mx-auto h-12 w-12 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z" />
                </svg>
                <p className="text-gray-500 mt-4">Nenhuma obra cadastrada</p>
              </div>
            )}
          </div>
      </AppShell>
    </ProtectedRoute>
  )
}
