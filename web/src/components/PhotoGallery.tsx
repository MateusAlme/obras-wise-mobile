'use client'

import { useState } from 'react'
import PhotoWithPlaca from './PhotoWithPlaca'
import PhotoModal from './PhotoModal'
import type { FotoInfo } from '@/lib/supabase'

interface PhotoGalleryProps {
  photos: FotoInfo[]
  obraNumero?: string
  tipoServico?: string
  equipe?: string
  title?: string
}

export default function PhotoGallery({
  photos,
  obraNumero,
  tipoServico,
  equipe,
  title,
}: PhotoGalleryProps) {
  const [selectedPhoto, setSelectedPhoto] = useState<FotoInfo | null>(null)

  if (!photos || photos.length === 0) {
    return null
  }

  return (
    <div className="mb-6">
      {title && (
        <h3 className="text-lg font-semibold text-gray-800 mb-3 flex items-center gap-2">
          <svg className="w-5 h-5 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
          </svg>
          {title}
          <span className="text-sm text-gray-500 font-normal">({photos.length})</span>
        </h3>
      )}

      <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-3">
        {photos.map((photo, index) => (
          <div
            key={index}
            className="relative group cursor-pointer overflow-hidden rounded-lg shadow-md hover:shadow-xl transition-all transform hover:scale-105"
            onClick={() => setSelectedPhoto(photo)}
          >
            <PhotoWithPlaca
              url={photo.url}
              obraNumero={photo.placaData?.obraNumero || obraNumero}
              tipoServico={photo.placaData?.tipoServico || tipoServico}
              equipe={photo.placaData?.equipe || equipe}
              latitude={photo.latitude}
              longitude={photo.longitude}
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

      {/* Modal fullscreen */}
      <PhotoModal
        isOpen={selectedPhoto !== null}
        onClose={() => setSelectedPhoto(null)}
        photo={selectedPhoto}
        obraNumero={obraNumero}
        tipoServico={tipoServico}
        equipe={equipe}
      />
    </div>
  )
}
