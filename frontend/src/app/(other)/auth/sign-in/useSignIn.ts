import { yupResolver } from '@hookform/resolvers/yup'
import { useForm } from 'react-hook-form'
import { useNavigate, useSearchParams } from 'react-router-dom'
import * as yup from 'yup'

import { useNotificationContext } from '@/context/useNotificationContext'
import { useAuthStore } from '@/store/authStore'

const dashboardPath = (role?: string) => (role === 'sales' ? '/dashboard/sales' : '/dashboard/analytics')

const useSignIn = () => {
  const navigate = useNavigate()
  const [searchParams] = useSearchParams()
  const loginUser = useAuthStore((state) => state.login)
  const loading = useAuthStore((state) => state.loading)

  const { showNotification } = useNotificationContext()

  const loginFormSchema = yup.object({
    email: yup.string().email('Please enter a valid email').required('Please enter your email'),
    password: yup.string().required('Please enter your password'),
  })

  const { control, handleSubmit } = useForm({
    resolver: yupResolver(loginFormSchema),
    defaultValues: {
      email: '',
      password: '',
    },
  })

  type LoginFormFields = yup.InferType<typeof loginFormSchema>

  const redirectUser = (role?: string) => {
    const redirectLink = searchParams.get('redirectTo')
    if (redirectLink) navigate(redirectLink)
    else navigate(dashboardPath(role))
  }

  const login = handleSubmit(async (values: LoginFormFields) => {
    try {
      const session = await loginUser(values.email, values.password)
      redirectUser(session.user.role)
      showNotification({ message: 'Successfully logged in.', variant: 'success' })
    } catch (e) {
      showNotification({ message: e instanceof Error ? e.message : 'Login failed', variant: 'danger' })
    }
  })

  return { loading, login, control }
}

export default useSignIn
