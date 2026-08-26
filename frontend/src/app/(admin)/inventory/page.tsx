import PageMetaData from '@/components/PageTitle'
import { apiFetch } from '@/helpers/api'
import { FormEvent, useEffect, useState } from 'react'
import { Alert, Badge, Button, Card, CardBody, Col, Form, Modal, Row, Table } from 'react-bootstrap'
import { Link } from 'react-router-dom'
import Swal from 'sweetalert2'

type Category = { _id: string; slug: string; label: string }
type Item = { _id: string; sku: string; productCode?: string; category: string; name: string; unit: string; quantityInStock: number; minStockLevel: number; location?: string; status: string; supplier?: { name: string; contactPerson?: string; phone?: string }; specs: Record<string, unknown> }

export default function InventoryPage() {
  const [categories, setCategories] = useState<Category[]>([])
  const [items, setItems] = useState<Item[]>([])
  const [error, setError] = useState('')
  const [query, setQuery] = useState('')
  const [categoryFilter, setCategoryFilter] = useState('')
  const [statusFilter, setStatusFilter] = useState('active')
  const [stockFilter, setStockFilter] = useState('all')
  const [selected, setSelected] = useState<Item>()
  const [viewItem, setViewItem] = useState<Item>()
  const [transaction, setTransaction] = useState({ type: 'in', quantity: 1, reference: '', note: '' })
  const [showTransaction, setShowTransaction] = useState(false)
  const load = async () => {
    try {
      const params = new URLSearchParams({ limit: '100' })
      if (query.trim()) params.set('q', query.trim())
      if (categoryFilter) params.set('category', categoryFilter)
      if (statusFilter) params.set('status', statusFilter)
      if (stockFilter === 'low') params.set('lowStock', 'true')
      const [categoryResponse, itemResponse] = await Promise.all([apiFetch<{ data: Category[] }>('/inventory/item-categories'), apiFetch<{ data: Item[] }>(`/inventory/items?${params}`)])
      setCategories(categoryResponse.data); setItems(itemResponse.data); setError('')
    } catch (reason) { setError(reason instanceof Error ? reason.message : 'Unable to load inventory') }
  }
  useEffect(() => { load() }, [categoryFilter, statusFilter, stockFilter])
  useEffect(() => { if (selected) { setShowTransaction(false); window.location.assign(`/inventory/${selected._id}`) } }, [selected])
  useEffect(() => { document.querySelectorAll<HTMLButtonElement>('button').forEach((button) => { if (button.textContent === 'View') button.remove(); if (button.textContent === 'Stock') button.textContent = '+ Quantity' }) }, [items])
  useEffect(() => {
    document.querySelectorAll<HTMLTableRowElement>('tbody tr').forEach((row, index) => {
      const material = items[index]; const cell = row.cells[1]
      if (!material?.supplier || !cell || cell.querySelector('[data-supplier]')) return
      const detail = document.createElement('small'); detail.dataset.supplier = 'true'; detail.className = 'd-block text-muted'; detail.textContent = `Supplier: ${material.supplier.name}${material.supplier.contactPerson ? ` · ${material.supplier.contactPerson}` : ''}${material.supplier.phone ? ` · ${material.supplier.phone}` : ''}`; cell.append(detail)
    })
    document.querySelectorAll<HTMLElement>('td.text-end > div').forEach((group) => { group.classList.add('flex-nowrap'); group.querySelectorAll<HTMLElement>('button, a').forEach((button) => button.classList.add('text-nowrap')) })
  }, [items])
  const clearFilters = () => { setQuery(''); setCategoryFilter(''); setStatusFilter('active'); setStockFilter('all') }
  const saveTransaction = async (event: FormEvent) => {
    event.preventDefault(); if (!selected) return
    try { await apiFetch(`/inventory/items/${selected._id}/transactions`, { method: 'POST', body: JSON.stringify({ ...transaction, quantity: Number(transaction.quantity) }) }); setShowTransaction(false); await load() } catch (reason) { setError(reason instanceof Error ? reason.message : 'Unable to update stock') }
  }
  const remove = async (item: Item) => {
    const result = await Swal.fire({ icon: 'warning', title: `Delete ${item.name}?`, text: 'This hides the material from the list but preserves its stock history.', showCancelButton: true, confirmButtonText: 'Delete material', confirmButtonColor: '#dc3545' })
    if (!result.isConfirmed) return
    try { await apiFetch(`/inventory/items/${item._id}`, { method: 'DELETE' }); await load(); await Swal.fire({ icon: 'success', title: 'Material deleted', timer: 1200, showConfirmButton: false }) } catch (reason) { setError(reason instanceof Error ? reason.message : 'Unable to delete material') }
  }
  return <><PageMetaData title="Inventory" /><div className="d-flex justify-content-between align-items-center flex-wrap gap-2 mb-3"><div><h4 className="mb-1">Inventory</h4><p className="text-muted mb-0">Materials and live stock ledger.</p></div><Link className="btn btn-primary" to="/inventory/add">Add material</Link></div>{error && <Alert variant="danger">{error}</Alert>}<Card><CardBody><Form onSubmit={(event) => { event.preventDefault(); load() }}><Row className="g-2 mb-3"><Col lg={4}><Form.Control placeholder="Search SKU, product code, or material name" value={query} onChange={(event) => setQuery(event.target.value)} /></Col><Col lg={2}><Form.Select value={categoryFilter} onChange={(event) => setCategoryFilter(event.target.value)}><option value="">All categories</option>{categories.map((category) => <option key={category._id} value={category.slug}>{category.label}</option>)}</Form.Select></Col><Col lg={2}><Form.Select value={statusFilter} onChange={(event) => setStatusFilter(event.target.value)}><option value="">All active statuses</option><option value="active">Active</option><option value="discontinued">Discontinued</option><option value="inactive">Deleted</option></Form.Select></Col><Col lg={2}><Form.Select value={stockFilter} onChange={(event) => setStockFilter(event.target.value)}><option value="all">All stock levels</option><option value="low">Low stock</option></Form.Select></Col><Col lg={2} className="d-flex gap-2"><Button type="submit">Search</Button><Button type="button" variant="outline-secondary" onClick={clearFilters}>Clear</Button></Col></Row></Form><div className="table-responsive"><Table hover className="align-middle mb-0"><thead><tr><th>SKU</th><th>Material</th><th>Category</th><th>Stock</th><th>Location</th><th /></tr></thead><tbody>{items.map((item) => <tr key={item._id}><td>{item.sku}{item.productCode && <small className="d-block text-muted">Code: {item.productCode}</small>}</td><td><div className="fw-medium">{item.name}</div><small className="text-muted">{Object.entries(item.specs || {}).map(([key, value]) => `${key}: ${value}`).join(' · ')}</small></td><td>{categories.find((entry) => entry.slug === item.category)?.label || item.category}</td><td><Badge bg={item.quantityInStock <= item.minStockLevel ? 'danger' : 'success'}>{item.quantityInStock} {item.unit}</Badge><small className="d-block text-muted">Min {item.minStockLevel}</small></td><td>{item.location || '—'}</td><td className="text-end"><div className="d-flex justify-content-end gap-1"><Button size="sm" variant="outline-secondary" onClick={() => setViewItem(item)}>View</Button><Link className="btn btn-sm btn-outline-primary" to={`/inventory/${item._id}/edit`}>Update</Link><Button size="sm" variant="outline-danger" onClick={() => remove(item)}>Delete</Button><Button size="sm" variant="outline-primary" onClick={() => { setSelected(item); setTransaction({ type: 'in', quantity: 1, reference: '', note: '' }); setShowTransaction(true) }}>Stock</Button></div></td></tr>)}{!items.length && <tr><td colSpan={6} className="text-center text-muted py-4">No inventory items found.</td></tr>}</tbody></Table></div></CardBody></Card><Modal show={showTransaction} onHide={() => setShowTransaction(false)}><Form onSubmit={saveTransaction}><Modal.Header closeButton><Modal.Title>Stock movement: {selected?.name}</Modal.Title></Modal.Header><Modal.Body><Form.Group className="mb-3"><Form.Label>Type</Form.Label><Form.Select value={transaction.type} onChange={(event) => setTransaction({ ...transaction, type: event.target.value })}><option value="in">Stock in</option><option value="out">Stock out</option><option value="adjustment">Adjustment (+/-)</option></Form.Select></Form.Group><Form.Group className="mb-3"><Form.Label>Quantity</Form.Label><Form.Control required type="number" min={transaction.type === 'adjustment' ? undefined : 1} value={transaction.quantity} onChange={(event) => setTransaction({ ...transaction, quantity: Number(event.target.value) })} /></Form.Group><Form.Group className="mb-3"><Form.Label>Reference</Form.Label><Form.Control value={transaction.reference} onChange={(event) => setTransaction({ ...transaction, reference: event.target.value })} /></Form.Group><Form.Group><Form.Label>Note</Form.Label><Form.Control value={transaction.note} onChange={(event) => setTransaction({ ...transaction, note: event.target.value })} /></Form.Group></Modal.Body><Modal.Footer><Button variant="outline-secondary" onClick={() => setShowTransaction(false)}>Cancel</Button><Button type="submit">Save movement</Button></Modal.Footer></Form></Modal><Modal show={Boolean(viewItem)} onHide={() => setViewItem(undefined)}><Modal.Header closeButton><Modal.Title>{viewItem?.name}</Modal.Title></Modal.Header><Modal.Body>{viewItem && <dl className="mb-0"><dt>SKU</dt><dd>{viewItem.sku}</dd>{viewItem.productCode && <><dt>Product code</dt><dd>{viewItem.productCode}</dd></>}<dt>Stock</dt><dd>{viewItem.quantityInStock} {viewItem.unit}</dd><dt>Location</dt><dd>{viewItem.location || '—'}</dd>{Object.entries(viewItem.specs || {}).map(([key, value]) => <div key={key}><dt>{key}</dt><dd>{String(value)}</dd></div>)}</dl>}</Modal.Body></Modal></>
}
