'use client'

import { useEffect, useState, useMemo } from 'react'
import { supabase, type Obra } from '@/lib/supabase'
import { format, startOfMonth, endOfMonth } from 'date-fns'
import { ptBR } from 'date-fns/locale'
import Image from 'next/image'
import { generatePDF } from '@/lib/pdf-generator'
import ProtectedRoute from '@/components/ProtectedRoute'
import Sidebar from '@/components/Sidebar'

export default function DashboardPage() {
  const [obras, setObras] = useState<Obra[]>([])
  const [loading, setLoading] = useState(true)
  const [selectedObra, setSelectedObra] = useState<Obra | null>(null)
  const [filter, setFilter] = useState('')
  const [filterTipoServico, setFilterTipoServico] = useState('todos')
  const [filterEquipe, setFilterEquipe] = useState('todas')
  const [filterPeriodo, setFilterPeriodo] = useState('todos')
  const [sortBy, setSortBy] = useState<'data' | 'obra' | 'fotos'>('data')
  const [generatingAllPDFs, setGeneratingAllPDFs] = useState(false)

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

  // Filtros e ordenação avançados
  const filteredAndSortedObras = useMemo(() => {
    let filtered = obras.filter(obra => {
      // Filtro de busca
      const matchesSearch = obra.obra.toLowerCase().includes(filter.toLowerCase()) ||
        obra.responsavel.toLowerCase().includes(filter.toLowerCase()) ||
        obra.equipe.toLowerCase().includes(filter.toLowerCase())

      if (!matchesSearch) return false

      // Filtro por tipo de serviço
      if (filterTipoServico !== 'todos' && obra.tipo_servico !== filterTipoServico) {
        return false
      }

      // Filtro por equipe
      if (filterEquipe !== 'todas' && obra.equipe !== filterEquipe) {
        return false
      }

      // Filtro por período
      if (filterPeriodo !== 'todos') {
        const obraDate = new Date(obra.created_at)
        const now = new Date()

        if (filterPeriodo === 'hoje') {
          const today = new Date(now.getFullYear(), now.getMonth(), now.getDate())
          const obraDay = new Date(obraDate.getFullYear(), obraDate.getMonth(), obraDate.getDate())
          if (obraDay.getTime() !== today.getTime()) return false
        } else if (filterPeriodo === 'semana') {
          const weekAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000)
          if (obraDate < weekAgo) return false
        } else if (filterPeriodo === 'mes') {
          const monthStart = startOfMonth(now)
          const monthEnd = endOfMonth(now)
          if (obraDate < monthStart || obraDate > monthEnd) return false
        }
      }

      return true
    })

    // Ordenação
    filtered.sort((a, b) => {
      if (sortBy === 'data') {
        return new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
      } else if (sortBy === 'obra') {
        return a.obra.localeCompare(b.obra)
      } else if (sortBy === 'fotos') {
        return getAllPhotos(b).length - getAllPhotos(a).length
      }
      return 0
    })

    return filtered
  }, [obras, filter, filterTipoServico, filterEquipe, filterPeriodo, sortBy])

  // Obter listas únicas para os filtros
  const tiposServico = useMemo(() => {
    const tipos = Array.from(new Set(obras.map(o => o.tipo_servico)))
    return tipos.sort()
  }, [obras])

  const equipes = useMemo(() => {
    const teams = Array.from(new Set(obras.map(o => o.equipe)))
    return teams.sort()
  }, [obras])

  const getAllPhotos = (obra: Obra) => {
    const photos: { url: string; type: string }[] = []

    // Fotos padrão (Emenda, Bandolamento, Aterramento, Linha Viva)
    if (obra.fotos_antes?.length) {
      obra.fotos_antes.forEach(f => photos.push({ url: f.url, type: 'Antes' }))
    }
    if (obra.fotos_durante?.length) {
      obra.fotos_durante.forEach(f => photos.push({ url: f.url, type: 'Durante' }))
    }
    if (obra.fotos_depois?.length) {
      obra.fotos_depois.forEach(f => photos.push({ url: f.url, type: 'Depois' }))
    }

    // Abertura e Fechamento de Chave
    if (obra.fotos_abertura?.length) {
      obra.fotos_abertura.forEach(f => photos.push({ url: f.url, type: 'Abertura Chave' }))
    }
    if (obra.fotos_fechamento?.length) {
      obra.fotos_fechamento.forEach(f => photos.push({ url: f.url, type: 'Fechamento Chave' }))
    }

    // DITAIS (5 fotos - método DITAIS)
    if (obra.fotos_ditais_abertura?.length) {
      obra.fotos_ditais_abertura.forEach(f => photos.push({ url: f.url, type: 'DITAIS - Abertura' }))
    }
    if (obra.fotos_ditais_impedir?.length) {
      obra.fotos_ditais_impedir.forEach(f => photos.push({ url: f.url, type: 'DITAIS - Impedir' }))
    }
    if (obra.fotos_ditais_testar?.length) {
      obra.fotos_ditais_testar.forEach(f => photos.push({ url: f.url, type: 'DITAIS - Testar' }))
    }
    if (obra.fotos_ditais_aterrar?.length) {
      obra.fotos_ditais_aterrar.forEach(f => photos.push({ url: f.url, type: 'DITAIS - Aterrar' }))
    }
    if (obra.fotos_ditais_sinalizar?.length) {
      obra.fotos_ditais_sinalizar.forEach(f => photos.push({ url: f.url, type: 'DITAIS - Sinalizar' }))
    }

    // BOOK ATERRAMENTO (4 fotos)
    if (obra.fotos_aterramento_vala_aberta?.length) {
      obra.fotos_aterramento_vala_aberta.forEach(f => photos.push({ url: f.url, type: 'Vala Aberta' }))
    }
    if (obra.fotos_aterramento_hastes?.length) {
      obra.fotos_aterramento_hastes.forEach(f => photos.push({ url: f.url, type: 'Hastes Aplicadas' }))
    }
    if (obra.fotos_aterramento_vala_fechada?.length) {
      obra.fotos_aterramento_vala_fechada.forEach(f => photos.push({ url: f.url, type: 'Vala Fechada' }))
    }
    if (obra.fotos_aterramento_medicao?.length) {
      obra.fotos_aterramento_medicao.forEach(f => photos.push({ url: f.url, type: 'Medição Terrômetro' }))
    }

    // TRANSFORMADOR
    if (obra.fotos_transformador_laudo?.length) {
      obra.fotos_transformador_laudo.forEach(f => photos.push({ url: f.url, type: 'Transformador - Laudo' }))
    }
    if (obra.fotos_transformador_componente_instalado?.length) {
      obra.fotos_transformador_componente_instalado.forEach(f => photos.push({ url: f.url, type: 'Transformador - Componente Instalado' }))
    }
    if (obra.fotos_transformador_tombamento_instalado?.length) {
      obra.fotos_transformador_tombamento_instalado.forEach(f => photos.push({ url: f.url, type: 'Transformador - Tombamento (Instalado)' }))
    }
    if (obra.fotos_transformador_tape?.length) {
      obra.fotos_transformador_tape.forEach(f => photos.push({ url: f.url, type: 'Transformador - Tape' }))
    }
    if (obra.fotos_transformador_placa_instalado?.length) {
      obra.fotos_transformador_placa_instalado.forEach(f => photos.push({ url: f.url, type: 'Transformador - Placa (Instalado)' }))
    }
    if (obra.fotos_transformador_instalado?.length) {
      obra.fotos_transformador_instalado.forEach(f => photos.push({ url: f.url, type: 'Transformador - Instalado' }))
    }
    if (obra.fotos_transformador_antes_retirar?.length) {
      obra.fotos_transformador_antes_retirar.forEach(f => photos.push({ url: f.url, type: 'Transformador - Antes de Retirar' }))
    }
    if (obra.fotos_transformador_tombamento_retirado?.length) {
      obra.fotos_transformador_tombamento_retirado.forEach(f => photos.push({ url: f.url, type: 'Transformador - Tombamento (Retirado)' }))
    }
    if (obra.fotos_transformador_placa_retirado?.length) {
      obra.fotos_transformador_placa_retirado.forEach(f => photos.push({ url: f.url, type: 'Transformador - Placa (Retirado)' }))
    }

    return photos
  }

  async function generateAllPDFs() {
    if (!confirm(`Deseja gerar PDFs para ${filteredAndSortedObras.length} obra(s)? Isso pode levar alguns minutos.`)) {
      return
    }

    setGeneratingAllPDFs(true)
    let successCount = 0
    let errorCount = 0

    for (let i = 0; i < filteredAndSortedObras.length; i++) {
      try {
        await generatePDF(filteredAndSortedObras[i])
        successCount++
        // Pequeno delay para evitar sobrecarga
        await new Promise(resolve => setTimeout(resolve, 500))
      } catch (error) {
        console.error(`Erro ao gerar PDF da obra ${filteredAndSortedObras[i].obra}:`, error)
        errorCount++
      }
    }

    setGeneratingAllPDFs(false)
    alert(`PDFs gerados!\n\nSucesso: ${successCount}\nErros: ${errorCount}`)
  }

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <p className="text-xl text-gray-600">Carregando obras...</p>
      </div>
    )
  }

  return (
    <ProtectedRoute>
      <div className="min-h-screen bg-gray-50 flex">
        <Sidebar />

      <div className="flex-1 px-4 sm:px-6 lg:px-8 py-8">
        {/* Header */}
        <div className="mb-8">
          <div className="flex flex-col sm:flex-row sm:justify-between sm:items-center gap-4 mb-6">
            <div>
              <h1 className="text-3xl font-bold text-gray-900">Dashboard</h1>
              <p className="text-gray-600 mt-1 flex items-center gap-2">
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
                </svg>
                Visão geral de todas as obras
              </p>
            </div>
          </div>

          {/* Busca */}
          <div className="relative">
            <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none">
              <svg className="h-5 w-5 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
              </svg>
            </div>
            <input
              type="text"
              placeholder="Buscar por número da obra, responsável ou equipe..."
              className="w-full pl-12 pr-4 py-3.5 border border-gray-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent shadow-sm"
              value={filter}
              onChange={(e) => setFilter(e.target.value)}
            />
          </div>
        </div>

        {/* Filtros Avançados */}
        <div className="mb-8 bg-white p-6 rounded-xl shadow-md border border-gray-100">
          <div className="flex items-center gap-2 mb-4">
            <svg className="w-5 h-5 text-gray-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 4a1 1 0 011-1h16a1 1 0 011 1v2.586a1 1 0 01-.293.707l-6.414 6.414a1 1 0 00-.293.707V17l-4 4v-6.586a1 1 0 00-.293-.707L3.293 7.293A1 1 0 013 6.586V4z" />
            </svg>
            <h3 className="text-base font-semibold text-gray-800">Filtros Avançados</h3>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            {/* Filtro por Tipo de Serviço */}
            <div>
              <label className="block text-sm font-semibold text-gray-700 mb-2">Tipo de Serviço</label>
              <select
                className="w-full px-4 py-2.5 border border-gray-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent shadow-sm bg-white"
                value={filterTipoServico}
                onChange={(e) => setFilterTipoServico(e.target.value)}
              >
                <option value="todos">Todos os Serviços</option>
                {tiposServico.map(tipo => (
                  <option key={tipo} value={tipo}>{tipo}</option>
                ))}
              </select>
            </div>

            {/* Filtro por Equipe */}
            <div>
              <label className="block text-sm font-semibold text-gray-700 mb-2">Equipe</label>
              <select
                className="w-full px-4 py-2.5 border border-gray-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent shadow-sm bg-white"
                value={filterEquipe}
                onChange={(e) => setFilterEquipe(e.target.value)}
              >
                <option value="todas">Todas as Equipes</option>
                {equipes.map(equipe => (
                  <option key={equipe} value={equipe}>{equipe}</option>
                ))}
              </select>
            </div>

            {/* Filtro por Período */}
            <div>
              <label className="block text-sm font-semibold text-gray-700 mb-2">Período</label>
              <select
                className="w-full px-4 py-2.5 border border-gray-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent shadow-sm bg-white"
                value={filterPeriodo}
                onChange={(e) => setFilterPeriodo(e.target.value)}
              >
                <option value="todos">Todos os Períodos</option>
                <option value="hoje">Hoje</option>
                <option value="semana">Última Semana</option>
                <option value="mes">Este Mês</option>
              </select>
            </div>

            {/* Ordenação */}
            <div>
              <label className="block text-sm font-semibold text-gray-700 mb-2">Ordenar Por</label>
              <select
                className="w-full px-4 py-2.5 border border-gray-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent shadow-sm bg-white"
                value={sortBy}
                onChange={(e) => setSortBy(e.target.value as 'data' | 'obra' | 'fotos')}
              >
                <option value="data">Data (Mais Recentes)</option>
                <option value="obra">Número da Obra</option>
                <option value="fotos">Quantidade de Fotos</option>
              </select>
            </div>
          </div>

          {/* Botão Limpar Filtros */}
          {(filter || filterTipoServico !== 'todos' || filterEquipe !== 'todas' || filterPeriodo !== 'todos') && (
            <div className="mt-4 pt-4 border-t border-gray-200 flex justify-end">
              <button
                onClick={() => {
                  setFilter('')
                  setFilterTipoServico('todos')
                  setFilterEquipe('todas')
                  setFilterPeriodo('todos')
                }}
                className="px-4 py-2 text-sm font-medium text-gray-700 hover:text-gray-900 hover:bg-gray-100 rounded-xl transition-colors flex items-center gap-2"
              >
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
                Limpar Todos os Filtros
              </button>
            </div>
          )}
        </div>

        {/* Stats */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-6 mb-8">
          <div className="bg-gradient-to-br from-blue-500 to-blue-600 p-6 rounded-lg shadow-lg text-white">
            <h3 className="text-blue-100 text-sm font-medium">Total de Obras</h3>
            <p className="text-4xl font-bold mt-2">{filteredAndSortedObras.length}</p>
            {filteredAndSortedObras.length !== obras.length && (
              <p className="text-blue-100 text-xs mt-1">de {obras.length} no total</p>
            )}
          </div>
          <div className="bg-gradient-to-br from-orange-500 to-orange-600 p-6 rounded-lg shadow-lg text-white">
            <h3 className="text-orange-100 text-sm font-medium">Com Atipicidades</h3>
            <p className="text-4xl font-bold mt-2">
              {filteredAndSortedObras.filter(o => o.tem_atipicidade).length}
            </p>
            <p className="text-orange-100 text-xs mt-1">
              {filteredAndSortedObras.length > 0
                ? `${Math.round(filteredAndSortedObras.filter(o => o.tem_atipicidade).length / filteredAndSortedObras.length * 100)}% do total`
                : '0% do total'}
            </p>
          </div>
          <div className="bg-gradient-to-br from-green-500 to-green-600 p-6 rounded-lg shadow-lg text-white">
            <h3 className="text-green-100 text-sm font-medium">Total de Fotos</h3>
            <p className="text-4xl font-bold mt-2">
              {filteredAndSortedObras.reduce((acc, obra) => acc + getAllPhotos(obra).length, 0)}
            </p>
            <p className="text-green-100 text-xs mt-1">
              {filteredAndSortedObras.length > 0
                ? `${Math.round(filteredAndSortedObras.reduce((acc, obra) => acc + getAllPhotos(obra).length, 0) / filteredAndSortedObras.length)} por obra`
                : '0 por obra'}
            </p>
          </div>
          <div className="bg-gradient-to-br from-purple-500 to-purple-600 p-6 rounded-lg shadow-lg text-white">
            <h3 className="text-purple-100 text-sm font-medium">Serviços Únicos</h3>
            <p className="text-4xl font-bold mt-2">
              {new Set(filteredAndSortedObras.map(o => o.tipo_servico)).size}
            </p>
            <p className="text-purple-100 text-xs mt-1">tipos diferentes</p>
          </div>
        </div>

        {/* Contador de Resultados e Ações em Massa */}
        {filteredAndSortedObras.length > 0 && (
          <div className="mb-4 flex justify-between items-center">
            <p className="text-sm text-gray-600">
              Mostrando <span className="font-semibold">{filteredAndSortedObras.length}</span> obra{filteredAndSortedObras.length !== 1 ? 's' : ''}
              {filteredAndSortedObras.length !== obras.length && (
                <span> de <span className="font-semibold">{obras.length}</span> no total</span>
              )}
            </p>
            <button
              onClick={generateAllPDFs}
              disabled={generatingAllPDFs}
              className="px-4 py-2 bg-green-600 hover:bg-green-700 text-white rounded-lg transition-colors flex items-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {generatingAllPDFs ? (
                <>
                  <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white"></div>
                  Gerando PDFs...
                </>
              ) : (
                <>
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 10v6m0 0l-3-3m3 3l3-3m2 8H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                  </svg>
                  Baixar Todos os PDFs
                </>
              )}
            </button>
          </div>
        )}

        {/* Lista de Obras */}
        <div className="grid grid-cols-1 gap-4">
          {filteredAndSortedObras.map((obra) => (
            <div
              key={obra.id}
              className="bg-white rounded-lg shadow-md hover:shadow-lg transition-all p-6 border border-gray-100"
            >
              <div className="flex justify-between items-start">
                <div className="flex-1">
                  <div className="flex items-center gap-3 flex-wrap">
                    <h2 className="text-2xl font-bold text-gray-900">
                      Obra {obra.obra}
                    </h2>
                    <span className="px-3 py-1 bg-blue-100 text-blue-700 rounded-full text-xs font-medium">
                      {obra.tipo_servico}
                    </span>
                    <span className="px-3 py-1 bg-gray-100 text-gray-600 rounded-full text-xs">
                      📅 {format(new Date(obra.created_at), "dd/MM/yyyy", { locale: ptBR })}
                    </span>
                  </div>

                  <div className="mt-4 grid grid-cols-2 md:grid-cols-3 gap-4">
                    <div>
                      <p className="text-sm text-gray-500">👤 Responsável</p>
                      <p className="font-medium text-gray-900">{obra.responsavel}</p>
                    </div>
                    <div>
                      <p className="text-sm text-gray-500">👥 Equipe</p>
                      <p className="font-medium text-gray-900">{obra.equipe}</p>
                    </div>
                    <div>
                      <p className="text-sm text-gray-500">📸 Fotos</p>
                      <p className="font-medium text-gray-900">
                        {getAllPhotos(obra).length} foto{getAllPhotos(obra).length !== 1 ? 's' : ''}
                      </p>
                    </div>
                  </div>

                  {/* Status do Transformador */}
                  {obra.transformador_status && (
                    <div className="mt-3">
                      <span className={`px-3 py-1 rounded-full text-xs font-medium ${
                        obra.transformador_status === 'Instalado'
                          ? 'bg-green-100 text-green-700'
                          : 'bg-red-100 text-red-700'
                      }`}>
                        Transformador: {obra.transformador_status}
                      </span>
                    </div>
                  )}

                  {obra.tem_atipicidade && (
                    <div className="mt-4 p-3 bg-orange-50 border border-orange-200 rounded-lg">
                      <p className="text-sm font-medium text-orange-800">
                        ⚠️ {obra.atipicidades.length} atipicidade(s)
                      </p>
                      {obra.descricao_atipicidade && (
                        <p className="text-sm text-orange-700 mt-1">{obra.descricao_atipicidade}</p>
                      )}
                    </div>
                  )}

                  {/* Fotos Preview */}
                  {getAllPhotos(obra).length > 0 && (
                    <div className="mt-4">
                      <p className="text-sm text-gray-500 mb-2">Fotos da Obra</p>
                      <div className="grid grid-cols-4 sm:grid-cols-6 md:grid-cols-8 gap-2">
                        {getAllPhotos(obra).slice(0, 8).map((photo, idx) => (
                          <div key={idx} className="relative aspect-square">
                            <Image
                              src={photo.url}
                              alt={`${photo.type} ${idx + 1}`}
                              fill
                              className="object-cover rounded-lg"
                              sizes="(max-width: 768px) 25vw, 12.5vw"
                            />
                            <div className="absolute bottom-0 left-0 right-0 bg-black bg-opacity-50 text-white text-xs px-1 py-0.5 rounded-b-lg">
                              {photo.type}
                            </div>
                          </div>
                        ))}
                        {getAllPhotos(obra).length > 8 && (
                          <div className="aspect-square flex items-center justify-center bg-gray-100 rounded-lg">
                            <p className="text-gray-600 text-sm font-medium">
                              +{getAllPhotos(obra).length - 8}
                            </p>
                          </div>
                        )}
                      </div>
                    </div>
                  )}
                </div>

                <div className="ml-6 flex flex-col gap-2">
                  <button
                    onClick={() => setSelectedObra(obra)}
                    className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
                  >
                    Ver Detalhes
                  </button>
                  <button
                    onClick={() => generatePDF(obra)}
                    className="px-4 py-2 bg-primary text-white rounded-lg hover:bg-primary-dark transition-colors"
                  >
                    Gerar PDF
                  </button>
                </div>
              </div>
            </div>
          ))}
        </div>

        {filteredAndSortedObras.length === 0 && (
          <div className="text-center py-16">
            <div className="max-w-md mx-auto">
              <div className="text-6xl mb-4">📋</div>
              <h3 className="text-xl font-semibold text-gray-900 mb-2">
                {obras.length === 0 ? 'Nenhuma obra registrada' : 'Nenhuma obra encontrada'}
              </h3>
              <p className="text-gray-500 mb-6">
                {obras.length === 0
                  ? 'As obras registradas no aplicativo mobile aparecerão aqui.'
                  : 'Tente ajustar os filtros para encontrar outras obras.'}
              </p>
              {obras.length > 0 && (
                <button
                  onClick={() => {
                    setFilter('')
                    setFilterTipoServico('todos')
                    setFilterEquipe('todas')
                    setFilterPeriodo('todos')
                  }}
                  className="px-6 py-3 bg-primary text-white rounded-lg hover:bg-primary-dark transition-colors"
                >
                  Limpar Todos os Filtros
                </button>
              )}
            </div>
          </div>
        )}
      </div>

      {/* Modal de Detalhes */}
      {selectedObra && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-lg max-w-4xl w-full max-h-[90vh] overflow-y-auto">
            <div className="p-6 border-b sticky top-0 bg-white">
              <div className="flex justify-between items-center">
                <h2 className="text-2xl font-bold">Obra {selectedObra.obra}</h2>
                <button
                  onClick={() => setSelectedObra(null)}
                  className="text-gray-500 hover:text-gray-700 text-2xl"
                >
                  ×
                </button>
              </div>
            </div>

            <div className="p-6">
              <div className="grid grid-cols-2 gap-4 mb-6">
                <div>
                  <p className="text-sm text-gray-500">Data</p>
                  <p className="font-medium">{format(new Date(selectedObra.data), 'dd/MM/yyyy')}</p>
                </div>
                <div>
                  <p className="text-sm text-gray-500">Responsável</p>
                  <p className="font-medium">{selectedObra.responsavel}</p>
                </div>
                <div>
                  <p className="text-sm text-gray-500">Equipe</p>
                  <p className="font-medium">{selectedObra.equipe}</p>
                </div>
                <div>
                  <p className="text-sm text-gray-500">Tipo de Serviço</p>
                  <p className="font-medium">{selectedObra.tipo_servico}</p>
                </div>
              </div>

              {/* Todas as Fotos */}
              <div>
                <h3 className="text-lg font-semibold mb-4">Fotos</h3>
                {getAllPhotos(selectedObra).length === 0 ? (
                  <p className="text-gray-500">Nenhuma foto disponível</p>
                ) : (
                  <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
                    {getAllPhotos(selectedObra).map((photo, idx) => (
                      <div key={idx} className="relative aspect-square">
                        <Image
                          src={photo.url}
                          alt={`${photo.type} ${idx + 1}`}
                          fill
                          className="object-cover rounded-lg"
                          sizes="(max-width: 768px) 50vw, 33vw"
                        />
                        <div className="absolute bottom-0 left-0 right-0 bg-black bg-opacity-70 text-white text-sm px-2 py-1 rounded-b-lg">
                          {photo.type}
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      )}
      </div>
    </ProtectedRoute>
  )
}
