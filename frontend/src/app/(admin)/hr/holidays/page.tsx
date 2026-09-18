import PageMetaData from '@/components/PageTitle'
import { apiFetch } from '@/helpers/api'
import type { EventClickArg } from '@fullcalendar/core'
import dayGridPlugin from '@fullcalendar/daygrid'
import interactionPlugin, { type DateClickArg } from '@fullcalendar/interaction'
import FullCalendar from '@fullcalendar/react'
import { FormEvent, useEffect, useMemo, useState } from 'react'
import { Alert, Button, Card, CardBody, Form, Modal } from 'react-bootstrap'

type Holiday = { _id: string; date: string; name: string; type: 'government' | 'festival' | 'private' }
type HolidayForm = { id: string; date: string; name: string; type: Holiday['type'] }
const emptyForm: HolidayForm = { id: '', date: '', name: '', type: 'festival' }

const HolidaysPage = () => {
  const [holidays, setHolidays] = useState<Holiday[]>([])
  const [form, setForm] = useState<HolidayForm>(emptyForm)
  const [showForm, setShowForm] = useState(false)
  const [error, setError] = useState('')
  const [saving, setSaving] = useState(false)
  const load = () => apiFetch<{ data: Holiday[] }>('/hr/holidays').then((response) => setHolidays(response.data)).catch((value) => setError(value instanceof Error ? value.message : 'Unable to load holidays'))

  useEffect(() => { load() }, [])

  const events = useMemo(() => holidays.map((holiday) => ({
    id: holiday._id,
    title: holiday.name,
    start: holiday.date.slice(0, 10),
    end: new Date(new Date(holiday.date).getTime() + 86400000).toISOString().slice(0, 10),
    allDay: true,
    color: holiday.type === 'government' ? '#0d6efd' : holiday.type === 'private' ? '#6f42c1' : '#fd7e14',
  })), [holidays])

  const openCreate = (arg?: DateClickArg) => {
    setForm({ ...emptyForm, date: arg?.dateStr || '' })
    setShowForm(true)
  }
  const openEdit = (arg: EventClickArg) => {
    const holiday = holidays.find((item) => item._id === arg.event.id)
    if (!holiday) return
    setForm({ id: holiday._id, date: holiday.date.slice(0, 10), name: holiday.name, type: holiday.type })
    setShowForm(true)
  }
  const save = async (event: FormEvent) => {
    event.preventDefault()
    setSaving(true)
    try {
      await apiFetch(form.id ? `/hr/holidays/${form.id}` : '/hr/holidays', { method: form.id ? 'PATCH' : 'POST', body: JSON.stringify({ date: form.date, name: form.name, type: form.type }) })
      setShowForm(false)
      setError('')
      await load()
    } catch (value) {
      setError(value instanceof Error ? value.message : 'Unable to save holiday')
    } finally {
      setSaving(false)
    }
  }
  const remove = async () => {
    if (!form.id || !window.confirm('Delete this holiday?')) return
    setSaving(true)
    try {
      await apiFetch(`/hr/holidays/${form.id}`, { method: 'DELETE' })
      setShowForm(false)
      setError('')
      await load()
    } catch (value) {
      setError(value instanceof Error ? value.message : 'Unable to delete holiday')
    } finally {
      setSaving(false)
    }
  }

  return <>
    <PageMetaData title="Holiday management" />
    <Card><CardBody>
      <div className="d-flex justify-content-between align-items-start flex-wrap gap-3 mb-3"><div><h4 className="card-title mb-1">Holiday management</h4><p className="text-muted mb-0">Add company holidays that block attendance and leave-day calculations.</p></div><Button onClick={() => openCreate()}>Add holiday</Button></div>
      {error && <Alert variant="danger">{error}</Alert>}
      <FullCalendar plugins={[dayGridPlugin, interactionPlugin]} initialView="dayGridMonth" themeSystem="bootstrap" events={events} dateClick={openCreate} eventClick={openEdit} height="auto" />
    </CardBody></Card>
    <Modal show={showForm} onHide={() => setShowForm(false)} centered><Form onSubmit={save}><Modal.Header closeButton><Modal.Title>{form.id ? 'Update holiday' : 'Add holiday'}</Modal.Title></Modal.Header><Modal.Body><Form.Group className="mb-3"><Form.Label>Date</Form.Label><Form.Control required type="date" value={form.date} onChange={(event) => setForm({ ...form, date: event.target.value })} /></Form.Group><Form.Group className="mb-3"><Form.Label>Holiday name</Form.Label><Form.Control required value={form.name} onChange={(event) => setForm({ ...form, name: event.target.value })} placeholder="Diwali" /></Form.Group><Form.Group><Form.Label>Holiday type</Form.Label><Form.Select value={form.type} onChange={(event) => setForm({ ...form, type: event.target.value as Holiday['type'] })}><option value="government">Government / national holiday</option><option value="festival">Festival holiday</option><option value="private">Private holiday</option></Form.Select></Form.Group></Modal.Body><Modal.Footer>{form.id && <Button variant="outline-danger" className="me-auto" type="button" disabled={saving} onClick={remove}>Delete</Button>}<Button variant="light" type="button" disabled={saving} onClick={() => setShowForm(false)}>Cancel</Button><Button type="submit" disabled={saving}>{saving ? 'Saving…' : 'Save holiday'}</Button></Modal.Footer></Form></Modal>
  </>
}

export default HolidaysPage
