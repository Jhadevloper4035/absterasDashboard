import { useEffect, useState } from 'react'
import { Alert, Badge, Card, CardBody, Col, Row, Table } from 'react-bootstrap'
import { Link } from 'react-router-dom'

import PageMetaData from '@/components/PageTitle'
import Spinner from '@/components/Spinner'
import IconifyIcon from '@/components/wrappers/IconifyIcon'
import { apiFetch } from '@/helpers/api'
import { canAccessModule } from '@/helpers/moduleAccess'
import { useAuthStore } from '@/store/authStore'

type EmployeeOverview = {
  attendance: { summary: Record<string, number> }
  leaves: { _id: string; leaveType?: { name?: string }; days: number; status: string }[]
}

type Todo = { _id: string; title: string; dueDate?: string; priority?: string; status: string }
type Task = Todo
type Attendance = { _id: string; date: string; status: string; checkIn?: string; checkOut?: string; correctionRequest?: { status: string } }
type LeaveRequest = { _id: string; leaveType?: { name?: string }; fromDate: string; toDate: string; days: number; status: string }

const currentMonth = () => new Date().toISOString().slice(0, 7)
const dateText = (value?: string) => value ? new Intl.DateTimeFormat(undefined, { day: 'numeric', month: 'short', year: 'numeric' }).format(new Date(value)) : 'No deadline'
const statusVariant = (status: string) => ['completed', 'done', 'approved', 'present'].includes(status.toLowerCase()) ? 'success' : ['rejected', 'absent', 'blocked'].includes(status.toLowerCase()) ? 'danger' : ['pending', 'late', 'in progress', 'review'].includes(status.toLowerCase()) ? 'warning' : 'primary'
const priorityVariant = (priority?: string) => priority === 'Critical' || priority === 'High' ? 'danger' : priority === 'Medium' ? 'warning' : 'secondary'

