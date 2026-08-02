import { useEffect, useRef } from 'react'
import { toast } from 'react-toastify'

import { apiFetch } from '@/helpers/api'
import { useAuthStore } from '@/store/authStore'

type AppNotification = {
  _id: string
  title?: string
  body?: string
}

const NotificationToasts = () => {
  const token = useAuthStore((state) => state.token)
  const shown = useRef(new Set<string>())

  useEffect(() => {
    if (!token) return
    let stopped = false

    const load = async () => {
      try {
        const res = await apiFetch<{ data: AppNotification[] }>('/notifications/unread', { token })
        if (stopped) return

        res.data.forEach((item) => {
          if (shown.current.has(item._id)) return
          shown.current.add(item._id)
          toast.info(`${item.title || 'Update'}${item.body ? `: ${item.body}` : ''}`, { toastId: item._id })
        })
      } catch {
        // Notification polling should never interrupt the current page.
      }
    }

    load()
    const timer = window.setInterval(load, 15000)
    return () => {
      stopped = true
      window.clearInterval(timer)
    }
  }, [token])

  return null
}

export default NotificationToasts
