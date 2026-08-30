export type UserRole = 'superadmin' | 'admin' | 'sales' | 'operations' | 'accounts' | 'designers'
export type ModulePermission = { module: 'todo' | 'notifications' | 'leads' | 'tasks' | 'hr' | 'clients' | 'inventory' | 'returns'; access: 'none' | 'view' | 'manage' }

export type UserType = {
  _id: string
  email: string
  name: string
  phone?: string
  role: UserRole
  additionalRoles?: UserRole[]
  accessTypes?: string[]
  workProfile?: 'director' | 'employee'
  modulePermissions?: ModulePermission[]
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
