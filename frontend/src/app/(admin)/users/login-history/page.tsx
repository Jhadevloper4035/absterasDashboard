import PageMetaData from '@/components/PageTitle'
import Spinner from '@/components/Spinner'
import { apiFetch } from '@/helpers/api'
import { useUserManagementStore } from '@/store/userManagementStore'
import type { UserType } from '@/types/auth'
import { useEffect, useMemo, useState } from 'react'
import { Alert, Badge, Button, Card, CardBody, Col, Form, Row, Table } from 'react-bootstrap'
import { toast } from 'react-toastify'

type LoginHistoryItem = {
  _id: string
  user?: Pick<UserType, '_id' | 'name' | 'email' | 'role' | 'status'>
  email: string
  role: UserType['role']
  ipAddress?: string
  userAgent?: string
  loggedInAt: string
  logoutAt?: string
  logoutReason?: 'logout' | 'new_login'
}

type PageMeta = { page: number; limit: number; total: number; totalPages: number }

const roleVariant = (role: UserType['role']) => {
  if (role === 'superadmin') return 'danger'
  if (role === 'admin') return 'primary'
  if (role === 'operations') return 'info'
  if (role === 'accounts') return 'warning'
  if (role === 'designers') return 'secondary'
  return 'success'
}

const timezone = Intl.DateTimeFormat().resolvedOptions().timeZone

const formatDateTime = (value: string) => {
  const date = new Date(value)
  return {
    date: new Intl.DateTimeFormat(undefined, {
      weekday: 'short',
      day: '2-digit',
      month: 'short',
      year: 'numeric',
    }).format(date),
    time: new Intl.DateTimeFormat(undefined, {
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
      hour12: true,
      timeZoneName: 'short',
    }).format(date),
  }
}

const DateTimeBlock = ({ value, variant = 'primary' }: { value: string; variant?: 'primary' | 'secondary' }) => {
  const item = formatDateTime(value)
  return (
    <div className={`border-start border-3 border-${variant} ps-2`}>
      <div className={`fw-bold text-${variant} text-nowrap`}>{item.time}</div>
      <div className="text-muted fs-13 text-nowrap">{item.date}</div>
    </div>
  )
}

const browserLabel = (userAgent = '') => {
  const browser = userAgent.includes('Edg/')
    ? 'Microsoft Edge'
    : userAgent.includes('Chrome/')
      ? 'Google Chrome'
      : userAgent.includes('Firefox/')
        ? 'Mozilla Firefox'
        : userAgent.includes('Safari/')
          ? 'Safari'
          : 'Unknown browser'
  const os = userAgent.includes('Windows') ? 'Windows' : userAgent.includes('Mac OS') ? 'macOS' : userAgent.includes('Android') ? 'Android' : userAgent.includes('iPhone') ? 'iPhone' : 'Unknown device'
  return `${browser} on ${os}`
}

const cleanIpAddress = (value = '') => value.match(/(?:\d{1,3}\.){3}\d{1,3}/)?.[0] || value || '-'

const logoutText = (item: LoginHistoryItem) => {
  if (!item.logoutAt) return 'Currently logged in'
  return item.logoutReason === 'new_login' ? 'Closed by new login' : 'Logged out'
}

