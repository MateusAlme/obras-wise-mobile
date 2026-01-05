'use client'

import { useState, useEffect } from 'react'
import { useAuth } from '@/contexts/AuthContext'
import { useRouter } from 'next/navigation'
import Image from 'next/image'

export default function LoginPage() {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [showPassword, setShowPassword] = useState(false)
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)
  const [mounted, setMounted] = useState(false)
  const { signIn, user } = useAuth()
  const router = useRouter()

  useEffect(() => {
    setMounted(true)
  }, [])

  useEffect(() => {
    if (user) {
      router.push('/dashboard')
    }
  }, [user, router])

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError('')
    setLoading(true)

    const { error } = await signIn(email, password)

    if (error) {
      setError('Email ou senha incorretos')
      setLoading(false)
    } else {
      router.push('/dashboard')
    }
  }

  return (
    <div className="min-h-screen w-full overflow-hidden">
      <div className="grid grid-cols-1 lg:grid-cols-2 min-h-screen w-full">
        {/* Left Panel - Hero (Desktop Only) */}
        <div className="hidden lg:flex flex-col items-center justify-center px-12 xl:px-16 2xl:px-20 py-20 bg-gradient-to-br from-primary via-primary-dark to-red-900 text-white relative overflow-hidden min-h-screen">
          {/* Decorative background pattern */}
          <div className="absolute inset-0 opacity-10">
            <div className="absolute top-0 left-0 w-full h-full" style={{
              backgroundImage: `radial-gradient(circle at 2px 2px, white 1px, transparent 0)`,
              backgroundSize: '40px 40px'
            }} />
          </div>

          {/* Decorative blobs */}
          <div className="absolute -top-20 -left-20 h-96 w-96 rounded-full bg-white/10 blur-3xl" />
          <div className="absolute -bottom-20 -right-20 h-96 w-96 rounded-full bg-white/5 blur-3xl" />

          <div className="relative z-10 w-full max-w-[36rem] mx-auto space-y-12">
            {/* Logo - Centralizado no topo */}
            <div className="flex justify-center">
              <div className="px-8 py-6">
                <Image
                  src="/logo_teccel_2.png"
                  alt="Teccel Engenharia"
                  width={260}
                  height={63}
                  priority
                  className="h-auto w-56 xl:w-64"
                />
              </div>
            </div>

            {/* Badge */}
            <div className="flex justify-center">
              <div className="inline-block bg-white/20 backdrop-blur-md px-5 py-2.5 rounded-full border border-white/30">
                <p className="text-sm font-bold tracking-[0.25em] uppercase">Gestão de Obras</p>
              </div>
            </div>

            {/* Heading */}
            <div className="text-center space-y-6">
              <h1 className="text-5xl xl:text-6xl font-bold tracking-tight leading-tight">
                Bem-vindo de volta!
              </h1>
              <p className="text-lg xl:text-xl text-white/95 leading-relaxed text-balance px-4">
                Acesse o sistema para acompanhar obras, gerenciar equipes e registrar evidências com precisão.
              </p>
            </div>

            {/* Features */}
            <div className="grid gap-4 pt-6">
              {[
                { icon: '📊', title: 'Dashboard completo', desc: 'Visão geral de todas as obras em andamento' },
                { icon: '📸', title: 'Registro de evidências', desc: 'Documentação fotográfica com geolocalização' },
                { icon: '👥', title: 'Gestão de equipes', desc: 'Controle total de usuários e permissões' },
              ].map((feature, idx) => (
                <div key={idx} className="flex items-start gap-4 bg-white/10 backdrop-blur-sm rounded-2xl p-5 border border-white/20 hover:bg-white/15 transition-all duration-300">
                  <div className="text-3xl">{feature.icon}</div>
                  <div>
                    <h3 className="font-bold text-base mb-1">{feature.title}</h3>
                    <p className="text-sm text-white/75 leading-relaxed">{feature.desc}</p>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Right Panel - Form */}
        <div className="flex items-start lg:items-center justify-center px-6 sm:px-10 lg:px-12 xl:px-16 py-12 sm:py-14 lg:py-20 bg-gradient-to-br from-slate-50 to-slate-100 min-h-screen">
        <div className={`w-full max-w-lg bg-white rounded-3xl shadow-2xl p-8 sm:p-10 lg:p-12 transition-all duration-700 ${mounted ? 'opacity-100 scale-100' : 'opacity-0 scale-95'}`}>
          {/* Mobile Logo */}
          <div className="flex flex-col items-center gap-5 mb-10 lg:hidden">
            <div className="px-6 py-4">
              <Image
                src="/logo_teccel_2.png"
                alt="Teccel Engenharia"
                width={220}
                height={53}
                priority
                className="h-auto w-44 sm:w-52"
              />
            </div>
          </div>

          {/* Login Card */}
          <div className="space-y-10">
            <div>
              <h2 className="text-4xl sm:text-5xl font-bold tracking-tight text-slate-900 mb-3">
                Entrar
              </h2>
              <p className="text-base sm:text-lg text-slate-600 text-balance">Use suas credenciais para acessar o sistema</p>
            </div>

            <form onSubmit={handleSubmit} className="space-y-7">
              {/* Email */}
              <div>
                <label htmlFor="email" className="block text-base font-semibold text-slate-900 mb-2.5">
                  Email
                </label>
                <div className="relative flex items-center gap-4 rounded-2xl border-2 border-slate-200 bg-slate-50 px-5 py-4 focus-within:border-primary focus-within:bg-white transition-all duration-300 hover:border-slate-300">
                  <svg className="h-6 w-6 text-slate-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 12a4 4 0 10-8 0 4 4 0 008 0zm0 0v1.5a2.5 2.5 0 005 0V12a9 9 0 10-9 9m4.5-1.206a8.959 8.959 0 01-4.5 1.207" />
                  </svg>
                  <input
                    id="email"
                    type="email"
                    required
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    className="w-full bg-transparent outline-none text-slate-900 text-base sm:text-lg placeholder:text-slate-400"
                    placeholder="seu@email.com"
                    disabled={loading}
                  />
                </div>
              </div>

              {/* Password */}
              <div>
                <label htmlFor="password" className="block text-base font-semibold text-slate-900 mb-2.5">
                  Senha
                </label>
                <div className="relative flex items-center gap-4 rounded-2xl border-2 border-slate-200 bg-slate-50 px-5 py-4 focus-within:border-primary focus-within:bg-white transition-all duration-300 hover:border-slate-300">
                  <svg className="h-6 w-6 text-slate-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
                  </svg>
                  <input
                    id="password"
                    type={showPassword ? 'text' : 'password'}
                    required
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    className="w-full bg-transparent outline-none text-slate-900 text-base sm:text-lg placeholder:text-slate-400"
                    placeholder="••••••••"
                    disabled={loading}
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    className="text-slate-400 hover:text-slate-600 transition-colors p-1"
                    aria-label={showPassword ? 'Ocultar senha' : 'Mostrar senha'}
                  >
                    {showPassword ? (
                      <svg className="h-6 w-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13.875 18.825A10.05 10.05 0 0112 19c-4.478 0-8.268-2.943-9.543-7a9.97 9.97 0 011.563-3.029m5.858.908a3 3 0 114.243 4.243M9.878 9.878l4.242 4.242M9.88 9.88l-3.29-3.29m7.532 7.532l3.29 3.29M3 3l3.59 3.59m0 0A9.953 9.953 0 0112 5c4.478 0 8.268 2.943 9.543 7a10.025 10.025 0 01-4.132 5.411m0 0L21 21" />
                      </svg>
                    ) : (
                      <svg className="h-6 w-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
                      </svg>
                    )}
                  </button>
                </div>
              </div>

              {/* Error Message */}
              {error && (
                <div className="flex items-center gap-3 rounded-2xl border-2 border-red-200 bg-red-50 px-5 py-4">
                  <svg className="h-6 w-6 text-red-500 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                  </svg>
                  <p className="text-base font-medium text-red-800">{error}</p>
                </div>
              )}

              {/* Submit Button */}
              <button
                type="submit"
                disabled={loading}
                className="group relative w-full overflow-hidden rounded-2xl bg-gradient-to-r from-primary to-primary-dark py-4 text-white text-base sm:text-lg font-bold shadow-xl shadow-primary/30 hover:shadow-2xl hover:scale-[1.02] disabled:opacity-60 disabled:cursor-not-allowed disabled:hover:scale-100 transition-all duration-300 active:scale-[0.98]"
              >
                <span className="relative flex items-center justify-center gap-3">
                  {loading ? (
                    <>
                      <svg className="animate-spin h-6 w-6" fill="none" viewBox="0 0 24 24">
                        <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                        <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                      </svg>
                      Entrando...
                    </>
                  ) : (
                    <>
                      Entrar
                      <svg className="h-6 w-6 group-hover:translate-x-1 transition-transform duration-300" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 7l5 5m0 0l-5 5m5-5H6" />
                      </svg>
                    </>
                  )}
                </span>
              </button>
            </form>

            {/* Footer */}
            <div className="mt-8 pt-6 border-t border-slate-200">
              <p className="text-base text-slate-600 text-center leading-relaxed">
                Precisa de acesso?{' '}
                <span className="font-bold text-primary cursor-pointer hover:text-primary-dark transition-colors">Entre em contato com o administrador</span>
              </p>
            </div>
          </div>

          {/* Version */}
          <div className="text-center mt-8">
            <p className="text-sm text-slate-500">
              © 2025 <span className="font-semibold">Teccel Engenharia</span>
            </p>
          </div>
        </div>
        </div>
      </div>
    </div>
  )
}
