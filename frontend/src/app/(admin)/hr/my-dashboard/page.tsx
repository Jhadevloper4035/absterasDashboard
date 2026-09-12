import { useEffect, useMemo, useState } from 'react'
import { Badge, Card, CardBody, Col, Row, Table } from 'react-bootstrap'
import { Link } from 'react-router-dom'

import PageMetaData from '@/components/PageTitle'
import Spinner from '@/components/Spinner'
import IconifyIcon from '@/components/wrappers/IconifyIcon'
import { apiFetch } from '@/helpers/api'
import { moduleLabel, type AppModule } from '@/helpers/moduleAccess'
import { useAuthStore } from '@/store/authStore'

type AccessLevel = 'view' | 'manage'
type ApiList = { data?: unknown[]; meta?: { total?: number } }
type WorkspaceModule = { module: AppModule; href: string; endpoint: string; icon: string; recordLabel: string }
type ModuleSnapshot = WorkspaceModule & { access: AccessLevel; total: number | null; latest: string; error?: string }
type Todo = { _id: string; title: string; dueDate?: string; priority?: string }
type Task = { _id: string; title: string; dueDate?: string; priority?: string; status: string }
type Lead = { _id: string; name: string; company?: string; nextMeeting?: { startsAt?: string; meetingType?: string } }
type Invoice = { _id: string; invoiceNumber: string; invoiceDate?: string; createdAt?: string; grandTotal?: number; client?: { name?: string } }
type Holiday = { _id: string; name: string; date: string; type: string }
type DashboardSummary = { todayMeetings: Lead[]; priorityTasks: Task[] }
type DashboardActivity = { todos: Todo[]; summary?: DashboardSummary; upcomingLeads: Lead[]; overdueTasks: Task[]; invoices: Invoice[]; holidays: Holiday[] }
type WorkRow = { id: string; type: string; item: string; detail: string; when: string; status: string; variant: string; href?: string }

const workspaceModules: Record<AppModule, WorkspaceModule> = {
  todo: { module: 'todo', href: '/apps/todo', endpoint: '/todos?limit=5', icon: 'iconamoon:check-circle-1-duotone', recordLabel: 'to-dos' },
  notifications: { module: 'notifications', href: '/notifications', endpoint: '/notifications/unread', icon: 'iconamoon:notification-duotone', recordLabel: 'unread notifications' },
  leads: { module: 'leads', href: '/leads', endpoint: '/leads?limit=5', icon: 'iconamoon:send-duotone', recordLabel: 'leads' },
  tasks: { module: 'tasks', href: '/tasks/assigned-to-me', endpoint: '/tasks?limit=5', icon: 'iconamoon:calendar-1-duotone', recordLabel: 'tasks' },
  hr: { module: 'hr', href: '/hr', endpoint: '/hr/leave/requests', icon: 'iconamoon:profile-circle-duotone', recordLabel: 'leave requests' },
  clients: { module: 'clients', href: '/clients', endpoint: '/clients?limit=5', icon: 'iconamoon:profile-duotone', recordLabel: 'clients' },
  invoices: { module: 'invoices', href: '/invoices', endpoint: '/invoices?limit=5', icon: 'iconamoon:cheque-duotone', recordLabel: 'invoices' },
  challans: { module: 'challans', href: '/challans', endpoint: '/challans?limit=5', icon: 'iconamoon:box-duotone', recordLabel: 'challans' },
  inventory: { module: 'inventory', href: '/inventory', endpoint: '/inventory/items?limit=5', icon: 'iconamoon:box-duotone', recordLabel: 'items' },
  'laser-cut': { module: 'laser-cut', href: '/laser-cut-management', endpoint: '/laser-cut-management/orders', icon: 'bx:cut', recordLabel: 'orders' },
  'powder-coating': { module: 'powder-coating', href: '/powder-coating-management', endpoint: '/powder-coating-management/orders', icon: 'bx:palette', recordLabel: 'orders' },
  returns: { module: 'returns', href: '/returns', endpoint: '/returns?limit=5', icon: 'iconamoon:refresh-duotone', recordLabel: 'returns' },
  designer: { module: 'designer', href: '/designer/boq', endpoint: '/designer/boqs', icon: 'iconamoon:pen-duotone', recordLabel: 'BOQs' },
}

