import PageMetaData from '@/components/PageTitle'
import { apiFetch } from '@/helpers/api'
import { useEffect, useState } from 'react'
import { Alert, Button, Card, CardBody, Table } from 'react-bootstrap'

type Request = {
  _id: string
  days: number
  fromDate: string
  toDate: string
  reason?: string
  employee?: { user?: { name?: string } }
  leaveType?: { name?: string }
}

const ApprovalsPage = () => {
  const [requests, setRequests] = useState<Request[]>([])
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState('')

  const load = async () => {
    setLoading(true)
    try {
      const response = await apiFetch<{ data: Request[] }>('/hr/leave/requests?status=pending')
      setRequests(response.data)
      setError('')
    } catch (value) {
      setError(value instanceof Error ? value.message : 'Unable to load approvals')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    load()
  }, [])

  const decide = async (id: string, status: 'approved' | 'rejected') => {
    setSaving(id)
    try {
      await apiFetch(`/hr/leave/requests/${id}`, { method: 'PATCH', body: JSON.stringify({ status }) })
      await load()
    } catch (value) {
      setError(value instanceof Error ? value.message : 'Unable to update request')
    } finally {
      setSaving('')
    }
  }

  return (
    <>
      <PageMetaData title="Leave approvals" />
      <Card>
        <CardBody>
          <h4 className="card-title mb-3">Leave approvals</h4>
          {error && <Alert variant="danger">{error}</Alert>}
          <Table responsive className="align-middle mb-0">
            <thead>
              <tr>
                <th>Employee</th>
                <th>Type</th>
                <th>Dates</th>
                <th>Days</th>
                <th>Reason</th>
                <th />
              </tr>
            </thead>
            <tbody>
              {requests.map((request) => (
                <tr key={request._id}>
                  <td>{request.employee?.user?.name || 'Employee unavailable'}</td>
                  <td>{request.leaveType?.name || 'Leave type unavailable'}</td>
                  <td>{new Date(request.fromDate).toLocaleDateString()} – {new Date(request.toDate).toLocaleDateString()}</td>
                  <td>{request.days}</td>
                  <td>{request.reason || '-'}</td>
                  <td className="text-end text-nowrap">
                    <Button size="sm" className="me-2" disabled={Boolean(saving)} onClick={() => decide(request._id, 'approved')}>
                      {saving === request._id ? 'Saving…' : 'Approve'}
                    </Button>
                    <Button size="sm" variant="outline-danger" disabled={Boolean(saving)} onClick={() => decide(request._id, 'rejected')}>
                      Reject
                    </Button>
                  </td>
                </tr>
              ))}
              {!loading && !requests.length && (
                <tr>
                  <td colSpan={6} className="text-center text-muted py-4">
                    No leave requests are waiting for approval.
                  </td>
                </tr>
              )}
            </tbody>
          </Table>
          {loading && <div className="text-center text-muted py-4">Loading approvals…</div>}
        </CardBody>
      </Card>
    </>
  )
}

export default ApprovalsPage
