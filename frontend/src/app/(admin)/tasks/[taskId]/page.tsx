import { FormEvent, useEffect, useState } from 'react'
import { Alert, Badge, Button, Card, CardBody, Col, Form, Row } from 'react-bootstrap'
import { Link, useParams } from 'react-router-dom'
import { toast } from 'react-toastify'

import PageBreadcrumb from '@/components/layout/PageBreadcrumb'
import PageMetaData from '@/components/PageTitle'
import Spinner from '@/components/Spinner'
import { apiFetch } from '@/helpers/api'
import { useAuthStore } from '@/store/authStore'
import type { UserType } from '@/types/auth'

type TaskUser = Pick<UserType, '_id' | 'name' | 'email' | 'role' | 'status'>
type TaskAttachment = { key: string; url?: string; originalName?: string; contentType?: string; size?: number; checksum?: string; attachmentToken?: string }
type TaskNote = { _id: string; title: string; description: string; createdBy?: string | TaskUser; createdAt?: string }

type Task = {
  _id: string
  title: string
  description?: string
  acceptanceCriteria?: string
  assignee?: string | TaskUser
  createdBy?: string | TaskUser
  priority: string
  status: string
  dueDate?: string
  projectEpic?: string
  labels?: string[]
  dependenciesBlockers?: string
  technicalNotes?: string
  attachments?: TaskAttachment[]
  estimate?: string
  definitionOfDone?: string
  completedAt?: string
  createdAt?: string
  updatedAt?: string
  notes?: TaskNote[]
}

const personName = (person?: string | TaskUser) => (typeof person === 'object' ? person.name : 'Not assigned')
const text = (value?: string, empty = 'Not added yet') => {
  const clean = value?.trim()
  if (!clean) return empty
  if (clean === 'Saved in MongoDB and rendered from the /api/tasks response.') return 'This task appears correctly in the CRM task list.'
  if (clean === 'Task is visible in the task list with assignee, status, priority, and due date.') return 'You can see this task in the list with owner, status, priority, and due date.'
  return clean
}
const dateText = (value?: string) =>
  value
    ? new Intl.DateTimeFormat(undefined, { dateStyle: 'medium', timeStyle: 'short' }).format(new Date(value))
    : 'No date set'
const statusVariant = (status: string) => (status === 'Done' ? 'success' : status === 'Blocked' ? 'danger' : ['In Progress', 'Review', 'Testing'].includes(status) ? 'warning' : 'primary')
const priorityVariant = (priority: string) => (priority === 'Critical' || priority === 'High' ? 'danger' : priority === 'Medium' ? 'warning' : 'success')

