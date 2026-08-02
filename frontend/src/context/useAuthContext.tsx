import type { AuthSessionType, UserType } from '@/types/auth'
import { useAuthStore } from '@/store/authStore'
import { createContext, useContext, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import type { ChildrenType } from '../types/component-props'

const ACTIVE_TAB_KEY = 'sales_crm_active_tab'
const DUPLICATE_TAB_KEY = 'sales_crm_duplicate_tab'

function tabId() {
  const existing = sessionStorage.getItem(ACTIVE_TAB_KEY)
  if (existing) return existing

  const id = globalThis.crypto?.randomUUID?.() || String(Date.now() + Math.random())
  sessionStorage.setItem(ACTIVE_TAB_KEY, id)
  return id
}

export type AuthContextType = {
  user: UserType | undefined
  token: string | undefined
  loading: boolean
  isAuthenticated: boolean
  saveSession: (session: AuthSessionType) => void
  removeSession: () => Promise<void>
}

const AuthContext = createContext<AuthContextType | undefined>(undefined)

export function useAuthContext() {
  const context = useContext(AuthContext)
  if (context === undefined) {
    throw new Error('useAuthContext must be used within an AuthProvider')
  }
  return context
}

export function AuthProvider({ children }: ChildrenType) {
  const navigate = useNavigate()
  const user = useAuthStore((state) => state.user)
  const token = useAuthStore((state) => state.token)
  const loading = useAuthStore((state) => state.loading)
  const saveSession = useAuthStore((state) => state.setSession)
  const refresh = useAuthStore((state) => state.refresh)
  const logout = useAuthStore((state) => state.logout)
  const clearSession = useAuthStore((state) => state.clearSession)

  useEffect(() => {
    if (token || sessionStorage.getItem(DUPLICATE_TAB_KEY) === 'true') return

    const activeTab = localStorage.getItem(ACTIVE_TAB_KEY)
    const currentTab = sessionStorage.getItem(ACTIVE_TAB_KEY)
    if (activeTab && activeTab !== currentTab) {
      sessionStorage.setItem(DUPLICATE_TAB_KEY, 'true')
      clearSession()
      return
    }

    refresh().catch(() => {})
  }, [clearSession, refresh, token])

  useEffect(() => {
    if (!token) return

    sessionStorage.removeItem(DUPLICATE_TAB_KEY)
    const currentTab = tabId()
    localStorage.setItem(ACTIVE_TAB_KEY, currentTab)
    const onStorage = (event: StorageEvent) => {
      if (event.key === ACTIVE_TAB_KEY && event.newValue && event.newValue !== currentTab) {
        sessionStorage.setItem(DUPLICATE_TAB_KEY, 'true')
        clearSession()
      }
    }

    window.addEventListener('storage', onStorage)
    return () => {
      window.removeEventListener('storage', onStorage)
      if (localStorage.getItem(ACTIVE_TAB_KEY) === currentTab) localStorage.removeItem(ACTIVE_TAB_KEY)
    }
  }, [clearSession, token])

  const removeSession = async () => {
    await logout()
    navigate('/auth/sign-in')
  }

  return (
    <AuthContext.Provider
      value={{
        user,
        token,
        loading,
        isAuthenticated: Boolean(token),
        saveSession,
        removeSession,
      }}>
      {children}
    </AuthContext.Provider>
  )
}
