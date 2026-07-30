import { useEffect } from 'react'
import { Alert, Badge, Card, CardBody, Col, Row } from 'react-bootstrap'

import PageBreadcrumb from '@/components/layout/PageBreadcrumb'
import PageMetaData from '@/components/PageTitle'
import Spinner from '@/components/Spinner'
import IconifyIcon from '@/components/wrappers/IconifyIcon'
import { useUserManagementStore } from '@/store/userManagementStore'
import type { UserType } from '@/types/auth'

const roleBadge = (role: UserType['role']) => {
  if (role === 'superadmin') return 'danger'
  if (role === 'admin') return 'primary'
  return 'success'
}

const statusBadge = (status: UserType['status']) => {
  if (status === 'active') return 'success'
  if (status === 'suspended') return 'danger'
  if (status === 'invited') return 'warning'
  return 'secondary'
}

const initials = (name: string) =>
  name
    .split(' ')
    .map((part) => part[0])
    .join('')
    .slice(0, 2)
    .toUpperCase() || 'U'

const fallbackValues = (user: UserType, index: number) => {
  const cities = ['Ahmedabad, Gujarat', 'Mumbai, Maharashtra', 'Delhi NCR', 'Bengaluru, Karnataka']
  const teams = {
    superadmin: 'Executive Office',
    admin: 'CRM Administration',
    sales: 'Sales Team',
  }

  return {
    phone: `+91 ${9876500000 + index}`,
    location: cities[index % cities.length],
    team: teams[user.role],
  }
}

const UserCard = ({ user, index }: { user: UserType; index: number }) => {
  const fallback = fallbackValues(user, index)
  const phone = user.phone || fallback.phone
  const location = (user as UserType & { location?: string; city?: string }).location || (user as UserType & { city?: string }).city || fallback.location

  return (
    <Card className="h-100">
      <CardBody className="d-flex flex-column">
        <div className="text-center">
          <div
            className="rounded-circle bg-primary-subtle text-primary d-inline-flex align-items-center justify-content-center fw-semibold fs-22"
            style={{ width: 76, height: 76 }}>
            {initials(user.name)}
          </div>
          <h4 className="fs-18 mt-3 mb-1 text-truncate">{user.name}</h4>
          <div className="text-muted fs-13 text-truncate">{user.email}</div>
          <div className="d-flex flex-wrap justify-content-center gap-2 mt-3">
            <Badge bg={roleBadge(user.role)}>{user.role}</Badge>
            <Badge bg={statusBadge(user.status)}>{user.status}</Badge>
          </div>
        </div>

        <div className="border-top mt-4 pt-3 d-grid gap-3">
          <div className="d-flex align-items-center gap-2 text-muted fs-13">
            <IconifyIcon icon="bx:phone-call" className="fs-16 text-success" />
            <span>{phone}</span>
          </div>
          <div className="d-flex align-items-center gap-2 text-muted fs-13">
            <IconifyIcon icon="bx:location-plus" className="fs-16 text-danger" />
            <span>{location}</span>
          </div>
          <div className="d-flex align-items-center gap-2 text-muted fs-13">
            <IconifyIcon icon="bx:briefcase" className="fs-16 text-primary" />
            <span>{fallback.team}</span>
          </div>
          <div className="d-flex align-items-center gap-2 text-muted fs-13">
            <IconifyIcon icon="bx:time-five" className="fs-16" />
            <span>{user.timezone || 'UTC'}</span>
          </div>
        </div>
      </CardBody>
    </Card>
  )
}

const Contacts = () => {
  const users = useUserManagementStore((state) => state.users)
  const loading = useUserManagementStore((state) => state.loading)
  const error = useUserManagementStore((state) => state.error)
  const fetchUsers = useUserManagementStore((state) => state.fetchUsers)

  useEffect(() => {
    fetchUsers().catch(() => undefined)
  }, [fetchUsers])

  return (
    <>
      <PageBreadcrumb subName="Apps" title="Contacts" />
      <PageMetaData title="Contacts" />

      {error && <Alert variant="danger">{error}</Alert>}

      {loading && !users.length ? (
        <div className="text-center py-5">
          <Spinner className="spinner-border-sm me-2" tag="span" />
          <span className="text-muted">Loading users...</span>
        </div>
      ) : (
        <Row className="row-cols-1 row-cols-md-2 row-cols-xl-3 g-3">
          {users.map((user, index) => (
            <Col key={user._id}>
              <UserCard user={user} index={index} />
            </Col>
          ))}
        </Row>
      )}

      {!loading && !users.length && !error && (
        <Card>
          <CardBody className="text-center text-muted py-5">No users found</CardBody>
        </Card>
      )}
    </>
  )
}

export default Contacts
