import { useEffect, useState } from 'react'
import { Alert, Badge, Button, Card, CardBody, Table } from 'react-bootstrap'
import { Link } from 'react-router-dom'

import PageBreadcrumb from '@/components/layout/PageBreadcrumb'
import PageMetaData from '@/components/PageTitle'
import Spinner from '@/components/Spinner'
import { apiFetch } from '@/helpers/api'
import { useAuthStore } from '@/store/authStore'

type AppNotification = {
  _id: string
  title?: string
  body?: string
  createdAt?: string
  metadata?: {
    leadId?: string
    taskId?: string
    type?: string
    fromName?: string
    fromRole?: string
  }
}

const NotificationsPage = () => {
  const token = useAuthStore((state) => state.token)
  const [notifications, setNotifications] = useState<AppNotification[]>([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  const load = async () => {
    if (!token) return
    setLoading(true)
    setError('')
    try {
      const res = await apiFetch<{ data: AppNotification[] }>('/notifications/unread', { token })
      setNotifications(res.data)
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Unable to load notifications')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    load()
  }, [token])

  const clearAll = async () => {
    if (!token || !notifications.length) return
    await apiFetch('/notifications/read', {
      method: 'POST',
      token,
      body: JSON.stringify({ ids: notifications.map((item) => item._id) }),
    })
    setNotifications([])
    window.dispatchEvent(new Event('notifications:changed'))
  }

  const markRead = async (id: string) => {
    if (!token) return
    await apiFetch('/notifications/read', {
      method: 'POST',
      token,
      body: JSON.stringify({ ids: [id] }),
    })
    setNotifications((items) => items.filter((item) => item._id !== id))
    window.dispatchEvent(new Event('notifications:changed'))
  }

  return (
    <>
      <PageBreadcrumb subName="Work" title="Notifications" />
      <PageMetaData title="Notifications" />

      <Card>
        <CardBody>
          <div className="d-flex align-items-start justify-content-between flex-wrap gap-3 mb-4">
            <div>
              <h4 className="card-title mb-1">Notifications</h4>
              <div className="text-muted">Unread lead and task updates assigned to you.</div>
            </div>
            <div className="d-flex align-items-center flex-wrap gap-2">
              <Badge bg={notifications.length ? 'danger' : 'success'}>{notifications.length} unread</Badge>
              <Button size="sm" variant="outline-secondary" onClick={load} disabled={loading}>Refresh</Button>
              <Button size="sm" onClick={clearAll} disabled={!notifications.length}>Clear All</Button>
            </div>
          </div>

          {error && <Alert variant="danger">{error}</Alert>}
          {loading ? (
            <div className="py-4 text-center">
              <Spinner className="spinner-border-sm me-2" tag="span" />
              <span className="text-muted">Loading notifications...</span>
            </div>
          ) : notifications.length ? (
            <div className="table-responsive-lg">
              <Table hover className="mb-0 align-middle" style={{ tableLayout: 'fixed' }}>
                <colgroup>
                  <col style={{ width: '18%' }} />
                  <col style={{ width: '16%' }} />
                  <col />
                  <col style={{ width: 190 }} />
                  <col style={{ width: 230 }} />
                </colgroup>
                <thead>
                  <tr>
                    <th>Notification</th>
                    <th>From</th>
                    <th>Item</th>
                    <th>Time</th>
                    <th className="text-end">Action</th>
                  </tr>
                </thead>
                <tbody>
                  {notifications.map((item) => (
                    <tr key={item._id}>
                      <td>
                        <div className="fw-semibold">{item.title || 'Notification'}</div>
                      </td>
                      <td>
                        <div>{item.metadata?.fromName || 'System'}</div>
                        <Badge bg="secondary">{item.metadata?.fromRole || 'system'}</Badge>
                      </td>
                      <td>{item.body || '-'}</td>
                      <td className="text-muted text-nowrap">{item.createdAt ? new Date(item.createdAt).toLocaleString() : '-'}</td>
                      <td className="text-end">
                        <div className="d-flex align-items-center justify-content-end flex-wrap gap-2">
                          {item.metadata?.taskId || item.metadata?.leadId ? (
                            <Link to={item.metadata.taskId ? `/tasks/${item.metadata.taskId}` : `/leads/${item.metadata.leadId}`} className="btn btn-sm btn-primary text-nowrap">
                              Open {item.metadata.taskId ? 'Task' : 'Lead'}
                            </Link>
                          ) : null}
                          <Button size="sm" variant="outline-secondary" className="text-nowrap" onClick={() => markRead(item._id)}>Mark Read</Button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </Table>
            </div>
          ) : (
            <Alert variant="info" className="mb-0">No unread notifications</Alert>
          )}
        </CardBody>
      </Card>
    </>
  )
}

export default NotificationsPage
