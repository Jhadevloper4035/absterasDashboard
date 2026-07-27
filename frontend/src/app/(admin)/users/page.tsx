import PageMetaData from '@/components/PageTitle'
import Spinner from '@/components/Spinner'
import IconifyIcon from '@/components/wrappers/IconifyIcon'
import { useAuthContext } from '@/context/useAuthContext'
import { useUserManagementStore } from '@/store/userManagementStore'
import type { UserType } from '@/types/auth'
import { useEffect, useState } from 'react'
import { Alert, Badge, Button, Card, CardBody, Form, InputGroup, Table } from 'react-bootstrap'

const roles = ['superadmin', 'admin', 'sales'] as const
const statuses = ['active', 'inactive', 'invited', 'suspended'] as const
const singleUserRoles = ['superadmin', 'admin'] as const

const UsersPage = () => {
  const { user } = useAuthContext()
  const users = useUserManagementStore((state) => state.users)
  const loading = useUserManagementStore((state) => state.loading)
  const storeError = useUserManagementStore((state) => state.error)
  const clearUsers = useUserManagementStore((state) => state.clearUsers)
  const fetchUsers = useUserManagementStore((state) => state.fetchUsers)
  const updateUserInStore = useUserManagementStore((state) => state.updateUser)
  const [passwords, setPasswords] = useState<Record<string, string>>({})
  const [visiblePasswords, setVisiblePasswords] = useState<Record<string, boolean>>({})
  const [message, setMessage] = useState('')
  const [error, setError] = useState('')
  const hasRole = (role: UserType['role'], exceptId = '') => users.some((item) => item.role === role && item._id !== exceptId)
  const editableRoles = (item: UserType) => roles.filter((role) => role === item.role || role === 'sales' || !hasRole(role, item._id))

  useEffect(() => {
    if (user?.role === 'superadmin') fetchUsers().catch((e) => setError(e instanceof Error ? e.message : 'Unable to load users'))
    else clearUsers()
  }, [clearUsers, fetchUsers, user?.role])

  const updateUser = async (id: string, patch: Partial<UserType>) => {
    setError('')
    setMessage('')

    try {
      await updateUserInStore(id, patch)
      setMessage('User updated')
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Unable to update user')
    }
  }

  const resetPassword = async (id: string) => {
    const password = passwords[id]?.trim()

    if (!password) {
      setError('Enter a new password')
      return
    }

    setError('')
    setMessage('')

    try {
      await updateUserInStore(id, { password })
      setPasswords(({ [id]: _password, ...rest }) => rest)
      setMessage('Password reset')
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Unable to reset password')
    }
  }

  if (user?.role !== 'superadmin') {
    return (
      <>
        <PageMetaData title="Users" />
        <Alert variant="warning">Only superadmin can manage users.</Alert>
      </>
    )
  }

  return (
    <>
      <PageMetaData title="Users" />
      <Card>
        <CardBody>
          <h4 className="card-title mb-3">All Users</h4>
          {(error || storeError) && <Alert variant="danger">{error || storeError}</Alert>}
          {message && <Alert variant="success">{message}</Alert>}
          <div className="table-responsive">
            <Table className="align-middle mb-0" style={{ minWidth: 1040 }}>
              <thead>
                <tr>
                  <th>User</th>
                  <th style={{ minWidth: 150 }}>Role</th>
                  <th style={{ minWidth: 150 }}>Status</th>
                  <th style={{ minWidth: 360 }}>Password</th>
                  <th style={{ minWidth: 120 }}>Login</th>
                  <th style={{ minWidth: 100 }}>Timezone</th>
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
                      <div className="text-muted fs-13">{item.email}</div>
                    </td>
                    <td>
                      <Form.Select
                        size="sm"
                        value={item.role}
                        disabled={singleUserRoles.includes(item.role as (typeof singleUserRoles)[number])}
                        onChange={(event) => updateUser(item._id, { role: event.target.value as UserType['role'] })}>
                        {editableRoles(item).map((role) => (
                          <option key={role} value={role}>
                            {role}
                          </option>
                        ))}
                      </Form.Select>
                    </td>
                    <td>
                      <Form.Select size="sm" value={item.status} onChange={(event) => updateUser(item._id, { status: event.target.value as UserType['status'] })}>
                        {statuses.map((status) => (
                          <option key={status} value={status}>
                            {status}
                          </option>
                        ))}
                      </Form.Select>
                    </td>
                    <td>
                      <div className="d-flex gap-2 align-items-center">
                        <InputGroup size="sm" style={{ minWidth: 240 }}>
                        <Form.Control
                          type={visiblePasswords[item._id] ? 'text' : 'password'}
                          value={passwords[item._id] || ''}
                          onChange={(event) => setPasswords({ ...passwords, [item._id]: event.target.value })}
                          placeholder="New password"
                        />
                          <Button
                            variant="outline-secondary"
                            type="button"
                            aria-label={visiblePasswords[item._id] ? 'Hide password' : 'Show password'}
                            onClick={() => setVisiblePasswords({ ...visiblePasswords, [item._id]: !visiblePasswords[item._id] })}>
                            <IconifyIcon icon={visiblePasswords[item._id] ? 'bx:hide' : 'bx:show'} />
                          </Button>
                        </InputGroup>
                        <Button size="sm" variant="outline-primary" type="button" className="text-nowrap d-inline-flex align-items-center gap-1" onClick={() => resetPassword(item._id)}>
                          <IconifyIcon icon="bx:key" className="me-1" />
                          Reset
                        </Button>
                      </div>
                    </td>
                    <td>
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
                    <td>
                      <Badge bg="light" text="dark">
                        {item.timezone || 'UTC'}
                      </Badge>
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
        </CardBody>
      </Card>
    </>
  )
}

export default UsersPage
