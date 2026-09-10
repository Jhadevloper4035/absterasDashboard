import PageMetaData from '@/components/PageTitle'
import PdfActionButton from '@/components/PdfActionButton'
import { apiFetch } from '@/helpers/api'
import { downloadPdf, printPdf } from '@/helpers/pdf'
import { useAuthStore } from '@/store/authStore'
import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { Alert, Badge, Button, Card, CardBody, Form, Spinner, Table } from 'react-bootstrap'

type Client = { _id: string; name: string }
type Challan = { _id: string; challanNumber: string; challanDate: string; transferType: string; process: string; client?: Client; siteName?: string; counterpartyName?: string; itemCount: number; workflowLink: string; isCentralChallan: boolean; pdfPath: string }
const typeLabel = (type: string) => ({ delivery: 'Delivery', return_transfer: 'Return transfer', inventory_to_laser_cut: 'Inventory to Laser Cut', laser_cut_return: 'Laser Cut return', inventory_to_powder_coating: 'Inventory to Powder Coating', laser_cut_to_powder_coating: 'Laser Cut to Powder Coating', powder_coating_to_client: 'Powder Coating to Client', powder_coating_return: 'Powder Coating return' }[type] || type)
const ChallansPage = () => {
  const [clients, setClients] = useState<Client[]>([])
  const [challans, setChallans] = useState<Challan[]>([])
  const [search, setSearch] = useState('')
  const [client, setClient] = useState('')
  const [transferType, setTransferType] = useState('')
  const [error, setError] = useState('')
  const [downloading, setDownloading] = useState('')
  const token = useAuthStore((state) => state.token)
  const load = () => {
    const query = new URLSearchParams()
    if (search) query.set('q', search)
    if (client) query.set('client', client)
    if (transferType) query.set('type', transferType)
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
  }, [search, client, transferType])
  const download = (challan: Challan) => downloadPdf(challan.pdfPath, `challan-${challan.challanNumber}.pdf`, token)
  return (
    <>
      <PageMetaData title="Delivery Challans" />
      <Card className="mb-3">
        <CardBody>
          <div className="d-flex justify-content-between align-items-start flex-wrap gap-3">
            <div>
              <h4 className="card-title mb-1">Delivery challans</h4>
              <p className="text-muted mb-0">Every inventory, Laser Cut, Powder Coating, and client delivery challan is shown here.</p>
            </div>
            <div className="d-flex gap-2">
              <Link to="/challans/create?type=hardware"><Button variant="outline-primary">Deliver hardware to client site</Button></Link>
              <Link to="/challans/create"><Button>Create challan</Button></Link>
            </div>
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
            <div className="col-md-4">
              <Form.Control placeholder="Search challan number" value={search} onChange={(event) => setSearch(event.target.value)} />
            </div>
            <div className="col-md-4">
              <Form.Select value={client} onChange={(event) => setClient(event.target.value)}>
                <option value="">All clients</option>
                {clients.map((entry) => (
                  <option key={entry._id} value={entry._id}>
                    {entry.name}
                  </option>
                ))}
              </Form.Select>
            </div>
            <div className="col-md-4">
              <Form.Select value={transferType} onChange={(event) => setTransferType(event.target.value)}>
                <option value="">All challan types</option>
                <option value="delivery">Delivery</option>
                <option value="return_transfer">Return transfer</option>
                <option value="inventory_to_laser_cut">Inventory to Laser Cut</option>
                <option value="inventory_to_powder_coating">Inventory to Powder Coating</option>
                <option value="laser_cut_to_powder_coating">Laser Cut to Powder Coating</option>
                <option value="powder_coating_to_client">Powder Coating to Client</option>
              </Form.Select>
            </div>
          </div>
          <Table responsive hover className="mb-0" style={{ minWidth: 1260 }}>
            <thead>
              <tr>
                <th>Challan</th>
                <th>Movement</th>
                <th>Client / Site</th>
                <th>Counterparty</th>
                <th>Date</th>
                <th style={{ minWidth: 290 }} />
              </tr>
            </thead>
            <tbody>
              {challans.map((challan) => (
                <tr key={challan._id}>
                  <td><div className="fw-semibold">{challan.challanNumber}</div><small className="text-muted">{challan.itemCount} item{challan.itemCount === 1 ? '' : 's'}</small></td>
                  <td><Badge bg={challan.process === 'Powder Coating' ? 'warning' : challan.process === 'Laser Cut' ? 'primary' : 'secondary'}>{typeLabel(challan.transferType)}</Badge><small className="text-muted d-block mt-1">{challan.process}</small></td>
                  <td><div>{challan.client?.name || '-'}</div>{challan.siteName && <small className="text-muted">{challan.siteName}</small>}</td>
                  <td>{challan.counterpartyName || '-'}</td>
                  <td>{new Date(challan.challanDate).toLocaleDateString()}</td>
                  <td className="text-end">
                    <div className="d-inline-flex align-items-center gap-2 flex-nowrap">
                    <Link to={challan.workflowLink}>
                      <Button size="sm" variant="outline-primary" className="text-nowrap">
                        {challan.isCentralChallan ? 'View' : 'Open order'}
                      </Button>
                    </Link>
                    <PdfActionButton
                      size="sm"
                      variant="outline-secondary"
                      className="text-nowrap"
                      action={() => printPdf(challan.pdfPath, token).catch((reason) => setError(reason instanceof Error ? reason.message : 'Unable to open challan PDF'))}>
                      Print
                    </PdfActionButton>
                    <Button
                      size="sm"
                      variant="outline-success"
                      className="text-nowrap"
                      disabled={downloading === challan._id}
                      onClick={() => { setDownloading(challan._id); download(challan).catch((reason) => setError(reason instanceof Error ? reason.message : 'Unable to download challan')).finally(() => setDownloading('')) }}>
                      {downloading === challan._id && <Spinner size="sm" className="me-2" />}Download
                    </Button>
                    </div>
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
