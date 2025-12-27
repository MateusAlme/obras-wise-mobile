'use client'

import { useEffect, useRef, useState } from 'react'
import PhotoWithPlaca from './PhotoWithPlaca'
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
}: PhotoModalProps) {
  const fileInputRef = useRef<HTMLInputElement>(null)
  const [isEditing, setIsEditing] = useState(false)
  const [saving, setSaving] = useState(false)
  const [uploading, setUploading] = useState(false)
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

      // Adicionar placa no canto inferior esquerdo (design moderno, GRANDE e LEGÍVEL)
      const placaWidth = Math.max(800, canvas.width * 0.4) // Aumentado de 450px/25% para 800px/40%
      const padding = 30
      const innerPadding = 40 // Aumentado de 25 para 40
      const titleFontSize = Math.max(48, placaWidth / 12) // Aumentado significativamente
      const labelFontSize = Math.max(32, placaWidth / 16) // Aumentado de 16/22 para 32/16
      const valueFontSize = Math.max(36, placaWidth / 15) // Aumentado de 18/20 para 36/15
      const lineSpacing = valueFontSize * 2.5 // Aumentado espaçamento

      // Calcular altura necessária
      let contentLines = 4 // Obra, Data/Hora, Serviço, Equipe
      if (photo.latitude && photo.longitude) contentLines += 2 // UTM, Endereço, GPS
      const placaHeight = titleFontSize + innerPadding + (contentLines * lineSpacing) + innerPadding

      const placaX = padding
      const placaY = canvas.height - placaHeight - padding

      // Fundo escuro com gradiente
      const gradient = ctx.createLinearGradient(placaX, placaY, placaX, placaY + placaHeight)
      gradient.addColorStop(0, 'rgba(15, 23, 42, 0.95)')
      gradient.addColorStop(1, 'rgba(15, 23, 42, 0.98)')
      ctx.fillStyle = gradient
      ctx.fillRect(placaX, placaY, placaWidth, placaHeight)

      // Borda superior azul (mais grossa)
      ctx.fillStyle = '#3b82f6'
      ctx.fillRect(placaX, placaY, placaWidth, 8)

      let yPos = placaY + innerPadding

      // Título "Registro Fotográfico" com ícone
      ctx.fillStyle = '#3b82f6'
      ctx.font = `bold ${titleFontSize}px Arial`
      ctx.fillText('📍 Registro Fotográfico', placaX + innerPadding, yPos)
      yPos += titleFontSize + 20

      // Separador horizontal
      ctx.fillStyle = 'rgba(148, 163, 184, 0.3)'
      ctx.fillRect(placaX + innerPadding, yPos, placaWidth - (innerPadding * 2), 2)
      yPos += 30

      // Helper para desenhar linha de informação (layout vertical melhor)
      const drawInfoLine = (label: string, value: string, isHighlight = false) => {
        // Label (menor, cinza)
        ctx.fillStyle = '#94a3b8'
        ctx.font = `${labelFontSize * 0.75}px Arial`
        ctx.fillText(label + ':', placaX + innerPadding, yPos)
        yPos += labelFontSize * 1.2

        // Value (maior, destaque)
        ctx.fillStyle = isHighlight ? '#ffffff' : '#e2e8f0'
        ctx.font = `bold ${valueFontSize}px Arial`
        ctx.fillText(value, placaX + innerPadding, yPos)
        yPos += lineSpacing
      }

      // Informações principais
      drawInfoLine('Obra', previewPlaca.obraNumero, true)
      drawInfoLine('Data/Hora', previewPlaca.dataHora)
      drawInfoLine('Serviço', previewPlaca.tipoServico)
      drawInfoLine('Equipe', previewPlaca.equipe)

      // Coordenadas GPS (se disponíveis)
      if (photo.latitude && photo.longitude) {
        yPos += 10

        // Separador
        ctx.fillStyle = 'rgba(148, 163, 184, 0.3)'
        ctx.fillRect(placaX + innerPadding, yPos, placaWidth - (innerPadding * 2), 2)
        yPos += 25

        // UTM
        ctx.fillStyle = '#22c55e'
        ctx.font = `${labelFontSize * 0.75}px Arial`
        ctx.fillText('UTM:', placaX + innerPadding, yPos)
        yPos += labelFontSize * 1.2

        ctx.fillStyle = '#4ade80'
        ctx.font = `bold ${valueFontSize * 0.85}px "Courier New", monospace`
        ctx.fillText(`24S  ${photo.latitude.toFixed(4)}E  ${photo.longitude.toFixed(3)}N`, placaX + innerPadding, yPos)
        yPos += lineSpacing

        // GPS
        ctx.fillStyle = '#64748b'
        ctx.font = `${labelFontSize * 0.65}px Arial`
        ctx.fillText(`📍 GPS: ${photo.latitude.toFixed(7)}, ${photo.longitude.toFixed(7)}`, placaX + innerPadding, yPos)
      }

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
                disabled={uploading}
              >
                {uploading ? 'Enviando foto...' : 'Trocar foto'}
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
