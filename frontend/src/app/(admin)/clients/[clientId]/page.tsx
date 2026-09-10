import PageMetaData from '@/components/PageTitle'
import { apiFetch } from '@/helpers/api'
import { useEffect, useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import { Alert, Badge, Button, Card, CardBody, Table } from 'react-bootstrap'
import type { Client } from '../client-form'

type Site = Pick<Client, '_id' | 'name' | 'siteName' | 'siteAddress' | 'status'>
const amount = (value?: number) => value?.toLocaleString(undefined, { minimumFractionDigits: 2 }) || '0.00'

const ClientOverviewPage = () => {
  const { clientId } = useParams()
  const [client, setClient] = useState<Client>()
  const [sites, setSites] = useState<Site[]>([])
  const [error, setError] = useState('')
  useEffect(() => {
    if (!clientId) return
    apiFetch<{ data: Client }>(`/clients/${clientId}`)
      .then(async (clientResponse) => {
        const parentClientId = typeof clientResponse.data.parentClient === 'string' ? clientResponse.data.parentClient : clientResponse.data.parentClient?._id
        const siteResponse = parentClientId ? { data: [] as Site[] } : await apiFetch<{ data: Site[] }>(`/clients?parentClient=${clientResponse.data._id}&limit=100`)
        setClient(clientResponse.data)
        setSites(siteResponse.data)
      })
      .catch((reason) => setError(reason instanceof Error ? reason.message : 'Unable to load client'))
  }, [clientId])
  const parentClientId = client && (typeof client.parentClient === 'string' ? client.parentClient : client.parentClient?._id)
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
          {!parentClientId && (
            <Card className="mb-3">
              <CardBody>
                <h5 className="mb-3">Client sites</h5>
                <Table responsive hover className="mb-0">
                  <thead>
                    <tr>
                      <th>Project</th>
                      <th>Address</th>
                      <th>Status</th>
                      <th />
                    </tr>
                  </thead>
                  <tbody>
                    {sites.map((site) => (
                      <tr key={site._id}>
                        <td>{site.siteName || site.name}</td>
                        <td>{site.siteAddress || '-'}</td>
                        <td><Badge bg={site.status === 'active' ? 'success' : site.status === 'completed' ? 'secondary' : 'warning'}>{site.status}</Badge></td>
                        <td className="text-end"><Link to={`/clients/${site._id}`}><Button size="sm" variant="outline-primary">View</Button></Link></td>
                      </tr>
                    ))}
                    {!sites.length && <tr><td colSpan={4} className="text-center text-muted py-4">No sites yet.</td></tr>}
                  </tbody>
                </Table>
              </CardBody>
            </Card>
          )}
        </>
      )}
    </>
  )
}

export default ClientOverviewPage
