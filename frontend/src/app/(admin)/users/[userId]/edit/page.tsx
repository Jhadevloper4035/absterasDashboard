import PageMetaData from '@/components/PageTitle'
import IconifyIcon from '@/components/wrappers/IconifyIcon'
import { useAuthContext } from '@/context/useAuthContext'
import { apiFetch } from '@/helpers/api'
import { BASIC_APP_MODULES, defaultModulePermissions, moduleLabel, type ModulePermission } from '@/helpers/moduleAccess'
import { useUserManagementStore } from '@/store/userManagementStore'
import type { UserType } from '@/types/auth'
import type { EmployeeType, OrganizationItem } from '@/types/hr'
import { FormEvent, useEffect, useState } from 'react'
import { Alert, Button, Card, CardBody, Col, Form, Row } from 'react-bootstrap'
import { useNavigate, useParams } from 'react-router-dom'

const statuses = ['active', 'inactive', 'invited', 'suspended'] as const
const inventoryModules = ['categories', 'items', 'transactions', 'reports']
type InventoryPermission = { module: string; access: 'none' | 'view' | 'manage' }
const defaultInventoryPermissions = () => inventoryModules.map((module) => ({ module, access: 'none' as const }))

type EditForm = Pick<UserType, 'name' | 'email' | 'phone' | 'workProfile' | 'status' | 'timezone'> & { password: string }
type Employment = { employeeType: 'office' | 'site'; department: string; designation: string; joiningDate: string; dateOfBirth: string }

