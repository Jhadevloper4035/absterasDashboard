import type { UserType } from '@/types/auth'

export const APP_MODULES = ['todo', 'notifications', 'leads', 'tasks', 'events', 'hr', 'clients', 'inventory', 'returns'] as const
export const BASIC_APP_MODULES = ['todo', 'notifications'] as const
export type AppModule = (typeof APP_MODULES)[number]
export type ModulePermission = { module: AppModule; access: 'none' | 'view' | 'manage' }

export const defaultModulePermissions = (): ModulePermission[] => APP_MODULES.map((module) => ({ module, access: BASIC_APP_MODULES.includes(module as (typeof BASIC_APP_MODULES)[number]) ? 'manage' : 'none' }))
export const moduleLabel = (module: AppModule) => ({
  todo: 'Todo',
  notifications: 'Notifications',
  leads: 'Lead Management',
  tasks: 'Task Management',
  events: 'Events Management',
  hr: 'HR Management',
  clients: 'Client Management',
  inventory: 'Inventory Management',
  returns: 'Return Management',
}[module])
export const canAccessModule = (user: UserType | undefined, module?: AppModule) => !module || BASIC_APP_MODULES.includes(module as (typeof BASIC_APP_MODULES)[number]) || (module !== 'hr' && [user?.role, ...(user?.additionalRoles || []), ...(user?.accessTypes || [])].some((role) => role === 'superadmin' || role === 'admin')) || (user?.workProfile !== 'director' && user?.modulePermissions?.some((permission) => permission.module === module && permission.access !== 'none'))
export const canManageModule = (user: UserType | undefined, module: AppModule) => [user?.role, ...(user?.additionalRoles || []), ...(user?.accessTypes || [])].some((role) => role === 'superadmin' || role === 'admin') || user?.modulePermissions?.some((permission) => permission.module === module && permission.access === 'manage')

export const moduleForPath = (path: string) => {
  if (path === '/apps/todo') return 'todo'
  if (path === '/notifications') return 'notifications'
  if (path.startsWith('/leads')) return 'leads'
  if (path.startsWith('/tasks')) return 'tasks'
  if (path === '/upcoming/events-management') return 'events'
  if (path.startsWith('/hr')) return 'hr'
  if (path.startsWith('/clients') || path.startsWith('/invoices') || path.startsWith('/challans')) return 'clients'
  if (path.startsWith('/inventory')) return 'inventory'
  if (path.startsWith('/returns')) return 'returns'
  return undefined
}
