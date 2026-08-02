import FullCalendar from '@fullcalendar/react'
import bootstrapPlugin from '@fullcalendar/bootstrap'
import dayGridPlugin from '@fullcalendar/daygrid'
import interactionPlugin, { type DateClickArg } from '@fullcalendar/interaction'
import listPlugin from '@fullcalendar/list'
import timeGridPlugin from '@fullcalendar/timegrid'
import type { EventClickArg } from '@fullcalendar/core/index.js'
import { FormEvent, useEffect, useMemo, useState } from 'react'
import { Alert, Badge, Button, Card, CardBody, Col, Form, Row, Table } from 'react-bootstrap'
import { Link, useLocation } from 'react-router-dom'
import { toast } from 'react-toastify'

import DropzoneFormInput from '@/components/form/DropzoneFormInput'
import DeleteConfirmModal from '@/components/DeleteConfirmModal'
import PageBreadcrumb from '@/components/layout/PageBreadcrumb'
import PageMetaData from '@/components/PageTitle'
import Spinner from '@/components/Spinner'
import IconifyIcon from '@/components/wrappers/IconifyIcon'
import { apiFetch } from '@/helpers/api'
import { defaultTaskWorkTypes, mergeTaskWorkTypes } from '@/helpers/taskWorkTypes'
import { uploadMultipartFiles } from '@/helpers/upload'
import { useAuthStore } from '@/store/authStore'
import type { UploadFileType } from '@/types/component-props'
import type { UserType } from '@/types/auth'
import { formatFileSize } from '@/utils/other'

type TodoStatus = 'Pending' | 'In-Progress' | 'Completed'
type TaskStatus = 'Backlog' | 'To Do' | 'In Progress' | 'Review' | 'Testing' | 'Blocked' | 'Done'
type TodoPriority = 'Low' | 'Medium' | 'High' | 'Critical'

type TodoUser = Pick<UserType, '_id' | 'name' | 'email' | 'role' | 'status'>
type TaskAttachment = { key: string; url?: string; contentType?: string; originalName?: string; size?: number; checksum?: string; attachmentToken?: string }

type SalesTodo = {
  _id: string
  ticketNumber?: string
  title: string
  dueDate?: string
  status: TodoStatus | TaskStatus
  priority: TodoPriority
  assignedTo?: string | TodoUser
  assignee?: string | TodoUser
  createdBy?: string | TodoUser
  completedAt?: string
  createdAt?: string
  description?: string
  projectEpic?: string
  dependenciesBlockers?: string
  attachments?: TaskAttachment[]
  estimate?: string
}

