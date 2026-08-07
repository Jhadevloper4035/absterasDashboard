import PageMetaData from '@/components/PageTitle'
import { apiFetch } from '@/helpers/api'
import { FormEvent, useEffect, useState } from 'react'
import { Alert, Badge, Button, Card, CardBody, Form, Modal, Table } from 'react-bootstrap'
import Swal from 'sweetalert2'

type LeaveType = { _id: string; name: string; maxBalance: number; isPaid: boolean }
type Balance = { _id: string; balance: number; leaveType: LeaveType }
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
  const [leaveType, setLeaveType] = useState('')
  const [fromDate, setFromDate] = useState('')
  const [toDate, setToDate] = useState('')
  const [reason, setReason] = useState('')
  const [newType, setNewType] = useState('')
  const [showTypeModal, setShowTypeModal] = useState(false)
  const [error, setError] = useState('')
  const [canManage, setCanManage] = useState(false)
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
      .then((response) => setCanManage(response.data.some((item) => item.module === 'leave' && item.access === 'manage')))
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
  const decide = async (request: Request, status: 'approved' | 'rejected') => {
    const result = await Swal.fire({ icon: status === 'approved' ? 'question' : 'warning', title: `${status === 'approved' ? 'Approve' : 'Decline'} leave request?`, text: status === 'approved' ? 'Attendance will be updated for the approved leave dates.' : 'The employee will be notified that this request was declined.', input: status === 'approved' ? 'select' : undefined, inputLabel: status === 'approved' ? 'Payroll treatment' : undefined, inputOptions: status === 'approved' ? { policy: 'Use leave policy', paid: 'Mark full range paid', unpaid: 'Mark full range unpaid' } : undefined, inputValue: 'policy', showCancelButton: true, confirmButtonText: status === 'approved' ? 'Approve leave' : 'Decline leave', confirmButtonColor: status === 'approved' ? undefined : '#dc3545' })
    if (!result.isConfirmed) return
    try {
      await apiFetch(`/hr/leave/requests/${request._id}`, { method: 'PATCH', body: JSON.stringify({ status, ...(result.value === 'paid' ? { paid: true } : result.value === 'unpaid' ? { paid: false } : {}) }) })
      load()
    } catch (value) {
      setError(value instanceof Error ? value.message : 'Unable to update request')
    }
  }
  return (
    <>
      <PageMetaData title="Leave" />
      <Card className="mb-3">
        <CardBody>
          <div className="d-flex justify-content-between align-items-start flex-wrap gap-2">
            <div>
              <h4 className="card-title mb-1">Leave</h4>
              <p className="text-muted mb-0">
                The first Medical Leave day each month is paid. A second Medical Leave request, and every other leave type, is unpaid and deducted from payroll.
              </p>
            </div>
            {canManage && <Button onClick={() => setShowTypeModal(true)}>Create leave type</Button>}
          </div>
          {error && (
            <Alert className="mt-3 mb-0" variant="danger">
              {error}
            </Alert>
          )}
        </CardBody>
      </Card>
      {!canManage && (
        <>
          <Card className="mb-3">
            <CardBody>
              <h5 className="mb-3">My leave balance</h5>
              <div className="d-flex gap-3 flex-wrap">
                {balances.map((balance) => (
                  <div key={balance._id} className="border rounded p-3">
                    <div className="text-muted">{balance.leaveType.name}</div>
                    <strong>
                      {balance.balance} day{balance.balance === 1 ? '' : 's'} remaining
                    </strong>
                  </div>
                ))}
                {!balances.length && <span className="text-muted">Medical Leave is available once each month.</span>}
              </div>
            </CardBody>
          </Card>
          <Card className="mb-3">
            <CardBody>
              <h5 className="mb-3">Apply for leave</h5>
              <Form onSubmit={apply} className="row g-3">
                <div className="col-md-3">
                  <Form.Label>Leave type</Form.Label>
                  <Form.Select required value={leaveType} onChange={(event) => setLeaveType(event.target.value)}>
                    <option value="">Choose leave type</option>
                    {types.map((type) => (
                      <option key={type._id} value={type._id}>
                        {type.name}
                        {type.isPaid ? ' — paid' : ' — unpaid'}
                      </option>
                    ))}
                  </Form.Select>
                </div>
                <div className="col-md-3">
                  <Form.Label>From</Form.Label>
                  <Form.Control required type="date" value={fromDate} onChange={(event) => setFromDate(event.target.value)} />
                </div>
                <div className="col-md-3">
                  <Form.Label>To</Form.Label>
                  <Form.Control required type="date" value={toDate} min={fromDate} onChange={(event) => setToDate(event.target.value)} />
                </div>
                <div className="col-md-3">
                  <Form.Label>Reason</Form.Label>
                  <Form.Control placeholder="Optional reason" value={reason} onChange={(event) => setReason(event.target.value)} />
                </div>
                <div className="col-12">
                  <Button type="submit" disabled={!types.length}>
                    Submit leave request
                  </Button>
                </div>
              </Form>
            </CardBody>
          </Card>
        </>
      )}
      <Card>
        <CardBody>
          <div className="d-flex justify-content-between flex-wrap gap-2 mb-3">
            <div>
              <h5 className="mb-1">{canManage ? 'Leave requests' : 'My leave requests'}</h5>
              <small className="text-muted">{canManage ? 'Approve or deny employee requests.' : 'Track your submitted requests.'}</small>
            </div>
            {canManage && (
              <div className="d-flex gap-2 flex-wrap align-items-center">
                {types.map((type) => (
                  <Badge key={type._id} bg={type.isPaid ? 'success' : 'secondary'} className="d-inline-flex align-items-center justify-content-center text-center">
                    {type.name}: {type.isPaid ? 'Paid' : 'Unpaid'}
                  </Badge>
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
                    {request.status === 'approved' && (
                      <Badge bg={request.paidDays > 0 ? 'success' : 'secondary'} className="ms-1">
                        {request.paidDays > 0 ? 'Paid' : 'Unpaid'}
                      </Badge>
                    )}
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
              <Form.Text>Only the first exact “Medical Leave” request each month is paid. All later requests and other types are unpaid.</Form.Text>
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
    </>
  )
}
export default LeavePage
