'use client'

import { useEffect, useRef, useState } from 'react'
import PhotoWithPlaca from './PhotoWithPlaca'
import { latLongToUTM, formatUTM } from '@/lib/geocoding'
import type { FotoInfo } from '@/lib/supabase'

interface PhotoModalProps {
  isOpen: boolean
  onClose: () => void
  photo: FotoInfo | null
  obraNumero?: string
  tipoServico?: string
  equipe?: string
  autoEdit?: boolean
  onSave?: (updatedPhoto: FotoInfo) => Promise<FotoInfo | null>
  onReplace?: (file: File) => Promise<FotoInfo | null>
  onDelete?: () => Promise<boolean>
}

export default function PhotoModal({
  isOpen,
  onClose,
  photo,
  obraNumero,
  tipoServico,
  equipe,
  autoEdit = false,
  onSave,
  onReplace,
  onDelete,
}: PhotoModalProps) {
  const fileInputRef = useRef<HTMLInputElement>(null)
  const [isEditing, setIsEditing] = useState(false)
  const [saving, setSaving] = useState(false)
  const [uploading, setUploading] = useState(false)
  const [deleting, setDeleting] = useState(false)
  const [draftPlaca, setDraftPlaca] = useState({
    obraNumero: '',
    tipoServico: '',
    equipe: '',
    dataHora: '',
  })

  function formatDateTime(date: Date) {
    const pad = (value: number) => String(value).padStart(2, '0')
    return `${pad(date.getDate())}/${pad(date.getMonth() + 1)}/${date.getFullYear()} ${pad(date.getHours())}:${pad(date.getMinutes())}`
  }
  // Fechar modal com tecla ESC
  useEffect(() => {
    const handleEscape = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose()
    }

    if (isOpen) {
      document.addEventListener('keydown', handleEscape)
      // Prevenir scroll do body
      document.body.style.overflow = 'hidden'
    }

    return () => {
      document.removeEventListener('keydown', handleEscape)
      document.body.style.overflow = 'unset'
    }
  }, [isOpen, onClose])

  useEffect(() => {
    if (!photo) return
    setDraftPlaca({
      obraNumero: photo.placaData?.obraNumero || obraNumero || '',
      tipoServico: photo.placaData?.tipoServico || tipoServico || '',
      equipe: photo.placaData?.equipe || equipe || '',
      dataHora: photo.placaData?.dataHora || formatDateTime(new Date()),
    })
    setIsEditing(autoEdit)
  }, [photo, obraNumero, tipoServico, equipe, autoEdit])

  if (!isOpen || !photo) return null

  const previewPlaca = isEditing
    ? draftPlaca
    : {
        obraNumero: photo.placaData?.obraNumero || obraNumero || '',
        tipoServico: photo.placaData?.tipoServico || tipoServico || '',
        equipe: photo.placaData?.equipe || equipe || '',
        dataHora: photo.placaData?.dataHora || draftPlaca.dataHora,
      }

  async function handleSave() {
    if (!onSave || !photo) {
      setIsEditing(false)
      return
    }

    setSaving(true)
    try {
      const updatedPhoto: FotoInfo = {
        ...photo,
        placaData: {
          obraNumero: draftPlaca.obraNumero || obraNumero || '',
          tipoServico: draftPlaca.tipoServico || tipoServico || '',
          equipe: draftPlaca.equipe || equipe || '',
          dataHora: draftPlaca.dataHora || formatDateTime(new Date()),
        },
      }
      await onSave(updatedPhoto)
      setIsEditing(false)
    } finally {
      setSaving(false)
    }
  }

  async function handleReplaceFile(file: File) {
    if (!onReplace) return
    setUploading(true)
    try {
      await onReplace(file)
      setIsEditing(true)
    } finally {
      setUploading(false)
    }
  }

  async function handleDownload() {
    if (!photo) return

    try {
      // Criar um canvas para desenhar a foto com a placa
      const canvas = document.createElement('canvas')
      const ctx = canvas.getContext('2d')
      if (!ctx) return

      // Carregar a imagem original
      const img = new Image()
      img.crossOrigin = 'anonymous'

      await new Promise((resolve, reject) => {
        img.onload = resolve
        img.onerror = reject
        img.src = photo.url
      })

      // Definir tamanho do canvas
      canvas.width = img.width
      canvas.height = img.height

      // Desenhar a imagem
      ctx.drawImage(img, 0, 0)

      // ── Placa proporcional que espelha o preview (fullscreen) ──────────────
      // Unidade de escala baseada na largura da imagem (baseline 1000px)
      const S = canvas.width / 1000
      const titleFont = 24 * S
      const valueFont = 20 * S
      const labelFont = 18 * S
      const smallFont = 15 * S
      const pad = 18 * S // padding interno
      const gap = 12 * S // espaço entre label e valor
      const margin = 20 * S // margem da borda da foto
      const radius = 12 * S
      const sep = Math.max(1, S) // espessura do separador
      const rowH = valueFont * 1.35

      // Truncar texto com reticências para caber em uma largura (usa a fonte atual do ctx)
      const fit = (text: string, maxW: number) => {
        if (ctx.measureText(text).width <= maxW) return text
        let t = text
        while (t.length > 1 && ctx.measureText(t + '…').width > maxW) t = t.slice(0, -1)
        return t + '…'
      }

      // Montar as linhas da placa (label, valor, estilo)
      type Row = { label: string; value: string; mono?: boolean; small?: boolean; highlight?: boolean }
      const rows: Row[] = [
        { label: 'Obra', value: previewPlaca.obraNumero || '-', highlight: true },
        { label: 'Data/Hora', value: previewPlaca.dataHora || '-' },
      ]
      if (previewPlaca.tipoServico) rows.push({ label: 'Serviço', value: previewPlaca.tipoServico })
      if (previewPlaca.equipe) rows.push({ label: 'Equipe', value: previewPlaca.equipe })

      // UTM (mesma lógica do preview)
      const utmX = photo.utmX ?? photo.utm_x
      const utmY = photo.utmY ?? photo.utm_y
      const utmZone = photo.utmZone ?? photo.utm_zone
      let utmDisplay = ''
      if (utmX && utmY && utmZone) {
        utmDisplay = `${utmZone} ${Math.round(utmX).toLocaleString('pt-BR')}E ${Math.round(utmY).toLocaleString('pt-BR')}N`
      } else if (photo.latitude && photo.longitude) {
        utmDisplay = formatUTM(latLongToUTM(photo.latitude, photo.longitude))
      }
      if (utmDisplay) rows.push({ label: 'UTM', value: utmDisplay, mono: true, small: true })

      const hasGps = Boolean(photo.latitude && photo.longitude)

      // Calcular a largura da placa a partir do conteúdo (limitada a 45% da foto)
      const minWidth = 260 * S
      const maxWidth = canvas.width * 0.45
      ctx.font = `bold ${titleFont}px Arial`
      let contentW = titleFont * 0.8 + ctx.measureText('Registro Fotográfico').width
      for (const row of rows) {
        ctx.font = `${labelFont}px Arial`
        const labelW = ctx.measureText(row.label + ':').width
        ctx.font = `${row.small ? smallFont : valueFont}px Arial`
        const valueW = ctx.measureText(row.value).width
        contentW = Math.max(contentW, labelW + gap + valueW)
      }
      const boxWidth = Math.min(maxWidth, Math.max(minWidth, contentW + pad * 2))

      // Calcular a altura total
      let boxHeight = pad
      boxHeight += titleFont + 8 * S // título + gap
      boxHeight += sep + 8 * S // separador + gap
      boxHeight += rows.length * rowH
      if (hasGps) boxHeight += 8 * S + sep + 8 * S + smallFont * 1.3
      boxHeight += pad

      const boxX = margin
      const boxY = canvas.height - boxHeight - margin

      // Helper de retângulo arredondado
      const roundRect = (x: number, y: number, w: number, h: number, r: number) => {
        ctx.beginPath()
        ctx.moveTo(x + r, y)
        ctx.arcTo(x + w, y, x + w, y + h, r)
        ctx.arcTo(x + w, y + h, x, y + h, r)
        ctx.arcTo(x, y + h, x, y, r)
        ctx.arcTo(x, y, x + w, y, r)
        ctx.closePath()
      }

      // Fundo escuro arredondado com borda azul (igual ao preview)
      roundRect(boxX, boxY, boxWidth, boxHeight, radius)
      ctx.fillStyle = 'rgba(0, 0, 0, 0.85)'
      ctx.fill()
      ctx.strokeStyle = 'rgba(37, 99, 235, 0.7)'
      ctx.lineWidth = 2 * S
      ctx.stroke()

      ctx.textBaseline = 'top'
      let yPos = boxY + pad

      // Título com marcador azul
      ctx.fillStyle = '#60a5fa'
      ctx.beginPath()
      ctx.arc(boxX + pad + titleFont * 0.28, yPos + titleFont * 0.5, titleFont * 0.28, 0, Math.PI * 2)
      ctx.fill()
      ctx.textAlign = 'left'
      ctx.font = `bold ${titleFont}px Arial`
      ctx.fillText('Registro Fotográfico', boxX + pad + titleFont * 0.8, yPos)
      yPos += titleFont + 8 * S

      // Separador
      ctx.fillStyle = 'rgba(148, 163, 184, 0.35)'
      ctx.fillRect(boxX + pad, yPos, boxWidth - pad * 2, sep)
      yPos += sep + 8 * S

      // Linhas de informação: label à esquerda, valor à direita
      for (const row of rows) {
        ctx.textAlign = 'left'
        ctx.font = `${labelFont}px Arial`
        ctx.fillStyle = '#94a3b8'
        ctx.fillText(row.label + ':', boxX + pad, yPos)
        const labelW = ctx.measureText(row.label + ':').width

        ctx.textAlign = 'right'
        ctx.font = row.mono
          ? `${row.small ? smallFont : valueFont}px "Courier New", monospace`
          : `${row.highlight ? 'bold ' : ''}${row.small ? smallFont : valueFont}px Arial`
        ctx.fillStyle = row.mono ? '#4ade80' : '#ffffff'
        const valMaxW = boxWidth - pad * 2 - labelW - gap
        ctx.fillText(fit(row.value, valMaxW), boxX + boxWidth - pad, yPos)
        yPos += rowH
      }

      // Rodapé GPS
      if (hasGps) {
        yPos += 8 * S
        ctx.fillStyle = 'rgba(148, 163, 184, 0.35)'
        ctx.fillRect(boxX + pad, yPos, boxWidth - pad * 2, sep)
        yPos += sep + 8 * S
        ctx.textAlign = 'left'
        ctx.font = `${smallFont}px Arial`
        ctx.fillStyle = '#64748b'
        ctx.fillText(
          `GPS: ${photo.latitude!.toFixed(6)}, ${photo.longitude!.toFixed(6)}`,
          boxX + pad,
          yPos,
        )
      }

      // Restaurar padrões do contexto
      ctx.textAlign = 'left'
      ctx.textBaseline = 'alphabetic'

      // Converter canvas para blob
      canvas.toBlob((blob) => {
        if (!blob) return

        const url = URL.createObjectURL(blob)
        const link = document.createElement('a')
        link.href = url

        // Nome do arquivo: obra_equipe_dataHora.jpg
        const fileName = `foto_${previewPlaca.obraNumero || 'obra'}_${previewPlaca.equipe || 'equipe'}_${previewPlaca.dataHora.replace(/[/:]/g, '-').replace(/\s/g, '_')}.jpg`
        link.download = fileName

        document.body.appendChild(link)
        link.click()
        document.body.removeChild(link)
        URL.revokeObjectURL(url)
      }, 'image/jpeg', 0.95)

    } catch (error) {
      console.error('Erro ao baixar foto:', error)
      alert('Erro ao baixar foto')
    }
  }

  async function handleDelete() {
    if (!onDelete) return
    const confirmed = window.confirm('Excluir esta foto?')
    if (!confirmed) return

    setDeleting(true)
    try {
      const deleted = await onDelete()
      if (deleted) {
        onClose()
      }
    } finally {
      setDeleting(false)
    }
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-90 backdrop-blur-sm"
      onClick={onClose}
    >
      {/* Botão de fechar */}
      <button
        onClick={onClose}
        className="absolute top-4 right-4 z-10 bg-white bg-opacity-20 hover:bg-opacity-30 text-white rounded-full p-3 transition-all shadow-xl"
        aria-label="Fechar"
      >
        <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
        </svg>
      </button>

      {/* Conte?do do modal */}
      <div
        className="max-w-7xl max-h-[90vh] w-full mx-4 overflow-auto"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex flex-col xl:flex-row gap-6">
          <div className="flex-1">
            <PhotoWithPlaca
              url={photo.url}
              obraNumero={previewPlaca.obraNumero}
              tipoServico={previewPlaca.tipoServico}
              equipe={previewPlaca.equipe}
              latitude={photo.latitude}
              longitude={photo.longitude}
              utmX={photo.utmX ?? photo.utm_x}
              utmY={photo.utmY ?? photo.utm_y}
              utmZone={photo.utmZone ?? photo.utm_zone}
              dateTime={previewPlaca.dataHora}
              isFullscreen={true}
              className="w-full h-full"
            />

            <div className="mt-4 flex flex-wrap items-center gap-3">
              <button
                onClick={handleDownload}
                className="px-4 py-2 bg-green-600 hover:bg-green-700 text-white rounded-lg text-sm font-semibold transition-colors flex items-center gap-2"
              >
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
                </svg>
                Baixar foto
              </button>
              <button
                onClick={() => setIsEditing(true)}
                className="px-4 py-2 bg-white/10 hover:bg-white/20 text-white rounded-lg text-sm font-semibold transition-colors"
              >
                Editar placa
              </button>
              <button
                onClick={() => fileInputRef.current?.click()}
                className="px-4 py-2 bg-white/10 hover:bg-white/20 text-white rounded-lg text-sm font-semibold transition-colors"
                disabled={uploading || deleting}
              >
                {uploading ? 'Enviando foto...' : 'Trocar foto'}
              </button>
              <button
                onClick={() => void handleDelete()}
                className="px-4 py-2 bg-red-600 hover:bg-red-700 text-white rounded-lg text-sm font-semibold transition-colors disabled:opacity-60 disabled:cursor-not-allowed"
                disabled={deleting || saving || uploading || !onDelete}
              >
                {deleting ? 'Excluindo...' : 'Excluir foto'}
              </button>
              <input
                ref={fileInputRef}
                type="file"
                accept="image/*"
                className="hidden"
                onChange={(event) => {
                  const file = event.target.files?.[0]
                  if (file) {
                    void handleReplaceFile(file)
                    event.target.value = ''
                  }
                }}
              />
            </div>
          </div>

          <div className="w-full xl:w-96 bg-white rounded-xl shadow-lg p-5">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-base font-semibold text-slate-900">Placa da foto</h3>
              <span className={`text-xs font-semibold px-2 py-1 rounded-full ${isEditing ? 'bg-blue-100 text-blue-700' : 'bg-slate-100 text-slate-600'}`}>
                {isEditing ? 'Editando' : 'Visualizar'}
              </span>
            </div>

            <div className="space-y-3">
              <div>
                <label className="block text-xs font-semibold text-slate-600 mb-1">Obra</label>
                <input
                  type="text"
                  value={draftPlaca.obraNumero}
                  onChange={(event) => setDraftPlaca((prev) => ({ ...prev, obraNumero: event.target.value }))}
                  disabled={!isEditing || saving}
                  className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 disabled:bg-slate-100"
                  placeholder={obraNumero || ''}
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-600 mb-1">Tipo de servico</label>
                <input
                  type="text"
                  value={draftPlaca.tipoServico}
                  onChange={(event) => setDraftPlaca((prev) => ({ ...prev, tipoServico: event.target.value }))}
                  disabled={!isEditing || saving}
                  className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 disabled:bg-slate-100"
                  placeholder={tipoServico || ''}
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-600 mb-1">Equipe</label>
                <input
                  type="text"
                  value={draftPlaca.equipe}
                  onChange={(event) => setDraftPlaca((prev) => ({ ...prev, equipe: event.target.value }))}
                  disabled={!isEditing || saving}
                  className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 disabled:bg-slate-100"
                  placeholder={equipe || ''}
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-600 mb-1">Data/hora</label>
                <input
                  type="text"
                  value={draftPlaca.dataHora}
                  onChange={(event) => setDraftPlaca((prev) => ({ ...prev, dataHora: event.target.value }))}
                  disabled={!isEditing || saving}
                  className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 disabled:bg-slate-100"
                  placeholder="dd/MM/yyyy HH:mm"
                />
              </div>
            </div>

            <div className="mt-4 flex items-center justify-end gap-2">
              <button
                onClick={() => setIsEditing(false)}
                className="px-3 py-2 text-sm font-semibold text-slate-600 hover:text-slate-800"
                disabled={saving}
              >
                Cancelar
              </button>
              <button
                onClick={() => void handleSave()}
                className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-sm font-semibold disabled:opacity-60 disabled:cursor-not-allowed"
                disabled={saving || !isEditing}
              >
                {saving ? 'Salvando...' : 'Salvar placa'}
              </button>
            </div>
          </div>
        </div>
      </div>
      {/* Instrução */}
      <div className="absolute bottom-4 left-1/2 transform -translate-x-1/2 text-white text-sm bg-black bg-opacity-50 px-4 py-2 rounded-full">
        Pressione <kbd className="bg-white bg-opacity-20 px-2 py-1 rounded">ESC</kbd> ou clique fora para fechar
      </div>
    </div>
  )
}
