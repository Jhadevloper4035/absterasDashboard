import FullCalendar from '@fullcalendar/react'
import bootstrapPlugin from '@fullcalendar/bootstrap'
import dayGridPlugin from '@fullcalendar/daygrid'
import interactionPlugin, { type DateClickArg } from '@fullcalendar/interaction'
import listPlugin from '@fullcalendar/list'
import timeGridPlugin from '@fullcalendar/timegrid'
import type { EventClickArg } from '@fullcalendar/core/index.js'
import { FormEvent, useEffect, useMemo, useState } from 'react'
import { Alert, Badge, Button, Card, CardBody, Col, Form, Row, Table } from 'react-bootstrap'
import { useLocation } from 'react-router-dom'

import PageBreadcrumb from '@/components/layout/PageBreadcrumb'
import PageMetaData from '@/components/PageTitle'
import Spinner from '@/components/Spinner'
import IconifyIcon from '@/components/wrappers/IconifyIcon'
import { apiFetch } from '@/helpers/api'
import { useAuthStore } from '@/store/authStore'
import type { UserType } from '@/types/auth'

type TodoStatus = 'Pending' | 'In-Progress' | 'Completed'
type TodoPriority = 'Low' | 'Medium' | 'High'

type TodoUser = Pick<UserType, '_id' | 'name' | 'email' | 'role' | 'status'>

type SalesTodo = {
  _id: string
  title: string
  dueDate?: string
  status: TodoStatus
  priority: TodoPriority
  assignedTo?: string | TodoUser
  createdBy?: string | TodoUser
  completedAt?: string
  createdAt?: string
}

const emptyForm = { title: '', dueDate: '', status: 'Pending' as TodoStatus, priority: 'Medium' as TodoPriority, assignedTo: '' }
const statusVariant = (status: TodoStatus) => (status === 'Completed' ? 'success' : status === 'In-Progress' ? 'warning' : 'primary')
const priorityColor = (priority: TodoPriority) => (priority === 'High' ? 'danger' : priority === 'Medium' ? 'warning' : 'success')
const priorityBg = (priority: TodoPriority) => (priority === 'High' ? 'danger' : priority === 'Medium' ? 'warning' : 'success')
const personName = (person?: string | TodoUser) => (typeof person === 'object' ? person.name : '')

