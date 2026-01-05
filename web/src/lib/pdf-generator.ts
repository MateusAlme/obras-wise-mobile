import jsPDF from 'jspdf'
import type { Obra, FotoInfo } from './supabase'
import { format } from 'date-fns'
import { ptBR } from 'date-fns/locale'
import { latLongToUTM, formatUTM } from './geocoding'

/**
 * Renderiza uma foto com placa de informações usando Canvas
 * Retorna a imagem como data URL para ser adicionada ao PDF
 */
async function renderPhotoWithPlaca(
  photo: FotoInfo,
  obra: Obra
): Promise<string> {
  return new Promise(async (resolve, reject) => {
    try {
      // Buscar imagem
      const response = await fetch(photo.url)
      const blob = await response.blob()

      const img = new Image()
      img.crossOrigin = 'anonymous'

      img.onload = () => {
        // Criar canvas
        const canvas = document.createElement('canvas')
        canvas.width = img.width
        canvas.height = img.height
        const ctx = canvas.getContext('2d')!

        // Desenhar imagem
        ctx.drawImage(img, 0, 0)

        // Preparar dados da placa
        const obraNumero = photo.placaData?.obraNumero || obra.obra
        const tipoServico = photo.placaData?.tipoServico || obra.tipo_servico
        const equipe = photo.placaData?.equipe || obra.equipe
        const dataHora = photo.placaData?.dataHora || format(new Date(obra.data), "dd/MM/yyyy HH:mm")

        // Calcular UTM se tiver GPS
        let utmDisplay = ''
        if (photo.latitude && photo.longitude) {
          const utm = latLongToUTM(photo.latitude, photo.longitude)
          utmDisplay = formatUTM(utm)
        }

        // Configurar estilo da placa - AUMENTADO PROPORCIONALMENTE para melhor visualização no PDF
        // Escala baseada no tamanho da imagem
        const scale = Math.min(canvas.width / 1200, 2.5) // Fator de escala dinâmico

        const placaWidth = Math.min(canvas.width * 0.65, 800)
        const placaPadding = Math.floor(20 * scale)
        const lineHeight = Math.floor(40 * scale) // Aumentado para melhor espaçamento vertical
        const fontSize = Math.floor(28 * scale) // Aumentado para melhor legibilidade

        // Calcular altura da placa baseado no conteúdo
        let lines = 4 // Mínimo: Obra, Data, Serviço, Equipe
        if (utmDisplay) lines++
        const placaHeight = placaPadding * 2 + lines * lineHeight + Math.floor(20 * scale)

        // Posição da placa (canto inferior esquerdo)
        const placaX = Math.floor(25 * scale)
        const placaY = canvas.height - placaHeight - Math.floor(25 * scale)

        // Desenhar fundo da placa (preto semi-transparente)
        ctx.fillStyle = 'rgba(0, 0, 0, 0.88)'
        ctx.fillRect(placaX, placaY, placaWidth, placaHeight)

        // Desenhar borda azul
        ctx.strokeStyle = 'rgba(37, 99, 235, 0.7)'
        ctx.lineWidth = Math.floor(4 * scale)
        ctx.strokeRect(placaX, placaY, placaWidth, placaHeight)

        // Desenhar textos
        ctx.font = `bold ${fontSize}px Arial`
        ctx.textAlign = 'left'

        let textY = placaY + placaPadding + fontSize

        // Linha 1: Obra
        ctx.fillStyle = '#9ca3af'
        ctx.font = `${Math.floor(fontSize * 0.9)}px Arial`
        ctx.fillText('Obra:', placaX + placaPadding, textY)
        ctx.fillStyle = '#ffffff'
        ctx.font = `bold ${fontSize}px Arial`
        ctx.fillText(obraNumero, placaX + placaPadding + Math.floor(95 * scale), textY)
        textY += lineHeight

        // Linha 2: Data/Hora
        ctx.fillStyle = '#9ca3af'
        ctx.font = `${Math.floor(fontSize * 0.9)}px Arial`
        ctx.fillText('Data/Hora:', placaX + placaPadding, textY)
        ctx.fillStyle = '#ffffff'
        ctx.font = `${Math.floor(fontSize * 0.9)}px Arial`
        ctx.fillText(dataHora, placaX + placaPadding + Math.floor(145 * scale), textY)
        textY += lineHeight

        // Linha 3: Serviço (truncar se muito longo)
        ctx.fillStyle = '#9ca3af'
        ctx.font = `${Math.floor(fontSize * 0.9)}px Arial`
        ctx.fillText('Serviço:', placaX + placaPadding, textY)
        ctx.fillStyle = '#ffffff'
        ctx.font = `${Math.floor(fontSize * 0.9)}px Arial`
        const servicoTruncado = tipoServico.length > 25 ? tipoServico.substring(0, 25) + '...' : tipoServico
        ctx.fillText(servicoTruncado, placaX + placaPadding + Math.floor(115 * scale), textY)
        textY += lineHeight

        // Linha 4: Equipe
        ctx.fillStyle = '#9ca3af'
        ctx.font = `${Math.floor(fontSize * 0.9)}px Arial`
        ctx.fillText('Equipe:', placaX + placaPadding, textY)
        ctx.fillStyle = '#ffffff'
        ctx.font = `bold ${fontSize}px Arial`
        ctx.fillText(equipe, placaX + placaPadding + Math.floor(115 * scale), textY)
        textY += lineHeight

        // Linha 5: UTM (se disponível)
        if (utmDisplay) {
          ctx.fillStyle = '#9ca3af'
          ctx.font = `${Math.floor(fontSize * 0.85)}px Arial`
          ctx.fillText('UTM:', placaX + placaPadding, textY)
          ctx.fillStyle = '#34d399'
          ctx.font = `${Math.floor(fontSize * 0.85)}px monospace`
          ctx.fillText(utmDisplay, placaX + placaPadding + Math.floor(70 * scale), textY)
        }

        // Converter canvas para data URL
        resolve(canvas.toDataURL('image/jpeg', 0.85))
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

export async function generatePDF(obra: Obra) {
  const pdf = new jsPDF()
  const pageWidth = pdf.internal.pageSize.getWidth()
  const pageHeight = pdf.internal.pageSize.getHeight()
  const margin = 15
  let yPos = 15
  const columns = 1 // 1 FOTO POR PÁGINA
  const gap = 8
  const availableWidth = pageWidth - margin * 2
  const imageWidth = availableWidth // Largura total da página (exceto margens)
  const imageHeight = imageWidth * 0.75 // Mantém proporção 4:3

  // Carregar logo da Energisa com dimensões
  let logoData: { dataUrl: string; width: number; height: number } | null = null

  try {
    logoData = await new Promise<{ dataUrl: string; width: number; height: number }>((resolve, reject) => {
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
          console.error('Erro ao processar logo:', err)
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
    logoData = null
  }

  const logoEnergisa = logoData?.dataUrl

  // ========== CABEÇALHO ENERGISA (COMPACTO) ==========

  const headerWidth = pageWidth - 2 * margin
  const headerTitleHeight = 8 // REDUZIDO de 10 para 8
  const headerBodyHeight = 20 // REDUZIDO de 35 para 20
  const headerHeight = headerTitleHeight + headerBodyHeight

  // Borda do cabeçalho
  pdf.setDrawColor(0, 0, 0)
  pdf.setLineWidth(0.5)
  pdf.rect(margin, yPos, headerWidth, headerHeight)

  // Linha horizontal entre título e corpo
  pdf.line(margin, yPos + headerTitleHeight, margin + headerWidth, yPos + headerTitleHeight)

  // Título centralizado (fonte menor)
  pdf.setFontSize(10) // REDUZIDO de 12 para 10
  pdf.setFont('helvetica', 'bold')
  pdf.text('RELATÓRIO DE ATIPICIDADE', margin + headerWidth / 2, yPos + 6, { align: 'center' }) // AJUSTADO de 7 para 6

  // Divisão vertical entre infos e logo (apenas no corpo)
  const logoWidth = headerWidth * 0.32
  const infoWidth = headerWidth - logoWidth
  pdf.line(margin + infoWidth, yPos + headerTitleHeight, margin + infoWidth, yPos + headerHeight)

  // Divisão vertical entre DATA e OBRA (apenas no corpo)
  const dataSectionWidth = infoWidth * 0.35
  pdf.line(margin + dataSectionWidth, yPos + headerTitleHeight, margin + dataSectionWidth, yPos + headerHeight)

  const bodyTextY = yPos + headerTitleHeight + headerBodyHeight / 2 + 2 // AJUSTADO de +4 para +2

  // DATA
  pdf.setFontSize(9) // REDUZIDO de 11 para 9
  pdf.setFont('helvetica', 'bold')
  pdf.text('DATA:', margin + 2, bodyTextY)
  pdf.setFont('helvetica', 'normal')
  pdf.text(format(new Date(obra.data), 'dd/MM/yyyy'), margin + 18, bodyTextY) // AJUSTADO de 22 para 18

  // OBRA
  pdf.setFont('helvetica', 'bold')
  pdf.text('OBRA:', margin + dataSectionWidth + 2, bodyTextY)
  pdf.setFont('helvetica', 'normal')
  pdf.text(obra.obra || '-', margin + dataSectionWidth + 18, bodyTextY) // AJUSTADO de 22 para 18

  // Logo Energisa (imagem centralizada e ajustada mantendo proporção - COMPACTA)
  if (logoData && logoEnergisa) {
    try {
      const logoMaxWidth = logoWidth - 4 // REDUZIDO de 6 para 4
      const logoMaxHeight = headerBodyHeight - 4 // REDUZIDO de 6 para 4

      // Calcular proporção da logo usando as dimensões já carregadas
      const logoAspectRatio = logoData.width / logoData.height
      let finalWidth = logoMaxWidth
      let finalHeight = logoMaxWidth / logoAspectRatio

      // Se altura calculada for maior que o máximo, ajustar pela altura
      if (finalHeight > logoMaxHeight) {
        finalHeight = logoMaxHeight
        finalWidth = logoMaxHeight * logoAspectRatio
      }

      // Centralizar a logo no espaço disponível
      const logoX = margin + infoWidth + (logoWidth - finalWidth) / 2
      const logoY = yPos + headerTitleHeight + (headerBodyHeight - finalHeight) / 2

      // Adicionar logo com proporção correta
      pdf.addImage(logoEnergisa, 'PNG', logoX, logoY, finalWidth, finalHeight, undefined, 'FAST')
    } catch (error) {
      // Fallback para texto se erro ao adicionar
      console.error('Erro ao adicionar logo ao PDF:', error)
      pdf.setFontSize(14) // REDUZIDO de 18 para 14
      pdf.setFont('helvetica', 'bold')
      pdf.setTextColor(0, 122, 204)
      pdf.text('energisa', margin + infoWidth + logoWidth / 2, yPos + headerTitleHeight + 11, { align: 'center' }) // AJUSTADO de 14 para 11
      pdf.setTextColor(0, 0, 0)
    }
  } else {
    // Fallback para texto se logo não carregou
    console.warn('Logo Energisa não carregada, usando texto')
    pdf.setFontSize(14) // REDUZIDO de 18 para 14
    pdf.setFont('helvetica', 'bold')
    pdf.setTextColor(0, 122, 204)
    pdf.text('energisa', margin + infoWidth + logoWidth / 2, yPos + headerTitleHeight + 11, { align: 'center' }) // AJUSTADO de 14 para 11
    pdf.setTextColor(0, 0, 0)
  }

  yPos += headerHeight

  // ========== SEÇÃO DE ATIPICIDADES ==========

  // Header da seção
  const atipicidadeHeaderHeight = 10
  pdf.setFillColor(240, 240, 240)
  pdf.rect(margin, yPos, pageWidth - 2 * margin, atipicidadeHeaderHeight, 'F')
  pdf.rect(margin, yPos, pageWidth - 2 * margin, atipicidadeHeaderHeight)

  pdf.setFontSize(10)
  pdf.setFont('helvetica', 'bold')
  pdf.text('DESCRIÇÃO DA ATIPICIDADE', margin + 2, yPos + 7)

  yPos += atipicidadeHeaderHeight

  // Buscar array de atipicidades reais (importar do arquivo principal)
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

  // Obter atipicidades selecionadas
  const atipicidadesDetalhadas = (obra.atipicidades || [])
    .map(id => ATIPICIDADES.find(a => a.id === id))
    .filter(Boolean) as typeof ATIPICIDADES

  // Calcular altura necessária baseada no número de atipicidades
  const lineHeight = 18 // Altura por linha de atipicidade
  const numAtipicidades = atipicidadesDetalhadas.length
  const atipBoxHeight = Math.max(numAtipicidades * lineHeight + 10, 30)

  // Desenhar borda geral
  pdf.rect(margin, yPos, pageWidth - 2 * margin, atipBoxHeight)

  // Layout em 3 colunas: Nº | Atipicidade | Descrição
  const numColWidth = 10 // Largura da coluna de número
  const atipColWidth = 60 // Largura da coluna de atipicidade
  const descColWidth = (pageWidth - 2 * margin) - numColWidth - atipColWidth - 2 // Restante para descrição

  // Divisões verticais entre colunas
  pdf.line(margin + numColWidth, yPos, margin + numColWidth, yPos + atipBoxHeight)
  pdf.line(margin + numColWidth + atipColWidth, yPos, margin + numColWidth + atipColWidth, yPos + atipBoxHeight)

  // Desenhar cada atipicidade em uma linha
  let currentY = yPos + 6
  pdf.setFontSize(7)

  atipicidadesDetalhadas.forEach((atip, index) => {
    // Linha horizontal entre atipicidades (exceto a primeira)
    if (index > 0) {
      pdf.line(margin, currentY - 3, pageWidth - margin, currentY - 3)
    }

    // Coluna 1: Número
    pdf.setFont('helvetica', 'bold')
    pdf.setTextColor(220, 53, 69) // Vermelho
    pdf.text(`${atip.id}.`, margin + 3, currentY + 4, { align: 'left' })

    // Coluna 2: Título da Atipicidade
    pdf.setTextColor(0, 0, 0)
    pdf.setFont('helvetica', 'bold')
    const titulo = pdf.splitTextToSize(atip.titulo, atipColWidth - 4)
    pdf.text(titulo, margin + numColWidth + 2, currentY + 4)

    // Coluna 3: Descrição
    pdf.setFont('helvetica', 'normal')
    pdf.setTextColor(60, 60, 60)
    const descricao = pdf.splitTextToSize(atip.descricao, descColWidth - 4)
    pdf.text(descricao, margin + numColWidth + atipColWidth + 2, currentY + 4)

    currentY += lineHeight
  })

  // Reset
  pdf.setTextColor(0, 0, 0)
  yPos += atipBoxHeight

  // Fotos
  yPos += 10
  pdf.setFont('helvetica', 'bold')
  pdf.setFontSize(14)
  pdf.text('Fotos da Obra', margin, yPos)
  yPos += 10

  // Função para adicionar fotos com placa - 1 FOTO POR PÁGINA
  const addPhotosSection = async (photos: FotoInfo[] | undefined, title: string) => {
    if (!photos || photos.length === 0) return

    for (let i = 0; i < photos.length; i++) {
      const photo = photos[i]

      try {
        // Nova página para cada foto (exceto a primeira foto se ainda couber na página atual)
        if (i > 0 || yPos > pageHeight - imageHeight - 40) {
          pdf.addPage()
          yPos = margin
        }

        // Cabeçalho da seção com contador de fotos
        pdf.setFontSize(11)
        pdf.setFont('helvetica', 'bold')
        pdf.text(`${title} (${i + 1}/${photos.length})`, margin, yPos)
        yPos += 10

        // Renderizar foto com placa
        const photoWithPlaca = await renderPhotoWithPlaca(photo, obra)

        // Adicionar foto ocupando toda a largura disponível
        pdf.addImage(photoWithPlaca, 'JPEG', margin, yPos, imageWidth, imageHeight)

        // Resetar posição para próxima seção (será sobrescrito por addPage)
        yPos += imageHeight + gap

      } catch (error) {
        console.error('Erro ao adicionar foto:', error)

        if (i > 0 || yPos > pageHeight - 40) {
          pdf.addPage()
          yPos = margin
        }

        pdf.setFont('helvetica', 'normal')
        pdf.setFontSize(10)
        pdf.text(`${title} - Foto ${i + 1}: (Erro ao carregar imagem)`, margin, yPos)
        yPos += 15
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
  if (obra.transformador_status) {
    pdf.setFontSize(12)
    pdf.setFont('helvetica', 'bold')
    pdf.setTextColor(0, 122, 255) // Blue
    pdf.text(`Transformador - Status: ${obra.transformador_status}`, margin, yPos)
    pdf.setTextColor(0, 0, 0)
    yPos += 10
  }

  await addPhotosSection(obra.fotos_transformador_laudo, 'Transformador - Laudo')
  await addPhotosSection(obra.fotos_transformador_componente_instalado, 'Transformador - Componente Instalado')
  await addPhotosSection(obra.fotos_transformador_tombamento_instalado, 'Transformador - Tombamento (Instalado)')
  await addPhotosSection(obra.fotos_transformador_tape, 'Transformador - Tape')
  await addPhotosSection(obra.fotos_transformador_placa_instalado, 'Transformador - Placa (Instalado)')
  await addPhotosSection(obra.fotos_transformador_instalado, 'Transformador - Instalado')
  await addPhotosSection(obra.fotos_transformador_antes_retirar, 'Transformador - Antes de Retirar')
  await addPhotosSection(obra.fotos_transformador_tombamento_retirado, 'Transformador - Tombamento (Retirado)')
  await addPhotosSection(obra.fotos_transformador_placa_retirado, 'Transformador - Placa (Retirado)')

  // Medidor
  await addPhotosSection(obra.fotos_medidor_padrao, 'Medidor - Padrão c/ Medidor Instalado')
  await addPhotosSection(obra.fotos_medidor_leitura, 'Medidor - Leitura c/ Medidor Instalado')
  await addPhotosSection(obra.fotos_medidor_selo_born, 'Medidor - Selo do Born do Medidor')
  await addPhotosSection(obra.fotos_medidor_selo_caixa, 'Medidor - Selo da Caixa')
  await addPhotosSection(obra.fotos_medidor_identificador_fase, 'Medidor - Identificador de Fase')

  // Checklist de Fiscalização
  await addPhotosSection(obra.fotos_checklist_croqui, 'Checklist - Croqui')
  await addPhotosSection(obra.fotos_checklist_panoramica_inicial, 'Checklist - Foto Panorâmica Inicial')
  await addPhotosSection(obra.fotos_checklist_chede, 'Checklist - CHEDE')
  await addPhotosSection(obra.fotos_checklist_aterramento_cerca, 'Checklist - Aterramento de Cerca')
  await addPhotosSection(obra.fotos_checklist_padrao_geral, 'Checklist - Padrão Geral')
  await addPhotosSection(obra.fotos_checklist_padrao_interno, 'Checklist - Padrão Interno')
  await addPhotosSection(obra.fotos_checklist_panoramica_final, 'Checklist - Foto Panorâmica Final')
  await addPhotosSection(obra.fotos_checklist_postes, 'Checklist - Postes')
  await addPhotosSection(obra.fotos_checklist_seccionamentos, 'Checklist - Seccionamentos')

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

  // Footer
  const totalPages = pdf.internal.pages.length - 1 // -1 porque a primeira página é null
  for (let i = 1; i <= totalPages; i++) {
    pdf.setPage(i)
    pdf.setFontSize(8)
    pdf.setFont('helvetica', 'normal')
    pdf.setTextColor(128, 128, 128)

    // Linha da esquerda: Data de geração
    pdf.text(
      `Gerado em ${format(new Date(), "dd/MM/yyyy 'às' HH:mm")}`,
      margin,
      pageHeight - 10
    )

    // Linha do centro: Equipe (destacado)
    pdf.setFont('helvetica', 'bold')
    pdf.setTextColor(220, 53, 69) // Vermelho
    pdf.text(`Equipe: ${obra.equipe}`, pageWidth / 2, pageHeight - 10, { align: 'center' })

    // Linha da direita: Número da página
    pdf.setFont('helvetica', 'normal')
    pdf.setTextColor(128, 128, 128)
    pdf.text(`Página ${i} de ${totalPages}`, pageWidth - margin - 30, pageHeight - 10)
  }

  // Salvar PDF com nome incluindo equipe
  const nomeArquivo = `Obra_${obra.obra}_${obra.equipe.replace(/\s+/g, '_')}_${format(new Date(), 'yyyy-MM-dd_HHmm')}.pdf`
  pdf.save(nomeArquivo)
}
