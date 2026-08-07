import PageMetaData from '@/components/PageTitle'
import Spinner from '@/components/Spinner'
import IconifyIcon from '@/components/wrappers/IconifyIcon'
import { useAuthContext } from '@/context/useAuthContext'
import { apiFetch } from '@/helpers/api'
import { useUserManagementStore } from '@/store/userManagementStore'
import type { UserType } from '@/types/auth'
import { FormEvent, useEffect, useState } from 'react'
import { Alert, Badge, Button, Card, CardBody, Form, InputGroup, Modal, Table } from 'react-bootstrap'
import ReactSelect from 'react-select'

const roles: UserType['role'][] = ['superadmin', 'admin', 'sales', 'operations', 'accounts', 'designers']
const teamRoles: UserType['role'][] = ['sales', 'operations', 'accounts', 'designers']
const accessTypes = ['admin', ...teamRoles, 'hr-management', 'employee']
const statuses = ['active', 'inactive', 'invited', 'suspended'] as const
const singleUserRoles = ['superadmin', 'admin'] as const
const hrModules = ['employees', 'attendance', 'leave', 'payroll', 'expenses', 'reports']
type HrAccess = 'none' | 'view' | 'manage'
type HrPermission = { module: string; access: HrAccess }
const defaultHrPermissions = () => hrModules.map((module) => ({ module, access: 'none' as HrAccess }))
const hrLabel = (module: string) => module.replace(/\b\w/g, (letter) => letter.toUpperCase())
const accessLabel = (type: string) => type.replace(/-/g, ' ').replace(/\b\w/g, (letter) => letter.toUpperCase())
const joinedDate = (value?: string) => value ? new Intl.DateTimeFormat(undefined, { dateStyle: 'medium' }).format(new Date(value)) : '—'

const roleBadge = (role: UserType['role']) => {
  if (role === 'superadmin') return 'danger'
  if (role === 'admin') return 'primary'
  if (role === 'operations') return 'info'
  if (role === 'accounts') return 'warning'
  if (role === 'designers') return 'secondary'
  return 'success'
}

