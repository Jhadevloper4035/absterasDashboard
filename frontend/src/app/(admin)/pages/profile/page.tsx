import { useEffect, useMemo, useState } from 'react'
import { Alert, Badge, Button, Card, CardBody, Col, Row } from 'react-bootstrap'
import { Link } from 'react-router-dom'

import PageBreadcrumb from '@/components/layout/PageBreadcrumb'
import PageMetaData from '@/components/PageTitle'
import Spinner from '@/components/Spinner'
import TodoCompletedList from '@/components/TodoCompletedList'
import { apiFetch } from '@/helpers/api'
import { canAccessModule } from '@/helpers/moduleAccess'
import { useAuthStore } from '@/store/authStore'
import type { LeadOwner, LeadType } from '@/types/lead'

type DashboardTask = {
  _id: string
  title: string
  status: string
  priority: string
  dueDate?: string
  createdBy?: string | { _id: string }
}

type DashboardUpdate = {
  _id: string
  title?: string
  body?: string
  createdAt?: string
  metadata?: { taskId?: string; leadId?: string }
}

const ownerName = (owner?: string | LeadOwner) => (typeof owner === 'object' ? owner.name : '')
const dayKey = (value: string | Date, timezone: string) =>
  new Intl.DateTimeFormat('en-CA', { timeZone: timezone, year: 'numeric', month: '2-digit', day: '2-digit' }).format(new Date(value))
const timeText = (value: string, timezone: string) => new Intl.DateTimeFormat(undefined, { timeZone: timezone, hour: '2-digit', minute: '2-digit' }).format(new Date(value))
const dateText = (value: string, timezone: string) => new Intl.DateTimeFormat(undefined, { timeZone: timezone, month: 'short', day: 'numeric' }).format(new Date(value))
const statusVariant = (status: string) => (status === 'WON' ? 'success' : status === 'MEETING_SCHEDULED' ? 'info' : 'secondary')
const taskStatusVariant = (status: string) => (status === 'Done' ? 'success' : status === 'Blocked' ? 'danger' : ['In Progress', 'Review', 'Testing'].includes(status) ? 'warning' : 'primary')
const dashboardTitles = {
  sales: 'My Sales Dashboard',
  operations: 'My Operations Dashboard',
  accounts: 'My Accounts Dashboard',
  designers: 'My Designers Dashboard',
}

const MeetingCard = ({ lead, timezone, showDate, actionLabel }: { lead: LeadType; timezone: string; showDate?: boolean; actionLabel: string }) => {
  const startsAt = lead.nextMeeting?.startsAt

  return (
    <div className="border rounded p-3 h-100 d-flex flex-column">
      <div className="d-flex align-items-start justify-content-between gap-3 mb-3">
        <div>
          <div className="fw-semibold text-break">{lead.nextMeeting?.title || lead.name}</div>
          <div className="text-muted fs-13 text-break">{lead.company || lead.name}</div>
        </div>
        <Badge bg={showDate ? 'info' : 'warning'} text={showDate ? undefined : 'dark'} className="text-nowrap">
          {startsAt ? (showDate ? dateText(startsAt, timezone) : timeText(startsAt, timezone)) : '-'}
        </Badge>
      </div>
      <div className="text-muted fs-13 mb-3 flex-grow-1">
        {startsAt && showDate ? `${timeText(startsAt, timezone)} - ` : ''}
        {lead.nextMeeting?.notes || 'No agenda added'}
      </div>
      <div className="d-flex align-items-center justify-content-between gap-2">
        <Badge bg={statusVariant(lead.status)}>{lead.status}</Badge>
        <Link to={`/leads/${lead._id}`}>
          <Button size="sm" variant="outline-primary" className="text-nowrap">
            {actionLabel}
          </Button>
        </Link>
      </div>
    </div>
  )
}

