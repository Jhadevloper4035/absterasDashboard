import PageMetaData from '@/components/PageTitle'
import DropzoneFormInput from '@/components/form/DropzoneFormInput'
import { useAuthContext } from '@/context/useAuthContext'
import { apiFetch } from '@/helpers/api'
import { canManageModule, canReviewDesignerDocuments, hasFullAppAccess } from '@/helpers/moduleAccess'
import { FormEvent, useEffect, useMemo, useState } from 'react'
import { Alert, Badge, Button, Card, CardBody, Col, Form, Row, Table } from 'react-bootstrap'
import ReactQuill from 'react-quill-new'
import { Link } from 'react-router-dom'
import { toast } from 'react-toastify'
import 'react-quill-new/dist/quill.snow.css'

type Attachment = { key: string; contentType: string; originalName?: string; size: number; checksum: string; attachmentToken: string; url?: string }
type Client = { _id: string; name: string }
type Site = { _id: string; name: string; parentClient: string; siteName?: string; siteAddress?: string }
type Person = { _id: string; name: string; email: string }
type Boq = {
  _id: string
  client: Client
  clientSite: Site
  title: string
  description?: string
  status: Status
  createdBy: Person
  versions: { _id: string; number: number; attachment: Attachment; uploadedBy: Person; uploadedAt: string }[]
  history: { _id: string; action: string; comment?: string; performedBy: Person; createdAt: string }[]
  updatedAt: string
}
type Status = 'PENDING_REVIEW' | 'REVISION_REQUESTED' | 'APPROVED' | 'REJECTED'
type Summary = Record<Status, number>
type DesignerDocument = 'boq' | 'drawing'

const statuses: Status[] = ['PENDING_REVIEW', 'REVISION_REQUESTED', 'APPROVED', 'REJECTED']
const statusLabel = (status: Status) => status.replaceAll('_', ' ').replace(/\b\w/g, (letter) => letter.toUpperCase())
const statusVariant = (status: Status) => ({ PENDING_REVIEW: 'warning', REVISION_REQUESTED: 'info', APPROVED: 'success', REJECTED: 'danger' })[status] as 'warning' | 'info' | 'success' | 'danger'
const emptySummary = (): Summary => ({ PENDING_REVIEW: 0, REVISION_REQUESTED: 0, APPROVED: 0, REJECTED: 0 })
const descriptionModules = { toolbar: [['bold', 'italic', 'underline'], [{ list: 'ordered' }, { list: 'bullet' }], ['link'], ['clean']] }
const documentConfig = { boq: { singular: 'BOQ', plural: 'BOQs', path: 'boq', api: 'boqs' }, drawing: { singular: 'Drawing', plural: 'Drawings', path: 'drawings', api: 'drawings' } }

