'use client'

import { useEffect, useState } from 'react'
import { useParams, useRouter } from 'next/navigation'
import { supabase, type Obra, type FotoInfo } from '@/lib/supabase'
import ProtectedRoute from '@/components/ProtectedRoute'
import Sidebar from '@/components/Sidebar'
import PhotoGallery from '@/components/PhotoGallery'
import { generatePDF } from '@/lib/pdf-generator'
import { format } from 'date-fns'
import { ptBR } from 'date-fns/locale'
import * as XLSX from 'xlsx'

// Mapeamento de tipos de serviço para galerias de fotos permitidas
const GALERIAS_POR_TIPO_SERVICO: Record<string, string[]> = {
  'Emenda': ['fotos_antes', 'fotos_durante', 'fotos_depois'],
  'Transformador': ['fotos_antes', 'fotos_durante', 'fotos_depois', 'fotos_abertura', 'fotos_fechamento'],
  'DITAIS': ['fotos_ditais_abertura', 'fotos_ditais_impedir', 'fotos_ditais_testar', 'fotos_ditais_aterrar', 'fotos_ditais_sinalizar'],
  'Ditais': ['fotos_ditais_abertura', 'fotos_ditais_impedir', 'fotos_ditais_testar', 'fotos_ditais_aterrar', 'fotos_ditais_sinalizar'],
  'Book de Aterramento': ['fotos_aterramento_vala_aberta', 'fotos_aterramento_hastes', 'fotos_aterramento_vala_fechada', 'fotos_aterramento_medicao'],
  'Abertura e Fechamento de Chave': ['fotos_abertura', 'fotos_fechamento'],
}

// Função para verificar se uma galeria deve ser exibida
function deveExibirGaleria(nomeGaleria: string, tipoServico: string): boolean {
  const galeriasPermitidas = GALERIAS_POR_TIPO_SERVICO[tipoServico]
  if (!galeriasPermitidas) {
    // Se o tipo de serviço não está no mapeamento, mostra apenas as básicas
    return ['fotos_antes', 'fotos_durante', 'fotos_depois'].includes(nomeGaleria)
  }
  return galeriasPermitidas.includes(nomeGaleria)
}

// Lista de atipicidades padrão Energisa
const ATIPICIDADES_ENERGISA = [
  { id: 1, descricao: 'Acesso difícil' },
  { id: 2, descricao: 'Aterramento inadequado' },
  { id: 3, descricao: 'Cabo com isolação danificada' },
  { id: 4, descricao: 'Conexão com aquecimento' },
  { id: 5, descricao: 'Estrutura danificada' },
  { id: 6, descricao: 'Falta de sinalização' },
  { id: 7, descricao: 'Medidor sem selo' },
  { id: 8, descricao: 'Padrão fora de norma' },
  { id: 9, descricao: 'Proteção inadequada' },
  { id: 10, descricao: 'Transformador com vazamento' },
]

