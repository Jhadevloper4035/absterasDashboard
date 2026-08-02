export type UserType = {
  _id: string
  email: string
  name: string
  phone?: string
  role: 'superadmin' | 'admin' | 'sales' | 'operations' | 'accounts' | 'designers'
  status: 'active' | 'inactive' | 'invited' | 'suspended'
  timezone?: string
  createdAt?: string
  updatedAt?: string
}

export type AuthSessionType = {
  token: string
  accessToken?: string
  accessTokenExpiresAt?: string
  user: UserType
}
