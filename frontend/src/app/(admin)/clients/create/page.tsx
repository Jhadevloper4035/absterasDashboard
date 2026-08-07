import PageMetaData from '@/components/PageTitle'
import { apiFetch } from '@/helpers/api'
import { FormEvent, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { Alert, Button, Card, CardBody, Form } from 'react-bootstrap'
import { ClientFields, ClientInput, clientPayload, emptyClientInput } from '../client-form'

const CreateClientPage = () => {
  const navigate = useNavigate()
  const [form, setForm] = useState<ClientInput>(emptyClientInput)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  const create = async (event: FormEvent) => { event.preventDefault(); setSaving(true); setError(''); try { await apiFetch('/clients', { method: 'POST', body: JSON.stringify(clientPayload(form)) }); navigate('/clients') } catch (reason) { setError(reason instanceof Error ? reason.message : 'Unable to create client') } finally { setSaving(false) } }
  return <><PageMetaData title="Create Client" /><Card><CardBody><div className="d-flex justify-content-between align-items-start flex-wrap gap-2 mb-4"><div><h4 className="card-title mb-1">Create client</h4><p className="text-muted mb-0">Add billing and project details together.</p></div><Link to="/clients"><Button variant="outline-secondary">All clients</Button></Link></div>{error && <Alert variant="danger">{error}</Alert>}<Form onSubmit={create}><ClientFields value={form} onChange={setForm} /><div className="d-flex justify-content-end gap-2 mt-4"><Link to="/clients"><Button variant="light">Cancel</Button></Link><Button type="submit" disabled={saving}>{saving ? 'Creating…' : 'Create client'}</Button></div></Form></CardBody></Card></>
}

export default CreateClientPage
