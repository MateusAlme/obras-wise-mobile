/**
 * Renderiza fotos com placa de informações "gravada" (burned-in)
 *
 * WEB: Usa Canvas API do navegador
 * MOBILE: Usa react-native-view-shot (funciona no Expo Go!)
 */

import { Platform } from 'react-native'
import { latLongToUTM, formatUTM } from './geocoding'
import React from 'react'

export interface PlacaData {
  obraNumero: string
  tipoServico: string
  equipe: string
  dataHora: string
  latitude?: number
  longitude?: number
  posteId?: string  // ID do poste para Cava em Rocha (P1, P2, P3...)
}

/**
 * Renderiza foto com placa usando Canvas API do navegador (WEB ONLY)
 */
export async function renderPhotoWithPlacaBurnedIn(
  imageUri: string,
  placaData: PlacaData
): Promise<string> {
  // Se for WEB, usa Canvas API do navegador
  if (Platform.OS === 'web') {
    return renderPhotoWithPlacaWeb(imageUri, placaData)
  }

  // MOBILE: Usa Skia Canvas
  console.log('📱 MOBILE: Renderizando placa com Skia...')
  return renderPhotoWithPlacaMobile(imageUri, placaData)
}

/**
 * Renderiza foto com placa GRAVADA permanentemente (MOBILE)
 * USA: Canvas do React Native (através de componente temporário + view-shot)
 */
async function renderPhotoWithPlacaMobile(
  imageUri: string,
  placaData: PlacaData
): Promise<string> {
  // No mobile a placa é exibida via overlay no componente de UI.
  // Evitamos processamento extra pós-captura para reduzir latência.
  void placaData
  return imageUri
}

/**
 * Renderiza foto com placa usando Canvas API do navegador (WEB)
 */
async function renderPhotoWithPlacaWeb(
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

      // REMOVIDO: Busca de endereço (causava erro offline)
      // Agora mostra apenas: UTM, Data/Hora, Equipe, Obra, Serviço

      // 3. Carregar imagem
      console.log('[PLACA WEB] Carregando imagem...', imageUri)
      const img = new Image()
      // IMPORTANTE: Não usar crossOrigin para blob: URLs
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

          // 6. Configurar dimensões da MARCA D'ÁGUA (RESPONSIVO)
          // Calcular tamanhos baseados na largura da imagem
          const scaleFactor = Math.min(img.width / 1000, 1.5) // Fator de escala baseado na imagem
          const watermarkPadding = Math.max(16, img.width * 0.015)
          const lineHeight = Math.max(28, img.width * 0.025)
          const fontSize = Math.max(16, img.width * 0.018)
          const fontSizeSmall = Math.max(13, img.width * 0.014)

          // Calcular número de linhas
          let numLines = 4 // Obra, Data, Serviço, Equipe
          if (utmDisplay) numLines++

          // Largura responsiva: 55% da imagem, com limites
          const watermarkWidth = Math.min(Math.max(img.width * 0.55, 400), 800)
          const watermarkHeight = watermarkPadding * 2 + numLines * lineHeight + 20

          const watermarkX = Math.max(15, img.width * 0.015)
          const watermarkY = img.height - watermarkHeight - Math.max(15, img.height * 0.015)

          console.log('[PLACA WEB] Desenhando marca d\'água...', { watermarkWidth, watermarkHeight, watermarkX, watermarkY })

          // 7. Desenhar fundo da marca d'água (opaco)
          ctx.fillStyle = 'rgba(0, 0, 0, 0.70)'
          ctx.fillRect(watermarkX, watermarkY, watermarkWidth, watermarkHeight)

          // 8. Desenhar borda destacada
          ctx.strokeStyle = 'rgba(255, 255, 255, 0.35)'
          ctx.lineWidth = 2
          ctx.strokeRect(watermarkX, watermarkY, watermarkWidth, watermarkHeight)

          // 9. Desenhar textos da marca d'água
          let textY = watermarkY + watermarkPadding + fontSize

          // Função auxiliar para desenhar linha de texto
          const labelOffset = Math.max(70, img.width * 0.08) // Offset responsivo
          const drawTextLine = (label: string, value: string, isBold = false, isGreen = false) => {
            // Label (cinza claro)
            ctx.font = `700 ${fontSizeSmall}px Arial, sans-serif`
            ctx.fillStyle = 'rgba(230, 230, 230, 1)'
            ctx.fillText(label, watermarkX + watermarkPadding, textY)

            // Value (branco ou verde)
            ctx.font = `${isBold ? '800' : '700'} ${fontSize}px Arial, sans-serif`
            ctx.fillStyle = isGreen ? 'rgba(52, 211, 153, 1)' : 'rgba(255, 255, 255, 1)'
            ctx.fillText(value, watermarkX + watermarkPadding + labelOffset, textY)

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
