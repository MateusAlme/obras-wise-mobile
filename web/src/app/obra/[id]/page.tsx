'use client'

import { useEffect, useState } from 'react'
import { useParams, useRouter } from 'next/navigation'
import { supabase, type Obra, type FotoInfo } from '@/lib/supabase'
import { useAuth } from '@/contexts/AuthContext'
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
  'Checklist de Fiscalização': ['fotos_checklist_croqui', 'fotos_checklist_panoramica_inicial', 'fotos_checklist_chede', 'fotos_checklist_aterramento_cerca', 'fotos_checklist_padrao_geral', 'fotos_checklist_padrao_interno', 'fotos_checklist_frying', 'fotos_checklist_abertura_fechamento_pulo', 'fotos_checklist_panoramica_final', 'fotos_checklist_postes', 'fotos_checklist_seccionamentos'],
  'DITAIS': ['fotos_ditais_abertura', 'fotos_ditais_impedir', 'fotos_ditais_testar', 'fotos_ditais_aterrar', 'fotos_ditais_sinalizar'],
  'Ditais': ['fotos_ditais_abertura', 'fotos_ditais_impedir', 'fotos_ditais_testar', 'fotos_ditais_aterrar', 'fotos_ditais_sinalizar'],
  'Book de Aterramento': ['fotos_aterramento_vala_aberta', 'fotos_aterramento_hastes', 'fotos_aterramento_vala_fechada', 'fotos_aterramento_medicao'],
  'Aterramento': ['fotos_aterramento_vala_aberta', 'fotos_aterramento_hastes', 'fotos_aterramento_vala_fechada', 'fotos_aterramento_medicao'],
  'Medidor': ['fotos_medidor_padrao', 'fotos_medidor_leitura', 'fotos_medidor_selo_born', 'fotos_medidor_selo_caixa', 'fotos_medidor_identificador_fase'],
  'Altimetria': ['fotos_altimetria_lado_fonte', 'fotos_altimetria_medicao_fonte', 'fotos_altimetria_lado_carga', 'fotos_altimetria_medicao_carga'],
  'Vazamento': ['fotos_vazamento_evidencia', 'fotos_vazamento_equipamentos_limpeza', 'fotos_vazamento_tombamento_retirado', 'fotos_vazamento_placa_retirado', 'fotos_vazamento_tombamento_instalado', 'fotos_vazamento_placa_instalado', 'fotos_vazamento_instalacao'],
  'Checklist': ['fotos_checklist_croqui', 'fotos_checklist_panoramica_inicial', 'fotos_checklist_chede', 'fotos_checklist_aterramento_cerca', 'fotos_checklist_padrao_geral', 'fotos_checklist_padrao_interno', 'fotos_checklist_frying', 'fotos_checklist_abertura_fechamento_pulo', 'fotos_checklist_panoramica_final', 'fotos_checklist_postes', 'fotos_checklist_seccionamentos'],
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
const CHECKLIST_POSTE_FIELDS = [
  'posteInteiro',
  'engaste',
  'conexao1',
  'conexao2',
  'maiorEsforco',
  'menorEsforco'
] as const

const CHECKLIST_POSTE_TIPO_TO_FIELD: Record<string, (typeof CHECKLIST_POSTE_FIELDS)[number]> = {
  'inteiro': 'posteInteiro',
  'engaste': 'engaste',
  'conexao1': 'conexao1',
  'conexao2': 'conexao2',
  'maior_esforco': 'maiorEsforco',
  'menor_esforco': 'menorEsforco'
}

const CHECKLIST_POSTE_FIELD_TO_TIPO: Record<(typeof CHECKLIST_POSTE_FIELDS)[number], string> = {
  posteInteiro: 'inteiro',
  engaste: 'engaste',
  conexao1: 'conexao1',
  conexao2: 'conexao2',
  maiorEsforco: 'maior_esforco',
  menorEsforco: 'menor_esforco'
}

const CHECKLIST_POSTE_SECTION_TO_FIELD: Record<string, (typeof CHECKLIST_POSTE_FIELDS)[number]> = {
  inteiro: 'posteInteiro',
  engaste: 'engaste',
  conexao1: 'conexao1',
  conexao2: 'conexao2',
  maior: 'maiorEsforco',
  menor: 'menorEsforco',
}

type StructuredSectionTarget =
  | { kind: 'haste_termo'; photoType: 'fotoHaste' | 'fotoTermometro'; index: number }
  | { kind: 'poste'; field: (typeof CHECKLIST_POSTE_FIELDS)[number]; index: number }
  | { kind: 'seccionamento'; index: number }
  | { kind: 'aterramento'; index: number }

function parseStructuredSectionKey(sectionKey: string): StructuredSectionTarget | null {
  const hasteTermoMatch = sectionKey.match(/^(haste|termo)_(\d+)$/)
  if (hasteTermoMatch) {
    return {
      kind: 'haste_termo',
      photoType: hasteTermoMatch[1] === 'haste' ? 'fotoHaste' : 'fotoTermometro',
      index: parseInt(hasteTermoMatch[2], 10),
    }
  }

  const posteMatch = sectionKey.match(/^poste_(\d+)_(inteiro|engaste|conexao1|conexao2|maior|menor)$/)
  if (posteMatch) {
    return {
      kind: 'poste',
      index: parseInt(posteMatch[1], 10),
      field: CHECKLIST_POSTE_SECTION_TO_FIELD[posteMatch[2]],
    }
  }

  const seccMatch = sectionKey.match(/^secc_(\d+)_fotos$/)
  if (seccMatch) {
    return {
      kind: 'seccionamento',
      index: parseInt(seccMatch[1], 10),
    }
  }

  const aterramentoMatch = sectionKey.match(/^fotos_aterramento_(\d+)$/)
  if (aterramentoMatch) {
    return {
      kind: 'aterramento',
      index: parseInt(aterramentoMatch[1], 10),
    }
  }

  return null
}

function isHttpUrl(value: unknown): value is string {
  return typeof value === 'string' && value.startsWith('http')
}

function toFotoInfoIfUrl(item: any): FotoInfo | null {
  if (typeof item === 'object' && item !== null && isHttpUrl(item.url)) {
    if (item.url.startsWith('file:///')) return null
    return {
      url: item.url,
      latitude: item.latitude ?? null,
      longitude: item.longitude ?? null,
      utmX: item.utmX ?? item.utm_x ?? null,
      utmY: item.utmY ?? item.utm_y ?? null,
      utmZone: item.utmZone ?? item.utm_zone ?? null,
      placaData: item.placaData || item.placa_data || null
    }
  }

  if (isHttpUrl(item)) {
    return {
      url: item,
      latitude: null,
      longitude: null,
      utmX: null,
      utmY: null,
      utmZone: null,
      placaData: null
    }
  }

  return null
}

function extractChecklistPostePhotoInfo(url: string): { tipo: string; timestamp: number } | null {
  const filename = url.split('/').pop() || ''
  const match = filename.match(/checklist_poste_([a-z_]+\d?)_(\d+)_/)
  if (!match) return null
  return {
    tipo: match[1],
    timestamp: parseInt(match[2], 10)
  }
}

