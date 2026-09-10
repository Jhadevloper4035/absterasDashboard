import { useEffect, useState } from 'react'
import { Alert, Badge, Card, CardBody, Col, Row, Table } from 'react-bootstrap'
import { Link } from 'react-router-dom'

import PageBreadcrumb from '@/components/layout/PageBreadcrumb'
import PageMetaData from '@/components/PageTitle'
import Spinner from '@/components/Spinner'
import IconifyIcon from '@/components/wrappers/IconifyIcon'
import { apiFetch } from '@/helpers/api'
import { buildApiUrl } from '@/helpers/apiUrl'
import { hasFullAppAccess } from '@/helpers/moduleAccess'
import { useAuthStore } from '@/store/authStore'
import MyDashboard from '@/app/(admin)/hr/my-dashboard/page'
import AdminDashboardPage from '@/app/(admin)/dashboard/admin/page'
import type { UserType } from '@/types/auth'
import type { LeadOwner, LeadType } from '@/types/lead'

type TaskUser = Pick<UserType, '_id' | 'name' | 'email' | 'role' | 'status'>
type Task = {
  _id: string
  title: string
  assignee?: string | TaskUser
  status: string
  priority: string
  dueDate?: string
  createdAt?: string
}

type DashboardSummary = {
  access: { leads: number; tasks: number }
  stats: {
    activeLeads: number
    unassignedLeads: number
    todayMeetings: number
    overdueTasks: number
    dueTodayTasks: number
    teamUsers: number
  }
  todayMeetings: LeadType[]
  priorityTasks: Task[]
  recentLeads: LeadType[]
}

const ownerName = (owner?: string | LeadOwner | TaskUser) => (typeof owner === 'object' ? owner.name : 'Unassigned')
const dateText = (value?: string) => (value ? new Intl.DateTimeFormat(undefined, { dateStyle: 'medium' }).format(new Date(value)) : 'No date')
const timeText = (value?: string) => (value ? new Intl.DateTimeFormat(undefined, { timeStyle: 'short' }).format(new Date(value)) : '')
const taskStatusColor = (status: string) => (status === 'Done' ? 'success' : status === 'Blocked' ? 'danger' : ['In Progress', 'Review', 'Testing'].includes(status) ? 'warning' : 'primary')
const leadStatusColor = (lead: LeadType) => (lead.status === 'WON' ? 'success' : lead.assignmentException ? 'warning' : closedLeadStatuses.includes(lead.status) ? 'secondary' : 'primary')
const closedLeadStatuses = ['WON', 'LOST', 'ON_HOLD']

