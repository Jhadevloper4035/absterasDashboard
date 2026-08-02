import { buildApiUrl } from '@/helpers/apiUrl'
import type { AuthSessionType, UserType } from '@/types/auth'
import { create } from 'zustand'
import { devtools } from 'zustand/middleware'

type SetupSuperadminPayload = {
  name: string
  email: string
  phone: string
  password: string
}

type AuthStore = {
  user: UserType | undefined
  token: string | undefined
  loading: boolean
  error: string | undefined
  setSession: (session: AuthSessionType) => void
  login: (email: string, password: string) => Promise<AuthSessionType>
  refresh: () => Promise<AuthSessionType>
  setupSuperadmin: (payload: SetupSuperadminPayload) => Promise<AuthSessionType>
  logout: () => Promise<void>
  clearSession: () => void
}

const emptyAuth = {
  user: undefined,
  token: undefined,
  loading: false,
  error: undefined,
}

let refreshPromise: Promise<AuthSessionType> | undefined

export const useAuthStore = create<AuthStore>()(
  devtools(
    (set, get) => ({
      ...emptyAuth,
      loading: true,
      setSession: (session) => set({ user: session.user, token: session.accessToken || session.token, loading: false, error: undefined }, false, 'auth/setSession'),
      login: async (email, password) => {
        set({ loading: true, error: undefined }, false, 'auth/login:start')
        try {
          const response = await fetch(buildApiUrl('/auth/login'), {
            method: 'POST',
            credentials: 'include',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ email, password }),
          })
          const res = await response.json().catch(() => ({}))
          if (!response.ok) throw new Error(res.error?.message || 'Login failed')
          get().setSession(res.data)
          return res.data
        } catch (e) {
          const message = e instanceof Error ? e.message : 'Login failed'
          set({ loading: false, error: message }, false, 'auth/login:error')
          throw e
        }
      },
      refresh: async () => {
        if (refreshPromise) return refreshPromise
        set({ loading: true, error: undefined }, false, 'auth/refresh:start')
        refreshPromise = (async () => {
          try {
            const response = await fetch(buildApiUrl('/auth/refresh'), {
              method: 'POST',
              credentials: 'include',
            })
            const res = await response.json().catch(() => ({}))

            if (!response.ok) throw new Error(res.error?.message || 'Please sign in again')

            get().setSession(res.data)
            return res.data
          } catch (e) {
            const message = e instanceof Error ? e.message : 'Please sign in again'
            set({ ...emptyAuth, error: message }, false, 'auth/refresh:error')
            throw e
          }
        })()

        try {
          return await refreshPromise
        } finally {
          refreshPromise = undefined
        }
      },
      setupSuperadmin: async (payload) => {
        set({ loading: true, error: undefined }, false, 'auth/setup:start')
        try {
          const response = await fetch(buildApiUrl('/users'), {
            method: 'POST',
            credentials: 'include',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ ...payload, role: 'superadmin' }),
          })
          const res = await response.json().catch(() => ({}))
          if (!response.ok) throw new Error(res.error?.message || 'Setup failed')
          return await get().login(payload.email, payload.password)
        } catch (e) {
          const message = e instanceof Error ? e.message : 'Setup failed'
          set({ loading: false, error: message }, false, 'auth/setup:error')
          throw e
        }
      },
      clearSession: () => set(emptyAuth, false, 'auth/clearSession'),
      logout: async () => {
        const token = get().token
        await fetch(buildApiUrl('/auth/logout'), {
          method: 'POST',
          credentials: 'include',
          headers: token ? { Authorization: `Bearer ${token}` } : undefined,
        }).catch(() => {})
        get().clearSession()
      },
    }),
    { name: 'AuthStore' },
  ),
)