const recordName = (record?: unknown) => {
  if (!record || typeof record !== 'object') return 'No recent record'
  const item = record as Record<string, unknown>
  const value = ['name', 'title', 'orderName', 'invoiceNumber', 'challanNo', 'returnNumber', 'itemName']
    .map((key) => item[key])
    .find((entry) => typeof entry === 'string' && entry.trim())
  return typeof value === 'string' ? value : 'Recent record available'
}

const loadSnapshot = async (item: WorkspaceModule, access: AccessLevel): Promise<ModuleSnapshot> => {
  try {
    const response = await apiFetch<ApiList>(item.endpoint)
    const records = Array.isArray(response.data) ? response.data : []
    return { ...item, access, total: typeof response.meta?.total === 'number' ? response.meta.total : records.length, latest: recordName(records[0]) }
  } catch (error) {
    return { ...item, access, total: null, latest: 'Data could not be loaded', error: error instanceof Error ? error.message : 'Request failed' }
  }
}

const emptyActivity: DashboardActivity = { todos: [], upcomingLeads: [], overdueTasks: [], invoices: [], holidays: [] }
const dateOnly = (value: string | Date = new Date()) => new Date(value).toISOString().slice(0, 10)
const dateText = (value?: string) => value ? new Intl.DateTimeFormat(undefined, { day: 'numeric', month: 'short', year: 'numeric' }).format(new Date(value)) : 'No date'
const dateTimeText = (value?: string) => value ? new Intl.DateTimeFormat(undefined, { day: 'numeric', month: 'short', hour: 'numeric', minute: '2-digit' }).format(new Date(value)) : 'Not scheduled'
const currency = (value?: number) => new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR', maximumFractionDigits: 0 }).format(value || 0)

const loadActivity = async (modules: AppModule[]): Promise<DashboardActivity> => {
  const canAccess = (module: AppModule) => modules.includes(module)
  const requestList = <T,>(allowed: boolean, endpoint: string) => allowed ? apiFetch<{ data: T[] }>(endpoint).then((response) => response.data).catch(() => []) : Promise.resolve<T[]>([])
  const today = dateOnly()
  const [todos, summary, upcomingLeads, overdueTasks, invoices, holidays] = await Promise.all([
    requestList<Todo>(canAccess('todo'), `/todos?limit=5&fromDate=${today}&toDate=${today}`),
    canAccess('leads') || canAccess('tasks') ? apiFetch<{ data: DashboardSummary }>('/dashboard/summary').then((response) => response.data).catch(() => undefined) : Promise.resolve(undefined),
    requestList<Lead>(canAccess('leads'), '/leads?upcomingMeeting=true&limit=5'),
    requestList<Task>(canAccess('tasks'), '/tasks?deadline=exceeded&limit=5'),
    requestList<Invoice>(canAccess('invoices'), '/invoices?limit=5&sort=createdAt'),
    requestList<Holiday>(canAccess('hr'), '/hr/holidays'),
  ])
  return { todos, summary, upcomingLeads, overdueTasks, invoices, holidays: holidays.filter((holiday) => dateOnly(holiday.date) >= today).slice(0, 5) }
}

