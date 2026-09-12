import PageMetaData from '@/components/PageTitle'
import { useAuthContext } from '@/context/useAuthContext'
import { apiFetch } from '@/helpers/api'
import { canManageModule, canReviewDesignerDocuments } from '@/helpers/moduleAccess'
import { useEffect, useState } from 'react'
import { Alert, Badge, Button, Card, CardBody, Col, Form, Row } from 'react-bootstrap'
import { Link, useParams } from 'react-router-dom'
import { toast } from 'react-toastify'

type Status = 'PENDING_REVIEW' | 'REVISION_REQUESTED' | 'APPROVED' | 'REJECTED'
type DesignerDocument = 'boq' | 'drawing'
type Attachment = { key: string; contentType: string; originalName?: string; size: number; checksum: string; attachmentToken: string; url?: string }
type Boq = {
  _id: string
  title: string
  description?: string
  status: Status
  client: { name: string }
  clientSite: { name: string; siteName?: string; siteAddress?: string }
  createdBy: { name: string; email: string }
  versions: { _id: string; number: number; attachment: Attachment; uploadedBy: { name: string }; uploadedAt: string }[]
  history: { _id: string; action: string; comment?: string; attachment?: Attachment; performedBy: { name: string }; createdAt: string }[]
}

const statusLabel = (status: string) => status.replaceAll('_', ' ').replace(/\b\w/g, (letter) => letter.toUpperCase())
const statusVariant = (status: Status) => ({ PENDING_REVIEW: 'warning', REVISION_REQUESTED: 'info', APPROVED: 'success', REJECTED: 'danger' })[status] as 'warning' | 'info' | 'success' | 'danger'
const timelineLabel = (action: string) => ({ SUBMITTED: 'Submitted for approval', REVISION_REQUESTED: 'Changes requested', APPROVED: 'Approved', REJECTED: 'Rejected' })[action] || action
const descriptionText = (value?: string) => new DOMParser().parseFromString(value || '', 'text/html').body.textContent?.trim() || ''
const documentConfig = { boq: { singular: 'BOQ', plural: 'BOQs', path: 'boq', api: 'boqs' }, drawing: { singular: 'Drawing', plural: 'Drawings', path: 'drawings', api: 'drawings' } }