const EditUserPage = () => {
  const { user } = useAuthContext()
  const { userId = '' } = useParams()
  const navigate = useNavigate()
  const updateUser = useUserManagementStore((state) => state.updateUser)
  const [form, setForm] = useState<EditForm>()
  const [error, setError] = useState('')
  const [saving, setSaving] = useState(false)
  const [departments, setDepartments] = useState<OrganizationItem[]>([])
  const [designations, setDesignations] = useState<OrganizationItem[]>([])
  const [employeeId, setEmployeeId] = useState('')
  const [salaryStructureId, setSalaryStructureId] = useState('')
  const [monthlySalary, setMonthlySalary] = useState('')
  const [employment, setEmployment] = useState<Employment>({ employeeType: 'office', department: '', designation: '', joiningDate: '', dateOfBirth: '' })
  const [inventoryPermissions, setInventoryPermissions] = useState<InventoryPermission[]>(defaultInventoryPermissions)
  const [modulePermissions, setModulePermissions] = useState<ModulePermission[]>(defaultModulePermissions)
  const currentAccessTypes = [user?.role, ...(user?.additionalRoles || []), ...(user?.accessTypes || [])]
  const isSuperadmin = currentAccessTypes.includes('superadmin')

  useEffect(() => {
    apiFetch<{ data: UserType }>(`/users/${userId}`)
      .then(({ data }) => {
        setForm({
          name: data.name,
          email: data.email,
          phone: data.phone || '',
          workProfile: data.workProfile || (data.accessTypes?.includes('employee') ? 'employee' : 'director'),
          status: data.status,
          timezone: data.timezone || 'UTC',
          password: '',
        })
        setModulePermissions(defaultModulePermissions().map((permission) => ({ ...permission, access: data.modulePermissions?.find((item) => item.module === permission.module)?.access || 'none' })))
      })
      .catch((reason) => setError(reason instanceof Error ? reason.message : 'Unable to load user'))
  }, [userId])

  useEffect(() => {
    if (!isSuperadmin) return
    apiFetch<{ data: InventoryPermission[] }>(`/inventory/permissions/${userId}`).then((response) => setInventoryPermissions(response.data)).catch(() => {})
  }, [isSuperadmin, userId])

  useEffect(() => {
    Promise.all([
      apiFetch<{ data: OrganizationItem[] }>('/hr/departments'),
      apiFetch<{ data: OrganizationItem[] }>('/hr/designations'),
      apiFetch<{ data: EmployeeType[] }>('/hr/employees?limit=100'),
    ])
      .then(([departmentResponse, designationResponse, employeeResponse]) => {
        setDepartments(departmentResponse.data)
        setDesignations(designationResponse.data)
        const employee = employeeResponse.data.find((item) => item.user._id === userId)
        if (employee) {
          setEmployeeId(employee._id)
          setEmployment({
            employeeType: employee.employeeType,
            department: employee.department?._id || '',
            designation: employee.designation?._id || '',
            joiningDate: employee.joiningDate.slice(0, 10),
            dateOfBirth: employee.dateOfBirth?.slice(0, 10) || '',
          })
          apiFetch<{ data: EmployeeType }>(`/hr/employees/${employee._id}`)
            .then(({ data }) => {
              setMonthlySalary(String(data.salary?.ctc || ''))
              setSalaryStructureId(data.salary?._id || '')
            })
            .catch(() => {})
        }
      })
      .catch(() => {})
  }, [userId])

  const save = async (event: FormEvent) => {
    event.preventDefault()
    if (!form) return
    if (
      form.workProfile === 'employee' &&
      (!employment.department || !employment.designation || !employment.joiningDate || !Number(monthlySalary))
    )
      return setError('Department, designation, joining date, and monthly salary are required')
    if (form.password && (form.password.length < 8 || !/[a-z]/i.test(form.password) || !/\d/.test(form.password)))
      return setError('Password must be at least 8 characters and include letters and numbers')

    setError('')
    setSaving(true)
    try {
      await updateUser(userId, {
        name: form.name.trim(),
        email: form.email.trim(),
        phone: form.phone?.trim(),
        workProfile: form.workProfile,
        status: form.status,
        timezone: form.timezone?.trim() || 'UTC',
        modulePermissions,
        ...(form.password ? { password: form.password } : {}),
      })
      if (isSuperadmin) await apiFetch(`/inventory/permissions/${userId}`, { method: 'PUT', body: JSON.stringify({ permissions: inventoryPermissions }) })
      if (form.workProfile === 'employee') {
        const response = employeeId
          ? await apiFetch<{ data: EmployeeType }>(`/hr/employees/${employeeId}`, { method: 'PATCH', body: JSON.stringify(employment) })
          : await apiFetch<{ data: EmployeeType }>('/hr/employees', { method: 'POST', body: JSON.stringify({ user: userId, ...employment }) })
        if (!employeeId) setEmployeeId(response.data._id)
        await apiFetch(salaryStructureId ? `/hr/payroll/salary-structures/${salaryStructureId}` : '/hr/payroll/salary-structures', {
          method: salaryStructureId ? 'PATCH' : 'POST',
          body: JSON.stringify({
            employee: response.data._id,
            ctc: Number(monthlySalary),
            basic: Number(monthlySalary),
            hra: 0,
            effectiveFrom: employment.joiningDate,
          }),
        })
      }
      navigate('/users')
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : 'Unable to update user')
    } finally {
      setSaving(false)
    }
  }

  return (
    <>
      <PageMetaData title="Edit User" />
      <Card>
        <CardBody>
          {error && <Alert variant="danger">{error}</Alert>}
          {!form ? (
            <p className="mb-0">Loading user…</p>
          ) : (
            <Form onSubmit={save}>
              <div className="d-flex flex-wrap align-items-center justify-content-between gap-2 mb-4">
                <div>
                  <h4 className="card-title mb-1">Edit User</h4>
                  <p className="text-muted mb-0">Update login details, work profile, and sidebar access.</p>
                </div>
              </div>
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
                    <Form.Label>
                      New Password <span className="text-muted">(optional)</span>
                    </Form.Label>
                    <Form.Control
                      minLength={8}
                      type="password"
                      value={form.password}
                      onChange={(event) => setForm({ ...form, password: event.target.value })}
                      placeholder="Leave blank to keep current password"
                    />
                    <Form.Text>Letters and numbers required.</Form.Text>
                  </Form.Group>
                </Col>
                <Col xl={6}>
                  <Form.Group>
                    <Form.Label>Work profile</Form.Label>
                    <Form.Select value={form.workProfile} onChange={(event) => {
                      const workProfile = event.target.value as NonNullable<UserType['workProfile']>
                      setForm({ ...form, workProfile })
                      if (workProfile === 'director') setModulePermissions((current) => current.map((permission) => permission.module === 'hr' ? { ...permission, access: 'none' } : permission))
                    }}>
                      <option value="employee">Employee</option>
                      <option value="director">Director</option>
                    </Form.Select>
                    <Form.Text>Only employees receive an HR record, salary, and leave data.</Form.Text>
                  </Form.Group>
                </Col>
                <Col xs={12}>
                  <details open>
                    <summary className="fw-medium">Sidebar access</summary>
                    <Form.Text>Todo and Notifications are enabled for every user. Grant access to the remaining sidebar labels.</Form.Text>
                    {modulePermissions.filter((permission) => !BASIC_APP_MODULES.includes(permission.module as (typeof BASIC_APP_MODULES)[number])).map((permission) => (
                      <div className="d-flex align-items-center gap-2 mt-2" key={permission.module}>
                        <span className="flex-grow-1">{moduleLabel(permission.module)}</span>
                        <Form.Select disabled={form.workProfile === 'director' && permission.module === 'hr'} style={{ maxWidth: 140 }} value={permission.access} onChange={(event) => setModulePermissions((current) => current.map((item) => item.module === permission.module ? { ...item, access: event.target.value as ModulePermission['access'] } : item))}>
                          <option value="none">None</option><option value="view">View</option><option value="manage">Manage</option>
                        </Form.Select>
                      </div>
                    ))}
                  </details>
                </Col>
                {isSuperadmin && <Col xs={12}><details><summary className="fw-medium">Inventory access</summary><Form.Text>Separate from roles and HR access.</Form.Text>{inventoryPermissions.map((permission) => <div className="d-flex align-items-center gap-2 mt-2" key={permission.module}><span className="flex-grow-1 text-capitalize">{permission.module}</span><Form.Select style={{ maxWidth: 140 }} value={permission.access} onChange={(event) => setInventoryPermissions((current) => current.map((item) => item.module === permission.module ? { ...item, access: event.target.value as InventoryPermission['access'] } : item))}><option value="none">None</option><option value="view">View</option><option value="manage">Manage</option></Form.Select></div>)}</details></Col>}
                {form.workProfile === 'employee' && (
                  <>
                    <Col xs={12}>
                      <hr className="my-2" />
                      <h5 className="mb-0">Employment details</h5>
                    </Col>
                    <Col xl={3}>
                      <Form.Group>
                        <Form.Label>Employee Type</Form.Label>
                        <Form.Select
                          value={employment.employeeType}
                          onChange={(event) => setEmployment({ ...employment, employeeType: event.target.value as 'office' | 'site' })}>
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
                          value={employment.department}
                          onChange={(event) => setEmployment({ ...employment, department: event.target.value, designation: '' })}>
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
                          disabled={!employment.department}
                          value={employment.designation}
                          onChange={(event) => setEmployment({ ...employment, designation: event.target.value })}>
                          <option value="">{employment.department ? 'Select designation' : 'Select department first'}</option>
                          {designations.filter((item) => item.department === employment.department).map((item) => (
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
                          value={employment.joiningDate}
                          onChange={(event) => setEmployment({ ...employment, joiningDate: event.target.value })}
                        />
                      </Form.Group>
                    </Col>
                    <Col xl={3}>
                      <Form.Group>
                        <Form.Label>Date of Birth</Form.Label>
                        <Form.Control type="date" value={employment.dateOfBirth} onChange={(event) => setEmployment({ ...employment, dateOfBirth: event.target.value })} />
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
                    <Form.Label>Monthly Salary</Form.Label>
                    <Form.Control
                      required
                      min="0.01"
                      step="0.01"
                      type="number"
                      value={monthlySalary}
                      onChange={(event) => setMonthlySalary(event.target.value)}
                    />
                    <Form.Text>Enter the full amount, for example 50,000.</Form.Text>
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
                <Button type="button" variant="light" onClick={() => navigate('/users')} disabled={saving}>
                  Cancel
                </Button>
                <Button type="submit" disabled={saving}>
                  <IconifyIcon icon="bx:save" className="me-1" />
                  Save Changes
                </Button>
              </div>
            </Form>
          )}
        </CardBody>
      </Card>
    </>
  )
}

export default EditUserPage