const statusBadge = (status: UserType['status']) => {
  if (status === 'active') return 'success'
  if (status === 'suspended') return 'danger'
  if (status === 'invited') return 'warning'
  return 'secondary'
}

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
  const users = useUserManagementStore((state) => state.users)
  const meta = useUserManagementStore((state) => state.meta)
  const loading = useUserManagementStore((state) => state.loading)
  const storeError = useUserManagementStore((state) => state.error)
  const clearUsers = useUserManagementStore((state) => state.clearUsers)
  const fetchUsers = useUserManagementStore((state) => state.fetchUsers)
  const updateUserInStore = useUserManagementStore((state) => state.updateUser)
  const [editingUser, setEditingUser] = useState<UserType | null>(null)
  const [editForm, setEditForm] = useState(emptyEditForm)
  const [editError, setEditError] = useState('')
  const [visiblePassword, setVisiblePassword] = useState(false)
  const [hrPermissions, setHrPermissions] = useState<HrPermission[]>(defaultHrPermissions)
  const [loadingHrPermissions, setLoadingHrPermissions] = useState(false)
  const [message, setMessage] = useState('')
  const [error, setError] = useState('')
  const [page, setPage] = useState(1)
  const [filters, setFilters] = useState({ q: '', role: '', status: '' })
  const currentAccessTypes = [user?.role, ...(user?.additionalRoles || []), ...(user?.accessTypes || [])]
  const isSuperadmin = currentAccessTypes.includes('superadmin')
  const canManageUsers = isSuperadmin || currentAccessTypes.includes('admin')
  const canManageProfile = (profile: UserType) => isSuperadmin || profile.role !== 'superadmin'
  useEffect(() => {
    const query = new URLSearchParams({ page: String(page), limit: '25' })
    if (filters.q.trim()) query.set('q', filters.q.trim())
    if (filters.role) query.set('role', filters.role)
    if (filters.status) query.set('status', filters.status)

    if (canManageUsers) fetchUsers(`?${query}`).catch((e) => setError(e instanceof Error ? e.message : 'Unable to load users'))
    else clearUsers()
  }, [canManageUsers, clearUsers, fetchUsers, filters.q, filters.role, filters.status, page])

  useEffect(() => {
    setPage(1)
  }, [filters.q, filters.role, filters.status])

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

  const openEdit = (item: UserType) => {
    setEditingUser(item)
    setVisiblePassword(false)
    setEditError('')
    setHrPermissions(defaultHrPermissions())
    setEditForm({
      name: item.name,
      email: item.email,
      phone: item.phone || '',
      role: item.role,
      accessTypes: [...new Set([...(item.role === 'superadmin' ? [] : [item.role]), ...(item.additionalRoles || []), ...(item.accessTypes || [])])],
      status: item.status,
      timezone: item.timezone || 'UTC',
      password: '',
    })
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

  const accessTypeOptions = [...new Set([...accessTypes, ...users.flatMap((item) => [item.role, ...(item.additionalRoles || []), ...(item.accessTypes || [])]), ...editForm.accessTypes])].filter((type) => type !== 'superadmin').map((type) => ({ value: type, label: type.replace(/-/g, ' ').replace(/\b\w/g, (letter) => letter.toUpperCase()) }))

  return (
    <>
      <PageMetaData title="Users" />
      <Card>
        <CardBody>
          <div className="d-flex flex-wrap justify-content-between align-items-start gap-2 mb-3"><div><h4 className="card-title mb-1">User Profiles & Access</h4><p className="text-muted mb-0">All account details and assigned access types in one place.</p></div><Badge bg="light" text="dark">{meta.total} users</Badge></div>
          {(error || storeError) && <Alert variant="danger">{error || storeError}</Alert>}
          {message && <Alert variant="success">{message}</Alert>}
          <div className="d-flex gap-2 flex-wrap mb-3">
            <Form.Control style={{ flex: '1 1 260px' }} placeholder="Search name, email, mobile" value={filters.q} onChange={(event) => setFilters({ ...filters, q: event.target.value })} />
            <Form.Select style={{ flex: '0 1 180px' }} value={filters.role} onChange={(event) => setFilters({ ...filters, role: event.target.value })}>
              <option value="">All roles</option>
              {roles.map((role) => (
                <option key={role}>{role}</option>
              ))}
            </Form.Select>
            <Form.Select style={{ flex: '0 1 180px' }} value={filters.status} onChange={(event) => setFilters({ ...filters, status: event.target.value })}>
              <option value="">All status</option>
              {statuses.map((status) => (
                <option key={status}>{status}</option>
              ))}
            </Form.Select>
          </div>
          <div className="table-responsive">
            <Table className="align-middle mb-0" style={{ minWidth: 960 }}>
              <thead>
                <tr>
                  <th style={{ minWidth: 260 }}>User</th>
                  <th style={{ minWidth: 220 }}>Access types</th>
                  <th style={{ minWidth: 150 }}>Account</th>
                  <th style={{ minWidth: 150 }}>Activity</th>
                  <th style={{ minWidth: 175 }} className="text-end">
                    Actions
                  </th>
                </tr>
              </thead>
              <tbody>
                {loading && !users.length && (
                  <tr>
                    <td colSpan={5} className="text-center py-5">
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
                    <td>
                      <div className="d-flex flex-wrap gap-1">{[...new Set([item.role, ...(item.additionalRoles || []), ...(item.accessTypes || [])])].map((type) => <Badge bg={roleBadge(type as UserType['role'])} key={type}>{accessLabel(type)}</Badge>)}</div>
                    </td>
                    <td>
                      <Badge bg={statusBadge(item.status)}>{item.status}</Badge>
                      <div className="text-muted fs-12 mt-1">{item.timezone || 'UTC'}</div>
                    </td>
                    <td>
                      <div className="fs-13">Joined {joinedDate(item.createdAt)}</div>
                      <div className="text-muted fs-12">Updated {joinedDate(item.updatedAt)}</div>
                    </td>
                    <td className="text-end">
                      {canManageProfile(item) ? <div className="d-inline-flex gap-2"><Button size="sm" variant="outline-primary" type="button" onClick={() => openEdit(item)}><IconifyIcon icon="bx:edit" className="me-1" />Edit</Button><Button size="sm" variant={item.status === 'suspended' ? 'outline-success' : 'outline-danger'} type="button" className="text-nowrap" onClick={() => updateUser(item._id, { status: item.status === 'suspended' ? 'active' : 'suspended' })}><IconifyIcon icon={item.status === 'suspended' ? 'bx:lock-open' : 'bx:lock'} className="me-1" />{item.status === 'suspended' ? 'Unlock' : 'Lock'}</Button></div> : <Badge bg="light" text="dark">Superadmin protected</Badge>}
                    </td>
                  </tr>
                ))}
                {!users.length && !loading && (
                  <tr>
                    <td colSpan={5} className="text-center text-muted py-4">
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

      <Modal show={Boolean(editingUser)} onHide={closeEdit} centered size="lg">
        <Form onSubmit={saveEdit}>
          <Modal.Header closeButton>
            <Modal.Title>Edit User Information</Modal.Title>
          </Modal.Header>
          <Modal.Body>
            {editError && <Alert variant="danger">{editError}</Alert>}
            <Form.Group className="mb-3">
              <Form.Label>Name</Form.Label>
              <Form.Control required value={editForm.name} onChange={(event) => setEditForm({ ...editForm, name: event.target.value })} />
            </Form.Group>
            <Form.Group className="mb-3">
              <Form.Label>Email</Form.Label>
              <Form.Control required type="email" value={editForm.email} onChange={(event) => setEditForm({ ...editForm, email: event.target.value })} />
            </Form.Group>
            <Form.Group className="mb-3">
              <Form.Label>Mobile Number</Form.Label>
              <Form.Control required type="tel" inputMode="tel" value={editForm.phone} onChange={(event) => setEditForm({ ...editForm, phone: event.target.value })} placeholder="10-digit mobile number" />
            </Form.Group>
            <Form.Group className="mb-3">
              <Form.Label>Access types</Form.Label>
              <ReactSelect
                isMulti
                classNamePrefix="react-select"
                options={accessTypeOptions}
                placeholder="Select access types"
                value={accessTypeOptions.filter((option) => editForm.accessTypes.includes(option.value))}
                onChange={(options) => setEditForm({ ...editForm, accessTypes: options.map((option) => option.value) })}
              />
              <Form.Text>Select one or more approved business access types.</Form.Text>
            </Form.Group>
            <Form.Group className="mb-3">
              <Form.Label>Status</Form.Label>
              <Form.Select value={editForm.status} onChange={(event) => setEditForm({ ...editForm, status: event.target.value as UserType['status'] })}>
                {statuses.map((status) => (
                  <option key={status} value={status}>
                    {status}
                  </option>
                ))}
              </Form.Select>
            </Form.Group>
            <Form.Group className="mb-3">
              <Form.Label>Timezone</Form.Label>
              <Form.Control value={editForm.timezone} onChange={(event) => setEditForm({ ...editForm, timezone: event.target.value })} />
            </Form.Group>
            <Form.Group>
              <Form.Label>New Password</Form.Label>
              <InputGroup>
                <Form.Control
                  type={visiblePassword ? 'text' : 'password'}
                  minLength={8}
                  value={editForm.password}
                  onChange={(event) => setEditForm({ ...editForm, password: event.target.value })}
                  placeholder="Leave blank to keep current password"
                />
                <Button variant="outline-secondary" type="button" aria-label={visiblePassword ? 'Hide password' : 'Show password'} onClick={() => setVisiblePassword(!visiblePassword)}>
                  <IconifyIcon icon={visiblePassword ? 'bx:hide' : 'bx:show'} />
                </Button>
              </InputGroup>
              <Form.Text>Use at least 8 characters with letters and numbers.</Form.Text>
            </Form.Group>
            {editingUser && !singleUserRoles.includes(editingUser.role as (typeof singleUserRoles)[number]) && (
              <Form.Group className="mt-3">
                <Form.Label>HR Access</Form.Label>
                {loadingHrPermissions ? <Spinner className="spinner-border-sm" tag="span" /> : hrPermissions.map((permission) => (
                  <div className="d-flex align-items-center gap-2 mb-2" key={permission.module}>
                    <span className="flex-grow-1">{hrLabel(permission.module)}</span>
                    <Form.Select aria-label={`${hrLabel(permission.module)} access`} value={permission.access} onChange={(event) => setHrPermissions((current) => current.map((item) => item.module === permission.module ? { ...item, access: event.target.value as HrAccess } : item))} style={{ maxWidth: 140 }}>
                      <option value="none">None</option><option value="view">View</option><option value="manage">Manage</option>
                    </Form.Select>
                  </div>
                ))}
              </Form.Group>
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
