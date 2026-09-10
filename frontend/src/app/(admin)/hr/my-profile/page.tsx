import PageMetaData from '@/components/PageTitle'
import PdfActionButton from '@/components/PdfActionButton'
import { apiFetch } from '@/helpers/api'
import { downloadIdCardPdf } from '@/helpers/idCard'
import { useAuthStore } from '@/store/authStore'
import type { EmployeeType } from '@/types/hr'
import { useEffect, useState } from 'react'
import { Alert, Badge, Card, CardBody, Spinner, Table } from 'react-bootstrap'

const date = (value?: string) => (value ? new Date(value).toLocaleDateString() : 'Not provided')
const amount = (value: number) => Number(value || 0).toLocaleString(undefined, { maximumFractionDigits: 2 })

const Detail = ({ label, value }: { label: string; value: string }) => <div className="col-sm-6"><div className="border rounded p-3 h-100"><small className="text-muted d-block mb-1">{label}</small><span className="fw-medium text-break">{value}</span></div></div>

const MyProfilePage = () => {
  const token = useAuthStore((state) => state.token)
  const [employee, setEmployee] = useState<EmployeeType>()
  const [error, setError] = useState('')

  useEffect(() => {
    apiFetch<{ data: EmployeeType }>('/hr/employees/me')
      .then((response) => setEmployee(response.data))
      .catch((reason) => setError(reason instanceof Error ? reason.message : 'Unable to load your details'))
  }, [])

  if (!employee) return <>
    <PageMetaData title="My Detail" />
    {error ? <Alert variant="danger">{error}</Alert> : <Card><CardBody className="py-5 text-center text-muted"><Spinner animation="border" size="sm" className="me-2" />Loading your details…</CardBody></Card>}
  </>

  const salary = employee.salary
  const monthlySalary = salary && salary.basic + salary.hra + (salary.allowances || []).reduce((total, allowance) => total + allowance.amount, 0)
  const emergencyContact = employee.emergencyContact?.name
    ? `${employee.emergencyContact.name}${employee.emergencyContact.relation ? ` (${employee.emergencyContact.relation})` : ''}${employee.emergencyContact.phone ? ` · ${employee.emergencyContact.phone}` : ''}`
    : 'Not provided'

  return <>
    <PageMetaData title="My Detail" />
    {error && <Alert variant="danger">{error}</Alert>}

    <Card className="mb-3"><CardBody className="d-flex align-items-center justify-content-between flex-wrap gap-3">
      <div><h4 className="card-title mb-1">My Detail</h4><p className="text-muted mb-0">Your employment information, salary summary, and HR documents in one place.</p></div>
      <Badge bg={employee.status === 'active' ? 'success' : employee.status === 'terminated' ? 'danger' : 'secondary'} className="text-capitalize px-3 py-2">{employee.status}</Badge>
    </CardBody></Card>

    <div className="row g-3 align-items-start">
      <div className="col-lg-4">
        <Card><CardBody className="text-center">
          <div className="mb-3">{employee.photo?.url ? <img src={employee.photo.url} alt={employee.user.name} className="rounded-circle border" style={{ width: 128, height: 128, objectFit: 'cover' }} /> : <div className="rounded-circle bg-primary-subtle text-primary d-inline-flex align-items-center justify-content-center fw-bold fs-1" style={{ width: 128, height: 128 }}>{employee.user.name.slice(0, 1)}</div>}</div>
          <h3 className="mb-1">{employee.user.name}</h3>
          <p className="text-muted mb-4">{employee.designation?.name || 'Job title not assigned'} · {employee.department?.name || 'Department not assigned'}</p>
          <PdfActionButton className="w-100" variant="outline-primary" action={() => downloadIdCardPdf(employee._id, token).catch((reason) => setError(reason instanceof Error ? reason.message : 'Unable to download ID card'))}>Download ID card</PdfActionButton>
        </CardBody></Card>
      </div>

      <div className="col-lg-8">
        <Card className="mb-3"><CardBody>
          <h5 className="mb-1">Work information</h5><p className="text-muted mb-3">Maintained by HR. Contact HR if anything needs updating.</p>
          <div className="row g-3">
            <Detail label="Employee ID" value={employee._id.slice(-8).toUpperCase()} />
            <Detail label="Employment type" value={employee.employeeType === 'site' ? 'Site employee' : 'Office employee'} />
            <Detail label="Department" value={employee.department?.name || 'Not assigned'} />
            <Detail label="Job title" value={employee.designation?.name || 'Not assigned'} />
            <Detail label="Joining date" value={date(employee.joiningDate)} />
            <Detail label="Reporting manager" value={employee.manager?.name || 'Not assigned'} />
          </div>
        </CardBody></Card>

        <Card className="mb-3"><CardBody>
          <h5 className="mb-1">Contact details</h5><p className="text-muted mb-3">Personal details shared with HR.</p>
          <div className="row g-3">
            <Detail label="Email" value={employee.user.email || 'Not provided'} />
            <Detail label="Mobile" value={employee.user.phone || 'Not provided'} />
            <Detail label="Date of birth" value={date(employee.dateOfBirth)} />
            <Detail label="Emergency contact" value={emergencyContact} />
          </div>
        </CardBody></Card>

        <Card className="mb-3"><CardBody>
          <h5 className="mb-1">Salary summary</h5><p className="text-muted mb-3">Your current salary structure as recorded by HR.</p>
          {salary ? <div className="row g-3"><Detail label="Monthly gross" value={amount(monthlySalary || 0)} /><Detail label="Basic salary" value={amount(salary.basic)} /><Detail label="HRA" value={amount(salary.hra)} /><Detail label="CTC" value={amount(salary.ctc)} /></div> : <Alert variant="light" className="mb-0">No salary structure has been added yet.</Alert>}
        </CardBody></Card>

        <Card><CardBody>
          <div className="d-flex justify-content-between align-items-start flex-wrap gap-2 mb-3"><div><h5 className="mb-1">Documents from HR</h5><p className="text-muted mb-0">Offer letters and other documents shared with you.</p></div><Badge bg="light" text="dark">{employee.documents.length} documents</Badge></div>
          <Table responsive className="align-middle mb-0"><thead><tr><th>Document type</th><th>File</th><th>Expiry</th></tr></thead><tbody>{employee.documents.map((document) => <tr key={document.key}><td><Badge bg="secondary">{document.type}</Badge></td><td>{document.url ? <a href={document.url} target="_blank" rel="noreferrer">{document.originalName || 'Open document'}</a> : document.originalName || 'Document unavailable'}</td><td>{date(document.expiresAt)}</td></tr>)}{!employee.documents.length && <tr><td colSpan={3} className="text-center text-muted py-4">No documents have been shared by HR yet.</td></tr>}</tbody></Table>
        </CardBody></Card>
      </div>
    </div>
  </>
}

export default MyProfilePage
