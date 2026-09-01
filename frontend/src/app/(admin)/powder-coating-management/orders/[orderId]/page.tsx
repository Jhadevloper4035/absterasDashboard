import PageMetaData from '@/components/PageTitle'
import { apiFetch } from '@/helpers/api'
import { FormEvent, useEffect, useState } from 'react'
import { Alert, Button, Card, CardBody, Form, Spinner, Table } from 'react-bootstrap'
import { Link, useNavigate, useParams } from 'react-router-dom'
import { toast } from 'react-toastify'

type Item = { inventoryItemRef: string; itemName: string; unit?: string; quantity: number; shadeName?: string; shadeCode?: string }
type Order = { _id: string; orderNo: string; clientName: string; clientSiteName?: string; clientSiteAddressSnapshot?: string; status: 'OUT' | 'RETURNED'; deliveryStatus: 'AT_VENDOR' | 'PARTIAL' | 'DELIVERED'; remainingItems: Item[] }
type Line = { inventoryItemRef: string; quantity: string }

export default function PowderCoatingSiteDispatchPage() {
  const { orderId } = useParams()
  const navigate = useNavigate()
  const [order, setOrder] = useState<Order>()
  const [lines, setLines] = useState<Line[]>([])
  const [challanDate, setChallanDate] = useState(new Date().toISOString().slice(0, 10))
  const [transportType, setTransportType] = useState('')
  const [vehicleNumber, setVehicleNumber] = useState('')
  const [eWayBillNumber, setEWayBillNumber] = useState('')
  const [error, setError] = useState('')
  const [saving, setSaving] = useState(false)

  const load = async () => {
    if (!orderId) return
    try {
      const response = await apiFetch<{ data: Order }>(`/powder-coating-management/orders/${orderId}`)
      setOrder(response.data)
      setLines(response.data.remainingItems.filter((item) => item.quantity > 0).map((item) => ({ inventoryItemRef: item.inventoryItemRef, quantity: String(item.quantity) })))
    } catch (reason) { setError(reason instanceof Error ? reason.message : 'Unable to load powder-coating order') }
  }
  useEffect(() => { void load() }, [orderId])
  const remainingFor = (id: string) => order?.remainingItems.find((item) => item.inventoryItemRef === id)
  const submit = async (event: FormEvent) => {
    event.preventDefault()
    if (!orderId) return
    const overRemaining = lines.find((line) => Number(line.quantity) > Number(remainingFor(line.inventoryItemRef)?.quantity || 0))
    if (overRemaining) return setError('Quantity cannot exceed the balance at powder coating')
    setSaving(true); setError('')
    try {
      await apiFetch(`/powder-coating-management/orders/${orderId}/dispatch-to-site`, { method: 'POST', body: JSON.stringify({ challanDate, transportType, vehicleNumber, eWayBillNumber, items: lines.map((line) => ({ ...line, quantity: Number(line.quantity) })) }) })
      toast.success('Site delivery challan created')
      navigate('/powder-coating-management')
    } catch (reason) { setError(reason instanceof Error ? reason.message : 'Unable to create site delivery challan') } finally { setSaving(false) }
  }

  return <>
    <PageMetaData title="Send Powder Coating Order to Site" />
    <div className="d-flex justify-content-between align-items-start gap-2 mb-3"><div><h4 className="mb-1">Send powder-coated products to site</h4><p className="text-muted mb-0">Send a partial or full balance. The remaining quantity stays at powder coating.</p></div><Link className="btn btn-outline-secondary" to="/powder-coating-management">Cancel</Link></div>
    {error && <Alert variant="danger">{error}</Alert>}
    {!order ? <div className="text-center py-5"><Spinner /></div> : <Card><CardBody><Form onSubmit={submit}>
      <div className="row g-3 mb-4"><div className="col-md-4"><Form.Label>Order</Form.Label><Form.Control readOnly value={order.orderNo} /></div><div className="col-md-4"><Form.Label>Client</Form.Label><Form.Control readOnly value={order.clientName} /></div><div className="col-md-4"><Form.Label>Client site address</Form.Label><Form.Control readOnly value={order.clientSiteAddressSnapshot || order.clientSiteName || 'Client address'} /></div><div className="col-md-3"><Form.Label>Challan date</Form.Label><Form.Control required type="date" value={challanDate} onChange={(event) => setChallanDate(event.target.value)} /></div><div className="col-md-3"><Form.Label>Transport type</Form.Label><Form.Control value={transportType} onChange={(event) => setTransportType(event.target.value)} /></div><div className="col-md-3"><Form.Label>Vehicle number</Form.Label><Form.Control value={vehicleNumber} onChange={(event) => setVehicleNumber(event.target.value)} /></div><div className="col-md-3"><Form.Label>E-way bill number</Form.Label><Form.Control value={eWayBillNumber} onChange={(event) => setEWayBillNumber(event.target.value)} /></div></div>
      <Table responsive className="align-middle"><thead><tr><th>Product</th><th>Shade</th><th>Shade code</th><th>Available at powder coating</th><th>Send quantity</th><th>Unit</th></tr></thead><tbody>{lines.map((line, index) => { const item = remainingFor(line.inventoryItemRef); return <tr key={line.inventoryItemRef}><td>{item?.itemName}</td><td>{item?.shadeName || '—'}</td><td>{item?.shadeCode || '—'}</td><td>{item?.quantity}</td><td><Form.Control required type="number" min="0.01" max={item?.quantity} step="0.01" value={line.quantity} onChange={(event) => setLines((current) => current.map((entry, lineIndex) => lineIndex === index ? { ...entry, quantity: event.target.value } : entry))} /></td><td>{item?.unit || '—'}</td></tr> })}</tbody></Table>
      <Button type="submit" disabled={saving || !lines.length || order.status !== 'OUT'}>{saving ? 'Creating…' : 'Create site delivery challan'}</Button>
    </Form></CardBody></Card>}
  </>
}
