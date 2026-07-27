import { useEffect, useMemo, useState } from 'react'
import { Alert, Badge, Button, Card, CardBody, Col, Row, Table } from 'react-bootstrap'
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

const Profile = () => {
  const token = useAuthStore((state) => state.token)
  const user = useAuthStore((state) => state.user)
  const [leads, setLeads] = useState<LeadType[]>([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const timezone = user?.timezone || Intl.DateTimeFormat().resolvedOptions().timeZone

  useEffect(() => {
    if (!token) return

    setLoading(true)
    setError('')
    apiFetch<{ data: LeadType[] }>('/leads?limit=50', { token })
      .then((res) => setLeads(res.data))
      .catch((e) => setError(e instanceof Error ? e.message : 'Unable to load dashboard data'))
      .finally(() => setLoading(false))
  }, [token])

  const todayMeetings = useMemo(
    () =>
      leads
        .filter((lead) => lead.nextMeeting?.startsAt && dayKey(lead.nextMeeting.startsAt, timezone) === dayKey(new Date(), timezone))
        .sort((a, b) => new Date(a.nextMeeting!.startsAt!).getTime() - new Date(b.nextMeeting!.startsAt!).getTime()),
    [leads, timezone],
  )
  const activeLeads = leads.filter((lead) => !['WON', 'LOST', 'ON_HOLD'].includes(lead.status))
  const wonLeads = leads.filter((lead) => lead.status === 'WON')
  const recentLeads = [...leads].sort((a, b) => new Date(b.createdAt || 0).getTime() - new Date(a.createdAt || 0).getTime()).slice(0, 8)
  const title = user?.role === 'sales' ? 'My Sales Dashboard' : 'Team Dashboard'
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

      <Row>
        {stats.map((item) => (
          <Col md={6} xl={3} key={item.label}>
            <Card>
              <CardBody>
                <div className="text-muted fs-13">{item.label}</div>
                <div className="d-flex align-items-center justify-content-between mt-2">
                  <h3 className="mb-0">{item.value}</h3>
                  <Badge bg={item.variant}>{user?.role === 'sales' ? 'Mine' : 'Allowed'}</Badge>
                </div>
              </CardBody>
            </Card>
          </Col>
        ))}
      </Row>

      <Card>
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
            <div className="table-responsive">
              <Table hover className="table-nowrap align-middle mb-0">
                <thead>
                  <tr>
                    <th>Time</th>
                    <th>Meeting</th>
                    <th>Lead</th>
                    <th>Company</th>
                    <th>Assigned</th>
                    <th>Status</th>
                    <th className="text-end">Action</th>
                  </tr>
                </thead>
                <tbody>
                  {todayMeetings.map((lead) => (
                    <tr key={lead._id}>
                      <td>{lead.nextMeeting?.startsAt ? timeText(lead.nextMeeting.startsAt, timezone) : '-'}</td>
                      <td>
                        <div className="fw-medium">{lead.nextMeeting?.title || lead.name}</div>
                        <div className="text-muted fs-13">{lead.nextMeeting?.notes || '-'}</div>
                      </td>
                      <td>{lead.name}</td>
                      <td>{lead.company || '-'}</td>
                      <td>{ownerName(lead.owner) || user?.name || '-'}</td>
                      <td>
                        <Badge bg="success">{lead.status}</Badge>
                      </td>
                      <td className="text-end">
                        <Link to={`/leads/${lead._id}`}>
                          <Button size="sm" variant="outline-primary" className="text-nowrap">
                            Update Detail
                          </Button>
                        </Link>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </Table>
            </div>
          ) : null}
        </CardBody>
      </Card>

      <TodoCompletedList />

      <Card>
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
