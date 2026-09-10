import { FormEvent, useEffect, useState } from 'react'
import { Alert, Badge, Button, Card, CardBody, Col, Form, Row } from 'react-bootstrap'
import { toast } from 'react-toastify'

import PageBreadcrumb from '@/components/layout/PageBreadcrumb'
import PageMetaData from '@/components/PageTitle'
import { apiFetch } from '@/helpers/api'
import { useAuthStore } from '@/store/authStore'
import type { UserType } from '@/types/auth'

const emptyLeadForm = {
  name: '',
  phone: '',
  email: '',
  company: '',
  siteAddress: '',
  googleMapUrl: '',
  productInterest: '',
  source: 'Sales dashboard',
  sourceType: 'manual',
  territory: '',
  owner: '',
}

const SalesCreateLeadPage = () => {
  const user = useAuthStore((state) => state.user)
  const token = useAuthStore((state) => state.token)
  const [form, setForm] = useState(emptyLeadForm)
  const [assignees, setAssignees] = useState<UserType[]>([])
  const [saving, setSaving] = useState(false)
  const [message, setMessage] = useState('')
  const [error, setError] = useState('')

  useEffect(() => {
    if (!token) return
    apiFetch<{ data: UserType[] }>('/leads/assignees', { token })
      .then((response) => setAssignees(response.data))
      .catch((reason) => setError(reason instanceof Error ? reason.message : 'Unable to load assignees'))
  }, [token])

  const createLead = async (event: FormEvent) => {
    event.preventDefault()
    if (!token) return

    setSaving(true)
    setMessage('')
    setError('')
    try {
      await apiFetch('/leads', {
        method: 'POST',
        body: JSON.stringify(form),
        token,
      })
      setForm(emptyLeadForm)
      setMessage('Lead created successfully.')
      toast.success('Lead created')
    } catch (e) {
      const message = e instanceof Error ? e.message : 'Unable to create lead'
      setError(message)
      toast.error(message)
    } finally {
      setSaving(false)
    }
  }

  return (
    <>
      <PageBreadcrumb subName="Lead Management" title="Create Lead" />
      <PageMetaData title="Create Lead" />
      <Row>
        <Col>
          <Card>
            <CardBody>
              <div className="d-flex align-items-center justify-content-between gap-3 flex-wrap mb-3">
                <div>
                  <h4 className="card-title mb-1">Create Lead</h4>
                  <div className="text-muted">Enter new lead details and assign it to an eligible Lead Management user.</div>
                </div>
                <Badge bg="warning" text="dark">
                  Assign on creation
                </Badge>
              </div>
              {message && <Alert variant="success">{message}</Alert>}
              {error && <Alert variant="danger">{error}</Alert>}
              <Form onSubmit={createLead}>
                <Row className="g-3">
                  <Form.Group as={Col} md={6} xl={3}>
                    <Form.Label>Customer name</Form.Label>
                    <Form.Control required value={form.name} onChange={(event) => setForm({ ...form, name: event.target.value })} placeholder="Full name" />
                  </Form.Group>
                  <Form.Group as={Col} md={6} xl={3}>
                    <Form.Label>Mobile number</Form.Label>
                    <Form.Control required type="tel" inputMode="tel" value={form.phone} onChange={(event) => setForm({ ...form, phone: event.target.value })} placeholder="Mobile number" />
                  </Form.Group>
                  <Form.Group as={Col} md={6} xl={3}>
                    <Form.Label>Email</Form.Label>
                    <Form.Control type="email" value={form.email} onChange={(event) => setForm({ ...form, email: event.target.value })} placeholder="Email address" />
                  </Form.Group>
                  <Form.Group as={Col} md={6} xl={3}>
                    <Form.Label>Company</Form.Label>
                    <Form.Control value={form.company} onChange={(event) => setForm({ ...form, company: event.target.value })} placeholder="Company or firm" />
                  </Form.Group>
                  <Form.Group as={Col} md={6} xl={3}>
                    <Form.Label>Product enquiry</Form.Label>
                    <Form.Control value={form.productInterest} onChange={(event) => setForm({ ...form, productInterest: event.target.value })} placeholder="Product or service" />
                  </Form.Group>
                  <Form.Group as={Col} md={6} xl={3}>
                    <Form.Label>Site address</Form.Label>
                    <Form.Control value={form.siteAddress} onChange={(event) => setForm({ ...form, siteAddress: event.target.value })} placeholder="Project/site address" />
                  </Form.Group>
                  <Form.Group as={Col} md={6} xl={3}>
                    <Form.Label>Google Map URL</Form.Label>
                    <Form.Control type="url" value={form.googleMapUrl} onChange={(event) => setForm({ ...form, googleMapUrl: event.target.value })} placeholder="https://maps.google.com/..." />
                  </Form.Group>
                  <Form.Group as={Col} md={6} xl={3}>
                    <Form.Label>Territory</Form.Label>
                    <Form.Control value={form.territory} onChange={(event) => setForm({ ...form, territory: event.target.value })} placeholder="City or area" />
                  </Form.Group>
                  <Form.Group as={Col} md={6} xl={3}>
                    <Form.Label>Assign lead</Form.Label>
                    <Form.Select value={form.owner} onChange={(event) => setForm({ ...form, owner: event.target.value })}>
                      <option value="">Assign to me (default)</option>
                      {assignees.filter((person) => person._id !== user?._id).map((person) => (
                        <option key={person._id} value={person._id}>{person.name}</option>
                      ))}
                    </Form.Select>
                  </Form.Group>
                  <Col xs={12} className="d-flex justify-content-end">
                    <Button type="submit" disabled={saving}>
                      {saving ? 'Submitting...' : 'Submit Lead'}
                    </Button>
                  </Col>
                </Row>
              </Form>
            </CardBody>
          </Card>
        </Col>
      </Row>
    </>
  )
}

export default SalesCreateLeadPage
