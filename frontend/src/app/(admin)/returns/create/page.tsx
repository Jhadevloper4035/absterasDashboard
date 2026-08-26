import PageMetaData from '@/components/PageTitle'
import { apiFetch } from '@/helpers/api'
import { canManageModule } from '@/helpers/moduleAccess'
import { useAuthStore } from '@/store/authStore'
import { FormEvent, useEffect, useMemo, useState } from 'react'
import { Alert, Button, Card, CardBody, Col, Form, Row, Table } from 'react-bootstrap'
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
  const [destinationSite, setDestinationSite] = useState('')
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
  const chooseClient = (id: string) => { setClient(id); setSourceSite(''); setDestinationSite('') }
  const setItem = (index: number, field: keyof Item, value: string) => setItems((current) => current.map((item, itemIndex) => itemIndex === index ? { ...item, [field]: value } : item))
  const address = (id: string) => sites.find((site) => site._id === id)?.siteAddress
  const submit = async (event: FormEvent) => {
    event.preventDefault()
    setSaving(true); setError('')
    try {
      const response = await apiFetch<{ data: { returnNumber: string; challan?: { challanNumber?: string } } }>('/returns', { method: 'POST', body: JSON.stringify({ client, sourceSite, destinationSite: destinationSite || undefined, pickupDate, storageLocation, notes, items: items.map((item) => ({ ...item, quantity: Number(item.quantity) })) }) })
      navigate('/returns', { state: { message: response.data.challan ? `Return ${response.data.returnNumber} transferred through challan.` : `Return ${response.data.returnNumber} stored separately from inventory.` } })
    } catch (reason) { setError(reason instanceof Error ? reason.message : 'Unable to record return') } finally { setSaving(false) }
  }

  if (!canManage) return <><PageMetaData title="Record Return" /><Alert variant="warning">You have view access to Return Management. Ask an admin for Manage access to record a return.</Alert></>

  return <><PageMetaData title="Record Return" /><div className="mb-3"><h4 className="mb-1">Record returned material</h4><p className="text-muted mb-0">Select the client and pickup address. Transfer to another address generates a challan.</p></div>{error && <Alert variant="danger">{error}</Alert>}<Card><CardBody><Form onSubmit={submit}><Row className="g-3">
    <Col md={4}><Form.Label>Client</Form.Label><Form.Select required value={client} onChange={(event) => chooseClient(event.target.value)}><option value="">Select client</option>{parentClients.map((entry) => <option key={entry._id} value={entry._id}>{entry.name}</option>)}</Form.Select></Col>
    <Col md={4}><Form.Label>Pickup site / address</Form.Label><Form.Select required disabled={!client} value={sourceSite} onChange={(event) => setSourceSite(event.target.value)}><option value="">{client ? 'Select pickup site' : 'Select client first'}</option>{sites.map((site) => <option key={site._id} value={site._id}>{site.siteName || site.name} · {site.siteAddress}</option>)}</Form.Select>{address(sourceSite) && <Form.Text>{address(sourceSite)}</Form.Text>}</Col>
    <Col md={4}><Form.Label>Pickup date</Form.Label><Form.Control required type="date" value={pickupDate} onChange={(event) => setPickupDate(event.target.value)} /></Col>
    <Col md={12}><Form.Check type="switch" id="site-transfer" label="Send this returned material to another client site through a challan" checked={Boolean(destinationSite)} onChange={(event) => setDestinationSite(event.target.checked ? 'select' : '')} /></Col>
    {destinationSite && <Col md={6}><Form.Label>Destination site / address</Form.Label><Form.Select required value={destinationSite === 'select' ? '' : destinationSite} disabled={!sourceSite} onChange={(event) => setDestinationSite(event.target.value)}><option value="">Select a different site</option>{sites.filter((site) => site._id !== sourceSite).map((site) => <option key={site._id} value={site._id}>{site.siteName || site.name} · {site.siteAddress}</option>)}</Form.Select>{destinationSite !== 'select' && address(destinationSite) && <Form.Text>{address(destinationSite)}</Form.Text>}</Col>}
    {!destinationSite && <Col md={6}><Form.Label>Return storage location</Form.Label><Form.Control value={storageLocation} onChange={(event) => setStorageLocation(event.target.value)} placeholder="Return warehouse rack" /></Col>}
  </Row><div className="d-flex justify-content-between align-items-center mt-4 mb-2"><h5 className="mb-0">Returned materials</h5><Button type="button" size="sm" variant="outline-primary" onClick={() => setItems((current) => [...current, blankItem()])}>Add material</Button></div><Table responsive><thead><tr><th>Material</th><th>Description</th><th>Quantity</th><th>Unit</th><th /></tr></thead><tbody>{items.map((item, index) => <tr key={index}><td><Form.Control required value={item.name} onChange={(event) => setItem(index, 'name', event.target.value)} /></td><td><Form.Control value={item.description} onChange={(event) => setItem(index, 'description', event.target.value)} /></td><td><Form.Control required type="number" min="0.01" step="any" value={item.quantity} onChange={(event) => setItem(index, 'quantity', event.target.value)} /></td><td><Form.Select value={item.unit} onChange={(event) => setItem(index, 'unit', event.target.value)}>{['pcs', 'nos', 'sheet', 'meter', 'kg', 'box', 'set', 'roll', 'bundle'].map((unit) => <option key={unit} value={unit}>{unit}</option>)}</Form.Select></td><td>{items.length > 1 && <Button type="button" size="sm" variant="outline-danger" onClick={() => setItems((current) => current.filter((_, itemIndex) => itemIndex !== index))}>×</Button>}</td></tr>)}</tbody></Table><Form.Group><Form.Label>Notes</Form.Label><Form.Control value={notes} onChange={(event) => setNotes(event.target.value)} /></Form.Group><div className="d-flex gap-2 mt-4"><Button type="submit" disabled={saving}>{saving ? 'Saving…' : destinationSite ? 'Create transfer challan' : 'Store return product'}</Button><Button type="button" variant="outline-secondary" onClick={() => navigate('/returns')}>Cancel</Button></div></Form></CardBody></Card></>
}
