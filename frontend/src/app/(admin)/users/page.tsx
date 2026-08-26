import PageMetaData from '@/components/PageTitle'
import Spinner from '@/components/Spinner'
import IconifyIcon from '@/components/wrappers/IconifyIcon'
import { useAuthContext } from '@/context/useAuthContext'
import { apiFetch } from '@/helpers/api'
import { BASIC_APP_MODULES, moduleLabel } from '@/helpers/moduleAccess'
import { useUserManagementStore } from '@/store/userManagementStore'
import type { UserType } from '@/types/auth'
import { FormEvent, useEffect, useState } from 'react'
import { Alert, Badge, Button, Card, CardBody, Col, Form, InputGroup, Modal, Row, Table } from 'react-bootstrap'
import ReactSelect from 'react-select'
import { useNavigate } from 'react-router-dom'
import Swal from 'sweetalert2'

const teamRoles: UserType['role'][] = ['sales', 'operations', 'accounts', 'designers']
const accessTypes = ['admin', ...teamRoles]
const statuses = ['active', 'inactive', 'invited', 'suspended'] as const
const singleUserRoles = ['superadmin', 'admin'] as const
const hrModules = ['employees', 'attendance', 'leave', 'payroll', 'expenses', 'reports']
type HrAccess = 'none' | 'view' | 'manage'
type HrPermission = { module: string; access: HrAccess }
const defaultHrPermissions = () => hrModules.map((module) => ({ module, access: 'none' as HrAccess }))
const hrLabel = (module: string) => module.replace(/\b\w/g, (letter) => letter.toUpperCase())
const joinedDate = (value?: string) => value ? new Intl.DateTimeFormat(undefined, { dateStyle: 'medium' }).format(new Date(value)) : '—'

const statusBadge = (status: UserType['status']) => {
  if (status === 'active') return 'success'
  if (status === 'suspended') return 'danger'
  if (status === 'invited') return 'warning'
  return 'secondary'
}

const workProfileLabel = (user: UserType) => user.workProfile === 'employee' || (!user.workProfile && user.accessTypes?.includes('employee')) ? 'Employee' : 'Director'
const sidebarPermissions = (user: UserType) => [
  ...BASIC_APP_MODULES.map((module) => ({ module, access: 'manage' as const })),
  ...(user.modulePermissions || []).filter((permission) => !BASIC_APP_MODULES.includes(permission.module as (typeof BASIC_APP_MODULES)[number]) && permission.access !== 'none'),
]

const emptyEditForm = {
  name: '',
  email: '',
  phone: '',
  role: 'sales' as UserType['role'],
  accessTypes: [] as string[],
  status: 'active' as UserType['status'],
  timezone: 'UTC',
  password: '',
}