const UserLoginHistoryPage = () => {
  const users = useUserManagementStore((state) => state.users)
  const fetchUsers = useUserManagementStore((state) => state.fetchUsers)
  const [selectedUserId, setSelectedUserId] = useState('')
  const [history, setHistory] = useState<LoginHistoryItem[]>([])
  const [meta, setMeta] = useState<PageMeta>({ page: 1, limit: 25, total: 0, totalPages: 1 })
  const [page, setPage] = useState(1)
  const [loading, setLoading] = useState(false)
  const [loggingOutUserId, setLoggingOutUserId] = useState('')
  const [error, setError] = useState('')

  const userOptions = useMemo(() => [...users].sort((a, b) => a.name.localeCompare(b.name)), [users])
  const currentCount = history.filter((item) => !item.logoutAt).length
  const selectedUserName = selectedUserId ? userOptions.find((item) => item._id === selectedUserId)?.name || 'Selected user' : 'All users'

  useEffect(() => {
    fetchUsers('?limit=100').catch((e) => setError(e instanceof Error ? e.message : 'Unable to load users'))
  }, [fetchUsers])

  const loadHistory = async () => {
    setLoading(true)
    setError('')
    try {
      const query = new URLSearchParams({ page: String(page), limit: '25' })
      if (selectedUserId) query.set('userId', selectedUserId)
      const res = await apiFetch<{ data: LoginHistoryItem[]; meta?: PageMeta }>(`/users/login-history?${query}`)
      setHistory(res.data)
      setMeta(res.meta || { page, limit: res.data.length, total: res.data.length, totalPages: 1 })
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Unable to load login history')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    loadHistory()
  }, [page, selectedUserId])

  useEffect(() => {
    setPage(1)
  }, [selectedUserId])

  const logoutUser = async (item: LoginHistoryItem) => {
    const userId = item.user?._id
    if (!userId || item.logoutAt) return

    setLoggingOutUserId(userId)
    setError('')
    try {
      await apiFetch(`/users/${userId}/logout`, { method: 'POST' })
      toast.success(`${item.user?.name || item.email} logged out`)
      await loadHistory()
    } catch (e) {
      const message = e instanceof Error ? e.message : 'Unable to logout user'
      setError(message)
      toast.error(message)
    } finally {
      setLoggingOutUserId('')
    }
  }

  return (
    <>
      <PageMetaData title="User Login History" />
      <Card>
        <CardBody>
          <Row className="align-items-end g-3 mb-4">
            <Col lg={7}>
              <h4 className="card-title mb-1">User Login History</h4>
              <p className="text-muted mb-2">
                Showing exact local date and time in <span className="fw-semibold">{timezone}</span>.
              </p>
              <div className="d-flex flex-wrap gap-2">
                <Badge bg="success-subtle" text="success" className="border border-success-subtle px-3 py-2">
                  {currentCount} currently online
                </Badge>
                <Badge bg="primary-subtle" text="primary" className="border border-primary-subtle px-3 py-2">
                  {meta.total} records
                </Badge>
                <Badge bg="secondary-subtle" text="body" className="border px-3 py-2">
                  {selectedUserName}
                </Badge>
              </div>
            </Col>
            <Col lg={5}>
              <Form.Label>User</Form.Label>
              <Form.Select value={selectedUserId} onChange={(event) => setSelectedUserId(event.target.value)}>
                <option value="">All users</option>
                {userOptions.map((item) => (
                  <option key={item._id} value={item._id}>
                    {item.name} - {item.role}
                  </option>
                ))}
              </Form.Select>
            </Col>
          </Row>

          {error && <Alert variant="danger">{error}</Alert>}

          <div className="table-responsive rounded border" style={{ maxHeight: '62vh', overflow: 'auto' }}>
            <Table hover className="align-middle mb-0" style={{ minWidth: 1040 }}>
              <thead className="table-light position-sticky top-0" style={{ zIndex: 1 }}>
                <tr>
                  <th style={{ width: '22%' }}>User</th>
                  <th style={{ width: '12%' }}>Role</th>
                  <th style={{ width: '17%' }}>Login</th>
                  <th style={{ width: '17%' }}>Logout</th>
                  <th style={{ width: '12%' }}>IP Address</th>
                  <th style={{ width: '14%' }}>Device</th>
                  <th style={{ width: '6%' }} className="text-end">Action</th>
                </tr>
              </thead>
              <tbody>
                {loading && (
                  <tr>
                    <td colSpan={7} className="text-center py-5">
                      <Spinner className="spinner-border-sm me-2" tag="span" />
                      <span className="text-muted">Loading history...</span>
                    </td>
                  </tr>
                )}
                {!loading &&
                  history.map((item) => (
                    <tr key={item._id}>
                      <td>
                        <div className="fw-medium">{item.user?.name || item.email}</div>
                        <div className="text-muted fs-13">{item.user?.email || item.email}</div>
                      </td>
                      <td>
                        <Badge bg={roleVariant(item.role)} className="mb-1">
                          {item.role}
                        </Badge>
                        <div>
                          <Badge bg={item.logoutAt ? 'secondary' : 'success'}>{item.logoutAt ? 'Logged out' : 'Current'}</Badge>
                        </div>
                      </td>
                      <td>
                        <DateTimeBlock value={item.loggedInAt} />
                      </td>
                      <td>
                        {item.logoutAt ? (
                          <>
                            <DateTimeBlock value={item.logoutAt} variant="secondary" />
                            {item.logoutReason === 'new_login' && <div className="text-muted fs-13 mt-1">Closed by new login</div>}
                          </>
                        ) : (
                          <Badge bg="success-subtle" text="success" className="border border-success-subtle px-3 py-2 text-wrap" style={{ maxWidth: 150 }}>
                            {logoutText(item)}
                          </Badge>
                        )}
                      </td>
                      <td>
                        <span className="badge bg-dark-subtle text-body border font-monospace px-2 py-1">{cleanIpAddress(item.ipAddress)}</span>
                      </td>
                      <td style={{ maxWidth: 220 }}>
                        <div className="fw-semibold text-truncate" title={item.userAgent || browserLabel(item.userAgent)}>
                          {browserLabel(item.userAgent)}
                        </div>
                      </td>
                      <td className="text-end">
                        {!item.logoutAt && (
                          <Button size="sm" variant="outline-danger" className="text-nowrap" disabled={loggingOutUserId === item.user?._id} onClick={() => logoutUser(item)}>
                            {loggingOutUserId === item.user?._id ? 'Logging out...' : 'Logout'}
                          </Button>
                        )}
                      </td>
                    </tr>
                  ))}
                {!loading && !history.length && (
                  <tr>
                    <td colSpan={7} className="text-center text-muted py-4">
                      No login history found
                    </td>
                  </tr>
                )}
              </tbody>
            </Table>
          </div>
          <div className="d-flex justify-content-between align-items-center gap-2 flex-wrap mt-3">
            <span className="text-muted fs-13">
              Showing page {meta.page} of {meta.totalPages}
            </span>
            <div className="d-flex gap-2">
              <Button size="sm" variant="outline-secondary" disabled={loading || page <= 1} onClick={() => setPage((value) => Math.max(value - 1, 1))}>
                Previous
              </Button>
              <Button size="sm" variant="outline-secondary" disabled={loading || page >= meta.totalPages} onClick={() => setPage((value) => value + 1)}>
                Next
              </Button>
            </div>
          </div>
        </CardBody>
      </Card>
    </>
  )
}

export default UserLoginHistoryPage
