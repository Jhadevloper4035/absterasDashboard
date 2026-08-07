import PageMetaData from '@/components/PageTitle'
import { apiFetch } from '@/helpers/api'
import type { EmployeeType } from '@/types/hr'
import { useEffect, useState } from 'react'
import { Alert, Button, Card, CardBody, Form } from 'react-bootstrap'

type Settlement = { payableDays: number; grossPay: number; deductions: number; netPay: number; encashmentPay: number }
const SettlementsPage = () => {
  const [employees, setEmployees] = useState<EmployeeType[]>([]); const [employee, setEmployee] = useState(''); const [month, setMonth] = useState(String(new Date().getMonth() + 1)); const [year, setYear] = useState(String(new Date().getFullYear())); const [settlement, setSettlement] = useState<Settlement>(); const [error, setError] = useState('')
  useEffect(() => { apiFetch<{ data: EmployeeType[] }>('/hr/payroll/employees?limit=100').then((response) => setEmployees(response.data.filter((item) => item.status !== 'active'))).catch((value) => setError(value instanceof Error ? value.message : 'Unable to load employees')) }, [])
  const preview = async () => { try { const response = await apiFetch<{ data: Settlement }>(`/hr/payroll/settlements/${employee}?month=${month}&year=${year}`); setSettlement(response.data) } catch (value) { setError(value instanceof Error ? value.message : 'Unable to preview settlement') } }
  return <><PageMetaData title="Settlements" /><Card><CardBody><h4 className="card-title mb-3">Full & final settlement</h4>{error && <Alert variant="danger">{error}</Alert>}<div className="d-flex gap-2 flex-wrap"><Form.Select value={employee} onChange={(event) => setEmployee(event.target.value)} style={{ width: 240 }}><option value="">Offboarded employee</option>{employees.map((item) => <option key={item._id} value={item._id}>{item.user.name}</option>)}</Form.Select><Form.Control value={month} onChange={(event) => setMonth(event.target.value)} style={{ width: 80 }} /><Form.Control value={year} onChange={(event) => setYear(event.target.value)} style={{ width: 100 }} /><Button disabled={!employee} onClick={preview}>Preview</Button></div>{settlement && <dl className="row mt-4 mb-0"><dt className="col-sm-3">Payable days</dt><dd className="col-sm-9">{settlement.payableDays}</dd><dt className="col-sm-3">Gross pay</dt><dd className="col-sm-9">{settlement.grossPay}</dd><dt className="col-sm-3">Encashment</dt><dd className="col-sm-9">{settlement.encashmentPay}</dd><dt className="col-sm-3">Net settlement</dt><dd className="col-sm-9">{settlement.netPay}</dd></dl>}</CardBody></Card></>
}
export default SettlementsPage
