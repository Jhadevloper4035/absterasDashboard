import PageMetaData from '@/components/PageTitle'
import { apiFetch } from '@/helpers/api'
import { useEffect, useMemo, useState } from 'react'
import { Alert, Badge, Button, Card, CardBody, Form, Spinner, Table } from 'react-bootstrap'
import { Link } from 'react-router-dom'
import Swal from 'sweetalert2'

type Order = {
  _id: string
  orderName: string
  clientName?: string
  createdAt: string
  planned: { sheets: number; tubes: number }
  ready: { sheets: number; tubes: number }
  remainingSheets: number
  remainingTubes: number
  status: 'PENDING' | 'PARTIAL' | 'COMPLETE'
}

export default function LaserCutCurrentOrdersPage() {
  const [orders, setOrders] = useState<Order[]>([])
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(true)
  const [deleting, setDeleting] = useState('')
  const [search, setSearch] = useState('')
  const [clientFilter, setClientFilter] = useState('')
  const [statusFilter, setStatusFilter] = useState('')
  const load = async () => {
    setLoading(true)
    try {
      const response = await apiFetch<{ data: Order[] }>('/laser-cut-management/orders')
      setOrders(response.data)
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
  const progress = (planned: number, ready: number, pending: number) => `${planned} planned · ${ready} ready · ${pending} pending`
  const clientNames = useMemo(() => [...new Set(orders.map((order) => order.clientName || '—'))].sort(), [orders])
  const visibleOrders = useMemo(() => {
    const query = search.trim().toLowerCase()
    return orders.filter((order) => {
      const matchesSearch = !query || [order.orderName, order.clientName].some((value) => value?.toLowerCase().includes(query))
      return matchesSearch && (!clientFilter || (order.clientName || '—') === clientFilter) && (!statusFilter || order.status === statusFilter)
    })
  }, [orders, search, clientFilter, statusFilter])
  const daysInLaserCut = (createdAt: string) => Math.max(0, Math.floor((Date.now() - new Date(createdAt).getTime()) / 86_400_000))
  const remove = async (order: Order) => {
    const confirmation = await Swal.fire({ icon: 'warning', title: `Delete order ${order.orderName}?`, text: 'Dispatched products will be moved back to inventory. This cannot be undone.', showCancelButton: true, confirmButtonText: 'Delete order', confirmButtonColor: '#dc3545', cancelButtonText: 'Keep order', reverseButtons: true })
    if (!confirmation.isConfirmed) return
    setError('')
    setDeleting(order._id)
    try {
      const response = await apiFetch<{ data: { restoredItems: number } }>(`/laser-cut-management/orders/${order._id}`, { method: 'DELETE' })
      setOrders((current) => current.filter((item) => item._id !== order._id))
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
          <p className="text-muted mb-0">Track Laser Cut orders, including completed orders ready for Powder Coating.</p>
        </div>
        <div className="d-flex gap-2">
          <Button variant="outline-secondary" onClick={load} disabled={loading}>
            Refresh
          </Button>
        </div>
      </div>
      {error && <Alert variant="danger">{error}</Alert>}
      <Card>
        <CardBody>
          <div className="row g-2 mb-3">
            <div className="col-md-4">
              <Form.Label htmlFor="laser-cut-search">Search</Form.Label>
              <Form.Control id="laser-cut-search" value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Order or client" />
            </div>
            <div className="col-md-4">
              <Form.Label htmlFor="laser-cut-client-filter">Client</Form.Label>
              <Form.Select id="laser-cut-client-filter" value={clientFilter} onChange={(event) => setClientFilter(event.target.value)}>
                <option value="">All clients</option>
                {clientNames.map((clientName) => <option key={clientName} value={clientName}>{clientName}</option>)}
              </Form.Select>
            </div>
            <div className="col-md-2">
              <Form.Label htmlFor="laser-cut-status-filter">Status</Form.Label>
              <Form.Select id="laser-cut-status-filter" value={statusFilter} onChange={(event) => setStatusFilter(event.target.value)}>
                <option value="">All statuses</option>
                {['PENDING', 'PARTIAL', 'COMPLETE'].map((status) => <option key={status} value={status}>{status}</option>)}
              </Form.Select>
            </div>
            <div className="col-md-2 d-flex align-items-end">
              <Button className="w-100" variant="outline-secondary" onClick={() => { setSearch(''); setClientFilter(''); setStatusFilter('') }}>
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
                  <th>Sheet progress</th>
                  <th>Tube progress</th>
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
                    <td className={remainingClass(order.remainingSheets)}>{progress(order.planned.sheets, order.ready.sheets, order.remainingSheets)}</td>
                    <td className={remainingClass(order.remainingTubes)}>{progress(order.planned.tubes, order.ready.tubes, order.remainingTubes)}</td>
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
                    <td colSpan={8} className="text-center text-muted py-4">
                      No laser-cut orders match these filters.
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
