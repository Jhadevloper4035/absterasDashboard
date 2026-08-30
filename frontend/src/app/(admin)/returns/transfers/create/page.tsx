import PageMetaData from '@/components/PageTitle'
import { apiFetch } from '@/helpers/api'
import { canManageModule } from '@/helpers/moduleAccess'
import { useAuthStore } from '@/store/authStore'
import { FormEvent, useEffect, useState } from 'react'
import { Alert, Button, Card, CardBody, Col, Form, Row, Spinner } from 'react-bootstrap'
import { Link, useNavigate } from 'react-router-dom'

type Place = { _id: string; name: string; siteName?: string; siteAddress?: string }
type Client = Place & { parentClient?: string | { _id: string } }
type ReturnProduct = { _id: string; name: string; quantity: number; unit: string; storageLocation?: string; client?: Place; sourceSite?: Place }
type ManualItem = { name: string; quantity: string; unit: string }

const parentId = (client: Client) => typeof client.parentClient === 'string' ? client.parentClient : client.parentClient?._id
const siteName = (site?: Place) => site?.siteName || site?.name || '—'

export default function CreateReturnTransferPage() {
  const navigate = useNavigate()
  const user = useAuthStore((state) => state.user)
  const [products, setProducts] = useState<ReturnProduct[]>([])
  const [clients, setClients] = useState<Client[]>([])
  const [sourceClientId, setSourceClientId] = useState('')
  const [sourceSite, setSourceSite] = useState('')
  const [destinationClientId, setDestinationClientId] = useState('')
  const [destinationSite, setDestinationSite] = useState('')
  const [challanDate, setChallanDate] = useState(new Date().toISOString().slice(0, 10))
  const [transportType, setTransportType] = useState('')
  const [vehicleNumber, setVehicleNumber] = useState('')
  const [eWayBillNumber, setEWayBillNumber] = useState('')
  const [quantities, setQuantities] = useState<Record<string, string>>({})
  const [manualItems, setManualItems] = useState<ManualItem[]>([])
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  const canManage = canManageModule(user, 'returns')

  useEffect(() => {
    Promise.all([
      apiFetch<{ data: ReturnProduct[] }>('/returns/products?status=stored&limit=100'),
      apiFetch<{ data: Client[] }>('/clients?limit=100'),
    ])
      .then(([productResponse, clientResponse]) => {
        setProducts(productResponse.data)
        setClients(clientResponse.data)
      })
      .catch((reason) => setError(reason instanceof Error ? reason.message : 'Unable to load return storage'))
  }, [])

  const parentClients = clients.filter((client) => !parentId(client))
  const sourceClientSites = clients.filter((client) => parentId(client) === sourceClientId)
  const destinationClientSites = clients.filter((client) => parentId(client) === destinationClientId)
  const sourceProducts = products.filter((product) => product.sourceSite?._id === sourceSite)
  const destinationSites = destinationClientSites.filter((site) => site._id !== sourceSite)
  const storedItems = sourceProducts.flatMap((product) => quantities[product._id] ? [{ returnProduct: product._id, quantity: Number(quantities[product._id]) }] : [])
  const selectedItems = [...storedItems, ...manualItems.map((item) => ({ name: item.name.trim(), quantity: Number(item.quantity), unit: item.unit.trim() })).filter((item) => item.name && item.unit && item.quantity > 0)]

  const chooseSourceClient = (id: string) => {
    setSourceClientId(id)
    setSourceSite('')
    setQuantities({})
  }

  const chooseSourceSite = (id: string) => {
    setSourceSite(id)
    if (destinationSite === id) setDestinationSite('')
    setQuantities({})
  }

  const chooseDestinationClient = (id: string) => {
    setDestinationClientId(id)
    setDestinationSite('')
  }

  const selectProduct = (product: ReturnProduct, selected: boolean) => {
    setQuantities((current) => {
      const next = { ...current }
      if (selected) next[product._id] = String(product.quantity)
      else delete next[product._id]
      return next
    })
  }

  const setManualItem = (index: number, field: keyof ManualItem, value: string) => setManualItems((current) => current.map((item, itemIndex) => itemIndex === index ? { ...item, [field]: value } : item))

  const submit = async (event: FormEvent) => {
    event.preventDefault()
    setSaving(true)
    setError('')
    try {
      const response = await apiFetch<{ data: { _id: string } }>('/returns/transfers', {
        method: 'POST',
        body: JSON.stringify({ sourceSite, destinationSite, challanDate, transportType, vehicleNumber, eWayBillNumber, items: selectedItems }),
      })
      navigate(`/challans/${response.data._id}`)
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : 'Unable to create return transfer challan')
    } finally {
      setSaving(false)
    }
  }

  if (!canManage) return <><PageMetaData title="Create Return Transfer" /><Alert variant="warning">You have view access to Return Management. Ask an admin for Manage access to create a transfer challan.</Alert></>

  return (
    <>
      <PageMetaData title="Create Return Transfer" />
      <div className="d-flex justify-content-between align-items-start flex-wrap gap-2 mb-3">
        <div><h4 className="mb-1">Create return transfer challan</h4><p className="text-muted mb-0">Select materials from return storage. Quantities are deducted only after this challan is created.</p></div>
        <Link className="btn btn-outline-secondary" to="/returns">Back to returns</Link>
      </div>

      {error && <Alert variant="danger">{error}</Alert>}

      <Card>
        <CardBody>
          <Form onSubmit={submit}>
            <div className="d-flex flex-wrap gap-2 mb-4" role="tablist" aria-label="Challan type">
              <Link className="btn btn-outline-primary" role="tab" to="/challans/create">Inventory challan</Link>
              <Button type="button" variant="primary" role="tab" aria-selected>Return challan</Button>
            </div>
            <Row className="g-3 mb-4">
              <Col md={3}>
                <Form.Label>Source client</Form.Label>
                <Form.Select required value={sourceClientId} onChange={(event) => chooseSourceClient(event.target.value)}>
                  <option value="">Select source client</option>
                  {parentClients.map((client) => <option key={client._id} value={client._id}>{client.name}</option>)}
                </Form.Select>
              </Col>
              <Col md={3}>
                <Form.Label>Source site</Form.Label>
                <Form.Select required value={sourceSite} disabled={!sourceClientId} onChange={(event) => chooseSourceSite(event.target.value)}>
                  <option value="">Select source site</option>
                  {sourceClientSites.map((site) => <option key={site._id} value={site._id}>{siteName(site)} · {site.siteAddress}</option>)}
                </Form.Select>
                {sourceClientId && !sourceClientSites.length && <Form.Text><Link to="/clients">Add a site in Client Management</Link></Form.Text>}
                <Form.Text className="d-block"><Link to="/returns?view=storage">View return products</Link></Form.Text>
              </Col>
              <Col md={3}>
                <Form.Label>Destination client</Form.Label>
                <Form.Select required value={destinationClientId} onChange={(event) => chooseDestinationClient(event.target.value)}>
                  <option value="">Select destination client</option>
                  {parentClients.map((client) => <option key={client._id} value={client._id}>{client.name}</option>)}
                </Form.Select>
              </Col>
              <Col md={3}>
                <Form.Label>Destination site</Form.Label>
                <Form.Select required value={destinationSite} disabled={!destinationClientId} onChange={(event) => setDestinationSite(event.target.value)}>
                  <option value="">Select destination site</option>
                  {destinationSites.map((site) => <option key={site._id} value={site._id}>{siteName(site)} · {site.siteAddress}</option>)}
                </Form.Select>
                {destinationClientId && !destinationClientSites.length && <Form.Text><Link to="/clients">Add a site in Client Management</Link></Form.Text>}
                <Form.Text className="d-block"><Link to="/returns?view=storage">View return products</Link></Form.Text>
              </Col>
              <Col md={4}>
                <Form.Label>Challan date</Form.Label>
                <Form.Control required type="date" value={challanDate} onChange={(event) => setChallanDate(event.target.value)} />
              </Col>
              <Col md={6}>
                <Form.Label>Transport type <span className="text-muted">(optional)</span></Form.Label>
                <Form.Control value={transportType} onChange={(event) => setTransportType(event.target.value)} placeholder="For example: Company vehicle" />
              </Col>
              <Col md={6}>
                <Form.Label>Vehicle number <span className="text-muted">(optional)</span></Form.Label>
                <Form.Control value={vehicleNumber} onChange={(event) => setVehicleNumber(event.target.value)} />
              </Col>
              <Col md={6}>
                <Form.Label>E-way bill number <span className="text-muted">(optional)</span></Form.Label>
                <Form.Control value={eWayBillNumber} onChange={(event) => setEWayBillNumber(event.target.value)} />
              </Col>
            </Row>

            <section className="border-top pt-4">
              <h5 className="mb-1">Products for this return challan</h5>
              <p className="text-muted mb-3">Stored products are deducted after the challan is created. Custom products are included only on this challan.</p>
              {!sourceSite && <Alert variant="light" className="border">Select a source site to see its stored materials.</Alert>}
              {sourceSite && !sourceProducts.length && <Alert variant="light" className="border">This site has no materials in return storage.</Alert>}
              {sourceProducts.map((product) => (
                <div className="border rounded p-3 mb-3" key={product._id}>
                  <Row className="align-items-center g-3">
                    <Col md={5}>
                      <Form.Check id={`product-${product._id}`} checked={Boolean(quantities[product._id])} onChange={(event) => selectProduct(product, event.target.checked)} label={<><span className="fw-semibold">{product.name}</span><span className="d-block text-muted small">{product.storageLocation || 'Return storage'}</span></>} />
                    </Col>
                    <Col xs={6} md={3}><span className="text-muted small d-block">Available</span><strong>{product.quantity} {product.unit}</strong></Col>
                    <Col xs={6} md={4}>
                      <Form.Label className="small">Send quantity</Form.Label>
                      <Form.Control required={Boolean(quantities[product._id])} disabled={!quantities[product._id]} type="number" min="0.01" max={product.quantity} step="any" value={quantities[product._id] || ''} onChange={(event) => setQuantities((current) => ({ ...current, [product._id]: event.target.value }))} />
                    </Col>
                  </Row>
                </div>
              ))}
              <div className="d-flex justify-content-between align-items-center mt-4 mb-2">
                <h6 className="mb-0">Custom products</h6>
                <Button type="button" size="sm" variant="outline-primary" onClick={() => setManualItems((current) => [...current, { name: '', quantity: '1', unit: 'pcs' }])}>Add custom product</Button>
              </div>
              {manualItems.map((item, index) => (
                <Row className="g-3 border rounded p-3 mx-0 mb-3" key={index}>
                  <Col md={5}><Form.Label>Product name</Form.Label><Form.Control required value={item.name} onChange={(event) => setManualItem(index, 'name', event.target.value)} /></Col>
                  <Col md={3}><Form.Label>Quantity</Form.Label><Form.Control required type="number" min="0.01" step="any" value={item.quantity} onChange={(event) => setManualItem(index, 'quantity', event.target.value)} /></Col>
                  <Col md={3}><Form.Label>Unit</Form.Label><Form.Control required value={item.unit} onChange={(event) => setManualItem(index, 'unit', event.target.value)} placeholder="pcs" /></Col>
                  <Col md={1} className="d-flex align-items-end"><Button type="button" variant="outline-danger" onClick={() => setManualItems((current) => current.filter((_, itemIndex) => itemIndex !== index))}>×</Button></Col>
                </Row>
              ))}
            </section>

            <div className="d-flex flex-wrap gap-2 mt-4">
              <Button type="submit" disabled={saving || !selectedItems.length}>{saving && <Spinner size="sm" className="me-2" />}{saving ? 'Creating challan…' : storedItems.length ? 'Create challan and deduct stored products' : 'Create challan'}</Button>
              <Link className="btn btn-outline-secondary" to="/returns">Cancel</Link>
            </div>
          </Form>
        </CardBody>
      </Card>
    </>
  )
}
