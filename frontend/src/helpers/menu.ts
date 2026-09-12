import { MENU_ITEMS } from '@/assets/data/menu-items'
import { type AppModule, type ModulePermission } from '@/helpers/moduleAccess'
import type { MenuItemType } from '@/types/menu'

const HR_MENU_MODULES: Record<string, string> = {
  'hr-employees': 'employees', 'hr-departments': 'employees', 'hr-designations': 'employees',
  'hr-attendance': 'attendance', 'hr-attendance-reports': 'attendance', 'hr-holidays': 'attendance',
  'hr-leave': 'leave', 'hr-leave-requests': 'leave', 'hr-leave-approvals': 'leave', 'hr-leave-calendar': 'leave', 'hr-leave-types': 'leave',
  'hr-payroll': 'payroll', 'employee-overview': 'employees', 'employee-profile': 'employees', 'employee-attendance': 'attendance', 'employee-id-card': 'employees', 'employee-payslips': 'payroll', 'employee-requests': 'leave', 'employee-leave': 'leave', 'employee-reimbursements': 'expenses', 'employee-advance': 'payroll', 'hr-expense-approvals': 'expenses', 'hr-reports': 'reports',
}
const INVENTORY_MENU_MODULES: Record<string, string> = { 'inventory-management': 'items', 'inventory-items': 'items', 'inventory-add-item': 'items', 'inventory-suppliers': 'items', 'inventory-purchases': 'transactions', 'laser-cut-management': 'laser-cut', 'laser-cut-dashboard': 'laser-cut', 'laser-cut-current-orders': 'laser-cut', 'laser-cut-move-in': 'laser-cut', 'laser-cut-move-out': 'laser-cut', 'laser-cut-vendors': 'laser-cut', 'powder-coating-management': 'powder-coating', 'powder-coating-dashboard': 'powder-coating', 'powder-coating-orders': 'powder-coating', 'powder-coating-move-in': 'powder-coating', 'powder-coating-move-out': 'powder-coating', 'powder-coating-vendors': 'powder-coating' }
const APP_MENU_MODULES: Record<string, AppModule> = { 'apps-todo': 'todo', notifications: 'notifications', leads: 'leads', tasks: 'tasks', 'hr-management': 'hr', 'client-management': 'clients', 'invoice-management': 'invoices', 'delivery-challans': 'challans', 'inventory-management': 'inventory', 'laser-cut-management': 'laser-cut', 'powder-coating-management': 'powder-coating', 'return-management': 'returns', designer: 'designer' }
const hasHrAccess = (modules: string[], permissions: ModulePermission[], module?: string) => Boolean(module && (permissions.some((permission) => permission.module === 'hr' && permission.access === 'manage') || modules.includes(module)))
const hasInventoryAccess = (modules: string[], permissions: ModulePermission[], module?: string) => Boolean(module && (permissions.some((permission) => permission.module === 'inventory' && permission.access === 'manage') || modules.includes(module)))
const hasAppAccess = (permissions: ModulePermission[], module?: AppModule, requiresManage = false) => !module || permissions.some((permission) => permission.module === module && (requiresManage ? permission.access === 'manage' : permission.access !== 'none'))
const hasFullAppAccess = (roles: string[], workProfile?: string) => roles.includes('superadmin') || roles.includes('admin') || workProfile === 'superadmin' || workProfile === 'admin'
const isSuperadminOnly = (item: MenuItemType) => item.roles?.length === 1 && item.roles[0] === 'superadmin'
const HIDDEN_SIDEBAR_MENU_KEYS = new Set(['pages', 'widgets', 'base-ui', 'advanced-ui', 'charts', 'tables', 'icons', 'maps', 'badge-menu', 'menuitem', 'disabled-item'])
const isVisible = (item: MenuItemType, roles: string[] = [], hrModules: string[] = [], inventoryModules: string[] = [], modulePermissions: ModulePermission[] = [], workProfile?: 'superadmin' | 'admin' | 'client' | 'director' | 'employee', parentModule?: AppModule) => {
  if (HIDDEN_SIDEBAR_MENU_KEYS.has(item.key)) return false
  if ((item.key === 'employee-panel' || item.parentKey === 'employee-panel') && workProfile !== 'employee') return false
  const module = APP_MENU_MODULES[item.key] || parentModule
  const fullAccess = hasFullAppAccess(roles, workProfile)
  if (item.adminOnly && !fullAccess) return false
  if (item.directorOnly && !(workProfile === 'director' && hasAppAccess(modulePermissions, 'designer'))) return false
  return (module ? fullAccess || hasAppAccess(modulePermissions, module, item.requiresManage) : isSuperadminOnly(item) ? roles.includes('superadmin') : fullAccess || !item.roles || roles.some((role) => item.roles?.includes(role))) && (fullAccess || !HR_MENU_MODULES[item.key] || hasHrAccess(hrModules, modulePermissions, HR_MENU_MODULES[item.key])) && (fullAccess || !INVENTORY_MENU_MODULES[item.key] || hasInventoryAccess(inventoryModules, modulePermissions, INVENTORY_MENU_MODULES[item.key]))
}

const filterMenuItem = (item: MenuItemType, roles: string[] = [], hrModules: string[] = [], inventoryModules: string[] = [], modulePermissions: ModulePermission[] = [], workProfile?: 'superadmin' | 'admin' | 'client' | 'director' | 'employee', parentModule?: AppModule): MenuItemType | null => {
  const module = APP_MENU_MODULES[item.key] || parentModule
  if (!isVisible(item, roles, hrModules, inventoryModules, modulePermissions, workProfile, parentModule)) return null

  const children = item.children?.map((child) => filterMenuItem(child, roles, hrModules, inventoryModules, modulePermissions, workProfile, module)).filter((child): child is MenuItemType => Boolean(child))
  if (item.children && !children?.length) return null

  return { ...item, children }
}

export const getMenuItems = (roles: string[] = [], hrModules: string[] = [], inventoryModules: string[] = [], modulePermissions: ModulePermission[] = [], workProfile?: 'superadmin' | 'admin' | 'client' | 'director' | 'employee'): MenuItemType[] => {
  return MENU_ITEMS.map((item) => filterMenuItem(item, roles, hrModules, inventoryModules, modulePermissions, workProfile)).filter((item): item is MenuItemType => Boolean(item))
}

export const findAllParent = (menuItems: MenuItemType[], menuItem: MenuItemType): string[] => {
  let parents: string[] = []
  const parent = findMenuItem(menuItems, menuItem.parentKey)
  if (parent) {
    parents.push(parent.key)
    if (parent.parentKey) {
      parents = [...parents, ...findAllParent(menuItems, parent)]
    }
  }
  return parents
}

export const getMenuItemFromURL = (items: MenuItemType | MenuItemType[], url: string): MenuItemType | undefined => {
  if (items instanceof Array) {
    for (const item of items) {
      const foundItem = getMenuItemFromURL(item, url)
      if (foundItem) {
        return foundItem
      }
    }
  } else {
    if (items.url == url) return items
    return items.children && getMenuItemFromURL(items.children, url)
  }
}

export const findMenuItem = (menuItems: MenuItemType[] | undefined, menuItemKey: MenuItemType['key'] | undefined): MenuItemType | null => {
  if (menuItems && menuItemKey) {
    for (const item of menuItems) {
      if (item.key === menuItemKey) {
        return item
      }
      const found = findMenuItem(item.children, menuItemKey)
      if (found) return found
    }
  }
  return null
}
