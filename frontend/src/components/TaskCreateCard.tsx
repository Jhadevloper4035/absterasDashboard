import { FormEvent, useEffect, useRef, useState } from 'react'
import { Alert, Button, Card, CardBody, Col, Form, Row } from 'react-bootstrap'
import { Link, useNavigate } from 'react-router-dom'
import ReactSelect from 'react-select'
import { toast } from 'react-toastify'

import DropzoneFormInput from '@/components/form/DropzoneFormInput'
import IconifyIcon from '@/components/wrappers/IconifyIcon'
import Spinner from '@/components/Spinner'
import { apiFetch } from '@/helpers/api'
import { defaultTaskWorkTypes, mergeTaskWorkTypes } from '@/helpers/taskWorkTypes'
import { uploadMultipartFiles } from '@/helpers/upload'
import { useAuthStore } from '@/store/authStore'
import type { UploadFileType } from '@/types/component-props'
import type { UserType } from '@/types/auth'
import { formatFileSize } from '@/utils/other'

type TaskAttachment = { key: string; url?: string; contentType?: string; originalName?: string; size?: number; checksum?: string; attachmentToken?: string }
type AssigneeOption = { value: string; label: string }
type Task = {
  _id: string
  title?: string
  description?: string
  assignee?: string | Pick<UserType, '_id' | 'role'>
  priority?: string
  status?: string
  dueDate?: string
  projectEpic?: string
  dependenciesBlockers?: string
  attachments?: TaskAttachment[]
  estimate?: string
}

const emptyForm = {
  title: '',
  description: '',
  assignee: '',
  priority: 'Medium',
  status: 'To Do',
  dueDate: '',
  projectEpic: '',
  dependenciesBlockers: '',
  attachments: [] as TaskAttachment[],
  estimate: '',
}

