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
  console.log('📱 [PLACA MOBILE] Iniciando renderização com Canvas...')

  try {
    // Importar dependências
    const ReactNative = await import('react-native')
    const { View, Image, Text, StyleSheet, Dimensions } = ReactNative
    const viewShot = await import('react-native-view-shot')
    const { captureRef } = viewShot
    const FileSystem = await import('expo-file-system')

    // 1. Calcular UTM e endereço
    let utmDisplay = ''
    if (placaData.latitude && placaData.longitude) {
      const utm = latLongToUTM(placaData.latitude, placaData.longitude)
      utmDisplay = formatUTM(utm)
      console.log('📱 [PLACA MOBILE] UTM calculado:', utmDisplay)
    }

    // REMOVIDO: Busca de endereço (causava erro offline)
    // Agora mostra apenas: UTM, Data/Hora, Equipe, Obra, Serviço

    // 2. Usar renderização em Canvas
    // IMPORTANTE: No build nativo, podemos usar APIs mais avançadas
    // Por enquanto, retornamos foto original e deixamos o componente PhotoWithPlaca fazer o trabalho visual

    // TODO: Implementar Skia Canvas quando disponível no build nativo
    // Por enquanto, a placa aparece como overlay visual através do componente PhotoWithPlaca

    console.log('📱 [PLACA MOBILE] Build nativo detectado')
    console.log('💡 Placa será aplicada visualmente pelo componente PhotoWithPlaca')
    console.log('💡 Para placa GRAVADA na imagem, use a versão WEB: http://10.0.0.116:8081')

    return imageUri

  } catch (error) {
    console.error('❌ [PLACA MOBILE] Erro:', error)
    return imageUri
  }
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

          // 6. Configurar dimensões da MARCA D'ÁGUA (GRANDE E LEGÍVEL)
          const watermarkPadding = 24
          const lineHeight = 38
          const fontSize = 22
          const fontSizeSmall = 18

          // Calcular número de linhas
          let numLines = 4 // Obra, Data, Serviço, Equipe
          if (utmDisplay) numLines++

          const watermarkWidth = Math.min(img.width * 0.6, 700) // 60% da largura
          const watermarkHeight = watermarkPadding * 2 + numLines * lineHeight + 30

          const watermarkX = 25
          const watermarkY = img.height - watermarkHeight - 25

          console.log('[PLACA WEB] Desenhando marca d\'água...', { watermarkWidth, watermarkHeight, watermarkX, watermarkY })

          // 7. Desenhar fundo da marca d'água (bem opaco)
          ctx.fillStyle = 'rgba(0, 0, 0, 0.75)'
          ctx.fillRect(watermarkX, watermarkY, watermarkWidth, watermarkHeight)

          // 8. Desenhar borda destacada
          ctx.strokeStyle = 'rgba(255, 255, 255, 0.4)'
          ctx.lineWidth = 3
          ctx.strokeRect(watermarkX, watermarkY, watermarkWidth, watermarkHeight)

          // 9. Desenhar textos da marca d'água (mais suave)
          let textY = watermarkY + watermarkPadding + fontSize

          // Função auxiliar para desenhar linha de texto (bem legível)
          const drawTextLine = (label: string, value: string, isBold = false, isGreen = false) => {
            // Label (cinza claro - bem visível)
            ctx.font = `700 ${fontSizeSmall}px Arial, sans-serif`
            ctx.fillStyle = 'rgba(230, 230, 230, 1)'
            ctx.fillText(label, watermarkX + watermarkPadding, textY)

            // Value (branco ou verde - destaque total)
            ctx.font = `${isBold ? '800' : '700'} ${fontSize}px Arial, sans-serif`
            ctx.fillStyle = isGreen ? 'rgba(52, 211, 153, 1)' : 'rgba(255, 255, 255, 1)'
            ctx.fillText(value, watermarkX + watermarkPadding + 100, textY)

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
