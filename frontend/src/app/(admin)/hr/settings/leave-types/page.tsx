import PageMetaData from '@/components/PageTitle'
import { apiFetch } from '@/helpers/api'
import { FormEvent, useEffect, useState } from 'react'
import { Alert, Button, Card, CardBody, Form, Table } from 'react-bootstrap'

type LeaveType = { _id: string; name: string; accrualPerMonth: number; maxBalance: number }
const LeaveTypesPage = () => {
  const [types, setTypes] = useState<LeaveType[]>([]); const [form, setForm] = useState({ name: '', accrualPerMonth: '0', maxBalance: '0' }); const [error, setError] = useState('')
  const load = () => apiFetch<{ data: LeaveType[] }>('/hr/leave/types').then((response) => setTypes(response.data)).catch((value) => setError(value instanceof Error ? value.message : 'Unable to load leave types'))
  useEffect(() => { load() }, [])
  const create = async (event: FormEvent) => { event.preventDefault(); try { await apiFetch('/hr/leave/types', { method: 'POST', body: JSON.stringify({ ...form, accrualPerMonth: Number(form.accrualPerMonth), maxBalance: Number(form.maxBalance) }) }); setForm({ name: '', accrualPerMonth: '0', maxBalance: '0' }); load() } catch (value) { setError(value instanceof Error ? value.message : 'Unable to create leave type') } }
  return <><PageMetaData title="Leave types" /><Card><CardBody><h4 className="card-title mb-3">Leave types</h4>{error && <Alert variant="danger">{error}</Alert>}<Form onSubmit={create} className="row g-2 mb-4"><div className="col-md-4"><Form.Control required placeholder="Name (e.g. Casual)" value={form.name} onChange={(event) => setForm({ ...form, name: event.target.value })} /></div><div className="col-md-3"><Form.Control required min="0" step="0.5" type="number" placeholder="Monthly accrual" value={form.accrualPerMonth} onChange={(event) => setForm({ ...form, accrualPerMonth: event.target.value })} /></div><div className="col-md-3"><Form.Control required min="0" step="0.5" type="number" placeholder="Maximum balance" value={form.maxBalance} onChange={(event) => setForm({ ...form, maxBalance: event.target.value })} /></div><div className="col-md-2"><Button type="submit">Add type</Button></div></Form><Table responsive><thead><tr><th>Name</th><th>Monthly accrual</th><th>Max balance</th></tr></thead><tbody>{types.map((type) => <tr key={type._id}><td>{type.name}</td><td>{type.accrualPerMonth}</td><td>{type.maxBalance}</td></tr>)}</tbody></Table></CardBody></Card></>
}
export default LeaveTypesPage
