import { apiFetch } from '@/helpers/api'
import { useEffect, useState } from 'react'
import { Alert, Badge, Card, CardBody, Spinner } from 'react-bootstrap'
import { Link } from 'react-router-dom'

type Holiday = { _id: string; date: string; name: string; type: 'government' | 'festival' | 'private' }

const holidayColor = (type: Holiday['type']) => type === 'government' ? 'primary' : type === 'festival' ? 'warning' : 'secondary'
const holidayLabel = (type: Holiday['type']) => type === 'government' ? 'Government' : type === 'festival' ? 'Festival' : 'Private'

const UpcomingHolidays = ({ limit }: { limit?: number }) => {
  const [holidays, setHolidays] = useState<Holiday[]>([])
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    apiFetch<{ data: Holiday[] }>('/hr/holidays')
      .then((response) => setHolidays(response.data.filter((holiday) => holiday.date.slice(0, 10) >= new Date().toISOString().slice(0, 10))))
      .catch((value) => setError(value instanceof Error ? value.message : 'Unable to load upcoming holidays'))
      .finally(() => setLoading(false))
  }, [])

  const visibleHolidays = limit ? holidays.slice(0, limit) : holidays
  return <Card><CardBody>
    <div className="d-flex justify-content-between align-items-start gap-3 mb-3"><div><h5 className="mb-1">Upcoming holidays</h5><p className="text-muted mb-0">Company holidays scheduled by HR.</p></div>{limit && <Link to="/hr/upcoming-holidays" className="btn btn-sm btn-outline-primary text-nowrap">View all</Link>}</div>
    {error && <Alert variant="danger" className="mb-0">{error}</Alert>}
    {loading && <div className="text-center text-muted py-3"><Spinner animation="border" size="sm" className="me-2" />Loading holidays…</div>}
    {!loading && !error && <div className="vstack gap-2">{visibleHolidays.map((holiday) => <div className="border rounded p-3 d-flex justify-content-between align-items-center gap-3" key={holiday._id}><div><div className="fw-semibold">{holiday.name}</div><small className="text-muted">{new Intl.DateTimeFormat(undefined, { weekday: 'short', day: 'numeric', month: 'short', year: 'numeric' }).format(new Date(holiday.date))}</small></div><Badge bg={holidayColor(holiday.type)} text={holiday.type === 'festival' ? 'dark' : undefined}>{holidayLabel(holiday.type)}</Badge></div>)}{!visibleHolidays.length && <div className="text-center text-muted py-3">No upcoming holidays have been added yet.</div>}</div>}
  </CardBody></Card>
}

export default UpcomingHolidays
