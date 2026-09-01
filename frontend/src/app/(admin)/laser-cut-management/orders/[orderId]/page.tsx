import PageMetaData from '@/components/PageTitle'
import { apiFetch } from '@/helpers/api'
import { type ReactNode, useEffect, useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import { Alert, Badge, Button, Card, CardBody, Spinner, Table } from 'react-bootstrap'

type Client = { name?: string; gstin?: string; billingAddress?: string; shippingAddress?: string; state?: string; stateCode?: string; phone?: string; email?: string }
type Item = { itemName: string; hsnCode?: string; materialType: string; unit?: string; quantity: number; dimensions?: { heightFt?: number; widthFt?: number }; pickupSupplierName?: string; pickupAddressSnapshot?: string }
type Challan = {
  _id: string; challanNo: string; type: 'OUT' | 'IN'; challanDate: string; createdAt: string; dispatchedAt?: string; receivedAt?: string
  clientName?: string; clientSiteName?: string; clientSiteAddressSnapshot?: string; deliveryAddress?: string
  vendorName: string; vendorAddressSnapshot?: string; transportType?: string; vehicleNumber?: string; eWayBillNumber?: string
  status: 'DRAFT' | 'DISPATCHED' | 'RECEIVED'; items: Item[]
}
type Order = {
  _id: string; orderName: string; createdAt: string; clientName?: string; client?: Client
  expected: { sheets: number }; sent: { sheets: number }; remainingSheets: number; status: 'PENDING' | 'PARTIAL' | 'COMPLETE'; challans: Challan[]
}

function Detail({ label, children }: { label: string; children?: ReactNode }) {
  return <div><div className="text-muted small">{label}</div><div className="fw-medium text-break">{children ?? '—'}</div></div>
}

const dateTime = (value?: string) => (value ? new Date(value).toLocaleString() : '—')
const laserCutDays = (createdAt: string) => Math.max(0, Math.floor((Date.now() - new Date(createdAt).getTime()) / 86_400_000))
const sheetSqFt = (item: Item) => {
  const height = Number(item.dimensions?.heightFt)
  const width = Number(item.dimensions?.widthFt)
  return item.materialType === 'SHEET' && height > 0 && width > 0 ? height * width * item.quantity : undefined
}
const sqFt = (value: number | undefined) => value === undefined ? '—' : `${value.toLocaleString(undefined, { maximumFractionDigits: 2 })} sq ft`

export default function LaserCutOrderDetailPage() {
  const { orderId } = useParams()
  const [order, setOrder] = useState<Order>()
  const [error, setError] = useState('')

  useEffect(() => {
    if (!orderId) return
    apiFetch<{ data: Order }>(`/laser-cut-management/orders/${orderId}`)
      .then((response) => setOrder(response.data))
      .catch((reason) => setError(reason instanceof Error ? reason.message : 'Unable to load laser-cut order'))
  }, [orderId])

  return (
    <>
      <PageMetaData title={order ? `Laser-cut order ${order.orderName}` : 'Laser-cut order'} />
      <div className="d-flex justify-content-between align-items-start flex-wrap gap-2 mb-3">
        <div><h4 className="mb-1">Laser-cut order details</h4><p className="text-muted mb-0">Order, client, dispatch, and product details.</p></div>
        <div className="d-flex gap-2">
          <Link to={`/laser-cut-management/move-out?orderId=${orderId}`}><Button>Move out to powder coating</Button></Link>
          <Link to="/laser-cut-management/orders"><Button variant="outline-secondary">Back to orders</Button></Link>
        </div>
      </div>
      {error && <Alert variant="danger">{error}</Alert>}
      {!error && !order && <div className="text-center py-5"><Spinner /></div>}
      {order && <>
        <Card className="mb-3">
          <CardBody>
            <h5 className="mb-3">Order summary</h5>
            <div className="row g-3">
              <div className="col-md-3"><Detail label="Order ID">{order.orderName}</Detail></div>
              <div className="col-md-3"><Detail label="Created date">{dateTime(order.createdAt)}</Detail></div>
              <div className="col-md-2"><Detail label="Days in laser cutting">{laserCutDays(order.createdAt)}</Detail></div>
              <div className="col-md-2"><Detail label="Expected sheets">{order.expected.sheets}</Detail></div>
              <div className="col-md-2"><Detail label="Sent sheets">{order.sent.sheets}</Detail></div>
              <div className="col-md-2"><Detail label="Remaining sheets">{order.remainingSheets}</Detail></div>
              <div className="col-md-2"><Detail label="Status"><Badge bg={order.status === 'COMPLETE' ? 'success' : order.status === 'PARTIAL' ? 'danger' : 'secondary'}>{order.status}</Badge></Detail></div>
            </div>
          </CardBody>
        </Card>

        <Card className="mb-3">
          <CardBody>
            <h5 className="mb-3">Client details</h5>
            <div className="row g-3">
              <div className="col-md-3"><Detail label="Client">{order.client?.name || order.clientName}</Detail></div>
              <div className="col-md-3"><Detail label="GSTIN">{order.client?.gstin}</Detail></div>
              <div className="col-md-3"><Detail label="Phone">{order.client?.phone}</Detail></div>
              <div className="col-md-3"><Detail label="Email">{order.client?.email}</Detail></div>
              <div className="col-md-6"><Detail label="Billing address">{order.client?.billingAddress}</Detail></div>
              <div className="col-md-6"><Detail label="Shipping address">{order.client?.shippingAddress}</Detail></div>
              <div className="col-md-3"><Detail label="State">{order.client?.state}</Detail></div>
              <div className="col-md-3"><Detail label="State code">{order.client?.stateCode}</Detail></div>
            </div>
          </CardBody>
        </Card>

        <h5 className="mb-3">Laser-cut challans ({order.challans.length})</h5>
        {order.challans.map((challan) => (
          <Card className="mb-3" key={challan._id}>
            <CardBody>
              <div className="d-flex justify-content-between align-items-start flex-wrap gap-2 mb-3">
                <div><h6 className="mb-1">{challan.challanNo}</h6><span className="text-muted">{challan.type === 'OUT' ? 'Outward dispatch' : 'Inward return'}</span></div>
                <Badge bg={challan.status === 'DISPATCHED' ? 'success' : challan.status === 'RECEIVED' ? 'primary' : 'secondary'}>{challan.status}</Badge>
              </div>
              <div className="row g-3 mb-4">
                <div className="col-md-3"><Detail label="Challan date">{dateTime(challan.challanDate)}</Detail></div>
                <div className="col-md-3"><Detail label="Created date">{dateTime(challan.createdAt)}</Detail></div>
                <div className="col-md-3"><Detail label="Dispatched date">{dateTime(challan.dispatchedAt)}</Detail></div>
                <div className="col-md-3"><Detail label="Received date">{dateTime(challan.receivedAt)}</Detail></div>
                <div className="col-md-3"><Detail label="Parent client">{challan.clientName}</Detail></div>
                <div className="col-md-3"><Detail label="Child client site">{challan.clientSiteName}</Detail></div>
                <div className="col-md-6"><Detail label="Child client address">{challan.clientSiteAddressSnapshot}</Detail></div>
                <div className="col-md-3"><Detail label="Vendor">{challan.vendorName}</Detail></div>
                <div className="col-md-3"><Detail label="Transport type">{challan.transportType}</Detail></div>
                <div className="col-md-3"><Detail label="Vehicle number">{challan.vehicleNumber}</Detail></div>
                <div className="col-md-3"><Detail label="E-way bill number">{challan.eWayBillNumber}</Detail></div>
                <div className="col-md-6"><Detail label="Vendor address">{challan.vendorAddressSnapshot}</Detail></div>
                <div className="col-md-6"><Detail label="Laser-cut drop-off address">{challan.deliveryAddress}</Detail></div>
              </div>
              <div className="table-responsive">
                <Table hover className="align-middle mb-0 text-nowrap" style={{ minWidth: 1100 }}>
                  <thead><tr><th>Product</th><th>Pickup vendor</th><th>Pickup address</th><th>HSN</th><th>Material type</th><th>Quantity</th><th>Sheet size (ft)</th><th>Total sq ft</th><th>Unit</th></tr></thead>
                  <tbody>{challan.items.map((item, index) => <tr key={`${challan._id}-${index}`}><td>{item.itemName}</td><td>{item.pickupSupplierName || '—'}</td><td>{item.pickupAddressSnapshot || '—'}</td><td>{item.hsnCode || '0000'}</td><td>{item.materialType}</td><td>{item.quantity}</td><td>{item.materialType === 'SHEET' ? `${item.dimensions?.heightFt || '—'} × ${item.dimensions?.widthFt || '—'}` : '—'}</td><td>{sqFt(sheetSqFt(item))}</td><td>{item.unit || '—'}</td></tr>)}</tbody>
                </Table>
              </div>
              <div className="text-end fw-semibold mt-3">Total sheet area: {sqFt(challan.items.reduce((total, item) => total + (sheetSqFt(item) || 0), 0))}</div>
            </CardBody>
          </Card>
        ))}
        {!order.challans.length && <Card><CardBody className="text-center text-muted py-4">No products have been sent for this order yet.</CardBody></Card>}
      </>}
    </>
  )
}
