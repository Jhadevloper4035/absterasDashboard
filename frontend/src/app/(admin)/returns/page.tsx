import PageMetaData from '@/components/PageTitle'
import { apiFetch } from '@/helpers/api'
import { canManageModule } from '@/helpers/moduleAccess'
import { useAuthStore } from '@/store/authStore'
import { useEffect, useState } from 'react'
import { Alert, Badge, Card, CardBody, Table } from 'react-bootstrap'
import { Link, useSearchParams } from 'react-router-dom'

type Place = { name?: string; siteName?: string; siteAddress?: string }
type ReturnProduct = { _id: string; name: string; quantity: number; unit: string; status: 'stored' | 'transferred'; storageLocation?: string; client?: Place; sourceSite?: Place; returnRecord?: { returnNumber: string } }
type ReturnTransfer = { _id: string; challanNumber: string; challanDate: string; client?: Place; sourceSite?: Place; site?: Place; lineItems: { description: string; quantity: number; unit?: string }[] }
type ReturnView = 'transfers' | 'storage'

const siteName = (site?: Place) => site?.siteName || site?.name || '—'

export default function ReturnsPage() {
  const user = useAuthStore((state) => state.user)
  const [transfers, setTransfers] = useState<ReturnTransfer[]>([])
  const [products, setProducts] = useState<ReturnProduct[]>([])
  const [searchParams] = useSearchParams()
  const [view, setView] = useState<ReturnView>(searchParams.get('view') === 'storage' ? 'storage' : 'transfers')
  const [error, setError] = useState('')
  const canManage = canManageModule(user, 'returns')

  const load = async () => {
    try {
      const [transferResponse, productResponse] = await Promise.all([
        apiFetch<{ data: ReturnTransfer[] }>('/returns/transfers?limit=100'),
        apiFetch<{ data: ReturnProduct[] }>('/returns/products?status=stored&limit=100'),
      ])
      setTransfers(transferResponse.data)
      setProducts(productResponse.data)
      setError('')
    } catch (reason) { setError(reason instanceof Error ? reason.message : 'Unable to load returned materials') }
  }

  useEffect(() => { load() }, [])

  const storedProducts = products.filter((product) => product.status === 'stored')

  return (
    <>
      <PageMetaData title="Return Management" />
      <div className="d-flex justify-content-between align-items-center flex-wrap gap-2 mb-3">
        <div><h4 className="mb-1">Return Management</h4><p className="text-muted mb-0">Track site transfers and material currently held in return storage.</p></div>
        {canManage && <div className="d-flex flex-wrap gap-2"><Link className="btn btn-outline-primary" to="/returns/transfers/create">Create transfer challan</Link><Link className="btn btn-primary" to="/returns/create">Record return</Link></div>}
      </div>

      {error && <Alert variant="danger">{error}</Alert>}

      <div className="d-flex flex-wrap gap-2 mb-3">
        <button type="button" className={`btn ${view === 'transfers' ? 'btn-primary' : 'btn-outline-primary'}`} onClick={() => setView('transfers')}>
          Site transfers <Badge bg={view === 'transfers' ? 'light' : 'primary'} text={view === 'transfers' ? 'dark' : undefined} className="ms-1">{transfers.length}</Badge>
        </button>
        <button type="button" className={`btn ${view === 'storage' ? 'btn-success' : 'btn-outline-success'}`} onClick={() => setView('storage')}>
          In return storage <Badge bg={view === 'storage' ? 'light' : 'success'} text={view === 'storage' ? 'dark' : undefined} className="ms-1">{storedProducts.length}</Badge>
        </button>
      </div>

      {view === 'transfers' ? (
        <Card>
          <CardBody>
            <h5 className="mb-1">Returns sent to another site</h5>
            <p className="text-muted mb-3">Every entry has an automatically created transfer challan.</p>
            <div className="table-responsive"><Table hover className="align-middle mb-0"><thead><tr><th>Challan</th><th>Client</th><th>Picked from</th><th>Sent to</th><th>View</th><th>Materials</th></tr></thead><tbody>
              {transfers.map((transfer) => <tr key={transfer._id}>
                <td><div className="fw-medium">{transfer.challanNumber}</div><small className="text-muted">{new Date(transfer.challanDate).toLocaleDateString()}</small></td>
                <td>{transfer.client?.name || '—'}</td>
                <td><div>{siteName(transfer.sourceSite)}</div><small className="text-muted">{transfer.sourceSite?.siteAddress || '—'}</small></td>
                <td><div>{siteName(transfer.site)}</div><small className="text-muted">{transfer.site?.siteAddress || '—'}</small></td>
                <td><Link to={`/challans/${transfer._id}`}><Badge bg="primary">{transfer.challanNumber}</Badge></Link></td>
                <td>{transfer.lineItems.map((item) => `${item.description} · ${item.quantity} ${item.unit || ''}`).join(', ')}</td>
              </tr>)}
              {!transfers.length && <tr><td colSpan={6} className="text-center text-muted py-4">No return transfers recorded.</td></tr>}
            </tbody></Table></div>
          </CardBody>
        </Card>
      ) : (
        <Card>
          <CardBody>
            <h5 className="mb-1">Materials currently in return storage</h5>
            <p className="text-muted mb-3">These materials are stored separately and are not part of normal inventory.</p>
            <div className="table-responsive"><Table hover className="align-middle mb-0"><thead><tr><th>Material</th><th>Return</th><th>Client / pickup site</th><th>Quantity</th><th>Storage location</th></tr></thead><tbody>
              {storedProducts.map((product) => <tr key={product._id}>
                <td className="fw-medium">{product.name}</td>
                <td>{product.returnRecord?.returnNumber || '—'}</td>
                <td><div>{product.client?.name || '—'}</div><small className="text-muted">{siteName(product.sourceSite)}</small></td>
                <td><Badge bg="success">{product.quantity} {product.unit}</Badge></td>
                <td>{product.storageLocation || 'Return storage'}</td>
              </tr>)}
              {!storedProducts.length && <tr><td colSpan={5} className="text-center text-muted py-4">No materials are currently in return storage.</td></tr>}
            </tbody></Table></div>
          </CardBody>
        </Card>
      )}
    </>
  )
}
