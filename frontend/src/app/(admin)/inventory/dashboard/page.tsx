import PageMetaData from '@/components/PageTitle'
import { apiFetch } from '@/helpers/api'
import { useEffect, useState } from 'react'
import { Alert, Badge, Card, CardBody, Col, Row, Spinner, Table } from 'react-bootstrap'
import { Link } from 'react-router-dom'

type Item = { _id: string; sku: string; name: string; category: string; unit: string; quantityInStock: number; minStockLevel: number; location?: string; supplier?: { name: string } }
type Count = { label: string; count: number }
type Dashboard = { totals: { materials: number; lowStock: number; outOfStock: number; suppliers: number }; categories: Count[]; locations: Count[]; lowStock: Item[]; items: Item[] }

export default function InventoryDashboardPage() {
  const [dashboard, setDashboard] = useState<Dashboard>()
  const [error, setError] = useState('')

  useEffect(() => {
    apiFetch<{ data: Dashboard }>('/inventory/dashboard')
      .then((response) => setDashboard(response.data))
      .catch((reason) => setError(reason instanceof Error ? reason.message : 'Unable to load the inventory dashboard'))
  }, [])

  if (!dashboard && !error) return <><PageMetaData title="Inventory Dashboard" /><div className="text-center py-5 text-muted"><Spinner animation="border" size="sm" className="me-2" />Loading purchased inventory…</div></>

  return (
    <>
      <PageMetaData title="Inventory Dashboard" />
      <div className="d-flex justify-content-between align-items-start flex-wrap gap-2 mb-3">
        <div><h4 className="mb-1">Inventory Dashboard</h4><p className="text-muted mb-0">Purchased materials and stock levels. Site-return material is tracked separately in Return Management.</p></div>
        <Link className="btn btn-outline-primary" to="/inventory">Open materials</Link>
      </div>
      {error && <Alert variant="danger">{error}</Alert>}
      {dashboard && <>
        <Row className="g-3 mb-3">
          {[
            ['Materials', dashboard.totals.materials, 'primary'],
            ['Low stock', dashboard.totals.lowStock, dashboard.totals.lowStock ? 'warning' : 'success'],
            ['Out of stock', dashboard.totals.outOfStock, dashboard.totals.outOfStock ? 'danger' : 'success'],
            ['Suppliers', dashboard.totals.suppliers, 'info'],
          ].map(([label, value, color]) => <Col sm={6} xl={3} key={String(label)}><Card className="h-100"><CardBody><div className="text-muted small">{label}</div><div className={`fs-2 fw-semibold text-${color}`}>{value}</div></CardBody></Card></Col>)}
        </Row>
        <Row className="g-3 mb-3">
          <Col lg={6}><Card className="h-100"><CardBody><h5 className="mb-3">Materials by category</h5>{dashboard.categories.map((entry) => <div className="d-flex justify-content-between border-top py-2" key={entry.label}><span>{entry.label}</span><Badge bg="light" text="dark">{entry.count}</Badge></div>)}{!dashboard.categories.length && <span className="text-muted">No purchased materials yet.</span>}</CardBody></Card></Col>
          <Col lg={6}><Card className="h-100"><CardBody><h5 className="mb-3">Materials by location</h5>{dashboard.locations.map((entry) => <div className="d-flex justify-content-between border-top py-2" key={entry.label}><span>{entry.label}</span><Badge bg="light" text="dark">{entry.count}</Badge></div>)}{!dashboard.locations.length && <span className="text-muted">No purchased materials yet.</span>}</CardBody></Card></Col>
        </Row>
        <Card className="mb-3"><CardBody><h5 className="mb-1">Low-stock materials</h5><p className="text-muted mb-3">Reorder these purchased materials before their available stock reaches zero.</p><div className="table-responsive"><Table hover className="align-middle mb-0"><thead><tr><th>Material</th><th>Location</th><th>Supplier</th><th>Available</th><th>Minimum</th></tr></thead><tbody>{dashboard.lowStock.map((item) => <tr key={item._id}><td><Link className="fw-semibold" to={`/inventory/${item._id}`}>{item.name}</Link><small className="d-block text-muted">{item.sku}</small></td><td>{item.location || '—'}</td><td>{item.supplier?.name || '—'}</td><td><Badge bg={item.quantityInStock === 0 ? 'danger' : 'warning'}>{item.quantityInStock} {item.unit}</Badge></td><td>{item.minStockLevel} {item.unit}</td></tr>)}{!dashboard.lowStock.length && <tr><td colSpan={5} className="text-center text-muted py-4">No low-stock purchased materials.</td></tr>}</tbody></Table></div></CardBody></Card>
        <Card><CardBody><h5 className="mb-1">Purchased material overview</h5><p className="text-muted mb-3">The first 100 active materials are shown here. Use Materials to search the full inventory ledger.</p><div className="table-responsive"><Table hover className="align-middle mb-0"><thead><tr><th>SKU</th><th>Material</th><th>Category</th><th>Location</th><th>Stock</th><th>Supplier</th></tr></thead><tbody>{dashboard.items.map((item) => <tr key={item._id}><td>{item.sku}</td><td><Link className="fw-semibold" to={`/inventory/${item._id}`}>{item.name}</Link></td><td>{item.category}</td><td>{item.location || '—'}</td><td><Badge bg={item.quantityInStock <= item.minStockLevel ? 'warning' : 'success'}>{item.quantityInStock} {item.unit}</Badge></td><td>{item.supplier?.name || '—'}</td></tr>)}{!dashboard.items.length && <tr><td colSpan={6} className="text-center text-muted py-4">No purchased materials yet.</td></tr>}</tbody></Table></div></CardBody></Card>
      </>}
    </>
  )
}
