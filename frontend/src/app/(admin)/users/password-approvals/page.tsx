import PageMetaData from '@/components/PageTitle'
import { apiFetch } from '@/helpers/api'
import { useEffect, useState } from 'react'
import { Alert, Badge, Button, Card, CardBody, Spinner, Table } from 'react-bootstrap'
import Swal from 'sweetalert2'

type PasswordResetRequest = {
  _id: string
  name: string
  email: string
  role: string
  workProfile?: string
  passwordResetRequestedAt: string
}

const formatDate = (value: string) => new Intl.DateTimeFormat(undefined, { dateStyle: 'medium', timeStyle: 'short' }).format(new Date(value))

export default function PasswordApprovalsPage() {
  const [requests, setRequests] = useState<PasswordResetRequest[]>([])
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(true)
  const [approvingId, setApprovingId] = useState('')

  const load = async () => {
    setLoading(true)
    try {
      const response = await apiFetch<{ data: PasswordResetRequest[] }>('/users/password-reset-requests')
      setRequests(response.data)
      setError('')
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : 'Unable to load password approval requests')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => { void load() }, [])

  const approve = async (request: PasswordResetRequest) => {
    const confirmation = await Swal.fire({
      icon: 'warning',
      title: `Approve ${request.name}'s password?`,
      text: 'Their requested password will become active and all current sessions will be signed out.',
      showCancelButton: true,
      confirmButtonText: 'Approve password',
      confirmButtonColor: '#0d6efd',
    })
    if (!confirmation.isConfirmed) return

    setApprovingId(request._id)
    setError('')
    try {
      await apiFetch(`/users/password-reset-requests/${request._id}/approve`, { method: 'POST' })
      setRequests((items) => items.filter((item) => item._id !== request._id))
      await Swal.fire({ icon: 'success', title: 'Password approved', text: `${request.name}'s password was updated.`, timer: 1600, showConfirmButton: false })
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : 'Unable to approve password reset')
    } finally {
      setApprovingId('')
    }
  }

  return (
    <>
      <PageMetaData title="Password Approvals" />
      <div className="d-flex justify-content-between align-items-start flex-wrap gap-2 mb-3">
        <div><h4 className="mb-1">Password Approvals</h4><p className="text-muted mb-0">Approve pending password changes. Approval signs the user out of all active sessions.</p></div>
        <Button variant="outline-secondary" onClick={load} disabled={loading}>Refresh</Button>
      </div>
      {error && <Alert variant="danger">{error}</Alert>}
      <Card><CardBody>
        <div className="d-flex justify-content-between align-items-center gap-2 mb-3"><h5 className="mb-0">Pending requests</h5><Badge bg="warning" text="dark">{requests.length} pending</Badge></div>
        {loading ? <div className="text-center py-4"><Spinner /></div> : <Table responsive hover className="align-middle mb-0">
          <thead><tr><th>User</th><th>Role</th><th>Requested</th><th className="text-end">Action</th></tr></thead>
          <tbody>{requests.map((request) => <tr key={request._id}>
            <td><div className="fw-semibold">{request.name}</div><small className="text-muted">{request.email}</small></td>
            <td><Badge bg="secondary">{request.workProfile || request.role}</Badge></td>
            <td>{formatDate(request.passwordResetRequestedAt)}</td>
            <td className="text-end"><Button size="sm" disabled={approvingId === request._id} onClick={() => approve(request)}>{approvingId === request._id ? 'Approving…' : 'Approve'}</Button></td>
          </tr>)}{!requests.length && <tr><td colSpan={4} className="text-center text-muted py-4">No password approvals are waiting.</td></tr>}</tbody>
        </Table>}
      </CardBody></Card>
    </>
  )
}
