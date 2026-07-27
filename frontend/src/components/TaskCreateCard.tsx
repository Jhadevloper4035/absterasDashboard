import { FormEvent, useEffect, useState } from 'react'
import { Alert, Button, Card, CardBody, Form } from 'react-bootstrap'

import Spinner from '@/components/Spinner'
import { apiFetch } from '@/helpers/api'
import { useAuthStore } from '@/store/authStore'
import type { UserType } from '@/types/auth'

const emptyForm = { title: '', assignedTo: '', dueDate: '' }

const TaskCreateCard = () => {
  const token = useAuthStore((state) => state.token)
  const [users, setUsers] = useState<UserType[]>([])
  const [form, setForm] = useState(emptyForm)
  const [loading, setLoading] = useState(false)
  const [saving, setSaving] = useState(false)
  const [message, setMessage] = useState('')
  const [error, setError] = useState('')

  useEffect(() => {
    if (!token) return
    setLoading(true)
    apiFetch<{ data: UserType[] }>('/users', { token })
      .then((res) => setUsers(res.data.filter((user) => user.role === 'sales' && user.status === 'active')))
      .catch((e) => setError(e instanceof Error ? e.message : 'Unable to load sales users'))
      .finally(() => setLoading(false))
  }, [token])

  const createTask = async (event: FormEvent) => {
    event.preventDefault()
    if (!token) return
    setSaving(true)
    setError('')
    setMessage('')
    try {
      await apiFetch('/todos', {
        method: 'POST',
        token,
        body: JSON.stringify(form),
      })
      setForm(emptyForm)
      setMessage('Task assigned successfully')
      window.dispatchEvent(new Event('todos:changed'))
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Unable to create task')
    } finally {
      setSaving(false)
    }
  }

  return (
    <Card>
      <CardBody>
        <h4 className="card-title mb-1">Create Task</h4>
        <div className="text-muted mb-3">Assign task with deadline</div>
        {error && <Alert variant="danger">{error}</Alert>}
        {message && <Alert variant="success">{message}</Alert>}
        {loading ? (
          <div className="py-3">
            <Spinner className="spinner-border-sm me-2" tag="span" />
            <span className="text-muted">Loading users...</span>
          </div>
        ) : (
          <Form onSubmit={createTask}>
            <Form.Group className="mb-3">
              <Form.Label>Task Detail</Form.Label>
              <Form.Control
                as="textarea"
                rows={5}
                required
                value={form.title}
                onChange={(event) => setForm({ ...form, title: event.target.value })}
                placeholder="Enter task detail"
              />
            </Form.Group>
            <Form.Group className="mb-3">
              <Form.Label>Assign To</Form.Label>
              <Form.Select required value={form.assignedTo} onChange={(event) => setForm({ ...form, assignedTo: event.target.value })}>
                <option value="">Select salesperson</option>
                {users.map((user) => (
                  <option key={user._id} value={user._id}>
                    {user.name}
                  </option>
                ))}
              </Form.Select>
            </Form.Group>
            <Form.Group className="mb-3">
              <Form.Label>Deadline</Form.Label>
              <Form.Control required type="date" value={form.dueDate} onChange={(event) => setForm({ ...form, dueDate: event.target.value })} />
            </Form.Group>
            <Button type="submit" disabled={saving}>
              {saving ? 'Creating...' : 'Create Task'}
            </Button>
          </Form>
        )}
      </CardBody>
    </Card>
  )
}

export default TaskCreateCard
