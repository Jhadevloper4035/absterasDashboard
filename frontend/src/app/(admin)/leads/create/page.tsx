import PageMetaData from '@/components/PageTitle'
import IconifyIcon from '@/components/wrappers/IconifyIcon'
import { apiFetch } from '@/helpers/api'
import { useAuthStore } from '@/store/authStore'
import { FormEvent, useState } from 'react'
import { Alert, Button, Card, CardBody, Form } from 'react-bootstrap'

const sourceTypes = ['manual', 'csv', 'api', 'webhook', 'integration'] as const

const emptyForm = {
  name: '',
  source: 'Manual entry',
  sourceType: 'manual',
  company: '',
  email: '',
  phone: '',
  productInterest: '',
}

const CreateLeadPage = () => {
  const user = useAuthStore((state) => state.user)
  const token = useAuthStore((state) => state.token)
  const [form, setForm] = useState(emptyForm)
  const [message, setMessage] = useState('')
  const [error, setError] = useState('')
  const canCreate = user?.role === 'superadmin' || user?.role === 'admin'

  const createLead = async (event: FormEvent) => {
    event.preventDefault()
    if (!token) return
    setError('')
    setMessage('')

    try {
      await apiFetch('/leads', {
        method: 'POST',
        body: JSON.stringify(form),
        token,
      })
      setForm(emptyForm)
      setMessage('Lead created')
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Unable to create lead')
    }
  }

  if (!canCreate) {
    return (
      <>
        <PageMetaData title="Create Lead" />
        <Alert variant="warning">Only admin can create leads.</Alert>
      </>
    )
  }

  return (
    <>
      <PageMetaData title="Create Lead" />
      <Card>
        <CardBody>
          <h4 className="card-title mb-3">Create Lead</h4>
          {error && <Alert variant="danger">{error}</Alert>}
          {message && <Alert variant="success">{message}</Alert>}
          <Form onSubmit={createLead}>
            <Form.Group className="mb-3">
              <Form.Label>Name</Form.Label>
              <Form.Control required value={form.name} onChange={(event) => setForm({ ...form, name: event.target.value })} />
            </Form.Group>
            <Form.Group className="mb-3">
              <Form.Label>Source</Form.Label>
              <Form.Control required value={form.source} onChange={(event) => setForm({ ...form, source: event.target.value })} />
            </Form.Group>
            <Form.Group className="mb-3">
              <Form.Label>Source Type</Form.Label>
              <Form.Select value={form.sourceType} onChange={(event) => setForm({ ...form, sourceType: event.target.value })}>
                {sourceTypes.map((sourceType) => (
                  <option key={sourceType} value={sourceType}>
                    {sourceType}
                  </option>
                ))}
              </Form.Select>
            </Form.Group>
            <Form.Group className="mb-3">
              <Form.Label>Company</Form.Label>
              <Form.Control value={form.company} onChange={(event) => setForm({ ...form, company: event.target.value })} />
            </Form.Group>
            <Form.Group className="mb-3">
              <Form.Label>Email</Form.Label>
              <Form.Control type="email" value={form.email} onChange={(event) => setForm({ ...form, email: event.target.value })} />
            </Form.Group>
            <Form.Group className="mb-3">
              <Form.Label>Phone</Form.Label>
              <Form.Control value={form.phone} onChange={(event) => setForm({ ...form, phone: event.target.value })} />
            </Form.Group>
            <Form.Group className="mb-3">
              <Form.Label>Product Interest</Form.Label>
              <Form.Control value={form.productInterest} onChange={(event) => setForm({ ...form, productInterest: event.target.value })} />
            </Form.Group>
            <Button type="submit">
              <IconifyIcon icon="bx:plus" className="me-1" />
              Create
            </Button>
          </Form>
        </CardBody>
      </Card>
    </>
  )
}

export default CreateLeadPage
