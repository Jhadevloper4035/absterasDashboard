import { FormEvent, useEffect, useState } from 'react'
import { Alert, Badge, Button, Card, CardBody, Col, Form, Row } from 'react-bootstrap'
import { Link, useParams } from 'react-router-dom'
import { toast } from 'react-toastify'

import DropzoneFormInput from '@/components/form/DropzoneFormInput'
import PageBreadcrumb from '@/components/layout/PageBreadcrumb'
import PageMetaData from '@/components/PageTitle'
import Spinner from '@/components/Spinner'
import IconifyIcon from '@/components/wrappers/IconifyIcon'
import { apiFetch } from '@/helpers/api'
import { uploadMultipartFiles } from '@/helpers/upload'
import { useAuthStore } from '@/store/authStore'
import type { UploadFileType } from '@/types/component-props'
import type { UserType } from '@/types/auth'
import { formatFileSize } from '@/utils/other'

type TaskUser = Pick<UserType, '_id' | 'name' | 'email' | 'role' | 'status'>
type TaskAttachment = { key: string; url?: string; originalName?: string; contentType?: string; size?: number; checksum?: string; attachmentToken?: string }
type TaskNote = { _id: string; title: string; description: string; attachments?: TaskAttachment[]; createdBy?: string | TaskUser; createdAt?: string }

type Task = {
  _id: string
  ticketNumber?: string
  title: string
  description?: string
  assignee?: string | TaskUser
  createdBy?: string | TaskUser
  priority: string
  status: string
  dueDate?: string
  projectEpic?: string
  dependenciesBlockers?: string
  attachments?: TaskAttachment[]
  estimate?: string
  completedAt?: string
  createdAt?: string
  updatedAt?: string
  notes?: TaskNote[]
}

const personName = (person?: string | TaskUser) => (typeof person === 'object' ? person.name : 'Not assigned')
const personRole = (person?: string | TaskUser) => (typeof person === 'object' ? person.role : '')
const text = (value?: string, empty = 'Not added yet') => {
  const clean = value?.trim()
  if (!clean) return empty
  if (clean === 'Saved in MongoDB and rendered from the /api/tasks response.') return 'This task appears correctly in the task management list.'
  if (clean === 'Task is visible in the task list with assignee, status, priority, and due date.') return 'You can see this task in the list with owner, status, priority, and due date.'
  return clean
}
const dateText = (value?: string) =>
  value
    ? new Intl.DateTimeFormat(undefined, { dateStyle: 'medium', timeStyle: 'short' }).format(new Date(value))
    : 'No date set'
