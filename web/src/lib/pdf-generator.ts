import jsPDF from 'jspdf'
import type { Obra, FotoInfo } from './supabase'
import { format, parseISO } from 'date-fns'
import { ptBR } from 'date-fns/locale'
import { latLongToUTM, formatUTM } from './geocoding'

const CHECKLIST_POSTE_TIPO_TO_FIELD: Record<string, string> = {
  inteiro: 'posteInteiro',
  descricao: 'descricao',
  engaste: 'engaste',
  conexao1: 'conexao1',
  conexao2: 'conexao2',
  maior_esforco: 'maiorEsforco',
  menor_esforco: 'menorEsforco'
}

function resolvePhotoRefToUrl(value: unknown): string | null {
  if (typeof value !== 'string') return null
  const trimmed = value.trim()
  if (!trimmed) return null
  if (trimmed.startsWith('file:///') || trimmed.startsWith('temp_') || trimmed.startsWith('local_')) return null
  if (trimmed.startsWith('http')) return trimmed
  return supabasePublicUrl(trimmed)
}

function toFotoInfo(item: any): FotoInfo | null {
  if (typeof item === 'object' && item !== null) {
    const url = resolvePhotoRefToUrl(item.url) || resolvePhotoRefToUrl(item.id)
    if (!url) return null

    return {
      url,
      latitude: item.latitude ?? null,
      longitude: item.longitude ?? null,
      utmX: item.utmX ?? item.utm_x ?? null,
      utmY: item.utmY ?? item.utm_y ?? null,
      utmZone: item.utmZone ?? item.utm_zone ?? null,
      placaData: item.placaData || item.placa_data || null
    }
  }

  const url = resolvePhotoRefToUrl(item)
  if (url) {
    return {
      url,
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

function normalizePhotoRefs(photos: any[] | undefined): FotoInfo[] {
  if (!photos || !Array.isArray(photos) || photos.length === 0) return []

  return photos
    .map((photo) => toFotoInfo(photo))
    .filter(Boolean) as FotoInfo[]
}

function supabasePublicUrl(photoId: string): string {
  if (!photoId || photoId.startsWith('temp_') || photoId.startsWith('local_') || photoId.startsWith('file:///')) {
    return ''
  }
  const baseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || ''
  if (!baseUrl) return ''
  return `${baseUrl}/storage/v1/object/public/obra-photos/${photoId}`
}

function getChecklistLinearTipo(item: any): 'seccionamento' | 'emenda' | 'poda' {
  const tipo = item?.tipo
  if (tipo === 'emenda' || tipo === 'poda' || tipo === 'seccionamento') return tipo
  return 'seccionamento'
}

function getChecklistTrechoLabel(item: any): string | null {
  const inicio = item?.posteInicio ?? item?.poste_inicio ?? null
  const fim = item?.posteFim ?? item?.poste_fim ?? null
  if (!inicio && !fim) return null
  return `Trecho P${inicio ?? '?'} - P${fim ?? '?'}`
}

/**
 * Mescla fotos do array flat (fotos_checklist_postes) com a estrutura de postes (checklist_postes_data)
 * Extrai o tipo de foto e associa ao poste correto baseado na sequência temporal
 */
function mergePostesPhotosWithStructure(
  postesData: any[] | undefined,
  flatPhotos: any[] | undefined
): any[] | undefined {
  if (!postesData || postesData.length === 0) return postesData
  const normalizedFlatPhotos = normalizePhotoRefs(flatPhotos)
  if (normalizedFlatPhotos.length === 0) return postesData

  const extractPhotoInfo = (url: string) => {
    const filename = url.split('/').pop() || ''
    const match = filename.match(/checklist_poste_([a-z_]+\d?)_(\d+)_/)
    if (!match) return null
    return {
      tipo: match[1],
      timestamp: parseInt(match[2])
    }
  }

  // ✅ NOVA LÓGICA: Usar sequência de fotos "inteiro" para delimitar postes
  // Ordenar fotos por timestamp
  const sortedPhotos = [...normalizedFlatPhotos].sort((a, b) => {
    const infoA = extractPhotoInfo(a.url)
    const infoB = extractPhotoInfo(b.url)
    if (!infoA || !infoB) return 0
    return infoA.timestamp - infoB.timestamp
  })

  // Identificar timestamps das fotos "inteiro" (cada uma marca início de um poste)
  const inteiroTimestamps: number[] = []
  for (const photo of sortedPhotos) {
    const info = extractPhotoInfo(photo.url)
    if (info && info.tipo === 'inteiro') {
      inteiroTimestamps.push(info.timestamp)
    }
  }

  // Se não há fotos "inteiro", todas as fotos vão para o primeiro poste
  if (inteiroTimestamps.length === 0) {
    const firstPoste = {
      ...postesData[0],
      posteInteiro: [],
      descricao: [],
      engaste: [],
      conexao1: [],
      conexao2: [],
      maiorEsforco: [],
      menorEsforco: []
    }

    for (const photo of sortedPhotos) {
      const info = extractPhotoInfo(photo.url)
      if (!info) continue
      const field = CHECKLIST_POSTE_TIPO_TO_FIELD[info.tipo]
      if (field && firstPoste[field]) {
        firstPoste[field].push(photo)
      }
    }

    return [firstPoste, ...postesData.slice(1)]
  }

  // Agrupar fotos por poste baseado nos timestamps "inteiro"
  const photoGroups: { posteIndex: number; tipo: string; photo: FotoInfo }[] = []

  for (const photo of sortedPhotos) {
    const info = extractPhotoInfo(photo.url)
    if (!info) continue

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

  const mergedPostes = postesData.map((poste, index) => {
    const mergedPoste = {
      ...poste,
      posteInteiro: normalizePhotoRefs(poste.posteInteiro || []),
      descricao: normalizePhotoRefs(poste.descricao || []),
      engaste: normalizePhotoRefs(poste.engaste || []),
      conexao1: normalizePhotoRefs(poste.conexao1 || []),
      conexao2: normalizePhotoRefs(poste.conexao2 || []),
      maiorEsforco: normalizePhotoRefs(poste.maiorEsforco || []),
      menorEsforco: normalizePhotoRefs(poste.menorEsforco || [])
    }

    for (const group of photoGroups) {
      if (group.posteIndex === index) {
        const field = CHECKLIST_POSTE_TIPO_TO_FIELD[group.tipo]
        if (field && mergedPoste[field]) {
          const exists = mergedPoste[field].some((f: FotoInfo) => f.url === group.photo.url)
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
  return structuredData.some((item: any) => {
    if (!item) return false
    const photoFields = ['posteInteiro', 'descricao', 'engaste', 'conexao1', 'conexao2', 'maiorEsforco', 'menorEsforco', 'fotos', 'fotoHaste', 'fotoTermometro']
    return photoFields.some(field => {
      const value = item[field]
      return Array.isArray(value) && value.some((photo: any) => !!toFotoInfo(photo))
    })
  })
}

function countPostesDataPhotos(postesData: any[] | undefined): number {
  if (!Array.isArray(postesData) || postesData.length === 0) return 0

  return postesData.reduce((total, poste) => {
    return total +
      normalizePhotoRefs(poste?.fotos_antes).length +
      normalizePhotoRefs(poste?.fotos_durante).length +
      normalizePhotoRefs(poste?.fotos_depois).length +
      normalizePhotoRefs(poste?.fotos_medicao).length
  }, 0)
}

/**
 * Carrega uma foto e retorna a imagem como data URL junto com suas dimensões originais
 * NÃO adiciona placa na imagem - a placa será renderizada separadamente no PDF
 */
async function loadPhotoWithDimensions(
  photo: FotoInfo
): Promise<{ dataUrl: string; width: number; height: number }> {
  return new Promise(async (resolve, reject) => {
    try {
      // Buscar imagem
      const response = await fetch(photo.url)
      const blob = await response.blob()

      const img = new Image()
      img.crossOrigin = 'anonymous'

      img.onload = () => {
        // Criar canvas para converter para data URL
        const canvas = document.createElement('canvas')
        canvas.width = img.width
        canvas.height = img.height
        const ctx = canvas.getContext('2d')!

        // Desenhar imagem sem placa
        ctx.drawImage(img, 0, 0)

        // Retornar imagem e dimensões
        resolve({
          dataUrl: canvas.toDataURL('image/jpeg', 0.90),
          width: img.width,
          height: img.height
        })
      }

      img.onerror = () => {
        reject(new Error('Erro ao carregar imagem'))
      }

      // Criar URL da imagem a partir do blob
      const reader = new FileReader()
      reader.onloadend = () => {
        img.src = reader.result as string
      }
      reader.readAsDataURL(blob)
    } catch (error) {
      reject(error)
    }
  })
}

/**
 * Renderiza a placa de informações abaixo da imagem no PDF
 */
function toNumberOrNull(value: unknown): number | null {
  if (typeof value === 'number' && Number.isFinite(value)) return value
  if (typeof value === 'string') {
    const cleaned = value.replace(/[^\d.-]/g, '')
    if (!cleaned) return null
    const parsed = Number(cleaned)
    return Number.isFinite(parsed) ? parsed : null
  }
  return null
}

function getUtmDisplayFromCoords(
  utmX: number | null,
  utmY: number | null,
  utmZoneRaw: string | null | undefined
): string {
  if (utmX == null || utmY == null) return ''
  const zone = String(utmZoneRaw || '').trim() || 'UTM'
  return `${zone} ${Math.round(utmX)} ${Math.round(utmY)}`
}

function getUtmDisplayFromPhotoData(photo: FotoInfo | any): string {
  const photoData = photo as any
  const photoUtmX = toNumberOrNull(photoData.utmX ?? photoData.utm_x)
  const photoUtmY = toNumberOrNull(photoData.utmY ?? photoData.utm_y)
  const photoUtmZoneRaw = photoData.utmZone ?? photoData.utm_zone ?? null

  const utmFromPhoto = getUtmDisplayFromCoords(photoUtmX, photoUtmY, photoUtmZoneRaw)
  if (utmFromPhoto) return utmFromPhoto

  if (photoData.latitude != null && photoData.longitude != null) {
    const utm = latLongToUTM(photo.latitude, photo.longitude)
    return formatUTM(utm)
  }

  return ''
}

function findFirstUtmDisplayInAny(value: unknown, depth = 0): string {
  if (value == null || depth > 8) return ''

  if (Array.isArray(value)) {
    for (const item of value) {
      const found = findFirstUtmDisplayInAny(item, depth + 1)
      if (found) return found
    }
    return ''
  }

  if (typeof value === 'object') {
    const asObj = value as any
    const direct = getUtmDisplayFromPhotoData(asObj)
    if (direct) return direct

    for (const nestedValue of Object.values(asObj)) {
      const found = findFirstUtmDisplayInAny(nestedValue, depth + 1)
      if (found) return found
    }
  }

  return ''
}

function getObraFallbackUtmDisplay(obra: Obra): string {
  const obraUtmLeste = toNumberOrNull(obra.utm_leste)
  const obraUtmNorte = toNumberOrNull(obra.utm_norte)
  const fromObraFields = getUtmDisplayFromCoords(obraUtmLeste, obraUtmNorte, null)
  if (fromObraFields) return fromObraFields

  return findFirstUtmDisplayInAny(obra)
}

function getUtmDisplayForPhoto(photo: FotoInfo, fallbackUtmDisplay: string): string {
  const direct = getUtmDisplayFromPhotoData(photo)
  if (direct) return direct
  return fallbackUtmDisplay
}

function renderPlacaBelowImage(
  pdf: jsPDF,
  photo: FotoInfo,
  obra: Obra,
  xPos: number,
  yPos: number,
  placaWidth: number,
  fallbackUtmDisplay: string
): number {
  // Preparar dados da placa
  const obraNumero = photo.placaData?.obraNumero || obra.obra
  const tipoServico = photo.placaData?.tipoServico || obra.tipo_servico
  const equipe = photo.placaData?.equipe || obra.equipe
  const dataHora = photo.placaData?.dataHora || format(parseISO(obra.data), "dd/MM/yyyy")

  // Prioridade: UTM/GPS da foto -> fallback de UTM da obra
  const utmDisplay = getUtmDisplayForPhoto(photo, fallbackUtmDisplay)

  // Altura da placa
  const placaHeight = utmDisplay ? 18 : 14

  // Sombra da placa
  pdf.setFillColor(220, 220, 220)
  pdf.roundedRect(xPos + 0.5, yPos + 0.5, placaWidth, placaHeight, 1, 1, 'F')

  // Fundo da placa (branco com borda)
  pdf.setFillColor(255, 255, 255)
  pdf.roundedRect(xPos, yPos, placaWidth, placaHeight, 1, 1, 'F')

  // Borda cinza sutil
  pdf.setDrawColor(200, 200, 200)
  pdf.setLineWidth(0.4)
  pdf.roundedRect(xPos, yPos, placaWidth, placaHeight, 1, 1, 'S')

  // Configurar texto
  pdf.setFontSize(7)
  let textY = yPos + 4

  // Linha 1: Obra | Data | Serviço
  pdf.setTextColor(120, 120, 120)
  pdf.setFont('helvetica', 'normal')
  pdf.text('Obra:', xPos + 3, textY)
  pdf.setTextColor(30, 30, 30)
  pdf.setFont('helvetica', 'bold')
  pdf.text(obraNumero, xPos + 14, textY)

  pdf.setTextColor(120, 120, 120)
  pdf.setFont('helvetica', 'normal')
  pdf.text('Data:', xPos + 45, textY)
  pdf.setTextColor(30, 30, 30)
  pdf.text(dataHora, xPos + 56, textY)

  pdf.setTextColor(120, 120, 120)
  pdf.text('Serviço:', xPos + 98, textY)
  pdf.setTextColor(30, 30, 30)
  const servicoTruncado = tipoServico.length > 20 ? tipoServico.substring(0, 20) + '...' : tipoServico
  pdf.text(servicoTruncado, xPos + 114, textY)

  textY += 5

  // Linha 2: Equipe | UTM (se disponível)
  pdf.setTextColor(120, 120, 120)
  pdf.setFont('helvetica', 'normal')
  pdf.text('Equipe:', xPos + 3, textY)
  pdf.setTextColor(0, 102, 204) // Azul corporativo
  pdf.setFont('helvetica', 'bold')
  pdf.text(equipe, xPos + 18, textY)

  if (utmDisplay) {
    textY += 5
    pdf.setTextColor(120, 120, 120)
    pdf.setFont('helvetica', 'normal')
    pdf.text('UTM:', xPos + 3, textY)
    pdf.setTextColor(80, 80, 80)
    pdf.setFont('courier', 'normal')
    pdf.text(utmDisplay, xPos + 15, textY)
  }

  // Reset cores
  pdf.setTextColor(0, 0, 0)
  pdf.setDrawColor(0, 0, 0)

  return placaHeight
}

type LogoData = { dataUrl: string; width: number; height: number }

async function loadPdfLogo(src: string): Promise<LogoData | null> {
  try {
    return await new Promise<LogoData>((resolve, reject) => {
      const img = new Image()
      img.crossOrigin = 'anonymous'
      img.onload = () => {
        try {
          const canvas = document.createElement('canvas')
          canvas.width = img.width
          canvas.height = img.height
          const ctx = canvas.getContext('2d')!
          ctx.drawImage(img, 0, 0)
          resolve({ dataUrl: canvas.toDataURL('image/png'), width: img.width, height: img.height })
        } catch (err) {
          reject(err)
        }
      }
      img.onerror = () => reject(new Error(`Erro ao carregar logo: ${src}`))
      img.src = src
    })
  } catch (error) {
    console.error(`Falha ao carregar logo ${src}:`, error)
    return null
  }
}

function addPdfFooters(
  pdf: jsPDF,
  centerLabel: string,
  margin: number,
  pageWidth: number,
  pageHeight: number
) {
  const totalPages = (pdf.internal.pages as any[]).length - 1
  for (let i = 1; i <= totalPages; i++) {
    pdf.setPage(i)
    pdf.setDrawColor(220, 220, 220)
    pdf.setLineWidth(0.3)
    pdf.line(margin, pageHeight - 15, pageWidth - margin, pageHeight - 15)
    pdf.setFontSize(7)
    pdf.setFont('helvetica', 'normal')
    pdf.setTextColor(140, 140, 140)
    pdf.text(`Gerado em ${format(new Date(), "dd/MM/yyyy 'às' HH:mm")}`, margin, pageHeight - 8)
    pdf.setFont('helvetica', 'bold')
    pdf.setTextColor(0, 102, 204)
    pdf.text(centerLabel, pageWidth / 2, pageHeight - 8, { align: 'center' })
    pdf.setFont('helvetica', 'normal')
    pdf.setTextColor(140, 140, 140)
    pdf.text(`Página ${i} de ${totalPages}`, pageWidth - margin, pageHeight - 8, { align: 'right' })
  }
}

async function addObraContentToPdf(
  pdf: jsPDF,
  obra: Obra,
  logoTeccelData: LogoData | null,
  logoEnergisaData: LogoData | null
): Promise<void> {
  const pageWidth = pdf.internal.pageSize.getWidth()
  const pageHeight = pdf.internal.pageSize.getHeight()
  const margin = 15
  let yPos = 15
  const gap = 8
  const availableWidth = pageWidth - margin * 2
  const imageWidth = availableWidth
  const maxImageHeight = pageHeight - margin * 2 - 35 // Espaço para título da seção + placa

  // ========== PÁGINA DE CAPA / RESUMO ==========

  const tipoServicoUpper = (obra.tipo_servico || 'OBRA').toUpperCase()

  // ===== CABEÇALHO CORPORATIVO COMPACTO =====
  // Fundo do cabeçalho
  pdf.setFillColor(250, 250, 250)
  pdf.rect(0, 0, pageWidth, 30, 'F')

  // Linha inferior do cabeçalho
  pdf.setDrawColor(220, 220, 220)
  pdf.setLineWidth(0.5)
  pdf.line(0, 30, pageWidth, 30)

  const headerCenterY = 15 // Centro vertical do cabeçalho

  // Largura padrão para ambas as logos (mesmo tamanho visual)
  const logoWidth = 30

  // Logo Teccel à esquerda
  if (logoTeccelData) {
    try {
      const logoAspectRatio = logoTeccelData.width / logoTeccelData.height
      const finalWidth = logoWidth
      const finalHeight = logoWidth / logoAspectRatio
      const logoY = headerCenterY - (finalHeight / 2) // Centralizar verticalmente
      pdf.addImage(logoTeccelData.dataUrl, 'PNG', margin + 2, logoY, finalWidth, finalHeight, undefined, 'FAST')
    } catch (error) {
      console.error('Erro ao adicionar logo Teccel:', error)
    }
  }

  // Título centralizado (duas linhas compactas)
  pdf.setFontSize(11)
  pdf.setFont('helvetica', 'bold')
  pdf.setTextColor(40, 40, 40)
  pdf.text('BOOK DE OBRA', pageWidth / 2, headerCenterY - 2, { align: 'center' })

  pdf.setFontSize(8)
  pdf.setTextColor(100, 100, 100)
  pdf.setFont('helvetica', 'normal')
  pdf.text(tipoServicoUpper, pageWidth / 2, headerCenterY + 5, { align: 'center' })

  // Logo Energisa à direita
  if (logoEnergisaData) {
    try {
      const logoAspectRatio = logoEnergisaData.width / logoEnergisaData.height
      const finalWidth = logoWidth
      const finalHeight = logoWidth / logoAspectRatio
      const logoY = headerCenterY - (finalHeight / 2) // Centralizar verticalmente
      pdf.addImage(logoEnergisaData.dataUrl, 'PNG', pageWidth - margin - finalWidth - 2, logoY, finalWidth, finalHeight, undefined, 'FAST')
    } catch (error) {
      console.error('Erro ao adicionar logo Energisa:', error)
    }
  }

  yPos = 40

  // Card de informações principais - Design profissional
  const cardHeight = 60

  // Sombra sutil do card
  pdf.setFillColor(230, 230, 230)
  pdf.roundedRect(margin + 1, yPos + 1, availableWidth, cardHeight, 2, 2, 'F')

  // Card principal
  pdf.setFillColor(255, 255, 255)
  pdf.roundedRect(margin, yPos, availableWidth, cardHeight, 2, 2, 'F')
  pdf.setDrawColor(220, 220, 220)
  pdf.setLineWidth(0.3)
  pdf.roundedRect(margin, yPos, availableWidth, cardHeight, 2, 2, 'S')

  // Grid de informações 2x2 com divisórias
  const colWidth = availableWidth / 2
  const rowHeight = cardHeight / 2

  // Linhas divisórias internas
  pdf.setDrawColor(240, 240, 240)
  pdf.line(margin + colWidth, yPos, margin + colWidth, yPos + cardHeight) // Vertical
  pdf.line(margin, yPos + rowHeight, margin + availableWidth, yPos + rowHeight) // Horizontal

  // Linha 1: Obra | Data
  pdf.setFontSize(8)
  pdf.setTextColor(120, 120, 120)
  pdf.setFont('helvetica', 'normal')
  pdf.text('OBRA', margin + 8, yPos + 10)
  pdf.setFontSize(13)
  pdf.setTextColor(30, 30, 30)
  pdf.setFont('helvetica', 'bold')
  pdf.text(obra.obra || '-', margin + 8, yPos + 22)

  pdf.setFontSize(8)
  pdf.setTextColor(120, 120, 120)
  pdf.setFont('helvetica', 'normal')
  pdf.text('DATA', margin + colWidth + 8, yPos + 10)
  pdf.setFontSize(13)
  pdf.setTextColor(30, 30, 30)
  pdf.setFont('helvetica', 'bold')
  pdf.text(format(parseISO(obra.data), 'dd/MM/yyyy'), margin + colWidth + 8, yPos + 22)

  // Linha 2: Equipe | Responsável
  pdf.setFontSize(8)
  pdf.setTextColor(120, 120, 120)
  pdf.setFont('helvetica', 'normal')
  pdf.text('EQUIPE', margin + 8, yPos + rowHeight + 10)
  pdf.setFontSize(13)
  pdf.setTextColor(0, 102, 204) // Azul corporativo
  pdf.setFont('helvetica', 'bold')
  pdf.text(obra.equipe || '-', margin + 8, yPos + rowHeight + 22)

  pdf.setFontSize(8)
  pdf.setTextColor(120, 120, 120)
  pdf.setFont('helvetica', 'normal')
  pdf.text('RESPONSÁVEL', margin + colWidth + 8, yPos + rowHeight + 10)
  pdf.setFontSize(11)
  pdf.setTextColor(30, 30, 30)
  pdf.setFont('helvetica', 'bold')
  const responsavelText = obra.responsavel || '-'
  const responsavelTrunc = responsavelText.length > 25 ? responsavelText.substring(0, 25) + '...' : responsavelText
  pdf.text(responsavelTrunc, margin + colWidth + 8, yPos + rowHeight + 22)

  yPos += cardHeight + 12

  // ========== SEÇÃO DE ATIPICIDADES (SÓ SE HOUVER) ==========

  const ATIPICIDADES = [
    { id: 3, titulo: 'Obra em locais sem acesso que necessitam de transporte especial de equipamento (guindaste, trator, carroça) ou BANDOLAGEA', descricao: '' },
    { id: 4, titulo: 'Obra em ilhas, terrenos alagados, arenosos, montanhosos, rochosos ou anexos, com CONCRETAGEM da base do poste ou obra essencial.', descricao: '' },
    { id: 5, titulo: 'Obra com travessia de condutores sobre linhas energizadas.', descricao: '' },
    { id: 6, titulo: 'Obra de expansão e construção de rede e linhas de distribuição com abertura de faixa de passagem.', descricao: '' },
    { id: 8, titulo: 'Obra com participação de linha viva', descricao: '' },
    { id: 9, titulo: 'Obra com participação de linha viva com atendimento alternativo de cargas (SE / Barramento móvel, estruturas temporárias/provisórias, gerador, Mega Jump)', descricao: '' },
    { id: 10, titulo: 'Obra com atendimento alternativo de cargas (SE / Barramento móvel, estruturas temporárias/provisórias, gerador, Mega Jump)', descricao: '' },
    { id: 11, titulo: 'Obra de conversão de Rede convencional para REDE COMPACTA.', descricao: '' },
    { id: 12, titulo: 'Obra exclusiva de recondutoramento de redes/linhas.', descricao: '' },
    { id: 13, titulo: 'Obra MISTA com RECONDUTORAMENTO PARCIAL de redes/linhas.', descricao: '' },
    { id: 17, titulo: 'Outros (EMENDAS DE CONDUTOR PARTIDO, ESPAÇADOR, e outras não previstas nos itens de 1 a 16).', descricao: '' },
  ]

  const atipicidadesDetalhadas = (obra.atipicidades || [])
    .map(id => ATIPICIDADES.find(a => a.id === id))
    .filter(Boolean) as typeof ATIPICIDADES

  if (atipicidadesDetalhadas.length > 0) {
    // Header da seção - estilo profissional
    pdf.setFillColor(245, 245, 245)
    pdf.roundedRect(margin, yPos, availableWidth, 10, 2, 2, 'F')
    pdf.setDrawColor(220, 220, 220)
    pdf.setLineWidth(0.3)
    pdf.roundedRect(margin, yPos, availableWidth, 10, 2, 2, 'S')

    pdf.setFontSize(9)
    pdf.setFont('helvetica', 'bold')
    pdf.setTextColor(60, 60, 60)
    pdf.text('ATIPICIDADES', margin + 6, yPos + 7)

    yPos += 12

    // Calcular altura para atipicidades
    const lineHeight = 12
    const atipBoxHeight = Math.max(atipicidadesDetalhadas.length * lineHeight + 8, 20)

    // Sombra do box
    pdf.setFillColor(230, 230, 230)
    pdf.roundedRect(margin + 1, yPos + 1, availableWidth, atipBoxHeight, 2, 2, 'F')

    // Box de atipicidades
    pdf.setFillColor(255, 255, 255)
    pdf.roundedRect(margin, yPos, availableWidth, atipBoxHeight, 2, 2, 'F')
    pdf.setDrawColor(220, 220, 220)
    pdf.setLineWidth(0.3)
    pdf.roundedRect(margin, yPos, availableWidth, atipBoxHeight, 2, 2, 'S')

    let currentY = yPos + 6
    pdf.setFontSize(7)

    atipicidadesDetalhadas.forEach((atip, index) => {
      if (index > 0) {
        // Linha divisória sutil
        pdf.setDrawColor(245, 245, 245)
        pdf.line(margin + 6, currentY - 2, pageWidth - margin - 6, currentY - 2)
      }

      // Número em badge
      pdf.setFillColor(0, 102, 204) // Azul corporativo
      pdf.circle(margin + 9, currentY + 1, 2.5, 'F')
      pdf.setTextColor(255, 255, 255)
      pdf.setFont('helvetica', 'bold')
      pdf.setFontSize(6)
      pdf.text(`${atip.id}`, margin + 9, currentY + 2.5, { align: 'center' })

      // Título
      pdf.setTextColor(50, 50, 50)
      pdf.setFont('helvetica', 'normal')
      pdf.setFontSize(7)
      const tituloWidth = availableWidth - 24
      const titulo = pdf.splitTextToSize(atip.titulo, tituloWidth)
      pdf.text(titulo[0] + (titulo.length > 1 ? '...' : ''), margin + 16, currentY + 3)
      currentY += lineHeight
    })

    pdf.setTextColor(0, 0, 0)
    yPos += atipBoxHeight + 10
  }

  // Observações (só mostrar se houver)
  if (obra.observacoes && obra.observacoes.trim()) {
    // Sombra
    pdf.setFillColor(230, 230, 230)
    pdf.roundedRect(margin + 1, yPos + 1, availableWidth, 22, 2, 2, 'F')

    // Box de observações
    pdf.setFillColor(255, 252, 240)
    pdf.roundedRect(margin, yPos, availableWidth, 22, 2, 2, 'F')
    pdf.setDrawColor(240, 200, 100)
    pdf.setLineWidth(0.5)
    pdf.roundedRect(margin, yPos, availableWidth, 22, 2, 2, 'S')

    // Ícone de alerta
    pdf.setFillColor(255, 193, 7)
    pdf.circle(margin + 7, yPos + 8, 2, 'F')
    pdf.setTextColor(255, 255, 255)
    pdf.setFont('helvetica', 'bold')
    pdf.setFontSize(7)
    pdf.text('!', margin + 7, yPos + 9.5, { align: 'center' })

    pdf.setFontSize(8)
    pdf.setFont('helvetica', 'bold')
    pdf.setTextColor(100, 80, 0)
    pdf.text('OBSERVAÇÕES:', margin + 12, yPos + 9)
    pdf.setFont('helvetica', 'normal')
    pdf.setTextColor(70, 70, 70)
    pdf.setFontSize(7)
    const obsText = obra.observacoes.length > 150 ? obra.observacoes.substring(0, 150) + '...' : obra.observacoes
    const obsLines = pdf.splitTextToSize(obsText, availableWidth - 16)
    pdf.text(obsLines[0], margin + 12, yPos + 15)
    if (obsLines[1]) pdf.text(obsLines[1], margin + 12, yPos + 20)

    yPos += 27
  }

  // Contagem de fotos por seção (resumo visual)
  const photoFields: { key: keyof Pick<Obra, 'fotos_antes' | 'fotos_durante' | 'fotos_depois' | 'fotos_abertura' | 'fotos_fechamento'>; label: string }[] = [
    { key: 'fotos_antes', label: 'Antes' },
    { key: 'fotos_durante', label: 'Durante' },
    { key: 'fotos_depois', label: 'Depois' },
    { key: 'fotos_abertura', label: 'Abertura' },
    { key: 'fotos_fechamento', label: 'Fechamento' },
  ]

  const photoCounts = photoFields.map(f => ({
    label: f.label,
    count: obra[f.key]?.length || 0
  }))

  const postesDataCount = countPostesDataPhotos(obra.postes_data)
  if (postesDataCount > 0) {
    photoCounts.push({
      label: Array.isArray(obra.postes_data) && obra.postes_data.some((poste: any) => normalizePhotoRefs(poste?.fotos_medicao).length > 0)
        ? 'Postes/Medição'
        : 'Postes',
      count: postesDataCount
    })
  }

  const visiblePhotoCounts = photoCounts.filter(p => p.count > 0)

  if (visiblePhotoCounts.length > 0) {
    yPos += 3

    // Sombra
    pdf.setFillColor(230, 230, 230)
    pdf.roundedRect(margin + 1, yPos + 1, availableWidth, 28, 2, 2, 'F')

    // Box de resumo
    pdf.setFillColor(248, 250, 252)
    pdf.roundedRect(margin, yPos, availableWidth, 28, 2, 2, 'F')
    pdf.setDrawColor(220, 220, 220)
    pdf.setLineWidth(0.3)
    pdf.roundedRect(margin, yPos, availableWidth, 28, 2, 2, 'S')

    pdf.setFontSize(8)
    pdf.setFont('helvetica', 'bold')
    pdf.setTextColor(80, 80, 80)
    pdf.text('RESUMO DE FOTOS', margin + 6, yPos + 8)

    let xOffset = margin + 6
    pdf.setFontSize(8)
    yPos += 14

    visiblePhotoCounts.forEach((p, idx) => {
      if (xOffset > pageWidth - margin - 50) {
        xOffset = margin + 6
        yPos += 10
      }

      // Badge azul corporativo
      pdf.setFillColor(0, 102, 204)
      pdf.circle(xOffset + 3.5, yPos + 2, 3.5, 'F')
      pdf.setTextColor(255, 255, 255)
      pdf.setFont('helvetica', 'bold')
      pdf.setFontSize(7)
      pdf.text(`${p.count}`, xOffset + 3.5, yPos + 3.5, { align: 'center' })

      pdf.setTextColor(60, 60, 60)
      pdf.setFont('helvetica', 'normal')
      pdf.setFontSize(8)
      pdf.text(p.label, xOffset + 9, yPos + 4)

      xOffset += 42
    })

    yPos += 18
  }

  // Rodapé da página de capa
  pdf.setDrawColor(220, 220, 220)
  pdf.line(margin, pageHeight - 20, pageWidth - margin, pageHeight - 20)
  pdf.setFontSize(7)
  pdf.setTextColor(140, 140, 140)
  pdf.setFont('helvetica', 'normal')
  pdf.text(`Documento gerado em ${format(new Date(), "dd/MM/yyyy 'às' HH:mm")}`, pageWidth / 2, pageHeight - 12, { align: 'center' })

  // ========== PÁGINAS DE FOTOS ==========
  // Cada foto em uma página dedicada

  const obraUtmFallback = getObraFallbackUtmDisplay(obra)

  const addPhotosSection = async (photos: any[] | undefined, title: string) => {
    const normalizedPhotos = normalizePhotoRefs(photos)
    if (normalizedPhotos.length === 0) return

    for (let i = 0; i < normalizedPhotos.length; i++) {
      const photo = normalizedPhotos[i]

      try {
        // Nova página para cada foto
        pdf.addPage()
        yPos = margin

        // Mini header da página - estilo profissional
        pdf.setFillColor(245, 245, 245)
        pdf.rect(margin, yPos, availableWidth, 12, 'F')
        pdf.setDrawColor(220, 220, 220)
        pdf.setLineWidth(0.3)
        pdf.rect(margin, yPos, availableWidth, 12, 'S')

        pdf.setFontSize(9)
        pdf.setFont('helvetica', 'bold')
        pdf.setTextColor(60, 60, 60)
        pdf.text(`${title} (${i + 1}/${normalizedPhotos.length})`, margin + 4, yPos + 8)

        // Info da obra no header
        pdf.setFontSize(7)
        pdf.setFont('helvetica', 'normal')
        pdf.setTextColor(120, 120, 120)
        pdf.text(`Obra: ${obra.obra} | Equipe: ${obra.equipe}`, pageWidth - margin - 4, yPos + 8, { align: 'right' })

        pdf.setTextColor(0, 0, 0)
        yPos += 15

        // Carregar foto e obter dimensões reais
        const photoData = await loadPhotoWithDimensions(photo)

        // Calcular altura mantendo proporção real da imagem
        const aspectRatio = photoData.height / photoData.width
        let finalImageWidth = imageWidth
        let finalImageHeight = imageWidth * aspectRatio

        // Se a imagem ficar muito alta, limitar pela altura máxima
        if (finalImageHeight > maxImageHeight) {
          finalImageHeight = maxImageHeight
          finalImageWidth = finalImageHeight / aspectRatio
        }

        // Centralizar imagem
        const imageX = margin + (imageWidth - finalImageWidth) / 2

        // Adicionar foto
        pdf.addImage(photoData.dataUrl, 'JPEG', imageX, yPos, finalImageWidth, finalImageHeight)

        yPos += finalImageHeight + 2

        // Renderizar placa ABAIXO da imagem
        renderPlacaBelowImage(pdf, photo, obra, imageX, yPos, finalImageWidth, obraUtmFallback)

      } catch (error) {
        console.error('Erro ao adicionar foto:', error)
        pdf.addPage()
        yPos = margin
        pdf.setFont('helvetica', 'normal')
        pdf.setFontSize(10)
        pdf.setTextColor(200, 0, 0)
        pdf.text(`${title} - Foto ${i + 1}: Erro ao carregar imagem`, margin, yPos)
        pdf.setTextColor(0, 0, 0)
      }
    }
  }

  const addPostesDataSections = async () => {
    if (!Array.isArray(obra.postes_data) || obra.postes_data.length === 0) return

    const isBookAterramento = obra.tipo_servico === 'Book de Aterramento'
    const sectionConfigs = isBookAterramento
      ? [
          { key: 'fotos_antes', label: 'Vala Aberta' },
          { key: 'fotos_durante', label: 'Hastes Aplicadas' },
          { key: 'fotos_depois', label: 'Vala Fechada' },
          { key: 'fotos_medicao', label: 'Medição Terrômetro' },
        ]
      : [
          { key: 'fotos_antes', label: 'Fotos Antes' },
          { key: 'fotos_durante', label: 'Fotos Durante' },
          { key: 'fotos_depois', label: 'Fotos Depois' },
          { key: 'fotos_medicao', label: 'Fotos Medição' },
        ]

    for (let posteIndex = 0; posteIndex < obra.postes_data.length; posteIndex++) {
      const poste = obra.postes_data[posteIndex]
      const prefixo = poste?.isAditivo ? 'AD-P' : 'P'
      const label = poste?.numero ? `${prefixo}${poste.numero}` : `Poste ${posteIndex + 1}`

      for (const section of sectionConfigs) {
        const photos = normalizePhotoRefs(poste?.[section.key])
        if (photos.length === 0) continue

        await addPhotosSection(
          photos,
          `${obra.tipo_servico} - ${label} - ${section.label}`
        )
      }
    }
  }

  // Adicionar cada seção de fotos
  await addPhotosSection(obra.fotos_antes, 'Fotos Antes')
  await addPhotosSection(obra.fotos_durante, 'Fotos Durante')
  await addPhotosSection(obra.fotos_depois, 'Fotos Depois')
  await addPhotosSection(obra.fotos_abertura, 'Fotos Abertura Chave')
  await addPhotosSection(obra.fotos_fechamento, 'Fotos Fechamento Chave')
  await addPostesDataSections()

  // DITAIS
  await addPhotosSection(obra.fotos_ditais_abertura, 'DITAIS - Desligar/Abertura')
  await addPhotosSection(obra.fotos_ditais_impedir, 'DITAIS - Impedir Religamento')
  await addPhotosSection(obra.fotos_ditais_testar, 'DITAIS - Testar Ausência de Tensão')
  await addPhotosSection(obra.fotos_ditais_aterrar, 'DITAIS - Aterrar')
  await addPhotosSection(obra.fotos_ditais_sinalizar, 'DITAIS - Sinalizar/Isolar')

  // Book de Aterramento
  await addPhotosSection(obra.fotos_aterramento_vala_aberta, 'Aterramento - Vala Aberta')
  await addPhotosSection(obra.fotos_aterramento_hastes, 'Aterramento - Hastes Aplicadas')
  await addPhotosSection(obra.fotos_aterramento_vala_fechada, 'Aterramento - Vala Fechada')
  await addPhotosSection(obra.fotos_aterramento_medicao, 'Aterramento - Medição Terrômetro')

  // Transformador
  await addPhotosSection(obra.fotos_transformador_laudo, 'Transformador - Laudo')
  await addPhotosSection(obra.fotos_transformador_componente_instalado, 'Transformador - Componente Instalado')
  await addPhotosSection(obra.fotos_transformador_tombamento_instalado, 'Transformador - Tombamento (Instalado)')
  await addPhotosSection(obra.fotos_transformador_tape, 'Transformador - Tape')
  await addPhotosSection(obra.fotos_transformador_placa_instalado, 'Transformador - Placa (Instalado)')
  await addPhotosSection(obra.fotos_transformador_instalado, 'Transformador - Instalado')
  await addPhotosSection(obra.fotos_transformador_antes_retirar, 'Transformador - Antes de Retirar')
  await addPhotosSection(obra.fotos_transformador_laudo_retirado, 'Transformador - Laudo (Retirado)')
  await addPhotosSection(obra.fotos_transformador_tombamento_retirado, 'Transformador - Tombamento (Retirado)')
  await addPhotosSection(obra.fotos_transformador_placa_retirado, 'Transformador - Placa (Retirado)')

  // Medidor
  await addPhotosSection(obra.fotos_medidor_padrao, 'Medidor - Padrão c/ Medidor Instalado')
  await addPhotosSection(obra.fotos_medidor_leitura, 'Medidor - Leitura c/ Medidor Instalado')
  await addPhotosSection(obra.fotos_medidor_selo_born, 'Medidor - Selo do Born do Medidor')
  await addPhotosSection(obra.fotos_medidor_selo_caixa, 'Medidor - Selo da Caixa')
  await addPhotosSection(obra.fotos_medidor_identificador_fase, 'Medidor - Identificador de Fase')

  // Checklist de Fiscalização (ordem do formulário do app)
  // 1. Croqui
  await addPhotosSection(obra.fotos_checklist_croqui, 'Checklist - 1. Croqui da Obra')

  // 2. Panorâmica Inicial
  await addPhotosSection(obra.fotos_checklist_panoramica_inicial, 'Checklist - 2. Panorâmica Inicial')

  // 3. CHEDE (Chave com Componente)
  await addPhotosSection(obra.fotos_checklist_chede, 'Checklist - 3. Foto da Chave com Componente (CHEDE)')

  // 4. Postes (organizado por poste)
  const mergedPostes = !hasRealPhotos(obra.checklist_postes_data) && (obra.fotos_checklist_postes?.length ?? 0) > 0
    ? mergePostesPhotosWithStructure(obra.checklist_postes_data, obra.fotos_checklist_postes)
    : obra.checklist_postes_data;

  if (hasRealPhotos(mergedPostes) && mergedPostes) {
    for (let posteIndex = 0; posteIndex < mergedPostes.length; posteIndex++) {
      const poste = mergedPostes[posteIndex];
      const prefixo = poste.isAditivo ? 'AD-P' : 'P';
      const label = poste.numero ? `${prefixo}${poste.numero}` : `Poste ${posteIndex + 1}`;
      const status = poste.status || '';
      const statusText = status ? ` (${status})` : '';

      // Renderizar cada tipo de foto do poste
      if (poste.posteInteiro?.length > 0) {
        await addPhotosSection(poste.posteInteiro, `Checklist - 4. ${label}${statusText} - Poste Inteiro`)
      }
      if (poste.descricao?.length > 0) {
        await addPhotosSection(poste.descricao, `Checklist - 4. ${label}${statusText} - Descrição do Poste`)
      }
      if (poste.engaste?.length > 0) {
        await addPhotosSection(poste.engaste, `Checklist - 4. ${label}${statusText} - Engaste`)
      }
      if (poste.conexao1?.length > 0) {
        await addPhotosSection(poste.conexao1, `Checklist - 4. ${label}${statusText} - Conexão 1`)
      }
      if (poste.conexao2?.length > 0) {
        await addPhotosSection(poste.conexao2, `Checklist - 4. ${label}${statusText} - Conexão 2`)
      }
      if (poste.maiorEsforco?.length > 0) {
        await addPhotosSection(poste.maiorEsforco, `Checklist - 4. ${label}${statusText} - Maior Esforço`)
      }
      if (poste.menorEsforco?.length > 0) {
        await addPhotosSection(poste.menorEsforco, `Checklist - 4. ${label}${statusText} - Menor Esforço`)
      }
    }
  } else if ((obra.fotos_checklist_postes?.length ?? 0) > 0) {
    // Fallback: mostrar todas as fotos juntas se não conseguir organizar
    await addPhotosSection(obra.fotos_checklist_postes, 'Checklist - 4. Postes')
  }

  // 5, 6 e 7. Emendas, Podas e Seccionamentos
  const checklistLinearData = Array.isArray(obra.checklist_seccionamentos_data)
    ? obra.checklist_seccionamentos_data.map((item: any, index: number) => ({ ...item, __index: index }))
    : []

  const checklistLinearWithPhotos = checklistLinearData.filter((item: any) => normalizePhotoRefs(item.fotos).length > 0)

  if (checklistLinearWithPhotos.length > 0) {
    const configs = [
      { tipo: 'emenda' as const, numeroSecao: 5, titulo: 'Emenda', prefixo: 'E' },
      { tipo: 'poda' as const, numeroSecao: 6, titulo: 'Poda', prefixo: 'PD' },
      { tipo: 'seccionamento' as const, numeroSecao: 7, titulo: 'Seccionamento de Cerca', prefixo: 'S' }
    ]

    for (const config of configs) {
      const itens = checklistLinearWithPhotos.filter((item: any) => getChecklistLinearTipo(item) === config.tipo)
      for (let itemIndex = 0; itemIndex < itens.length; itemIndex++) {
        const item = itens[itemIndex]
        const fotos = normalizePhotoRefs(item.fotos)
        if (fotos.length === 0) continue

        const numero = item.numero || (itemIndex + 1)
        const label = `${config.prefixo}${numero}`
        const trecho = config.tipo === 'seccionamento' ? null : getChecklistTrechoLabel(item)
        const sufixoTrecho = trecho ? ` - ${trecho}` : ''
        await addPhotosSection(fotos, `Checklist - ${config.numeroSecao}. ${config.titulo} ${label}${sufixoTrecho}`)
      }
    }
  } else {
    await addPhotosSection(obra.fotos_checklist_seccionamentos, 'Checklist - 5 a 7. Emendas, Podas e Seccionamentos')
  }

  // 8. Aterramento de Cerca
  await addPhotosSection(obra.fotos_checklist_aterramento_cerca, 'Checklist - 8. Aterramento de Cerca')

  // 9. Padrão Geral
  await addPhotosSection(obra.fotos_checklist_padrao_geral, 'Checklist - 9. Padrão de Ligação - Geral')

  // 10. Padrão Interno
  await addPhotosSection(obra.fotos_checklist_padrao_interno, 'Checklist - 10. Padrão de Ligação - Interno')

  // 11. Flying
  await addPhotosSection(obra.fotos_checklist_frying, 'Checklist - 11. Flying')

  // 12. Abertura e Fechamento de Pulo
  await addPhotosSection(obra.fotos_checklist_abertura_fechamento_pulo, 'Checklist - 12. Abertura e Fechamento de Pulo')

  // 13. Hastes Aplicadas e Medição do Termômetro
  if (hasRealPhotos(obra.checklist_hastes_termometros_data) && obra.checklist_hastes_termometros_data) {
    for (let pontoIndex = 0; pontoIndex < obra.checklist_hastes_termometros_data.length; pontoIndex++) {
      const ponto = obra.checklist_hastes_termometros_data[pontoIndex]
      const prefixo = ponto.isAditivo ? 'AD-P' : 'P'
      const label = ponto.numero ? `${prefixo}${ponto.numero}` : `Ponto ${pontoIndex + 1}`

      if (ponto.fotoHaste?.length > 0) {
        await addPhotosSection(ponto.fotoHaste, `Checklist - 13. ${label} - Haste Aplicada`)
      }
      if (ponto.fotoTermometro?.length > 0) {
        await addPhotosSection(ponto.fotoTermometro, `Checklist - 13. ${label} - Medição do Termômetro`)
      }
    }
  } else {
    // Fallback: fotos planas (compatibilidade)
    await addPhotosSection(obra.fotos_checklist_hastes_aplicadas, 'Checklist - 13. Hastes Aplicadas')
    await addPhotosSection(obra.fotos_checklist_medicao_termometro, 'Checklist - 13. Medição do Termômetro')
  }

  // 14. Panorâmica Final
  await addPhotosSection(obra.fotos_checklist_panoramica_final, 'Checklist - 14. Panorâmica Final')

  // Altimetria
  await addPhotosSection(obra.fotos_altimetria_lado_fonte, 'Altimetria - Lado Fonte')
  await addPhotosSection(obra.fotos_altimetria_medicao_fonte, 'Altimetria - Medição Fonte')
  await addPhotosSection(obra.fotos_altimetria_lado_carga, 'Altimetria - Lado Carga')
  await addPhotosSection(obra.fotos_altimetria_medicao_carga, 'Altimetria - Medição Carga')

  // Vazamento e Limpeza de Transformador
  await addPhotosSection(obra.fotos_vazamento_evidencia, 'Vazamento - Evidência do Vazamento de Óleo')
  await addPhotosSection(obra.fotos_vazamento_equipamentos_limpeza, 'Vazamento - Equipamentos de Limpeza')
  await addPhotosSection(obra.fotos_vazamento_tombamento_retirado, 'Vazamento - Tombamento Transformador Retirado')
  await addPhotosSection(obra.fotos_vazamento_placa_retirado, 'Vazamento - Placa Transformador Retirado')
  await addPhotosSection(obra.fotos_vazamento_tombamento_instalado, 'Vazamento - Tombamento Transformador Instalado')
  await addPhotosSection(obra.fotos_vazamento_placa_instalado, 'Vazamento - Placa Transformador Instalado')
  await addPhotosSection(obra.fotos_vazamento_instalacao, 'Vazamento - Instalação do Transformador')

  // Documentação (PDFs)
  await addPhotosSection(obra.doc_cadastro_medidor, 'Documentação - Cadastro de Medidor')
  await addPhotosSection(obra.doc_laudo_transformador, 'Documentação - Laudo de Transformador')
  await addPhotosSection(obra.doc_laudo_regulador, 'Documentação - Laudo de Regulador')
  await addPhotosSection(obra.doc_laudo_religador, 'Documentação - Laudo de Religador')
  await addPhotosSection(obra.doc_apr, 'Documentação - APR (Análise Preliminar de Risco)')
  await addPhotosSection(obra.doc_fvbt, 'Documentação - FVBT (Formulário de Vistoria de Baixa Tensão)')
  await addPhotosSection(obra.doc_termo_desistencia_lpt, 'Documentação - Termo de Desistência LPT')

}

export async function generatePDF(obra: Obra) {
  const [logoTeccelData, logoEnergisaData] = await Promise.all([
    loadPdfLogo('/logo_teccel.png'),
    loadPdfLogo('/logo_energisa.png'),
  ])

  const pdf = new jsPDF()
  const pageWidth = pdf.internal.pageSize.getWidth()
  const pageHeight = pdf.internal.pageSize.getHeight()
  const margin = 15

  await addObraContentToPdf(pdf, obra, logoTeccelData, logoEnergisaData)
  addPdfFooters(pdf, `Equipe: ${obra.equipe}`, margin, pageWidth, pageHeight)

  const nomeArquivo = `Obra_${obra.obra}_${obra.equipe.replace(/\s+/g, '_')}_${format(new Date(), 'yyyy-MM-dd_HHmm')}.pdf`
  pdf.save(nomeArquivo)
}

export async function generateCombinedPDF(obras: Obra[]) {
  if (obras.length === 0) return

  const [logoTeccelData, logoEnergisaData] = await Promise.all([
    loadPdfLogo('/logo_teccel.png'),
    loadPdfLogo('/logo_energisa.png'),
  ])

  const pdf = new jsPDF()
  const pageWidth = pdf.internal.pageSize.getWidth()
  const pageHeight = pdf.internal.pageSize.getHeight()
  const margin = 15

  for (let i = 0; i < obras.length; i++) {
    if (i > 0) pdf.addPage()
    await addObraContentToPdf(pdf, obras[i], logoTeccelData, logoEnergisaData)
  }

  const nums = [...new Set(obras.map(o => o.obra).filter(Boolean))]
  const obraLabel = nums.length === 1 ? `Obra: ${nums[0]}` : `Obras: ${nums.slice(0, 3).join(', ')}${nums.length > 3 ? '...' : ''}`
  const obraFileTag = nums.length === 1 ? nums[0] : `${nums[0]}_e_outros`
  addPdfFooters(pdf, obraLabel, margin, pageWidth, pageHeight)

  const nomeArquivo = `Obra_${obraFileTag}_Combinado_${format(new Date(), 'yyyy-MM-dd_HHmm')}.pdf`
  pdf.save(nomeArquivo)
}
