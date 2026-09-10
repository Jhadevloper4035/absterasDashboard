import PageMetaData from '@/components/PageTitle'
import { apiFetch } from '@/helpers/api'
import { canManageModule } from '@/helpers/moduleAccess'
import { useAuthStore } from '@/store/authStore'
import { FormEvent, useEffect, useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { Alert, Badge, Button, Card, CardBody, Form, Modal, Table } from 'react-bootstrap'
import { Client, ClientFields, ClientInput, clientPayload, emptyClientInput, inputFromClient } from './client-form'

const ClientManagementPage = () => {
  const user = useAuthStore((state) => state.user)
  const canCreate = canManageModule(user, 'clients')
  const [clients, setClients] = useState<Client[]>([])
  const [editing, setEditing] = useState<Client | null>(null)
  const [form, setForm] = useState<ClientInput>(emptyClientInput)
  const [search, setSearch] = useState('')
  const [error, setError] = useState('')
  const [saving, setSaving] = useState(false)
  const load = () => apiFetch<{ data: Client[] }>('/clients?limit=100').then((response) => setClients(response.data)).catch((reason) => setError(reason instanceof Error ? reason.message : 'Unable to load clients'))

  useEffect(() => { load() }, [])

  const parentClients = useMemo(() => clients.filter((client) => !client.parentClient), [clients])
  const visibleClients = useMemo(() => parentClients.filter((client) => `${client.name} ${client.phone || ''} ${client.email || ''}`.toLowerCase().includes(search.toLowerCase())), [parentClients, search])
  const sitesFor = (client: Client) => clients.filter((site) => String(typeof site.parentClient === 'string' ? site.parentClient : site.parentClient?._id) === client._id)
  const openEdit = (client: Client) => { setEditing(client); setForm(inputFromClient(client)) }
  const save = async (event: FormEvent) => {
    event.preventDefault()
    if (!editing) return
    setSaving(true)
    setError('')
    try {
      await apiFetch(`/clients/${editing._id}`, { method: 'PATCH', body: JSON.stringify(clientPayload(form)) })
      setEditing(null)
      load()
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : 'Unable to update client')
    } finally {
      setSaving(false)
    }
  }

  return <>
    <PageMetaData title="Parent Clients" />
    <Card className="mb-3"><CardBody>
      <div className="d-flex justify-content-between align-items-start flex-wrap gap-3">
        <div><h4 className="card-title mb-1">Parent clients</h4><p className="text-muted mb-0">Open a client to view invoices and challans for every delivery address.</p></div>
        {canCreate && <Link to="/clients/create"><Button>Create client</Button></Link>}
      </div>
      {error && <Alert className="mt-3 mb-0" variant="danger">{error}</Alert>}
    </CardBody></Card>
    <Card><CardBody>
      <div className="d-flex justify-content-between align-items-center flex-wrap gap-2 mb-3"><h5 className="mb-0">Clients</h5><Form.Control aria-label="Search parent clients" placeholder="Search client, phone, or email" value={search} onChange={(event) => setSearch(event.target.value)} style={{ maxWidth: 340 }} /></div>
      <Table responsive hover className="mb-0"><thead><tr><th>Client</th><th>Delivery addresses</th><th>Contact</th><th>Status</th><th>Estimated value</th><th /></tr></thead><tbody>
        {visibleClients.map((client) => {
          const sites = sitesFor(client)
          return <tr key={client._id}><td><strong>{client.name}</strong></td><td>{sites.length ? `${sites.length} site address${sites.length === 1 ? '' : 'es'}` : client.shippingAddress || client.billingAddress || '-'}</td><td>{client.phone || client.email || '-'}</td><td><Badge bg={client.status === 'active' ? 'success' : client.status === 'completed' ? 'secondary' : 'warning'}>{client.status}</Badge></td><td>{client.estimatedValue?.toLocaleString() || '-'}</td><td className="text-end d-flex justify-content-end gap-2"><Link to={`/clients/${client._id}`}><Button size="sm" variant="outline-secondary">View documents</Button></Link><Button size="sm" variant="outline-primary" onClick={() => openEdit(client)}>Edit</Button></td></tr>
        })}
        {!visibleClients.length && <tr><td colSpan={6} className="text-center text-muted py-4">No parent clients found.</td></tr>}
      </tbody></Table>
    </CardBody></Card>
    <Modal show={Boolean(editing)} onHide={() => setEditing(null)} centered size="lg"><Form onSubmit={save}><Modal.Header closeButton><Modal.Title>Update client</Modal.Title></Modal.Header><Modal.Body><ClientFields value={form} onChange={setForm} parentClients={parentClients.filter((client) => client._id !== editing?._id)} /></Modal.Body><Modal.Footer><Button variant="light" onClick={() => setEditing(null)}>Cancel</Button><Button type="submit" disabled={saving}>{saving ? 'Saving…' : 'Save changes'}</Button></Modal.Footer></Form></Modal>
  </>
}

export default ClientManagementPage
