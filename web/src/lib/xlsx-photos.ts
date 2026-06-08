import type { Workbook } from 'exceljs'

/** Uma foto a ser embutida, com rótulo. */
export type FotoEmbed = { label: string; url: string }
/** Um grupo de fotos (ex.: uma obra), com título de cabeçalho. */
export type FotoGroup = { title: string; fotos: FotoEmbed[] }

/**
 * Busca uma foto pela URL e devolve um JPEG redimensionado (data URL) para
 * embutir no Excel. Retorna null em caso de falha (CORS, 404, formato invalido).
 */
export async function fetchResizedImage(
  url: string,
  maxSize: number,
  quality: number
): Promise<{ dataUrl: string; width: number; height: number } | null> {
  try {
    const resp = await fetch(url)
    if (!resp.ok) return null
    const blob = await resp.blob()
    const origDataUrl: string = await new Promise((resolve, reject) => {
      const reader = new FileReader()
      reader.onloadend = () => resolve(reader.result as string)
      reader.onerror = reject
      reader.readAsDataURL(blob)
    })
    const img = await new Promise<HTMLImageElement>((resolve, reject) => {
      const im = new Image()
      im.crossOrigin = 'anonymous'
      im.onload = () => resolve(im)
      im.onerror = reject
      im.src = origDataUrl
    })
    let w = img.width
    let h = img.height
    if (!w || !h) return null
    const scale = Math.min(1, maxSize / Math.max(w, h))
    w = Math.max(1, Math.round(w * scale))
    h = Math.max(1, Math.round(h * scale))
    const canvas = document.createElement('canvas')
    canvas.width = w
    canvas.height = h
    const ctx = canvas.getContext('2d')
    if (!ctx) return null
    ctx.drawImage(img, 0, 0, w, h)
    return { dataUrl: canvas.toDataURL('image/jpeg', quality), width: w, height: h }
  } catch {
    return null
  }
}

/**
 * Adiciona uma aba "Fotos" ao workbook ExcelJS, com as imagens embutidas em
 * grade (COLS por linha), agrupadas por título e rotuladas. As imagens sao
 * buscadas e redimensionadas antes de embutir.
 */
export async function addFotosSheet(
  workbook: Workbook,
  groups: FotoGroup[],
  opts?: { sheetName?: string; cols?: number; thumbW?: number; maxSize?: number; quality?: number }
): Promise<void> {
  const COLS = opts?.cols ?? 4
  const THUMB_W = opts?.thumbW ?? 160
  const MAX_SIZE = opts?.maxSize ?? 800
  const QUALITY = opts?.quality ?? 0.8

  const ws = workbook.addWorksheet(opts?.sheetName ?? 'Fotos')
  for (let c = 1; c <= COLS; c++) ws.getColumn(c).width = 24 // ~170px

  let rowCursor = 0 // 0-based, para ancorar imagens
  for (const group of groups) {
    // Cabecalho do grupo (linha mesclada).
    const headerIdx = rowCursor + 1
    const headerRow = ws.getRow(headerIdx)
    headerRow.getCell(1).value = group.title
    headerRow.getCell(1).font = { bold: true, size: 12, color: { argb: 'FFFFFFFF' } }
    headerRow.getCell(1).fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF1D4ED8' } }
    ws.mergeCells(headerIdx, 1, headerIdx, COLS)
    headerRow.height = 22
    rowCursor += 1

    if (group.fotos.length === 0) {
      const er = ws.getRow(rowCursor + 1)
      er.getCell(1).value = 'Sem fotos disponiveis'
      er.getCell(1).font = { italic: true, color: { argb: 'FF888888' } }
      rowCursor += 2
      continue
    }

    // Grade: COLS por linha; cada bloco = 1 linha de imagem + 1 de rotulo.
    for (let i = 0; i < group.fotos.length; i += COLS) {
      const imageRow0 = rowCursor // 0-based
      const labelIdx = rowCursor + 2 // 1-based (linha de rotulos)
      ws.getRow(imageRow0 + 1).height = 115 // ~153px
      ws.getRow(labelIdx).height = 14

      const slice = group.fotos.slice(i, i + COLS)
      for (let c = 0; c < slice.length; c++) {
        const f = slice[c]
        const resized = await fetchResizedImage(f.url, MAX_SIZE, QUALITY)
        if (resized) {
          const base64 = resized.dataUrl.replace(/^data:image\/\w+;base64,/, '')
          const imageId = workbook.addImage({ base64, extension: 'jpeg' })
          let dw = THUMB_W
          let dh = Math.round(THUMB_W * (resized.height / resized.width))
          if (dh > 150) {
            dh = 150
            dw = Math.round(150 * (resized.width / resized.height))
          }
          ws.addImage(imageId, {
            tl: { col: c + 0.05, row: imageRow0 + 0.05 },
            ext: { width: dw, height: dh },
          })
        }
        const labelCell = ws.getRow(labelIdx).getCell(c + 1)
        labelCell.value = f.label
        labelCell.font = { size: 8, color: { argb: 'FF555555' } }
        labelCell.alignment = { horizontal: 'center' }
      }
      rowCursor += 2
    }
    rowCursor += 1 // espaco entre grupos
  }
}
