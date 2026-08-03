import { useEffect, useState } from 'react'
import { Alert, Badge, Card, CardBody, Col, Row, Table } from 'react-bootstrap'
import { Link } from 'react-router-dom'

import PageBreadcrumb from '@/components/layout/PageBreadcrumb'
import PageMetaData from '@/components/PageTitle'
import Spinner from '@/components/Spinner'
import { apiFetch } from '@/helpers/api'
import { buildApiUrl } from '@/helpers/apiUrl'
import { useAuthStore } from '@/store/authStore'
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

const AdminDashboard = () => {
  const token = useAuthStore((state) => state.token)
  const [summary, setSummary] = useState<DashboardSummary>({
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

  const stats = [
    { label: 'Active leads', value: summary.stats.activeLeads, note: 'Follow-up required', bg: 'primary' },
    { label: 'Unassigned leads', value: summary.stats.unassignedLeads, note: 'Assign today', bg: summary.stats.unassignedLeads ? 'warning' : 'success' },
    { label: "Today's meetings", value: summary.stats.todayMeetings, note: 'Scheduled', bg: 'info' },
    { label: 'Overdue tasks', value: summary.stats.overdueTasks, note: 'Action required', bg: summary.stats.overdueTasks ? 'danger' : 'success' },
    { label: 'Tasks due today', value: summary.stats.dueTodayTasks, note: 'Due today', bg: 'warning' },
    { label: 'Team users', value: summary.stats.teamUsers, note: 'Active team', bg: 'secondary' },
  ]

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
      <PageBreadcrumb title="Absteras Dashboard" subName="Facade CRM" />
      <PageMetaData title="Absteras Dashboard" />

      <div className="d-flex justify-content-between align-items-center gap-3 flex-wrap mb-4">
        <div className="text-muted">Absteras Company overview for leads, meetings, tasks, and sales workload.</div>
        <div className="d-flex gap-2 flex-wrap ms-auto">
          <Link to="/leads/create" className="btn btn-primary text-nowrap">Create Lead</Link>
          <Link to="/tasks/create" className="btn btn-outline-primary text-nowrap">Create Task</Link>
          <button type="button" className="btn btn-outline-secondary text-nowrap" onClick={downloadReport} disabled={exporting}>
            {exporting ? 'Exporting...' : 'Export CSV'}
          </button>
        </div>
      </div>

      {error && <Alert variant="danger">{error}</Alert>}
      {loading && !summary.recentLeads.length && !summary.priorityTasks.length ? (
        <div className="text-center py-5">
          <Spinner className="spinner-border-sm me-2" tag="span" />
          <span className="text-muted">Loading dashboard...</span>
        </div>
      ) : null}

      <Row className="g-3 mb-4">
        {stats.map((item) => (
          <Col md={6} xl={4} xxl={2} key={item.label}>
            <Card className="h-100">
              <CardBody className="p-3">
                <div className="d-flex justify-content-between align-items-start gap-3">
                  <div>
                    <div className="text-muted fs-13 mb-2">{item.label}</div>
                    <h2 className="mb-0">{item.value}</h2>
                  </div>
                  <Badge className="text-nowrap mt-1" bg={item.bg} text={item.bg === 'warning' || item.bg === 'info' ? 'dark' : undefined}>{item.note}</Badge>
                </div>
              </CardBody>
            </Card>
          </Col>
        ))}
      </Row>

      <Row className="g-3 mb-4">
        <Col xl={7}>
          <Card className="h-100">
            <CardBody>
              <div className="d-flex justify-content-between align-items-start gap-3 mb-3">
                <div>
                  <h4 className="card-title mb-1">Today&apos;s Meetings</h4>
                  <div className="text-muted">Scheduled calls and visits for today.</div>
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
        </Col>

        <Col xl={5}>
          <Card className="h-100">
            <CardBody>
              <div className="d-flex justify-content-between align-items-start gap-3 mb-3">
                <div>
                  <h4 className="card-title mb-1">Priority Tasks</h4>
                  <div className="text-muted">Blocked, high-priority, and soonest-due work.</div>
                </div>
                <Link to="/tasks/all" className="btn btn-sm btn-outline-secondary text-nowrap">View All</Link>
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
        </Col>
      </Row>

      <Card className="mb-0">
        <CardBody>
          <div className="d-flex justify-content-between align-items-start gap-3 mb-3">
            <div>
              <h4 className="card-title mb-1">Recent Leads</h4>
              <div className="text-muted">Recently captured leads awaiting qualification or follow-up.</div>
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
      </Card>
    </>
  )
}

export default AdminDashboard
