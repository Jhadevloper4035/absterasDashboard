import PageMetaData from '@/components/PageTitle'
import { apiFetch } from '@/helpers/api'
import CreatePowderCoatingOrderPage from '@/app/(admin)/powder-coating-management/challans/create/page'
import { useEffect, useState } from 'react'
import { Alert, Button, Card, CardBody, Form, Spinner } from 'react-bootstrap'
import { Link, useSearchParams } from 'react-router-dom'

type LaserCutOrder = {
  _id: string
  orderName: string
  clientName?: string
  status: 'PENDING' | 'PARTIAL' | 'COMPLETE'
  sent: { sheets: number; tubes: number }
}

export default function LaserCutMoveOutPage() {
  const [searchParams] = useSearchParams()
  const [orders, setOrders] = useState<LaserCutOrder[]>([])
  const [orderRef, setOrderRef] = useState(searchParams.get('orderId') || '')
  const [moveOrderRef, setMoveOrderRef] = useState(searchParams.get('orderId') || '')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    apiFetch<{ data: LaserCutOrder[] }>('/laser-cut-management/orders')
      .then((response) => setOrders(response.data.filter((order) => order.status !== 'PENDING')))
      .catch((reason) => setError(reason instanceof Error ? reason.message : 'Unable to load laser-cut orders'))
      .finally(() => setLoading(false))
  }, [])

  const selectedOrder = orders.find((order) => order._id === orderRef)
  const sentQuantity = selectedOrder ? selectedOrder.sent.sheets + selectedOrder.sent.tubes : 0

  if (moveOrderRef) return <CreatePowderCoatingOrderPage laserCutOrderId={moveOrderRef} cancelTo="/laser-cut-management/move-out" />

  return (
    <>
      <PageMetaData title="Move Laser Cut Products Out" />
      <div className="d-flex justify-content-between align-items-start flex-wrap gap-2 mb-3">
        <div>
          <h4 className="mb-1">Move Out to Powder Coating</h4>
          <p className="text-muted mb-0">Select a Laser Cut order, then send a partial or full available batch to Powder Coating.</p>
        </div>
        <Link className="btn btn-outline-secondary" to="/laser-cut-management/orders">
          Current orders
        </Link>
      </div>
      {error && <Alert variant="danger">{error}</Alert>}
      <Card>
        <CardBody>
          {loading ? <div className="text-center py-4"><Spinner /></div> : (
            <Form onSubmit={(event) => { event.preventDefault(); if (orderRef) setMoveOrderRef(orderRef) }}>
              <Form.Group className="mb-3">
                <Form.Label>Active Laser Cut order</Form.Label>
                <Form.Select required value={orderRef} onChange={(event) => setOrderRef(event.target.value)}>
                  <option value="">Select order</option>
                  {orders.map((order) => (
                    <option key={order._id} value={order._id}>
                      {order.orderName} · {order.clientName || 'No client'} · {order.status}
                    </option>
                  ))}
                </Form.Select>
              </Form.Group>
              {selectedOrder && <Alert variant="info">{sentQuantity} item(s) have been moved into Laser Cut for this order. Choose the partial quantity and enter its updated shade details on this page.</Alert>}
              {!orders.length && <Alert variant="secondary">No Laser Cut orders have dispatched products yet.</Alert>}
              <Button type="submit" disabled={!orderRef}>
                Select products and move out
              </Button>
            </Form>
          )}
        </CardBody>
      </Card>
    </>
  )
}