const MyDashboardPage = () => {
  const user = useAuthStore((state) => state.user)
  const canViewTodos = canAccessModule(user, 'todo')
  const canViewTasks = canAccessModule(user, 'tasks')
  const [overview, setOverview] = useState<EmployeeOverview>()
  const [todos, setTodos] = useState<Todo[]>([])
  const [tasks, setTasks] = useState<Task[]>([])
  const [attendanceRecords, setAttendanceRecords] = useState<Attendance[]>([])
  const [leaveRequests, setLeaveRequests] = useState<LeaveRequest[]>([])
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    let active = true
    setLoading(true)
    setError('')
    Promise.all([
      apiFetch<{ data: EmployeeOverview }>(`/hr/employee-overview?month=${currentMonth()}`),
      canViewTodos ? apiFetch<{ data: Todo[] }>('/todos?limit=5') : Promise.resolve({ data: [] }),
      canViewTasks ? apiFetch<{ data: Task[] }>('/tasks?assignedToMe=true&limit=6') : Promise.resolve({ data: [] }),
      apiFetch<{ data: Attendance[] }>('/hr/attendance?limit=5'),
      apiFetch<{ data: LeaveRequest[] }>('/hr/leave/requests?status=pending'),
    ]).then(([employee, todoList, taskList, attendanceList, leaveList]) => {
      if (!active) return
      setOverview(employee.data)
      setTodos(todoList.data)
      setTasks(taskList.data)
      setAttendanceRecords(attendanceList.data)
      setLeaveRequests(leaveList.data)
    }).catch((reason) => {
      if (active) setError(reason instanceof Error ? reason.message : 'Unable to load your dashboard')
    }).finally(() => {
      if (active) setLoading(false)
    })
    return () => { active = false }
  }, [canViewTasks, canViewTodos])

  const attendance = overview?.attendance.summary || {}
  const pendingLeaves = overview?.leaves.filter((leave) => leave.status === 'pending').length || 0
  const cards = [
    { label: 'Present days', value: attendance.present || 0, icon: 'iconamoon:check-circle-1-duotone', color: 'success' },
    { label: 'Late arrivals', value: attendance.late || 0, icon: 'iconamoon:clock-duotone', color: 'warning' },
    { label: 'Leave requests', value: overview?.leaves.length || 0, icon: 'iconamoon:calendar-1-duotone', color: 'primary' },
    { label: 'Pending leave', value: pendingLeaves, icon: 'iconamoon:time-duotone', color: 'info' },
  ]
  const selfService = [
    { label: 'My profile', description: 'Personal details and employment documents.', href: '/hr/my-profile' },
    { label: 'My attendance', description: 'Attendance records and correction requests.', href: '/hr/my-attendance' },
    { label: 'Leave requests', description: 'Apply for leave and follow approval status.', href: '/hr/my-leave' },
    { label: 'Salary slips', description: 'View and download your payslips.', href: '/hr/my-payslips' },
  ]

  return <>
    <PageMetaData title="My Dashboard" />
    <Card className="border-0 bg-body-tertiary mb-4">
      <CardBody className="p-4 p-lg-5">
        <Row className="align-items-center g-3">
          <Col lg={8}>
            <div className="text-primary text-uppercase fw-semibold fs-13 mb-2">Employee dashboard</div>
            <h2 className="mb-2">Welcome back, {user?.name || 'there'}.</h2>
            <p className="text-muted mb-0">Your attendance, leave, payroll self-service, and assigned tasks in one place.</p>
          </Col>
        </Row>
      </CardBody>
    </Card>

    {error && <Alert variant="danger">{error}</Alert>}
    <Row className="g-3 mb-4">
      {cards.map((card) => <Col sm={6} xl={3} key={card.label}>
        <Card className="h-100 border-start border-3" style={{ borderLeftColor: `var(--bs-${card.color})` }}>
          <CardBody className="p-3 p-lg-4">
            <div className="d-flex align-items-start justify-content-between gap-2">
              <div><div className="text-muted fs-13">{card.label}</div><h2 className={`mb-0 mt-1 text-${card.color}`}>{loading ? '—' : card.value}</h2></div>
              <IconifyIcon icon={card.icon} className={`fs-3 text-${card.color}`} aria-hidden="true" />
            </div>
          </CardBody>
        </Card>
      </Col>)}
    </Row>

    <Card className="mb-4">
      <CardBody className="p-4">
        <div className="mb-3"><div className="text-primary text-uppercase fw-semibold fs-13 mb-1">Employee self-service</div><h4 className="card-title mb-1">My work profile</h4><p className="text-muted mb-0">Review and manage your own employment information.</p></div>
        <Table responsive hover className="align-middle mb-0">
          <thead><tr><th>Service</th><th>What you can do</th><th className="text-end">Action</th></tr></thead>
          <tbody>{selfService.map((service) => <tr key={service.href}><td className="fw-semibold">{service.label}</td><td className="text-muted">{service.description}</td><td className="text-end"><Link to={service.href} className="btn btn-sm btn-outline-primary">View</Link></td></tr>)}</tbody>
        </Table>
      </CardBody>
    </Card>

    {loading ? <div className="text-center py-4"><Spinner className="spinner-border-sm me-2" tag="span" /><span className="text-muted">Loading dashboard tables...</span></div> : <Row className="g-4">
      {canViewTodos && <Col xl={6}><Card className="h-100"><CardBody className="p-4"><div className="d-flex justify-content-between gap-3 mb-3"><div><h4 className="card-title mb-1">My todos</h4><p className="text-muted mb-0">Personal work and due dates.</p></div><Link to="/apps/todo" className="btn btn-sm btn-outline-primary text-nowrap">View all</Link></div><Table responsive hover className="align-middle mb-0"><thead><tr><th>Todo</th><th>Due date</th><th>Priority</th><th>Status</th></tr></thead><tbody>{todos.map((todo) => <tr key={todo._id}><td className="fw-semibold">{todo.title}</td><td>{dateText(todo.dueDate)}</td><td><Badge bg={priorityVariant(todo.priority)} text={priorityVariant(todo.priority) === 'warning' ? 'dark' : undefined}>{todo.priority || 'Normal'}</Badge></td><td><Badge bg={statusVariant(todo.status)} text={statusVariant(todo.status) === 'warning' ? 'dark' : undefined}>{todo.status}</Badge></td></tr>)}{!todos.length && <tr><td colSpan={4} className="text-center text-muted py-4">No todos assigned to you.</td></tr>}</tbody></Table></CardBody></Card></Col>}
      {canViewTasks && <Col xl={6}><Card className="h-100"><CardBody className="p-4"><div className="d-flex justify-content-between gap-3 mb-3"><div><div className="text-primary text-uppercase fw-semibold fs-13 mb-1">Task Management</div><h4 className="card-title mb-1">New tasks</h4><p className="text-muted mb-0">Tasks assigned to you, ordered by due date.</p></div><Link to="/tasks/assigned-to-me" className="btn btn-sm btn-outline-primary text-nowrap">View all</Link></div><Table responsive hover className="align-middle mb-0"><thead><tr><th>Task</th><th>Due date</th><th>Priority</th><th>Status</th></tr></thead><tbody>{tasks.map((task) => <tr key={task._id}><td className="fw-semibold"><Link to={`/tasks/${task._id}`} className="text-reset">{task.title}</Link></td><td>{dateText(task.dueDate)}</td><td><Badge bg={priorityVariant(task.priority)} text={priorityVariant(task.priority) === 'warning' ? 'dark' : undefined}>{task.priority || 'Normal'}</Badge></td><td><Badge bg={statusVariant(task.status)} text={statusVariant(task.status) === 'warning' ? 'dark' : undefined}>{task.status}</Badge></td></tr>)}{!tasks.length && <tr><td colSpan={4} className="text-center text-muted py-4">No tasks are assigned to you.</td></tr>}</tbody></Table></CardBody></Card></Col>}
      <Col xl={6}><Card className="h-100"><CardBody className="p-4"><div className="d-flex justify-content-between gap-3 mb-3"><div><h4 className="card-title mb-1">Recent attendance</h4><p className="text-muted mb-0">Your latest attendance records and corrections.</p></div><Link to="/hr/my-attendance" className="btn btn-sm btn-outline-primary text-nowrap">View all</Link></div><Table responsive hover className="align-middle mb-0"><thead><tr><th>Date</th><th>Status</th><th>In</th><th>Out</th><th>Correction</th></tr></thead><tbody>{attendanceRecords.map((record) => <tr key={record._id}><td>{dateText(record.date)}</td><td><Badge bg={statusVariant(record.status)} text={statusVariant(record.status) === 'warning' ? 'dark' : undefined}>{record.status}</Badge></td><td>{record.checkIn || '—'}</td><td>{record.checkOut || '—'}</td><td>{record.correctionRequest ? <Badge bg={statusVariant(record.correctionRequest.status)} text={record.correctionRequest.status === 'pending' ? 'dark' : undefined}>{record.correctionRequest.status}</Badge> : '—'}</td></tr>)}{!attendanceRecords.length && <tr><td colSpan={5} className="text-center text-muted py-4">No attendance records yet.</td></tr>}</tbody></Table></CardBody></Card></Col>
      <Col xl={6}><Card className="h-100"><CardBody className="p-4"><div className="d-flex justify-content-between gap-3 mb-3"><div><h4 className="card-title mb-1">Pending leave requests</h4><p className="text-muted mb-0">Requests awaiting HR approval.</p></div><Link to="/hr/my-leave" className="btn btn-sm btn-outline-primary text-nowrap">View all</Link></div><Table responsive hover className="align-middle mb-0"><thead><tr><th>Leave type</th><th>From</th><th>To</th><th>Days</th><th>Status</th></tr></thead><tbody>{leaveRequests.map((request) => <tr key={request._id}><td className="fw-semibold">{request.leaveType?.name || 'Leave'}</td><td>{dateText(request.fromDate)}</td><td>{dateText(request.toDate)}</td><td>{request.days}</td><td><Badge bg="warning" text="dark">{request.status}</Badge></td></tr>)}{!leaveRequests.length && <tr><td colSpan={5} className="text-center text-muted py-4">No leave requests are waiting for approval.</td></tr>}</tbody></Table></CardBody></Card></Col>
    </Row>}
  </>
}

export default MyDashboardPage