const ModuleTable = ({ title, description, href, emptyText, rows }: { title: string; description: string; href: string; emptyText: string; rows: WorkRow[] }) => <Card className="h-100"><CardBody className="p-4"><div className="d-flex align-items-start justify-content-between gap-3 flex-wrap mb-3"><div><h4 className="card-title mb-1">{title}</h4><p className="text-muted mb-0">{description}</p></div><Link to={href} className="btn btn-sm btn-outline-primary text-nowrap">View all</Link></div>{!rows.length ? <div className="text-muted text-center py-4">{emptyText}</div> : <Table responsive hover className="align-middle mb-0"><thead><tr><th>Item</th><th>Details</th><th>When</th><th>Status</th><th className="text-end">Open</th></tr></thead><tbody>{rows.map((row) => <tr key={row.id}><td className="fw-semibold">{row.item}</td><td className="text-muted">{row.detail}</td><td>{row.when}</td><td><Badge bg={row.variant} text={row.variant === 'warning' || row.variant === 'info' ? 'dark' : undefined}>{row.status}</Badge></td><td className="text-end">{row.href ? <Link to={row.href} className="btn btn-sm btn-outline-primary">Open</Link> : <span className="text-muted">—</span>}</td></tr>)}</tbody></Table>}</CardBody></Card>

