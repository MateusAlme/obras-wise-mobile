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
      if (obraDate >= today) stats.obrasHoje++
      if (obraDate >= weekAgo) stats.obrasSemana++
      if (obraDate >= monthStart) stats.obrasMes++
      stats.totalFotos += getAllPhotosCount(obra)
      if (obra.tem_atipicidade) stats.comAtipicidades++
      if (!stats.tiposServico.includes(obra.tipo_servico)) {
        stats.tiposServico.push(obra.tipo_servico)
      }
    })

    return Array.from(statsMap.values()).sort((a, b) => b.totalObras - a.totalObras)
  }, [obras])

  const filteredObras = useMemo(() => {
    const now = new Date()
    let filtered = obras

    if (searchNumeroObra.trim()) {
      const searchTerm = searchNumeroObra.toLowerCase().trim()
      filtered = filtered.filter(o =>
        o.obra?.toLowerCase().includes(searchTerm) ||
        o.placa?.toLowerCase().includes(searchTerm)
      )
    }

    if (filterEquipe !== 'todas') {
      filtered = filtered.filter(o => o.equipe === filterEquipe)
    }

    if (filterTipoServico !== 'todos') {
      filtered = filtered.filter(o => o.tipo_servico === filterTipoServico)
    }

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

  const stats = useMemo(() => {
    const totalObras = filteredObras.length
    const totalFotos = filteredObras.reduce((acc, o) => acc + getAllPhotosCount(o), 0)
    const comAtipicidades = filteredObras.filter(o => o.tem_atipicidade).length
    const equipesUnicas = new Set(filteredObras.map(o => o.equipe)).size
    const tiposServicoUnicos = new Set(filteredObras.map(o => o.tipo_servico)).size
    const concluidas = filteredObras.filter(o => o.data_fechamento).length

    return {
      totalObras,
      totalFotos,
      mediaFotosPorObra: totalObras > 0 ? Math.round(totalFotos / totalObras) : 0,
      comAtipicidades,
      percentualAtipicidades: totalObras > 0 ? Math.round((comAtipicidades / totalObras) * 100) : 0,
      equipesUnicas,
      tiposServicoUnicos,
      concluidas,
      percentualConcluidas: totalObras > 0 ? Math.round((concluidas / totalObras) * 100) : 0,
    }
  }, [filteredObras])

  const topEquipes = useMemo(() => {
    const equipesMap = new Map<string, number>()
    filteredObras.forEach(obra => {
      equipesMap.set(obra.equipe, (equipesMap.get(obra.equipe) || 0) + 1)
    })
    return Array.from(equipesMap.entries())
      .sort((a, b) => b[1] - a[1])
      .slice(0, 5)
  }, [filteredObras])

  const distribuicaoServicos = useMemo(() => {
    const servicosMap = new Map<string, number>()
    filteredObras.forEach(obra => {
      servicosMap.set(obra.tipo_servico, (servicosMap.get(obra.tipo_servico) || 0) + 1)
    })
    return Array.from(servicosMap.entries()).sort((a, b) => b[1] - a[1])
  }, [filteredObras])

  const equipes = useMemo(() => Array.from(new Set(obras.map(o => o.equipe))).sort(), [obras])
  const tiposServico = useMemo(() => Array.from(new Set(obras.map(o => o.tipo_servico))).sort(), [obras])

  function getAllPhotosCount(obra: Obra): number {
    let count = 0
    const fields = [
      'fotos_antes','fotos_durante','fotos_depois','fotos_abertura','fotos_fechamento',
      'fotos_ditais_abertura','fotos_ditais_impedir','fotos_ditais_testar','fotos_ditais_aterrar','fotos_ditais_sinalizar',
      'fotos_aterramento_vala_aberta','fotos_aterramento_hastes','fotos_aterramento_vala_fechada','fotos_aterramento_medicao',
      'fotos_transformador_laudo','fotos_transformador_componente_instalado','fotos_transformador_tombamento_instalado',
      'fotos_transformador_tape','fotos_transformador_placa_instalado','fotos_transformador_instalado',
      'fotos_transformador_antes_retirar','fotos_transformador_tombamento_retirado','fotos_transformador_placa_retirado',
    ]
    fields.forEach(f => { if ((obra as any)[f]?.length) count += (obra as any)[f].length })
    return count
  }

  const activeFilters = [
    filterPeriodo !== 'mes',
    filterEquipe !== 'todas',
    filterTipoServico !== 'todos',
    !!searchNumeroObra.trim(),
  ].filter(Boolean).length

  if (loading) {
    return (
      <ProtectedRoute>
        <div className="min-h-screen flex items-center justify-center">
          <div className="text-center space-y-3">
            <div className="spinner mx-auto" />
            <p className="text-sm font-medium text-gray-500">Carregando dashboard...</p>
          </div>
        </div>
      </ProtectedRoute>
    )
  }

  return (
    <ProtectedRoute>
      <AppShell>
        {/* Page Header */}
        <div className="mb-8 flex flex-col sm:flex-row sm:items-end justify-between gap-4">
          <div>
            <h1 className="page-title">Dashboard</h1>
            <p className="page-subtitle">Visão geral de desempenho e estatísticas por equipe</p>
          </div>
          <div className="flex items-center gap-2 px-3 py-1.5 bg-white border border-slate-200 rounded-xl text-xs font-medium text-slate-500 shadow-sm shrink-0">
            <svg className="w-3.5 h-3.5 text-slate-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
            </svg>
            {format(new Date(), "dd 'de' MMMM 'de' yyyy", { locale: ptBR })}
          </div>
        </div>

        {/* Filtros */}
        <div className="card-padded mb-8">
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-2.5">
              <div className="w-7 h-7 bg-slate-100 rounded-lg flex items-center justify-center">
                <svg className="w-3.5 h-3.5 text-slate-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 4a1 1 0 011-1h16a1 1 0 011 1v2.586a1 1 0 01-.293.707l-6.414 6.414a1 1 0 00-.293.707V17l-4 4v-6.586a1 1 0 00-.293-.707L3.293 7.293A1 1 0 013 6.586V4z" />
                </svg>
              </div>
              <span className="text-sm font-bold text-slate-800">Filtros</span>
              {activeFilters > 0 && (
                <span className="px-2 py-0.5 bg-blue-600 text-white text-xs font-bold rounded-full">
                  {activeFilters}
                </span>
              )}
            </div>
            {activeFilters > 0 && (
              <button
                onClick={() => {
                  setFilterPeriodo('mes')
                  setFilterEquipe('todas')
                  setFilterTipoServico('todos')
                  setSearchNumeroObra('')
                }}
                className="text-xs text-red-600 hover:text-red-700 font-semibold transition-colors flex items-center gap-1"
              >
                <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
                Limpar filtros
              </button>
            )}
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-3">
            <div>
              <label className="block text-xs font-semibold text-gray-400 uppercase tracking-wider mb-1.5">Nº da Obra</label>
              <div className="relative">
                <svg className="w-4 h-4 text-gray-400 absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                </svg>
                <input
                  type="text"
                  placeholder="Buscar número..."
                  value={searchNumeroObra}
                  onChange={(e) => setSearchNumeroObra(e.target.value)}
                  className="input-field pl-9 pr-8"
                />
                {searchNumeroObra && (
                  <button onClick={() => setSearchNumeroObra('')} className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600">
                    <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                    </svg>
                  </button>
                )}
              </div>
            </div>

            <div>
              <label className="block text-xs font-semibold text-gray-400 uppercase tracking-wider mb-1.5">Período</label>
              <select className="input-field" value={filterPeriodo} onChange={(e) => setFilterPeriodo(e.target.value)}>
                <option value="todos">Todos os Períodos</option>
                <option value="hoje">Hoje</option>
                <option value="semana">Última Semana</option>
                <option value="mes">Este Mês</option>
              </select>
            </div>

            <div>
              <label className="block text-xs font-semibold text-gray-400 uppercase tracking-wider mb-1.5">Equipe</label>
              <select className="input-field" value={filterEquipe} onChange={(e) => setFilterEquipe(e.target.value)}>
                <option value="todas">Todas as Equipes</option>
                {equipes.map(e => <option key={e} value={e}>{e}</option>)}
              </select>
            </div>

            <div>
              <label className="block text-xs font-semibold text-gray-400 uppercase tracking-wider mb-1.5">Tipo de Serviço</label>
              <select className="input-field" value={filterTipoServico} onChange={(e) => setFilterTipoServico(e.target.value)}>
                <option value="todos">Todos os Serviços</option>
                {tiposServico.map(t => <option key={t} value={t}>{t}</option>)}
              </select>
            </div>
          </div>
        </div>

        {/* Stats Cards */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
          {/* Total Obras */}
          <div className="stat-card">
            <div className="w-11 h-11 bg-gradient-to-br from-blue-500 to-blue-600 rounded-xl flex items-center justify-center shadow-sm shadow-blue-500/30 mb-4">
              <svg className="w-5 h-5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4" />
              </svg>
            </div>
            <p className="text-3xl font-bold text-slate-900 tracking-tight">{stats.totalObras}</p>
            <p className="text-sm font-semibold text-slate-700 mt-0.5">Total de Obras</p>
            <p className="text-xs text-slate-400 mt-1">{stats.equipesUnicas} equipe{stats.equipesUnicas !== 1 ? 's' : ''} ativa{stats.equipesUnicas !== 1 ? 's' : ''}</p>
          </div>

          {/* Concluídas */}
          <div className="stat-card">
            <div className="w-11 h-11 bg-gradient-to-br from-emerald-500 to-emerald-600 rounded-xl flex items-center justify-center shadow-sm shadow-emerald-500/30 mb-4">
              <svg className="w-5 h-5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
            </div>
            <p className="text-3xl font-bold text-slate-900 tracking-tight">{stats.concluidas}</p>
            <p className="text-sm font-semibold text-slate-700 mt-0.5">Concluídas</p>
            <p className="text-xs text-slate-400 mt-1">{stats.percentualConcluidas}% do total</p>
          </div>

          {/* Total Fotos */}
          <div className="stat-card">
            <div className="w-11 h-11 bg-gradient-to-br from-violet-500 to-violet-600 rounded-xl flex items-center justify-center shadow-sm shadow-violet-500/30 mb-4">
              <svg className="w-5 h-5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
              </svg>
            </div>
            <p className="text-3xl font-bold text-slate-900 tracking-tight">{stats.totalFotos}</p>
            <p className="text-sm font-semibold text-slate-700 mt-0.5">Total de Fotos</p>
            <p className="text-xs text-slate-400 mt-1">~{stats.mediaFotosPorObra} por obra</p>
          </div>

          {/* Atipicidades */}
          <div className="stat-card">
            <div className="w-11 h-11 bg-gradient-to-br from-amber-500 to-orange-500 rounded-xl flex items-center justify-center shadow-sm shadow-amber-500/30 mb-4">
              <svg className="w-5 h-5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
              </svg>
            </div>
            <p className="text-3xl font-bold text-slate-900 tracking-tight">{stats.comAtipicidades}</p>
            <p className="text-sm font-semibold text-slate-700 mt-0.5">Atipicidades</p>
            <p className="text-xs text-slate-400 mt-1">{stats.percentualAtipicidades}% do total</p>
          </div>
        </div>

        {/* Charts */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-5 mb-8">
          {/* Top 5 Equipes */}
          <div className="card-padded">
            <div className="flex items-center gap-3 mb-5">
              <div className="w-9 h-9 bg-gradient-to-br from-blue-500 to-blue-600 rounded-xl flex items-center justify-center shadow-sm shadow-blue-500/30">
                <svg className="w-4 h-4 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
                </svg>
              </div>
              <div>
                <h3 className="text-sm font-bold text-slate-800">Top 5 Equipes</h3>
                <p className="text-xs text-slate-400">por número de obras</p>
              </div>
            </div>
            <div className="space-y-4">
              {topEquipes.length === 0 ? (
                <p className="text-slate-400 text-sm text-center py-4">Nenhuma obra no período</p>
              ) : (
                topEquipes.map(([equipe, count], index) => {
                  const maxCount = topEquipes[0][1]
                  const percentage = (count / maxCount) * 100
                  const medals = ['🥇','🥈','🥉']
                  return (
                    <div key={equipe}>
                      <div className="flex items-center justify-between mb-2">
                        <span className="text-sm font-medium text-slate-700 flex items-center gap-2">
                          <span className="w-5 text-center">{medals[index] || <span className="text-xs font-bold text-slate-400">{index + 1}</span>}</span>
                          {equipe}
                        </span>
                        <span className="text-xs font-bold text-slate-600">{count} obras</span>
                      </div>
                      <div className="w-full bg-slate-100 rounded-full h-2">
                        <div
                          className="bg-gradient-to-r from-blue-500 to-blue-400 h-2 rounded-full transition-all duration-700"
                          style={{ width: `${percentage}%` }}
                        />
                      </div>
                    </div>
                  )
                })
              )}
            </div>
          </div>

          {/* Distribuição por Serviço */}
          <div className="card-padded">
            <div className="flex items-center gap-3 mb-5">
              <div className="w-9 h-9 bg-gradient-to-br from-violet-500 to-violet-600 rounded-xl flex items-center justify-center shadow-sm shadow-violet-500/30">
                <svg className="w-4 h-4 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 3.055A9.001 9.001 0 1020.945 13H11V3.055z" />
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M20.488 9H15V3.512A9.025 9.025 0 0120.488 9z" />
                </svg>
              </div>
              <div>
                <h3 className="text-sm font-bold text-slate-800">Por Tipo de Serviço</h3>
                <p className="text-xs text-slate-400">distribuição percentual</p>
              </div>
            </div>
            <div className="space-y-4">
              {distribuicaoServicos.length === 0 ? (
                <p className="text-slate-400 text-sm text-center py-4">Nenhuma obra no período</p>
              ) : (
                distribuicaoServicos.slice(0, 6).map(([servico, count]) => {
                  const total = filteredObras.length
                  const percentage = (count / total) * 100
                  return (
                    <div key={servico}>
                      <div className="flex items-center justify-between mb-2">
                        <span className="text-sm font-medium text-slate-700 truncate mr-4">{servico}</span>
                        <span className="text-xs font-bold text-slate-600 shrink-0">{count} ({percentage.toFixed(0)}%)</span>
                      </div>
                      <div className="w-full bg-slate-100 rounded-full h-2">
                        <div
                          className="bg-gradient-to-r from-violet-500 to-violet-400 h-2 rounded-full transition-all duration-700"
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

        {/* Tabela de Equipes */}
        <div className="table-wrapper">
          <div className="table-header">
            <div className="flex items-center gap-3">
              <div className="w-8 h-8 bg-gradient-to-br from-slate-700 to-slate-800 rounded-xl flex items-center justify-center shadow-sm">
                <svg className="w-4 h-4 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0z" />
                </svg>
              </div>
              <div>
                <h3 className="text-sm font-bold text-slate-800">Estatísticas por Equipe</h3>
                <p className="text-xs text-slate-400 mt-0.5">{equipesStats.length} equipe{equipesStats.length !== 1 ? 's' : ''} cadastrada{equipesStats.length !== 1 ? 's' : ''}</p>
              </div>
            </div>
          </div>
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-gray-50">
              <thead className="bg-gray-50/50">
                <tr>
                  <th className="th">Equipe</th>
                  <th className="th-center">Total</th>
                  <th className="th-center">Hoje</th>
                  <th className="th-center">Semana</th>
                  <th className="th-center">Mês</th>
                  <th className="th-center">Fotos</th>
                  <th className="th-center">Atipic.</th>
                  <th className="th-center">Serviços</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-50">
                {equipesStats.map((s, i) => (
                  <tr key={s.equipe} className="hover:bg-slate-50/60 transition-colors">
                    <td className="td">
                      <div className="flex items-center gap-3">
                        <div
                          className="flex-shrink-0 h-9 w-9 rounded-lg flex items-center justify-center text-white text-xs font-bold"
                          style={{ background: `hsl(${(i * 47) % 360}, 60%, 50%)` }}
                        >
                          {s.equipe.substring(0, 2).toUpperCase()}
                        </div>
                        <span className="font-medium text-slate-800">{s.equipe}</span>
                      </div>
                    </td>
                    <td className="td-center font-bold text-slate-900">{s.totalObras}</td>
                    <td className="td-center">
                      {s.obrasHoje > 0
                        ? <span className="badge-blue">{s.obrasHoje}</span>
                        : <span className="text-gray-300">—</span>}
                    </td>
                    <td className="td-center text-gray-500">{s.obrasSemana}</td>
                    <td className="td-center text-gray-500">{s.obrasMes}</td>
                    <td className="td-center">
                      <span className="text-emerald-600 font-medium">{s.totalFotos}</span>
                    </td>
                    <td className="td-center">
                      {s.comAtipicidades > 0
                        ? <span className="badge-amber">{s.comAtipicidades}</span>
                        : <span className="text-gray-300">—</span>}
                    </td>
                    <td className="td-center text-gray-500">{s.tiposServico.length}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {equipesStats.length === 0 && (
            <div className="text-center py-16">
              <div className="w-14 h-14 bg-gray-100 rounded-2xl flex items-center justify-center mx-auto mb-3">
                <svg className="w-7 h-7 text-gray-300" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0z" />
                </svg>
              </div>
              <p className="text-sm font-medium text-gray-400">Nenhuma obra cadastrada</p>
            </div>
          )}
        </div>
      </AppShell>
    </ProtectedRoute>
  )
}
