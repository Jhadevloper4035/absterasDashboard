import { createContext, useContext, useCallback, useEffect, useMemo, useState } from 'react'

import useLocalStorage from '@/hooks/useLocalStorage'
import useQueryParams from '@/hooks/useQueryParams'
import type { ChildrenType } from '@/types/component-props'
import type { LayoutState, LayoutType, MenuType, OffcanvasControlType, LayoutOffcanvasStatesType } from '@/types/context'
import { toggleDocumentAttribute } from '@/utils/layout'

const ThemeContext = createContext<LayoutType | undefined>(undefined)

const useLayoutContext = () => {
  const context = useContext(ThemeContext)
  if (!context) {
    throw new Error('useLayoutContext can only be used within LayoutProvider')
  }
  return context
}

const LayoutProvider = ({ children }: ChildrenType) => {
  const queryParams = useQueryParams()

  const INIT_STATE: LayoutState = {
    theme: 'dark',
    topbarTheme: 'dark',
    menu: {
      theme: 'dark',
      size: queryParams['menu_size'] ? (queryParams['menu_size'] as MenuType['size']) : 'sm-hover-active',
    },
  }

  const [settings, setSettings] = useLocalStorage<LayoutState>('__REBACK_NEXT_CONFIG__', INIT_STATE, true)
  const [offcanvasStates, setOffcanvasStates] = useState<LayoutOffcanvasStatesType>({
    showActivityStream: false,
    showBackdrop: false,
  })

  const updateSettings = (newSettings: Partial<LayoutState>) => setSettings({ ...settings, ...newSettings, theme: 'dark', topbarTheme: 'dark', menu: { ...settings.menu, ...newSettings.menu, theme: 'dark' } })

  // change menu theme
  const changeMenuSize = (newSize: MenuType['size']) => {
    updateSettings({ menu: { ...settings.menu, size: newSize } })
  }

  // toggle activity stream offcanvas
  const toggleActivityStream: OffcanvasControlType['toggle'] = () => {
    setOffcanvasStates({ ...offcanvasStates, showActivityStream: !offcanvasStates.showActivityStream })
  }

  const activityStream: LayoutType['activityStream'] = {
    open: offcanvasStates.showActivityStream,
    toggle: toggleActivityStream,
  }

  // toggle backdrop
  const toggleBackdrop = useCallback(() => {
    const htmlTag = document.getElementsByTagName('html')[0]
    if (offcanvasStates.showBackdrop) htmlTag.classList.remove('sidebar-enable')
    else htmlTag.classList.add('sidebar-enable')
    setOffcanvasStates({ ...offcanvasStates, showBackdrop: !offcanvasStates.showBackdrop })
  }, [offcanvasStates.showBackdrop])


  useEffect(() => {
    toggleDocumentAttribute('data-bs-theme', settings.theme)
    toggleDocumentAttribute('data-topbar-color', settings.topbarTheme)
    toggleDocumentAttribute('data-menu-color', settings.menu.theme)
    toggleDocumentAttribute('data-menu-size', settings.menu.size)
    return () => {
      toggleDocumentAttribute('data-bs-theme', settings.theme, true)
      toggleDocumentAttribute('data-topbar-color', settings.topbarTheme, true)
      toggleDocumentAttribute('data-menu-color', settings.menu.theme, true)
      toggleDocumentAttribute('data-menu-size', settings.menu.size, true)
    }
  }, [settings])

  const resetSettings = () => updateSettings(INIT_STATE)

  return (
    <ThemeContext.Provider
      value={useMemo(
        () => ({
          ...settings,
          themeMode: settings.theme,
          changeMenu: {
            size: changeMenuSize,
          },
          activityStream,
          toggleBackdrop,
          resetSettings,
        }),
        [settings, offcanvasStates],
      )}>
      {children}
      {offcanvasStates.showBackdrop && <div className="offcanvas-backdrop fade show" onClick={toggleBackdrop} />}
    </ThemeContext.Provider>
  )
}

export { LayoutProvider, useLayoutContext }
