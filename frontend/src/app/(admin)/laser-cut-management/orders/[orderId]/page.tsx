import PageMetaData from '@/components/PageTitle'
import { apiFetch } from '@/helpers/api'
import { type FormEvent, type ReactNode, useCallback, useEffect, useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import { Alert, Badge, Button, Card, CardBody, Form, Spinner, Table } from 'react-bootstrap'

type Client = { name?: string; gstin?: string; billingAddress?: string; shippingAddress?: string; state?: string; stateCode?: string; phone?: string; email?: string }
type Dimensions = { heightFt?: number; widthFt?: number; lengthFt?: number }
type Item = { itemName: string; hsnCode?: string; materialType: string; unit?: string; quantity: number; dimensions?: Dimensions; pickupSupplierName?: string; pickupAddressSnapshot?: string }
type Challan = {
  _id: string; challanNo: string; type: 'OUT' | 'IN'; challanDate: string; createdAt: string; dispatchedAt?: string; receivedAt?: string
  clientName?: string; clientSiteName?: string; clientSiteAddressSnapshot?: string; deliveryAddress?: string
  vendorRef: string; vendorName: string; vendorAddressSnapshot?: string; transportType?: string; vehicleNumber?: string; eWayBillNumber?: string
  status: 'DRAFT' | 'DISPATCHED' | 'RECEIVED'; items: Item[]
}
type ProductionOutput = { challanRef: string; lineIndex: number; outputIndex: number; challanNo: string; itemName: string; materialType: 'SHEET' | 'TUBE'; dimensions: Dimensions; plannedQuantity: number; readyQuantity: number; remainingQuantity: number }
type ProductionBatch = { batchNo?: string; reportedAt?: string; materialType: 'SHEET' | 'TUBE'; panelsProduced: number }
type Order = {
  _id: string; orderName: string; createdAt: string; clientName?: string; client?: Client
  expected: { sheets: number; tubes: number }; sent: { sheets: number; tubes: number }; planned: { sheets: number; tubes: number }; ready: { sheets: number; tubes: number }; remainingSheets: number; remainingTubes: number; status: 'PENDING' | 'PARTIAL' | 'COMPLETE'; challans: Challan[]
  production: { outputs: ProductionOutput[]; batches: ProductionBatch[] }
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
const outputKey = (output: ProductionOutput) => `${output.challanRef}:${output.lineIndex}:${output.outputIndex}`
const outputSize = (output: ProductionOutput) => output.materialType === 'SHEET' ? `${output.dimensions.heightFt} × ${output.dimensions.widthFt} ft` : `${output.dimensions.lengthFt} ft`

export default function LaserCutOrderDetailPage() {
  const { orderId } = useParams()
  const [order, setOrder] = useState<Order>()
  const [error, setError] = useState('')
  const [batchQuantities, setBatchQuantities] = useState<Record<string, string>>({})
  const [savingBatch, setSavingBatch] = useState(false)

  const load = useCallback(async () => {
    if (!orderId) return
    try {
      setError('')
      const response = await apiFetch<{ data: Order }>(`/laser-cut-management/orders/${orderId}`)
      setOrder(response.data)
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : 'Unable to load laser-cut order')
    }
  }, [orderId])
  useEffect(() => {
    void load()
  }, [load])

  const submitReadyBatch = async (event: FormEvent) => {
    event.preventDefault()
    if (!order) return
    const items = order.production.outputs.map((output) => ({ ...output, quantity: Number(batchQuantities[outputKey(output)] || 0) })).filter((output) => output.quantity > 0)
    if (!items.length) return setError('Enter at least one ready sheet or tube quantity')
    setSavingBatch(true); setError('')
    try {
      await apiFetch(`/laser-cut-management/orders/${order._id}/ready-batches`, { method: 'POST', body: JSON.stringify({ items }) })
      setBatchQuantities({})
      await load()
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : 'Unable to record ready batch')
    } finally {
      setSavingBatch(false)
    }
  }
  const batchGroups = order ? Object.values(order.production.batches.reduce<Record<string, { batchNo: string; reportedAt?: string; quantities: string[] }>>((groups, batch) => {
    const key = batch.batchNo || `${batch.reportedAt}-${batch.materialType}`
    const group = groups[key] || { batchNo: batch.batchNo || 'Existing output', reportedAt: batch.reportedAt, quantities: [] }
    group.quantities.push(`${batch.materialType.toLowerCase()}: ${batch.panelsProduced}`)
    groups[key] = group
    return groups
  }, {})) : []

  return (
    <>
      <PageMetaData title={order ? `Laser-cut order ${order.orderName}` : 'Laser-cut order'} />
      <div className="d-flex justify-content-between align-items-start flex-wrap gap-2 mb-3">
        <div>
          <div className="d-flex align-items-center gap-2 mb-1"><h4 className="mb-0">{order?.orderName || 'Laser-cut order'}</h4>{order && <Badge bg={order.status === 'COMPLETE' ? 'success' : order.status === 'PARTIAL' ? 'warning' : 'secondary'}>{order.status}</Badge>}</div>
          <p className="text-muted mb-0">{order?.client?.name || order?.clientName || 'Client'} · {order?.client?.shippingAddress || order?.client?.billingAddress || 'No address added'}</p>
        </div>
        <div className="d-flex gap-2">
          {order?.status === 'PENDING' ? <Button disabled>Send to Powder Coating</Button> : <Link to={`/laser-cut-management/move-out?orderId=${orderId}`}><Button>Send to Powder Coating</Button></Link>}
          <Link to="/laser-cut-management/orders"><Button variant="outline-secondary">Back to orders</Button></Link>
        </div>
      </div>
      {error && <Alert variant="danger">{error}</Alert>}
      {!error && !order && <div className="text-center py-5"><Spinner /></div>}
      {order && <>
        <Card className="mb-3">
          <CardBody>
            <h5 className="mb-3">At a glance</h5>
            <div className="row g-3">
              <div className="col-6 col-md-3"><Detail label="Ready sheets">{order.ready.sheets} / {order.planned.sheets}</Detail></div>
              <div className="col-6 col-md-3"><Detail label="Ready tubes">{order.ready.tubes} / {order.planned.tubes}</Detail></div>
              <div className="col-6 col-md-3"><Detail label="Source material sent">{order.sent.sheets} sheets · {order.sent.tubes} tubes</Detail></div>
              <div className="col-6 col-md-3"><Detail label="In Laser Cut">{laserCutDays(order.createdAt)} days</Detail></div>
            </div>
          </CardBody>
        </Card>

        <Card className="mb-3">
          <CardBody>
            <h5 className="mb-1">Record ready batch</h5>
            <p className="text-muted mb-3">Enter what is cut and ready now. You may enter sheets, tubes, or both.</p>
            {order.production.outputs.some((output) => output.remainingQuantity > 0) ? (
              <Form onSubmit={submitReadyBatch}>
                <div className="table-responsive">
                  <Table hover className="align-middle mb-3 text-nowrap" style={{ minWidth: 720 }}>
                    <thead><tr><th>Product</th><th>Smaller size</th><th>Planned</th><th>Ready</th><th>Add now</th><th>Pending</th></tr></thead>
                    <tbody>{order.production.outputs.map((output) => <tr key={outputKey(output)}>
                      <td>{output.itemName}<div className="small text-muted">{output.materialType}</div></td><td>{outputSize(output)}</td><td>{output.plannedQuantity}</td><td>{output.readyQuantity}</td>
                      <td><Form.Control aria-label={`${output.itemName} ready quantity`} type="number" min="0" max={output.remainingQuantity} step="0.01" disabled={!output.remainingQuantity || savingBatch} value={batchQuantities[outputKey(output)] || ''} onChange={(event) => setBatchQuantities((current) => ({ ...current, [outputKey(output)]: event.target.value }))} /></td>
                      <td>{output.remainingQuantity}</td>
                    </tr>)}</tbody>
                  </Table>
                </div>
                <Button type="submit" disabled={savingBatch}>{savingBatch ? 'Saving…' : 'Save ready batch'}</Button>
              </Form>
            ) : order.production.outputs.length ? <Alert variant="success" className="mb-0">All planned cut items are ready for Powder Coating.</Alert> : <div className="text-muted">No smaller cut outputs were planned for this order.</div>}
            {!!batchGroups.length && <details className="mt-4"><summary className="text-primary">View recorded batches ({batchGroups.length})</summary><Table size="sm" className="mt-2 mb-0"><thead><tr><th>Batch</th><th>Recorded</th><th>Ready in this batch</th></tr></thead><tbody>{batchGroups.map((batch) => <tr key={batch.batchNo}><td>{batch.batchNo}</td><td>{dateTime(batch.reportedAt)}</td><td>{batch.quantities.join(' · ')}</td></tr>)}</tbody></Table></details>}
          </CardBody>
        </Card>

        <Card className="mb-3">
          <CardBody>
            <details>
              <summary className="fw-semibold">Client and delivery details</summary>
              <div className="row g-3 mt-1">
                <div className="col-md-3"><Detail label="Client">{order.client?.name || order.clientName}</Detail></div>
                <div className="col-md-3"><Detail label="Phone">{order.client?.phone}</Detail></div>
                <div className="col-md-3"><Detail label="Email">{order.client?.email}</Detail></div>
                <div className="col-md-3"><Detail label="GSTIN">{order.client?.gstin}</Detail></div>
                <div className="col-md-6"><Detail label="Billing address">{order.client?.billingAddress}</Detail></div>
                <div className="col-md-6"><Detail label="Shipping address">{order.client?.shippingAddress}</Detail></div>
              </div>
            </details>
          </CardBody>
        </Card>

        <h5 className="mb-3">Laser-cut challans ({order.challans.length})</h5>
        {order.challans.map((challan) => (
          <Card className="mb-3" key={challan._id}>
            <CardBody>
              <details>
                <summary className="fw-semibold">{challan.challanNo} · {challan.vendorName} · {challan.items.length} product{challan.items.length === 1 ? '' : 's'}</summary>
                <div className="mt-3">
                  <div className="d-flex justify-content-between align-items-start flex-wrap gap-2 mb-3">
                    <span className="text-muted">{challan.type === 'OUT' ? 'Outward dispatch' : 'Inward return'}</span>
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
                <div className="col-md-6"><Detail label="Drop location">{challan.deliveryAddress || challan.vendorAddressSnapshot}</Detail></div>
              </div>
              <div className="table-responsive">
                <Table hover className="align-middle mb-0 text-nowrap" style={{ minWidth: 1100 }}>
                  <thead><tr><th>Product</th><th>Pickup vendor</th><th>Pickup location</th><th>HSN</th><th>Material type</th><th>Quantity</th><th>Sheet size (ft)</th><th>Total sq ft</th><th>Unit</th></tr></thead>
                  <tbody>{challan.items.map((item, index) => <tr key={`${challan._id}-${index}`}><td>{item.itemName}</td><td>{item.pickupSupplierName || '—'}</td><td>{item.pickupAddressSnapshot || '—'}</td><td>{item.hsnCode || '0000'}</td><td>{item.materialType}</td><td>{item.quantity}</td><td>{item.materialType === 'SHEET' ? `${item.dimensions?.heightFt || '—'} × ${item.dimensions?.widthFt || '—'}` : '—'}</td><td>{sqFt(sheetSqFt(item))}</td><td>{item.unit || '—'}</td></tr>)}</tbody>
                </Table>
              </div>
              <div className="text-end fw-semibold mt-3">Total sheet area: {sqFt(challan.items.reduce((total, item) => total + (sheetSqFt(item) || 0), 0))}</div>
                </div>
              </details>
            </CardBody>
          </Card>
        ))}
        {!order.challans.length && <Card><CardBody className="text-center text-muted py-4">No products have been sent for this order yet.</CardBody></Card>}
      </>}
    </>
  )
}
