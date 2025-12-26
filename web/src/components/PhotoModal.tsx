'use client'

import { useEffect } from 'react'
import PhotoWithPlaca from './PhotoWithPlaca'
import type { FotoInfo } from '@/lib/supabase'

interface PhotoModalProps {
  isOpen: boolean
  onClose: () => void
  photo: FotoInfo | null
  obraNumero?: string
  tipoServico?: string
  equipe?: string
}

export default function PhotoModal({
  isOpen,
  onClose,
  photo,
  obraNumero,
  tipoServico,
  equipe,
}: PhotoModalProps) {
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

  if (!isOpen || !photo) return null

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

      {/* Conteúdo do modal */}
      <div
        className="max-w-7xl max-h-[90vh] w-full mx-4 overflow-auto"
        onClick={(e) => e.stopPropagation()}
      >
        <PhotoWithPlaca
          url={photo.url}
          obraNumero={photo.placaData?.obraNumero || obraNumero}
          tipoServico={photo.placaData?.tipoServico || tipoServico}
          equipe={photo.placaData?.equipe || equipe}
          latitude={photo.latitude}
          longitude={photo.longitude}
          dateTime={photo.placaData?.dataHora}
          isFullscreen={true}
          className="w-full h-full"
        />
      </div>

      {/* Instrução */}
      <div className="absolute bottom-4 left-1/2 transform -translate-x-1/2 text-white text-sm bg-black bg-opacity-50 px-4 py-2 rounded-full">
        Pressione <kbd className="bg-white bg-opacity-20 px-2 py-1 rounded">ESC</kbd> ou clique fora para fechar
      </div>
    </div>
  )
}
