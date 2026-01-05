'use client'

import { useAuth } from '@/contexts/AuthContext'
import Link from 'next/link'
import Image from 'next/image'
import { usePathname } from 'next/navigation'
import { useState } from 'react'

export default function Sidebar() {
  const { profile, signOut, isAdmin } = useAuth()
  const pathname = usePathname()
  const [collapsed, setCollapsed] = useState(false)
  const logoSrc = collapsed ? '/logo-teccel.png' : '/logo_teccel.png'
  const logoWidth = collapsed ? 54 : 160
  const logoHeight = collapsed ? 125 : 40
  const logoClassName = collapsed ? 'h-9 w-auto' : 'h-7 w-auto'

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
    <>
      {/* Sidebar */}
      <aside
        className={`fixed top-0 left-0 h-screen bg-white border-r border-gray-200 shadow-lg z-50 transition-all duration-300 ${
          collapsed ? 'w-20' : 'w-72'
        }`}
      >
        {/* Logo */}
        <div className="h-16 flex items-center justify-center px-4 border-b border-gray-200">
          <Link
            href="/dashboard"
            className="flex w-full items-center justify-center py-1 transition-opacity hover:opacity-90"
          >
            <Image
              src={logoSrc}
              alt="Teccel Engenharia"
              width={logoWidth}
              height={logoHeight}
              className={`${logoClassName} transition-all duration-300`}
              priority
            />
          </Link>
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
                      ? 'bg-gradient-to-r from-primary to-primary-dark text-white shadow-lg'
                      : 'text-gray-700 hover:bg-gray-100'
                  }`}
                  title={collapsed ? item.name : undefined}
                >
                  <div className={collapsed ? 'mx-auto' : ''}>
                    {item.icon}
                  </div>
                  {!collapsed && (
                    <div className="flex-1">
                      <div className="font-semibold text-sm">{item.name}</div>
                      <div className={`text-xs ${isActive ? 'text-red-100' : 'text-gray-500'}`}>
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
        <div className="border-t border-gray-200 p-4">
          {!collapsed ? (
            <div className="mb-3">
              <div className="flex items-center gap-3 mb-3">
                <div className="w-10 h-10 bg-gradient-to-br from-primary to-primary-dark rounded-full flex items-center justify-center text-white font-semibold">
                  {(profile?.full_name?.[0] || profile?.email?.[0] || 'U').toUpperCase()}
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-semibold text-gray-900 truncate">
                    {profile?.full_name || profile?.email?.split('@')[0]}
                  </p>
                  <p className="text-xs text-gray-500 capitalize">
                    {profile?.role === 'admin' ? 'Administrador' : 'Usuário'}
                  </p>
                </div>
              </div>
              <button
                onClick={signOut}
                className="w-full flex items-center justify-center gap-2 px-4 py-2.5 bg-gray-100 hover:bg-red-50 text-gray-700 hover:text-primary rounded-xl transition-all border border-transparent hover:border-red-200"
              >
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" />
                </svg>
                <span className="text-sm font-medium">Sair</span>
              </button>
            </div>
          ) : (
            <div className="flex flex-col items-center gap-3">
              <div className="w-10 h-10 bg-gradient-to-br from-primary to-primary-dark rounded-full flex items-center justify-center text-white font-semibold">
                {(profile?.full_name?.[0] || profile?.email?.[0] || 'U').toUpperCase()}
              </div>
              <button
                onClick={signOut}
                className="p-2 text-gray-700 hover:bg-red-50 hover:text-primary rounded-xl transition-all"
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
          onClick={() => setCollapsed(!collapsed)}
          className="absolute -right-3 top-20 w-6 h-6 bg-white border border-gray-200 rounded-full flex items-center justify-center shadow-md hover:shadow-lg transition-all hover:scale-110"
        >
          <svg
            className={`w-4 h-4 text-gray-600 transition-transform ${collapsed ? 'rotate-180' : ''}`}
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
          >
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
          </svg>
        </button>
      </aside>

      {/* Spacer para o conteúdo não ficar atrás da sidebar */}
      <div className={`transition-all duration-300 ${collapsed ? 'ml-20' : 'ml-72'}`} />
    </>
  )
}
