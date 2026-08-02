import { useEffect, useMemo, useState } from 'react'
import { Alert, Badge, Card, CardBody, Col, Row, Table } from 'react-bootstrap'
import { Link } from 'react-router-dom'

import PageBreadcrumb from '@/components/layout/PageBreadcrumb'
import PageMetaData from '@/components/PageTitle'
import Spinner from '@/components/Spinner'
import { apiFetch } from '@/helpers/api'
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

const closedLeadStatuses = ['WON', 'LOST', 'ON_HOLD']
const ownerName = (owner?: string | LeadOwner | TaskUser) => (typeof owner === 'object' ? owner.name : 'Unassigned')
const dateText = (value?: string) => (value ? new Intl.DateTimeFormat(undefined, { dateStyle: 'medium' }).format(new Date(value)) : 'No date')
const timeText = (value?: string) => (value ? new Intl.DateTimeFormat(undefined, { timeStyle: 'short' }).format(new Date(value)) : '')
const dayKey = (value: string | Date) => new Intl.DateTimeFormat('en-CA', { year: 'numeric', month: '2-digit', day: '2-digit' }).format(new Date(value))
const isToday = (value?: string) => Boolean(value && dayKey(value) === dayKey(new Date()))
const isOverdue = (value?: string) => Boolean(value && new Date(value).getTime() < Date.now() && !isToday(value))
const taskStatusColor = (status: string) => (status === 'Done' ? 'success' : status === 'Blocked' ? 'danger' : ['In Progress', 'Review', 'Testing'].includes(status) ? 'warning' : 'primary')
const leadStatusColor = (lead: LeadType) => (lead.status === 'WON' ? 'success' : lead.assignmentException ? 'warning' : closedLeadStatuses.includes(lead.status) ? 'secondary' : 'primary')
const teamRoles = ['sales', 'operations', 'accounts', 'designers']

const AdminDashboard = () => {
  const token = useAuthStore((state) => state.token)
  const [leads, setLeads] = useState<LeadType[]>([])
  const [tasks, setTasks] = useState<Task[]>([])
  const [users, setUsers] = useState<UserType[]>([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  useEffect(() => {
    if (!token) return

    setLoading(true)
    setError('')
    Promise.all([
      apiFetch<{ data: LeadType[] }>('/leads?limit=50', { token }),
      apiFetch<{ data: Task[] }>('/tasks', { token }),
      apiFetch<{ data: UserType[] }>('/users', { token }),
    ])
      .then(([leadRes, taskRes, userRes]) => {
        setLeads(leadRes.data)
        setTasks(taskRes.data)
        setUsers(userRes.data)
      })
      .catch((e) => setError(e instanceof Error ? e.message : 'Unable to load dashboard'))
      .finally(() => setLoading(false))
  }, [token])

  const activeLeads = leads.filter((lead) => !closedLeadStatuses.includes(lead.status))
  const unassignedLeads = activeLeads.filter((lead) => lead.assignmentException || !lead.owner)
  const todayMeetings = leads
    .filter((lead) => isToday(lead.nextMeeting?.startsAt))
    .sort((a, b) => new Date(a.nextMeeting!.startsAt!).getTime() - new Date(b.nextMeeting!.startsAt!).getTime())
  const openTasks = tasks.filter((task) => task.status !== 'Done')
  const overdueTasks = openTasks.filter((task) => isOverdue(task.dueDate))
  const dueTodayTasks = openTasks.filter((task) => isToday(task.dueDate))
  const urgentTasks = useMemo(
    () =>
      [...openTasks]
        .sort((a, b) => {
          const priority = Number(b.priority === 'Critical') - Number(a.priority === 'Critical') || Number(b.priority === 'High') - Number(a.priority === 'High')
          return priority || new Date(a.dueDate || a.createdAt || 0).getTime() - new Date(b.dueDate || b.createdAt || 0).getTime()
        })
        .slice(0, 6),
    [openTasks],
  )
  const recentLeads = [...leads].sort((a, b) => new Date(b.createdAt || 0).getTime() - new Date(a.createdAt || 0).getTime()).slice(0, 6)
  const activeTeamUsers = users.filter((item) => teamRoles.includes(item.role) && item.status === 'active')

  const stats = [
    { label: 'Active leads', value: activeLeads.length, note: 'Follow-up required', bg: 'primary' },
    { label: 'Unassigned leads', value: unassignedLeads.length, note: 'Assign today', bg: unassignedLeads.length ? 'warning' : 'success' },
    { label: "Today's meetings", value: todayMeetings.length, note: 'Scheduled', bg: 'info' },
    { label: 'Overdue tasks', value: overdueTasks.length, note: 'Action required', bg: overdueTasks.length ? 'danger' : 'success' },
    { label: 'Tasks due today', value: dueTodayTasks.length, note: 'Due today', bg: 'warning' },
    { label: 'Team users', value: activeTeamUsers.length, note: 'Active team', bg: 'secondary' },
  ]

  return (
    <>
      <PageBreadcrumb title="Absteras Dashboard" subName="Facade CRM" />
      <PageMetaData title="Absteras Dashboard" />

      <div className="d-flex justify-content-between align-items-center gap-3 flex-wrap mb-4">
        <div className="text-muted">Absteras Company overview for leads, meetings, tasks, and sales workload.</div>
        <div className="d-flex gap-2 flex-wrap ms-auto">
          <Link to="/leads/create" className="btn btn-primary text-nowrap">Create Lead</Link>
          <Link to="/tasks/create" className="btn btn-outline-primary text-nowrap">Create Task</Link>
        </div>
      </div>

      {error && <Alert variant="danger">{error}</Alert>}
      {loading && !leads.length && !tasks.length ? (
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
              {!todayMeetings.length ? <Alert variant="info" className="mb-0">No meetings scheduled today.</Alert> : (
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
                      {todayMeetings.map((lead) => (
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
              {!urgentTasks.length ? <Alert variant="info" className="mb-0">No open tasks.</Alert> : (
                urgentTasks.map((task) => (
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
          {!recentLeads.length ? <Alert variant="info" className="mb-0">No leads found.</Alert> : (
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
                  {recentLeads.map((lead) => (
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
