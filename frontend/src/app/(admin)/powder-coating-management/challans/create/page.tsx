import PageMetaData from '@/components/PageTitle'
import { apiFetch } from '@/helpers/api'
import { FormEvent, useEffect, useState } from 'react'
import { Alert, Button, Card, CardBody, Col, Form, Row, Spinner, Table } from 'react-bootstrap'
import { Link, useNavigate, useSearchParams } from 'react-router-dom'
import { toast } from 'react-toastify'

type Supplier = { _id: string; name: string; address?: string }
type Product = { _id: string; name: string; sku: string; category?: string; hsnCode?: string; unit: string; quantityInStock: number; shadeName?: string; shadeCode?: string; shadeImage?: { url?: string; originalName?: string }; supplier?: Supplier }
type Client = { _id: string; name: string; parentClient?: string | { _id: string }; siteName?: string; siteAddress?: string; shippingAddress?: string; billingAddress?: string }
type LaserCutStock = { _id: string; inventoryItemRef: string; itemName: string; vendorRef: string; vendorName: string; quantityAvailable: number; unit?: string }
type LaserCutOrder = { _id: string; orderName: string; customerRef?: string; challans: { type: 'OUT' | 'IN'; status: string; vendorRef: string; clientSiteRef?: string; transportType?: string; vehicleNumber?: string; eWayBillNumber?: string }[] }
type Line = { inventoryItemRef: string; quantity: string; source?: 'INVENTORY' | 'LASER_CUT'; laserCutStockRef?: string; shadeName?: string; shadeCode?: string }
type CreatePowderCoatingOrderProps = { laserCutOrderId?: string; cancelTo?: string }
const blankLine = (): Line => ({ inventoryItemRef: '', quantity: '1', source: 'INVENTORY' })
const today = new Date().toISOString().slice(0, 10)

