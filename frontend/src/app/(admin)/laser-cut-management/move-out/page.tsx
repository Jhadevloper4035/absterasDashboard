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
  clientSiteName?: string
  clientAddress?: string
  status: 'PENDING' | 'PARTIAL' | 'COMPLETE'
  sent: { sheets: number; tubes: number }
}

export default function LaserCutMoveOutPage() {
  const [searchParams] = useSearchParams()
  const [orders, setOrders] = useState<LaserCutOrder[]>([])
  const [clientName, setClientName] = useState('')
  const [clientAddress, setClientAddress] = useState('')
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
  const clientNames = [...new Set(orders.map((order) => order.clientName).filter(Boolean))] as string[]
  const clientOrders = orders.filter((order) => order.clientName === clientName)
  const clientAddresses = [...new Set(clientOrders.map((order) => order.clientAddress).filter(Boolean))] as string[]
  const visibleOrders = clientOrders.filter((order) => order.clientAddress === clientAddress)
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
              <div className="row g-3 mb-3">
                <div className="col-md-4">
                  <Form.Label>Client name</Form.Label>
                  <Form.Select required value={clientName} onChange={(event) => { setClientName(event.target.value); setClientAddress(''); setOrderRef('') }}>
                    <option value="">Select client</option>
                    {clientNames.map((name) => <option key={name} value={name}>{name}</option>)}
                  </Form.Select>
                </div>
                <div className="col-md-5">
                  <Form.Label>Client site address</Form.Label>
                  <Form.Select required disabled={!clientName} value={clientAddress} onChange={(event) => { setClientAddress(event.target.value); setOrderRef('') }}>
                    <option value="">{clientName ? 'Select client address' : 'Select client first'}</option>
                    {clientAddresses.map((address) => <option key={address} value={address}>{address}</option>)}
                  </Form.Select>
                </div>
                <div className="col-md-3">
                  <Form.Label>Laser Cut order</Form.Label>
                  <Form.Select required disabled={!clientAddress} value={orderRef} onChange={(event) => setOrderRef(event.target.value)}>
                  <option value="">Select order</option>
                  {visibleOrders.map((order) => (
                    <option key={order._id} value={order._id}>
                      ID: {order._id} · {order.orderName} · {order.status}
                    </option>
                  ))}
                  </Form.Select>
                </div>
              </div>
              {clientAddress && !visibleOrders.length && <Alert variant="secondary">No dispatched Laser Cut order is available for this client address.</Alert>}
              {selectedOrder && <Alert variant="info">Order ID: {selectedOrder._id}{selectedOrder.clientSiteName ? ` · ${selectedOrder.clientSiteName}` : ''}</Alert>}
              {!orders.length && <Alert variant="secondary">No Laser Cut orders have dispatched products yet.</Alert>}
              <Button type="submit" disabled={!orderRef}>
                Continue to Powder Coating challan
              </Button>
            </Form>
          )}
        </CardBody>
      </Card>
    </>
  )
}
