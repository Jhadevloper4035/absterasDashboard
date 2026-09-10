import { Link } from 'react-router-dom'
import { Dropdown, DropdownDivider, DropdownHeader, DropdownItem, DropdownMenu, DropdownToggle } from 'react-bootstrap'

import IconifyIcon from '@/components/wrappers/IconifyIcon'
import { useAuthContext } from '@/context/useAuthContext'

import avatar1 from '@/assets/images/users/avatar-1.jpg'

const ProfileDropdown = () => {
  const { removeSession, user } = useAuthContext()
  const isEmployee = user?.workProfile === 'employee' || (!user?.workProfile && user?.accessTypes?.includes('employee'))
  const profileLink = isEmployee ? '/hr/my-profile' : '/pages/profile'

  return (
    <Dropdown className="topbar-item" align={'end'}>
      <DropdownToggle
        as="button"
        type="button"
        className="topbar-button content-none"
        id="page-header-user-dropdown"
        data-bs-toggle="dropdown"
        aria-haspopup="true"
        aria-expanded="false">
        <span className="d-flex align-items-center">
          <img className="rounded-circle" width={32} height={32} src={avatar1} alt="avatar-3" />
        </span>
      </DropdownToggle>
      <DropdownMenu>
        <DropdownHeader as="h6">Welcome {user?.name || 'User'}!</DropdownHeader>
        <DropdownItem as={Link} to={profileLink}>
          <IconifyIcon icon="bx:user-circle" className="text-muted fs-18 align-middle me-1" />
          <span className="align-middle">Profile</span>
        </DropdownItem>
        {isEmployee && <DropdownItem as={Link} to="/hr/advances">
          <IconifyIcon icon="bx:wallet" className="text-muted fs-18 align-middle me-1" />
          <span className="align-middle">Salary Advances</span>
        </DropdownItem>}
        <DropdownItem as={Link} to="/pages/faqs">
          <IconifyIcon icon="bx:help-circle" className="text-muted fs-18 align-middle me-1" />
          <span className="align-middle">Help</span>
        </DropdownItem>
        <DropdownItem as={Link} to="/auth/lock-screen">
          <IconifyIcon icon="bx:lock" className="text-muted fs-18 align-middle me-1" />
          <span className="align-middle">Lock screen</span>
        </DropdownItem>
        <DropdownDivider className="dropdown-divider my-1" />
        <DropdownItem as="button" type="button" className="text-danger" onClick={() => void removeSession()}>
          <IconifyIcon icon="bx:log-out" className="fs-18 align-middle me-1" />
          <span className="align-middle">Logout</span>
        </DropdownItem>
      </DropdownMenu>
    </Dropdown>
  )
}

export default ProfileDropdown
