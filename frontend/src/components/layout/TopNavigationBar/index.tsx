import { lazy } from 'react'
import { Suspense } from 'react'

import ActivityStreamToggle from './components/ActivityStreamToggle'
import LeftSideBarToggle from './components/LeftSideBarToggle'
import ProfileDropdown from './components/ProfileDropdown'
import SearchBox from './components/SearchBox'
import ThemeCustomizerToggle from './components/ThemeCustomizerToggle'
import ThemeModeToggle from './components/ThemeModeToggle'

const AppsDropdown = lazy(() => import('./components/AppsDropdown'))
const Notifications = lazy(() => import('./components/Notifications'))

const TopNavigationBar = () => {
  return (
    <header className="topbar">
      <div className="container-xxl">
        <div className="navbar-header">
          <div className="d-flex align-items-center gap-2">
            <LeftSideBarToggle />

            <SearchBox />
          </div>
          <div className="d-flex align-items-center gap-1">
            {/* Toggle Theme Mode */}
            <ThemeModeToggle />

            {/* Apps Dropdown */}
            <Suspense>
              <AppsDropdown />
            </Suspense>

            {/* Notification Dropdown */}
            <Suspense>
              <Notifications />
            </Suspense>

            {/* Toggle for Theme Customizer */}
            <ThemeCustomizerToggle />

            {/* Toggle for Activity Stream */}
            <ActivityStreamToggle />

            {/* Admin Profile Dropdown */}
            <ProfileDropdown />
          </div>
        </div>
      </div>
    </header>
  )
}

export default TopNavigationBar
