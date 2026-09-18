import PageMetaData from '@/components/PageTitle'
import { apiFetch } from '@/helpers/api'
import { FormEvent, useState } from 'react'
import { Alert, Button, Card, CardBody, Col, Form, Row } from 'react-bootstrap'
import { Link, useNavigate } from 'react-router-dom'

type VendorType = 'laser_cut' | 'powder_coating' | 'purchase_material'
const vendorTypes: { value: VendorType; label: string }[] = [{ value: 'laser_cut', label: 'Laser Cut' }, { value: 'powder_coating', label: 'Powder Coating' }, { value: 'purchase_material', label: 'Purchase Material' }]
const blank = { name: '', contactPerson: '', phone: '', email: '', address: '', taxId: '', notes: '', serviceTypes: [] as VendorType[], status: 'active' }

export default function CreateVendorPage() {
  const [form, setForm] = useState(blank)
  const [error, setError] = useState('')
  const [saving, setSaving] = useState(false)
  const navigate = useNavigate()

  const save = async (event: FormEvent) => {
    event.preventDefault()
    if (!form.serviceTypes.length) return setError('Select at least one vendor type')
    setSaving(true)
    setError('')
    try {
      await apiFetch('/inventory/suppliers', { method: 'POST', body: JSON.stringify(form) })
      navigate('/vendor-management')
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : 'Unable to create vendor')
    } finally {
      setSaving(false)
    }
  }

  return <>
    <PageMetaData title="Create Vendor" />
    <div className="d-flex justify-content-between align-items-start flex-wrap gap-2 mb-3"><div><h4 className="mb-1">Create Vendor</h4><p className="text-muted mb-0">Add the vendor details, GSTIN, and service type.</p></div><Link className="btn btn-outline-secondary" to="/vendor-management">All vendors</Link></div>
    {error && <Alert variant="danger" dismissible onClose={() => setError('')}>{error}</Alert>}
    <Card><CardBody><Form onSubmit={save}><Row className="g-3">
      <Col xs={12}><h5 className="mb-0">Vendor details</h5><p className="text-muted small mb-0">Fields marked with * are required.</p></Col>
      <Col md={6}><Form.Group><Form.Label>Vendor name <span className="text-danger">*</span></Form.Label><Form.Control required autoFocus value={form.name} placeholder="e.g. Precision Laser Works" onChange={(event) => setForm({ ...form, name: event.target.value })} /></Form.Group></Col>
      <Col md={6}><Form.Group><Form.Label>Vendor type <span className="text-danger">*</span></Form.Label><Form.Select required value={form.serviceTypes[0] || ''} onChange={(event) => setForm({ ...form, serviceTypes: event.target.value ? [event.target.value as VendorType] : [] })}><option value="">Select vendor type</option>{vendorTypes.map((type) => <option key={type.value} value={type.value}>{type.label}</option>)}</Form.Select></Form.Group></Col>
      <Col md={6}><Form.Group><Form.Label>GSTIN</Form.Label><Form.Control value={form.taxId} placeholder="e.g. 06AABCA0001A1Z1" onChange={(event) => setForm({ ...form, taxId: event.target.value.toUpperCase() })} /><Form.Text className="text-muted">Enter GSTIN if the vendor is registered.</Form.Text></Form.Group></Col>
      <Col md={6}><Form.Group><Form.Label>Contact person</Form.Label><Form.Control value={form.contactPerson} onChange={(event) => setForm({ ...form, contactPerson: event.target.value })} /></Form.Group></Col>
      <Col md={6}><Form.Group><Form.Label>Phone number</Form.Label><Form.Control type="tel" value={form.phone} onChange={(event) => setForm({ ...form, phone: event.target.value })} /></Form.Group></Col>
      <Col md={6}><Form.Group><Form.Label>Email address</Form.Label><Form.Control type="email" value={form.email} onChange={(event) => setForm({ ...form, email: event.target.value })} /></Form.Group></Col>
      <Col xs={12}><h5 className="mb-0 mt-2">Additional details</h5></Col>
      <Col md={6}><Form.Group><Form.Label>Status</Form.Label><Form.Select value={form.status} onChange={(event) => setForm({ ...form, status: event.target.value as typeof form.status })}><option value="active">Active</option><option value="inactive">Inactive</option></Form.Select></Form.Group></Col>
      <Col md={6}><Form.Group><Form.Label>Vendor address</Form.Label><Form.Control as="textarea" rows={2} placeholder="Full pickup or delivery address" value={form.address} onChange={(event) => setForm({ ...form, address: event.target.value })} /></Form.Group></Col>
      <Col xs={12}><Form.Group><Form.Label>Notes</Form.Label><Form.Control as="textarea" rows={2} value={form.notes} onChange={(event) => setForm({ ...form, notes: event.target.value })} /></Form.Group></Col>
      <Col xs={12}><Button type="submit" disabled={saving}>{saving ? 'Creating…' : 'Create vendor'}</Button></Col>
    </Row></Form></CardBody></Card>
  </>
}
