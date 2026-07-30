import { FormEvent, useEffect, useState } from 'react'
import { Alert, Badge, Button, Card, CardBody, Col, Form, Row } from 'react-bootstrap'
import { Link, useNavigate } from 'react-router-dom'
import ReactSelect from 'react-select'
import { toast } from 'react-toastify'

import DropzoneFormInput from '@/components/form/DropzoneFormInput'
import Spinner from '@/components/Spinner'
import { apiFetch } from '@/helpers/api'
import { useAuthStore } from '@/store/authStore'
import type { UploadFileType } from '@/types/component-props'
import type { UserType } from '@/types/auth'

type TaskAttachment = { key: string; url?: string; contentType?: string; originalName?: string; size?: number; checksum?: string; attachmentToken?: string }
type AssigneeOption = { value: string; label: string }
type Task = {
  _id: string
  title?: string
  description?: string
  acceptanceCriteria?: string
  assignee?: string | Pick<UserType, '_id'>
  priority?: string
  status?: string
  dueDate?: string
  projectEpic?: string
  labels?: string[]
  dependenciesBlockers?: string
  technicalNotes?: string
  attachments?: TaskAttachment[]
  estimate?: string
  definitionOfDone?: string
}

const emptyForm = {
  title: '',
  description: '',
  acceptanceCriteria: '',
  assignee: '',
  priority: 'Medium',
  status: 'To Do',
  dueDate: '',
  projectEpic: '',
  labels: '',
  dependenciesBlockers: '',
  technicalNotes: '',
  attachments: [] as TaskAttachment[],
  estimate: '',
  definitionOfDone: '',
}

