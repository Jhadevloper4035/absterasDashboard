import PageMetaData from '@/components/PageTitle'
import PdfActionButton from '@/components/PdfActionButton'
import { apiFetch } from '@/helpers/api'
import { buildApiUrl } from '@/helpers/apiUrl'
import { downloadPayslipPdf } from '@/helpers/payslip'
import { useAuthStore } from '@/store/authStore'
import { useEffect, useState } from 'react'
import { Alert, Button, Card, CardBody, Table } from 'react-bootstrap'
import { Link, useParams } from 'react-router-dom'
import Swal from 'sweetalert2'

type Entry = {
  employee?: { _id: string; user?: { name: string } }
  payableDays: number
  workingDays: number
  grossPay: number
  deductions: number
  netPay: number
}
type Run = { _id: string; month: number; year: number; status: string; entries: Entry[] }
const PayrollDetailPage = () => {
  const { runId = '' } = useParams()
  const token = useAuthStore((state) => state.token)
  const [run, setRun] = useState<Run>()
  const [error, setError] = useState('')
  const load = () =>
    apiFetch<{ data: Run }>(`/hr/payroll/runs/${runId}`)
      .then((response) => {
        setRun(response.data)
        setError('')
      })
      .catch((reason) => setError(reason instanceof Error ? reason.message : 'Unable to load payroll run'))
  useEffect(() => {
    load()
  }, [runId])
  const process = async () => {
    if (
      !(
        await Swal.fire({
          icon: 'warning',
          title: 'Process payroll?',
          text: 'This locks the payroll after recalculating the latest attendance, leave, advances, and reimbursements. Employees will receive their salary-slip email.',
          showCancelButton: true,
          confirmButtonText: 'Process payroll',
        })
      ).isConfirmed
    )
      return
    await apiFetch(`/hr/payroll/runs/${runId}/process`, { method: 'POST' })
    load()
  }
  const download = async () => {
    const response = await fetch(buildApiUrl(`/hr/payroll/runs/${runId}/bank-file`), { headers: token ? { Authorization: `Bearer ${token}` } : {} })
    const blob = await response.blob()
    const url = URL.createObjectURL(blob)
    const link = document.createElement('a')
    link.href = url
    link.download = 'bank-file.csv'
    link.click()
    URL.revokeObjectURL(url)
  }
  if (!run)
    return (
      <>
        <PageMetaData title="Payroll run" />
        {error ? <Alert variant="danger">{error}</Alert> : <div>Loading…</div>}
      </>
    )
  const entries = Array.isArray(run.entries) ? run.entries : []
  return (
    <>
      <PageMetaData title="Payroll run" />
      <Card>
        <CardBody>
          <div className="d-flex justify-content-between flex-wrap gap-2 mb-3">
            <h4 className="card-title mb-0">
              Payroll {run.year}-{String(run.month).padStart(2, '0')} · {run.status}
            </h4>
            <div className="d-flex gap-2">
              {run.status === 'draft' && <Button onClick={process}>Process payroll</Button>}
              <Button variant="outline-primary" onClick={download}>
                Export bank CSV
              </Button>
            </div>
          </div>
          {error && <Alert variant="danger">{error}</Alert>}
          {run.status === 'draft' && (
            <Alert variant="info" className="d-flex justify-content-between align-items-center flex-wrap gap-2">
              <span>
                Review attendance, leave, salary, advances, and reimbursements before processing. Processing recalculates the final figures and emails
                every employee’s salary-slip summary.
              </span>
              <div className="d-flex gap-2">
                <Link to="/hr/attendance">
                  <Button size="sm" variant="outline-primary">
                    Attendance
                  </Button>
                </Link>
                <Link to="/hr/employees">
                  <Button size="sm" variant="outline-primary">
                    Employees
                  </Button>
                </Link>
                <Link to="/hr/expenses/approvals">
                  <Button size="sm" variant="outline-primary">
                    Reimbursements
                  </Button>
                </Link>
              </div>
            </Alert>
          )}
          <Table hover responsive className="text-nowrap mb-0">
            <thead className="bg-light bg-opacity-50">
              <tr>
                <th>Employee</th>
                <th>Payable days</th>
                <th>Gross</th>
                <th>Deductions</th>
                <th>Net</th>
                <th />
              </tr>
            </thead>
            <tbody>
              {entries.map((entry, index) => (
                <tr key={entry.employee?._id || index}>
                  <td>{entry.employee?.user?.name || 'Deleted employee'}</td>
                  <td>{entry.payableDays}</td>
                  <td>{entry.grossPay}</td>
                  <td>{entry.deductions}</td>
                  <td>{entry.netPay}</td>
                  <td>
                    {entry.employee && (
                      <PdfActionButton
                        size="sm"
                        variant="outline-secondary"
                        action={() => downloadPayslipPdf(run.year, run.month, token, entry.employee!._id).catch((reason) => setError(reason instanceof Error ? reason.message : 'Unable to download payslip'))}>
                        Payslip
                      </PdfActionButton>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </Table>
        </CardBody>
      </Card>
    </>
  )
}
export default PayrollDetailPage
