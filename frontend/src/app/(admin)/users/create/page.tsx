import PageMetaData from '@/components/PageTitle'
import IconifyIcon from '@/components/wrappers/IconifyIcon'
import { useAuthContext } from '@/context/useAuthContext'
import { apiFetch } from '@/helpers/api'
import { type CreateUserPayload, useUserManagementStore } from '@/store/userManagementStore'
import type { UserType } from '@/types/auth'
import type { OrganizationItem } from '@/types/hr'
import { FormEvent, useEffect, useMemo, useState } from 'react'
import { Alert, Button, Card, CardBody, Col, Form, Row } from 'react-bootstrap'
import ReactSelect from 'react-select'

const roles: UserType['role'][] = ['superadmin', 'admin', 'sales', 'operations', 'accounts', 'designers']
const teamRoles: UserType['role'][] = ['sales', 'operations', 'accounts', 'designers']
const defaultAccessTypes = ['admin', ...teamRoles, 'hr-management', 'employee']
const statuses = ['active', 'inactive', 'invited', 'suspended'] as const
const defaultTimezone = Intl.DateTimeFormat().resolvedOptions().timeZone || 'UTC'

const emptyForm: CreateUserPayload = {
  name: '',
  email: '',
  phone: '',
  password: '',
  role: 'sales',
  additionalRoles: [],
  accessTypes: ['sales'],
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
  const [departments, setDepartments] = useState<OrganizationItem[]>([])
  const [designations, setDesignations] = useState<OrganizationItem[]>([])
  const currentAccessTypes = [user?.role, ...(user?.additionalRoles || []), ...(user?.accessTypes || [])]
  const canManageUsers = currentAccessTypes.includes('superadmin') || currentAccessTypes.includes('admin')
  const createRoles = teamRoles
  const accessTypeOptions = useMemo(() => [...new Set([...defaultAccessTypes, ...createRoles, ...users.flatMap((item) => [item.role, ...(item.additionalRoles || []), ...(item.accessTypes || [])])])].filter((type) => type !== 'superadmin')
    .map((type) => ({ value: type, label: type.replace(/-/g, ' ').replace(/\b\w/g, (letter) => letter.toUpperCase()) })), [createRoles, users])

  useEffect(() => {
    if (canManageUsers) fetchUsers('?limit=100').catch((e) => setError(e instanceof Error ? e.message : 'Unable to load users'))
    else clearUsers()
  }, [canManageUsers, clearUsers, fetchUsers])

  useEffect(() => {
    if (!canManageUsers) return
    Promise.all([apiFetch<{ data: OrganizationItem[] }>('/hr/departments'), apiFetch<{ data: OrganizationItem[] }>('/hr/designations')])
      .then(([departmentResponse, designationResponse]) => { setDepartments(departmentResponse.data); setDesignations(designationResponse.data) })
      .catch((reason) => setError(reason instanceof Error ? reason.message : 'Unable to load employment options'))
  }, [canManageUsers])

  const createUser = async (event: FormEvent) => {
    event.preventDefault()
    setError('')
    setMessage('')

    if (form.password.length < 8 || !/[a-z]/i.test(form.password) || !/\d/.test(form.password)) {
      setError('Password must be at least 8 characters and include letters and numbers')
      return
    }

    try {
      const selectedRoles = (form.accessTypes || []).filter((type): type is UserType['role'] => roles.includes(type as UserType['role']))
      const businessRoles = selectedRoles.filter((type) => teamRoles.includes(type))
      const primaryRole = businessRoles[0]
      if (!primaryRole || !createRoles.includes(primaryRole)) {
        setError('Select at least one permitted business access type')
        return
      }
      const employment = form.accessTypes?.includes('employee') ? form.employment : undefined
      if (form.accessTypes?.includes('employee') && (!employment?.department || !employment.designation || !employment.joiningDate)) {
        setError('Department, designation, and joining date are required')
        return
      }
      await createUserInStore({ ...form, role: primaryRole, additionalRoles: selectedRoles.filter((type) => type !== primaryRole && type !== 'superadmin'), accessTypes: (form.accessTypes || []).filter((type) => !roles.includes(type as UserType['role'])), employment })
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
            <h5 className="mb-3">Account details</h5>
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
              <Col xl={12}>
                <Form.Group>
                  <Form.Label>Access types</Form.Label>
                  <ReactSelect isMulti classNamePrefix="react-select" options={accessTypeOptions} placeholder="Select access types" value={accessTypeOptions.filter((option) => form.accessTypes?.includes(option.value))} onChange={(options) => { const accessTypes = options.map((option) => option.value); setForm({ ...form, accessTypes, employment: accessTypes.includes('employee') ? form.employment : undefined }) }} />
                  <Form.Text>Select all applicable types. Options already assigned to users appear here automatically.</Form.Text>
                </Form.Group>
              </Col>
              {form.accessTypes?.includes('employee') && <><Col xs={12}><hr className="my-2" /><h5 className="mb-0">Employment details</h5><Form.Text>Choose the department (for example Accounts, Operations, or Designers) and optional starting monthly salary.</Form.Text></Col>
                <Col xl={3}><Form.Group><Form.Label>Employee Type</Form.Label><Form.Select value={form.employment?.employeeType || 'office'} onChange={(event) => setForm({ ...form, employment: { ...form.employment, employeeType: event.target.value as 'office' | 'site', department: form.employment?.department || '', designation: form.employment?.designation || '', joiningDate: form.employment?.joiningDate || '', manager: form.employment?.manager, monthlySalary: form.employment?.monthlySalary } })}><option value="office">Office</option><option value="site">Site</option></Form.Select></Form.Group></Col>
                <Col xl={3}><Form.Group><Form.Label>Department</Form.Label><Form.Select required value={form.employment?.department || ''} onChange={(event) => setForm({ ...form, employment: { employeeType: form.employment?.employeeType || 'office', department: event.target.value, designation: form.employment?.designation || '', joiningDate: form.employment?.joiningDate || '', manager: form.employment?.manager, monthlySalary: form.employment?.monthlySalary } })}><option value="">Select department</option>{departments.map((item) => <option key={item._id} value={item._id}>{item.name}</option>)}</Form.Select></Form.Group></Col>
                <Col xl={3}><Form.Group><Form.Label>Designation</Form.Label><Form.Select required value={form.employment?.designation || ''} onChange={(event) => setForm({ ...form, employment: { employeeType: form.employment?.employeeType || 'office', department: form.employment?.department || '', designation: event.target.value, joiningDate: form.employment?.joiningDate || '', manager: form.employment?.manager, monthlySalary: form.employment?.monthlySalary } })}><option value="">Select designation</option>{designations.map((item) => <option key={item._id} value={item._id}>{item.name}</option>)}</Form.Select></Form.Group></Col>
                <Col xl={3}><Form.Group><Form.Label>Joining Date</Form.Label><Form.Control required type="date" value={form.employment?.joiningDate || ''} onChange={(event) => setForm({ ...form, employment: { employeeType: form.employment?.employeeType || 'office', department: form.employment?.department || '', designation: form.employment?.designation || '', joiningDate: event.target.value, manager: form.employment?.manager, monthlySalary: form.employment?.monthlySalary } })} /></Form.Group></Col>
                <Col xl={3}><Form.Group><Form.Label>Monthly salary <span className="text-muted">(optional)</span></Form.Label><Form.Control min="0" step="0.01" type="number" value={form.employment?.monthlySalary || ''} onChange={(event) => setForm({ ...form, employment: { employeeType: form.employment?.employeeType || 'office', department: form.employment?.department || '', designation: form.employment?.designation || '', joiningDate: form.employment?.joiningDate || '', manager: form.employment?.manager, monthlySalary: event.target.value } })} /></Form.Group></Col>
              </>}
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
