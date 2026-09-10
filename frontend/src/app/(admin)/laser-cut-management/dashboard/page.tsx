import PageMetaData from '@/components/PageTitle'
import { apiFetch } from '@/helpers/api'
import { useEffect, useMemo, useState } from 'react'
import { Alert, Badge, Button, Card, CardBody, Spinner, Table } from 'react-bootstrap'
import { Link } from 'react-router-dom'

type Order = {
  _id: string
  orderName: string
  clientName?: string
  createdAt: string
  status: 'PENDING' | 'PARTIAL' | 'COMPLETE'
  remainingSheets: number
  remainingTubes: number
}

const statusVariant = (status: Order['status']) => status === 'COMPLETE' ? 'success' : status === 'PARTIAL' ? 'primary' : 'warning'

export default function LaserCutDashboardPage() {
  const [orders, setOrders] = useState<Order[]>([])
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(true)

  const load = async () => {
    setLoading(true)
    try {
      const response = await apiFetch<{ data: { orders: Order[] } }>('/laser-cut-management/summary')
      setOrders(response.data.orders)
      setError('')
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : 'Unable to load laser-cut dashboard')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => { void load() }, [])

  const metrics = useMemo(() => ({
    pending: orders.filter((order) => order.status === 'PENDING').length,
    partial: orders.filter((order) => order.status === 'PARTIAL').length,
    complete: orders.filter((order) => order.status === 'COMPLETE').length,
  }), [orders])

  return (
    <>
      <PageMetaData title="Laser Cut Dashboard" />
      <div className="d-flex flex-wrap justify-content-between gap-3 mb-3">
        <div>
          <h4 className="mb-1">Laser Cut Dashboard</h4>
          <p className="text-muted mb-0">Current order progress and completed work ready for the next process.</p>
        </div>
        <div className="d-flex gap-2">
          <Button variant="outline-secondary" onClick={load} disabled={loading}>Refresh</Button>
          <Link className="btn btn-primary" to="/laser-cut-management/orders">View orders</Link>
        </div>
      </div>
      {error && <Alert variant="danger">{error}</Alert>}
      <div className="row g-3 mb-3">
        <div className="col-sm-6 col-xl-3"><Card><CardBody><div className="text-muted">Total orders</div><h3 className="mb-0">{orders.length}</h3></CardBody></Card></div>
        <div className="col-sm-6 col-xl-3"><Card><CardBody><div className="text-muted">Pending orders</div><h3 className="mb-0">{metrics.pending}</h3></CardBody></Card></div>
        <div className="col-sm-6 col-xl-3"><Card><CardBody><div className="text-muted">In progress</div><h3 className="mb-0">{metrics.partial}</h3></CardBody></Card></div>
        <div className="col-sm-6 col-xl-3"><Card><CardBody><div className="text-muted">Completed / ready</div><h3 className="mb-0">{metrics.complete}</h3></CardBody></Card></div>
      </div>
      <Card>
        <CardBody>
          <div className="d-flex justify-content-between align-items-center flex-wrap gap-2 mb-3">
            <div><h5 className="mb-1">Recent laser-cut orders</h5><p className="text-muted mb-0">Completed orders are ready to move to the next process.</p></div>
            <Link className="btn btn-sm btn-outline-primary" to="/laser-cut-management/orders">All orders</Link>
          </div>
          {loading ? <div className="text-center py-4"><Spinner /></div> : (
            <Table responsive hover className="align-middle mb-0">
              <thead><tr><th>Order</th><th>Client</th><th>Created</th><th>Status</th><th className="text-end">Action</th></tr></thead>
              <tbody>{orders.slice(0, 6).map((order) => <tr key={order._id}>
                <td className="fw-semibold">{order.orderName}</td>
                <td>{order.clientName || '—'}</td>
                <td>{new Date(order.createdAt).toLocaleDateString()}</td>
                <td><Badge bg={statusVariant(order.status)}>{order.status === 'COMPLETE' ? 'COMPLETED' : order.status}</Badge></td>
                <td className="text-end"><Link className="btn btn-sm btn-outline-primary" to={`/laser-cut-management/orders/${order._id}`}>Open</Link></td>
              </tr>)}{!orders.length && <tr><td colSpan={5} className="text-center text-muted py-4">No laser-cut orders yet.</td></tr>}</tbody>
            </Table>
          )}
        </CardBody>
      </Card>
    </>
  )
}
