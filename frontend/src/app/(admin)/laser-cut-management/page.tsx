import PageMetaData from '@/components/PageTitle'
import { apiFetch } from '@/helpers/api'
import { FormEvent, useEffect, useState } from 'react'
import { Alert, Badge, Button, Card, CardBody, Col, Form, Row, Spinner, Table } from 'react-bootstrap'
import { Link } from 'react-router-dom'

type MaterialType = 'SHEET' | 'TUBE' | 'OTHER'
type Dimensions = { heightFt?: number; widthFt?: number; lengthFt?: number }
type Material = {
  _id: string
  name: string
  sku: string
  quantityInStock: number
  materialType: MaterialType | 'OTHER'
  defaultDimensions?: Dimensions
}
type Supplier = { _id: string; name: string }
type Client = { _id: string; name: string; parentClient?: string }
type Order = {
  _id: string
  orderName: string
  expected: { sheets: number }
  sent: { sheets: number }
  remainingSheets: number
  status: 'PENDING' | 'PARTIAL' | 'COMPLETE'
}
type Stock = { _id: string; vendorName: string; materialType: MaterialType; dimensions: Dimensions; quantityAvailable: number }
type Challan = {
  _id: string
  challanNo: string
  type: 'OUT' | 'IN'
  vendorName: string
  status: 'DRAFT' | 'DISPATCHED' | 'RECEIVED'
  items: { itemName: string; quantity: number }[]
  orderRef?: string
}
type Line = { inventoryItemRef: string; quantity: string }
const blankLine = (): Line => ({ inventoryItemRef: '', quantity: '1' })
const number = (value: string) => Number(value || 0)
const spec = (type: MaterialType, dimensions: Dimensions = {}) =>
  type === 'SHEET' ? `${dimensions.heightFt || '—'}ft × ${dimensions.widthFt || '—'}ft` : type === 'TUBE' ? `${dimensions.lengthFt || '—'}ft` : '—'

