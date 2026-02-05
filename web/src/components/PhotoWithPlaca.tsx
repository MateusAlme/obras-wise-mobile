'use client'

import { useEffect, useState } from 'react'
import { latLongToUTM, formatUTM, getAddressFromCoords } from '@/lib/geocoding'

interface PhotoWithPlacaProps {
  url: string
  obraNumero?: string
  tipoServico?: string
  equipe?: string
  latitude?: number | null
  longitude?: number | null
  utmX?: number | null
  utmY?: number | null
  utmZone?: string | null
  dateTime?: string
  isFullscreen?: boolean
  className?: string
}

export default function PhotoWithPlaca({
  url,
  obraNumero,
  tipoServico,
  equipe,
  latitude,
  longitude,
  utmX,
  utmY,
  utmZone,
  dateTime,
  isFullscreen = false,
  className = '',
}: PhotoWithPlacaProps) {
  const [address, setAddress] = useState<string>('')
  const [loading, setLoading] = useState(false)

  // Geocodificação assíncrona (somente em modo fullscreen)
  useEffect(() => {
    if (isFullscreen) {
      loadAddress()
    }
  }, [latitude, longitude, isFullscreen])

  async function loadAddress() {
    if (!latitude || !longitude) return

    setLoading(true)
    try {
      // Timeout de 5 segundos para evitar travamento
      const addr = await Promise.race([
        getAddressFromCoords(latitude, longitude),
        new Promise<null>((resolve) => setTimeout(() => resolve(null), 5000)),
      ])

      if (addr && addr.formattedAddress && addr.formattedAddress !== 'Endereço não disponível') {
        setAddress(addr.formattedAddress)
      }
    } catch (error) {
      console.error('Erro ao buscar endereço:', error)
    } finally {
      setLoading(false)
    }
  }

  // Calcular UTM se não fornecido
  let utmDisplay = ''
  if (utmX && utmY && utmZone) {
    // Usar UTM fornecido
    utmDisplay = `${utmZone} ${Math.round(utmX).toLocaleString('pt-BR')}E ${Math.round(utmY).toLocaleString('pt-BR')}N`
  } else if (latitude && longitude) {
    // Calcular UTM agora
    const utm = latLongToUTM(latitude, longitude)
    utmDisplay = formatUTM(utm)
  }

  // Formatar data/hora
  const displayDateTime = dateTime || new Date().toLocaleString('pt-BR', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  })

  if (!isFullscreen) {
    // Modo Badge (thumbnail)
    return (
      <div className={`relative ${className}`}>
        <img src={url} alt="Foto da obra" className="w-full h-full object-cover rounded-lg" />

        {/* Badge compacto */}
        <div className="absolute left-1 bottom-1 bg-black bg-opacity-85 text-white text-xs px-2 py-1.5 rounded-md border border-blue-600 border-opacity-70 max-w-[90%]">
          <div className="font-semibold truncate">{obraNumero || '-'}</div>
          <div className="text-[10px] text-gray-300 truncate">{displayDateTime}</div>
        </div>
      </div>
    )
  }

  // Modo Fullscreen (placa completa)
  return (
    <div className={`relative ${className}`}>
      <img src={url} alt="Foto da obra" className="w-full h-full object-contain" />

      {/* Placa completa */}
      <div className="absolute left-2 bottom-2 bg-black bg-opacity-88 text-white px-4 py-3 rounded-lg border border-blue-600 border-opacity-70 shadow-xl max-w-[65%] min-w-[240px]">
        {/* Header com ícone */}
        <div className="flex items-center gap-2 mb-2 pb-2 border-b border-gray-600">
          <svg className="w-4 h-4 text-blue-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" />
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 11a3 3 0 11-6 0 3 3 0 016 0z" />
          </svg>
          <span className="font-bold text-sm text-blue-400">Registro Fotográfico</span>
        </div>

        {/* Informações principais */}
        <div className="space-y-1.5 text-xs">
          <div className="flex justify-between items-center">
            <span className="text-gray-400 font-medium">Obra:</span>
            <span className="font-semibold text-white">{obraNumero || '-'}</span>
          </div>

          <div className="flex justify-between items-center">
            <span className="text-gray-400 font-medium">Data/Hora:</span>
            <span className="text-white">{displayDateTime}</span>
          </div>

          {tipoServico && (
            <div className="flex justify-between items-center">
              <span className="text-gray-400 font-medium">Serviço:</span>
              <span className="text-white truncate max-w-[60%]" title={tipoServico}>
                {tipoServico}
              </span>
            </div>
          )}

          {equipe && (
            <div className="flex justify-between items-center">
              <span className="text-gray-400 font-medium">Equipe:</span>
              <span className="text-white font-semibold">{equipe}</span>
            </div>
          )}

          {/* Coordenadas UTM */}
          {utmDisplay && (
            <>
              <div className="border-t border-gray-600 my-2 pt-2"></div>
              <div className="flex justify-between items-center">
                <span className="text-gray-400 font-medium">UTM:</span>
                <span className="text-green-400 font-mono text-[10px]">{utmDisplay}</span>
              </div>
            </>
          )}

          {/* Endereço */}
          {(address || loading) && (
            <div className="flex justify-between items-start gap-2">
              <span className="text-gray-400 font-medium flex-shrink-0">Endereço:</span>
              {loading ? (
                <span className="text-gray-500 text-[10px] italic">Buscando...</span>
              ) : (
                <span className="text-gray-300 text-[10px] leading-tight text-right">
                  {address}
                </span>
              )}
            </div>
          )}
        </div>

        {/* Footer com ícone GPS */}
        {latitude && longitude && (
          <div className="mt-2 pt-2 border-t border-gray-600 flex items-center gap-1.5 text-[9px] text-gray-500">
            <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3.055 11H5a2 2 0 012 2v1a2 2 0 002 2 2 2 0 012 2v2.945M8 3.935V5.5A2.5 2.5 0 0010.5 8h.5a2 2 0 012 2 2 2 0 104 0 2 2 0 012-2h1.064M15 20.488V18a2 2 0 012-2h3.064M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
            <span>GPS: {latitude.toFixed(6)}, {longitude.toFixed(6)}</span>
          </div>
        )}
      </div>
    </div>
  )
}
