import PageMetaData from '@/components/PageTitle'
import { apiFetch } from '@/helpers/api'
import { FormEvent, useEffect, useState } from 'react'
import { Alert, Button, Card, CardBody, Form, Modal, Table } from 'react-bootstrap'

type Supplier = { _id: string; name: string; contactPerson?: string; phone?: string; email?: string; address?: string; taxId?: string; notes?: string; status: string }
const blank = { name: '', contactPerson: '', phone: '', email: '', address: '', taxId: '', notes: '', status: 'active' }

export default function SuppliersPage() {
  const [items, setItems] = useState<Supplier[]>([])
  const [form, setForm] = useState(blank)
  const [editing, setEditing] = useState<Supplier>()
  const [error, setError] = useState('')
  const load = () => apiFetch<{ data: Supplier[] }>('/inventory/suppliers').then((response) => setItems(response.data)).catch((reason) => setError(reason instanceof Error ? reason.message : 'Unable to load suppliers'))
  useEffect(() => { load() }, [])
  useEffect(() => {
    document.querySelectorAll<HTMLTableCellElement>('tbody tr td:nth-child(5)').forEach((cell) => {
      const address = cell.textContent?.trim() || ''
      cell.replaceChildren(...(address && address !== '—' ? address.split(',').flatMap((part, index) => index ? [document.createTextNode(', '), document.createTextNode(part.trim())] : [document.createTextNode(part.trim())]) : [document.createTextNode('No address')]))
      cell.style.maxWidth = '280px'; cell.style.whiteSpace = 'normal'
    })
  }, [items])
  const save = async (event: FormEvent) => {
    event.preventDefault()
    try { await apiFetch(editing?._id ? `/inventory/suppliers/${editing._id}` : '/inventory/suppliers', { method: editing?._id ? 'PATCH' : 'POST', body: JSON.stringify(form) }); setEditing(undefined); setForm(blank); load() } catch (reason) { setError(reason instanceof Error ? reason.message : 'Unable to save supplier') }
  }
  const edit = (item: Supplier) => { setEditing(item); setForm({ name: item.name, contactPerson: item.contactPerson || '', phone: item.phone || '', email: item.email || '', address: item.address || '', taxId: item.taxId || '', notes: item.notes || '', status: item.status }) }
  return <><PageMetaData title="Suppliers" /><div className="d-flex justify-content-between mb-3"><h4>Suppliers</h4><Button onClick={() => { setEditing({ _id: '', ...blank }); setForm(blank) }}>Add supplier</Button></div>{error && <Alert variant="danger">{error}</Alert>}<Card><CardBody><Table responsive hover><thead><tr><th>Supplier</th><th>Contact</th><th>Phone</th><th>Email</th><th>Address</th><th /></tr></thead><tbody>{items.map((item) => <tr key={item._id}><td>{item.name}<small className="d-block text-muted">{item.taxId}</small></td><td>{item.contactPerson || '—'}</td><td>{item.phone || '—'}</td><td>{item.email || '—'}</td><td style={{ minWidth: 220 }}>{item.address || '—'}</td><td><Button size="sm" onClick={() => edit(item)}>Edit</Button></td></tr>)}</tbody></Table></CardBody></Card><Modal show={Boolean(editing)} onHide={() => setEditing(undefined)}><Form onSubmit={save}><Modal.Header closeButton><Modal.Title>Supplier details</Modal.Title></Modal.Header><Modal.Body>{Object.entries(form).map(([key, value]) => key === 'status' ? <Form.Select className="mb-2" key={key} value={value} onChange={(event) => setForm({ ...form, status: event.target.value })}><option value="active">Active</option><option value="inactive">Inactive</option></Form.Select> : <Form.Control className="mb-2" key={key} required={key === 'name'} type={key === 'email' ? 'email' : 'text'} placeholder={key.replace(/([A-Z])/g, ' $1')} value={value} onChange={(event) => setForm({ ...form, [key]: event.target.value })} />)}</Modal.Body><Modal.Footer><Button variant="outline-secondary" onClick={() => setEditing(undefined)}>Cancel</Button><Button type="submit">Save supplier</Button></Modal.Footer></Form></Modal></>
}
