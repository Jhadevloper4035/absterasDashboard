import { MENU_ITEMS } from '@/assets/data/menu-items'
import type { MenuItemType } from '@/types/menu'

const HR_MENU_MODULES: Record<string, string> = {
  'hr-employees': 'employees', 'hr-departments': 'employees', 'hr-designations': 'employees',
  'hr-attendance': 'attendance', 'hr-attendance-reports': 'attendance', 'hr-holidays': 'attendance',
  'hr-leave': 'leave', 'hr-leave-requests': 'leave', 'hr-leave-approvals': 'leave', 'hr-leave-calendar': 'leave', 'hr-leave-types': 'leave',
  'hr-payroll': 'payroll', 'employee-reimbursements': 'expenses', 'hr-expense-approvals': 'expenses', 'hr-reports': 'reports',
}
const isVisible = (item: MenuItemType, roles: string[] = [], hrModules: string[] = []) => (!item.roles || roles.some((role) => item.roles?.includes(role))) && (!HR_MENU_MODULES[item.key] || hrModules.includes(HR_MENU_MODULES[item.key]))

const filterMenuItem = (item: MenuItemType, roles: string[] = [], hrModules: string[] = []): MenuItemType | null => {
  if (!isVisible(item, roles, hrModules)) return null

  const children = item.children?.map((child) => filterMenuItem(child, roles, hrModules)).filter((child): child is MenuItemType => Boolean(child))
  if (item.children && !children?.length) return null

  return { ...item, children }
}

export const getMenuItems = (roles: string[] = [], hrModules: string[] = []): MenuItemType[] => {
  return MENU_ITEMS.map((item) => filterMenuItem(item, roles, hrModules)).filter((item): item is MenuItemType => Boolean(item))
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
    if (items.children != null) {
      for (const item of items.children) {
        if (item.url == url) return item
      }
    }
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
