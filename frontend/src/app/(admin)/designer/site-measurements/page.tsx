import PageMetaData from '@/components/PageTitle'
import DropzoneFormInput from '@/components/form/DropzoneFormInput'
import { useAuthContext } from '@/context/useAuthContext'
import { apiFetch } from '@/helpers/api'
import { canManageModule, hasFullAppAccess } from '@/helpers/moduleAccess'
import { FormEvent, Fragment, useEffect, useMemo, useState } from 'react'
import { Alert, Button, Card, CardBody, Col, Form, Row, Table } from 'react-bootstrap'
import ReactQuill from 'react-quill-new'
import { toast } from 'react-toastify'
import 'react-quill-new/dist/quill.snow.css'

type Attachment = { key: string; contentType: string; originalName?: string; attachmentToken: string; url?: string }
type Client = { _id: string; name: string }
type Site = { _id: string; name: string; parentClient: string; siteName?: string; siteAddress?: string }
type Measurement = { _id: string; client: Client; clientSite: Site; title: string; description?: string; attachment: Attachment; createdBy: { name: string }; createdAt: string }
type MeasurementSite = { client: Client; site: Site; measurements: Measurement[] }

const descriptionModules = { toolbar: [['bold', 'italic', 'underline'], [{ list: 'ordered' }, { list: 'bullet' }], ['link'], ['clean']] }
const descriptionText = (value?: string) => new DOMParser().parseFromString(value || '', 'text/html').body.textContent?.trim() || ''

