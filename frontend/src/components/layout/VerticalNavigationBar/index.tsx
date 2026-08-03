import LogoBox from '@/components/LogoBox'
import SimplebarReactClient from '@/components/wrappers/SimplebarReactClient'
import { useAuthStore } from '@/store/authStore'
import { getMenuItems } from '@/helpers/menu'
import HoverMenuToggle from './components/HoverMenuToggle'
import AppMenu from './components/AppMenu'

const VerticalNavigationBar = () => {
  const role = useAuthStore((state) => state.user?.role)
  const menuItems = getMenuItems(role)

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
