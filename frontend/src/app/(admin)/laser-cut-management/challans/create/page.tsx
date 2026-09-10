import PageMetaData from '@/components/PageTitle'
import { apiFetch } from '@/helpers/api'
import { FormEvent, useEffect, useState } from 'react'
import { Alert, Button, Card, CardBody, Col, Form, Row, Spinner, Table } from 'react-bootstrap'
import { Link, useNavigate } from 'react-router-dom'
import { toast } from 'react-toastify'

type Material = {
  _id: string
  name: string
  sku: string
  quantityInStock: number
  unit: string
  hsnCode?: string
  materialType?: 'SHEET' | 'TUBE' | 'OTHER'
  defaultDimensions?: Dimensions
  supplier?: Supplier
}
type Dimensions = { heightFt?: number; widthFt?: number; lengthFt?: number }
type Supplier = { _id: string; name: string; address?: string }
type Client = { _id: string; name: string; siteName?: string; siteAddress?: string; parentClient?: string | { _id: string }; shippingAddress?: string; billingAddress?: string }
type Order = { _id: string; orderName: string; status: 'PENDING' | 'PARTIAL' | 'COMPLETE' }
type CutOutput = { quantity: string; dimensions: Dimensions }
type Line = { inventoryItemRef: string; hsnCode: string; quantity: string; materialType: 'SHEET' | 'TUBE'; cutOutputs: CutOutput[] }
const blankCutOutput = (): CutOutput => ({ quantity: '', dimensions: {} })
const blankLine = (): Line => ({ inventoryItemRef: '', hsnCode: '', quantity: '1', materialType: 'SHEET', cutOutputs: [blankCutOutput()] })
const number = (value: string) => Number(value || 0)
const sheetSqFt = (material: Material | undefined, quantity: string) => {
  const height = Number(material?.defaultDimensions?.heightFt)
  const width = Number(material?.defaultDimensions?.widthFt)
  return material?.materialType === 'SHEET' && height > 0 && width > 0 ? height * width * number(quantity) : undefined
}
const sqFt = (value: number | undefined) => value === undefined ? '—' : `${value.toLocaleString(undefined, { maximumFractionDigits: 2 })} sq ft`
const materialSize = (material: Material | undefined) => material?.materialType === 'SHEET'
  ? `${material.defaultDimensions?.heightFt || '—'} × ${material.defaultDimensions?.widthFt || '—'}`
  : material?.materialType === 'TUBE' ? `${material.defaultDimensions?.lengthFt || '—'}` : '—'

