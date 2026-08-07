import PageMetaData from '@/components/PageTitle'
import { apiFetch } from '@/helpers/api'
import { generateIdCardPdf } from '@/helpers/idCard'
import { uploadMultipartFiles } from '@/helpers/upload'
import { useAuthStore } from '@/store/authStore'
import type { EmployeeType } from '@/types/hr'
import { ChangeEvent, useEffect, useState } from 'react'
import { Alert, Badge, Button, Card, CardBody, Form, Table } from 'react-bootstrap'
import Swal from 'sweetalert2'
import { useParams } from 'react-router-dom'

type Upload = { key: string; contentType: string; originalName?: string; size: number; checksum: string; attachmentToken: string }
const documentTypes = ['Aadhaar Card', 'PAN Card', 'Degree Certificate', 'Passport', 'Driving Licence', 'Other']

const EmployeeDetailPage = () => {
  const { employeeId = '' } = useParams()
  const token = useAuthStore((state) => state.token)
  const [employee, setEmployee] = useState<EmployeeType>()
  const [documentType, setDocumentType] = useState(documentTypes[0])
  const [error, setError] = useState('')
  const [saving, setSaving] = useState(false)
  const load = () =>
    apiFetch<{ data: EmployeeType }>(`/hr/employees/${employeeId}`)
      .then((response) => setEmployee(response.data))
      .catch((reason) => setError(reason instanceof Error ? reason.message : 'Unable to load employee'))
  useEffect(() => {
    load()
  }, [employeeId])
  const update = async (patch: Partial<EmployeeType>) => {
    if (!employee) return
    setSaving(true)
    setError('')
    try {
      const response = await apiFetch<{ data: EmployeeType }>(`/hr/employees/${employee._id}`, { method: 'PATCH', body: JSON.stringify(patch) })
      setEmployee(response.data)
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : 'Unable to update employee')
    } finally {
      setSaving(false)
    }
  }
  const changeStatus = async (status: EmployeeType['status']) => {
    if (!employee || status === employee.status) return
    if (
      status === 'terminated' &&
      !(
        await Swal.fire({
          icon: 'warning',
          title: `Terminate ${employee.user.name}?`,
          text: 'This immediately suspends their user account and revokes all active sessions.',
          showCancelButton: true,
          confirmButtonText: 'Terminate and revoke access',
          confirmButtonColor: '#dc3545',
          cancelButtonText: 'Cancel',
        })
      ).isConfirmed
    )
      return
    await update({ status, ...(status === 'active' ? {} : { lastWorkingDate: new Date().toISOString().slice(0, 10) }) })
  }
  const uploadPhoto = async (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0]
    if (!file || !token) return
    setSaving(true)
    try {
      const [photo] = await uploadMultipartFiles<Upload>([file], token)
      await update({ photo })
      event.target.value = ''
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : 'Unable to upload photo')
    } finally {
      setSaving(false)
    }
  }
  const uploadDocuments = async (event: ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(event.target.files || [])
    if (!files.length || !employee || !token) return
    setSaving(true)
    try {
      const filesToAdd = await uploadMultipartFiles<Upload>(files, token)
      await update({ documents: [...employee.documents, ...filesToAdd.map((file) => ({ ...file, type: documentType }))] })
      event.target.value = ''
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : 'Unable to upload documents')
    } finally {
      setSaving(false)
    }
  }
  if (!employee)
    return (
      <>
        <PageMetaData title="Employee" />
        {error ? <Alert variant="danger">{error}</Alert> : <div>Loading…</div>}
      </>
    )
  const salary = employee.salary
  const monthlySalary = salary && salary.basic + salary.hra + (salary.allowances || []).reduce((total, allowance) => total + allowance.amount, 0)
  return (
    <>
      <PageMetaData title={employee.user.name} />
      {error && <Alert variant="danger">{error}</Alert>}
      <div className="row g-3 align-items-start">
        <div className="col-lg-4">
          <Card>
            <CardBody className="text-center">
              <div className="mb-3">
                {employee.photo?.url ? (
                  <img
                    src={employee.photo.url}
                    alt={employee.user.name}
                    className="rounded-circle border"
                    style={{ width: 132, height: 132, objectFit: 'cover' }}
                  />
                ) : (
                  <div
                    className="rounded-circle bg-primary-subtle text-primary d-inline-flex align-items-center justify-content-center fw-bold fs-1"
                    style={{ width: 132, height: 132 }}>
                    {employee.user.name.slice(0, 1)}
                  </div>
                )}
              </div>
              <h3 className="mb-1">{employee.user.name}</h3>
              <p className="text-muted mb-3">
                {employee.designation?.name || 'No job title'} · {employee.department?.name || 'No department'}
              </p>
              <Badge bg={employee.status === 'active' ? 'success' : employee.status === 'terminated' ? 'danger' : 'secondary'}>
                {employee.status}
              </Badge>
              <div className="border-top mt-4 pt-3 text-start">
                <Form.Label>Profile photo</Form.Label>
                <Form.Control disabled={saving} type="file" accept="image/jpeg,image/png,image/webp" onChange={uploadPhoto} />
                <Form.Text>Used on the ID card.</Form.Text>
              </div>
              <Button className="mt-3" variant="outline-primary" onClick={() => generateIdCardPdf(employee)}>
                Print ID card
              </Button>
            </CardBody>
          </Card>
        </div>
        <div className="col-lg-8">
          <Card className="mb-3">
            <CardBody>
              <div className="d-flex justify-content-between align-items-start flex-wrap gap-3 mb-3">
                <div>
                  <h4 className="card-title mb-1">Employment information</h4>
                  <p className="text-muted mb-0">
                    {employee.user.email} · {employee.user.phone}
                  </p>
                </div>
                <Form.Select
                  aria-label="Employment status"
                  disabled={saving}
                  value={employee.status}
                  onChange={(event) => changeStatus(event.target.value as EmployeeType['status'])}
                  style={{ minWidth: 220 }}>
                  <option value="active">Active</option>
                  <option value="resigned">Resigned</option>
                  <option value="terminated">Terminate & revoke access</option>
                </Form.Select>
              </div>
              <dl className="row mb-0 border-top pt-3">
                <dt className="col-sm-4 text-muted">Department</dt>
                <dd className="col-sm-8">{employee.department?.name || '-'}</dd>
                <dt className="col-sm-4 text-muted">Job title</dt>
                <dd className="col-sm-8">{employee.designation?.name || '-'}</dd>
                <dt className="col-sm-4 text-muted">Joining date</dt>
                <dd className="col-sm-8">{new Date(employee.joiningDate).toLocaleDateString()}</dd>
                <dt className="col-sm-4 text-muted">Manager</dt>
                <dd className="col-sm-8">{employee.manager?.name || '-'}</dd>
                <dt className="col-sm-4 text-muted">Account access</dt>
                <dd className="col-sm-8">
                  {employee.status === 'terminated' ? <span className="text-danger">Revoked — cannot log in</span> : 'Active'}
                </dd>
              </dl>
            </CardBody>
          </Card>
          <Card className="mb-3">
            <CardBody>
              <h4 className="card-title mb-3">Monthly salary</h4>
              {salary ? (
                <>
                  <div className="row g-3">
                    <div className="col-sm-4">
                      <small className="text-muted d-block">Monthly gross</small>
                      <strong className="fs-4">{monthlySalary}</strong>
                    </div>
                    <div className="col-sm-4">
                      <small className="text-muted d-block">Basic salary</small>
                      <strong className="fs-4">{salary.basic}</strong>
                    </div>
                    <div className="col-sm-4">
                      <small className="text-muted d-block">CTC</small>
                      <strong className="fs-4">{salary.ctc}</strong>
                    </div>
                  </div>
                  <div className="border-top mt-3 pt-3 small text-muted">
                    Effective from {new Date(salary.effectiveFrom).toLocaleDateString()} · HRA {salary.hra}
                  </div>
                </>
              ) : (
                <p className="text-muted mb-0">No salary structure has been added.</p>
              )}
            </CardBody>
          </Card>
          <Card>
            <CardBody>
              <div className="d-flex justify-content-between align-items-start flex-wrap gap-2 mb-3">
                <div>
                  <h4 className="card-title mb-1">Employee documents</h4>
                  <p className="text-muted mb-0">Upload Aadhaar, PAN, degrees, or other employment documents.</p>
                </div>
                <Badge bg="light" text="dark">
                  {employee.documents.length} documents
                </Badge>
              </div>
            <div className="row g-3 align-items-start mb-4">
                <div className="col-md-4">
                  <Form.Label>Document type</Form.Label>
                  <Form.Select value={documentType} onChange={(event) => setDocumentType(event.target.value)}>
                    {documentTypes.map((type) => (
                      <option key={type}>{type}</option>
                    ))}
                  </Form.Select>
                </div>
                <div className="col-md-8">
                  <Form.Label>Select one or more files</Form.Label>
                  <Form.Control disabled={saving} multiple type="file" accept=".pdf,image/jpeg,image/png,image/webp" onChange={uploadDocuments} />
                  <Form.Text>PDF, JPG, PNG, or WebP; maximum 10 MB each.</Form.Text>
                </div>
              </div>
              <Table responsive className="align-middle mb-0">
                <thead>
                  <tr>
                    <th>Type</th>
                    <th>File</th>
                    <th>Expiry</th>
                  </tr>
                </thead>
                <tbody>
                  {employee.documents.map((document) => (
                    <tr key={document.key}>
                      <td>
                        <Badge bg="secondary">{document.type}</Badge>
                      </td>
                      <td>
                        {document.url ? (
                          <a href={document.url} target="_blank" rel="noreferrer">
                            {document.originalName || 'Open document'}
                          </a>
                        ) : (
                          document.originalName || 'Document'
                        )}
                      </td>
                      <td>{document.expiresAt ? new Date(document.expiresAt).toLocaleDateString() : '-'}</td>
                    </tr>
                  ))}
                  {!employee.documents.length && (
                    <tr>
                      <td colSpan={3} className="text-center text-muted py-4">
                        No documents uploaded yet.
                      </td>
                    </tr>
                  )}
                </tbody>
              </Table>
            </CardBody>
          </Card>
        </div>
      </div>
    </>
  )
}

export default EmployeeDetailPage