const Profile = () => {
  const token = useAuthStore((state) => state.token)
  const user = useAuthStore((state) => state.user)
  const [leads, setLeads] = useState<LeadType[]>([])
  const [meetingLeads, setMeetingLeads] = useState<LeadType[]>([])
  const [tasks, setTasks] = useState<DashboardTask[]>([])
  const [updates, setUpdates] = useState<DashboardUpdate[]>([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const timezone = user?.timezone || Intl.DateTimeFormat().resolvedOptions().timeZone

  useEffect(() => {
    if (!token) return

    setLoading(true)
    setError('')
    Promise.all([
      canAccessModule(user, 'leads') ? apiFetch<{ data: LeadType[] }>('/leads?limit=50&fresh=true', { token }) : Promise.resolve({ data: [] }),
      canAccessModule(user, 'leads') ? apiFetch<{ data: LeadType[] }>('/leads?limit=50&upcomingMeeting=true&fresh=true', { token }) : Promise.resolve({ data: [] }),
      canAccessModule(user, 'tasks') ? apiFetch<{ data: DashboardTask[] }>('/tasks?limit=50&fresh=true', { token }) : Promise.resolve({ data: [] }),
      canAccessModule(user, 'notifications') ? apiFetch<{ data: DashboardUpdate[] }>('/notifications/unread?fresh=true', { token }) : Promise.resolve({ data: [] }),
    ])
      .then(([leadRes, meetingRes, taskRes, updateRes]) => {
        setLeads(leadRes.data)
        setMeetingLeads(meetingRes.data)
        setTasks(taskRes.data)
        setUpdates(updateRes.data)
      })
      .catch((e) => setError(e instanceof Error ? e.message : 'Unable to load dashboard data'))
      .finally(() => setLoading(false))
  }, [token, user])

  const todayMeetings = useMemo(
    () =>
      meetingLeads
        .filter((lead) => lead.nextMeeting?.startsAt && dayKey(lead.nextMeeting.startsAt, timezone) === dayKey(new Date(), timezone))
        .sort((a, b) => new Date(a.nextMeeting!.startsAt!).getTime() - new Date(b.nextMeeting!.startsAt!).getTime()),
    [meetingLeads, timezone],
  )
  const upcomingMeetings = useMemo(
    () =>
      meetingLeads
        .filter((lead) => {
          const startsAt = lead.nextMeeting?.startsAt
          return startsAt && new Date(startsAt).getTime() > Date.now() && dayKey(startsAt, timezone) !== dayKey(new Date(), timezone)
        })
        .sort((a, b) => new Date(a.nextMeeting!.startsAt!).getTime() - new Date(b.nextMeeting!.startsAt!).getTime())
        .slice(0, 5),
    [meetingLeads, timezone],
  )
  const activeLeads = leads.filter((lead) => !['WON', 'LOST', 'ON_HOLD'].includes(lead.status))
  const wonLeads = leads.filter((lead) => lead.status === 'WON')
  const recentLeads = [...leads].sort((a, b) => new Date(b.createdAt || 0).getTime() - new Date(a.createdAt || 0).getTime()).slice(0, 8)
  const openTasks = tasks.filter((task) => task.status !== 'Done')
  const overdueTasks = openTasks.filter((task) => task.dueDate && new Date(task.dueDate).getTime() < Date.now())
  const assignedByMe = tasks.filter((task) => String(typeof task.createdBy === 'object' ? task.createdBy?._id : task.createdBy) === String(user?._id))
  const openTasksAssignedByMe = assignedByMe.filter((task) => task.status !== 'Done')
  const overdueTasksAssignedByMe = openTasksAssignedByMe.filter((task) => task.dueDate && new Date(task.dueDate).getTime() < Date.now())
  const title = dashboardTitles[user?.role as keyof typeof dashboardTitles] || 'Team Dashboard'
  const stats = [
    { label: 'Total Leads', value: leads.length, variant: 'primary' },
    { label: 'Active Leads', value: activeLeads.length, variant: 'info' },
    { label: 'Today Meetings', value: todayMeetings.length, variant: 'warning' },
    { label: 'Won Leads', value: wonLeads.length, variant: 'success' },
    { label: 'Open Tasks', value: openTasks.length, variant: 'info' },
    { label: 'Overdue Tasks', value: overdueTasks.length, variant: overdueTasks.length ? 'danger' : 'success' },
    { label: 'Open Tasks Assigned By Me', value: openTasksAssignedByMe.length, variant: 'info' },
    { label: 'Overdue Tasks Assigned By Me', value: overdueTasksAssignedByMe.length, variant: overdueTasksAssignedByMe.length ? 'danger' : 'success' },
  ]

  return (
    <>
      <PageBreadcrumb subName="Dashboards" title={title} />
      <PageMetaData title={title} />

      <Card className="mb-4">
        <CardBody className="d-flex align-items-center justify-content-between flex-wrap gap-3">
          <div>
            <h4 className="mb-1">Hi {user?.name || 'Salesperson'}</h4>
            <div className="text-muted">Here are your leads, meetings, and next actions for today.</div>
          </div>
          <Badge bg="light" text="dark">
            {timezone}
          </Badge>
          {user?.role === 'sales' && <Link to="/leads/mine"><Button size="sm">My Leads</Button></Link>}
        </CardBody>
      </Card>

      <Row className="g-3 mb-4">
        {stats.map((item) => (
          <Col md={6} xl={3} key={item.label}>
            <Card className="h-100">
              <CardBody>
                <div className="text-muted fs-13">{item.label}</div>
                <div className="d-flex align-items-center justify-content-between mt-2">
                  <h3 className="mb-0">{item.value}</h3>
                  <Badge bg={item.variant}>{dashboardTitles[user?.role as keyof typeof dashboardTitles] ? 'Mine' : 'Allowed'}</Badge>
                </div>
              </CardBody>
            </Card>
          </Col>
        ))}
      </Row>

      <Card className="mb-4">
        <CardBody>
          <div className="d-flex align-items-center justify-content-between mb-3">
            <div>
              <h4 className="card-title mb-1">Today&apos;s Meetings</h4>
              <div className="text-muted">
                {user?.name || 'Salesperson'}, you have {todayMeetings.length} meeting{todayMeetings.length === 1 ? '' : 's'} today
              </div>
            </div>
            <Badge bg="light" text="dark">
              {dayKey(new Date(), timezone)}
            </Badge>
          </div>
          {loading && !leads.length ? (
            <div className="text-center py-5">
              <Spinner className="spinner-border-sm me-2" tag="span" />
              <span className="text-muted">Loading dashboard data...</span>
            </div>
          ) : null}
          {error && <Alert variant="danger">{error}</Alert>}
          {!todayMeetings.length && !error && !loading ? <Alert variant="info">No meetings scheduled for today</Alert> : null}
          {todayMeetings.length ? (
            <Row className="g-3">
              {todayMeetings.map((lead) => (
                <Col md={6} xl={4} key={lead._id}>
                  <MeetingCard lead={lead} timezone={timezone} actionLabel="Update Detail" />
                </Col>
              ))}
            </Row>
          ) : null}
        </CardBody>
      </Card>

      <Card className="mb-4">
        <CardBody>
          <div className="d-flex align-items-center justify-content-between mb-3">
            <div>
              <h4 className="card-title mb-1">Upcoming Meetings</h4>
              <div className="text-muted">Next scheduled meetings after today</div>
            </div>
            <Badge bg="light" text="dark">
              {upcomingMeetings.length} upcoming
            </Badge>
          </div>
          {!upcomingMeetings.length && !error && !loading ? <Alert variant="info" className="mb-0">No upcoming meetings scheduled</Alert> : null}
          {upcomingMeetings.length ? (
            <Row className="g-3">
              {upcomingMeetings.map((lead) => (
                <Col md={6} xl={4} key={lead._id}>
                  <MeetingCard lead={lead} timezone={timezone} showDate actionLabel="View Lead" />
                </Col>
              ))}
            </Row>
          ) : null}
        </CardBody>
      </Card>

      <Row className="g-3 mb-4">
        <Col xl={7}>
          <Card className="h-100">
            <CardBody>
              <div className="d-flex align-items-center justify-content-between mb-3 gap-3">
                <div>
                  <h4 className="card-title mb-1">My Open Tasks</h4>
                  <div className="text-muted">Tasks created by you or assigned to you.</div>
                </div>
                <div className="d-flex gap-2">
                  <Link to="/tasks/assigned-by-me"><Button size="sm" variant="outline-primary">Assigned By Me</Button></Link>
                  <Link to="/tasks/assigned-to-me"><Button size="sm" variant="outline-primary">Assigned To Me</Button></Link>
                </div>
              </div>
              {!openTasks.length && !loading && !error ? <Alert variant="info" className="mb-0">No open tasks.</Alert> : null}
              {openTasks.slice(0, 5).map((task) => (
                <div key={task._id} className="d-flex align-items-center justify-content-between border-top py-3 gap-3">
                  <div>
                    <Link to={`/tasks/${task._id}`} className="fw-medium">{task.title}</Link>
                    <div className="text-muted fs-13">Due: {task.dueDate ? new Date(task.dueDate).toLocaleDateString() : 'Not set'}</div>
                  </div>
                  <Badge bg={taskStatusVariant(task.status)}>{task.status}</Badge>
                </div>
              ))}
            </CardBody>
          </Card>
        </Col>
        <Col xl={5}>
          <Card className="h-100">
            <CardBody>
              <div className="d-flex align-items-center justify-content-between mb-3 gap-3">
                <div>
                  <h4 className="card-title mb-1">Important Updates</h4>
                  <div className="text-muted">Unread lead and task changes.</div>
                </div>
                <Link to="/notifications"><Button size="sm" variant="outline-primary">View Updates</Button></Link>
              </div>
              {!updates.length && !loading && !error ? <Alert variant="info" className="mb-0">You are up to date.</Alert> : null}
              {updates.slice(0, 5).map((update) => {
                const href = update.metadata?.taskId ? `/tasks/${update.metadata.taskId}` : update.metadata?.leadId ? `/leads/${update.metadata.leadId}` : '/notifications'
                return (
                  <div key={update._id} className="border-top py-3">
                    <Link to={href} className="fw-medium d-block">{update.title || 'Update'}</Link>
                    {update.body && <div className="text-muted fs-13 text-truncate">{update.body}</div>}
                  </div>
                )
              })}
            </CardBody>
          </Card>
        </Col>
      </Row>

      <div className="mb-4">
        <TodoCompletedList />
      </div>

      <Card className="mb-4">
        <CardBody>
          <div className="d-flex align-items-center justify-content-between mb-3">
            <div>
              <h4 className="card-title mb-1">Recent Leads</h4>
              <div className="text-muted">{user?.name || 'User'} data</div>
            </div>
            <Badge bg="light" text="dark">
              {recentLeads.length} shown
            </Badge>
          </div>
          {!recentLeads.length && !loading && !error ? <Alert variant="info">No leads found</Alert> : null}
          {recentLeads.map((lead) => (
            <div key={lead._id} className="d-flex align-items-center justify-content-between border-top py-3 gap-3">
              <div>
                <div className="fw-medium">{lead.name}</div>
                <div className="text-muted fs-13">
                  {lead.company || lead.email || lead.phone || '-'}
                  {ownerName(lead.owner) ? ` - ${ownerName(lead.owner)}` : ''}
                </div>
              </div>
              <div className="d-flex align-items-center gap-2">
                <Badge bg={lead.status === 'WON' ? 'success' : lead.assignmentException ? 'warning' : 'secondary'} text={lead.assignmentException ? 'dark' : undefined}>
                  {lead.status}
                </Badge>
                <Link to={`/leads/${lead._id}`}>
                  <Button size="sm" variant="outline-primary" className="text-nowrap">
                    View
                  </Button>
                </Link>
              </div>
            </div>
          ))}
        </CardBody>
      </Card>
    </>
  )
}

export default Profile
