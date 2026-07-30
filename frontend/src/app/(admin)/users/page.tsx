import PageMetaData from '@/components/PageTitle'
import Spinner from '@/components/Spinner'
import IconifyIcon from '@/components/wrappers/IconifyIcon'
import { useAuthContext } from '@/context/useAuthContext'
import { useUserManagementStore } from '@/store/userManagementStore'
import type { UserType } from '@/types/auth'
import { FormEvent, useEffect, useState } from 'react'
import { Alert, Badge, Button, Card, CardBody, Form, InputGroup, Modal, Table } from 'react-bootstrap'

const roles = ['superadmin', 'admin', 'sales'] as const
const statuses = ['active', 'inactive', 'invited', 'suspended'] as const
const singleUserRoles = ['superadmin', 'admin'] as const

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

const emptyEditForm = {
  name: '',
  email: '',
  phone: '',
  role: 'sales' as UserType['role'],
  status: 'active' as UserType['status'],
  timezone: 'UTC',
  password: '',
}

const UsersPage = () => {
  const { user } = useAuthContext()
  const users = useUserManagementStore((state) => state.users)
  const loading = useUserManagementStore((state) => state.loading)
  const storeError = useUserManagementStore((state) => state.error)
  const clearUsers = useUserManagementStore((state) => state.clearUsers)
  const fetchUsers = useUserManagementStore((state) => state.fetchUsers)
  const updateUserInStore = useUserManagementStore((state) => state.updateUser)
  const [editingUser, setEditingUser] = useState<UserType | null>(null)
  const [editForm, setEditForm] = useState(emptyEditForm)
  const [visiblePassword, setVisiblePassword] = useState(false)
  const [message, setMessage] = useState('')
  const [error, setError] = useState('')
  const canManageUsers = user?.role === 'superadmin' || user?.role === 'admin'
  const hasRole = (role: UserType['role'], exceptId = '') => users.some((item) => item.role === role && item._id !== exceptId)
  const editableRoles = (item: UserType) =>
    user?.role === 'admin' ? ['sales'] : roles.filter((role) => role === item.role || role === 'sales' || !hasRole(role, item._id))

  useEffect(() => {
    if (canManageUsers) fetchUsers().catch((e) => setError(e instanceof Error ? e.message : 'Unable to load users'))
    else clearUsers()
  }, [canManageUsers, clearUsers, fetchUsers])

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
    setEditForm({
      name: item.name,
      email: item.email,
      phone: item.phone || '',
      role: item.role,
      status: item.status,
      timezone: item.timezone || 'UTC',
      password: '',
    })
  }

  const closeEdit = () => {
    setEditingUser(null)
    setEditForm(emptyEditForm)
    setVisiblePassword(false)
  }

  const saveEdit = async (event: FormEvent) => {
    event.preventDefault()
    if (!editingUser) return

    const name = editForm.name.trim()
    const email = editForm.email.trim()
    const phone = editForm.phone.trim()

    if (!name) {
      setError('Enter a user name')
      return
    }

    if (!email) {
      setError('Enter a user email')
      return
    }

    if (!phone) {
      setError('Enter a mobile number')
      return
    }

    const patch: Partial<UserType> & { password?: string } = {
      name,
      email,
      phone,
      role: editForm.role,
      status: editForm.status,
      timezone: editForm.timezone.trim() || 'UTC',
    }

    if (editForm.password.trim()) patch.password = editForm.password.trim()

    if (await updateUser(editingUser._id, patch)) {
      closeEdit()
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

  return (
    <>
      <PageMetaData title="Users" />
      <Card>
        <CardBody>
          <h4 className="card-title mb-3">User Profiles & Access</h4>
          {(error || storeError) && <Alert variant="danger">{error || storeError}</Alert>}
          {message && <Alert variant="success">{message}</Alert>}
          <div className="table-responsive">
            <Table className="align-middle mb-0" style={{ minWidth: 880 }}>
              <thead>
                <tr>
                  <th>User</th>
                  <th style={{ minWidth: 100 }}>Timezone</th>
                  <th style={{ minWidth: 120 }}>Role</th>
                  <th style={{ minWidth: 120 }}>Status</th>
                  <th style={{ minWidth: 230 }} className="text-end">
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
                      <div className="text-muted fs-13">{item.email}</div>
                      <div className="text-muted fs-13">{item.phone || 'Mobile not added'}</div>
                    </td>
                    <td>
                      <Badge bg="light" text="dark">
                        {item.timezone || 'UTC'}
                      </Badge>
                    </td>
                    <td>
                      <Badge bg={roleBadge(item.role)}>{item.role}</Badge>
                    </td>
                    <td>
                      <Badge bg={statusBadge(item.status)}>{item.status}</Badge>
                    </td>
                    <td className="text-end">
                      <Button size="sm" variant="outline-primary" type="button" className="me-2" onClick={() => openEdit(item)}>
                        <IconifyIcon icon="bx:edit" className="me-1" />
                        Edit
                      </Button>
                      <Button
                        size="sm"
                        variant={item.status === 'suspended' ? 'outline-success' : 'outline-danger'}
                        type="button"
                        className="text-nowrap d-inline-flex align-items-center gap-1"
                        onClick={() => updateUser(item._id, { status: item.status === 'suspended' ? 'active' : 'suspended' })}>
                        <IconifyIcon icon={item.status === 'suspended' ? 'bx:lock-open' : 'bx:lock'} className="me-1" />
                        {item.status === 'suspended' ? 'Unlock' : 'Lock'}
                      </Button>
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
        </CardBody>
      </Card>

      <Modal show={Boolean(editingUser)} onHide={closeEdit} centered>
        <Form onSubmit={saveEdit}>
          <Modal.Header closeButton>
            <Modal.Title>Edit User Information</Modal.Title>
          </Modal.Header>
          <Modal.Body>
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
              <Form.Label>Role</Form.Label>
              <Form.Select
                value={editForm.role}
                disabled={Boolean(editingUser && singleUserRoles.includes(editingUser.role as (typeof singleUserRoles)[number]))}
                onChange={(event) => setEditForm({ ...editForm, role: event.target.value as UserType['role'] })}>
                {(editingUser ? editableRoles(editingUser) : ['sales']).map((role) => (
                  <option key={role} value={role}>
                    {role}
                  </option>
                ))}
              </Form.Select>
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
                  value={editForm.password}
                  onChange={(event) => setEditForm({ ...editForm, password: event.target.value })}
                  placeholder="Leave blank to keep current password"
                />
                <Button variant="outline-secondary" type="button" aria-label={visiblePassword ? 'Hide password' : 'Show password'} onClick={() => setVisiblePassword(!visiblePassword)}>
                  <IconifyIcon icon={visiblePassword ? 'bx:hide' : 'bx:show'} />
                </Button>
              </InputGroup>
            </Form.Group>
          </Modal.Body>
          <Modal.Footer>
            <Button variant="outline-secondary" type="button" onClick={closeEdit}>
              Cancel
            </Button>
            <Button type="submit" disabled={loading}>
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