function normalizeChecklistPostesData(postesData: any[] | undefined): any[] | undefined {
  if (!postesData || !Array.isArray(postesData)) return postesData

  return postesData.map((poste: any) => {
    const normalized = { ...poste }

    for (const field of CHECKLIST_POSTE_FIELDS) {
      const source = Array.isArray(poste?.[field]) ? poste[field] : []
      normalized[field] = source
        .map((item: any) => {
          const foto = toFotoInfoIfUrl(item)
          if (foto) return foto

          if (typeof item === 'object' && item !== null && typeof item.id === 'string') {
            return {
              id: item.id,
              latitude: item.latitude ?? null,
              longitude: item.longitude ?? null,
              utmX: item.utmX ?? item.utm_x ?? null,
              utmY: item.utmY ?? item.utm_y ?? null,
              utmZone: item.utmZone ?? item.utm_zone ?? null
            }
          }

          if (typeof item === 'string' && item.trim()) {
            return { id: item }
          }

          return null
        })
        .filter(Boolean)
    }

    return normalized
  })
}

function hydrateChecklistPostesDataFromFlatByCounts(
  postesData: any[] | undefined,
  flatPhotos: FotoInfo[] | undefined
): any[] | undefined {
  if (!postesData || !Array.isArray(postesData) || postesData.length === 0) return postesData
  if (!flatPhotos || flatPhotos.length === 0) return postesData

  const parsedPhotos = flatPhotos
    .map(photo => {
      const info = extractChecklistPostePhotoInfo(photo.url || '')
      if (!info || !CHECKLIST_POSTE_TIPO_TO_FIELD[info.tipo]) return null
      return { photo, info }
    })
    .filter(Boolean) as Array<{ photo: FotoInfo; info: { tipo: string; timestamp: number } }>

  if (parsedPhotos.length === 0) return postesData

  const byTipo: Record<string, FotoInfo[]> = {
    inteiro: [],
    engaste: [],
    conexao1: [],
    conexao2: [],
    maior_esforco: [],
    menor_esforco: []
  }

  for (const item of parsedPhotos.sort((a, b) => a.info.timestamp - b.info.timestamp)) {
    if (byTipo[item.info.tipo]) {
      byTipo[item.info.tipo].push(item.photo)
    }
  }

  const cursors: Record<string, number> = {
    inteiro: 0,
    engaste: 0,
    conexao1: 0,
    conexao2: 0,
    maior_esforco: 0,
    menor_esforco: 0
  }

  return postesData.map((poste: any) => {
    const hydrated = { ...poste }

    for (const field of CHECKLIST_POSTE_FIELDS) {
      const current = Array.isArray(poste?.[field]) ? poste[field] : []
      const currentUrls = current.map(toFotoInfoIfUrl).filter(Boolean) as FotoInfo[]

      if (currentUrls.length > 0) {
        hydrated[field] = currentUrls
        continue
      }

      const placeholderCount = current.length
      if (placeholderCount === 0) {
        hydrated[field] = []
        continue
      }

      const tipo = CHECKLIST_POSTE_FIELD_TO_TIPO[field]
      const source = byTipo[tipo] || []
      const start = cursors[tipo] || 0
      const end = Math.min(start + placeholderCount, source.length)
      hydrated[field] = source.slice(start, end)
      cursors[tipo] = end
    }

    return hydrated
  })
}

/**
 * Mescla fotos do array flat (fotos_checklist_postes) com a estrutura de postes (checklist_postes_data)
 * Extrai o tipo de foto e associa ao poste correto baseado na sequência temporal
 */
function mergePostesPhotosWithStructure(
  postesData: any[] | undefined,
  flatPhotos: FotoInfo[] | undefined
): any[] | undefined {
  if (!postesData || postesData.length === 0) return postesData
  if (!flatPhotos || flatPhotos.length === 0) return postesData

  const parsedPhotos = flatPhotos
    .map(photo => {
      const url = photo.url || ''
      const info = extractChecklistPostePhotoInfo(url)
      if (!info || !CHECKLIST_POSTE_TIPO_TO_FIELD[info.tipo]) return null
      return { photo, info }
    })
    .filter(Boolean) as Array<{ photo: FotoInfo; info: { tipo: string; timestamp: number } }>

  if (parsedPhotos.length === 0) return postesData

  const sortedPhotos = [...parsedPhotos].sort((a, b) => a.info.timestamp - b.info.timestamp)

  // Mapeamento confiável: precisa de um marcador "inteiro" por poste.
  const inteiroTimestamps = sortedPhotos
    .filter(item => item.info.tipo === 'inteiro')
    .map(item => item.info.timestamp)

  if (inteiroTimestamps.length !== postesData.length) {
    return postesData
  }

  // Agrupar fotos por poste baseado nos timestamps "inteiro"
  const photoGroups: { posteIndex: number; tipo: string; photo: FotoInfo }[] = []

  for (const item of sortedPhotos) {
    const { photo, info } = item

    // Determinar a qual poste esta foto pertence
    // Encontrar o índice do último "inteiro" que veio ANTES ou NO MESMO timestamp desta foto
    let posteIndex = 0
    for (let i = 0; i < inteiroTimestamps.length; i++) {
      if (info.timestamp >= inteiroTimestamps[i]) {
        posteIndex = i
      } else {
        break
      }
    }

    // Garantir que não exceda o número de postes disponíveis
    if (posteIndex < postesData.length) {
      photoGroups.push({
        posteIndex,
        tipo: info.tipo,
        photo
      })
    }
  }

  // Segurança: quando não há estrutura confiável por campo, evitar agrupar tudo em um único poste.
  const nonInteiroGroups = photoGroups.filter(group => group.tipo !== 'inteiro')
  if (postesData.length > 1 && nonInteiroGroups.length > 1) {
    const uniquePostes = new Set(nonInteiroGroups.map(group => group.posteIndex))
    if (uniquePostes.size === 1) {
      return postesData
    }
  }

  // Criar cópia profunda dos postes e adicionar as fotos
  const mergedPostes = postesData.map((poste, index) => {
    const mergedPoste = {
      ...poste,
      posteInteiro: [...(poste.posteInteiro || [])],
      engaste: [...(poste.engaste || [])],
      conexao1: [...(poste.conexao1 || [])],
      conexao2: [...(poste.conexao2 || [])],
      maiorEsforco: [...(poste.maiorEsforco || [])],
      menorEsforco: [...(poste.menorEsforco || [])]
    }

    // Adicionar fotos deste poste
    for (const group of photoGroups) {
      if (group.posteIndex === index) {
        const field = CHECKLIST_POSTE_TIPO_TO_FIELD[group.tipo]
        if (field && mergedPoste[field]) {
          // Verificar se a foto já não existe (evitar duplicatas)
          const exists = mergedPoste[field]
            .map(toFotoInfoIfUrl)
            .filter(Boolean)
            .some((f: FotoInfo | null) => f?.url === group.photo.url)
          if (!exists) {
            mergedPoste[field].push(group.photo)
          }
        }
      }
    }

    return mergedPoste
  })

  return mergedPostes
}

/**
 * Verifica se um campo estruturado tem fotos reais
 */
