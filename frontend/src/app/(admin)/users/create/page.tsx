import PageMetaData from '@/components/PageTitle'
import IconifyIcon from '@/components/wrappers/IconifyIcon'
import { useAuthContext } from '@/context/useAuthContext'
import { type CreateUserPayload, useUserManagementStore } from '@/store/userManagementStore'
import type { UserType } from '@/types/auth'
import { FormEvent, useEffect, useMemo, useState } from 'react'
import { Alert, Button, Card, CardBody, Col, Form, Row } from 'react-bootstrap'

const roles: UserType['role'][] = ['superadmin', 'admin', 'sales', 'operations', 'accounts', 'designers']
const teamRoles: UserType['role'][] = ['sales', 'operations', 'accounts', 'designers']
const statuses = ['active', 'inactive', 'invited', 'suspended'] as const
const defaultTimezone = Intl.DateTimeFormat().resolvedOptions().timeZone || 'UTC'

const emptyForm: CreateUserPayload = {
  name: '',
  email: '',
  phone: '',
  password: '',
  role: 'sales',
  status: 'active',
  timezone: defaultTimezone,
}

const CreateUserPage = () => {
  const { user } = useAuthContext()
  const users = useUserManagementStore((state) => state.users)
  const loading = useUserManagementStore((state) => state.loading)
  const storeError = useUserManagementStore((state) => state.error)
  const clearUsers = useUserManagementStore((state) => state.clearUsers)
  const fetchUsers = useUserManagementStore((state) => state.fetchUsers)
  const createUserInStore = useUserManagementStore((state) => state.createUser)
  const [form, setForm] = useState(emptyForm)
  const [message, setMessage] = useState('')
  const [error, setError] = useState('')
  const canManageUsers = user?.role === 'superadmin' || user?.role === 'admin'
  const createRoles = useMemo(
    () => (user?.role === 'admin' ? teamRoles : roles.filter((role) => teamRoles.includes(role) || !users.some((item) => item.role === role))),
    [users, user?.role],
  )

  useEffect(() => {
    if (canManageUsers) fetchUsers('?limit=100').catch((e) => setError(e instanceof Error ? e.message : 'Unable to load users'))
    else clearUsers()
  }, [canManageUsers, clearUsers, fetchUsers])

  useEffect(() => {
    if (!createRoles.includes(form.role)) setForm((value) => ({ ...value, role: 'sales' }))
  }, [createRoles, form.role])

  const createUser = async (event: FormEvent) => {
    event.preventDefault()
    setError('')
    setMessage('')

    if (form.password.length < 8 || !/[a-z]/i.test(form.password) || !/\d/.test(form.password)) {
      setError('Password must be at least 8 characters and include letters and numbers')
      return
    }

    try {
      await createUserInStore(form)
      setForm(emptyForm)
      setMessage('User created')
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Unable to create user')
    }
  }

  if (!canManageUsers) {
    return (
      <>
        <PageMetaData title="Create User" />
        <Alert variant="warning">Only administrators can manage users.</Alert>
      </>
    )
  }

  return (
    <>
      <PageMetaData title="Create User" />
      <Card>
        <CardBody>
          <div className="d-flex flex-wrap align-items-center justify-content-between gap-2 mb-4">
            <div>
              <h4 className="card-title mb-1">Create User</h4>
              <p className="text-muted mb-0">Add login details, role, and access status.</p>
            </div>
            <span className="badge bg-primary-subtle text-primary border border-primary-subtle px-3 py-2">{createRoles.length} roles available</span>
          </div>
          {(error || storeError) && <Alert variant="danger">{error || storeError}</Alert>}
          {message && <Alert variant="success">{message}</Alert>}
          <Form onSubmit={createUser}>
            <Row className="g-3">
              <Col xl={6}>
                <Form.Group>
                  <Form.Label>Name</Form.Label>
                  <Form.Control required value={form.name} onChange={(event) => setForm({ ...form, name: event.target.value })} placeholder="Full name" />
                </Form.Group>
              </Col>
              <Col xl={6}>
                <Form.Group>
                  <Form.Label>Email</Form.Label>
                  <Form.Control required type="email" value={form.email} onChange={(event) => setForm({ ...form, email: event.target.value })} placeholder="name@company.com" />
                </Form.Group>
              </Col>
              <Col xl={6}>
                <Form.Group>
                  <Form.Label>Mobile Number</Form.Label>
                  <Form.Control required type="tel" inputMode="tel" value={form.phone} onChange={(event) => setForm({ ...form, phone: event.target.value })} placeholder="10-digit mobile number" />
                </Form.Group>
              </Col>
              <Col xl={6}>
                <Form.Group>
                  <Form.Label>Password</Form.Label>
                  <Form.Control required minLength={8} type="password" value={form.password} onChange={(event) => setForm({ ...form, password: event.target.value })} placeholder="At least 8 characters" />
                  <Form.Text>Letters and numbers required.</Form.Text>
                </Form.Group>
              </Col>
              <Col xl={4}>
                <Form.Group>
                  <Form.Label>Role</Form.Label>
                  <Form.Select value={form.role} onChange={(event) => setForm({ ...form, role: event.target.value as UserType['role'] })}>
                    {createRoles.map((role) => (
                      <option key={role} value={role}>
                        {role}
                      </option>
                    ))}
                  </Form.Select>
                </Form.Group>
              </Col>
              <Col xl={4}>
                <Form.Group>
                  <Form.Label>Status</Form.Label>
                  <Form.Select value={form.status} onChange={(event) => setForm({ ...form, status: event.target.value as UserType['status'] })}>
                    {statuses.map((status) => (
                      <option key={status} value={status}>
                        {status}
                      </option>
                    ))}
                  </Form.Select>
                </Form.Group>
              </Col>
              <Col xl={4}>
                <Form.Group>
                  <Form.Label>Timezone</Form.Label>
                  <Form.Control value={form.timezone} onChange={(event) => setForm({ ...form, timezone: event.target.value })} />
                </Form.Group>
              </Col>
            </Row>

            <div className="d-flex justify-content-end gap-2 mt-4">
              <Button type="button" variant="light" onClick={() => setForm(emptyForm)} disabled={loading}>
                Reset
              </Button>
              <Button type="submit" disabled={loading}>
                <IconifyIcon icon="bx:user-plus" className="me-1" />
                Create User
              </Button>
            </div>
          </Form>
        </CardBody>
      </Card>
    </>
  )
}

export default CreateUserPage
