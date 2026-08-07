import PageMetaData from '@/components/PageTitle'
import { apiFetch } from '@/helpers/api'
import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { Alert, Badge, Button, Card, CardBody, Form, Table } from 'react-bootstrap'

type Client = { _id: string; name: string }
type Invoice = { _id: string; invoiceNumber: string; invoiceDate: string; grandTotal: number; status: 'unpaid' | 'partially paid' | 'paid'; client?: Client }

const InvoicesPage = () => {
  const [clients, setClients] = useState<Client[]>([])
  const [invoices, setInvoices] = useState<Invoice[]>([])
  const [search, setSearch] = useState('')
  const [client, setClient] = useState('')
  const [status, setStatus] = useState('')
  const [error, setError] = useState('')
  const load = () => { const query = new URLSearchParams(); if (search) query.set('q', search); if (client) query.set('client', client); if (status) query.set('status', status); apiFetch<{ data: Invoice[] }>(`/invoices?${query}`).then(({ data }) => setInvoices(data)).catch((reason) => setError(reason instanceof Error ? reason.message : 'Unable to load invoices')) }
  useEffect(() => { apiFetch<{ data: Client[] }>('/clients?limit=100').then(({ data }) => setClients(data)).catch((reason) => setError(reason instanceof Error ? reason.message : 'Unable to load clients')) }, [])
  useEffect(() => { load() }, [search, client, status])
  return <><PageMetaData title="Invoices" /><Card className="mb-3"><CardBody><div className="d-flex justify-content-between align-items-start flex-wrap gap-3"><div><h4 className="card-title mb-1">Invoices</h4><p className="text-muted mb-0">Filter invoices by number, client, or payment status.</p></div><Link to="/invoices/create"><Button>Create invoice</Button></Link></div>{error && <Alert className="mt-3 mb-0" variant="danger">{error}</Alert>}</CardBody></Card><Card><CardBody><div className="row g-2 mb-3"><div className="col-md-4"><Form.Control placeholder="Search invoice number" value={search} onChange={(event) => setSearch(event.target.value)} /></div><div className="col-md-4"><Form.Select value={client} onChange={(event) => setClient(event.target.value)}><option value="">All clients</option>{clients.map((entry) => <option key={entry._id} value={entry._id}>{entry.name}</option>)}</Form.Select></div><div className="col-md-4"><Form.Select value={status} onChange={(event) => setStatus(event.target.value)}><option value="">All payment statuses</option><option value="unpaid">Unpaid</option><option value="partially paid">Partially paid</option><option value="paid">Paid</option></Form.Select></div></div><Table responsive hover className="mb-0"><thead><tr><th>Invoice</th><th>Client</th><th>Date</th><th>Grand total</th><th>Status</th><th /></tr></thead><tbody>{invoices.map((invoice) => <tr key={invoice._id}><td>{invoice.invoiceNumber}</td><td>{invoice.client ? <Link to={`/clients/${invoice.client._id}`}>{invoice.client.name}</Link> : '-'}</td><td>{new Date(invoice.invoiceDate).toLocaleDateString()}</td><td>{invoice.grandTotal.toLocaleString(undefined, { minimumFractionDigits: 2 })}</td><td><Badge bg={invoice.status === 'paid' ? 'success' : invoice.status === 'partially paid' ? 'warning' : 'secondary'}>{invoice.status}</Badge></td><td className="text-end"><Link to={`/invoices/${invoice._id}`}><Button size="sm" variant="outline-primary" className="me-2">View</Button></Link><Button size="sm" variant="outline-secondary" onClick={() => window.open(`/invoices/${invoice._id}?print=1`, '_blank')}>Print</Button></td></tr>)}{!invoices.length && <tr><td colSpan={6} className="text-center text-muted py-4">No invoices found.</td></tr>}</tbody></Table></CardBody></Card></>
}

export default InvoicesPage
