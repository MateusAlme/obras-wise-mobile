'use client'

import { useEffect, useState } from 'react'
import ProtectedRoute from '@/components/ProtectedRoute'
import AppShell from '@/components/AppShell'
import AvatarUpload from '@/components/AvatarUpload'
import { useAuth } from '@/contexts/AuthContext'
import { supabase } from '@/lib/supabase'

export default function ProfilePage() {
  const { user } = useAuth()
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [profile, setProfile] = useState<any>(null)
  const [formData, setFormData] = useState({ full_name: '', email: '' })
  const [success, setSuccess] = useState('')
  const [error, setError] = useState('')

  useEffect(() => { loadProfile() }, [user])

  async function loadProfile() {
    try {
      if (!user) return
      const { data, error } = await supabase
        .from('profiles')
        .select('*')
        .eq('id', user.id)
        .single()
      if (error) throw error
      setProfile(data)
      setFormData({ full_name: data.full_name || '', email: data.email || user.email || '' })
    } catch (error: any) {
      setError('Erro ao carregar perfil')
    } finally {
      setLoading(false)
    }
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!user) return
    setSaving(true)
    setError('')
    setSuccess('')
    try {
      const { error: updateError } = await supabase
        .from('profiles')
        .update({ full_name: formData.full_name, updated_at: new Date().toISOString() })
        .eq('id', user.id)
      if (updateError) throw updateError
      setSuccess('Perfil atualizado com sucesso!')
      await loadProfile()
      setTimeout(() => setSuccess(''), 3000)
    } catch (error: any) {
      setError(error.message || 'Erro ao atualizar perfil')
    } finally {
      setSaving(false)
    }
  }

  if (loading || !user) {
    return (
      <ProtectedRoute>
        <div className="min-h-screen flex items-center justify-center">
          <div className="text-center space-y-3">
            <div className="spinner mx-auto" />
            <p className="text-sm font-medium text-gray-500">Carregando perfil...</p>
          </div>
        </div>
      </ProtectedRoute>
    )
  }

  return (
    <ProtectedRoute>
      <AppShell>
        <div className="max-w-xl mx-auto">
          {/* Header */}
          <div className="mb-8">
            <h1 className="page-title">Meu Perfil</h1>
            <p className="page-subtitle">Gerencie suas informações pessoais e foto de perfil</p>
          </div>

          {success && (
            <div className="alert-success mb-5">
              <svg className="w-4 h-4 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
              </svg>
              {success}
            </div>
          )}
          {error && (
            <div className="alert-error mb-5">
              <svg className="w-4 h-4 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
              {error}
            </div>
          )}

          <div className="card-padded space-y-6">
            {/* Avatar */}
            <div className="pb-6 border-b border-gray-100">
              <h2 className="text-sm font-semibold text-gray-700 mb-4">Foto de Perfil</h2>
              <AvatarUpload
                userId={user.id}
                currentAvatarUrl={profile?.avatar_url}
                onUploadComplete={loadProfile}
                size="lg"
              />
            </div>

            {/* Form */}
            <form onSubmit={handleSubmit} className="space-y-4">
              <div>
                <label className="block text-xs font-semibold text-gray-400 uppercase tracking-wider mb-1.5">
                  Nome Completo
                </label>
                <input
                  type="text"
                  value={formData.full_name}
                  onChange={(e) => setFormData({ ...formData, full_name: e.target.value })}
                  className="input-field"
                  placeholder="Seu nome completo"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-gray-400 uppercase tracking-wider mb-1.5">
                  Email
                </label>
                <input
                  type="email"
                  value={formData.email}
                  disabled
                  className="input-field"
                />
                <p className="text-xs text-gray-400 mt-1">O email não pode ser alterado</p>
              </div>

              <div>
                <label className="block text-xs font-semibold text-gray-400 uppercase tracking-wider mb-1.5">
                  Perfil
                </label>
                <div className="flex items-center gap-2 px-3.5 py-2.5 bg-gray-50 border border-gray-200 rounded-lg">
                  <span className={profile?.role === 'admin' ? 'badge-purple' : 'badge-gray'}>
                    {profile?.role === 'admin' ? 'Administrador' : 'Visualizador'}
                  </span>
                  <p className="text-xs text-gray-400">Definido pelo administrador do sistema</p>
                </div>
              </div>

              <div className="pt-2">
                <button type="submit" disabled={saving} className="btn-primary w-full">
                  {saving ? (
                    <><span className="spinner-sm" />Salvando...</>
                  ) : (
                    'Salvar Alterações'
                  )}
                </button>
              </div>
            </form>
          </div>
        </div>
      </AppShell>
    </ProtectedRoute>
  )
}
