export type UserType = {
  _id: string
  email: string
  name: string
  role: 'superadmin' | 'admin' | 'sales'
  status: 'active' | 'inactive' | 'invited' | 'suspended'
  timezone?: string
  createdAt?: string
  updatedAt?: string
}

export type AuthSessionType = {
  token: string
  user: UserType
}
