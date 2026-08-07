import PageMetaData from '@/components/PageTitle'
import { apiFetch } from '@/helpers/api'
import { buildApiUrl } from '@/helpers/apiUrl'
import { useAuthStore } from '@/store/authStore'
import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { Alert, Button, Card, CardBody, Form, Spinner, Table } from 'react-bootstrap'

type Client = { _id: string; name: string }
type Challan = { _id: string; challanNumber: string; challanDate: string; totalAmount: number; client?: Client }
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
  const download = async (challan: Challan) => {
    const response = await fetch(buildApiUrl(`/challans/${challan._id}/pdf`), {
      headers: token ? { Authorization: `Bearer ${token}` } : {},
      credentials: 'include',
    })
    if (!response.ok) throw new Error('Unable to download challan')
    const url = URL.createObjectURL(await response.blob())
    const link = document.createElement('a')
    link.href = url
    link.download = `challan-${challan.challanNumber}.pdf`
    link.click()
    URL.revokeObjectURL(url)
  }
  return (
    <>
      <PageMetaData title="Challans" />
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
                  <td>{challan.client?.name || '-'}</td>
                  <td>{new Date(challan.challanDate).toLocaleDateString()}</td>
                  <td>{challan.totalAmount.toLocaleString(undefined, { minimumFractionDigits: 2 })}</td>
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
                      disabled={downloading === challan._id}
                      onClick={() => { setDownloading(challan._id); download(challan).catch((reason) => setError(reason instanceof Error ? reason.message : 'Unable to download challan')).finally(() => setDownloading('')) }}>
                      {downloading === challan._id && <Spinner size="sm" className="me-2" />}Download
                    </Button>
                  </td>
                </tr>
              ))}
              {!challans.length && (
                <tr>
                  <td colSpan={5} className="text-center text-muted py-4">
                    No challans found.
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
