'use client'

import { useEffect, useState, useMemo, useRef } from 'react'
import { supabase, type Obra, getObraStatus } from '@/lib/supabase'
import ProtectedRoute from '@/components/ProtectedRoute'
import Sidebar from '@/components/Sidebar'
import { generatePDF } from '@/lib/pdf-generator'
import { format } from 'date-fns'
import { ptBR } from 'date-fns/locale'
import { useRouter } from 'next/navigation'
import * as XLSX from 'xlsx'

export default function ReportsPage() {
  const router = useRouter()
  const [obras, setObras] = useState<Obra[]>([])
  const [loading, setLoading] = useState(true)
  const [selectedPeriod, setSelectedPeriod] = useState('todos')
  const [selectedTeam, setSelectedTeam] = useState('todas')
  const [selectedService, setSelectedService] = useState('todos')
  const [searchNumeroObra, setSearchNumeroObra] = useState('')
  const [selectedObras, setSelectedObras] = useState<Set<string>>(new Set())
  const [openMenuId, setOpenMenuId] = useState<string | null>(null)
  const [exportingId, setExportingId] = useState<string | null>(null)
  const [exportingXlsx, setExportingXlsx] = useState(false)
  const [selectedObraForBook, setSelectedObraForBook] = useState<Obra | null>(null)
  const menuRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    loadObras()
  }, [])

  // Fechar menu ao clicar fora
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (menuRef.current && !menuRef.current.contains(event.target as Node)) {
        setOpenMenuId(null)
      }
    }
    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
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
      // Filtro por busca de número da obra
      if (searchNumeroObra.trim()) {
        const searchTerm = searchNumeroObra.toLowerCase().trim()
        const matchNumero = obra.obra?.toLowerCase().includes(searchTerm)
        const matchPlaca = obra.placa?.toLowerCase().includes(searchTerm)
        if (!matchNumero && !matchPlaca) return false
      }

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
          if (obraDate.getMonth() !== now.getMonth() || obraDate.getFullYear() !== now.getFullYear()) {
            return false
          }
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
  }, [obras, selectedPeriod, selectedTeam, selectedService, searchNumeroObra])

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
      if (obra.fotos_abertura?.length) count += obra.fotos_abertura.length
      if (obra.fotos_fechamento?.length) count += obra.fotos_fechamento.length
      return acc + count
    }, 0)

    return {
      totalObras,
      obrasComAtipicidade,
      totalFotos,
      mediaFotos: totalObras > 0 ? Math.round(totalFotos / totalObras) : 0,
      obrasSelecionadas: selectedObras.size
    }
  }, [filteredObras, selectedObras])

  function toggleSelectAll() {
    if (selectedObras.size === filteredObras.length) {
      setSelectedObras(new Set())
    } else {
      setSelectedObras(new Set(filteredObras.map(o => o.id)))
    }
  }

  function toggleSelectObra(id: string) {
    const newSelected = new Set(selectedObras)
    if (newSelected.has(id)) {
      newSelected.delete(id)
    } else {
      newSelected.add(id)
    }
    setSelectedObras(newSelected)
  }

  function getTotalPhotosCount(obra: Obra): number {
    let count = 0
    if (obra.fotos_antes?.length) count += obra.fotos_antes.length
    if (obra.fotos_durante?.length) count += obra.fotos_durante.length
    if (obra.fotos_depois?.length) count += obra.fotos_depois.length
    if (obra.fotos_abertura?.length) count += obra.fotos_abertura.length
    if (obra.fotos_fechamento?.length) count += obra.fotos_fechamento.length
    return count
  }

  function handleOpenBook(obraId: string) {
    const obra = obras.find(o => o.id === obraId)
    if (obra) {
      setSelectedObraForBook(obra)
    }
  }

  function handleCloseBook() {
    setSelectedObraForBook(null)
  }

  function handleCreatePlaque(obra: Obra) {
    setOpenMenuId(null)
    // Criar placa da obra - será implementado
    alert(`Criar placa para obra: ${obra.obra || obra.placa}`)
  }

  async function handleExportSinglePDF(obra: Obra) {
    setOpenMenuId(null)
    setExportingId(obra.id)
    try {
      await generatePDF(obra)
    } catch (error) {
      console.error('Erro ao gerar PDF:', error)
      alert('Erro ao gerar PDF')
    } finally {
      setExportingId(null)
    }
  }

  async function exportToExcel() {
    if (selectedObras.size === 0) {
      alert('Selecione pelo menos uma obra para exportar')
      return
    }

    setExportingXlsx(true)
    try {
      const obrasToExport = filteredObras.filter(o => selectedObras.has(o.id))

      const exportData = obrasToExport.map(obra => ({
        'N Obra': obra.obra || '-' ,
        'Placa': obra.placa || '-' ,
        'Equipe': obra.equipe,
        'Tipo de Servico': obra.tipo_servico,
        'Total de Fotos': getTotalPhotosCount(obra),
        'Data': format(new Date(obra.created_at), 'dd/MM/yyyy HH:mm', { locale: ptBR }),
        'Endereco': obra.endereco || '-' ,
        'UTM Norte': obra.utm_norte || '-' ,
        'UTM Leste': obra.utm_leste || '-' ,
        'Observacoes': obra.observacoes || '-' ,
      }))

      const workbook = XLSX.utils.book_new()
      const worksheet = XLSX.utils.json_to_sheet(exportData)
      XLSX.utils.book_append_sheet(workbook, worksheet, 'Obras')

      const buffer = XLSX.write(workbook, { bookType: 'xlsx', type: 'array' })
      const blob = new Blob([buffer], {
        type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      })
      const url = URL.createObjectURL(blob)
      const link = document.createElement('a')
      link.href = url
      link.download = `relatorio_obras_${format(new Date(), 'yyyyMMdd_HHmm')}.xlsx`
      link.click()
      URL.revokeObjectURL(url)
    } catch (error) {
      console.error('Erro ao exportar XLSX:', error)
      alert('Erro ao exportar XLSX')
    } finally {
      setExportingXlsx(false)
    }
  }

  if (loading) {
    return (
      <ProtectedRoute>
        <div className="min-h-screen flex items-center justify-center">
          <div className="text-center">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary mx-auto mb-4"></div>
            <p className="text-xl text-gray-600">Carregando relatórios...</p>
          </div>
        </div>
      </ProtectedRoute>
    )
  }

  return (
    <ProtectedRoute>
      <div className="min-h-screen bg-gradient-to-br from-slate-50 to-slate-100 flex">
        <Sidebar />

        <div className="flex-1 px-6 lg:px-10 py-8">
          {/* Header */}
          <div className="mb-8">
            <h1 className="text-4xl font-bold text-slate-900 mb-2">Relatórios</h1>
            <p className="text-lg text-slate-600">
              Visualize e exporte relatórios detalhados das obras
            </p>
          </div>

          {/* Filtros */}
          <div className="mb-8 bg-white p-6 rounded-2xl shadow-lg border border-slate-200">
            <div className="flex items-center gap-2 mb-4">
              <svg className="w-5 h-5 text-slate-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 4a1 1 0 011-1h16a1 1 0 011 1v2.586a1 1 0 01-.293.707l-6.414 6.414a1 1 0 00-.293.707V17l-4 4v-6.586a1 1 0 00-.293-.707L3.293 7.293A1 1 0 013 6.586V4z" />
              </svg>
              <h3 className="text-base font-semibold text-slate-800">Filtros</h3>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-4 gap-4">
              {/* Buscar Nº Obra */}
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-2">Buscar Nº Obra</label>
                <div className="relative">
                  <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                    <svg className="h-5 w-5 text-slate-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                    </svg>
                  </div>
                  <input
                    type="text"
                    placeholder="Digite o número..."
                    value={searchNumeroObra}
                    onChange={(e) => setSearchNumeroObra(e.target.value)}
                    className="w-full pl-10 pr-10 py-2.5 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  />
                  {searchNumeroObra && (
                    <button
                      onClick={() => setSearchNumeroObra('')}
                      className="absolute inset-y-0 right-0 pr-3 flex items-center text-slate-400 hover:text-slate-600"
                    >
                      <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                      </svg>
                    </button>
                  )}
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-slate-700 mb-2">Período</label>
                <select
                  className="w-full px-4 py-2.5 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
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
                <label className="block text-sm font-medium text-slate-700 mb-2">Equipe</label>
                <select
                  className="w-full px-4 py-2.5 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
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
                <label className="block text-sm font-medium text-slate-700 mb-2">Tipo de Serviço</label>
                <select
                  className="w-full px-4 py-2.5 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
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

          {/* Cards de Estatísticas */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
            <div className="bg-gradient-to-br from-blue-500 to-blue-600 p-6 rounded-2xl shadow-lg text-white relative overflow-hidden">
              <div className="absolute top-0 right-0 w-20 h-20 bg-white/10 rounded-full -mr-10 -mt-10"></div>
              <div className="relative">
                <div className="flex items-center justify-between mb-2">
                  <h3 className="text-sm font-semibold uppercase tracking-wide">Obras Filtradas</h3>
                  <svg className="w-8 h-8 text-blue-200" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4" />
                  </svg>
                </div>
                <p className="text-5xl font-bold">{stats.totalObras}</p>
              </div>
            </div>

            <div className="bg-gradient-to-br from-orange-500 to-orange-600 p-6 rounded-2xl shadow-lg text-white relative overflow-hidden">
              <div className="absolute top-0 right-0 w-20 h-20 bg-white/10 rounded-full -mr-10 -mt-10"></div>
              <div className="relative">
                <div className="flex items-center justify-between mb-2">
                  <h3 className="text-sm font-semibold uppercase tracking-wide">Com Atipicidades</h3>
                  <svg className="w-8 h-8 text-orange-200" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                  </svg>
                </div>
                <p className="text-5xl font-bold">{stats.obrasComAtipicidade}</p>
              </div>
            </div>

            <div className="bg-gradient-to-br from-green-500 to-green-600 p-6 rounded-2xl shadow-lg text-white relative overflow-hidden">
              <div className="absolute top-0 right-0 w-20 h-20 bg-white/10 rounded-full -mr-10 -mt-10"></div>
              <div className="relative">
                <div className="flex items-center justify-between mb-2">
                  <h3 className="text-sm font-semibold uppercase tracking-wide">Total de Fotos</h3>
                  <svg className="w-8 h-8 text-green-200" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
                  </svg>
                </div>
                <p className="text-5xl font-bold">{stats.totalFotos}</p>
                <p className="text-sm text-green-100 mt-1">{stats.mediaFotos} fotos por obra</p>
              </div>
            </div>

            <div className="bg-gradient-to-br from-purple-500 to-purple-600 p-6 rounded-2xl shadow-lg text-white relative overflow-hidden">
              <div className="absolute top-0 right-0 w-20 h-20 bg-white/10 rounded-full -mr-10 -mt-10"></div>
              <div className="relative">
                <div className="flex items-center justify-between mb-2">
                  <h3 className="text-sm font-semibold uppercase tracking-wide">Selecionadas</h3>
                  <svg className="w-8 h-8 text-purple-200" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                  </svg>
                </div>
                <p className="text-5xl font-bold">{stats.obrasSelecionadas}</p>
              </div>
            </div>
          </div>

          {/* Botão Exportar */}
          <div className="flex justify-end mb-6">
            <button
              onClick={exportToExcel}
              disabled={selectedObras.size === 0 || exportingXlsx}
              className="px-6 py-3.5 bg-gradient-to-r from-green-600 to-green-700 hover:from-green-700 hover:to-green-800 text-white rounded-2xl shadow-lg hover:shadow-xl transition-all flex items-center gap-3 font-bold text-lg disabled:opacity-50 disabled:cursor-not-allowed"
            >
              <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 10v6m0 0l-3-3m3 3l3-3m2 8H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
              </svg>
              {exportingXlsx ? 'Exportando...' : 'Exportar Tudo (XLSX)'}
            </button>
          </div>

          {/* Tabela */}
          <div className="bg-white rounded-2xl shadow-lg border border-slate-200 overflow-hidden">
            <div className="overflow-x-auto">
              <table className="min-w-full">
                <thead className="bg-slate-50 border-b-2 border-slate-200">
                  <tr>
                    <th className="px-6 py-4 text-center w-12">
                      <input
                        type="checkbox"
                        checked={selectedObras.size === filteredObras.length && filteredObras.length > 0}
                        onChange={toggleSelectAll}
                        className="w-5 h-5 text-blue-600 rounded focus:ring-2 focus:ring-blue-500"
                      />
                    </th>
                    <th className="px-6 py-4 text-left text-xs font-bold text-slate-700 uppercase tracking-wider">
                      Nº OBRA
                    </th>
                    <th className="px-6 py-4 text-left text-xs font-bold text-slate-700 uppercase tracking-wider">
                      EQUIPE
                    </th>
                    <th className="px-6 py-4 text-left text-xs font-bold text-slate-700 uppercase tracking-wider">
                      TIPO DE SERVIÇO
                    </th>
                    <th className="px-6 py-4 text-center text-xs font-bold text-slate-700 uppercase tracking-wider">
                      STATUS
                    </th>
                    <th className="px-6 py-4 text-center text-xs font-bold text-slate-700 uppercase tracking-wider">
                      FOTOS
                    </th>
                    <th className="px-6 py-4 text-left text-xs font-bold text-slate-700 uppercase tracking-wider">
                      DATA
                    </th>
                    <th className="px-6 py-4 text-center text-xs font-bold text-slate-700 uppercase tracking-wider">
                      AÇÕES
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-200">
                  {filteredObras.map((obra) => (
                    <tr
                      key={obra.id}
                      onDoubleClick={() => handleOpenBook(obra.id)}
                      className={`hover:bg-slate-50 transition-colors cursor-pointer ${
                        selectedObras.has(obra.id) ? 'bg-blue-50' : ''
                      }`}
                    >
                      <td className="px-6 py-4 text-center" onClick={(e) => e.stopPropagation()}>
                        <input
                          type="checkbox"
                          checked={selectedObras.has(obra.id)}
                          onChange={() => toggleSelectObra(obra.id)}
                          className="w-5 h-5 text-blue-600 rounded focus:ring-2 focus:ring-blue-500"
                        />
                      </td>
                      <td className="px-6 py-4">
                        <span className="text-sm font-bold text-slate-900">
                          {obra.obra || '-'}
                        </span>
                      </td>
                      <td className="px-6 py-4">
                        <span className="text-sm text-slate-900">{obra.equipe}</span>
                      </td>
                      <td className="px-6 py-4">
                        <span className="inline-flex items-center px-3 py-1 bg-blue-100 text-blue-700 rounded-full text-xs font-semibold">
                          {obra.tipo_servico}
                        </span>
                      </td>
                      <td className="px-6 py-4 text-center">
                        {getObraStatus(obra) === 'concluida' ? (
                          <span className="inline-flex items-center gap-1 px-3 py-1 bg-green-100 text-green-700 rounded-full text-xs font-bold">
                            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                            </svg>
                            Concluída
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1 px-3 py-1 bg-yellow-100 text-yellow-700 rounded-full text-xs font-bold">
                            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                            </svg>
                            Parcial
                          </span>
                        )}
                      </td>
                      <td className="px-6 py-4 text-center">
                        <span className="inline-flex items-center gap-1 px-3 py-1 bg-slate-100 text-slate-700 rounded-full text-sm font-semibold">
                          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
                          </svg>
                          {getTotalPhotosCount(obra)}
                        </span>
                      </td>
                      <td className="px-6 py-4">
                        <span className="text-sm text-slate-600">
                          {format(new Date(obra.created_at), "dd/MM/yyyy", { locale: ptBR })}
                        </span>
                        <br />
                        <span className="text-xs text-slate-500">
                          {format(new Date(obra.created_at), "HH:mm", { locale: ptBR })}
                        </span>
                      </td>
                      <td className="px-6 py-4 text-center relative" onClick={(e) => e.stopPropagation()}>
                        <button
                          onClick={() => setOpenMenuId(openMenuId === obra.id ? null : obra.id)}
                          className="p-2 text-slate-600 hover:bg-slate-100 rounded-lg transition-colors"
                          title="Opções"
                        >
                          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 5v.01M12 12v.01M12 19v.01M12 6a1 1 0 110-2 1 1 0 010 2zm0 7a1 1 0 110-2 1 1 0 010 2zm0 7a1 1 0 110-2 1 1 0 010 2z" />
                          </svg>
                        </button>

                        {openMenuId === obra.id && (
                          <div
                            ref={menuRef}
                            className="absolute right-0 mt-2 w-56 bg-white rounded-lg shadow-xl border border-slate-200 z-50"
                          >
                            <div className="py-1">
                              <button
                                onClick={() => {
                                  setOpenMenuId(null)
                                  handleOpenBook(obra.id)
                                }}
                                className="w-full px-4 py-2 text-left text-sm text-slate-700 hover:bg-blue-50 hover:text-blue-700 flex items-center gap-3"
                              >
                                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                                </svg>
                                Abrir/Editar Obra
                              </button>
                              <button
                                onClick={() => handleCreatePlaque(obra)}
                                className="w-full px-4 py-2 text-left text-sm text-slate-700 hover:bg-purple-50 hover:text-purple-700 flex items-center gap-3"
                              >
                                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 7h.01M7 3h5c.512 0 1.024.195 1.414.586l7 7a2 2 0 010 2.828l-7 7a2 2 0 01-2.828 0l-7-7A1.994 1.994 0 013 12V7a4 4 0 014-4z" />
                                </svg>
                                Criar Placa da Obra
                              </button>
                              <button
                                onClick={() => handleExportSinglePDF(obra)}
                                disabled={exportingId === obra.id}
                                className={`w-full px-4 py-2 text-left text-sm text-slate-700 hover:bg-red-50 hover:text-red-700 flex items-center gap-3 ${exportingId === obra.id ? 'opacity-60 cursor-not-allowed' : ''}`}
                              >
                                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 21h10a2 2 0 002-2V9.414a1 1 0 00-.293-.707l-5.414-5.414A1 1 0 0012.586 3H7a2 2 0 00-2 2v14a2 2 0 002 2z" />
                                </svg>
                                {exportingId === obra.id ? 'Gerando PDF...' : 'Exportar PDF'}
                              </button>
                            </div>
                          </div>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {filteredObras.length === 0 && (
              <div className="text-center py-16">
                <svg
                  className="w-20 h-20 text-slate-300 mx-auto mb-4"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"
                  />
                </svg>
                <p className="text-xl text-slate-500 font-medium">Nenhuma obra encontrada</p>
                <p className="text-sm text-slate-400 mt-2">Ajuste os filtros para ver mais resultados</p>
              </div>
            )}
          </div>
        </div>

        {/* Modal/Drawer do Book */}
        {selectedObraForBook && (
          <div className="fixed inset-0 z-50 overflow-hidden animate-fadeIn">
            {/* Overlay com blur */}
            <div
              className="absolute inset-0 bg-black/60 backdrop-blur-sm transition-all duration-300"
              onClick={handleCloseBook}
            ></div>

            {/* Drawer - Animação slide-in */}
            <div className="absolute right-0 top-0 h-full w-full md:w-[85%] lg:w-[75%] bg-gradient-to-b from-slate-50 to-white shadow-2xl overflow-y-auto animate-slideInRight">
              {/* Header Moderno */}
              <div className="sticky top-0 z-10 bg-gradient-to-r from-primary via-primary-dark to-primary text-white shadow-xl">
                <div className="px-8 py-6">
                  <div className="flex items-start justify-between">
                    <div className="flex-1">
                      <div className="flex items-center gap-3 mb-2">
                        <div className="bg-white/20 backdrop-blur-sm rounded-lg px-3 py-1">
                          <span className="text-xs font-semibold uppercase tracking-wider">Book da Obra</span>
                        </div>
                      </div>
                      <h2 className="text-3xl font-bold tracking-tight mb-2">
                        {selectedObraForBook.obra || 'Sem número'}
                      </h2>
                      <div className="flex flex-wrap items-center gap-3 text-sm">
                        <span className="flex items-center gap-1.5 bg-white/10 backdrop-blur-sm px-3 py-1 rounded-full">
                          <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 20 20">
                            <path d="M13 6a3 3 0 11-6 0 3 3 0 016 0zM18 8a2 2 0 11-4 0 2 2 0 014 0zM14 15a4 4 0 00-8 0v3h8v-3zM6 8a2 2 0 11-4 0 2 2 0 014 0zM16 18v-3a5.972 5.972 0 00-.75-2.906A3.005 3.005 0 0119 15v3h-3zM4.75 12.094A5.973 5.973 0 004 15v3H1v-3a3 3 0 013.75-2.906z" />
                          </svg>
                          {selectedObraForBook.equipe}
                        </span>
                        <span className="flex items-center gap-1.5 bg-white/10 backdrop-blur-sm px-3 py-1 rounded-full">
                          <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 20 20">
                            <path fillRule="evenodd" d="M6 2a1 1 0 00-1 1v1H4a2 2 0 00-2 2v10a2 2 0 002 2h12a2 2 0 002-2V6a2 2 0 00-2-2h-1V3a1 1 0 10-2 0v1H7V3a1 1 0 00-1-1zm0 5a1 1 0 000 2h8a1 1 0 100-2H6z" />
                          </svg>
                          {selectedObraForBook.tipo_servico}
                        </span>
                      </div>
                    </div>
                    <button
                      onClick={handleCloseBook}
                      className="p-3 hover:bg-white/20 rounded-xl transition-all duration-200 hover:rotate-90"
                      title="Fechar"
                    >
                      <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M6 18L18 6M6 6l12 12" />
                      </svg>
                    </button>
                  </div>
                </div>
              </div>

              {/* Conteúdo do Book */}
              <div className="px-8 py-8">
                {/* Card de Informações - Design Moderno */}
                <div className="bg-white rounded-2xl shadow-lg border border-slate-200 overflow-hidden mb-8">
                  <div className="bg-gradient-to-r from-slate-50 to-slate-100 px-6 py-4 border-b border-slate-200">
                    <h3 className="text-xl font-bold text-slate-900 flex items-center gap-2">
                      <svg className="w-5 h-5 text-primary" fill="currentColor" viewBox="0 0 20 20">
                        <path d="M9 2a1 1 0 000 2h2a1 1 0 100-2H9z" />
                        <path fillRule="evenodd" d="M4 5a2 2 0 012-2 3 3 0 003 3h2a3 3 0 003-3 2 2 0 012 2v11a2 2 0 01-2 2H6a2 2 0 01-2-2V5zm3 4a1 1 0 000 2h.01a1 1 0 100-2H7zm3 0a1 1 0 000 2h3a1 1 0 100-2h-3zm-3 4a1 1 0 100 2h.01a1 1 0 100-2H7zm3 0a1 1 0 100 2h3a1 1 0 100-2h-3z" />
                      </svg>
                      Informações da Obra
                    </h3>
                  </div>
                  <div className="p-6">
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                      <div className="space-y-1">
                        <p className="text-xs font-semibold text-slate-500 uppercase tracking-wider">Nº da Obra</p>
                        <p className="text-2xl font-bold text-slate-900">{selectedObraForBook.obra || '-'}</p>
                      </div>
                      <div className="space-y-1">
                        <p className="text-xs font-semibold text-slate-500 uppercase tracking-wider">Placa</p>
                        <p className="text-lg font-semibold text-slate-700">{selectedObraForBook.placa || '-'}</p>
                      </div>
                      <div className="space-y-1">
                        <p className="text-xs font-semibold text-slate-500 uppercase tracking-wider">Equipe</p>
                        <p className="text-lg font-semibold text-slate-700">{selectedObraForBook.equipe}</p>
                      </div>
                      <div className="space-y-1">
                        <p className="text-xs font-semibold text-slate-500 uppercase tracking-wider">Tipo de Serviço</p>
                        <p className="text-lg font-semibold text-primary">{selectedObraForBook.tipo_servico}</p>
                      </div>
                      <div className="space-y-1">
                        <p className="text-xs font-semibold text-slate-500 uppercase tracking-wider">Data</p>
                        <p className="text-lg font-semibold text-slate-700">
                          {format(new Date(selectedObraForBook.created_at), "dd/MM/yyyy 'às' HH:mm", { locale: ptBR })}
                        </p>
                      </div>
                      <div className="space-y-1">
                        <p className="text-xs font-semibold text-slate-500 uppercase tracking-wider">Responsável</p>
                        <p className="text-lg font-semibold text-slate-700">{selectedObraForBook.responsavel}</p>
                      </div>
                    </div>
                  </div>
                </div>

                {/* Galerias de Fotos - Design Premium */}
                <div className="space-y-8">
                  {selectedObraForBook.fotos_antes && selectedObraForBook.fotos_antes.length > 0 && (
                    <div>
                      <div className="flex items-center gap-3 mb-4">
                        <div className="bg-gradient-to-r from-blue-500 to-blue-600 text-white px-4 py-2 rounded-lg shadow-md">
                          <h4 className="font-bold text-sm uppercase tracking-wider">Fotos Antes</h4>
                        </div>
                        <div className="flex-1 h-px bg-gradient-to-r from-blue-300 to-transparent"></div>
                        <span className="text-sm font-semibold text-slate-500">{selectedObraForBook.fotos_antes.length} foto(s)</span>
                      </div>
                      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
                        {selectedObraForBook.fotos_antes.map((foto, idx) => (
                          <div key={idx} className="relative group overflow-hidden rounded-xl shadow-md hover:shadow-2xl transition-all duration-300 transform hover:-translate-y-1">
                            <div className="aspect-square bg-slate-100">
                              <img
                                src={foto.url}
                                alt={`Foto Antes ${idx + 1}`}
                                className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-110"
                              />
                            </div>
                            <div className="absolute inset-0 bg-gradient-to-t from-black/70 via-black/20 to-transparent opacity-0 group-hover:opacity-100 transition-all duration-300 flex items-end justify-center pb-4">
                              <button className="bg-white text-slate-900 px-4 py-2 rounded-lg text-sm font-bold shadow-lg transform translate-y-4 group-hover:translate-y-0 transition-transform duration-300 flex items-center gap-2">
                                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
                                </svg>
                                Visualizar
                              </button>
                            </div>
                            <div className="absolute top-2 left-2 bg-blue-600 text-white text-xs font-bold px-2 py-1 rounded-md shadow-lg">
                              #{idx + 1}
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  {selectedObraForBook.fotos_durante && selectedObraForBook.fotos_durante.length > 0 && (
                    <div>
                      <div className="flex items-center gap-3 mb-4">
                        <div className="bg-gradient-to-r from-orange-500 to-orange-600 text-white px-4 py-2 rounded-lg shadow-md">
                          <h4 className="font-bold text-sm uppercase tracking-wider">Fotos Durante</h4>
                        </div>
                        <div className="flex-1 h-px bg-gradient-to-r from-orange-300 to-transparent"></div>
                        <span className="text-sm font-semibold text-slate-500">{selectedObraForBook.fotos_durante.length} foto(s)</span>
                      </div>
                      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
                        {selectedObraForBook.fotos_durante.map((foto, idx) => (
                          <div key={idx} className="relative group overflow-hidden rounded-xl shadow-md hover:shadow-2xl transition-all duration-300 transform hover:-translate-y-1">
                            <div className="aspect-square bg-slate-100">
                              <img
                                src={foto.url}
                                alt={`Foto Durante ${idx + 1}`}
                                className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-110"
                              />
                            </div>
                            <div className="absolute inset-0 bg-gradient-to-t from-black/70 via-black/20 to-transparent opacity-0 group-hover:opacity-100 transition-all duration-300 flex items-end justify-center pb-4">
                              <button className="bg-white text-slate-900 px-4 py-2 rounded-lg text-sm font-bold shadow-lg transform translate-y-4 group-hover:translate-y-0 transition-transform duration-300 flex items-center gap-2">
                                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
                                </svg>
                                Visualizar
                              </button>
                            </div>
                            <div className="absolute top-2 left-2 bg-orange-600 text-white text-xs font-bold px-2 py-1 rounded-md shadow-lg">
                              #{idx + 1}
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  {selectedObraForBook.fotos_depois && selectedObraForBook.fotos_depois.length > 0 && (
                    <div>
                      <div className="flex items-center gap-3 mb-4">
                        <div className="bg-gradient-to-r from-green-500 to-green-600 text-white px-4 py-2 rounded-lg shadow-md">
                          <h4 className="font-bold text-sm uppercase tracking-wider">Fotos Depois</h4>
                        </div>
                        <div className="flex-1 h-px bg-gradient-to-r from-green-300 to-transparent"></div>
                        <span className="text-sm font-semibold text-slate-500">{selectedObraForBook.fotos_depois.length} foto(s)</span>
                      </div>
                      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
                        {selectedObraForBook.fotos_depois.map((foto, idx) => (
                          <div key={idx} className="relative group overflow-hidden rounded-xl shadow-md hover:shadow-2xl transition-all duration-300 transform hover:-translate-y-1">
                            <div className="aspect-square bg-slate-100">
                              <img
                                src={foto.url}
                                alt={`Foto Depois ${idx + 1}`}
                                className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-110"
                              />
                            </div>
                            <div className="absolute inset-0 bg-gradient-to-t from-black/70 via-black/20 to-transparent opacity-0 group-hover:opacity-100 transition-all duration-300 flex items-end justify-center pb-4">
                              <button className="bg-white text-slate-900 px-4 py-2 rounded-lg text-sm font-bold shadow-lg transform translate-y-4 group-hover:translate-y-0 transition-transform duration-300 flex items-center gap-2">
                                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
                                </svg>
                                Visualizar
                              </button>
                            </div>
                            <div className="absolute top-2 left-2 bg-green-600 text-white text-xs font-bold px-2 py-1 rounded-md shadow-lg">
                              #{idx + 1}
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </div>

                {/* Botão para página completa - Design Premium */}
                <div className="mt-12 pt-8 border-t-2 border-slate-200">
                  <div className="flex flex-col items-center gap-4">
                    <p className="text-sm text-slate-600 text-center">
                      Para editar fotos, adicionar novas ou visualizar todas as seções da obra
                    </p>
                    <button
                      onClick={() => {
                        handleCloseBook()
                        router.push(`/obra/${selectedObraForBook.id}`)
                      }}
                      className="group relative px-8 py-4 bg-gradient-to-r from-primary to-primary-dark hover:from-primary-dark hover:to-primary text-white rounded-xl font-bold text-lg shadow-xl hover:shadow-2xl transition-all duration-300 transform hover:-translate-y-1 flex items-center gap-3"
                    >
                      <svg className="w-6 h-6 group-hover:rotate-12 transition-transform duration-300" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                      </svg>
                      Ver Página Completa e Editar
                      <svg className="w-5 h-5 group-hover:translate-x-1 transition-transform duration-300" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                      </svg>
                    </button>
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}
      </div>
    </ProtectedRoute>
  )
}
