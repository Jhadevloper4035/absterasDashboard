import PageMetaData from '@/components/PageTitle'
import { apiFetch } from '@/helpers/api'
import dayGridPlugin from '@fullcalendar/daygrid'
import FullCalendar from '@fullcalendar/react'
import { useEffect, useMemo, useState } from 'react'
import { Alert, Badge, Card, CardBody, Col, Row, Spinner } from 'react-bootstrap'

type Holiday = { _id: string; date: string; name: string; type: 'government' | 'festival' | 'private' }
type LeaveRequest = { _id: string; fromDate: string; toDate: string; leaveType?: { name?: string } }

const dateOnly = (value: string) => value.slice(0, 10)
const nextDay = (value: string) => {
  const date = new Date(`${dateOnly(value)}T00:00:00.000Z`)
  date.setUTCDate(date.getUTCDate() + 1)
  return date.toISOString().slice(0, 10)
}
const holidayColor = (type: Holiday['type']) => type === 'government' ? '#0d6efd' : type === 'festival' ? '#fd7e14' : '#6f42c1'
const displayDate = (value: string) => new Intl.DateTimeFormat(undefined, { weekday: 'short', day: 'numeric', month: 'short', year: 'numeric' }).format(new Date(`${dateOnly(value)}T00:00:00`))

const UpcomingHolidaysPage = () => {
  const [holidays, setHolidays] = useState<Holiday[]>([])
  const [leaves, setLeaves] = useState<LeaveRequest[]>([])
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    const today = new Date().toISOString().slice(0, 10)
    Promise.all([
      apiFetch<{ data: Holiday[] }>('/hr/holidays'),
      apiFetch<{ data: LeaveRequest[] }>('/hr/leave/requests?status=approved'),
    ])
      .then(([holidayResponse, leaveResponse]) => {
        setHolidays(holidayResponse.data.filter((holiday) => dateOnly(holiday.date) >= today))
        setLeaves(leaveResponse.data.filter((leave) => dateOnly(leave.toDate) >= today))
      })
      .catch((value) => setError(value instanceof Error ? value.message : 'Unable to load your calendar'))
      .finally(() => setLoading(false))
  }, [])

  const events = useMemo(() => [
    ...holidays.map((holiday) => ({ id: `holiday-${holiday._id}`, title: holiday.name, start: dateOnly(holiday.date), end: nextDay(holiday.date), allDay: true, color: holidayColor(holiday.type) })),
    ...leaves.map((leave) => ({ id: `leave-${leave._id}`, title: `My leave — ${leave.leaveType?.name || 'Leave'}`, start: dateOnly(leave.fromDate), end: nextDay(leave.toDate), allDay: true, color: '#198754' })),
  ], [holidays, leaves])
  const upcomingItems = useMemo(() => [
    ...holidays.map((holiday) => ({ id: `holiday-${holiday._id}`, date: holiday.date, title: holiday.name, detail: `${holiday.type[0].toUpperCase()}${holiday.type.slice(1)} holiday`, variant: 'primary' })),
    ...leaves.map((leave) => ({ id: `leave-${leave._id}`, date: leave.fromDate, title: leave.leaveType?.name || 'Approved leave', detail: `${displayDate(leave.fromDate)} – ${displayDate(leave.toDate)}`, variant: 'success' })),
  ].sort((a, b) => a.date.localeCompare(b.date)), [holidays, leaves])
  const nextHoliday = upcomingItems.find((item) => item.id.startsWith('holiday-'))
  const nextLeave = upcomingItems.find((item) => item.id.startsWith('leave-'))

  return <>
    <PageMetaData title="Upcoming holidays" />
    <Card className="border-0 shadow-sm mb-4">
      <CardBody>
        <div className="d-flex justify-content-between align-items-start flex-wrap gap-3">
          <div>
            <div className="text-primary text-uppercase fw-semibold small mb-1">My schedule</div>
            <h3 className="mb-1">Holidays & approved leave</h3>
            <p className="text-muted mb-0">Plan ahead with company holidays and your approved leave, including Birthday Leave.</p>
          </div>
          <div className="d-flex gap-2 flex-wrap"><Badge bg="primary" className="px-3 py-2">Company holiday</Badge><Badge bg="success" className="px-3 py-2">My approved leave</Badge></div>
        </div>
      </CardBody>
    </Card>
    {error && <Alert variant="danger">{error}</Alert>}
    {loading ? <Card><CardBody className="text-center text-muted py-5"><Spinner animation="border" size="sm" className="me-2" />Loading your schedule…</CardBody></Card> : <>
      <Row className="g-3 mb-4">
        <Col md={6}><Card className="h-100 border shadow-sm"><CardBody><small className="text-muted text-uppercase fw-semibold">Next company holiday</small><h5 className="mt-2 mb-1">{nextHoliday?.title || 'No holiday scheduled'}</h5><span className="text-muted">{nextHoliday ? displayDate(nextHoliday.date) : 'HR has not added an upcoming holiday yet.'}</span></CardBody></Card></Col>
        <Col md={6}><Card className="h-100 border shadow-sm"><CardBody><small className="text-muted text-uppercase fw-semibold">My next approved leave</small><h5 className="mt-2 mb-1">{nextLeave?.title || 'No approved leave planned'}</h5><span className="text-muted">{nextLeave?.detail || 'Approved leave will appear here automatically.'}</span></CardBody></Card></Col>
      </Row>
      <Row className="g-4">
        <Col xl={8}>
          <Card className="h-100 border shadow-sm"><CardBody>
            <div className="d-flex justify-content-between align-items-start gap-3 flex-wrap mb-3"><div><h5 className="mb-1">Calendar</h5><p className="text-muted mb-0">Use the arrows to view future months.</p></div><div className="d-flex gap-2 flex-wrap"><Badge bg="primary">Holiday</Badge><Badge bg="success">Approved leave</Badge></div></div>
            {!events.length && <Alert variant="light" className="border text-muted">No upcoming holidays or approved leave have been scheduled yet.</Alert>}
            <FullCalendar plugins={[dayGridPlugin]} initialView="dayGridMonth" themeSystem="bootstrap" events={events} height="auto" fixedWeekCount={false} dayMaxEvents={2} headerToolbar={{ left: 'prev,next today', center: 'title', right: '' }} buttonText={{ today: 'Today' }} />
          </CardBody></Card>
        </Col>
        <Col xl={4}>
          <Card className="h-100 border shadow-sm"><CardBody>
            <h5 className="mb-1">Upcoming schedule</h5><p className="text-muted mb-3">Your next holidays and approved time off.</p>
            <div className="vstack gap-2">{upcomingItems.slice(0, 6).map((item) => <div className="border rounded p-3" key={item.id}><div className="d-flex justify-content-between align-items-start gap-2"><div className="fw-semibold">{item.title}</div><Badge bg={item.variant}>{item.id.startsWith('holiday-') ? 'Holiday' : 'Leave'}</Badge></div><small className="text-muted d-block mt-1">{item.id.startsWith('holiday-') ? displayDate(item.date) : item.detail}</small></div>)}{!upcomingItems.length && <div className="text-center text-muted py-4">Nothing upcoming yet.</div>}</div>
          </CardBody></Card>
        </Col>
      </Row>
    </>}
  </>
}

export default UpcomingHolidaysPage
