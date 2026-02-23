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
      className={`fixed top-0 left-0 z-50 h-screen w-72 flex flex-col bg-white border-r border-slate-200/80 shadow-xl transition-all duration-300 ${
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
      <nav className="flex-1 overflow-y-auto py-4 px-3">
        {!isCompact && (
          <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest px-3 mb-3">Menu</p>
        )}
        <div className="space-y-1">
          {filteredNavItems.map((item) => {
            const isActive = pathname === item.path
            return (
              <Link
                key={item.path}
                href={item.path}
                className={`flex items-center gap-3 px-3 py-2.5 rounded-xl transition-all duration-200 ${
                  isActive
                    ? 'bg-gradient-to-r from-primary to-primary-dark text-white shadow-lg shadow-primary/25'
                    : 'text-slate-600 hover:bg-slate-100 hover:text-slate-800'
                }`}
                title={isCompact ? item.name : undefined}
                onClick={onMobileClose}
              >
                <div className={`shrink-0 ${isCompact ? 'mx-auto' : ''} ${isActive ? 'text-white' : 'text-slate-400 group-hover:text-slate-600'}`}>
                  {item.icon}
                </div>
                {!isCompact && (
                  <div className="flex-1 min-w-0">
                    <div className={`font-semibold text-sm truncate ${isActive ? 'text-white' : 'text-slate-800'}`}>{item.name}</div>
                    <div className={`text-xs truncate ${isActive ? 'text-white/75' : 'text-slate-400'}`}>
                      {item.description}
                    </div>
                  </div>
                )}
                {isActive && !isCompact && (
                  <div className="w-2 h-2 rounded-full bg-white/70 shrink-0 shadow-sm" />
                )}
              </Link>
            )
          })}
        </div>
      </nav>

      {/* User Profile */}
      <div className="border-t border-slate-100 p-3">
        {!isCompact ? (
          <div className="space-y-0.5">
            <Link
              href="/profile"
              className="flex items-center gap-3 px-3 py-2.5 rounded-xl hover:bg-slate-50 transition-colors group"
              onClick={onMobileClose}
            >
              <div className="relative w-9 h-9 rounded-xl overflow-hidden flex-shrink-0 ring-2 ring-slate-100 group-hover:ring-primary/30 transition-all">
                {profile?.avatar_url ? (
                  <Image src={profile.avatar_url} alt={profile.full_name || 'Avatar'} fill className="object-cover" unoptimized />
                ) : (
                  <div className="w-full h-full bg-gradient-to-br from-primary to-primary-dark flex items-center justify-center text-white text-sm font-bold">
                    {(profile?.full_name?.[0] || profile?.email?.[0] || 'U').toUpperCase()}
                  </div>
                )}
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-semibold text-slate-900 truncate leading-none mb-0.5">
                  {profile?.full_name || profile?.email?.split('@')[0]}
                </p>
                <p className="text-[11px] text-slate-400 truncate font-medium">
                  {profile?.role === 'admin' ? 'Administrador' : 'Usuário'}
                </p>
              </div>
              <svg className="w-3.5 h-3.5 text-slate-300 group-hover:text-slate-500 transition-colors flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
              </svg>
            </Link>
            <button
              onClick={signOut}
              className="w-full flex items-center gap-2.5 px-3 py-2 text-slate-400 hover:bg-red-50 hover:text-red-600 rounded-xl transition-all text-sm font-medium"
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" />
              </svg>
              Sair da conta
            </button>
          </div>
        ) : (
          <div className="flex flex-col items-center gap-2">
            <Link
              href="/profile"
              className="relative w-9 h-9 rounded-xl overflow-hidden ring-2 ring-slate-100 hover:ring-primary/40 transition-all"
              title="Meu Perfil"
              onClick={onMobileClose}
            >
              {profile?.avatar_url ? (
                <Image src={profile.avatar_url} alt={profile.full_name || 'Avatar'} fill className="object-cover" unoptimized />
              ) : (
                <div className="w-full h-full bg-gradient-to-br from-primary to-primary-dark flex items-center justify-center text-white text-sm font-bold">
                  {(profile?.full_name?.[0] || profile?.email?.[0] || 'U').toUpperCase()}
                </div>
              )}
            </Link>
            <button
              onClick={signOut}
              className="p-2 text-slate-400 hover:bg-red-50 hover:text-red-600 rounded-xl transition-all"
              title="Sair"
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
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