export default function CreatePowderCoatingOrderPage({ laserCutOrderId: providedLaserCutOrderId, cancelTo = '/powder-coating-management' }: CreatePowderCoatingOrderProps = {}) {
  const navigate = useNavigate()
  const [searchParams] = useSearchParams()
  const laserCutOrderId = providedLaserCutOrderId || searchParams.get('laserCutOrderId') || ''
  const [products, setProducts] = useState<Product[]>([])
  const [vendors, setVendors] = useState<Supplier[]>([])
  const [clients, setClients] = useState<Client[]>([])
  const [laserCutOrder, setLaserCutOrder] = useState<LaserCutOrder>()
  const [laserCutStock, setLaserCutStock] = useState<LaserCutStock[]>([])
  const [lines, setLines] = useState<Line[]>([blankLine()])
  const [clientRef, setClientRef] = useState('')
  const [clientSiteRef, setClientSiteRef] = useState('')
  const [vendorRef, setVendorRef] = useState('')
  const [challanDate, setChallanDate] = useState(today)
  const [transportType, setTransportType] = useState('')
  const [vehicleNumber, setVehicleNumber] = useState('')
  const [eWayBillNumber, setEWayBillNumber] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  useEffect(() => {
    const requests: Promise<unknown>[] = [
      apiFetch<{ data: Product[] }>('/inventory/items?limit=100'),
      apiFetch<{ data: Supplier[] }>('/powder-coating-management/vendors?status=active'),
      apiFetch<{ data: Client[] }>('/clients?limit=100'),
    ]
    if (laserCutOrderId) requests.push(apiFetch<{ data: LaserCutOrder }>(`/laser-cut-management/orders/${laserCutOrderId}`), apiFetch<{ data: LaserCutStock[] }>('/laser-cut-management/stock'))
    Promise.all(requests).then((responses) => {
      const [productResponse, vendorResponse, clientResponse] = responses as [{ data: Product[] }, { data: Supplier[] }, { data: Client[] }, { data: LaserCutOrder }?, { data: LaserCutStock[] }?]
      setProducts(productResponse.data)
      setVendors(vendorResponse.data)
      setClients(clientResponse.data)
      if (laserCutOrderId) {
        const order = responses[3] as { data: LaserCutOrder }
        const stock = responses[4] as { data: LaserCutStock[] }
        const latestDispatch = order.data.challans.find((challan) => challan.type === 'OUT' && challan.status === 'DISPATCHED')
        const vendorRefs = new Set(order.data.challans.filter((challan) => challan.type === 'OUT' && challan.status === 'DISPATCHED').map((challan) => challan.vendorRef))
        const availableLaserStock = stock.data.filter((entry) => vendorRefs.has(entry.vendorRef) && entry.quantityAvailable > 0)
        setLaserCutOrder(order.data)
        setLaserCutStock(availableLaserStock)
        setClientRef(order.data.customerRef || '')
        setClientSiteRef(latestDispatch?.clientSiteRef || '')
        setTransportType(latestDispatch?.transportType || '')
        setVehicleNumber(latestDispatch?.vehicleNumber || '')
        setEWayBillNumber(latestDispatch?.eWayBillNumber || '')
        setLines(availableLaserStock.length
          ? availableLaserStock.map((entry) => ({ ...blankLine(), source: 'LASER_CUT', laserCutStockRef: entry._id, inventoryItemRef: entry.inventoryItemRef, quantity: String(entry.quantityAvailable) }))
          : [{ ...blankLine(), source: 'LASER_CUT' }])
      }
    }).catch((reason) => setError(reason instanceof Error ? reason.message : 'Unable to load powder-coating form')).finally(() => setLoading(false))
  }, [laserCutOrderId])
  const parentClients = clients.filter((client) => !client.parentClient)
  const sites = clients.filter((client) => String(typeof client.parentClient === 'string' ? client.parentClient : client.parentClient?._id) === clientRef)
  const selectedSite = sites.find((site) => site._id === clientSiteRef)
  const selectedVendor = vendors.find((vendor) => vendor._id === vendorRef)
  const powderCoatingProducts = products.filter((product) => product.category !== 'hardware')
  const productFor = (id: string) => products.find((product) => product._id === id)
  const laserStockFor = (id?: string) => laserCutStock.find((stock) => stock._id === id)
  const selectLaserStock = (index: number, id: string) => {
    const stock = laserStockFor(id)
    setLines((current) => current.map((entry, lineIndex) => lineIndex === index ? { ...entry, source: 'LASER_CUT', laserCutStockRef: id, inventoryItemRef: stock?.inventoryItemRef || '', shadeName: '', shadeCode: '' } : entry))
  }
  const selectInventoryProduct = (index: number, id: string) => {
    const product = productFor(id)
    setLines((current) => current.map((entry, lineIndex) => lineIndex === index ? { ...entry, inventoryItemRef: id, shadeName: product?.shadeName || '', shadeCode: product?.shadeCode || '' } : entry))
  }
  const addAllProducts = () => setLines(laserCutOrder
    ? laserCutStock.map((stock) => ({ ...blankLine(), source: 'LASER_CUT', laserCutStockRef: stock._id, inventoryItemRef: stock.inventoryItemRef }))
    : powderCoatingProducts.map((product) => ({ ...blankLine(), inventoryItemRef: product._id, shadeName: product.shadeName || '', shadeCode: product.shadeCode || '' })))
  const save = async (event: FormEvent) => {
    event.preventDefault()
    const overStock = lines.find((line) => {
      const available = line.source === 'LASER_CUT' ? laserStockFor(line.laserCutStockRef)?.quantityAvailable : productFor(line.inventoryItemRef)?.quantityInStock
      return Number(line.quantity) > Number(available || 0)
    })
    if (overStock) return setError('Quantity cannot be greater than available inventory stock')
    setSaving(true)
    setError('')
    try {
      await apiFetch('/powder-coating-management/orders', { method: 'POST', body: JSON.stringify({ clientRef, clientSiteRef: clientSiteRef || undefined, vendorRef, challanDate, transportType, vehicleNumber, eWayBillNumber, laserCutOrderRef: laserCutOrder?._id, items: lines }) })
      toast.success('Powder-coating order and outward challan created')
      navigate('/powder-coating-management')
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : 'Unable to create powder-coating order')
    } finally {
      setSaving(false)
    }
  }
  return (
    <>
      <PageMetaData title="Create Powder Coating Order" />
      <div className="d-flex justify-content-between align-items-start gap-3 mb-3"><div><h4 className="mb-1">Send {laserCutOrder ? `laser-cut order ${laserCutOrder.orderName}` : 'inventory'} to powder coating</h4><p className="text-muted mb-0">The outward challan is created and dispatched with this order. You can send an order in as many partial batches as needed.</p></div><div className="d-flex gap-2"><Link className="btn btn-outline-primary" to="/powder-coating-management/vendors">Manage vendors</Link><Link className="btn btn-outline-secondary" to={cancelTo}>{laserCutOrder ? 'Change order' : 'Cancel'}</Link></div></div>
      {error && <Alert variant="danger">{error}</Alert>}
      <Card><CardBody>
        <Form onSubmit={save}>
          <Row className="g-3">
            <Col md={4}><Form.Label>Challan date</Form.Label><Form.Control required type="date" value={challanDate} onChange={(event) => setChallanDate(event.target.value)} /></Col>
            <Col md={4}><Form.Label>Parent client</Form.Label><Form.Select required value={clientRef} onChange={(event) => { setClientRef(event.target.value); setClientSiteRef('') }}><option value="">Select parent client</option>{parentClients.map((client) => <option key={client._id} value={client._id}>{client.name}</option>)}</Form.Select></Col>
            <Col md={4}><Form.Label>Child client site</Form.Label><Form.Select value={clientSiteRef} disabled={!clientRef || !sites.length} onChange={(event) => setClientSiteRef(event.target.value)}><option value="">{clientRef ? 'Select child client site' : 'Select parent client first'}</option>{sites.map((site) => <option key={site._id} value={site._id}>{site.siteName || site.name}</option>)}</Form.Select></Col>
            <Col md={12}><Form.Label>Child client address</Form.Label><Form.Control readOnly value={selectedSite?.siteAddress || selectedSite?.shippingAddress || selectedSite?.billingAddress || ''} /></Col>
            <Col md={6}><Form.Label>Powder-coating vendor</Form.Label><Form.Select required value={vendorRef} onChange={(event) => setVendorRef(event.target.value)}><option value="">Select vendor</option>{vendors.map((vendor) => <option key={vendor._id} value={vendor._id}>{vendor.name}</option>)}</Form.Select></Col>
            <Col md={6}><Form.Label>Powder-coating vendor address</Form.Label><Form.Control readOnly value={selectedVendor?.address || ''} /></Col>
            <Col md={4}><Form.Label>Transport type</Form.Label><Form.Control value={transportType} onChange={(event) => setTransportType(event.target.value)} /></Col>
            <Col md={4}><Form.Label>Vehicle number</Form.Label><Form.Control value={vehicleNumber} onChange={(event) => setVehicleNumber(event.target.value)} /></Col>
            <Col md={4}><Form.Label>E-way bill number</Form.Label><Form.Control value={eWayBillNumber} onChange={(event) => setEWayBillNumber(event.target.value)} /></Col>
          </Row>
          <div className="d-flex justify-content-between align-items-center flex-wrap gap-2 mt-4 mb-2"><div><h5 className="mb-0">{laserCutOrder ? 'Laser-cut stock' : 'Inventory products'}</h5><small className="text-muted">Hardware is excluded. For Laser Cut transfers, enter the updated shade name and shade code before creating the Powder Coating order.</small></div><div className="d-flex gap-2"><Button type="button" size="sm" variant="outline-primary" onClick={addAllProducts}>Add all products</Button><Button type="button" size="sm" variant="outline-primary" onClick={() => setLines((current) => [...current, { ...blankLine(), source: laserCutOrder ? 'LASER_CUT' : 'INVENTORY' }])}>Add product</Button></div></div>
          <Table responsive className="align-middle" style={{ minWidth: 1450 }}><thead><tr><th>Product</th><th>Pickup supplier</th><th>Pickup address</th><th>Available</th><th>HSN</th><th>Shade name</th><th>Shade code</th><th>Shade image</th><th>Quantity</th><th>Unit</th><th /></tr></thead><tbody>{lines.map((line, index) => {
            const product = productFor(line.inventoryItemRef)
            const stock = laserStockFor(line.laserCutStockRef)
            const available = line.source === 'LASER_CUT' ? stock?.quantityAvailable : product?.quantityInStock
            const shadeName = line.source === 'LASER_CUT' ? line.shadeName || '' : line.shadeName ?? product?.shadeName ?? ''
            const shadeCode = line.source === 'LASER_CUT' ? line.shadeCode || '' : line.shadeCode ?? product?.shadeCode ?? ''
            return <tr key={index}><td><Form.Select required value={line.source === 'LASER_CUT' ? line.laserCutStockRef : line.inventoryItemRef} onChange={(event) => line.source === 'LASER_CUT' ? selectLaserStock(index, event.target.value) : selectInventoryProduct(index, event.target.value)}><option value="">Select product</option>{line.source === 'LASER_CUT' ? laserCutStock.map((item) => <option key={item._id} value={item._id}>{item.itemName} · {item.vendorName}</option>) : powderCoatingProducts.map((item) => <option key={item._id} value={item._id}>{item.name} ({item.sku})</option>)}</Form.Select></td><td>{stock?.vendorName || product?.supplier?.name || 'No supplier assigned'}</td><td style={{ minWidth: 180 }}>{product?.supplier?.address || '—'}</td><td>{available ?? '—'}</td><td>{product?.hsnCode || '0000'}</td><td><Form.Control required value={shadeName} onChange={(event) => setLines((current) => current.map((entry, lineIndex) => lineIndex === index ? { ...entry, shadeName: event.target.value } : entry))} /></td><td><Form.Control required value={shadeCode} onChange={(event) => setLines((current) => current.map((entry, lineIndex) => lineIndex === index ? { ...entry, shadeCode: event.target.value } : entry))} /></td><td>{product?.shadeImage?.url ? <img src={product.shadeImage.url} alt={shadeName || product.shadeName || 'Shade'} width={44} height={44} style={{ objectFit: 'cover' }} /> : '—'}</td><td><Form.Control required type="number" min="0.01" step="0.01" value={line.quantity} onChange={(event) => setLines((current) => current.map((entry, lineIndex) => lineIndex === index ? { ...entry, quantity: event.target.value } : entry))} /></td><td>{stock?.unit || product?.unit || '—'}</td><td>{lines.length > 1 && <Button type="button" size="sm" variant="outline-danger" onClick={() => setLines((current) => current.filter((_, lineIndex) => lineIndex !== index))}>Remove</Button>}</td></tr>
          })}</tbody></Table>
          <Button type="submit" disabled={saving || loading}>{saving ? 'Creating…' : 'Create Powder Coating order and challan'}</Button>
        </Form>
        {loading && <div className="text-center py-4"><Spinner /></div>}
      </CardBody></Card>
    </>
  )
}
