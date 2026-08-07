import PageMetaData from '@/components/PageTitle'
import { apiFetch } from '@/helpers/api'
import FullCalendar from '@fullcalendar/react'
import dayGridPlugin from '@fullcalendar/daygrid'
import { useEffect, useState } from 'react'
import { Alert, Card, CardBody } from 'react-bootstrap'

type Request = { _id: string; fromDate: string; toDate: string; status: string; employee: { user: { name: string } }; leaveType: { name: string } }
const LeaveCalendarPage = () => {
  const [requests, setRequests] = useState<Request[]>([]); const [error, setError] = useState('')
  useEffect(() => { apiFetch<{ data: Request[] }>('/hr/leave/requests?status=approved').then((response) => setRequests(response.data)).catch((value) => setError(value instanceof Error ? value.message : 'Unable to load leave calendar')) }, [])
  return <><PageMetaData title="Leave calendar" /><Card><CardBody><h4 className="card-title mb-3">Leave calendar</h4>{error && <Alert variant="danger">{error}</Alert>}<FullCalendar plugins={[dayGridPlugin]} initialView="dayGridMonth" themeSystem="bootstrap" events={requests.map((request) => ({ id: request._id, title: `${request.employee?.user.name} — ${request.leaveType?.name}`, start: request.fromDate.slice(0, 10), end: new Date(new Date(request.toDate).getTime() + 86400000).toISOString().slice(0, 10), allDay: true }))} /></CardBody></Card></>
}
export default LeaveCalendarPage