const TODO = () => {
  const { pathname } = useLocation()
  const token = useAuthStore((state) => state.token)
  const user = useAuthStore((state) => state.user)
  const [todos, setTodos] = useState<SalesTodo[]>([])
  const [users, setUsers] = useState<UserType[]>([])
  const [form, setForm] = useState(emptyForm)
  const [editingId, setEditingId] = useState('')
  const [search, setSearch] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const canAssign = user?.role === 'superadmin' || user?.role === 'admin'
  const isPendingPage = pathname.includes('/tasks/pending')
  const isCreatePage = pathname.includes('/tasks/create')
  const pageTitle = isCreatePage ? 'Create Task' : isPendingPage ? 'Pending Tasks' : 'All Tasks'

  const load = async () => {
    if (!token) return
    setLoading(true)
    setError('')
    try {
      const [todoRes, userRes] = await Promise.all([
        apiFetch<{ data: SalesTodo[] }>('/todos', { token }),
        canAssign ? apiFetch<{ data: UserType[] }>('/users', { token }) : Promise.resolve({ data: [] }),
      ])
      setTodos(todoRes.data)
      setUsers(userRes.data)
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Unable to load tasks')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    load()
  }, [canAssign, token])

  const visibleTodos = useMemo(() => {
    const query = search.toLowerCase().trim()
    return todos.filter(
      (todo) =>
        (!isPendingPage || todo.status === 'Pending') &&
        (!query || todo.title.toLowerCase().includes(query) || todo.status.toLowerCase().includes(query) || todo.priority.toLowerCase().includes(query)),
    )
  }, [isPendingPage, search, todos])
  const completedTodos = todos.filter((todo) => todo.status === 'Completed')
  const calendarEvents = todos
    .filter((todo) => todo.dueDate && (!isPendingPage || todo.status === 'Pending'))
    .map((todo) => ({
      id: todo._id,
      title: `${todo.status === 'Completed' ? 'Done: ' : ''}${todo.title}`,
      start: todo.dueDate,
      className: `bg-${priorityBg(todo.priority)}`,
    }))

  const saveTask = async (event: FormEvent) => {
    event.preventDefault()
    if (!token || !form.title.trim()) return
    setError('')

    try {
      const payload = {
        title: form.title,
        dueDate: form.dueDate || undefined,
        status: form.status,
        priority: form.priority,
        ...(canAssign ? { assignedTo: form.assignedTo } : {}),
      }
      const res = await apiFetch<{ data: SalesTodo }>(editingId ? `/todos/${editingId}` : '/todos', {
        method: editingId ? 'PATCH' : 'POST',
        body: JSON.stringify(payload),
        token,
      })
      setTodos((items) => (editingId ? items.map((item) => (item._id === editingId ? res.data : item)) : [res.data, ...items]))
      setForm(emptyForm)
      setEditingId('')
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Unable to save task')
    }
  }

  const editTask = (todo: SalesTodo) => {
    setEditingId(todo._id)
    setForm({
      title: todo.title,
      dueDate: todo.dueDate ? todo.dueDate.slice(0, 10) : '',
      status: todo.status,
      priority: todo.priority,
      assignedTo: typeof todo.assignedTo === 'object' ? todo.assignedTo._id : todo.assignedTo || '',
    })
  }

  const deleteTask = async (id: string) => {
    if (!token) return
    await apiFetch(`/todos/${id}`, { method: 'DELETE', token })
    setTodos((items) => items.filter((todo) => todo._id !== id))
  }

  const updateStatus = async (todo: SalesTodo, status: TodoStatus) => {
    if (!token) return
    const res = await apiFetch<{ data: SalesTodo }>(`/todos/${todo._id}`, {
      method: 'PATCH',
      body: JSON.stringify({ status }),
      token,
    })
    setTodos((items) => items.map((item) => (item._id === todo._id ? res.data : item)))
  }

  const onDateClick = (arg: DateClickArg) => setForm((value) => ({ ...value, dueDate: arg.dateStr }))
  const onEventClick = (arg: EventClickArg) => {
    const todo = todos.find((item) => item._id === arg.event.id)
    if (todo) editTask(todo)
  }

  return (
    <>
      <PageBreadcrumb subName="Task Management" title={pageTitle} />
      <PageMetaData title={pageTitle} />
      <Row>
        <Col>
          <Card>
            <CardBody>
              <Row>
                <Col xl={3}>
                  <div className="d-grid">
                    <Button type="button" onClick={() => {
                      setEditingId('')
                      setForm(emptyForm)
                    }}>
                      <IconifyIcon icon="bx:plus" className="fs-18 me-2" />
                      Add New Task
                    </Button>
                  </div>
                  <div id="external-events">
                    <br />
                    <p className="text-muted">Click a calendar date or fill the form to create a task.</p>
                    <Form onSubmit={saveTask}>
                      <Form.Group className="mb-2">
                        <Form.Label className="fw-medium">Task Title</Form.Label>
                        <Form.Control required value={form.title} onChange={(event) => setForm({ ...form, title: event.target.value })} placeholder="Write todo title" />
                      </Form.Group>
                      {canAssign && (
                        <Form.Group className="mb-2">
                          <Form.Label>Assign To</Form.Label>
                          <Form.Select required value={form.assignedTo} onChange={(event) => setForm({ ...form, assignedTo: event.target.value })}>
                            <option value="">Select salesperson</option>
                            {users.map((salesperson) => (
                              <option key={salesperson._id} value={salesperson._id}>
                                {salesperson.name}
                              </option>
                            ))}
                          </Form.Select>
                        </Form.Group>
                      )}
                      <Form.Group className="mb-2">
                        <Form.Label>Deadline</Form.Label>
                        <Form.Control type="date" value={form.dueDate} onChange={(event) => setForm({ ...form, dueDate: event.target.value })} />
                      </Form.Group>
                      <Form.Group className="mb-2">
                        <Form.Label>Status</Form.Label>
                        <Form.Select value={form.status} onChange={(event) => setForm({ ...form, status: event.target.value as TodoStatus })}>
                          <option>Pending</option>
                          <option>In-Progress</option>
                          <option>Completed</option>
                        </Form.Select>
                      </Form.Group>
                      <Form.Group className="mb-3">
                        <Form.Label>Priority</Form.Label>
                        <Form.Select value={form.priority} onChange={(event) => setForm({ ...form, priority: event.target.value as TodoPriority })}>
                          <option>Low</option>
                          <option>Medium</option>
                          <option>High</option>
                        </Form.Select>
                      </Form.Group>
                      <div className="d-flex gap-2">
                        <Button type="submit" className="text-nowrap">
                          {editingId ? 'Update Task' : 'Create Task'}
                        </Button>
                        {editingId && (
                          <Button type="button" variant="light" onClick={() => {
                            setEditingId('')
                            setForm(emptyForm)
                          }}>
                            Cancel
                          </Button>
                        )}
                      </div>
                    </Form>
                    <div className="external-event pb-1 bg-soft-primary text-primary mt-3">
                      <IconifyIcon icon="bxs:circle" className="me-2 vertical-middle" />
                      {visibleTodos.length} Total Tasks
                    </div>
                    <div className="external-event pb-1 bg-soft-success text-success">
                      <IconifyIcon icon="bxs:circle" className="me-2 vertical-middle" />
                      {completedTodos.length} Completed Tasks
                    </div>
                  </div>
                </Col>

                <Col xl={9}>
                  <div className="mt-4 mt-lg-0">
                    <FullCalendar
                      initialView="dayGridMonth"
                      plugins={[dayGridPlugin, interactionPlugin, timeGridPlugin, listPlugin, bootstrapPlugin]}
                      themeSystem="bootstrap"
                      buttonText={{ today: 'Today', month: 'Month', week: 'Week', day: 'Day', list: 'List', prev: 'Prev', next: 'Next' }}
                      headerToolbar={{ left: 'prev,next today', center: 'title', right: 'dayGridMonth,timeGridWeek,timeGridDay,listMonth' }}
                      dayMaxEventRows={2}
                      selectable
                      events={calendarEvents}
                      dateClick={onDateClick}
                      eventClick={onEventClick}
                    />
                  </div>
                </Col>
              </Row>
            </CardBody>
          </Card>
        </Col>
      </Row>

      <Card>
        <CardBody>
          <div className="d-flex align-items-center justify-content-between gap-3 flex-wrap mb-3">
            <div>
              <h4 className="card-title mb-1">{pageTitle}</h4>
              <div className="text-muted">{canAssign ? 'Assigned team tasks' : `${user?.name || 'Salesperson'} tasks`}</div>
            </div>
            <Badge bg="light" text="dark">
              {visibleTodos.length} tasks
            </Badge>
          </div>
          {error && <Alert variant="danger">{error}</Alert>}
          <div className="search-bar">
            <span>
              <IconifyIcon icon="bx:search-alt" />
            </span>
            <input type="search" className="form-control" value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Search tasks..." />
          </div>
        </CardBody>
        <div className="table-responsive table-centered">
          <Table hover className="text-nowrap mb-0 align-middle">
            <thead className="bg-light bg-opacity-50">
              <tr>
                <th className="border-0 py-2">Task</th>
                <th className="border-0 py-2">Assigned</th>
                <th className="border-0 py-2">Created</th>
                <th className="border-0 py-2">Deadline</th>
                <th className="border-0 py-2">Status</th>
                <th className="border-0 py-2">Priority</th>
                <th className="border-0 py-2 text-end">Action</th>
              </tr>
            </thead>
            <tbody>
              {loading && (
                <tr>
                  <td colSpan={7} className="text-center py-5">
                    <Spinner className="spinner-border-sm me-2" tag="span" />
                    <span className="text-muted">Loading tasks...</span>
                  </td>
                </tr>
              )}
              {!loading &&
                visibleTodos.map((todo) => (
                  <tr key={todo._id}>
                    <td>
                      <Form.Check
                        type="checkbox"
                        checked={todo.status === 'Completed'}
                        label={todo.title}
                        onChange={(event) => updateStatus(todo, event.target.checked ? 'Completed' : 'Pending')}
                      />
                    </td>
                    <td>{personName(todo.assignedTo) || user?.name || '-'}</td>
                    <td>{todo.createdAt ? new Date(todo.createdAt).toLocaleString() : '-'}</td>
                    <td>{todo.dueDate ? new Date(todo.dueDate).toLocaleDateString() : '-'}</td>
                    <td>
                      <Badge bg={statusVariant(todo.status)}>{todo.status}</Badge>
                      {todo.completedAt && <span className="text-muted fs-13 ms-2">{new Date(todo.completedAt).toLocaleDateString()}</span>}
                    </td>
                    <td className={`text-${priorityColor(todo.priority)}`}>
                      <IconifyIcon icon="bxs:circle" className="me-1" />
                      {todo.priority}
                    </td>
                    <td className="text-end">
                      <Button variant="soft-secondary" size="sm" className="me-2" onClick={() => editTask(todo)}>
                        <IconifyIcon icon="bx:edit" className="fs-16" />
                      </Button>
                      <Button variant="soft-danger" size="sm" type="button" onClick={() => deleteTask(todo._id)}>
                        <IconifyIcon icon="bx:trash" className="fs-16" />
                      </Button>
                    </td>
                  </tr>
                ))}
            </tbody>
          </Table>
        </div>
        {!loading && !visibleTodos.length && (
          <div className="p-3">
            <Alert variant="info" className="mb-0">
              No tasks found
            </Alert>
          </div>
        )}
      </Card>
    </>
  )
}

export default TODO
