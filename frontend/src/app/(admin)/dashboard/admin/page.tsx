import { useEffect, useState } from 'react'
import { Alert, Badge, Button, Card, CardBody, Col, Row, Table } from 'react-bootstrap'
import { Link } from 'react-router-dom'

import IconifyIcon from '@/components/wrappers/IconifyIcon'
import PageBreadcrumb from '@/components/layout/PageBreadcrumb'
import PageMetaData from '@/components/PageTitle'
import Spinner from '@/components/Spinner'
import { apiFetch } from '@/helpers/api'
import { buildApiUrl } from '@/helpers/apiUrl'
import { useAuthStore } from '@/store/authStore'
import type { UserType } from '@/types/auth'
import type { LeadOwner, LeadType } from '@/types/lead'

type TaskUser = Pick<UserType, '_id' | 'name' | 'email' | 'role' | 'status'>
type Task = { _id: string; title: string; assignee?: string | TaskUser; status: string; priority: string; dueDate?: string }
type DashboardSummary = {
  stats: { activeLeads: number; unassignedLeads: number; todayMeetings: number; overdueTasks: number; dueTodayTasks: number; teamUsers: number }
  todayMeetings: LeadType[]
  priorityTasks: Task[]
  recentLeads: LeadType[]
}
type HrSummary = {
  activeEmployees: number
  todayAttendance: number
  pendingLeaves: number
  pendingAdvances: number
  pendingExpenses: number
  payroll: null | { status: string; employees: number }
}

const ownerName = (owner?: string | LeadOwner | TaskUser) => typeof owner === 'object' ? owner.name : 'Unassigned'
const dateText = (value?: string) => value ? new Intl.DateTimeFormat(undefined, { dateStyle: 'medium' }).format(new Date(value)) : 'No date'
const timeText = (value?: string) => value ? new Intl.DateTimeFormat(undefined, { timeStyle: 'short' }).format(new Date(value)) : ''
const taskStatusColor = (status: string) => status === 'Done' ? 'success' : status === 'Blocked' ? 'danger' : ['In Progress', 'Review', 'Testing'].includes(status) ? 'warning' : 'primary'
const closedLeadStatuses = ['WON', 'LOST', 'ON_HOLD']
const leadStatusColor = (lead: LeadType) => lead.status === 'WON' ? 'success' : lead.assignmentException ? 'warning' : closedLeadStatuses.includes(lead.status) ? 'secondary' : 'primary'

const emptyDashboard: DashboardSummary = {
  stats: { activeLeads: 0, unassignedLeads: 0, todayMeetings: 0, overdueTasks: 0, dueTodayTasks: 0, teamUsers: 0 },
  todayMeetings: [],
  priorityTasks: [],
  recentLeads: [],
}