const BoqPage = ({ approvalOnly = false, document = 'boq' }: { approvalOnly?: boolean; document?: DesignerDocument }) => {
  const config = documentConfig[document]
  const { user } = useAuthContext()
  const admin = hasFullAppAccess(user)
  const canSeeAll = admin || canReviewDesignerDocuments(user)
  const canCreate = canManageModule(user, 'designer')
  const [clients, setClients] = useState<Client[]>([])
  const [sites, setSites] = useState<Site[]>([])
  const [boqs, setBoqs] = useState<Boq[]>([])
  const [summary, setSummary] = useState<Summary>(emptySummary())
  const [createClient, setCreateClient] = useState('')
  const [createSite, setCreateSite] = useState('')
  const [filterClient, setFilterClient] = useState('')
  const [filterSite, setFilterSite] = useState('')
  const [title, setTitle] = useState('')
  const [description, setDescription] = useState('')
  const [status, setStatus] = useState('APPROVED')
  const [file, setFile] = useState<File>()
  const [error, setError] = useState('')
  const [saving, setSaving] = useState(false)
  const [showCreate, setShowCreate] = useState(false)

  const availableSites = useMemo(() => sites.filter((item) => item.parentClient === createClient), [sites, createClient])
  const filterSites = useMemo(() => sites.filter((item) => item.parentClient === filterClient), [sites, filterClient])
  const load = async () => {
    setError('')
    try {
      const query = new URLSearchParams()
      if (filterClient) query.set('client', filterClient)
      if (filterSite) query.set('site', filterSite)
      if (approvalOnly) query.set('status', 'PENDING_REVIEW')
      else if (status) query.set('status', status)
      const [clientSites, response] = await Promise.all([
        apiFetch<{ data: { clients: Client[]; sites: Site[] } }>('/designer/client-sites'),
        apiFetch<{ data: Boq[]; summary: Summary }>(`/designer/${config.api}${query.size ? `?${query}` : ''}`),
      ])
      setClients(clientSites.data.clients)
      setSites(clientSites.data.sites)
      setBoqs(response.data)
      setSummary(response.summary)
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : 'Unable to load BOQs')
    }
  }

  useEffect(() => { load() }, [])

  const upload = async (selected?: File) => {
    if (!selected) throw new Error('Choose a PDF file')
    const body = new FormData()
    body.append('files', selected)
    const response = await apiFetch<{ data: Attachment[] }>('/designer/uploads', { method: 'POST', body })
    return response.data[0]
  }

  const submit = async (event: FormEvent) => {
    event.preventDefault()
    if (!createClient || !createSite) return setError('Choose a client and site address')
    setSaving(true)
    setError('')
    try {
      const attachment = await upload(file)
      await apiFetch(`/designer/${config.api}`, { method: 'POST', body: JSON.stringify({ client: createClient, clientSite: createSite, title, description, attachment }) })
      toast.success(`${config.singular} submitted for review`)
      setTitle('')
      setDescription('')
      setFile(undefined)
      setCreateClient('')
      setCreateSite('')
      setShowCreate(false)
      await load()
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : `Unable to submit ${config.singular}`)
    } finally {
      setSaving(false)
    }
  }

  return (
    <>
      <PageMetaData title={config.singular} />
      <Card className="mb-3">
        <CardBody>
          <div className="d-flex justify-content-between align-items-start flex-wrap gap-3">
            <div><h4 className="card-title mb-1">{approvalOnly ? `${config.singular} approvals` : config.plural}</h4><p className="text-muted mb-0">{approvalOnly ? `Review every ${config.singular.toLowerCase()} waiting for approval.` : `View ${config.plural.toLowerCase()} by client, site, status, and latest PDF.`}</p></div>
            <div className="d-flex gap-2"><Button variant="outline-secondary" onClick={load} disabled={saving}>Refresh</Button>{canCreate && !approvalOnly && <Button onClick={() => setShowCreate(true)}>Create {config.singular}</Button>}</div>
          </div>
          {error && <Alert className="mt-3 mb-0" variant="danger">{error}</Alert>}
        </CardBody>
      </Card>
      {canSeeAll && !approvalOnly && <Row className="g-3 mb-3">{statuses.map((item) => <Col key={item} sm={6} xl={3}><Card><CardBody><small className="text-muted">{statusLabel(item)}</small><h3 className="mb-0 mt-1">{summary[item]}</h3></CardBody></Card></Col>)}</Row>}
      {showCreate && <Card className="mb-3">
        <CardBody>
          <div className="d-flex justify-content-between align-items-center mb-3"><h5 className="mb-0">Create {config.singular}</h5><Button size="sm" variant="outline-secondary" onClick={() => setShowCreate(false)} disabled={saving}>Cancel</Button></div>
          <Form onSubmit={submit}>
            <Row className="g-3">
              <Col md={6}><Form.Label htmlFor="boq-title">Title</Form.Label><Form.Control id="boq-title" required maxLength={160} value={title} onChange={(event) => setTitle(event.target.value)} placeholder={`e.g. Tower A ${config.singular.toLowerCase()}`} /></Col>
              <Col md={6}><Form.Label htmlFor="boq-client">Client</Form.Label><Form.Select id="boq-client" required value={createClient} onChange={(event) => { setCreateClient(event.target.value); setCreateSite('') }}><option value="">Select client</option>{clients.map((item) => <option key={item._id} value={item._id}>{item.name}</option>)}</Form.Select></Col>
              <Col md={6}><Form.Label htmlFor="boq-site">Client address</Form.Label><Form.Select id="boq-site" required disabled={!createClient} value={createSite} onChange={(event) => setCreateSite(event.target.value)}><option value="">Select address</option>{availableSites.map((item) => <option key={item._id} value={item._id}>{item.siteName || item.name} — {item.siteAddress}</option>)}</Form.Select></Col>
              <Col xs={12}><Form.Label>Description</Form.Label><ReactQuill className="boq-description-editor" theme="snow" value={description} onChange={setDescription} modules={descriptionModules} placeholder={`Add ${config.singular.toLowerCase()} scope, notes, or revision details`} /><Form.Text>Use the toolbar for headings, lists, emphasis, and links.</Form.Text></Col>
              <Col xs={12}><DropzoneFormInput label={`${config.singular} PDF`} iconProps={{ icon: 'bx:cloud-upload', height: 34, width: 34 }} text={`Drag & drop the ${config.singular.toLowerCase()} PDF here, or browse`} helpText="One PDF, up to 10 MB." showPreview={false} accept={{ 'application/pdf': ['.pdf'] }} maxFiles={1} onFileUpload={(files) => setFile(files[0])} />{file && <div className="small text-muted mt-2">Selected: {file.name}</div>}</Col>
              <Col xs={12}><Button type="submit" disabled={saving}>{saving ? 'Submitting…' : 'Submit for review'}</Button></Col>
            </Row>
          </Form>
        </CardBody>
      </Card>
      }
      <Card>
        <CardBody>
          <div className="row g-2 mb-3">
            <div className={approvalOnly ? 'col-md-6' : 'col-md-4'}><Form.Label className="visually-hidden" htmlFor="boq-filter-client">Client</Form.Label><Form.Select id="boq-filter-client" value={filterClient} onChange={(event) => { setFilterClient(event.target.value); setFilterSite('') }}><option value="">All clients</option>{clients.map((item) => <option key={item._id} value={item._id}>{item.name}</option>)}</Form.Select></div>
            <div className={approvalOnly ? 'col-md-6' : 'col-md-4'}><Form.Label className="visually-hidden" htmlFor="boq-filter-site">Client address</Form.Label><Form.Select id="boq-filter-site" value={filterSite} disabled={!filterClient} onChange={(event) => setFilterSite(event.target.value)}><option value="">All addresses</option>{filterSites.map((item) => <option key={item._id} value={item._id}>{item.siteName || item.name} — {item.siteAddress}</option>)}</Form.Select></div>
            {!approvalOnly && <div className="col-md-4"><Form.Label className="visually-hidden" htmlFor="boq-filter-status">Status</Form.Label><Form.Select id="boq-filter-status" value={status} onChange={(event) => setStatus(event.target.value)}><option value="">All statuses</option>{statuses.map((item) => <option key={item} value={item}>{statusLabel(item)}</option>)}</Form.Select></div>}
          </div>
          <div className="d-flex justify-content-between align-items-center mb-3"><h5 className="mb-0">{approvalOnly ? 'Waiting for approval' : canSeeAll ? `All ${config.plural}` : `My ${config.plural}`}</h5><Button size="sm" variant="outline-primary" onClick={load} disabled={saving}>Apply filters</Button></div>
          <Table responsive hover className="align-middle mb-0" style={{ minWidth: canSeeAll ? 1160 : 980 }}>
            <thead><tr><th>{config.singular}</th><th>Client / site</th><th>Status</th><th>Version</th>{canSeeAll && <th>Designer</th>}<th>Updated</th><th style={{ minWidth: 190 }} /></tr></thead>
            <tbody>
              {boqs.map((boq) => {
                const current = boq.versions[boq.versions.length - 1]
                return <tr key={boq._id}>
                  <td><div className="fw-semibold">{boq.title}</div></td>
                  <td><div>{boq.client.name}</div><small className="text-muted">{boq.clientSite.siteName || boq.clientSite.name}{boq.clientSite.siteAddress && ` — ${boq.clientSite.siteAddress}`}</small></td>
                  <td><Badge bg={statusVariant(boq.status)}>{statusLabel(boq.status)}</Badge></td>
                  <td><div>v{current?.number || 1}</div><small className="text-muted">{current?.attachment.originalName || `${config.singular} PDF`}</small></td>
                  {canSeeAll && <td>{boq.createdBy.name}</td>}
                  <td>{new Date(boq.updatedAt).toLocaleDateString()}</td>
                  <td className="text-end">
                    <div className="d-inline-flex align-items-start gap-2 flex-nowrap">
                      {current && <a href={current.attachment.url} target="_blank" rel="noreferrer"><Button size="sm" variant="outline-secondary" className="text-nowrap">View PDF</Button></a>}
                      <Link to={`/designer/${config.path}/${boq._id}`}><Button size="sm" variant="outline-primary" className="text-nowrap">Open</Button></Link>
                    </div>
                  </td>
                </tr>
              })}
              {!boqs.length && <tr><td className="text-center text-muted py-4" colSpan={canSeeAll ? 7 : 6}>{approvalOnly ? `No ${config.plural.toLowerCase()} are waiting for approval.` : `No ${config.plural.toLowerCase()} found.`}</td></tr>}
            </tbody>
          </Table>
        </CardBody>
      </Card>
    </>
  )
}

export default BoqPage
