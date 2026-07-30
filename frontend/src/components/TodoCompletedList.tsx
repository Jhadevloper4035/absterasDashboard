import { useEffect, useState } from 'react'
import { Alert, Badge, Button, Card, CardBody, Col, Row, Table } from 'react-bootstrap'
import { Link } from 'react-router-dom'

import { apiFetch } from '@/helpers/api'
import Spinner from '@/components/Spinner'
import { useAuthStore } from '@/store/authStore'
import type { UserType } from '@/types/auth'

type TodoUser = Pick<UserType, '_id' | 'name' | 'email' | 'role' | 'status'>

type Todo = {
  _id: string
  title: string
  status: 'Pending' | 'In-Progress' | 'Completed'
  priority: 'Low' | 'Medium' | 'High'
  assignedTo?: string | TodoUser
  dueDate?: string
  completedAt?: string
}

const personName = (person?: string | TodoUser) => (typeof person === 'object' ? person.name : '')

const TodoCompletedList = () => {
  const token = useAuthStore((state) => state.token)
  const user = useAuthStore((state) => state.user)
  const [todos, setTodos] = useState<Todo[]>([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  const loadTodos = () => {
    if (!token) return
    setLoading(true)
    apiFetch<{ data: Todo[] }>('/todos', { token })
      .then((res) =>
        setTodos(
          [...res.data].sort((a, b) => {
            if (a.status === 'Completed' && b.status !== 'Completed') return 1
            if (a.status !== 'Completed' && b.status === 'Completed') return -1
            return new Date(a.dueDate || a.completedAt || 0).getTime() - new Date(b.dueDate || b.completedAt || 0).getTime()
          }),
        ),
      )
      .catch((e) => setError(e instanceof Error ? e.message : 'Unable to load tasks'))
      .finally(() => setLoading(false))
  }

  useEffect(() => {
    loadTodos()
    window.addEventListener('todos:changed', loadTodos)
    return () => window.removeEventListener('todos:changed', loadTodos)
  }, [token])

  const pendingCount = todos.filter((todo) => todo.status === 'Pending').length
  const inProgressCount = todos.filter((todo) => todo.status === 'In-Progress').length
  const completedCount = todos.filter((todo) => todo.status === 'Completed').length

  return (
    <Card>
      <CardBody>
        <div className="d-flex align-items-center justify-content-between mb-3">
          <div>
            <h4 className="card-title mb-1">Todo Tasks</h4>
            <div className="text-muted">Your assigned todos</div>
          </div>
          <div className="d-flex gap-2">
            <Badge bg="warning" text="dark">
              {pendingCount} pending
            </Badge>
            <Badge bg="success">{completedCount} done</Badge>
          </div>
        </div>
        {error && <Alert variant="danger">{error}</Alert>}
        {loading ? (
          <div className="text-center py-4">
            <Spinner className="spinner-border-sm me-2" tag="span" />
            <span className="text-muted">Loading tasks...</span>
          </div>
        ) : null}
        {!loading && (
          <Row className="g-2 mb-3">
            {[
              { label: 'Pending', value: pendingCount, bg: 'primary' },
              { label: 'In-Progress', value: inProgressCount, bg: 'warning' },
              { label: 'Completed', value: completedCount, bg: 'success' },
            ].map((item) => (
              <Col md={4} key={item.label}>
                <div className="border rounded p-3 h-100">
                  <div className="text-muted fs-13">{item.label}</div>
                  <div className="d-flex align-items-center justify-content-between mt-2">
                    <h4 className="mb-0">{item.value}</h4>
                    <Badge bg={item.bg} text={item.bg === 'warning' ? 'dark' : undefined}>
                      tasks
                    </Badge>
                  </div>
                </div>
              </Col>
            ))}
          </Row>
        )}
        {!todos.length && !error && !loading ? <Alert variant="info">No tasks yet</Alert> : null}
        {todos.length ? (
          <div className="table-responsive">
            <Table hover className="table-nowrap align-middle mb-0">
              <thead>
                <tr>
                  <th>Task</th>
                  <th>Assigned</th>
                  <th>Due Date</th>
                  <th>Status</th>
                  <th className="text-end">Action</th>
                </tr>
              </thead>
              <tbody>
                {todos.slice(0, 8).map((todo) => (
                  <tr key={todo._id}>
                    <td>{todo.title}</td>
                    <td>{personName(todo.assignedTo) || user?.name || '-'}</td>
                    <td>{todo.dueDate ? new Date(todo.dueDate).toLocaleDateString() : '-'}</td>
                    <td>
                      <Badge bg={todo.status === 'Completed' ? 'success' : todo.status === 'In-Progress' ? 'warning' : 'primary'}>{todo.status}</Badge>
                      {todo.completedAt && <span className="text-muted fs-13 ms-2">{new Date(todo.completedAt).toLocaleDateString()}</span>}
                    </td>
                    <td className="text-end">
                      <Link to="/apps/todo">
                        <Button size="sm" variant="outline-primary">
                          View
                        </Button>
                      </Link>
                    </td>
                  </tr>
                ))}
              </tbody>
            </Table>
          </div>
        ) : null}
      </CardBody>
    </Card>
  )
}

export default TodoCompletedList
