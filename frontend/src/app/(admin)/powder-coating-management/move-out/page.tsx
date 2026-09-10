import PageMetaData from '@/components/PageTitle'
import { apiFetch } from '@/helpers/api'
import { useEffect, useState } from 'react'
import { Alert, Badge, Card, CardBody, Spinner, Table } from 'react-bootstrap'
import { Link } from 'react-router-dom'

type Order = {
  _id: string
  orderNo: string
  clientName: string
  clientSiteName?: string
  readyQuantity: number
  pendingCoatingQuantity: number
  remainingQuantity: number
  deliveryStatus: string
}

export default function PowderCoatingMoveOutPage() {
  const [orders, setOrders] = useState<Order[]>([])
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    apiFetch<{ data: { orders: Order[] } }>('/powder-coating-management/summary')
      .then((response) => setOrders(response.data.orders.filter((order) => order.remainingQuantity > 0)))
      .catch((reason) => setError(reason instanceof Error ? reason.message : 'Unable to load ready powder-coating orders'))
      .finally(() => setLoading(false))
  }, [])

  return (
    <>
      <PageMetaData title="Move Powder-Coated Products Out" />
      <div className="d-flex justify-content-between align-items-start flex-wrap gap-2 mb-3">
        <div><h4 className="mb-1">Move Out to Client</h4><p className="text-muted mb-0">Choose a powder-coating order to create a client delivery challan.</p></div>
        <Link className="btn btn-outline-secondary" to="/powder-coating-management/orders">Current orders</Link>
      </div>
      {error && <Alert variant="danger">{error}</Alert>}
      <Card><CardBody>
        {loading ? <div className="text-center py-4"><Spinner /></div> : <Table responsive hover className="align-middle mb-0">
          <thead><tr><th>Order</th><th>Client site</th><th>Coated</th><th>Ready to deliver</th><th>Status</th><th className="text-end">Action</th></tr></thead>
          <tbody>{orders.map((order) => <tr key={order._id}>
            <td className="fw-semibold">{order.orderNo}</td>
            <td>{order.clientName}{order.clientSiteName ? <small className="text-muted d-block">{order.clientSiteName}</small> : null}</td>
            <td>{order.readyQuantity}</td>
            <td>{order.remainingQuantity}</td>
            <td><Badge bg="primary">{order.deliveryStatus.replaceAll('_', ' ')}</Badge></td>
            <td className="text-end"><Link className="btn btn-sm btn-primary" to={`/powder-coating-management/orders/${order._id}/dispatch`}>Move out</Link></td>
          </tr>)}{!orders.length && <tr><td colSpan={6} className="text-center text-muted py-4">No powder-coated material is ready to move out.</td></tr>}</tbody>
        </Table>}
      </CardBody></Card>
    </>
  )
}
