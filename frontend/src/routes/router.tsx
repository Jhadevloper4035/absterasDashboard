import { Navigate, Route, Routes, useLocation, type RouteProps } from 'react-router-dom'

import AuthLayout from '@/layouts/AuthLayout'
import { useAuthContext } from '@/context/useAuthContext'
import { appRoutes, authRoutes } from '@/routes/index'
import AdminLayout from '@/layouts/AdminLayout'
import type { UserType } from '@/types/auth'

const dashboardPath = (roles: string[] = []) => roles.includes('hr-management') ? '/hr' : roles.includes('employee') ? '/hr/my-overview' : roles.some((role) => ['sales', 'operations', 'accounts', 'designers'].includes(role)) ? '/dashboard/sales' : '/dashboard/analytics'
const accessRoles = (user?: UserType): string[] => [user?.role, ...(user?.additionalRoles || []), ...(user?.accessTypes || [])].filter(Boolean) as string[]
const publicPaths = ['/auth/sign-in', '/auth/setup-superadmin']

const AppRouter = (props: RouteProps) => {
  const { isAuthenticated, loading, user } = useAuthContext()
  const location = useLocation()
  const redirectTo = encodeURIComponent(`${location.pathname}${location.search}`)
  const publicRoutes = authRoutes.filter((route) => route.path && publicPaths.includes(route.path))

  return (
    <Routes>
      {publicRoutes.map((route, idx) => (
        <Route
          key={idx + route.name}
          path={route.path}
          element={isAuthenticated ? <Navigate to={dashboardPath(accessRoles(user))} replace /> : <AuthLayout {...props}>{route.element}</AuthLayout>}
        />
      ))}

      {(appRoutes || []).map((route, idx) => (
        <Route
          key={idx + route.name}
          path={route.path}
          element={
            loading ? null : !isAuthenticated ? (
              <Navigate to={{ pathname: '/auth/sign-in', search: `?redirectTo=${redirectTo}` }} replace />
            ) : !route.roles || accessRoles(user).some((role) => route.roles?.includes(role)) ? (
              <AdminLayout {...props}>{route.element}</AdminLayout>
            ) : (
              <Navigate to={dashboardPath(accessRoles(user))} replace />
            )
          }
        />
      ))}
    </Routes>
  )
}

export default AppRouter
