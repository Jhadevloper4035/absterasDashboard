import PageMetaData from '@/components/PageTitle'
import { apiFetch } from '@/helpers/api'
import { useAuthStore } from '@/store/authStore'
import { FormEvent, useEffect, useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { Alert, Badge, Button, Card, CardBody, Form, Modal, Table } from 'react-bootstrap'
import { Client, ClientFields, ClientInput, clientPayload, emptyClientInput, inputFromClient } from './client-form'

const ClientManagementPage = () => {
  const user = useAuthStore((state) => state.user)
  const canCreate = [user?.role, ...(user?.additionalRoles || []), ...(user?.accessTypes || [])].some((role) => role === 'superadmin' || role === 'admin')
  const [clients, setClients] = useState<Client[]>([])
  const [editing, setEditing] = useState<Client | null>(null)
  const [form, setForm] = useState<ClientInput>(emptyClientInput)
  const [search, setSearch] = useState('')
  const [error, setError] = useState('')
  const [saving, setSaving] = useState(false)
  const load = () => apiFetch<{ data: Client[] }>('/clients?limit=100').then((response) => setClients(response.data)).catch((reason) => setError(reason instanceof Error ? reason.message : 'Unable to load clients'))
  useEffect(() => { load() }, [])
  const visibleClients = useMemo(() => clients.filter((client) => `${client.name} ${client.siteName || ''} ${client.phone || ''} ${client.email || ''}`.toLowerCase().includes(search.toLowerCase())), [clients, search])
  const openEdit = (client: Client) => { setEditing(client); setForm(inputFromClient(client)) }
  const save = async (event: FormEvent) => { event.preventDefault(); if (!editing) return; setSaving(true); setError(''); try { await apiFetch(`/clients/${editing._id}`, { method: 'PATCH', body: JSON.stringify(clientPayload(form)) }); setEditing(null); load() } catch (reason) { setError(reason instanceof Error ? reason.message : 'Unable to update client') } finally { setSaving(false) } }

  return <><PageMetaData title="All Clients" /><Card className="mb-3"><CardBody><div className="d-flex justify-content-between align-items-start flex-wrap gap-3"><div><h4 className="card-title mb-1">All clients</h4><p className="text-muted mb-0">Client billing and project details in one place.</p></div>{canCreate && <Link to="/clients/create"><Button>Create client</Button></Link>}</div>{error && <Alert className="mt-3 mb-0" variant="danger">{error}</Alert>}</CardBody></Card><Card><CardBody><div className="d-flex justify-content-between align-items-center flex-wrap gap-2 mb-3"><h5 className="mb-0">Clients</h5><Form.Control aria-label="Search clients" placeholder="Search client, site, phone, or email" value={search} onChange={(event) => setSearch(event.target.value)} style={{ maxWidth: 340 }} /></div><Table responsive hover className="mb-0"><thead><tr><th>Client & project</th><th>Contact</th><th>Location</th><th>Status</th><th>Estimated value</th><th /></tr></thead><tbody>{visibleClients.map((client) => <tr key={client._id}><td><strong>{client.name}</strong><div className="text-muted small">{client.siteName || 'No project name'}</div></td><td>{client.phone || client.email || '-'}</td><td>{[client.state, client.siteAddress].filter(Boolean).join(' · ') || '-'}</td><td><Badge bg={client.status === 'active' ? 'success' : client.status === 'completed' ? 'secondary' : 'warning'}>{client.status}</Badge></td><td>{client.estimatedValue?.toLocaleString() || '-'}</td><td className="text-end d-flex justify-content-end gap-2"><Link to={`/clients/${client._id}`}><Button size="sm" variant="outline-secondary">View</Button></Link><Button size="sm" variant="outline-primary" onClick={() => openEdit(client)}>Edit</Button></td></tr>)}{!visibleClients.length && <tr><td colSpan={6} className="text-center text-muted py-4">No clients found.</td></tr>}</tbody></Table></CardBody></Card><Modal show={Boolean(editing)} onHide={() => setEditing(null)} centered size="lg"><Form onSubmit={save}><Modal.Header closeButton><Modal.Title>Update client</Modal.Title></Modal.Header><Modal.Body><ClientFields value={form} onChange={setForm} /></Modal.Body><Modal.Footer><Button variant="light" onClick={() => setEditing(null)}>Cancel</Button><Button type="submit" disabled={saving}>{saving ? 'Saving…' : 'Save changes'}</Button></Modal.Footer></Form></Modal></>
}

export default ClientManagementPage
