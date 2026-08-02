import { useEffect, useMemo, useState } from 'react'
import { Alert, Badge, Button, Card, CardBody, Col, Row } from 'react-bootstrap'
import { Link } from 'react-router-dom'

import PageBreadcrumb from '@/components/layout/PageBreadcrumb'
import PageMetaData from '@/components/PageTitle'
import Spinner from '@/components/Spinner'
import TodoCompletedList from '@/components/TodoCompletedList'
import { apiFetch } from '@/helpers/api'
import { useAuthStore } from '@/store/authStore'
import type { LeadOwner, LeadType } from '@/types/lead'

const ownerName = (owner?: string | LeadOwner) => (typeof owner === 'object' ? owner.name : '')
const dayKey = (value: string | Date, timezone: string) =>
  new Intl.DateTimeFormat('en-CA', { timeZone: timezone, year: 'numeric', month: '2-digit', day: '2-digit' }).format(new Date(value))
const timeText = (value: string, timezone: string) => new Intl.DateTimeFormat(undefined, { timeZone: timezone, hour: '2-digit', minute: '2-digit' }).format(new Date(value))
const dateText = (value: string, timezone: string) => new Intl.DateTimeFormat(undefined, { timeZone: timezone, month: 'short', day: 'numeric' }).format(new Date(value))
const statusVariant = (status: string) => (status === 'WON' ? 'success' : status === 'MEETING_SCHEDULED' ? 'info' : 'secondary')
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
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const timezone = user?.timezone || Intl.DateTimeFormat().resolvedOptions().timeZone

  useEffect(() => {
    if (!token) return

    setLoading(true)
    setError('')
    Promise.all([
      apiFetch<{ data: LeadType[] }>('/leads?limit=50', { token }),
      apiFetch<{ data: LeadType[] }>('/leads?limit=50&upcomingMeeting=true', { token }),
    ])
      .then(([leadRes, meetingRes]) => {
        setLeads(leadRes.data)
        setMeetingLeads(meetingRes.data)
      })
      .catch((e) => setError(e instanceof Error ? e.message : 'Unable to load dashboard data'))
      .finally(() => setLoading(false))
  }, [token])

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
  const title = dashboardTitles[user?.role as keyof typeof dashboardTitles] || 'Team Dashboard'
  const stats = [
    { label: 'Total Leads', value: leads.length, variant: 'primary' },
    { label: 'Active Leads', value: activeLeads.length, variant: 'info' },
    { label: 'Today Meetings', value: todayMeetings.length, variant: 'warning' },
    { label: 'Won Leads', value: wonLeads.length, variant: 'success' },
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