export const AdminDashboard = () => {
  const token = useAuthStore((state) => state.token)
  const user = useAuthStore((state) => state.user)
  const [summary, setSummary] = useState<DashboardSummary>({
    access: { leads: 0, tasks: 0 },
    stats: { activeLeads: 0, unassignedLeads: 0, todayMeetings: 0, overdueTasks: 0, dueTodayTasks: 0, teamUsers: 0 },
    todayMeetings: [],
    priorityTasks: [],
    recentLeads: [],
  })
  const [loading, setLoading] = useState(false)
  const [exporting, setExporting] = useState(false)
  const [error, setError] = useState('')

  useEffect(() => {
    if (!token) return

    setLoading(true)
    setError('')
    apiFetch<{ data: DashboardSummary }>('/dashboard/summary', { token })
      .then((res) => setSummary(res.data))
      .catch((e) => setError(e instanceof Error ? e.message : 'Unable to load dashboard'))
      .finally(() => setLoading(false))
  }, [token])

  const canReadLeads = summary.access.leads > 0
  const canReadTasks = summary.access.tasks > 0
  const canManageLeads = summary.access.leads === 2
  const canManageTasks = summary.access.tasks === 2
  const firstName = user?.name?.split(' ')[0] || 'Admin'
  const stats = [
    { label: 'Active leads', value: summary.stats.activeLeads, note: 'Need follow-up', bg: 'primary', icon: 'iconamoon:send-duotone' },
    { label: 'Needs assignment', value: summary.stats.unassignedLeads, note: summary.stats.unassignedLeads ? 'Review today' : 'All assigned', bg: summary.stats.unassignedLeads ? 'warning' : 'success', icon: 'iconamoon:profile-circle-duotone' },
    { label: "Today's meetings", value: summary.stats.todayMeetings, note: 'Calls and visits', bg: 'info', icon: 'iconamoon:calendar-1-duotone' },
    { label: 'Overdue tasks', value: summary.stats.overdueTasks, note: summary.stats.overdueTasks ? 'Action required' : 'All on track', bg: summary.stats.overdueTasks ? 'danger' : 'success', icon: 'iconamoon:clock-duotone' },
    { label: 'Due today', value: summary.stats.dueTodayTasks, note: 'Tasks to finish', bg: 'warning', icon: 'iconamoon:check-circle-1-duotone' },
    { label: 'Active team', value: summary.stats.teamUsers, note: 'Current users', bg: 'secondary', icon: 'iconamoon:group-duotone' },
  ].filter((item) => (['Active leads', 'Needs assignment', "Today's meetings"].includes(item.label) ? canReadLeads : ['Overdue tasks', 'Due today'].includes(item.label) ? canReadTasks : canReadLeads || canReadTasks))
  const actionItems = [
    { label: 'Leads needing assignment', value: summary.stats.unassignedLeads, note: 'Make sure every new enquiry has an owner.', visible: canReadLeads, variant: summary.stats.unassignedLeads ? 'warning' : 'success' },
    { label: 'Overdue tasks', value: summary.stats.overdueTasks, note: 'Review blockers and deadlines with the team.', visible: canReadTasks, variant: summary.stats.overdueTasks ? 'danger' : 'success' },
    { label: 'Meetings today', value: summary.stats.todayMeetings, note: 'Confirm owners are prepared for each meeting.', visible: canReadLeads, variant: 'info' },
  ].filter((item) => item.visible)

  const downloadReport = async () => {
    if (!token) return
    setExporting(true)
    setError('')
    try {
      const response = await fetch(buildApiUrl('/dashboard/summary.csv'), {
        headers: { Authorization: `Bearer ${token}` },
        credentials: 'include',
      })
      if (!response.ok) throw new Error('Unable to export dashboard report')
      const blob = await response.blob()
      const url = URL.createObjectURL(blob)
      const link = document.createElement('a')
      link.href = url
      link.download = 'absteras-dashboard-report.csv'
      link.click()
      URL.revokeObjectURL(url)
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Unable to export dashboard report')
    } finally {
      setExporting(false)
    }
  }

  return (
    <>
      <PageBreadcrumb title="Admin Dashboard" subName="Control Center" />
      <PageMetaData title="Admin Dashboard" />

      <Card className="border-0 bg-body-tertiary mb-4">
        <CardBody className="p-4 p-lg-5">
          <Row className="align-items-center g-4">
            <Col lg={8}>
              <div className="text-primary text-uppercase fw-semibold fs-13 mb-2">Admin control center</div>
              <h2 className="mb-2">Good day, {firstName}.</h2>
              <p className="text-muted mb-0">A focused view of leads, meetings, tasks, and team workload that need your attention today.</p>
            </Col>
            <Col lg={4}>
              <div className="d-flex gap-2 flex-wrap justify-content-lg-end">
                {canManageLeads && <Link to="/leads/create" className="btn btn-primary">Create lead</Link>}
                {canManageTasks && <Link to="/tasks/create" className="btn btn-outline-primary">Create task</Link>}
                {(canReadLeads || canReadTasks) && <button type="button" className="btn btn-outline-secondary" onClick={downloadReport} disabled={exporting}>
                  <IconifyIcon icon="iconamoon:download-duotone" className="me-1" />
                  {exporting ? 'Exporting...' : 'Export CSV'}
                </button>}
              </div>
            </Col>
          </Row>
        </CardBody>
      </Card>

      {error && <Alert variant="danger">{error}</Alert>}
      {loading && !summary.recentLeads.length && !summary.priorityTasks.length ? (
        <div className="text-center py-5">
          <Spinner className="spinner-border-sm me-2" tag="span" />
          <span className="text-muted">Loading dashboard...</span>
        </div>
      ) : null}

      <Row className="g-3 mb-4">
        {stats.map((item) => (
          <Col sm={6} xl={4} xxl={2} key={item.label}>
            <Card className="h-100 border-start border-3" style={{ borderLeftColor: `var(--bs-${item.bg})` }}>
              <CardBody className="p-3 p-lg-4">
                <div className="d-flex justify-content-between align-items-start gap-3 mb-3">
                  <div>
                    <div className="text-muted fs-13">{item.label}</div>
                    <h2 className="mb-0 mt-1">{item.value}</h2>
                  </div>
                  <IconifyIcon icon={item.icon} className={`fs-3 text-${item.bg}`} aria-hidden="true" />
                </div>
                <div className="text-muted fs-13">{item.note}</div>
              </CardBody>
            </Card>
          </Col>
        ))}
      </Row>

      {!canReadLeads && !canReadTasks && <Alert variant="info">No business modules are assigned yet. Assign access in User Management.</Alert>}

      {actionItems.length > 0 && <Card className="mb-4">
        <CardBody className="p-4">
          <div className="d-flex align-items-start justify-content-between gap-3 flex-wrap mb-4">
            <div>
              <div className="text-primary text-uppercase fw-semibold fs-13 mb-1">Action queue</div>
              <h4 className="card-title mb-1">What needs a decision today</h4>
              <div className="text-muted">Resolve the exceptions below before they hold up the team.</div>
            </div>
            <Badge bg="light" text="dark" className="px-3 py-2">Live summary</Badge>
          </div>
          <Row className="g-3">
            {actionItems.map((item) => <Col md={4} key={item.label}>
              <div className="border rounded p-3 h-100">
                <div className="d-flex align-items-center justify-content-between gap-3 mb-2">
                  <span className="text-muted fs-13">{item.label}</span>
                  <Badge bg={item.variant} text={item.variant === 'warning' || item.variant === 'info' ? 'dark' : undefined}>{item.value}</Badge>
                </div>
                <div className="fs-13">{item.note}</div>
              </div>
            </Col>)}
          </Row>
        </CardBody>
      </Card>}

      {(canReadLeads || canReadTasks) && <Row className="g-3 mb-4">
        {canReadLeads && <Col xl={canReadTasks ? 7 : 12}>
          <Card className="h-100">
            <CardBody>
              <div className="d-flex justify-content-between align-items-start gap-3 mb-3">
                <div>
                  <h4 className="card-title mb-1">Today&apos;s meeting schedule</h4>
                  <div className="text-muted">Calls and visits your team needs to be ready for.</div>
                </div>
                <Link to="/leads/scheduled" className="btn btn-sm btn-outline-secondary text-nowrap">View All</Link>
              </div>
              {!summary.todayMeetings.length ? <Alert variant="info" className="mb-0">No meetings scheduled today.</Alert> : (
                <div className="table-responsive">
                  <Table hover className="table-nowrap align-middle mb-0">
                    <thead>
                      <tr>
                        <th>Time</th>
                        <th>Lead</th>
                        <th>Owner</th>
                        <th>Status</th>
                        <th className="text-end">Action</th>
                      </tr>
                    </thead>
                    <tbody>
                      {summary.todayMeetings.map((lead) => (
                        <tr key={lead._id}>
                          <td>{timeText(lead.nextMeeting?.startsAt)}</td>
                          <td>
                            <div className="fw-semibold">{lead.nextMeeting?.title || lead.name}</div>
                            <div className="text-muted fs-13">{lead.company || lead.phone || lead.email || 'No company added'}</div>
                          </td>
                          <td>{ownerName(lead.owner)}</td>
                          <td><Badge bg={leadStatusColor(lead)}>{lead.status}</Badge></td>
                          <td className="text-end"><Link to={`/leads/${lead._id}`} className="btn btn-sm btn-outline-primary">Open</Link></td>
                        </tr>
                      ))}
                    </tbody>
                  </Table>
                </div>
              )}
            </CardBody>
          </Card>
        </Col>}

        {canReadTasks && <Col xl={canReadLeads ? 5 : 12}>
          <Card className="h-100">
            <CardBody>
              <div className="d-flex justify-content-between align-items-start gap-3 mb-3">
                <div>
                  <h4 className="card-title mb-1">Priority work</h4>
                  <div className="text-muted">Blocked, urgent, and soonest-due tasks.</div>
                </div>
              </div>
              {!summary.priorityTasks.length ? <Alert variant="info" className="mb-0">No open tasks.</Alert> : (
                summary.priorityTasks.map((task) => (
                  <div className="d-flex justify-content-between align-items-start gap-3 border-top py-3" key={task._id}>
                    <div style={{ minWidth: 0 }}>
                      <Link to={`/tasks/${task._id}`} className="fw-semibold d-block text-truncate">{task.title}</Link>
                      <div className="text-muted fs-13">{ownerName(task.assignee)} · Due {dateText(task.dueDate)}</div>
                    </div>
                    <div className="d-flex gap-2 flex-wrap justify-content-end flex-shrink-0">
                      <Badge bg={taskStatusColor(task.status)}>{task.status}</Badge>
                      <Badge bg={task.priority === 'Critical' || task.priority === 'High' ? 'danger' : 'secondary'}>{task.priority}</Badge>
                    </div>
                  </div>
                ))
              )}
            </CardBody>
          </Card>
        </Col>}
      </Row>}

      {canReadLeads && <Card className="mb-0">
        <CardBody>
          <div className="d-flex justify-content-between align-items-start gap-3 mb-3">
            <div>
              <h4 className="card-title mb-1">New lead activity</h4>
              <div className="text-muted">Recently captured enquiries that may need qualification or follow-up.</div>
            </div>
            <Link to="/leads" className="btn btn-sm btn-outline-secondary text-nowrap">View All</Link>
          </div>
          {!summary.recentLeads.length ? <Alert variant="info" className="mb-0">No leads found.</Alert> : (
            <div className="table-responsive">
              <Table hover className="table-nowrap align-middle mb-0">
                <thead>
                  <tr>
                    <th>Lead</th>
                    <th>Source</th>
                    <th>Owner</th>
                    <th>Created</th>
                    <th>Status</th>
                    <th className="text-end">Action</th>
                  </tr>
                </thead>
                <tbody>
                  {summary.recentLeads.map((lead) => (
                    <tr key={lead._id}>
                      <td>
                        <div className="fw-semibold">{lead.name}</div>
                        <div className="text-muted fs-13">{lead.company || lead.email || lead.phone || 'Contact details not provided'}</div>
                      </td>
                      <td>{lead.source}</td>
                      <td>{ownerName(lead.owner)}</td>
                      <td>{dateText(lead.createdAt)}</td>
                      <td><Badge bg={leadStatusColor(lead)} text={lead.assignmentException ? 'dark' : undefined}>{lead.assignmentException ? 'Needs assignment' : lead.status}</Badge></td>
                      <td className="text-end"><Link to={`/leads/${lead._id}`} className="btn btn-sm btn-outline-primary">Open</Link></td>
                    </tr>
                  ))}
                </tbody>
              </Table>
            </div>
          )}
        </CardBody>
      </Card>}
    </>
  )
}

const Analytics = () => {
  const user = useAuthStore((state) => state.user)
  const isAdmin = hasFullAppAccess(user)

  return isAdmin ? <AdminDashboardPage /> : <MyDashboard />
}

export default Analytics
