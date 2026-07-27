import { apiFetch } from '@/helpers/api'
import type { UserType } from '@/types/auth'
import { create } from 'zustand'
import { devtools } from 'zustand/middleware'
import { useAuthStore } from './authStore'

export type CreateUserPayload = {
  name: string
  email: string
  password: string
  role: UserType['role']
  status: UserType['status']
  timezone: string
}

type UserManagementStore = {
  users: UserType[]
  loading: boolean
  error: string | undefined
  clearUsers: () => void
  fetchUsers: () => Promise<UserType[]>
  createUser: (payload: CreateUserPayload) => Promise<UserType>
  updateUser: (id: string, patch: Partial<UserType>) => Promise<UserType>
}

const authedFetch = <T>(path: string, options: RequestInit = {}) => {
  const token = useAuthStore.getState().token
  if (!token) throw new Error('Please sign in again')
  return apiFetch<T>(path, { ...options, token })
}

export const useUserManagementStore = create<UserManagementStore>()(
  devtools(
    (set) => ({
      users: [],
      loading: false,
      error: undefined,
      clearUsers: () => set({ users: [] }, false, 'users/clear'),
      fetchUsers: async () => {
        set({ loading: true, error: undefined }, false, 'users/fetch:start')
        try {
          const res = await authedFetch<{ data: UserType[] }>('/users')
          set({ users: res.data, loading: false }, false, 'users/fetch:success')
          return res.data
        } catch (e) {
          const message = e instanceof Error ? e.message : 'Unable to load users'
          set({ loading: false, error: message }, false, 'users/fetch:error')
          throw e
        }
      },
      createUser: async (payload) => {
        set({ loading: true, error: undefined }, false, 'users/create:start')
        try {
          const res = await authedFetch<{ data: UserType }>('/users', {
            method: 'POST',
            body: JSON.stringify(payload),
          })
          set((state) => ({ users: [res.data, ...state.users], loading: false }), false, 'users/create:success')
          return res.data
        } catch (e) {
          const message = e instanceof Error ? e.message : 'Unable to create user'
          set({ loading: false, error: message }, false, 'users/create:error')
          throw e
        }
      },
      updateUser: async (id, patch) => {
        try {
          const res = await authedFetch<{ data: UserType }>(`/users/${id}`, {
            method: 'PATCH',
            body: JSON.stringify(patch),
          })
          set((state) => ({ users: state.users.map((item) => (item._id === id ? res.data : item)) }), false, 'users/update:success')
          return res.data
        } catch (e) {
          const message = e instanceof Error ? e.message : 'Unable to update user'
          set({ error: message }, false, 'users/update:error')
          throw e
        }
      },
    }),
    { name: 'UserManagementStore' },
  ),
)
