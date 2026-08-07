import LogoBox from '@/components/LogoBox'
import SimplebarReactClient from '@/components/wrappers/SimplebarReactClient'
import { apiFetch } from '@/helpers/api'
import { useAuthStore } from '@/store/authStore'
import type { UserRole } from '@/types/auth'
import { useEffect, useState } from 'react'
import { getMenuItems } from '@/helpers/menu'
import HoverMenuToggle from './components/HoverMenuToggle'
import AppMenu from './components/AppMenu'

const VerticalNavigationBar = () => {
  const user = useAuthStore((state) => state.user)
  const token = useAuthStore((state) => state.token)
  const [hrModules, setHrModules] = useState<string[]>([])
  useEffect(() => {
    if (!token) return setHrModules([])
    apiFetch<{ data: { module: string; access: string }[] }>('/hr/permissions/me', { token })
      .then((response) => setHrModules(response.data.filter((item) => item.access !== 'none').map((item) => item.module)))
      .catch(() => setHrModules([]))
  }, [token])
  const menuItems = getMenuItems([user?.role, ...(user?.additionalRoles || []), ...(user?.accessTypes || [])].filter(Boolean) as UserRole[], hrModules)

  return (
    <div className="main-nav" id="leftside-menu-container">
      <LogoBox containerClassName="logo-box" squareLogo={{ className: 'logo-sm' }} textLogo={{ className: 'logo-lg' }} />

      <HoverMenuToggle />

      <SimplebarReactClient className="scrollbar">
        <AppMenu menuItems={menuItems} />
      </SimplebarReactClient>
    </div>
  )
}

export default VerticalNavigationBar
