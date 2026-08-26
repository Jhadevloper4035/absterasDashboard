import PageMetaData from '@/components/PageTitle'
import { apiFetch } from '@/helpers/api'
import { canManageModule } from '@/helpers/moduleAccess'
import { useAuthStore } from '@/store/authStore'
import { useEffect, useState } from 'react'
import { Alert, Badge, Button, Card, CardBody, Table } from 'react-bootstrap'
import { Link } from 'react-router-dom'

type Place = { name?: string; siteName?: string; siteAddress?: string }
type ReturnRecord = { _id: string; returnNumber: string; client?: Place; sourceSite?: Place; destinationSite?: Place; pickupDate: string; disposition: 'return_stock' | 'site_transfer'; storageLocation?: string; challan?: { challanNumber: string }; items: { name: string; quantity: number; unit: string }[] }
type ReturnProduct = { _id: string; name: string; quantity: number; unit: string; status: 'stored' | 'transferred'; storageLocation?: string; client?: Place; sourceSite?: Place; returnRecord?: { returnNumber: string } }

const siteName = (site?: Place) => site?.siteName || site?.name || '—'

export default function ReturnsPage() {
  const user = useAuthStore((state) => state.user)
  const [returns, setReturns] = useState<ReturnRecord[]>([])
  const [products, setProducts] = useState<ReturnProduct[]>([])
  const [error, setError] = useState('')
  const canManage = canManageModule(user, 'returns')

  const load = async () => {
    try {
      const [returnResponse, productResponse] = await Promise.all([
        apiFetch<{ data: ReturnRecord[] }>('/returns?limit=100'),
        apiFetch<{ data: ReturnProduct[] }>('/returns/products?limit=100'),
      ])
      setReturns(returnResponse.data)
      setProducts(productResponse.data)
      setError('')
    } catch (reason) { setError(reason instanceof Error ? reason.message : 'Unable to load returned materials') }
  }

  useEffect(() => { load() }, [])

  return <>
    <PageMetaData title="Return Management" />
    <div className="d-flex justify-content-between align-items-center flex-wrap gap-2 mb-3">
      <div><h4 className="mb-1">Return Management</h4><p className="text-muted mb-0">Materials picked from client sites, kept separate from inventory.</p></div>
      {canManage && <Link className="btn btn-primary" to="/returns/create">Record return</Link>}
    </div>
    {error && <Alert variant="danger">{error}</Alert>}
    <Card className="mb-3"><CardBody>
      <h5 className="mb-3">Return pickups</h5>
      <div className="table-responsive"><Table hover className="align-middle mb-0"><thead><tr><th>Return</th><th>Client</th><th>Picked from</th><th>Destination</th><th>Materials</th><th>Status</th></tr></thead><tbody>
        {returns.map((record) => <tr key={record._id}>
          <td><div className="fw-medium">{record.returnNumber}</div><small className="text-muted">{new Date(record.pickupDate).toLocaleDateString()}</small></td>
          <td>{record.client?.name || '—'}</td>
          <td><div>{siteName(record.sourceSite)}</div><small className="text-muted">{record.sourceSite?.siteAddress || '—'}</small></td>
          <td>{record.disposition === 'site_transfer' ? <><div>{siteName(record.destinationSite)}</div><small className="text-muted">{record.challan?.challanNumber || 'Challan pending'}</small></> : record.storageLocation || 'Return storage'}</td>
          <td>{record.items.map((item) => `${item.name} · ${item.quantity} ${item.unit}`).join(', ')}</td>
          <td><Badge bg={record.disposition === 'return_stock' ? 'success' : 'primary'}>{record.disposition === 'return_stock' ? 'Stored' : 'Transferred'}</Badge></td>
        </tr>)}
        {!returns.length && <tr><td colSpan={6} className="text-center text-muted py-4">No return pickups recorded.</td></tr>}
      </tbody></Table></div>
    </CardBody></Card>
    <Card><CardBody>
      <h5 className="mb-3">Return product table</h5>
      <div className="table-responsive"><Table hover className="align-middle mb-0"><thead><tr><th>Material</th><th>Return</th><th>Client / source site</th><th>Quantity</th><th>Storage / destination</th><th>Status</th></tr></thead><tbody>
        {products.map((product) => <tr key={product._id}>
          <td className="fw-medium">{product.name}</td><td>{product.returnRecord?.returnNumber || '—'}</td>
          <td><div>{product.client?.name || '—'}</div><small className="text-muted">{siteName(product.sourceSite)}</small></td>
          <td>{product.quantity} {product.unit}</td><td>{product.storageLocation || 'Transferred through challan'}</td>
          <td><Badge bg={product.status === 'stored' ? 'success' : 'primary'}>{product.status}</Badge></td>
        </tr>)}
        {!products.length && <tr><td colSpan={6} className="text-center text-muted py-4">No return products recorded.</td></tr>}
      </tbody></Table></div>
    </CardBody></Card>
  </>
}