function attachmentName(file: TaskAttachment) {
  return (file.originalName || file.key).replace(/^\.?\//, '')
}

function attachmentExtension(file: TaskAttachment) {
  return attachmentName(file).split('.').pop()?.toUpperCase() || 'FILE'
}

const TaskCreateCard = ({ taskId }: { taskId?: string }) => {
  const navigate = useNavigate()
  const token = useAuthStore((state) => state.token)
  const user = useAuthStore((state) => state.user)
  const [users, setUsers] = useState<UserType[]>([])
  const [workTypesByRole, setWorkTypesByRole] = useState(defaultTaskWorkTypes)
  const [form, setForm] = useState(emptyForm)
  const [loading, setLoading] = useState(false)
  const [saving, setSaving] = useState(false)
  const [pendingUploads, setPendingUploads] = useState(0)
  const pendingUploadsRef = useRef(0)
  const [uploadProgress, setUploadProgress] = useState(0)
  const [uploadFailed, setUploadFailed] = useState(false)
  const [message, setMessage] = useState('')
  const [error, setError] = useState('')
  const canAssign = user?.role === 'superadmin' || user?.role === 'admin'
  const uploading = pendingUploads > 0
  const selectedAssignee = users.find((person) => person._id === form.assignee)
  const selectedRole = selectedAssignee?.role || user?.role || ''
  const workTypes = [...new Set([...(workTypesByRole[selectedRole] || ['General']), form.projectEpic].filter(Boolean))]

  const updatePendingUploads = (change: number) => {
    pendingUploadsRef.current = Math.max(0, pendingUploadsRef.current + change)
    setPendingUploads(pendingUploadsRef.current)
  }

  useEffect(() => {
    if (!token) return
    setLoading(true)
    Promise.all([
      canAssign ? apiFetch<{ data: UserType[] }>('/tasks/assignees', { token }) : Promise.resolve({ data: [] }),
      apiFetch<{ data: Record<string, string[]> }>('/tasks/work-types', { token }),
      taskId ? apiFetch<{ data: Task }>(`/tasks/${taskId}`, { token }) : Promise.resolve(undefined),
    ])
      .then(([userRes, workTypeRes, taskRes]) => {
        setUsers(userRes.data)
        setWorkTypesByRole(mergeTaskWorkTypes(workTypeRes.data, false))
        if (taskRes?.data) {
          const task = taskRes.data
          setForm({
            title: task.title || '',
            description: task.description || '',
            assignee: typeof task.assignee === 'object' ? task.assignee._id : task.assignee || '',
            priority: task.priority || 'Medium',
            status: task.status || 'To Do',
            dueDate: task.dueDate ? task.dueDate.slice(0, 10) : '',
            projectEpic: task.projectEpic || '',
            dependenciesBlockers: task.dependenciesBlockers || '',
            attachments: task.attachments || [],
            estimate: task.estimate || '',
          })
        }
      })
      .catch((e) => setError(e instanceof Error ? e.message : 'Unable to load users'))
      .finally(() => setLoading(false))
  }, [canAssign, taskId, token])

  const uploadFiles = async (files: UploadFileType[]) => {
    if (!token || !files.length) return
    updatePendingUploads(1)
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
      updatePendingUploads(-1)
    }
  }

  const removeAttachment = (key: string) => {
    setForm((value) => ({ ...value, attachments: value.attachments.filter((file) => file.key !== key) }))
  }

  const saveTask = async (event: FormEvent) => {
    event.preventDefault()
    if (!token) return
    if (pendingUploadsRef.current > 0) {
      setError('Please wait until attachments finish uploading before saving the task.')
      return
    }
    if (uploadFailed) {
      setError('Attachment upload failed. Please upload the file again before saving the task.')
      return
    }
    if (canAssign && !form.assignee) {
      setError('Please select an assignee')
      return
    }
    setSaving(true)
    setError('')
    setMessage('')
    try {
      const { assignee, ...taskFields } = form
      const response = await apiFetch<{ data: Task }>(taskId ? `/tasks/${taskId}` : '/tasks', {
        method: taskId ? 'PATCH' : 'POST',
        token,
        body: JSON.stringify(canAssign ? { ...taskFields, assignee } : taskFields),
      })
      toast.success(taskId ? 'Task updated successfully' : 'Task assigned successfully')
      if (taskId) {
        navigate(`/tasks/${taskId}`)
      } else {
        window.dispatchEvent(new Event('todos:changed'))
        navigate(`/tasks/${response.data._id}`)
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
                  placeholder="e.g. Prepare coating estimate"
                />
              </Form.Group>
              {canAssign && (
                <Form.Group as={Col} lg={6}>
                  <Form.Label className="fs-14 mb-1">Assign to</Form.Label>
                  <ReactSelect<AssigneeOption>
                    classNamePrefix="react-select"
                    options={assigneeOptions}
                    value={assigneeOptions.find((option) => option.value === form.assignee) ?? null}
                    onChange={(option) => setForm({ ...form, assignee: option?.value ?? '', projectEpic: '' })}
                    placeholder="Search by name, email, or role"
                    isClearable
                    isSearchable
                  />
                </Form.Group>
              )}

              <Form.Group as={Col} lg={6}>
                <Form.Label className="fs-14 mb-1">Scope of work</Form.Label>
                <Form.Control
                  as="textarea"
                  rows={4}
                  value={form.description}
                  onChange={(event) => setForm({ ...form, description: event.target.value })}
                  placeholder="Add the work scope"
                />
              </Form.Group>
              <Form.Group as={Col} lg={6}>
                <Form.Label className="fs-14 mb-1">Dependencies or blockers</Form.Label>
                <Form.Control
                  as="textarea"
                  rows={4}
                  value={form.dependenciesBlockers}
                  onChange={(event) => setForm({ ...form, dependenciesBlockers: event.target.value })}
                  placeholder="Access, approvals, or blocked items"
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
                <Form.Label className="fs-14 mb-1">Work type</Form.Label>
                <Form.Select disabled={canAssign && !form.assignee} value={form.projectEpic} onChange={(event) => setForm({ ...form, projectEpic: event.target.value })}>
                  <option value="">Select work type</option>
                  {workTypes.map((workType) => (
                    <option key={workType}>{workType}</option>
                  ))}
                </Form.Select>
              </Form.Group>

              <Form.Group as={Col} xs={12}>
                <DropzoneFormInput
                  label="Attachments"
                  labelClassName="fs-14 mb-1"
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
                        <Button variant="link" className="attachment-remove" onClick={() => removeAttachment(file.key)} aria-label={`Remove ${attachmentName(file)}`}>
                          <IconifyIcon icon="bx:x" />
                        </Button>
                      </div>
                    ))}
                  </div>
                )}
              </Form.Group>
              <Col xs={12} className="d-flex gap-2 pt-1">
                <Button type="submit" disabled={saving || uploading}>
                  {uploading ? 'Uploading...' : saving ? 'Saving...' : taskId ? 'Update Task' : 'Create Task'}
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
