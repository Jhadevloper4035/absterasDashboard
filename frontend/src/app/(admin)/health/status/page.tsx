import PageMetaData from '@/components/PageTitle'
import Spinner from '@/components/Spinner'
import { buildApiUrl } from '@/helpers/apiUrl'
import { useAuthStore } from '@/store/authStore'
import { useEffect, useState } from 'react'
import { Alert, Badge, Button, Card, CardBody, Col, Row, Table } from 'react-bootstrap'

type ServiceStatus = {
  status?: string
  state?: string
  name?: string | null
  configured?: boolean
  host?: string
  from?: string
  error?: string
  message?: string
  uptimeSeconds?: number
}

type HealthStatus = {
  status: 'ok' | 'degraded'
  service: string
  environment: string
  checkedAt: string
  services: Record<string, ServiceStatus>
}

const statusText = (service: ServiceStatus) => service.status || service.state || 'unknown'
const statusVariant = (service: ServiceStatus) => {
  const value = statusText(service)
  if (value === 'ok' || value === 'connected') return 'success'
  if (value === 'configured') return 'info'
  if (value === 'unavailable') return 'secondary'
  return 'danger'
}

const formatUptime = (seconds = 0) => {
  const hours = Math.floor(seconds / 3600)
  const minutes = Math.floor((seconds % 3600) / 60)
  return hours ? `${hours}h ${minutes}m` : `${minutes}m`
}

const HealthStatusPage = () => {
  const token = useAuthStore((state) => state.token)
  const [health, setHealth] = useState<HealthStatus>()
  const [loading, setLoading] = useState(false)
  const [testingEmail, setTestingEmail] = useState(false)
  const [emailMessage, setEmailMessage] = useState('')
  const [error, setError] = useState('')

  const loadHealth = async () => {
    setLoading(true)
    setError('')
    try {
      const response = await fetch(buildApiUrl('/health/status'), {
        credentials: 'include',
        headers: token ? { Authorization: `Bearer ${token}` } : undefined,
      })
      const body = await response.json().catch(() => ({}))
      if (!body?.services) throw new Error(body.error?.message || 'Unable to load health status')
      setHealth(body)
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Unable to load health status')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    loadHealth()
  }, [token])

  const sendTestEmail = async () => {
    setTestingEmail(true)
    setEmailMessage('')
    setError('')
    try {
      const response = await fetch(buildApiUrl('/health/email-test'), {
        method: 'POST',
        credentials: 'include',
        headers: token ? { Authorization: `Bearer ${token}` } : undefined,
      })
      const body = await response.json().catch(() => ({}))
      if (!response.ok) throw new Error(body.error?.message || 'Unable to send test email')
      setEmailMessage(`Test email sent to ${body.data.to}`)
      await loadHealth()
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Unable to send test email')
    } finally {
      setTestingEmail(false)
    }
  }

  return (
    <>
      <PageMetaData title="Health Status" />
      <Row>
        <Col xs={12}>
          <div className="d-flex align-items-center justify-content-between mb-3">
            <div>
              <h4 className="mb-1">Health Status</h4>
              <div className="text-muted">Production services and operational checks</div>
            </div>
            <div className="d-flex gap-2">
              <Button variant="outline-primary" onClick={sendTestEmail} disabled={testingEmail}>
                Send Test Email
              </Button>
              <Button variant="primary" onClick={loadHealth} disabled={loading}>
                Refresh
              </Button>
            </div>
          </div>
          {error && <Alert variant="danger">{error}</Alert>}
          {emailMessage && <Alert variant="success">{emailMessage}</Alert>}
        </Col>
      </Row>

      {loading && !health ? (
        <Spinner />
      ) : health ? (
        <>
          <Row>
            <Col md={4}>
              <Card>
                <CardBody>
                  <div className="text-muted">Overall</div>
                  <h3 className="mb-0">
                    <Badge bg={health.status === 'ok' ? 'success' : 'danger'}>{health.status}</Badge>
                  </h3>
                </CardBody>
              </Card>
            </Col>
            <Col md={4}>
              <Card>
                <CardBody>
                  <div className="text-muted">Environment</div>
                  <h5 className="mb-0">{health.environment}</h5>
                </CardBody>
              </Card>
            </Col>
            <Col md={4}>
              <Card>
                <CardBody>
                  <div className="text-muted">Last Checked</div>
                  <h5 className="mb-0">{new Date(health.checkedAt).toLocaleString()}</h5>
                </CardBody>
              </Card>
            </Col>
          </Row>

          <Card>
            <CardBody>
              <Table responsive hover className="mb-0 align-middle">
                <thead>
                  <tr>
                    <th>Service</th>
                    <th>Status</th>
                    <th>Details</th>
                  </tr>
                </thead>
                <tbody>
                  {Object.entries(health.services).map(([name, service]) => (
                    <tr key={name}>
                      <td className="text-capitalize fw-semibold">{name}</td>
                      <td>
                        <Badge bg={statusVariant(service)}>{statusText(service)}</Badge>
                      </td>
                      <td className="text-muted">
                        {name === 'api' && service.uptimeSeconds !== undefined ? `Uptime ${formatUptime(service.uptimeSeconds)}` : null}
                        {name === 'database' ? `Database ${service.name || '-'}` : null}
                        {name === 'email' ? [service.host, service.from, service.error].filter(Boolean).join(' | ') || 'No SMTP settings' : null}
                        {name === 'logs' ? service.message : null}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </Table>
            </CardBody>
          </Card>
        </>
      ) : null}
    </>
  )
}

export default HealthStatusPage
