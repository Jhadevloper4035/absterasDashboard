import PageMetaData from '@/components/PageTitle'
import IconifyIcon from '@/components/wrappers/IconifyIcon'
import { apiFetch } from '@/helpers/api'
import { useAuthStore } from '@/store/authStore'
import { ChangeEvent, FormEvent, useState } from 'react'
import { Alert, Button, ButtonGroup, Card, CardBody, Col, Form, Row } from 'react-bootstrap'
import { toast } from 'react-toastify'

type FormMode = 'lead' | 'architect'
type CreateMode = 'single' | 'csv'

const sourceTypes = ['manual', 'csv', 'api', 'webhook', 'integration'] as const

const emptyLeadForm = {
  name: '',
  source: 'Manual entry',
  sourceType: 'manual',
  company: '',
  email: '',
  phone: '',
  productInterest: '',
}

const emptyArchitectForm = {
  name: '',
  phone: '',
  email: '',
  company: '',
  city: '',
  specialty: '',
  notes: '',
}

const normalizeHeader = (value: string) => value.toLowerCase().replace(/[^a-z0-9]/g, '')

const splitCsvLine = (line: string) => {
  const cells: string[] = []
  let cell = ''
  let quoted = false

  for (let index = 0; index < line.length; index += 1) {
    const char = line[index]
    const next = line[index + 1]

    if (char === '"' && next === '"') {
      cell += '"'
      index += 1
    } else if (char === '"') {
      quoted = !quoted
    } else if (char === ',' && !quoted) {
      cells.push(cell.trim())
      cell = ''
    } else {
      cell += char
    }
  }

  cells.push(cell.trim())
  return cells
}

const parseCsv = (value: string) => {
  const lines = value.split(/\r?\n/).filter((line) => line.trim())
  const headers = splitCsvLine(lines[0] || '').map(normalizeHeader)
  return lines.slice(1).map((line) =>
    splitCsvLine(line).reduce<Record<string, string>>((row, cell, index) => {
      row[headers[index]] = cell
      return row
    }, {}),
  )
}

const firstValue = (row: Record<string, string>, keys: string[]) => keys.map((key) => row[normalizeHeader(key)]).find(Boolean) || ''

const leadFromCsv = (row: Record<string, string>) => ({
  name: firstValue(row, ['name', 'full name', 'customer name']),
  phone: firstValue(row, ['phone', 'mobile', 'mobile number']),
  email: firstValue(row, ['email', 'email address']),
  company: firstValue(row, ['company', 'firm name', 'firm name and address']),
  productInterest: firstValue(row, ['product', 'product enquiry', 'product interest']),
  source: firstValue(row, ['source', 'lead source']) || 'CSV import',
  sourceType: firstValue(row, ['source type']) || 'csv',
})

const architectFromCsv = (row: Record<string, string>) => ({
  name: firstValue(row, ['name', 'full name', 'architect name']),
  phone: firstValue(row, ['phone', 'mobile', 'mobile number']),
  email: firstValue(row, ['email', 'email address']),
  company: firstValue(row, ['company', 'firm name', 'firm name and address']),
  city: firstValue(row, ['city']),
  specialty: firstValue(row, ['specialty', 'project type', 'product enquiry']),
  notes: firstValue(row, ['notes', 'representative', 'address']),
})

const csvSample = (mode: FormMode) =>
  mode === 'architect'
    ? 'Full Name,Mobile Number,Email,Firm Name,City,Project Type,Notes\nAsha Mehta,9876543210,asha@example.com,Build Studio,Mumbai,Residential,Met at Bharat Build Con'
    : 'Full Name,Mobile Number,Email,Company,Product Enquiry,Source\nRavi Kumar,9876543210,ravi@example.com,Prime Build,HPL Sheets,Website'

const csvDownloadHref = (mode: FormMode) => `data:text/csv;charset=utf-8,${encodeURIComponent(csvSample(mode))}`
const csvHeaders = (mode: FormMode) =>
  mode === 'architect'
    ? 'Full Name, Mobile Number, Email, Firm Name, City, Project Type, Notes'
    : 'Full Name, Mobile Number, Email, Company, Product Enquiry, Source'

