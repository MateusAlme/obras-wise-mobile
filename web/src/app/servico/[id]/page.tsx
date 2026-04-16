'use client'

import { useEffect, useState } from 'react'
import { useParams, useRouter } from 'next/navigation'
import { supabase, type FotoInfo } from '@/lib/supabase'
import { useAuth } from '@/contexts/AuthContext'
import ProtectedRoute from '@/components/ProtectedRoute'
import AppShell from '@/components/AppShell'
import PhotoGallery from '@/components/PhotoGallery'
import { generatePDF } from '@/lib/pdf-generator'
import { format } from 'date-fns'
import { ptBR } from 'date-fns/locale'

const GALERIAS_POR_TIPO_SERVICO: Record<string, string[]> = {
  'Emenda': ['fotos_antes', 'fotos_durante', 'fotos_depois'],
  'Bandolamento': ['fotos_antes', 'fotos_durante', 'fotos_depois'],
  'Linha Viva': ['fotos_antes', 'fotos_durante', 'fotos_depois'],
  'Poda': ['fotos_antes', 'fotos_durante', 'fotos_depois'],
  'Fundação Especial': ['fotos_antes', 'fotos_durante', 'fotos_depois'],
  'Cava em Rocha': ['fotos_antes', 'fotos_durante', 'fotos_depois'],
  'Transformador': [
    'fotos_transformador_laudo', 'fotos_transformador_componente_instalado',
    'fotos_transformador_tombamento_instalado', 'fotos_transformador_tape',
    'fotos_transformador_placa_instalado', 'fotos_transformador_instalado',
    'fotos_transformador_antes_retirar', 'fotos_transformador_tombamento_retirado',
    'fotos_transformador_placa_retirado',
  ],
  'Abertura e Fechamento de Chave': ['fotos_abertura', 'fotos_fechamento'],
  'Instalação do Medidor': [
    'fotos_medidor_padrao', 'fotos_medidor_leitura', 'fotos_medidor_selo_born',
    'fotos_medidor_selo_caixa', 'fotos_medidor_identificador_fase',
  ],
  'Checklist de Fiscalização': [
    'fotos_checklist_croqui', 'fotos_checklist_panoramica_inicial', 'fotos_checklist_chede',
    'fotos_checklist_aterramento_cerca', 'fotos_checklist_padrao_geral',
    'fotos_checklist_padrao_interno', 'fotos_checklist_frying',
    'fotos_checklist_abertura_fechamento_pulo', 'fotos_checklist_panoramica_final',
    'fotos_checklist_postes', 'fotos_checklist_seccionamentos',
  ],
  'Ditais': [
    'fotos_ditais_abertura', 'fotos_ditais_impedir', 'fotos_ditais_testar',
    'fotos_ditais_aterrar', 'fotos_ditais_sinalizar',
  ],
  'Book de Aterramento': [
    'fotos_aterramento_vala_aberta', 'fotos_aterramento_hastes',
    'fotos_aterramento_vala_fechada', 'fotos_aterramento_medicao',
  ],
  'Altimetria': [
    'fotos_altimetria_lado_fonte', 'fotos_altimetria_medicao_fonte',
    'fotos_altimetria_lado_carga', 'fotos_altimetria_medicao_carga',
  ],
  'Vazamento e Limpeza de Transformador': [
    'fotos_vazamento_evidencia', 'fotos_vazamento_equipamentos_limpeza',
    'fotos_vazamento_tombamento_retirado', 'fotos_vazamento_placa_retirado',
    'fotos_vazamento_tombamento_instalado', 'fotos_vazamento_placa_instalado',
    'fotos_vazamento_instalacao',
  ],
}

