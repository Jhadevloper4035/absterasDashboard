import PageMetaData from '@/components/PageTitle'
import ReactTable from '@/components/Table'
import { apiFetch } from '@/helpers/api'
import type { EmployeeType } from '@/types/hr'
import type { ColumnDef } from '@tanstack/react-table'
import { useEffect, useMemo, useState } from 'react'
import { Alert, Button, Card, CardBody, Form } from 'react-bootstrap'

type Record = { _id: string; date: string; status: string; checkIn?: string; checkOut?: string; workMinutes?: number; isShortLeave?: boolean; overtimeMinutes: number; employee: { user: { name: string }; department?: { name: string } }; markedBy?: { name: string } }
const hours = (minutes = 0) => `${Math.floor(minutes / 60)}h ${minutes % 60}m`
const workedMinutes = (record: Record) => {
  if (record.workMinutes) return record.workMinutes
  const [inHour, inMinute] = record.checkIn?.split(':').map(Number) || []
  const [outHour, outMinute] = record.checkOut?.split(':').map(Number) || []
  return Number.isInteger(inHour) && Number.isInteger(inMinute) && Number.isInteger(outHour) && Number.isInteger(outMinute) ? Math.max(0, outHour * 60 + outMinute - inHour * 60 - inMinute) : 0
}
const ReportsPage = () => {
  const [from, setFrom] = useState(new Date(new Date().getFullYear(), new Date().getMonth(), 1).toISOString().slice(0, 10))
  const [to, setTo] = useState(new Date().toISOString().slice(0, 10))
  const [employees, setEmployees] = useState<EmployeeType[]>([])
  const [employee, setEmployee] = useState('')
  const [records, setRecords] = useState<Record[]>([])
  const [error, setError] = useState('')
  const selectedEmployee = employees.find((item) => item._id === employee)
  useEffect(() => { apiFetch<{ data: EmployeeType[] }>('/hr/attendance/employees?limit=100').then((response) => { const active = response.data.filter((item) => item.status === 'active'); setEmployees(active); setEmployee((current) => current || active[0]?._id || '') }).catch((reason) => setError(reason instanceof Error ? reason.message : 'Unable to load employees')) }, [])
  useEffect(() => { if (employee) apiFetch<{ data: Record[] }>(`/hr/attendance?employee=${employee}&from=${from}&to=${to}&limit=100`).then((response) => setRecords(response.data)).catch((reason) => setError(reason instanceof Error ? reason.message : 'Unable to load report')) }, [employee, from, to])
  const columns = useMemo<ColumnDef<Record>[]>(() => [{ header: 'Date', cell: ({ row }) => new Date(row.original.date).toLocaleDateString() }, { header: 'Employee', cell: ({ row }) => <span className={row.original.status === 'half-day' || row.original.isShortLeave ? 'fw-bold text-danger' : ''}>{row.original.employee?.user.name || '-'}</span> }, { header: 'Department', cell: ({ row }) => row.original.employee?.department?.name || '-' }, { header: 'Status', accessorKey: 'status' }, { header: 'In / out', cell: ({ row }) => `${row.original.checkIn || '-'} / ${row.original.checkOut || '-'}` }, { header: 'Hours', cell: ({ row }) => row.original.checkIn && row.original.checkOut ? hours(workedMinutes(row.original)) : '—' }, { header: 'Notice', cell: ({ row }) => row.original.status === 'half-day' ? 'Half-day salary' : row.original.isShortLeave ? 'Short hours' : row.original.status === 'late' ? 'Late after 10:30' : '—' }, { header: 'Overtime', cell: ({ row }) => `${row.original.overtimeMinutes || 0} min` }, { header: 'Marked by', cell: ({ row }) => row.original.markedBy?.name || '-' }], [])
  return <><PageMetaData title={selectedEmployee ? `${selectedEmployee.user.name} attendance report` : 'Attendance report'} /><Card><CardBody><div className="d-flex justify-content-between align-items-start gap-3 mb-3 d-print-none"><div><h4 className="card-title mb-1">Attendance report</h4><p className="text-muted mb-0">View the selected employee’s attendance for the current month or a custom date range.</p></div><Button variant="outline-primary" onClick={() => window.print()}>Print report</Button></div><div className="d-none d-print-block mb-4"><h2 className="mb-1">Employee attendance report</h2><div>{selectedEmployee?.user.name || 'Employee'} · {selectedEmployee?.department?.name || 'No department'}</div><div>Period: {new Date(`${from}T00:00:00`).toLocaleDateString()} – {new Date(`${to}T00:00:00`).toLocaleDateString()}</div></div>{error && <Alert variant="danger" className="d-print-none">{error}</Alert>}<div className="d-flex gap-2 flex-wrap mb-3 d-print-none"><Form.Select value={employee} onChange={(event) => setEmployee(event.target.value)} style={{ width: 260 }}><option value="">Select employee</option>{employees.map((item) => <option key={item._id} value={item._id}>{item.user.name} · {item.department?.name || 'No department'}</option>)}</Form.Select><Form.Control aria-label="From date" type="date" value={from} onChange={(event) => setFrom(event.target.value)} style={{ width: 180 }} /><Form.Control aria-label="To date" type="date" value={to} onChange={(event) => setTo(event.target.value)} style={{ width: 180 }} /></div><div className="attendance-report-table"><ReactTable columns={columns} data={records} pageSize={25} tableClass="text-nowrap mb-0" theadClass="bg-light bg-opacity-50" /></div></CardBody></Card></>
}
export default ReportsPage
