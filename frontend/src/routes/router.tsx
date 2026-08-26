import { Navigate, Route, Routes, useLocation, type RouteProps } from 'react-router-dom'

import AuthLayout from '@/layouts/AuthLayout'
import { useAuthContext } from '@/context/useAuthContext'
import { appRoutes, authRoutes } from '@/routes/index'
import AdminLayout from '@/layouts/AdminLayout'
import type { UserType } from '@/types/auth'
import { canAccessModule, moduleForPath } from '@/helpers/moduleAccess'

const dashboardPath = (user?: UserType) => user?.workProfile === 'employee' ? '/hr/my-overview' : '/dashboard/analytics'
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
          element={isAuthenticated ? <Navigate to={dashboardPath(user)} replace /> : <AuthLayout {...props}>{route.element}</AuthLayout>}
        />
      ))}

      {(appRoutes || []).map((route, idx) => (
        <Route
          key={idx + route.name}
          path={route.path}
          element={
            loading ? null : !isAuthenticated ? (
              <Navigate to={{ pathname: '/auth/sign-in', search: `?redirectTo=${redirectTo}` }} replace />
            ) : (() => { const module = typeof route.path === 'string' ? moduleForPath(route.path) : undefined; return (module ? canAccessModule(user, module) : String(route.path).startsWith('/dashboard') || !route.roles || accessRoles(user).some((role) => route.roles?.includes(role))) })() ? (
              <AdminLayout {...props}>{route.element}</AdminLayout>
            ) : (
              <Navigate to="/access-denied" replace />
            )
          }
        />
      ))}
    </Routes>
  )
}

export default AppRouter