const BoqDetailPage = ({ document = 'boq' }: { document?: DesignerDocument }) => {
  const config = documentConfig[document]
  const { documentId } = useParams()
  const { user } = useAuthContext()
  const canReview = canReviewDesignerDocuments(user)
  const canManage = canManageModule(user, 'designer')
  const [boq, setBoq] = useState<Boq>()
  const [file, setFile] = useState<File>()
  const [reviewFile, setReviewFile] = useState<File>()
  const [comment, setComment] = useState('')
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  const currentVersion = boq && boq.versions[boq.versions.length - 1]

  const load = async () => {
    if (!documentId) return
    setError('')
    try {
      const response = await apiFetch<{ data: Boq }>(`/designer/${config.api}/${documentId}`)
      setBoq(response.data)
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : `Unable to load ${config.singular}`)
    }
  }

  useEffect(() => { load() }, [documentId])

  const upload = async (selected?: File) => {
    if (!selected) throw new Error('Choose a file')
    const body = new FormData()
    body.append('files', selected)
    const response = await apiFetch<{ data: Attachment[] }>('/designer/uploads', { method: 'POST', body })
    return response.data[0]
  }

  const resubmit = async () => {
    if (!boq) return
    setSaving(true)
    setError('')
    try {
      const attachment = await upload(file)
      const response = await apiFetch<{ data: Boq }>(`/designer/${config.api}/${boq._id}/resubmit`, { method: 'POST', body: JSON.stringify({ attachment }) })
      setBoq(response.data)
      setFile(undefined)
      toast.success(`Corrected ${config.singular.toLowerCase()} submitted for approval`)
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : `Unable to submit corrected ${config.singular}`)
    } finally {
      setSaving(false)
    }
  }

  const review = async (action: 'APPROVE' | 'REQUEST_REVISION' | 'REJECT') => {
    if (!boq) return
    setSaving(true)
    setError('')
    try {
      const attachment = reviewFile ? await upload(reviewFile) : undefined
      const response = await apiFetch<{ data: Boq }>(`/designer/${config.api}/${boq._id}/review`, { method: 'POST', body: JSON.stringify({ action, comment, attachment }) })
      setBoq(response.data)
      setComment('')
      setReviewFile(undefined)
      toast.success(action === 'APPROVE' ? `${config.singular} approved` : action === 'REJECT' ? `${config.singular} rejected` : 'Changes requested')
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : `Unable to review ${config.singular}`)
    } finally {
      setSaving(false)
    }
  }

  return (
    <>
      <PageMetaData title={boq ? boq.title : config.singular} />
      {error && <Alert variant="danger">{error}</Alert>}
      {!boq && !error && <Card><CardBody className="text-muted">Loading {config.singular}...</CardBody></Card>}
      {boq && <>
        <Card className="mb-3">
          <CardBody>
            <div className="d-flex justify-content-between align-items-start flex-wrap gap-3">
              <div><Link to={`/designer/${config.path}`}><Button size="sm" variant="outline-secondary">Back to {config.plural}</Button></Link><h4 className="card-title mt-3 mb-1">{boq.title}</h4><div className="text-muted">{boq.client.name} — {boq.clientSite.siteName || boq.clientSite.name}</div></div>
              <div className="d-flex align-items-center gap-2"><Badge bg={statusVariant(boq.status)}>{statusLabel(boq.status)}</Badge>{currentVersion?.attachment.url && <a href={currentVersion.attachment.url} target="_blank" rel="noreferrer"><Button size="sm" variant="outline-secondary">View latest PDF</Button></a>}</div>
            </div>
            <Row className="g-3 border-top mt-3 pt-3">
              <Col sm={6} lg={3}><small className="text-muted d-block">Client</small><span>{boq.client.name}</span></Col>
              <Col sm={6} lg={3}><small className="text-muted d-block">Site</small><span>{boq.clientSite.siteName || boq.clientSite.name}</span></Col>
              <Col sm={6} lg={3}><small className="text-muted d-block">Submitted by</small><span>{boq.createdBy.name}</span></Col>
              <Col sm={6} lg={3}><small className="text-muted d-block">Current version</small><span>v{boq.versions.length}</span></Col>
            </Row>
          </CardBody>
        </Card>
        {canReview && boq.status === 'PENDING_REVIEW' && <Card className="mb-3"><CardBody><div className="d-flex justify-content-between align-items-start flex-wrap gap-2 mb-3"><div><h5 className="mb-1">Review {config.singular}</h5><p className="text-muted mb-0">Choose an outcome and leave clear instructions for the designer.</p></div><Badge bg="warning" text="dark">Waiting for your decision</Badge></div><Form><Row className="g-3"><Col xs={12}><div className="border rounded p-3 d-flex justify-content-between align-items-center flex-wrap gap-3"><div><small className="text-muted d-block">Designer is requesting approval for</small><div className="fw-semibold">{config.singular} v{currentVersion?.number || 1} — {currentVersion?.attachment.originalName || 'Submitted PDF'}</div><small className="text-muted">Uploaded by {currentVersion?.uploadedBy.name || boq.createdBy.name} on {currentVersion?.uploadedAt ? new Date(currentVersion.uploadedAt).toLocaleString() : '-'}</small></div>{currentVersion?.attachment.url && <a href={currentVersion.attachment.url} target="_blank" rel="noreferrer"><Button type="button" size="sm" variant="outline-primary">View PDF for approval</Button></a>}</div></Col><Col md={8}><Form.Label htmlFor="boq-review-comment">Review note</Form.Label><Form.Control as="textarea" rows={4} id="boq-review-comment" value={comment} onChange={(event) => setComment(event.target.value)} placeholder="Example: Please update the hardware quantities on page 3." /><Form.Text>Required when requesting changes or rejecting.</Form.Text></Col><Col md={4}><Form.Label htmlFor="boq-review-attachment">Approval attachment</Form.Label><Form.Control id="boq-review-attachment" type="file" accept="application/pdf,image/jpeg,image/png,image/webp" onChange={(event) => setReviewFile((event.target as HTMLInputElement).files?.[0])} /><Form.Text>Optional PDF or image, up to 10 MB.</Form.Text>{reviewFile && <div className="small text-muted mt-2">Selected: {reviewFile.name}</div>}</Col><Col xs={12}><div className="d-flex flex-wrap gap-2"><Button type="button" variant="success" disabled={saving} onClick={() => review('APPROVE')}>Approve {config.singular}</Button><Button type="button" variant="outline-primary" disabled={saving} onClick={() => review('REQUEST_REVISION')}>Request changes</Button><Button type="button" variant="outline-danger" disabled={saving} onClick={() => review('REJECT')}>Reject {config.singular}</Button></div></Col></Row></Form></CardBody></Card>}
        <Row className="g-3">
          <Col lg={8}>
            <Card>
              <CardBody>
                <h5 className="mb-1">Approval timeline</h5><p className="text-muted mb-3">Every submission, reviewer decision, comment, and attachment is recorded here.</p>
                <ul className="list-unstyled left-timeline mb-0">
                  {boq.history.map((entry, index) => {
                    const version = entry.action === 'SUBMITTED' ? boq.versions[boq.history.slice(0, index + 1).filter((item) => item.action === 'SUBMITTED').length - 1] : undefined
                    return <li className="left-timeline-list pb-3" key={entry._id}><div className="border rounded p-3"><div className="d-flex justify-content-between gap-2 flex-wrap"><strong>{timelineLabel(entry.action)}</strong><small className="text-muted">{new Date(entry.createdAt).toLocaleString()}</small></div><div className="text-muted mt-1">{entry.performedBy.name}</div>{entry.comment && <div className="mt-2">{entry.comment}</div>}{entry.attachment && <a className="d-inline-block mt-2" href={entry.attachment.url} target="_blank" rel="noreferrer">View reviewer attachment: {entry.attachment.originalName || 'Attachment'}</a>}{version && <a className="d-block mt-2" href={version.attachment.url} target="_blank" rel="noreferrer">View v{version.number}: {version.attachment.originalName || `${config.singular} PDF`}</a>}</div></li>
                  })}
                </ul>
              </CardBody>
            </Card>
          </Col>
          <Col lg={4}>
            <Card className="mb-3"><CardBody><h5 className="mb-2">Description</h5><div>{descriptionText(boq.description) || 'No description provided.'}</div></CardBody></Card>
            <Card className="mb-3"><CardBody><h5 className="mb-2">PDF versions</h5>{boq.versions.map((version) => <div className="mb-2" key={version._id}><a href={version.attachment.url} target="_blank" rel="noreferrer">v{version.number}: {version.attachment.originalName || `${config.singular} PDF`}</a><small className="d-block text-muted">Uploaded by {version.uploadedBy.name} · {new Date(version.uploadedAt).toLocaleString()}</small></div>)}</CardBody></Card>
            {boq.status === 'REVISION_REQUESTED' && <Alert variant="info"><strong>Changes requested.</strong> Use the reviewer note in the timeline, upload a corrected PDF, and submit it again.</Alert>}
            {canManage && boq.status === 'REVISION_REQUESTED' && <Card className="mb-3"><CardBody><h5 className="mb-2">Upload corrected {config.singular}</h5><Form.Label className="visually-hidden" htmlFor="boq-revision-file">Corrected {config.singular} PDF</Form.Label><Form.Control id="boq-revision-file" type="file" accept="application/pdf" onChange={(event) => setFile((event.target as HTMLInputElement).files?.[0])} /><Button className="mt-2" size="sm" disabled={saving} onClick={resubmit}>Submit for approval again</Button></CardBody></Card>}
          </Col>
        </Row>
      </>}
    </>
  )
}

export default BoqDetailPage
