import { useEffect, useState } from 'react'
import { Button, Col, Dropdown, DropdownItem, DropdownMenu, DropdownToggle, Row } from 'react-bootstrap'

import IconifyIcon from '@/components/wrappers/IconifyIcon'
import SimplebarReactClient from '@/components/wrappers/SimplebarReactClient'
import { apiFetch } from '@/helpers/api'
import { useAuthStore } from '@/store/authStore'

type AppNotification = {
  _id: string
  title?: string
  body?: string
  createdAt?: string
}

const NotificationItem = ({ title, body, createdAt }: AppNotification) => {
  return (
    <DropdownItem className="py-3 border-bottom text-wrap">
      <div className="d-flex">
        <div className="flex-shrink-0">
          <div className="avatar-sm me-2">
            <span className="avatar-title bg-soft-info text-info fs-20 rounded-circle">
              <IconifyIcon icon="bx:bell" />
            </span>
          </div>
        </div>
        <div className="flex-grow-1">
          <p className="mb-0 fw-semibold">{title || 'Notification'}</p>
          {body && <p className="mb-0 text-wrap">{body}</p>}
          {createdAt && <p className="mb-0 text-muted fs-12">{new Date(createdAt).toLocaleString()}</p>}
        </div>
      </div>
    </DropdownItem>
  )
}

const Notifications = () => {
  const token = useAuthStore((state) => state.token)
  const [notificationList, setNotificationList] = useState<AppNotification[]>([])

  const load = async () => {
    if (!token) return setNotificationList([])
    const res = await apiFetch<{ data: AppNotification[] }>('/notifications/unread', { token })
    setNotificationList(res.data)
  }

  useEffect(() => {
    load().catch(() => setNotificationList([]))
    const onChange = () => load().catch(() => setNotificationList([]))
    window.addEventListener('notifications:changed', onChange)
    const timer = window.setInterval(() => load().catch(() => setNotificationList([])), 15000)
    return () => {
      window.removeEventListener('notifications:changed', onChange)
      window.clearInterval(timer)
    }
  }, [token])

  const clearAll = async () => {
    if (!token || !notificationList.length) return
    await apiFetch('/notifications/read', {
      method: 'POST',
      token,
      body: JSON.stringify({ ids: notificationList.map((item) => item._id) }),
    })
    setNotificationList([])
    window.dispatchEvent(new Event('notifications:changed'))
  }

  return (
    <Dropdown className="topbar-item" align={'end'}>
      <DropdownToggle as="button" onClick={() => load().catch(() => setNotificationList([]))} className="content-none topbar-button position-relative" aria-haspopup="true">
        <IconifyIcon icon="iconamoon:notification-duotone" className="fs-24 align-middle" />
        {notificationList.length > 0 && (
          <span className="position-absolute topbar-badge fs-10 translate-middle badge bg-danger rounded-pill">
            {notificationList.length}
            <span className="visually-hidden">unread messages</span>
          </span>
        )}
      </DropdownToggle>
      <DropdownMenu className="py-0 dropdown-lg">
        <div className="p-3 border-top-0 border-start-0 border-end-0 border-dashed border">
          <Row className="align-items-center">
            <Col>
              <h6 className="m-0 fs-16 fw-semibold"> Notifications</h6>
            </Col>
            <Col xs="auto">
              <button type="button" className="btn btn-link p-0 text-dark text-decoration-underline" onClick={clearAll}>
                <small>Clear All</small>
              </button>
            </Col>
          </Row>
        </div>
        <SimplebarReactClient style={{ maxHeight: 280 }}>
          {notificationList.length ? notificationList.map((notification) => (
            <NotificationItem key={notification._id} {...notification} />
          )) : <div className="py-4 text-center text-muted">No unread notifications</div>}
        </SimplebarReactClient>
        <div className="text-center py-3">
          <Button size="sm" variant="primary" className="icons-center" onClick={() => load().catch(() => setNotificationList([]))}>
            Refresh
            <IconifyIcon icon="bx:refresh" className="ms-2" />
          </Button>
        </div>
      </DropdownMenu>
    </Dropdown>
  )
}

export default Notifications
