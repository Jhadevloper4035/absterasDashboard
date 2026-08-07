import PageMetaData from '@/components/PageTitle'
import ReactTable from '@/components/Table'
import { apiFetch } from '@/helpers/api'
import { buildApiUrl } from '@/helpers/apiUrl'
import { generatePayslipPdf } from '@/helpers/payslip'
import { useAuthStore } from '@/store/authStore'
import type { ColumnDef } from '@tanstack/react-table'
import { useEffect, useMemo, useState } from 'react'
import { Alert, Button, Card, CardBody } from 'react-bootstrap'
import { Link, useParams } from 'react-router-dom'
import Swal from 'sweetalert2'

type Entry = { employee?: { _id: string; user?: { name: string } }; payableDays: number; workingDays: number; grossPay: number; deductions: number; netPay: number }
type Run = { _id: string; month: number; year: number; status: string; entries: Entry[] }
const PayrollDetailPage = () => {
  const { runId = '' } = useParams(); const token = useAuthStore((state) => state.token); const [run, setRun] = useState<Run>(); const [error, setError] = useState('')
  const load = () => apiFetch<{ data: Run }>(`/hr/payroll/runs/${runId}`).then((response) => { setRun(response.data); setError('') }).catch((reason) => setError(reason instanceof Error ? reason.message : 'Unable to load payroll run'))
  useEffect(() => { load() }, [runId])
  const process = async () => { if (!(await Swal.fire({ icon: 'warning', title: 'Process payroll?', text: 'This locks the payroll after recalculating the latest attendance, leave, advances, and reimbursements. Employees will receive their salary-slip email.', showCancelButton: true, confirmButtonText: 'Process payroll' })).isConfirmed) return; await apiFetch(`/hr/payroll/runs/${runId}/process`, { method: 'POST' }); load() }
  const download = async () => { const response = await fetch(buildApiUrl(`/hr/payroll/runs/${runId}/bank-file`), { headers: token ? { Authorization: `Bearer ${token}` } : {} }); const blob = await response.blob(); const url = URL.createObjectURL(blob); const link = document.createElement('a'); link.href = url; link.download = 'bank-file.csv'; link.click(); URL.revokeObjectURL(url) }
  const columns = useMemo<ColumnDef<Entry>[]>(() => [{ header: 'Employee', cell: ({ row }) => row.original.employee?.user?.name || 'Employee unavailable' }, { header: 'Payable days', accessorKey: 'payableDays' }, { header: 'Gross', accessorKey: 'grossPay' }, { header: 'Deductions', accessorKey: 'deductions' }, { header: 'Net', accessorKey: 'netPay' }, { header: '', cell: ({ row }) => run && row.original.employee && <Button size="sm" variant="outline-secondary" onClick={() => generatePayslipPdf({ ...row.original, employee: row.original.employee!, month: run.month, year: run.year })}>Payslip</Button> }], [run])
  if (!run) return <><PageMetaData title="Payroll run" />{error ? <Alert variant="danger">{error}</Alert> : <div>Loading…</div>}</>
  return <><PageMetaData title="Payroll run" /><Card><CardBody><div className="d-flex justify-content-between flex-wrap gap-2 mb-3"><h4 className="card-title mb-0">Payroll {run.year}-{String(run.month).padStart(2, '0')} · {run.status}</h4><div className="d-flex gap-2">{run.status === 'draft' && <Button onClick={process}>Process payroll</Button>}<Button variant="outline-primary" onClick={download}>Export bank CSV</Button></div></div>{error && <Alert variant="danger">{error}</Alert>}{run.status === 'draft' && <Alert variant="info" className="d-flex justify-content-between align-items-center flex-wrap gap-2"><span>Review attendance, leave, salary, advances, and reimbursements before processing. Processing recalculates the final figures and emails every employee’s salary-slip summary.</span><div className="d-flex gap-2"><Link to="/hr/attendance"><Button size="sm" variant="outline-primary">Attendance</Button></Link><Link to="/hr/employees"><Button size="sm" variant="outline-primary">Employees</Button></Link><Link to="/hr/expenses/approvals"><Button size="sm" variant="outline-primary">Reimbursements</Button></Link></div></Alert>}<ReactTable columns={columns} data={Array.isArray(run.entries) ? run.entries : []} pageSize={25} tableClass="text-nowrap mb-0" theadClass="bg-light bg-opacity-50" /></CardBody></Card></>
}
export default PayrollDetailPage
