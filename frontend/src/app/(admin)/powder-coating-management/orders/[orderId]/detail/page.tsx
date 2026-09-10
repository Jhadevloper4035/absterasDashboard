import PageMetaData from '@/components/PageTitle'
import { apiFetch } from '@/helpers/api'
import { FormEvent, useEffect, useState } from 'react'
import { Alert, Button, Card, CardBody, Form, Spinner, Table } from 'react-bootstrap'
import { Link, useParams } from 'react-router-dom'

type Item = { inventoryItemRef: string; laserCutStockRef?: string; itemName: string; quantity: number; unit?: string; shadeName?: string; shadeCode?: string; dimensions?: { heightFt?: number; widthFt?: number; lengthFt?: number } }
type Batch = { batchNo: string; recordedAt: string; items: { inventoryItemRef: string; laserCutStockRef?: string; quantity: number }[] }
type Order = { _id: string; orderNo: string; clientName: string; clientSiteName?: string; clientSiteAddressSnapshot?: string; vendorName: string; status: 'OUT' | 'RETURNED'; totalQuantity: number; readyQuantity: number; pendingCoatingQuantity: number; deliveredQuantity: number; remainingQuantity: number; deliveryStatus: string; items: Item[]; coatingBatches?: Batch[] }
const itemKey = (item: Pick<Item, 'inventoryItemRef' | 'laserCutStockRef'>) => item.laserCutStockRef ? `stock:${item.laserCutStockRef}` : `product:${item.inventoryItemRef}`
const materialSize = (dimensions?: Item['dimensions']) => dimensions?.heightFt && dimensions.widthFt ? `${dimensions.heightFt} × ${dimensions.widthFt} ft` : dimensions?.lengthFt ? `${dimensions.lengthFt} ft` : '—'

export default function PowderCoatingOrderDetailPage() {
  const { orderId } = useParams()
  const [order, setOrder] = useState<Order>()
  const [quantities, setQuantities] = useState<Record<string, string>>({})
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const load = async () => {
    if (!orderId) return
    setLoading(true)
    try { const response = await apiFetch<{ data: Order }>(`/powder-coating-management/orders/${orderId}`); setOrder(response.data); setError('') } catch (reason) { setError(reason instanceof Error ? reason.message : 'Unable to load powder-coating order') } finally { setLoading(false) }
  }
  useEffect(() => { void load() }, [orderId])
  const readyFor = (item: Item) => (order?.coatingBatches || []).flatMap((batch) => batch.items).filter((entry) => itemKey(entry) === itemKey(item)).reduce((total, entry) => total + entry.quantity, 0)
  const saveBatch = async (event: FormEvent) => {
    event.preventDefault()
    if (!order) return
    const items = order.items.map((item) => ({ inventoryItemRef: item.inventoryItemRef, laserCutStockRef: item.laserCutStockRef, quantity: Number(quantities[itemKey(item)] || 0) })).filter((item) => item.quantity > 0)
    if (!items.length) return setError('Enter at least one completed coating quantity')
    setSaving(true); setError('')
    try { await apiFetch(`/powder-coating-management/orders/${order._id}/ready-batches`, { method: 'POST', body: JSON.stringify({ items }) }); setQuantities({}); await load() } catch (reason) { setError(reason instanceof Error ? reason.message : 'Unable to save coating batch') } finally { setSaving(false) }
  }
  return <><PageMetaData title="Powder Coating Order" />
    <div className="d-flex justify-content-between align-items-start flex-wrap gap-2 mb-3"><div><h4 className="mb-1">{order?.orderNo || 'Powder Coating Order'}</h4><p className="text-muted mb-0">{order?.clientName || 'Client'}{order?.clientSiteName ? ` · ${order.clientSiteName}` : ''}</p></div><div className="d-flex gap-2">{order?.status === 'OUT' && order.remainingQuantity > 0 ? <Link className="btn btn-primary" to={`/powder-coating-management/orders/${orderId}/dispatch`}>Send ready items to client</Link> : <Button disabled>Send ready items to client</Button>}<Link className="btn btn-outline-secondary" to="/powder-coating-management/orders">Back to orders</Link></div></div>
    {error && <Alert variant="danger">{error}</Alert>}
    {loading || !order ? <div className="text-center py-5"><Spinner /></div> : <>
      <Card className="mb-3"><CardBody><div className="row g-3"><div className="col-6 col-md"><small className="text-muted d-block">Planned for coating</small><strong>{order.totalQuantity}</strong></div><div className="col-6 col-md"><small className="text-muted d-block">Coating ready</small><strong className="text-success">{order.readyQuantity}</strong></div><div className="col-6 col-md"><small className="text-muted d-block">Delivered to client</small><strong className="text-success">{order.deliveredQuantity}</strong></div><div className="col-6 col-md"><small className="text-muted d-block">Ready to deliver</small><strong className="text-primary">{order.remainingQuantity}</strong></div><div className="col-6 col-md"><small className="text-muted d-block">Pending coating</small><strong className="text-warning">{order.pendingCoatingQuantity}</strong></div></div></CardBody></Card>
      <Card className="mb-3"><CardBody><h5 className="mb-1">Record ready coating batch</h5><p className="text-muted mb-3">Enter only the materials that are coated and ready now. You may save partial batches.</p><Form onSubmit={saveBatch}><Table responsive className="align-middle mb-3"><thead><tr><th>Material</th><th>Planned</th><th>Ready</th><th>Pending</th><th>Add now</th></tr></thead><tbody>{order.items.map((item) => { const ready = readyFor(item); const pending = Math.max(item.quantity - ready, 0); return <tr key={itemKey(item)}><td><div className="fw-medium">{item.itemName} · {materialSize(item.dimensions)}</div><small className="text-muted">{item.shadeName} · {item.shadeCode}</small></td><td>{item.quantity} {item.unit}</td><td>{ready}</td><td>{pending}</td><td><Form.Control aria-label={`${item.itemName} ready quantity`} type="number" min="0" max={pending} step="0.01" disabled={!pending || saving} value={quantities[itemKey(item)] || ''} onChange={(event) => setQuantities((current) => ({ ...current, [itemKey(item)]: event.target.value }))} /></td></tr> })}</tbody></Table><Button type="submit" disabled={saving || order.status !== 'OUT'}>{saving ? 'Saving…' : 'Save ready batch'}</Button></Form></CardBody></Card>
      {!!order.coatingBatches?.length && <Card><CardBody><details><summary className="text-primary">View recorded coating batches ({order.coatingBatches.length})</summary><Table size="sm" responsive className="mt-3 mb-0"><thead><tr><th>Batch</th><th>Recorded</th><th>Ready material</th></tr></thead><tbody>{order.coatingBatches.map((batch) => <tr key={batch.batchNo}><td>{batch.batchNo}</td><td>{new Date(batch.recordedAt).toLocaleString()}</td><td>{batch.items.map((entry) => { const item = order.items.find((value) => itemKey(value) === itemKey(entry)); return `${item?.itemName || 'Material'}: ${entry.quantity}` }).join(' · ')}</td></tr>)}</tbody></Table></details></CardBody></Card>}
    </>}
  </>
}
