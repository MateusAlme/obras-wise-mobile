'use client'

import { useRef, useState } from 'react'
import PhotoWithPlaca from './PhotoWithPlaca'
import PhotoModal from './PhotoModal'
import type { FotoInfo } from '@/lib/supabase'

interface PhotoGalleryProps {
  photos: FotoInfo[]
  obraNumero?: string
  tipoServico?: string
  equipe?: string
  title?: string
  sectionKey?: string
  allowAdd?: boolean
  onAddPhoto?: (sectionKey: string, file: File) => Promise<FotoInfo | null>
  onUpdatePhoto?: (sectionKey: string, index: number, updatedPhoto: FotoInfo) => Promise<FotoInfo | null>
  onReplacePhoto?: (sectionKey: string, index: number, file: File) => Promise<FotoInfo | null>
  onDeletePhoto?: (sectionKey: string, index: number, photo: FotoInfo) => Promise<boolean>
}

export default function PhotoGallery({
  photos,
  obraNumero,
  tipoServico,
  equipe,
  title,
  sectionKey,
  allowAdd = false,
  onAddPhoto,
  onUpdatePhoto,
  onReplacePhoto,
  onDeletePhoto,
}: PhotoGalleryProps) {
  const [selectedPhoto, setSelectedPhoto] = useState<FotoInfo | null>(null)
  const [selectedIndex, setSelectedIndex] = useState<number | null>(null)
  const [autoEdit, setAutoEdit] = useState(false)
  const [adding, setAdding] = useState(false)
  const fileInputRef = useRef<HTMLInputElement>(null)

  const hasPhotos = photos && photos.length > 0
  if (!hasPhotos && !allowAdd) return null

  async function handleAddFile(file: File) {
    if (!sectionKey || !onAddPhoto) return
    setAdding(true)
    try {
      const newPhoto = await onAddPhoto(sectionKey, file)
      if (newPhoto) {
        setSelectedPhoto(newPhoto)
        setSelectedIndex(photos.length)
        setAutoEdit(true)
      }
    } finally {
      setAdding(false)
    }
  }

  return (
    <div className="mb-6">
      {title && (
        <div className="flex flex-wrap items-center justify-between gap-3 mb-3">
          <h3 className="text-lg font-semibold text-gray-800 flex items-center gap-2">
            <svg className="w-5 h-5 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
            </svg>
            {title}
            <span className="text-sm text-gray-500 font-normal">({photos.length})</span>
          </h3>
          {allowAdd && sectionKey && (
            <div className="flex items-center gap-2">
              <button
                onClick={() => fileInputRef.current?.click()}
                className="px-3 py-2 bg-white border border-gray-200 hover:border-blue-500 text-sm font-semibold text-gray-700 rounded-lg shadow-sm transition-colors"
                disabled={adding}
              >
                {adding ? 'Enviando...' : 'Adicionar foto'}
              </button>
              <input
                ref={fileInputRef}
                type="file"
                accept="image/*"
                className="hidden"
                onChange={(event) => {
                  const file = event.target.files?.[0]
                  if (file) {
                    void handleAddFile(file)
                    event.target.value = ''
                  }
                }}
              />
            </div>
          )}
        </div>
      )}

      {hasPhotos ? (
        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-3">
          {photos.map((photo, index) => (
            <div
              key={index}
              className="relative group cursor-pointer overflow-hidden rounded-lg shadow-md hover:shadow-xl transition-all transform hover:scale-105"
              onClick={() => {
                setSelectedPhoto(photo)
                setSelectedIndex(index)
                setAutoEdit(false)
              }}
            >
              <PhotoWithPlaca
                url={photo.url}
                obraNumero={photo.placaData?.obraNumero || obraNumero}
                tipoServico={photo.placaData?.tipoServico || tipoServico}
                equipe={photo.placaData?.equipe || equipe}
                latitude={photo.latitude}
                longitude={photo.longitude}
                utmX={photo.utmX ?? photo.utm_x}
                utmY={photo.utmY ?? photo.utm_y}
                utmZone={photo.utmZone ?? photo.utm_zone}
                dateTime={photo.placaData?.dataHora}
                isFullscreen={false}
                className="aspect-[4/3]"
              />

              {/* Overlay ao passar o mouse */}
              <div className="absolute inset-0 bg-black bg-opacity-0 group-hover:bg-opacity-30 transition-all flex items-center justify-center">
                <svg className="w-8 h-8 text-white opacity-0 group-hover:opacity-100 transition-all transform scale-50 group-hover:scale-100" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0zM10 7v3m0 0v3m0-3h3m-3 0H7" />
                </svg>
              </div>
            </div>
          ))}
        </div>
      ) : (
        <div className="rounded-xl border border-dashed border-gray-300 p-6 text-center text-sm text-gray-500">
          Nenhuma foto adicionada ainda.
        </div>
      )}

      {/* Modal fullscreen */}
      <PhotoModal
        isOpen={selectedPhoto !== null}
        onClose={() => {
          setSelectedPhoto(null)
          setSelectedIndex(null)
          setAutoEdit(false)
        }}
        photo={selectedPhoto}
        obraNumero={obraNumero}
        tipoServico={tipoServico}
        equipe={equipe}
        autoEdit={autoEdit}
        onSave={async (updatedPhoto) => {
          if (selectedIndex === null || !sectionKey || !onUpdatePhoto) return null
          const saved = await onUpdatePhoto(sectionKey, selectedIndex, updatedPhoto)
          if (saved) {
            setSelectedPhoto(saved)
            setAutoEdit(false)
          }
          return saved
        }}
        onReplace={async (file) => {
          if (selectedIndex === null || !sectionKey || !onReplacePhoto) return null
          const replaced = await onReplacePhoto(sectionKey, selectedIndex, file)
          if (replaced) {
            setSelectedPhoto(replaced)
            setAutoEdit(false)
          }
          return replaced
        }}
        onDelete={async () => {
          if (selectedIndex === null || !sectionKey || !selectedPhoto || !onDeletePhoto) return false
          const deleted = await onDeletePhoto(sectionKey, selectedIndex, selectedPhoto)
          if (deleted) {
            setSelectedPhoto(null)
            setSelectedIndex(null)
            setAutoEdit(false)
          }
          return deleted
        }}
      />
    </div>
  )
}
