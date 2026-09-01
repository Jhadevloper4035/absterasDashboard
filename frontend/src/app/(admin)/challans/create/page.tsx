import PageMetaData from '@/components/PageTitle'
import { apiFetch } from '@/helpers/api'
import { generatedChallanNumber } from '@/helpers/documentNumber'
import { FormEvent, useEffect, useState } from 'react'
import { Link, useNavigate, useParams, useSearchParams } from 'react-router-dom'
import { Alert, Button, Card, CardBody, Form, Spinner, Table } from 'react-bootstrap'

type Client = { _id: string; name: string; siteName?: string; siteAddress?: string; billingAddress?: string; shippingAddress?: string; parentClient?: string | { _id: string } }
type Supplier = { _id: string; name: string; address?: string }
type InventoryItem = { _id: string; name: string; sku: string; category?: string; hsnCode?: string; unit: string; quantityInStock: number; supplier?: Supplier }
type Line = { inventoryItem?: string; description: string; hsnCode: string; quantity: string; unit: string }
type Challan = {
  challanNumber: string
  client: string | { _id: string }
  site?: string | { _id: string }
  supplier?: string | Supplier
  challanDate: string
  pickupAddress?: string
  transportType?: string
  vehicleNumber?: string
  eWayBillNumber?: string
  lineItems: { inventoryItem?: string; description: string; hsnCode?: string; quantity: number; unit?: string }[]
}
const blank = (): Line => ({ description: '', hsnCode: '', quantity: '1', unit: 'NOS' })