const SECTION_LABELS: Record<string, string> = {
  fotos_antes: 'Fotos Antes',
  fotos_durante: 'Fotos Durante',
  fotos_depois: 'Fotos Depois',
  fotos_abertura: 'Abertura de Chave',
  fotos_fechamento: 'Fechamento de Chave',
  fotos_ditais_abertura: 'DITAIS - Desligar/Abertura',
  fotos_ditais_impedir: 'DITAIS - Impedir Religamento',
  fotos_ditais_testar: 'DITAIS - Testar Ausência de Tensão',
  fotos_ditais_aterrar: 'DITAIS - Aterrar',
  fotos_ditais_sinalizar: 'DITAIS - Sinalizar/Isolar',
  fotos_aterramento_vala_aberta: 'Vala Aberta',
  fotos_aterramento_hastes: 'Hastes Aplicadas',
  fotos_aterramento_vala_fechada: 'Vala Fechada',
  fotos_aterramento_medicao: 'Medição Terrômetro',
  fotos_transformador_laudo: 'Laudo',
  fotos_transformador_componente_instalado: 'Componente Instalado',
  fotos_transformador_tombamento_instalado: 'Tombamento Instalado',
  fotos_transformador_tape: 'Tape',
  fotos_transformador_placa_instalado: 'Placa Instalada',
  fotos_transformador_instalado: 'Instalado',
  fotos_transformador_antes_retirar: 'Antes de Retirar',
  fotos_transformador_tombamento_retirado: 'Tombamento Retirado',
  fotos_transformador_placa_retirado: 'Placa Retirada',
  fotos_medidor_padrao: 'Padrão',
  fotos_medidor_leitura: 'Leitura',
  fotos_medidor_selo_born: 'Selo Born',
  fotos_medidor_selo_caixa: 'Selo Caixa',
  fotos_medidor_identificador_fase: 'Identificador de Fase',
  fotos_checklist_croqui: 'Croqui',
  fotos_checklist_panoramica_inicial: 'Panorâmica Inicial',
  fotos_checklist_chede: 'Chave com Componente',
  fotos_checklist_aterramento_cerca: 'Aterramento de Cerca',
  fotos_checklist_padrao_geral: 'Padrão Geral',
  fotos_checklist_padrao_interno: 'Padrão Interno',
  fotos_checklist_frying: 'Flying',
  fotos_checklist_abertura_fechamento_pulo: 'Abertura/Fechamento de Pulo',
  fotos_checklist_postes: 'Postes',
  fotos_checklist_seccionamentos: 'Seccionamentos',
  fotos_checklist_panoramica_final: 'Panorâmica Final',
  fotos_altimetria_lado_fonte: 'Lado Fonte',
  fotos_altimetria_medicao_fonte: 'Medição Fonte',
  fotos_altimetria_lado_carga: 'Lado Carga',
  fotos_altimetria_medicao_carga: 'Medição Carga',
  fotos_vazamento_evidencia: 'Evidência',
  fotos_vazamento_equipamentos_limpeza: 'Equipamentos de Limpeza',
  fotos_vazamento_tombamento_retirado: 'Tombamento Retirado',
  fotos_vazamento_placa_retirado: 'Placa Retirada',
  fotos_vazamento_tombamento_instalado: 'Tombamento Instalado',
  fotos_vazamento_placa_instalado: 'Placa Instalada',
  fotos_vazamento_instalacao: 'Instalação',
}

function convertPhotoField(photoField: any): FotoInfo[] {
  if (!photoField || !Array.isArray(photoField) || photoField.length === 0) return []
  return photoField.map((item: any) => {
    if (typeof item === 'object' && item !== null && item.url) {
      if (item.url.startsWith('file:///') || item.url.startsWith('temp_') || item.url.startsWith('local_')) return null
      return {
        url: item.url,
        latitude: item.latitude ?? null,
        longitude: item.longitude ?? null,
        utmX: item.utmX ?? item.utm_x ?? null,
        utmY: item.utmY ?? item.utm_y ?? null,
        utmZone: item.utmZone ?? item.utm_zone ?? null,
        placaData: item.placaData || item.placa_data || null,
      } as FotoInfo
    }
    if (typeof item === 'string' && item.startsWith('http')) {
      return { url: item, latitude: null, longitude: null, utmX: null, utmY: null, utmZone: null, placaData: null } as FotoInfo
    }
    if (typeof item === 'string' && item.trim() && !item.startsWith('temp_') && !item.startsWith('local_')) {
      const url = supabase.storage.from('obra-photos').getPublicUrl(item).data.publicUrl
      return { url, latitude: null, longitude: null, utmX: null, utmY: null, utmZone: null, placaData: null } as FotoInfo
    }
    return null
  }).filter(Boolean) as FotoInfo[]
}

