import PageMetaData from '@/components/PageTitle'
import { apiFetch } from '@/helpers/api'
import { generatePayslipPdf } from '@/helpers/payslip'
import type { EmployeeType } from '@/types/hr'
import { useEffect, useState } from 'react'
import { Alert, Badge, Button, Card, CardBody, Form } from 'react-bootstrap'

type Payroll = { status: string; grossPay: number; deductions: number; netPay: number; payableDays: number; workingDays: number }
type Overview = { employee: EmployeeType; payroll?: Payroll }
const currentMonth = () => new Date().toISOString().slice(0, 7)

const MyPayslipsPage = () => {
  const [month, setMonth] = useState(currentMonth())
  const [overview, setOverview] = useState<Overview>()
  const [error, setError] = useState('')
  useEffect(() => { setError(''); apiFetch<{ data: Overview }>(`/hr/employee-overview?month=${month}`).then((response) => setOverview(response.data)).catch((reason) => setError(reason instanceof Error ? reason.message : 'Unable to load salary slip')) }, [month])
  const payroll = overview?.payroll
  const [year, selectedMonth] = month.split('-').map(Number)
  return <><PageMetaData title="My Salary Slips" /><Card><CardBody><div className="d-flex justify-content-between align-items-start flex-wrap gap-3 mb-4"><div><h4 className="card-title mb-1">My salary slips</h4><p className="text-muted mb-0">Select a processed payroll month and download your payslip.</p></div><Form.Control aria-label="Salary month" type="month" value={month} onChange={(event) => setMonth(event.target.value)} style={{ width: 180 }} /></div>{error && <Alert variant="danger">{error}</Alert>}{payroll ? <div className="d-flex justify-content-between align-items-center flex-wrap gap-3"><div><h5 className="mb-1">{month}</h5><div className="text-muted">Gross: {payroll.grossPay} · Deductions: {payroll.deductions} · Net: {payroll.netPay}</div></div><div className="d-flex align-items-center gap-2"><Badge bg={payroll.status === 'processed' ? 'success' : 'warning'}>{payroll.status}</Badge><Button disabled={payroll.status !== 'processed'} onClick={() => overview && generatePayslipPdf({ employee: overview.employee, ...payroll, month: selectedMonth, year })}>Download salary slip</Button></div></div> : <Alert variant="light" className="mb-0">No payroll is available for this month.</Alert>}</CardBody></Card></>
}

export default MyPayslipsPage
