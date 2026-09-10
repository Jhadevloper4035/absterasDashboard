import PageMetaData from '@/components/PageTitle'
import IconifyIcon from '@/components/wrappers/IconifyIcon'
import { apiFetch } from '@/helpers/api'
import { FormEvent, useEffect, useState } from 'react'
import { Alert, Badge, Button, Card, CardBody, Form, InputGroup, Table } from 'react-bootstrap'

type PasswordResetHistory = { requestedAt: string; approvedAt?: string; status: 'pending' | 'approved' }
const formatDate = (value: string) => new Intl.DateTimeFormat(undefined, { dateStyle: 'medium', timeStyle: 'short' }).format(new Date(value))

const PasswordResetPage = () => {
  const [password, setPassword] = useState('')
  const [confirmation, setConfirmation] = useState('')
  const [error, setError] = useState('')
  const [message, setMessage] = useState('')
  const [saving, setSaving] = useState(false)
  const [history, setHistory] = useState<PasswordResetHistory[]>([])
  const [showPassword, setShowPassword] = useState(false)
  const [showConfirmation, setShowConfirmation] = useState(false)

  useEffect(() => {
    apiFetch<{ data: PasswordResetHistory[] }>('/users/password-reset-requests/history')
      .then((response) => setHistory(response.data))
      .catch((reason) => setError(reason instanceof Error ? reason.message : 'Unable to load password reset history'))
  }, [])

  const submit = async (event: FormEvent) => {
    event.preventDefault()
    if (password !== confirmation) return setError('Passwords do not match')

    setSaving(true)
    setError('')
    setMessage('')
    try {
      const response = await apiFetch<{ data: { requestedAt: string } }>('/users/password-reset-requests', { method: 'POST', body: JSON.stringify({ password }) })
      setPassword('')
      setConfirmation('')
      setHistory((items) => [{ requestedAt: response.data.requestedAt, status: 'pending' }, ...items])
      setMessage('Your request was sent to an administrator for approval.')
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : 'Unable to request a password reset')
    } finally {
      setSaving(false)
    }
  }

  return (
    <>
      <PageMetaData title="Password Reset" />
      <div className="d-flex justify-content-center py-3">
        <div className="w-100" style={{ maxWidth: 620 }}>
          <Card className="border-0 shadow-sm">
            <CardBody className="p-4 p-md-5">
              <div className="text-center mb-4">
                <div className="bg-primary-subtle text-primary rounded-circle d-inline-flex align-items-center justify-content-center mb-3" style={{ width: 52, height: 52 }}>
                  <IconifyIcon icon="bx:key" className="fs-3" />
                </div>
                <h3 className="mb-1">Reset your password</h3>
                <p className="text-muted mb-0">Choose a new password. It becomes active after administrator approval.</p>
              </div>
              {error && <Alert variant="danger">{error}</Alert>}
              {message && <Alert variant="success">{message}</Alert>}
              <Form onSubmit={submit}>
                <Form.Group className="mb-3">
                  <Form.Label>New password</Form.Label>
                  <InputGroup>
                    <Form.Control required minLength={8} type={showPassword ? 'text' : 'password'} value={password} onChange={(event) => setPassword(event.target.value)} autoComplete="new-password" placeholder="Create a new password" />
                    <Button type="button" variant="outline-secondary" aria-label={showPassword ? 'Hide password' : 'Show password'} onClick={() => setShowPassword(!showPassword)}><IconifyIcon icon={showPassword ? 'bx:hide' : 'bx:show'} /></Button>
                  </InputGroup>
                  <Form.Text>At least 8 characters, including letters and numbers.</Form.Text>
                </Form.Group>
                <Form.Group className="mb-4">
                  <Form.Label>Confirm new password</Form.Label>
                  <InputGroup>
                    <Form.Control required minLength={8} type={showConfirmation ? 'text' : 'password'} value={confirmation} onChange={(event) => setConfirmation(event.target.value)} autoComplete="new-password" placeholder="Enter the password again" />
                    <Button type="button" variant="outline-secondary" aria-label={showConfirmation ? 'Hide confirmation password' : 'Show confirmation password'} onClick={() => setShowConfirmation(!showConfirmation)}><IconifyIcon icon={showConfirmation ? 'bx:hide' : 'bx:show'} /></Button>
                  </InputGroup>
                </Form.Group>
                <Button className="w-100 py-2" type="submit" disabled={saving}>{saving ? 'Sending request...' : 'Send for approval'}</Button>
              </Form>
            </CardBody>
          </Card>
          <Card className="mt-4 border-0 shadow-sm">
            <CardBody className="p-4">
              <div className="d-flex align-items-center justify-content-between gap-3 mb-3"><h5 className="mb-0">Password Reset History</h5><Badge bg="light" text="dark">{history.length}</Badge></div>
              <div className="table-responsive">
                <Table size="sm" className="align-middle mb-0">
                  <thead><tr><th>Requested</th><th>Status</th><th>Approved</th></tr></thead>
                  <tbody>
                    {history.map((item, index) => <tr key={`${item.requestedAt}-${index}`}>
                      <td>{formatDate(item.requestedAt)}</td>
                      <td><Badge bg={item.status === 'approved' ? 'success' : 'warning'} text={item.status === 'approved' ? undefined : 'dark'}>{item.status}</Badge></td>
                      <td>{item.approvedAt ? formatDate(item.approvedAt) : 'Awaiting approval'}</td>
                    </tr>)}
                    {!history.length && <tr><td colSpan={3} className="text-center text-muted py-4">No password reset requests yet.</td></tr>}
                  </tbody>
                </Table>
              </div>
            </CardBody>
          </Card>
        </div>
      </div>
    </>
  )
}

export default PasswordResetPage
