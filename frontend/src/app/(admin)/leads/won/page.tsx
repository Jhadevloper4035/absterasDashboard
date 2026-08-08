import LeadsPage from '../page'
import { useAuthStore } from '@/store/authStore'

const WonLeadsPage = () => {
  const user = useAuthStore((state) => state.user)
  const roles = [user?.role, ...(user?.additionalRoles || []), ...(user?.accessTypes || [])]
  const canViewAll = roles.includes('superadmin') || roles.includes('admin')

  return <LeadsPage title="Closed Leads" apiPath={`/leads?limit=50&closed=true${canViewAll ? '' : '&closedByMe=true'}`} />
}

export default WonLeadsPage
