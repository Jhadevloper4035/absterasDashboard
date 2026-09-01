import PageMetaData from '@/components/PageTitle'
import { apiFetch } from '@/helpers/api'
import { FormEvent, useEffect, useState } from 'react'
import { Alert, Badge, Button, Card, CardBody, Col, Form, Modal, Row, Spinner, Table } from 'react-bootstrap'

type Vendor = { _id: string; name: string; contactPerson?: string; phone?: string; email?: string; address?: string; notes?: string; status: 'active' | 'inactive' }
type VendorForm = Omit<Vendor, '_id'>

const blank: VendorForm = { name: '', contactPerson: '', phone: '', email: '', address: '', notes: '', status: 'active' }

export default function ProcessVendorPage({ title, endpoint }: { title: string; endpoint: string }) {
  const [vendors, setVendors] = useState<Vendor[]>([])
  const [form, setForm] = useState<VendorForm>(blank)
  const [editing, setEditing] = useState<Vendor | null>(null)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [deletingId, setDeletingId] = useState<string | null>(null)
  const [error, setError] = useState('')

  const load = async () => {
    setLoading(true)
    try {
      const response = await apiFetch<{ data: Vendor[] }>(`${endpoint}?status=active`)
      setVendors(response.data)
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : 'Unable to load vendors')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => { load() }, [])

  const openCreate = () => {
    setError('')
    setForm(blank)
    setEditing({ _id: '', ...blank })
  }

  const edit = (vendor: Vendor) => {
    setError('')
    setForm({ name: vendor.name, contactPerson: vendor.contactPerson || '', phone: vendor.phone || '', email: vendor.email || '', address: vendor.address || '', notes: vendor.notes || '', status: vendor.status })
    setEditing(vendor)
  }

  const save = async (event: FormEvent) => {
    event.preventDefault()
    setSaving(true)
    setError('')
    try {
      await apiFetch(editing?._id ? `${endpoint}/${editing._id}` : endpoint, { method: editing?._id ? 'PATCH' : 'POST', body: JSON.stringify(form) })
      setEditing(null)
      await load()
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : 'Unable to save vendor')
    } finally {
      setSaving(false)
    }
  }

  const remove = async (vendor: Vendor) => {
    if (!window.confirm(`Delete ${vendor.name}? It will be hidden from new orders but kept for existing challans.`)) return
    setDeletingId(vendor._id)
    setError('')
    try {
      await apiFetch(`${endpoint}/${vendor._id}`, { method: 'DELETE' })
      await load()
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : 'Unable to delete vendor')
    } finally {
      setDeletingId(null)
    }
  }

  const setField = <K extends keyof VendorForm>(key: K, value: VendorForm[K]) => setForm({ ...form, [key]: value })

  return <>
    <PageMetaData title={title} />
    <div className="d-flex justify-content-between align-items-start flex-wrap gap-2 mb-3">
      <div><h4 className="mb-1">{title}</h4><p className="text-muted mb-0">Add the vendors available for this process. Only active vendors appear while creating an order.</p></div>
      <Button onClick={openCreate}>Add vendor</Button>
    </div>
    {error && <Alert variant="danger" dismissible onClose={() => setError('')}>{error}</Alert>}
    <Card><CardBody>
      <div className="d-flex justify-content-between align-items-center mb-3"><span className="text-muted">{loading ? 'Loading vendors…' : `${vendors.length} vendor${vendors.length === 1 ? '' : 's'}`}</span><Button variant="outline-secondary" size="sm" onClick={load} disabled={loading}>Refresh</Button></div>
      <Table responsive hover className="align-middle mb-0"><thead><tr><th>Vendor</th><th>Contact person</th><th>Phone</th><th>Email</th><th>Address</th><th>Status</th><th /></tr></thead><tbody>
        {vendors.map((vendor) => <tr key={vendor._id}><td className="fw-semibold">{vendor.name}</td><td>{vendor.contactPerson || '—'}</td><td>{vendor.phone || '—'}</td><td>{vendor.email || '—'}</td><td style={{ minWidth: 220 }}>{vendor.address || '—'}</td><td><Badge bg={vendor.status === 'active' ? 'success' : 'secondary'}>{vendor.status === 'active' ? 'Active' : 'Inactive'}</Badge></td><td className="text-end"><div className="d-flex justify-content-end gap-1"><Button size="sm" variant="outline-primary" onClick={() => edit(vendor)}>Edit</Button>{vendor.status === 'active' && <Button size="sm" variant="outline-danger" disabled={deletingId === vendor._id} onClick={() => remove(vendor)}>{deletingId === vendor._id ? 'Deleting…' : 'Delete'}</Button>}</div></td></tr>)}
        {!loading && !vendors.length && <tr><td colSpan={7} className="text-center text-muted py-4">No vendors added yet. Use “Add vendor” to create one.</td></tr>}
      </tbody></Table>
    </CardBody></Card>
    <Modal show={Boolean(editing)} onHide={() => !saving && setEditing(null)} centered size="lg"><Form onSubmit={save}>
      <Modal.Header closeButton><Modal.Title>{editing?._id ? 'Edit vendor' : `Add ${title.slice(0, -1)}`}</Modal.Title></Modal.Header>
      <Modal.Body>
        <p className="text-muted small mb-3">Vendor name is required. Contact and address details help the team when dispatching challans.</p>
        <Row className="g-3">
          <Col md={6}><Form.Group><Form.Label>Vendor name <span className="text-danger">*</span></Form.Label><Form.Control required autoFocus value={form.name} placeholder="e.g. Precision Laser Works" onChange={(event) => setField('name', event.target.value)} /></Form.Group></Col>
          <Col md={6}><Form.Group><Form.Label>Contact person</Form.Label><Form.Control value={form.contactPerson} placeholder="e.g. Amit Bansal" onChange={(event) => setField('contactPerson', event.target.value)} /></Form.Group></Col>
          <Col md={6}><Form.Group><Form.Label>Phone number</Form.Label><Form.Control type="tel" inputMode="tel" value={form.phone} placeholder="e.g. +91 98100 00106" onChange={(event) => setField('phone', event.target.value)} /></Form.Group></Col>
          <Col md={6}><Form.Group><Form.Label>Email address</Form.Label><Form.Control type="email" value={form.email} placeholder="e.g. dispatch@vendor.com" onChange={(event) => setField('email', event.target.value)} /></Form.Group></Col>
          <Col md={8}><Form.Group><Form.Label>Vendor address</Form.Label><Form.Control as="textarea" rows={2} value={form.address} placeholder="Full pickup and delivery address" onChange={(event) => setField('address', event.target.value)} /></Form.Group></Col>
          <Col md={4}><Form.Group><Form.Label>Status</Form.Label><Form.Select value={form.status} onChange={(event) => setField('status', event.target.value as VendorForm['status'])}><option value="active">Active — available for orders</option><option value="inactive">Inactive — hidden from orders</option></Form.Select></Form.Group></Col>
          <Col xs={12}><Form.Group><Form.Label>Notes</Form.Label><Form.Control as="textarea" rows={2} value={form.notes} placeholder="Optional dispatch instructions or notes" onChange={(event) => setField('notes', event.target.value)} /></Form.Group></Col>
        </Row>
      </Modal.Body>
      <Modal.Footer><Button variant="outline-secondary" disabled={saving} onClick={() => setEditing(null)}>Cancel</Button><Button type="submit" disabled={saving}>{saving && <Spinner size="sm" className="me-1" />} {saving ? 'Saving…' : 'Save vendor'}</Button></Modal.Footer>
    </Form></Modal>
  </>
}
