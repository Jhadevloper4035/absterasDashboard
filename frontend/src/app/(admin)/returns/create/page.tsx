import PageMetaData from '@/components/PageTitle'
import IconifyIcon from '@/components/wrappers/IconifyIcon'
import { apiFetch } from '@/helpers/api'
import { canManageModule } from '@/helpers/moduleAccess'
import { useAuthStore } from '@/store/authStore'
import { FormEvent, useEffect, useMemo, useState } from 'react'
import { Alert, Badge, Button, Card, CardBody, Col, Form, Row, Spinner } from 'react-bootstrap'
import { Link, useNavigate } from 'react-router-dom'

type Client = { _id: string; name: string; siteName?: string; siteAddress?: string; parentClient?: string | { _id: string } }
type Item = { name: string; description: string; quantity: string; unit: string }

const units = ['pcs', 'nos', 'sheet', 'meter', 'kg', 'box', 'set', 'roll', 'bundle']
const blankItem = (): Item => ({ name: '', description: '', quantity: '1', unit: 'pcs' })
const parentId = (client: Client) => typeof client.parentClient === 'string' ? client.parentClient : client.parentClient?._id
const siteLabel = (site: Client) => site.siteName || site.name

export default function CreateReturnPage() {
  const navigate = useNavigate()
  const user = useAuthStore((state) => state.user)
  const [clients, setClients] = useState<Client[]>([])
  const [client, setClient] = useState('')
  const [sourceSite, setSourceSite] = useState('')
  const [pickupDate, setPickupDate] = useState(new Date().toISOString().slice(0, 10))
  const [storageLocation, setStorageLocation] = useState('')
  const [notes, setNotes] = useState('')
  const [items, setItems] = useState<Item[]>([blankItem()])
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  const canManage = canManageModule(user, 'returns')

  useEffect(() => {
    apiFetch<{ data: Client[] }>('/clients?limit=100')
      .then((response) => setClients(response.data))
      .catch((reason) => setError(reason instanceof Error ? reason.message : 'Unable to load clients'))
      .finally(() => setLoading(false))
  }, [])

  const parentClients = useMemo(() => clients.filter((entry) => !entry.parentClient), [clients])
  const sites = useMemo(() => clients.filter((entry) => parentId(entry) === client), [clients, client])
  const selectedSite = sites.find((site) => site._id === sourceSite)
  const completeItems = items.filter((item) => item.name.trim() && Number(item.quantity) > 0)

  const chooseClient = (id: string) => {
    setClient(id)
    setSourceSite('')
  }

  const setItem = (index: number, field: keyof Item, value: string) => {
    setItems((current) => current.map((item, itemIndex) => itemIndex === index ? { ...item, [field]: value } : item))
  }

  const removeItem = (index: number) => setItems((current) => current.filter((_, itemIndex) => itemIndex !== index))

  const submit = async (event: FormEvent) => {
    event.preventDefault()
    if (!completeItems.length) {
      setError('Add at least one material with a quantity.')
      return
    }

    setSaving(true)
    setError('')
    try {
      const response = await apiFetch<{ data: { returnNumber: string } }>('/returns', {
        method: 'POST',
        body: JSON.stringify({ client, sourceSite, pickupDate, storageLocation, notes, items: items.map((item) => ({ ...item, quantity: Number(item.quantity) })) }),
      })
      navigate('/returns', { state: { message: `Return ${response.data.returnNumber} added to return storage.` } })
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : 'Unable to record return')
    } finally {
      setSaving(false)
    }
  }

  if (!canManage) return <><PageMetaData title="Record Return" /><Alert variant="warning">You have view access to Return Management. Ask an admin for Manage access to record a return.</Alert></>

  return (
    <>
      <PageMetaData title="Record Return" />
      <div className="d-flex justify-content-between align-items-start flex-wrap gap-2 mb-3">
        <div>
          <h4 className="mb-1">Record returned material</h4>
          <p className="text-muted mb-0">Record extra material collected from a client site. It stays in Return Management and is never added to purchased inventory.</p>
        </div>
        <Link className="btn btn-outline-secondary" to="/returns">Back to returns</Link>
      </div>

      {error && <Alert variant="danger" dismissible onClose={() => setError('')}>{error}</Alert>}

      <Alert variant="info" className="d-flex gap-2 align-items-start">
        <IconifyIcon icon="bx:info-circle" className="fs-20 mt-1" />
        <div><strong>What happens next?</strong><br />The material is placed in site-return storage only. It is not added to Inventory Management; create a transfer challan only when it is sent to another site.</div>
      </Alert>

      <Form onSubmit={submit}>
        <Card className="mb-3">
          <CardBody>
            <div className="d-flex align-items-center gap-2 mb-3">
              <Badge bg="primary" pill>1</Badge>
              <div><h5 className="mb-0">Pickup details</h5><small className="text-muted">Choose the client and site where material was collected.</small></div>
            </div>
            {loading ? <div className="py-3 text-muted"><Spinner animation="border" size="sm" className="me-2" />Loading clients…</div> : <Row className="g-3">
              <Col md={4}>
                <Form.Label>Client</Form.Label>
                <Form.Select required value={client} onChange={(event) => chooseClient(event.target.value)}>
                  <option value="">Select client</option>
                  {parentClients.map((entry) => <option key={entry._id} value={entry._id}>{entry.name}</option>)}
                </Form.Select>
                {!parentClients.length && <Form.Text><Link to="/clients">Add a client in Client Management</Link></Form.Text>}
              </Col>
              <Col md={4}>
                <Form.Label>Pickup site</Form.Label>
                <Form.Select required disabled={!client} value={sourceSite} onChange={(event) => setSourceSite(event.target.value)}>
                  <option value="">{client ? 'Select pickup site' : 'Select client first'}</option>
                  {sites.map((site) => <option key={site._id} value={site._id}>{siteLabel(site)}{site.siteAddress ? ` · ${site.siteAddress}` : ''}</option>)}
                </Form.Select>
                {client && !sites.length && <Form.Text><Link to="/clients">This client has no sites. Add a site first.</Link></Form.Text>}
                {selectedSite?.siteAddress && <Form.Text className="d-block">{selectedSite.siteAddress}</Form.Text>}
              </Col>
              <Col md={4}>
                <Form.Label>Pickup date</Form.Label>
                <Form.Control required type="date" value={pickupDate} onChange={(event) => setPickupDate(event.target.value)} />
              </Col>
            </Row>}
          </CardBody>
        </Card>

        <Card className="mb-3">
          <CardBody>
            <div className="d-flex align-items-center gap-2 mb-3">
              <Badge bg="primary" pill>2</Badge>
              <div><h5 className="mb-0">Return storage</h5><small className="text-muted">Use the rack or area where these materials will be kept.</small></div>
            </div>
            <Row className="g-3">
              <Col md={6}>
                <Form.Label>Storage location <span className="text-muted">(optional)</span></Form.Label>
                <Form.Control value={storageLocation} onChange={(event) => setStorageLocation(event.target.value)} placeholder="For example: Return warehouse rack A-12" />
              </Col>
            </Row>
          </CardBody>
        </Card>

        <Card>
          <CardBody>
            <div className="d-flex justify-content-between align-items-start flex-wrap gap-2 mb-3">
              <div className="d-flex align-items-center gap-2">
                <Badge bg="primary" pill>3</Badge>
                <div><h5 className="mb-0">Returned materials</h5><small className="text-muted">Add each material and the quantity received.</small></div>
              </div>
              <Button type="button" size="sm" variant="outline-primary" onClick={() => setItems((current) => [...current, blankItem()])}>
                <IconifyIcon icon="bx:plus" className="me-1" />Add material
              </Button>
            </div>

            {items.map((item, index) => (
              <div className="border rounded p-3 mb-3" key={index}>
                <div className="d-flex justify-content-between align-items-center mb-3">
                  <span className="fw-semibold">Material {index + 1}</span>
                  {items.length > 1 && <Button type="button" size="sm" variant="link" className="text-danger p-0" aria-label={`Remove material ${index + 1}`} onClick={() => removeItem(index)}>Remove</Button>}
                </div>
                <Row className="g-3">
                  <Col md={5}>
                    <Form.Label>Material name</Form.Label>
                    <Form.Control required value={item.name} onChange={(event) => setItem(index, 'name', event.target.value)} placeholder="For example: Wall panel" />
                  </Col>
                  <Col md={7}>
                    <Form.Label>Description <span className="text-muted">(optional)</span></Form.Label>
                    <Form.Control value={item.description} onChange={(event) => setItem(index, 'description', event.target.value)} placeholder="Colour, size, or condition" />
                  </Col>
                  <Col xs={6} md={3}>
                    <Form.Label>Quantity</Form.Label>
                    <Form.Control required type="number" min="0.01" step="any" value={item.quantity} onChange={(event) => setItem(index, 'quantity', event.target.value)} />
                  </Col>
                  <Col xs={6} md={3}>
                    <Form.Label>Unit</Form.Label>
                    <Form.Select value={item.unit} onChange={(event) => setItem(index, 'unit', event.target.value)}>{units.map((unit) => <option key={unit} value={unit}>{unit}</option>)}</Form.Select>
                  </Col>
                </Row>
              </div>
            ))}

            <div className="border-top pt-3 mt-4">
              <Form.Label>Notes <span className="text-muted">(optional)</span></Form.Label>
              <Form.Control as="textarea" rows={3} value={notes} onChange={(event) => setNotes(event.target.value)} placeholder="Add pickup or material condition notes" />
            </div>

            <div className="d-flex justify-content-between align-items-center flex-wrap gap-3 border-top pt-3 mt-4">
              <span className="text-muted small">{completeItems.length} material{completeItems.length === 1 ? '' : 's'} ready to store</span>
              <div className="d-flex flex-wrap gap-2">
                <Button type="button" variant="outline-secondary" onClick={() => navigate('/returns')}>Cancel</Button>
                <Button type="submit" disabled={saving || loading}>{saving && <Spinner animation="border" size="sm" className="me-2" />}{saving ? 'Saving return…' : 'Store returned material'}</Button>
              </div>
            </div>
          </CardBody>
        </Card>
      </Form>
    </>
  )
}
