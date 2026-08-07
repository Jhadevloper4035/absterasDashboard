import PageMetaData from '@/components/PageTitle'
import { apiFetch } from '@/helpers/api'
import { useEffect, useState } from 'react'
import { Alert, Badge, Button, Card, CardBody, Col, Row } from 'react-bootstrap'
import { Link } from 'react-router-dom'

type Summary = { activeEmployees: number; todayAttendance: number; pendingLeaves: number; pendingAdvances: number; pendingExpenses: number; payroll: null | { status: string; employees: number } }

const HrDashboard = () => {
  const [summary, setSummary] = useState<Summary>()
  const [error, setError] = useState('')
  useEffect(() => { apiFetch<{ data: Summary }>('/hr/dashboard').then((response) => setSummary(response.data)).catch((reason) => setError(reason instanceof Error ? reason.message : 'Unable to load HR dashboard')) }, [])
  const cards = summary && [
    ['Active employees', summary.activeEmployees, '/hr/employees'],
    ["Today's attendance", summary.todayAttendance, '/hr/attendance'],
    ['Pending leave requests', summary.pendingLeaves, '/hr/leave'],
    ['Pending advances', summary.pendingAdvances, '/hr/payroll/advances'],
    ['Pending reimbursements', summary.pendingExpenses, '/hr/expenses/approvals'],
  ]
  return <><PageMetaData title="HR Dashboard" /><div className="d-flex justify-content-between align-items-start flex-wrap gap-3 mb-4"><div><h4 className="mb-1">HR Dashboard</h4><p className="text-muted mb-0">Your workforce, attendance, approvals, and payroll actions in one place.</p></div><Link to="/hr/employees"><Button>Manage employees</Button></Link></div>{error && <Alert variant="danger">{error}</Alert>}{cards && <><Row className="g-3 mb-3">{cards.map(([label, value, to]) => <Col md={6} xl key={label}><Link to={to as string} className="text-reset text-decoration-none"><Card className="h-100"><CardBody><div className="text-muted small">{label}</div><h3 className="mb-0 mt-1">{value}</h3></CardBody></Card></Link></Col>)}</Row><Card><CardBody><div className="d-flex justify-content-between align-items-center flex-wrap gap-2"><div><h5 className="mb-1">Current payroll</h5><div className="text-muted">{summary.payroll ? `${summary.payroll.employees} employees in this month’s run` : 'No payroll run has been created this month.'}</div></div><div className="d-flex align-items-center gap-2">{summary.payroll && <Badge bg={summary.payroll.status === 'processed' ? 'success' : 'warning'}>{summary.payroll.status}</Badge>}<Link to="/hr/payroll"><Button variant="outline-primary">Open payroll</Button></Link></div></div></CardBody></Card></>}</>
}

export default HrDashboard
