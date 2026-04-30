'use client'

import { useEffect, useState, useMemo, useRef } from 'react'
import { supabase, type Obra, type FotoInfo, getObraStatus } from '@/lib/supabase'
import ProtectedRoute from '@/components/ProtectedRoute'
import AppShell from '@/components/AppShell'
import { generatePDF, generateCombinedPDF } from '@/lib/pdf-generator'
import { format } from 'date-fns'
import { ptBR } from 'date-fns/locale'
import { useRouter } from 'next/navigation'
import { useAuth } from '@/contexts/AuthContext'
import * as XLSX from 'xlsx'

const REPORT_PHOTO_SECTIONS: { key: keyof Obra; label: string; color: string; lightColor: string }[] = [
  { key: 'fotos_antes', label: 'Fotos Antes', color: 'blue', lightColor: 'blue' },
  { key: 'fotos_durante', label: 'Fotos Durante', color: 'orange', lightColor: 'orange' },
  { key: 'fotos_depois', label: 'Fotos Depois', color: 'green', lightColor: 'green' },
  { key: 'fotos_abertura', label: 'Fotos Abertura de Chave', color: 'cyan', lightColor: 'cyan' },
  { key: 'fotos_fechamento', label: 'Fotos Fechamento de Chave', color: 'teal', lightColor: 'teal' },
  { key: 'fotos_ditais_abertura', label: 'DITAIS - Desligar/Abertura', color: 'indigo', lightColor: 'indigo' },
  { key: 'fotos_ditais_impedir', label: 'DITAIS - Impedir Religamento', color: 'indigo', lightColor: 'indigo' },
  { key: 'fotos_ditais_testar', label: 'DITAIS - Testar Ausência de Tensão', color: 'indigo', lightColor: 'indigo' },
  { key: 'fotos_ditais_aterrar', label: 'DITAIS - Aterrar', color: 'indigo', lightColor: 'indigo' },
  { key: 'fotos_ditais_sinalizar', label: 'DITAIS - Sinalizar/Isolar', color: 'indigo', lightColor: 'indigo' },
  { key: 'fotos_aterramento_vala_aberta', label: 'Aterramento - Vala Aberta', color: 'emerald', lightColor: 'emerald' },
  { key: 'fotos_aterramento_hastes', label: 'Aterramento - Hastes Aplicadas', color: 'emerald', lightColor: 'emerald' },
  { key: 'fotos_aterramento_vala_fechada', label: 'Aterramento - Vala Fechada', color: 'emerald', lightColor: 'emerald' },
  { key: 'fotos_aterramento_medicao', label: 'Aterramento - Medição Terrômetro', color: 'emerald', lightColor: 'emerald' },
  { key: 'fotos_checklist_croqui', label: 'Checklist - Croqui', color: 'purple', lightColor: 'purple' },
  { key: 'fotos_checklist_panoramica_inicial', label: 'Checklist - Panorâmica Inicial', color: 'purple', lightColor: 'purple' },
  { key: 'fotos_checklist_chede', label: 'Checklist - Chave com Componente', color: 'purple', lightColor: 'purple' },
  { key: 'fotos_checklist_postes', label: 'Checklist - Postes', color: 'purple', lightColor: 'purple' },
  { key: 'fotos_checklist_seccionamentos', label: 'Checklist - Seccionamentos', color: 'purple', lightColor: 'purple' },
  { key: 'fotos_checklist_aterramento_cerca', label: 'Checklist - Aterramento de Cerca', color: 'purple', lightColor: 'purple' },
  { key: 'fotos_checklist_padrao_geral', label: 'Checklist - Padrão Geral', color: 'purple', lightColor: 'purple' },
  { key: 'fotos_checklist_padrao_interno', label: 'Checklist - Padrão Interno', color: 'purple', lightColor: 'purple' },
  { key: 'fotos_checklist_frying', label: 'Checklist - Flying', color: 'purple', lightColor: 'purple' },
  { key: 'fotos_checklist_abertura_fechamento_pulo', label: 'Checklist - Abertura/Fechamento de Pulo', color: 'purple', lightColor: 'purple' },
  { key: 'fotos_checklist_hastes_aplicadas', label: 'Checklist - Hastes Aplicadas e Medição do Termômetro', color: 'purple', lightColor: 'purple' },
  { key: 'fotos_checklist_panoramica_final', label: 'Checklist - Panorâmica Final', color: 'purple', lightColor: 'purple' },
  { key: 'fotos_altimetria_lado_fonte', label: 'Altimetria - Lado Fonte', color: 'sky', lightColor: 'sky' },
  { key: 'fotos_altimetria_medicao_fonte', label: 'Altimetria - Medição Fonte', color: 'sky', lightColor: 'sky' },
  { key: 'fotos_altimetria_lado_carga', label: 'Altimetria - Lado Carga', color: 'sky', lightColor: 'sky' },
  { key: 'fotos_altimetria_medicao_carga', label: 'Altimetria - Medição Carga', color: 'sky', lightColor: 'sky' },
  { key: 'fotos_vazamento_evidencia', label: 'Vazamento - Evidência', color: 'rose', lightColor: 'rose' },
  { key: 'fotos_vazamento_equipamentos_limpeza', label: 'Vazamento - Equipamentos de Limpeza', color: 'rose', lightColor: 'rose' },
  { key: 'fotos_vazamento_tombamento_retirado', label: 'Vazamento - Tombamento Retirado', color: 'rose', lightColor: 'rose' },
  { key: 'fotos_vazamento_placa_retirado', label: 'Vazamento - Placa Retirado', color: 'rose', lightColor: 'rose' },
  { key: 'fotos_vazamento_tombamento_instalado', label: 'Vazamento - Tombamento Instalado', color: 'rose', lightColor: 'rose' },
  { key: 'fotos_vazamento_placa_instalado', label: 'Vazamento - Placa Instalado', color: 'rose', lightColor: 'rose' },
  { key: 'fotos_vazamento_instalacao', label: 'Vazamento - Instalação', color: 'rose', lightColor: 'rose' },
  { key: 'fotos_medidor_padrao', label: 'Medidor - Padrão', color: 'amber', lightColor: 'amber' },
  { key: 'fotos_medidor_leitura', label: 'Medidor - Leitura', color: 'amber', lightColor: 'amber' },
  { key: 'fotos_medidor_selo_born', label: 'Medidor - Selo Born', color: 'amber', lightColor: 'amber' },
  { key: 'fotos_medidor_selo_caixa', label: 'Medidor - Selo Caixa', color: 'amber', lightColor: 'amber' },
  { key: 'fotos_medidor_identificador_fase', label: 'Medidor - Identificador de Fase', color: 'amber', lightColor: 'amber' },
  { key: 'fotos_transformador_laudo', label: 'Transformador - Laudo', color: 'red', lightColor: 'red' },
  { key: 'fotos_transformador_componente_instalado', label: 'Transformador - Componente Instalado', color: 'red', lightColor: 'red' },
  { key: 'fotos_transformador_tombamento_instalado', label: 'Transformador - Tombamento Instalado', color: 'red', lightColor: 'red' },
  { key: 'fotos_transformador_tape', label: 'Transformador - Tape', color: 'red', lightColor: 'red' },
  { key: 'fotos_transformador_placa_instalado', label: 'Transformador - Placa Instalada', color: 'red', lightColor: 'red' },
  { key: 'fotos_transformador_instalado', label: 'Transformador - Instalado', color: 'red', lightColor: 'red' },
  { key: 'fotos_transformador_antes_retirar', label: 'Transformador - Antes de Retirar', color: 'red', lightColor: 'red' },
  { key: 'fotos_transformador_tombamento_retirado', label: 'Transformador - Tombamento Retirado', color: 'red', lightColor: 'red' },
  { key: 'fotos_transformador_placa_retirado', label: 'Transformador - Placa Retirada', color: 'red', lightColor: 'red' },
]

const TIPOS_SERVICO_BASE = [
  'Abertura e Fechamento de Chave',
  'Altimetria',
  'Bandolamento',
  'Book de Aterramento',
  'Cava em Rocha',
  'Checklist de Fiscalização',
  'Ditais',
  'Documentação',
  'Emenda',
  'Fundação Especial',
  'Instalação do Medidor',
  'Linha Viva',
  'Poda',
  'Transformador',
  'Vazamento e Limpeza de Transformador',
]

