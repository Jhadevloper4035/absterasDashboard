import PageMetaData from '@/components/PageTitle'
import { apiFetch } from '@/helpers/api'
import { FormEvent, useEffect, useMemo, useState } from 'react'
import { Link, useNavigate, useSearchParams } from 'react-router-dom'
import { Alert, Button, Card, CardBody, Form, Spinner, Table } from 'react-bootstrap'

type Client = { _id: string; name: string; state?: string; stateCode?: string }
type Line = { description: string; hsnCode: string; quantity: string; unit: string; unitPrice: string }
const blankLine = (): Line => ({ description: '', hsnCode: '', quantity: '1', unit: 'NOS', unitPrice: '' })

const CreateInvoicePage = () => {
  const navigate = useNavigate()
  const [params] = useSearchParams()
  const [clients, setClients] = useState<Client[]>([])
  const [client, setClient] = useState(params.get('client') || '')
  const [invoiceNumber, setInvoiceNumber] = useState('')
  const [financialYear, setFinancialYear] = useState('')
  const [invoiceDate, setInvoiceDate] = useState(new Date().toISOString().slice(0, 10))
  const [placeOfSupply, setPlaceOfSupply] = useState('')
  const [placeOfSupplyCode, setPlaceOfSupplyCode] = useState('')
  const [lines, setLines] = useState<Line[]>([blankLine()])
  const [igstRate, setIgstRate] = useState('18')
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  useEffect(() => {
    apiFetch<{ data: Client[] }>('/clients?limit=100')
      .then(({ data }) => setClients(data))
      .catch((reason) => setError(reason instanceof Error ? reason.message : 'Unable to load clients'))
  }, [])
  const selectedClient = clients.find((entry) => entry._id === client)
  const taxableAmount = useMemo(() => lines.reduce((sum, line) => sum + (Number(line.quantity) || 0) * (Number(line.unitPrice) || 0), 0), [lines])
  const igstAmount = (taxableAmount * (Number(igstRate) || 0)) / 100
  const setLine = (index: number, field: keyof Line, value: string) =>
    setLines((current) => current.map((line, lineIndex) => (lineIndex === index ? { ...line, [field]: value } : line)))
  const chooseClient = (id: string) => {
    setClient(id)
    const entry = clients.find((current) => current._id === id)
    setPlaceOfSupply(entry?.state || '')
    setPlaceOfSupplyCode(entry?.stateCode || '')
  }
  const submit = async (event: FormEvent) => {
    event.preventDefault()
    setSaving(true)
    setError('')
    try {
      await apiFetch('/invoices', {
        method: 'POST',
        body: JSON.stringify({
          invoiceNumber,
          financialYear,
          client,
          invoiceDate,
          placeOfSupply,
          placeOfSupplyCode,
          lineItems: lines.map((line) => ({
            ...line,
            quantity: Number(line.quantity),
            unitPrice: Number(line.unitPrice),
            lineAmount: Number(line.quantity) * Number(line.unitPrice),
          })),
          taxableAmount,
          igstAmount,
          grandTotal: taxableAmount + igstAmount,
        }),
      })
      navigate(`/clients/${client}`)
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : 'Unable to create invoice')
    } finally {
      setSaving(false)
    }
  }
  return (
    <>
      <PageMetaData title="Create Invoice" />
      <Card>
        <CardBody>
          <div className="d-flex justify-content-between align-items-start mb-4">
            <div>
              <h4 className="card-title mb-1">Create tax invoice</h4>
              <p className="text-muted mb-0">Invoice numbering stays manual until Step 8.</p>
            </div>
            <Link to={client ? `/clients/${client}` : '/clients'}>
              <Button variant="outline-secondary">Cancel</Button>
            </Link>
          </div>
          {error && <Alert variant="danger">{error}</Alert>}
          <Form onSubmit={submit}>
            <div className="row g-3">
              <div className="col-md-4">
                <Form.Label>Invoice number</Form.Label>
                <Form.Control required value={invoiceNumber} onChange={(event) => setInvoiceNumber(event.target.value)} />
              </div>
              <div className="col-md-4">
                <Form.Label>Financial year</Form.Label>
                <Form.Control
                  required
                  placeholder="2026-27"
                  pattern="[0-9]{4}-[0-9]{2}"
                  value={financialYear}
                  onChange={(event) => setFinancialYear(event.target.value)}
                />
              </div>
              <div className="col-md-4">
                <Form.Label>Invoice date</Form.Label>
                <Form.Control required type="date" value={invoiceDate} onChange={(event) => setInvoiceDate(event.target.value)} />
              </div>
              <div className="col-md-6">
                <Form.Label>Client</Form.Label>
                <Form.Select required value={client} onChange={(event) => chooseClient(event.target.value)}>
                  <option value="">Select client</option>
                  {clients.map((entry) => (
                    <option value={entry._id} key={entry._id}>
                      {entry.name}
                    </option>
                  ))}
                </Form.Select>
              </div>
              <div className="col-md-4">
                <Form.Label>Place of supply</Form.Label>
                <Form.Control value={placeOfSupply} onChange={(event) => setPlaceOfSupply(event.target.value)} />
              </div>
              <div className="col-md-2">
                <Form.Label>State code</Form.Label>
                <Form.Control
                  inputMode="numeric"
                  pattern="[0-9]{2}"
                  maxLength={2}
                  value={placeOfSupplyCode}
                  onChange={(event) => setPlaceOfSupplyCode(event.target.value)}
                />
              </div>
            </div>
            <div className="d-flex justify-content-between align-items-center mt-4 mb-2">
              <h5 className="mb-0">Items</h5>
              <Button type="button" size="sm" variant="outline-primary" onClick={() => setLines((current) => [...current, blankLine()])}>
                Add item
              </Button>
            </div>
            <Table responsive>
              <thead>
                <tr>
                  <th>Description</th>
                  <th>HSN</th>
                  <th>Qty</th>
                  <th>Unit</th>
                  <th>Unit price</th>
                  <th>Amount</th>
                  <th />
                </tr>
              </thead>
              <tbody>
                {lines.map((line, index) => {
                  const amount = (Number(line.quantity) || 0) * (Number(line.unitPrice) || 0)
                  return (
                    <tr key={index}>
                      <td>
                        <Form.Control required value={line.description} onChange={(event) => setLine(index, 'description', event.target.value)} />
                      </td>
                      <td>
                        <Form.Control value={line.hsnCode} onChange={(event) => setLine(index, 'hsnCode', event.target.value)} />
                      </td>
                      <td>
                        <Form.Control
                          required
                          type="number"
                          min="0"
                          step="any"
                          value={line.quantity}
                          onChange={(event) => setLine(index, 'quantity', event.target.value)}
                        />
                      </td>
                      <td>
                        <Form.Control value={line.unit} onChange={(event) => setLine(index, 'unit', event.target.value)} />
                      </td>
                      <td>
                        <Form.Control
                          required
                          type="number"
                          min="0"
                          step="0.01"
                          value={line.unitPrice}
                          onChange={(event) => setLine(index, 'unitPrice', event.target.value)}
                        />
                      </td>
                      <td>{amount.toFixed(2)}</td>
                      <td>
                        {lines.length > 1 && (
                          <Button
                            type="button"
                            size="sm"
                            variant="outline-danger"
                            onClick={() => setLines((current) => current.filter((_, lineIndex) => lineIndex !== index))}>
                            ×
                          </Button>
                        )}
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </Table>
            <div className="row justify-content-end">
              <div className="col-md-4">
                <Form.Label>IGST rate (%)</Form.Label>
                <Form.Control type="number" min="0" step="0.01" value={igstRate} onChange={(event) => setIgstRate(event.target.value)} />
                <div className="text-end mt-3">
                  <div>Taxable: {taxableAmount.toFixed(2)}</div>
                  <div>IGST: {igstAmount.toFixed(2)}</div>
                  <strong>Grand total: {(taxableAmount + igstAmount).toFixed(2)}</strong>
                </div>
              </div>
            </div>
            <div className="d-flex justify-content-end mt-4">
              <Button type="submit" disabled={saving || !selectedClient}>
                {saving && <Spinner size="sm" className="me-2" />} {saving ? 'Creating…' : 'Create invoice'}
              </Button>
            </div>
          </Form>
        </CardBody>
      </Card>
    </>
  )
}

export default CreateInvoicePage
