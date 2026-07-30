import { MENU_ITEMS } from '@/assets/data/menu-items'
import type { MenuItemType } from '@/types/menu'

const isVisible = (item: MenuItemType, role?: string) => !item.roles || item.roles.includes(role || '')

const filterMenuItem = (item: MenuItemType, role?: string): MenuItemType | null => {
  if (!isVisible(item, role)) return null

  const children = item.children?.map((child) => filterMenuItem(child, role)).filter((child): child is MenuItemType => Boolean(child))
  if (item.children && !children?.length) return null

  return { ...item, children }
}

export const getMenuItems = (role?: string): MenuItemType[] => {
  return MENU_ITEMS.map((item) => filterMenuItem(item, role)).filter((item): item is MenuItemType => Boolean(item))
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