const emptyForm = {
  title: '',
  description: '',
  dueDate: '',
  status: 'Pending' as TodoStatus | TaskStatus,
  priority: 'Medium' as TodoPriority,
  assignedTo: '',
  projectEpic: '',
  dependenciesBlockers: '',
  attachments: [] as TaskAttachment[],
  estimate: '',
}
const todoStatuses = ['Pending', 'In-Progress', 'Completed']
const taskStatuses = ['Backlog', 'To Do', 'In Progress', 'Review', 'Testing', 'Blocked', 'Done']
const statusVariant = (status: TodoStatus | TaskStatus) => (status === 'Completed' || status === 'Done' ? 'success' : status === 'Blocked' ? 'danger' : status === 'In-Progress' || status === 'In Progress' || status === 'Review' || status === 'Testing' ? 'warning' : 'primary')
const priorityColor = (priority: TodoPriority) => (priority === 'Critical' || priority === 'High' ? 'danger' : priority === 'Medium' ? 'warning' : 'success')
const priorityBg = priorityColor
const personName = (person?: string | TodoUser) => (typeof person === 'object' ? person.name : '')
const personId = (person?: string | TodoUser) => (typeof person === 'object' ? person._id : person)
const personRole = (person?: string | TodoUser) => (typeof person === 'object' ? person.role : '')
const dayKey = (value: string | Date) => new Intl.DateTimeFormat('en-CA', { year: 'numeric', month: '2-digit', day: '2-digit' }).format(new Date(value))
const isToday = (value?: string) => Boolean(value && dayKey(value) === dayKey(new Date()))
const isOverdue = (todo: SalesTodo) => Boolean(todo.dueDate && todo.status !== 'Completed' && todo.status !== 'Done' && new Date(todo.dueDate).getTime() < Date.now() && !isToday(todo.dueDate))
const attachmentName = (file: TaskAttachment) => (file.originalName || file.key).replace(/^\.?\//, '')
const attachmentExtension = (file: TaskAttachment) => attachmentName(file).split('.').pop()?.toUpperCase() || 'FILE'

const TODO = () => {
  const { pathname } = useLocation()
  const token = useAuthStore((state) => state.token)
  const user = useAuthStore((state) => state.user)
  const [todos, setTodos] = useState<SalesTodo[]>([])
  const [users, setUsers] = useState<UserType[]>([])
  const [workTypesByRole, setWorkTypesByRole] = useState(defaultTaskWorkTypes)
  const [form, setForm] = useState(emptyForm)
  const [editingId, setEditingId] = useState('')
  const [search, setSearch] = useState('')
  const [assigneeFilter, setAssigneeFilter] = useState('')
  const [groupFilter, setGroupFilter] = useState('')
  const [workTypeFilter, setWorkTypeFilter] = useState('')
  const [statusFilter, setStatusFilter] = useState('')
  const [priorityFilter, setPriorityFilter] = useState('')
  const [fromDateFilter, setFromDateFilter] = useState('')
  const [toDateFilter, setToDateFilter] = useState('')
  const [loading, setLoading] = useState(false)
  const [uploading, setUploading] = useState(false)
  const [uploadProgress, setUploadProgress] = useState(0)
  const [uploadFailed, setUploadFailed] = useState(false)
  const [deleteTarget, setDeleteTarget] = useState<SalesTodo>()
  const [deleting, setDeleting] = useState(false)
  const [error, setError] = useState('')
  const isTodoPage = pathname.includes('/apps/todo')
  const canAssign = !isTodoPage && (user?.role === 'superadmin' || user?.role === 'admin')
  const isPendingPage = pathname.includes('/tasks/pending')
  const isExceededDeadlinePage = pathname.includes('/tasks/exceeded-deadline')
  const isCreatePage = pathname.includes('/tasks/create')
  const itemName = isTodoPage ? 'Todo' : 'Task'
  const pageTitle = isTodoPage ? 'Todo' : isCreatePage ? 'Create Task' : isExceededDeadlinePage ? 'Exceeded Deadline Tasks' : isPendingPage ? 'Pending Tasks' : canAssign ? 'All Tasks' : 'My Tasks'
  const apiPath = isTodoPage ? '/todos' : '/tasks'
  const resetForm = () => {
    setForm({ ...emptyForm, status: isTodoPage ? 'Pending' : 'To Do' })
    setUploadFailed(false)
    setUploadProgress(0)
  }
  const groups = useMemo(() => [...new Set([...Object.keys(workTypesByRole), ...users.map((person) => person.role).filter(Boolean)])].sort(), [users, workTypesByRole])
  const workTypes = useMemo(() => {
    const roleWorkTypes = groupFilter ? workTypesByRole[groupFilter] || [] : Object.values(workTypesByRole).flat()
    const existingWorkTypes = todos
      .filter((todo) => !groupFilter || personRole(todo.assignee || todo.assignedTo) === groupFilter)
      .map((todo) => todo.projectEpic || '')
      .filter(Boolean)

    return [...new Set([...roleWorkTypes, ...existingWorkTypes])].sort()
  }, [groupFilter, todos, workTypesByRole])
  const selectedAssignee = users.find((person) => person._id === form.assignedTo)
  const formWorkTypes = [...new Set([...(workTypesByRole[selectedAssignee?.role || user?.role || ''] || ['General']), form.projectEpic].filter(Boolean))]

  const load = async () => {
    if (!token) return
    setLoading(true)
    setError('')
    try {
      const [todoRes, userRes, workTypeRes] = await Promise.all([
        apiFetch<{ data: SalesTodo[] }>(isExceededDeadlinePage && !isTodoPage ? `${apiPath}?deadline=exceeded` : isPendingPage && !isTodoPage ? `${apiPath}?status=To%20Do` : apiPath, { token }),
        canAssign ? apiFetch<{ data: UserType[] }>('/tasks/assignees', { token }) : Promise.resolve({ data: [] }),
        !isTodoPage ? apiFetch<{ data: Record<string, string[]> }>('/tasks/work-types', { token }) : Promise.resolve({ data: defaultTaskWorkTypes }),
      ])
      setTodos(todoRes.data)
      setUsers(userRes.data)
      setWorkTypesByRole(mergeTaskWorkTypes(workTypeRes.data, false))
    } catch (e) {
      setError(e instanceof Error ? e.message : `Unable to load ${itemName.toLowerCase()}s`)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    load()
  }, [apiPath, canAssign, isExceededDeadlinePage, isPendingPage, isTodoPage, itemName, token])

  const visibleTodos = useMemo(() => {
    const query = search.toLowerCase().trim()
    return todos.filter(
      (todo) => {
        const dueDate = todo.dueDate?.slice(0, 10) || ''

        return (
          (!isTodoPage || personId(todo.assignedTo) === user?._id) &&
          (!isPendingPage || (isTodoPage ? todo.status === 'Pending' : todo.status === 'To Do')) &&
          (!isExceededDeadlinePage || isOverdue(todo)) &&
          (!assigneeFilter || personId(todo.assignee || todo.assignedTo) === assigneeFilter) &&
          (!groupFilter || personRole(todo.assignee || todo.assignedTo) === groupFilter) &&
          (!workTypeFilter || todo.projectEpic === workTypeFilter) &&
          (!statusFilter || todo.status === statusFilter) &&
          (!priorityFilter || todo.priority === priorityFilter) &&
          (!fromDateFilter || (dueDate && dueDate >= fromDateFilter)) &&
          (!toDateFilter || (dueDate && dueDate <= toDateFilter)) &&
          (!query || todo.title.toLowerCase().includes(query) || todo.ticketNumber?.toLowerCase().includes(query))
        )
      },
    )
  }, [assigneeFilter, fromDateFilter, groupFilter, isExceededDeadlinePage, isPendingPage, isTodoPage, priorityFilter, search, statusFilter, toDateFilter, todos, user?._id, workTypeFilter])
  const completedTodos = visibleTodos.filter((todo) => todo.status === 'Completed' || todo.status === 'Done')
  const calendarEvents = visibleTodos
    .filter((todo) => todo.dueDate)
    .map((todo) => ({
      id: todo._id,
      title: `${todo.status === 'Completed' ? 'Done: ' : ''}${todo.title}`,
      start: todo.dueDate,
      className: `bg-${priorityBg(todo.priority)}`,
    }))

  const uploadFiles = async (files: UploadFileType[]) => {
    if (!token || !files.length) return
    setUploading(true)
    setUploadProgress(0)
    setUploadFailed(false)
    setError('')
    try {
      const attachments = await uploadMultipartFiles<TaskAttachment>(files, token, setUploadProgress)
      setForm((value) => ({ ...value, attachments: [...value.attachments, ...attachments] }))
    } catch (e) {
      setUploadFailed(true)
      setError(e instanceof Error ? e.message : 'Unable to upload attachments')
    } finally {
      setUploading(false)
    }
  }

  const saveTask = async (event: FormEvent) => {
    event.preventDefault()
    if (!token || !form.title.trim()) return
    if (uploading) {
      setError('Please wait until attachments finish uploading before saving the task.')
      return
    }
    if (uploadFailed) {
      setError('Attachment upload failed. Please upload the file again before saving the task.')
      return
    }
    setError('')

    try {
      const payload = isTodoPage ? {
        title: form.title,
        dueDate: form.dueDate || undefined,
        status: todoStatuses.includes(form.status) ? form.status : 'Pending',
        priority: form.priority,
        assignedTo: canAssign ? form.assignedTo : user?._id,
      } : {
        title: form.title,
        description: form.description,
        ...(canAssign ? { assignee: form.assignedTo } : {}),
        priority: form.priority,
        status: form.status,
        dueDate: form.dueDate || undefined,
        projectEpic: form.projectEpic,
        dependenciesBlockers: form.dependenciesBlockers,
        attachments: form.attachments,
        estimate: form.estimate,
      }
      const res = await apiFetch<{ data: SalesTodo }>(editingId ? `${apiPath}/${editingId}` : apiPath, {
        method: editingId ? 'PATCH' : 'POST',
        body: JSON.stringify(payload),
        token,
      })
      setTodos((items) => (editingId ? items.map((item) => (item._id === editingId ? res.data : item)) : [res.data, ...items]))
      toast.success(`${itemName} ${editingId ? 'updated' : 'created'} successfully`)
      resetForm()
      setEditingId('')
    } catch (e) {
      const message = e instanceof Error ? e.message : `Unable to save ${itemName.toLowerCase()}`
      setError(message)
      toast.error(message)
    }
  }

  const editTask = (todo: SalesTodo) => {
    setEditingId(todo._id)
    setForm({
      title: todo.title,
      description: todo.description || '',
      dueDate: todo.dueDate ? todo.dueDate.slice(0, 10) : '',
      status: todo.status,
      priority: todo.priority,
      assignedTo: personId(todo.assignee || todo.assignedTo) || '',
      projectEpic: todo.projectEpic || '',
      dependenciesBlockers: todo.dependenciesBlockers || '',
      attachments: todo.attachments || [],
      estimate: todo.estimate || '',
    })
  }

  const deleteTask = async () => {
    if (!token || !deleteTarget) return

    setDeleting(true)
    try {
      await apiFetch(`${apiPath}/${deleteTarget._id}`, { method: 'DELETE', token })
      setTodos((items) => items.filter((item) => item._id !== deleteTarget._id))
      setDeleteTarget(undefined)
      toast.success(`${itemName} deleted`)
    } catch (e) {
      toast.error(e instanceof Error ? e.message : `Unable to delete ${itemName.toLowerCase()}`)
    } finally {
      setDeleting(false)
    }
  }

  const patchTask = async (todo: SalesTodo, patch: Partial<SalesTodo>) => {
    if (!token) return
    try {
      const res = await apiFetch<{ data: SalesTodo }>(`${apiPath}/${todo._id}`, {
        method: 'PATCH',
        body: JSON.stringify(patch),
        token,
      })
      setTodos((items) => items.map((item) => (item._id === todo._id ? res.data : item)))
      return true
    } catch (e) {
      toast.error(e instanceof Error ? e.message : `Unable to update ${itemName.toLowerCase()}`)
      return false
    }
  }

  const updateStatus = async (todo: SalesTodo, status: TodoStatus | TaskStatus) => {
    const updated = await patchTask(todo, { status: isTodoPage ? status : status === 'Completed' ? 'Done' : status === 'Pending' ? 'To Do' : status })
    if (updated) {
      toast.success(`${itemName} status updated`)
    }
  }

  const reassignTask = async (todo: SalesTodo, assignee: string) => {
    const updated = await patchTask(todo, { assignee })
    if (updated) {
      toast.success(`${itemName} reassigned`)
    }
  }

  const updatePriority = async (todo: SalesTodo, priority: TodoPriority) => {
    const updated = await patchTask(todo, { priority })
    if (updated) {
      toast.success(`${itemName} priority updated`)
    }
  }

  const onDateClick = (arg: DateClickArg) => setForm((value) => ({ ...value, dueDate: arg.dateStr }))
  const onEventClick = (arg: EventClickArg) => {
    const todo = visibleTodos.find((item) => item._id === arg.event.id)
    if (todo) editTask(todo)
  }

  return (
    <>
      <PageBreadcrumb subName={isTodoPage ? 'Todo' : 'Task Management'} title={pageTitle} />
      <PageMetaData title={pageTitle} />
      <Row>
        <Col>
          {(isTodoPage || editingId) && (
            <Card>
              <CardBody>
                <Row>
                  <Col xl={isTodoPage ? 3 : 12}>
                  <div className="d-grid">
                    <Button type="button" onClick={() => {
                      setEditingId('')
                      resetForm()
                    }}>
                      <IconifyIcon icon="bx:plus" className="fs-18 me-2" />
                      Add New {itemName}
                    </Button>
                  </div>
                  <div id="external-events">
                    <br />
                    <p className="text-muted">Click a calendar date or fill the form to create a {itemName.toLowerCase()}.</p>
                    <Form onSubmit={saveTask} className={isTodoPage ? undefined : 'row g-3'}>
                      <Form.Group className={isTodoPage ? 'mb-2' : 'col-lg-6'}>
                        <Form.Label className="fw-medium">{itemName} Title</Form.Label>
                        <Form.Control required value={form.title} onChange={(event) => setForm({ ...form, title: event.target.value })} placeholder={`Write ${itemName.toLowerCase()} title`} />
                      </Form.Group>
                      {canAssign && (
                        <Form.Group className="col-lg-6">
                          <Form.Label>Assign to</Form.Label>
                          <Form.Select required value={form.assignedTo} onChange={(event) => setForm({ ...form, assignedTo: event.target.value, projectEpic: '' })}>
                            <option value="">Select assignee</option>
                            {users.map((person) => (
                              <option key={person._id} value={person._id}>
                                {person.name} ({person.role})
                              </option>
                            ))}
                          </Form.Select>
                        </Form.Group>
                      )}
                      {!isTodoPage && (
                        <>
                          <Form.Group className="col-lg-6">
                            <Form.Label>Scope of work</Form.Label>
                            <Form.Control as="textarea" rows={3} value={form.description} onChange={(event) => setForm({ ...form, description: event.target.value })} />
                          </Form.Group>
                          <Form.Group className="col-lg-6">
                            <Form.Label>Work type</Form.Label>
                            <Form.Select value={form.projectEpic} onChange={(event) => setForm({ ...form, projectEpic: event.target.value })}>
                              <option value="">Select work type</option>
                              {formWorkTypes.map((workType) => (
                                <option key={workType}>{workType}</option>
                              ))}
                            </Form.Select>
                          </Form.Group>
                        </>
                      )}
                      <Form.Group className={isTodoPage ? 'mb-2' : 'col-lg-3 col-md-6'}>
                            <Form.Label>Deadline</Form.Label>
                        <Form.Control type="date" value={form.dueDate} onChange={(event) => setForm({ ...form, dueDate: event.target.value })} />
                      </Form.Group>
                      <Form.Group className={isTodoPage ? 'mb-2' : 'col-lg-3 col-md-6'}>
                        <Form.Label>Status</Form.Label>
                        <Form.Select value={isTodoPage || taskStatuses.includes(form.status) ? form.status : 'To Do'} onChange={(event) => setForm({ ...form, status: event.target.value as TodoStatus | TaskStatus })}>
                          {(isTodoPage ? todoStatuses : taskStatuses).map((status) => (
                            <option key={status}>{status}</option>
                          ))}
                        </Form.Select>
                      </Form.Group>
                      <Form.Group className={isTodoPage ? 'mb-3' : 'col-lg-3 col-md-6'}>
                        <Form.Label>Priority</Form.Label>
                        <Form.Select value={form.priority} onChange={(event) => setForm({ ...form, priority: event.target.value as TodoPriority })}>
                          <option>Low</option>
                          <option>Medium</option>
                          <option>High</option>
                          {!isTodoPage && <option>Critical</option>}
                        </Form.Select>
                      </Form.Group>
                      {!isTodoPage && (
                        <>
                          <Form.Group className="col-lg-4">
                            <Form.Label>Time needed</Form.Label>
                            <Form.Control value={form.estimate} onChange={(event) => setForm({ ...form, estimate: event.target.value })} placeholder="5 points" />
                          </Form.Group>
                          <Form.Group className="col-lg-4">
                            <Form.Label>Dependencies or blockers</Form.Label>
                            <Form.Control as="textarea" rows={2} value={form.dependenciesBlockers} onChange={(event) => setForm({ ...form, dependenciesBlockers: event.target.value })} />
                          </Form.Group>
                          <Form.Group className="col-12">
                            <DropzoneFormInput
                              label="Attachments"
                              labelClassName="form-label"
                              iconProps={{ icon: 'bx:cloud-upload', height: 34, width: 34 }}
                              text="Drag & drop files here, or browse"
                              helpText={<span className="text-muted fs-13">PDF, Word, Excel, CSV, TXT, JPG, PNG, WebP. Up to 5 files.</span>}
                              showPreview={false}
                              onFileUpload={uploadFiles}
                            />
                            {uploading && (
                              <div className="text-muted fs-13 mt-2">
                                <div className="d-flex align-items-center gap-2 mb-1">
                                  <Spinner className="spinner-border-sm" tag="span" />
                                  <span>Uploading attachment... {uploadProgress}%</span>
                                </div>
                                <div className="progress" style={{ height: 6 }}>
                                  <div className="progress-bar" style={{ width: `${uploadProgress}%` }} />
                                </div>
                              </div>
                            )}
                            {form.attachments.length > 0 && (
                              <div className="attachment-list mt-3">
                                <div className="text-muted fs-13 mb-2">Attached files</div>
                                {form.attachments.map((file) => (
                                  <div className="attachment-row" key={file.key}>
                                    <span className="attachment-icon">
                                      <IconifyIcon icon={file.contentType?.startsWith('image/') ? 'bx:image' : 'bx:paperclip'} />
                                    </span>
                                    <span className="attachment-meta">
                                      <span className="attachment-name" title={attachmentName(file)}>{attachmentName(file)}</span>
                                      <span className="attachment-detail">{attachmentExtension(file)}{file.size ? ` · ${formatFileSize(file.size)}` : ''}</span>
                                    </span>
                                    {file.url && (
                                      <a className="attachment-download" href={file.url} target="_blank" rel="noreferrer" aria-label={`Download ${attachmentName(file)}`}>
                                        <IconifyIcon icon="bx:download" />
                                      </a>
                                    )}
                                  </div>
                                ))}
                              </div>
                            )}
                          </Form.Group>
                        </>
                      )}
                      <div className={isTodoPage ? 'd-flex gap-2' : 'col-12 d-flex gap-2'}>
                        <Button type="submit" className="text-nowrap" disabled={uploading}>
                          {uploading ? 'Uploading...' : editingId ? `Update ${itemName}` : `Create ${itemName}`}
                        </Button>
                        {editingId && (
                          <Button type="button" variant="light" onClick={() => {
                            setEditingId('')
                            resetForm()
                          }}>
                            Cancel
                          </Button>
                        )}
                      </div>
                    </Form>
                    <div className="external-event pb-1 bg-soft-primary text-primary mt-3">
                      <IconifyIcon icon="bxs:circle" className="me-2 vertical-middle" />
                      {visibleTodos.length} Total {itemName}s
                    </div>
                    <div className="external-event pb-1 bg-soft-success text-success">
                      <IconifyIcon icon="bxs:circle" className="me-2 vertical-middle" />
                      {completedTodos.length} Completed {itemName}s
                    </div>
                  </div>
                </Col>

                  {isTodoPage && <Col xl={9}>
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
                  </Col>}
                </Row>
              </CardBody>
            </Card>
          )}
        </Col>
      </Row>

      <Card>
        <CardBody>
          <div className="d-flex align-items-center justify-content-between gap-3 flex-wrap mb-3">
            <div>
              <h4 className="card-title mb-1">{pageTitle}</h4>
              <div className="text-muted">{isTodoPage ? `${user?.name || 'User'} task list` : canAssign ? 'Team task ownership and deadlines' : 'Tasks assigned to you'}</div>
            </div>
            <Badge bg="light" text="dark">
              {visibleTodos.length} {itemName.toLowerCase()}s
            </Badge>
          </div>
          {error && <Alert variant="danger">{error}</Alert>}
          <div className="d-flex gap-2 flex-wrap">
            <div style={{ flex: '1 1 280px' }}>
              <div className="search-bar">
                <span>
                  <IconifyIcon icon="bx:search-alt" />
                </span>
                <input type="search" className="form-control" value={search} onChange={(event) => setSearch(event.target.value)} placeholder={`Search ${itemName.toLowerCase()} title`} />
              </div>
            </div>
            {!isTodoPage && (
              <div style={{ flex: '1 1 240px' }}>
                <Form.Select value={assigneeFilter} onChange={(event) => setAssigneeFilter(event.target.value)}>
                  <option value="">All assignees</option>
                  {users.map((person) => (
                    <option key={person._id} value={person._id}>
                      {person.name}
                    </option>
                  ))}
                </Form.Select>
              </div>
            )}
            {!isTodoPage && (
              <div style={{ flex: '1 1 190px' }}>
                <Form.Select value={groupFilter} onChange={(event) => {
                  setGroupFilter(event.target.value)
                  setWorkTypeFilter('')
                }}>
                  <option value="">All roles</option>
                  {groups.map((group) => (
                    <option key={group} value={group}>
                      {group}
                    </option>
                  ))}
                </Form.Select>
              </div>
            )}
            {!isTodoPage && (
              <div style={{ flex: '1 1 190px' }}>
                <Form.Select value={workTypeFilter} onChange={(event) => setWorkTypeFilter(event.target.value)}>
                  <option value="">All work types</option>
                  {workTypes.map((workType) => (
                    <option key={workType} value={workType}>
                      {workType}
                    </option>
                  ))}
                </Form.Select>
              </div>
            )}
            <div style={{ flex: '1 1 190px' }}>
              <Form.Select value={statusFilter} onChange={(event) => setStatusFilter(event.target.value)}>
                <option value="">All statuses</option>
                {(isTodoPage ? todoStatuses : taskStatuses).map((status) => (
                  <option key={status} value={status}>
                    {status === 'To Do' ? 'Pending' : status}
                  </option>
                ))}
              </Form.Select>
            </div>
            <div style={{ flex: '1 1 190px' }}>
              <Form.Select value={priorityFilter} onChange={(event) => setPriorityFilter(event.target.value)}>
                <option value="">All priorities</option>
                <option>Low</option>
                <option>Medium</option>
                <option>High</option>
                {!isTodoPage && <option>Critical</option>}
              </Form.Select>
            </div>
            <div style={{ flex: '0 1 170px' }}>
              <Form.Control type="date" value={fromDateFilter} onChange={(event) => setFromDateFilter(event.target.value)} aria-label="From deadline" />
            </div>
            <div style={{ flex: '0 1 170px' }}>
              <Form.Control type="date" value={toDateFilter} onChange={(event) => setToDateFilter(event.target.value)} aria-label="To deadline" />
            </div>
          </div>
        </CardBody>
        <div className="table-responsive table-centered">
          <Table hover className="mb-0 align-middle" style={{ minWidth: 1280 }}>
            <thead className="bg-light bg-opacity-50">
              <tr>
                <th className="border-0 py-2 text-center" style={{ width: 48 }}>Done</th>
                {!isTodoPage && <th className="border-0 py-2" style={{ width: 120 }}>Ticket</th>}
                <th className="border-0 py-2" style={{ minWidth: 360 }}>{itemName}</th>
                {!isTodoPage && <th className="border-0 py-2" style={{ width: 150 }}>Work Type</th>}
                <th className="border-0 py-2" style={{ width: 170 }}>Assignee</th>
                <th className="border-0 py-2" style={{ width: 180 }}>Created on</th>
                <th className="border-0 py-2" style={{ width: 160 }}>Deadline</th>
                <th className="border-0 py-2" style={{ width: 130 }}>Status</th>
                <th className="border-0 py-2" style={{ width: 130 }}>Priority</th>
                <th className="border-0 py-2 text-center" style={{ width: 80 }}>View</th>
                <th className="border-0 py-2 text-center" style={{ width: 80 }}>Update</th>
                <th className="border-0 py-2 text-center" style={{ width: 80 }}>Delete</th>
              </tr>
            </thead>
            <tbody>
              {loading && (
                <tr>
                  <td colSpan={isTodoPage ? 10 : 12} className="text-center py-5">
                    <Spinner className="spinner-border-sm me-2" tag="span" />
                    <span className="text-muted">Loading {itemName.toLowerCase()}s...</span>
                  </td>
                </tr>
              )}
              {!loading &&
                visibleTodos.map((todo) => (
                  <tr key={todo._id}>
                    <td className="text-center">
                      <Form.Check
                        type="checkbox"
                        checked={todo.status === 'Completed' || todo.status === 'Done'}
                        aria-label={`Mark ${todo.title} complete`}
                        onChange={(event) => updateStatus(todo, event.target.checked ? 'Completed' : 'Pending')}
                      />
                    </td>
                    {!isTodoPage && (
                      <td>
                        <Badge bg="light" text="dark">{todo.ticketNumber || '-'}</Badge>
                      </td>
                    )}
                    <td style={{ whiteSpace: 'normal' }}>
                      <div className="fw-medium">{todo.title}</div>
                      {!isTodoPage && todo.description && <div className="text-muted fs-13">{todo.description}</div>}
                    </td>
                    {!isTodoPage && <td>{todo.projectEpic || '-'}</td>}
                    <td>
                      {canAssign && !isTodoPage ? (
                        <Form.Select size="sm" value={personId(todo.assignee) || ''} onChange={(event) => reassignTask(todo, event.target.value)}>
                          {users.map((person) => (
                            <option key={person._id} value={person._id}>
                              {person.name}
                            </option>
                          ))}
                        </Form.Select>
                      ) : (
                        personName(todo.assignee || todo.assignedTo) || user?.name || '-'
                      )}
                    </td>
                    <td>{todo.createdAt ? new Date(todo.createdAt).toLocaleString() : '-'}</td>
                    <td>
                      {todo.dueDate ? new Date(todo.dueDate).toLocaleDateString() : '-'}
                      {isOverdue(todo) && <Badge bg="danger" className="ms-2">Exceeded Deadline</Badge>}
                    </td>
                    <td>
                      {!isTodoPage ? (
                        <Form.Select size="sm" value={todo.status} onChange={(event) => updateStatus(todo, event.target.value as TaskStatus)}>
                          {taskStatuses.map((status) => (
                            <option key={status}>{status}</option>
                          ))}
                        </Form.Select>
                      ) : (
                        <Badge bg={statusVariant(todo.status)}>{todo.status}</Badge>
                      )}
                      {todo.completedAt && <span className="text-muted fs-13 ms-2">{new Date(todo.completedAt).toLocaleDateString()}</span>}
                    </td>
                    <td className={`text-${priorityColor(todo.priority)}`}>
                      {!isTodoPage ? (
                        <Form.Select size="sm" value={todo.priority} onChange={(event) => updatePriority(todo, event.target.value as TodoPriority)}>
                          <option>Low</option>
                          <option>Medium</option>
                          <option>High</option>
                          <option>Critical</option>
                        </Form.Select>
                      ) : (
                        <>
                          <IconifyIcon icon="bxs:circle" className="me-1" />
                          {todo.priority}
                        </>
                      )}
                    </td>
                    <td className="text-center">
                      {!isTodoPage ? (
                        <Link to={`/tasks/${todo._id}`} className="btn btn-soft-primary btn-sm text-nowrap">
                          View
                        </Link>
                      ) : (
                        '-'
                      )}
                    </td>
                    <td className="text-center">
                      {isTodoPage ? (
                        <Button variant="soft-secondary" size="sm" onClick={() => editTask(todo)}>
                          <IconifyIcon icon="bx:edit" className="fs-16" />
                        </Button>
                      ) : (
                        <Link to={`/tasks/${todo._id}/edit`} className="btn btn-soft-secondary btn-sm">
                          <IconifyIcon icon="bx:edit" className="fs-16" />
                        </Link>
                      )}
                    </td>
                    <td className="text-center">
                      {isTodoPage || canAssign ? (
                        <Button variant="soft-danger" size="sm" type="button" onClick={() => setDeleteTarget(todo)}>
                          <IconifyIcon icon="bx:trash" className="fs-16" />
                        </Button>
                      ) : '-'}
                    </td>
                  </tr>
                ))}
            </tbody>
          </Table>
        </div>
        {!loading && !visibleTodos.length && (
          <div className="p-3">
            <Alert variant="info" className="mb-0">
              No {itemName.toLowerCase()}s found
            </Alert>
          </div>
        )}
      </Card>
      <DeleteConfirmModal
        show={!!deleteTarget}
        title={`Delete ${itemName.toLowerCase()}?`}
        itemName={deleteTarget?.title}
        confirming={deleting}
        onCancel={() => setDeleteTarget(undefined)}
        onConfirm={deleteTask}
      />
    </>
  )
}

export default TODO
