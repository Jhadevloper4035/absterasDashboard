import PageMetaData from '@/components/PageTitle'
import IconifyIcon from '@/components/wrappers/IconifyIcon'
import { apiFetch } from '@/helpers/api'
import { canManageModule } from '@/helpers/moduleAccess'
import { useAuthStore } from '@/store/authStore'
import { FormEvent, useEffect, useMemo, useState } from 'react'
import { Alert, Button, Card, CardBody, Col, Form, Row } from 'react-bootstrap'
import { useNavigate } from 'react-router-dom'

type Client = { _id: string; name: string; siteName?: string; siteAddress?: string; parentClient?: string | { _id: string } }
type Item = { name: string; description: string; quantity: string; unit: string }
const blankItem = (): Item => ({ name: '', description: '', quantity: '1', unit: 'pcs' })
const parentId = (client: Client) => typeof client.parentClient === 'string' ? client.parentClient : client.parentClient?._id

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
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  const canManage = canManageModule(user, 'returns')

  useEffect(() => { apiFetch<{ data: Client[] }>('/clients?limit=100').then((response) => setClients(response.data)).catch((reason) => setError(reason instanceof Error ? reason.message : 'Unable to load clients')) }, [])
  const parentClients = useMemo(() => clients.filter((entry) => !entry.parentClient), [clients])
  const sites = useMemo(() => clients.filter((entry) => parentId(entry) === client), [clients, client])
  const chooseClient = (id: string) => { setClient(id); setSourceSite('') }
  const setItem = (index: number, field: keyof Item, value: string) => setItems((current) => current.map((item, itemIndex) => itemIndex === index ? { ...item, [field]: value } : item))
  const address = (id: string) => sites.find((site) => site._id === id)?.siteAddress
  const submit = async (event: FormEvent) => {
    event.preventDefault()
    setSaving(true); setError('')
    try {
      const response = await apiFetch<{ data: { returnNumber: string } }>('/returns', { method: 'POST', body: JSON.stringify({ client, sourceSite, pickupDate, storageLocation, notes, items: items.map((item) => ({ ...item, quantity: Number(item.quantity) })) }) })
      navigate('/returns', { state: { message: `Return ${response.data.returnNumber} added to return storage.` } })
    } catch (reason) { setError(reason instanceof Error ? reason.message : 'Unable to record return') } finally { setSaving(false) }
  }

  if (!canManage) return <><PageMetaData title="Record Return" /><Alert variant="warning">You have view access to Return Management. Ask an admin for Manage access to record a return.</Alert></>

  return (
    <>
      <PageMetaData title="Record Return" />
      <div className="mb-3">
        <h4 className="mb-1">Record returned material</h4>
        <p className="text-muted mb-0">Choose where the material came from, then store it or send it to another site.</p>
      </div>

      {error && <Alert variant="danger">{error}</Alert>}

      <Card>
        <CardBody>
          <Form onSubmit={submit}>
            <section className="mb-4">
              <h5 className="mb-1">1. Pickup details</h5>
              <p className="text-muted mb-3">Select the client site where the material was collected.</p>
              <Row className="g-3">
                <Col md={4}>
                  <Form.Label>Client</Form.Label>
                  <Form.Select required value={client} onChange={(event) => chooseClient(event.target.value)}>
                    <option value="">Select client</option>
                    {parentClients.map((entry) => <option key={entry._id} value={entry._id}>{entry.name}</option>)}
                  </Form.Select>
                </Col>
                <Col md={4}>
                  <Form.Label>Pickup site / address</Form.Label>
                  <Form.Select required disabled={!client} value={sourceSite} onChange={(event) => setSourceSite(event.target.value)}>
                    <option value="">{client ? 'Select pickup site' : 'Select client first'}</option>
                    {sites.map((site) => <option key={site._id} value={site._id}>{site.siteName || site.name} · {site.siteAddress}</option>)}
                  </Form.Select>
                  {address(sourceSite) && <Form.Text>{address(sourceSite)}</Form.Text>}
                </Col>
                <Col md={4}>
                  <Form.Label>Pickup date</Form.Label>
                  <Form.Control required type="date" value={pickupDate} onChange={(event) => setPickupDate(event.target.value)} />
                </Col>
              </Row>
            </section>

            <section className="border-top pt-4 mb-4">
              <h5 className="mb-1">2. Return storage</h5>
              <p className="text-muted mb-3">The material stays separate from normal inventory. Create a transfer challan later when it is sent to another site.</p>
              <Row className="g-3">
                <Col md={6}>
                  <Form.Label>Return storage location</Form.Label>
                  <Form.Control value={storageLocation} onChange={(event) => setStorageLocation(event.target.value)} placeholder="For example: Return warehouse rack A-12" />
                </Col>
              </Row>
            </section>

            <section className="border-top pt-4">
              <div className="d-flex justify-content-between align-items-center gap-2 mb-1">
                <h5 className="mb-0">3. Returned materials</h5>
                <Button type="button" size="sm" variant="outline-primary" onClick={() => setItems((current) => [...current, blankItem()])}>
                  <IconifyIcon icon="bx:plus" className="me-1" />Add material
                </Button>
              </div>
              <p className="text-muted mb-3">Add each material that was picked up.</p>
              {items.map((item, index) => (
                <div className="border rounded p-3 mb-3" key={index}>
                  <div className="d-flex justify-content-between align-items-center mb-3">
                    <span className="fw-semibold">Material {index + 1}</span>
                    {items.length > 1 && <Button type="button" size="sm" variant="link" className="text-danger p-0" onClick={() => setItems((current) => current.filter((_, itemIndex) => itemIndex !== index))}>Remove</Button>}
                  </div>
                  <Row className="g-3">
                    <Col md={5}><Form.Label>Material name</Form.Label><Form.Control required value={item.name} onChange={(event) => setItem(index, 'name', event.target.value)} placeholder="For example: Wall panel" /></Col>
                    <Col md={7}><Form.Label>Description <span className="text-muted">(optional)</span></Form.Label><Form.Control value={item.description} onChange={(event) => setItem(index, 'description', event.target.value)} placeholder="Colour, size, or condition" /></Col>
                    <Col xs={6} md={3}><Form.Label>Quantity</Form.Label><Form.Control required type="number" min="0.01" step="any" value={item.quantity} onChange={(event) => setItem(index, 'quantity', event.target.value)} /></Col>
                    <Col xs={6} md={3}><Form.Label>Unit</Form.Label><Form.Select value={item.unit} onChange={(event) => setItem(index, 'unit', event.target.value)}>{['pcs', 'nos', 'sheet', 'meter', 'kg', 'box', 'set', 'roll', 'bundle'].map((unit) => <option key={unit} value={unit}>{unit}</option>)}</Form.Select></Col>
                  </Row>
                </div>
              ))}
            </section>

            <section className="border-top pt-4">
              <Form.Label>Notes <span className="text-muted">(optional)</span></Form.Label>
              <Form.Control as="textarea" rows={3} value={notes} onChange={(event) => setNotes(event.target.value)} placeholder="Add pickup or material condition notes" />
            </section>

            <div className="d-flex flex-wrap gap-2 mt-4">
              <Button type="submit" disabled={saving}>{saving ? 'Saving…' : 'Store return product'}</Button>
              <Button type="button" variant="outline-secondary" onClick={() => navigate('/returns')}>Cancel</Button>
            </div>
          </Form>
        </CardBody>
      </Card>
    </>
  )
}
