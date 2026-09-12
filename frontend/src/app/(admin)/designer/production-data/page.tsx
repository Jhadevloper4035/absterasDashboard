import PageMetaData from '@/components/PageTitle'
import DropzoneFormInput from '@/components/form/DropzoneFormInput'
import { useAuthContext } from '@/context/useAuthContext'
import { apiFetch } from '@/helpers/api'
import { canManageModule, hasFullAppAccess } from '@/helpers/moduleAccess'
import { FormEvent, Fragment, useEffect, useMemo, useState } from 'react'
import { Alert, Badge, Button, Card, CardBody, Col, Form, Row, Table } from 'react-bootstrap'
import ReactQuill from 'react-quill-new'
import { toast } from 'react-toastify'
import 'react-quill-new/dist/quill.snow.css'

type Attachment = { key: string; contentType: string; originalName?: string; attachmentToken: string; url?: string }
type Client = { _id: string; name: string }
type Site = { _id: string; name: string; parentClient: string; siteName?: string; siteAddress?: string }
type SourceDocument = { key: string; title: string; status?: string; createdAt?: string; attachment: Attachment }
type ProductionRecord = { _id: string; client: Client; clientSite: Site; title: string; description?: string; attachments: Attachment[]; createdBy: { name: string }; createdAt: string }
type Eligibility = { boqApproved: boolean; drawingApproved: boolean; siteMeasurementExists: boolean; productionDataExists: boolean; canCreate: boolean; documents?: { boqs: SourceDocument[]; drawings: SourceDocument[]; siteMeasurements: SourceDocument[] } }

const descriptionModules = { toolbar: [['bold', 'italic', 'underline'], [{ list: 'ordered' }, { list: 'bullet' }], ['link'], ['clean']] }
const descriptionText = (value?: string) => new DOMParser().parseFromString(value || '', 'text/html').body.textContent?.trim() || ''

