import PageMetaData from '@/components/PageTitle'
import { apiFetch } from '@/helpers/api'
import { useEffect, useState } from 'react'
import { Alert, Badge, Button, Card, CardBody, Table } from 'react-bootstrap'

type Advance = {
  _id: string
  employee?: { user?: { name?: string; email?: string } }
  amount: number
  deductedAmount: number
  monthlySalary: number
  reason: string
  status: 'pending' | 'approved' | 'rejected' | 'settled'
  deductionSchedule: { monthlyAmount: number }
}

const money = (amount: number) => amount.toLocaleString('en-IN', { maximumFractionDigits: 2 })

const AdvancesPage = () => {
  const [advances, setAdvances] = useState<Advance[]>([])
  const [error, setError] = useState('')
  const load = () => apiFetch<{ data: Advance[] }>('/hr/payroll/advances').then((response) => setAdvances(response.data)).catch((value) => setError(value instanceof Error ? value.message : 'Unable to load advance requests'))

  useEffect(() => { load() }, [])

  const decide = async (id: string, status: 'approved' | 'rejected') => {
    setError('')
    try {
      await apiFetch(`/hr/payroll/advances/${id}`, { method: 'PATCH', body: JSON.stringify({ status }) })
      load()
    } catch (value) { setError(value instanceof Error ? value.message : 'Unable to update advance request') }
  }

  return <>
    <PageMetaData title="Advance requests" />
    <Card><CardBody>
      <h4 className="card-title mb-1">Employee advance requests</h4>
      <p className="text-muted mb-4">Approve or decline employee requests. Monthly deductions cannot be higher than the employee’s current monthly salary.</p>
      {error && <Alert variant="danger">{error}</Alert>}
      <Table responsive className="align-middle mb-0"><thead><tr><th>Employee</th><th>Monthly salary</th><th>Requested</th><th>Monthly deduction</th><th>Remaining</th><th>Reason</th><th>Status</th><th className="text-end">Actions</th></tr></thead><tbody>
        {advances.map((advance) => <tr key={advance._id}><td><div className="fw-medium">{advance.employee?.user?.name || 'Deleted employee'}</div><small className="text-muted">{advance.employee?.user?.email || '-'}</small></td><td>{advance.monthlySalary ? money(advance.monthlySalary) : '-'}</td><td>{money(advance.amount)}</td><td>{money(advance.deductionSchedule.monthlyAmount)}</td><td>{money(Math.max(advance.amount - advance.deductedAmount, 0))}</td><td className="text-wrap" style={{ minWidth: 180 }}>{advance.reason}</td><td><Badge bg={advance.status === 'approved' ? 'success' : advance.status === 'rejected' ? 'danger' : advance.status === 'settled' ? 'secondary' : 'warning'}>{advance.status}</Badge></td><td className="text-end text-nowrap">{advance.status === 'pending' && <><Button size="sm" className="me-2" onClick={() => decide(advance._id, 'approved')}>Approve</Button><Button size="sm" variant="outline-danger" onClick={() => decide(advance._id, 'rejected')}>Decline</Button></>}</td></tr>)}
        {!advances.length && <tr><td colSpan={8} className="text-center text-muted py-4">No employee advance requests yet.</td></tr>}
      </tbody></Table>
    </CardBody></Card>
  </>
}

export default AdvancesPage
