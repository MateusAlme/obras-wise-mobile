'use client'

import { useState } from 'react'
import Image from 'next/image'
import Link from 'next/link'
import Sidebar from '@/components/Sidebar'

interface AppShellProps {
  children: React.ReactNode
}

export default function AppShell({ children }: AppShellProps) {
  const [collapsed, setCollapsed] = useState(false)
  const [mobileOpen, setMobileOpen] = useState(false)

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-white to-slate-100 text-slate-900">
      <Sidebar
        collapsed={collapsed}
        onToggleCollapsed={() => setCollapsed((prev) => !prev)}
        isMobileOpen={mobileOpen}
        onMobileClose={() => setMobileOpen(false)}
      />

      {mobileOpen && (
        <button
          type="button"
          aria-label="Fechar menu"
          onClick={() => setMobileOpen(false)}
          className="fixed inset-0 z-40 bg-black/30 backdrop-blur-[1px] lg:hidden"
        />
      )}

      <div
        className={`min-h-screen transition-[margin] duration-300 ${
          collapsed ? 'lg:ml-20' : 'lg:ml-72'
        }`}
      >
        <header className="lg:hidden sticky top-0 z-30 bg-white/80 backdrop-blur border-b border-slate-200">
          <div className="flex items-center gap-3 px-4 py-3">
            <button
              type="button"
              aria-label="Abrir menu"
              aria-expanded={mobileOpen}
              aria-controls="app-sidebar"
              onClick={() => setMobileOpen(true)}
              className="inline-flex h-10 w-10 items-center justify-center rounded-xl border border-slate-200 bg-white text-slate-700 shadow-sm"
            >
              <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h10" />
              </svg>
            </button>

            <Link href="/dashboard" className="flex items-center gap-2">
              <Image
                src="/t_logo.png"
                alt="Teccel Engenharia"
                width={36}
                height={36}
                className="h-8 w-auto"
                priority
              />
              <span className="text-sm font-semibold text-slate-800">Teccel Engenharia</span>
            </Link>
          </div>
        </header>

        <main className="px-4 sm:px-6 lg:px-8 py-6 lg:py-8">
          {children}
        </main>
      </div>
    </div>
  )
}