const SiteMeasurementsPage = () => {
  const { user } = useAuthContext()
  const admin = hasFullAppAccess(user)
  const canCreate = canManageModule(user, 'designer')
  const [clients, setClients] = useState<Client[]>([])
  const [sites, setSites] = useState<Site[]>([])
  const [measurements, setMeasurements] = useState<Measurement[]>([])
  const [createClient, setCreateClient] = useState('')
  const [createSite, setCreateSite] = useState('')
  const [filterClient, setFilterClient] = useState('')
  const [filterSite, setFilterSite] = useState('')
  const [title, setTitle] = useState('')
  const [description, setDescription] = useState('')
  const [file, setFile] = useState<File>()
  const [expanded, setExpanded] = useState('')
  const [showCreate, setShowCreate] = useState(false)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')

  const availableSites = useMemo(() => sites.filter((site) => site.parentClient === createClient), [sites, createClient])
  const filterSites = useMemo(() => sites.filter((site) => site.parentClient === filterClient), [sites, filterClient])
  const measurementSites = useMemo(() => Array.from(measurements.reduce((groups, measurement) => {
    const key = `${measurement.client._id}:${measurement.clientSite._id}`
    const group = groups.get(key) || { client: measurement.client, site: measurement.clientSite, measurements: [] }
    group.measurements.push(measurement)
    groups.set(key, group)
    return groups
  }, new Map<string, MeasurementSite>()).values()), [measurements])

  const load = async () => {
    setError('')
    try {
      const query = new URLSearchParams()
      if (filterClient) query.set('client', filterClient)
      if (filterSite) query.set('site', filterSite)
      const [clientSites, response] = await Promise.all([
        apiFetch<{ data: { clients: Client[]; sites: Site[] } }>('/designer/client-sites'),
        apiFetch<{ data: Measurement[] }>(`/designer/site-measurements${query.size ? `?${query}` : ''}`),
      ])
      setClients(clientSites.data.clients)
      setSites(clientSites.data.sites)
      setMeasurements(response.data)
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : 'Unable to load site measurements')
    }
  }

  useEffect(() => { load() }, [])

  const submit = async (event: FormEvent) => {
    event.preventDefault()
    if (!createClient || !createSite) return setError('Choose a client and site address')
    if (!file) return setError('Choose a PDF file')
    setSaving(true)
    setError('')
    try {
      const body = new FormData()
      body.append('files', file)
      const upload = await apiFetch<{ data: Attachment[] }>('/designer/uploads', { method: 'POST', body })
      await apiFetch('/designer/site-measurements', { method: 'POST', body: JSON.stringify({ client: createClient, clientSite: createSite, title, description, attachment: upload.data[0] }) })
      toast.success('Site measurement added')
      setTitle('')
      setDescription('')
      setFile(undefined)
      setCreateClient('')
      setCreateSite('')
      setShowCreate(false)
      await load()
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : 'Unable to add site measurement')
    } finally {
      setSaving(false)
    }
  }

  return <>
    <PageMetaData title="Site Measurements" />
    <Card className="mb-3"><CardBody><div className="d-flex justify-content-between align-items-start flex-wrap gap-3"><div><h4 className="card-title mb-1">Site Measurements</h4><p className="text-muted mb-0">Keep a PDF record for every site visit. Multiple entries can be added to the same address.</p></div><div className="d-flex gap-2"><Button variant="outline-secondary" onClick={load} disabled={saving}>Refresh</Button>{canCreate && <Button onClick={() => setShowCreate(true)}>Add site measurement</Button>}</div></div>{error && <Alert className="mt-3 mb-0" variant="danger">{error}</Alert>}</CardBody></Card>
    {showCreate && <Card className="mb-3"><CardBody><div className="d-flex justify-content-between align-items-center mb-3"><h5 className="mb-0">Add site measurement</h5><Button size="sm" variant="outline-secondary" onClick={() => setShowCreate(false)} disabled={saving}>Cancel</Button></div><Form onSubmit={submit}><Row className="g-3"><Col md={6}><Form.Label htmlFor="measurement-title">Title</Form.Label><Form.Control id="measurement-title" required maxLength={160} value={title} onChange={(event) => setTitle(event.target.value)} placeholder="e.g. First site visit" /></Col><Col md={6}><Form.Label htmlFor="measurement-client">Client</Form.Label><Form.Select id="measurement-client" required value={createClient} onChange={(event) => { setCreateClient(event.target.value); setCreateSite('') }}><option value="">Select client</option>{clients.map((client) => <option key={client._id} value={client._id}>{client.name}</option>)}</Form.Select></Col><Col md={6}><Form.Label htmlFor="measurement-site">Client address</Form.Label><Form.Select id="measurement-site" required disabled={!createClient} value={createSite} onChange={(event) => setCreateSite(event.target.value)}><option value="">Select address</option>{availableSites.map((site) => <option key={site._id} value={site._id}>{site.siteName || site.name} — {site.siteAddress}</option>)}</Form.Select></Col><Col xs={12}><Form.Label>Description</Form.Label><ReactQuill className="boq-description-editor" theme="snow" value={description} onChange={setDescription} modules={descriptionModules} placeholder="Add site measurements, notes, or visit details" /><Form.Text>Use the toolbar for lists, emphasis, and links.</Form.Text></Col><Col xs={12}><DropzoneFormInput label="Site measurement PDF" iconProps={{ icon: 'bx:cloud-upload', height: 34, width: 34 }} text="Drag & drop the measurement PDF here, or browse" helpText="One PDF, up to 10 MB." showPreview={false} accept={{ 'application/pdf': ['.pdf'] }} maxFiles={1} onFileUpload={(files) => setFile(files[0])} />{file && <div className="small text-muted mt-2">Selected: {file.name}</div>}</Col><Col xs={12}><Button type="submit" disabled={saving}>{saving ? 'Saving…' : 'Save site measurement'}</Button></Col></Row></Form></CardBody></Card>}
    <Card><CardBody><div className="row g-2 mb-3"><div className="col-md-6"><Form.Label className="visually-hidden" htmlFor="measurement-filter-client">Client</Form.Label><Form.Select id="measurement-filter-client" value={filterClient} onChange={(event) => { setFilterClient(event.target.value); setFilterSite('') }}><option value="">All clients</option>{clients.map((client) => <option key={client._id} value={client._id}>{client.name}</option>)}</Form.Select></div><div className="col-md-6"><Form.Label className="visually-hidden" htmlFor="measurement-filter-site">Client address</Form.Label><Form.Select id="measurement-filter-site" disabled={!filterClient} value={filterSite} onChange={(event) => setFilterSite(event.target.value)}><option value="">All addresses</option>{filterSites.map((site) => <option key={site._id} value={site._id}>{site.siteName || site.name} — {site.siteAddress}</option>)}</Form.Select></div></div><div className="d-flex justify-content-between align-items-center mb-3"><h5 className="mb-0">{admin ? 'All sites with measurements' : 'My sites with measurements'}</h5><Button size="sm" variant="outline-primary" onClick={load} disabled={saving}>Apply filters</Button></div><Table responsive hover className="align-middle mb-0" style={{ minWidth: admin ? 980 : 840 }}><thead><tr><th>Client / site</th><th>Measurements</th>{admin && <th>Latest designer</th>}<th>Latest visit</th><th /></tr></thead><tbody>{measurementSites.map(({ client, site, measurements: entries }) => { const latest = entries[0]; const key = `${client._id}:${site._id}`; return <Fragment key={key}><tr><td><div className="fw-semibold">{client.name}</div><small className="text-muted">{site.siteName || site.name}{site.siteAddress && ` — ${site.siteAddress}`}</small></td><td>{entries.length}</td>{admin && <td>{latest.createdBy.name}</td>}<td><div>{latest.title}</div><small className="text-muted">{new Date(latest.createdAt).toLocaleDateString()}</small></td><td className="text-end"><Button size="sm" variant="outline-primary" onClick={() => setExpanded(expanded === key ? '' : key)}>{expanded === key ? 'Hide measurements' : 'View timeline'}</Button></td></tr>{expanded === key && <tr><td colSpan={admin ? 5 : 4} className="bg-body-tertiary"><div className="py-2"><div className="small text-muted mb-3">Measurement timeline — newest first</div><div className="border-start border-primary ms-2 ps-4 d-grid gap-3">{entries.map((measurement) => <div className="position-relative" key={measurement._id}><span aria-hidden="true" className="position-absolute top-0 start-0 translate-middle rounded-circle bg-primary border border-3 border-body" style={{ height: 14, width: 14 }} /><div className="border rounded bg-body p-3"><div className="d-flex justify-content-between align-items-start gap-3 flex-wrap"><div><strong>{measurement.title}</strong><div className="small text-muted mt-1">{new Date(measurement.createdAt).toLocaleString()} · {measurement.createdBy.name}</div></div>{measurement.attachment.url && <a href={measurement.attachment.url} target="_blank" rel="noreferrer"><Button size="sm" variant="outline-secondary">View PDF</Button></a>}</div><p className="mb-0 mt-2">{descriptionText(measurement.description) || 'No description provided.'}</p></div></div>)}</div></div></td></tr>}</Fragment> })}{!measurementSites.length && <tr><td className="text-center text-muted py-4" colSpan={admin ? 5 : 4}>No sites with measurements found.</td></tr>}</tbody></Table></CardBody></Card>
  </>
}

export default SiteMeasurementsPage
