/**
 * Renderiza fotos com placa de informações "gravada" (burned-in) usando Canvas API do navegador
 *
 * IMPORTANTE: Este arquivo é APENAS para WEB (navegador)
 * Para MOBILE (Android/iOS), usa-se photo-with-placa-mobile.ts com Skia
 */

import { latLongToUTM, formatUTM, getAddressFromCoords } from './geocoding'

export interface PlacaData {
  obraNumero: string
  tipoServico: string
  equipe: string
  dataHora: string
  latitude?: number
  longitude?: number
}

/**
 * Renderiza uma foto com placa de informações usando Canvas API do navegador
 *
 * A placa é "gravada" permanentemente na imagem (burned-in)
 *
 * @param imageUri - URI da foto original
 * @param placaData - Dados para exibir na placa
 * @returns URI da nova foto com placa gravada
 */
export async function renderPhotoWithPlacaBurnedIn(
  imageUri: string,
  placaData: PlacaData
): Promise<string> {
  console.log('[PLACA WEB] Iniciando renderização...', { imageUri, placaData })

  return new Promise(async (resolve) => {
    try {
      // 1. Calcular UTM se tiver GPS
      let utmDisplay = ''
      if (placaData.latitude && placaData.longitude) {
        const utm = latLongToUTM(placaData.latitude, placaData.longitude)
        utmDisplay = formatUTM(utm)
        console.log('[PLACA WEB] UTM calculado:', utmDisplay)
      }

      // 2. Buscar endereço (com timeout de 3s)
      let endereco = ''
      if (placaData.latitude && placaData.longitude) {
        try {
          const addr = await Promise.race([
            getAddressFromCoords(placaData.latitude, placaData.longitude),
            new Promise<null>((resolve) => setTimeout(() => resolve(null), 3000))
          ])
          if (addr && addr.formattedAddress && addr.formattedAddress !== 'Endereço não disponível') {
            endereco = addr.formattedAddress
          }
        } catch (error) {
          console.log('[PLACA WEB] Erro ao buscar endereço:', error)
        }
      }

      // 3. Carregar imagem
      console.log('[PLACA WEB] Carregando imagem...', imageUri)
      const img = new Image()
      // IMPORTANTE: Não usar crossOrigin para blob: URLs (causa erro CORS)
      if (!imageUri.startsWith('blob:')) {
        img.crossOrigin = 'anonymous'
      }

      img.onload = () => {
        console.log('[PLACA WEB] Imagem carregada!', img.width, 'x', img.height)
        try {
          // 4. Criar canvas
          const canvas = document.createElement('canvas')
          canvas.width = img.width
          canvas.height = img.height
          const ctx = canvas.getContext('2d')

          if (!ctx) {
            throw new Error('Não foi possível criar contexto 2D')
          }

          console.log('[PLACA WEB] Canvas criado, desenhando imagem...')
          // 5. Desenhar imagem original
          ctx.drawImage(img, 0, 0)

          // 6. Configurar dimensões da placa
          const placaPadding = 16
          const lineHeight = 28
          const fontSize = 20
          const fontSizeSmall = 16

          // Calcular número de linhas
          let numLines = 4 // Obra, Data, Serviço, Equipe
          if (utmDisplay) numLines++
          if (endereco) numLines++

          const placaWidth = Math.min(img.width * 0.4, 480)
          const placaHeight = placaPadding * 2 + numLines * lineHeight + 20

          const placaX = 20
          const placaY = img.height - placaHeight - 20

          console.log('[PLACA WEB] Desenhando placa...', { placaWidth, placaHeight, placaX, placaY })

          // 7. Desenhar fundo da placa (preto semi-transparente)
          ctx.fillStyle = 'rgba(0, 0, 0, 0.88)'
          ctx.fillRect(placaX, placaY, placaWidth, placaHeight)

          // 8. Desenhar borda azul
          ctx.strokeStyle = 'rgba(37, 99, 235, 0.7)'
          ctx.lineWidth = 3
          ctx.strokeRect(placaX, placaY, placaWidth, placaHeight)

          // 9. Desenhar textos
          let textY = placaY + placaPadding + fontSize

          // Função auxiliar para desenhar linha de texto
          const drawTextLine = (label: string, value: string, isBold = false, isGreen = false) => {
            // Label (cinza)
            ctx.font = `600 ${fontSizeSmall}px sans-serif`
            ctx.fillStyle = '#9ca3af'
            ctx.fillText(label, placaX + placaPadding, textY)

            // Value (branco ou verde)
            ctx.font = `${isBold ? 'bold' : 'normal'} ${fontSize}px sans-serif`
            ctx.fillStyle = isGreen ? '#34d399' : '#ffffff'
            ctx.fillText(value, placaX + placaPadding + 80, textY)

            textY += lineHeight
          }

          // Desenhar cada linha
          drawTextLine('Obra:', placaData.obraNumero, true)
          drawTextLine('Data:', placaData.dataHora)

          const servicoTrunc = placaData.tipoServico.length > 20
            ? placaData.tipoServico.substring(0, 20) + '...'
            : placaData.tipoServico
          drawTextLine('Serviço:', servicoTrunc)

          drawTextLine('Equipe:', placaData.equipe, true)

          if (utmDisplay) {
            drawTextLine('UTM:', utmDisplay, false, true)
          }

          if (endereco) {
            const enderecoTrunc = endereco.length > 30 ? endereco.substring(0, 30) + '...' : endereco
            drawTextLine('Local:', enderecoTrunc)
          }

          // 10. Converter canvas para blob e criar URL
          console.log('[PLACA WEB] Convertendo canvas para blob...')
          canvas.toBlob((blob) => {
            if (blob) {
              const url = URL.createObjectURL(blob)
              console.log('✅ [PLACA WEB] Foto com placa gravada!', url)
              resolve(url)
            } else {
              console.error('❌ [PLACA WEB] Erro ao converter canvas para blob')
              resolve(imageUri)
            }
          }, 'image/jpeg', 0.95)

        } catch (error) {
          console.error('❌ [PLACA WEB] Erro ao renderizar placa no canvas:', error)
          resolve(imageUri)
        }
      }

      img.onerror = () => {
        console.error('❌ [PLACA WEB] Erro ao carregar imagem')
        resolve(imageUri)
      }

      img.src = imageUri

    } catch (error) {
      console.error('❌ [PLACA WEB] Erro geral:', error)
      resolve(imageUri)
    }
  })
}
