import PageMetaData from '@/components/PageTitle'
import DropzoneFormInput from '@/components/form/DropzoneFormInput'
import IconifyIcon from '@/components/wrappers/IconifyIcon'
import { apiFetch } from '@/helpers/api'
import { canManageModule } from '@/helpers/moduleAccess'
import { uploadMultipartFiles } from '@/helpers/upload'
import { useAuthStore } from '@/store/authStore'
import type { UploadFileType } from '@/types/component-props'
import type { LeadAttachment } from '@/types/lead'
import type { UserType } from '@/types/auth'
import { ChangeEvent, FormEvent, useEffect, useState } from 'react'
import { Alert, Button, ButtonGroup, Card, CardBody, Col, Form, Row } from 'react-bootstrap'
import { toast } from 'react-toastify'

type FormMode = 'lead' | 'architect'
type CreateMode = 'single' | 'csv'

const sourceTypes = ['manual', 'csv', 'api', 'webhook', 'integration'] as const
const documentTypes = [
  { value: 'site_images', label: 'Site images' },
  { value: 'psf', label: 'PSF' },
  { value: 'boq', label: 'BOQ' },
  { value: 'estimation', label: 'Estimation' },
] as const
type LeadDocument = LeadAttachment & { type: (typeof documentTypes)[number]['value'] }