export default function LaserCutManagementPage() {
  const [orders, setOrders] = useState<Order[]>([])
  const [stock, setStock] = useState<Stock[]>([])
  const [challans, setChallans] = useState<Challan[]>([])
  const [materials, setMaterials] = useState<Material[]>([])
  const [vendors, setVendors] = useState<Supplier[]>([])
  const [clients, setClients] = useState<Client[]>([])
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [challanType, setChallanType] = useState<'OUT' | 'IN'>('OUT')
  const [vendorRef, setVendorRef] = useState('')
  const [clientRef, setClientRef] = useState('')
  const [orderRef, setOrderRef] = useState('')
  const [lines, setLines] = useState<Line[]>([blankLine()])
  const [usage, setUsage] = useState({
    vendorRef: '',
    orderRef: '',
    materialType: 'SHEET' as MaterialType,
    quantityConsumed: '',
    panelsProduced: '',
    dimensions: {} as Dimensions,
  })

  const load = async () => {
    setLoading(true)
    try {
      const [summary, materialResponse, vendorResponse, clientResponse] = await Promise.all([
        apiFetch<{ data: { orders: Order[]; stock: Stock[]; challans: Challan[] } }>('/laser-cut-management/summary'),
        apiFetch<{ data: Material[] }>('/inventory/items?limit=100&status=active'),
        apiFetch<{ data: Supplier[] }>('/laser-cut-management/vendors?status=active'),
        apiFetch<{ data: Client[] }>('/clients?limit=100'),
      ])
      setOrders(summary.data.orders)
      setStock(summary.data.stock)
      setChallans(summary.data.challans)
      setMaterials(materialResponse.data)
      setVendors(vendorResponse.data)
      setClients(clientResponse.data.filter((client) => !client.parentClient))
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : 'Unable to load laser-cut management')
    } finally {
      setLoading(false)
    }
  }
  useEffect(() => {
    load()
  }, [])

  const submit = async (action: () => Promise<unknown>) => {
    setSaving(true)
    setError('')
    try {
      await action()
      await load()
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : 'Unable to save')
    } finally {
      setSaving(false)
    }
  }
  const setLine = (index: number, next: Partial<Line>) =>
    setLines((current) => current.map((line, lineIndex) => (lineIndex === index ? { ...line, ...next } : line)))
  const chooseMaterial = (index: number, id: string) => setLine(index, { inventoryItemRef: id })
  const createChallan = (event: FormEvent) => {
    event.preventDefault()
    submit(async () => {
      await apiFetch('/laser-cut-management/challans', {
        method: 'POST',
        body: JSON.stringify({
          type: challanType,
          vendorRef,
          clientRef: challanType === 'OUT' ? clientRef : undefined,
          orderRef: orderRef || undefined,
          items: lines.map((line) => ({ ...line, quantity: number(line.quantity) })),
        }),
      })
      setVendorRef('')
      setClientRef('')
      setOrderRef('')
      setLines([blankLine()])
    })
  }
  const submitUsage = (event: FormEvent) => {
    event.preventDefault()
    submit(async () => {
      await apiFetch('/laser-cut-management/usage-entries', {
        method: 'POST',
        body: JSON.stringify({ ...usage, quantityConsumed: number(usage.quantityConsumed), panelsProduced: number(usage.panelsProduced) }),
      })
      setUsage({ vendorRef: '', orderRef: '', materialType: 'SHEET', quantityConsumed: '', panelsProduced: '', dimensions: {} })
    })
  }
  const apply = (challan: Challan) =>
    submit(() => apiFetch(`/laser-cut-management/challans/${challan._id}/${challan.type === 'OUT' ? 'dispatch' : 'receive'}`, { method: 'POST' }))
  const remainingClass = (value: number) => (value > 0 ? 'text-danger fw-semibold' : 'text-success fw-semibold')

  return (
    <>
      <PageMetaData title="Laser Cut Management" />
      <div className="d-flex justify-content-between align-items-start flex-wrap gap-2 mb-3">
        <div>
          <h4 className="mb-1">Laser Cut Management</h4>
          <p className="text-muted mb-0">Track vendor-held sheet and tube stock without mixing it into central inventory.</p>
        </div>
        <div className="d-flex gap-2"><Link className="btn btn-outline-primary" to="/laser-cut-management/vendors">Manage vendors</Link><Button variant="outline-secondary" onClick={load} disabled={loading}>Refresh</Button></div>
      </div>
      {error && <Alert variant="danger">{error}</Alert>}
      <Row className="g-3 mb-3">
        <Col lg={12}>
          <Card>
            <CardBody>
              <h5 className="mb-3">New laser-cut challan</h5>
              <Form onSubmit={createChallan}>
                <Row className="g-2">
                  <Col md={3}>
                    <Form.Label>Type</Form.Label>
                    <Form.Select value={challanType} onChange={(event) => setChallanType(event.target.value as 'OUT' | 'IN')}>
                      <option value="OUT">Outward</option>
                      <option value="IN">Inward return</option>
                    </Form.Select>
                  </Col>
                  {challanType === 'OUT' && (
                    <Col md={4}>
                      <Form.Label>Parent client</Form.Label>
                      <Form.Select required value={clientRef} onChange={(event) => setClientRef(event.target.value)}>
                        <option value="">Select parent client</option>
                        {clients.map((client) => (
                          <option key={client._id} value={client._id}>
                            {client.name}
                          </option>
                        ))}
                      </Form.Select>
                    </Col>
                  )}
                  <Col md={challanType === 'OUT' ? 4 : 6}>
                    <Form.Label>Vendor</Form.Label>
                    <Form.Select required value={vendorRef} onChange={(event) => setVendorRef(event.target.value)}>
                      <option value="">Select vendor</option>
                      {vendors.map((vendor) => (
                        <option key={vendor._id} value={vendor._id}>
                          {vendor.name}
                        </option>
                      ))}
                    </Form.Select>
                  </Col>
                  <Col md={challanType === 'OUT' ? 4 : 6}>
                    <Form.Label>
                      Order <small className="text-muted">(optional)</small>
                    </Form.Label>
                    <Form.Select value={orderRef} onChange={(event) => setOrderRef(event.target.value)}>
                      <option value="">No linked order</option>
                      {orders.map((order) => (
                        <option key={order._id} value={order._id}>
                          {order.orderName}
                        </option>
                      ))}
                    </Form.Select>
                  </Col>
                </Row>
                <div className="mt-3 table-responsive">
                  <Table size="sm" className="align-middle mb-0">
                    <thead>
                      <tr>
                        <th>Product</th>
                        <th>Qty</th>
                        <th />
                      </tr>
                    </thead>
                    <tbody>
                      {lines.map((line, index) => (
                          <tr key={index}>
                            <td>
                              <Form.Select required value={line.inventoryItemRef} onChange={(event) => chooseMaterial(index, event.target.value)}>
                                <option value="">Select product</option>
                                {materials.map((item) => (
                                  <option key={item._id} value={item._id}>
                                    {item.name} · {item.quantityInStock} in stock
                                  </option>
                                ))}
                              </Form.Select>
                            </td>
                            <td>
                              <Form.Control
                                required
                                type="number"
                                min="0.01"
                                step="0.01"
                                value={line.quantity}
                                onChange={(event) => setLine(index, { quantity: event.target.value })}
                              />
                            </td>
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
                      ))}
                    </tbody>
                  </Table>
                </div>
                <div className="d-flex gap-2 mt-3">
                  <Button type="button" variant="outline-primary" onClick={() => setLines((current) => [...current, blankLine()])}>
                    Add product
                  </Button>
                  <Button type="submit" disabled={saving}>
                    Save draft
                  </Button>
                </div>
              </Form>
            </CardBody>
          </Card>
        </Col>
      </Row>
      <Card className="mb-3">
        <CardBody>
          <h5 className="mb-3">Orders</h5>
          <div className="table-responsive">
            <Table hover className="align-middle mb-0">
              <thead>
                <tr>
                  <th>Order</th>
                  <th>Expected sheets</th>
                  <th>Sent sheets</th>
                  <th>Remaining sheets</th>
                  <th>Status</th>
                </tr>
              </thead>
              <tbody>
                {orders.map((order) => (
                  <tr key={order._id}>
                    <td>{order.orderName}</td>
                    <td>{order.expected.sheets}</td>
                    <td>{order.sent.sheets}</td>
                    <td className={remainingClass(order.remainingSheets)}>{order.remainingSheets}</td>
                    <td>
                      <Badge bg={order.status === 'COMPLETE' ? 'success' : order.status === 'PARTIAL' ? 'danger' : 'secondary'}>{order.status}</Badge>
                    </td>
                  </tr>
                ))}
                {!orders.length && (
                  <tr>
                    <td colSpan={5} className="text-center text-muted py-3">
                      No laser-cut orders yet.
                    </td>
                  </tr>
                )}
              </tbody>
            </Table>
          </div>
        </CardBody>
      </Card>
      <Row className="g-3">
        <Col lg={6}>
          <Card>
            <CardBody>
              <h5 className="mb-3">Vendor stock pool</h5>
              <div className="table-responsive">
                <Table hover className="align-middle mb-0">
                  <thead>
                    <tr>
                      <th>Vendor</th>
                      <th>Material</th>
                      <th>Spec</th>
                      <th>Available</th>
                    </tr>
                  </thead>
                  <tbody>
                    {stock.map((item) => (
                      <tr key={item._id}>
                        <td>{item.vendorName}</td>
                        <td>{item.materialType}</td>
                        <td>{spec(item.materialType, item.dimensions)}</td>
                        <td>{item.quantityAvailable}</td>
                      </tr>
                    ))}
                    {!stock.length && (
                      <tr>
                        <td colSpan={4} className="text-center text-muted py-3">
                          No vendor-held material.
                        </td>
                      </tr>
                    )}
                  </tbody>
                </Table>
              </div>
            </CardBody>
          </Card>
        </Col>
        <Col lg={6}>
          <Card>
            <CardBody>
              <h5 className="mb-3">Record vendor usage</h5>
              <Form onSubmit={submitUsage}>
                <Row className="g-2">
                  <Col md={6}>
                    <Form.Label>Vendor</Form.Label>
                    <Form.Select required value={usage.vendorRef} onChange={(event) => setUsage({ ...usage, vendorRef: event.target.value })}>
                      <option value="">Select vendor</option>
                      {vendors.map((vendor) => (
                        <option key={vendor._id} value={vendor._id}>
                          {vendor.name}
                        </option>
                      ))}
                    </Form.Select>
                  </Col>
                  <Col md={6}>
                    <Form.Label>Order</Form.Label>
                    <Form.Select required value={usage.orderRef} onChange={(event) => setUsage({ ...usage, orderRef: event.target.value })}>
                      <option value="">Select order</option>
                      {orders.map((order) => (
                        <option key={order._id} value={order._id}>
                          {order.orderName}
                        </option>
                      ))}
                    </Form.Select>
                  </Col>
                  <Col md={4}>
                    <Form.Label>Material</Form.Label>
                    <Form.Select
                      value={usage.materialType}
                      onChange={(event) => setUsage({ ...usage, materialType: event.target.value as MaterialType, dimensions: {} })}>
                      <option value="SHEET">Sheet</option>
                      <option value="TUBE">Tube</option>
                    </Form.Select>
                  </Col>
                  <Col md={4}>
                    <Form.Label>Consumed</Form.Label>
                    <Form.Control
                      required
                      type="number"
                      min="0.01"
                      step="0.01"
                      value={usage.quantityConsumed}
                      onChange={(event) => setUsage({ ...usage, quantityConsumed: event.target.value })}
                    />
                  </Col>
                  <Col md={4}>
                    <Form.Label>Panels made</Form.Label>
                    <Form.Control
                      type="number"
                      min="0"
                      step="1"
                      value={usage.panelsProduced}
                      onChange={(event) => setUsage({ ...usage, panelsProduced: event.target.value })}
                    />
                  </Col>
                  {usage.materialType === 'SHEET' ? (
                    <>
                      <Col md={6}>
                        <Form.Label>Height (ft)</Form.Label>
                        <Form.Control
                          required
                          type="number"
                          min="0.01"
                          step="0.01"
                          value={usage.dimensions.heightFt || ''}
                          onChange={(event) => setUsage({ ...usage, dimensions: { ...usage.dimensions, heightFt: number(event.target.value) } })}
                        />
                      </Col>
                      <Col md={6}>
                        <Form.Label>Width (ft)</Form.Label>
                        <Form.Control
                          required
                          type="number"
                          min="0.01"
                          step="0.01"
                          value={usage.dimensions.widthFt || ''}
                          onChange={(event) => setUsage({ ...usage, dimensions: { ...usage.dimensions, widthFt: number(event.target.value) } })}
                        />
                      </Col>
                    </>
                  ) : (
                    <Col md={6}>
                      <Form.Label>Length (ft)</Form.Label>
                      <Form.Control
                        required
                        type="number"
                        min="0.01"
                        step="0.01"
                        value={usage.dimensions.lengthFt || ''}
                        onChange={(event) => setUsage({ ...usage, dimensions: { ...usage.dimensions, lengthFt: number(event.target.value) } })}
                      />
                    </Col>
                  )}
                </Row>
                <Button className="mt-3" type="submit" disabled={saving}>
                  Record usage
                </Button>
              </Form>
            </CardBody>
          </Card>
        </Col>
      </Row>
      <Card className="mt-3">
        <CardBody>
          <h5 className="mb-3">Challan register</h5>
          <div className="table-responsive">
            <Table hover className="align-middle mb-0">
              <thead>
                <tr>
                  <th>No.</th>
                  <th>Type</th>
                  <th>Vendor</th>
                  <th>Materials</th>
                  <th>Status</th>
                  <th />
                </tr>
              </thead>
              <tbody>
                {challans.map((challan) => (
                  <tr key={challan._id}>
                    <td>{challan.challanNo}</td>
                    <td>{challan.type === 'OUT' ? 'Outward' : 'Inward'}</td>
                    <td>{challan.vendorName}</td>
                    <td>{challan.items.map((item) => `${item.itemName} (${item.quantity})`).join(', ')}</td>
                    <td>
                      <Badge bg={challan.status === 'DRAFT' ? 'secondary' : 'success'}>{challan.status}</Badge>
                    </td>
                    <td>
                      {challan.status === 'DRAFT' && (
                        <Button size="sm" onClick={() => apply(challan)} disabled={saving}>
                          {challan.type === 'OUT' ? 'Dispatch' : 'Receive'}
                        </Button>
                      )}
                    </td>
                  </tr>
                ))}
                {!challans.length && (
                  <tr>
                    <td colSpan={6} className="text-center text-muted py-3">
                      No laser-cut challans yet.
                    </td>
                  </tr>
                )}
              </tbody>
            </Table>
          </div>
        </CardBody>
      </Card>
      {loading && (
        <div className="text-center py-4">
          <Spinner />
        </div>
      )}
    </>
  )
}
