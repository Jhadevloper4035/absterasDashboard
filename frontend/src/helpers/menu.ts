import { MENU_ITEMS } from '@/assets/data/menu-items'
import { BASIC_APP_MODULES, type AppModule, type ModulePermission } from '@/helpers/moduleAccess'
import type { MenuItemType } from '@/types/menu'

const HR_MENU_MODULES: Record<string, string> = {
  'hr-employees': 'employees', 'hr-departments': 'employees', 'hr-designations': 'employees',
  'hr-attendance': 'attendance', 'hr-attendance-reports': 'attendance', 'hr-holidays': 'attendance',
  'hr-leave': 'leave', 'hr-leave-requests': 'leave', 'hr-leave-approvals': 'leave', 'hr-leave-calendar': 'leave', 'hr-leave-types': 'leave',
  'hr-payroll': 'payroll', 'employee-overview': 'employees', 'employee-profile': 'employees', 'employee-attendance': 'attendance', 'employee-id-card': 'employees', 'employee-payslips': 'payroll', 'employee-leave': 'leave', 'employee-reimbursements': 'expenses', 'employee-advance': 'payroll', 'hr-expense-approvals': 'expenses', 'hr-reports': 'reports',
}
const INVENTORY_MENU_MODULES: Record<string, string> = { 'inventory-management': 'items', 'inventory-items': 'items', 'inventory-add-item': 'items', 'inventory-suppliers': 'items', 'inventory-purchases': 'transactions' }
const APP_MENU_MODULES: Record<string, AppModule> = { 'apps-todo': 'todo', notifications: 'notifications', leads: 'leads', tasks: 'tasks', 'events-management': 'events', 'hr-management': 'hr', 'employee-panel': 'hr', 'client-management': 'clients', 'inventory-management': 'inventory', 'return-management': 'returns' }
const hasInventoryAccess = (roles: string[], modules: string[], permissions: ModulePermission[], module?: string) => roles.some((role) => ['superadmin', 'admin'].includes(role)) || permissions.some((permission) => permission.module === 'inventory' && permission.access !== 'none') || Boolean(module && modules.includes(module))
const hasAppAccess = (roles: string[], permissions: ModulePermission[], workProfile: 'director' | 'employee' | undefined, module?: AppModule) => !module || BASIC_APP_MODULES.includes(module as (typeof BASIC_APP_MODULES)[number]) || (module !== 'hr' && roles.some((role) => ['superadmin', 'admin'].includes(role))) || (workProfile !== 'director' && permissions.some((permission) => permission.module === module && permission.access !== 'none'))
const isVisible = (item: MenuItemType, roles: string[] = [], hrModules: string[] = [], inventoryModules: string[] = [], modulePermissions: ModulePermission[] = [], workProfile?: 'director' | 'employee', parentModule?: AppModule) => {
  const module = APP_MENU_MODULES[item.key] || parentModule
  return (module ? hasAppAccess(roles, modulePermissions, workProfile, module) : !item.roles || roles.some((role) => item.roles?.includes(role))) && (!HR_MENU_MODULES[item.key] || hrModules.includes(HR_MENU_MODULES[item.key])) && (!INVENTORY_MENU_MODULES[item.key] || hasInventoryAccess(roles, inventoryModules, modulePermissions, INVENTORY_MENU_MODULES[item.key]))
}

const filterMenuItem = (item: MenuItemType, roles: string[] = [], hrModules: string[] = [], inventoryModules: string[] = [], modulePermissions: ModulePermission[] = [], workProfile?: 'director' | 'employee', parentModule?: AppModule): MenuItemType | null => {
  const module = APP_MENU_MODULES[item.key] || parentModule
  if (!isVisible(item, roles, hrModules, inventoryModules, modulePermissions, workProfile, parentModule)) return null

  const children = item.children?.map((child) => filterMenuItem(child, roles, hrModules, inventoryModules, modulePermissions, workProfile, module)).filter((child): child is MenuItemType => Boolean(child))
  if (item.children && !children?.length) return null

  return { ...item, children }
}

export const getMenuItems = (roles: string[] = [], hrModules: string[] = [], inventoryModules: string[] = [], modulePermissions: ModulePermission[] = [], workProfile?: 'director' | 'employee'): MenuItemType[] => {
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