export default function CreateLaserCutChallanPage() {
  const navigate = useNavigate()
  const [materials, setMaterials] = useState<Material[]>([])
  const [vendors, setVendors] = useState<Supplier[]>([])
  const [clients, setClients] = useState<Client[]>([])
  const [orders, setOrders] = useState<Order[]>([])
  const [vendorRef, setVendorRef] = useState('')
  const [orderRef, setOrderRef] = useState('new')
  const [expectedSheets, setExpectedSheets] = useState('0')
  const [expectedTubes, setExpectedTubes] = useState('0')
  const [clientRef, setClientRef] = useState('')
  const [clientSiteRef, setClientSiteRef] = useState('')
  const [challanDate, setChallanDate] = useState(new Date().toISOString().slice(0, 10))
  const [vendorAddressSnapshot, setVendorAddressSnapshot] = useState('')
  const [transportType, setTransportType] = useState('')
  const [vehicleNumber, setVehicleNumber] = useState('')
  const [eWayBillNumber, setEWayBillNumber] = useState('')
  const [lines, setLines] = useState<Line[]>([blankLine()])
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    Promise.all([
      apiFetch<{ data: Material[] }>('/inventory/items?limit=100&status=active'),
      apiFetch<{ data: Supplier[] }>('/laser-cut-management/vendors?status=active'),
      apiFetch<{ data: Client[] }>('/clients?limit=100'),
      apiFetch<{ data: Order[] }>('/laser-cut-management/orders'),
    ])
      .then(([materialResponse, vendorResponse, clientResponse, orderResponse]) => {
        setMaterials(materialResponse.data)
        setVendors(vendorResponse.data)
        setClients(clientResponse.data)
        setOrders(orderResponse.data.filter((order) => order.status !== 'COMPLETE'))
      })
      .catch((reason) => setError(reason instanceof Error ? reason.message : 'Unable to load laser-cut challan form'))
      .finally(() => setLoading(false))
  }, [])

  const materialFor = (id: string) => materials.find((material) => material._id === id)
  const setLine = (index: number, next: Partial<Line>) =>
    setLines((current) => current.map((line, lineIndex) => (lineIndex === index ? { ...line, ...next } : line)))
  const selectMaterial = (index: number, id: string) => {
    const material = materialFor(id)
    setLine(index, { inventoryItemRef: id, hsnCode: material?.hsnCode || '0000' })
  }
  const selectMaterialType = (index: number, materialType: Line['materialType']) =>
    setLine(index, { materialType, inventoryItemRef: '', hsnCode: '', cutOutputs: [] })
  const setCutOutput = (lineIndex: number, outputIndex: number, next: Partial<CutOutput>) =>
    setLine(lineIndex, { cutOutputs: lines[lineIndex].cutOutputs.map((output, index) => index === outputIndex ? { ...output, ...next } : output) })
  const requestedQuantity = (materialId: string, changedIndex?: number, changedQuantity?: string) =>
    lines.reduce((total, line, index) => total + (line.inventoryItemRef === materialId ? number(index === changedIndex ? changedQuantity || '' : line.quantity) : 0), 0)
  const totalSheetSqFt = lines.reduce((total, line) => total + (sheetSqFt(materialFor(line.inventoryItemRef), line.quantity) || 0), 0)
  const updateQuantity = (index: number, quantity: string) => {
    const material = materialFor(lines[index].inventoryItemRef)
    if (material && requestedQuantity(material._id, index, quantity) > material.quantityInStock) toast.error(`${material.name}: only ${material.quantityInStock} ${material.unit} available`)
    setLine(index, { quantity })
  }
  const parentId = (client: Client) => (typeof client.parentClient === 'string' ? client.parentClient : client.parentClient?._id)
  const parentClients = clients.filter((client) => !parentId(client))
  const clientSites = clients.filter((client) => parentId(client) === clientRef)
  const selectedSite = clientSites.find((client) => client._id === clientSiteRef)
  const pickupLocations = [...new Set(lines.map((line) => {
    const supplier = materialFor(line.inventoryItemRef)?.supplier
    return supplier?.address ? `${supplier.name} · ${supplier.address}` : ''
  }).filter(Boolean))]
  const pickupLocation = pickupLocations.length === 1 ? pickupLocations[0] : pickupLocations.length > 1 ? `${pickupLocations.length} pickup locations selected` : ''
  const selectClient = (id: string) => {
    setClientRef(id)
    setClientSiteRef('')
  }
  const selectVendor = (id: string) => {
    const vendor = vendors.find((entry) => entry._id === id)
    setVendorRef(id)
    setVendorAddressSnapshot(vendor?.address || '')
  }
  const submit = async (event: FormEvent) => {
    event.preventDefault()
    if (!vendorAddressSnapshot.trim()) {
      toast.error('Select a Laser-cut vendor with an address for the drop location')
      return
    }
    const unavailable = materials.find((material) => requestedQuantity(material._id) > material.quantityInStock)
    if (unavailable) {
      toast.error(`${unavailable.name}: only ${unavailable.quantityInStock} ${unavailable.unit} available`)
      return
    }
    setSaving(true)
    setError('')
    try {
      const selectedOrder =
        orderRef === 'new'
          ? await apiFetch<{ data: { _id: string } }>('/laser-cut-management/orders', {
              method: 'POST',
              body: JSON.stringify({ customerRef: clientRef, expected: { sheets: number(expectedSheets), tubes: number(expectedTubes) } }),
            })
          : { data: { _id: orderRef } }
      const created = await apiFetch<{ data: { _id: string } }>('/laser-cut-management/challans', {
        method: 'POST',
        body: JSON.stringify({
          type: 'OUT',
          challanDate,
          clientRef,
          clientSiteRef: clientSiteRef || undefined,
          vendorRef,
          transportType,
          vehicleNumber,
          eWayBillNumber,
          orderRef: selectedOrder.data._id,
          items: lines.map(({ cutOutputs, ...line }) => ({
            ...line,
            quantity: number(line.quantity),
            cutOutputs: cutOutputs.filter((output) => number(output.quantity) > 0).map((output) => ({ quantity: number(output.quantity), dimensions: output.dimensions })),
          })),
        }),
      })
      await apiFetch(`/laser-cut-management/challans/${created.data._id}/dispatch`, { method: 'POST' })
      navigate('/laser-cut-management')
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : 'Unable to send material to laser cut')
    } finally {
      setSaving(false)
    }
  }

  return (
    <>
      <PageMetaData title="Send to Laser Cut" />
      <Card>
        <CardBody>
          <div className="d-flex justify-content-between align-items-start mb-4">
            <div>
              <h4 className="card-title mb-1">Send inventory to laser cut</h4>
              <p className="text-muted mb-0">Dispatch inventory products to a vendor. Stock moves only after this form is submitted.</p>
            </div>
            <div className="d-flex gap-2"><Link className="btn btn-outline-primary" to="/laser-cut-management/vendors">Manage vendors</Link><Link to="/laser-cut-management"><Button variant="outline-secondary">Cancel</Button></Link></div>
          </div>
          {error && <Alert variant="danger">{error}</Alert>}
          <Form onSubmit={submit}>
            <Row className="g-3">
              <Col md={4}>
                <Form.Label>Generated challan number</Form.Label>
                <Form.Control readOnly value="Generated when dispatched" />
              </Col>
              <Col md={4}>
                <Form.Label>Challan date</Form.Label>
                <Form.Control required type="date" value={challanDate} onChange={(event) => setChallanDate(event.target.value)} />
              </Col>
              <Col md={4}>
                <Form.Label>Parent client</Form.Label>
                <Form.Select required value={clientRef} onChange={(event) => selectClient(event.target.value)}>
                  <option value="">Select parent client</option>
                  {parentClients.map((client) => (
                    <option key={client._id} value={client._id}>
                      {client.name}
                    </option>
                  ))}
                </Form.Select>
              </Col>
              <Col md={4}>
                <Form.Label>Child client site</Form.Label>
                <Form.Select value={clientSiteRef} disabled={!clientRef || !clientSites.length} onChange={(event) => setClientSiteRef(event.target.value)}>
                  <option value="">{clientRef ? 'Select child client site' : 'Select parent client first'}</option>
                  {clientSites.map((client) => (
                    <option key={client._id} value={client._id}>
                      {client.siteName || client.name}{client.siteAddress ? ` · ${client.siteAddress}` : ''}
                    </option>
                  ))}
                </Form.Select>
              </Col>
              <Col md={8}>
                <Form.Label>Child client address</Form.Label>
                <Form.Control readOnly value={selectedSite?.siteAddress || selectedSite?.shippingAddress || selectedSite?.billingAddress || ''} />
              </Col>
              <Col md={4}>
                <Form.Label>Pickup location</Form.Label>
                <Form.Control readOnly value={pickupLocation} placeholder="Select a product below" />
              </Col>
              <Col md={4}>
                <Form.Label>Laser-cut vendor</Form.Label>
                <Form.Select required value={vendorRef} onChange={(event) => selectVendor(event.target.value)}>
                  <option value="">Select vendor</option>
                  {vendors.map((vendor) => (
                    <option key={vendor._id} value={vendor._id}>
                      {vendor.name}
                    </option>
                  ))}
                </Form.Select>
              </Col>
              <Col md={4}>
                <Form.Label>Drop location</Form.Label>
                <Form.Control
                  readOnly
                  value={vendorAddressSnapshot}
                />
              </Col>
              <Col md={4}>
                <Form.Label>Transport type</Form.Label>
                <Form.Control value={transportType} onChange={(event) => setTransportType(event.target.value)} />
              </Col>
              <Col md={4}>
                <Form.Label>Vehicle number</Form.Label>
                <Form.Control value={vehicleNumber} onChange={(event) => setVehicleNumber(event.target.value)} />
              </Col>
              <Col md={4}>
                <Form.Label>E-way bill number</Form.Label>
                <Form.Control value={eWayBillNumber} onChange={(event) => setEWayBillNumber(event.target.value)} />
              </Col>
              <Col md={6}>
                <Form.Label>Order</Form.Label>
                <Form.Select required value={orderRef} onChange={(event) => setOrderRef(event.target.value)}>
                  <option value="new">Create a new order with this challan</option>
                  {orders.map((order) => (
                    <option key={order._id} value={order._id}>
                      {order.orderName}
                    </option>
                  ))}
                </Form.Select>
              </Col>
              {orderRef === 'new' && <>
                  <Col md={3}>
                    <Form.Label>Expected sheets</Form.Label>
                    <Form.Control
                      required
                      type="number"
                      min="0"
                      step="0.01"
                      value={expectedSheets}
                      onChange={(event) => setExpectedSheets(event.target.value)}
                    />
                  </Col>
                  <Col md={3}>
                    <Form.Label>Expected tubes</Form.Label>
                    <Form.Control
                      required
                      type="number"
                      min="0"
                      step="0.01"
                      value={expectedTubes}
                      onChange={(event) => setExpectedTubes(event.target.value)}
                    />
                  </Col>
              </>}
            </Row>
            <div className="d-flex justify-content-between align-items-center mt-4 mb-2">
              <div><h5 className="mb-0">Product details</h5><small className="text-muted">Select products to set the pickup location above.</small></div>
              <Button type="button" size="sm" variant="outline-primary" onClick={() => setLines((current) => [...current, blankLine()])}>
                Add product
              </Button>
            </div>
            <Table responsive className="align-middle" style={{ minWidth: 1500 }}>
              <thead>
                <tr>
                  <th>Material type</th>
                  <th>Product</th>
                  <th>Available</th>
                  <th>HSN</th>
                  <th>Quantity</th>
                  <th>Source size (ft)</th>
                  <th>Smaller cut outputs</th>
                  <th>Total sq ft</th>
                  <th>Unit</th>
                  <th />
                </tr>
              </thead>
              <tbody>
                {lines.map((line, index) => {
                  const material = materialFor(line.inventoryItemRef)
                  return (
                    <tr key={index}>
                      <td>
                        <Form.Select value={line.materialType} onChange={(event) => selectMaterialType(index, event.target.value as Line['materialType'])}>
                          <option value="SHEET">Sheet</option>
                          <option value="TUBE">Tube</option>
                        </Form.Select>
                      </td>
                      <td>
                        <Form.Select required value={line.inventoryItemRef} onChange={(event) => selectMaterial(index, event.target.value)}>
                          <option value="">Select product</option>
                          {materials.filter((item) => item.materialType === line.materialType).map((item) => (
                            <option key={item._id} value={item._id}>
                              {item.name} ({item.sku})
                            </option>
                          ))}
                        </Form.Select>
                      </td>
                      <td>{material ? `${material.quantityInStock}` : '—'}</td>
                      <td>
                        <Form.Control readOnly value={line.hsnCode} />
                      </td>
                      <td>
                        <Form.Control
                          required
                          type="number"
                          min="0.01"
                          step="0.01"
                          value={line.quantity}
                          onChange={(event) => updateQuantity(index, event.target.value)}
                        />
                      </td>
                      <td>{materialSize(material)}</td>
                      <td style={{ minWidth: 360 }}>
                        {line.cutOutputs.map((output, outputIndex) => (
                          <div className="d-flex gap-1 mb-1" key={outputIndex}>
                            <Form.Control
                              type="number"
                              min="0.01"
                              step="0.01"
                              aria-label="Smaller cut quantity"
                              placeholder="Qty"
                              value={output.quantity}
                              onChange={(event) => setCutOutput(index, outputIndex, { quantity: event.target.value })}
                            />
                            {line.materialType === 'SHEET' ? <>
                              <Form.Control
                                required={number(output.quantity) > 0}
                                type="number"
                                min="0.01"
                                step="0.01"
                                aria-label="Smaller sheet height in feet"
                                placeholder="H"
                                value={output.dimensions.heightFt || ''}
                                onChange={(event) => setCutOutput(index, outputIndex, { dimensions: { ...output.dimensions, heightFt: number(event.target.value) || undefined } })}
                              />
                              <Form.Control
                                required={number(output.quantity) > 0}
                                type="number"
                                min="0.01"
                                step="0.01"
                                aria-label="Smaller sheet width in feet"
                                placeholder="W"
                                value={output.dimensions.widthFt || ''}
                                onChange={(event) => setCutOutput(index, outputIndex, { dimensions: { ...output.dimensions, widthFt: number(event.target.value) || undefined } })}
                              />
                            </> : <Form.Control
                              required={number(output.quantity) > 0}
                              type="number"
                              min="0.01"
                              step="0.01"
                              aria-label="Smaller tube length in feet"
                              placeholder="Length"
                              value={output.dimensions.lengthFt || ''}
                              onChange={(event) => setCutOutput(index, outputIndex, { dimensions: { lengthFt: number(event.target.value) || undefined } })}
                            />}
                          </div>
                        ))}
                      </td>
                      <td>{sqFt(sheetSqFt(material, line.quantity))}</td>
                      <td>{material?.unit || '—'}</td>
                      <td>
                        {lines.length > 1 && (
                          <Button
                            type="button"
                            size="sm"
                            variant="outline-danger"
                            onClick={() => setLines((current) => current.filter((_, lineIndex) => lineIndex !== index))}>
                            Remove
                          </Button>
                        )}
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </Table>
            <div className="text-end fw-semibold mb-3">Total sheet area: {sqFt(totalSheetSqFt)}</div>
            <Button type="submit" disabled={saving || loading}>
              {saving ? 'Sending…' : 'Dispatch to laser cut'}
            </Button>
          </Form>
          {loading && (
            <div className="text-center py-4">
              <Spinner />
            </div>
          )}
        </CardBody>
      </Card>
    </>
  )
}
