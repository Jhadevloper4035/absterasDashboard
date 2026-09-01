import PageMetaData from '@/components/PageTitle'
import { apiFetch } from '@/helpers/api'
import { useEffect, useState } from 'react'
import { Alert, Badge, Button, Card, CardBody, Spinner, Table } from 'react-bootstrap'
import { Link } from 'react-router-dom'
import { toast } from 'react-toastify'

type Order = { _id: string; orderNo: string; clientName: string; vendorName: string; status: 'OUT' | 'RETURNED'; deliveryStatus: 'AT_VENDOR' | 'PARTIAL' | 'DELIVERED'; remainingQuantity: number; createdAt: string; items: { quantity: number }[] }
type Challan = { _id: string; challanNo: string; type: 'OUT' | 'IN' | 'SITE_OUT' }
const date = (value: string) => new Date(value).toLocaleDateString()
const total = (items: { quantity: number }[]) => items.reduce((sum, item) => sum + item.quantity, 0)

export default function PowderCoatingManagementPage() {
  const [orders, setOrders] = useState<Order[]>([])
  const [challans, setChallans] = useState<Challan[]>([])
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(true)
  const [receiving, setReceiving] = useState('')
  const load = async () => {
    setLoading(true)
    try {
      const response = await apiFetch<{ data: { orders: Order[]; challans: Challan[] } }>('/powder-coating-management/summary')
      setOrders(response.data.orders)
      setChallans(response.data.challans)
      setError('')
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : 'Unable to load powder coating orders')
    } finally {
      setLoading(false)
    }
  }
  useEffect(() => { void load() }, [])
  const receive = async (order: Order) => {
    if (!window.confirm(`Receive the full quantity for ${order.orderNo}? This creates the inward challan.`)) return
    setReceiving(order._id)
    try {
      await apiFetch(`/powder-coating-management/orders/${order._id}/receive`, { method: 'POST' })
      toast.success('Inward powder-coating challan created and stock returned')
      await load()
    } catch (reason) {
      toast.error(reason instanceof Error ? reason.message : 'Unable to receive powder-coating order')
    } finally {
      setReceiving('')
    }
  }
  const outward = orders.filter((order) => order.status === 'OUT' && order.deliveryStatus !== 'DELIVERED')
  return (
    <>
      <PageMetaData title="Powder Coating Management" />
      <div className="d-flex flex-wrap justify-content-between gap-3 mb-3">
        <div><h4 className="mb-1">Powder Coating Management</h4><p className="text-muted mb-0">Each order creates its outward challan automatically. Send partial or full quantities directly to the client site.</p></div>
        <div className="d-flex gap-2"><Link className="btn btn-outline-primary" to="/powder-coating-management/vendors">Manage vendors</Link><Link className="btn btn-primary" to="/powder-coating-management/challans/create">Create order</Link></div>
      </div>
      {error && <Alert variant="danger">{error}</Alert>}
      <div className="row g-3 mb-3">
        <div className="col-md-4"><Card><CardBody><div className="text-muted">Orders at powder coating</div><h3 className="mb-0">{outward.length}</h3></CardBody></Card></div>
        <div className="col-md-4"><Card><CardBody><div className="text-muted">Total orders</div><h3 className="mb-0">{orders.length}</h3></CardBody></Card></div>
        <div className="col-md-4"><Card><CardBody><div className="text-muted">Generated challans</div><h3 className="mb-0">{challans.length}</h3></CardBody></Card></div>
      </div>
      <Card>
        <CardBody>
          <h5 className="mb-3">Powder-coating orders</h5>
          {loading ? <div className="text-center py-4"><Spinner /></div> : (
            <Table responsive hover className="align-middle" style={{ minWidth: 1000 }}>
              <thead><tr><th>Order</th><th>Client</th><th>Powder-coating vendor</th><th>Products</th><th>Total quantity</th><th>Remaining at powder coating</th><th>Created</th><th>Status</th><th /></tr></thead>
              <tbody>{orders.length ? orders.map((order) => <tr key={order._id}>
                <td className="fw-semibold">{order.orderNo}</td><td>{order.clientName}</td><td>{order.vendorName}</td><td>{order.items.length}</td><td>{total(order.items)}</td><td>{order.remainingQuantity}</td><td>{date(order.createdAt)}</td>
                <td><Badge bg={order.status === 'RETURNED' || order.deliveryStatus === 'DELIVERED' ? 'success' : order.deliveryStatus === 'PARTIAL' ? 'primary' : 'warning'}>{order.status === 'RETURNED' ? 'RETURNED' : order.deliveryStatus.replace('_', ' ')}</Badge></td>
                <td className="text-nowrap">{order.status === 'OUT' && order.deliveryStatus !== 'DELIVERED' && <><Link className="btn btn-sm btn-outline-primary me-2" to={`/powder-coating-management/orders/${order._id}/dispatch`}>Send to site</Link><Button size="sm" onClick={() => receive(order)} disabled={receiving === order._id}>{receiving === order._id ? 'Receiving…' : 'Receive balance'}</Button></>}</td>
              </tr>) : <tr><td colSpan={9} className="text-center text-muted py-4">No powder-coating orders yet.</td></tr>}</tbody>
            </Table>
          )}
        </CardBody>
      </Card>
    </>
  )
}
