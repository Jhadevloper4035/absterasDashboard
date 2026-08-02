import { FormEvent, useState } from 'react'
import { Alert, Badge, Button, Card, CardBody, Col, Form, Row } from 'react-bootstrap'
import { toast } from 'react-toastify'

import PageBreadcrumb from '@/components/layout/PageBreadcrumb'
import PageMetaData from '@/components/PageTitle'
import { apiFetch } from '@/helpers/api'
import { useAuthStore } from '@/store/authStore'

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
}

const SalesCreateLeadPage = () => {
  const token = useAuthStore((state) => state.token)
  const [form, setForm] = useState(emptyLeadForm)
  const [saving, setSaving] = useState(false)
  const [message, setMessage] = useState('')
  const [error, setError] = useState('')

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
      setMessage('Lead submitted to admin for assignment.')
      toast.success('Lead submitted to admin')
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
                  <div className="text-muted">Enter new lead details. Admin can assign it from All Leads.</div>
                </div>
                <Badge bg="warning" text="dark">
                  Unassigned
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
