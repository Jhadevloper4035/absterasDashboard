import PageMetaData from '@/components/PageTitle'
import IconifyIcon from '@/components/wrappers/IconifyIcon'
import { useAuthContext } from '@/context/useAuthContext'
import { apiFetch } from '@/helpers/api'
import { defaultModulePermissions, hasFullAppAccess, moduleLabel, type ModulePermission } from '@/helpers/moduleAccess'
import { type CreateUserPayload, useUserManagementStore } from '@/store/userManagementStore'
import type { UserType } from '@/types/auth'
import type { OrganizationItem } from '@/types/hr'
import { FormEvent, useEffect, useState } from 'react'
import { Alert, Button, Card, CardBody, Col, Form, Row } from 'react-bootstrap'
import { toast } from 'react-toastify'
import { useNavigate } from 'react-router-dom'

const statuses = ['active', 'inactive', 'invited', 'suspended'] as const
const defaultTimezone = Intl.DateTimeFormat().resolvedOptions().timeZone || 'UTC'

const emptyForm: CreateUserPayload = {
  name: '',
  email: '',
  phone: '',
  password: '',
  workProfile: 'employee',
  modulePermissions: defaultModulePermissions(),
  status: 'active',
  timezone: defaultTimezone,
}

const CreateUserPage = () => {
  const { user } = useAuthContext()
  const navigate = useNavigate()
  const loading = useUserManagementStore((state) => state.loading)
  const storeError = useUserManagementStore((state) => state.error)
  const createUserInStore = useUserManagementStore((state) => state.createUser)
  const [form, setForm] = useState(emptyForm)
  const [message, setMessage] = useState('')
  const [error, setError] = useState('')
  const [departments, setDepartments] = useState<OrganizationItem[]>([])
  const [designations, setDesignations] = useState<OrganizationItem[]>([])
  const canManageUsers = hasFullAppAccess(user)

  useEffect(() => {
    if (!canManageUsers) return
    Promise.all([apiFetch<{ data: OrganizationItem[] }>('/hr/departments'), apiFetch<{ data: OrganizationItem[] }>('/hr/designations')])
      .then(([departmentResponse, designationResponse]) => {
        setDepartments(departmentResponse.data)
        setDesignations(designationResponse.data)
      })
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
      const employment = form.workProfile === 'employee' ? form.employment : undefined
      if (
        form.workProfile === 'employee' &&
        (!employment?.department || !employment.designation || !employment.joiningDate || !Number(employment.monthlySalary))
      ) {
        setError('Department, designation, joining date, and monthly salary are required')
        return
      }
      const createdUser = await createUserInStore({
        ...form,
        employment,
      })
      toast.success('User created successfully')
      navigate(`/users/${createdUser._id}/edit`)
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
              <p className="text-muted mb-0">Add login details, work profile, and sidebar access.</p>
            </div>
          </div>
          {(error || storeError) && <Alert variant="danger">{error || storeError}</Alert>}
          {message && <Alert variant="success">{message}</Alert>}
          <Form onSubmit={createUser}>
            <h5 className="mb-3">Account details</h5>
            <Row className="g-3">
              <Col xl={6}>
                <Form.Group>
                  <Form.Label>Name</Form.Label>
                  <Form.Control
                    required
                    value={form.name}
                    onChange={(event) => setForm({ ...form, name: event.target.value })}
                    placeholder="Full name"
                  />
                </Form.Group>
              </Col>
              <Col xl={6}>
                <Form.Group>
                  <Form.Label>Email</Form.Label>
                  <Form.Control
                    required
                    type="email"
                    value={form.email}
                    onChange={(event) => setForm({ ...form, email: event.target.value })}
                    placeholder="name@company.com"
                  />
                </Form.Group>
              </Col>
              <Col xl={6}>
                <Form.Group>
                  <Form.Label>Mobile Number</Form.Label>
                  <Form.Control
                    required
                    type="tel"
                    inputMode="tel"
                    value={form.phone}
                    onChange={(event) => setForm({ ...form, phone: event.target.value })}
                    placeholder="10-digit mobile number"
                  />
                </Form.Group>
              </Col>
              <Col xl={6}>
                <Form.Group>
                  <Form.Label>Password</Form.Label>
                  <Form.Control
                    required
                    minLength={8}
                    type="password"
                    value={form.password}
                    onChange={(event) => setForm({ ...form, password: event.target.value })}
                    placeholder="At least 8 characters"
                  />
                  <Form.Text>Letters and numbers required.</Form.Text>
                </Form.Group>
              </Col>
              <Col xl={6}>
                <Form.Group>
                  <Form.Label>Work profile</Form.Label>
                  <Form.Select value={form.workProfile} onChange={(event) => {
                    const workProfile = event.target.value as NonNullable<UserType['workProfile']>
                    setForm({ ...form, workProfile, employment: workProfile === 'employee' ? form.employment : undefined })
                  }}>
                    <option value="superadmin">Superadmin</option>
                    <option value="admin">Admin</option>
                    <option value="client">Client</option>
                    <option value="employee">Employee</option>
                    <option value="director">Director</option>
                  </Form.Select>
                  <Form.Text>Only employees receive an HR record, salary, and leave data.</Form.Text>
                </Form.Group>
              </Col>
              <Col xs={12}>
                <details open>
                  <summary className="fw-medium">Sidebar access</summary>
                  <Form.Text>Grant access to each sidebar module.</Form.Text>
                  {(form.modulePermissions || []).map((permission) => (
                    <div className="d-flex align-items-center gap-2 mt-2" key={permission.module}>
                      <span className="flex-grow-1">{moduleLabel(permission.module)}</span>
                      <Form.Select style={{ maxWidth: 140 }} value={permission.access} onChange={(event) => setForm({ ...form, modulePermissions: form.modulePermissions?.map((item) => item.module === permission.module ? { ...item, access: event.target.value as ModulePermission['access'] } : item) })}>
                        <option value="none">None</option><option value="view">View</option><option value="manage">Manage</option>
                      </Form.Select>
                    </div>
                  ))}
                </details>
              </Col>
              {form.workProfile === 'employee' && (
                <>
                  <Col xs={12}>
                    <hr className="my-2" />
                    <h5 className="mb-0">Employment details</h5>
                    <Form.Text>Choose the department, designation, and monthly salary.</Form.Text>
                  </Col>
                  <Col xl={3}>
                    <Form.Group>
                      <Form.Label>Employee Type</Form.Label>
                      <Form.Select
                        value={form.employment?.employeeType || 'office'}
                        onChange={(event) =>
                          setForm({
                            ...form,
                            employment: {
                              ...form.employment,
                              employeeType: event.target.value as 'office' | 'site',
                              department: form.employment?.department || '',
                              designation: form.employment?.designation || '',
                              joiningDate: form.employment?.joiningDate || '',
                              dateOfBirth: form.employment?.dateOfBirth,
                              manager: form.employment?.manager,
                              monthlySalary: form.employment?.monthlySalary,
                            },
                          })
                        }>
                        <option value="office">Office</option>
                        <option value="site">Site</option>
                      </Form.Select>
                    </Form.Group>
                  </Col>
                  <Col xl={3}>
                    <Form.Group>
                      <Form.Label>Department</Form.Label>
                      <Form.Select
                        required
                        value={form.employment?.department || ''}
                        onChange={(event) =>
                          setForm({
                            ...form,
                            employment: {
                              employeeType: form.employment?.employeeType || 'office',
                              department: event.target.value,
                              designation: '',
                              joiningDate: form.employment?.joiningDate || '',
                              dateOfBirth: form.employment?.dateOfBirth,
                              manager: form.employment?.manager,
                              monthlySalary: form.employment?.monthlySalary,
                            },
                          })
                        }>
                        <option value="">Select department</option>
                        {departments.map((item) => (
                          <option key={item._id} value={item._id}>
                            {item.name}
                          </option>
                        ))}
                      </Form.Select>
                    </Form.Group>
                  </Col>
                  <Col xl={3}>
                    <Form.Group>
                      <Form.Label>Designation</Form.Label>
                      <Form.Select
                        required
                        disabled={!form.employment?.department}
                        value={form.employment?.designation || ''}
                        onChange={(event) =>
                          setForm({
                            ...form,
                            employment: {
                              employeeType: form.employment?.employeeType || 'office',
                              department: form.employment?.department || '',
                              designation: event.target.value,
                              joiningDate: form.employment?.joiningDate || '',
                              dateOfBirth: form.employment?.dateOfBirth,
                              manager: form.employment?.manager,
                              monthlySalary: form.employment?.monthlySalary,
                            },
                          })
                        }>
                        <option value="">{form.employment?.department ? 'Select designation' : 'Select department first'}</option>
                        {designations.filter((item) => item.department === form.employment?.department).map((item) => (
                          <option key={item._id} value={item._id}>
                            {item.name}
                          </option>
                        ))}
                      </Form.Select>
                    </Form.Group>
                  </Col>
                  <Col xl={3}>
                    <Form.Group>
                      <Form.Label>Joining Date</Form.Label>
                      <Form.Control
                        required
                        type="date"
                        value={form.employment?.joiningDate || ''}
                        onChange={(event) =>
                          setForm({
                            ...form,
                            employment: {
                              employeeType: form.employment?.employeeType || 'office',
                              department: form.employment?.department || '',
                              designation: form.employment?.designation || '',
                              joiningDate: event.target.value,
                              dateOfBirth: form.employment?.dateOfBirth,
                              manager: form.employment?.manager,
                              monthlySalary: form.employment?.monthlySalary,
                            },
                          })
                        }
                      />
                    </Form.Group>
                  </Col>
                  <Col xl={3}>
                    <Form.Group>
                      <Form.Label>Date of Birth</Form.Label>
                      <Form.Control
                        type="date"
                        value={form.employment?.dateOfBirth || ''}
                        onChange={(event) =>
                          setForm({
                            ...form,
                            employment: {
                              employeeType: form.employment?.employeeType || 'office',
                              department: form.employment?.department || '',
                              designation: form.employment?.designation || '',
                              joiningDate: form.employment?.joiningDate || '',
                              dateOfBirth: event.target.value,
                              manager: form.employment?.manager,
                              monthlySalary: form.employment?.monthlySalary,
                            },
                          })
                        }
                      />
                    </Form.Group>
                  </Col>
                  <Col xl={3}>
                    <Form.Group>
                      <Form.Label>Monthly salary</Form.Label>
                      <Form.Control
                        required
                        min="0.01"
                        step="0.01"
                        type="number"
                        value={form.employment?.monthlySalary || ''}
                        onChange={(event) =>
                          setForm({
                            ...form,
                            employment: {
                              employeeType: form.employment?.employeeType || 'office',
                              department: form.employment?.department || '',
                              designation: form.employment?.designation || '',
                              joiningDate: form.employment?.joiningDate || '',
                              dateOfBirth: form.employment?.dateOfBirth,
                              manager: form.employment?.manager,
                              monthlySalary: event.target.value,
                            },
                          })
                        }
                      />
                      <Form.Text>Enter the full amount, for example 50,000.</Form.Text>
                    </Form.Group>
                  </Col>
                </>
              )}
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
