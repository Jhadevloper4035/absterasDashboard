import PageMetaData from '@/components/PageTitle'
import { apiFetch } from '@/helpers/api'
import { FormEvent, useEffect, useState } from 'react'
import { Alert, Badge, Button, Card, CardBody, Col, Form, Modal, Row, Table } from 'react-bootstrap'
import { Link } from 'react-router-dom'
import Swal from 'sweetalert2'

type VendorType = 'laser_cut' | 'powder_coating' | 'purchase_material'
type Supplier = { _id: string; name: string; contactPerson?: string; phone?: string; email?: string; address?: string; taxId?: string; notes?: string; serviceTypes?: VendorType[]; status: 'active' | 'inactive' }
type VendorForm = Omit<Supplier, '_id' | 'serviceTypes'> & { serviceTypes: VendorType[] }

const vendorTypes: { value: VendorType; label: string }[] = [
  { value: 'laser_cut', label: 'Laser Cut' },
  { value: 'powder_coating', label: 'Powder Coating' },
  { value: 'purchase_material', label: 'Purchase Material' },
]

export default function SuppliersPage() {
  const [items, setItems] = useState<Supplier[]>([])
  const [editing, setEditing] = useState<Supplier>()
  const [form, setForm] = useState<VendorForm>()
  const [error, setError] = useState('')
  const [search, setSearch] = useState('')
  const [typeFilter, setTypeFilter] = useState<'all' | VendorType>('all')
  const [statusFilter, setStatusFilter] = useState<'all' | Supplier['status']>('all')
  const load = () => apiFetch<{ data: Supplier[] }>('/inventory/suppliers').then((response) => setItems(response.data)).catch((reason) => setError(reason instanceof Error ? reason.message : 'Unable to load vendors'))
  const visibleItems = items.filter((item) => {
    const matchesSearch = !search.trim() || [item.name, item.contactPerson, item.phone, item.email, item.taxId, item.address].some((value) => value?.toLowerCase().includes(search.trim().toLowerCase()))
    return matchesSearch && (typeFilter === 'all' || item.serviceTypes?.includes(typeFilter)) && (statusFilter === 'all' || item.status === statusFilter)
  })

  useEffect(() => { load() }, [])

  const edit = (item: Supplier) => {
    setError('')
    setEditing(item)
    setForm({ name: item.name, contactPerson: item.contactPerson || '', phone: item.phone || '', email: item.email || '', address: item.address || '', taxId: item.taxId || '', notes: item.notes || '', serviceTypes: item.serviceTypes || [], status: item.status })
  }

  const save = async (event: FormEvent) => {
    event.preventDefault()
    if (!editing || !form) return
    if (!form.serviceTypes.length) return setError('Select at least one vendor type')
    try {
      await apiFetch(`/inventory/suppliers/${editing._id}`, { method: 'PATCH', body: JSON.stringify(form) })
      setEditing(undefined)
      setForm(undefined)
      load()
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : 'Unable to save vendor')
    }
  }

  const remove = async (item: Supplier) => {
    const confirmation = await Swal.fire({ icon: 'warning', title: `Delete ${item.name}?`, text: 'The vendor will be deactivated and can be restored later with Update.', showCancelButton: true, confirmButtonText: 'Delete vendor', confirmButtonColor: '#dc3545', cancelButtonText: 'Keep vendor', reverseButtons: true })
    if (!confirmation.isConfirmed) return
    try {
      await apiFetch(`/inventory/suppliers/${item._id}`, { method: 'DELETE' })
      await load()
      await Swal.fire({ icon: 'success', title: 'Vendor deleted', text: `${item.name} is now inactive.`, timer: 1500, showConfirmButton: false })
    } catch (reason) {
      const message = reason instanceof Error ? reason.message : 'Unable to delete vendor'
      setError(message)
      await Swal.fire({ icon: 'error', title: 'Vendor not deleted', text: message })
    }
  }

  return <>
    <PageMetaData title="All Vendors" />
    <div className="d-flex justify-content-between align-items-start flex-wrap gap-2 mb-3"><div><h4 className="mb-1">All Vendors</h4><p className="text-muted mb-0">Laser Cut, Powder Coating, and Purchase Material vendors.</p></div><Link className="btn btn-primary" to="/vendor-management/create">Create vendor</Link></div>
    {error && <Alert variant="danger" dismissible onClose={() => setError('')}>{error}</Alert>}
    <Card><CardBody><Row className="g-2 align-items-end mb-3"><Col md={4}><Form.Label htmlFor="vendor-search">Search</Form.Label><Form.Control id="vendor-search" value={search} placeholder="Vendor, GSTIN, phone, or email" onChange={(event) => setSearch(event.target.value)} /></Col><Col md={3}><Form.Label htmlFor="vendor-type-filter">Vendor type</Form.Label><Form.Select id="vendor-type-filter" value={typeFilter} onChange={(event) => setTypeFilter(event.target.value as 'all' | VendorType)}><option value="all">All vendor types</option>{vendorTypes.map((type) => <option key={type.value} value={type.value}>{type.label}</option>)}</Form.Select></Col><Col md={3}><Form.Label htmlFor="vendor-status-filter">Status</Form.Label><Form.Select id="vendor-status-filter" value={statusFilter} onChange={(event) => setStatusFilter(event.target.value as 'all' | Supplier['status'])}><option value="all">All statuses</option><option value="active">Active</option><option value="inactive">Inactive</option></Form.Select></Col><Col md={2}><Button className="w-100" variant="outline-secondary" disabled={!search && typeFilter === 'all' && statusFilter === 'all'} onClick={() => { setSearch(''); setTypeFilter('all'); setStatusFilter('all') }}>Clear filters</Button></Col></Row><Table responsive hover className="align-middle mb-0"><thead><tr><th>Vendor</th><th>Types</th><th>GSTIN</th><th>Contact</th><th>Phone</th><th>Email</th><th>Address</th><th>Status</th><th /></tr></thead><tbody>
      {visibleItems.map((item) => <tr key={item._id}><td className="fw-semibold">{item.name}</td><td>{item.serviceTypes?.length ? item.serviceTypes.map((type) => <Badge className="me-1" bg="secondary" key={type}>{vendorTypes.find((entry) => entry.value === type)?.label}</Badge>) : '—'}</td><td>{item.taxId || '—'}</td><td>{item.contactPerson || '—'}</td><td>{item.phone || '—'}</td><td>{item.email || '—'}</td><td style={{ minWidth: 220 }}>{item.address || '—'}</td><td><Badge bg={item.status === 'active' ? 'success' : 'secondary'}>{item.status === 'active' ? 'Active' : 'Inactive'}</Badge></td><td><div className="d-flex gap-1"><Button size="sm" variant="outline-primary" onClick={() => edit(item)}>Update</Button><Button size="sm" variant="outline-danger" disabled={item.status === 'inactive'} onClick={() => remove(item)}>Delete</Button></div></td></tr>)}
      {!visibleItems.length && <tr><td colSpan={9} className="text-center text-muted py-4">No vendors match this filter.</td></tr>}
    </tbody></Table></CardBody></Card>
    <Modal show={Boolean(editing && form)} onHide={() => setEditing(undefined)} centered size="lg"><Form onSubmit={save}><Modal.Header closeButton><Modal.Title>Edit vendor</Modal.Title></Modal.Header><Modal.Body>{form && <Row className="g-3">
      <Col md={6}><Form.Group><Form.Label>Vendor name <span className="text-danger">*</span></Form.Label><Form.Control required autoFocus value={form.name} onChange={(event) => setForm({ ...form, name: event.target.value })} /></Form.Group></Col>
      <Col md={6}><Form.Group><Form.Label>GSTIN</Form.Label><Form.Control value={form.taxId} onChange={(event) => setForm({ ...form, taxId: event.target.value })} /></Form.Group></Col>
      <Col md={6}><Form.Group><Form.Label>Contact person</Form.Label><Form.Control value={form.contactPerson} onChange={(event) => setForm({ ...form, contactPerson: event.target.value })} /></Form.Group></Col>
      <Col md={6}><Form.Group><Form.Label>Phone number</Form.Label><Form.Control type="tel" value={form.phone} onChange={(event) => setForm({ ...form, phone: event.target.value })} /></Form.Group></Col>
      <Col md={6}><Form.Group><Form.Label>Email address</Form.Label><Form.Control type="email" value={form.email} onChange={(event) => setForm({ ...form, email: event.target.value })} /></Form.Group></Col>
      <Col md={6}><Form.Group><Form.Label>Status</Form.Label><Form.Select value={form.status} onChange={(event) => setForm({ ...form, status: event.target.value as Supplier['status'] })}><option value="active">Active</option><option value="inactive">Inactive</option></Form.Select></Form.Group></Col>
      <Col xs={12}><Form.Group><Form.Label>Vendor address</Form.Label><Form.Control as="textarea" rows={2} value={form.address} onChange={(event) => setForm({ ...form, address: event.target.value })} /></Form.Group></Col>
      <Col xs={12}><Form.Label>Vendor types <span className="text-danger">*</span></Form.Label>{vendorTypes.map((type) => <Form.Check key={type.value} inline type="checkbox" label={type.label} checked={form.serviceTypes.includes(type.value)} onChange={(event) => setForm({ ...form, serviceTypes: event.target.checked ? [...form.serviceTypes, type.value] : form.serviceTypes.filter((value) => value !== type.value) })} />)}</Col>
      <Col xs={12}><Form.Group><Form.Label>Notes</Form.Label><Form.Control as="textarea" rows={2} value={form.notes} onChange={(event) => setForm({ ...form, notes: event.target.value })} /></Form.Group></Col>
    </Row>}</Modal.Body><Modal.Footer><Button variant="outline-secondary" onClick={() => setEditing(undefined)}>Cancel</Button><Button type="submit">Save changes</Button></Modal.Footer></Form></Modal>
  </>
}
