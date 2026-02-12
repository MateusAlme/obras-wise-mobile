import jsPDF from 'jspdf'
import type { Obra, FotoInfo } from './supabase'
import { format, parseISO } from 'date-fns'
import { ptBR } from 'date-fns/locale'
import { latLongToUTM, formatUTM } from './geocoding'

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

  const extractPhotoInfo = (url: string) => {
    const filename = url.split('/').pop() || ''
    const match = filename.match(/checklist_poste_([a-z_]+\d?)_(\d+)_/)
    if (!match) return null
    return {
      tipo: match[1],
      timestamp: parseInt(match[2])
    }
  }

  const tipoToField: Record<string, string> = {
    'inteiro': 'posteInteiro',
    'engaste': 'engaste',
    'conexao1': 'conexao1',
    'conexao2': 'conexao2',
    'maior_esforco': 'maiorEsforco',
    'menor_esforco': 'menorEsforco'
  }

  const photoGroups: { posteIndex: number; tipo: string; photo: FotoInfo }[] = []
  let currentPosteIndex = -1
  let lastInteiroTimestamp = 0

  const sortedPhotos = [...flatPhotos].sort((a, b) => {
    const infoA = extractPhotoInfo(a.url)
    const infoB = extractPhotoInfo(b.url)
    if (!infoA || !infoB) return 0
    return infoA.timestamp - infoB.timestamp
  })

  for (const photo of sortedPhotos) {
    const info = extractPhotoInfo(photo.url)
    if (!info) continue

    if (info.tipo === 'inteiro') {
      if (currentPosteIndex === -1 || info.timestamp - lastInteiroTimestamp > 30000) {
        currentPosteIndex++
        lastInteiroTimestamp = info.timestamp
      }
    }

    if (currentPosteIndex >= 0 && currentPosteIndex < postesData.length) {
      photoGroups.push({
        posteIndex: currentPosteIndex,
        tipo: info.tipo,
        photo
      })
    }
  }

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

    for (const group of photoGroups) {
      if (group.posteIndex === index) {
        const field = tipoToField[group.tipo]
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
    const photoFields = ['posteInteiro', 'engaste', 'conexao1', 'conexao2', 'maiorEsforco', 'menorEsforco', 'fotos', 'fotoHaste', 'fotoTermometro']
    return photoFields.some(field => {
      const value = item[field]
      return Array.isArray(value) && value.length > 0
    })
  })
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
function renderPlacaBelowImage(
  pdf: jsPDF,
  photo: FotoInfo,
  obra: Obra,
  xPos: number,
  yPos: number,
  placaWidth: number
): number {
  // Preparar dados da placa
  const obraNumero = photo.placaData?.obraNumero || obra.obra
  const tipoServico = photo.placaData?.tipoServico || obra.tipo_servico
  const equipe = photo.placaData?.equipe || obra.equipe
  const dataHora = photo.placaData?.dataHora || format(parseISO(obra.data), "dd/MM/yyyy")

  // Calcular UTM se tiver GPS
  let utmDisplay = ''
  if (photo.latitude && photo.longitude) {
    const utm = latLongToUTM(photo.latitude, photo.longitude)
    utmDisplay = formatUTM(utm)
  }

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

export async function generatePDF(obra: Obra) {
  const pdf = new jsPDF()
  const pageWidth = pdf.internal.pageSize.getWidth()
  const pageHeight = pdf.internal.pageSize.getHeight()
  const margin = 15
  let yPos = 15
  const gap = 8
  const availableWidth = pageWidth - margin * 2
  const imageWidth = availableWidth
  const maxImageHeight = pageHeight - margin * 2 - 35 // Espaço para título da seção + placa

  // Carregar logo da Energisa com dimensões
  let logoEnergisaData: { dataUrl: string; width: number; height: number } | null = null

  try {
    logoEnergisaData = await new Promise<{ dataUrl: string; width: number; height: number }>((resolve, reject) => {
      const img = new Image()
      img.crossOrigin = 'anonymous'
      img.onload = () => {
        try {
          const canvas = document.createElement('canvas')
          canvas.width = img.width
          canvas.height = img.height
          const ctx = canvas.getContext('2d')!
          ctx.drawImage(img, 0, 0)
          resolve({
            dataUrl: canvas.toDataURL('image/png'),
            width: img.width,
            height: img.height
          })
        } catch (err) {
          console.error('Erro ao processar logo Energisa:', err)
          reject(err)
        }
      }
      img.onerror = (err) => {
        console.error('Erro ao carregar logo Energisa:', err)
        reject(new Error('Erro ao carregar logo Energisa'))
      }
      img.src = '/logo_energisa.png'
    })
  } catch (error) {
    console.error('Falha ao carregar logo da Energisa:', error)
    logoEnergisaData = null
  }

  // Carregar logo da Teccel
  let logoTeccelData: { dataUrl: string; width: number; height: number } | null = null

  try {
    logoTeccelData = await new Promise<{ dataUrl: string; width: number; height: number }>((resolve, reject) => {
      const img = new Image()
      img.crossOrigin = 'anonymous'
      img.onload = () => {
        try {
          const canvas = document.createElement('canvas')
          canvas.width = img.width
          canvas.height = img.height
          const ctx = canvas.getContext('2d')!
          ctx.drawImage(img, 0, 0)
          resolve({
            dataUrl: canvas.toDataURL('image/png'),
            width: img.width,
            height: img.height
          })
        } catch (err) {
          console.error('Erro ao processar logo Teccel:', err)
          reject(err)
        }
      }
      img.onerror = (err) => {
        console.error('Erro ao carregar logo Teccel:', err)
        reject(new Error('Erro ao carregar logo Teccel'))
      }
      img.src = '/logo_teccel.png'
    })
  } catch (error) {
    console.error('Falha ao carregar logo da Teccel:', error)
    logoTeccelData = null
  }

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
  })).filter(p => p.count > 0)

  if (photoCounts.length > 0) {
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

    photoCounts.forEach((p, idx) => {
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

  const addPhotosSection = async (photos: FotoInfo[] | undefined, title: string) => {
    if (!photos || photos.length === 0) return

    for (let i = 0; i < photos.length; i++) {
      const photo = photos[i]

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
        pdf.text(`${title} (${i + 1}/${photos.length})`, margin + 4, yPos + 8)

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
        renderPlacaBelowImage(pdf, photo, obra, imageX, yPos, finalImageWidth)

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

  // Adicionar cada seção de fotos
  await addPhotosSection(obra.fotos_antes, 'Fotos Antes')
  await addPhotosSection(obra.fotos_durante, 'Fotos Durante')
  await addPhotosSection(obra.fotos_depois, 'Fotos Depois')
  await addPhotosSection(obra.fotos_abertura, 'Fotos Abertura Chave')
  await addPhotosSection(obra.fotos_fechamento, 'Fotos Fechamento Chave')

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

  // 5. Seccionamentos
  await addPhotosSection(obra.fotos_checklist_seccionamentos, 'Checklist - 5. Seccionamentos')

  // 6. Aterramento de Cerca
  await addPhotosSection(obra.fotos_checklist_aterramento_cerca, 'Checklist - 6. Aterramento de Cerca')

  // 7. Padrão Geral
  await addPhotosSection(obra.fotos_checklist_padrao_geral, 'Checklist - 7. Padrão de Ligação - Geral')

  // 8. Padrão Interno
  await addPhotosSection(obra.fotos_checklist_padrao_interno, 'Checklist - 8. Padrão de Ligação - Interno')

  // 9. Frying
  await addPhotosSection(obra.fotos_checklist_frying, 'Checklist - 9. Frying')

  // 10. Abertura e Fechamento de Pulo
  await addPhotosSection(obra.fotos_checklist_abertura_fechamento_pulo, 'Checklist - 10. Abertura e Fechamento de Pulo')

  // 11. Hastes e Termômetros
  // TODO: Adicionar suporte para hastes/termômetros estruturados se necessário

  // 12. Panorâmica Final
  await addPhotosSection(obra.fotos_checklist_panoramica_final, 'Checklist - 12. Panorâmica Final')

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

  // Footer profissional para todas as páginas
  const totalPages = pdf.internal.pages.length - 1 // -1 porque a primeira página é null
  for (let i = 1; i <= totalPages; i++) {
    pdf.setPage(i)

    // Linha divisória no rodapé
    pdf.setDrawColor(220, 220, 220)
    pdf.setLineWidth(0.3)
    pdf.line(margin, pageHeight - 15, pageWidth - margin, pageHeight - 15)

    pdf.setFontSize(7)
    pdf.setFont('helvetica', 'normal')
    pdf.setTextColor(140, 140, 140)

    // Esquerda: Data de geração
    pdf.text(
      `Gerado em ${format(new Date(), "dd/MM/yyyy 'às' HH:mm")}`,
      margin,
      pageHeight - 8
    )

    // Centro: Equipe (destacado)
    pdf.setFont('helvetica', 'bold')
    pdf.setTextColor(0, 102, 204) // Azul corporativo
    pdf.text(`Equipe: ${obra.equipe}`, pageWidth / 2, pageHeight - 8, { align: 'center' })

    // Direita: Número da página
    pdf.setFont('helvetica', 'normal')
    pdf.setTextColor(140, 140, 140)
    pdf.text(`Página ${i} de ${totalPages}`, pageWidth - margin, pageHeight - 8, { align: 'right' })
  }

  // Salvar PDF com nome incluindo equipe
  const nomeArquivo = `Obra_${obra.obra}_${obra.equipe.replace(/\s+/g, '_')}_${format(new Date(), 'yyyy-MM-dd_HHmm')}.pdf`
  pdf.save(nomeArquivo)
}
