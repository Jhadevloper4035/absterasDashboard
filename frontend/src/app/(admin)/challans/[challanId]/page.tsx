import PageMetaData from '@/components/PageTitle'
import { apiFetch } from '@/helpers/api'
import { buildApiUrl } from '@/helpers/apiUrl'
import { useAuthStore } from '@/store/authStore'
import { useEffect, useState } from 'react'
import { Link, useParams, useSearchParams } from 'react-router-dom'
import { Alert, Button, Card, CardBody, Spinner, Table } from 'react-bootstrap'

type Challan = {
  challanNumber: string
  challanDate: string
  transportType?: string
  vehicleNumber?: string
  eWayBillNumber?: string
  freightCharge: number
  taxableAmount: number
  gstAmount: number
  roundOff: number
  totalAmount: number
  lineItems: { description: string; hsnCode?: string; quantity: number; unit?: string; rate: number; amount: number }[]
  client: { name: string; gstin?: string; phone?: string; shippingAddress?: string; billingAddress?: string; state?: string; stateCode?: string }
}
const money = (value = 0) => value.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })
const ChallanDetailPage = () => {
  const { challanId } = useParams()
  const [searchParams] = useSearchParams()
  const [challan, setChallan] = useState<Challan>()
  const [error, setError] = useState('')
  const [downloading, setDownloading] = useState(false)
  const token = useAuthStore((state) => state.token)
  useEffect(() => {
    if (challanId)
      apiFetch<{ data: Challan }>(`/challans/${challanId}`)
        .then(({ data }) => setChallan(data))
        .catch((reason) => setError(reason instanceof Error ? reason.message : 'Unable to load challan'))
  }, [challanId])
  useEffect(() => {
    if (challan && searchParams.get('print') === '1') window.print()
  }, [challan, searchParams])
  const download = async () => {
    const response = await fetch(buildApiUrl(`/challans/${challanId}/pdf`), {
      headers: token ? { Authorization: `Bearer ${token}` } : {},
      credentials: 'include',
    })
    if (!response.ok) throw new Error('Unable to download challan')
    const url = URL.createObjectURL(await response.blob())
    const link = document.createElement('a')
    link.href = url
    link.download = `challan-${challan?.challanNumber}.pdf`
    link.click()
    URL.revokeObjectURL(url)
  }
  return (
    <>
      <PageMetaData title={challan ? `Challan ${challan.challanNumber}` : 'Challan'} />
      <style>
        {
          '@media print { .no-print { display:none!important } body { background:#fff!important } .card { border:0!important; box-shadow:none!important } }'
        }
      </style>
      {error && <Alert variant="danger">{error}</Alert>}
      {challan && (
        <Card>
          <CardBody>
            <div className="no-print d-flex justify-content-between mb-4">
              <Link to="/challans">
                <Button variant="outline-secondary">Back to challans</Button>
              </Link>
              <div>
                <Link to={`/challans/${challanId}/edit`}>
                  <Button variant="outline-primary" className="me-2">
                    Edit
                  </Button>
                </Link>
                <Button className="me-2" onClick={() => window.print()}>
                  Print challan
                </Button>
                <Button
                  variant="outline-success"
                  disabled={downloading}
                  onClick={() => { setDownloading(true); download().catch((reason) => setError(reason instanceof Error ? reason.message : 'Unable to download challan')).finally(() => setDownloading(false)) }}>
                  {downloading && <Spinner size="sm" className="me-2" />}Download PDF
                </Button>
              </div>
            </div>
            <div className="d-flex justify-content-between border-bottom pb-2">
              <strong>GSTIN: 06ABXFA0801H1ZK</strong>
              <strong>DELIVERY CHALLAN</strong>
              <strong>ORIGINAL COPY</strong>
            </div>
            <div className="text-center border-bottom py-3">
              <h2 className="mb-1">ABSTERAS</h2>
              <div>PLOT NO -A-1140 SUSHANT LOK-1, GURUGRAM, HARYANA</div>
              <div>E-MAIL: design.absteras@gmail.com · MOB: +91-9838034555</div>
            </div>
            <div className="row border-bottom py-3">
              <div className="col-md-7">
                <h6>Details of Receiver</h6>
                <strong>NAME: {challan.client.name}</strong>
                <br />
                <strong>ADDRESS:</strong> {challan.client.shippingAddress || challan.client.billingAddress || '-'}
                <br />
                STATE: {challan.client.state || '-'}
                <br />
                STATE CODE: {challan.client.stateCode || '-'}
                <br />
                PHONE NO.: {challan.client.phone || '-'}
                <br />
                GSTIN: {challan.client.gstin || '-'}
              </div>
              <div className="col-md-5">
                <strong>CHALLAN NO: {challan.challanNumber}</strong>
                <br />
                DATE: {new Date(challan.challanDate).toLocaleDateString()}
                <br />
                <br />
                TRANSPORT TYPE: {challan.transportType || '-'}
                <br />
                VEHICLE NO.: {challan.vehicleNumber || '-'}
                <br />
                E-WAY BILL NO.: {challan.eWayBillNumber || '-'}
              </div>
            </div>
            <Table bordered responsive className="mt-3">
              <thead>
                <tr>
                  <th>S No.</th>
                  <th>Descriptions of Goods</th>
                  <th>HSN Code</th>
                  <th className="text-end">Qty.</th>
                  <th>Unit</th>
                  <th className="text-end">Rate</th>
                  <th className="text-end">Amount</th>
                </tr>
              </thead>
              <tbody>
                {challan.lineItems.map((line, index) => (
                  <tr key={index}>
                    <td>{index + 1}</td>
                    <td>{line.description}</td>
                    <td>{line.hsnCode || '-'}</td>
                    <td className="text-end">{line.quantity}</td>
                    <td>{line.unit}</td>
                    <td className="text-end">{money(line.rate)}</td>
                    <td className="text-end">{money(line.amount)}</td>
                  </tr>
                ))}
              </tbody>
              <tfoot>
                <tr>
                  <th colSpan={3} className="text-end">
                    TOTAL
                  </th>
                  <th className="text-end">{challan.lineItems.reduce((sum, line) => sum + line.quantity, 0)}</th>
                  <th colSpan={2} />
                  <th className="text-end">{money(challan.taxableAmount)}</th>
                </tr>
              </tfoot>
            </Table>
            <div className="row border">
              <div className="col-md-7 p-3">
                <strong>Total Amount</strong>
                <br />
                Freight and taxes are included in the total below.
              </div>
              <div className="col-md-5 p-0">
                <Table bordered className="mb-0">
                  <tbody>
                    <tr>
                      <th>Freight Charge</th>
                      <td className="text-end">{money(challan.freightCharge)}</td>
                    </tr>
                    <tr>
                      <th>Goods Assessable Value</th>
                      <td className="text-end">{money(challan.taxableAmount)}</td>
                    </tr>
                    <tr>
                      <th>GST</th>
                      <td className="text-end">{money(challan.gstAmount)}</td>
                    </tr>
                    {challan.roundOff !== 0 && (
                      <tr>
                        <th>Round Off</th>
                        <td className="text-end">{money(challan.roundOff)}</td>
                      </tr>
                    )}
                    <tr>
                      <th>TOTAL AMOUNT</th>
                      <th className="text-end">{money(challan.totalAmount)}</th>
                    </tr>
                  </tbody>
                </Table>
              </div>
            </div>
            <div className="border p-3 mt-3">
              <strong>TERMS AND CONDITIONS</strong>
              <br />
              Goods once sold are not refundable. Interest will be charged at 2% per month if payment is not made within 30 days. All disputes are
              subject to G.B. Nagar jurisdiction only.
              <div className="text-end mt-4">
                <strong>ABSTERAS</strong>
                <br />
                <br />
                Authorised Signatory
              </div>
            </div>
          </CardBody>
        </Card>
      )}
    </>
  )
}
export default ChallanDetailPage