function hasRealPhotos(structuredData: any[] | undefined): boolean {
  if (!structuredData || !Array.isArray(structuredData) || structuredData.length === 0) {
    return false
  }
  // Verificar se algum item tem fotos reais em seus arrays
  return structuredData.some((item: any) => {
    if (!item) return false
    // Verificar todos os campos que podem conter fotos
    const photoFields = ['posteInteiro', 'engaste', 'conexao1', 'conexao2', 'maiorEsforco', 'menorEsforco', 'fotos', 'fotoHaste', 'fotoTermometro']
    return photoFields.some(field => {
      const value = item[field]
      return Array.isArray(value) && value.some((photo: any) => !!toFotoInfoIfUrl(photo))
    })
  })
}

function clearChecklistPostesPhotos(postesData: any[] | undefined): any[] | undefined {
  if (!postesData || !Array.isArray(postesData)) return postesData

  return postesData.map((poste: any) => ({
    ...poste,
    posteInteiro: [],
    engaste: [],
    conexao1: [],
    conexao2: [],
    maiorEsforco: [],
    menorEsforco: []
  }))
}

function getChecklistPostesForDisplay(
  postesData: any[] | undefined,
  flatPhotos: FotoInfo[] | undefined
): any[] | undefined {
  const normalizedPostes = normalizeChecklistPostesData(postesData)
  if (!normalizedPostes || !Array.isArray(normalizedPostes) || normalizedPostes.length === 0) {
    return normalizedPostes
  }

  const hasFlat = !!flatPhotos && flatPhotos.length > 0

  // Primeiro: tentar hidratar usando a própria estrutura (quantidade por poste/campo) + flat.
  const hydratedByCount = hasFlat
    ? hydrateChecklistPostesDataFromFlatByCounts(normalizedPostes, flatPhotos)
    : normalizedPostes

  if (hasRealPhotos(hydratedByCount)) {
    return hydratedByCount
  }

  // Segundo: fallback por timestamp (requer "inteiro" para todos os postes).
  if (hasFlat) {
    const emptyPostes = clearChecklistPostesPhotos(normalizedPostes)
    const remapped = mergePostesPhotosWithStructure(emptyPostes, flatPhotos)
    if (hasRealPhotos(remapped)) {
      return remapped
    }
  }

  return clearChecklistPostesPhotos(normalizedPostes)
}

