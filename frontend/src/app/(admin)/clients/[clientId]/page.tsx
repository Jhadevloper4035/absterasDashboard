import PageMetaData from '@/components/PageTitle'
import { apiFetch } from '@/helpers/api'
import { buildApiUrl } from '@/helpers/apiUrl'
import { useAuthStore } from '@/store/authStore'
import { useEffect, useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import { Alert, Badge, Button, Card, CardBody, Spinner, Table } from 'react-bootstrap'
import type { Client } from '../client-form'

type Invoice = { _id: string; invoiceNumber: string; invoiceDate: string; grandTotal: number; status: 'unpaid' | 'partially paid' | 'paid' }
type Challan = { _id: string; challanNumber: string; challanDate: string; totalAmount: number }
const amount = (value?: number) => value?.toLocaleString(undefined, { minimumFractionDigits: 2 }) || '0.00'

const ClientOverviewPage = () => {
  const { clientId } = useParams()
  const [client, setClient] = useState<Client>()
  const [invoices, setInvoices] = useState<Invoice[]>([])
  const [challans, setChallans] = useState<Challan[]>([])
  const [error, setError] = useState('')
  const [downloading, setDownloading] = useState('')
  const token = useAuthStore((state) => state.token)
  useEffect(() => {
    if (!clientId) return
    Promise.all([
      apiFetch<{ data: Client }>(`/clients/${clientId}`),
      apiFetch<{ data: Invoice[] }>(`/invoices?client=${clientId}`),
      apiFetch<{ data: Challan[] }>(`/challans?client=${clientId}`),
    ])
      .then(([clientResponse, invoiceResponse, challanResponse]) => {
        setClient(clientResponse.data)
        setInvoices(invoiceResponse.data)
        setChallans(challanResponse.data)
      })
      .catch((reason) => setError(reason instanceof Error ? reason.message : 'Unable to load client'))
  }, [clientId])
  const totalInvoiced = invoices.reduce((sum, invoice) => sum + invoice.grandTotal, 0)
  const totalChallans = challans.reduce((sum, challan) => sum + challan.totalAmount, 0)
  const download = async (path: string, filename: string) => {
    const response = await fetch(buildApiUrl(path), { headers: token ? { Authorization: `Bearer ${token}` } : {}, credentials: 'include' })
    if (!response.ok) throw new Error('Unable to download PDF')
    const url = URL.createObjectURL(await response.blob())
    const link = document.createElement('a')
    link.href = url
    link.download = filename
    link.click()
    URL.revokeObjectURL(url)
  }
  return (
    <>
      <PageMetaData title={client?.name || 'Client'} />
      {error && <Alert variant="danger">{error}</Alert>}
      {client && (
        <>
          <Card className="mb-3">
            <CardBody>
              <div className="d-flex justify-content-between align-items-start flex-wrap gap-3">
                <div>
                  <h4 className="card-title mb-1">{client.name}</h4>
                  <p className="text-muted mb-0">{client.siteName || 'No project name'}</p>
                </div>
                <div className="d-flex gap-2">
                  <Link to="/clients">
                    <Button variant="outline-secondary">All clients</Button>
                  </Link>
                  <Link to={`/invoices/create?client=${client._id}`}>
                    <Button variant="outline-primary">Create invoice</Button>
                  </Link>
                  <Link to="/challans/create">
                    <Button>Create challan</Button>
                  </Link>
                </div>
              </div>
            </CardBody>
          </Card>
          <div className="row g-3 mb-3">
            <div className="col-lg-6">
              <Card className="h-100">
                <CardBody>
                  <h5 className="mb-3">Client details</h5>
                  <dl className="row mb-0">
                    <dt className="col-sm-4">Phone</dt>
                    <dd className="col-sm-8">{client.phone || '-'}</dd>
                    <dt className="col-sm-4">Email</dt>
                    <dd className="col-sm-8">{client.email || '-'}</dd>
                    <dt className="col-sm-4">GSTIN</dt>
                    <dd className="col-sm-8">{client.gstin || '-'}</dd>
                    <dt className="col-sm-4">Status</dt>
                    <dd className="col-sm-8">
                      <Badge bg={client.status === 'active' ? 'success' : client.status === 'completed' ? 'secondary' : 'warning'}>
                        {client.status}
                      </Badge>
                    </dd>
                    <dt className="col-sm-4">Estimated value</dt>
                    <dd className="col-sm-8">{amount(client.estimatedValue)}</dd>
                  </dl>
                </CardBody>
              </Card>
            </div>
            <div className="col-lg-6">
              <Card className="h-100">
                <CardBody>
                  <h5 className="mb-3">Project & addresses</h5>
                  <dl className="row mb-0">
                    <dt className="col-sm-4">Project</dt>
                    <dd className="col-sm-8">{client.siteName || '-'}</dd>
                    <dt className="col-sm-4">Site address</dt>
                    <dd className="col-sm-8">{client.siteAddress || '-'}</dd>
                    <dt className="col-sm-4">Billing address</dt>
                    <dd className="col-sm-8">{client.billingAddress || '-'}</dd>
                    <dt className="col-sm-4">Shipping address</dt>
                    <dd className="col-sm-8">{client.shippingAddress || '-'}</dd>
                    <dt className="col-sm-4">State</dt>
                    <dd className="col-sm-8">{[client.state, client.stateCode].filter(Boolean).join(' · ') || '-'}</dd>
                    <dt className="col-sm-4">Start date</dt>
                    <dd className="col-sm-8">{client.startDate ? new Date(client.startDate).toLocaleDateString() : '-'}</dd>
                  </dl>
                </CardBody>
              </Card>
            </div>
          </div>
          {client.notes && (
            <Card className="mb-3">
              <CardBody>
                <h5 className="mb-2">Notes</h5>
                <p className="mb-0">{client.notes}</p>
              </CardBody>
            </Card>
          )}
          <Card className="mb-3">
            <CardBody>
              <div className="d-flex justify-content-between align-items-center mb-3">
                <h5 className="mb-0">Invoices</h5>
                <strong>Total billed: {amount(totalInvoiced)}</strong>
              </div>
              <Table responsive hover className="mb-0">
                <thead>
                  <tr>
                    <th>Invoice</th>
                    <th>Date</th>
                    <th>Amount</th>
                    <th>Status</th>
                    <th />
                  </tr>
                </thead>
                <tbody>
                  {invoices.map((invoice) => (
                    <tr key={invoice._id}>
                      <td>
                        <Link to={`/invoices/${invoice._id}`}>{invoice.invoiceNumber}</Link>
                      </td>
                      <td>{new Date(invoice.invoiceDate).toLocaleDateString()}</td>
                      <td>{amount(invoice.grandTotal)}</td>
                      <td>
                        <Badge bg={invoice.status === 'paid' ? 'success' : invoice.status === 'partially paid' ? 'warning' : 'secondary'}>
                          {invoice.status}
                        </Badge>
                      </td>
                      <td className="text-end">
                        <Link to={`/invoices/${invoice._id}`}>
                          <Button size="sm" variant="outline-primary" className="me-2">
                            View
                          </Button>
                        </Link>
                        <Button
                          size="sm"
                          variant="outline-secondary"
                          className="me-2"
                          onClick={() => window.open(`/invoices/${invoice._id}?print=1`, '_blank')}>
                          Print
                        </Button>
                        <Button
                          size="sm"
                          variant="outline-success"
                          disabled={downloading === `invoice-${invoice._id}`}
                          onClick={() => { setDownloading(`invoice-${invoice._id}`); download(`/invoices/${invoice._id}/pdf`, `invoice-${invoice.invoiceNumber}.pdf`).catch((reason) => setError(reason instanceof Error ? reason.message : 'Unable to download invoice')).finally(() => setDownloading('')) }}>
                          {downloading === `invoice-${invoice._id}` && <Spinner size="sm" className="me-2" />}Download
                        </Button>
                      </td>
                    </tr>
                  ))}
                  {!invoices.length && (
                    <tr>
                      <td colSpan={5} className="text-center text-muted py-4">
                        No invoices yet.
                      </td>
                    </tr>
                  )}
                </tbody>
              </Table>
            </CardBody>
          </Card>
          <Card>
            <CardBody>
              <div className="d-flex justify-content-between align-items-center mb-3">
                <h5 className="mb-0">Delivery challans</h5>
                <strong>Total challan value: {amount(totalChallans)}</strong>
              </div>
              <Table responsive hover className="mb-0">
                <thead>
                  <tr>
                    <th>Challan</th>
                    <th>Date</th>
                    <th>Total amount</th>
                    <th />
                  </tr>
                </thead>
                <tbody>
                  {challans.map((challan) => (
                    <tr key={challan._id}>
                      <td>
                        <Link to={`/challans/${challan._id}`}>{challan.challanNumber}</Link>
                      </td>
                      <td>{new Date(challan.challanDate).toLocaleDateString()}</td>
                      <td>{amount(challan.totalAmount)}</td>
                      <td className="text-end">
                        <Link to={`/challans/${challan._id}`}>
                          <Button size="sm" variant="outline-primary" className="me-2">
                            View
                          </Button>
                        </Link>
                        <Button
                          size="sm"
                          variant="outline-secondary"
                          className="me-2"
                          onClick={() => window.open(`/challans/${challan._id}?print=1`, '_blank')}>
                          Print
                        </Button>
                        <Button
                          size="sm"
                          variant="outline-success"
                          disabled={downloading === `challan-${challan._id}`}
                          onClick={() => { setDownloading(`challan-${challan._id}`); download(`/challans/${challan._id}/pdf`, `challan-${challan.challanNumber}.pdf`).catch((reason) => setError(reason instanceof Error ? reason.message : 'Unable to download challan')).finally(() => setDownloading('')) }}>
                          {downloading === `challan-${challan._id}` && <Spinner size="sm" className="me-2" />}Download
                        </Button>
                      </td>
                    </tr>
                  ))}
                  {!challans.length && (
                    <tr>
                      <td colSpan={4} className="text-center text-muted py-4">
                        No challans yet.
                      </td>
                    </tr>
                  )}
                </tbody>
              </Table>
            </CardBody>
          </Card>
        </>
      )}
    </>
  )
}

export default ClientOverviewPage
