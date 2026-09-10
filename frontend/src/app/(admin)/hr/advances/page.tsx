import PageMetaData from '@/components/PageTitle'
import { apiFetch } from '@/helpers/api'
import { type FormEvent, useEffect, useMemo, useState } from 'react'
import { Alert, Badge, Button, Card, CardBody, Col, Form, Row, Table } from 'react-bootstrap'

type Advance = { _id: string; amount: number; deductedAmount: number; reason: string; status: string; createdAt: string; deductionSchedule: { monthlyAmount: number } }

const money = (amount: number) => Number(amount || 0).toLocaleString(undefined, { maximumFractionDigits: 2 })
const statusVariant = (status: string) => status === 'approved' ? 'success' : status === 'rejected' ? 'danger' : status === 'settled' ? 'secondary' : 'warning'

const MyAdvancesPage = () => {
  const [advances, setAdvances] = useState<Advance[]>([])
  const [form, setForm] = useState({ amount: '', reason: '', monthlyAmount: '' })
  const [error, setError] = useState('')
  const [success, setSuccess] = useState('')
  const [saving, setSaving] = useState(false)

  const load = () => apiFetch<{ data: Advance[] }>('/hr/advances').then((response) => setAdvances(response.data)).catch((value) => setError(value instanceof Error ? value.message : 'Unable to load salary advance requests'))
  useEffect(() => { load() }, [])

  const repaymentMonths = useMemo(() => {
    const amount = Number(form.amount)
    const monthlyAmount = Number(form.monthlyAmount)
    return amount > 0 && monthlyAmount > 0 ? Math.ceil(amount / monthlyAmount) : 0
  }, [form.amount, form.monthlyAmount])
  const requestSummary = useMemo(() => ({
    pending: advances.filter((advance) => advance.status === 'pending').length,
    approved: advances.filter((advance) => advance.status === 'approved').length,
    remaining: advances.reduce((total, advance) => total + Math.max(advance.amount - advance.deductedAmount, 0), 0),
  }), [advances])

  const submit = async (event: FormEvent) => {
    event.preventDefault()
    setSaving(true)
    setError('')
    setSuccess('')
    try {
      await apiFetch('/hr/advances', { method: 'POST', body: JSON.stringify({ amount: Number(form.amount), reason: form.reason, deductionSchedule: { monthlyAmount: Number(form.monthlyAmount) } }) })
      setForm({ amount: '', reason: '', monthlyAmount: '' })
      setSuccess('Your salary advance request was sent to HR for review.')
      await load()
    } catch (value) {
      setError(value instanceof Error ? value.message : 'Unable to submit salary advance request')
    } finally {
      setSaving(false)
    }
  }

  return <>
    <PageMetaData title="Salary Advance" />
    <Card className="mb-4 border-0 shadow-sm"><CardBody className="py-4"><div className="text-primary text-uppercase fw-semibold small mb-1">Payroll support</div><h4 className="card-title mb-1">Salary advance request</h4><p className="text-muted mb-0">Request an advance, choose a manageable monthly deduction, and track HR’s decision here.</p></CardBody></Card>

    <Row className="g-3 mb-4">{[
      ['Pending review', requestSummary.pending, 'warning'],
      ['Approved', requestSummary.approved, 'success'],
      ['Outstanding balance', money(requestSummary.remaining), 'primary'],
    ].map(([label, value, variant]) => <Col md={4} key={label as string}><Card className="h-100 border shadow-sm"><CardBody className="d-flex justify-content-between align-items-center py-3"><span className="text-muted">{label}</span><Badge pill bg={variant as string} className="fs-6 px-3 py-2">{value}</Badge></CardBody></Card></Col>)}</Row>

    <Row className="g-3 mb-4">
      <Col md={4}><Card className="h-100 border shadow-sm"><CardBody><Badge pill bg="light" text="dark" className="mb-2">Step 1</Badge><div className="fw-semibold">Submit your request</div><p className="text-muted small mb-0 mt-2">Enter the amount, reason, and preferred monthly deduction.</p></CardBody></Card></Col>
      <Col md={4}><Card className="h-100 border shadow-sm"><CardBody><Badge pill bg="light" text="dark" className="mb-2">Step 2</Badge><div className="fw-semibold">HR reviews it</div><p className="text-muted small mb-0 mt-2">Your request remains pending until HR approves or declines it.</p></CardBody></Card></Col>
      <Col md={4}><Card className="h-100 border shadow-sm"><CardBody><Badge pill bg="light" text="dark" className="mb-2">Step 3</Badge><div className="fw-semibold">Payroll deducts it</div><p className="text-muted small mb-0 mt-2">Approved advances are deducted from future payroll at the agreed amount.</p></CardBody></Card></Col>
    </Row>

    <Card className="mb-4 border shadow-sm"><CardBody>
      <div className="d-flex justify-content-between gap-3 flex-wrap mb-4"><div><h5 className="mb-1">Request details</h5><p className="text-muted mb-0">Choose a monthly deduction you can comfortably manage.</p></div></div>
      {error && <Alert variant="danger">{error}</Alert>}
      {success && <Alert variant="success">{success}</Alert>}
      <Row className="g-4"><Col lg={8}><Form onSubmit={submit}><Row className="g-3">
        <Col md={6}><Form.Label>Advance amount</Form.Label><Form.Control required min="0.01" step="0.01" type="number" inputMode="decimal" value={form.amount} onChange={(event) => setForm({ ...form, amount: event.target.value })} placeholder="0.00" /><Form.Text>Enter the total amount you are requesting.</Form.Text></Col>
        <Col md={6}><Form.Label>Monthly payroll deduction</Form.Label><Form.Control required min="0.01" step="0.01" type="number" inputMode="decimal" value={form.monthlyAmount} onChange={(event) => setForm({ ...form, monthlyAmount: event.target.value })} placeholder="0.00" /><Form.Text>This is deducted from each future payroll after approval.</Form.Text></Col>
        <Col xs={12}><Form.Label>Reason for the advance</Form.Label><Form.Control required as="textarea" rows={3} value={form.reason} onChange={(event) => setForm({ ...form, reason: event.target.value })} placeholder="Briefly explain why you need this advance." /></Col>
        <Col xs={12} className="d-flex justify-content-end"><Button type="submit" disabled={saving}>{saving ? 'Submitting request…' : 'Submit advance request'}</Button></Col>
      </Row></Form></Col><Col lg={4}><Card className="h-100 border bg-body"><CardBody><div className="text-muted small mb-1">Repayment preview</div>{repaymentMonths > 0 ? <><div className="fs-4 fw-semibold mb-2">About {repaymentMonths} month{repaymentMonths === 1 ? '' : 's'}</div><p className="text-muted mb-0">Based on a monthly payroll deduction of {money(Number(form.monthlyAmount))}.</p></> : <p className="text-muted mb-0">Enter an advance amount and monthly deduction to see the estimated repayment period.</p>}</CardBody></Card></Col></Row>
    </CardBody></Card>

    <Card className="border shadow-sm"><CardBody>
      <div className="mb-3"><h4 className="card-title mb-1">My salary advance requests</h4><p className="text-muted mb-0">Track HR’s decision and the amount already deducted from payroll.</p></div>
      <Table responsive className="align-middle mb-0"><thead><tr><th>Requested</th><th className="d-none d-md-table-cell">Monthly deduction</th><th>Remaining</th><th className="d-none d-md-table-cell">Reason</th><th>Status</th><th className="d-none d-md-table-cell">Requested on</th></tr></thead><tbody>{advances.map((advance) => <tr key={advance._id}><td>{money(advance.amount)}</td><td className="d-none d-md-table-cell">{money(advance.deductionSchedule.monthlyAmount)}</td><td>{money(Math.max(advance.amount - advance.deductedAmount, 0))}</td><td className="d-none d-md-table-cell text-wrap" style={{ minWidth: 220 }}>{advance.reason}</td><td><Badge bg={statusVariant(advance.status)} text={advance.status === 'pending' ? 'dark' : undefined}>{advance.status}</Badge></td><td className="d-none d-md-table-cell">{new Date(advance.createdAt).toLocaleDateString()}</td></tr>)}{!advances.length && <tr><td colSpan={6} className="text-center text-muted py-4">No salary advance requests yet.</td></tr>}</tbody></Table>
    </CardBody></Card>
  </>
}

export default MyAdvancesPage
