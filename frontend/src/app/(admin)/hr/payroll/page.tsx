import PageMetaData from '@/components/PageTitle'
import ReactTable from '@/components/Table'
import { apiFetch } from '@/helpers/api'
import type { ColumnDef } from '@tanstack/react-table'
import { useEffect, useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { Alert, Button, Card, CardBody, Form } from 'react-bootstrap'

type Entry = { employee: { _id: string; user?: { name: string; email?: string } }; payableDays: number; grossPay: number; deductions: number; netPay: number }
type Run = { _id: string; month: number; year: number; status: string; entries: Entry[] }
const PayrollPage = () => {
  const date = new Date(); const [month, setMonth] = useState(String(date.getMonth() + 1)); const [year, setYear] = useState(String(date.getFullYear())); const [preview, setPreview] = useState<Entry[]>([]); const [runs, setRuns] = useState<Run[]>([]); const [error, setError] = useState('')
  const load = () => apiFetch<{ data: Run[] }>('/hr/payroll/runs').then((response) => setRuns(response.data)).catch((value) => setError(value instanceof Error ? value.message : 'Unable to load payroll runs'))
  useEffect(() => { load() }, [])
  const showPreview = async () => { try { const response = await apiFetch<{ data: { entries: Entry[] } }>('/hr/payroll/preview', { method: 'POST', body: JSON.stringify({ month: Number(month), year: Number(year) }) }); setPreview(response.data.entries) } catch (value) { setError(value instanceof Error ? value.message : 'Unable to preview payroll') } }
  const create = async () => { try { const response = await apiFetch<{ data: Run }>('/hr/payroll/runs', { method: 'POST', body: JSON.stringify({ month: Number(month), year: Number(year) }) }); load(); window.location.assign(`/hr/payroll/${response.data._id}`) } catch (value) { setError(value instanceof Error ? value.message : 'Unable to create payroll run') } }
  const columns = useMemo<ColumnDef<Entry>[]>(() => [{ header: 'Employee', cell: ({ row }) => <><div className="fw-medium">{row.original.employee.user?.name || 'Employee'}</div><small className="text-muted">{row.original.employee.user?.email || '-'}</small></> }, { header: 'Payable days', accessorKey: 'payableDays' }, { header: 'Gross', accessorKey: 'grossPay' }, { header: 'Deductions', accessorKey: 'deductions' }, { header: 'Net', accessorKey: 'netPay' }], [])
  return <><PageMetaData title="Payroll" /><Card className="mb-3"><CardBody><div className="d-flex justify-content-between flex-wrap gap-2 mb-3"><h4 className="card-title mb-0">Monthly payroll</h4><div className="d-flex gap-2"><Link to="/hr/payroll/salaries"><Button size="sm" variant="outline-secondary">Salary structures</Button></Link><Link to="/hr/payroll/advances"><Button size="sm" variant="outline-secondary">Advances</Button></Link></div></div>{error && <Alert variant="danger">{error}</Alert>}<div className="d-flex gap-2 flex-wrap mb-3"><Form.Select value={month} onChange={(event) => setMonth(event.target.value)} style={{ width: 140 }}>{Array.from({ length: 12 }, (_, index) => <option key={index + 1} value={index + 1}>{index + 1}</option>)}</Form.Select><Form.Control value={year} onChange={(event) => setYear(event.target.value)} style={{ width: 120 }} /><Button variant="outline-primary" onClick={showPreview}>Preview</Button><Button onClick={create}>Create draft</Button></div>{preview.length > 0 && <ReactTable columns={columns} data={preview} pageSize={25} tableClass="text-nowrap mb-0" theadClass="bg-light bg-opacity-50" />}</CardBody></Card><Card><CardBody><h4 className="card-title mb-3">Payroll runs</h4>{runs.map((run) => <div key={run._id} className="d-flex justify-content-between border-bottom py-2"><span>{run.year}-{String(run.month).padStart(2, '0')} · {run.status}</span><Link to={`/hr/payroll/${run._id}`}>Open</Link></div>)}</CardBody></Card></>
}
export default PayrollPage
