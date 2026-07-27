import PageMetaData from '@/components/PageTitle'
import IconifyIcon from '@/components/wrappers/IconifyIcon'
import { useAuthContext } from '@/context/useAuthContext'
import { type CreateUserPayload, useUserManagementStore } from '@/store/userManagementStore'
import type { UserType } from '@/types/auth'
import { FormEvent, useEffect, useState } from 'react'
import { Alert, Badge, Button, Card, CardBody, Col, Form, Row, Table } from 'react-bootstrap'

const roles = ['superadmin', 'admin', 'sales'] as const
const statuses = ['active', 'inactive', 'invited', 'suspended'] as const

const emptyForm: CreateUserPayload = {
  name: '',
  email: '',
  password: '',
  role: 'sales',
  status: 'active',
  timezone: 'UTC',
}

const UsersPage = () => {
  const { user } = useAuthContext()
  const users = useUserManagementStore((state) => state.users)
  const loading = useUserManagementStore((state) => state.loading)
  const storeError = useUserManagementStore((state) => state.error)
  const clearUsers = useUserManagementStore((state) => state.clearUsers)
  const fetchUsers = useUserManagementStore((state) => state.fetchUsers)
  const createUserInStore = useUserManagementStore((state) => state.createUser)
  const updateUserInStore = useUserManagementStore((state) => state.updateUser)
  const [form, setForm] = useState(emptyForm)
  const [message, setMessage] = useState('')
  const [error, setError] = useState('')

  useEffect(() => {
    if (user?.role === 'superadmin') fetchUsers().catch((e) => setError(e instanceof Error ? e.message : 'Unable to load users'))
    else clearUsers()
  }, [clearUsers, fetchUsers, user?.role])

  const createUser = async (event: FormEvent) => {
    event.preventDefault()
    setError('')
    setMessage('')

    try {
      await createUserInStore(form)
      setForm(emptyForm)
      setMessage('User created')
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Unable to create user')
    }
  }

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
      <Row>
        <Col xl={4}>
          <Card>
            <CardBody>
              <h4 className="card-title mb-3">Create User</h4>
              {(error || storeError) && <Alert variant="danger">{error || storeError}</Alert>}
              {message && <Alert variant="success">{message}</Alert>}
              <Form onSubmit={createUser}>
                <Form.Group className="mb-3">
                  <Form.Label>Name</Form.Label>
                  <Form.Control required value={form.name} onChange={(event) => setForm({ ...form, name: event.target.value })} />
                </Form.Group>
                <Form.Group className="mb-3">
                  <Form.Label>Email</Form.Label>
                  <Form.Control required type="email" value={form.email} onChange={(event) => setForm({ ...form, email: event.target.value })} />
                </Form.Group>
                <Form.Group className="mb-3">
                  <Form.Label>Password</Form.Label>
                  <Form.Control required type="password" value={form.password} onChange={(event) => setForm({ ...form, password: event.target.value })} />
                </Form.Group>
                <Form.Group className="mb-3">
                  <Form.Label>Role</Form.Label>
                  <Form.Select value={form.role} onChange={(event) => setForm({ ...form, role: event.target.value as UserType['role'] })}>
                    {roles.map((role) => (
                      <option key={role} value={role}>
                        {role}
                      </option>
                    ))}
                  </Form.Select>
                </Form.Group>
                <Form.Group className="mb-3">
                  <Form.Label>Status</Form.Label>
                  <Form.Select value={form.status} onChange={(event) => setForm({ ...form, status: event.target.value as UserType['status'] })}>
                    {statuses.map((status) => (
                      <option key={status} value={status}>
                        {status}
                      </option>
                    ))}
                  </Form.Select>
                </Form.Group>
                <Form.Group className="mb-3">
                  <Form.Label>Timezone</Form.Label>
                  <Form.Control value={form.timezone} onChange={(event) => setForm({ ...form, timezone: event.target.value })} />
                </Form.Group>
                <Button type="submit" disabled={loading}>
                  <IconifyIcon icon="bx:user-plus" className="me-1" />
                  Create
                </Button>
              </Form>
            </CardBody>
          </Card>
        </Col>
        <Col xl={8}>
          <Card>
            <CardBody>
              <h4 className="card-title mb-3">Role Management</h4>
              <div className="table-responsive">
                <Table className="align-middle mb-0">
                  <thead>
                    <tr>
                      <th>User</th>
                      <th>Role</th>
                      <th>Status</th>
                      <th>Timezone</th>
                    </tr>
                  </thead>
                  <tbody>
                    {users.map((item) => (
                      <tr key={item._id}>
                        <td>
                          <div className="fw-medium">{item.name}</div>
                          <div className="text-muted fs-13">{item.email}</div>
                        </td>
                        <td>
                          <Form.Select size="sm" value={item.role} onChange={(event) => updateUser(item._id, { role: event.target.value as UserType['role'] })}>
                            {roles.map((role) => (
                              <option key={role} value={role}>
                                {role}
                              </option>
                            ))}
                          </Form.Select>
                        </td>
                        <td>
                          <Form.Select
                            size="sm"
                            value={item.status}
                            onChange={(event) => updateUser(item._id, { status: event.target.value as UserType['status'] })}>
                            {statuses.map((status) => (
                              <option key={status} value={status}>
                                {status}
                              </option>
                            ))}
                          </Form.Select>
                        </td>
                        <td>
                          <Badge bg="light" text="dark">
                            {item.timezone || 'UTC'}
                          </Badge>
                        </td>
                      </tr>
                    ))}
                    {!users.length && (
                      <tr>
                        <td colSpan={4} className="text-center text-muted py-4">
                          No users found
                        </td>
                      </tr>
                    )}
                  </tbody>
                </Table>
              </div>
            </CardBody>
          </Card>
        </Col>
      </Row>
    </>
  )
}

export default UsersPage
