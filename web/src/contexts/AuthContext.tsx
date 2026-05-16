'use client'

import { createContext, useContext, useEffect, useState } from 'react'
import { User } from '@supabase/supabase-js'
import { supabase } from '@/lib/supabase'
import { useRouter } from 'next/navigation'

interface Profile {
  id: string
  email: string
  full_name: string | null
  role: 'admin' | 'user'
  avatar_url: string | null
  created_at: string
  updated_at: string
}

interface AuthContextType {
  user: User | null
  profile: Profile | null
  loading: boolean
  signIn: (email: string, password: string) => Promise<{ error: Error | null }>
  signOut: () => Promise<void>
  isAdmin: boolean
}

const AuthContext = createContext<AuthContextType | undefined>(undefined)

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null)
  const [profile, setProfile] = useState<Profile | null>(null)
  const [loading, setLoading] = useState(true)
  const router = useRouter()

  const isInvalidRefreshTokenError = (error: unknown) => {
    const message = error instanceof Error ? error.message : String(error || '')
    return message.includes('Invalid Refresh Token') || message.includes('Refresh Token Not Found')
  }

  const clearInvalidSession = async () => {
    try {
      await supabase.auth.signOut({ scope: 'local' })
    } catch {
      // Se o refresh token local já está inválido, o próprio signOut pode falhar.
    }

    if (typeof window !== 'undefined') {
      Object.keys(window.localStorage)
        .filter((key) => key.startsWith('sb-') && key.includes('auth-token'))
        .forEach((key) => window.localStorage.removeItem(key))
    }

    setUser(null)
    setProfile(null)
    setLoading(false)
    router.replace('/login')
  }

  useEffect(() => {
    // Verificar sessão atual
    supabase.auth.getSession()
      .then(({ data: { session }, error }) => {
        if (error) throw error
        setUser(session?.user ?? null)
        if (session?.user) {
          loadProfile(session.user.id)
        } else {
          setLoading(false)
        }
      })
      .catch((error) => {
        if (isInvalidRefreshTokenError(error)) {
          void clearInvalidSession()
          return
        }
        console.error('Error loading session:', error)
        setLoading(false)
      })

    // Escutar mudanças de autenticação
    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, session) => {
      setUser(session?.user ?? null)
      if (session?.user) {
        loadProfile(session.user.id)
      } else {
        setProfile(null)
        setLoading(false)
      }
    })

    const handleUnhandledRejection = (event: PromiseRejectionEvent) => {
      if (isInvalidRefreshTokenError(event.reason)) {
        event.preventDefault()
        void clearInvalidSession()
      }
    }

    window.addEventListener('unhandledrejection', handleUnhandledRejection)

    return () => {
      subscription.unsubscribe()
      window.removeEventListener('unhandledrejection', handleUnhandledRejection)
    }
  }, [])

  const loadProfile = async (userId: string) => {
    try {
      const { data, error } = await supabase
        .from('profiles')
        .select('*')
        .eq('id', userId)
        .single()

      if (error) throw error
      setProfile(data)
    } catch (error) {
      console.error('Error loading profile:', error)
    } finally {
      setLoading(false)
    }
  }

  const signIn = async (email: string, password: string) => {
    try {
      const { error } = await supabase.auth.signInWithPassword({
        email,
        password,
      })
      if (error) throw error
      return { error: null }
    } catch (error) {
      return { error: error as Error }
    }
  }

  const signOut = async () => {
    try {
      await supabase.auth.signOut()
    } catch (error) {
      if (!isInvalidRefreshTokenError(error)) throw error
      await supabase.auth.signOut({ scope: 'local' })
    }
    setUser(null)
    setProfile(null)
    router.push('/login')
  }

  const isAdmin = profile?.role === 'admin'

  return (
    <AuthContext.Provider value={{ user, profile, loading, signIn, signOut, isAdmin }}>
      {children}
    </AuthContext.Provider>
  )
}

export function useAuth() {
  const context = useContext(AuthContext)
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider')
  }
  return context
}
