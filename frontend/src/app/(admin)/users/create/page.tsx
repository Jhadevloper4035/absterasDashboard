import PageMetaData from '@/components/PageTitle'
import IconifyIcon from '@/components/wrappers/IconifyIcon'
import { useAuthContext } from '@/context/useAuthContext'
import { type CreateUserPayload, useUserManagementStore } from '@/store/userManagementStore'
import type { UserType } from '@/types/auth'
import { FormEvent, useEffect, useMemo, useState } from 'react'
import { Alert, Button, Card, CardBody, Form } from 'react-bootstrap'

const roles = ['superadmin', 'admin', 'sales'] as const
const statuses = ['active', 'inactive', 'invited', 'suspended'] as const

const emptyForm: CreateUserPayload = {
  name: '',
  email: '',
  phone: '',
  password: '',
  role: 'sales',
  status: 'active',
  timezone: 'UTC',
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
    () => (user?.role === 'admin' ? ['sales'] : roles.filter((role) => role === 'sales' || !users.some((item) => item.role === role))),
    [users, user?.role],
  )

  useEffect(() => {
    if (canManageUsers) fetchUsers().catch((e) => setError(e instanceof Error ? e.message : 'Unable to load users'))
    else clearUsers()
  }, [canManageUsers, clearUsers, fetchUsers])

  useEffect(() => {
    if (!createRoles.includes(form.role)) setForm((value) => ({ ...value, role: 'sales' }))
  }, [createRoles, form.role])

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
              <Form.Label>Mobile Number</Form.Label>
              <Form.Control required type="tel" inputMode="tel" value={form.phone} onChange={(event) => setForm({ ...form, phone: event.target.value })} placeholder="10-digit mobile number" />
            </Form.Group>
            <Form.Group className="mb-3">
              <Form.Label>Password</Form.Label>
              <Form.Control required type="password" value={form.password} onChange={(event) => setForm({ ...form, password: event.target.value })} />
            </Form.Group>
            <Form.Group className="mb-3">
              <Form.Label>Role</Form.Label>
              <Form.Select value={form.role} onChange={(event) => setForm({ ...form, role: event.target.value as UserType['role'] })}>
                {createRoles.map((role) => (
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
    </>
  )
}

export default CreateUserPage
