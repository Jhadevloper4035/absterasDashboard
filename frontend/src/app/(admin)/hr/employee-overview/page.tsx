import PageMetaData from '@/components/PageTitle'
import { apiFetch } from '@/helpers/api'
import { useAuthStore } from '@/store/authStore'
import type { EmployeeType } from '@/types/hr'
import { useEffect, useState } from 'react'
import { Alert, Badge, Button, Card, CardBody, Col, Form, Row, Table } from 'react-bootstrap'
import { Link, useLocation } from 'react-router-dom'

type Overview = { employee: EmployeeType; salary?: { basic: number; hra: number; ctc: number; monthlyGross: number }; payroll?: { status: string; grossPay: number; deductions: number; netPay: number; advanceDeducted: number; reimbursementPay: number }; attendance: { summary: Record<string, number>; records: { _id: string; date: string; status: string; checkIn?: string; checkOut?: string; workMinutes?: number; isShortLeave?: boolean }[] }; leaves: { _id: string; leaveType?: { name: string }; days: number; status: string }[]; advances: { _id: string; amount: number; deductedAmount: number; status: string; deductionSchedule: { monthlyAmount: number } }[]; reimbursements: { _id: string; category: string; amount: number; status: string }[] }

const currentMonth = () => new Date().toISOString().slice(0, 7)
const date = (value: string) => new Intl.DateTimeFormat(undefined, { day: 'numeric', month: 'short' }).format(new Date(value))
const hours = (minutes = 0) => `${Math.floor(minutes / 60)}h ${minutes % 60}m`
const money = (value?: number) => value === undefined ? '—' : Number(value).toLocaleString(undefined, { maximumFractionDigits: 2 })
const statusColor = (status: string) => ['approved', 'paid', 'present', 'settled'].includes(status.toLowerCase()) ? 'success' : ['rejected', 'absent'].includes(status.toLowerCase()) ? 'danger' : status.toLowerCase() === 'pending' ? 'warning' : 'secondary'

