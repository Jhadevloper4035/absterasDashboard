import PageMetaData from '@/components/PageTitle'
import Spinner from '@/components/Spinner'
import ReactTable from '@/components/Table'
import { apiFetch } from '@/helpers/api'
import { useAuthStore } from '@/store/authStore'
import type { LeadType } from '@/types/lead'
import type { UserType } from '@/types/auth'
import type { ColumnDef } from '@tanstack/react-table'
import { FormEvent, useEffect, useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { Alert, Badge, Button, Card, CardBody, Col, Form, Modal, Row } from 'react-bootstrap'

const ownerId = (owner: LeadType['owner']) => (typeof owner === 'string' ? owner : owner?._id || '')
const ownerName = (owner: LeadType['owner']) => (typeof owner === 'object' ? owner.name : '')

type LeadsPageProps = {
  architectOnly?: boolean
  title?: string
  apiPath?: string
}

const isArchitectLead = (lead: LeadType) => [lead.name, lead.source, lead.sourceType, lead.productInterest, lead.company].some((value) => value?.toLowerCase().includes('architect'))

const LeadsPage = ({ architectOnly = false, title, apiPath = '/leads?limit=50' }: LeadsPageProps) => {
  const user = useAuthStore((state) => state.user)
  const token = useAuthStore((state) => state.token)
  const [leads, setLeads] = useState<LeadType[]>([])
  const [users, setUsers] = useState<UserType[]>([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [filters, setFilters] = useState({ name: '', phone: '', email: '' })
  const [meetingLead, setMeetingLead] = useState<LeadType>()
  const [meeting, setMeeting] = useState({ owner: '', startsAt: '', title: '', notes: '' })
  const canAssign = user?.role === 'superadmin' || user?.role === 'admin'

  const salespeople = useMemo(() => users.filter((item) => item.role === 'sales' && item.status === 'active'), [users])
  const visibleLeads = useMemo(() => {
    const name = filters.name.toLowerCase().trim()
    const phone = filters.phone.toLowerCase().trim()
    const email = filters.email.toLowerCase().trim()

    return (architectOnly ? leads.filter(isArchitectLead) : leads).filter((lead) => {
      const matchesName = !name || lead.name.toLowerCase().includes(name)
      const matchesPhone = !phone || (lead.phone || '').toLowerCase().includes(phone)
      const matchesEmail = !email || (lead.email || '').toLowerCase().includes(email)
      return matchesName && matchesPhone && matchesEmail
    })
  }, [architectOnly, filters, leads])
  const assignLead = async (leadId: string, owner: string) => {
    if (!token || !owner) return
    setError('')

    try {
      const res = await apiFetch<{ data: LeadType }>(`/leads/${leadId}`, {
        method: 'PATCH',
        body: JSON.stringify({ owner }),
        token,
      })
      setLeads((items) => items.map((item) => (item._id === leadId ? res.data : item)))
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Unable to assign lead')
    }
  }

  const openMeeting = (lead: LeadType) => {
    setMeetingLead(lead)
    setMeeting({
      owner: ownerId(lead.owner),
      startsAt: lead.nextMeeting?.startsAt ? lead.nextMeeting.startsAt.slice(0, 16) : '',
      title: lead.nextMeeting?.title || `${lead.name} meeting`,
      notes: lead.nextMeeting?.notes || '',
    })
  }

  const scheduleMeeting = async (event: FormEvent) => {
    event.preventDefault()
    if (!token || !meetingLead) return
    setError('')

    try {
      const res = await apiFetch<{ data: LeadType }>(`/leads/${meetingLead._id}`, {
        method: 'PATCH',
        body: JSON.stringify({
          ...(canAssign && meeting.owner ? { owner: meeting.owner } : {}),
          nextMeeting: { startsAt: meeting.startsAt, title: meeting.title, notes: meeting.notes },
        }),
        token,
      })
      setLeads((items) => items.map((item) => (item._id === meetingLead._id ? res.data : item)))
      setMeetingLead(undefined)
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Unable to schedule meeting')
    }
  }

  const columns = useMemo<ColumnDef<LeadType>[]>(
    () => [
      {
        header: '#',
        cell: ({ row }) => row.index + 1,
      },
      {
        header: 'Name',
        cell: ({ row: { original } }) => (
          <div>
            <div className="fw-medium">{original.name}</div>
            <div className="text-muted fs-13">{original.company || '-'}</div>
          </div>
        ),
      },
      {
        header: 'Phone',
        accessorKey: 'phone',
        cell: ({ row: { original } }) => original.phone || '-',
      },
      {
        header: 'Email',
        accessorKey: 'email',
        cell: ({ row: { original } }) => original.email || '-',
      },
      {
        header: 'Source',
        accessorKey: 'source',
      },
      {
        header: 'Source Type',
        accessorKey: 'sourceType',
        cell: ({ row: { original } }) => original.sourceType || '-',
      },
      {
        header: 'Product Enquire',
        accessorKey: 'productInterest',
        cell: ({ row: { original } }) => original.productInterest || '-',
      },
      {
        header: 'Company',
        accessorKey: 'company',
        cell: ({ row: { original } }) => original.company || '-',
      },
      {
        header: 'Status',
        cell: ({ row: { original } }) => (
          <Badge bg={original.assignmentException ? 'warning' : 'success'} text={original.assignmentException ? 'dark' : undefined}>
            {original.status}
          </Badge>
        ),
      },
      {
        header: canAssign ? 'Assign To' : 'Owner',
        cell: ({ row: { original } }) =>
          canAssign ? (
            <div style={{ minWidth: 210 }}>
              <Form.Select size="sm" value={ownerId(original.owner)} onChange={(event) => assignLead(original._id, event.target.value)}>
                <option value="">Unassigned</option>
                {salespeople.map((salesperson) => (
                  <option key={salesperson._id} value={salesperson._id}>
                    {salesperson.name}
                  </option>
                ))}
              </Form.Select>
            </div>
          ) : (
            ownerName(original.owner) || user?.name || '-'
          ),
      },
      {
        header: 'Created',
        cell: ({ row: { original } }) => (original.createdAt ? new Date(original.createdAt).toLocaleDateString() : '-'),
      },
      {
        header: 'Next Meeting',
        cell: ({ row: { original } }) => (original.nextMeeting?.startsAt ? new Date(original.nextMeeting.startsAt).toLocaleString() : '-'),
      },
      {
        header: 'Action',
        cell: ({ row: { original } }) => (
          <div className="d-flex justify-content-end gap-2" style={{ minWidth: 230 }}>
            <Button size="sm" variant="outline-success" type="button" className="text-nowrap" onClick={() => openMeeting(original)}>
              Schedule
            </Button>
            <Link to={`/leads/${original._id}`}>
              <Button size="sm" variant="outline-primary" type="button" className="text-nowrap">
                View More
              </Button>
            </Link>
          </div>
        ),
      },
    ],
    [canAssign, salespeople, token, user?.name],
  )

  useEffect(() => {
    if (!token) return

    const load = async () => {
      setLoading(true)
      setError('')
      try {
        const [leadRes, userRes] = await Promise.all([
          apiFetch<{ data: LeadType[] }>(apiPath, { token }),
          canAssign ? apiFetch<{ data: UserType[] }>('/users', { token }) : Promise.resolve({ data: [] }),
        ])
        setLeads(leadRes.data)
        setUsers(userRes.data)
      } catch (e) {
        setError(e instanceof Error ? e.message : 'Unable to load leads')
      } finally {
        setLoading(false)
      }
    }

    load()
  }, [apiPath, canAssign, token])

  return (
    <>
      <PageMetaData title={title || (architectOnly ? 'Architect Leads' : 'Leads')} />
      <Card>
        <CardBody>
          <div className="d-flex align-items-center justify-content-between mb-3">
            <h4 className="card-title mb-0">{title || (architectOnly ? 'Architect Leads' : canAssign ? 'Lead Assignment' : 'My Leads')}</h4>
            <Badge bg="light" text="dark">
              {loading ? 'Loading' : `${visibleLeads.length} leads`}
            </Badge>
          </div>
          {error && <Alert variant="danger">{error}</Alert>}
          <Row className="g-2 mb-3">
            <Col md={4}>
              <Form.Control placeholder="Filter by name" value={filters.name} onChange={(event) => setFilters({ ...filters, name: event.target.value })} />
            </Col>
            <Col md={4}>
              <Form.Control placeholder="Filter by mobile number" value={filters.phone} onChange={(event) => setFilters({ ...filters, phone: event.target.value })} />
            </Col>
            <Col md={4}>
              <Form.Control placeholder="Filter by email" value={filters.email} onChange={(event) => setFilters({ ...filters, email: event.target.value })} />
            </Col>
          </Row>
          {!visibleLeads.length && !loading ? <Alert variant="info">No leads found</Alert> : null}
          {loading && !visibleLeads.length ? (
            <div className="text-center py-5">
              <Spinner className="spinner-border-sm me-2" tag="span" />
              <span className="text-muted">Loading data...</span>
            </div>
          ) : (
            <ReactTable<LeadType> columns={columns} data={visibleLeads} rowsPerPageList={[10, 25, 50]} pageSize={10} tableClass="text-nowrap mb-0" theadClass="bg-light bg-opacity-50" showPagination />
          )}
        </CardBody>
      </Card>
      <Modal show={!!meetingLead} onHide={() => setMeetingLead(undefined)} centered>
        <Form onSubmit={scheduleMeeting}>
          <Modal.Header closeButton>
            <Modal.Title>Schedule Next Meeting</Modal.Title>
          </Modal.Header>
          <Modal.Body>
            <Form.Group className="mb-3">
              <Form.Label>Lead</Form.Label>
              <Form.Control value={meetingLead?.name || ''} disabled />
            </Form.Group>
            {canAssign && (
              <Form.Group className="mb-3">
                <Form.Label>Salesperson</Form.Label>
                <Form.Select required value={meeting.owner} onChange={(event) => setMeeting({ ...meeting, owner: event.target.value })}>
                  <option value="">Select salesperson</option>
                  {salespeople.map((salesperson) => (
                    <option key={salesperson._id} value={salesperson._id}>
                      {salesperson.name}
                    </option>
                  ))}
                </Form.Select>
              </Form.Group>
            )}
            <Form.Group className="mb-3">
              <Form.Label>Meeting Title</Form.Label>
              <Form.Control value={meeting.title} onChange={(event) => setMeeting({ ...meeting, title: event.target.value })} />
            </Form.Group>
            <Form.Group className="mb-3">
              <Form.Label>Date & Time</Form.Label>
              <Form.Control type="datetime-local" required value={meeting.startsAt} onChange={(event) => setMeeting({ ...meeting, startsAt: event.target.value })} />
            </Form.Group>
            <Form.Group>
              <Form.Label>Notes</Form.Label>
              <Form.Control as="textarea" rows={3} placeholder="Add a little meeting note" value={meeting.notes} onChange={(event) => setMeeting({ ...meeting, notes: event.target.value })} />
            </Form.Group>
          </Modal.Body>
          <Modal.Footer>
            <Button variant="light" type="button" onClick={() => setMeetingLead(undefined)}>
              Cancel
            </Button>
            <Button type="submit">Save Meeting</Button>
          </Modal.Footer>
        </Form>
      </Modal>
    </>
  )
}

export default LeadsPage
