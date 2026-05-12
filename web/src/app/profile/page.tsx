'use client'

import { useEffect, useState } from 'react'
import { format } from 'date-fns'
import { ptBR } from 'date-fns/locale'
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
            <p className="text-sm font-medium text-gray-500 dark:text-slate-400">Carregando perfil...</p>
          </div>
        </div>
      </ProtectedRoute>
    )
  }

  const displayName = formData.full_name || formData.email.split('@')[0] || 'Usuário'
  const initials = displayName
    .split(' ')
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase())
    .join('') || 'U'
  const roleLabel = profile?.role === 'admin' ? 'Administrador' : 'Visualizador'
  const memberSince = profile?.created_at
    ? format(new Date(profile.created_at), "dd 'de' MMMM 'de' yyyy", { locale: ptBR })
    : 'Data indisponível'

  return (
    <ProtectedRoute>
      <AppShell>
        <div className="mx-auto max-w-5xl space-y-6">
          <div className="relative overflow-hidden rounded-3xl border border-slate-200/70 dark:border-slate-700/70 bg-white dark:bg-slate-800 shadow-sm">
            <div className="absolute inset-0 bg-gradient-to-r from-primary via-red-600 to-blue-600" />
            <div className="absolute inset-0 bg-black/10" />
            <div className="relative px-6 py-7 sm:px-8">
              <div className="flex flex-col gap-5 sm:flex-row sm:items-end sm:justify-between">
                <div className="flex items-end gap-4">
                  <div className="flex h-20 w-20 items-center justify-center rounded-2xl border-4 border-white/90 dark:border-slate-800 bg-slate-900 text-2xl font-bold text-white shadow-xl">
                    {initials}
                  </div>
                  <div className="pb-1">
                    <p className="mb-2 inline-flex rounded-full bg-white/15 px-3 py-1 text-xs font-semibold uppercase tracking-wider text-white backdrop-blur">
                      Minha conta
                    </p>
                    <h1 className="text-3xl font-bold tracking-tight text-white">{displayName}</h1>
                    <p className="mt-1 text-sm font-medium text-white/80">{formData.email}</p>
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-2 sm:w-72">
                  <div className="rounded-2xl bg-white/95 dark:bg-slate-900/80 px-4 py-3 shadow-sm backdrop-blur">
                    <p className="text-[10px] font-bold uppercase tracking-widest text-slate-400 dark:text-slate-500">Perfil</p>
                    <p className="mt-1 text-sm font-bold text-slate-900 dark:text-white">{roleLabel}</p>
                  </div>
                  <div className="rounded-2xl bg-white/95 dark:bg-slate-900/80 px-4 py-3 shadow-sm backdrop-blur">
                    <p className="text-[10px] font-bold uppercase tracking-widest text-slate-400 dark:text-slate-500">Status</p>
                    <p className="mt-1 text-sm font-bold text-emerald-700 dark:text-emerald-300">Ativo</p>
                  </div>
                </div>
              </div>
            </div>
          </div>

          {success && (
            <div className="alert-success">
              <svg className="w-4 h-4 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
              </svg>
              {success}
            </div>
          )}
          {error && (
            <div className="alert-error">
              <svg className="w-4 h-4 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
              {error}
            </div>
          )}

          <div className="grid gap-6 lg:grid-cols-[360px_1fr]">
            <aside className="rounded-3xl border border-slate-200/70 dark:border-slate-700/70 bg-white dark:bg-slate-800 p-6 shadow-sm">
              <div className="mb-5">
                <p className="text-xs font-bold uppercase tracking-widest text-slate-400 dark:text-slate-500">Foto de Perfil</p>
                <h2 className="mt-1 text-xl font-bold text-slate-900 dark:text-white">Identidade visual</h2>
                <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">A foto aparece no menu lateral e nos registros administrativos.</p>
              </div>
              <AvatarUpload
                userId={user.id}
                currentAvatarUrl={profile?.avatar_url}
                onUploadComplete={loadProfile}
                size="lg"
              />
              <div className="mt-6 space-y-3 rounded-2xl bg-slate-50 dark:bg-slate-900/50 p-4">
                <div className="flex items-center justify-between gap-4">
                  <span className="text-sm text-slate-500 dark:text-slate-400">Membro desde</span>
                  <span className="text-right text-sm font-semibold text-slate-800 dark:text-slate-100">{memberSince}</span>
                </div>
                <div className="flex items-center justify-between gap-4">
                  <span className="text-sm text-slate-500 dark:text-slate-400">Permissão</span>
                  <span className={profile?.role === 'admin' ? 'badge-purple' : 'badge-gray'}>{roleLabel}</span>
                </div>
              </div>
            </aside>

            <div className="rounded-3xl border border-slate-200/70 dark:border-slate-700/70 bg-white dark:bg-slate-800 p-6 shadow-sm sm:p-8">
              <div className="mb-7 flex flex-col gap-2 border-b border-slate-100 dark:border-slate-700 pb-5">
                <p className="text-xs font-bold uppercase tracking-widest text-slate-400 dark:text-slate-500">Dados pessoais</p>
                <h2 className="text-2xl font-bold text-slate-900 dark:text-white">Informações da conta</h2>
                <p className="text-sm text-slate-500 dark:text-slate-400">Mantenha o nome atualizado para facilitar a identificação nas telas do sistema.</p>
              </div>

              <form onSubmit={handleSubmit} className="space-y-5">
                <div>
                  <label className="block text-xs font-semibold text-slate-400 dark:text-slate-500 uppercase tracking-wider mb-1.5">
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
                  <label className="block text-xs font-semibold text-slate-400 dark:text-slate-500 uppercase tracking-wider mb-1.5">
                    Email
                  </label>
                  <input
                    type="email"
                    value={formData.email}
                    disabled
                    className="input-field"
                  />
                  <p className="text-xs text-slate-400 dark:text-slate-500 mt-1">O email não pode ser alterado.</p>
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-400 dark:text-slate-500 uppercase tracking-wider mb-1.5">
                    Perfil
                  </label>
                  <div className="flex flex-wrap items-center gap-3 rounded-xl border border-slate-200 dark:border-slate-600 bg-slate-50 dark:bg-slate-900/50 px-3.5 py-3">
                    <span className={profile?.role === 'admin' ? 'badge-purple' : 'badge-gray'}>
                      {roleLabel}
                    </span>
                    <p className="text-xs text-slate-500 dark:text-slate-400">Definido pelo administrador do sistema</p>
                  </div>
                </div>

                <div className="pt-3">
                  <button type="submit" disabled={saving} className="btn-primary w-full sm:w-auto sm:min-w-56">
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
        </div>
      </AppShell>
    </ProtectedRoute>
  )
}
