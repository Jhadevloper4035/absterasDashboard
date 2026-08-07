import PageMetaData from '@/components/PageTitle'
import ReactTable from '@/components/Table'
import { apiFetch } from '@/helpers/api'
import type { EmployeeType } from '@/types/hr'
import type { ColumnDef } from '@tanstack/react-table'
import { FormEvent, useEffect, useMemo, useState } from 'react'
import { Alert, Badge, Button, Card, CardBody, Col, Form, Row } from 'react-bootstrap'
import { toast } from 'react-toastify'

type Mark = { employee: string; status: 'present' | 'absent' | 'half-day' | 'late'; checkIn: string; checkOut: string; regularizationReason: string }
type Record = { _id: string; date: string; status: string; checkIn?: string; checkOut?: string; workMinutes?: number; isShortLeave?: boolean; overtimeMinutes: number; employee: EmployeeType; markedBy?: { name: string } }
const today = () => new Date().toISOString().slice(0, 10)
const hours = (minutes = 0) => `${Math.floor(minutes / 60)}h ${minutes % 60}m`
const workedMinutes = (record: Record) => {
  if (record.workMinutes) return record.workMinutes
  const [inHour, inMinute] = record.checkIn?.split(':').map(Number) || []
  const [outHour, outMinute] = record.checkOut?.split(':').map(Number) || []
  return Number.isInteger(inHour) && Number.isInteger(inMinute) && Number.isInteger(outHour) && Number.isInteger(outMinute) ? Math.max(0, outHour * 60 + outMinute - inHour * 60 - inMinute) : 0
}
const emptyMark: Mark = { employee: '', status: 'present', checkIn: '', checkOut: '', regularizationReason: '' }

const AttendancePage = () => {
  const [date, setDate] = useState(today())
  const [employees, setEmployees] = useState<EmployeeType[]>([])
  const [records, setRecords] = useState<Record[]>([])
  const [mark, setMark] = useState<Mark>(emptyMark)
  const [error, setError] = useState('')
  const [saving, setSaving] = useState(false)
  const load = () => Promise.all([apiFetch<{ data: EmployeeType[] }>('/hr/attendance/employees?limit=100'), apiFetch<{ data: Record[] }>(`/hr/attendance?from=${date}&to=${date}&limit=100`)])
    .then(([employeeResponse, attendanceResponse]) => { setEmployees(employeeResponse.data.filter((employee) => employee.status === 'active')); setRecords(attendanceResponse.data) })
    .catch((reason) => setError(reason instanceof Error ? reason.message : 'Unable to load attendance'))
  useEffect(() => { load() }, [date])

  const save = async (event: FormEvent) => {
    event.preventDefault()
    if (!mark.employee) return setError('Select an employee')
    setSaving(true); setError('')
    try {
      await apiFetch('/hr/attendance', { method: 'POST', body: JSON.stringify({ date, records: [mark] }) })
      toast.success('Attendance saved'); setMark(emptyMark); await load()
    } catch (reason) { setError(reason instanceof Error ? reason.message : 'Unable to save attendance') } finally { setSaving(false) }
  }

  const columns = useMemo<ColumnDef<Record>[]>(() => [
    { header: 'Date', cell: ({ row }) => new Date(row.original.date).toLocaleDateString() },
    { header: 'Employee', cell: ({ row }) => <><div className={row.original.status === 'half-day' || row.original.isShortLeave ? 'fw-bold text-danger' : 'fw-medium'}>{row.original.employee?.user?.name || '-'}</div><small className="text-muted">{row.original.employee?.department?.name || '-'}</small></> },
    { header: 'Status', cell: ({ row }) => <Badge bg={row.original.status === 'absent' ? 'danger' : row.original.status === 'late' ? 'warning' : 'success'}>{row.original.status === 'late' ? 'Late' : row.original.status}</Badge> },
    { header: 'Punch in', cell: ({ row }) => row.original.checkIn || '—' },
    { header: 'Punch out', cell: ({ row }) => row.original.checkOut || '—' },
    { header: 'Hours in office', cell: ({ row }) => row.original.checkIn && row.original.checkOut ? hours(workedMinutes(row.original)) : '—' },
    { header: 'Attention', cell: ({ row }) => row.original.status === 'half-day' ? <Badge bg="danger">Half-day salary</Badge> : row.original.isShortLeave ? <Badge bg="warning" text="dark">Short hours</Badge> : row.original.status === 'late' ? <Badge bg="warning" text="dark">Late after 10:30</Badge> : '—' },
    { header: 'Overtime', cell: ({ row }) => row.original.overtimeMinutes ? `${row.original.overtimeMinutes} min` : '—' },
    { header: 'Marked by', cell: ({ row }) => row.original.markedBy?.name || '—' },
  ], [])

  return <><PageMetaData title="Attendance" /><Card className="mb-4"><CardBody><div className="d-flex justify-content-between align-items-start gap-3 mb-4"><div><h4 className="card-title mb-1">Mark attendance</h4><p className="text-muted mb-0">Late after 10:30 AM is flagged. Arrival after 4:00 PM is a half-day salary deduction.</p></div><Badge bg="info" className="px-3 py-2">HR manager only</Badge></div>{error && <Alert variant="danger">{error}</Alert>}<Form onSubmit={save}><Row className="g-3"><Col lg={2} md={4}><Form.Label>Date</Form.Label><Form.Control required type="date" value={date} onChange={(event) => setDate(event.target.value)} /></Col><Col lg={4} md={8}><Form.Label>Employee</Form.Label><Form.Select required value={mark.employee} onChange={(event) => setMark({ ...mark, employee: event.target.value })}><option value="">Select employee</option>{employees.map((employee) => <option key={employee._id} value={employee._id}>{employee.user.name} · {employee.department?.name}</option>)}</Form.Select></Col><Col lg={2} md={4}><Form.Label>Status</Form.Label><Form.Select value={mark.status} onChange={(event) => setMark({ ...mark, status: event.target.value as Mark['status'] })}><option value="present">Present</option><option value="absent">Absent</option><option value="half-day">Half-day</option><option value="late">Late</option></Form.Select></Col><Col lg={2} md={4}><Form.Label>Punch in</Form.Label><Form.Control type="time" value={mark.checkIn} onChange={(event) => setMark({ ...mark, checkIn: event.target.value })} /></Col><Col lg={2} md={4}><Form.Label>Punch out</Form.Label><Form.Control type="time" value={mark.checkOut} onChange={(event) => setMark({ ...mark, checkOut: event.target.value })} /></Col><Col lg={9}><Form.Label>Remark <span className="text-muted">(optional)</span></Form.Label><Form.Control value={mark.regularizationReason} onChange={(event) => setMark({ ...mark, regularizationReason: event.target.value })} placeholder="Add a note when needed" /></Col><Col lg={3} className="d-flex align-items-end"><Button type="submit" className="w-100" disabled={saving}>{saving ? 'Saving…' : 'Save attendance'}</Button></Col></Row></Form></CardBody></Card><Card><CardBody><div className="d-flex justify-content-between align-items-center mb-3"><div><h4 className="card-title mb-1">Attendance for {new Date(`${date}T00:00:00`).toLocaleDateString()}</h4><p className="text-muted mb-0">Hours, late arrivals, short hours, and half-day salary deductions are shown below.</p></div><Badge bg="light" text="dark">{records.length} records</Badge></div><ReactTable columns={columns} data={records} pageSize={25} tableClass="text-nowrap mb-0" theadClass="bg-light bg-opacity-50" /></CardBody></Card></>
}

export default AttendancePage
