import PageMetaData from '@/components/PageTitle'
import PdfActionButton from '@/components/PdfActionButton'
import { apiFetch } from '@/helpers/api'
import { downloadPdf, printPdf } from '@/helpers/pdf'
import { useAuthStore } from '@/store/authStore'
import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { Alert, Badge, Button, Card, CardBody, Form, Spinner, Table } from 'react-bootstrap'

type Client = { _id: string; name: string }
type Challan = { _id: string; challanNumber: string; challanDate: string; totalAmount: number; transferType?: 'delivery' | 'return_transfer'; client?: Client }
const ChallansPage = () => {
  const [clients, setClients] = useState<Client[]>([])
  const [challans, setChallans] = useState<Challan[]>([])
  const [search, setSearch] = useState('')
  const [client, setClient] = useState('')
  const [error, setError] = useState('')
  const [downloading, setDownloading] = useState('')
  const token = useAuthStore((state) => state.token)
  const load = () => {
    const query = new URLSearchParams()
    if (search) query.set('q', search)
    if (client) query.set('client', client)
    apiFetch<{ data: Challan[] }>(`/challans?${query}`)
      .then(({ data }) => setChallans(data))
      .catch((reason) => setError(reason instanceof Error ? reason.message : 'Unable to load challans'))
  }
  useEffect(() => {
    apiFetch<{ data: Client[] }>('/clients?limit=100')
      .then(({ data }) => setClients(data))
      .catch((reason) => setError(reason instanceof Error ? reason.message : 'Unable to load clients'))
  }, [])
  useEffect(() => {
    load()
  }, [search, client])
  const download = (challan: Challan) => downloadPdf(`/challans/${challan._id}/pdf`, `challan-${challan.challanNumber}.pdf`, token)
  return (
    <>
      <PageMetaData title="Delivery Challans" />
      <Card className="mb-3">
        <CardBody>
          <div className="d-flex justify-content-between align-items-start flex-wrap gap-3">
            <div>
              <h4 className="card-title mb-1">Delivery challans</h4>
              <p className="text-muted mb-0">Filter by challan number or client.</p>
            </div>
            <Link to="/challans/create">
              <Button>Create challan</Button>
            </Link>
          </div>
          {error && (
            <Alert className="mt-3 mb-0" variant="danger">
              {error}
            </Alert>
          )}
        </CardBody>
      </Card>
      <Card>
        <CardBody>
          <div className="row g-2 mb-3">
            <div className="col-md-6">
              <Form.Control placeholder="Search challan number" value={search} onChange={(event) => setSearch(event.target.value)} />
            </div>
            <div className="col-md-6">
              <Form.Select value={client} onChange={(event) => setClient(event.target.value)}>
                <option value="">All clients</option>
                {clients.map((entry) => (
                  <option key={entry._id} value={entry._id}>
                    {entry.name}
                  </option>
                ))}
              </Form.Select>
            </div>
          </div>
          <Table responsive hover className="mb-0">
            <thead>
              <tr>
                <th>Challan</th>
                <th>Type</th>
                <th>Client</th>
                <th>Date</th>
                <th>Total amount</th>
                <th />
              </tr>
            </thead>
            <tbody>
              {challans.map((challan) => (
                <tr key={challan._id}>
                  <td>{challan.challanNumber}</td>
                  <td><Badge bg={challan.transferType === 'return_transfer' ? 'primary' : 'secondary'}>{challan.transferType === 'return_transfer' ? 'Return transfer' : 'Delivery'}</Badge></td>
                  <td>{challan.client?.name || '-'}</td>
                  <td>{new Date(challan.challanDate).toLocaleDateString()}</td>
                  <td>{challan.totalAmount.toLocaleString(undefined, { minimumFractionDigits: 2 })}</td>
                  <td className="text-end">
                    <Link to={`/challans/${challan._id}`}>
                      <Button size="sm" variant="outline-primary" className="me-2">
                        View
                      </Button>
                    </Link>
                    <PdfActionButton
                      size="sm"
                      variant="outline-secondary"
                      className="me-2"
                      action={() => printPdf(`/challans/${challan._id}/pdf`, token).catch((reason) => setError(reason instanceof Error ? reason.message : 'Unable to open delivery challan PDF'))}>
                      Print
                    </PdfActionButton>
                    <Button
                      size="sm"
                      variant="outline-success"
                      disabled={downloading === challan._id}
                      onClick={() => { setDownloading(challan._id); download(challan).catch((reason) => setError(reason instanceof Error ? reason.message : 'Unable to download challan')).finally(() => setDownloading('')) }}>
                      {downloading === challan._id && <Spinner size="sm" className="me-2" />}Download
                    </Button>
                  </td>
                </tr>
              ))}
              {!challans.length && (
                <tr>
                  <td colSpan={6} className="text-center text-muted py-4">
                    No delivery challans found.
                  </td>
                </tr>
              )}
            </tbody>
          </Table>
        </CardBody>
      </Card>
    </>
  )
}
export default ChallansPage
