import PageMetaData from '@/components/PageTitle'
import PdfActionButton from '@/components/PdfActionButton'
import { apiFetch } from '@/helpers/api'
import { downloadIdCardPdf } from '@/helpers/idCard'
import { useAuthStore } from '@/store/authStore'
import type { EmployeeType } from '@/types/hr'
import { useEffect, useState } from 'react'
import { Alert, Card, CardBody } from 'react-bootstrap'

const currentMonth = () => new Date().toISOString().slice(0, 7)

const MyIdCardPage = () => {
  const token = useAuthStore((state) => state.token)
  const [employee, setEmployee] = useState<EmployeeType>()
  const [error, setError] = useState('')
  useEffect(() => { apiFetch<{ data: { employee: EmployeeType } }>(`/hr/employee-overview?month=${currentMonth()}`).then((response) => setEmployee(response.data.employee)).catch((reason) => setError(reason instanceof Error ? reason.message : 'Unable to load ID card')) }, [])
  return <><PageMetaData title="My ID Card" /><Card><CardBody><h4 className="card-title mb-1">My employee ID card</h4><p className="text-muted mb-4">Download your employee ID card as a PDF.</p>{error && <Alert variant="danger">{error}</Alert>}{employee && <div className="d-flex align-items-center justify-content-between flex-wrap gap-3"><div><h5 className="mb-1">{employee.user.name}</h5><div className="text-muted">{employee.designation?.name || 'Employee'} · {employee.department?.name || 'No department'}</div></div><PdfActionButton action={() => downloadIdCardPdf(employee._id, token).catch((reason) => setError(reason instanceof Error ? reason.message : 'Unable to download ID card'))}>Download ID card</PdfActionButton></div>}</CardBody></Card></>
}

export default MyIdCardPage
