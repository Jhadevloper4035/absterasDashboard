import PageMetaData from '@/components/PageTitle'
import { apiFetch } from '@/helpers/api'
import { useEffect, useState } from 'react'
import { Alert, Button, Card, CardBody, Table } from 'react-bootstrap'

type Request = { _id: string; days: number; fromDate: string; toDate: string; reason?: string; status: string; employee: { user: { name: string } }; leaveType: { name: string } }
const ApprovalsPage = () => {
  const [requests, setRequests] = useState<Request[]>([]); const [error, setError] = useState('')
  const load = () => apiFetch<{ data: Request[] }>('/hr/leave/requests?status=pending').then((response) => setRequests(response.data)).catch((value) => setError(value instanceof Error ? value.message : 'Unable to load approvals'))
  useEffect(() => { load() }, [])
  const decide = async (id: string, status: 'approved' | 'rejected') => { try { await apiFetch(`/hr/leave/requests/${id}`, { method: 'PATCH', body: JSON.stringify({ status }) }); load() } catch (value) { setError(value instanceof Error ? value.message : 'Unable to update request') } }
  return <><PageMetaData title="Leave approvals" /><Card><CardBody><h4 className="card-title mb-3">Leave approvals</h4>{error && <Alert variant="danger">{error}</Alert>}<Table responsive><thead><tr><th>Employee</th><th>Type</th><th>Dates</th><th>Days</th><th>Reason</th><th /></tr></thead><tbody>{requests.map((request) => <tr key={request._id}><td>{request.employee?.user.name}</td><td>{request.leaveType?.name}</td><td>{new Date(request.fromDate).toLocaleDateString()} – {new Date(request.toDate).toLocaleDateString()}</td><td>{request.days}</td><td>{request.reason || '-'}</td><td className="text-end"><Button size="sm" className="me-2" onClick={() => decide(request._id, 'approved')}>Approve</Button><Button size="sm" variant="outline-danger" onClick={() => decide(request._id, 'rejected')}>Reject</Button></td></tr>)}</tbody></Table></CardBody></Card></>
}
export default ApprovalsPage