const ChallanFormPage = () => {
  const { challanId } = useParams()
  const navigate = useNavigate()
  const [params] = useSearchParams()
  const hardwareOnly = params.get('type') === 'hardware'
  const [clients, setClients] = useState<Client[]>([])
  const [materials, setMaterials] = useState<InventoryItem[]>([])
  const [suppliers, setSuppliers] = useState<Supplier[]>([])
  const [challanNumber, setChallanNumber] = useState(generatedChallanNumber)
  const [client, setClient] = useState(params.get('client') || '')
  const [site, setSite] = useState(params.get('site') || '')
  const [supplier, setSupplier] = useState('')
  const [challanDate, setChallanDate] = useState(new Date().toISOString().slice(0, 10))
  const [pickupAddress, setPickupAddress] = useState('')
  const [transportType, setTransportType] = useState('')
  const [vehicleNumber, setVehicleNumber] = useState('')
  const [eWayBillNumber, setEWayBillNumber] = useState('')
  const [lines, setLines] = useState<Line[]>([blank()])
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  useEffect(() => {
    apiFetch<{ data: Client[] }>('/clients?limit=100')
      .then(({ data }) => setClients(data))
      .catch((reason) => setError(reason instanceof Error ? reason.message : 'Unable to load clients'))
    apiFetch<{ data: InventoryItem[] }>('/inventory/items?limit=100')
      .then(({ data }) => setMaterials(data))
      .catch(() => {})
    apiFetch<{ data: Supplier[] }>('/inventory/suppliers?status=active')
      .then(({ data }) => setSuppliers(data))
      .catch(() => {})
    if (challanId)
      apiFetch<{ data: Challan }>(`/challans/${challanId}`)
        .then(({ data }) => {
          setChallanNumber(data.challanNumber)
          setClient(typeof data.client === 'string' ? data.client : data.client._id)
          setSite(typeof data.site === 'string' ? data.site : data.site?._id || '')
          setSupplier(typeof data.supplier === 'string' ? data.supplier : data.supplier?._id || '')
          setChallanDate(data.challanDate.slice(0, 10))
          setPickupAddress(data.pickupAddress || '')
          setTransportType(data.transportType || '')
          setVehicleNumber(data.vehicleNumber || '')
          setEWayBillNumber(data.eWayBillNumber || '')
          setLines(
            data.lineItems.map((line) => ({
              description: line.description,
              hsnCode: line.hsnCode || '',
          quantity: String(line.quantity),
          inventoryItem: line.inventoryItem,
              unit: line.unit || '',
            })),
          )
        })
        .catch((reason) => setError(reason instanceof Error ? reason.message : 'Unable to load challan'))
  }, [challanId])
  const parentClients = clients.filter((entry) => !entry.parentClient)
  const selectableMaterials = hardwareOnly ? materials.filter((item) => item.category === 'hardware') : materials
  const sites = clients.filter((entry) => String(typeof entry.parentClient === 'string' ? entry.parentClient : entry.parentClient?._id) === client)
  const selectedClient = clients.find((entry) => entry._id === client)
  const clientAddress = selectedClient?.shippingAddress || selectedClient?.billingAddress || ''
  useEffect(() => {
    if (!client || site || !clients.length || sites.length || !clientAddress) return
    setSite('client-address')
  }, [client, site, clients.length, sites.length, clientAddress])
  const chooseClient = (id: string) => {
    setClient(id)
    const entry = clients.find((current) => current._id === id)
    const hasSites = clients.some((current) => String(typeof current.parentClient === 'string' ? current.parentClient : current.parentClient?._id) === id)
    setSite(hasSites ? '' : entry?.shippingAddress || entry?.billingAddress ? 'client-address' : '')
  }
  const setLine = (index: number, field: keyof Line, value: string) =>
    setLines((current) => current.map((line, lineIndex) => (lineIndex === index ? { ...line, [field]: value } : line)))
  const chooseMaterial = (index: number, id: string) => {
    const material = materials.find((item) => item._id === id)
    setLines((current) => current.map((line, lineIndex) => lineIndex === index ? { ...line, inventoryItem: id || undefined, description: material?.name || '', hsnCode: material?.hsnCode || '0000', unit: material?.unit || line.unit } : line))
    if (!supplier && material?.supplier) chooseSupplier(material.supplier._id)
  }
  const chooseSupplier = (id: string) => {
    const selected = suppliers.find((entry) => entry._id === id) || materials.find((item) => item.supplier?._id === id)?.supplier
    setSupplier(id)
    if (selected?.address) setPickupAddress(selected.address)
  }
  const submit = async (event: FormEvent) => {
    event.preventDefault()
    setSaving(true)
    setError('')
    try {
      const body = {
        challanNumber,
        client,
        site: site === 'client-address' ? null : site || null,
        supplier: supplier || null,
        challanDate,
        pickupAddress,
        transportType,
        vehicleNumber,
        eWayBillNumber,
        ...(challanId ? {} : { lineItems: lines.map((line) => ({
          ...line,
          quantity: Number(line.quantity),
        })) }),
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
              <h4 className="card-title mb-1">{challanId ? 'Update delivery challan' : hardwareOnly ? 'Send hardware to client site' : 'Create delivery challan'}</h4>
              <p className="text-muted mb-0">{hardwareOnly ? 'Hardware is sent directly from inventory to the selected client address.' : 'A unique challan number is generated automatically when you save.'}</p>
            </div>
            <Link to="/challans">
              <Button variant="outline-secondary">Cancel</Button>
            </Link>
          </div>
          {error && <Alert variant="danger">{error}</Alert>}
          <Form onSubmit={submit}>
            {!challanId && (
              <div className="d-flex flex-wrap gap-2 mb-4" role="tablist" aria-label="Challan type">
                <Link className={`btn ${hardwareOnly ? 'btn-outline-primary' : 'btn-primary'}`} role="tab" aria-selected={!hardwareOnly} to="/challans/create">Inventory challan</Link>
                <Link className={`btn ${hardwareOnly ? 'btn-primary' : 'btn-outline-primary'}`} role="tab" aria-selected={hardwareOnly} to="/challans/create?type=hardware">Hardware challan</Link>
                <Link className="btn btn-outline-primary" role="tab" to="/returns/transfers/create">Return challan</Link>
              </div>
            )}
            <div className="row g-3">
              <div className="col-md-4">
                <Form.Label>Generated challan number</Form.Label>
                <Form.Control readOnly value={challanNumber} />
              </div>
              <div className="col-md-4">
                <Form.Label>Challan date</Form.Label>
                <Form.Control required type="date" value={challanDate} onChange={(event) => setChallanDate(event.target.value)} />
              </div>
              <div className="col-md-4">
                <Form.Label>Parent client</Form.Label>
                <Form.Select required value={client} onChange={(event) => chooseClient(event.target.value)}>
                  <option value="">Select parent client</option>
                  {parentClients.map((entry) => (
                    <option key={entry._id} value={entry._id}>
                      {entry.name}
                    </option>
                  ))}
                </Form.Select>
              </div>
              <div className="col-md-4">
                <Form.Label>{hardwareOnly ? 'Client delivery site' : 'Delivery address'}</Form.Label>
                <Form.Select value={site} disabled={!client || (!sites.length && !clientAddress)} required onChange={(event) => setSite(event.target.value)}>
                  <option value="">{client ? 'Select delivery address' : 'Select client first'}</option>
                  {sites.length
                    ? sites.map((entry) => <option key={entry._id} value={entry._id}>{entry.siteName || entry.name}{entry.siteAddress ? ` · ${entry.siteAddress}` : ''}</option>)
                    : clientAddress && <option value="client-address">Client address · {clientAddress}</option>}
                </Form.Select>
              </div>
              <div className="col-md-4">
                <Form.Label>Vendor</Form.Label>
                <Form.Select value={supplier} onChange={(event) => chooseSupplier(event.target.value)}>
                  <option value="">Select vendor</option>
                  {suppliers.map((entry) => <option key={entry._id} value={entry._id}>{entry.name}</option>)}
                </Form.Select>
              </div>
              <div className="col-md-8">
                <Form.Label>Vendor site address</Form.Label>
                <Form.Control as="textarea" rows={2} value={pickupAddress} onChange={(event) => setPickupAddress(event.target.value)} placeholder="Filled from the selected vendor or inventory material" />
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
              <div>
                <h5 className="mb-0">Goods</h5>
                {challanId && <small className="text-muted">Items are locked after inventory stock is transferred.</small>}
              </div>
              <Button type="button" size="sm" variant="outline-primary" disabled={Boolean(challanId)} onClick={() => setLines((current) => [...current, blank()])}>
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
                  <th />
                </tr>
              </thead>
              <tbody>
                {lines.map((line, index) => (
                  <tr key={index}>
                    <td><Form.Select required disabled={Boolean(challanId)} value={line.inventoryItem || ''} onChange={(event) => chooseMaterial(index, event.target.value)}><option value="">Select inventory material</option>{selectableMaterials.map((item) => <option key={item._id} value={item._id}>{item.name} ({item.sku}) · {item.quantityInStock} {item.unit}</option>)}</Form.Select></td>
                    <td>
                      <Form.Control readOnly value={line.hsnCode} />
                    </td>
                    <td>
                      <Form.Control
                        required
                        disabled={Boolean(challanId)}
                        type="number"
                        min="0"
                        step="any"
                        value={line.quantity}
                        onChange={(event) => setLine(index, 'quantity', event.target.value)}
                      />
                    </td>
                    <td>
                      <Form.Control readOnly value={line.unit} />
                    </td>
                    <td>
                      {!challanId && lines.length > 1 && (
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
