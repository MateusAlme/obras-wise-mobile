'use client'

import { useEffect, useState } from 'react'
import { useParams, useRouter } from 'next/navigation'
import { supabase, type Obra, type FotoInfo } from '@/lib/supabase'
import ProtectedRoute from '@/components/ProtectedRoute'
import AppShell from '@/components/AppShell'
import PhotoGallery from '@/components/PhotoGallery'
import { generatePDF } from '@/lib/pdf-generator'
import { format } from 'date-fns'
import { ptBR } from 'date-fns/locale'
import * as XLSX from 'xlsx'

// Mapeamento de tipos de serviço para galerias de fotos permitidas
const GALERIAS_POR_TIPO_SERVICO: Record<string, string[]> = {
  'Emenda': ['fotos_antes', 'fotos_durante', 'fotos_depois'],
  'Bandolamento': ['fotos_antes', 'fotos_durante', 'fotos_depois'],
  'Linha Viva': ['fotos_antes', 'fotos_durante', 'fotos_depois'],
  'Transformador': ['fotos_antes', 'fotos_durante', 'fotos_depois', 'fotos_abertura', 'fotos_fechamento'],
  'Abertura e Fechamento de Chave': ['fotos_abertura', 'fotos_fechamento'],
  'Poda': ['fotos_antes', 'fotos_durante', 'fotos_depois'],
  'Fundação Especial': ['fotos_antes', 'fotos_durante', 'fotos_depois'],
  'Instalação do Medidor': ['fotos_antes', 'fotos_durante', 'fotos_depois'],
  'Checklist de Fiscalização': ['fotos_checklist_croqui', 'fotos_checklist_panoramica_inicial', 'fotos_checklist_chede', 'fotos_checklist_aterramento_cerca', 'fotos_checklist_padrao_geral', 'fotos_checklist_padrao_interno', 'fotos_checklist_panoramica_final', 'fotos_checklist_postes', 'fotos_checklist_seccionamentos'],
  'DITAIS': ['fotos_ditais_abertura', 'fotos_ditais_impedir', 'fotos_ditais_testar', 'fotos_ditais_aterrar', 'fotos_ditais_sinalizar'],
  'Ditais': ['fotos_ditais_abertura', 'fotos_ditais_impedir', 'fotos_ditais_testar', 'fotos_ditais_aterrar', 'fotos_ditais_sinalizar'],
  'Book de Aterramento': ['fotos_aterramento_vala_aberta', 'fotos_aterramento_hastes', 'fotos_aterramento_vala_fechada', 'fotos_aterramento_medicao'],
  'Aterramento': ['fotos_aterramento_vala_aberta', 'fotos_aterramento_hastes', 'fotos_aterramento_vala_fechada', 'fotos_aterramento_medicao'],
  'Medidor': ['fotos_medidor_padrao', 'fotos_medidor_leitura', 'fotos_medidor_selo_born', 'fotos_medidor_selo_caixa', 'fotos_medidor_identificador_fase'],
  'Altimetria': ['fotos_altimetria_lado_fonte', 'fotos_altimetria_medicao_fonte', 'fotos_altimetria_lado_carga', 'fotos_altimetria_medicao_carga'],
  'Vazamento': ['fotos_vazamento_evidencia', 'fotos_vazamento_equipamentos_limpeza', 'fotos_vazamento_tombamento_retirado', 'fotos_vazamento_placa_retirado', 'fotos_vazamento_tombamento_instalado', 'fotos_vazamento_placa_instalado', 'fotos_vazamento_instalacao'],
  'Checklist': ['fotos_checklist_croqui', 'fotos_checklist_panoramica_inicial', 'fotos_checklist_chede', 'fotos_checklist_aterramento_cerca', 'fotos_checklist_padrao_geral', 'fotos_checklist_padrao_interno', 'fotos_checklist_panoramica_final', 'fotos_checklist_postes', 'fotos_checklist_seccionamentos'],
  'Documentação': ['doc_cadastro_medidor', 'doc_laudo_transformador', 'doc_laudo_regulador', 'doc_laudo_religador', 'doc_apr', 'doc_fvbt', 'doc_termo_desistencia_lpt']
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

// Função helper para obter aterramentos de cerca (suporta formato novo e antigo)
function getAterramentosFotos(obra: Obra): { titulo: string; fotos: FotoInfo[] }[] {
  // Tentar usar formato novo (estruturado)
  if (obra.checklist_aterramentos_cerca_data && Array.isArray(obra.checklist_aterramentos_cerca_data) && obra.checklist_aterramentos_cerca_data.length > 0) {
    return obra.checklist_aterramentos_cerca_data.map((aterr: any, index: number) => ({
      titulo: `Checklist - Aterramento de Cerca A${aterr.numero || (index + 1)}`,
      fotos: aterr.fotos || []
    }))
  }

  // Fallback: usar formato antigo (coluna única)
  if (obra.fotos_checklist_aterramento_cerca && Array.isArray(obra.fotos_checklist_aterramento_cerca) && obra.fotos_checklist_aterramento_cerca.length > 0) {
    return [{
      titulo: 'Aterramento de Cerca',
      fotos: obra.fotos_checklist_aterramento_cerca
    }]
  }

  return []
}

// Lista de atipicidades reais
const ATIPICIDADES = [
  { id: 3, titulo: 'Obra em locais sem acesso que necessitam de transporte especial de equipamento (guindaste, trator, carroça) ou BANDOLAGEA', descricao: 'Existem obras que precisam de um transporte especial como guindaste, trator ou até mesmo bandolagem (que significa deslocar postes e transformadores sem auxílio de guindaste), devido às características do terreno tornando os necessário o transporte não usual dos equipamentos necessários para os atendimentos.' },
  { id: 4, titulo: 'Obra em ilhas, terrenos alagados, arenosos, montanhosos, rochosos ou anexos , com CONCRETAGEM da base do poste ou obra essencial.', descricao: 'A região apresenta terrenos rochosos, havendo a necessidade de em alguns obras de requipe fazer uso de compressor para perfuração do solo, e, posteriormente a corretagem do poste ou a utilização de concreto na base dos postes.' },
  { id: 5, titulo: 'Obra com travessia de condutores sobre linhas energizadas.', descricao: 'São consideradas atípicas pelo fato de utilizarmos equipes de linha-viva para realizar a travessia dos condutores da rede de distribuição em relação a rede de transmissão de energia.' },
  { id: 6, titulo: 'Obra de expansão e construção de rede e linhas de distribuição com abertura de faixa de passagem.', descricao: 'Faz-se necessário em algumas obras, a supressão da vegetação com auxílio de ferramentas ou máquinas agrícolas.' },
  { id: 8, titulo: 'Obra com participação de linha viva', descricao: 'São consideradas atípicas pelo fato de utilizarmos equipes de linha viva em alguns casos visando a não interrupção do fornecimento de energia elétrica para não impactar no DEC e FEC da concessionária.' },
  { id: 9, titulo: 'Obra com participação de linha viva com atendimento alternativo de caraias (SE / Barramento móvel, estruturas temporárias/provisórias, gerador, Mega Jump)', descricao: 'São consideradas atípicas pelo fato de utilizarmos equipes de linha viva e atendimento alternativo de cargas em alguns casos visando a não interrupção do fornecimento de energia elétrica para não impactar no DEC e FEC da concessionária.' },
  { id: 10, titulo: 'Obra com atendimento alternativo de caraias (SE / Barramento móvel, estruturas temporárias/provisórias, gerador, Mega Jump)', descricao: 'Utilizamos em alguns casos os referidos equipamentos visando a não interrupção do fornecimento de energia para grandes clientes.' },
  { id: 11, titulo: 'Obra de conversão de Rede convencional para REDE COMPACTA.', descricao: 'A atipicidade ocorre pelo fato da substituição em campo de rede convencional de cabo CA4/CAA2 por cabo protegido de rede compacta em grandes proporções.' },
  { id: 12, titulo: 'Obra exclusiva de recondutoramento de redes/linhas.', descricao: 'Ocorre quando há substituição de estruturas de média tensão tipo T por estruturas compactas tipo CE, substituição de rede de MT aérea de cabo CAA4 AWG, CAA2 AWG, e CA 4 AWG por rede compacta com cabo protegido multiplex.' },
  { id: 13, titulo: 'Obra MISTA com RECONDUTORAMENTO PARCIAL de redes / linhas.', descricao: 'São consideradas atípicas devido a necessidade do recondutoramento parcial da rede existente da distribuidora, seja em redes de baixa/média tensão substituindo a rede de MT aérea de cabo CAA4 AWG, CAA2 AWG, e CA 4 AWG por rede compacta com condutores de alumínio protegidos ou cabos multiplex.' },
  { id: 17, titulo: 'Outros (EMENDAS DE CONDUTOR PARTIDO, ESPAÇADOR, e outras não previstas nos itens de 1 a 16).', descricao: 'São necessárias a realização de emendas sejam nos cabos de média tensão ou baixa tensão, instalação de espaçadores longitudinares na rede épica, entre outros, visando não impactar nos indicadores de DEC e FEC.' },
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

  // Função para converter IDs de fotos em objetos FotoInfo com URLs
  function convertPhotoIdsToFotoInfo(photoField: any): FotoInfo[] {
    if (!photoField) return []

    // Se já é array de objetos com URL, retornar como está
    if (Array.isArray(photoField) && photoField.length > 0 && typeof photoField[0] === 'object' && photoField[0].url) {
      return photoField as FotoInfo[]
    }

    // Se é array de strings (IDs), converter para objetos com URL do storage
    if (Array.isArray(photoField) && photoField.length > 0 && typeof photoField[0] === 'string') {
      return photoField.map((photoId: string) => {
        // Gerar URL do Supabase Storage a partir do photo ID
        // Formato: obra-photos/{obraId}/{photoId}.jpg
        const { data } = supabase.storage
          .from('obra-photos')
          .getPublicUrl(`${photoId}`)

        return {
          url: data.publicUrl,
          latitude: null,
          longitude: null,
          placaData: null
        }
      })
    }

    return []
  }

  // Função para converter estruturas JSONB do checklist
  function convertChecklistJSONBPhotos(jsonbData: any): any {
    if (!jsonbData || !Array.isArray(jsonbData)) return jsonbData

    return jsonbData.map((item: any) => {
      const converted = { ...item }

      // Converter todos os campos que são arrays de IDs de fotos
      Object.keys(converted).forEach(key => {
        if (Array.isArray(converted[key])) {
          converted[key] = convertPhotoIdsToFotoInfo(converted[key])
        }
      })

      return converted
    })
  }

  async function loadObra(id: string) {
    try {
      const { data, error } = await supabase
        .from('obras')
        .select('*')
        .eq('id', id)
        .single()

      if (error) throw error

      // ✅ CORREÇÃO: Converter IDs de fotos em objetos FotoInfo
      const obraComFotos = {
        ...data,
        fotos_antes: convertPhotoIdsToFotoInfo(data.fotos_antes),
        fotos_durante: convertPhotoIdsToFotoInfo(data.fotos_durante),
        fotos_depois: convertPhotoIdsToFotoInfo(data.fotos_depois),
        fotos_abertura: convertPhotoIdsToFotoInfo(data.fotos_abertura),
        fotos_fechamento: convertPhotoIdsToFotoInfo(data.fotos_fechamento),
        fotos_ditais_abertura: convertPhotoIdsToFotoInfo(data.fotos_ditais_abertura),
        fotos_ditais_impedir: convertPhotoIdsToFotoInfo(data.fotos_ditais_impedir),
        fotos_ditais_testar: convertPhotoIdsToFotoInfo(data.fotos_ditais_testar),
        fotos_ditais_aterrar: convertPhotoIdsToFotoInfo(data.fotos_ditais_aterrar),
        fotos_ditais_sinalizar: convertPhotoIdsToFotoInfo(data.fotos_ditais_sinalizar),
        fotos_aterramento_vala_aberta: convertPhotoIdsToFotoInfo(data.fotos_aterramento_vala_aberta),
        fotos_aterramento_hastes: convertPhotoIdsToFotoInfo(data.fotos_aterramento_hastes),
        fotos_aterramento_vala_fechada: convertPhotoIdsToFotoInfo(data.fotos_aterramento_vala_fechada),
        fotos_aterramento_medicao: convertPhotoIdsToFotoInfo(data.fotos_aterramento_medicao),
        fotos_transformador_laudo: convertPhotoIdsToFotoInfo(data.fotos_transformador_laudo),
        fotos_transformador_componente_instalado: convertPhotoIdsToFotoInfo(data.fotos_transformador_componente_instalado),
        fotos_transformador_tombamento_instalado: convertPhotoIdsToFotoInfo(data.fotos_transformador_tombamento_instalado),
        fotos_transformador_tape: convertPhotoIdsToFotoInfo(data.fotos_transformador_tape),
        fotos_transformador_placa_instalado: convertPhotoIdsToFotoInfo(data.fotos_transformador_placa_instalado),
        fotos_transformador_instalado: convertPhotoIdsToFotoInfo(data.fotos_transformador_instalado),
        fotos_transformador_antes_retirar: convertPhotoIdsToFotoInfo(data.fotos_transformador_antes_retirar),
        fotos_transformador_tombamento_retirado: convertPhotoIdsToFotoInfo(data.fotos_transformador_tombamento_retirado),
        fotos_transformador_placa_retirado: convertPhotoIdsToFotoInfo(data.fotos_transformador_placa_retirado),
        fotos_medidor_padrao: convertPhotoIdsToFotoInfo(data.fotos_medidor_padrao),
        fotos_medidor_leitura: convertPhotoIdsToFotoInfo(data.fotos_medidor_leitura),
        fotos_medidor_selo_born: convertPhotoIdsToFotoInfo(data.fotos_medidor_selo_born),
        fotos_medidor_selo_caixa: convertPhotoIdsToFotoInfo(data.fotos_medidor_selo_caixa),
        fotos_medidor_identificador_fase: convertPhotoIdsToFotoInfo(data.fotos_medidor_identificador_fase),
        fotos_checklist_croqui: convertPhotoIdsToFotoInfo(data.fotos_checklist_croqui),
        fotos_checklist_panoramica_inicial: convertPhotoIdsToFotoInfo(data.fotos_checklist_panoramica_inicial),
        fotos_checklist_chede: convertPhotoIdsToFotoInfo(data.fotos_checklist_chede),
        fotos_checklist_aterramento_cerca: convertPhotoIdsToFotoInfo(data.fotos_checklist_aterramento_cerca),
        fotos_checklist_padrao_geral: convertPhotoIdsToFotoInfo(data.fotos_checklist_padrao_geral),
        fotos_checklist_padrao_interno: convertPhotoIdsToFotoInfo(data.fotos_checklist_padrao_interno),
        fotos_checklist_panoramica_final: convertPhotoIdsToFotoInfo(data.fotos_checklist_panoramica_final),
        fotos_checklist_postes: convertPhotoIdsToFotoInfo(data.fotos_checklist_postes),
        fotos_checklist_seccionamentos: convertPhotoIdsToFotoInfo(data.fotos_checklist_seccionamentos),
        fotos_altimetria_lado_fonte: convertPhotoIdsToFotoInfo(data.fotos_altimetria_lado_fonte),
        fotos_altimetria_medicao_fonte: convertPhotoIdsToFotoInfo(data.fotos_altimetria_medicao_fonte),
        fotos_altimetria_lado_carga: convertPhotoIdsToFotoInfo(data.fotos_altimetria_lado_carga),
        fotos_altimetria_medicao_carga: convertPhotoIdsToFotoInfo(data.fotos_altimetria_medicao_carga),
        fotos_vazamento_evidencia: convertPhotoIdsToFotoInfo(data.fotos_vazamento_evidencia),
        fotos_vazamento_equipamentos_limpeza: convertPhotoIdsToFotoInfo(data.fotos_vazamento_equipamentos_limpeza),
        fotos_vazamento_tombamento_retirado: convertPhotoIdsToFotoInfo(data.fotos_vazamento_tombamento_retirado),
        fotos_vazamento_placa_retirado: convertPhotoIdsToFotoInfo(data.fotos_vazamento_placa_retirado),
        fotos_vazamento_tombamento_instalado: convertPhotoIdsToFotoInfo(data.fotos_vazamento_tombamento_instalado),
        fotos_vazamento_placa_instalado: convertPhotoIdsToFotoInfo(data.fotos_vazamento_placa_instalado),
        fotos_vazamento_instalacao: convertPhotoIdsToFotoInfo(data.fotos_vazamento_instalacao),
        // Converter estruturas JSONB do checklist (formato novo)
        checklist_postes_data: convertChecklistJSONBPhotos(data.checklist_postes_data),
        checklist_seccionamentos_data: convertChecklistJSONBPhotos(data.checklist_seccionamentos_data),
        checklist_aterramentos_cerca_data: convertChecklistJSONBPhotos(data.checklist_aterramentos_cerca_data),
      }

      setObra(obraComFotos)

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
  const [selectedDropdownId, setSelectedDropdownId] = useState<number | null>(null)

  async function handleAddAtipicidade() {
    if (!obra || !selectedDropdownId) return

    // Não adicionar duplicadas
    if (selectedAtipicidades.includes(selectedDropdownId)) {
      alert('Esta atipicidade já foi adicionada')
      return
    }

    const newSelected = [...selectedAtipicidades, selectedDropdownId]

    // Gerar descrição concatenando TODAS as atipicidades selecionadas
    const descricoesAtipicidades = newSelected
      .map(id => {
        const atip = ATIPICIDADES.find(a => a.id === id)
        return atip ? atip.descricao : null
      })
      .filter(Boolean)
      .join('\n\n')

    setSelectedAtipicidades(newSelected)
    setDescricaoAtipicidade(descricoesAtipicidades)
    setSelectedDropdownId(null) // Reset dropdown
    await saveAtipicidades(newSelected, descricoesAtipicidades)
  }

  async function handleRemoveAtipicidade(id: number) {
    if (!obra) return

    const newSelected = selectedAtipicidades.filter(atipId => atipId !== id)

    // Recalcular descrição com as atipicidades restantes
    const descricoesAtipicidades = newSelected.length === 0
      ? ''
      : newSelected
          .map(atipId => {
            const atip = ATIPICIDADES.find(a => a.id === atipId)
            return atip ? atip.descricao : null
          })
          .filter(Boolean)
          .join('\n\n')

    setSelectedAtipicidades(newSelected)
    setDescricaoAtipicidade(descricoesAtipicidades)
    await saveAtipicidades(newSelected, descricoesAtipicidades)
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

      // ========== CRIAR ABA DE RELATÓRIO DE ATIPICIDADE ==========
      const workbook = XLSX.utils.book_new()

      // Criar array de dados ao invés de células manuais
      const worksheetData: any[][] = []

      // Linha 1: Cabeçalho (será mesclado depois)
      worksheetData.push(['LOGO TECCEL', '', '', 'RELATÓRIO DE ATIPICIDADE', '', '', '', 'energisa', '', ''])

      // Linha 2: Vazia (separador)
      worksheetData.push(['', '', '', '', '', '', '', '', '', ''])

      // Linha 3: DATA e OBRA
      worksheetData.push([
        `DATA: ${format(new Date(obra.data), 'dd/MM/yyyy')}`,
        '', '', '',
        `OBRA: ${obra.obra || '-'}`,
        '', '', '', '', ''
      ])

      // Linha 4: Vazia (separador)
      worksheetData.push(['', '', '', '', '', '', '', '', '', ''])

      // Linha 5: Header DESCRIÇÃO DA ATIPICIDADE
      worksheetData.push(['DESCRIÇÃO DA ATIPICIDADE', '', '', '', '', '', '', '', '', ''])

      // Linha 6: Vazia (separador)
      worksheetData.push(['', '', '', '', '', '', '', '', '', ''])

      // Linha 7: Headers das 3 colunas de atipicidades
      worksheetData.push(['Nº', 'Atipicidade', 'Descrição', 'Nº', 'Atipicidade', 'Descrição', 'Nº', 'Atipicidade', 'Descrição', ''])

      // Obter atipicidades selecionadas com detalhes
      const atipicidadesDetalhadas = (obra.atipicidades || [])
        .map(id => ATIPICIDADES.find(a => a.id === id))
        .filter(Boolean) as typeof ATIPICIDADES

      // Dividir em 3 colunas
      const porColuna = Math.ceil(atipicidadesDetalhadas.length / 3)
      const maxLinhas = Math.max(porColuna, 3) // Mínimo 3 linhas

      // Adicionar linhas de atipicidades (3 colunas)
      for (let i = 0; i < maxLinhas; i++) {
        const row: any[] = []

        // Coluna 1
        const atip1 = atipicidadesDetalhadas[i]
        if (atip1) {
          row.push(atip1.id, atip1.titulo, atip1.descricao)
        } else {
          row.push('', '', '')
        }

        // Coluna 2
        const atip2 = atipicidadesDetalhadas[i + porColuna]
        if (atip2) {
          row.push(atip2.id, atip2.titulo, atip2.descricao)
        } else {
          row.push('', '', '')
        }

        // Coluna 3
        const atip3 = atipicidadesDetalhadas[i + porColuna * 2]
        if (atip3) {
          row.push(atip3.id, atip3.titulo, atip3.descricao)
        } else {
          row.push('', '', '')
        }

        row.push('') // Coluna extra
        worksheetData.push(row)
      }

      // Criar worksheet a partir dos dados
      const ws = XLSX.utils.aoa_to_sheet(worksheetData)

      // Configurar mesclagens de células
      ws['!merges'] = [
        { s: { r: 0, c: 0 }, e: { r: 0, c: 2 } }, // LOGO TECCEL
        { s: { r: 0, c: 3 }, e: { r: 0, c: 6 } }, // RELATÓRIO DE ATIPICIDADE
        { s: { r: 0, c: 7 }, e: { r: 0, c: 9 } }, // energisa
        { s: { r: 2, c: 0 }, e: { r: 2, c: 3 } }, // DATA
        { s: { r: 2, c: 4 }, e: { r: 2, c: 9 } }, // OBRA
        { s: { r: 4, c: 0 }, e: { r: 4, c: 9 } }, // DESCRIÇÃO DA ATIPICIDADE
      ]

      // Configurar larguras das colunas
      ws['!cols'] = [
        { wch: 4 },  // Nº (col 1)
        { wch: 35 }, // Atipicidade (col 1)
        { wch: 45 }, // Descrição (col 1)
        { wch: 4 },  // Nº (col 2)
        { wch: 35 }, // Atipicidade (col 2)
        { wch: 45 }, // Descrição (col 2)
        { wch: 4 },  // Nº (col 3)
        { wch: 35 }, // Atipicidade (col 3)
        { wch: 45 }, // Descrição (col 3)
        { wch: 2 },  // Extra
      ]

      // Configurar alturas das linhas
      const rowHeights: any[] = []
      rowHeights[0] = { hpx: 40 }  // Cabeçalho
      rowHeights[2] = { hpx: 25 }  // DATA/OBRA
      rowHeights[4] = { hpx: 30 }  // DESCRIÇÃO header
      rowHeights[6] = { hpx: 25 }  // Headers colunas

      // Atipicidades - altura dinâmica
      for (let i = 7; i < worksheetData.length; i++) {
        rowHeights[i] = { hpx: 60 }
      }

      ws['!rows'] = rowHeights

      // Adicionar worksheet ao workbook
      XLSX.utils.book_append_sheet(workbook, ws, 'Relatório Atipicidade')

      // ========== ABA DE FOTOS ==========
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
      <AppShell>
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
                <h1 className="text-2xl sm:text-3xl lg:text-4xl font-semibold text-slate-900 tracking-tight">{obra.obra}</h1>
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

            {/* Adicionar Atipicidade */}
            <div className="mb-6">
              <h3 className="text-lg font-semibold text-gray-900 mb-3">Adicionar Atipicidade</h3>
              <div className="flex gap-3">
                <select
                  value={selectedDropdownId || ''}
                  onChange={(e) => setSelectedDropdownId(e.target.value ? Number(e.target.value) : null)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' && selectedDropdownId) {
                      handleAddAtipicidade()
                    }
                  }}
                  className="flex-1 px-4 py-3 border-2 border-gray-200 rounded-lg focus:border-orange-500 focus:ring-2 focus:ring-orange-200 outline-none transition-all text-sm"
                >
                  <option value="">Selecione uma atipicidade...</option>
                  {ATIPICIDADES.map((atip) => (
                    <option key={atip.id} value={atip.id}>
                      {atip.id}. {atip.titulo}
                    </option>
                  ))}
                </select>
                <button
                  onClick={handleAddAtipicidade}
                  disabled={!selectedDropdownId}
                  className="px-6 py-3 bg-orange-600 hover:bg-orange-700 text-white font-semibold rounded-lg shadow-md transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
                >
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
                  </svg>
                  Adicionar
                </button>
              </div>
            </div>

            {/* Lista de Atipicidades Selecionadas */}
            {selectedAtipicidades.length > 0 && (
              <div className="mb-6">
                <h3 className="text-lg font-semibold text-gray-900 mb-3">
                  Atipicidades Selecionadas ({selectedAtipicidades.length})
                </h3>
                <div className="space-y-3">
                  {selectedAtipicidades.map((id) => {
                    const atip = ATIPICIDADES.find(a => a.id === id)
                    if (!atip) return null
                    return (
                      <div
                        key={id}
                        className="bg-orange-50 border-l-4 border-orange-500 p-4 rounded-lg"
                      >
                        <div className="flex items-start justify-between gap-4">
                          <div className="flex-1">
                            <div className="flex items-center gap-2 mb-2">
                              <span className="w-8 h-8 bg-orange-500 text-white rounded-full flex items-center justify-center font-bold text-sm">
                                {atip.id}
                              </span>
                              <h4 className="font-semibold text-gray-900 text-sm">{atip.titulo}</h4>
                            </div>
                            <p className="text-gray-700 text-sm leading-relaxed">{atip.descricao}</p>
                          </div>
                          <button
                            onClick={() => handleRemoveAtipicidade(id)}
                            className="text-red-600 hover:text-red-800 hover:bg-red-100 p-2 rounded-lg transition-colors flex-shrink-0"
                            title="Remover atipicidade"
                          >
                            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                            </svg>
                          </button>
                        </div>
                      </div>
                    )
                  })}
                </div>
              </div>
            )}

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

            {/* Checklist de Fiscalização */}
            {(obra.fotos_checklist_croqui?.length || obra.fotos_checklist_panoramica_inicial?.length || obra.fotos_checklist_chede?.length || obra.fotos_checklist_aterramento_cerca?.length || getAterramentosFotos(obra).length > 0 || obra.fotos_checklist_padrao_geral?.length || obra.fotos_checklist_padrao_interno?.length || obra.fotos_checklist_panoramica_final?.length || obra.fotos_checklist_postes?.length || obra.fotos_checklist_seccionamentos?.length) ? (
              <div className="mt-8 pt-8 border-t border-gray-200">
                <h3 className="text-xl font-bold text-gray-900 mb-4">Checklist de Fiscalização</h3>
                <PhotoGallery photos={obra.fotos_checklist_croqui || []} title="Croqui" sectionKey="fotos_checklist_croqui" {...galleryProps} />
                <PhotoGallery photos={obra.fotos_checklist_panoramica_inicial || []} title="Panorâmica Inicial" sectionKey="fotos_checklist_panoramica_inicial" {...galleryProps} />
                <PhotoGallery photos={obra.fotos_checklist_chede || []} title="CHEDE" sectionKey="fotos_checklist_chede" {...galleryProps} />

                {/* Aterramentos - suporta formato novo (estruturado) e antigo */}
                {getAterramentosFotos(obra).map((aterramento, index) => (
                  <PhotoGallery
                    key={`aterramento_${index}`}
                    photos={aterramento.fotos}
                    title={aterramento.titulo}
                    sectionKey={`fotos_aterramento_${index}`}
                    {...galleryProps}
                  />
                ))}

                <PhotoGallery photos={obra.fotos_checklist_padrao_geral || []} title="Padrão Geral" sectionKey="fotos_checklist_padrao_geral" {...galleryProps} />
                <PhotoGallery photos={obra.fotos_checklist_padrao_interno || []} title="Padrão Interno" sectionKey="fotos_checklist_padrao_interno" {...galleryProps} />
                <PhotoGallery photos={obra.fotos_checklist_panoramica_final || []} title="Panorâmica Final" sectionKey="fotos_checklist_panoramica_final" {...galleryProps} />
                <PhotoGallery photos={obra.fotos_checklist_postes || []} title="Postes" sectionKey="fotos_checklist_postes" {...galleryProps} />
                <PhotoGallery photos={obra.fotos_checklist_seccionamentos || []} title="Seccionamentos" sectionKey="fotos_checklist_seccionamentos" {...galleryProps} />
              </div>
            ) : null}
          </div>
      </AppShell>
    </ProtectedRoute>
  )
}
