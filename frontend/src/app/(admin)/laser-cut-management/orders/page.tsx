import PageMetaData from '@/components/PageTitle'
import { apiFetch } from '@/helpers/api'
import { useEffect, useState } from 'react'
import { Alert, Badge, Button, Card, CardBody, Form, Spinner, Table } from 'react-bootstrap'
import { Link } from 'react-router-dom'
import Swal from 'sweetalert2'

type Order = {
  _id: string
  orderName: string
  clientName?: string
  createdAt: string
  expected: { sheets: number }
  sent: { sheets: number }
  remainingSheets: number
  status: 'PENDING' | 'PARTIAL' | 'COMPLETE'
}

export default function LaserCutCurrentOrdersPage() {
  const [orders, setOrders] = useState<Order[]>([])
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(true)
  const [deleting, setDeleting] = useState('')
  const [orderFilter, setOrderFilter] = useState('')
  const [clientFilter, setClientFilter] = useState('')
  const load = async () => {
    setLoading(true)
    try {
      const response = await apiFetch<{ data: Order[] }>('/laser-cut-management/orders')
      setOrders(response.data.filter((order) => order.status !== 'COMPLETE'))
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : 'Unable to load current laser-cut orders')
    } finally {
      setLoading(false)
    }
  }
  useEffect(() => {
    load()
  }, [])
  const remainingClass = (value: number) => (value > 0 ? 'text-danger fw-semibold' : 'text-success fw-semibold')
  const clientNames = [...new Set(orders.map((order) => order.clientName || '—'))].sort()
  const visibleOrders = orders.filter((order) => (!orderFilter || order._id === orderFilter) && (!clientFilter || (order.clientName || '—') === clientFilter))
  const daysInLaserCut = (createdAt: string) => Math.max(0, Math.floor((Date.now() - new Date(createdAt).getTime()) / 86_400_000))
  const remove = async (order: Order) => {
    const confirmation = await Swal.fire({ icon: 'warning', title: `Delete order ${order.orderName}?`, text: 'Dispatched products will be moved back to inventory. This cannot be undone.', showCancelButton: true, confirmButtonText: 'Delete order', confirmButtonColor: '#dc3545', cancelButtonText: 'Keep order', reverseButtons: true })
    if (!confirmation.isConfirmed) return
    setError('')
    setDeleting(order._id)
    try {
      const response = await apiFetch<{ data: { restoredItems: number } }>(`/laser-cut-management/orders/${order._id}`, { method: 'DELETE' })
      setOrders((current) => current.filter((item) => item._id !== order._id))
      if (orderFilter === order._id) setOrderFilter('')
      await Swal.fire({ icon: 'success', title: 'Order deleted', text: `${response.data.restoredItems} product line(s) moved back to inventory.`, timer: 1800, showConfirmButton: false })
    } catch (reason) {
      const message = reason instanceof Error ? reason.message : 'Unable to delete laser-cut order'
      setError(message)
      await Swal.fire({ icon: 'error', title: 'Order not deleted', text: message })
    } finally {
      setDeleting('')
    }
  }

  return (
    <>
      <PageMetaData title="Current Laser Cut Orders" />
      <div className="d-flex justify-content-between align-items-start flex-wrap gap-2 mb-3">
        <div>
          <h4 className="mb-1">Current Laser Cut Orders</h4>
          <p className="text-muted mb-0">Orders that still need sheets dispatched to the vendor.</p>
        </div>
        <div className="d-flex gap-2">
          <Button variant="outline-secondary" onClick={load} disabled={loading}>
            Refresh
          </Button>
          <Link className="btn btn-primary" to="/laser-cut-management">
            Laser cut dashboard
          </Link>
        </div>
      </div>
      {error && <Alert variant="danger">{error}</Alert>}
      <Card>
        <CardBody>
          <div className="row g-2 mb-3">
            <div className="col-md-4">
              <Form.Label htmlFor="laser-cut-order-filter">Order</Form.Label>
              <Form.Select id="laser-cut-order-filter" value={orderFilter} onChange={(event) => setOrderFilter(event.target.value)}>
                <option value="">All orders</option>
                {orders.map((order) => <option key={order._id} value={order._id}>{order.orderName}</option>)}
              </Form.Select>
            </div>
            <div className="col-md-4">
              <Form.Label htmlFor="laser-cut-client-filter">Client</Form.Label>
              <Form.Select id="laser-cut-client-filter" value={clientFilter} onChange={(event) => setClientFilter(event.target.value)}>
                <option value="">All clients</option>
                {clientNames.map((clientName) => <option key={clientName} value={clientName}>{clientName}</option>)}
              </Form.Select>
            </div>
            <div className="col-md-2 d-flex align-items-end">
              <Button className="w-100" variant="outline-secondary" onClick={() => { setOrderFilter(''); setClientFilter('') }}>
                Clear filters
              </Button>
            </div>
          </div>
          <div className="table-responsive">
            <Table hover className="align-middle mb-0 text-nowrap" style={{ minWidth: 1400 }}>
              <thead>
                <tr>
                  <th>Order</th>
                  <th>Client</th>
                  <th>Created date</th>
                  <th>Days in laser cutting</th>
                  <th>Expected sheets</th>
                  <th>Sent sheets</th>
                  <th>Remaining sheets</th>
                  <th>Status</th>
                  <th>Action</th>
                </tr>
              </thead>
              <tbody>
                {visibleOrders.map((order) => (
                  <tr key={order._id}>
                    <td className="fw-medium">{order.orderName}</td>
                    <td>{order.clientName || '—'}</td>
                    <td>{new Date(order.createdAt).toLocaleDateString()}</td>
                    <td>{daysInLaserCut(order.createdAt)}</td>
                    <td>{order.expected.sheets}</td>
                    <td>{order.sent.sheets}</td>
                    <td className={remainingClass(order.remainingSheets)}>{order.remainingSheets}</td>
                    <td>
                      <Badge bg={order.status === 'PARTIAL' ? 'danger' : 'secondary'}>{order.status}</Badge>
                    </td>
                    <td>
                      <div className="d-flex gap-1">
                        <Link className="btn btn-sm btn-outline-primary" to={`/laser-cut-management/orders/${order._id}`}>
                          View
                        </Link>
                        <Button size="sm" variant="outline-danger" disabled={deleting === order._id} onClick={() => remove(order)}>
                          {deleting === order._id ? 'Deleting…' : 'Delete'}
                        </Button>
                      </div>
                    </td>
                  </tr>
                ))}
                {!loading && !visibleOrders.length && (
                  <tr>
                    <td colSpan={9} className="text-center text-muted py-4">
                      No current laser-cut orders match these filters.
                    </td>
                  </tr>
                )}
              </tbody>
            </Table>
          </div>
          {loading && (
            <div className="text-center py-4">
              <Spinner />
            </div>
          )}
        </CardBody>
      </Card>
    </>
  )
}