function getAterramentosFotos(obra: Obra): { titulo: string; fotos: FotoInfo[] }[] {
  // Tentar usar formato novo (estruturado) - mas só se tiver fotos reais
  if (hasRealPhotos(obra.checklist_aterramentos_cerca_data)) {
    return obra.checklist_aterramentos_cerca_data?.map((aterr: any, index: number) => ({
      titulo: `Checklist - Aterramento de Cerca A${aterr.numero || (index + 1)}`,
      fotos: aterr.fotos || []
    })) || []
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
  const [finalizandoObra, setFinalizandoObra] = useState(false)
  const [selectedAtipicidades, setSelectedAtipicidades] = useState<number[]>([])
  const { isAdmin } = useAuth()
  const [descricaoAtipicidade, setDescricaoAtipicidade] = useState('')

  useEffect(() => {
    if (params.id) {
      loadObra(params.id as string)
    }
  }, [params.id])

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
          console.warn('⚠️ [convertPhotoIdsToFotoInfo] URL local ignorada:', item.url.substring(0, 60))
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

      // CASO 2: String que já é URL completa (começa com http)
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

      // CASO 3: String que é um photo ID (formato: obraId_type_index_timestamp ou local_timestamp_type_index_timestamp)
      // Tentar reconstruir a URL do storage
      if (typeof item === 'string') {
        // Tentar buscar a foto no storage usando o ID como nome do arquivo
        // O storage usa o padrão: obra-photos/{obraId}/{photoId}
        const photoId = item

        // Se começa com "local_" ou tem padrão de ID temporário, não conseguimos reconstruir
        if (photoId.startsWith('temp_') || photoId.startsWith('local_')) {
          console.warn('⚠️ [convertPhotoIdsToFotoInfo] PhotoID temporário encontrado:', photoId)
          console.warn('   Esta foto nunca foi sincronizada corretamente.')
          return null
        }

        // Tentar reconstruir a URL usando o padrão do Supabase Storage
        // Formato: https://{project}.supabase.co/storage/v1/object/public/obra-photos/{photoId}
        const storageUrl = `${supabase.storage.from('obra-photos').getPublicUrl(photoId).data.publicUrl}`

        console.log('ℹ️ [convertPhotoIdsToFotoInfo] Reconstruindo URL para photoID:', photoId)
        console.log('   URL reconstruída:', storageUrl)

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
    }).filter(Boolean) as FotoInfo[]
  }

  function convertChecklistPhotoRefs(photoField: any): any[] {
    if (!Array.isArray(photoField) || photoField.length === 0) return []

    return photoField.map((item: any) => {
      const foto = toFotoInfoIfUrl(item)
      if (foto) return foto

      if (typeof item === 'object' && item !== null && typeof item.id === 'string') {
        return {
          id: item.id,
          latitude: item.latitude ?? null,
          longitude: item.longitude ?? null,
          utmX: item.utmX ?? item.utm_x ?? null,
          utmY: item.utmY ?? item.utm_y ?? null,
          utmZone: item.utmZone ?? item.utm_zone ?? null
        }
      }

      if (typeof item === 'string' && item.trim()) {
        return { id: item }
      }

      return null
    }).filter(Boolean)
  }

  // Função para converter estruturas JSONB do checklist
  function convertChecklistJSONBPhotos(jsonbData: any): any {
    if (!jsonbData || !Array.isArray(jsonbData)) return jsonbData

    return jsonbData.map((item: any) => {
      const converted = { ...item }

      // Converter todos os campos que são arrays de IDs de fotos
      Object.keys(converted).forEach(key => {
        if (Array.isArray(converted[key])) {
          converted[key] = convertChecklistPhotoRefs(converted[key])
        }
      })

      return converted
    })
  }

  function convertChecklistPostesJSONBPhotos(
    jsonbData: any,
    flatPhotos: FotoInfo[]
  ): any {
    const normalized = normalizeChecklistPostesData(jsonbData)
    if (!normalized || !Array.isArray(normalized)) return normalized
    return getChecklistPostesForDisplay(normalized, flatPhotos)
  }

  async function loadObra(id: string) {
    try {
      const { data, error } = await supabase
        .from('obras')
        .select('*')
        .eq('id', id)
        .single()

      if (error) throw error

      const fotosChecklistPostes = convertPhotoIdsToFotoInfo(data.fotos_checklist_postes)

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
        fotos_checklist_postes: fotosChecklistPostes,
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
        checklist_postes_data: convertChecklistPostesJSONBPhotos(data.checklist_postes_data, fotosChecklistPostes),
        checklist_seccionamentos_data: convertChecklistJSONBPhotos(data.checklist_seccionamentos_data),
        checklist_aterramentos_cerca_data: convertChecklistJSONBPhotos(data.checklist_aterramentos_cerca_data),
        checklist_hastes_termometros_data: convertChecklistJSONBPhotos(data.checklist_hastes_termometros_data),
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

  async function tryRemovePhotoFromStorage(url?: string) {
    if (!url) return
    const storagePath = extractStoragePathFromPublicUrl(url)
    if (!storagePath) return
    const { error } = await supabase.storage.from('obra-photos').remove([storagePath])
    if (error) {
      console.warn('Nao foi possivel remover do storage:', error.message)
    }
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

      const structuredTarget = parseStructuredSectionKey(sectionKey)
      if (structuredTarget?.kind === 'haste_termo') {
        const photoType = structuredTarget.photoType
        const pontoIndex = structuredTarget.index
        const pontos = Array.isArray(obra.checklist_hastes_termometros_data)
          ? [...obra.checklist_hastes_termometros_data]
          : []

        if (!Number.isInteger(pontoIndex) || pontoIndex < 0 || pontoIndex >= pontos.length) {
          throw new Error('Ponto de haste/termômetro inválido para adicionar foto')
        }

        const pontoAtual = { ...pontos[pontoIndex] }
        const currentPhotos = Array.isArray(pontoAtual[photoType]) ? [...pontoAtual[photoType]] : []
        pontoAtual[photoType] = [...currentPhotos, newPhoto]
        pontos[pontoIndex] = pontoAtual

        const { error } = await supabase
          .from('obras')
          .update({ checklist_hastes_termometros_data: pontos })
          .eq('id', obra.id)
        if (error) throw error

        setObra({ ...obra, checklist_hastes_termometros_data: pontos })
        return newPhoto
      }

      if (structuredTarget?.kind === 'poste') {
        const posteIndex = structuredTarget.index
        const field = structuredTarget.field
        const postes = Array.isArray(obra.checklist_postes_data) ? [...obra.checklist_postes_data] : []
        if (!Number.isInteger(posteIndex) || posteIndex < 0 || posteIndex >= postes.length) {
          throw new Error('Poste inválido para adicionar foto')
        }

        const posteAtual = { ...postes[posteIndex] }
        const currentPhotos = Array.isArray(posteAtual[field]) ? [...posteAtual[field]] : []
        posteAtual[field] = [...currentPhotos, newPhoto]
        postes[posteIndex] = posteAtual

        const { error } = await supabase
          .from('obras')
          .update({ checklist_postes_data: postes })
          .eq('id', obra.id)
        if (error) throw error

        setObra({ ...obra, checklist_postes_data: postes })
        return newPhoto
      }

      if (structuredTarget?.kind === 'seccionamento') {
        const seccIndex = structuredTarget.index
        const seccionamentos = Array.isArray(obra.checklist_seccionamentos_data)
          ? [...obra.checklist_seccionamentos_data]
          : []
        if (!Number.isInteger(seccIndex) || seccIndex < 0 || seccIndex >= seccionamentos.length) {
          throw new Error('Seccionamento inválido para adicionar foto')
        }

        const seccAtual = { ...seccionamentos[seccIndex] }
        const currentPhotos = Array.isArray(seccAtual.fotos) ? [...seccAtual.fotos] : []
        seccAtual.fotos = [...currentPhotos, newPhoto]
        seccionamentos[seccIndex] = seccAtual

        const { error } = await supabase
          .from('obras')
          .update({ checklist_seccionamentos_data: seccionamentos })
          .eq('id', obra.id)
        if (error) throw error

        setObra({ ...obra, checklist_seccionamentos_data: seccionamentos })
        return newPhoto
      }

      if (structuredTarget?.kind === 'aterramento') {
        const aterramentoIndex = structuredTarget.index
        const aterramentos = Array.isArray(obra.checklist_aterramentos_cerca_data)
          ? [...obra.checklist_aterramentos_cerca_data]
          : []
        if (!Number.isInteger(aterramentoIndex) || aterramentoIndex < 0 || aterramentoIndex >= aterramentos.length) {
          throw new Error('Aterramento inválido para adicionar foto')
        }

        const aterrAtual = { ...aterramentos[aterramentoIndex] }
        const currentPhotos = Array.isArray(aterrAtual.fotos) ? [...aterrAtual.fotos] : []
        aterrAtual.fotos = [...currentPhotos, newPhoto]
        aterramentos[aterramentoIndex] = aterrAtual

        const { error } = await supabase
          .from('obras')
          .update({ checklist_aterramentos_cerca_data: aterramentos })
          .eq('id', obra.id)
        if (error) throw error

        setObra({ ...obra, checklist_aterramentos_cerca_data: aterramentos })
        return newPhoto
      }

      if (!(sectionKey in obra)) {
        throw new Error(`Secao de foto invalida: ${sectionKey}`)
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
      const structuredTarget = parseStructuredSectionKey(sectionKey)
      if (structuredTarget?.kind === 'haste_termo') {
        const photoType = structuredTarget.photoType
        const pontoIndex = structuredTarget.index
        const pontos = Array.isArray(obra.checklist_hastes_termometros_data)
          ? [...obra.checklist_hastes_termometros_data]
          : []

        if (!Number.isInteger(pontoIndex) || pontoIndex < 0 || pontoIndex >= pontos.length) {
          return null
        }

        const pontoAtual = { ...pontos[pontoIndex] }
        const currentPhotos = Array.isArray(pontoAtual[photoType]) ? [...pontoAtual[photoType]] : []
        if (!currentPhotos[index]) return null
        currentPhotos[index] = updatedPhoto
        pontoAtual[photoType] = currentPhotos
        pontos[pontoIndex] = pontoAtual

        const { error } = await supabase
          .from('obras')
          .update({ checklist_hastes_termometros_data: pontos })
          .eq('id', obra.id)
        if (error) throw error

        setObra({ ...obra, checklist_hastes_termometros_data: pontos })
        return updatedPhoto
      }

      if (structuredTarget?.kind === 'poste') {
        const posteIndex = structuredTarget.index
        const field = structuredTarget.field
        const postes = Array.isArray(obra.checklist_postes_data) ? [...obra.checklist_postes_data] : []
        if (!Number.isInteger(posteIndex) || posteIndex < 0 || posteIndex >= postes.length) {
          return null
        }

        const posteAtual = { ...postes[posteIndex] }
        const currentPhotos = Array.isArray(posteAtual[field]) ? [...posteAtual[field]] : []
        if (!currentPhotos[index]) return null
        currentPhotos[index] = updatedPhoto
        posteAtual[field] = currentPhotos
        postes[posteIndex] = posteAtual

        const { error } = await supabase
          .from('obras')
          .update({ checklist_postes_data: postes })
          .eq('id', obra.id)
        if (error) throw error

        setObra({ ...obra, checklist_postes_data: postes })
        return updatedPhoto
      }

      if (structuredTarget?.kind === 'seccionamento') {
        const seccIndex = structuredTarget.index
        const seccionamentos = Array.isArray(obra.checklist_seccionamentos_data)
          ? [...obra.checklist_seccionamentos_data]
          : []
        if (!Number.isInteger(seccIndex) || seccIndex < 0 || seccIndex >= seccionamentos.length) {
          return null
        }

        const seccAtual = { ...seccionamentos[seccIndex] }
        const currentPhotos = Array.isArray(seccAtual.fotos) ? [...seccAtual.fotos] : []
        if (!currentPhotos[index]) return null
        currentPhotos[index] = updatedPhoto
        seccAtual.fotos = currentPhotos
        seccionamentos[seccIndex] = seccAtual

        const { error } = await supabase
          .from('obras')
          .update({ checklist_seccionamentos_data: seccionamentos })
          .eq('id', obra.id)
        if (error) throw error

        setObra({ ...obra, checklist_seccionamentos_data: seccionamentos })
        return updatedPhoto
      }

      if (structuredTarget?.kind === 'aterramento') {
        const aterramentoIndex = structuredTarget.index
        const aterramentos = Array.isArray(obra.checklist_aterramentos_cerca_data)
          ? [...obra.checklist_aterramentos_cerca_data]
          : []
        if (!Number.isInteger(aterramentoIndex) || aterramentoIndex < 0 || aterramentoIndex >= aterramentos.length) {
          return null
        }

        const aterrAtual = { ...aterramentos[aterramentoIndex] }
        const currentPhotos = Array.isArray(aterrAtual.fotos) ? [...aterrAtual.fotos] : []
        if (!currentPhotos[index]) return null
        currentPhotos[index] = updatedPhoto
        aterrAtual.fotos = currentPhotos
        aterramentos[aterramentoIndex] = aterrAtual

        const { error } = await supabase
          .from('obras')
          .update({ checklist_aterramentos_cerca_data: aterramentos })
          .eq('id', obra.id)
        if (error) throw error

        setObra({ ...obra, checklist_aterramentos_cerca_data: aterramentos })
        return updatedPhoto
      }

      if (!(sectionKey in obra)) {
        throw new Error(`Secao de foto invalida: ${sectionKey}`)
      }

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
      const structuredTarget = parseStructuredSectionKey(sectionKey)
      if (structuredTarget?.kind === 'haste_termo') {
        const photoType = structuredTarget.photoType
        const pontoIndex = structuredTarget.index
        const pontos = Array.isArray(obra.checklist_hastes_termometros_data)
          ? [...obra.checklist_hastes_termometros_data]
          : []

        if (!Number.isInteger(pontoIndex) || pontoIndex < 0 || pontoIndex >= pontos.length) {
          return null
        }

        const pontoAtual = { ...pontos[pontoIndex] }
        const currentPhotos = Array.isArray(pontoAtual[photoType]) ? [...pontoAtual[photoType]] : []
        if (!currentPhotos[index]) return null
        const nextPhoto: FotoInfo = {
          ...currentPhotos[index],
          url,
        }
        currentPhotos[index] = nextPhoto
        pontoAtual[photoType] = currentPhotos
        pontos[pontoIndex] = pontoAtual

        const { error } = await supabase
          .from('obras')
          .update({ checklist_hastes_termometros_data: pontos })
          .eq('id', obra.id)
        if (error) throw error

        setObra({ ...obra, checklist_hastes_termometros_data: pontos })
        return nextPhoto
      }

      if (structuredTarget?.kind === 'poste') {
        const posteIndex = structuredTarget.index
        const field = structuredTarget.field
        const postes = Array.isArray(obra.checklist_postes_data) ? [...obra.checklist_postes_data] : []
        if (!Number.isInteger(posteIndex) || posteIndex < 0 || posteIndex >= postes.length) {
          return null
        }

        const posteAtual = { ...postes[posteIndex] }
        const currentPhotos = Array.isArray(posteAtual[field]) ? [...posteAtual[field]] : []
        if (!currentPhotos[index]) return null

        const nextPhoto: FotoInfo = {
          ...currentPhotos[index],
          url,
        }
        currentPhotos[index] = nextPhoto
        posteAtual[field] = currentPhotos
        postes[posteIndex] = posteAtual

        const { error } = await supabase
          .from('obras')
          .update({ checklist_postes_data: postes })
          .eq('id', obra.id)
        if (error) throw error

        setObra({ ...obra, checklist_postes_data: postes })
        return nextPhoto
      }

      if (structuredTarget?.kind === 'seccionamento') {
        const seccIndex = structuredTarget.index
        const seccionamentos = Array.isArray(obra.checklist_seccionamentos_data)
          ? [...obra.checklist_seccionamentos_data]
          : []
        if (!Number.isInteger(seccIndex) || seccIndex < 0 || seccIndex >= seccionamentos.length) {
          return null
        }

        const seccAtual = { ...seccionamentos[seccIndex] }
        const currentPhotos = Array.isArray(seccAtual.fotos) ? [...seccAtual.fotos] : []
        if (!currentPhotos[index]) return null

        const nextPhoto: FotoInfo = {
          ...currentPhotos[index],
          url,
        }
        currentPhotos[index] = nextPhoto
        seccAtual.fotos = currentPhotos
        seccionamentos[seccIndex] = seccAtual

        const { error } = await supabase
          .from('obras')
          .update({ checklist_seccionamentos_data: seccionamentos })
          .eq('id', obra.id)
        if (error) throw error

        setObra({ ...obra, checklist_seccionamentos_data: seccionamentos })
        return nextPhoto
      }

      if (structuredTarget?.kind === 'aterramento') {
        const aterramentoIndex = structuredTarget.index
        const aterramentos = Array.isArray(obra.checklist_aterramentos_cerca_data)
          ? [...obra.checklist_aterramentos_cerca_data]
          : []
        if (!Number.isInteger(aterramentoIndex) || aterramentoIndex < 0 || aterramentoIndex >= aterramentos.length) {
          return null
        }

        const aterrAtual = { ...aterramentos[aterramentoIndex] }
        const currentPhotos = Array.isArray(aterrAtual.fotos) ? [...aterrAtual.fotos] : []
        if (!currentPhotos[index]) return null

        const nextPhoto: FotoInfo = {
          ...currentPhotos[index],
          url,
        }
        currentPhotos[index] = nextPhoto
        aterrAtual.fotos = currentPhotos
        aterramentos[aterramentoIndex] = aterrAtual

        const { error } = await supabase
          .from('obras')
          .update({ checklist_aterramentos_cerca_data: aterramentos })
          .eq('id', obra.id)
        if (error) throw error

        setObra({ ...obra, checklist_aterramentos_cerca_data: aterramentos })
        return nextPhoto
      }

      if (!(sectionKey in obra)) {
        throw new Error(`Secao de foto invalida: ${sectionKey}`)
      }

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
  async function handleDeletePhoto(
    sectionKey: string,
    index: number,
    photo: FotoInfo
  ): Promise<boolean> {
    if (!obra) return false
    try {
      const structuredTarget = parseStructuredSectionKey(sectionKey)
      if (structuredTarget?.kind === 'haste_termo') {
        const photoType = structuredTarget.photoType
        const pontoIndex = structuredTarget.index
        const pontos = Array.isArray(obra.checklist_hastes_termometros_data)
          ? [...obra.checklist_hastes_termometros_data]
          : []
        if (!Number.isInteger(pontoIndex) || pontoIndex < 0 || pontoIndex >= pontos.length) {
          return false
        }

        const pontoAtual = { ...pontos[pontoIndex] }
        const currentPhotos = Array.isArray(pontoAtual[photoType]) ? [...pontoAtual[photoType]] : []
        if (!currentPhotos[index]) return false
        const nextPhotos = currentPhotos.filter((_, photoIndex) => photoIndex !== index)
        pontoAtual[photoType] = nextPhotos
        pontos[pontoIndex] = pontoAtual

        const { error } = await supabase
          .from('obras')
          .update({ checklist_hastes_termometros_data: pontos })
          .eq('id', obra.id)
        if (error) throw error

        setObra({ ...obra, checklist_hastes_termometros_data: pontos })
        await tryRemovePhotoFromStorage(photo.url)
        return true
      }

      if (structuredTarget?.kind === 'poste') {
        const posteIndex = structuredTarget.index
        const field = structuredTarget.field
        const postes = Array.isArray(obra.checklist_postes_data) ? [...obra.checklist_postes_data] : []
        if (!Number.isInteger(posteIndex) || posteIndex < 0 || posteIndex >= postes.length) {
          return false
        }

        const posteAtual = { ...postes[posteIndex] }
        const currentPhotos = Array.isArray(posteAtual[field]) ? [...posteAtual[field]] : []
        if (!currentPhotos[index]) return false
        const nextPhotos = currentPhotos.filter((_, photoIndex) => photoIndex !== index)
        posteAtual[field] = nextPhotos
        postes[posteIndex] = posteAtual

        const { error } = await supabase
          .from('obras')
          .update({ checklist_postes_data: postes })
          .eq('id', obra.id)
        if (error) throw error

        setObra({ ...obra, checklist_postes_data: postes })
        await tryRemovePhotoFromStorage(photo.url)
        return true
      }

      if (structuredTarget?.kind === 'seccionamento') {
        const seccIndex = structuredTarget.index
        const seccionamentos = Array.isArray(obra.checklist_seccionamentos_data)
          ? [...obra.checklist_seccionamentos_data]
          : []
        if (!Number.isInteger(seccIndex) || seccIndex < 0 || seccIndex >= seccionamentos.length) {
          return false
        }

        const seccAtual = { ...seccionamentos[seccIndex] }
        const currentPhotos = Array.isArray(seccAtual.fotos) ? [...seccAtual.fotos] : []
        if (!currentPhotos[index]) return false
        const nextPhotos = currentPhotos.filter((_, photoIndex) => photoIndex !== index)
        seccAtual.fotos = nextPhotos
        seccionamentos[seccIndex] = seccAtual

        const { error } = await supabase
          .from('obras')
          .update({ checklist_seccionamentos_data: seccionamentos })
          .eq('id', obra.id)
        if (error) throw error

        setObra({ ...obra, checklist_seccionamentos_data: seccionamentos })
        await tryRemovePhotoFromStorage(photo.url)
        return true
      }

      if (structuredTarget?.kind === 'aterramento') {
        const aterramentoIndex = structuredTarget.index
        const aterramentos = Array.isArray(obra.checklist_aterramentos_cerca_data)
          ? [...obra.checklist_aterramentos_cerca_data]
          : []
        if (!Number.isInteger(aterramentoIndex) || aterramentoIndex < 0 || aterramentoIndex >= aterramentos.length) {
          return false
        }

        const aterrAtual = { ...aterramentos[aterramentoIndex] }
        const currentPhotos = Array.isArray(aterrAtual.fotos) ? [...aterrAtual.fotos] : []
        if (!currentPhotos[index]) return false
        const nextPhotos = currentPhotos.filter((_, photoIndex) => photoIndex !== index)
        aterrAtual.fotos = nextPhotos
        aterramentos[aterramentoIndex] = aterrAtual

        const { error } = await supabase
          .from('obras')
          .update({ checklist_aterramentos_cerca_data: aterramentos })
          .eq('id', obra.id)
        if (error) throw error

        setObra({ ...obra, checklist_aterramentos_cerca_data: aterramentos })
        await tryRemovePhotoFromStorage(photo.url)
        return true
      }

      if (!(sectionKey in obra)) {
        throw new Error(`Secao de foto invalida: ${sectionKey}`)
      }

      const currentPhotos = (obra as any)[sectionKey] as FotoInfo[] | undefined || []
      if (!currentPhotos[index]) return false
      const nextPhotos = currentPhotos.filter((_, photoIndex) => photoIndex !== index)
      const { error } = await supabase
        .from('obras')
        .update({ [sectionKey]: nextPhotos })
        .eq('id', obra.id)
      if (error) throw error

      setObra({ ...obra, [sectionKey]: nextPhotos })
      await tryRemovePhotoFromStorage(photo.url)
      return true
    } catch (error) {
      console.error('Erro ao excluir foto:', error)
      alert('Erro ao excluir foto')
      return false
    }
  }

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

  async function handleFinalizarObra() {
    if (!obra || !window.confirm('Confirmar finalização da obra? O status será alterado para Concluída.')) return
    setFinalizandoObra(true)
    try {
      const dataFechamento = new Date().toISOString()
      const { error } = await supabase
        .from('obras')
        .update({ data_fechamento: dataFechamento })
        .eq('id', obra.id)
      if (error) throw error
      setObra({ ...obra, data_fechamento: dataFechamento })
    } catch (error) {
      console.error('Erro ao finalizar obra:', error)
      alert('Erro ao finalizar obra')
    } finally {
      setFinalizandoObra(false)
    }
  }

  async function handleReabrirObra() {
    if (!obra || !window.confirm('Confirmar reabertura da obra? O status voltará para Em Andamento.')) return
    setFinalizandoObra(true)
    try {
      const { error } = await supabase
        .from('obras')
        .update({ data_fechamento: null })
        .eq('id', obra.id)
      if (error) throw error
      setObra({ ...obra, data_fechamento: null })
    } catch (error) {
      console.error('Erro ao reabrir obra:', error)
      alert('Erro ao reabrir obra')
    } finally {
      setFinalizandoObra(false)
    }
  }

  if (loading) {
    return (
      <ProtectedRoute>
        <div className="min-h-screen flex items-center justify-center">
          <div className="text-center space-y-3">
            <div className="spinner mx-auto" />
            <p className="text-sm font-medium text-gray-500">Carregando obra...</p>
          </div>
        </div>
      </ProtectedRoute>
    )
  }

  if (!obra) {
    return (
      <ProtectedRoute>
        <div className="min-h-screen flex items-center justify-center">
          <div className="text-center space-y-4">
            <div className="w-16 h-16 bg-gray-100 rounded-2xl flex items-center justify-center mx-auto">
              <svg className="w-8 h-8 text-gray-300" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" />
              </svg>
            </div>
            <p className="text-base font-medium text-gray-500">Obra não encontrada</p>
            <button
              onClick={handleGoBack}
              className="btn-ghost mx-auto"
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
    onDeletePhoto: handleDeletePhoto,
  }

  return (
    <ProtectedRoute>
      <AppShell>
          {/* Header */}
          <div className="mb-6 space-y-4">
            <button
              onClick={handleGoBack}
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
                  <h1 className="text-2xl sm:text-3xl lg:text-4xl font-semibold text-slate-900 tracking-tight">{obra.obra}</h1>
                  {obra.data_fechamento ? (
                    <span className="px-3 py-1 bg-green-100 text-green-800 border border-green-200 text-sm font-semibold rounded-full flex items-center gap-1.5">
                      <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                      </svg>
                      Concluída
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
                    {obra.equipe}
                  </span>
                  <span className="text-gray-500 text-sm">
                    {format(new Date(obra.data), "dd 'de' MMMM 'de' yyyy", { locale: ptBR })}
                  </span>
                  {obra.data_fechamento && (
                    <span className="text-green-700 text-sm font-medium">
                      · Concluída em {format(new Date(obra.data_fechamento), "dd/MM/yyyy 'às' HH:mm", { locale: ptBR })}
                    </span>
                  )}
                </div>
              </div>
              <div className="flex flex-wrap items-center gap-3">
                {isAdmin && (
                  obra.data_fechamento ? (
                    <button
                      onClick={handleReabrirObra}
                      disabled={finalizandoObra}
                      className="px-4 py-2.5 bg-white border border-gray-300 hover:border-gray-400 text-sm font-semibold text-gray-700 rounded-lg shadow-sm transition-colors disabled:opacity-60 disabled:cursor-not-allowed flex items-center gap-2"
                    >
                      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 11V7a4 4 0 118 0m-4 8v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2z" />
                      </svg>
                      {finalizandoObra ? 'Aguarde...' : 'Reabrir Obra'}
                    </button>
                  ) : (
                    <button
                      onClick={handleFinalizarObra}
                      disabled={finalizandoObra}
                      className="px-4 py-2.5 bg-green-600 hover:bg-green-700 text-white text-sm font-semibold rounded-lg shadow-sm transition-colors disabled:opacity-60 disabled:cursor-not-allowed flex items-center gap-2"
                    >
                      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                      </svg>
                      {finalizandoObra ? 'Aguarde...' : 'Finalizar Obra'}
                    </button>
                  )
                )}
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
            <p className="text-sm text-gray-400">Clique em uma foto para visualizar, trocar ou editar a placa.</p>
          </div>


          {/* Info Cards */}
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 mb-8">
            <div className="bg-white p-4 rounded-xl shadow-sm border border-gray-100">
              <div className="text-xs font-medium text-gray-400 uppercase tracking-wider mb-1">Responsável</div>
              <div className="text-sm font-semibold text-gray-900">{obra.responsavel || '—'}</div>
            </div>
            <div className="bg-white p-4 rounded-xl shadow-sm border border-gray-100">
              <div className="text-xs font-medium text-gray-400 uppercase tracking-wider mb-1">Tipo de Serviço</div>
              <div className="text-sm font-semibold text-gray-900">{obra.tipo_servico}</div>
            </div>
            <div className="bg-white p-4 rounded-xl shadow-sm border border-gray-100">
              <div className="text-xs font-medium text-gray-400 uppercase tracking-wider mb-1">Status</div>
              <div>
                {obra.data_fechamento ? (
                  <span className="px-2.5 py-1 bg-green-100 text-green-800 text-xs font-semibold rounded-full">Concluída</span>
                ) : (
                  <span className="px-2.5 py-1 bg-amber-100 text-amber-800 text-xs font-semibold rounded-full">Em Andamento</span>
                )}
              </div>
            </div>
            <div className="bg-white p-4 rounded-xl shadow-sm border border-gray-100">
              <div className="text-xs font-medium text-gray-400 uppercase tracking-wider mb-1">
                {obra.data_fechamento ? 'Concluída em' : 'Data da Obra'}
              </div>
              <div className="text-sm font-semibold text-gray-900">
                {obra.data_fechamento
                  ? format(new Date(obra.data_fechamento), "dd/MM/yyyy HH:mm", { locale: ptBR })
                  : format(new Date(obra.data), "dd/MM/yyyy", { locale: ptBR })}
              </div>
            </div>
          </div>

          {/* Atipicidades */}
          <div className="card-padded mb-8">
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
          <div className="card-padded">
            <h2 className="text-xl font-bold text-slate-900 mb-6">Registro Fotográfico</h2>

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
            {(obra.fotos_checklist_croqui?.length || obra.fotos_checklist_panoramica_inicial?.length || obra.fotos_checklist_chede?.length || obra.fotos_checklist_aterramento_cerca?.length || getAterramentosFotos(obra).length > 0 || obra.fotos_checklist_padrao_geral?.length || obra.fotos_checklist_padrao_interno?.length || obra.fotos_checklist_frying?.length || obra.fotos_checklist_abertura_fechamento_pulo?.length || obra.fotos_checklist_panoramica_final?.length || obra.fotos_checklist_postes?.length || obra.fotos_checklist_seccionamentos?.length || obra.checklist_postes_data?.length || obra.checklist_seccionamentos_data?.length || obra.checklist_hastes_termometros_data?.length) ? (
              <div className="mt-8 pt-8 border-t border-gray-200">
                <h3 className="text-xl font-bold text-gray-900 mb-4">Checklist de Fiscalização</h3>
                
                {/* 1. Croqui */}
                <PhotoGallery photos={obra.fotos_checklist_croqui || []} title="1. Croqui da Obra" sectionKey="fotos_checklist_croqui" {...galleryProps} />
                
                {/* 2. Panorâmica Inicial */}
                <PhotoGallery photos={obra.fotos_checklist_panoramica_inicial || []} title="2. Panorâmica Inicial" sectionKey="fotos_checklist_panoramica_inicial" {...galleryProps} />
                
                {/* 3. CHEDE */}
                <PhotoGallery photos={obra.fotos_checklist_chede || []} title="3. Foto da Chave com Componente (CHEDE)" sectionKey="fotos_checklist_chede" {...galleryProps} />
                
                {/* 4. Postes - Exibição estruturada */}
                {(() => {
                  const mergedPostes = getChecklistPostesForDisplay(
                    obra.checklist_postes_data,
                    obra.fotos_checklist_postes
                  )

                  const hasPostesWithPhotos = hasRealPhotos(mergedPostes);

                  if (hasPostesWithPhotos && mergedPostes) {
                    return (
                      <div className="mb-6">
                        <h4 className="text-lg font-semibold text-gray-800 mb-3">4. Registro dos Postes</h4>
                        {mergedPostes.map((poste: any, posteIndex: number) => {
                          const prefixo = poste.isAditivo ? 'AD-P' : 'P';
                          const label = poste.numero ? `${prefixo}${poste.numero}` : `Poste ${posteIndex + 1}`;
                          const status = poste.status || 'N/A';
                          return (
                            <div key={posteIndex} className={`mb-4 p-4 rounded-lg border-l-4 ${poste.isAditivo ? 'bg-red-50 border-red-500' : 'bg-blue-50 border-blue-500'}`}>
                              <div className="flex items-center gap-2 mb-2">
                                <span className={`px-3 py-1 rounded-full text-sm font-bold ${poste.isAditivo ? 'bg-red-500 text-white' : 'bg-blue-500 text-white'}`}>
                                  {label}
                                </span>
                                <span className="text-sm text-gray-600">Status: {status}</span>
                              </div>
                              {poste.posteInteiro?.length > 0 && (
                                <PhotoGallery photos={poste.posteInteiro} title="Poste Inteiro" sectionKey={`poste_${posteIndex}_inteiro`} {...galleryProps} />
                              )}
                              {poste.engaste?.length > 0 && (
                                <PhotoGallery photos={poste.engaste} title="Engaste" sectionKey={`poste_${posteIndex}_engaste`} {...galleryProps} />
                              )}
                              {poste.conexao1?.length > 0 && (
                                <PhotoGallery photos={poste.conexao1} title="Conexão 1" sectionKey={`poste_${posteIndex}_conexao1`} {...galleryProps} />
                              )}
                              {poste.conexao2?.length > 0 && (
                                <PhotoGallery photos={poste.conexao2} title="Conexão 2" sectionKey={`poste_${posteIndex}_conexao2`} {...galleryProps} />
                              )}
                              {poste.maiorEsforco?.length > 0 && (
                                <PhotoGallery photos={poste.maiorEsforco} title="Maior Esforço" sectionKey={`poste_${posteIndex}_maior`} {...galleryProps} />
                              )}
                              {poste.menorEsforco?.length > 0 && (
                                <PhotoGallery photos={poste.menorEsforco} title="Menor Esforço" sectionKey={`poste_${posteIndex}_menor`} {...galleryProps} />
                              )}
                            </div>
                          );
                        })}
                      </div>
                    );
                  }

                  // Fallback: mostrar todas as fotos juntas se não conseguir mesclar
                  if ((obra.fotos_checklist_postes?.length ?? 0) > 0) {
                    return <PhotoGallery photos={obra.fotos_checklist_postes || []} title="4. Postes" sectionKey="fotos_checklist_postes" {...galleryProps} />;
                  }

                  return null;
                })()}
                
                {/* 5. Seccionamentos - Exibição estruturada (só se tiver fotos reais) */}
                {hasRealPhotos(obra.checklist_seccionamentos_data) && (
                  <div className="mb-6">
                    <h4 className="text-lg font-semibold text-gray-800 mb-3">5. Seccionamentos</h4>
                    {obra.checklist_seccionamentos_data?.map((secc: any, seccIndex: number) => {
                      const label = secc.numero ? `S${secc.numero}` : `Seccionamento ${seccIndex + 1}`;
                      return (
                        <div key={seccIndex} className="mb-4 p-4 bg-purple-50 rounded-lg border-l-4 border-purple-500">
                          <div className="flex items-center gap-2 mb-2">
                            <span className="px-3 py-1 bg-purple-500 text-white rounded-full text-sm font-bold">{label}</span>
                          </div>
                          {secc.fotos?.length > 0 && (
                            <PhotoGallery photos={secc.fotos} title="Fotos" sectionKey={`secc_${seccIndex}_fotos`} {...galleryProps} />
                          )}
                        </div>
                      );
                    })}
                  </div>
                )}
                {/* Fallback para formato antigo de seccionamentos */}
                {!hasRealPhotos(obra.checklist_seccionamentos_data) && (obra.fotos_checklist_seccionamentos?.length ?? 0) > 0 && (
                  <PhotoGallery photos={obra.fotos_checklist_seccionamentos || []} title="5. Seccionamentos" sectionKey="fotos_checklist_seccionamentos" {...galleryProps} />
                )}

                {/* 6. Aterramentos de Cerca - suporta formato novo (estruturado) e antigo */}
                {getAterramentosFotos(obra).length > 0 && (
                  <div className="mb-6">
                    <h4 className="text-lg font-semibold text-gray-800 mb-3">6. Aterramento de Cerca</h4>
                    {getAterramentosFotos(obra).map((aterramento, index) => (
                      <PhotoGallery
                        key={`aterramento_${index}`}
                        photos={aterramento.fotos}
                        title={aterramento.titulo}
                        sectionKey={`fotos_aterramento_${index}`}
                        {...galleryProps}
                      />
                    ))}
                  </div>
                )}

                {/* 7. Padrão Geral */}
                <PhotoGallery photos={obra.fotos_checklist_padrao_geral || []} title="7. Padrão de Ligação - Vista Geral" sectionKey="fotos_checklist_padrao_geral" {...galleryProps} />
                
                {/* 8. Padrão Interno */}
                <PhotoGallery photos={obra.fotos_checklist_padrao_interno || []} title="8. Padrão de Ligação - Interno" sectionKey="fotos_checklist_padrao_interno" {...galleryProps} />
                
                {/* 9. Flying */}
                <PhotoGallery photos={obra.fotos_checklist_frying || []} title="9. Flying" sectionKey="fotos_checklist_frying" {...galleryProps} />
                
                {/* 10. Abertura e Fechamento de Pulo */}
                <PhotoGallery photos={obra.fotos_checklist_abertura_fechamento_pulo || []} title="10. Abertura e Fechamento de Pulo" sectionKey="fotos_checklist_abertura_fechamento_pulo" {...galleryProps} />
                
                {/* 11. Hastes Aplicadas e Medição do Termômetro */}
                <div className="mb-6">
                  <h4 className="text-lg font-semibold text-gray-800 mb-3">📸 11. Hastes Aplicadas e Medição do Termômetro</h4>
                  {(obra.checklist_hastes_termometros_data?.length ?? 0) > 0 ? (
                    <>
                      {obra.checklist_hastes_termometros_data?.map((ponto: any, pontoIndex: number) => {
                        const prefixo = ponto.isAditivo ? 'AD-P' : 'P';
                        const label = ponto.numero ? `${prefixo}${ponto.numero}` : `Ponto ${pontoIndex + 1}`;

                        // Contar fotos válidas
                        const hasteFotos = ponto.fotoHaste || [];
                        const termoFotos = ponto.fotoTermometro || [];
                        const totalFotos = hasteFotos.length + termoFotos.length;

                        return (
                          <div key={pontoIndex} className={`mb-4 p-4 rounded-lg border-l-4 ${ponto.isAditivo ? 'bg-red-50 border-red-500' : 'bg-green-50 border-green-500'}`}>
                            <div className="flex items-center gap-2 mb-2">
                              <span className={`px-3 py-1 rounded-full text-sm font-bold ${ponto.isAditivo ? 'bg-red-500 text-white' : 'bg-green-500 text-white'}`}>
                                {label}
                              </span>
                              <span className="text-sm text-gray-500">
                                ({totalFotos} {totalFotos === 1 ? 'foto' : 'fotos'})
                              </span>
                            </div>
                            <PhotoGallery photos={hasteFotos} title="Haste Aplicada" sectionKey={`haste_${pontoIndex}`} {...galleryProps} />
                            <PhotoGallery photos={termoFotos} title="Medição do Termômetro" sectionKey={`termo_${pontoIndex}`} {...galleryProps} />
                            {totalFotos === 0 && (
                              <p className="text-gray-500 text-sm italic">Nenhuma foto adicionada ainda.</p>
                            )}
                          </div>
                        );
                      })}
                    </>
                  ) : (
                    <>
                      {/* Fallback: campos flat antigos - manter botão disponível mesmo vazio */}
                      <PhotoGallery
                        photos={(obra as any).fotos_checklist_hastes_aplicadas || []}
                        title="Hastes Aplicadas"
                        sectionKey="fotos_checklist_hastes_aplicadas"
                        {...galleryProps}
                      />
                      <PhotoGallery
                        photos={(obra as any).fotos_checklist_medicao_termometro || []}
                        title="Medição do Termômetro"
                        sectionKey="fotos_checklist_medicao_termometro"
                        {...galleryProps}
                      />
                    </>
                  )}
                </div>

                {/* 12. Panorâmica Final */}
                <PhotoGallery photos={obra.fotos_checklist_panoramica_final || []} title="12. Panorâmica Final" sectionKey="fotos_checklist_panoramica_final" {...galleryProps} />
              </div>
            ) : null}
          </div>
      </AppShell>
    </ProtectedRoute>
  )
}
