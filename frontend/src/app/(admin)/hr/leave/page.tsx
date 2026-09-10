import PageMetaData from '@/components/PageTitle'
import { apiFetch } from '@/helpers/api'
import type { EventClickArg } from '@fullcalendar/core'
import dayGridPlugin from '@fullcalendar/daygrid'
import interactionPlugin, { type DateClickArg } from '@fullcalendar/interaction'
import FullCalendar from '@fullcalendar/react'
import { FormEvent, useEffect, useMemo, useState } from 'react'
import { Alert, Badge, Button, Card, CardBody, Col, Form, Modal, Row, Table } from 'react-bootstrap'
import Swal from 'sweetalert2'

type LeaveType = { _id: string; name: string; maxBalance: number; isPaid: boolean }
type Balance = { _id: string; balance: number; leaveType: LeaveType }
type Holiday = { _id: string; date: string; name: string; type: 'government' | 'festival' | 'private' }
const sundayEvents = () => {
  const events = []
  const sunday = new Date()
  sunday.setUTCDate(sunday.getUTCDate() - sunday.getUTCDay())
  for (let index = 0; index < 104; index++) {
    const date = new Date(sunday)
    date.setUTCDate(date.getUTCDate() + index * 7)
    events.push({ id: `sunday-${date.toISOString().slice(0, 10)}`, title: 'Sunday · Weekly off', start: date.toISOString().slice(0, 10), allDay: true, color: '#6c757d' })
  }
  return events
}
type Request = {
  _id: string
  fromDate: string
  toDate: string
  days: number
  paidDays: number
  status: string
  reason?: string
  leaveType: LeaveType
  employee?: { user?: { name: string } }
}
const LeavePage = () => {
  const [types, setTypes] = useState<LeaveType[]>([])
  const [balances, setBalances] = useState<Balance[]>([])
  const [requests, setRequests] = useState<Request[]>([])
  const [holidays, setHolidays] = useState<Holiday[]>([])
  const [leaveType, setLeaveType] = useState('')
  const [fromDate, setFromDate] = useState('')
  const [toDate, setToDate] = useState('')
  const [reason, setReason] = useState('')
  const [newType, setNewType] = useState('')
  const [showTypeModal, setShowTypeModal] = useState(false)
  const [holidayForm, setHolidayForm] = useState({ id: '', date: '', name: '', type: 'festival' as Holiday['type'] })
  const [showHolidayModal, setShowHolidayModal] = useState(false)
  const [error, setError] = useState('')
  const [canManage, setCanManage] = useState(false)
  const [canManageHolidays, setCanManageHolidays] = useState(false)
  const selectedLeaveType = types.find((type) => type._id === leaveType)
  const selectedBalance = balances.find((balance) => balance.leaveType._id === leaveType)
  const requestCounts = useMemo(() => ({
    pending: requests.filter((request) => request.status === 'pending').length,
    approved: requests.filter((request) => request.status === 'approved').length,
    rejected: requests.filter((request) => request.status === 'rejected').length,
  }), [requests])
  const load = () =>
    Promise.all([
      apiFetch<{ data: LeaveType[] }>('/hr/leave/types'),
      apiFetch<{ data: Balance[] }>('/hr/leave/balances'),
      apiFetch<{ data: Request[] }>('/hr/leave/requests'),
    ])
      .then(([typeResponse, balanceResponse, requestResponse]) => {
        setTypes(typeResponse.data)
        setBalances(balanceResponse.data)
        setRequests(requestResponse.data)
        setLeaveType((selected) => selected || typeResponse.data[0]?._id || '')
      })
      .catch((value) => setError(value instanceof Error ? value.message : 'Unable to load leave data'))
  useEffect(() => {
    load()
    apiFetch<{ data: { module: string; access: string }[] }>('/hr/permissions/me')
      .then((response) => {
        const canManageLeave = response.data.some((item) => item.module === 'leave' && item.access === 'manage')
        const canManageHoliday = response.data.some((item) => item.module === 'attendance' && item.access === 'manage')
        setCanManage(canManageLeave)
        setCanManageHolidays(canManageHoliday)
        if (canManageHoliday) apiFetch<{ data: Holiday[] }>('/hr/holidays').then((holidayResponse) => setHolidays(holidayResponse.data)).catch(() => {})
      })
      .catch(() => {})
  }, [])
  const apply = async (event: FormEvent) => {
    event.preventDefault()
    setError('')
    try {
      await apiFetch('/hr/leave/requests', { method: 'POST', body: JSON.stringify({ leaveType, fromDate, toDate, reason }) })
      setFromDate('')
      setToDate('')
      setReason('')
      load()
    } catch (value) {
      setError(value instanceof Error ? value.message : 'Unable to apply for leave')
    }
  }
  const createType = async (event: FormEvent) => {
    event.preventDefault()
    try {
      await apiFetch('/hr/leave/types', { method: 'POST', body: JSON.stringify({ name: newType }) })
      setNewType('')
      setShowTypeModal(false)
      load()
    } catch (value) {
      setError(value instanceof Error ? value.message : 'Unable to create leave type')
    }
  }
  const loadHolidays = () => apiFetch<{ data: Holiday[] }>('/hr/holidays').then((response) => setHolidays(response.data))
  const openHolidayCreate = (arg: DateClickArg) => {
    if (canManageHolidays && arg.date.getUTCDay() !== 0) {
      setHolidayForm({ id: '', date: arg.dateStr, name: '', type: 'festival' })
      setShowHolidayModal(true)
    }
  }
  const openHolidayEdit = (arg: EventClickArg) => {
    const holiday = holidays.find((item) => item._id === arg.event.id)
    if (canManageHolidays && holiday) {
      setHolidayForm({ id: holiday._id, date: holiday.date.slice(0, 10), name: holiday.name, type: holiday.type })
      setShowHolidayModal(true)
    }
  }
  const saveHoliday = async (event: FormEvent) => {
    event.preventDefault()
    try {
      await apiFetch(holidayForm.id ? `/hr/holidays/${holidayForm.id}` : '/hr/holidays', {
        method: holidayForm.id ? 'PATCH' : 'POST',
        body: JSON.stringify({ date: holidayForm.date, name: holidayForm.name, type: holidayForm.type }),
      })
      setShowHolidayModal(false)
      await loadHolidays()
    } catch (value) {
      setError(value instanceof Error ? value.message : 'Unable to save holiday')
    }
  }
  const removeHoliday = async () => {
    if (!holidayForm.id || !window.confirm('Delete this holiday?')) return
    try {
      await apiFetch(`/hr/holidays/${holidayForm.id}`, { method: 'DELETE' })
      setShowHolidayModal(false)
      await loadHolidays()
    } catch (value) {
      setError(value instanceof Error ? value.message : 'Unable to delete holiday')
    }
  }
  const calendarEvents = useMemo(
    () => [
      ...sundayEvents(),
      ...holidays.map((holiday) => ({
        id: holiday._id,
        title: `Holiday — ${holiday.name}`,
        start: holiday.date.slice(0, 10),
        end: new Date(new Date(holiday.date).getTime() + 86400000).toISOString().slice(0, 10),
        allDay: true,
        color: holiday.type === 'government' ? '#0d6efd' : holiday.type === 'private' ? '#6f42c1' : '#fd7e14',
      })),
      ...requests
        .filter((request) => request.status === 'approved')
        .map((request) => ({
          id: request._id,
          title: `${request.employee?.user?.name || 'Employee'} — ${request.leaveType?.name || 'Leave'}`,
          start: request.fromDate.slice(0, 10),
          end: new Date(new Date(request.toDate).getTime() + 86400000).toISOString().slice(0, 10),
          allDay: true,
        })),
    ],
    [holidays, requests],
  )
  const decide = async (request: Request, status: 'approved' | 'rejected') => {
    const result = await Swal.fire({ icon: status === 'approved' ? 'question' : 'warning', title: `${status === 'approved' ? 'Approve' : 'Decline'} leave request?`, text: status === 'approved' ? 'Paid and unpaid days will be calculated automatically from this month’s leave policy.' : 'The employee will be notified that this request was declined.', showCancelButton: true, confirmButtonText: status === 'approved' ? 'Approve leave' : 'Decline leave', confirmButtonColor: status === 'approved' ? undefined : '#dc3545' })
    if (!result.isConfirmed) return
    try {
      await apiFetch(`/hr/leave/requests/${request._id}`, { method: 'PATCH', body: JSON.stringify({ status }) })
      load()
    } catch (value) {
      setError(value instanceof Error ? value.message : 'Unable to update request')
    }
  }
  return (
    <>
      <PageMetaData title="Leave" />
      <Card className="mb-4 border-0 shadow-sm">
        <CardBody>
          <div className="d-flex justify-content-between align-items-start flex-wrap gap-3">
            <div>
              <div className="text-primary text-uppercase fw-semibold small mb-1">HR management</div>
              <h4 className="card-title mb-1">Leave requests</h4>
              <p className="text-muted mb-0">
              {canManage ? 'Review employee requests and manage leave types. Payroll calculates paid and unpaid days automatically.' : 'Check your leave balance, request time off, and follow each decision.'}
              </p>
            </div>
            {canManage && <Button onClick={() => setShowTypeModal(true)}>Add leave type</Button>}
          </div>
          {error && (
            <Alert className="mt-3 mb-0" variant="danger">
              {error}
            </Alert>
          )}
        </CardBody>
      </Card>
      <Row className="g-3 mb-4">
        {[
          ['Pending', requestCounts.pending, 'warning'],
          ['Approved', requestCounts.approved, 'success'],
          ['Declined', requestCounts.rejected, 'danger'],
        ].map(([label, count, variant]) => (
          <Col md={4} key={label as string}>
            <Card className="h-100 border shadow-sm">
              <CardBody className="d-flex align-items-center justify-content-between py-3">
                <span className="text-muted">{label}</span>
                <Badge pill bg={variant as string} className="fs-6 px-3 py-2">{count}</Badge>
              </CardBody>
            </Card>
          </Col>
        ))}
      </Row>
      {!canManage && <>
        <Card className="mb-4 border shadow-sm">
          <CardBody>
            <div className="d-flex justify-content-between align-items-center flex-wrap gap-2 mb-3">
              <div>
                <h5 className="mb-1">My leave balance</h5>
                <small className="text-muted">Available days by leave type.</small>
              </div>
            </div>
            {balances.length ? <Row className="g-3">
              {balances.map((balance) => <Col key={balance._id} sm={6} xl={4}>
                <div className="border rounded-3 p-3 h-100">
                  <div className="text-muted small mb-1">{balance.leaveType.name}</div>
                  <div className="fw-semibold fs-5">{balance.balance} day{balance.balance === 1 ? '' : 's'}</div>
                  <small className="text-muted">remaining</small>
                </div>
              </Col>)}
            </Row> : <span className="text-muted">Your leave details are reviewed by HR when each request is approved.</span>}
          </CardBody>
        </Card>
        <Card className="mb-4 border shadow-sm">
          <CardBody>
            <div className="mb-4">
              <h5 className="mb-1">Request time off</h5>
              <small className="text-muted">Choose the leave type and dates. Your request is sent to HR for approval.</small>
            </div>
            <Form onSubmit={apply}>
              <Row className="g-3">
                <Col lg={4} md={6}>
                  <Form.Label>Leave type</Form.Label>
                  <Form.Select required value={leaveType} onChange={(event) => setLeaveType(event.target.value)}>
                    <option value="">Choose leave type</option>
                    {types.map((type) => <option key={type._id} value={type._id}>{type.name}</option>)}
                  </Form.Select>
                  {selectedBalance && <Form.Text>{selectedBalance.balance} day{selectedBalance.balance === 1 ? '' : 's'} available.</Form.Text>}
                  {selectedLeaveType?.name === 'Long Leave' && <Form.Text className="d-block">Choose your full leave period and submit it to HR for approval.</Form.Text>}
                </Col>
                <Col lg={2} md={3}>
                  <Form.Label>From</Form.Label>
                  <Form.Control required type="date" value={fromDate} onChange={(event) => setFromDate(event.target.value)} />
                </Col>
                <Col lg={2} md={3}>
                  <Form.Label>To</Form.Label>
                  <Form.Control required type="date" value={toDate} min={fromDate} onChange={(event) => setToDate(event.target.value)} />
                </Col>
                <Col lg={4}>
                  <Form.Label>Reason <span className="text-muted">(optional)</span></Form.Label>
                  <Form.Control as="textarea" rows={2} placeholder="Add a short note for HR" value={reason} onChange={(event) => setReason(event.target.value)} />
                </Col>
                <Col xs={12} className="d-flex justify-content-end">
                  <Button type="submit" disabled={!types.length}>Submit leave request</Button>
                </Col>
              </Row>
            </Form>
          </CardBody>
        </Card>
      </>}
      <Card className="border shadow-sm">
        <CardBody>
          <div className="d-flex justify-content-between flex-wrap gap-2 mb-3">
            <div>
              <h5 className="mb-1">{canManage ? 'Requests to review' : 'My leave requests'}</h5>
              <small className="text-muted">{canManage ? 'Pending requests need an approval decision.' : 'Track the status of every request you submit.'}</small>
            </div>
            {canManage && (
              <div className="d-flex gap-2 flex-wrap align-items-center">
                {types.map((type) => (
                  <Badge key={type._id} bg="light" text="dark" className="d-inline-flex align-items-center justify-content-center text-center">{type.name}</Badge>
                ))}
              </div>
            )}
          </div>
          <Table responsive className="align-middle mb-0">
            <thead>
              <tr>
                {canManage && <th>Employee</th>}
                <th>Type</th>
                <th>Dates</th>
                <th>Days</th>
                <th>Reason</th>
                <th>Status</th>
                {canManage && <th className="text-end">Actions</th>}
              </tr>
            </thead>
            <tbody>
              {requests.map((request) => (
                <tr key={request._id}>
                  {canManage && <td>{request.employee?.user?.name || '-'}</td>}
                  <td>
                    {request.leaveType?.name}{' '}
                    {canManage && request.status === 'approved' && <Badge bg={request.paidDays > 0 ? 'success' : 'secondary'} className="ms-1">{request.paidDays > 0 ? `${request.paidDays} paid · ${Math.max(request.days - request.paidDays, 0)} unpaid` : 'Unpaid'}</Badge>}
                  </td>
                  <td>
                    {new Date(request.fromDate).toLocaleDateString()} – {new Date(request.toDate).toLocaleDateString()}
                  </td>
                  <td>{request.days}</td>
                  <td>{request.reason || '-'}</td>
                  <td>
                    <Badge bg={request.status === 'approved' ? 'success' : request.status === 'rejected' ? 'danger' : 'warning'}>
                      {request.status}
                    </Badge>
                  </td>
                  {canManage && (
                    <td className="text-end text-nowrap">
                      {request.status === 'pending' && (
                        <>
                          <Button size="sm" className="me-2" onClick={() => decide(request, 'approved')}>
                            Approve
                          </Button>
                          <Button size="sm" variant="outline-danger" onClick={() => decide(request, 'rejected')}>
                            Deny
                          </Button>
                        </>
                      )}
                      {request.status !== 'pending' && <span className="text-muted small">Completed</span>}
                    </td>
                  )}
                </tr>
              ))}
              {!requests.length && (
                <tr>
                  <td colSpan={canManage ? 7 : 5} className="text-center text-muted py-4">
                    No leave requests yet.
                  </td>
                </tr>
              )}
            </tbody>
          </Table>
        </CardBody>
      </Card>
      {canManage && (
        <Card className="mt-3">
          <CardBody>
            <div className="d-flex justify-content-between align-items-start gap-2 mb-3">
              <div>
                <h5 className="mb-1">Leave & holiday calendar</h5>
                <small className="text-muted">Sundays are weekly off. HR-created government, festival, and private holidays are shown here.</small>
              </div>
              {canManageHolidays && <Button size="sm" onClick={() => { setHolidayForm({ id: '', date: '', name: '', type: 'festival' }); setShowHolidayModal(true) }}>Add holiday</Button>}
            </div>
            <FullCalendar
              plugins={[dayGridPlugin, interactionPlugin]}
              initialView="dayGridMonth"
              themeSystem="bootstrap"
              events={calendarEvents}
              dateClick={openHolidayCreate}
              eventClick={openHolidayEdit}
            />
          </CardBody>
        </Card>
      )}
      <Modal show={showTypeModal} onHide={() => setShowTypeModal(false)} centered>
        <Form onSubmit={createType}>
          <Modal.Header closeButton>
            <Modal.Title>Create leave type</Modal.Title>
          </Modal.Header>
          <Modal.Body>
            <Form.Group>
              <Form.Label>Leave type name</Form.Label>
              <Form.Control
                required
                autoFocus
                value={newType}
                onChange={(event) => setNewType(event.target.value)}
                placeholder="Medical Leave or Personal Leave"
              />
              <Form.Text>Medical leave uses the monthly paid-leave allowance. Other leave is unpaid, except Birthday Leave.</Form.Text>
            </Form.Group>
          </Modal.Body>
          <Modal.Footer>
            <Button variant="light" onClick={() => setShowTypeModal(false)}>
              Cancel
            </Button>
            <Button type="submit">Create leave type</Button>
          </Modal.Footer>
        </Form>
      </Modal>
      <Modal show={showHolidayModal} onHide={() => setShowHolidayModal(false)} centered>
        <Form onSubmit={saveHoliday}>
          <Modal.Header closeButton>
            <Modal.Title>{holidayForm.id ? 'Update holiday' : 'Add holiday'}</Modal.Title>
          </Modal.Header>
          <Modal.Body>
            <Form.Group className="mb-3">
              <Form.Label>Date</Form.Label>
              <Form.Control required type="date" value={holidayForm.date} onChange={(event) => setHolidayForm({ ...holidayForm, date: event.target.value })} />
            </Form.Group>
            <Form.Group className="mb-3">
              <Form.Label>Holiday name</Form.Label>
              <Form.Control required value={holidayForm.name} onChange={(event) => setHolidayForm({ ...holidayForm, name: event.target.value })} placeholder="Diwali" />
            </Form.Group>
            <Form.Group>
              <Form.Label>Holiday type</Form.Label>
              <Form.Select value={holidayForm.type} onChange={(event) => setHolidayForm({ ...holidayForm, type: event.target.value as Holiday['type'] })}>
                <option value="government">Government / national holiday</option>
                <option value="festival">Festival holiday</option>
                <option value="private">Private holiday</option>
              </Form.Select>
            </Form.Group>
          </Modal.Body>
          <Modal.Footer>
            {holidayForm.id && <Button variant="outline-danger" className="me-auto" type="button" onClick={removeHoliday}>Delete</Button>}
            <Button variant="light" type="button" onClick={() => setShowHolidayModal(false)}>Cancel</Button>
            <Button type="submit">Save holiday</Button>
          </Modal.Footer>
        </Form>
      </Modal>
    </>
  )
}
export default LeavePage
