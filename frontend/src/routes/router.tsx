import { Navigate, Route, Routes, useLocation, type RouteProps } from 'react-router-dom'

import AuthLayout from '@/layouts/AuthLayout'
import { useAuthContext } from '@/context/useAuthContext'
import { appRoutes, authRoutes } from '@/routes/index'
import AdminLayout from '@/layouts/AdminLayout'
import type { UserType } from '@/types/auth'
import { canAccessModule, hasFullAppAccess, moduleForPath } from '@/helpers/moduleAccess'

const dashboardPath = (_user?: UserType) => '/dashboard/analytics'
const accessRoles = (user?: UserType): string[] => [user?.role, ...(user?.additionalRoles || []), ...(user?.accessTypes || []), ...(user?.workProfile === 'employee' ? ['employee'] : []), ...(user?.workProfile === 'admin' ? ['admin'] : []), ...(user?.workProfile === 'superadmin' ? ['superadmin'] : []), ...(user?.workProfile === 'client' ? ['client'] : []), ...(user?.workProfile === 'director' ? ['director'] : [])].filter(Boolean) as string[]
const publicPaths = ['/auth/sign-in', '/auth/setup-superadmin']

const hasExplicitModuleAccess = (user: UserType | undefined, module?: ReturnType<typeof moduleForPath>) => Boolean(module && user?.modulePermissions?.some((permission) => permission.module === module && permission.access !== 'none'))

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
            ) : (() => {
              const module = typeof route.path === 'string' ? moduleForPath(route.path) : undefined
              const roles = accessRoles(user)
              const hasModuleAccess = !module || canAccessModule(user, module, route.moduleAccess)
              const superadminOnly = route.roles?.length === 1 && route.roles[0] === 'superadmin'
              const roleAllowed = !route.roles || roles.some((role) => route.roles?.includes(role)) || (!route.strictRoles && !superadminOnly && hasFullAppAccess(user)) || Boolean(route.allowModuleRoleBypass && hasExplicitModuleAccess(user, module))
              return hasModuleAccess && roleAllowed
            })() ? (
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
