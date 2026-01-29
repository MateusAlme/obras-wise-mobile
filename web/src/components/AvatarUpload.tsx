'use client'

import { useState, useRef } from 'react'
import Image from 'next/image'
import { supabase } from '@/lib/supabase'

interface AvatarUploadProps {
  userId: string
  currentAvatarUrl?: string | null
  onUploadComplete?: (url: string) => void
  size?: 'sm' | 'md' | 'lg'
}

export default function AvatarUpload({
  userId,
  currentAvatarUrl,
  onUploadComplete,
  size = 'md'
}: AvatarUploadProps) {
  const [uploading, setUploading] = useState(false)
  const [avatarUrl, setAvatarUrl] = useState(currentAvatarUrl)
  const [error, setError] = useState('')
  const fileInputRef = useRef<HTMLInputElement>(null)

  const sizeClasses = {
    sm: 'w-16 h-16',
    md: 'w-24 h-24',
    lg: 'w-32 h-32'
  }

  async function uploadAvatar(event: React.ChangeEvent<HTMLInputElement>) {
    try {
      setUploading(true)
      setError('')

      if (!event.target.files || event.target.files.length === 0) {
        return
      }

      const file = event.target.files[0]
      const fileExt = file.name.split('.').pop()
      const fileName = `${userId}/${Date.now()}.${fileExt}`

      // Validar tamanho (2MB)
      if (file.size > 2 * 1024 * 1024) {
        setError('A imagem deve ter no máximo 2MB')
        return
      }

      // Validar tipo
      if (!['image/jpeg', 'image/jpg', 'image/png', 'image/webp'].includes(file.type)) {
        setError('Apenas imagens JPG, PNG ou WebP são permitidas')
        return
      }

      // Upload para o Supabase Storage
      const { data, error: uploadError } = await supabase.storage
        .from('avatars')
        .upload(fileName, file, {
          cacheControl: '3600',
          upsert: false
        })

      if (uploadError) {
        throw uploadError
      }

      // Obter URL pública
      const { data: { publicUrl } } = supabase.storage
        .from('avatars')
        .getPublicUrl(data.path)

      // Atualizar perfil com nova URL
      const { error: updateError } = await supabase
        .from('profiles')
        .update({ avatar_url: publicUrl })
        .eq('id', userId)

      if (updateError) {
        throw updateError
      }

      setAvatarUrl(publicUrl)
      if (onUploadComplete) {
        onUploadComplete(publicUrl)
      }
    } catch (error: any) {
      console.error('Erro ao fazer upload:', error)
      setError(error.message || 'Erro ao fazer upload da imagem')
    } finally {
      setUploading(false)
      if (fileInputRef.current) {
        fileInputRef.current.value = ''
      }
    }
  }

  async function removeAvatar() {
    try {
      setUploading(true)
      setError('')

      // Remover URL do perfil
      const { error: updateError } = await supabase
        .from('profiles')
        .update({ avatar_url: null })
        .eq('id', userId)

      if (updateError) {
        throw updateError
      }

      setAvatarUrl(null)
      if (onUploadComplete) {
        onUploadComplete('')
      }
    } catch (error: any) {
      console.error('Erro ao remover avatar:', error)
      setError(error.message || 'Erro ao remover foto')
    } finally {
      setUploading(false)
    }
  }

  return (
    <div className="flex flex-col items-center gap-3">
      <div className={`relative ${sizeClasses[size]} rounded-full overflow-hidden bg-gray-200`}>
        {avatarUrl ? (
          <Image
            src={avatarUrl}
            alt="Avatar"
            fill
            className="object-cover"
            unoptimized
          />
        ) : (
          <div className="w-full h-full flex items-center justify-center bg-gradient-to-br from-blue-500 to-purple-600 text-white text-2xl font-bold">
            ?
          </div>
        )}

        {uploading && (
          <div className="absolute inset-0 bg-black bg-opacity-50 flex items-center justify-center">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-white"></div>
          </div>
        )}
      </div>

      <input
        ref={fileInputRef}
        type="file"
        accept="image/jpeg,image/jpg,image/png,image/webp"
        onChange={uploadAvatar}
        disabled={uploading}
        className="hidden"
      />

      <div className="flex gap-2">
        <button
          type="button"
          onClick={() => fileInputRef.current?.click()}
          disabled={uploading}
          className="px-3 py-1.5 text-sm bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
        >
          {avatarUrl ? 'Alterar Foto' : 'Adicionar Foto'}
        </button>

        {avatarUrl && (
          <button
            type="button"
            onClick={removeAvatar}
            disabled={uploading}
            className="px-3 py-1.5 text-sm bg-red-600 text-white rounded-lg hover:bg-red-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
          >
            Remover
          </button>
        )}
      </div>

      {error && (
        <p className="text-xs text-red-600 text-center max-w-xs">{error}</p>
      )}

      <p className="text-xs text-gray-500 text-center max-w-xs">
        JPG, PNG ou WebP. Máximo 2MB.
      </p>
    </div>
  )
}
