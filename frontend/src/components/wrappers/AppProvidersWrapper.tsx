import { useEffect } from 'react'
import { ToastContainer } from 'react-toastify'
import { DEFAULT_PAGE_TITLE } from '@/context/constants'
import { AuthProvider } from '@/context/useAuthContext'
import { LayoutProvider } from '@/context/useLayoutContext'
import { NotificationProvider } from '@/context/useNotificationContext'
import type { ChildrenType } from '@/types/component-props'


const handleChangeTitle = () => {
  if (document.visibilityState === 'hidden') {
    document.title = 'Please come back 🥺'
  } else {
    document.title = DEFAULT_PAGE_TITLE
  }
}

const AppProvidersWrapper = ({ children }: ChildrenType) => {
  useEffect(() => {
    document.addEventListener('visibilitychange', handleChangeTitle)
    return () => {
      document.removeEventListener('visibilitychange', handleChangeTitle)
    }
  }, [])

  return (
    <AuthProvider>
      <LayoutProvider>
        <NotificationProvider>
          {children}
          <ToastContainer theme="colored" />
        </NotificationProvider>
      </LayoutProvider>
    </AuthProvider>
  )
}

export default AppProvidersWrapper
