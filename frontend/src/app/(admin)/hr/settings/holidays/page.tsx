import PageMetaData from '@/components/PageTitle'
import { apiFetch } from '@/helpers/api'
import FullCalendar from '@fullcalendar/react'
import dayGridPlugin from '@fullcalendar/daygrid'
import interactionPlugin, { type DateClickArg } from '@fullcalendar/interaction'
import type { EventClickArg } from '@fullcalendar/core'
import { FormEvent, useEffect, useMemo, useState } from 'react'
import { Alert, Badge, Button, Card, CardBody, Form, Modal } from 'react-bootstrap'

type Holiday = { _id: string; date: string; name: string; type: 'government' | 'festival' | 'private' }
const sundayEvents = () => { const events = []; const date = new Date(); date.setUTCDate(date.getUTCDate() - date.getUTCDay()); for (let index = 0; index < 104; index++) { const day = new Date(date); day.setUTCDate(day.getUTCDate() + index * 7); events.push({ id: `sunday-${day.toISOString().slice(0, 10)}`, title: 'Sunday · Weekly holiday', start: day.toISOString().slice(0, 10), allDay: true, color: '#6c757d', extendedProps: { permanent: true } }) } return events }
const HolidaysPage = () => {
  const [holidays, setHolidays] = useState<Holiday[]>([])
  const [canManage, setCanManage] = useState(false)
  const [form, setForm] = useState({ id: '', date: '', name: '', type: 'festival' as Holiday['type'] })
  const [show, setShow] = useState(false)
  const [error, setError] = useState('')
  const load = () => apiFetch<{ data: Holiday[] }>('/hr/holidays').then((response) => setHolidays(response.data)).catch((reason) => setError(reason instanceof Error ? reason.message : 'Unable to load holidays'))
  useEffect(() => { load(); apiFetch<{ data: { module: string; access: string }[] }>('/hr/permissions/me').then((response) => setCanManage(response.data.some((item) => item.module === 'attendance' && item.access === 'manage'))).catch(() => {}) }, [])
  const events = useMemo(() => [...sundayEvents(), ...holidays.map((holiday) => ({ id: holiday._id, title: holiday.name, start: holiday.date.slice(0, 10), allDay: true, color: holiday.type === 'government' ? '#0d6efd' : holiday.type === 'private' ? '#6f42c1' : '#fd7e14' }))], [holidays])
  const openCreate = (arg: DateClickArg) => { if (canManage && arg.date.getUTCDay() !== 0) { setForm({ id: '', date: arg.dateStr, name: '', type: 'festival' }); setShow(true) } }
  const openEdit = (arg: EventClickArg) => { const holiday = holidays.find((item) => item._id === arg.event.id); if (canManage && holiday) { setForm({ id: holiday._id, date: holiday.date.slice(0, 10), name: holiday.name, type: holiday.type }); setShow(true) } }
  const save = async (event: FormEvent) => { event.preventDefault(); try { const path = form.id ? `/hr/holidays/${form.id}` : '/hr/holidays'; await apiFetch(path, { method: form.id ? 'PATCH' : 'POST', body: JSON.stringify({ date: form.date, name: form.name, type: form.type }) }); setShow(false); load() } catch (reason) { setError(reason instanceof Error ? reason.message : 'Unable to save holiday') } }
  const remove = async () => { if (!form.id || !window.confirm('Delete this holiday?')) return; try { await apiFetch(`/hr/holidays/${form.id}`, { method: 'DELETE' }); setShow(false); load() } catch (reason) { setError(reason instanceof Error ? reason.message : 'Unable to delete holiday') } }
  return <><PageMetaData title="Holiday calendar" /><Card><CardBody><div className="d-flex justify-content-between align-items-start gap-3 mb-3"><div><h4 className="card-title mb-1">Holiday calendar</h4><p className="text-muted mb-0">Upcoming government, festival, private, and permanent Sunday holidays.</p></div><Badge bg={canManage ? 'primary' : 'secondary'}>{canManage ? 'HR manager' : 'View only'}</Badge></div>{canManage && <Alert variant="info">Select a future date to add a holiday. Select an existing holiday to update or delete it.</Alert>}{error && <Alert variant="danger">{error}</Alert>}<FullCalendar plugins={[dayGridPlugin, interactionPlugin]} initialView="dayGridMonth" themeSystem="bootstrap" events={events} dateClick={openCreate} eventClick={openEdit} /></CardBody></Card><Modal show={show} onHide={() => setShow(false)} centered><Form onSubmit={save}><Modal.Header closeButton><Modal.Title>{form.id ? 'Update holiday' : 'Add holiday'}</Modal.Title></Modal.Header><Modal.Body><Form.Group className="mb-3"><Form.Label>Date</Form.Label><Form.Control required type="date" value={form.date} onChange={(event) => setForm({ ...form, date: event.target.value })} /></Form.Group><Form.Group className="mb-3"><Form.Label>Holiday name</Form.Label><Form.Control required value={form.name} onChange={(event) => setForm({ ...form, name: event.target.value })} placeholder="Diwali" /></Form.Group><Form.Group><Form.Label>Holiday type</Form.Label><Form.Select value={form.type} onChange={(event) => setForm({ ...form, type: event.target.value as Holiday['type'] })}><option value="government">Government holiday</option><option value="festival">Festival holiday</option><option value="private">Private holiday</option></Form.Select></Form.Group></Modal.Body><Modal.Footer>{form.id && <Button variant="outline-danger" className="me-auto" type="button" onClick={remove}>Delete</Button>}<Button variant="light" type="button" onClick={() => setShow(false)}>Cancel</Button><Button type="submit">Save holiday</Button></Modal.Footer></Form></Modal></>
}
export default HolidaysPage
