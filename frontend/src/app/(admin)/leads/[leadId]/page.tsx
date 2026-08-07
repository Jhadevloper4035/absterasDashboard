import PageMetaData from '@/components/PageTitle'
import DeleteConfirmModal from '@/components/DeleteConfirmModal'
import DropzoneFormInput from '@/components/form/DropzoneFormInput'
import IconifyIcon from '@/components/wrappers/IconifyIcon'
import { apiFetch } from '@/helpers/api'
import { uploadMultipartFiles } from '@/helpers/upload'
import { useAuthStore } from '@/store/authStore'
import type { UploadFileType } from '@/types/component-props'
import type { UserType } from '@/types/auth'
import type { LeadAttachment, LeadOwner, LeadType } from '@/types/lead'
import { formatFileSize } from '@/utils/other'
import { FormEvent, useEffect, useMemo, useState } from 'react'
import { Alert, Badge, Button, Card, CardBody, Col, Form, Row } from 'react-bootstrap'
import { Link, useNavigate, useParams } from 'react-router-dom'
import { toast } from 'react-toastify'

const personName = (person?: string | LeadOwner) => (typeof person === 'object' ? person.name : '')
const personRole = (person?: string | LeadOwner) => (typeof person === 'object' ? person.role : '')
const roleLabel = (role?: string) => (role ? role.replace('superadmin', 'Super Admin').replace('admin', 'Admin').replace('sales', 'Sales') : 'User')
const roleBadge = (role?: string) => (role === 'sales' ? 'info' : role === 'admin' || role === 'superadmin' ? 'primary' : 'secondary')
const attachmentName = (file: LeadAttachment) => (file.originalName || file.key).replace(/^\.?\//, '')
const attachmentExtension = (file: LeadAttachment) => attachmentName(file).split('.').pop()?.toUpperCase() || 'FILE'
const attachmentIcon = (file: LeadAttachment) => file.contentType?.startsWith('image/') ? 'bx:image' : 'bx:paperclip'

const AttachmentDownloadList = ({ attachments, onRemove }: { attachments?: LeadAttachment[]; onRemove?: (key: string) => void }) => (
  attachments?.length ? (
    <div className="attachment-list">
      {attachments.map((file) => (
        <div className="attachment-row" key={file.key}>
          <span className="attachment-icon">
            <IconifyIcon icon={attachmentIcon(file)} />
          </span>
          <span className="attachment-meta">
            <span className="attachment-name" title={attachmentName(file)}>{attachmentName(file)}</span>
            <span className="attachment-detail">{attachmentExtension(file)}{file.size ? ` · ${formatFileSize(file.size)}` : ''}</span>
          </span>
          {onRemove ? (
            <Button size="sm" variant="outline-danger" className="text-nowrap" onClick={() => onRemove(file.key)}>Remove</Button>
          ) : file.url ? (
            <a className="btn btn-sm btn-outline-primary text-nowrap" href={file.url} target="_blank" rel="noreferrer">
              <IconifyIcon icon="bx:download" className="me-1" />
              Download
            </a>
          ) : (
            <Button size="sm" variant="outline-secondary" disabled className="text-nowrap">Unavailable</Button>
          )}
        </div>
      ))}
    </div>
  ) : null
)

const LeadDetailPage = () => {
  const { leadId } = useParams()
  const navigate = useNavigate()
  const user = useAuthStore((state) => state.user)
  const token = useAuthStore((state) => state.token)
  const [lead, setLead] = useState<LeadType>()
  const [users, setUsers] = useState<UserType[]>([])
  const [note, setNote] = useState({ text: '', attachments: [] as LeadAttachment[], specialSampleRequired: false })
  const [uploadingNote, setUploadingNote] = useState(false)
  const [uploadNoteProgress, setUploadNoteProgress] = useState(0)
  const [uploadNoteFailed, setUploadNoteFailed] = useState(false)
  const [meetingForm, setMeetingForm] = useState({ title: '', startsAt: '', notes: '' })
  const [deleteOpen, setDeleteOpen] = useState(false)
  const [deleting, setDeleting] = useState(false)
  const [error, setError] = useState('')
  const [message, setMessage] = useState('')
  const canAssign = user?.role === 'superadmin' || user?.role === 'admin'
  const salespeople = useMemo(() => users.filter((item) => (item.role === 'sales' || item.additionalRoles?.includes('sales')) && item.status === 'active'), [users])

  useEffect(() => {
    if (!token || !leadId) return

    const load = async () => {
      setError('')
      try {
        const [leadRes, userRes] = await Promise.all([
          apiFetch<{ data: LeadType }>(`/leads/${leadId}`, { token }),
          canAssign ? apiFetch<{ data: UserType[] }>('/users', { token }) : Promise.resolve({ data: [] }),
        ])
        setLead(leadRes.data)
        setUsers(userRes.data)
      } catch (e) {
        setError(e instanceof Error ? e.message : 'Unable to load lead')
      }
    }

    load()
  }, [canAssign, leadId, token])

  useEffect(() => {
    if (!lead) return
    setMeetingForm({
      title: lead.nextMeeting?.title || `${lead.name} meeting`,
      startsAt: lead.nextMeeting?.startsAt ? lead.nextMeeting.startsAt.slice(0, 16) : '',
      notes: lead.nextMeeting?.notes || '',
    })
  }, [lead?._id, lead?.nextMeeting?.startsAt])

  const updateLead = async (patch: Record<string, unknown>) => {
    if (!token || !leadId) return
    setError('')
    setMessage('')

    try {
      const res = await apiFetch<{ data: LeadType }>(`/leads/${leadId}`, {
        method: 'PATCH',
        body: JSON.stringify(patch),
        token,
      })
      setLead(res.data)
      setMessage('Lead updated')
      toast.success('Lead updated')
    } catch (e) {
      const message = e instanceof Error ? e.message : 'Unable to update lead'
      setError(message)
      toast.error(message)
    }
  }

  const addNote = async (event: FormEvent) => {
    event.preventDefault()
    const text = note.text.trim()
    if (!text && !note.attachments.length && !note.specialSampleRequired) return
    if (uploadingNote) {
      setError('Please wait until attachments finish uploading before saving the note.')
      return
    }
    if (uploadNoteFailed) {
      setError('Attachment upload failed. Please upload the file again before saving the note.')
      return
    }
    await updateLead({
      noteText: text,
      noteAttachments: note.attachments,
      specialSampleRequired: note.specialSampleRequired,
    })
    setNote({ text: '', attachments: [], specialSampleRequired: false })
    setUploadNoteProgress(0)
    setUploadNoteFailed(false)
  }

  const uploadNoteFiles = async (files: UploadFileType[]) => {
    if (!token || !files.length) return
    setUploadingNote(true)
    setUploadNoteProgress(0)
    setUploadNoteFailed(false)
    setError('')
    try {
      const attachments = await uploadMultipartFiles<LeadAttachment>(files, token, setUploadNoteProgress)
      setNote((value) => ({ ...value, attachments: [...value.attachments, ...attachments] }))
    } catch (e) {
      setUploadNoteFailed(true)
      setError(e instanceof Error ? e.message : 'Unable to upload note attachments')
    } finally {
      setUploadingNote(false)
    }
  }

  const saveMeeting = async (event: FormEvent) => {
    event.preventDefault()
    await updateLead({ nextMeeting: meetingForm })
  }

  const cancelMeeting = async () => {
    await updateLead({ cancelMeeting: true, cancelMeetingNote: meetingForm.notes })
  }

  const deleteLead = async () => {
    if (!token || !leadId || !lead || !canAssign) return

    setDeleting(true)
    try {
      await apiFetch(`/leads/${leadId}`, { method: 'DELETE', token })
      toast.success('Lead deleted')
      navigate('/leads')
    } catch (e) {
      const message = e instanceof Error ? e.message : 'Unable to delete lead'
      setError(message)
      toast.error(message)
    } finally {
      setDeleting(false)
    }
  }

  if (!lead) {
    return (
      <>
        <PageMetaData title="Lead Detail" />
        {error ? <Alert variant="danger">{error}</Alert> : <Alert variant="info">Loading lead...</Alert>}
      </>
    )
  }

  const meetingHistory = lead.meetingHistory?.length ? lead.meetingHistory : lead.nextMeeting?.startsAt ? [lead.nextMeeting] : []
  const noteTimeline = [...(lead.notes || [])].sort((a, b) => (new Date(b.createdAt || 0).getTime() || 0) - (new Date(a.createdAt || 0).getTime() || 0))

  return (
    <>
      <PageMetaData title={lead.name} />
      <div className="d-flex align-items-center justify-content-between flex-wrap gap-2 mb-4">
        <Link to="/leads" className="btn btn-sm btn-outline-secondary text-nowrap">
          <IconifyIcon icon="bx:left-arrow-alt" className="me-1" />
          Back
        </Link>
        {canAssign && (
          <Button type="button" size="sm" variant="outline-danger" className="text-nowrap" onClick={() => setDeleteOpen(true)}>
            Delete lead
          </Button>
        )}
      </div>
      {error && <Alert variant="danger">{error}</Alert>}
      {message && <Alert variant="success">{message}</Alert>}
      <Row className="g-4">
        <Col xl={8}>
          <Card className="mb-4">
            <CardBody>
              <div className="d-flex align-items-start justify-content-between flex-wrap gap-3 mb-4">
                <div>
                  <h4 className="card-title mb-1">{lead.name}</h4>
                  <div className="text-muted">{lead.company || 'No company'}</div>
                </div>
                <Badge bg={lead.assignmentException ? 'warning' : 'success'} text={lead.assignmentException ? 'dark' : undefined}>
                  {lead.status}
                </Badge>
              </div>
              <Row className="g-3">
                <Col md={6}>
                  <div className="border rounded p-3 h-100">
                    <div className="text-muted fs-13">Phone</div>
                    <div className="fw-medium text-break">{lead.phone || '-'}</div>
                  </div>
                </Col>
                <Col md={6}>
                  <div className="border rounded p-3 h-100">
                    <div className="text-muted fs-13">Email</div>
                    <div className="fw-medium text-break">{lead.email || '-'}</div>
                  </div>
                </Col>
                <Col md={6}>
                  <div className="border rounded p-3 h-100">
                    <div className="text-muted fs-13">Source</div>
                    <div className="fw-medium text-break">{lead.source}</div>
                  </div>
                </Col>
                <Col md={6}>
                  <div className="border rounded p-3 h-100">
                    <div className="text-muted fs-13">Product enquiry</div>
                    <div className="fw-medium text-break">{lead.productInterest || '-'}</div>
                  </div>
                </Col>
                <Col md={6}>
                  <div className="border rounded p-3 h-100">
                    <div className="text-muted fs-13">Site address</div>
                    <div className="fw-medium text-break">{lead.siteAddress || '-'}</div>
                  </div>
                </Col>
                <Col md={6}>
                  <div className="border rounded p-3 h-100">
                    <div className="text-muted fs-13">Google Map URL</div>
                    {lead.googleMapUrl ? (
                      <a href={lead.googleMapUrl} target="_blank" rel="noreferrer" className="fw-medium text-break">
                        Open map
                      </a>
                    ) : (
                      <div className="fw-medium">-</div>
                    )}
                  </div>
                </Col>
                <Col md={6}>
                  <div className="border rounded p-3 h-100">
                    <div className="text-muted fs-13">Assigned salesperson</div>
                    <div className="fw-medium text-break">{personName(lead.owner) || 'Unassigned'}</div>
                  </div>
                </Col>
                <Col md={6}>
                  <div className="border rounded p-3 h-100">
                    <div className="text-muted fs-13">Created</div>
                    <div className="fw-medium">{lead.createdAt ? new Date(lead.createdAt).toLocaleString() : '-'}</div>
                  </div>
                </Col>
              </Row>
            </CardBody>
          </Card>
          <Card className="mb-4">
            <CardBody>
              <div className="d-flex align-items-center justify-content-between flex-wrap gap-2 mb-3">
                <div>
                  <h4 className="card-title mb-1">Notes</h4>
                  <div className="text-muted">Call updates, customer feedback, and next action notes</div>
                </div>
                <Badge bg="light" text="dark">{noteTimeline.length} notes</Badge>
              </div>
              <Form onSubmit={addNote} className="mb-3">
                <Form.Control as="textarea" rows={3} value={note.text} onChange={(event) => setNote({ ...note, text: event.target.value })} placeholder="Add a call note, customer update, or next action" />
                <Form.Check
                  className="my-3"
                  checked={note.specialSampleRequired}
                  onChange={(event) => setNote({ ...note, specialSampleRequired: event.target.checked })}
                  label="Special sample required"
                />
                <DropzoneFormInput
                  label="Attachments"
                  labelClassName="form-label"
                  iconProps={{ icon: 'bx:cloud-upload', height: 28, width: 28 }}
                  text="Attach files"
                  textClassName="fs-5"
                  helpText={<span className="text-muted fs-13">PDF, images, CSV, TXT. Up to 5 files.</span>}
                  showPreview={false}
                  onFileUpload={uploadNoteFiles}
                />
                {uploadingNote && (
                  <div className="text-muted fs-13 mt-2">
                    <div className="d-flex align-items-center gap-2 mb-1">
                      <span>Uploading attachment... {uploadNoteProgress}%</span>
                    </div>
                    <div className="progress" style={{ height: 6 }}>
                      <div className="progress-bar" style={{ width: `${uploadNoteProgress}%` }} />
                    </div>
                  </div>
                )}
                {!!note.attachments.length && (
                  <div className="mt-2">
                    <AttachmentDownloadList attachments={note.attachments} onRemove={(key) => setNote((value) => ({ ...value, attachments: value.attachments.filter((file) => file.key !== key) }))} />
                  </div>
                )}
                <Button type="submit" className="mt-3" disabled={uploadingNote || (!note.text.trim() && !note.attachments.length && !note.specialSampleRequired)}>
                  {uploadingNote ? 'Uploading...' : 'Add note'}
                </Button>
              </Form>
              <ul className="list-unstyled left-timeline mb-0">
                {noteTimeline.map((note) => {
                  const role = personRole(note.createdBy)
                  return (
                    <li key={note._id || note.createdAt || note.text} className="left-timeline-list pb-3">
                      <div className="border rounded p-3">
                        <div className="d-flex align-items-center justify-content-between gap-2 flex-wrap mb-1">
                          <div className="fw-medium">
                            {personName(note.createdBy) || 'Unknown user'} <Badge bg={roleBadge(role)}>{roleLabel(role)}</Badge>
                          </div>
                          <div className="text-muted fs-13">{note.createdAt ? new Date(note.createdAt).toLocaleString() : ''}</div>
                        </div>
                        {note.specialSampleRequired && <Badge bg="warning" text="dark" className="mb-2">Special sample required</Badge>}
                        <div>{note.text || '-'}</div>
                        {!!note.attachments?.length && (
                          <div className="mt-2">
                            <AttachmentDownloadList attachments={note.attachments} />
                          </div>
                        )}
                      </div>
                    </li>
                  )
                })}
              </ul>
              {!lead.notes?.length && <Alert variant="info" className="mb-0">No notes yet</Alert>}
            </CardBody>
          </Card>
        </Col>
        <Col xl={4}>
          <Card className="mb-4">
            <CardBody>
              <h4 className="card-title mb-3">Assignment</h4>
              {canAssign ? (
                <Form.Select value={typeof lead.owner === 'string' ? lead.owner : lead.owner?._id || ''} onChange={(event) => updateLead({ owner: event.target.value })}>
                  <option value="">Unassigned</option>
                  {salespeople.map((salesperson) => (
                    <option key={salesperson._id} value={salesperson._id}>
                      {salesperson.name}
                    </option>
                  ))}
                </Form.Select>
              ) : (
                <div className="border rounded p-3">
                  <div className="text-muted fs-13">Owner</div>
                  <div className="fw-medium">{personName(lead.owner) || user?.name || '-'}</div>
                </div>
              )}
            </CardBody>
          </Card>
          <Card className="mb-4">
            <CardBody>
              <h4 className="card-title mb-3">Meeting schedule</h4>
              <Form onSubmit={saveMeeting} className="mb-3">
                <Form.Group className="mb-2">
                  <Form.Label>Meeting title</Form.Label>
                  <Form.Control value={meetingForm.title} onChange={(event) => setMeetingForm({ ...meetingForm, title: event.target.value })} />
                </Form.Group>
                <Form.Group className="mb-2">
                  <Form.Label>Date and time</Form.Label>
                  <Form.Control type="datetime-local" required value={meetingForm.startsAt} onChange={(event) => setMeetingForm({ ...meetingForm, startsAt: event.target.value })} />
                </Form.Group>
                <Form.Group className="mb-2">
                  <Form.Label>Meeting notes</Form.Label>
                  <Form.Control as="textarea" rows={2} value={meetingForm.notes} onChange={(event) => setMeetingForm({ ...meetingForm, notes: event.target.value })} />
                </Form.Group>
                <div className="d-flex flex-wrap gap-2">
                  <Button type="submit" size="sm">
                    {lead.nextMeeting?.startsAt ? 'Update meeting' : 'Schedule meeting'}
                  </Button>
                  {lead.nextMeeting?.startsAt && (
                    <Button type="button" size="sm" variant="outline-danger" onClick={cancelMeeting}>
                      Cancel meeting
                    </Button>
                  )}
                </div>
              </Form>
              {lead.nextMeeting?.startsAt ? (
                <div className="border rounded p-3 mb-3">
                  <div className="d-flex align-items-start justify-content-between gap-2 mb-3">
                    <div>
                      <div className="text-muted fs-13">Next meeting</div>
                      <div className="fw-medium">{lead.nextMeeting.title || 'Next meeting'}</div>
                    </div>
                    <Badge bg="info">Scheduled</Badge>
                  </div>
                  <div className="mb-3">
                    <div className="text-muted fs-13">Date and time</div>
                    <div className="fw-medium">{new Date(lead.nextMeeting.startsAt).toLocaleString()}</div>
                  </div>
                  <div>
                    <div className="text-muted fs-13">Meeting notes</div>
                    <div className="fw-medium">{lead.nextMeeting.notes || '-'}</div>
                  </div>
                </div>
              ) : (
                <Alert variant="info">{lead.status === 'MEETING_SCHEDULED' ? 'This lead is marked as meeting scheduled, but no meeting details were saved. Schedule the meeting again to store the date, time, and notes.' : 'No meeting scheduled'}</Alert>
              )}
              <div className="border-top pt-3 mt-3">
                <div className="text-muted fs-13 mb-2">History</div>
                {meetingHistory.map((meeting, index) => (
                  <div key={`${meeting.startsAt}-${meeting.scheduledAt}-${index}`} className="mb-3">
                    <div className="fw-medium">
                      {meeting.title || 'Next meeting'} {meeting.status === 'CANCELLED' ? '(Cancelled)' : ''}
                    </div>
                    <div className="text-muted fs-13">{meeting.startsAt ? new Date(meeting.startsAt).toLocaleString() : '-'}</div>
                    <div className="text-muted fs-13">Note: {meeting.notes || '-'}</div>
                    <div className="text-muted fs-13">
                      Scheduled by {personName(meeting.scheduledBy) || '-'}
                      {meeting.scheduledAt ? ` on ${new Date(meeting.scheduledAt).toLocaleString()}` : ''}
                    </div>
                  </div>
                ))}
                {!meetingHistory.length && <div className="text-muted">No meeting history</div>}
              </div>
            </CardBody>
          </Card>
          <Card className="mb-4">
            <CardBody>
              <h4 className="card-title mb-3">Assignment history</h4>
              {(lead.assignmentHistory || []).map((item, index) => (
                <div key={`${item.assignedAt}-${index}`} className="border-top py-3">
                  <div className="fw-medium">{personName(item.newOwner) || 'Unassigned'}</div>
                  <div className="text-muted fs-13">{item.reason || item.rule || 'Manual assignment'}</div>
                  <div className="text-muted fs-13">{item.assignedAt ? new Date(item.assignedAt).toLocaleString() : ''}</div>
                </div>
              ))}
              {!lead.assignmentHistory?.length && <div className="text-muted">No assignment history</div>}
            </CardBody>
          </Card>
        </Col>
      </Row>
      <DeleteConfirmModal
        show={deleteOpen}
        title="Delete lead?"
        itemName={lead.name}
        confirming={deleting}
        onCancel={() => setDeleteOpen(false)}
        onConfirm={deleteLead}
      />
    </>
  )
}

export default LeadDetailPage