type ServicoData = {
  id: string
  obra_id: string
  tipo_servico: string
  responsavel?: string | null
  status?: string | null
  created_at: string
  [key: string]: any
}

type ObraParent = {
  id: string
  obra?: string
  equipe?: string
  data?: string
}

export default function ServicoDetailPage() {
  const params = useParams()
  const router = useRouter()
  const { isAdmin } = useAuth()
  const [servico, setServico] = useState<ServicoData | null>(null)
  const [parentObra, setParentObra] = useState<ObraParent | null>(null)
  const [loading, setLoading] = useState(true)
  const [exportingPdf, setExportingPdf] = useState(false)
  const [finalizando, setFinalizando] = useState(false)
  const [showEditModal, setShowEditModal] = useState(false)
  const [editForm, setEditForm] = useState({ responsavel: '', tipo_servico: '', status: '' })
  const [savingEdit, setSavingEdit] = useState(false)
  const [editError, setEditError] = useState('')

  useEffect(() => {
    if (params.id) {
      loadServico(params.id as string)
    }
  }, [params.id])

  async function loadServico(id: string) {
    try {
      // Busca serviço + obra pai via join (foreign key obra_id → obras.id)
      const { data, error } = await supabase
        .from('servicos')
        .select('*, obras!obra_id(id, obra, equipe, data)')
        .eq('id', id)
        .single()

      if (error) throw error

      // Extrair e setar obra pai
      const obraJoin = (data as any).obras
      if (obraJoin) {
        setParentObra({
          id: obraJoin.id,
          obra: obraJoin.obra,
          equipe: obraJoin.equipe,
          data: obraJoin.data,
        })
      } else if (data.obra_id) {
        // Fallback: query separada caso o join não retorne
        const { data: obraData } = await supabase
          .from('obras')
          .select('id, obra, equipe, data')
          .eq('id', data.obra_id)
          .single()
        if (obraData) setParentObra(obraData)
      }

      // Converter campos de fotos
      const converted: ServicoData = { ...data }
      for (const key of Object.keys(data)) {
        if (key.startsWith('fotos_')) {
          converted[key] = convertPhotoField(data[key])
        }
      }
      setServico(converted)
    } catch (error) {
      console.error('Erro ao carregar serviço:', error)
      alert('Erro ao carregar serviço')
    } finally {
      setLoading(false)
    }
  }

  async function handleFinalizarServico() {
    if (!servico || !window.confirm('Confirmar conclusão do serviço?')) return
    setFinalizando(true)
    try {
      const { error } = await supabase
        .from('servicos')
        .update({ status: 'completo' })
        .eq('id', servico.id)
      if (error) throw error
      setServico({ ...servico, status: 'completo' })
    } catch (error) {
      console.error('Erro ao finalizar serviço:', error)
      alert('Erro ao finalizar serviço')
    } finally {
      setFinalizando(false)
    }
  }

  async function handleReabrirServico() {
    if (!servico || !window.confirm('Confirmar reabertura do serviço? O status voltará para Em Andamento.')) return
    setFinalizando(true)
    try {
      const { error } = await supabase
        .from('servicos')
        .update({ status: 'em_progresso' })
        .eq('id', servico.id)
      if (error) throw error
      setServico({ ...servico, status: 'em_progresso' })
    } catch (error) {
      console.error('Erro ao reabrir serviço:', error)
      alert('Erro ao reabrir serviço')
    } finally {
      setFinalizando(false)
    }
  }

  async function handleExportPdf() {
    if (!servico || !parentObra) return
    setExportingPdf(true)
    try {
      // Montar objeto compatível com Obra para o gerador de PDF
      const obraParaPdf = {
        ...servico,
        id: servico.id,
        obra: parentObra.obra || '',
        equipe: parentObra.equipe || '',
        data: parentObra.data || servico.created_at,
        placa: '',
        responsavel: servico.responsavel || '',
        tipo_servico: servico.tipo_servico,
        data_fechamento: servico.status === 'completo' ? servico.updated_at || servico.created_at : null,
        tem_atipicidade: false,
        atipicidades: [],
        user_id: servico.user_id || '',
      } as any
      await generatePDF(obraParaPdf)
    } catch (error) {
      console.error('Erro ao gerar PDF:', error)
      alert('Erro ao gerar PDF')
    } finally {
      setExportingPdf(false)
    }
  }

  function openEdit() {
    if (!servico) return
    setEditForm({
      responsavel: servico.responsavel || '',
      tipo_servico: servico.tipo_servico || '',
      status: servico.status || 'rascunho',
    })
    setEditError('')
    setShowEditModal(true)
  }

  async function handleSaveEdit(e: React.FormEvent) {
    e.preventDefault()
    if (!servico) return
    setSavingEdit(true)
    setEditError('')
    try {
      const { error } = await supabase
        .from('servicos')
        .update({
          responsavel: editForm.responsavel.trim(),
          tipo_servico: editForm.tipo_servico.trim(),
          status: editForm.status,
        })
        .eq('id', servico.id)
      if (error) throw error
      setServico(prev => prev ? { ...prev, ...editForm } : prev)
      setShowEditModal(false)
    } catch (err: any) {
      setEditError(err.message || 'Erro ao salvar')
    } finally {
      setSavingEdit(false)
    }
  }

  async function handleAddPhoto(sectionKey: string, file: File): Promise<FotoInfo | null> {
    if (!servico) return null
    try {
      const ext = file.name.split('.').pop() || 'jpg'
      const path = `servicos/${servico.id}/${sectionKey}_${Date.now()}.${ext}`
      const { error: upErr } = await supabase.storage.from('obra-photos').upload(path, file)
      if (upErr) throw upErr
      const url = supabase.storage.from('obra-photos').getPublicUrl(path).data.publicUrl
      const newPhoto: FotoInfo = { url, latitude: null, longitude: null, utmX: null, utmY: null, utmZone: null, placaData: null }
      const current: FotoInfo[] = servico[sectionKey] || []
      const next = [...current, newPhoto]
      const { error } = await supabase.from('servicos').update({ [sectionKey]: next }).eq('id', servico.id)
      if (error) throw error
      setServico({ ...servico, [sectionKey]: next })
      return newPhoto
    } catch (err) {
      console.error('Erro ao adicionar foto:', err)
      alert('Erro ao adicionar foto')
      return null
    }
  }

  async function handleUpdatePhoto(sectionKey: string, index: number, updatedPhoto: FotoInfo): Promise<FotoInfo | null> {
    if (!servico) return null
    try {
      const current: FotoInfo[] = [...(servico[sectionKey] || [])]
      current[index] = updatedPhoto
      const { error } = await supabase.from('servicos').update({ [sectionKey]: current }).eq('id', servico.id)
      if (error) throw error
      setServico({ ...servico, [sectionKey]: current })
      return updatedPhoto
    } catch (err) {
      console.error('Erro ao atualizar foto:', err)
      return null
    }
  }

  async function handleReplacePhoto(sectionKey: string, index: number, file: File): Promise<FotoInfo | null> {
    if (!servico) return null
    try {
      const ext = file.name.split('.').pop() || 'jpg'
      const path = `servicos/${servico.id}/${sectionKey}_${Date.now()}_r.${ext}`
      const { error: upErr } = await supabase.storage.from('obra-photos').upload(path, file)
      if (upErr) throw upErr
      const url = supabase.storage.from('obra-photos').getPublicUrl(path).data.publicUrl
      const current: FotoInfo[] = [...(servico[sectionKey] || [])]
      const nextPhoto: FotoInfo = { ...current[index], url }
      current[index] = nextPhoto
      const { error } = await supabase.from('servicos').update({ [sectionKey]: current }).eq('id', servico.id)
      if (error) throw error
      setServico({ ...servico, [sectionKey]: current })
      return nextPhoto
    } catch (err) {
      console.error('Erro ao substituir foto:', err)
      return null
    }
  }

  async function handleDeletePhoto(sectionKey: string, index: number, photo: FotoInfo): Promise<boolean> {
    if (!servico) return false
    try {
      const current: FotoInfo[] = [...(servico[sectionKey] || [])]
      const next = current.filter((_, i) => i !== index)
      const { error } = await supabase.from('servicos').update({ [sectionKey]: next }).eq('id', servico.id)
      if (error) throw error
      setServico({ ...servico, [sectionKey]: next })
      // Try to remove from storage
      if (photo.url) {
        const match = photo.url.match(/obra-photos\/(.+)$/)
        if (match) await supabase.storage.from('obra-photos').remove([match[1]])
      }
      return true
    } catch (err) {
      console.error('Erro ao excluir foto:', err)
      return false
    }
  }

  const galerias = servico
    ? (GALERIAS_POR_TIPO_SERVICO[servico.tipo_servico] ?? ['fotos_antes', 'fotos_durante', 'fotos_depois'])
    : []

  const isConcluido = servico?.status === 'completo'

  if (loading) {
    return (
      <ProtectedRoute>
        <div className="min-h-screen flex items-center justify-center">
          <div className="text-center space-y-3">
            <div className="spinner mx-auto" />
            <p className="text-sm font-medium text-gray-500">Carregando serviço...</p>
          </div>
        </div>
      </ProtectedRoute>
    )
  }

  if (!servico) {
    return (
      <ProtectedRoute>
        <div className="min-h-screen flex items-center justify-center">
          <div className="text-center space-y-4">
            <p className="text-base font-medium text-gray-500">Serviço não encontrado</p>
            <button onClick={() => router.back()} className="btn-ghost mx-auto">Voltar</button>
          </div>
        </div>
      </ProtectedRoute>
    )
  }

  const galleryProps = {
    obraNumero: parentObra?.obra,
    tipoServico: servico.tipo_servico,
    equipe: parentObra?.equipe,
    allowAdd: true,
    onAddPhoto: handleAddPhoto,
    onUpdatePhoto: handleUpdatePhoto,
    onReplacePhoto: handleReplacePhoto,
    onDeletePhoto: handleDeletePhoto,
  }

  return (
    <ProtectedRoute>
      <AppShell>
        {/* Header */}
        <div className="mb-6 space-y-4">
          <button
            onClick={() => router.back()}
            className="flex items-center gap-1.5 text-gray-500 hover:text-gray-900 transition-colors group"
          >
            <svg className="w-4 h-4 transition-transform group-hover:-translate-x-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 19l-7-7m0 0l7-7m-7 7h18" />
            </svg>
            <span className="text-sm font-medium">Voltar</span>
          </button>

          <div className="flex flex-wrap items-start justify-between gap-4">
            <div>
              <div className="flex flex-wrap items-center gap-3 mb-2">
                <h1 className="text-2xl sm:text-3xl lg:text-4xl font-semibold text-slate-900 tracking-tight">
                  {parentObra?.obra || 'Sem número'}
                </h1>
                {isConcluido ? (
                  <span className="px-3 py-1 bg-green-100 text-green-800 border border-green-200 text-sm font-semibold rounded-full flex items-center gap-1.5">
                    <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                    </svg>
                    Concluído
                  </span>
                ) : (
                  <span className="px-3 py-1 bg-amber-100 text-amber-800 border border-amber-200 text-sm font-semibold rounded-full flex items-center gap-1.5">
                    <span className="w-2 h-2 rounded-full bg-amber-500 animate-pulse" />
                    Em Andamento
                  </span>
                )}
              </div>
              <div className="flex flex-wrap items-center gap-2">
                <span className="px-3 py-1 bg-red-600 text-white text-sm font-semibold rounded-full">
                  {parentObra?.equipe || '-'}
                </span>
                <span className="text-gray-500 text-sm">{servico.tipo_servico}</span>
                {parentObra?.data && (
                  <span className="text-gray-500 text-sm">
                    · {format(new Date(parentObra.data), "dd 'de' MMMM 'de' yyyy", { locale: ptBR })}
                  </span>
                )}
              </div>
            </div>

            <div className="flex flex-wrap items-center gap-3">
              {isAdmin && (
                isConcluido ? (
                  <button
                    onClick={handleReabrirServico}
                    disabled={finalizando}
                    className="px-4 py-2.5 bg-white border border-gray-300 hover:border-gray-400 text-sm font-semibold text-gray-700 rounded-lg shadow-sm transition-colors disabled:opacity-60 disabled:cursor-not-allowed flex items-center gap-2"
                  >
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 11V7a4 4 0 118 0m-4 8v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2z" />
                    </svg>
                    {finalizando ? 'Aguarde...' : 'Reabrir Serviço'}
                  </button>
                ) : (
                  <button
                    onClick={handleFinalizarServico}
                    disabled={finalizando}
                    className="px-4 py-2.5 bg-green-600 hover:bg-green-700 text-white text-sm font-semibold rounded-lg shadow-sm transition-colors disabled:opacity-60 disabled:cursor-not-allowed flex items-center gap-2"
                  >
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                    </svg>
                    {finalizando ? 'Aguarde...' : 'Finalizar Serviço'}
                  </button>
                )
              )}
              {isAdmin && (
                <button
                  onClick={openEdit}
                  className="px-4 py-2.5 bg-white border border-gray-200 hover:border-indigo-400 text-sm font-semibold text-gray-700 rounded-lg shadow-sm transition-colors flex items-center gap-2"
                >
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                  </svg>
                  Editar Dados
                </button>
              )}
              <button
                onClick={handleExportPdf}
                disabled={exportingPdf}
                className="px-4 py-2.5 bg-white border border-gray-200 hover:border-blue-500 text-sm font-semibold text-gray-700 rounded-lg shadow-sm transition-colors disabled:opacity-60 disabled:cursor-not-allowed"
              >
                {exportingPdf ? 'Gerando PDF...' : 'Exportar PDF'}
              </button>
            </div>
          </div>

          <p className="text-sm text-gray-400">Clique em uma foto para visualizar, trocar ou editar a placa.</p>
        </div>

        {/* Info Cards */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 mb-8">
          <div className="bg-white p-4 rounded-xl shadow-sm border border-gray-100">
            <div className="text-xs font-medium text-gray-400 uppercase tracking-wider mb-1">Responsável</div>
            <div className="text-sm font-semibold text-gray-900">{servico.responsavel || '—'}</div>
          </div>
          <div className="bg-white p-4 rounded-xl shadow-sm border border-gray-100">
            <div className="text-xs font-medium text-gray-400 uppercase tracking-wider mb-1">Tipo de Serviço</div>
            <div className="text-sm font-semibold text-gray-900">{servico.tipo_servico}</div>
          </div>
          <div className="bg-white p-4 rounded-xl shadow-sm border border-gray-100">
            <div className="text-xs font-medium text-gray-400 uppercase tracking-wider mb-1">Status</div>
            <div>
              {isConcluido ? (
                <span className="px-2.5 py-1 bg-green-100 text-green-800 text-xs font-semibold rounded-full">Concluído</span>
              ) : servico.status === 'em_progresso' ? (
                <span className="px-2.5 py-1 bg-blue-100 text-blue-800 text-xs font-semibold rounded-full">Em Progresso</span>
              ) : (
                <span className="px-2.5 py-1 bg-amber-100 text-amber-800 text-xs font-semibold rounded-full">Rascunho</span>
              )}
            </div>
          </div>
          <div className="bg-white p-4 rounded-xl shadow-sm border border-gray-100">
            <div className="text-xs font-medium text-gray-400 uppercase tracking-wider mb-1">Data</div>
            <div className="text-sm font-semibold text-gray-900">
              {format(new Date(servico.created_at), 'dd/MM/yyyy', { locale: ptBR })}
            </div>
          </div>
        </div>

        {/* Photo Galleries */}
        <div className="space-y-0">
          {galerias.map(key => {
            const photos: FotoInfo[] = servico[key] || []
            if (!photos.length && !galleryProps.allowAdd) return null
            return (
              <PhotoGallery
                key={key}
                photos={photos}
                title={SECTION_LABELS[key] || key}
                sectionKey={key}
                {...galleryProps}
              />
            )
          })}
          {galerias.every(key => !(servico[key]?.length)) && (
            <div className="text-center py-20">
              <svg className="w-16 h-16 text-gray-200 mx-auto mb-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
              </svg>
              <p className="text-gray-400 font-medium">Nenhuma foto registrada neste serviço</p>
            </div>
          )}
        </div>

        {/* Edit Modal */}
        {showEditModal && (
          <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50 p-4">
            <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md">
              <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100">
                <h3 className="text-lg font-bold text-gray-900">Editar Serviço</h3>
                <button onClick={() => setShowEditModal(false)} className="p-2 rounded-lg text-gray-400 hover:bg-gray-100">
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </button>
              </div>
              <form onSubmit={handleSaveEdit} className="p-6 space-y-4">
                {editError && (
                  <div className="p-3 bg-red-50 text-red-700 rounded-lg text-sm">{editError}</div>
                )}
                <div>
                  <label className="block text-sm font-semibold text-gray-700 mb-1">Tipo de Serviço</label>
                  <input
                    type="text"
                    value={editForm.tipo_servico}
                    onChange={e => setEditForm(f => ({ ...f, tipo_servico: e.target.value }))}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-indigo-400"
                  />
                </div>
                <div>
                  <label className="block text-sm font-semibold text-gray-700 mb-1">Responsável</label>
                  <input
                    type="text"
                    value={editForm.responsavel}
                    onChange={e => setEditForm(f => ({ ...f, responsavel: e.target.value }))}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-indigo-400"
                  />
                </div>
                <div>
                  <label className="block text-sm font-semibold text-gray-700 mb-1">Status</label>
                  <select
                    value={editForm.status}
                    onChange={e => setEditForm(f => ({ ...f, status: e.target.value }))}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-indigo-400"
                  >
                    <option value="rascunho">Rascunho</option>
                    <option value="em_progresso">Em Progresso</option>
                    <option value="completo">Concluído</option>
                  </select>
                </div>
                <div className="flex gap-3 pt-2">
                  <button
                    type="button"
                    onClick={() => setShowEditModal(false)}
                    className="flex-1 px-4 py-2 border border-gray-300 text-gray-700 rounded-lg text-sm font-semibold hover:bg-gray-50"
                  >
                    Cancelar
                  </button>
                  <button
                    type="submit"
                    disabled={savingEdit}
                    className="flex-1 px-4 py-2 bg-indigo-600 text-white rounded-lg text-sm font-semibold hover:bg-indigo-700 disabled:opacity-50"
                  >
                    {savingEdit ? 'Salvando...' : 'Salvar'}
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