export default function ObraDetailPage() {
  const params = useParams()
  const router = useRouter()
  const [obra, setObra] = useState<Obra | null>(null)
  const [loading, setLoading] = useState(true)
  const [exportingPdf, setExportingPdf] = useState(false)
  const [exportingXlsx, setExportingXlsx] = useState(false)
  const [selectedAtipicidades, setSelectedAtipicidades] = useState<number[]>([])
  const [descricaoAtipicidade, setDescricaoAtipicidade] = useState('')

  useEffect(() => {
    if (params.id) {
      loadObra(params.id as string)
    }
  }, [params.id])

  async function loadObra(id: string) {
    try {
      const { data, error } = await supabase
        .from('obras')
        .select('*')
        .eq('id', id)
        .single()

      if (error) throw error
      setObra(data)

      // Carregar atipicidades existentes
      if (data.atipicidades && data.atipicidades.length > 0) {
        setSelectedAtipicidades(data.atipicidades)
      }
      if (data.descricao_atipicidade) {
        setDescricaoAtipicidade(data.descricao_atipicidade)
      }
    } catch (error) {
      console.error('Erro ao carregar obra:', error)
      alert('Erro ao carregar obra')
    } finally {
      setLoading(false)
    }
  }

  function handleGoBack() {
    router.back()
  }

  function formatDateTime(date: Date) {
    const pad = (value: number) => String(value).padStart(2, '0')
    return `${pad(date.getDate())}/${pad(date.getMonth() + 1)}/${date.getFullYear()} ${pad(date.getHours())}:${pad(date.getMinutes())}`
  }

  // Handlers de atipicidades
  async function toggleAtipicidade(id: number) {
    if (!obra) return

    const newSelected = selectedAtipicidades.includes(id)
      ? selectedAtipicidades.filter(atipId => atipId !== id)
      : [...selectedAtipicidades, id]

    setSelectedAtipicidades(newSelected)
    await saveAtipicidades(newSelected, descricaoAtipicidade)
  }

  async function handleDescricaoChange(value: string) {
    setDescricaoAtipicidade(value)
    await saveAtipicidades(selectedAtipicidades, value)
  }

  async function saveAtipicidades(atipicidades: number[], descricao: string) {
    if (!obra) return

    try {
      const { error } = await supabase
        .from('obras')
        .update({
          atipicidades: atipicidades,
          descricao_atipicidade: descricao,
          tem_atipicidade: atipicidades.length > 0 || descricao.trim() !== ''
        })
        .eq('id', obra.id)

      if (error) throw error

      setObra({
        ...obra,
        atipicidades: atipicidades,
        descricao_atipicidade: descricao,
        tem_atipicidade: atipicidades.length > 0 || descricao.trim() !== ''
      })
    } catch (error) {
      console.error('Erro ao salvar atipicidades:', error)
    }
  }

  async function uploadPhotoFile(file: File, sectionKey: string) {
    if (!obra) throw new Error('Obra nao carregada')
    const safeName = file.name.replace(/[^a-zA-Z0-9._-]/g, '_')
    const filePath = `${obra.id}/${sectionKey}-${Date.now()}-${safeName}`
    const { error: uploadError } = await supabase.storage
      .from('obra-photos')
      .upload(filePath, file, { contentType: file.type, upsert: false })
    if (uploadError) throw uploadError
    const { data } = supabase.storage.from('obra-photos').getPublicUrl(filePath)
    return data.publicUrl
  }

  async function handleAddPhoto(sectionKey: string, file: File): Promise<FotoInfo | null> {
    if (!obra) return null
    try {
      const url = await uploadPhotoFile(file, sectionKey)
      const newPhoto: FotoInfo = {
        url,
        placaData: {
          obraNumero: obra.obra || '',
          tipoServico: obra.tipo_servico || '',
          equipe: obra.equipe || '',
          dataHora: formatDateTime(new Date()),
        },
      }
      const currentPhotos = (obra as any)[sectionKey] as FotoInfo[] | undefined || []
      const nextPhotos = [...currentPhotos, newPhoto]
      const { error } = await supabase
        .from('obras')
        .update({ [sectionKey]: nextPhotos })
        .eq('id', obra.id)
      if (error) throw error
      setObra({ ...obra, [sectionKey]: nextPhotos })
      return newPhoto
    } catch (error) {
      console.error('Erro ao adicionar foto:', error)
      alert('Erro ao adicionar foto')
      return null
    }
  }

  async function handleUpdatePhoto(
    sectionKey: string,
    index: number,
    updatedPhoto: FotoInfo
  ): Promise<FotoInfo | null> {
    if (!obra) return null
    try {
      const currentPhotos = (obra as any)[sectionKey] as FotoInfo[] | undefined || []
      if (!currentPhotos[index]) return null
      const nextPhotos = [...currentPhotos]
      nextPhotos[index] = updatedPhoto
      const { error } = await supabase
        .from('obras')
        .update({ [sectionKey]: nextPhotos })
        .eq('id', obra.id)
      if (error) throw error
      setObra({ ...obra, [sectionKey]: nextPhotos })
      return updatedPhoto
    } catch (error) {
      console.error('Erro ao atualizar foto:', error)
      alert('Erro ao salvar placa')
      return null
    }
  }

  async function handleReplacePhoto(
    sectionKey: string,
    index: number,
    file: File
  ): Promise<FotoInfo | null> {
    if (!obra) return null
    try {
      const url = await uploadPhotoFile(file, sectionKey)
      const currentPhotos = (obra as any)[sectionKey] as FotoInfo[] | undefined || []
      if (!currentPhotos[index]) return null
      const nextPhoto: FotoInfo = {
        ...currentPhotos[index],
        url,
      }
      const nextPhotos = [...currentPhotos]
      nextPhotos[index] = nextPhoto
      const { error } = await supabase
        .from('obras')
        .update({ [sectionKey]: nextPhotos })
        .eq('id', obra.id)
      if (error) throw error
      setObra({ ...obra, [sectionKey]: nextPhotos })
      return nextPhoto
    } catch (error) {
      console.error('Erro ao substituir foto:', error)
      alert('Erro ao substituir foto')
      return null
    }
  }

  // Funções de exportação
  async function handleExportPdf() {
    if (!obra) return
    setExportingPdf(true)
    try {
      await generatePDF(obra)
    } catch (error) {
      console.error('Erro ao gerar PDF:', error)
      alert('Erro ao gerar PDF')
    } finally {
      setExportingPdf(false)
    }
  }

  async function handleExportXlsx() {
    if (!obra) return
    setExportingXlsx(true)
    try {
      const sections = [
        { key: 'fotos_antes', label: 'Fotos Antes' },
        { key: 'fotos_durante', label: 'Fotos Durante' },
        { key: 'fotos_depois', label: 'Fotos Depois' },
        { key: 'fotos_abertura', label: 'Fotos Abertura de Chave' },
        { key: 'fotos_fechamento', label: 'Fotos Fechamento de Chave' },
        { key: 'fotos_ditais_abertura', label: 'DITAIS - Desligar/Abertura' },
        { key: 'fotos_ditais_impedir', label: 'DITAIS - Impedir Religamento' },
        { key: 'fotos_ditais_testar', label: 'DITAIS - Testar Ausencia de Tensao' },
        { key: 'fotos_ditais_aterrar', label: 'DITAIS - Aterrar' },
        { key: 'fotos_ditais_sinalizar', label: 'DITAIS - Sinalizar/Isolar' },
        { key: 'fotos_aterramento_vala_aberta', label: 'Aterramento - Vala Aberta' },
        { key: 'fotos_aterramento_hastes', label: 'Aterramento - Hastes Aplicadas' },
        { key: 'fotos_aterramento_vala_fechada', label: 'Aterramento - Vala Fechada' },
        { key: 'fotos_aterramento_medicao', label: 'Aterramento - Medicao Terrometro' },
        { key: 'fotos_transformador_laudo', label: 'Transformador - Laudo' },
        { key: 'fotos_transformador_componente_instalado', label: 'Transformador - Componente Instalado' },
        { key: 'fotos_transformador_tombamento_instalado', label: 'Transformador - Tombamento (Instalado)' },
        { key: 'fotos_transformador_tape', label: 'Transformador - Tape' },
        { key: 'fotos_transformador_placa_instalado', label: 'Transformador - Placa (Instalado)' },
        { key: 'fotos_transformador_instalado', label: 'Transformador - Instalado' },
        { key: 'fotos_transformador_antes_retirar', label: 'Transformador - Antes de Retirar' },
        { key: 'fotos_transformador_tombamento_retirado', label: 'Transformador - Tombamento (Retirado)' },
        { key: 'fotos_transformador_placa_retirado', label: 'Transformador - Placa (Retirado)' },
      ]

      const photoRows = [] as Array<Record<string, string | number>>
      let totalPhotos = 0

      sections.forEach(({ key, label }) => {
        const sectionPhotos = (obra as any)[key] as FotoInfo[] | undefined || []
        totalPhotos += sectionPhotos.length
        sectionPhotos.forEach((photo) => {
          photoRows.push({
            Secao: label,
            Url: photo.url,
            DataHora: photo.placaData?.dataHora || '',
            Obra: photo.placaData?.obraNumero || obra.obra || '',
            Equipe: photo.placaData?.equipe || obra.equipe || '',
            TipoServico: photo.placaData?.tipoServico || obra.tipo_servico || '',
          })
        })
      })

      const resumo = [
        {
          'N Obra': obra.obra || '-',
          'Placa': obra.placa || '-',
          'Equipe': obra.equipe || '-',
          'Tipo de Servico': obra.tipo_servico || '-',
          'Responsavel': obra.responsavel || '-',
          'Data': format(new Date(obra.data), 'dd/MM/yyyy', { locale: ptBR }),
          'Total de Fotos': totalPhotos,
          'Endereco': obra.endereco || '-',
          'UTM Norte': obra.utm_norte || '-',
          'UTM Leste': obra.utm_leste || '-',
          'Observacoes': obra.observacoes || '-',
        },
      ]

      const workbook = XLSX.utils.book_new()
      const resumoSheet = XLSX.utils.json_to_sheet(resumo)
      XLSX.utils.book_append_sheet(workbook, resumoSheet, 'Resumo')
      if (photoRows.length) {
        const fotosSheet = XLSX.utils.json_to_sheet(photoRows)
        XLSX.utils.book_append_sheet(workbook, fotosSheet, 'Fotos')
      }

      const buffer = XLSX.write(workbook, { bookType: 'xlsx', type: 'array' })
      const blob = new Blob([buffer], {
        type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      })
      const url = URL.createObjectURL(blob)
      const link = document.createElement('a')
      link.href = url
      link.download = `obra_${obra.obra || 'sem_numero'}_${format(new Date(), 'yyyyMMdd_HHmm')}.xlsx`
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
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto mb-4"></div>
            <p className="text-xl text-gray-600">Carregando obra...</p>
          </div>
        </div>
      </ProtectedRoute>
    )
  }

  if (!obra) {
    return (
      <ProtectedRoute>
        <div className="min-h-screen flex items-center justify-center">
          <div className="text-center">
            <p className="text-xl text-gray-600">Obra não encontrada</p>
            <button
              onClick={handleGoBack}
              className="mt-4 px-6 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
            >
              Voltar
            </button>
          </div>
        </div>
      </ProtectedRoute>
    )
  }

  const galleryProps = {
    obraNumero: obra.obra,
    tipoServico: obra.tipo_servico,
    equipe: obra.equipe,
    allowAdd: true,
    onAddPhoto: handleAddPhoto,
    onUpdatePhoto: handleUpdatePhoto,
    onReplacePhoto: handleReplacePhoto,
  }

  return (
    <ProtectedRoute>
      <div className="min-h-screen bg-gray-50 flex">
        <Sidebar />

        <div className="flex-1 px-4 sm:px-6 lg:px-8 py-8">
          {/* Header */}
          <div className="mb-6 space-y-4">
            <button
              onClick={handleGoBack}
              className="flex items-center gap-2 text-gray-600 hover:text-gray-900"
            >
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 19l-7-7m0 0l7-7m-7 7h18" />
              </svg>
              Voltar
            </button>

            <div className="flex flex-wrap items-start justify-between gap-4">
              <div>
                <h1 className="text-3xl font-bold text-gray-900">{obra.obra}</h1>
                <div className="flex items-center gap-2 mt-2">
                  <span className="px-3 py-1 bg-red-600 text-white text-sm font-semibold rounded-full">
                    {obra.equipe}
                  </span>
                  <span className="text-gray-600">
                    {format(new Date(obra.data), "dd 'de' MMMM 'de' yyyy", { locale: ptBR })}
                  </span>
                </div>
              </div>
              <div className="flex flex-wrap items-center gap-3">
                <button
                  onClick={handleExportPdf}
                  disabled={exportingPdf}
                  className="px-4 py-2.5 bg-white border border-gray-200 hover:border-blue-500 text-sm font-semibold text-gray-700 rounded-lg shadow-sm transition-colors disabled:opacity-60 disabled:cursor-not-allowed"
                >
                  {exportingPdf ? "Gerando PDF..." : "Exportar PDF"}
                </button>
                <button
                  onClick={handleExportXlsx}
                  disabled={exportingXlsx}
                  className="px-4 py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white text-sm font-semibold rounded-lg shadow-sm transition-colors disabled:opacity-60 disabled:cursor-not-allowed"
                >
                  {exportingXlsx ? "Gerando XLSX..." : "Exportar XLSX"}
                </button>
              </div>
            </div>
            <p className="text-sm text-gray-500">Clique em uma foto para visualizar, trocar ou editar a placa.</p>
          </div>


          {/* Info Cards */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-8">
            <div className="bg-white p-4 rounded-lg shadow-md border border-gray-100">
              <div className="text-sm text-gray-600 mb-1">Responsável</div>
              <div className="text-lg font-semibold text-gray-900">{obra.responsavel}</div>
            </div>

            <div className="bg-white p-4 rounded-lg shadow-md border border-gray-100">
              <div className="text-sm text-gray-600 mb-1">Tipo de Serviço</div>
              <div className="text-lg font-semibold text-gray-900">{obra.tipo_servico}</div>
            </div>
          </div>

          {/* Atipicidades */}
          <div className="bg-white rounded-xl shadow-md border border-gray-100 p-6 mb-8">
            <h2 className="text-2xl font-bold text-gray-900 mb-6 flex items-center gap-2">
              <svg className="w-7 h-7 text-orange-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
              </svg>
              Atipicidades da Obra
            </h2>

            {/* Atipicidades Padrão Energisa */}
            <div className="mb-6">
              <h3 className="text-lg font-semibold text-gray-900 mb-4">Atipicidades Padrão Energisa</h3>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                {ATIPICIDADES_ENERGISA.map((atipicidade) => (
                  <label
                    key={atipicidade.id}
                    className={`flex items-center gap-3 p-3 border-2 rounded-lg cursor-pointer transition-all ${
                      selectedAtipicidades.includes(atipicidade.id)
                        ? 'border-orange-500 bg-orange-50'
                        : 'border-gray-200 hover:border-orange-300 hover:bg-gray-50'
                    }`}
                  >
                    <input
                      type="checkbox"
                      checked={selectedAtipicidades.includes(atipicidade.id)}
                      onChange={() => toggleAtipicidade(atipicidade.id)}
                      className="w-5 h-5 text-orange-600 rounded border-gray-300 focus:ring-orange-500"
                    />
                    <span className="text-sm font-medium text-gray-700">
                      {atipicidade.descricao}
                    </span>
                  </label>
                ))}
              </div>
            </div>

            {/* Descrição Adicional */}
            <div>
              <label className="block text-sm font-semibold text-gray-900 mb-2">
                Descrição Adicional
              </label>
              <textarea
                value={descricaoAtipicidade}
                onChange={(e) => handleDescricaoChange(e.target.value)}
                placeholder="Descreva outras atipicidades não listadas acima..."
                rows={4}
                className="w-full px-4 py-3 border-2 border-gray-200 rounded-lg focus:border-orange-500 focus:ring-2 focus:ring-orange-200 outline-none transition-all resize-none text-sm"
              />
              <p className="mt-1 text-xs text-gray-500">
                Campo opcional para informações adicionais. As alterações são salvas automaticamente.
              </p>
            </div>
          </div>

          {/* Fotos */}
          <div className="bg-white rounded-xl shadow-md border border-gray-100 p-6">
            <h2 className="text-2xl font-bold text-gray-900 mb-6">Registro Fotográfico</h2>

            {deveExibirGaleria('fotos_antes', obra.tipo_servico) && (
              <PhotoGallery photos={obra.fotos_antes || []} title="Fotos Antes" sectionKey="fotos_antes" {...galleryProps} />
            )}
            {deveExibirGaleria('fotos_durante', obra.tipo_servico) && (
              <PhotoGallery photos={obra.fotos_durante || []} title="Fotos Durante" sectionKey="fotos_durante" {...galleryProps} />
            )}
            {deveExibirGaleria('fotos_depois', obra.tipo_servico) && (
              <PhotoGallery photos={obra.fotos_depois || []} title="Fotos Depois" sectionKey="fotos_depois" {...galleryProps} />
            )}
            {deveExibirGaleria('fotos_abertura', obra.tipo_servico) && (
              <PhotoGallery photos={obra.fotos_abertura || []} title="Fotos Abertura de Chave" sectionKey="fotos_abertura" {...galleryProps} />
            )}
            {deveExibirGaleria('fotos_fechamento', obra.tipo_servico) && (
              <PhotoGallery photos={obra.fotos_fechamento || []} title="Fotos Fechamento de Chave" sectionKey="fotos_fechamento" {...galleryProps} />
            )}

            {/* DITAIS */}
            {(obra.fotos_ditais_abertura?.length || obra.fotos_ditais_impedir?.length || obra.fotos_ditais_testar?.length || obra.fotos_ditais_aterrar?.length || obra.fotos_ditais_sinalizar?.length) ? (
              <div className="mt-8 pt-8 border-t border-gray-200">
                <h3 className="text-xl font-bold text-gray-900 mb-4">Método DITAIS</h3>
                <PhotoGallery photos={obra.fotos_ditais_abertura || []} title="1. Desligar/Abertura" sectionKey="fotos_ditais_abertura" {...galleryProps} />
                <PhotoGallery photos={obra.fotos_ditais_impedir || []} title="2. Impedir Religamento" sectionKey="fotos_ditais_impedir" {...galleryProps} />
                <PhotoGallery photos={obra.fotos_ditais_testar || []} title="3. Testar Ausencia de Tensao" sectionKey="fotos_ditais_testar" {...galleryProps} />
                <PhotoGallery photos={obra.fotos_ditais_aterrar || []} title="4. Aterrar" sectionKey="fotos_ditais_aterrar" {...galleryProps} />
                <PhotoGallery photos={obra.fotos_ditais_sinalizar || []} title="5. Sinalizar/Isolar" sectionKey="fotos_ditais_sinalizar" {...galleryProps} />
              </div>
            ) : null}

            {/* Book de Aterramento */}
            {(obra.fotos_aterramento_vala_aberta?.length || obra.fotos_aterramento_hastes?.length || obra.fotos_aterramento_vala_fechada?.length || obra.fotos_aterramento_medicao?.length) ? (
              <div className="mt-8 pt-8 border-t border-gray-200">
                <h3 className="text-xl font-bold text-gray-900 mb-4">Book de Aterramento</h3>
                <PhotoGallery photos={obra.fotos_aterramento_vala_aberta || []} title="Vala Aberta" sectionKey="fotos_aterramento_vala_aberta" {...galleryProps} />
                <PhotoGallery photos={obra.fotos_aterramento_hastes || []} title="Hastes Aplicadas" sectionKey="fotos_aterramento_hastes" {...galleryProps} />
                <PhotoGallery photos={obra.fotos_aterramento_vala_fechada || []} title="Vala Fechada" sectionKey="fotos_aterramento_vala_fechada" {...galleryProps} />
                <PhotoGallery photos={obra.fotos_aterramento_medicao || []} title="Medicao com Terrometro" sectionKey="fotos_aterramento_medicao" {...galleryProps} />
              </div>
            ) : null}

            {/* Transformador */}
            {(obra.fotos_transformador_laudo?.length || obra.fotos_transformador_componente_instalado?.length || obra.fotos_transformador_tombamento_instalado?.length || obra.fotos_transformador_tape?.length || obra.fotos_transformador_placa_instalado?.length || obra.fotos_transformador_instalado?.length || obra.fotos_transformador_antes_retirar?.length || obra.fotos_transformador_tombamento_retirado?.length || obra.fotos_transformador_placa_retirado?.length) ? (
              <div className="mt-8 pt-8 border-t border-gray-200">
                <h3 className="text-xl font-bold text-gray-900 mb-4">
                  Transformador
                  {obra.transformador_status && (
                    <span className="ml-3 text-base text-blue-600">({obra.transformador_status})</span>
                  )}
                </h3>
                <PhotoGallery photos={obra.fotos_transformador_laudo || []} title="Laudo" sectionKey="fotos_transformador_laudo" {...galleryProps} />
                <PhotoGallery photos={obra.fotos_transformador_componente_instalado || []} title="Componente Instalado" sectionKey="fotos_transformador_componente_instalado" {...galleryProps} />
                <PhotoGallery photos={obra.fotos_transformador_tombamento_instalado || []} title="Tombamento (Instalado)" sectionKey="fotos_transformador_tombamento_instalado" {...galleryProps} />
                <PhotoGallery photos={obra.fotos_transformador_tape || []} title="Tape" sectionKey="fotos_transformador_tape" {...galleryProps} />
                <PhotoGallery photos={obra.fotos_transformador_placa_instalado || []} title="Placa (Instalado)" sectionKey="fotos_transformador_placa_instalado" {...galleryProps} />
                <PhotoGallery photos={obra.fotos_transformador_instalado || []} title="Instalado" sectionKey="fotos_transformador_instalado" {...galleryProps} />
                <PhotoGallery photos={obra.fotos_transformador_antes_retirar || []} title="Antes de Retirar" sectionKey="fotos_transformador_antes_retirar" {...galleryProps} />
                <PhotoGallery photos={obra.fotos_transformador_tombamento_retirado || []} title="Tombamento (Retirado)" sectionKey="fotos_transformador_tombamento_retirado" {...galleryProps} />
                <PhotoGallery photos={obra.fotos_transformador_placa_retirado || []} title="Placa (Retirado)" sectionKey="fotos_transformador_placa_retirado" {...galleryProps} />
              </div>
            ) : null}

            {/* Outras seções podem ser adicionadas aqui */}
          </div>
        </div>
      </div>
    </ProtectedRoute>
  )
}