const TaskCreateCard = ({ taskId }: { taskId?: string }) => {
  const navigate = useNavigate()
  const token = useAuthStore((state) => state.token)
  const [users, setUsers] = useState<UserType[]>([])
  const [form, setForm] = useState(emptyForm)
  const [loading, setLoading] = useState(false)
  const [saving, setSaving] = useState(false)
  const [uploading, setUploading] = useState(false)
  const [message, setMessage] = useState('')
  const [error, setError] = useState('')

  useEffect(() => {
    if (!token) return
    setLoading(true)
    Promise.all([
      apiFetch<{ data: UserType[] }>('/tasks/assignees', { token }),
      taskId ? apiFetch<{ data: Task }>(`/tasks/${taskId}`, { token }) : Promise.resolve(undefined),
    ])
      .then(([userRes, taskRes]) => {
        setUsers(userRes.data)
        if (taskRes?.data) {
          const task = taskRes.data
          setForm({
            title: task.title || '',
            description: task.description || '',
            acceptanceCriteria: task.acceptanceCriteria || '',
            assignee: typeof task.assignee === 'object' ? task.assignee._id : task.assignee || '',
            priority: task.priority || 'Medium',
            status: task.status || 'To Do',
            dueDate: task.dueDate ? task.dueDate.slice(0, 10) : '',
            projectEpic: task.projectEpic || '',
            labels: Array.isArray(task.labels) ? task.labels.join(', ') : task.labels || '',
            dependenciesBlockers: task.dependenciesBlockers || '',
            technicalNotes: task.technicalNotes || '',
            attachments: task.attachments || [],
            estimate: task.estimate || '',
            definitionOfDone: task.definitionOfDone || '',
          })
        }
      })
      .catch((e) => setError(e instanceof Error ? e.message : 'Unable to load users'))
      .finally(() => setLoading(false))
  }, [taskId, token])

  const uploadFiles = async (files: UploadFileType[]) => {
    if (!token || !files.length) return
    setUploading(true)
    setError('')
    try {
      const body = new FormData()
      files.forEach((file) => body.append('files', file))
      const res = await apiFetch<{ data: TaskAttachment[] }>('/uploads/multipart', { method: 'POST', body, token })
      setForm((value) => ({ ...value, attachments: [...value.attachments, ...res.data] }))
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Unable to upload attachments')
    } finally {
      setUploading(false)
    }
  }

  const saveTask = async (event: FormEvent) => {
    event.preventDefault()
    if (!token) return
    if (!form.assignee) {
      setError('Please select an assignee')
      return
    }
    setSaving(true)
    setError('')
    setMessage('')
    try {
      await apiFetch(taskId ? `/tasks/${taskId}` : '/tasks', {
        method: taskId ? 'PATCH' : 'POST',
        token,
        body: JSON.stringify(form),
      })
      toast.success(taskId ? 'Task updated successfully' : 'Task assigned successfully')
      if (taskId) {
        navigate(`/tasks/${taskId}`)
      } else {
        setForm(emptyForm)
        setMessage('Task assigned successfully')
        window.dispatchEvent(new Event('todos:changed'))
      }
    } catch (e) {
      const message = e instanceof Error ? e.message : taskId ? 'Unable to update task' : 'Unable to create task'
      setError(message)
      toast.error(message)
    } finally {
      setSaving(false)
    }
  }

  const assigneeOptions: AssigneeOption[] = users.map((user) => ({
    value: user._id,
    label: `${user.name} (${user.email}) - ${user.role}`,
  }))

  return (
    <Card>
      <CardBody>
        <div className="mb-3">
          <h4 className="card-title mb-1">{taskId ? 'Update Task' : 'Create Task'}</h4>
          <div className="text-muted">{taskId ? 'Update the selected task without leaving the task detail workflow.' : 'Assign clear, trackable work with ownership, priority, due date, and supporting notes.'}</div>
        </div>
        {error && <Alert variant="danger">{error}</Alert>}
        {message && <Alert variant="success">{message}</Alert>}
        {loading ? (
          <div className="py-3">
            <Spinner className="spinner-border-sm me-2" tag="span" />
            <span className="text-muted">Loading team members...</span>
          </div>
        ) : (
          <Form onSubmit={saveTask}>
            <Row className="g-3 align-items-start">
            <Form.Group as={Col} lg={6}>
              <Form.Label className="fs-14 mb-1">Task title</Form.Label>
              <Form.Control
                required
                value={form.title}
                onChange={(event) => setForm({ ...form, title: event.target.value })}
                placeholder="e.g. Implement refresh-token rotation"
              />
            </Form.Group>
            <Form.Group as={Col} lg={6}>
              <Form.Label className="fs-14 mb-1">Assign to</Form.Label>
              <ReactSelect<AssigneeOption>
                classNamePrefix="react-select"
                options={assigneeOptions}
                value={assigneeOptions.find((option) => option.value === form.assignee) ?? null}
                onChange={(option) => setForm({ ...form, assignee: option?.value ?? '' })}
                placeholder="Search by name, email, or role"
                isClearable
                isSearchable
              />
            </Form.Group>

            <Form.Group as={Col} lg={6}>
              <Form.Label className="fs-14 mb-1">Scope of work</Form.Label>
              <Form.Control
                as="textarea"
                rows={4}
                value={form.description}
                onChange={(event) => setForm({ ...form, description: event.target.value })}
                placeholder="Example: Contact new website leads and record the first response"
              />
            </Form.Group>
            <Form.Group as={Col} lg={6}>
              <Form.Label className="fs-14 mb-1">Acceptance criteria</Form.Label>
              <Form.Control
                as="textarea"
                rows={4}
                value={form.acceptanceCriteria}
                onChange={(event) => setForm({ ...form, acceptanceCriteria: event.target.value })}
                placeholder="Example: Lead is updated with status, owner, priority, and next action"
              />
            </Form.Group>

            <Form.Group as={Col} lg={3} md={6}>
              <Form.Label className="fs-14 mb-1">Due date</Form.Label>
              <Form.Control required type="date" value={form.dueDate} onChange={(event) => setForm({ ...form, dueDate: event.target.value })} />
            </Form.Group>
            <Form.Group as={Col} lg={3} md={6}>
              <Form.Label className="fs-14 mb-1">Status</Form.Label>
              <Form.Select value={form.status} onChange={(event) => setForm({ ...form, status: event.target.value })}>
                <option>Backlog</option>
                <option>To Do</option>
                <option>In Progress</option>
                <option>Review</option>
                <option>Testing</option>
                <option>Blocked</option>
                <option>Done</option>
              </Form.Select>
            </Form.Group>
            <Form.Group as={Col} lg={3} md={6}>
              <Form.Label className="fs-14 mb-1">Priority</Form.Label>
              <Form.Select value={form.priority} onChange={(event) => setForm({ ...form, priority: event.target.value })}>
                <option>Critical</option>
                <option>High</option>
                <option>Medium</option>
                <option>Low</option>
              </Form.Select>
            </Form.Group>
            <Form.Group as={Col} lg={3} md={6}>
              <Form.Label className="fs-14 mb-1">Estimated effort</Form.Label>
              <Form.Control value={form.estimate} onChange={(event) => setForm({ ...form, estimate: event.target.value })} placeholder="e.g. 5 points" />
            </Form.Group>

            <Form.Group as={Col} lg={4}>
              <Form.Label className="fs-14 mb-1">Project or epic</Form.Label>
              <Form.Control value={form.projectEpic} onChange={(event) => setForm({ ...form, projectEpic: event.target.value })} placeholder="e.g. Authentication" />
            </Form.Group>
            <Form.Group as={Col} lg={4}>
              <Form.Label className="fs-14 mb-1">Labels</Form.Label>
              <Form.Control value={form.labels} onChange={(event) => setForm({ ...form, labels: event.target.value })} placeholder="backend, bug, security" />
            </Form.Group>
            <Form.Group as={Col} lg={4}>
              <Form.Label className="fs-14 mb-1">Dependencies or blockers</Form.Label>
              <Form.Control value={form.dependenciesBlockers} onChange={(event) => setForm({ ...form, dependenciesBlockers: event.target.value })} placeholder="Tasks, access, or decisions needed first" />
            </Form.Group>

            <Form.Group as={Col} lg={4}>
              <Form.Label className="fs-14 mb-1">Internal notes</Form.Label>
              <Form.Control
                as="textarea"
                rows={3}
                value={form.technicalNotes}
                onChange={(event) => setForm({ ...form, technicalNotes: event.target.value })}
                placeholder="Context, constraints, or instructions for the assignee"
              />
            </Form.Group>
            <Form.Group as={Col} lg={8}>
              <Form.Label className="fs-14 mb-1">Definition of done</Form.Label>
              <Form.Control
                as="textarea"
                rows={3}
                value={form.definitionOfDone}
                onChange={(event) => setForm({ ...form, definitionOfDone: event.target.value })}
                placeholder="Example: Customer response is recorded and the next follow-up is scheduled"
              />
            </Form.Group>

            <Form.Group as={Col} xs={12}>
              <DropzoneFormInput
                label="Attachments"
                labelClassName="fs-14 mb-1"
                iconProps={{ icon: 'bx:cloud-upload', height: 34, width: 34 }}
                text="Drag & drop files here, or browse"
                helpText={<span className="text-muted fs-13">PDF, Word, Excel, CSV, TXT, JPG, PNG, WebP. Up to 5 files.</span>}
                showPreview
                onFileUpload={uploadFiles}
              />
              {uploading && <div className="text-muted fs-13 mt-1">Uploading...</div>}
              {form.attachments.length > 0 && (
                <div className="mt-2 d-flex gap-2 flex-wrap">
                  {form.attachments.map((file) => (
                    <Badge bg="light" text="dark" key={file.key}>
                      {file.originalName || file.key}
                    </Badge>
                  ))}
                </div>
              )}
            </Form.Group>
            <Col xs={12} className="d-flex gap-2 pt-1">
              <Button type="submit" disabled={saving}>
                {saving ? 'Saving...' : taskId ? 'Update Task' : 'Create Task'}
              </Button>
              <Link to="/tasks/all" className="btn btn-light">
                Cancel
              </Link>
            </Col>
            </Row>
          </Form>
        )}
      </CardBody>
    </Card>
  )
}

export default TaskCreateCard