const AdminDashboardPage = () => {
  const token = useAuthStore((state) => state.token)
  const user = useAuthStore((state) => state.user)
  const [dashboard, setDashboard] = useState<DashboardSummary>(emptyDashboard)
  const [hr, setHr] = useState<HrSummary>()
  const [loading, setLoading] = useState(false)
  const [exporting, setExporting] = useState(false)
  const [error, setError] = useState('')
  const firstName = user?.name?.split(' ')[0] || 'Admin'

  useEffect(() => {
    if (!token) return

    setLoading(true)
    setError('')
    Promise.all([
      apiFetch<{ data: DashboardSummary }>('/dashboard/summary', { token }),
      apiFetch<{ data: HrSummary }>('/hr/dashboard', { token }),
    ])
      .then(([dashboardResponse, hrResponse]) => {
        setDashboard(dashboardResponse.data)
        setHr(hrResponse.data)
      })
      .catch((reason) => setError(reason instanceof Error ? reason.message : 'Unable to load the admin dashboard'))
      .finally(() => setLoading(false))
  }, [token])

  const downloadReport = async () => {
    if (!token) return
    setExporting(true)
    setError('')
    try {
      const response = await fetch(buildApiUrl('/dashboard/summary.csv'), { headers: { Authorization: `Bearer ${token}` }, credentials: 'include' })
      if (!response.ok) throw new Error('Unable to export dashboard report')
      const url = URL.createObjectURL(await response.blob())
      const link = document.createElement('a')
      link.href = url
      link.download = 'absteras-admin-report.csv'
      link.click()
      URL.revokeObjectURL(url)
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : 'Unable to export dashboard report')
    } finally {
      setExporting(false)
    }
  }

  const crmMetrics = [
    { label: 'Active leads', value: dashboard.stats.activeLeads, note: 'Open opportunities', icon: 'iconamoon:send-duotone', variant: 'primary' },
    { label: 'Needs assignment', value: dashboard.stats.unassignedLeads, note: dashboard.stats.unassignedLeads ? 'Review today' : 'All assigned', icon: 'iconamoon:profile-circle-duotone', variant: dashboard.stats.unassignedLeads ? 'warning' : 'success' },
    { label: 'Meetings today', value: dashboard.stats.todayMeetings, note: 'Calls and visits', icon: 'iconamoon:calendar-1-duotone', variant: 'info' },
    { label: 'Overdue tasks', value: dashboard.stats.overdueTasks, note: dashboard.stats.overdueTasks ? 'Action required' : 'All on track', icon: 'iconamoon:clock-duotone', variant: dashboard.stats.overdueTasks ? 'danger' : 'success' },
  ]
  const hrMetrics = [
    { label: 'Active employees', value: hr?.activeEmployees ?? 0, note: 'Current workforce', to: '/hr/employees' },
    { label: 'Attendance today', value: hr?.todayAttendance ?? 0, note: 'Marked today', to: '/hr/attendance' },
    { label: 'Leave approvals', value: hr?.pendingLeaves ?? 0, note: 'Waiting for a decision', to: '/hr/leave' },
    { label: 'Pending claims', value: (hr?.pendingAdvances ?? 0) + (hr?.pendingExpenses ?? 0), note: 'Advances and reimbursements', to: '/hr/expenses/approvals' },
  ]
  const services = [
    { label: 'Lead management', note: 'Enquiries and follow-up', to: '/leads', icon: 'iconamoon:send-duotone' },
    { label: 'Task management', note: 'Team work and deadlines', to: '/tasks/assigned-to-me', icon: 'iconamoon:calendar-1-duotone' },
    { label: 'People and payroll', note: 'Employees and approvals', to: '/hr/employees', icon: 'iconamoon:profile-circle-duotone' },
    { label: 'Client management', note: 'Clients and sites', to: '/clients', icon: 'iconamoon:folder-duotone' },
    { label: 'Inventory', note: 'Stock and movement', to: '/inventory', icon: 'iconamoon:box-duotone' },
    { label: 'Return management', note: 'Returns and transfers', to: '/returns', icon: 'iconamoon:refresh-duotone' },
  ]

  return <>
    <PageBreadcrumb title="Admin Dashboard" subName="Control Center" />
    <PageMetaData title="Admin Dashboard" />

    <Card className="border-0 bg-body-tertiary mb-4">
      <CardBody className="p-4 p-lg-5">
        <Row className="align-items-center g-4">
          <Col lg={7}>
            <div className="text-primary text-uppercase fw-semibold fs-13 mb-2">Admin control center</div>
            <h2 className="mb-2">Hi, {firstName}.</h2>
            <p className="text-muted mb-0">Run the business from one place: review sales activity, people operations, payroll, and the services your team uses every day.</p>
          </Col>
          <Col lg={5}>
            <div className="d-flex flex-wrap gap-2 justify-content-lg-end">
              <Link to="/leads/create" className="btn btn-primary">Create lead</Link>
              <Link to="/tasks/create" className="btn btn-outline-primary">Create task</Link>
              <Button variant="outline-secondary" onClick={downloadReport} disabled={exporting}>
                <IconifyIcon icon="iconamoon:download-duotone" className="me-1" />{exporting ? 'Exporting...' : 'Export CSV'}
              </Button>
            </div>
          </Col>
        </Row>
      </CardBody>
    </Card>

    {error && <Alert variant="danger">{error}</Alert>}
    {loading && <div className="text-center py-3"><Spinner className="spinner-border-sm me-2" tag="span" /><span className="text-muted">Loading your business overview...</span></div>}

    <Card className="mb-4">
      <CardBody className="p-4">
        <div className="d-flex justify-content-between align-items-start gap-3 flex-wrap mb-4"><div><div className="text-primary text-uppercase fw-semibold fs-13 mb-1">CRM operations</div><h4 className="card-title mb-1">Sales and delivery pulse</h4><div className="text-muted">The work that needs team attention today.</div></div><Badge bg="light" text="dark" className="px-3 py-2">{dashboard.stats.teamUsers} active team members</Badge></div>
        <Row className="g-3">
          {crmMetrics.map((item) => <Col sm={6} xl={3} key={item.label}><div className="border rounded p-3 h-100"><div className="d-flex justify-content-between gap-3 mb-3"><div><div className="text-muted fs-13">{item.label}</div><h2 className="mb-0 mt-1">{item.value}</h2></div><IconifyIcon icon={item.icon} className={`fs-3 text-${item.variant}`} aria-hidden="true" /></div><div className="text-muted fs-13">{item.note}</div></div></Col>)}
        </Row>
      </CardBody>
    </Card>

    <Row className="g-3 mb-4">
      <Col xl={8}>
        <Card className="h-100"><CardBody className="p-4"><div className="d-flex justify-content-between align-items-start gap-3 mb-3"><div><div className="text-primary text-uppercase fw-semibold fs-13 mb-1">People operations</div><h4 className="card-title mb-1">Employees, attendance, and approvals</h4><div className="text-muted">Keep workforce decisions in the same daily flow as CRM operations.</div></div><Link to="/hr/employees" className="btn btn-sm btn-outline-primary text-nowrap">Manage employees</Link></div><Row className="g-3">{hrMetrics.map((item) => <Col sm={6} key={item.label}><Link to={item.to} className="border rounded p-3 h-100 d-block text-reset text-decoration-none"><div className="text-muted fs-13">{item.label}</div><h3 className="my-1">{item.value}</h3><div className="text-muted fs-13">{item.note}</div></Link></Col>)}</Row></CardBody></Card>
      </Col>
      <Col xl={4}>
        <Card className="h-100"><CardBody className="p-4 d-flex flex-column"><div className="text-primary text-uppercase fw-semibold fs-13 mb-1">Payroll status</div><h4 className="card-title mb-2">This month&apos;s payroll</h4><div className="text-muted mb-4 flex-grow-1">{hr?.payroll ? `${hr.payroll.employees} employees in a ${hr.payroll.status} payroll run.` : 'No payroll run has been started for this month.'}</div><Link to="/hr/payroll" className="btn btn-outline-primary">Open payroll</Link></CardBody></Card>
      </Col>
    </Row>

    <Card className="mb-4"><CardBody className="p-4"><div className="mb-3"><div className="text-primary text-uppercase fw-semibold fs-13 mb-1">Business services</div><h4 className="card-title mb-1">Move between services without leaving your workflow</h4><div className="text-muted">Shortcuts to the daily operational areas.</div></div><Row className="g-2">{services.map((service) => <Col sm={6} xl={4} key={service.label}><Link to={service.to} className="border rounded p-3 d-flex align-items-center gap-3 text-reset text-decoration-none h-100"><IconifyIcon icon={service.icon} className="fs-3 text-primary" aria-hidden="true" /><div><div className="fw-semibold">{service.label}</div><div className="text-muted fs-13">{service.note}</div></div></Link></Col>)}</Row></CardBody></Card>

    <Row className="g-3 mb-4">
      <Col xl={7}><Card className="h-100"><CardBody className="p-4"><div className="d-flex justify-content-between align-items-start gap-3 mb-3"><div><h4 className="card-title mb-1">Today&apos;s meeting schedule</h4><div className="text-muted">Calls and visits your team should be prepared for.</div></div><Link to="/leads/scheduled" className="btn btn-sm btn-outline-secondary text-nowrap">View schedule</Link></div>{!dashboard.todayMeetings.length ? <Alert variant="info" className="mb-0">No meetings scheduled today.</Alert> : <div className="table-responsive"><Table hover className="table-nowrap align-middle mb-0"><thead><tr><th>Time</th><th>Lead</th><th>Owner</th><th>Status</th><th className="text-end">Action</th></tr></thead><tbody>{dashboard.todayMeetings.map((lead) => <tr key={lead._id}><td>{timeText(lead.nextMeeting?.startsAt)}</td><td><div className="fw-semibold">{lead.nextMeeting?.title || lead.name}</div><div className="text-muted fs-13">{lead.company || lead.phone || lead.email || 'No company added'}</div></td><td>{ownerName(lead.owner)}</td><td><Badge bg={leadStatusColor(lead)}>{lead.status}</Badge></td><td className="text-end"><Link to={`/leads/${lead._id}`} className="btn btn-sm btn-outline-primary">Open</Link></td></tr>)}</tbody></Table></div>}</CardBody></Card></Col>
      <Col xl={5}><Card className="h-100"><CardBody className="p-4"><h4 className="card-title mb-1">Priority work</h4><div className="text-muted mb-3">Blocked, urgent, and soonest-due tasks.</div>{!dashboard.priorityTasks.length ? <Alert variant="info" className="mb-0">No open tasks.</Alert> : dashboard.priorityTasks.map((task) => <div className="d-flex justify-content-between align-items-start gap-3 border-top py-3" key={task._id}><div style={{ minWidth: 0 }}><Link to={`/tasks/${task._id}`} className="fw-semibold d-block text-truncate">{task.title}</Link><div className="text-muted fs-13">{ownerName(task.assignee)} · Due {dateText(task.dueDate)}</div></div><div className="d-flex gap-2 flex-wrap justify-content-end"><Badge bg={taskStatusColor(task.status)}>{task.status}</Badge><Badge bg={task.priority === 'Critical' || task.priority === 'High' ? 'danger' : 'secondary'}>{task.priority}</Badge></div></div>)}</CardBody></Card></Col>
    </Row>

    <Card className="mb-0"><CardBody className="p-4"><div className="d-flex justify-content-between align-items-start gap-3 mb-3"><div><h4 className="card-title mb-1">New lead activity</h4><div className="text-muted">Recently captured enquiries that may need qualification or follow-up.</div></div><Link to="/leads" className="btn btn-sm btn-outline-secondary text-nowrap">View leads</Link></div>{!dashboard.recentLeads.length ? <Alert variant="info" className="mb-0">No leads found.</Alert> : <div className="table-responsive"><Table hover className="table-nowrap align-middle mb-0"><thead><tr><th>Lead</th><th>Source</th><th>Owner</th><th>Created</th><th>Status</th><th className="text-end">Action</th></tr></thead><tbody>{dashboard.recentLeads.map((lead) => <tr key={lead._id}><td><div className="fw-semibold">{lead.name}</div><div className="text-muted fs-13">{lead.company || lead.email || lead.phone || 'Contact details not provided'}</div></td><td>{lead.source}</td><td>{ownerName(lead.owner)}</td><td>{dateText(lead.createdAt)}</td><td><Badge bg={leadStatusColor(lead)} text={lead.assignmentException ? 'dark' : undefined}>{lead.assignmentException ? 'Needs assignment' : lead.status}</Badge></td><td className="text-end"><Link to={`/leads/${lead._id}`} className="btn btn-sm btn-outline-primary">Open</Link></td></tr>)}</tbody></Table></div>}</CardBody></Card>
  </>
}

export default AdminDashboardPage