const MyDashboardPage = () => {
  const token = useAuthStore((state) => state.token)
  const user = useAuthStore((state) => state.user)
  const [snapshots, setSnapshots] = useState<ModuleSnapshot[]>([])
  const [activity, setActivity] = useState<DashboardActivity>(emptyActivity)
  const [loading, setLoading] = useState(true)
  const access = useMemo(() => (user?.modulePermissions || [])
    .filter((permission): permission is { module: AppModule; access: AccessLevel } => permission.access === 'view' || permission.access === 'manage')
    .map((permission) => ({ ...workspaceModules[permission.module], access: permission.access })), [user?.modulePermissions])
  const accessKey = access.map((item) => `${item.module}:${item.access}`).join('|')

  useEffect(() => {
    let active = true
    if (!token || !access.length) {
      setSnapshots([])
      setActivity(emptyActivity)
      setLoading(false)
      return () => { active = false }
    }
    setLoading(true)
    Promise.all([
      Promise.all(access.map((item) => loadSnapshot(item, item.access))),
      loadActivity(access.map((item) => item.module)),
    ]).then(([snapshotData, activityData]) => {
      if (!active) return
      setSnapshots(snapshotData)
      setActivity(activityData)
    }).finally(() => {
      if (active) setLoading(false)
    })
    return () => { active = false }
  }, [token, accessKey])

  const hasAccess = (module: AppModule) => access.some((item) => item.module === module)
  const visibleSnapshots = snapshots.filter((item) => item.module !== 'notifications' && hasAccess(item.module))
  const moduleTotal = (module: AppModule) => snapshots.find((item) => item.module === module)?.total ?? 0
  const focusModules: AppModule[] = ['todo', 'leads', 'tasks', 'hr', 'clients', 'invoices']
  const countCards = [
    hasAccess('todo') && { label: 'Due today', value: activity.todos.length, note: 'Todo items scheduled for today', color: 'primary', icon: 'iconamoon:check-circle-1-duotone' },
    hasAccess('leads') && { label: 'Meetings today', value: activity.summary?.todayMeetings.length || 0, note: 'Lead meetings on today’s calendar', color: 'info', icon: 'iconamoon:calendar-1-duotone' },
    hasAccess('tasks') && { label: 'Pending tasks', value: activity.summary?.priorityTasks.length || 0, note: 'Open work requiring attention', color: 'warning', icon: 'iconamoon:clock-duotone' },
    hasAccess('tasks') && { label: 'Past deadline', value: activity.overdueTasks.length, note: 'Open tasks that are overdue', color: 'danger', icon: 'iconamoon:danger-triangle-duotone' },
    hasAccess('clients') && { label: 'Total clients', value: moduleTotal('clients'), note: 'Client records you can access', color: 'success', icon: 'iconamoon:profile-duotone' },
    hasAccess('invoices') && { label: 'Recent invoices', value: activity.invoices.length, note: 'Newest invoices', color: 'secondary', icon: 'iconamoon:receipt-duotone' },
    hasAccess('hr') && { label: 'Upcoming holidays', value: activity.holidays.length, note: 'The next holidays on the calendar', color: 'info', icon: 'iconamoon:calendar-duotone' },
    ...snapshots.filter((item) => !focusModules.includes(item.module)).map((item) => ({ label: moduleLabel(item.module), value: item.total ?? '—', note: item.recordLabel, color: 'primary', icon: item.icon })),
  ].filter(Boolean) as { label: string; value: string | number; note: string; color: string; icon: string }[]
  const workRows: WorkRow[] = [
    ...activity.todos.map((todo) => ({ id: `todo-${todo._id}`, type: 'Today’s todo', item: todo.title, detail: `${todo.priority || 'Medium'} priority`, when: dateText(todo.dueDate), status: 'Due today', variant: 'primary', href: '/apps/todo' })),
    ...(activity.summary?.todayMeetings || []).map((lead) => ({ id: `meeting-${lead._id}`, type: 'Today’s meeting', item: lead.name, detail: lead.nextMeeting?.meetingType || 'Lead meeting', when: dateTimeText(lead.nextMeeting?.startsAt), status: 'Today', variant: 'info', href: `/leads/${lead._id}` })),
    ...(activity.summary?.priorityTasks || []).map((task) => ({ id: `task-${task._id}`, type: 'Pending task', item: task.title, detail: `${task.priority || 'Medium'} priority`, when: dateText(task.dueDate), status: task.status, variant: 'warning', href: `/tasks/${task._id}` })),
    ...activity.overdueTasks.map((task) => ({ id: `overdue-${task._id}`, type: 'Past deadline', item: task.title, detail: `${task.priority || 'Medium'} priority`, when: dateText(task.dueDate), status: 'Overdue', variant: 'danger', href: `/tasks/${task._id}` })),
    ...activity.upcomingLeads.map((lead) => ({ id: `upcoming-${lead._id}`, type: 'Upcoming meeting', item: lead.name, detail: lead.company || lead.nextMeeting?.meetingType || 'Lead meeting', when: dateTimeText(lead.nextMeeting?.startsAt), status: 'Scheduled', variant: 'info', href: `/leads/${lead._id}` })),
    ...activity.invoices.map((invoice) => ({ id: `invoice-${invoice._id}`, type: 'Recent invoice', item: invoice.invoiceNumber, detail: `${invoice.client?.name || 'Client'} · ${currency(invoice.grandTotal)}`, when: dateText(invoice.createdAt), status: 'Created', variant: 'secondary', href: `/invoices/${invoice._id}` })),
    ...activity.holidays.map((holiday) => ({ id: `holiday-${holiday._id}`, type: 'Upcoming holiday', item: holiday.name, detail: holiday.type, when: dateText(holiday.date), status: 'Holiday', variant: 'info' })),
  ]

  return <>
    <PageMetaData title="My Dashboard" />
    <Card className="border-0 bg-body-tertiary mb-4"><CardBody className="p-4 p-lg-5"><Row className="align-items-center g-3"><Col lg={8}><div className="text-primary text-uppercase fw-semibold fs-13 mb-2">My dashboard</div><h2 className="mb-2">Welcome back, {user?.name || 'there'}.</h2><p className="text-muted mb-0">A live view of the records available through your assigned access.</p></Col><Col lg={4} className="text-lg-end"><Badge bg="primary" className="fs-6">{access.length} active modules</Badge></Col></Row></CardBody></Card>

    {!access.length ? <Card><CardBody className="py-5 text-center text-muted">No business modules are assigned yet.</CardBody></Card> : <>
      <Row className="g-3 mb-4">{countCards.map((item) => <Col sm={6} xl={3} key={item.label}><Card className="h-100 border-start border-3" style={{ borderLeftColor: `var(--bs-${item.color})` }}><CardBody className="p-3 p-lg-4"><div className="d-flex justify-content-between align-items-start gap-2"><div><div className="text-muted fs-13">{item.label}</div><h2 className={`mb-1 mt-1 text-${item.color}`}>{loading ? '—' : item.value}</h2><div className="text-muted fs-13">{item.note}</div></div><IconifyIcon icon={item.icon} className={`fs-3 text-${item.color}`} aria-hidden="true" /></div></CardBody></Card></Col>)}</Row>

      {loading ? <div className="text-center py-5"><Spinner className="spinner-border-sm me-2" tag="span" /><span className="text-muted">Loading your dashboard...</span></div> : <>
        <Card className="mb-4"><CardBody className="p-4"><div className="d-flex align-items-start justify-content-between gap-3 flex-wrap mb-3"><div><div className="text-primary text-uppercase fw-semibold fs-13 mb-1">Available tools</div><h4 className="card-title mb-1">Your accessible modules</h4><p className="text-muted mb-0">Open a module, see its current record count, and review its latest item.</p></div><Badge bg="light" text="dark">{visibleSnapshots.length} available</Badge></div><Table responsive hover className="align-middle mb-0"><thead><tr><th>Module</th><th>Records</th><th>Latest record</th><th>Access</th><th className="text-end">Open</th></tr></thead><tbody>{visibleSnapshots.map((item) => <tr key={item.module}><td><div className="d-flex align-items-center gap-2"><span className="d-inline-flex align-items-center justify-content-center rounded bg-primary-subtle text-primary p-2"><IconifyIcon icon={item.icon} className="fs-5" aria-hidden="true" /></span><span className="fw-semibold">{moduleLabel(item.module)}</span></div></td><td>{item.total === null ? <span className="text-danger">Unavailable</span> : <><span className="fw-semibold">{item.total}</span> <span className="text-muted fs-13">{item.recordLabel}</span></>}</td><td className="text-muted">{item.latest}{item.error ? <div className="fs-13 text-danger">{item.error}</div> : null}</td><td><Badge bg={item.access === 'manage' ? 'success' : 'info'} text={item.access === 'view' ? 'dark' : undefined}>{item.access}</Badge></td><td className="text-end"><Link to={item.href} className="btn btn-sm btn-outline-primary">Open</Link></td></tr>)}</tbody></Table></CardBody></Card>

        <Row className="g-4">
          {hasAccess('todo') && <Col xl={6}><ModuleTable title="Today’s todos" description="Todo items due today." href="/apps/todo" emptyText="No todos are due today." rows={workRows.filter((row) => row.type === 'Today’s todo')} /></Col>}
          {hasAccess('leads') && <Col xl={6}><ModuleTable title="Today’s lead meetings" description="Meetings scheduled for today." href="/leads/scheduled" emptyText="No meetings are scheduled today." rows={workRows.filter((row) => row.type === 'Today’s meeting')} /></Col>}
          {hasAccess('tasks') && <Col xl={6}><ModuleTable title="Pending tasks" description="Open tasks that need attention." href="/tasks/assigned-to-me" emptyText="No pending tasks." rows={workRows.filter((row) => row.type === 'Pending task')} /></Col>}
          {hasAccess('tasks') && <Col xl={6}><ModuleTable title="Tasks past deadline" description="Open tasks whose due date has passed." href="/tasks/assigned-to-me" emptyText="No tasks have crossed their deadline." rows={workRows.filter((row) => row.type === 'Past deadline')} /></Col>}
          {hasAccess('leads') && <Col xl={6}><ModuleTable title="Upcoming lead meetings" description="Your next lead conversations." href="/leads/scheduled" emptyText="No upcoming lead meetings." rows={workRows.filter((row) => row.type === 'Upcoming meeting')} /></Col>}
          {hasAccess('hr') && <Col xl={6}><ModuleTable title="Upcoming holidays" description="Company holidays scheduled ahead." href="/hr/upcoming-holidays" emptyText="No upcoming holidays have been scheduled." rows={workRows.filter((row) => row.type === 'Upcoming holiday')} /></Col>}
        </Row>
      </>}
    </>}
  </>
}

export default MyDashboardPage