function getSectionsForBook(tipoServico: string) {
  const keyMap: Record<string, string[]> = {
    'Abertura e Fechamento de Chave': [
      'fotos_abertura', 'fotos_fechamento',
    ],
    'Ditais': [
      'fotos_ditais_abertura', 'fotos_ditais_impedir', 'fotos_ditais_testar',
      'fotos_ditais_aterrar', 'fotos_ditais_sinalizar',
    ],
    'Book de Aterramento': [
      'fotos_aterramento_vala_aberta', 'fotos_aterramento_hastes',
      'fotos_aterramento_vala_fechada', 'fotos_aterramento_medicao',
    ],
    'Transformador': [
      'fotos_transformador_laudo', 'fotos_transformador_componente_instalado',
      'fotos_transformador_tombamento_instalado', 'fotos_transformador_tape',
      'fotos_transformador_placa_instalado', 'fotos_transformador_instalado',
      'fotos_transformador_antes_retirar', 'fotos_transformador_tombamento_retirado',
      'fotos_transformador_placa_retirado',
    ],
    'Instalação do Medidor': [
      'fotos_medidor_padrao', 'fotos_medidor_leitura', 'fotos_medidor_selo_born',
      'fotos_medidor_selo_caixa', 'fotos_medidor_identificador_fase',
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
    'Checklist de Fiscalização': [
      'fotos_checklist_croqui', 'fotos_checklist_panoramica_inicial',
      'fotos_checklist_chede', 'fotos_checklist_postes', 'fotos_checklist_seccionamentos',
      'fotos_checklist_aterramento_cerca', 'fotos_checklist_padrao_geral',
      'fotos_checklist_padrao_interno', 'fotos_checklist_frying',
      'fotos_checklist_abertura_fechamento_pulo', 'fotos_checklist_hastes_aplicadas',
      'fotos_checklist_panoramica_final',
    ],
  }

  const keys = keyMap[tipoServico] ?? ['fotos_antes', 'fotos_durante', 'fotos_depois']
  return REPORT_PHOTO_SECTIONS.filter(s => keys.includes(String(s.key)))
}

type ServicoReport = {
  id: string
  obra_id: string
  tipo_servico: string
  responsavel?: string | null
  status?: string | null
  sync_status?: string | null
  error_message?: string | null
  created_at: string
  updated_at?: string | null
  fotos_antes?: FotoInfo[]
  fotos_durante?: FotoInfo[]
  fotos_depois?: FotoInfo[]
}

type ReportBook = Obra & {
  source_table: 'obras' | 'servicos'
  parent_obra_id?: string
  service_id?: string
  service_status?: string | null
  service_sync_status?: string | null
}

export default function ReportsPage() {
  const router = useRouter()
  const { isAdmin, user, profile } = useAuth()
  const [obras, setObras] = useState<ReportBook[]>([])
  const [loading, setLoading] = useState(true)
  const [selectedPeriod, setSelectedPeriod] = useState('todos')
  const [selectedTeam, setSelectedTeam] = useState('todas')
  const [selectedService, setSelectedService] = useState('todos')
  const [searchNumeroObra, setSearchNumeroObra] = useState('')
  const [selectedObras, setSelectedObras] = useState<Set<string>>(new Set())
  const [expandedObraIds, setExpandedObraIds] = useState<Set<string>>(new Set())
  const [openMenuId, setOpenMenuId] = useState<string | null>(null)
  const [menuPosition, setMenuPosition] = useState<{ top: number; left: number } | null>(null)
  const [exportingId, setExportingId] = useState<string | null>(null)
  const [exportingCombinedId, setExportingCombinedId] = useState<string | null>(null)
  const [exportingXlsx, setExportingXlsx] = useState(false)
  const [exportingAllPdf, setExportingAllPdf] = useState(false)
  const [selectedObraForBook, setSelectedObraForBook] = useState<ReportBook | null>(null)
  const [servicosDaObra, setServicosDaObra] = useState<ServicoReport[]>([])
  const [deletingId, setDeletingId] = useState<string | null>(null)
  const [deletingBulk, setDeletingBulk] = useState(false)
  const [photoActionKey, setPhotoActionKey] = useState<string | null>(null)
  const [viewingPhoto, setViewingPhoto] = useState<{ url: string; label: string } | null>(null)
  const [editingObra, setEditingObra] = useState<Obra | null>(null)
  const [editForm, setEditForm] = useState({ equipe: '', obra: '', data: '', responsavel: '', tipo_servico: '' })
  const [savingEdit, setSavingEdit] = useState(false)
  const [editError, setEditError] = useState('')
  const [showCreateBookModal, setShowCreateBookModal] = useState(false)
  const [createForm, setCreateForm] = useState({ equipe: '', obra: '', data: '', responsavel: '', tipo_servico: '' })
  const [savingCreateBook, setSavingCreateBook] = useState(false)
  const [createBookError, setCreateBookError] = useState('')
  const [equipesDB, setEquipesDB] = useState<string[]>([])
  const [tiposServicoDB, setTiposServicoDB] = useState<string[]>([])
  const menuRef = useRef<HTMLDivElement>(null)

  const isServiceRow = (obra: ReportBook) => obra.source_table === 'servicos'
  const getSelectableRows = (rows: ReportBook[]) => rows

  useEffect(() => {
    loadObras()
    loadEquipes()
    loadTiposServico()
  }, [])

  // Fechar menu ao clicar fora ou rolar
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (menuRef.current && !menuRef.current.contains(event.target as Node)) {
        setOpenMenuId(null)
        setMenuPosition(null)
      }
    }
    function handleScroll() {
      setOpenMenuId(null)
      setMenuPosition(null)
    }
    document.addEventListener('mousedown', handleClickOutside)
    window.addEventListener('scroll', handleScroll, true)
    return () => {
      document.removeEventListener('mousedown', handleClickOutside)
      window.removeEventListener('scroll', handleScroll, true)
    }
  }, [])

  async function loadObras() {
    try {
      const [obrasResult, servicosResult] = await Promise.allSettled([
        supabase
          .from('obras')
          .select('*')
          .order('created_at', { ascending: false }),
        supabase
          .from('servicos')
          .select('*')
          .order('created_at', { ascending: false }),
      ])

      if (obrasResult.status !== 'fulfilled') {
        throw obrasResult.reason
      }

      const obrasData = obrasResult.value.data || []
      const obrasError = obrasResult.value.error
      if (obrasError) throw obrasError

      const obrasBase = obrasData.map((obra) => ({
        ...obra,
        source_table: 'obras' as const,
      })) as ReportBook[]

      const servicosData = servicosResult.status === 'fulfilled' ? servicosResult.value.data || [] : []
      const servicosError = servicosResult.status === 'fulfilled' ? servicosResult.value.error : servicosResult.reason
      if (servicosError) {
        console.warn('[reports] Erro ao carregar servicos:', servicosError)
      } else {
        console.log(`[reports] ${servicosData.length} serviço(s) carregado(s) da tabela servicos`)
      }

      const obrasById = new Map(obrasBase.map((obra) => [obra.id, obra]))
      const servicosNormalizados = servicosData.map((servico: any) => {
        const parentObra = obrasById.get(servico.obra_id)
        const base: Partial<ReportBook> = parentObra ? { ...parentObra } : {
          id: servico.obra_id,
          data: servico.created_at,
          obra: servico.obra_id,
          responsavel: servico.responsavel || '',
          equipe: '',
          tipo_servico: servico.tipo_servico,
          tem_atipicidade: false,
          atipicidades: [],
          user_id: servico.user_id || '',
          created_at: servico.created_at,
          source_table: 'servicos' as const,
        }

        return {
          ...base,
          ...servico,
          id: `servico:${servico.id}`,
          obra: parentObra?.obra || base.obra || servico.obra_id,
          equipe: parentObra?.equipe || base.equipe || '',
          responsavel: servico.responsavel || parentObra?.responsavel || base.responsavel || '',
          data: parentObra?.data || base.data || servico.created_at,
          tipo_servico: servico.tipo_servico,
          created_at: servico.created_at,
          source_table: 'servicos' as const,
          parent_obra_id: servico.obra_id,
          service_id: servico.id,
          service_status: servico.status,
          service_sync_status: servico.sync_status,
        } as ReportBook
      })

      setObras([...obrasBase, ...servicosNormalizados])
    } catch (error) {
      console.error('Erro ao carregar obras:', error)
    } finally {
      setLoading(false)
    }
  }

  async function loadEquipes() {
    const { data } = await supabase
      .from('equipes')
      .select('codigo')
      .eq('ativa', true)
      .order('codigo')
    if (data) setEquipesDB(data.map((e: { codigo: string }) => e.codigo))
  }

  async function loadTiposServico() {
    const [obrasData, servicosData] = await Promise.all([
      supabase
        .from('obras')
        .select('tipo_servico')
        .not('tipo_servico', 'is', null),
      supabase
        .from('servicos')
        .select('tipo_servico')
        .not('tipo_servico', 'is', null),
    ])

    const fromObras = obrasData.data ? obrasData.data.map((o: { tipo_servico: string }) => o.tipo_servico).filter(Boolean) : []
    const fromServicos = servicosData.data ? servicosData.data.map((o: { tipo_servico: string }) => o.tipo_servico).filter(Boolean) : []
    const fromDB = [...fromObras, ...fromServicos]
    const merged = Array.from(new Set([...TIPOS_SERVICO_BASE, ...fromDB])).sort() as string[]
    setTiposServicoDB(merged)
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
    const totalFotos = filteredObras.reduce((acc, obra) => acc + getTotalPhotosCount(obra), 0)

    return {
      totalObras,
      obrasComAtipicidade,
      totalFotos,
      mediaFotos: totalObras > 0 ? Math.round(totalFotos / totalObras) : 0,
      obrasSelecionadas: selectedObras.size
    }
  }, [filteredObras, selectedObras])

  function toggleSelectAll() {
    const selectableRows = getSelectableRows(filteredObras)
    if (selectedObras.size === selectableRows.length) {
      setSelectedObras(new Set())
    } else {
      setSelectedObras(new Set(selectableRows.map(o => o.id)))
    }
  }

  function toggleObraExpand(obraId: string) {
    setExpandedObraIds(prev => {
      const next = new Set(prev)
      if (next.has(obraId)) next.delete(obraId)
      else next.add(obraId)
      return next
    })
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
    // Fotos básicas
    if (obra.fotos_antes?.length) count += obra.fotos_antes.length
    if (obra.fotos_durante?.length) count += obra.fotos_durante.length
    if (obra.fotos_depois?.length) count += obra.fotos_depois.length
    if (obra.fotos_abertura?.length) count += obra.fotos_abertura.length
    if (obra.fotos_fechamento?.length) count += obra.fotos_fechamento.length
    // DITAIS
    if (obra.fotos_ditais_abertura?.length) count += obra.fotos_ditais_abertura.length
    if (obra.fotos_ditais_impedir?.length) count += obra.fotos_ditais_impedir.length
    if (obra.fotos_ditais_testar?.length) count += obra.fotos_ditais_testar.length
    if (obra.fotos_ditais_aterrar?.length) count += obra.fotos_ditais_aterrar.length
    if (obra.fotos_ditais_sinalizar?.length) count += obra.fotos_ditais_sinalizar.length
    // Aterramento
    if (obra.fotos_aterramento_vala_aberta?.length) count += obra.fotos_aterramento_vala_aberta.length
    if (obra.fotos_aterramento_hastes?.length) count += obra.fotos_aterramento_hastes.length
    if (obra.fotos_aterramento_vala_fechada?.length) count += obra.fotos_aterramento_vala_fechada.length
    if (obra.fotos_aterramento_medicao?.length) count += obra.fotos_aterramento_medicao.length
    // Checklist de Fiscalização
    if (obra.fotos_checklist_croqui?.length) count += obra.fotos_checklist_croqui.length
    if (obra.fotos_checklist_panoramica_inicial?.length) count += obra.fotos_checklist_panoramica_inicial.length
    if (obra.fotos_checklist_chede?.length) count += obra.fotos_checklist_chede.length
    if (obra.fotos_checklist_aterramento_cerca?.length) count += obra.fotos_checklist_aterramento_cerca.length
    if (obra.fotos_checklist_padrao_geral?.length) count += obra.fotos_checklist_padrao_geral.length
    if (obra.fotos_checklist_padrao_interno?.length) count += obra.fotos_checklist_padrao_interno.length
    if (obra.fotos_checklist_frying?.length) count += obra.fotos_checklist_frying.length
    if (obra.fotos_checklist_abertura_fechamento_pulo?.length) count += obra.fotos_checklist_abertura_fechamento_pulo.length
    if (obra.fotos_checklist_panoramica_final?.length) count += obra.fotos_checklist_panoramica_final.length
    if (obra.fotos_checklist_postes?.length) count += obra.fotos_checklist_postes.length
    if (obra.fotos_checklist_seccionamentos?.length) count += obra.fotos_checklist_seccionamentos.length
    // Altimetria
    if (obra.fotos_altimetria_lado_fonte?.length) count += obra.fotos_altimetria_lado_fonte.length
    if (obra.fotos_altimetria_medicao_fonte?.length) count += obra.fotos_altimetria_medicao_fonte.length
    if (obra.fotos_altimetria_lado_carga?.length) count += obra.fotos_altimetria_lado_carga.length
    if (obra.fotos_altimetria_medicao_carga?.length) count += obra.fotos_altimetria_medicao_carga.length
    // Vazamento
    if (obra.fotos_vazamento_evidencia?.length) count += obra.fotos_vazamento_evidencia.length
    if (obra.fotos_vazamento_equipamentos_limpeza?.length) count += obra.fotos_vazamento_equipamentos_limpeza.length
    if (obra.fotos_vazamento_tombamento_retirado?.length) count += obra.fotos_vazamento_tombamento_retirado.length
    if (obra.fotos_vazamento_placa_retirado?.length) count += obra.fotos_vazamento_placa_retirado.length
    if (obra.fotos_vazamento_tombamento_instalado?.length) count += obra.fotos_vazamento_tombamento_instalado.length
    if (obra.fotos_vazamento_placa_instalado?.length) count += obra.fotos_vazamento_placa_instalado.length
    if (obra.fotos_vazamento_instalacao?.length) count += obra.fotos_vazamento_instalacao.length
    // Medidor
    if (obra.fotos_medidor_padrao?.length) count += obra.fotos_medidor_padrao.length
    if (obra.fotos_medidor_leitura?.length) count += obra.fotos_medidor_leitura.length
    if (obra.fotos_medidor_selo_born?.length) count += obra.fotos_medidor_selo_born.length
    if (obra.fotos_medidor_selo_caixa?.length) count += obra.fotos_medidor_selo_caixa.length
    if (obra.fotos_medidor_identificador_fase?.length) count += obra.fotos_medidor_identificador_fase.length
    // Transformador
    if (obra.fotos_transformador_laudo?.length) count += obra.fotos_transformador_laudo.length
    if (obra.fotos_transformador_componente_instalado?.length) count += obra.fotos_transformador_componente_instalado.length
    if (obra.fotos_transformador_tombamento_instalado?.length) count += obra.fotos_transformador_tombamento_instalado.length
    if (obra.fotos_transformador_tape?.length) count += obra.fotos_transformador_tape.length
    if (obra.fotos_transformador_placa_instalado?.length) count += obra.fotos_transformador_placa_instalado.length
    if (obra.fotos_transformador_instalado?.length) count += obra.fotos_transformador_instalado.length
    if (obra.fotos_transformador_antes_retirar?.length) count += obra.fotos_transformador_antes_retirar.length
    if (obra.fotos_transformador_tombamento_retirado?.length) count += obra.fotos_transformador_tombamento_retirado.length
    if (obra.fotos_transformador_placa_retirado?.length) count += obra.fotos_transformador_placa_retirado.length
    // Linha Viva / Cava em Rocha - postes_data
    if (Array.isArray(obra.postes_data)) {
      obra.postes_data.forEach((p: any) => {
        count += (p.fotos_antes?.length || 0) + (p.fotos_durante?.length || 0) + (p.fotos_depois?.length || 0) + (p.fotos_medicao?.length || 0)
      })
    }
    return count
  }

  // Função para converter IDs de fotos em objetos FotoInfo com URLs
  function convertPhotoIdsToFotoInfo(photoField: any): FotoInfo[] {
    if (!photoField) return []
    if (!Array.isArray(photoField)) return []
    if (photoField.length === 0) return []

    return photoField.map((item: any) => {
      // CASO 1: Já é objeto com URL (dados sincronizados corretamente)
      if (typeof item === 'object' && item !== null && item.url) {
        // Filtrar URLs locais (file:///)
        if (item.url.startsWith('file:///')) {
          return null
        }
        return {
          url: item.url,
          latitude: item.latitude || null,
          longitude: item.longitude || null,
          utmX: item.utmX ?? item.utm_x ?? null,
          utmY: item.utmY ?? item.utm_y ?? null,
          utmZone: item.utmZone ?? item.utm_zone ?? null,
          placaData: item.placaData || item.placa_data || null
        } as FotoInfo
      }

      // CASO 2: String que é uma URL direta (https://...)
      if (typeof item === 'string' && item.startsWith('http')) {
        return {
          url: item,
          latitude: null,
          longitude: null,
          utmX: null,
          utmY: null,
          utmZone: null,
          placaData: null
        } as FotoInfo
      }

      // CASO 3: String que é um photo ID - tentar reconstruir a URL do storage
      if (typeof item === 'string') {
        const photoId = item

        // Se começa com "temp_" ou "local_", não conseguimos reconstruir
        if (photoId.startsWith('temp_') || photoId.startsWith('local_')) {
          return null
        }

        // Tentar reconstruir a URL usando o padrão do Supabase Storage
        const storageUrl = `${supabase.storage.from('obra-photos').getPublicUrl(photoId).data.publicUrl}`

        return {
          url: storageUrl,
          latitude: null,
          longitude: null,
          utmX: null,
          utmY: null,
          utmZone: null,
          placaData: null
        } as FotoInfo
      }

      return null
    }).filter((item: FotoInfo | null): item is FotoInfo => item !== null)
  }

  function formatDateTime(date: Date) {
    const pad = (value: number) => String(value).padStart(2, '0')
    return `${pad(date.getDate())}/${pad(date.getMonth() + 1)}/${date.getFullYear()} ${pad(date.getHours())}:${pad(date.getMinutes())}`
  }

  function extractStoragePathFromPublicUrl(url: string): string | null {
    const marker = '/storage/v1/object/public/obra-photos/'
    const markerIndex = url.indexOf(marker)
    if (markerIndex < 0) return null
    const rawPath = url.slice(markerIndex + marker.length)
    if (!rawPath) return null
    try {
      return decodeURIComponent(rawPath)
    } catch {
      return rawPath
    }
  }

  async function uploadPhotoFileForReport(obraId: string, file: File, sectionKey: string) {
    const safeName = file.name.replace(/[^a-zA-Z0-9._-]/g, '_')
    const filePath = `${obraId}/${sectionKey}-${Date.now()}-${safeName}`
    const { error: uploadError } = await supabase.storage
      .from('obra-photos')
      .upload(filePath, file, { contentType: file.type, upsert: false })
    if (uploadError) throw uploadError
    const { data } = supabase.storage.from('obra-photos').getPublicUrl(filePath)
    return data.publicUrl
  }

  function updateObraPhotoSectionInState(obraId: string, sectionKey: keyof Obra, nextPhotos: FotoInfo[]) {
    setSelectedObraForBook(prev => {
      if (!prev || prev.id !== obraId) return prev
      return { ...prev, [sectionKey]: nextPhotos }
    })

    setObras(prev =>
      prev.map(obra => {
        if (obra.id !== obraId) return obra
        return { ...obra, [sectionKey]: nextPhotos }
      })
    )
  }

  async function handleAddPhotoToReport(sectionKey: keyof Obra, file: File) {
    if (!selectedObraForBook) return
    const actionKey = `${String(sectionKey)}:add`
    setPhotoActionKey(actionKey)
    try {
      const url = await uploadPhotoFileForReport(selectedObraForBook.id, file, String(sectionKey))
      const newPhoto: FotoInfo = {
        url,
        placaData: {
          obraNumero: selectedObraForBook.obra || '',
          tipoServico: selectedObraForBook.tipo_servico || '',
          equipe: selectedObraForBook.equipe || '',
          dataHora: formatDateTime(new Date()),
        },
      }

      const currentPhotos = convertPhotoIdsToFotoInfo((selectedObraForBook as any)[sectionKey])
      const nextPhotos = [...currentPhotos, newPhoto]
      const { error } = await supabase
        .from('obras')
        .update({ [sectionKey]: nextPhotos })
        .eq('id', selectedObraForBook.id)

      if (error) throw error
      updateObraPhotoSectionInState(selectedObraForBook.id, sectionKey, nextPhotos)
    } catch (error) {
      console.error('Erro ao adicionar foto no relatorio:', error)
      alert('Erro ao adicionar foto. Verifique permissões de storage e tente novamente.')
    } finally {
      setPhotoActionKey(null)
    }
  }

  async function handleDeletePhotoFromReport(sectionKey: keyof Obra, index: number, url: string) {
    if (!selectedObraForBook) return
    if (!window.confirm('Excluir esta foto?')) return

    const actionKey = `${String(sectionKey)}:delete:${index}`
    setPhotoActionKey(actionKey)
    try {
      const currentPhotos = convertPhotoIdsToFotoInfo((selectedObraForBook as any)[sectionKey])
      if (!currentPhotos[index]) return

      const nextPhotos = currentPhotos.filter((_, photoIndex) => photoIndex !== index)
      const { error } = await supabase
        .from('obras')
        .update({ [sectionKey]: nextPhotos })
        .eq('id', selectedObraForBook.id)

      if (error) throw error

      const storagePath = extractStoragePathFromPublicUrl(url)
      if (storagePath) {
        const { error: storageError } = await supabase.storage
          .from('obra-photos')
          .remove([storagePath])
        if (storageError) {
          console.warn('Nao foi possivel excluir do storage (registro removido da obra):', storageError.message)
        }
      }

      updateObraPhotoSectionInState(selectedObraForBook.id, sectionKey, nextPhotos)
    } catch (error) {
      console.error('Erro ao excluir foto no relatorio:', error)
      alert('Erro ao excluir foto.')
    } finally {
      setPhotoActionKey(null)
    }
  }

  function normalizeObraForPreview(obra: Obra): Obra {
    const obraComFotosConvertidas: Obra = { ...obra }
    for (const section of REPORT_PHOTO_SECTIONS) {
      ;(obraComFotosConvertidas as any)[section.key] = convertPhotoIdsToFotoInfo((obra as any)[section.key])
    }
    return obraComFotosConvertidas
  }

  async function fetchObraById(obraId: string): Promise<Obra | null> {
    const localItem = obras.find((item) => item.id === obraId)
    if (localItem) {
      return localItem as Obra
    }

    const { data, error } = await supabase
      .from('obras')
      .select('*')
      .eq('id', obraId)
      .maybeSingle()

    if (error) {
      console.error('Erro ao buscar obra por ID:', error)
      return null
    }
    return data || null
  }

  async function fetchServicosByObraId(obraId: string): Promise<ServicoReport[]> {
    const { data, error } = await supabase
      .from('servicos')
      .select('*')
      .eq('obra_id', obraId)
      .order('created_at', { ascending: true })

    if (error) {
      console.error('Erro ao buscar serviços da obra:', error)
      return []
    }

    return (data || []) as ServicoReport[]
  }

  async function handleOpenBook(obraId: string) {
    let obraAtual = await fetchObraById(obraId)
    if (!obraAtual) {
      obraAtual = obras.find(o => o.id === obraId) || null
    }
    if (!obraAtual) {
      alert('Obra não encontrada.')
      return
    }

    setSelectedObraForBook(normalizeObraForPreview(obraAtual as Obra) as ReportBook)

    const parentObraId = (obraAtual as ReportBook).source_table === 'servicos'
      ? (obraAtual as ReportBook).parent_obra_id || obraAtual.id.replace(/^servico:/, '')
      : obraAtual.id

    setServicosDaObra(await fetchServicosByObraId(parentObraId))
  }

  function handleCloseBook() {
    setSelectedObraForBook(null)
    setServicosDaObra([])
  }

  function handleOpenCreateBookModal(
    prefill?: Partial<{ equipe: string; obra: string; data: string; responsavel: string; tipo_servico: string }>
  ) {
    setCreateBookError('')
    setCreateForm({
      equipe: selectedTeam !== 'todas' ? selectedTeam : '',
      obra: '',
      data: format(new Date(), 'yyyy-MM-dd'),
      responsavel: '',
      tipo_servico: selectedService !== 'todos' ? selectedService : '',
      ...(prefill || {}),
    })
    setShowCreateBookModal(true)
  }

  async function handleCreateBook(e: React.FormEvent) {
    e.preventDefault()
    setSavingCreateBook(true)
    setCreateBookError('')

    try {
      if (!user?.id) {
        throw new Error('SessÃ£o invÃ¡lida. FaÃ§a login novamente para criar o book.')
      }

      const payload: any = {
        equipe: createForm.equipe.trim(),
        obra: createForm.obra.trim(),
        data: createForm.data,
        responsavel: createForm.responsavel.trim(),
        tipo_servico: createForm.tipo_servico.trim(),
        tem_atipicidade: false,
        atipicidades: [],
        user_id: user.id,
        creator_role: isAdmin ? 'admin' : 'equipe',
        created_by_admin: isAdmin ? (profile?.full_name || profile?.email || 'WEB-ADMIN') : null,
      }

      const { data, error } = await supabase
        .from('obras')
        .insert(payload)
        .select('*')
        .single()

      if (error) throw error
      if (!data) throw new Error('Registro criado, mas resposta vazia do banco.')

      setObras(prev => [{ ...(data as Obra), source_table: 'obras' as const }, ...prev])
      setShowCreateBookModal(false)
      setSelectedObraForBook({ ...(normalizeObraForPreview(data as Obra) as ReportBook), source_table: 'obras' })
    } catch (err: any) {
      setCreateBookError(err.message || 'Erro ao criar novo book')
    } finally {
      setSavingCreateBook(false)
    }
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

  async function handleExportByObraNumber(obra: Obra) {
    if (!obra.obra) {
      await handleExportSinglePDF(obra)
      return
    }
    setOpenMenuId(null)
    setExportingCombinedId(obra.id)
    try {
      // Buscar todas as obras com o mesmo número de obra no banco
      const { data, error } = await supabase
        .from('obras')
        .select('*')
        .eq('obra', obra.obra)
        .order('equipe', { ascending: true })
      if (error) throw error
      const obras = data as Obra[]
      if (obras.length <= 1) {
        // Só uma obra com esse número, baixar individual
        await generatePDF(obras[0] || obra)
      } else {
        await generateCombinedPDF(obras)
      }
    } catch (error) {
      console.error('Erro ao gerar PDF combinado:', error)
      alert('Erro ao gerar PDF combinado')
    } finally {
      setExportingCombinedId(null)
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

  async function exportAllToPdf() {
    if (selectedObras.size === 0) {
      alert('Selecione pelo menos uma obra para exportar')
      return
    }

    setExportingAllPdf(true)
    try {
      // Ordenar por número de obra, depois por equipe para consistência no PDF
      const obrasToExport = filteredObras
        .filter(o => selectedObras.has(o.id))
        .sort((a, b) => (a.obra || '').localeCompare(b.obra || '') || (a.equipe || '').localeCompare(b.equipe || ''))

      // Gerar sempre 1 único PDF com todos os books selecionados
      if (obrasToExport.length === 1) {
        await generatePDF(obrasToExport[0])
      } else {
        await generateCombinedPDF(obrasToExport)
      }
    } catch (error) {
      console.error('Erro ao exportar PDFs:', error)
      alert('Erro ao exportar PDFs')
    } finally {
      setExportingAllPdf(false)
    }
  }

  async function handleDeleteObra(obra: Obra) {
    const isServico = (obra as ReportBook).source_table === 'servicos'
    const label = isServico ? 'serviço' : 'obra'
    const confirmMessage = `Tem certeza que deseja EXCLUIR ${isServico ? 'o serviço' : 'a obra'} "${obra.obra || 'sem número'}"?\n\nEsta ação é IRREVERSÍVEL.\n\nDigite "EXCLUIR" para confirmar:`

    const confirmation = window.prompt(confirmMessage)

    if (confirmation !== 'EXCLUIR') {
      if (confirmation !== null) {
        alert('Exclusão cancelada. Digite exatamente "EXCLUIR" para confirmar.')
      }
      return
    }

    setDeletingId(obra.id)
    setOpenMenuId(null)

    try {
      if (isServico) {
        const realId = (obra as ReportBook).service_id || obra.id.replace(/^servico:/, '')
        const { error } = await supabase.from('servicos').delete().eq('id', realId)
        if (error) throw error
      } else {
        const response = await fetch(`/api/obras/${obra.id}`, { method: 'DELETE' })
        const result = await response.json()
        if (!result.success) throw new Error(result.error || `Erro ao excluir ${label}`)
      }

      setObras(prev => prev.filter(o => o.id !== obra.id))
      setSelectedObras(prev => {
        const newSet = new Set(prev)
        newSet.delete(obra.id)
        return newSet
      })

      alert(`${isServico ? 'Serviço' : 'Obra'} "${obra.obra || 'sem número'}" excluído com sucesso!`)
    } catch (error: any) {
      console.error(`Erro ao excluir ${label}:`, error)
      alert(`Erro ao excluir ${label}: ${error.message}`)
    } finally {
      setDeletingId(null)
    }
  }

  async function handleDeleteSelectedObras() {
    if (selectedObras.size === 0) {
      alert('Selecione ao menos uma obra para excluir.')
      return
    }

    const obrasSelecionadas = obras.filter((obra) => selectedObras.has(obra.id))
    const resumoObras = obrasSelecionadas
      .slice(0, 5)
      .map((obra) => obra.obra || obra.id.slice(0, 8))
      .join(', ')
    const sufixoResumo = obrasSelecionadas.length > 5 ? ` e mais ${obrasSelecionadas.length - 5}` : ''
    const confirmMessage = `Tem certeza que deseja EXCLUIR ${obrasSelecionadas.length} obra(s)?\n\nObras selecionadas: ${resumoObras}${sufixoResumo}\n\nEsta ação é IRREVERSÍVEL e irá:\n- Deletar as obras do banco de dados\n- Deletar todas as fotos associadas\n\nDigite "EXCLUIR" para confirmar:`

    const confirmation = window.prompt(confirmMessage)

    if (confirmation !== 'EXCLUIR') {
      if (confirmation !== null) {
        alert('Exclusão cancelada. Digite exatamente "EXCLUIR" para confirmar.')
      }
      return
    }

    setDeletingBulk(true)
    setOpenMenuId(null)
    setMenuPosition(null)

    try {
      const response = await fetch('/api/obras/bulk-delete', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ obraIds: obrasSelecionadas.map((obra) => obra.id) }),
      })

      const result = await response.json()

      if (!response.ok) {
        throw new Error(result.error || 'Erro ao excluir obras selecionadas')
      }

      const deletedIds: string[] = Array.isArray(result.deletedIds) ? result.deletedIds : []
      if (deletedIds.length > 0) {
        setObras((prev) => prev.filter((obra) => !deletedIds.includes(obra.id)))
        setSelectedObras((prev) => {
          const next = new Set(prev)
          deletedIds.forEach((id) => next.delete(id))
          return next
        })
      }

      if (result.failed?.length) {
        const failures = result.failed
          .slice(0, 5)
          .map((item: { id: string; error: string }) => `${item.id.slice(0, 8)}: ${item.error}`)
          .join('\n')

        alert(
          `${deletedIds.length} obra(s) excluída(s) com sucesso.\n${result.failed.length} falha(s) ocorreram.\n${result.photosDeleted || 0} foto(s) removidas.\n\nFalhas:\n${failures}`
        )
        return
      }

      alert(
        `${deletedIds.length} obra(s) excluída(s) com sucesso!\n${result.photosDeleted || 0} foto(s) removidas.`
      )
    } catch (error: any) {
      console.error('Erro ao excluir obras em lote:', error)
      alert(`Erro ao excluir obras selecionadas: ${error.message}`)
    } finally {
      setDeletingBulk(false)
    }
  }

  function openEditModal(obra: Obra) {
    setEditError('')
    // Normaliza a data para YYYY-MM-DD (campo type="date")
    let dataFormatada = ''
    if (obra.data) {
      try {
        const d = new Date(obra.data)
        if (!isNaN(d.getTime())) {
          dataFormatada = d.toISOString().slice(0, 10)
        } else {
          dataFormatada = obra.data.slice(0, 10)
        }
      } catch {
        dataFormatada = obra.data.slice(0, 10)
      }
    }
    setEditForm({
      equipe: obra.equipe || '',
      obra: obra.obra || '',
      data: dataFormatada,
      responsavel: obra.responsavel || '',
      tipo_servico: obra.tipo_servico || '',
    })
    setEditingObra(obra)
  }

  async function handleOpenEdit(obraId: string) {
    setOpenMenuId(null)
    setMenuPosition(null)
    setEditError('')

    let obraAtual = await fetchObraById(obraId)
    if (!obraAtual) {
      obraAtual = obras.find(o => o.id === obraId) || null
    }
    if (!obraAtual) {
      setEditError('Obra não encontrada para edição.')
      return
    }

    openEditModal(obraAtual)
  }

  async function handleSaveEdit(e: React.FormEvent) {
    e.preventDefault()
    if (!editingObra) return
    setSavingEdit(true)
    setEditError('')
    try {
      const isServico = (editingObra as ReportBook).source_table === 'servicos'
      const realId = isServico
        ? ((editingObra as ReportBook).service_id || editingObra.id.replace(/^servico:/, ''))
        : editingObra.id

      if (isServico) {
        const { error } = await supabase
          .from('servicos')
          .update({
            responsavel: editForm.responsavel.trim(),
            tipo_servico: editForm.tipo_servico.trim(),
          })
          .eq('id', realId)
        if (error) throw error
      } else {
        const { error } = await supabase
          .from('obras')
          .update({
            equipe: editForm.equipe.trim(),
            obra: editForm.obra.trim(),
            data: editForm.data,
            responsavel: editForm.responsavel.trim(),
            tipo_servico: editForm.tipo_servico.trim(),
          })
          .eq('id', realId)
        if (error) throw error
      }
      setObras(prev => prev.map(o =>
        o.id === editingObra.id
          ? {
              ...o,
              equipe: editForm.equipe.trim(),
              obra: editForm.obra.trim(),
              data: editForm.data,
              responsavel: editForm.responsavel.trim(),
              tipo_servico: editForm.tipo_servico.trim(),
            }
          : o
      ))
      setSelectedObraForBook(prev => (
        prev && prev.id === editingObra.id
          ? {
              ...prev,
              equipe: editForm.equipe.trim(),
              obra: editForm.obra.trim(),
              data: editForm.data,
              responsavel: editForm.responsavel.trim(),
              tipo_servico: editForm.tipo_servico.trim(),
            }
          : prev
      ))
      setEditingObra(null)
    } catch (err: any) {
      setEditError(err.message || 'Erro ao salvar alterações')
    } finally {
      setSavingEdit(false)
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
      <AppShell>
          {/* Header */}
          <div className="mb-8">
            <h1 className="text-3xl lg:text-4xl font-semibold text-slate-900 tracking-tight mb-2">Relatórios</h1>
            <p className="text-sm sm:text-base text-slate-600">
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

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
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
          <div className="flex flex-wrap justify-end gap-3 mb-6">
            <button
              onClick={() => handleOpenCreateBookModal()}
              className="px-6 py-3.5 bg-gradient-to-r from-blue-600 to-blue-700 hover:from-blue-700 hover:to-blue-800 text-white rounded-2xl shadow-lg hover:shadow-xl transition-all flex items-center gap-3 font-bold text-lg"
            >
              <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
              </svg>
              Novo Book
            </button>
            {isAdmin && (
              <button
                onClick={handleDeleteSelectedObras}
                disabled={selectedObras.size === 0 || deletingBulk}
                className="px-6 py-3.5 bg-gradient-to-r from-rose-600 to-red-700 hover:from-rose-700 hover:to-red-800 text-white rounded-2xl shadow-lg hover:shadow-xl transition-all flex items-center gap-3 font-bold text-lg disabled:opacity-50 disabled:cursor-not-allowed"
              >
                <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                </svg>
                {deletingBulk ? 'Excluindo Selecionadas...' : `Excluir Selecionadas (${selectedObras.size})`}
              </button>
            )}
            <button
              onClick={exportAllToPdf}
              disabled={selectedObras.size === 0 || exportingAllPdf}
              className="px-6 py-3.5 bg-gradient-to-r from-red-600 to-red-700 hover:from-red-700 hover:to-red-800 text-white rounded-2xl shadow-lg hover:shadow-xl transition-all flex items-center gap-3 font-bold text-lg disabled:opacity-50 disabled:cursor-not-allowed"
            >
              <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 21h10a2 2 0 002-2V9.414a1 1 0 00-.293-.707l-5.414-5.414A1 1 0 0012.586 3H7a2 2 0 00-2 2v14a2 2 0 002 2z" />
              </svg>
              {exportingAllPdf ? `Exportando PDFs...` : 'Exportar Tudo (PDF)'}
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
                        checked={selectedObras.size === getSelectableRows(filteredObras).length && getSelectableRows(filteredObras).length > 0}
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
                  {(() => {
                    const obrasOnly = filteredObras.filter(o => !isServiceRow(o))
                    const servicosOnly = filteredObras.filter(o => isServiceRow(o))

                    // Map parent_obra_id → list of child servicos
                    const servicosByParentId = new Map<string, ReportBook[]>()
                    servicosOnly.forEach(s => {
                      const pid = s.parent_obra_id
                      if (pid) {
                        if (!servicosByParentId.has(pid)) servicosByParentId.set(pid, [])
                        servicosByParentId.get(pid)!.push(s)
                      }
                    })

                    // Orphan services (parent obra filtered out)
                    const parentIds = new Set(obrasOnly.map(o => o.id))
                    const orphanServicos = servicosOnly.filter(s => !s.parent_obra_id || !parentIds.has(s.parent_obra_id))

                    const renderStatusBadge = (o: ReportBook) => {
                      if (isServiceRow(o)) {
                        const cls = o.service_status === 'completo' ? 'bg-emerald-100 text-emerald-700' : o.service_status === 'em_progresso' ? 'bg-blue-100 text-blue-700' : 'bg-amber-100 text-amber-700'
                        const lbl = o.service_status === 'completo' ? 'Concluído' : o.service_status === 'em_progresso' ? 'Em progresso' : 'Rascunho'
                        return <span className={`inline-flex items-center gap-1 px-3 py-1 rounded-full text-xs font-bold ${cls}`}>{lbl}</span>
                      }
                      return getObraStatus(o) === 'concluida'
                        ? <span className="inline-flex items-center gap-1 px-3 py-1 bg-green-100 text-green-700 rounded-full text-xs font-bold">Concluída</span>
                        : <span className="inline-flex items-center gap-1 px-3 py-1 bg-yellow-100 text-yellow-700 rounded-full text-xs font-bold">Parcial</span>
                    }

                    const renderDateCell = (dateStr: string) => (
                      <td className="px-6 py-4">
                        <span className="text-sm text-slate-600">{format(new Date(dateStr), "dd/MM/yyyy", { locale: ptBR })}</span>
                        <br />
                        <span className="text-xs text-slate-500">{format(new Date(dateStr), "HH:mm", { locale: ptBR })}</span>
                      </td>
                    )

                    const renderServicoRow = (servico: ReportBook) => (
                      <tr
                        key={servico.id}
                        onDoubleClick={() => { void handleOpenBook(servico.id) }}
                        className={`hover:bg-slate-50 transition-colors cursor-pointer ${selectedObras.has(servico.id) ? 'bg-blue-50' : ''}`}
                      >
                        <td className="px-6 py-4 text-center" onClick={(e) => e.stopPropagation()}>
                          <div className="flex items-center justify-center gap-1.5">
                            <input
                              type="checkbox"
                              checked={selectedObras.has(servico.id)}
                              onChange={() => toggleSelectObra(servico.id)}
                              className="w-5 h-5 text-blue-600 rounded focus:ring-2 focus:ring-blue-500"
                            />
                          </div>
                        </td>
                        <td className="px-6 py-4">
                          <span className="text-sm font-bold text-slate-900">{servico.obra || '-'}</span>
                        </td>
                        <td className="px-6 py-4"><span className="text-sm text-slate-900">{servico.equipe}</span></td>
                        <td className="px-6 py-4">
                          <span className="inline-flex items-center px-3 py-1 bg-blue-100 text-blue-700 rounded-full text-xs font-semibold">{servico.tipo_servico}</span>
                        </td>
                        <td className="px-6 py-4 text-center">{renderStatusBadge(servico)}</td>
                        <td className="px-6 py-4 text-center">
                          <span className="inline-flex items-center gap-1 px-3 py-1 bg-slate-100 text-slate-700 rounded-full text-sm font-semibold">
                            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" /></svg>
                            {getTotalPhotosCount(servico)}
                          </span>
                        </td>
                        {renderDateCell(servico.created_at)}
                        <td className="px-6 py-4 text-center" onClick={(e) => e.stopPropagation()}>
                          <button
                            onClick={(e) => {
                              if (openMenuId === servico.id) { setOpenMenuId(null); setMenuPosition(null); return }
                              const btn = e.currentTarget as HTMLElement
                              const rect = btn.getBoundingClientRect()
                              const menuHeight = 280
                              const spaceBelow = window.innerHeight - rect.bottom
                              const top = spaceBelow < menuHeight ? rect.top - menuHeight - 4 : rect.bottom + 4
                              const left = Math.min(rect.right - 224, window.innerWidth - 236)
                              setMenuPosition({ top, left })
                              setOpenMenuId(servico.id)
                            }}
                            className={`p-2 rounded-lg transition-all duration-150 ${openMenuId === servico.id ? 'bg-slate-200 text-slate-900' : 'text-slate-400 hover:bg-slate-100 hover:text-slate-700'}`}
                            title="Opções"
                          >
                            <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 24 24"><circle cx="12" cy="5" r="1.5" /><circle cx="12" cy="12" r="1.5" /><circle cx="12" cy="19" r="1.5" /></svg>
                          </button>
                        </td>
                      </tr>
                    )

                    const rows: React.ReactNode[] = []

                    obrasOnly.forEach(obra => {
                      const childServicos = servicosByParentId.get(obra.id) || []

                      // ── Obra (parent) row ──
                      rows.push(
                        <tr
                          key={obra.id}
                          onDoubleClick={() => { void handleOpenBook(obra.id) }}
                          className={`hover:bg-slate-50 transition-colors cursor-pointer ${selectedObras.has(obra.id) ? 'bg-blue-50' : ''}`}
                        >
                          <td className="px-6 py-4 text-center" onClick={(e) => e.stopPropagation()}>
                            <div className="flex items-center justify-center gap-1.5">
                              <input
                                type="checkbox"
                                checked={selectedObras.has(obra.id)}
                                onChange={() => toggleSelectObra(obra.id)}
                                className="w-5 h-5 text-blue-600 rounded focus:ring-2 focus:ring-blue-500"
                              />
                            </div>
                          </td>
                          <td className="px-6 py-4">
                            <span className="text-sm font-bold text-slate-900">{obra.obra || '-'}</span>
                          </td>
                          <td className="px-6 py-4"><span className="text-sm text-slate-900">{obra.equipe}</span></td>
                          <td className="px-6 py-4">
                            <span className="inline-flex items-center px-3 py-1 bg-blue-100 text-blue-700 rounded-full text-xs font-semibold">{obra.tipo_servico}</span>
                          </td>
                          <td className="px-6 py-4 text-center">{renderStatusBadge(obra)}</td>
                          <td className="px-6 py-4 text-center">
                            <span className="inline-flex items-center gap-1 px-3 py-1 bg-slate-100 text-slate-700 rounded-full text-sm font-semibold">
                              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" /></svg>
                              {getTotalPhotosCount(obra)}
                            </span>
                          </td>
                          {renderDateCell(obra.created_at)}
                          <td className="px-6 py-4 text-center" onClick={(e) => e.stopPropagation()}>
                            <button
                              onClick={(e) => {
                                if (openMenuId === obra.id) { setOpenMenuId(null); setMenuPosition(null); return }
                                const btn = e.currentTarget as HTMLElement
                                const rect = btn.getBoundingClientRect()
                                const menuHeight = 280
                                const spaceBelow = window.innerHeight - rect.bottom
                                const top = spaceBelow < menuHeight ? rect.top - menuHeight - 4 : rect.bottom + 4
                                const left = Math.min(rect.right - 224, window.innerWidth - 236)
                                setMenuPosition({ top, left })
                                setOpenMenuId(obra.id)
                              }}
                              className={`p-2 rounded-lg transition-all duration-150 ${openMenuId === obra.id ? 'bg-slate-200 text-slate-900' : 'text-slate-400 hover:bg-slate-100 hover:text-slate-700'}`}
                              title="Opções"
                            >
                              <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 24 24"><circle cx="12" cy="5" r="1.5" /><circle cx="12" cy="12" r="1.5" /><circle cx="12" cy="19" r="1.5" /></svg>
                            </button>
                          </td>
                        </tr>
                      )

                      // ── Child servico rows (always visible, flat rows) ──
                      childServicos.forEach(servico => {
                        rows.push(renderServicoRow(servico))
                      })
                    })

                    // ── Orphan services (parent filtered out) ──
                    orphanServicos.forEach(servico => {
                      rows.push(renderServicoRow(servico))
                    })

                    return rows
                  })()}
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

        {/* Modal Editar Dados da Obra */}
        {editingObra && (
          <div
            className="modal-overlay"
            onClick={(e) => { if (e.target === e.currentTarget && !savingEdit) setEditingObra(null) }}
          >
            <div className="modal-box max-w-md animate-slideUp">
              <div className="modal-header">
                <div className="flex items-center gap-3">
                  <div className="w-9 h-9 bg-gradient-to-br from-amber-500 to-amber-600 rounded-xl flex items-center justify-center shadow-sm shadow-amber-500/30">
                    <svg className="w-4 h-4 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-6 9l2 2 4-4" />
                    </svg>
                  </div>
                  <div>
                    <h2 className="modal-title">Editar Dados da Obra</h2>
                    <p className="text-xs text-slate-400 mt-0.5">ID: {editingObra.id.slice(0, 8)}…</p>
                  </div>
                </div>
                <button
                  onClick={() => setEditingObra(null)}
                  disabled={savingEdit}
                  className="p-1.5 text-slate-400 hover:text-slate-600 hover:bg-slate-100 rounded-lg transition-colors"
                >
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </button>
              </div>

              <form onSubmit={handleSaveEdit}>
                <div className="modal-body space-y-4">
                  {editError && (
                    <div className="alert-error">{editError}</div>
                  )}

                  <div>
                    <label className="block text-xs font-semibold text-slate-400 uppercase tracking-wider mb-1.5">
                      Equipe
                    </label>
                    <select
                      value={editForm.equipe}
                      onChange={(e) => setEditForm(f => ({ ...f, equipe: e.target.value }))}
                      className="input-field"
                      required
                    >
                      <option value="">Selecione a equipe...</option>
                      {equipesDB.map((team) => (
                        <option key={team} value={team}>{team}</option>
                      ))}
                      {editForm.equipe && !equipesDB.includes(editForm.equipe) && (
                        <option value={editForm.equipe}>{editForm.equipe}</option>
                      )}
                    </select>
                  </div>

                  <div>
                    <label className="block text-xs font-semibold text-slate-400 uppercase tracking-wider mb-1.5">
                      Número da Obra
                    </label>
                    <input
                      type="text"
                      value={editForm.obra}
                      onChange={(e) => setEditForm(f => ({ ...f, obra: e.target.value }))}
                      className="input-field"
                      placeholder="Ex: 12345678"
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-semibold text-slate-400 uppercase tracking-wider mb-1.5">
                      Tipo de Serviço / Book
                    </label>
                    <select
                      value={editForm.tipo_servico}
                      onChange={(e) => setEditForm(f => ({ ...f, tipo_servico: e.target.value }))}
                      className="input-field"
                      required
                    >
                      <option value="">Selecione o tipo de serviço...</option>
                      {tiposServicoDB.map((tipo) => (
                        <option key={tipo} value={tipo}>{tipo}</option>
                      ))}
                      {editForm.tipo_servico && !tiposServicoDB.includes(editForm.tipo_servico) && (
                        <option value={editForm.tipo_servico}>{editForm.tipo_servico}</option>
                      )}
                    </select>
                  </div>

                  <div>
                    <label className="block text-xs font-semibold text-slate-400 uppercase tracking-wider mb-1.5">
                      Data da Obra
                    </label>
                    <input
                      type="date"
                      value={editForm.data}
                      onChange={(e) => setEditForm(f => ({ ...f, data: e.target.value }))}
                      className="input-field"
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-semibold text-slate-400 uppercase tracking-wider mb-1.5">
                      Responsável
                    </label>
                    <input
                      type="text"
                      value={editForm.responsavel}
                      onChange={(e) => setEditForm(f => ({ ...f, responsavel: e.target.value }))}
                      className="input-field"
                      placeholder="Nome do responsável"
                      required
                    />
                  </div>
                </div>

                <div className="modal-footer justify-end">
                  <button
                    type="button"
                    onClick={() => setEditingObra(null)}
                    disabled={savingEdit}
                    className="btn-ghost"
                  >
                    Cancelar
                  </button>
                  <button
                    type="submit"
                    disabled={savingEdit}
                    className="btn-primary"
                  >
                    {savingEdit ? (
                      <><span className="spinner-sm" />Salvando...</>
                    ) : (
                      <>
                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                        </svg>
                        Salvar Alterações
                      </>
                    )}
                  </button>
                </div>
              </form>
            </div>
          </div>
        )}

        {/* Modal Criar Novo Book */}
        {showCreateBookModal && (
          <div
            className="modal-overlay"
            onClick={(e) => { if (e.target === e.currentTarget && !savingCreateBook) setShowCreateBookModal(false) }}
          >
            <div className="modal-box max-w-md animate-slideUp">
              <div className="modal-header">
                <div className="flex items-center gap-3">
                  <div className="w-9 h-9 bg-gradient-to-br from-blue-600 to-blue-700 rounded-xl flex items-center justify-center shadow-sm shadow-blue-500/30">
                    <svg className="w-4 h-4 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
                    </svg>
                  </div>
                  <div>
                    <h2 className="modal-title">Criar Novo Book</h2>
                    <p className="text-xs text-slate-400 mt-0.5">Você pode ter vários books no mesmo nº de obra.</p>
                  </div>
                </div>
                <button
                  onClick={() => setShowCreateBookModal(false)}
                  disabled={savingCreateBook}
                  className="p-1.5 text-slate-400 hover:text-slate-600 hover:bg-slate-100 rounded-lg transition-colors"
                >
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </button>
              </div>

              <form onSubmit={handleCreateBook}>
                <div className="modal-body space-y-4">
                  {createBookError && (
                    <div className="alert-error">{createBookError}</div>
                  )}

                  <div>
                    <label className="block text-xs font-semibold text-slate-400 uppercase tracking-wider mb-1.5">
                      Número da Obra
                    </label>
                    <input
                      type="text"
                      value={createForm.obra}
                      onChange={(e) => setCreateForm(f => ({ ...f, obra: e.target.value }))}
                      className="input-field"
                      placeholder="Ex: 0032502210"
                      required
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-semibold text-slate-400 uppercase tracking-wider mb-1.5">
                      Equipe
                    </label>
                    <select
                      value={createForm.equipe}
                      onChange={(e) => setCreateForm(f => ({ ...f, equipe: e.target.value }))}
                      className="input-field"
                      required
                    >
                      <option value="">Selecione a equipe...</option>
                      {equipesDB.map((team) => (
                        <option key={team} value={team}>{team}</option>
                      ))}
                    </select>
                  </div>

                  <div>
                    <label className="block text-xs font-semibold text-slate-400 uppercase tracking-wider mb-1.5">
                      Tipo de Serviço / Book
                    </label>
                    <select
                      value={createForm.tipo_servico}
                      onChange={(e) => setCreateForm(f => ({ ...f, tipo_servico: e.target.value }))}
                      className="input-field"
                      required
                    >
                      <option value="">Selecione o tipo de serviço...</option>
                      {tiposServicoDB.map((tipo) => (
                        <option key={tipo} value={tipo}>{tipo}</option>
                      ))}
                    </select>
                  </div>

                  <div>
                    <label className="block text-xs font-semibold text-slate-400 uppercase tracking-wider mb-1.5">
                      Data da Obra
                    </label>
                    <input
                      type="date"
                      value={createForm.data}
                      onChange={(e) => setCreateForm(f => ({ ...f, data: e.target.value }))}
                      className="input-field"
                      required
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-semibold text-slate-400 uppercase tracking-wider mb-1.5">
                      Responsável
                    </label>
                    <input
                      type="text"
                      value={createForm.responsavel}
                      onChange={(e) => setCreateForm(f => ({ ...f, responsavel: e.target.value }))}
                      className="input-field"
                      placeholder="Nome do responsável"
                      required
                    />
                  </div>
                </div>

                <div className="modal-footer justify-end">
                  <button
                    type="button"
                    onClick={() => setShowCreateBookModal(false)}
                    disabled={savingCreateBook}
                    className="btn-ghost"
                  >
                    Cancelar
                  </button>
                  <button type="submit" disabled={savingCreateBook} className="btn-primary">
                    {savingCreateBook ? (
                      <><span className="spinner-sm" />Criando...</>
                    ) : (
                      <>
                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
                        </svg>
                        Criar Book
                      </>
                    )}
                  </button>
                </div>
              </form>
            </div>
          </div>
        )}

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

                {servicosDaObra.length > 0 && selectedObraForBook?.source_table !== 'servicos' && (
                  <div className="bg-white rounded-2xl shadow-lg border border-slate-200 overflow-hidden mb-8">
                    <div className="bg-gradient-to-r from-slate-50 to-slate-100 px-6 py-4 border-b border-slate-200">
                      <h3 className="text-xl font-bold text-slate-900 flex items-center gap-2">
                        <svg className="w-5 h-5 text-primary" fill="currentColor" viewBox="0 0 20 20">
                          <path d="M4 4a2 2 0 012-2h8a2 2 0 012 2v1h1.5A1.5 1.5 0 0119 6.5v10A1.5 1.5 0 0117.5 18H2.5A1.5 1.5 0 011 16.5v-10A1.5 1.5 0 012.5 5H4V4zm10 1V4H6v1h8z" />
                        </svg>
                        Serviços vinculados
                      </h3>
                    </div>
                    <div className="p-6 grid grid-cols-1 lg:grid-cols-2 gap-4">
                      {servicosDaObra.map((servico) => {
                        const sections = getSectionsForBook(servico.tipo_servico)
                        const totalFotosServico = sections.reduce(
                          (acc, section) => acc + convertPhotoIdsToFotoInfo((servico as any)[section.key]).length,
                          0
                        )
                        const statusLabel = servico.status === 'completo'
                          ? 'Concluído'
                          : servico.status === 'em_progresso'
                            ? 'Em progresso'
                            : 'Rascunho'
                        const statusClass = servico.status === 'completo'
                          ? 'bg-green-100 text-green-700'
                          : servico.status === 'em_progresso'
                            ? 'bg-blue-100 text-blue-700'
                            : 'bg-amber-100 text-amber-700'

                        return (
                          <div key={servico.id} className="rounded-2xl border border-slate-200 bg-slate-50 overflow-hidden">
                            <div className="flex items-start justify-between gap-3 px-4 py-3 border-b border-slate-200 bg-white">
                              <div>
                                <p className="text-sm font-bold text-slate-900">{servico.tipo_servico}</p>
                                <p className="text-xs text-slate-500 mt-0.5">
                                  {servico.responsavel || 'Sem responsável'}
                                </p>
                              </div>
                              <div className="flex flex-col items-end gap-2">
                                <span className={`text-xs font-semibold px-2.5 py-1 rounded-full ${statusClass}`}>
                                  {statusLabel}
                                </span>
                                <span className="text-[11px] text-slate-500">
                                  {servico.sync_status === 'synced' ? 'Sincronizado' : servico.sync_status || 'offline'}
                                </span>
                              </div>
                            </div>
                            <div className="px-4 py-3 text-sm text-slate-700">
                              <div className="flex items-center justify-between gap-4">
                                <span>{sections.length} seção(ões)</span>
                                <span className="font-semibold text-slate-900">{totalFotosServico} foto(s)</span>
                              </div>
                              {servico.error_message ? (
                                <p className="mt-2 text-xs text-red-600">{servico.error_message}</p>
                              ) : null}
                            </div>
                          </div>
                        )
                      })}
                    </div>
                  </div>
                )}

                {/* Galerias de Fotos - Dinâmico por tipo de serviço */}
                {/* Resumo de seções */}
                {(() => {
                  const bookSections = getSectionsForBook(selectedObraForBook.tipo_servico)
                  const postesLVData: any[] = (selectedObraForBook as any).postes_data
                  const hasPostesLV = Array.isArray(postesLVData) && postesLVData.length > 0
                  const totalFotosPostesLV = hasPostesLV
                    ? postesLVData.reduce((acc: number, p: any) => acc + (p.fotos_antes?.length || 0) + (p.fotos_durante?.length || 0) + (p.fotos_depois?.length || 0) + (p.fotos_medicao?.length || 0), 0)
                    : 0
                  const withPhotos = hasPostesLV
                    ? (totalFotosPostesLV > 0 ? 1 : 0)
                    : bookSections.filter(s => convertPhotoIdsToFotoInfo((selectedObraForBook as any)[s.key]).length > 0).length
                  const totalFotosBook = hasPostesLV
                    ? totalFotosPostesLV
                    : bookSections.reduce((acc, s) => acc + convertPhotoIdsToFotoInfo((selectedObraForBook as any)[s.key]).length, 0)
                  return (
                    <div className="flex items-center gap-4 mb-6 p-4 bg-slate-50 rounded-2xl border border-slate-200">
                      <div className="flex items-center gap-2 text-sm">
                        <span className="w-2.5 h-2.5 rounded-full bg-primary inline-block"></span>
                        <span className="font-semibold text-slate-700">{bookSections.length} seções</span>
                      </div>
                      <div className="w-px h-4 bg-slate-300"></div>
                      <div className="flex items-center gap-2 text-sm">
                        <span className="w-2.5 h-2.5 rounded-full bg-green-500 inline-block"></span>
                        <span className="font-semibold text-slate-700">{withPhotos} com fotos</span>
                      </div>
                      <div className="w-px h-4 bg-slate-300"></div>
                      <div className="flex items-center gap-2 text-sm">
                        <svg className="w-4 h-4 text-slate-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
                        </svg>
                        <span className="font-semibold text-slate-700">{totalFotosBook} fotos no total</span>
                      </div>
                    </div>
                  )
                })()}

                <div className="space-y-6">
                  {(() => {
                    const colorMap: Record<string, string> = {
                      blue: 'bg-blue-600', orange: 'bg-orange-600', green: 'bg-green-600', cyan: 'bg-cyan-600', teal: 'bg-teal-600', red: 'bg-red-600', amber: 'bg-amber-600', purple: 'bg-purple-600', indigo: 'bg-indigo-600', emerald: 'bg-emerald-600', sky: 'bg-sky-600', rose: 'bg-rose-600',
                    };
                    const lightColorMap: Record<string, string> = {
                      blue: 'from-blue-300', orange: 'from-orange-300', green: 'from-green-300', cyan: 'from-cyan-300', teal: 'from-teal-300', red: 'from-red-300', amber: 'from-amber-300', purple: 'from-purple-300', indigo: 'from-indigo-300', emerald: 'from-emerald-300', sky: 'from-sky-300', rose: 'from-rose-300',
                    };
                    const borderColorMap: Record<string, string> = {
                      blue: 'border-blue-200', orange: 'border-orange-200', green: 'border-green-200', cyan: 'border-cyan-200', teal: 'border-teal-200', red: 'border-red-200', amber: 'border-amber-200', purple: 'border-purple-200', indigo: 'border-indigo-200', emerald: 'border-emerald-200', sky: 'border-sky-200', rose: 'border-rose-200',
                    };
                    const bgLightMap: Record<string, string> = {
                      blue: 'bg-blue-50', orange: 'bg-orange-50', green: 'bg-green-50', cyan: 'bg-cyan-50', teal: 'bg-teal-50', red: 'bg-red-50', amber: 'bg-amber-50', purple: 'bg-purple-50', indigo: 'bg-indigo-50', emerald: 'bg-emerald-50', sky: 'bg-sky-50', rose: 'bg-rose-50',
                    };

                    const getPhotoUrlFromRef = (photoRef: any): string | null => {
                      const value = typeof photoRef === 'string'
                        ? photoRef
                        : (photoRef?.url || photoRef?.id || '')
                      if (!value || typeof value !== 'string') return null
                      if (value.startsWith('temp_') || value.startsWith('local_') || value.startsWith('file:///')) return null
                      if (value.startsWith('http')) return value
                      return supabase.storage.from('obra-photos').getPublicUrl(value).data.publicUrl
                    }

                    const getChecklistLinearType = (item: any): 'seccionamento' | 'emenda' | 'poda' => {
                      const tipo = item?.tipo
                      if (tipo === 'emenda' || tipo === 'poda' || tipo === 'seccionamento') return tipo
                      return 'seccionamento'
                    }

                    const getTrechoEntrePostes = (item: any): string | null => {
                      const inicio = item?.posteInicio ?? item?.poste_inicio ?? null
                      const fim = item?.posteFim ?? item?.poste_fim ?? null
                      if (!inicio && !fim) return null
                      return `P${inicio ?? '?'} - P${fim ?? '?'}`
                    }

                    const parseNumericOrder = (value: unknown): number | null => {
                      const parsed = typeof value === 'number'
                        ? value
                        : parseInt(String(value ?? '').trim(), 10)
                      return Number.isFinite(parsed) ? parsed : null
                    }

                    function sortByNumero<T extends { numero?: unknown; isAditivo?: boolean }>(items: T[] | undefined): T[] {
                      if (!Array.isArray(items) || items.length === 0) return []

                      return items
                        .map((item, index) => ({ item, index }))
                        .sort((a, b) => {
                          const numeroA = parseNumericOrder(a.item?.numero)
                          const numeroB = parseNumericOrder(b.item?.numero)

                          if (numeroA !== null && numeroB !== null && numeroA !== numeroB) {
                            return numeroA - numeroB
                          }
                          if (numeroA !== null && numeroB === null) return -1
                          if (numeroA === null && numeroB !== null) return 1

                          const aditivoA = !!a.item?.isAditivo
                          const aditivoB = !!b.item?.isAditivo
                          if (aditivoA !== aditivoB) return aditivoA ? 1 : -1

                          return a.index - b.index
                        })
                        .map(({ item }) => item)
                    }

                    const renderPhotoThumb = (url: string, label: string, idx: number, color: string) => (
                      <div key={idx} className="relative group overflow-hidden rounded-lg shadow-sm hover:shadow-md transition-all">
                        <div className="aspect-square bg-slate-100">
                          <img src={url} alt={`${label} #${idx + 1}`} className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300" />
                        </div>
                        <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
                          <button
                            onClick={(e) => { e.stopPropagation(); setViewingPhoto({ url, label: `${label} #${idx + 1}` }) }}
                            className="bg-white/90 text-slate-900 p-1.5 rounded-lg"
                          >
                            <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
                            </svg>
                          </button>
                        </div>
                        <div className={`absolute top-1 left-1 ${colorMap[color] ?? 'bg-slate-600'} text-white text-xs font-bold px-1.5 py-0.5 rounded shadow`}>#{idx + 1}</div>
                      </div>
                    )

                    // ── POSTES (Linha Viva / Cava / Book de Aterramento / Fundação Especial) ──
                    const postesDataRenderRaw: any[] = (selectedObraForBook as any).postes_data
                    const postesDataRender = sortByNumero(postesDataRenderRaw)
                    if (postesDataRender.length > 0) {
                      const isBookAterr = selectedObraForBook.tipo_servico === 'Book de Aterramento'
                      const subKeysPostes = isBookAterr
                        ? [
                            { key: 'fotos_antes', label: 'Vala Aberta', color: 'blue' },
                            { key: 'fotos_durante', label: 'Hastes', color: 'orange' },
                            { key: 'fotos_depois', label: 'Vala Fechada', color: 'green' },
                            { key: 'fotos_medicao', label: 'Medição Terrômetro', color: 'teal' },
                          ]
                        : [
                            { key: 'fotos_antes', label: 'Fotos Antes', color: 'blue' },
                            { key: 'fotos_durante', label: 'Fotos Durante', color: 'orange' },
                            { key: 'fotos_depois', label: 'Fotos Depois', color: 'green' },
                          ]
                      const totalFotosPostes = postesDataRender.reduce((acc: number, p: any) => acc + subKeysPostes.reduce((a, s) => a + (p[s.key]?.length || 0), 0), 0)
                      return (
                        <div key="postes_data_block" className="rounded-2xl border border-green-200 bg-green-50 overflow-hidden shadow-sm">
                          <div className="flex items-center gap-3 px-4 py-3">
                            <div className="bg-green-600 text-white px-3 py-1.5 rounded-lg shadow-sm">
                              <h4 className="font-bold text-xs uppercase tracking-wider">Checklist de Postes</h4>
                            </div>
                            <span className="text-xs font-semibold px-2 py-1 rounded-full bg-white text-slate-700 shadow-sm">
                              {postesDataRender.length} poste{postesDataRender.length !== 1 ? 's' : ''} · {totalFotosPostes} foto{totalFotosPostes !== 1 ? 's' : ''}
                            </span>
                          </div>
                          <div className="px-4 pb-4 space-y-2">
                            {postesDataRender.map((poste: any, pIdx: number) => {
                              const labelP = `P${poste.numero || pIdx + 1}`
                              const hasAnyP = subKeysPostes.some(s => (poste[s.key] || []).length > 0)
                              if (!hasAnyP) return null
                              return (
                                <div key={pIdx} className="bg-white rounded-xl border border-green-100 overflow-hidden">
                                  <div className="flex items-center gap-3 px-3 py-2 bg-green-100/60 border-b border-green-100">
                                    <span className="font-bold text-sm text-green-900">{labelP}</span>
                                    <span className="text-xs text-green-400 ml-auto">
                                      {subKeysPostes.reduce((a, s) => a + (poste[s.key]?.length || 0), 0)} foto{subKeysPostes.reduce((a, s) => a + (poste[s.key]?.length || 0), 0) !== 1 ? 's' : ''}
                                    </span>
                                  </div>
                                  {subKeysPostes.map(ss => {
                                    const urls = (poste[ss.key] || []).map((p: any) => getPhotoUrlFromRef(p)).filter(Boolean) as string[]
                                    if (urls.length === 0) return null
                                    return (
                                      <div key={ss.key} className="px-3 py-2 border-t border-green-50">
                                        <p className="text-xs font-semibold text-green-600 mb-2 uppercase tracking-wide">{ss.label} ({urls.length})</p>
                                        <div className="grid grid-cols-3 md:grid-cols-5 lg:grid-cols-6 gap-1.5">
                                          {urls.map((url, i) => renderPhotoThumb(url, `${labelP} ${ss.label}`, i, ss.color))}
                                        </div>
                                      </div>
                                    )
                                  })}
                                </div>
                              )
                            })}
                          </div>
                        </div>
                      )
                    }

                    return getSectionsForBook(selectedObraForBook.tipo_servico).map((section) => {
                      const sectionKey = String(section.key)

                      // ── POSTES AGRUPADOS ──────────────────────────────────────
                      if (section.key === 'fotos_checklist_postes') {
                        const postesDataRaw: any[] = (selectedObraForBook as any).checklist_postes_data
                        const postesData = sortByNumero(postesDataRaw)
                        if (postesData.length > 0) {
                          const subKeys = [
                            { key: 'posteInteiro', label: 'Poste Inteiro' },
                            { key: 'descricao', label: 'Descrição do Poste' },
                            { key: 'engaste', label: 'Engaste' },
                            { key: 'conexao1', label: 'Conexão 1' },
                            { key: 'conexao2', label: 'Conexão 2' },
                            { key: 'maiorEsforco', label: 'Maior Esforço' },
                            { key: 'menorEsforco', label: 'Menor Esforço' },
                          ]
                          const totalFotos = postesData.reduce((acc, p) => acc + subKeys.reduce((a, s) => a + (p[s.key]?.length || 0), 0), 0)
                          const statusColors: Record<string, string> = { instalado: 'bg-green-100 text-green-700', retirado: 'bg-red-100 text-red-700', existente: 'bg-blue-100 text-blue-700' }
                          const statusLabels: Record<string, string> = { instalado: 'Instalado', retirado: 'Retirado', existente: 'Existente' }
                          return (
                            <div key={sectionKey} className="rounded-2xl border border-purple-200 bg-purple-50 overflow-hidden shadow-sm">
                              <div className="flex items-center gap-3 px-4 py-3">
                                <div className="bg-purple-600 text-white px-3 py-1.5 rounded-lg shadow-sm">
                                  <h4 className="font-bold text-xs uppercase tracking-wider">Checklist - Postes</h4>
                                </div>
                                <span className="text-xs font-semibold px-2 py-1 rounded-full bg-white text-slate-700 shadow-sm">
                                  {postesData.length} poste{postesData.length !== 1 ? 's' : ''} · {totalFotos} foto{totalFotos !== 1 ? 's' : ''}
                                </span>
                              </div>
                              <div className="px-4 pb-4 space-y-2">
                                {postesData.map((poste, pIdx) => {
                                  const numero = poste.numero || (pIdx + 1)
                                  const label = poste.isAditivo ? `AD-P${numero}` : `P${numero}`
                                  const statusLabel = statusLabels[poste.status] || poste.status
                                  const statusColor = statusColors[poste.status] || 'bg-slate-100 text-slate-600'
                                  const hasAny = subKeys.some(s => (poste[s.key] || []).length > 0)
                                  if (!hasAny) return null
                                  return (
                                    <div key={pIdx} className="bg-white rounded-xl border border-purple-100 overflow-hidden">
                                      <div className="flex items-center gap-3 px-3 py-2 bg-purple-100/60 border-b border-purple-100">
                                        <span className="font-bold text-sm text-purple-900">{label}</span>
                                        <span className={`text-xs font-semibold px-2 py-0.5 rounded-full ${statusColor}`}>{statusLabel}</span>
                                        <span className="text-xs text-purple-400 ml-auto">
                                          {subKeys.reduce((a, s) => a + (poste[s.key]?.length || 0), 0)} foto{subKeys.reduce((a, s) => a + (poste[s.key]?.length || 0), 0) !== 1 ? 's' : ''}
                                        </span>
                                      </div>
                                      {subKeys.map(ss => {
                                        const urls = (poste[ss.key] || []).map((p: any) => getPhotoUrlFromRef(p)).filter(Boolean) as string[]
                                        if (urls.length === 0) return null
                                        return (
                                          <div key={ss.key} className="px-3 py-2 border-t border-purple-50">
                                            <p className="text-xs font-semibold text-purple-500 mb-2 uppercase tracking-wide">{ss.label} ({urls.length})</p>
                                            <div className="grid grid-cols-3 md:grid-cols-5 lg:grid-cols-6 gap-1.5">
                                              {urls.map((url, i) => renderPhotoThumb(url, `${label} ${ss.label}`, i, 'purple'))}
                                            </div>
                                          </div>
                                        )
                                      })}
                                    </div>
                                  )
                                })}
                              </div>
                            </div>
                          )
                        }
                      }

                      // ── SECCIONAMENTOS / EMENDAS / PODAS AGRUPADOS ────────────
                      if (section.key === 'fotos_checklist_seccionamentos') {
                        const secData: any[] = (selectedObraForBook as any).checklist_seccionamentos_data
                        if (secData && Array.isArray(secData) && secData.length > 0) {
                          const secDataComFotos = secData
                            .map((item, index) => ({ ...item, __index: index }))
                            .filter(item => ((item.fotos || []).map((p: any) => getPhotoUrlFromRef(p)).filter(Boolean) as string[]).length > 0)

                          if (secDataComFotos.length === 0) return null

                          const totalFotos = secDataComFotos.reduce((acc, s) => {
                            const urls = ((s.fotos || []).map((p: any) => getPhotoUrlFromRef(p)).filter(Boolean) as string[])
                            return acc + urls.length
                          }, 0)

                          const grupos = [
                            { tipo: 'emenda' as const, titulo: 'Emendas', prefixo: 'E', labelTitulo: 'Emenda', badgeClass: 'bg-orange-500 text-white' },
                            { tipo: 'poda' as const, titulo: 'Podas', prefixo: 'PD', labelTitulo: 'Poda', badgeClass: 'bg-emerald-500 text-white' },
                            { tipo: 'seccionamento' as const, titulo: 'Seccionamentos', prefixo: 'S', labelTitulo: 'Seccionamento', badgeClass: 'bg-purple-500 text-white' },
                          ]

                          return (
                            <div key={sectionKey} className="rounded-2xl border border-purple-200 bg-purple-50 overflow-hidden shadow-sm">
                              <div className="flex items-center gap-3 px-4 py-3">
                                <div className="bg-purple-600 text-white px-3 py-1.5 rounded-lg shadow-sm">
                                  <h4 className="font-bold text-xs uppercase tracking-wider">Checklist - Emendas, Podas e Seccionamentos</h4>
                                </div>
                                <span className="text-xs font-semibold px-2 py-1 rounded-full bg-white text-slate-700 shadow-sm">
                                  {secDataComFotos.length} ponto{secDataComFotos.length !== 1 ? 's' : ''} · {totalFotos} foto{totalFotos !== 1 ? 's' : ''}
                                </span>
                              </div>
                              <div className="px-4 pb-4 space-y-2">
                                {grupos.map((grupo) => {
                                  const itens = secDataComFotos.filter((item) => getChecklistLinearType(item) === grupo.tipo)
                                    .sort((a, b) => {
                                      const numeroA = parseNumericOrder(a?.numero)
                                      const numeroB = parseNumericOrder(b?.numero)
                                      if (numeroA !== null && numeroB !== null && numeroA !== numeroB) return numeroA - numeroB
                                      if (numeroA !== null && numeroB === null) return -1
                                      if (numeroA === null && numeroB !== null) return 1
                                      return 0
                                    })
                                  if (itens.length === 0) return null

                                  return (
                                    <div key={grupo.tipo} className="space-y-2">
                                      <p className="text-xs font-semibold text-purple-500 uppercase tracking-wide">{grupo.titulo}</p>
                                      {itens.map((item, itemIdx) => {
                                        const numero = item.numero || (itemIdx + 1)
                                        const label = `${grupo.prefixo}${numero}`
                                        const urls = (item.fotos || []).map((p: any) => getPhotoUrlFromRef(p)).filter(Boolean) as string[]
                                        const trecho = grupo.tipo === 'seccionamento' ? null : getTrechoEntrePostes(item)
                                        if (urls.length === 0) return null

                                        return (
                                          <div key={`${grupo.tipo}_${item.__index ?? itemIdx}`} className="bg-white rounded-xl border border-purple-100 overflow-hidden">
                                            <div className="flex items-center gap-3 px-3 py-2 bg-purple-100/60 border-b border-purple-100">
                                              <span className={`text-xs font-semibold px-2 py-0.5 rounded-full ${grupo.badgeClass}`}>{label}</span>
                                              <span className="font-bold text-sm text-purple-900">{grupo.labelTitulo}</span>
                                              {trecho && (
                                                <span className="text-xs text-slate-600">Trecho {trecho}</span>
                                              )}
                                              <span className="text-xs text-purple-400 ml-auto">{urls.length} foto{urls.length !== 1 ? 's' : ''}</span>
                                            </div>
                                            <div className="grid grid-cols-3 md:grid-cols-5 lg:grid-cols-6 gap-1.5 p-3">
                                              {urls.map((url, i) => renderPhotoThumb(url, `${grupo.labelTitulo} ${label}`, i, 'purple'))}
                                            </div>
                                          </div>
                                        )
                                      })}
                                    </div>
                                  )
                                })}
                              </div>
                            </div>
                          )
                        }
                      }

                      // ── ATERRAMENTO CERCA AGRUPADO ────────────────────────────
                      if (section.key === 'fotos_checklist_aterramento_cerca') {
                        const aterrData: any[] = (selectedObraForBook as any).checklist_aterramentos_cerca_data
                        if (aterrData && Array.isArray(aterrData) && aterrData.length > 0) {
                          const totalFotos = aterrData.reduce((acc, a) => acc + (a.fotos?.length || 0), 0)
                          return (
                            <div key={sectionKey} className="rounded-2xl border border-purple-200 bg-purple-50 overflow-hidden shadow-sm">
                              <div className="flex items-center gap-3 px-4 py-3">
                                <div className="bg-purple-600 text-white px-3 py-1.5 rounded-lg shadow-sm">
                                  <h4 className="font-bold text-xs uppercase tracking-wider">Checklist - Aterramento de Cerca</h4>
                                </div>
                                <span className="text-xs font-semibold px-2 py-1 rounded-full bg-white text-slate-700 shadow-sm">
                                  {aterrData.length} aterramento{aterrData.length !== 1 ? 's' : ''} · {totalFotos} foto{totalFotos !== 1 ? 's' : ''}
                                </span>
                              </div>
                              <div className="px-4 pb-4 space-y-2">
                                {aterrData.map((aterr, aIdx) => {
                                  const urls = (aterr.fotos || []).map((p: any) => getPhotoUrlFromRef(p)).filter(Boolean) as string[]
                                  if (urls.length === 0) return null
                                  return (
                                    <div key={aIdx} className="bg-white rounded-xl border border-purple-100 overflow-hidden">
                                      <div className="flex items-center gap-3 px-3 py-2 bg-purple-100/60 border-b border-purple-100">
                                        <span className="font-bold text-sm text-purple-900">Aterramento {aterr.numero}</span>
                                        <span className="text-xs text-purple-400 ml-auto">{urls.length} foto{urls.length !== 1 ? 's' : ''}</span>
                                      </div>
                                      <div className="grid grid-cols-3 md:grid-cols-5 lg:grid-cols-6 gap-1.5 p-3">
                                        {urls.map((url, i) => renderPhotoThumb(url, `Aterramento ${aterr.numero}`, i, 'purple'))}
                                      </div>
                                    </div>
                                  )
                                })}
                              </div>
                            </div>
                          )
                        }
                      }

                      // ── HASTES E TERMÔMETROS AGRUPADOS ───────────────────────
                      if (section.key === 'fotos_checklist_hastes_aplicadas') {
                        const hastesDataRaw: any[] = (selectedObraForBook as any).checklist_hastes_termometros_data
                        const hastesData = sortByNumero(hastesDataRaw)
                        if (hastesData.length > 0) {
                          const totalFotos = hastesData.reduce((acc, p) => acc + (p.fotoHaste?.length || 0) + (p.fotoTermometro?.length || 0), 0)
                          return (
                            <div key={sectionKey} className="rounded-2xl border border-purple-200 bg-purple-50 overflow-hidden shadow-sm">
                              <div className="flex items-center gap-3 px-4 py-3">
                                <div className="bg-purple-600 text-white px-3 py-1.5 rounded-lg shadow-sm">
                                  <h4 className="font-bold text-xs uppercase tracking-wider">Checklist - Hastes Aplicadas e Medição do Termômetro</h4>
                                </div>
                                <span className="text-xs font-semibold px-2 py-1 rounded-full bg-white text-slate-700 shadow-sm">
                                  {hastesData.length} ponto{hastesData.length !== 1 ? 's' : ''} · {totalFotos} foto{totalFotos !== 1 ? 's' : ''}
                                </span>
                              </div>
                              <div className="px-4 pb-4 space-y-2">
                                {hastesData.map((ponto, pIdx) => {
                                  const numero = ponto.numero || (pIdx + 1)
                                  const label = ponto.isAditivo ? `AD-P${numero}` : `P${numero}`
                                  const hasteUrls = (ponto.fotoHaste || []).map((p: any) => getPhotoUrlFromRef(p)).filter(Boolean) as string[]
                                  const termoUrls = (ponto.fotoTermometro || []).map((p: any) => getPhotoUrlFromRef(p)).filter(Boolean) as string[]
                                  if (hasteUrls.length === 0 && termoUrls.length === 0) return null
                                  return (
                                    <div key={pIdx} className="bg-white rounded-xl border border-purple-100 overflow-hidden">
                                      <div className="flex items-center gap-3 px-3 py-2 bg-purple-100/60 border-b border-purple-100">
                                        <span className="font-bold text-sm text-purple-900">{label}</span>
                                        <span className="text-xs text-purple-400 ml-auto">{hasteUrls.length + termoUrls.length} foto{hasteUrls.length + termoUrls.length !== 1 ? 's' : ''}</span>
                                      </div>
                                      {hasteUrls.length > 0 && (
                                        <div className="px-3 py-2 border-t border-purple-50">
                                          <p className="text-xs font-semibold text-purple-500 mb-2 uppercase tracking-wide">Haste Aplicada ({hasteUrls.length})</p>
                                          <div className="grid grid-cols-3 md:grid-cols-5 lg:grid-cols-6 gap-1.5">
                                            {hasteUrls.map((url, i) => renderPhotoThumb(url, `${label} Haste`, i, 'purple'))}
                                          </div>
                                        </div>
                                      )}
                                      {termoUrls.length > 0 && (
                                        <div className="px-3 py-2 border-t border-purple-50">
                                          <p className="text-xs font-semibold text-purple-500 mb-2 uppercase tracking-wide">Medição do Termômetro ({termoUrls.length})</p>
                                          <div className="grid grid-cols-3 md:grid-cols-5 lg:grid-cols-6 gap-1.5">
                                            {termoUrls.map((url, i) => renderPhotoThumb(url, `${label} Termômetro`, i, 'purple'))}
                                          </div>
                                        </div>
                                      )}
                                    </div>
                                  )
                                })}
                              </div>
                            </div>
                          )
                        }
                      }

                      // ── RENDERING FLAT (demais seções) ────────────────────────
                      const fotos = convertPhotoIdsToFotoInfo((selectedObraForBook as any)[section.key]);
                      const addActionKey = `${sectionKey}:add`
                      const hasPhotos = fotos.length > 0

                      return (
                        <div
                          key={sectionKey}
                          className={`rounded-2xl border ${hasPhotos ? borderColorMap[section.color] + ' ' + bgLightMap[section.color] : 'border-slate-200 bg-white'} overflow-hidden shadow-sm`}
                        >
                          {/* Header da seção */}
                          <div className={`flex items-center justify-between px-4 py-3 ${hasPhotos ? '' : 'border-b-0'}`}>
                            <div className="flex items-center gap-3">
                              <div className={`${colorMap[section.color]} text-white px-3 py-1.5 rounded-lg shadow-sm`}>
                                <h4 className="font-bold text-xs uppercase tracking-wider">{section.label}</h4>
                              </div>
                              <span className={`text-xs font-semibold px-2 py-1 rounded-full ${hasPhotos ? 'bg-white text-slate-700 shadow-sm' : 'text-slate-400'}`}>
                                {fotos.length} foto{fotos.length !== 1 ? 's' : ''}
                              </span>
                            </div>
                            <button
                              className={`px-3 py-1.5 text-white rounded-lg font-semibold text-xs transition-all disabled:opacity-60 disabled:cursor-not-allowed flex items-center gap-1.5 ${colorMap[section.color]} hover:opacity-90 shadow-sm`}
                              disabled={photoActionKey === addActionKey}
                              onClick={() => document.getElementById(`file-input-${sectionKey}`)?.click()}
                            >
                              {photoActionKey === addActionKey ? (
                                <>
                                  <svg className="w-3.5 h-3.5 animate-spin" fill="none" viewBox="0 0 24 24">
                                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"/>
                                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"/>
                                  </svg>
                                  Enviando...
                                </>
                              ) : (
                                <>
                                  <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M12 4v16m8-8H4" />
                                  </svg>
                                  Adicionar
                                </>
                              )}
                            </button>
                            <input
                              id={`file-input-${sectionKey}`}
                              type="file"
                              accept="image/*"
                              className="hidden"
                              onChange={(event) => {
                                const file = event.target.files?.[0]
                                if (file) void handleAddPhotoToReport(section.key, file)
                                event.target.value = ''
                              }}
                            />
                          </div>

                          {/* Fotos ou estado vazio */}
                          {hasPhotos ? (
                            <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3 px-4 pb-4">
                              {fotos.map((foto, idx) => (
                                <div key={idx} className="relative group overflow-hidden rounded-xl shadow-md hover:shadow-xl transition-all duration-300 transform hover:-translate-y-0.5">
                                  <div className="aspect-square bg-slate-100">
                                    <img
                                      src={foto.url}
                                      alt={`${section.label} ${idx + 1}`}
                                      className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-105"
                                    />
                                  </div>
                                  <div className="absolute inset-0 bg-gradient-to-t from-black/70 via-transparent to-transparent opacity-0 group-hover:opacity-100 transition-all duration-300 flex items-end justify-center pb-3">
                                    <button
                                      onClick={(e) => {
                                        e.stopPropagation()
                                        setViewingPhoto({ url: foto.url, label: `${section.label} #${idx + 1}` })
                                      }}
                                      className="bg-white/95 text-slate-900 px-3 py-1.5 rounded-lg text-xs font-bold shadow-lg translate-y-2 group-hover:translate-y-0 transition-transform duration-300 flex items-center gap-1.5"
                                    >
                                      <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
                                      </svg>
                                      Visualizar
                                    </button>
                                  </div>
                                  <div className={`absolute top-2 left-2 ${colorMap[section.color]} text-white text-xs font-bold px-1.5 py-0.5 rounded shadow-md`}>
                                    #{idx + 1}
                                  </div>
                                  <button
                                    type="button"
                                    title="Excluir foto"
                                    className="absolute top-2 right-2 bg-red-600/90 text-white text-xs font-bold px-1.5 py-0.5 rounded shadow-md hover:bg-red-700 disabled:opacity-60 opacity-0 group-hover:opacity-100 transition-all duration-200"
                                    disabled={photoActionKey === `${sectionKey}:delete:${idx}`}
                                    onClick={(event) => {
                                      event.preventDefault()
                                      event.stopPropagation()
                                      void handleDeletePhotoFromReport(section.key, idx, foto.url)
                                    }}
                                  >
                                    {photoActionKey === `${sectionKey}:delete:${idx}` ? '...' : 'Excluir'}
                                  </button>
                                </div>
                              ))}
                            </div>
                          ) : (
                            <div className="flex items-center gap-2 px-4 py-2.5 text-slate-400 text-xs border-t border-slate-100">
                              <svg className="w-3.5 h-3.5 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
                              </svg>
                              Nenhuma foto adicionada
                            </div>
                          )}
                        </div>
                      );
                    });
                  })()}
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
                        if (selectedObraForBook.source_table === 'servicos') {
                          const serviceId = selectedObraForBook.service_id || selectedObraForBook.id.replace(/^servico:/, '')
                          router.push(`/servico/${serviceId}`)
                        } else {
                          router.push(`/obra/${selectedObraForBook.id}`)
                        }
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
        {/* Lightbox - Visualização de foto */}
        {viewingPhoto && (
          <div
            className="fixed inset-0 z-[60] bg-black/90 flex flex-col items-center justify-center animate-fadeIn"
            onClick={() => setViewingPhoto(null)}
          >
            <div className="absolute top-4 left-0 right-0 flex items-center justify-between px-6">
              <span className="text-white text-sm font-semibold bg-black/40 px-3 py-1.5 rounded-lg">
                {viewingPhoto.label}
              </span>
              <div className="flex items-center gap-2">
                <a
                  href={viewingPhoto.url}
                  download
                  target="_blank"
                  rel="noreferrer"
                  onClick={(e) => e.stopPropagation()}
                  className="p-2.5 bg-white/10 hover:bg-white/20 text-white rounded-lg transition-colors"
                  title="Baixar foto"
                >
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
                  </svg>
                </a>
                <button
                  onClick={() => setViewingPhoto(null)}
                  className="p-2.5 bg-white/10 hover:bg-white/20 text-white rounded-lg transition-colors"
                  title="Fechar"
                >
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </button>
              </div>
            </div>
            <img
              src={viewingPhoto.url}
              alt={viewingPhoto.label}
              className="max-h-[85vh] max-w-[90vw] object-contain rounded-lg shadow-2xl"
              onClick={(e) => e.stopPropagation()}
            />
          </div>
        )}

        {/* Dropdown de ações — renderizado com fixed para não ser cortado pelo overflow da tabela */}
        {openMenuId && menuPosition && (
          <div
            ref={menuRef}
            style={{ top: menuPosition.top, left: menuPosition.left }}
            className="fixed z-[9999] w-56 bg-white rounded-2xl shadow-2xl shadow-slate-900/15 border border-slate-200/80 overflow-hidden animate-slideUp"
          >
            {/* Cabeçalho */}
            <div className="px-3 pt-3 pb-1.5">
              <p className="text-[10px] font-semibold text-slate-400 uppercase tracking-widest">Ações da obra</p>
            </div>

            {/* Itens principais */}
            <div className="px-2 pb-2 space-y-0.5">
              <button
                onClick={() => {
                  const id = openMenuId!
                  setOpenMenuId(null)
                  setMenuPosition(null)
                  void handleOpenBook(id)
                }}
                className="w-full px-3 py-2 text-left text-sm font-medium text-slate-700 hover:bg-blue-50 hover:text-blue-700 rounded-xl flex items-center gap-3 transition-colors group"
              >
                <span className="w-7 h-7 bg-blue-100 group-hover:bg-blue-200 rounded-lg flex items-center justify-center shrink-0 transition-colors">
                  <svg className="w-3.5 h-3.5 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" />
                  </svg>
                </span>
                Abrir Obra
              </button>

              <button
                onClick={() => {
                  const id = openMenuId!
                  const obraAtual = obras.find(o => o.id === id)
                  handleOpenCreateBookModal({
                    obra: obraAtual?.obra || '',
                    equipe: obraAtual?.equipe || '',
                    responsavel: obraAtual?.responsavel || '',
                  })
                  setOpenMenuId(null)
                  setMenuPosition(null)
                }}
                className="w-full px-3 py-2 text-left text-sm font-medium text-slate-700 hover:bg-emerald-50 hover:text-emerald-700 rounded-xl flex items-center gap-3 transition-colors group"
              >
                <span className="w-7 h-7 bg-emerald-100 group-hover:bg-emerald-200 rounded-lg flex items-center justify-center shrink-0 transition-colors">
                  <svg className="w-3.5 h-3.5 text-emerald-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
                  </svg>
                </span>
                Novo Book (mesmo nº)
              </button>

              {isAdmin && (
                <button
                  onClick={() => {
                    const id = openMenuId!
                    void handleOpenEdit(id)
                    setOpenMenuId(null)
                    setMenuPosition(null)
                  }}
                  className="w-full px-3 py-2 text-left text-sm font-medium text-slate-700 hover:bg-amber-50 hover:text-amber-700 rounded-xl flex items-center gap-3 transition-colors group"
                >
                  <span className="w-7 h-7 bg-amber-100 group-hover:bg-amber-200 rounded-lg flex items-center justify-center shrink-0 transition-colors">
                    <svg className="w-3.5 h-3.5 text-amber-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                    </svg>
                  </span>
                  Editar Dados
                </button>
              )}

              <button
                onClick={() => {
                  const obraAtual = filteredObras.find(o => o.id === openMenuId)
                  if (obraAtual) handleCreatePlaque(obraAtual)
                  setOpenMenuId(null)
                  setMenuPosition(null)
                }}
                className="w-full px-3 py-2 text-left text-sm font-medium text-slate-700 hover:bg-purple-50 hover:text-purple-700 rounded-xl flex items-center gap-3 transition-colors group"
              >
                <span className="w-7 h-7 bg-purple-100 group-hover:bg-purple-200 rounded-lg flex items-center justify-center shrink-0 transition-colors">
                  <svg className="w-3.5 h-3.5 text-purple-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 7h.01M7 3h5c.512 0 1.024.195 1.414.586l7 7a2 2 0 010 2.828l-7 7a2 2 0 01-2.828 0l-7-7A1.994 1.994 0 013 12V7a4 4 0 014-4z" />
                  </svg>
                </span>
                Criar Placa
              </button>

              <button
                onClick={() => {
                  const obraAtual = filteredObras.find(o => o.id === openMenuId)
                  if (obraAtual) handleExportSinglePDF(obraAtual)
                  setOpenMenuId(null)
                  setMenuPosition(null)
                }}
                disabled={exportingId === openMenuId}
                className="w-full px-3 py-2 text-left text-sm font-medium text-slate-700 hover:bg-slate-100 rounded-xl flex items-center gap-3 transition-colors group disabled:opacity-50 disabled:cursor-not-allowed"
              >
                <span className="w-7 h-7 bg-slate-100 group-hover:bg-slate-200 rounded-lg flex items-center justify-center shrink-0 transition-colors">
                  <svg className="w-3.5 h-3.5 text-slate-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 21h10a2 2 0 002-2V9.414a1 1 0 00-.293-.707l-5.414-5.414A1 1 0 0012.586 3H7a2 2 0 00-2 2v14a2 2 0 002 2z" />
                  </svg>
                </span>
                {exportingId === openMenuId ? 'Gerando PDF...' : 'Exportar PDF'}
              </button>

              {/* Baixar todos com mesmo Nº de obra (equipes diferentes) */}
              <button
                onClick={() => {
                  const obraAtual = filteredObras.find(o => o.id === openMenuId)
                  if (obraAtual) handleExportByObraNumber(obraAtual)
                }}
                disabled={exportingCombinedId === openMenuId}
                className="w-full px-3 py-2 text-left text-sm font-medium text-slate-700 hover:bg-slate-100 rounded-xl flex items-center gap-3 transition-colors group disabled:opacity-50 disabled:cursor-not-allowed"
              >
                <span className="w-7 h-7 bg-indigo-100 group-hover:bg-indigo-200 rounded-lg flex items-center justify-center shrink-0 transition-colors">
                  <svg className="w-3.5 h-3.5 text-indigo-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
                  </svg>
                </span>
                {exportingCombinedId === openMenuId ? 'Gerando PDF...' : 'Baixar todas equipes (mesmo Nº)'}
              </button>
            </div>

            {isAdmin && (
              <>
                <div className="border-t border-slate-100 mx-2" />
                <div className="px-2 py-2">
                  <button
                    onClick={() => {
                      const obraAtual = filteredObras.find(o => o.id === openMenuId)
                      if (obraAtual) handleDeleteObra(obraAtual)
                      setOpenMenuId(null)
                      setMenuPosition(null)
                    }}
                    disabled={deletingId === openMenuId || deletingBulk}
                    className="w-full px-3 py-2 text-left text-sm font-medium text-red-600 hover:bg-red-50 rounded-xl flex items-center gap-3 transition-colors group disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    <span className="w-7 h-7 bg-red-100 group-hover:bg-red-200 rounded-lg flex items-center justify-center shrink-0 transition-colors">
                      <svg className="w-3.5 h-3.5 text-red-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                      </svg>
                    </span>
                    {deletingId === openMenuId ? 'Excluindo...' : 'Excluir Obra'}
                  </button>
                </div>
              </>
            )}
          </div>
        )}
      </AppShell>
    </ProtectedRoute>
  )
}