const UsersPage = () => {
  const { user } = useAuthContext()
  const navigate = useNavigate()
  const users = useUserManagementStore((state) => state.users)
  const meta = useUserManagementStore((state) => state.meta)
  const loading = useUserManagementStore((state) => state.loading)
  const storeError = useUserManagementStore((state) => state.error)
  const clearUsers = useUserManagementStore((state) => state.clearUsers)
  const fetchUsers = useUserManagementStore((state) => state.fetchUsers)
  const updateUserInStore = useUserManagementStore((state) => state.updateUser)
  const deleteUserInStore = useUserManagementStore((state) => state.deleteUser)
  const [editingUser, setEditingUser] = useState<UserType | null>(null)
  const [editForm, setEditForm] = useState(emptyEditForm)
  const [editError, setEditError] = useState('')
  const [visiblePassword, setVisiblePassword] = useState(false)
  const [hrPermissions, setHrPermissions] = useState<HrPermission[]>(defaultHrPermissions)
  const [loadingHrPermissions, setLoadingHrPermissions] = useState(false)
  const [message, setMessage] = useState('')
  const [error, setError] = useState('')
  const [page, setPage] = useState(1)
  const [filters, setFilters] = useState({ q: '', status: '' })
  const currentAccessTypes = [user?.role, ...(user?.additionalRoles || []), ...(user?.accessTypes || [])]
  const isSuperadmin = currentAccessTypes.includes('superadmin')
  const canManageUsers = isSuperadmin || currentAccessTypes.includes('admin')
  const canManageProfile = (profile: UserType) => isSuperadmin || ![profile.role, ...(profile.additionalRoles || []), ...(profile.accessTypes || [])].includes('superadmin') && ![profile.role, ...(profile.additionalRoles || []), ...(profile.accessTypes || [])].includes('admin')
  useEffect(() => {
    const query = new URLSearchParams({ page: String(page), limit: '25' })
    if (filters.q.trim()) query.set('q', filters.q.trim())
    if (filters.status) query.set('status', filters.status)

    if (canManageUsers) fetchUsers(`?${query}`).catch((e) => setError(e instanceof Error ? e.message : 'Unable to load users'))
    else clearUsers()
  }, [canManageUsers, clearUsers, fetchUsers, filters.q, filters.status, page])

  useEffect(() => {
    setPage(1)
  }, [filters.q, filters.status])

  useEffect(() => {
    if (!editingUser || singleUserRoles.includes(editingUser.role as (typeof singleUserRoles)[number])) return
    setLoadingHrPermissions(true)
    apiFetch<{ data: HrPermission[] }>(`/hr/permissions/${editingUser._id}`)
      .then((response) => setHrPermissions(response.data))
      .catch((reason) => setEditError(reason instanceof Error ? reason.message : 'Unable to load HR access'))
      .finally(() => setLoadingHrPermissions(false))
  }, [editingUser])

  const updateUser = async (id: string, patch: Partial<UserType> & { password?: string }) => {
    setError('')
    setMessage('')

    try {
      await updateUserInStore(id, patch)
      setMessage('User updated')
      return true
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Unable to update user')
      return false
    }
  }

  const deleteUser = async (item: UserType) => {
    const hardDelete = import.meta.env.DEV
    const confirmation = await Swal.fire({
      icon: 'warning',
      title: `Delete ${item.name}?`,
      text: hardDelete ? 'This permanently removes the development account. It cannot be undone.' : 'This deactivates the account, signs the user out, and keeps their history.',
      showCancelButton: true,
      confirmButtonColor: '#dc3545',
      confirmButtonText: 'Delete user',
      cancelButtonText: 'Keep user',
      reverseButtons: true,
    })
    if (!confirmation.isConfirmed) return
    setError('')
    setMessage('')
    try {
      await deleteUserInStore(item._id, hardDelete)
      setMessage(hardDelete ? 'User permanently deleted' : 'User deleted')
      await Swal.fire({ icon: 'success', title: hardDelete ? 'User permanently deleted' : 'User deleted', text: hardDelete ? `${item.name} was removed from development.` : `${item.name} can no longer sign in.`, timer: 1800, showConfirmButton: false })
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Unable to delete user')
    }
  }

  const openEdit = (item: UserType) => {
    navigate(`/users/${item._id}/edit`)
  }

  const closeEdit = () => {
    setEditingUser(null)
    setEditForm(emptyEditForm)
    setEditError('')
    setVisiblePassword(false)
    setHrPermissions(defaultHrPermissions())
  }

  const saveEdit = async (event: FormEvent) => {
    event.preventDefault()
    if (!editingUser) return
    setEditError('')

    const name = editForm.name.trim()
    const email = editForm.email.trim()
    const phone = editForm.phone.trim()

    if (!name) {
      setEditError('Enter a user name')
      return
    }

    if (!email) {
      setEditError('Enter a user email')
      return
    }

    if (!phone) {
      setEditError('Enter a mobile number')
      return
    }

    const patch: Partial<UserType> & { password?: string } = {
      name,
      email,
      phone,
      status: editForm.status,
      timezone: editForm.timezone.trim() || 'UTC',
    }

    patch.accessTypes = editForm.accessTypes
    if (editForm.password.trim()) {
      if (editForm.password.length < 8 || !/[a-z]/i.test(editForm.password) || !/\d/.test(editForm.password)) {
        setEditError('Password must be at least 8 characters and include letters and numbers')
        return
      }
      patch.password = editForm.password.trim()
    }

    if (await updateUser(editingUser._id, patch)) {
      try {
        if (!singleUserRoles.includes(editingUser.role as (typeof singleUserRoles)[number])) {
          await apiFetch(`/hr/permissions/${editingUser._id}`, { method: 'PUT', body: JSON.stringify({ permissions: hrPermissions }) })
        }
        closeEdit()
      } catch (reason) {
        setEditError(reason instanceof Error ? reason.message : 'User updated, but HR access could not be saved')
      }
    } else {
      setEditError(useUserManagementStore.getState().error || 'Unable to update user')
    }
  }

  if (!canManageUsers) {
    return (
      <>
        <PageMetaData title="Users" />
        <Alert variant="warning">Only administrators can manage users.</Alert>
      </>
    )
  }

  const accessTypeOptions = [...new Set([...accessTypes, ...users.flatMap((item) => [item.role, ...(item.additionalRoles || []), ...(item.accessTypes || [])]), ...editForm.accessTypes])].filter((type) => type !== 'superadmin' && type !== 'hr-management' && type !== 'employee' && (isSuperadmin || type !== 'admin')).map((type) => ({ value: type, label: type.replace(/-/g, ' ').replace(/\b\w/g, (letter) => letter.toUpperCase()) }))

  return (
    <>
      <PageMetaData title="Users" />
      <Card>
        <CardBody>
          <div className="d-flex flex-wrap justify-content-between align-items-start gap-2 mb-3"><div><h4 className="card-title mb-1">User Profiles & Access</h4><p className="text-muted mb-0">System role, work profile, and sidebar access in one place.</p></div><Badge bg="light" text="dark">{meta.total} users</Badge></div>
          {(error || storeError) && <Alert variant="danger">{error || storeError}</Alert>}
          {message && <Alert variant="success">{message}</Alert>}
          <div className="d-flex gap-2 flex-wrap mb-3">
            <Form.Control style={{ flex: '1 1 260px' }} placeholder="Search name, email, mobile" value={filters.q} onChange={(event) => setFilters({ ...filters, q: event.target.value })} />
            <Form.Select style={{ flex: '0 1 180px' }} value={filters.status} onChange={(event) => setFilters({ ...filters, status: event.target.value })}>
              <option value="">All status</option>
              {statuses.map((status) => (
                <option key={status}>{status}</option>
              ))}
            </Form.Select>
          </div>
          <div className="table-responsive">
            <Table className="align-middle mb-0" style={{ minWidth: 1200 }}>
              <thead>
                <tr>
                  <th style={{ minWidth: 260 }}>User</th>
                  <th style={{ minWidth: 130 }}>Work profile</th>
                  <th style={{ minWidth: 260 }}>Sidebar access</th>
                  <th style={{ minWidth: 150 }}>Account</th>
                  <th style={{ minWidth: 150 }}>Activity</th>
                  <th style={{ minWidth: 280 }} className="text-end">
                    Actions
                  </th>
                </tr>
              </thead>
              <tbody>
                {loading && !users.length && (
                  <tr>
                    <td colSpan={6} className="text-center py-5">
                      <Spinner className="spinner-border-sm me-2" tag="span" />
                      <span className="text-muted">Loading data...</span>
                    </td>
                  </tr>
                )}
                {users.map((item) => (
                  <tr key={item._id}>
                    <td>
                      <div className="fw-medium">{item.name}</div>
                      <div className="fs-13">{item.email}</div>
                      <div className="text-muted fs-13">{item.phone || 'Mobile not added'}</div>
                    </td>
                    <td><Badge bg={workProfileLabel(item) === 'Employee' ? 'success' : 'secondary'}>{workProfileLabel(item)}</Badge></td>
                    <td>
                      {[item.role, ...(item.additionalRoles || [])].some((role) => role === 'superadmin' || role === 'admin') ? (
                        <Badge bg="primary">{workProfileLabel(item) === 'Director' ? 'All except HR Management' : 'All sidebar tabs'}</Badge>
                      ) : (
                        <div className="d-flex flex-wrap gap-1">
                          {sidebarPermissions(item).map((permission) => <Badge bg={permission.access === 'manage' ? 'primary' : 'light'} text={permission.access === 'manage' ? undefined : 'dark'} key={permission.module}>{moduleLabel(permission.module)} · {permission.access}</Badge>)}
                        </div>
                      )}
                    </td>
                    <td>
                      <Badge bg={statusBadge(item.status)}>{item.status}</Badge>
                      <div className="text-muted fs-12 mt-1">{item.timezone || 'UTC'}</div>
                    </td>
                    <td>
                      <div className="fs-13">Joined {joinedDate(item.createdAt)}</div>
                      <div className="text-muted fs-12">Updated {joinedDate(item.updatedAt)}</div>
                    </td>
                    <td className="text-end" style={{ minWidth: 280 }}>
                      {canManageProfile(item) ? (
                        <div className="d-inline-flex align-items-center gap-2 flex-nowrap">
                          <Button size="sm" variant="outline-primary" type="button" className="text-nowrap" onClick={() => openEdit(item)}><IconifyIcon icon="bx:edit" className="me-1" />Edit</Button>
                          <Button size="sm" variant={item.status === 'suspended' ? 'outline-success' : 'outline-danger'} type="button" className="text-nowrap" onClick={() => updateUser(item._id, { status: item.status === 'suspended' ? 'active' : 'suspended' })}><IconifyIcon icon={item.status === 'suspended' ? 'bx:lock-open' : 'bx:lock'} className="me-1" />{item.status === 'suspended' ? 'Unlock' : 'Lock'}</Button>
                          {item._id !== user?._id && <Button size="sm" variant="outline-danger" type="button" className="text-nowrap" onClick={() => deleteUser(item)}><IconifyIcon icon="bx:trash" className="me-1" />Delete</Button>}
                        </div>
                      ) : <Badge bg="light" text="dark">Superadmin protected</Badge>}
                    </td>
                  </tr>
                ))}
                {!users.length && !loading && (
                  <tr>
                    <td colSpan={6} className="text-center text-muted py-4">
                      No users found
                    </td>
                  </tr>
                )}
              </tbody>
            </Table>
          </div>
          <div className="d-flex justify-content-between align-items-center gap-2 flex-wrap mt-3">
            <span className="text-muted fs-13">
              Showing page {meta.page} of {meta.totalPages} · {meta.total} users
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

      <Modal show={Boolean(editingUser)} onHide={closeEdit} centered size="xl">
        <Form onSubmit={saveEdit}>
          <Modal.Header closeButton>
            <Modal.Title>Edit User Information</Modal.Title>
          </Modal.Header>
          <Modal.Body>
            {editError && <Alert variant="danger">{editError}</Alert>}
            <h5 className="mb-3">Account details</h5>
            <Row className="g-3">
              <Col xl={6}><Form.Group><Form.Label>Name</Form.Label><Form.Control required value={editForm.name} onChange={(event) => setEditForm({ ...editForm, name: event.target.value })} placeholder="Full name" /></Form.Group></Col>
              <Col xl={6}><Form.Group><Form.Label>Email</Form.Label><Form.Control required type="email" value={editForm.email} onChange={(event) => setEditForm({ ...editForm, email: event.target.value })} placeholder="name@company.com" /></Form.Group></Col>
              <Col xl={6}><Form.Group><Form.Label>Mobile Number</Form.Label><Form.Control required type="tel" inputMode="tel" value={editForm.phone} onChange={(event) => setEditForm({ ...editForm, phone: event.target.value })} placeholder="10-digit mobile number" /></Form.Group></Col>
              <Col xl={6}><Form.Group><Form.Label>New Password <span className="text-muted">(optional)</span></Form.Label><InputGroup><Form.Control type={visiblePassword ? 'text' : 'password'} minLength={8} value={editForm.password} onChange={(event) => setEditForm({ ...editForm, password: event.target.value })} placeholder="Leave blank to keep current password" /><Button variant="outline-secondary" type="button" aria-label={visiblePassword ? 'Hide password' : 'Show password'} onClick={() => setVisiblePassword(!visiblePassword)}><IconifyIcon icon={visiblePassword ? 'bx:hide' : 'bx:show'} /></Button></InputGroup><Form.Text>Letters and numbers required.</Form.Text></Form.Group></Col>
              <Col xs={12}><Form.Group><Form.Label>System roles</Form.Label><ReactSelect isMulti classNamePrefix="react-select" options={accessTypeOptions} placeholder="Select system roles" value={accessTypeOptions.filter((option) => editForm.accessTypes.includes(option.value))} onChange={(options) => setEditForm({ ...editForm, accessTypes: options.map((option) => option.value) })} /><Form.Text>Choose Sales, Operations, Accounts, or Designers.</Form.Text></Form.Group></Col>
              <Col xl={6}><Form.Group><Form.Label>Status</Form.Label><Form.Select value={editForm.status} onChange={(event) => setEditForm({ ...editForm, status: event.target.value as UserType['status'] })}>{statuses.map((status) => <option key={status} value={status}>{status}</option>)}</Form.Select></Form.Group></Col>
              <Col xl={6}><Form.Group><Form.Label>Timezone</Form.Label><Form.Control value={editForm.timezone} onChange={(event) => setEditForm({ ...editForm, timezone: event.target.value })} /></Form.Group></Col>
            </Row>
            {editingUser && !singleUserRoles.includes(editingUser.role as (typeof singleUserRoles)[number]) && (
              <details className="mt-3">
                <summary className="fw-medium">Advanced HR module permissions</summary>
                <Form.Text>Use only when this user needs different access for individual HR modules.</Form.Text>
                {loadingHrPermissions ? <Spinner className="spinner-border-sm" tag="span" /> : hrPermissions.map((permission) => (
                  <div className="d-flex align-items-center gap-2 mt-2" key={permission.module}>
                    <span className="flex-grow-1">{hrLabel(permission.module)}</span>
                    <Form.Select aria-label={`${hrLabel(permission.module)} access`} value={permission.access} onChange={(event) => setHrPermissions((current) => current.map((item) => item.module === permission.module ? { ...item, access: event.target.value as HrAccess } : item))} style={{ maxWidth: 140 }}>
                      <option value="none">None</option><option value="view">View</option><option value="manage">Manage</option>
                    </Form.Select>
                  </div>
                ))}
              </details>
            )}
          </Modal.Body>
          <Modal.Footer>
            <Button variant="outline-secondary" type="button" onClick={closeEdit}>
              Cancel
            </Button>
            <Button type="submit" disabled={loading || loadingHrPermissions}>
              <IconifyIcon icon="bx:save" className="me-1" />
              Save Changes
            </Button>
          </Modal.Footer>
        </Form>
      </Modal>
    </>
  )
}

export default UsersPage
