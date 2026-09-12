import type { UserType } from '@/types/auth'

export const APP_MODULES = ['todo', 'notifications', 'leads', 'tasks', 'hr', 'clients', 'invoices', 'challans', 'inventory', 'laser-cut', 'powder-coating', 'returns', 'designer'] as const
export type AppModule = (typeof APP_MODULES)[number]
export type ModulePermission = { module: AppModule; access: 'none' | 'view' | 'manage' }
type RequiredModuleAccess = Exclude<ModulePermission['access'], 'none'>

export const defaultModulePermissions = (): ModulePermission[] => APP_MODULES.map((module) => ({ module, access: 'none' }))
export const moduleLabel = (module: AppModule) => ({
  todo: 'Todo',
  notifications: 'Notifications',
  leads: 'Lead Management',
  tasks: 'Task Management',
  hr: 'HR Management',
  clients: 'Client Management',
  invoices: 'Invoice Management',
  challans: 'Delivery Challans',
  inventory: 'Inventory Management',
  'laser-cut': 'Laser Cut Management',
  'powder-coating': 'Powder Coating',
  returns: 'Return Management',
  designer: 'Designer',
}[module])
export const hasFullAppAccess = (user?: UserType) => [user?.role, ...(user?.additionalRoles || []), ...(user?.accessTypes || []), user?.workProfile]
  .some((role) => role === 'superadmin' || role === 'admin')
export const canAccessModule = (user: UserType | undefined, module?: AppModule, required: RequiredModuleAccess = 'view') => !module || hasFullAppAccess(user) || (module === 'hr' && required === 'view' && user?.workProfile === 'employee') || Boolean(user?.modulePermissions?.some((permission) => permission.module === module && (required === 'view' ? permission.access !== 'none' : permission.access === 'manage')))
export const canManageModule = (user: UserType | undefined, module: AppModule) => hasFullAppAccess(user) || Boolean(user?.modulePermissions?.some((permission) => permission.module === module && permission.access === 'manage'))
export const canReviewDesignerDocuments = (user?: UserType) => user?.workProfile === 'director' && Boolean(user.modulePermissions?.some((permission) => permission.module === 'designer' && permission.access !== 'none'))

export const moduleForPath = (path: string) => {
  if (path === '/apps/todo') return 'todo'
  if (path === '/notifications') return 'notifications'
  if (path.startsWith('/leads')) return 'leads'
  if (path.startsWith('/tasks')) return 'tasks'
  if (path.startsWith('/hr')) return 'hr'
  if (path.startsWith('/clients')) return 'clients'
  if (path.startsWith('/invoices')) return 'invoices'
  if (path.startsWith('/challans')) return 'challans'
  if (path.startsWith('/inventory')) return 'inventory'
  if (path.startsWith('/laser-cut-management')) return 'laser-cut'
  if (path.startsWith('/powder-coating-management')) return 'powder-coating'
  if (path.startsWith('/returns')) return 'returns'
  if (path.startsWith('/designer')) return 'designer'
  return undefined
}