const TaskDetail = () => {
  const { taskId } = useParams()
  const token = useAuthStore((state) => state.token)
  const [task, setTask] = useState<Task>()
  const [note, setNote] = useState({ title: '', description: '' })
  const [loading, setLoading] = useState(false)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')

  useEffect(() => {
    if (!token || !taskId) return
    setLoading(true)
    setError('')
    apiFetch<{ data: Task }>(`/tasks/${taskId}`, { token })
      .then((res) => setTask(res.data))
      .catch((e) => setError(e instanceof Error ? e.message : 'Unable to load task'))
      .finally(() => setLoading(false))
  }, [taskId, token])

  const addNote = async (event: FormEvent) => {
    event.preventDefault()
    if (!token || !taskId || !note.title.trim() || !note.description.trim()) return
    setSaving(true)
    setError('')
    try {
      const res = await apiFetch<{ data: Task }>(`/tasks/${taskId}/notes`, {
        method: 'POST',
        token,
        body: JSON.stringify(note),
      })
      setTask(res.data)
      setNote({ title: '', description: '' })
      toast.success('Task note added')
    } catch (e) {
      const message = e instanceof Error ? e.message : 'Unable to save note'
      setError(message)
      toast.error(message)
    } finally {
      setSaving(false)
    }
  }

  return (
    <>
      <PageBreadcrumb subName="Task Management" title={task?.title || 'Task Detail'} />
      <PageMetaData title={task?.title || 'Task Detail'} />
      {error && <Alert variant="danger">{error}</Alert>}
      {loading && (
        <div className="text-center py-5">
          <Spinner className="spinner-border-sm me-2" tag="span" />
          <span className="text-muted">Loading task...</span>
        </div>
      )}
      {task && (
        <>
          <div className="d-flex justify-content-between align-items-center gap-3 flex-wrap mb-3">
            <div>
              <h3 className="mb-1">{task.title}</h3>
              <div className="text-muted">Assignee: {personName(task.assignee)}</div>
            </div>
            <div className="d-flex gap-2">
              <Link to={`/tasks/${task._id}/edit`} className="btn btn-primary">
                Update
              </Link>
              <Link to="/tasks/all" className="btn btn-outline-secondary">
                Back
              </Link>
            </div>
          </div>

          <Row className="g-3">
            <Col xl={8}>
              <Card>
                <CardBody>
                  <div className="d-flex justify-content-between align-items-start gap-3 flex-wrap mb-4">
                    <h4 className="card-title mb-0">Task Summary</h4>
                    <div className="d-flex gap-2 flex-wrap">
                      <Badge bg={statusVariant(task.status)}>{task.status}</Badge>
                      <Badge bg={priorityVariant(task.priority)}>{task.priority} priority</Badge>
                    </div>
                  </div>

                  <div className="mb-4">
                    <div className="fw-semibold mb-1">Scope of work</div>
                    <div className="text-muted">{text(task.description)}</div>
                  </div>

                  <div className="mb-4">
                    <div className="fw-semibold mb-1">Acceptance criteria</div>
                    <div className="text-muted">{text(task.acceptanceCriteria)}</div>
                  </div>

                  <Row className="g-3 mb-4">
                    <Col md={6} lg={3}>
                      <div className="small text-muted">Assignee</div>
                      <div className="fw-semibold">{personName(task.assignee)}</div>
                    </Col>
                    <Col md={6} lg={3}>
                      <div className="small text-muted">Due date</div>
                      <div className="fw-semibold text-nowrap">{dateText(task.dueDate)}</div>
                    </Col>
                    <Col md={6} lg={3}>
                      <div className="small text-muted">Estimated effort</div>
                      <div className="fw-semibold">{text(task.estimate)}</div>
                    </Col>
                    <Col md={6} lg={3}>
                      <div className="small text-muted">Project</div>
                      <div className="fw-semibold">{text(task.projectEpic)}</div>
                    </Col>
                  </Row>

                  <div className="border-top pt-3">
                    <Row className="g-3">
                      <Col md={6}>
                      <div className="small text-muted">Created by</div>
                        <div>{personName(task.createdBy)}</div>
                      </Col>
                      <Col md={6}>
                      <div className="small text-muted">Created on</div>
                        <div className="text-nowrap">{dateText(task.createdAt)}</div>
                      </Col>
                      <Col md={6}>
                        <div className="small text-muted">Dependencies or blockers</div>
                        <div>{text(task.dependenciesBlockers, 'No blockers')}</div>
                      </Col>
                      <Col md={6}>
                        <div className="small text-muted">Internal notes</div>
                        <div>{text(task.technicalNotes)}</div>
                      </Col>
                      <Col xs={12}>
                        <div className="small text-muted">Definition of done</div>
                        <div>{text(task.definitionOfDone)}</div>
                      </Col>
                      <Col xs={12}>
                        <div className="small text-muted mb-2">Tags</div>
                        <div className="d-flex gap-2 flex-wrap">
                          {task.labels?.length ? task.labels.map((label) => <Badge bg="secondary" className="rounded-pill" key={label}>{label}</Badge>) : <span className="text-muted">No tags</span>}
                        </div>
                      </Col>
                      <Col xs={12}>
                        <div className="small text-muted mb-2">Attachments</div>
                        <div className="d-flex gap-2 flex-wrap">
                          {task.attachments?.length ? task.attachments.map((file) => (
                            file.url ? (
                              <a className="btn btn-sm btn-outline-primary" href={file.url} target="_blank" rel="noreferrer" key={file.key}>
                                {file.originalName || file.key}
                              </a>
                            ) : (
                              <Badge bg="secondary" className="rounded-pill" key={file.key}>{file.originalName || file.key}</Badge>
                            )
                          )) : <span className="text-muted">No attachments</span>}
                        </div>
                      </Col>
                    </Row>
                  </div>
                </CardBody>
              </Card>
            </Col>
            <Col xl={4}>
              <Card>
                <CardBody>
                  <h4 className="card-title mb-3">Add note</h4>
                  <Form onSubmit={addNote}>
                    <Form.Group className="mb-3">
                      <Form.Label>Title</Form.Label>
                      <Form.Control required value={note.title} onChange={(event) => setNote({ ...note, title: event.target.value })} />
                    </Form.Group>
                    <Form.Group className="mb-3">
                      <Form.Label>Description</Form.Label>
                      <Form.Control required as="textarea" rows={4} value={note.description} onChange={(event) => setNote({ ...note, description: event.target.value })} />
                    </Form.Group>
                    <Button type="submit" disabled={saving}>{saving ? 'Saving...' : 'Add note'}</Button>
                  </Form>
                </CardBody>
              </Card>
              <Card>
                <CardBody>
                  <h4 className="card-title mb-3">Notes</h4>
                  {task.notes?.length ? (
                    [...task.notes].reverse().map((item) => (
                      <div className="border-bottom pb-3 mb-3" key={item._id}>
                        <div className="d-flex justify-content-between gap-2">
                          <strong>{item.title}</strong>
                          <span className="text-muted fs-13">{dateText(item.createdAt)}</span>
                        </div>
                        <div className="text-muted fs-13 mb-2">{personName(item.createdBy)}</div>
                        <div>{item.description}</div>
                      </div>
                    ))
                  ) : (
                    <Alert variant="info" className="mb-0">No notes yet</Alert>
                  )}
                </CardBody>
              </Card>
            </Col>
          </Row>
        </>
      )}
    </>
  )
}

export default TaskDetail
