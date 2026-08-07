import PageMetaData from '@/components/PageTitle'
import { apiFetch } from '@/helpers/api'
import { FormEvent, useEffect, useMemo, useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import { Alert, Button, Card, CardBody, Form, Spinner, Table } from 'react-bootstrap'

type Client = { _id: string; name: string }
type Line = { description: string; hsnCode: string; quantity: string; unit: string; rate: string }
type Challan = {
  challanNumber: string
  client: string | { _id: string }
  challanDate: string
  transportType?: string
  vehicleNumber?: string
  eWayBillNumber?: string
  freightCharge: number
  gstAmount: number
  lineItems: { description: string; hsnCode?: string; quantity: number; unit?: string; rate: number }[]
}
const blank = (): Line => ({ description: '', hsnCode: '', quantity: '1', unit: 'NOS', rate: '' })

const ChallanFormPage = () => {
  const { challanId } = useParams()
  const navigate = useNavigate()
  const [clients, setClients] = useState<Client[]>([])
  const [challanNumber, setChallanNumber] = useState('')
  const [client, setClient] = useState('')
  const [challanDate, setChallanDate] = useState(new Date().toISOString().slice(0, 10))
  const [transportType, setTransportType] = useState('')
  const [vehicleNumber, setVehicleNumber] = useState('')
  const [eWayBillNumber, setEWayBillNumber] = useState('')
  const [freightCharge, setFreightCharge] = useState('0')
  const [gstRate, setGstRate] = useState('18')
  const [lines, setLines] = useState<Line[]>([blank()])
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  useEffect(() => {
    apiFetch<{ data: Client[] }>('/clients?limit=100')
      .then(({ data }) => setClients(data))
      .catch((reason) => setError(reason instanceof Error ? reason.message : 'Unable to load clients'))
    if (challanId)
      apiFetch<{ data: Challan }>(`/challans/${challanId}`)
        .then(({ data }) => {
          setChallanNumber(data.challanNumber)
          setClient(typeof data.client === 'string' ? data.client : data.client._id)
          setChallanDate(data.challanDate.slice(0, 10))
          setTransportType(data.transportType || '')
          setVehicleNumber(data.vehicleNumber || '')
          setEWayBillNumber(data.eWayBillNumber || '')
          setFreightCharge(String(data.freightCharge))
          setLines(
            data.lineItems.map((line) => ({
              description: line.description,
              hsnCode: line.hsnCode || '',
              quantity: String(line.quantity),
              unit: line.unit || '',
              rate: String(line.rate),
            })),
          )
        })
        .catch((reason) => setError(reason instanceof Error ? reason.message : 'Unable to load challan'))
  }, [challanId])
  const taxableAmount = useMemo(() => lines.reduce((sum, line) => sum + (Number(line.quantity) || 0) * (Number(line.rate) || 0), 0), [lines])
  const gstAmount = (taxableAmount * (Number(gstRate) || 0)) / 100
  const totalAmount = taxableAmount + gstAmount + (Number(freightCharge) || 0)
  const setLine = (index: number, field: keyof Line, value: string) =>
    setLines((current) => current.map((line, lineIndex) => (lineIndex === index ? { ...line, [field]: value } : line)))
  const submit = async (event: FormEvent) => {
    event.preventDefault()
    setSaving(true)
    setError('')
    try {
      const body = {
        challanNumber,
        client,
        challanDate,
        transportType,
        vehicleNumber,
        eWayBillNumber,
        freightCharge: Number(freightCharge),
        lineItems: lines.map((line) => ({
          ...line,
          quantity: Number(line.quantity),
          rate: Number(line.rate),
          amount: Number(line.quantity) * Number(line.rate),
        })),
        taxableAmount,
        gstAmount,
        totalAmount,
      }
      const result = await apiFetch<{ data: { _id: string } }>(challanId ? `/challans/${challanId}` : '/challans', {
        method: challanId ? 'PATCH' : 'POST',
        body: JSON.stringify(body),
      })
      navigate(`/challans/${result.data._id}`)
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : 'Unable to save challan')
    } finally {
      setSaving(false)
    }
  }
  return (
    <>
      <PageMetaData title={challanId ? 'Update Challan' : 'Create Challan'} />
      <Card>
        <CardBody>
          <div className="d-flex justify-content-between align-items-start mb-4">
            <div>
              <h4 className="card-title mb-1">{challanId ? 'Update delivery challan' : 'Create delivery challan'}</h4>
              <p className="text-muted mb-0">Challan numbering stays manual until Step 8.</p>
            </div>
            <Link to="/challans">
              <Button variant="outline-secondary">Cancel</Button>
            </Link>
          </div>
          {error && <Alert variant="danger">{error}</Alert>}
          <Form onSubmit={submit}>
            <div className="row g-3">
              <div className="col-md-4">
                <Form.Label>Challan number</Form.Label>
                <Form.Control required value={challanNumber} onChange={(event) => setChallanNumber(event.target.value)} />
              </div>
              <div className="col-md-4">
                <Form.Label>Challan date</Form.Label>
                <Form.Control required type="date" value={challanDate} onChange={(event) => setChallanDate(event.target.value)} />
              </div>
              <div className="col-md-4">
                <Form.Label>Client</Form.Label>
                <Form.Select required value={client} onChange={(event) => setClient(event.target.value)}>
                  <option value="">Select client</option>
                  {clients.map((entry) => (
                    <option key={entry._id} value={entry._id}>
                      {entry.name}
                    </option>
                  ))}
                </Form.Select>
              </div>
              <div className="col-md-4">
                <Form.Label>Transport type</Form.Label>
                <Form.Control value={transportType} onChange={(event) => setTransportType(event.target.value)} />
              </div>
              <div className="col-md-4">
                <Form.Label>Vehicle number</Form.Label>
                <Form.Control value={vehicleNumber} onChange={(event) => setVehicleNumber(event.target.value)} />
              </div>
              <div className="col-md-4">
                <Form.Label>E-way bill number</Form.Label>
                <Form.Control value={eWayBillNumber} onChange={(event) => setEWayBillNumber(event.target.value)} />
              </div>
            </div>
            <div className="d-flex justify-content-between align-items-center mt-4 mb-2">
              <h5 className="mb-0">Goods</h5>
              <Button type="button" size="sm" variant="outline-primary" onClick={() => setLines((current) => [...current, blank()])}>
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
                  <th>Rate</th>
                  <th>Amount</th>
                  <th />
                </tr>
              </thead>
              <tbody>
                {lines.map((line, index) => (
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
                        value={line.rate}
                        onChange={(event) => setLine(index, 'rate', event.target.value)}
                      />
                    </td>
                    <td>{((Number(line.quantity) || 0) * (Number(line.rate) || 0)).toFixed(2)}</td>
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
                ))}
              </tbody>
            </Table>
            <div className="row justify-content-end">
              <div className="col-md-4">
                <Form.Label>Freight charge</Form.Label>
                <Form.Control type="number" min="0" step="0.01" value={freightCharge} onChange={(event) => setFreightCharge(event.target.value)} />
                <Form.Label className="mt-2">GST rate (%)</Form.Label>
                <Form.Control type="number" min="0" step="0.01" value={gstRate} onChange={(event) => setGstRate(event.target.value)} />
                <div className="text-end mt-3">
                  Taxable: {taxableAmount.toFixed(2)}
                  <br />
                  GST: {gstAmount.toFixed(2)}
                  <br />
                  <strong>Total: {totalAmount.toFixed(2)}</strong>
                </div>
              </div>
            </div>
            <div className="d-flex justify-content-end mt-4">
              <Button type="submit" disabled={saving}>
                {saving && <Spinner size="sm" className="me-2" />}
                {saving ? 'Saving…' : challanId ? 'Update challan' : 'Create challan'}
              </Button>
            </div>
          </Form>
        </CardBody>
      </Card>
    </>
  )
}

export default ChallanFormPage