const dayKey = (value: string | Date) => new Intl.DateTimeFormat('en-CA', { year: 'numeric', month: '2-digit', day: '2-digit' }).format(new Date(value))
const isToday = (value?: string) => Boolean(value && dayKey(value) === dayKey(new Date()))
const isOverdue = (task: Task) => Boolean(task.dueDate && task.status !== 'Done' && new Date(task.dueDate).getTime() < Date.now() && !isToday(task.dueDate))
const statusVariant = (status: string) => (status === 'Done' ? 'success' : status === 'Blocked' ? 'danger' : ['In Progress', 'Review', 'Testing'].includes(status) ? 'warning' : 'primary')
const priorityVariant = (priority: string) => (priority === 'Critical' || priority === 'High' ? 'danger' : priority === 'Medium' ? 'warning' : 'success')
const attachmentName = (file: TaskAttachment) => (file.originalName || file.key).replace(/^\.?\//, '')
const attachmentExtension = (file: TaskAttachment) => attachmentName(file).split('.').pop()?.toUpperCase() || 'FILE'
const attachmentIcon = (file: TaskAttachment) => file.contentType?.startsWith('image/') ? 'bx:image' : 'bx:paperclip'

const AttachmentDownloadList = ({ attachments }: { attachments?: TaskAttachment[] }) => (
  attachments?.length ? (
    <div className="attachment-list">
      {attachments.map((file) => (
        <div className="attachment-row" key={file.key}>
          <span className="attachment-icon">
            <IconifyIcon icon={attachmentIcon(file)} />
          </span>
          <span className="attachment-meta">
            <span className="attachment-name" title={attachmentName(file)}>{attachmentName(file)}</span>
            <span className="attachment-detail">{attachmentExtension(file)}{file.size ? ` · ${formatFileSize(file.size)}` : ''}</span>
          </span>
          {file.url ? (
            <a className="btn btn-sm btn-outline-primary text-nowrap" href={file.url} target="_blank" rel="noreferrer">
              <IconifyIcon icon="bx:download" className="me-1" />
              Download
            </a>
          ) : (
            <Button size="sm" variant="outline-secondary" disabled className="text-nowrap">Unavailable</Button>
          )}
        </div>
      ))}
    </div>
  ) : (
    <span className="text-muted">No attachments</span>
  )
)

const TaskDetail = () => {
  const { taskId } = useParams()
  const token = useAuthStore((state) => state.token)
  const [task, setTask] = useState<Task>()
  const [note, setNote] = useState({ title: '', description: '', attachments: [] as TaskAttachment[] })
  const [loading, setLoading] = useState(false)
  const [saving, setSaving] = useState(false)
  const [uploadingNote, setUploadingNote] = useState(false)
  const [uploadNoteProgress, setUploadNoteProgress] = useState(0)
  const [uploadNoteFailed, setUploadNoteFailed] = useState(false)
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
    if (uploadingNote) {
      setError('Please wait until attachments finish uploading before saving the note.')
      return
    }
    if (uploadNoteFailed) {
      setError('Attachment upload failed. Please upload the file again before saving the note.')
      return
    }
    setSaving(true)
    setError('')
    try {
      const res = await apiFetch<{ data: Task }>(`/tasks/${taskId}/notes`, {
        method: 'POST',
        token,
        body: JSON.stringify(note),
      })
      setTask(res.data)
      setNote({ title: '', description: '', attachments: [] })
      setUploadNoteFailed(false)
      setUploadNoteProgress(0)
      toast.success('Task note added')
    } catch (e) {
      const message = e instanceof Error ? e.message : 'Unable to save note'
      setError(message)
      toast.error(message)
    } finally {
      setSaving(false)
    }
  }

  const uploadNoteFiles = async (files: UploadFileType[]) => {
    if (!token || !files.length) return
    setUploadingNote(true)
    setUploadNoteProgress(0)
    setUploadNoteFailed(false)
    setError('')
    try {
      const attachments = await uploadMultipartFiles<TaskAttachment>(files, token, setUploadNoteProgress)
      setNote((value) => ({ ...value, attachments: [...value.attachments, ...attachments] }))
    } catch (e) {
      setUploadNoteFailed(true)
      setError(e instanceof Error ? e.message : 'Unable to upload note attachments')
    } finally {
      setUploadingNote(false)
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
              <div className="text-muted">{task.ticketNumber ? `${task.ticketNumber} · ` : ''}Assignee: {personName(task.assignee)}</div>
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
                      {task.ticketNumber && <Badge bg="light" text="dark">{task.ticketNumber}</Badge>}
                      <Badge bg={statusVariant(task.status)}>{task.status}</Badge>
                      <Badge bg={priorityVariant(task.priority)}>{task.priority} priority</Badge>
                      {isOverdue(task) && <Badge bg="danger">Exceeded Deadline</Badge>}
                    </div>
                  </div>

                  <div className="mb-4">
                    <div className="fw-semibold mb-1">Scope of work</div>
                    <div className="text-muted">{text(task.description)}</div>
                  </div>

                  <Row className="g-3 mb-4">
                    <Col md={6} lg={3}>
                      <div className="small text-muted">Assignee</div>
                      <div className="fw-semibold">{personName(task.assignee)}</div>
                    </Col>
                    <Col md={6} lg={3}>
                      <div className="small text-muted">Deadline</div>
                      <div className="fw-semibold text-nowrap">{dateText(task.dueDate)}</div>
                    </Col>
                    <Col md={6} lg={3}>
                      <div className="small text-muted">Estimated effort</div>
                      <div className="fw-semibold">{text(task.estimate)}</div>
                    </Col>
                    <Col md={6} lg={3}>
                      <div className="small text-muted">Work type</div>
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
                      <Col xs={12}>
                        <div className="small text-muted">Dependencies or blockers</div>
                        <div>{text(task.dependenciesBlockers, 'No blockers')}</div>
                      </Col>
                      <Col xs={12}>
                        <div className="small text-muted mb-2">Attachments</div>
                        <AttachmentDownloadList attachments={task.attachments} />
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
                    <Form.Group className="mb-3">
                      <DropzoneFormInput
                        label="Attachments"
                        labelClassName="form-label"
                        iconProps={{ icon: 'bx:cloud-upload', height: 28, width: 28 }}
                        text="Attach files"
                        textClassName="fs-5"
                        helpText={<span className="text-muted fs-13">Images, PDF, Word, Excel, PowerPoint, CSV, TXT. Up to 5 files.</span>}
                        showPreview={false}
                        onFileUpload={uploadNoteFiles}
                      />
                      {uploadingNote && (
                        <div className="text-muted fs-13 mt-2">
                          <div className="d-flex align-items-center gap-2 mb-1">
                            <Spinner className="spinner-border-sm" tag="span" />
                            <span>Uploading attachment... {uploadNoteProgress}%</span>
                          </div>
                          <div className="progress" style={{ height: 6 }}>
                            <div className="progress-bar" style={{ width: `${uploadNoteProgress}%` }} />
                          </div>
                        </div>
                      )}
                      {!!note.attachments.length && (
                        <div className="mt-2">
                          <AttachmentDownloadList attachments={note.attachments} />
                        </div>
                      )}
                    </Form.Group>
                    <Button type="submit" disabled={saving || uploadingNote}>{uploadingNote ? 'Uploading...' : saving ? 'Saving...' : 'Add note'}</Button>
                  </Form>
                </CardBody>
              </Card>
              <Card>
                <CardBody>
                  <h4 className="card-title mb-3">Notes</h4>
                  {task.notes?.length ? (
                    <div className="position-relative border-start ps-3">
                      {[...task.notes].reverse().map((item) => (
                        <div className="position-relative pb-4" key={item._id}>
                          <span className="position-absolute bg-primary rounded-circle" style={{ width: 10, height: 10, left: -21, top: 6 }} />
                          <div className="d-flex justify-content-between gap-2 flex-wrap">
                            <strong>{item.title}</strong>
                            <span className="text-muted fs-13">{dateText(item.createdAt)}</span>
                          </div>
                          <div className="text-muted fs-13 mb-2">
                            {personName(item.createdBy)}
                            {personRole(item.createdBy) && <Badge bg="light" text="dark" className="ms-2">{personRole(item.createdBy)}</Badge>}
                          </div>
                          <div className="mb-2">{item.description}</div>
                          {!!item.attachments?.length && (
                            <AttachmentDownloadList attachments={item.attachments} />
                          )}
                        </div>
                      ))}
                    </div>
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