const emptyLeadForm = {
  name: '',
  source: 'Manual entry',
  sourceType: 'manual',
  campaign: '',
  company: '',
  siteAddress: '',
  googleMapUrl: '',
  email: '',
  phone: '',
  productInterest: '',
  territory: '',
  leadCost: '',
  documents: [] as LeadDocument[],
  owner: '',
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

const dummyLeadForm = {
  name: 'Rohan Malhotra',
  source: 'India Facade Summit',
  sourceType: 'manual',
  campaign: 'Metal facade India architect event',
  company: 'Malhotra Design Associates',
  siteAddress: 'Bandra Kurla Complex, Mumbai',
  googleMapUrl: 'https://maps.google.com/?q=Bandra+Kurla+Complex+Mumbai',
  email: 'rohan.malhotra@example.in',
  phone: '+919820000201',
  productInterest: 'Metal facade cladding',
  territory: 'India - Mumbai',
  leadCost: '',
  documents: [] as LeadDocument[],
  owner: '',
}

const dummyArchitectForm = {
  name: 'Anika Rao',
  phone: '+919820000202',
  email: 'anika.rao@example.in',
  company: 'Rao Facade Studio',
  city: 'Mumbai',
  specialty: 'Metal facade event - India Facade Summit',
  notes: 'Dummy architect lead from India metal facade event.',
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
  siteAddress: firstValue(row, ['site address', 'address', 'project address']),
  googleMapUrl: firstValue(row, ['google map url', 'google maps url', 'map url', 'google map link']),
  productInterest: firstValue(row, ['product', 'product enquiry', 'product interest']),
  campaign: firstValue(row, ['campaign', 'event']),
  territory: firstValue(row, ['territory', 'city', 'region']),
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
    : 'Full Name,Mobile Number,Email,Company,Site Address,Google Map URL,Product Enquiry,Source,Campaign,Territory\nRavi Kumar,9876543210,ravi@example.com,Prime Build,"BKC, Mumbai",https://maps.google.com/?q=BKC+Mumbai,HPL Sheets,Website,Metal facade India architect event,India - Mumbai'

const csvDownloadHref = (mode: FormMode) => `data:text/csv;charset=utf-8,${encodeURIComponent(csvSample(mode))}`
const csvHeaders = (mode: FormMode) =>
  mode === 'architect'
    ? 'Full Name, Mobile Number, Email, Firm Name, City, Project Type, Notes'
    : 'Full Name, Mobile Number, Email, Company, Site Address, Google Map URL, Product Enquiry, Source, Campaign, Territory'

const CreateLeadPage = () => {
  const user = useAuthStore((state) => state.user)
  const token = useAuthStore((state) => state.token)
  const [mode, setMode] = useState<FormMode>('lead')
  const [createMode, setCreateMode] = useState<CreateMode>('single')
  const [leadForm, setLeadForm] = useState(emptyLeadForm)
  const [architectForm, setArchitectForm] = useState(emptyArchitectForm)
  const [csvFile, setCsvFile] = useState<File>()
  const [saving, setSaving] = useState(false)
  const [salespeople, setSalespeople] = useState<UserType[]>([])
  const [uploading, setUploading] = useState(false)
  const [documentType, setDocumentType] = useState<LeadDocument['type']>('site_images')
  const [message, setMessage] = useState('')
  const [error, setError] = useState('')
  const canCreate = canManageModule(user, 'leads')
  const isArchitect = mode === 'architect'

  useEffect(() => {
    if (!token || !canCreate) return
    apiFetch<{ data: UserType[] }>('/leads/assignees', { token })
      .then((response) => setSalespeople(response.data))
      .catch((e) => setError(e instanceof Error ? e.message : 'Unable to load salespeople'))
  }, [canCreate, token])

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
      const rows = parseCsv(await csvFile.text())
        .map((row) => (isArchitect ? architectFromCsv(row) : leadFromCsv(row)))
        .filter((row) => row.name && row.phone)

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

  const uploadDocuments = async (files: UploadFileType[]) => {
    if (!token || !files.length) return
    setUploading(true)
    setError('')
    try {
      const documents = await uploadMultipartFiles<LeadAttachment>(files, token)
      setLeadForm((form) => ({ ...form, documents: [...form.documents, ...documents.map((document) => ({ ...document, type: documentType }))] }))
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Unable to upload documents')
    } finally {
      setUploading(false)
    }
  }

  const selectCsv = (event: ChangeEvent<HTMLInputElement>) => setCsvFile(event.target.files?.[0])
  const loadDummy = () => (isArchitect ? setArchitectForm(dummyArchitectForm) : setLeadForm(dummyLeadForm))

  if (!canCreate) {
    return (
      <>
        <PageMetaData title="Create Lead" />
        <Alert variant="warning">Lead Management access is required to create leads.</Alert>
      </>
    )
  }

  return (
    <>
      <PageMetaData title="Create Lead" />
      <div className="rounded-3 border bg-primary bg-opacity-10 p-3 p-md-4 mb-3">
        <div className="d-flex align-items-start justify-content-between gap-3 flex-wrap">
          <div className="d-flex align-items-center gap-3">
            <div className="avatar-md rounded-circle bg-primary text-white d-flex align-items-center justify-content-center flex-shrink-0">
              <IconifyIcon icon="bx:user-plus" className="fs-24" />
            </div>
            <div>
              <h4 className="mb-1">Create lead</h4>
              <p className="text-muted mb-0">Capture a new enquiry, then assign it to the right owner.</p>
            </div>
          </div>
          <div className="text-md-end">
            <span className="badge bg-white text-primary border">New record</span>
            <div className="small text-muted mt-2"><span className="text-danger">*</span> Name and mobile number are required</div>
          </div>
        </div>
      </div>
      <Card className="border-0 shadow-sm">
        <CardBody className="p-3 p-md-4">
          <div className="rounded-3 border bg-light p-3 mb-4">
            <Row className="g-3 align-items-center">
              <Col md={6}>
                <Form.Label className="fw-semibold mb-2">1. Contact type</Form.Label>
                <ButtonGroup aria-label="Contact type" className="w-100">
                  <Button variant={mode === 'lead' ? 'primary' : 'outline-primary'} onClick={() => setMode('lead')}>
                    Customer lead
                  </Button>
                  <Button variant={mode === 'architect' ? 'primary' : 'outline-primary'} onClick={() => setMode('architect')}>
                    Architect lead
                  </Button>
                </ButtonGroup>
              </Col>
              <Col md={6}>
                <Form.Label className="fw-semibold mb-2">2. Add method</Form.Label>
                <ButtonGroup aria-label="Entry method" className="w-100">
                  <Button variant={createMode === 'single' ? 'secondary' : 'outline-secondary'} onClick={() => setCreateMode('single')}>
                    Single entry
                  </Button>
                  <Button variant={createMode === 'csv' ? 'secondary' : 'outline-secondary'} onClick={() => setCreateMode('csv')}>
                    Import CSV
                  </Button>
                </ButtonGroup>
              </Col>
            </Row>
          </div>

          {error && <Alert variant="danger">{error}</Alert>}
          {message && <Alert variant="success">{message}</Alert>}

          {createMode === 'csv' ? (
            <Form onSubmit={uploadCsv}>
              <Row className="g-3">
                <Col xs={12}>
                  <h5 className="mb-1">Import {isArchitect ? 'architect contacts' : 'leads'}</h5>
                  <p className="text-muted mb-3">Download the sample first, fill in your details, then upload the CSV file.</p>
                  <Form.Label>CSV file</Form.Label>
                  <Form.Control required type="file" accept=".csv,text/csv" onChange={selectCsv} />
                  <div className="d-flex gap-2 flex-wrap mt-3">
                    <Button
                      as="a"
                      href={csvDownloadHref(mode)}
                      download={`${isArchitect ? 'architect-leads' : 'leads'}-sample.csv`}
                      variant="outline-secondary"
                      className="text-nowrap">
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
                      <li>
                        Use this exact header row: <span className="fw-semibold">{csvHeaders(mode)}</span>.
                      </li>
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
              <div className="d-flex align-items-start justify-content-between gap-3 flex-wrap border-bottom pb-3 mb-4">
                <div>
                  <h5 className="mb-1">{isArchitect ? 'Architect contact details' : 'Customer and project details'}</h5>
                  <p className="text-muted mb-0">Start with the contact details. All other information can be added later.</p>
                </div>
                <span className="badge bg-light text-dark border">Required fields marked <span className="text-danger">*</span></span>
              </div>
              {isArchitect ? (
                <Row className="g-3">
                  <Col xs={12}><h6 className="text-uppercase text-muted fs-12 mb-0">Contact details</h6></Col>
                  <Form.Group as={Col} md={6}>
                    <Form.Label>Architect name <span className="text-danger">*</span></Form.Label>
                    <Form.Control
                      required
                      value={architectForm.name}
                      onChange={(event) => setArchitectForm({ ...architectForm, name: event.target.value })}
                      placeholder="Full name"
                    />
                  </Form.Group>
                  <Form.Group as={Col} md={6}>
                    <Form.Label>Mobile number <span className="text-danger">*</span></Form.Label>
                    <Form.Control
                      required
                      type="tel"
                      inputMode="tel"
                      value={architectForm.phone}
                      onChange={(event) => setArchitectForm({ ...architectForm, phone: event.target.value })}
                      placeholder="10-digit mobile number"
                    />
                  </Form.Group>
                  <Form.Group as={Col} md={6}>
                    <Form.Label>Email</Form.Label>
                    <Form.Control
                      type="email"
                      value={architectForm.email}
                      onChange={(event) => setArchitectForm({ ...architectForm, email: event.target.value })}
                      placeholder="Email address"
                    />
                  </Form.Group>
                  <Form.Group as={Col} md={6}>
                    <Form.Label>Firm name</Form.Label>
                    <Form.Control
                      value={architectForm.company}
                      onChange={(event) => setArchitectForm({ ...architectForm, company: event.target.value })}
                      placeholder="Architecture firm or studio"
                    />
                  </Form.Group>
                  <Form.Group as={Col} md={6}>
                    <Form.Label>City</Form.Label>
                    <Form.Control
                      value={architectForm.city}
                      onChange={(event) => setArchitectForm({ ...architectForm, city: event.target.value })}
                      placeholder="City"
                    />
                  </Form.Group>
                  <Form.Group as={Col} md={6}>
                    <Form.Label>Project type</Form.Label>
                    <Form.Control
                      value={architectForm.specialty}
                      onChange={(event) => setArchitectForm({ ...architectForm, specialty: event.target.value })}
                      placeholder="Residential, commercial, hospitality..."
                    />
                  </Form.Group>
                  <Form.Group as={Col} xs={12}>
                    <Form.Label>Notes</Form.Label>
                    <Form.Control
                      as="textarea"
                      rows={3}
                      value={architectForm.notes}
                      onChange={(event) => setArchitectForm({ ...architectForm, notes: event.target.value })}
                      placeholder="Requirement, representative, address, or next step"
                    />
                  </Form.Group>
                </Row>
              ) : (
                <Row className="g-3">
                  <Col xs={12}><h6 className="text-uppercase text-muted fs-12 mb-0">Contact details</h6></Col>
                  <Form.Group as={Col} md={6}>
                    <Form.Label>Customer name <span className="text-danger">*</span></Form.Label>
                    <Form.Control
                      required
                      value={leadForm.name}
                      onChange={(event) => setLeadForm({ ...leadForm, name: event.target.value })}
                      placeholder="Full name"
                    />
                  </Form.Group>
                  <Form.Group as={Col} md={6}>
                    <Form.Label>Mobile number <span className="text-danger">*</span></Form.Label>
                    <Form.Control
                      required
                      type="tel"
                      inputMode="tel"
                      value={leadForm.phone}
                      onChange={(event) => setLeadForm({ ...leadForm, phone: event.target.value })}
                      placeholder="10-digit mobile number"
                    />
                  </Form.Group>
                  <Form.Group as={Col} md={6}>
                    <Form.Label>Email</Form.Label>
                    <Form.Control
                      type="email"
                      value={leadForm.email}
                      onChange={(event) => setLeadForm({ ...leadForm, email: event.target.value })}
                      placeholder="Email address"
                    />
                  </Form.Group>
                  <Form.Group as={Col} md={6}>
                    <Form.Label>Company</Form.Label>
                    <Form.Control
                      value={leadForm.company}
                      onChange={(event) => setLeadForm({ ...leadForm, company: event.target.value })}
                      placeholder="Company or firm"
                    />
                  </Form.Group>
                  <Col xs={12} className="pt-2"><div className="border-top pt-3"><h6 className="text-uppercase text-muted fs-12 mb-0">Project details</h6></div></Col>
                  <Form.Group as={Col} md={6}>
                    <Form.Label>Site address</Form.Label>
                    <Form.Control
                      value={leadForm.siteAddress}
                      onChange={(event) => setLeadForm({ ...leadForm, siteAddress: event.target.value })}
                      placeholder="Project or site address"
                    />
                  </Form.Group>
                  <Form.Group as={Col} md={6}>
                    <Form.Label>Google Map URL</Form.Label>
                    <Form.Control
                      type="url"
                      value={leadForm.googleMapUrl}
                      onChange={(event) => setLeadForm({ ...leadForm, googleMapUrl: event.target.value })}
                      placeholder="https://maps.google.com/..."
                    />
                  </Form.Group>
                  <Form.Group as={Col} md={6}>
                    <Form.Label>Product enquiry</Form.Label>
                    <Form.Control
                      value={leadForm.productInterest}
                      onChange={(event) => setLeadForm({ ...leadForm, productInterest: event.target.value })}
                      placeholder="Product or service required"
                    />
                  </Form.Group>
                  <Form.Group as={Col} md={6}>
                    <Form.Label>Campaign</Form.Label>
                    <Form.Control
                      value={leadForm.campaign}
                      onChange={(event) => setLeadForm({ ...leadForm, campaign: event.target.value })}
                      placeholder="Campaign or event name"
                    />
                  </Form.Group>
                  <Form.Group as={Col} md={6}>
                    <Form.Label>Territory</Form.Label>
                    <Form.Control
                      value={leadForm.territory}
                      onChange={(event) => setLeadForm({ ...leadForm, territory: event.target.value })}
                      placeholder="City, region, or territory"
                    />
                  </Form.Group>
                  <Form.Group as={Col} md={6}>
                    <Form.Label>Lead cost</Form.Label>
                    <Form.Control
                      min="0"
                      step="0.01"
                      type="number"
                      value={leadForm.leadCost}
                      onChange={(event) => setLeadForm({ ...leadForm, leadCost: event.target.value })}
                      placeholder="0.00"
                    />
                  </Form.Group>
                  <Col xs={12} className="pt-2"><div className="border-top pt-3"><h6 className="text-uppercase text-muted fs-12 mb-0">Assignment and source</h6></div></Col>
                  <Form.Group as={Col} md={6}>
                    <Form.Label>Assign lead</Form.Label>
                    <Form.Select value={leadForm.owner} onChange={(event) => setLeadForm({ ...leadForm, owner: event.target.value })}>
                      <option value="">Assign to me (default)</option>
                      {salespeople
                        .filter((person) => person._id !== user?._id)
                        .map((person) => (
                          <option key={person._id} value={person._id}>
                            {person.name}
                          </option>
                        ))}
                    </Form.Select>
                  </Form.Group>
                  <Form.Group as={Col} md={3}>
                    <Form.Label>Lead source <span className="text-danger">*</span></Form.Label>
                    <Form.Control
                      required
                      value={leadForm.source}
                      onChange={(event) => setLeadForm({ ...leadForm, source: event.target.value })}
                      placeholder="Expo, website, call..."
                    />
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
                  <Col xs={12}>
                    <Form.Label>
                      Supporting documents <span className="text-muted fw-normal">(optional)</span>
                    </Form.Label>
                    <div className="d-flex gap-2 mb-2" style={{ maxWidth: 260 }}>
                      <Form.Select
                        aria-label="Document category"
                        value={documentType}
                        onChange={(event) => setDocumentType(event.target.value as LeadDocument['type'])}>
                        {documentTypes.map((type) => (
                          <option key={type.value} value={type.value}>
                            {type.label}
                          </option>
                        ))}
                      </Form.Select>
                    </div>
                    <DropzoneFormInput
                      label=""
                      text="Drop site images or PDF documents here"
                      showPreview={false}
                      helpText="Choose a category first, then upload up to 5 files at a time."
                      onFileUpload={uploadDocuments}
                    />
                    {!!leadForm.documents.length && (
                      <div className="mt-2 small">
                        {leadForm.documents.map((document) => (
                          <div key={document.key}>
                            {documentTypes.find((type) => type.value === document.type)?.label}: {document.originalName || document.key}
                          </div>
                        ))}
                      </div>
                    )}
                  </Col>
                </Row>
              )}

              <div className="d-flex justify-content-end mt-4">
                <Button type="button" variant="outline-secondary" className="me-2" onClick={loadDummy}>
                  Use dummy
                </Button>
                <Button type="submit" className="px-4" disabled={saving || uploading}>
                  <IconifyIcon icon="bx:plus" className="me-1" />
                  {uploading ? 'Uploading...' : saving ? 'Creating...' : isArchitect ? 'Create Architect Lead' : 'Create Lead'}
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