const ProductionDataPage = () => {
  const { user } = useAuthContext()
  const admin = hasFullAppAccess(user)
  const canCreate = canManageModule(user, 'designer')
  const [clients, setClients] = useState<Client[]>([])
  const [sites, setSites] = useState<Site[]>([])
  const [records, setRecords] = useState<ProductionRecord[]>([])
  const [createClient, setCreateClient] = useState('')
  const [createSite, setCreateSite] = useState('')
  const [filterClient, setFilterClient] = useState('')
  const [filterSite, setFilterSite] = useState('')
  const [title, setTitle] = useState('')
  const [description, setDescription] = useState('')
  const [files, setFiles] = useState<File[]>([])
  const [sourceDocuments, setSourceDocuments] = useState({ boq: '', drawing: '', siteMeasurement: '' })
  const [eligibility, setEligibility] = useState<Eligibility>()
  const [expanded, setExpanded] = useState('')
  const [showCreate, setShowCreate] = useState(false)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')

  const availableSites = useMemo(() => sites.filter((site) => site.parentClient === createClient), [sites, createClient])
  const filterSites = useMemo(() => sites.filter((site) => site.parentClient === filterClient), [sites, filterClient])
  const missingRequirements = eligibility && [!eligibility.boqApproved && 'approved BOQ', !eligibility.drawingApproved && 'approved Drawing', !eligibility.siteMeasurementExists && 'site measurement'].filter(Boolean)

  const load = async () => {
    setError('')
    try {
      const query = new URLSearchParams()
      if (filterClient) query.set('client', filterClient)
      if (filterSite) query.set('site', filterSite)
      const [clientSites, productionData] = await Promise.all([
        apiFetch<{ data: { clients: Client[]; sites: Site[] } }>('/designer/client-sites'),
        apiFetch<{ data: ProductionRecord[] }>(`/designer/production-data${query.size ? `?${query}` : ''}`),
      ])
      setClients(clientSites.data.clients)
      setSites(clientSites.data.sites)
      setRecords(productionData.data)
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : 'Unable to load production data')
    }
  }

  useEffect(() => { load() }, [])
  useEffect(() => {
    setEligibility(undefined)
    setSourceDocuments({ boq: '', drawing: '', siteMeasurement: '' })
    if (!createClient || !createSite) return
    apiFetch<{ data: Eligibility }>(`/designer/production-data/eligibility?${new URLSearchParams({ client: createClient, site: createSite })}`)
      .then((response) => {
        const { documents } = response.data
        setEligibility(response.data)
        setSourceDocuments({
          boq: documents?.boqs.find((source) => source.status === 'APPROVED')?.key || documents?.boqs[0]?.key || '',
          drawing: documents?.drawings.find((source) => source.status === 'APPROVED')?.key || documents?.drawings[0]?.key || '',
          siteMeasurement: documents?.siteMeasurements[0]?.key || '',
        })
      })
      .catch((reason) => setError(reason instanceof Error ? reason.message : 'Unable to check production requirements'))
  }, [createClient, createSite])

  const submit = async (event: FormEvent) => {
    event.preventDefault()
    if (!createClient || !createSite) return setError('Choose a client and site address')
    if (!eligibility?.canCreate) return setError('Complete the site requirements before creating production data')
    if (!sourceDocuments.boq || !sourceDocuments.drawing || !sourceDocuments.siteMeasurement) return setError('Select a BOQ, Drawing, and Site Measurement')
    if (!files.length) return setError('Choose at least one PDF or Excel file')
    setSaving(true)
    setError('')
    try {
      const body = new FormData()
      files.forEach((file) => body.append('files', file))
      const upload = await apiFetch<{ data: Attachment[] }>('/designer/uploads', { method: 'POST', body })
      await apiFetch('/designer/production-data', { method: 'POST', body: JSON.stringify({ client: createClient, clientSite: createSite, title, description, sourceDocuments, attachments: upload.data }) })
      toast.success('Production data created')
      setTitle('')
      setDescription('')
      setFiles([])
      setCreateClient('')
      setCreateSite('')
      setShowCreate(false)
      await load()
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : 'Unable to create production data')
    } finally {
      setSaving(false)
    }
  }

  return <>
    <PageMetaData title="Production Data" />
    <Card className="mb-3"><CardBody><div className="d-flex justify-content-between align-items-start flex-wrap gap-3"><div><h4 className="card-title mb-1">Production Data</h4><p className="text-muted mb-0">Create one production data record per address after BOQ, Drawing, and Site Measurement are complete.</p></div><div className="d-flex gap-2"><Button variant="outline-secondary" onClick={load} disabled={saving}>Refresh</Button>{canCreate && <Button onClick={() => setShowCreate(true)}>Create production data</Button>}</div></div>{error && <Alert className="mt-3 mb-0" variant="danger">{error}</Alert>}</CardBody></Card>
    {showCreate && <Card className="mb-3"><CardBody><div className="d-flex justify-content-between align-items-center mb-3"><h5 className="mb-0">Create production data</h5><Button size="sm" variant="outline-secondary" onClick={() => setShowCreate(false)} disabled={saving}>Cancel</Button></div><Form onSubmit={submit}><Row className="g-3"><Col md={6}><Form.Label htmlFor="production-title">Title</Form.Label><Form.Control id="production-title" required maxLength={160} value={title} onChange={(event) => setTitle(event.target.value)} placeholder="e.g. Tower A production pack" /></Col><Col md={6}><Form.Label htmlFor="production-client">Client</Form.Label><Form.Select id="production-client" required value={createClient} onChange={(event) => { setCreateClient(event.target.value); setCreateSite('') }}><option value="">Select client</option>{clients.map((client) => <option key={client._id} value={client._id}>{client.name}</option>)}</Form.Select></Col><Col md={6}><Form.Label htmlFor="production-site">Client address</Form.Label><Form.Select id="production-site" required disabled={!createClient} value={createSite} onChange={(event) => setCreateSite(event.target.value)}><option value="">Select address</option>{availableSites.map((site) => <option key={site._id} value={site._id}>{site.siteName || site.name} — {site.siteAddress}</option>)}</Form.Select></Col><Col md={6}>{eligibility && <div className="border rounded p-3 h-100"><div className="fw-semibold mb-2">Address requirements</div><div className="d-flex flex-wrap gap-2"><Badge bg={eligibility.boqApproved ? 'success' : 'secondary'}>BOQ {eligibility.boqApproved ? 'approved' : 'waiting'}</Badge><Badge bg={eligibility.drawingApproved ? 'success' : 'secondary'}>Drawing {eligibility.drawingApproved ? 'approved' : 'waiting'}</Badge><Badge bg={eligibility.siteMeasurementExists ? 'success' : 'secondary'}>Site measurement {eligibility.siteMeasurementExists ? 'added' : 'waiting'}</Badge></div>{eligibility.productionDataExists && <div className="small text-danger mt-2">Production data already exists for this address.</div>}{missingRequirements?.length ? <div className="small text-muted mt-2">Waiting for: {missingRequirements.join(', ')}.</div> : null}</div>}</Col>{eligibility?.documents && <Col xs={12}><div className="border rounded p-3"><h6 className="mb-3">Source documents</h6><Row className="g-3"><Col md={4}><Form.Label htmlFor="production-boq-source">BOQ</Form.Label><Form.Select id="production-boq-source" value={sourceDocuments.boq} onChange={(event) => setSourceDocuments({ ...sourceDocuments, boq: event.target.value })}><option value="">Select BOQ</option>{eligibility.documents.boqs.map((source) => <option key={source.key} value={source.key}>{source.status === 'APPROVED' ? 'Approved — ' : ''}{source.title}</option>)}</Form.Select></Col><Col md={4}><Form.Label htmlFor="production-drawing-source">Drawing</Form.Label><Form.Select id="production-drawing-source" value={sourceDocuments.drawing} onChange={(event) => setSourceDocuments({ ...sourceDocuments, drawing: event.target.value })}><option value="">Select Drawing</option>{eligibility.documents.drawings.map((source) => <option key={source.key} value={source.key}>{source.status === 'APPROVED' ? 'Approved — ' : ''}{source.title}</option>)}</Form.Select></Col><Col md={4}><Form.Label htmlFor="production-measurement-source">Site Measurement</Form.Label><Form.Select id="production-measurement-source" value={sourceDocuments.siteMeasurement} onChange={(event) => setSourceDocuments({ ...sourceDocuments, siteMeasurement: event.target.value })}><option value="">Select site measurement</option>{eligibility.documents.siteMeasurements.map((source) => <option key={source.key} value={source.key}>{source.title}{source.createdAt && ` — ${new Date(source.createdAt).toLocaleDateString()}`}</option>)}</Form.Select></Col></Row></div></Col>}<Col xs={12}><Form.Label>Description</Form.Label><ReactQuill className="boq-description-editor" theme="snow" value={description} onChange={setDescription} modules={descriptionModules} placeholder="Add production notes, coding, or numbering details" /><Form.Text>Use the toolbar for lists, emphasis, and links.</Form.Text></Col><Col xs={12}><DropzoneFormInput label="Production files" iconProps={{ icon: 'bx:cloud-upload', height: 34, width: 34 }} text="Drag & drop production PDFs or Excel files here, or browse" helpText="Up to five .pdf or .xlsx files, 10 MB each." showPreview={false} accept={{ 'application/pdf': ['.pdf'], 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet': ['.xlsx'] }} maxFiles={5} onFileUpload={setFiles} />{files.length > 0 && <div className="small text-muted mt-2">Selected: {files.map((file) => file.name).join(', ')}</div>}</Col><Col xs={12}><Button type="submit" disabled={saving || !eligibility?.canCreate}>{saving ? 'Saving…' : 'Create production data'}</Button></Col></Row></Form></CardBody></Card>}
    <Card><CardBody><div className="row g-2 mb-3"><div className="col-md-6"><Form.Label className="visually-hidden" htmlFor="production-filter-client">Client</Form.Label><Form.Select id="production-filter-client" value={filterClient} onChange={(event) => { setFilterClient(event.target.value); setFilterSite('') }}><option value="">All clients</option>{clients.map((client) => <option key={client._id} value={client._id}>{client.name}</option>)}</Form.Select></div><div className="col-md-6"><Form.Label className="visually-hidden" htmlFor="production-filter-site">Client address</Form.Label><Form.Select id="production-filter-site" disabled={!filterClient} value={filterSite} onChange={(event) => setFilterSite(event.target.value)}><option value="">All addresses</option>{filterSites.map((site) => <option key={site._id} value={site._id}>{site.siteName || site.name} — {site.siteAddress}</option>)}</Form.Select></div></div><div className="d-flex justify-content-between align-items-center mb-3"><h5 className="mb-0">{admin ? 'All production data' : 'My production data'}</h5><Button size="sm" variant="outline-primary" onClick={load} disabled={saving}>Apply filters</Button></div><Table responsive hover className="align-middle mb-0" style={{ minWidth: admin ? 980 : 840 }}><thead><tr><th>Production data</th><th>Client / site</th>{admin && <th>Designer</th>}<th>Created</th><th /></tr></thead><tbody>{records.map((record) => <Fragment key={record._id}><tr><td><div className="fw-semibold">{record.title}</div><small className="text-muted">{record.attachments.length} file{record.attachments.length === 1 ? '' : 's'}</small></td><td><div>{record.client.name}</div><small className="text-muted">{record.clientSite.siteName || record.clientSite.name}{record.clientSite.siteAddress && ` — ${record.clientSite.siteAddress}`}</small></td>{admin && <td>{record.createdBy.name}</td>}<td>{new Date(record.createdAt).toLocaleDateString()}</td><td className="text-end"><Button size="sm" variant="outline-primary" onClick={() => setExpanded(expanded === record._id ? '' : record._id)}>{expanded === record._id ? 'Hide details' : 'View files'}</Button></td></tr>{expanded === record._id && <tr><td colSpan={admin ? 5 : 4} className="bg-body-tertiary"><div className="py-2"><strong>Description</strong><p className="mt-1">{descriptionText(record.description) || 'No description provided.'}</p><strong>Files</strong>{record.attachments.map((attachment) => <a className="d-block mt-1" href={attachment.url} target="_blank" rel="noreferrer" key={attachment.key}>{attachment.originalName || 'Production file'}</a>)}</div></td></tr>}</Fragment>)}{!records.length && <tr><td className="text-center text-muted py-4" colSpan={admin ? 5 : 4}>No production data found.</td></tr>}</tbody></Table></CardBody></Card>
  </>
}

export default ProductionDataPage
