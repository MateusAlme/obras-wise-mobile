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

        // Configurar estilo da placa
        const placaWidth = Math.min(canvas.width * 0.35, 300)
        const placaPadding = 12
        const lineHeight = 18
        const fontSize = 13

        // Calcular altura da placa baseado no conteúdo
        let lines = 4 // Mínimo: Obra, Data, Serviço, Equipe
        if (utmDisplay) lines++
        const placaHeight = placaPadding * 2 + lines * lineHeight + 10

        // Posição da placa (canto inferior esquerdo)
        const placaX = 15
        const placaY = canvas.height - placaHeight - 15

        // Desenhar fundo da placa (preto semi-transparente)
        ctx.fillStyle = 'rgba(0, 0, 0, 0.88)'
        ctx.fillRect(placaX, placaY, placaWidth, placaHeight)

        // Desenhar borda azul
        ctx.strokeStyle = 'rgba(37, 99, 235, 0.7)'
        ctx.lineWidth = 2
        ctx.strokeRect(placaX, placaY, placaWidth, placaHeight)

        // Desenhar textos
        ctx.font = `bold ${fontSize}px Arial`
        ctx.textAlign = 'left'

        let textY = placaY + placaPadding + fontSize

        // Linha 1: Obra
        ctx.fillStyle = '#9ca3af'
        ctx.font = `${fontSize - 1}px Arial`
        ctx.fillText('Obra:', placaX + placaPadding, textY)
        ctx.fillStyle = '#ffffff'
        ctx.font = `bold ${fontSize}px Arial`
        ctx.fillText(obraNumero, placaX + placaPadding + 50, textY)
        textY += lineHeight

        // Linha 2: Data/Hora
        ctx.fillStyle = '#9ca3af'
        ctx.font = `${fontSize - 1}px Arial`
        ctx.fillText('Data/Hora:', placaX + placaPadding, textY)
        ctx.fillStyle = '#ffffff'
        ctx.font = `${fontSize - 1}px Arial`
        ctx.fillText(dataHora, placaX + placaPadding + 75, textY)
        textY += lineHeight

        // Linha 3: Serviço (truncar se muito longo)
        ctx.fillStyle = '#9ca3af'
        ctx.font = `${fontSize - 1}px Arial`
        ctx.fillText('Serviço:', placaX + placaPadding, textY)
        ctx.fillStyle = '#ffffff'
        ctx.font = `${fontSize - 1}px Arial`
        const servicoTruncado = tipoServico.length > 20 ? tipoServico.substring(0, 20) + '...' : tipoServico
        ctx.fillText(servicoTruncado, placaX + placaPadding + 60, textY)
        textY += lineHeight

        // Linha 4: Equipe
        ctx.fillStyle = '#9ca3af'
        ctx.font = `${fontSize - 1}px Arial`
        ctx.fillText('Equipe:', placaX + placaPadding, textY)
        ctx.fillStyle = '#ffffff'
        ctx.font = `bold ${fontSize}px Arial`
        ctx.fillText(equipe, placaX + placaPadding + 60, textY)
        textY += lineHeight

        // Linha 5: UTM (se disponível)
        if (utmDisplay) {
          ctx.fillStyle = '#9ca3af'
          ctx.font = `${fontSize - 2}px Arial`
          ctx.fillText('UTM:', placaX + placaPadding, textY)
          ctx.fillStyle = '#34d399'
          ctx.font = `${fontSize - 2}px monospace`
          ctx.fillText(utmDisplay, placaX + placaPadding + 40, textY)
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
  const margin = 20
  let yPos = 20

  // Título
  pdf.setFontSize(20)
  pdf.setFont('helvetica', 'bold')
  pdf.text('Relatório de Obra', pageWidth / 2, yPos, { align: 'center' })

  yPos += 15

  // Banner da Equipe (destacado)
  pdf.setFillColor(220, 53, 69) // Vermelho
  pdf.rect(margin, yPos, pageWidth - 2 * margin, 12, 'F')
  pdf.setFontSize(14)
  pdf.setFont('helvetica', 'bold')
  pdf.setTextColor(255, 255, 255) // Branco
  pdf.text(`EQUIPE: ${obra.equipe}`, margin + 5, yPos + 8)
  pdf.setTextColor(0, 0, 0) // Voltar para preto

  yPos += 18

  // Informações da Obra
  pdf.setFontSize(12)
  pdf.setFont('helvetica', 'normal')

  const info = [
    ['Obra:', obra.obra],
    ['Data:', format(new Date(obra.data), "dd 'de' MMMM 'de' yyyy", { locale: ptBR })],
    ['Responsável:', obra.responsavel],
    ['Tipo de Serviço:', obra.tipo_servico],
  ]

  info.forEach(([label, value]) => {
    pdf.setFont('helvetica', 'bold')
    pdf.text(label, margin, yPos)
    pdf.setFont('helvetica', 'normal')
    pdf.text(value, margin + 40, yPos)
    yPos += 8
  })

  // Atipicidades
  if (obra.tem_atipicidade) {
    yPos += 5
    pdf.setFont('helvetica', 'bold')
    pdf.setTextColor(255, 140, 0) // Orange
    pdf.text('⚠ ATIPICIDADES:', margin, yPos)
    pdf.setTextColor(0, 0, 0)
    yPos += 8

    pdf.setFont('helvetica', 'normal')
    pdf.text(`Quantidade: ${obra.atipicidades.length}`, margin, yPos)
    yPos += 8

    if (obra.descricao_atipicidade) {
      const lines = pdf.splitTextToSize(obra.descricao_atipicidade, pageWidth - 2 * margin)
      pdf.text(lines, margin, yPos)
      yPos += lines.length * 6
    }
  }

  // Fotos
  yPos += 10
  pdf.setFont('helvetica', 'bold')
  pdf.setFontSize(14)
  pdf.text('Fotos da Obra', margin, yPos)
  yPos += 10

  // Função para adicionar fotos com placa
  const addPhotosSection = async (
    photos: FotoInfo[] | undefined,
    title: string
  ) => {
    if (!photos || photos.length === 0) return

    // Verificar se precisa de nova página
    if (yPos > pageHeight - 80) {
      pdf.addPage()
      yPos = margin
    }

    pdf.setFontSize(12)
    pdf.setFont('helvetica', 'bold')
    pdf.text(title, margin, yPos)
    yPos += 8

    for (const photo of photos) {
      try {
        // Renderizar foto com placa
        const photoWithPlaca = await renderPhotoWithPlaca(photo, obra)

        // Verificar espaço na página
        if (yPos > pageHeight - 70) {
          pdf.addPage()
          yPos = margin
        }

        // Adicionar imagem com placa
        const imgWidth = 160
        const imgHeight = 120
        pdf.addImage(photoWithPlaca, 'JPEG', margin, yPos, imgWidth, imgHeight)
        yPos += imgHeight + 5
      } catch (error) {
        console.error('Erro ao adicionar foto:', error)
        pdf.setFont('helvetica', 'normal')
        pdf.setFontSize(10)
        pdf.text('(Erro ao carregar imagem)', margin, yPos)
        yPos += 8
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
