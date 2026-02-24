'use client'

import { useEffect, useState, useMemo, useRef } from 'react'
import { supabase, type Obra, type FotoInfo, getObraStatus } from '@/lib/supabase'
import ProtectedRoute from '@/components/ProtectedRoute'
import AppShell from '@/components/AppShell'
import { generatePDF } from '@/lib/pdf-generator'
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
      'fotos_checklist_abertura_fechamento_pulo', 'fotos_checklist_panoramica_final',
    ],
  }

  const keys = keyMap[tipoServico] ?? ['fotos_antes', 'fotos_durante', 'fotos_depois']
  return REPORT_PHOTO_SECTIONS.filter(s => keys.includes(String(s.key)))
}

export default function ReportsPage() {
  const router = useRouter()
  const { isAdmin } = useAuth()
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
  const [exportingAllPdf, setExportingAllPdf] = useState(false)
  const [selectedObraForBook, setSelectedObraForBook] = useState<Obra | null>(null)
  const [deletingId, setDeletingId] = useState<string | null>(null)
  const [photoActionKey, setPhotoActionKey] = useState<string | null>(null)
  const [viewingPhoto, setViewingPhoto] = useState<{ url: string; label: string } | null>(null)
  const [editingObra, setEditingObra] = useState<Obra | null>(null)
  const [editForm, setEditForm] = useState({ equipe: '', obra: '', data: '', responsavel: '' })
  const [savingEdit, setSavingEdit] = useState(false)
  const [editError, setEditError] = useState('')
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

  function handleOpenBook(obraId: string) {
    const obra = obras.find(o => o.id === obraId)
    if (obra) {
      // Converter fotos para o formato correto antes de exibir
      const obraComFotosConvertidas: Obra = {
        ...obra
      }
      for (const section of REPORT_PHOTO_SECTIONS) {
        ;(obraComFotosConvertidas as any)[section.key] = convertPhotoIdsToFotoInfo((obra as any)[section.key])
      }
      setSelectedObraForBook(obraComFotosConvertidas)
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

  async function exportAllToPdf() {
    if (selectedObras.size === 0) {
      alert('Selecione pelo menos uma obra para exportar')
      return
    }

    setExportingAllPdf(true)
    try {
      const obrasToExport = filteredObras.filter(o => selectedObras.has(o.id))

      for (let i = 0; i < obrasToExport.length; i++) {
        const obra = obrasToExport[i]
        await generatePDF(obra)
        // Pequeno delay entre downloads para evitar bloqueio do navegador
        if (i < obrasToExport.length - 1) {
          await new Promise(resolve => setTimeout(resolve, 500))
        }
      }

      alert(`${obrasToExport.length} PDF(s) exportado(s) com sucesso!`)
    } catch (error) {
      console.error('Erro ao exportar PDFs:', error)
      alert('Erro ao exportar PDFs')
    } finally {
      setExportingAllPdf(false)
    }
  }

  async function handleDeleteObra(obra: Obra) {
    const confirmMessage = `Tem certeza que deseja EXCLUIR a obra "${obra.obra || 'sem número'}"?\n\nEsta ação é IRREVERSÍVEL e irá:\n- Deletar a obra do banco de dados\n- Deletar todas as fotos associadas\n\nDigite "EXCLUIR" para confirmar:`

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
      const response = await fetch(`/api/obras/${obra.id}`, {
        method: 'DELETE',
      })

      const result = await response.json()

      if (!result.success) {
        throw new Error(result.error || 'Erro ao excluir obra')
      }

      // Remover obra da lista local
      setObras(prev => prev.filter(o => o.id !== obra.id))
      setSelectedObras(prev => {
        const newSet = new Set(prev)
        newSet.delete(obra.id)
        return newSet
      })

      alert(`Obra "${obra.obra || 'sem número'}" excluída com sucesso!\n${result.photosDeleted || 0} foto(s) removidas.`)
    } catch (error: any) {
      console.error('Erro ao excluir obra:', error)
      alert(`Erro ao excluir obra: ${error.message}`)
    } finally {
      setDeletingId(null)
    }
  }

  function handleOpenEdit(obra: Obra) {
    setOpenMenuId(null)
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
    })
    setEditingObra(obra)
  }

  async function handleSaveEdit(e: React.FormEvent) {
    e.preventDefault()
    if (!editingObra) return
    setSavingEdit(true)
    setEditError('')
    try {
      const { error } = await supabase
        .from('obras')
        .update({
          equipe: editForm.equipe.trim(),
          obra: editForm.obra.trim(),
          data: editForm.data,
          responsavel: editForm.responsavel.trim(),
        })
        .eq('id', editingObra.id)
      if (error) throw error
      setObras(prev => prev.map(o =>
        o.id === editingObra.id
          ? { ...o, equipe: editForm.equipe.trim(), obra: editForm.obra.trim(), data: editForm.data, responsavel: editForm.responsavel.trim() }
          : o
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
          <div className="flex justify-end mb-6">
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
                              {isAdmin && (
                                <button
                                  onClick={() => handleOpenEdit(obra)}
                                  className="w-full px-4 py-2 text-left text-sm text-slate-700 hover:bg-amber-50 hover:text-amber-700 flex items-center gap-3"
                                >
                                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-6 9l2 2 4-4" />
                                  </svg>
                                  Editar Dados
                                </button>
                              )}
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
                              <div className="border-t border-slate-200 my-1"></div>
                              <button
                                onClick={() => handleDeleteObra(obra)}
                                disabled={deletingId === obra.id}
                                className={`w-full px-4 py-2 text-left text-sm text-red-600 hover:bg-red-50 flex items-center gap-3 ${deletingId === obra.id ? 'opacity-60 cursor-not-allowed' : ''}`}
                              >
                                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                                </svg>
                                {deletingId === obra.id ? 'Excluindo...' : 'Excluir Obra'}
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
                    <input
                      type="text"
                      value={editForm.equipe}
                      onChange={(e) => setEditForm(f => ({ ...f, equipe: e.target.value }))}
                      className="input-field"
                      placeholder="Nome da equipe"
                      required
                    />
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

                {/* Galerias de Fotos - Dinâmico por tipo de serviço */}
                {/* Resumo de seções */}
                {(() => {
                  const bookSections = getSectionsForBook(selectedObraForBook.tipo_servico)
                  const withPhotos = bookSections.filter(s => convertPhotoIdsToFotoInfo((selectedObraForBook as any)[s.key]).length > 0).length
                  const totalFotosBook = bookSections.reduce((acc, s) => acc + convertPhotoIdsToFotoInfo((selectedObraForBook as any)[s.key]).length, 0)
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

                    const getUrlFromId = (id: string): string | null => {
                      if (!id || id.startsWith('temp_') || id.startsWith('local_') || id.startsWith('file:///')) return null
                      if (id.startsWith('http')) return id
                      return supabase.storage.from('obra-photos').getPublicUrl(id).data.publicUrl
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

                    return getSectionsForBook(selectedObraForBook.tipo_servico).map((section) => {
                      const sectionKey = String(section.key)

                      // ── POSTES AGRUPADOS ──────────────────────────────────────
                      if (section.key === 'fotos_checklist_postes') {
                        const postesData: any[] = (selectedObraForBook as any).checklist_postes_data
                        if (postesData && Array.isArray(postesData) && postesData.length > 0) {
                          const subKeys = [
                            { key: 'posteInteiro', label: 'Poste Inteiro' },
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
                                  const label = poste.isAditivo ? `AD-P${poste.numero}` : `P${poste.numero}`
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
                                        const urls = (poste[ss.key] || []).map((p: any) => getUrlFromId(p.id)).filter(Boolean) as string[]
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

                      // ── SECCIONAMENTOS AGRUPADOS ──────────────────────────────
                      if (section.key === 'fotos_checklist_seccionamentos') {
                        const secData: any[] = (selectedObraForBook as any).checklist_seccionamentos_data
                        if (secData && Array.isArray(secData) && secData.length > 0) {
                          const totalFotos = secData.reduce((acc, s) => acc + (s.fotos?.length || 0), 0)
                          return (
                            <div key={sectionKey} className="rounded-2xl border border-purple-200 bg-purple-50 overflow-hidden shadow-sm">
                              <div className="flex items-center gap-3 px-4 py-3">
                                <div className="bg-purple-600 text-white px-3 py-1.5 rounded-lg shadow-sm">
                                  <h4 className="font-bold text-xs uppercase tracking-wider">Checklist - Seccionamentos</h4>
                                </div>
                                <span className="text-xs font-semibold px-2 py-1 rounded-full bg-white text-slate-700 shadow-sm">
                                  {secData.length} seccionamento{secData.length !== 1 ? 's' : ''} · {totalFotos} foto{totalFotos !== 1 ? 's' : ''}
                                </span>
                              </div>
                              <div className="px-4 pb-4 space-y-2">
                                {secData.map((sec, sIdx) => {
                                  const urls = (sec.fotos || []).map((p: any) => getUrlFromId(p.id)).filter(Boolean) as string[]
                                  if (urls.length === 0) return null
                                  return (
                                    <div key={sIdx} className="bg-white rounded-xl border border-purple-100 overflow-hidden">
                                      <div className="flex items-center gap-3 px-3 py-2 bg-purple-100/60 border-b border-purple-100">
                                        <span className="font-bold text-sm text-purple-900">Seccionamento {sec.numero}</span>
                                        <span className="text-xs text-purple-400 ml-auto">{urls.length} foto{urls.length !== 1 ? 's' : ''}</span>
                                      </div>
                                      <div className="grid grid-cols-3 md:grid-cols-5 lg:grid-cols-6 gap-1.5 p-3">
                                        {urls.map((url, i) => renderPhotoThumb(url, `Seccionamento ${sec.numero}`, i, 'purple'))}
                                      </div>
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
                                  const urls = (aterr.fotos || []).map((p: any) => getUrlFromId(p.id)).filter(Boolean) as string[]
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
      </AppShell>
    </ProtectedRoute>
  )
}
