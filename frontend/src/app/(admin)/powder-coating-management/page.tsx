import PageMetaData from '@/components/PageTitle'
import { apiFetch } from '@/helpers/api'
import { useEffect, useMemo, useState } from 'react'
import { Alert, Badge, Button, Card, CardBody, Form, Spinner, Table } from 'react-bootstrap'
import { Link } from 'react-router-dom'

type Item = { itemName: string; quantity: number; unit?: string; shadeName?: string; shadeCode?: string; dimensions?: { heightFt?: number; widthFt?: number; lengthFt?: number } }
type Order = { _id: string; orderNo: string; clientName: string; clientSiteName?: string; clientSiteAddressSnapshot?: string; vendorName: string; status: 'OUT' | 'RETURNED'; deliveryStatus: string; readyQuantity: number; pendingCoatingQuantity: number; deliveredQuantity: number; remainingQuantity: number; createdAt: string; items: Item[] }
const date = (value: string) => new Date(value).toLocaleDateString()
const materialSize = (dimensions?: Item['dimensions']) => dimensions?.heightFt && dimensions.widthFt ? `${dimensions.heightFt} × ${dimensions.widthFt} ft` : dimensions?.lengthFt ? `${dimensions.lengthFt} ft` : ''

export default function PowderCoatingManagementPage() {
  const [orders, setOrders] = useState<Order[]>([])
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [clientFilter, setClientFilter] = useState('')
  const [statusFilter, setStatusFilter] = useState('')
  const load = async () => {
    setLoading(true)
    try {
      const response = await apiFetch<{ data: { orders: Order[] } }>('/powder-coating-management/summary')
      setOrders(response.data.orders)
      setError('')
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : 'Unable to load powder coating orders')
    } finally {
      setLoading(false)
    }
  }
  useEffect(() => { void load() }, [])
  const metrics = useMemo(() => ({
    pending: orders.filter((order) => order.pendingCoatingQuantity > 0).length,
    readyToDeliver: orders.filter((order) => order.pendingCoatingQuantity === 0 && order.remainingQuantity > 0).length,
    delivered: orders.filter((order) => order.deliveryStatus === 'DELIVERED').length,
  }), [orders])
  const clientNames = useMemo(() => [...new Set(orders.map((order) => order.clientName || '—'))].sort(), [orders])
  const deliveryStatuses = useMemo(() => [...new Set(orders.map((order) => order.deliveryStatus))].sort(), [orders])
  const visibleOrders = useMemo(() => {
    const query = search.trim().toLowerCase()
    return orders.filter((order) => {
      const matchesSearch = !query || [order.orderNo, order.clientName, order.vendorName, ...order.items.flatMap((item) => [item.itemName, item.shadeName, item.shadeCode])].some((value) => value?.toLowerCase().includes(query))
      return matchesSearch && (!clientFilter || (order.clientName || '—') === clientFilter) && (!statusFilter || order.deliveryStatus === statusFilter)
    })
  }, [orders, search, clientFilter, statusFilter])
  return (
    <>
      <PageMetaData title="Powder Coating Dashboard" />
      <div className="d-flex flex-wrap justify-content-between gap-3 mb-3">
        <div><h4 className="mb-1">Powder Coating Dashboard</h4><p className="text-muted mb-0">Current coating progress and delivery status for every order.</p></div>
        <div className="d-flex gap-2"><Link className="btn btn-outline-primary" to="/powder-coating-management/vendors">Manage vendors</Link><Link className="btn btn-primary" to="/powder-coating-management/challans/create">Create order</Link></div>
      </div>
      {error && <Alert variant="danger">{error}</Alert>}
      <div className="row g-3 mb-3">
        <div className="col-sm-6 col-xl-3"><Card><CardBody><div className="text-muted">Total orders</div><h3 className="mb-0">{orders.length}</h3></CardBody></Card></div>
        <div className="col-sm-6 col-xl-3"><Card><CardBody><div className="text-muted">Pending coating</div><h3 className="mb-0">{metrics.pending}</h3></CardBody></Card></div>
        <div className="col-sm-6 col-xl-3"><Card><CardBody><div className="text-muted">Ready to deliver</div><h3 className="mb-0">{metrics.readyToDeliver}</h3></CardBody></Card></div>
        <div className="col-sm-6 col-xl-3"><Card><CardBody><div className="text-muted">Delivered orders</div><h3 className="mb-0">{metrics.delivered}</h3></CardBody></Card></div>
      </div>
      <Card>
        <CardBody>
          <div className="d-flex justify-content-between align-items-center flex-wrap gap-2 mb-3"><div><h5 className="mb-1">Powder-coating orders</h5><p className="text-muted mb-0">Open an order to update batches and create the client delivery challan.</p></div><Badge bg="light" text="dark">{visibleOrders.length} of {orders.length} order{orders.length === 1 ? '' : 's'}</Badge></div>
          <div className="row g-2 mb-3">
            <div className="col-md-4"><Form.Label htmlFor="powder-coating-search">Search</Form.Label><Form.Control id="powder-coating-search" value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Order, client, vendor, or material" /></div>
            <div className="col-md-3"><Form.Label htmlFor="powder-coating-client-filter">Client</Form.Label><Form.Select id="powder-coating-client-filter" value={clientFilter} onChange={(event) => setClientFilter(event.target.value)}><option value="">All clients</option>{clientNames.map((clientName) => <option key={clientName} value={clientName}>{clientName}</option>)}</Form.Select></div>
            <div className="col-md-3"><Form.Label htmlFor="powder-coating-status-filter">Status</Form.Label><Form.Select id="powder-coating-status-filter" value={statusFilter} onChange={(event) => setStatusFilter(event.target.value)}><option value="">All statuses</option>{deliveryStatuses.map((status) => <option key={status} value={status}>{status.replaceAll('_', ' ')}</option>)}</Form.Select></div>
            <div className="col-md-2 d-flex align-items-end"><Button className="w-100" variant="outline-secondary" onClick={() => { setSearch(''); setClientFilter(''); setStatusFilter('') }}>Clear filters</Button></div>
          </div>
          {loading ? <div className="text-center py-4"><Spinner /></div> : (
            <Table responsive hover className="align-middle mb-0" style={{ minWidth: 900 }}>
              <thead className="bg-light bg-opacity-10"><tr><th>Order</th><th>Client site</th><th className="d-none d-lg-table-cell">Coating vendor</th><th>Material</th><th>Progress</th><th>Status</th><th className="text-end">Action</th></tr></thead>
              <tbody>{visibleOrders.length ? visibleOrders.map((order) => <tr key={order._id}>
                <td className="py-3"><div className="fw-semibold">{order.orderNo}</div><small className="text-muted">Created {date(order.createdAt)}</small></td>
                <td className="py-3"><div className="fw-medium">{order.clientName}</div>{order.clientSiteName && <small className="text-muted d-block">{order.clientSiteName}</small>}</td>
                <td className="py-3 d-none d-lg-table-cell">{order.vendorName}</td>
                <td className="py-3">{order.items.map((item, index) => <div key={`${item.itemName}-${index}`} className={index ? 'mt-1' : ''}><span className="fw-medium">{item.itemName}</span><small className="text-muted">{materialSize(item.dimensions) && ` · ${materialSize(item.dimensions)}`} · {item.shadeName || 'No shade'}</small></div>)}</td>
                <td className="py-3 text-nowrap"><div className="fw-semibold">{order.readyQuantity} coated</div><small className="text-success d-block">{order.deliveredQuantity} delivered</small><small className="text-muted">{order.pendingCoatingQuantity} pending · {order.remainingQuantity} to deliver</small></td>
                <td className="py-3"><Badge bg={order.status === 'RETURNED' || order.deliveryStatus === 'DELIVERED' ? 'success' : ['PARTIAL_DELIVERY', 'PARTIAL_READY', 'READY_FOR_DELIVERY'].includes(order.deliveryStatus) ? 'primary' : 'warning'}>{order.status === 'RETURNED' ? 'RETURNED' : order.deliveryStatus.replaceAll('_', ' ')}</Badge></td>
                <td className="py-3 text-end"><Link className="btn btn-sm btn-outline-primary text-nowrap" to={`/powder-coating-management/orders/${order._id}`}>Open order</Link></td>
              </tr>) : <tr><td colSpan={7} className="text-center text-muted py-4">No powder-coating orders match these filters.</td></tr>}</tbody>
            </Table>
          )}
        </CardBody>
      </Card>
    </>
  )
}
