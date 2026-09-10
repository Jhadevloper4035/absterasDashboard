import PageMetaData from '@/components/PageTitle'
import { apiFetch } from '@/helpers/api'
import { uploadMultipartFiles } from '@/helpers/upload'
import { useAuthStore } from '@/store/authStore'
import type { EmployeeType } from '@/types/hr'
import { type ChangeEvent, type FormEvent, useEffect, useRef, useState } from 'react'
import { Alert, Badge, Button, Card, CardBody, Form, Table } from 'react-bootstrap'

type Receipt = { key: string; contentType: string; originalName?: string; url?: string; size: number; checksum: string; attachmentToken: string }
type Claim = { _id: string; category: string; amount: number; note: string; status: string; receipts: Receipt[]; createdAt: string; decisionNote?: string; employee?: { user?: { name: string } } }

const currentMonth = () => new Date().toISOString().slice(0, 7)
const statusVariant = (status: string) => status === 'approved' ? 'success' : status === 'rejected' ? 'danger' : 'warning'
const amountText = (amount: number) => Number(amount || 0).toLocaleString(undefined, { maximumFractionDigits: 2 })

const ExpensesPage = () => {
  const token = useAuthStore((state) => state.token)
  const user = useAuthStore((state) => state.user)
  const fileInput = useRef<HTMLInputElement>(null)
  const [claims, setClaims] = useState<Claim[]>([])
  const [employees, setEmployees] = useState<EmployeeType[]>([])
  const [paidBy, setPaidBy] = useState('')
  const [category, setCategory] = useState('')
  const [amount, setAmount] = useState('')
  const [note, setNote] = useState('')
  const [files, setFiles] = useState<File[]>([])
  const [month, setMonth] = useState(currentMonth())
  const [error, setError] = useState('')
  const [success, setSuccess] = useState('')
  const [saving, setSaving] = useState(false)

  const isEmployee = user?.workProfile === 'employee' || (!user?.workProfile && user?.accessTypes?.includes('employee'))
  const canChooseEmployee = !isEmployee && employees.length > 0
  const load = () => apiFetch<{ data: Claim[] }>(`/hr/expenses?month=${month}`).then((response) => setClaims(response.data)).catch((value) => setError(value instanceof Error ? value.message : 'Unable to load reimbursement requests'))

  useEffect(() => { load() }, [month])
  useEffect(() => {
    if (isEmployee) return
    apiFetch<{ data: EmployeeType[] }>('/hr/expenses/employees?limit=100')
      .then((response) => setEmployees(response.data.filter((employee) => employee.status === 'active')))
      .catch(() => {})
  }, [isEmployee])

  const selectFiles = (event: ChangeEvent<HTMLInputElement>) => {
    const selected = Array.from(event.target.files || []).filter((file) => file.type.startsWith('image/')).slice(0, 5)
    setFiles(selected)
    if (event.target.files?.length && !selected.length) setError('Choose JPEG, PNG, or WebP payment screenshots.')
  }

  const submit = async (event: FormEvent) => {
    event.preventDefault()
    if (!token || !files.length) {
      setError('Add at least one payment screenshot before submitting.')
      return
    }

    setSaving(true)
    setError('')
    setSuccess('')
    try {
      const receipts = await uploadMultipartFiles<Receipt>(files, token)
      await apiFetch('/hr/expenses', { method: 'POST', body: JSON.stringify({ employee: paidBy || undefined, category, amount: Number(amount), note, receipts }) })
      setCategory('')
      setAmount('')
      setNote('')
      setFiles([])
      if (fileInput.current) fileInput.current.value = ''
      setSuccess('Your reimbursement request was sent to HR.')
      await load()
    } catch (value) {
      setError(value instanceof Error ? value.message : 'Unable to submit reimbursement request')
    } finally {
      setSaving(false)
    }
  }

  return <>
    <PageMetaData title="Reimbursements" />
    <Card className="mb-3">
      <CardBody>
        <h4 className="card-title mb-1">Claim a reimbursement</h4>
        <p className="text-muted mb-0">Add what you paid for, the amount, and a clear payment screenshot. HR will review your request.</p>
      </CardBody>
    </Card>

    <Card className="mb-4">
      <CardBody>
        <div className="row g-3 mb-3">
          <div className="col-md-4"><div className="border rounded p-3 h-100"><strong>1. Add expense details</strong><div className="text-muted small mt-1">Choose a category and enter the amount paid.</div></div></div>
          <div className="col-md-4"><div className="border rounded p-3 h-100"><strong>2. Upload proof</strong><div className="text-muted small mt-1">Attach up to five payment screenshots.</div></div></div>
          <div className="col-md-4"><div className="border rounded p-3 h-100"><strong>3. Track the decision</strong><div className="text-muted small mt-1">See pending, approved, or rejected requests below.</div></div></div>
        </div>
        {error && <Alert variant="danger">{error}</Alert>}
        {success && <Alert variant="success">{success}</Alert>}
        <Form onSubmit={submit} className="row g-3">
          {canChooseEmployee && <div className="col-md-6"><Form.Label>Employee who paid</Form.Label><Form.Select required value={paidBy} onChange={(event) => setPaidBy(event.target.value)}><option value="">Choose an employee</option>{employees.map((employee) => <option key={employee._id} value={employee._id}>{employee.user.name}</option>)}</Form.Select></div>}
          {!canChooseEmployee && <div className="col-md-6"><Form.Label>Submitted by</Form.Label><Form.Control value={user?.name || 'Current employee'} disabled /></div>}
          <div className="col-md-6"><Form.Label>Expense category</Form.Label><Form.Control required value={category} onChange={(event) => setCategory(event.target.value)} placeholder="For example: Local travel" /></div>
          <div className="col-md-4"><Form.Label>Amount paid</Form.Label><Form.Control required min="0.01" step="0.01" type="number" inputMode="decimal" value={amount} onChange={(event) => setAmount(event.target.value)} placeholder="0.00" /></div>
          <div className="col-md-8"><Form.Label>Payment screenshot</Form.Label><Form.Control ref={fileInput} required multiple accept="image/jpeg,image/png,image/webp" type="file" onChange={selectFiles} /><Form.Text>{files.length ? `${files.length} screenshot${files.length === 1 ? '' : 's'} ready: ${files.map((file) => file.name).join(', ')}` : 'JPEG, PNG, or WebP. You can add up to five images.'}</Form.Text></div>
          <div className="col-12"><Form.Label>What was this payment for?</Form.Label><Form.Control required as="textarea" rows={3} value={note} onChange={(event) => setNote(event.target.value)} placeholder="Briefly explain the business purpose of this expense." /></div>
          <div className="col-12 d-flex justify-content-end"><Button type="submit" disabled={saving || !files.length}>{saving ? 'Submitting request…' : 'Submit reimbursement request'}</Button></div>
        </Form>
      </CardBody>
    </Card>

    <Card>
      <CardBody>
        <div className="d-flex justify-content-between align-items-center gap-3 flex-wrap mb-3">
          <div><h4 className="card-title mb-1">{canChooseEmployee ? 'Reimbursement requests' : 'My reimbursement requests'}</h4><p className="text-muted mb-0">Review the latest status of requests submitted in the selected month.</p></div>
          <Form.Group><Form.Label className="visually-hidden">Request month</Form.Label><Form.Control aria-label="Request month" type="month" value={month} onChange={(event) => setMonth(event.target.value)} /></Form.Group>
        </div>
        <Table responsive className="align-middle mb-0">
          <thead><tr><th>Expense</th><th className="d-none d-md-table-cell">Description</th><th>Amount</th><th>Proof</th><th>Status</th><th className="d-none d-md-table-cell">Submitted</th></tr></thead>
          <tbody>{claims.map((claim) => <tr key={claim._id}><td><div className="fw-medium">{claim.category}</div>{claim.employee?.user?.name && <small className="text-muted">{claim.employee.user.name}</small>}</td><td className="d-none d-md-table-cell text-wrap" style={{ minWidth: 220 }}>{claim.note}</td><td>{amountText(claim.amount)}</td><td>{claim.receipts.map((receipt, index) => <a className="d-block" key={receipt.key} target="_blank" rel="noreferrer" href={receipt.url}>{receipt.originalName || `Screenshot ${index + 1}`}</a>)}</td><td><Badge bg={statusVariant(claim.status)} text={claim.status === 'pending' ? 'dark' : undefined}>{claim.status}</Badge>{claim.decisionNote && <small className="d-block text-muted mt-1">{claim.decisionNote}</small>}</td><td className="d-none d-md-table-cell">{new Date(claim.createdAt).toLocaleDateString()}</td></tr>)}{!claims.length && <tr><td colSpan={6} className="text-center text-muted py-4">No reimbursement requests for this month yet.</td></tr>}</tbody>
        </Table>
      </CardBody>
    </Card>
  </>
}

export default ExpensesPage
