'use client'

import { useAuth } from '@/contexts/AuthContext'
import Link from 'next/link'
import Image from 'next/image'
import { usePathname } from 'next/navigation'

interface SidebarProps {
  collapsed: boolean
  onToggleCollapsed: () => void
  isMobileOpen: boolean
  onMobileClose: () => void
}

export default function Sidebar({
  collapsed,
  onToggleCollapsed,
  isMobileOpen,
  onMobileClose,
}: SidebarProps) {
  const { profile, signOut, isAdmin } = useAuth()
  const pathname = usePathname()
  const isCompact = collapsed && !isMobileOpen

  const navItems = [
    {
      name: 'Dashboard',
      path: '/dashboard',
      icon: (
        <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-6 0a1 1 0 001-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 001 1m-6 0h6" />
        </svg>
      ),
      description: 'Visão geral'
    },
    {
      name: 'Acompanhamento',
      path: '/acompanhamento',
      icon: (
        <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-6 9l2 2 4-4" />
        </svg>
      ),
      description: 'Status e cobrança'
    },
    {
      name: 'Equipes',
      path: '/teams',
      icon: (
        <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z" />
        </svg>
      ),
      description: 'Gerenciar equipes',
      adminOnly: true
    },
    {
      name: 'Relatórios',
      path: '/reports',
      icon: (
        <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 17v-2m3 2v-4m3 4v-6m2 10H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
        </svg>
      ),
      description: 'Gerar relatórios'
    },
    {
      name: 'Usuários',
      path: '/users',
      icon: (
        <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4.354a4 4 0 110 5.292M15 21H3v-1a6 6 0 0112 0v1zm0 0h6v-1a6 6 0 00-9-5.197M13 7a4 4 0 11-8 0 4 4 0 018 0z" />
        </svg>
      ),
      description: 'Gerenciar usuários',
      adminOnly: true
    },
  ]

  const filteredNavItems = navItems.filter(item => !item.adminOnly || isAdmin)

  return (
    <aside
      id="app-sidebar"
      className={`fixed top-0 left-0 z-50 h-screen w-72 flex flex-col bg-white border-r border-slate-200 shadow-lg transition-all duration-300 ${
        collapsed ? 'lg:w-20' : 'lg:w-72'
      } ${isMobileOpen ? 'translate-x-0' : '-translate-x-full lg:translate-x-0'}`}
    >
      {/* Logo */}
      <div className="relative h-16 flex items-center px-4 border-b border-slate-200">
        <Link
          href="/dashboard"
          className={`flex w-full items-center justify-center py-1 transition-opacity hover:opacity-90 ${
            isCompact ? 'lg:justify-center' : ''
          }`}
          onClick={onMobileClose}
        >
          {isCompact ? (
            <Image
              src="/t_logo.png"
              alt="Teccel"
              width={40}
              height={40}
              className="h-10 w-auto transition-all duration-300"
              priority
            />
          ) : (
            <Image
              src="/logo_teccel.png"
              alt="Teccel Engenharia"
              width={160}
              height={45}
              className="h-9 w-auto transition-all duration-300"
              priority
            />
          )}
        </Link>

        <button
          type="button"
          onClick={onMobileClose}
          className="absolute right-4 inline-flex h-9 w-9 items-center justify-center rounded-lg border border-slate-200 text-slate-600 lg:hidden"
          aria-label="Fechar menu"
        >
          <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
          </svg>
        </button>
      </div>

      {/* Navigation */}
      <nav className="flex-1 overflow-y-auto py-6 px-3">
        <div className="space-y-2">
            {filteredNavItems.map((item) => {
              const isActive = pathname === item.path
              return (
                <Link
                  key={item.path}
                  href={item.path}
                  className={`flex items-center gap-3 px-4 py-3 rounded-xl transition-all ${
                    isActive
                      ? 'bg-gradient-to-r from-primary to-primary-dark text-white shadow-md'
                      : 'text-slate-700 hover:bg-slate-100'
                  }`}
                title={isCompact ? item.name : undefined}
                onClick={onMobileClose}
              >
                <div className={isCompact ? 'mx-auto' : ''}>
                  {item.icon}
                </div>
                {!isCompact && (
                  <div className="flex-1">
                    <div className="font-semibold text-sm">{item.name}</div>
                    <div className={`text-xs ${isActive ? 'text-white/70' : 'text-slate-500'}`}>
                      {item.description}
                    </div>
                  </div>
                )}
              </Link>
            )
          })}
        </div>
      </nav>

      {/* User Profile */}
      <div className="border-t border-slate-200 p-4">
        {!isCompact ? (
          <div className="mb-3">
            <Link
              href="/profile"
              className="flex items-center gap-3 mb-3 p-2 rounded-xl hover:bg-slate-100 transition-colors cursor-pointer"
              onClick={onMobileClose}
            >
              <div className="relative w-10 h-10 rounded-full overflow-hidden flex-shrink-0">
                {profile?.avatar_url ? (
                  <Image
                    src={profile.avatar_url}
                    alt={profile.full_name || 'Avatar'}
                    fill
                    className="object-cover"
                    unoptimized
                  />
                ) : (
                  <div className="w-full h-full bg-gradient-to-br from-primary to-primary-dark flex items-center justify-center text-white font-semibold">
                    {(profile?.full_name?.[0] || profile?.email?.[0] || 'U').toUpperCase()}
                  </div>
                )}
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-semibold text-slate-900 truncate">
                  {profile?.full_name || profile?.email?.split('@')[0]}
                </p>
                <p className="text-xs text-slate-500 capitalize">
                  {profile?.role === 'admin' ? 'Administrador' : 'Usuário'}
                </p>
              </div>
              <svg className="w-4 h-4 text-slate-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
              </svg>
            </Link>
            <button
              onClick={signOut}
              className="w-full flex items-center justify-center gap-2 px-4 py-2.5 bg-slate-100 hover:bg-red-50 text-slate-700 hover:text-primary rounded-xl transition-all border border-transparent hover:border-red-200"
            >
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" />
              </svg>
              <span className="text-sm font-medium">Sair</span>
            </button>
          </div>
        ) : (
          <div className="flex flex-col items-center gap-3">
            <Link
              href="/profile"
              className="relative w-10 h-10 rounded-full overflow-hidden flex-shrink-0 hover:ring-2 hover:ring-primary transition-all"
              title="Meu Perfil"
              onClick={onMobileClose}
            >
              {profile?.avatar_url ? (
                <Image
                  src={profile.avatar_url}
                  alt={profile.full_name || 'Avatar'}
                  fill
                  className="object-cover"
                  unoptimized
                />
              ) : (
                <div className="w-full h-full bg-gradient-to-br from-primary to-primary-dark flex items-center justify-center text-white font-semibold">
                  {(profile?.full_name?.[0] || profile?.email?.[0] || 'U').toUpperCase()}
                </div>
              )}
            </Link>
            <button
              onClick={signOut}
              className="p-2 text-slate-700 hover:bg-red-50 hover:text-primary rounded-xl transition-all"
              title="Sair"
            >
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" />
              </svg>
            </button>
          </div>
        )}
      </div>

      {/* Toggle Button */}
      <button
        onClick={onToggleCollapsed}
        className="absolute -right-3 top-20 hidden h-6 w-6 items-center justify-center rounded-full border border-slate-200 bg-white shadow-md transition-all hover:scale-110 hover:shadow-lg lg:flex"
      >
        <svg
          className={`h-4 w-4 text-slate-600 transition-transform ${collapsed ? 'rotate-180' : ''}`}
          fill="none"
          stroke="currentColor"
          viewBox="0 0 24 24"
        >
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
        </svg>
      </button>
    </aside>
  )
}