const EmployeeOverviewPage = () => {
  const user = useAuthStore((state) => state.user)
  const location = useLocation()
  const isMine = user?.workProfile === 'employee' || (!user?.workProfile && user?.accessTypes?.includes('employee')) || location.pathname === '/hr/my-overview'
  const [employees, setEmployees] = useState<EmployeeType[]>([])
  const [employee, setEmployee] = useState('')
  const [month, setMonth] = useState(currentMonth())
  const [overview, setOverview] = useState<Overview>()
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)

  useEffect(() => {
    if (isMine) return
    apiFetch<{ data: EmployeeType[] }>('/hr/employees?limit=100')
      .then((response) => { setEmployees(response.data); setEmployee((selected) => selected || response.data[0]?._id || '') })
      .catch((value) => setError(value instanceof Error ? value.message : 'Unable to load employees'))
  }, [isMine])

  useEffect(() => {
    if (!isMine && !employee) return
    setError('')
    setLoading(true)
    setOverview(undefined)
    apiFetch<{ data: Overview }>(`/hr/employee-overview?month=${month}${isMine ? '' : `&employee=${employee}`}`)
      .then((response) => setOverview(response.data))
      .catch((value) => setError(value instanceof Error ? value.message : 'Unable to load monthly overview'))
      .finally(() => setLoading(false))
  }, [employee, isMine, month])

  const payroll = overview?.payroll
  const attendanceSummary = overview ? Object.entries(overview.attendance.summary) : []

  return <>
    <PageMetaData title={isMine ? 'My dashboard' : 'Employee monthly overview'} />
    <Card className="mb-4 border-0 shadow-sm"><CardBody className="py-4">
      <div className="d-flex justify-content-between align-items-end flex-wrap gap-3">
        <div><div className="text-primary text-uppercase fw-semibold small mb-1">Monthly workspace</div><h4 className="card-title mb-1">{isMine ? 'My monthly summary' : 'Employee monthly overview'}</h4><p className="text-muted mb-0">Review attendance, salary, and HR requests for the selected month.</p></div>
        <div className="d-flex gap-2 flex-wrap align-items-end">{!isMine && <Form.Group><Form.Label className="small text-muted mb-1">Employee</Form.Label><Form.Select aria-label="Employee" value={employee} onChange={(event) => setEmployee(event.target.value)} style={{ minWidth: 220 }}><option value="">Select employee</option>{employees.map((item) => <option key={item._id} value={item._id}>{item.user.name}</option>)}</Form.Select></Form.Group>}<Form.Group><Form.Label className="small text-muted mb-1">Month</Form.Label><Form.Control aria-label="Month" type="month" value={month} onChange={(event) => setMonth(event.target.value)} /></Form.Group></div>
      </div>
      {error && <Alert className="mt-3 mb-0" variant="danger">{error}</Alert>}
    </CardBody></Card>

    {loading && <Card className="border shadow-sm"><CardBody className="py-5 text-center text-muted">Loading monthly overview…</CardBody></Card>}
    {!loading && !overview && !error && <Card className="border shadow-sm"><CardBody className="py-5 text-center text-muted">Select an employee to view their monthly overview.</CardBody></Card>}
    {overview && <>
      <Card className="mb-4 border-start border-4 border-primary shadow-sm"><CardBody className="d-flex justify-content-between align-items-center flex-wrap gap-3"><div><div className="text-muted small mb-1">Viewing employee</div><h5 className="mb-1">{overview.employee.user.name}</h5><p className="text-muted mb-0">{overview.employee.department?.name || 'No department'} · {overview.employee.designation?.name || 'No job title'}</p></div>{isMine && <div className="d-flex gap-2 flex-wrap"><Link to="/hr/leave"><Button size="sm" variant="outline-primary">Request leave</Button></Link><Link to="/hr/expenses"><Button size="sm" variant="outline-primary">Claim reimbursement</Button></Link><Link to="/hr/advances"><Button size="sm" variant="outline-primary">Request advance</Button></Link></div>}</CardBody></Card>

      <Row className="g-3 mb-4">{[
        ['Net salary', payroll ? money(payroll.netPay) : '—', payroll ? 'After deductions' : 'Payroll not processed'],
        ['Gross salary', money(payroll?.grossPay ?? overview.salary?.monthlyGross), 'Before deductions'],
        ['Deductions', money(payroll?.deductions), 'This month'],
        ['Advance deduction', money(payroll?.advanceDeducted ?? 0), 'This month'],
        ['Reimbursements', money(payroll?.reimbursementPay ?? 0), 'This month'],
      ].map(([label, value, note]) => <Col sm={6} xl key={label}><Card className="h-100 border shadow-sm"><CardBody><small className="text-muted d-block mb-2">{label}</small><h4 className="mb-1">{value}</h4><small className="text-muted">{note}</small></CardBody></Card></Col>)}</Row>

      <Row className="g-3">
        <Col lg={6}><Card className="h-100 border shadow-sm"><CardBody><div className="d-flex justify-content-between align-items-start gap-3"><div><h5 className="mb-1">Attendance</h5><p className="text-muted mb-3">Daily attendance for this month.</p></div><Badge bg="light" text="dark">{overview.attendance.records.length} records</Badge></div><div className="d-flex gap-2 flex-wrap mb-3">{attendanceSummary.map(([status, count]) => <Badge bg="light" text="dark" key={status}>{status}: {count}</Badge>)}{!attendanceSummary.length && <span className="text-muted">No attendance records.</span>}</div><Table responsive size="sm" className="align-middle mb-0"><thead><tr><th>Date</th><th>Status</th><th>In</th><th>Out</th><th>Hours</th></tr></thead><tbody>{overview.attendance.records.map((item) => <tr key={item._id}><td>{date(item.date)}</td><td><Badge bg={statusColor(item.status)} text={item.status.toLowerCase() === 'pending' ? 'dark' : undefined}>{item.status}</Badge></td><td>{item.checkIn || '—'}</td><td>{item.checkOut || '—'}</td><td>{item.workMinutes ? hours(item.workMinutes) : item.isShortLeave ? 'Short leave' : '—'}</td></tr>)}{!overview.attendance.records.length && <tr><td colSpan={5} className="text-center text-muted py-3">No attendance records for this month.</td></tr>}</tbody></Table></CardBody></Card></Col>

        <Col lg={6}><Card className="h-100 border shadow-sm"><CardBody><h5 className="mb-1">Leave requests</h5><p className="text-muted mb-3">Leave requests submitted for this month.</p><Table responsive size="sm" className="align-middle mb-0"><thead><tr><th>Leave type</th><th>Days</th><th>Status</th></tr></thead><tbody>{overview.leaves.map((item) => <tr key={item._id}><td>{item.leaveType?.name || 'Leave'}</td><td>{item.days}</td><td><Badge bg={statusColor(item.status)} text={item.status.toLowerCase() === 'pending' ? 'dark' : undefined}>{item.status}</Badge></td></tr>)}{!overview.leaves.length && <tr><td colSpan={3} className="text-center text-muted py-3">No leave requests for this month.</td></tr>}</tbody></Table></CardBody></Card></Col>

        <Col lg={6}><Card className="h-100 border shadow-sm"><CardBody><h5 className="mb-1">Salary advances</h5><p className="text-muted mb-3">Current advance requests and deductions.</p><Table responsive size="sm" className="align-middle mb-0"><thead><tr><th>Requested</th><th>Monthly</th><th>Remaining</th><th>Status</th></tr></thead><tbody>{overview.advances.map((item) => <tr key={item._id}><td>{money(item.amount)}</td><td>{money(item.deductionSchedule.monthlyAmount)}</td><td>{money(Math.max(item.amount - item.deductedAmount, 0))}</td><td><Badge bg={statusColor(item.status)} text={item.status.toLowerCase() === 'pending' ? 'dark' : undefined}>{item.status}</Badge></td></tr>)}{!overview.advances.length && <tr><td colSpan={4} className="text-center text-muted py-3">No salary advance requests.</td></tr>}</tbody></Table></CardBody></Card></Col>

        <Col lg={6}><Card className="h-100 border shadow-sm"><CardBody><h5 className="mb-1">Reimbursements</h5><p className="text-muted mb-3">Expenses submitted to HR for review.</p><Table responsive size="sm" className="align-middle mb-0"><thead><tr><th>Category</th><th>Amount</th><th>Status</th></tr></thead><tbody>{overview.reimbursements.map((item) => <tr key={item._id}><td>{item.category}</td><td>{money(item.amount)}</td><td><Badge bg={statusColor(item.status)} text={item.status.toLowerCase() === 'pending' ? 'dark' : undefined}>{item.status}</Badge></td></tr>)}{!overview.reimbursements.length && <tr><td colSpan={3} className="text-center text-muted py-3">No reimbursements submitted.</td></tr>}</tbody></Table></CardBody></Card></Col>
      </Row>
    </>}
  </>
}

export default EmployeeOverviewPage
