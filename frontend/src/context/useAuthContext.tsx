import type { AuthSessionType, UserType } from '@/types/auth'
import { useAuthStore } from '@/store/authStore'
import { createContext, useContext, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import type { ChildrenType } from '../types/component-props'

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

  useEffect(() => {
    if (!token) refresh().catch(() => {})
  }, [refresh, token])

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