const CreateLeadPage = () => {
  const user = useAuthStore((state) => state.user)
  const token = useAuthStore((state) => state.token)
  const [mode, setMode] = useState<FormMode>('lead')
  const [createMode, setCreateMode] = useState<CreateMode>('single')
  const [leadForm, setLeadForm] = useState(emptyLeadForm)
  const [architectForm, setArchitectForm] = useState(emptyArchitectForm)
  const [csvFile, setCsvFile] = useState<File>()
  const [saving, setSaving] = useState(false)
  const [message, setMessage] = useState('')
  const [error, setError] = useState('')
  const canCreate = user?.role === 'superadmin' || user?.role === 'admin'
  const isArchitect = mode === 'architect'

  const createRecord = async (event: FormEvent) => {
    event.preventDefault()
    if (!token) return
    setSaving(true)
    setError('')
    setMessage('')

    try {
      await apiFetch(isArchitect ? '/architects' : '/leads', {
        method: 'POST',
        body: JSON.stringify(isArchitect ? architectForm : leadForm),
        token,
      })
      if (isArchitect) setArchitectForm(emptyArchitectForm)
      else setLeadForm(emptyLeadForm)
      setMessage(isArchitect ? 'Architect lead created successfully' : 'Lead created successfully')
      toast.success(isArchitect ? 'Architect lead created successfully' : 'Lead created successfully')
    } catch (e) {
      const message = e instanceof Error ? e.message : 'Unable to create lead'
      setError(message)
      toast.error(message)
    } finally {
      setSaving(false)
    }
  }

  const uploadCsv = async (event: FormEvent) => {
    event.preventDefault()
    if (!token || !csvFile) return
    setSaving(true)
    setError('')
    setMessage('')

    try {
      const rows = parseCsv(await csvFile.text()).map((row) => (isArchitect ? architectFromCsv(row) : leadFromCsv(row))).filter((row) => row.name && row.phone)

      if (!rows.length) throw new Error('CSV must include at least one row with a name and mobile number')

      for (const row of rows) {
        await apiFetch(isArchitect ? '/architects' : '/leads', {
          method: 'POST',
          body: JSON.stringify(row),
          token,
        })
      }

      setCsvFile(undefined)
      setMessage(`${rows.length} ${isArchitect ? 'architect lead' : 'lead'}${rows.length === 1 ? '' : 's'} created`)
      toast.success('CSV import completed')
    } catch (e) {
      const message = e instanceof Error ? e.message : 'Unable to import CSV'
      setError(message)
      toast.error(message)
    } finally {
      setSaving(false)
    }
  }

  const selectCsv = (event: ChangeEvent<HTMLInputElement>) => setCsvFile(event.target.files?.[0])

  if (!canCreate) {
    return (
      <>
        <PageMetaData title="Create Lead" />
        <Alert variant="warning">Only administrators can create leads.</Alert>
      </>
    )
  }

  return (
    <>
      <PageMetaData title="Create Lead" />
      <Card>
        <CardBody>
          <div className="d-flex justify-content-between align-items-start gap-3 flex-wrap mb-4">
            <div>
              <h4 className="card-title mb-1">Create Lead</h4>
              <div className="text-muted">Select the lead category, then capture the details needed for qualification and follow-up.</div>
            </div>
            <ButtonGroup>
              <Button variant={mode === 'lead' ? 'primary' : 'outline-primary'} onClick={() => setMode('lead')}>
                Lead
              </Button>
              <Button variant={mode === 'architect' ? 'primary' : 'outline-primary'} onClick={() => setMode('architect')}>
                Architect Lead
              </Button>
            </ButtonGroup>
          </div>

          <div className="d-flex justify-content-center mb-4">
            <ButtonGroup>
              <Button variant={createMode === 'single' ? 'secondary' : 'outline-secondary'} onClick={() => setCreateMode('single')}>
                Single entry
              </Button>
              <Button variant={createMode === 'csv' ? 'secondary' : 'outline-secondary'} onClick={() => setCreateMode('csv')}>
                CSV upload
              </Button>
            </ButtonGroup>
          </div>

          {error && <Alert variant="danger">{error}</Alert>}
          {message && <Alert variant="success">{message}</Alert>}

          {createMode === 'csv' ? (
            <Form onSubmit={uploadCsv}>
              <Row className="g-3">
                <Col xs={12}>
                  <Form.Label>Upload {isArchitect ? 'architect leads' : 'leads'} CSV file</Form.Label>
                  <Form.Control required type="file" accept=".csv,text/csv" onChange={selectCsv} />
                  <div className="d-flex gap-2 flex-wrap mt-3">
                    <Button as="a" href={csvDownloadHref(mode)} download={`${isArchitect ? 'architect-leads' : 'leads'}-sample.csv`} variant="outline-secondary" className="text-nowrap">
                      Download sample CSV
                    </Button>
                    <Button type="submit" className="text-nowrap" disabled={saving || !csvFile}>
                      <IconifyIcon icon="bx:upload" className="me-1" />
                      {saving ? 'Importing...' : 'Import CSV'}
                    </Button>
                  </div>
                </Col>
                <Col xs={12}>
                  <div className="border rounded p-3 mt-2">
                    <h5 className="mb-3">CSV import guide</h5>
                    <ul className="ps-3 mb-3">
                      <li>Open Excel, Google Sheets, or another spreadsheet tool.</li>
                      <li>Use this exact header row: <span className="fw-semibold">{csvHeaders(mode)}</span>.</li>
                      <li>Add one {isArchitect ? 'architect lead' : 'lead'} per row below the header.</li>
                      <li>Name and mobile number are mandatory. Rows missing either value are skipped.</li>
                      <li>Email, company, product, city, and notes may stay blank if the details are not available.</li>
                      <li>Do not merge cells or add extra headings above the header row.</li>
                      <li>Export the sheet as a CSV file. In Google Sheets, use File, Download, Comma Separated Values.</li>
                      <li>Upload the CSV file here, then select Import CSV.</li>
                    </ul>
                    <div className="text-muted fs-13">
                      Tip: download the sample CSV, enter your data in the same columns, and upload the completed file.
                    </div>
                  </div>
                </Col>
              </Row>
            </Form>
          ) : (
          <Form onSubmit={createRecord}>
            {isArchitect ? (
              <Row className="g-3">
                <Form.Group as={Col} md={6}>
                  <Form.Label>Architect name</Form.Label>
                  <Form.Control required value={architectForm.name} onChange={(event) => setArchitectForm({ ...architectForm, name: event.target.value })} placeholder="Full name" />
                </Form.Group>
                <Form.Group as={Col} md={6}>
                  <Form.Label>Mobile number</Form.Label>
                  <Form.Control required type="tel" inputMode="tel" value={architectForm.phone} onChange={(event) => setArchitectForm({ ...architectForm, phone: event.target.value })} placeholder="10-digit mobile number" />
                </Form.Group>
                <Form.Group as={Col} md={6}>
                  <Form.Label>Email</Form.Label>
                  <Form.Control type="email" value={architectForm.email} onChange={(event) => setArchitectForm({ ...architectForm, email: event.target.value })} placeholder="Email address" />
                </Form.Group>
                <Form.Group as={Col} md={6}>
                  <Form.Label>Firm name</Form.Label>
                  <Form.Control value={architectForm.company} onChange={(event) => setArchitectForm({ ...architectForm, company: event.target.value })} placeholder="Architecture firm or studio" />
                </Form.Group>
                <Form.Group as={Col} md={6}>
                  <Form.Label>City</Form.Label>
                  <Form.Control value={architectForm.city} onChange={(event) => setArchitectForm({ ...architectForm, city: event.target.value })} placeholder="City" />
                </Form.Group>
                <Form.Group as={Col} md={6}>
                  <Form.Label>Project type</Form.Label>
                  <Form.Control value={architectForm.specialty} onChange={(event) => setArchitectForm({ ...architectForm, specialty: event.target.value })} placeholder="Residential, commercial, hospitality..." />
                </Form.Group>
                <Form.Group as={Col} xs={12}>
                  <Form.Label>Notes</Form.Label>
                  <Form.Control as="textarea" rows={3} value={architectForm.notes} onChange={(event) => setArchitectForm({ ...architectForm, notes: event.target.value })} placeholder="Requirement, representative, address, or next step" />
                </Form.Group>
              </Row>
            ) : (
              <Row className="g-3">
                <Form.Group as={Col} md={6}>
                  <Form.Label>Customer name</Form.Label>
                  <Form.Control required value={leadForm.name} onChange={(event) => setLeadForm({ ...leadForm, name: event.target.value })} placeholder="Full name" />
                </Form.Group>
                <Form.Group as={Col} md={6}>
                  <Form.Label>Mobile number</Form.Label>
                  <Form.Control required type="tel" inputMode="tel" value={leadForm.phone} onChange={(event) => setLeadForm({ ...leadForm, phone: event.target.value })} placeholder="10-digit mobile number" />
                </Form.Group>
                <Form.Group as={Col} md={6}>
                  <Form.Label>Email</Form.Label>
                  <Form.Control type="email" value={leadForm.email} onChange={(event) => setLeadForm({ ...leadForm, email: event.target.value })} placeholder="Email address" />
                </Form.Group>
                <Form.Group as={Col} md={6}>
                  <Form.Label>Company</Form.Label>
                  <Form.Control value={leadForm.company} onChange={(event) => setLeadForm({ ...leadForm, company: event.target.value })} placeholder="Company or firm" />
                </Form.Group>
                <Form.Group as={Col} md={6}>
                  <Form.Label>Product enquiry</Form.Label>
                  <Form.Control value={leadForm.productInterest} onChange={(event) => setLeadForm({ ...leadForm, productInterest: event.target.value })} placeholder="Product or service required" />
                </Form.Group>
                <Form.Group as={Col} md={3}>
                  <Form.Label>Lead source</Form.Label>
                  <Form.Control required value={leadForm.source} onChange={(event) => setLeadForm({ ...leadForm, source: event.target.value })} placeholder="Expo, website, call..." />
                </Form.Group>
                <Form.Group as={Col} md={3}>
                  <Form.Label>Source type</Form.Label>
                  <Form.Select value={leadForm.sourceType} onChange={(event) => setLeadForm({ ...leadForm, sourceType: event.target.value })}>
                    {sourceTypes.map((sourceType) => (
                      <option key={sourceType} value={sourceType}>
                        {sourceType}
                      </option>
                    ))}
                  </Form.Select>
                </Form.Group>
              </Row>
            )}

            <div className="d-flex justify-content-end mt-4">
              <Button type="submit" className="px-4" disabled={saving}>
                <IconifyIcon icon="bx:plus" className="me-1" />
                {saving ? 'Creating...' : isArchitect ? 'Create Architect Lead' : 'Create Lead'}
              </Button>
            </div>
          </Form>
          )}
        </CardBody>
      </Card>
    </>
  )
}

export default CreateLeadPage
