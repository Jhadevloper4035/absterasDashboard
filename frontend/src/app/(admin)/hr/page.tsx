import PageMetaData from '@/components/PageTitle'
import { apiFetch } from '@/helpers/api'
import { useEffect, useState } from 'react'
import { Alert, Badge, Button, Card, CardBody, Col, Row } from 'react-bootstrap'
import { Link } from 'react-router-dom'
import HrReports from './reports/page'

type Summary = {
  activeEmployees: number
  todayAttendance: number
  pendingLeaves: number
  pendingAdvances: number
  pendingExpenses: number
  payroll: null | { status: string; employees: number }
}

const HrDashboard = () => {
  const [summary, setSummary] = useState<Summary>()
  const [error, setError] = useState('')
  const [canViewReports, setCanViewReports] = useState(false)

  useEffect(() => {
    apiFetch<{ data: Summary }>('/hr/dashboard')
      .then((response) => setSummary(response.data))
      .catch((reason) => setError(reason instanceof Error ? reason.message : 'Unable to load HR dashboard'))
    apiFetch<{ data: { module: string; access: string }[] }>('/hr/permissions/me')
      .then((response) => setCanViewReports(response.data.some((item) => item.module === 'reports' && ['view', 'manage'].includes(item.access))))
      .catch(() => {})
  }, [])

  const metrics: [string, number, string, string][] = summary
    ? [
        ['Active employees', summary.activeEmployees, 'Current workforce', '/hr/employees'],
        ["Today's attendance", summary.todayAttendance, 'Marked for today', '/hr/attendance'],
        ['Leave approvals', summary.pendingLeaves, 'Waiting for decision', '/hr/leave'],
        ['Salary advances', summary.pendingAdvances, 'Waiting for decision', '/hr/payroll/advances'],
        ['Reimbursements', summary.pendingExpenses, 'Waiting for decision', '/hr/expenses/approvals'],
      ]
    : []

  return (
    <>
      <PageMetaData title="HR Dashboard" />
      <div className="d-flex justify-content-between align-items-start flex-wrap gap-3 mb-4">
        <div>
          <span className="text-primary text-uppercase fw-semibold small">HR workspace</span>
          <h3 className="mb-1 mt-1">People, payroll, and approvals</h3>
          <p className="text-muted mb-0">Use this dashboard to see what needs attention and manage your workforce.</p>
        </div>
        <div className="d-flex flex-wrap gap-2">
          <Link to="/hr/leave">
            <Button variant="outline-primary">Manage leave</Button>
          </Link>
          <Link to="/hr/employees">
            <Button>Manage employees</Button>
          </Link>
        </div>
      </div>

      {error && <Alert variant="danger">{error}</Alert>}

      <Card className="mb-3">
        <CardBody>
          <div className="d-flex justify-content-between align-items-center flex-wrap gap-2 mb-3">
            <div>
              <h5 className="mb-1">Today at a glance</h5>
              <small className="text-muted">Open a card to manage the related item.</small>
            </div>
          </div>
          <Row className="g-3">
            {metrics.map(([label, value, hint, to]) => (
              <Col key={label} sm={6} xl>
                <Link to={to} className="text-reset text-decoration-none">
                  <Card className="h-100 border">
                    <CardBody>
                      <small className="text-muted d-block mb-2">{label}</small>
                      <h2 className="mb-1">{value}</h2>
                      <small className="text-muted">{hint}</small>
                    </CardBody>
                  </Card>
                </Link>
              </Col>
            ))}
            {!summary && <Col className="text-muted py-4">Loading HR summary…</Col>}
          </Row>
        </CardBody>
      </Card>

      {summary && (
        <Card className="mb-4">
          <CardBody className="d-flex justify-content-between align-items-center flex-wrap gap-3">
            <div>
              <small className="text-muted text-uppercase fw-semibold">Current payroll</small>
              <h5 className="mb-1 mt-1">
                {summary.payroll ? `${summary.payroll.employees} employees in this month’s payroll` : 'No payroll run for this month'}
              </h5>
              <small className="text-muted">Review and process payroll when all attendance and approvals are complete.</small>
            </div>
            <div className="d-flex align-items-center gap-2">
              {summary.payroll && <Badge bg={summary.payroll.status === 'processed' ? 'success' : 'warning'}>{summary.payroll.status}</Badge>}
              <Link to="/hr/payroll">
                <Button variant="outline-primary">Open payroll</Button>
              </Link>
            </div>
          </CardBody>
        </Card>
      )}

      {canViewReports && (
        <section className="border-top pt-4">
          <div className="mb-3">
            <span className="text-primary text-uppercase fw-semibold small">Insights</span>
            <h4 className="mb-1 mt-1">Reports and workforce trends</h4>
            <p className="text-muted mb-0">Filter attendance, leave, headcount, and payroll data from one place.</p>
          </div>
          <HrReports embedded />
        </section>
      )}
    </>
  )
}

export default HrDashboard
