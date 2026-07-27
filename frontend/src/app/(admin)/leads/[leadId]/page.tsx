import PageMetaData from '@/components/PageTitle'
import IconifyIcon from '@/components/wrappers/IconifyIcon'
import { apiFetch } from '@/helpers/api'
import { useAuthStore } from '@/store/authStore'
import type { UserType } from '@/types/auth'
import type { LeadOwner, LeadType } from '@/types/lead'
import { FormEvent, useEffect, useMemo, useState } from 'react'
import { Alert, Badge, Button, Card, CardBody, Col, Form, Row } from 'react-bootstrap'
import { Link, useParams } from 'react-router-dom'

const personName = (person?: string | LeadOwner) => (typeof person === 'object' ? person.name : '')
const personRole = (person?: string | LeadOwner) => (typeof person === 'object' ? person.role : '')
const roleLabel = (role?: string) => (role ? role.replace('superadmin', 'Super Admin').replace('admin', 'Admin').replace('sales', 'Sales') : 'User')
const roleBadge = (role?: string) => (role === 'sales' ? 'info' : role === 'admin' || role === 'superadmin' ? 'primary' : 'secondary')

const LeadDetailPage = () => {
  const { leadId } = useParams()
  const user = useAuthStore((state) => state.user)
  const token = useAuthStore((state) => state.token)
  const [lead, setLead] = useState<LeadType>()
  const [users, setUsers] = useState<UserType[]>([])
  const [noteText, setNoteText] = useState('')
  const [meetingForm, setMeetingForm] = useState({ title: '', startsAt: '', notes: '' })
  const [error, setError] = useState('')
  const [message, setMessage] = useState('')
  const canAssign = user?.role === 'superadmin' || user?.role === 'admin'
  const salespeople = useMemo(() => users.filter((item) => item.role === 'sales' && item.status === 'active'), [users])

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
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Unable to update lead')
    }
  }

  const addNote = async (event: FormEvent) => {
    event.preventDefault()
    const text = noteText.trim()
    if (!text) return
    await updateLead({ noteText: text })
    setNoteText('')
  }

  const saveMeeting = async (event: FormEvent) => {
    event.preventDefault()
    await updateLead({ nextMeeting: meetingForm })
  }

  const cancelMeeting = async () => {
    await updateLead({ cancelMeeting: true, cancelMeetingNote: meetingForm.notes })
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
      <div className="mb-3">
        <Link to="/leads" className="btn btn-sm btn-outline-secondary">
          <IconifyIcon icon="bx:left-arrow-alt" className="me-1" />
          Back
        </Link>
      </div>
      {error && <Alert variant="danger">{error}</Alert>}
      {message && <Alert variant="success">{message}</Alert>}
      <Row>
        <Col xl={8}>
          <Card>
            <CardBody>
              <div className="d-flex align-items-start justify-content-between mb-3">
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
                  <div className="text-muted fs-13">Phone</div>
                  <div className="fw-medium">{lead.phone || '-'}</div>
                </Col>
                <Col md={6}>
                  <div className="text-muted fs-13">Email</div>
                  <div className="fw-medium">{lead.email || '-'}</div>
                </Col>
                <Col md={6}>
                  <div className="text-muted fs-13">Source</div>
                  <div className="fw-medium">{lead.source}</div>
                </Col>
                <Col md={6}>
                  <div className="text-muted fs-13">Product Enquire</div>
                  <div className="fw-medium">{lead.productInterest || '-'}</div>
                </Col>
                <Col md={6}>
                  <div className="text-muted fs-13">Assigned Salesperson</div>
                  <div className="fw-medium">{personName(lead.owner) || 'Unassigned'}</div>
                </Col>
                <Col md={6}>
                  <div className="text-muted fs-13">Created</div>
                  <div className="fw-medium">{lead.createdAt ? new Date(lead.createdAt).toLocaleString() : '-'}</div>
                </Col>
              </Row>
            </CardBody>
          </Card>
          <Card>
            <CardBody>
              <h4 className="card-title mb-3">Notes</h4>
              <Form onSubmit={addNote} className="mb-3">
                <Form.Control as="textarea" rows={3} value={noteText} onChange={(event) => setNoteText(event.target.value)} placeholder="Share an update with admin and sales..." />
                <Button type="submit" className="mt-2">
                  Add Note
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
                        <div>{note.text || '-'}</div>
                      </div>
                    </li>
                  )
                })}
              </ul>
              {!lead.notes?.length && <div className="text-muted">No notes yet</div>}
            </CardBody>
          </Card>
        </Col>
        <Col xl={4}>
          <Card>
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
                <div className="fw-medium">{personName(lead.owner) || user?.name || '-'}</div>
              )}
            </CardBody>
          </Card>
          <Card>
            <CardBody>
              <h4 className="card-title mb-3">Meeting Schedule</h4>
              <Form onSubmit={saveMeeting} className="mb-3">
                <Form.Group className="mb-2">
                  <Form.Label>Meeting Title</Form.Label>
                  <Form.Control value={meetingForm.title} onChange={(event) => setMeetingForm({ ...meetingForm, title: event.target.value })} />
                </Form.Group>
                <Form.Group className="mb-2">
                  <Form.Label>Date & Time</Form.Label>
                  <Form.Control type="datetime-local" required value={meetingForm.startsAt} onChange={(event) => setMeetingForm({ ...meetingForm, startsAt: event.target.value })} />
                </Form.Group>
                <Form.Group className="mb-2">
                  <Form.Label>Note</Form.Label>
                  <Form.Control as="textarea" rows={2} value={meetingForm.notes} onChange={(event) => setMeetingForm({ ...meetingForm, notes: event.target.value })} />
                </Form.Group>
                <div className="d-flex gap-2">
                  <Button type="submit" size="sm">
                    {lead.nextMeeting?.startsAt ? 'Update Meeting' : 'Schedule Meeting'}
                  </Button>
                  {lead.nextMeeting?.startsAt && (
                    <Button type="button" size="sm" variant="outline-danger" onClick={cancelMeeting}>
                      Cancel Meeting
                    </Button>
                  )}
                </div>
              </Form>
              {lead.nextMeeting?.startsAt ? (
                <>
                  <div className="mb-3">
                    <div className="text-muted fs-13">Title</div>
                    <div className="fw-medium">{lead.nextMeeting.title || 'Next meeting'}</div>
                  </div>
                  <div className="mb-3">
                    <div className="text-muted fs-13">Date & Time</div>
                    <div className="fw-medium">{new Date(lead.nextMeeting.startsAt).toLocaleString()}</div>
                  </div>
                  <div className="mb-3">
                    <div className="text-muted fs-13">Note</div>
                    <div className="fw-medium">{lead.nextMeeting.notes || '-'}</div>
                  </div>
                </>
              ) : (
                <div className="text-muted">{lead.status === 'MEETING_SCHEDULED' ? 'Meeting status is scheduled, but date/time and note were not saved. Schedule it again to store details.' : 'No meeting scheduled'}</div>
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
          <Card>
            <CardBody>
              <h4 className="card-title mb-3">Assignment History</h4>
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
    </>
  )
}

export default LeadDetailPage
