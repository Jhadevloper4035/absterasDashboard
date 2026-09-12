import { lazy } from 'react'
import { Navigate, type RouteProps } from 'react-router-dom'
import type { UserType } from '@/types/auth'

// Dashboard Routes
const Analytics = lazy(() => import('@/app/(admin)/dashboard/analytics/page'))
const Users = lazy(() => import('@/app/(admin)/users/page'))
const CreateUser = lazy(() => import('@/app/(admin)/users/create/page'))
const EditUser = lazy(() => import('@/app/(admin)/users/[userId]/edit/page'))
const LoginHistory = lazy(() => import('@/app/(admin)/users/login-history/page'))
const PasswordReset = lazy(() => import('@/app/(admin)/users/password-reset/page'))
const PasswordApprovals = lazy(() => import('@/app/(admin)/users/password-approvals/page'))
const HealthStatus = lazy(() => import('@/app/(admin)/health/status/page'))
const Employees = lazy(() => import('@/app/(admin)/hr/employees/page'))
const EmployeeDetail = lazy(() => import('@/app/(admin)/hr/employees/[employeeId]/page'))
const EmployeeOverview = lazy(() => import('@/app/(admin)/hr/employee-overview/page'))
const MyEmployeeProfile = lazy(() => import('@/app/(admin)/hr/my-profile/page'))
const MyDashboard = lazy(() => import('@/app/(admin)/hr/my-dashboard/page'))
const MyAttendance = lazy(() => import('@/app/(admin)/hr/my-attendance/page'))
const MyIdCard = lazy(() => import('@/app/(admin)/hr/my-id-card/page'))
const MyPayslips = lazy(() => import('@/app/(admin)/hr/my-payslips/page'))
const UpcomingHolidays = lazy(() => import('@/app/(admin)/hr/upcoming-holidays/page'))
const HrOrganization = lazy(() => import('@/app/(admin)/hr/settings/organization/page'))
const Attendance = lazy(() => import('@/app/(admin)/hr/attendance/page'))
const Leave = lazy(() => import('@/app/(admin)/hr/leave/page'))
const Payroll = lazy(() => import('@/app/(admin)/hr/payroll/page'))
const PayrollDetail = lazy(() => import('@/app/(admin)/hr/payroll/[runId]/page'))
const Advances = lazy(() => import('@/app/(admin)/hr/payroll/advances/page'))
const MyAdvances = lazy(() => import('@/app/(admin)/hr/advances/page'))
const Settlements = lazy(() => import('@/app/(admin)/hr/payroll/settlements/page'))
const Expenses = lazy(() => import('@/app/(admin)/hr/expenses/page'))
const ExpenseApprovals = lazy(() => import('@/app/(admin)/hr/expenses/approvals/page'))
const MyLeads = lazy(() => import('@/app/(admin)/leads/mine/page'))
const MyArchitects = lazy(() => import('@/app/(admin)/leads/my-architects/page'))
const CreateLead = lazy(() => import('@/app/(admin)/leads/create/page'))
const SalesCreateLead = lazy(() => import('@/app/(admin)/leads/sales-create/page'))
const ClientManagement = lazy(() => import('@/app/(admin)/clients/page'))
const CreateClient = lazy(() => import('@/app/(admin)/clients/create/page'))
const ClientOverview = lazy(() => import('@/app/(admin)/clients/[clientId]/page'))
const CreateInvoice = lazy(() => import('@/app/(admin)/invoices/create/page'))
const Challans = lazy(() => import('@/app/(admin)/challans/page'))
const CreateChallan = lazy(() => import('@/app/(admin)/challans/create/page'))
const ChallanDetail = lazy(() => import('@/app/(admin)/challans/[challanId]/page'))
const ScheduledLeads = lazy(() => import('@/app/(admin)/leads/scheduled/page'))
const ClosedLeads = lazy(() => import('@/app/(admin)/leads/won/page'))
const LeadDetail = lazy(() => import('@/app/(admin)/leads/[leadId]/page'))
const CreateTask = lazy(() => import('@/app/(admin)/tasks/create/page'))
const TaskDetail = lazy(() => import('@/app/(admin)/tasks/[taskId]/page'))
const UpdateTask = lazy(() => import('@/app/(admin)/tasks/[taskId]/edit/page'))

// Apps Routes
const EcommerceProducts = lazy(() => import('@/app/(admin)/ecommerce/products/page'))
const EcommerceProductDetails = lazy(() => import('@/app/(admin)/ecommerce/products/[productId]/page'))
const EcommerceProductCreate = lazy(() => import('@/app/(admin)/ecommerce/products/create/page'))
const EcommerceCustomers = lazy(() => import('@/app/(admin)/ecommerce/customers/page'))
const EcommerceSellers = lazy(() => import('@/app/(admin)/ecommerce/sellers/page'))
const EcommerceOrders = lazy(() => import('@/app/(admin)/ecommerce/orders/page'))
const EcommerceOrderDetails = lazy(() => import('@/app/(admin)/ecommerce/orders/[orderId]/page'))
const EcommerceInventory = lazy(() => import('@/app/(admin)/ecommerce/inventory/page'))
const Inventory = lazy(() => import('@/app/(admin)/inventory/page'))
const AddInventoryItem = lazy(() => import('@/app/(admin)/inventory/add/page'))
const InventorySuppliers = lazy(() => import('@/app/(admin)/inventory/suppliers/page'))
const InventoryMaterialDetail = lazy(() => import('@/app/(admin)/inventory/[itemId]/page'))
const InventoryPurchases = lazy(() => import('@/app/(admin)/inventory/purchases/page'))
const Returns = lazy(() => import('@/app/(admin)/returns/page'))
const CreateReturn = lazy(() => import('@/app/(admin)/returns/create/page'))
const CreateReturnTransfer = lazy(() => import('@/app/(admin)/returns/transfers/create/page'))
const LaserCutDashboard = lazy(() => import('@/app/(admin)/laser-cut-management/dashboard/page'))
const LaserCutCurrentOrders = lazy(() => import('@/app/(admin)/laser-cut-management/orders/page'))
const LaserCutOrderDetail = lazy(() => import('@/app/(admin)/laser-cut-management/orders/[orderId]/page'))
const CreateLaserCutChallan = lazy(() => import('@/app/(admin)/laser-cut-management/challans/create/page'))
const LaserCutMoveOut = lazy(() => import('@/app/(admin)/laser-cut-management/move-out/page'))
const LaserCutVendors = lazy(() => import('@/app/(admin)/laser-cut-management/vendors/page'))
const PowderCoatingManagement = lazy(() => import('@/app/(admin)/powder-coating-management/page'))
const PowderCoatingOrders = lazy(() => import('@/app/(admin)/powder-coating-management/orders/page'))
const PowderCoatingOrderDetail = lazy(() => import('@/app/(admin)/powder-coating-management/orders/[orderId]/detail/page'))
const PowderCoatingOrderDispatch = lazy(() => import('@/app/(admin)/powder-coating-management/orders/[orderId]/page'))
const CreatePowderCoatingOrder = lazy(() => import('@/app/(admin)/powder-coating-management/challans/create/page'))
const PowderCoatingMoveOut = lazy(() => import('@/app/(admin)/powder-coating-management/move-out/page'))
const PowderCoatingVendors = lazy(() => import('@/app/(admin)/powder-coating-management/vendors/page'))
const Boq = lazy(() => import('@/app/(admin)/designer/boq/page'))
const BoqApprovals = lazy(() => import('@/app/(admin)/designer/approvals/page'))
const BoqDetail = lazy(() => import('@/app/(admin)/designer/boq/[boqId]/page'))
const Drawings = lazy(() => import('@/app/(admin)/designer/drawings/page'))
const DrawingApprovals = lazy(() => import('@/app/(admin)/designer/drawings/approvals/page'))
const DrawingDetail = lazy(() => import('@/app/(admin)/designer/drawings/[boqId]/page'))
const SiteMeasurements = lazy(() => import('@/app/(admin)/designer/site-measurements/page'))
const ProductionData = lazy(() => import('@/app/(admin)/designer/production-data/page'))
const Chat = lazy(() => import('@/app/(admin)/apps/chat/page'))
const Email = lazy(() => import('@/app/(admin)/apps/email/page'))
const Schedule = lazy(() => import('@/app/(admin)/calendar/schedule/page'))
const Integration = lazy(() => import('@/app/(admin)/calendar/integration/page'))
const Help = lazy(() => import('@/app/(admin)/calendar/help/page'))
const Social = lazy(() => import('@/app/(admin)/apps/social/page'))
const Contacts = lazy(() => import('@/app/(admin)/apps/contacts/page'))
const Invoices = lazy(() => import('@/app/(admin)/invoices/page'))
const InvoiceDetails = lazy(() => import('@/app/(admin)/invoices/[invoiceId]/page'))
const Todo = lazy(() => import('@/app/(admin)/apps/todo/page'))
const NotificationsPage = lazy(() => import('@/app/(admin)/notifications/page'))

// Pages Routes
const Welcome = lazy(() => import('@/app/(admin)/pages/welcome/page'))
const FAQs = lazy(() => import('@/app/(admin)/pages/faqs/page'))
const Profile = lazy(() => import('@/app/(admin)/pages/profile/page'))
const ComingSoon = lazy(() => import('@/app/(other)/coming-soon/page'))
const ContactUs = lazy(() => import('@/app/(admin)/pages/contact-us/page'))
const AboutUs = lazy(() => import('@/app/(admin)/pages/about-us/page'))
const OurTeam = lazy(() => import('@/app/(admin)/pages/our-team/page'))
const TimelinePage = lazy(() => import('@/app/(admin)/pages/timeline/page'))
const Pricing = lazy(() => import('@/app/(admin)/pages/pricing/page'))
const Maintenance = lazy(() => import('@/app/(other)/maintenance/page'))
const Widgets = lazy(() => import('@/app/(admin)/widgets/page'))
const AccessDenied = lazy(() => import('@/app/(admin)/access-denied'))

// Base UI Routes
const Accordions = lazy(() => import('@/app/(admin)/ui/accordions/page'))
const Alerts = lazy(() => import('@/app/(admin)/ui/alerts/page'))
const Avatars = lazy(() => import('@/app/(admin)/ui/avatars/page'))
const Badges = lazy(() => import('@/app/(admin)/ui/badges/page'))
const Breadcrumb = lazy(() => import('@/app/(admin)/ui/breadcrumb/page'))
const Buttons = lazy(() => import('@/app/(admin)/ui/buttons/page'))
const Cards = lazy(() => import('@/app/(admin)/ui/cards/page'))
const Carousel = lazy(() => import('@/app/(admin)/ui/carousel/page'))
const Collapse = lazy(() => import('@/app/(admin)/ui/collapse/page'))
const Dropdowns = lazy(() => import('@/app/(admin)/ui/dropdowns/page'))
const ListGroup = lazy(() => import('@/app/(admin)/ui/list-group/page'))
const Modals = lazy(() => import('@/app/(admin)/ui/modals/page'))
const Tabs = lazy(() => import('@/app/(admin)/ui/tabs/page'))
const Offcanvas = lazy(() => import('@/app/(admin)/ui/offcanvas/page'))
const Pagination = lazy(() => import('@/app/(admin)/ui/pagination/page'))
const Placeholders = lazy(() => import('@/app/(admin)/ui/placeholders/page'))
const Popovers = lazy(() => import('@/app/(admin)/ui/popovers/page'))
const Progress = lazy(() => import('@/app/(admin)/ui/progress/page'))
const Spinners = lazy(() => import('@/app/(admin)/ui/spinners/page'))
const Toasts = lazy(() => import('@/app/(admin)/ui/toasts/page'))
const Tooltips = lazy(() => import('@/app/(admin)/ui/tooltips/page'))

// Advanced UI Routes
const Ratings = lazy(() => import('@/app/(admin)/advanced/ratings/page'))
const SweetAlerts = lazy(() => import('@/app/(admin)/advanced/alert/page'))
const Swiper = lazy(() => import('@/app/(admin)/advanced/swiper/page'))
const Scrollbar = lazy(() => import('@/app/(admin)/advanced/scrollbar/page'))
const Toastify = lazy(() => import('@/app/(admin)/advanced/toastify/page'))

// Charts and Maps Routes
const Area = lazy(() => import('@/app/(admin)/charts/area/page'))
const Bar = lazy(() => import('@/app/(admin)/charts/bar/page'))
const Bubble = lazy(() => import('@/app/(admin)/charts/bubble/page'))
const Candlestick = lazy(() => import('@/app/(admin)/charts/candlestick/page'))
const Column = lazy(() => import('@/app/(admin)/charts/column/page'))
const Heatmap = lazy(() => import('@/app/(admin)/charts/heatmap/page'))
const Line = lazy(() => import('@/app/(admin)/charts/line/page'))
const Mixed = lazy(() => import('@/app/(admin)/charts/mixed/page'))
const Timeline = lazy(() => import('@/app/(admin)/charts/timeline/page'))
const Boxplot = lazy(() => import('@/app/(admin)/charts/boxplot/page'))
const Treemap = lazy(() => import('@/app/(admin)/charts/treemap/page'))
const Pie = lazy(() => import('@/app/(admin)/charts/pie/page'))
const Radar = lazy(() => import('@/app/(admin)/charts/radar/page'))
const RadialBar = lazy(() => import('@/app/(admin)/charts/radial-bar/page'))
const Scatter = lazy(() => import('@/app/(admin)/charts/scatter/page'))
const Polar = lazy(() => import('@/app/(admin)/charts/polar/page'))
const GoogleMaps = lazy(() => import('@/app/(admin)/maps/google/page'))
const VectorMaps = lazy(() => import('@/app/(admin)/maps/vector/page'))

// Forms Routes
const Basic = lazy(() => import('@/app/(admin)/forms/basic/page'))
const Checkbox = lazy(() => import('@/app/(admin)/forms/checkbox/page'))
const Select = lazy(() => import('@/app/(admin)/forms/select/page'))
const Clipboard = lazy(() => import('@/app/(admin)/forms/clipboard/page'))
const FlatPicker = lazy(() => import('@/app/(admin)/forms/flat-picker/page'))
const Validation = lazy(() => import('@/app/(admin)/forms/validation/page'))
const Wizard = lazy(() => import('@/app/(admin)/forms/wizard/page'))
const FileUploads = lazy(() => import('@/app/(admin)/forms/file-uploads/page'))
const Editors = lazy(() => import('@/app/(admin)/forms/editors/page'))
const InputMask = lazy(() => import('@/app/(admin)/forms/input-mask/page'))
const Slider = lazy(() => import('@/app/(admin)/forms/slider/page'))

// Form Routes
const BasicTable = lazy(() => import('@/app/(admin)/tables/basic/page'))
const GridjsTable = lazy(() => import('@/app/(admin)/tables/gridjs/page'))

// Icon Routes
const BoxIcons = lazy(() => import('@/app/(admin)/icons/boxicons/page'))
const IconaMoonIcons = lazy(() => import('@/app/(admin)/icons/iconamoon/page'))

// Not Found Routes
const NotFoundAdmin = lazy(() => import('@/app/(admin)/not-found'))
const NotFound = lazy(() => import('@/app/(other)/(error-pages)/error-404/page'))
const NotFound2 = lazy(() => import('@/app/(other)/(error-pages)/error-404-2/page'))

// Auth Routes
const AuthSignIn = lazy(() => import('@/app/(other)/auth/sign-in/page'))
const AuthSignIn2 = lazy(() => import('@/app/(other)/auth/sign-in-2/page'))
const AuthSignUp = lazy(() => import('@/app/(other)/auth/sign-up/page'))
const AuthSignUp2 = lazy(() => import('@/app/(other)/auth/sign-up-2/page'))
const SetupSuperadmin = lazy(() => import('@/app/(other)/auth/setup-superadmin/page'))
const ResetPassword = lazy(() => import('@/app/(other)/auth/reset-pass/page'))
const ResetPassword2 = lazy(() => import('@/app/(other)/auth/reset-pass-2/page'))
const LockScreen = lazy(() => import('@/app/(other)/auth/lock-screen/page'))
const LockScreen2 = lazy(() => import('@/app/(other)/auth/lock-screen-2/page'))

const dashboardPath = () => '/dashboard/analytics'

const DashboardRedirect = () => {
  return <Navigate to={dashboardPath()} replace />
}

export type RoutesProps = {
  path: RouteProps['path']
  name: string
  element: RouteProps['element']
  roles?: string[]
  moduleAccess?: 'view' | 'manage'
  allowModuleRoleBypass?: boolean
  strictRoles?: boolean
  exact?: boolean
}

const adminRoles: UserType['role'][] = ['superadmin', 'admin']
const teamRoles: UserType['role'][] = ['sales', 'operations', 'accounts', 'designers']
const allRoles: UserType['role'][] = [...adminRoles, ...teamRoles]
const leadRoles: UserType['role'][] = [...adminRoles, 'sales']
const hrAccessRoles = allRoles
const superadminRoles: UserType['role'][] = ['superadmin']
const superadminOnly = (routes: RoutesProps[]) => routes.map((route) => ({ ...route, roles: route.roles ?? superadminRoles }))

const initialRoutes: RoutesProps[] = [
  {
    path: '/',
    name: 'root',
    element: <DashboardRedirect />,
  },
  {
    path: '/access-denied',
    name: 'access-denied',
    element: <AccessDenied />,
  },
  {
    path: '*',
    name: 'not-found',
    element: <NotFound />,
  },
]

const generalRoutes: RoutesProps[] = [
  {
    path: '/dashboard/analytics',
    name: 'Admin Dashboard',
    element: <Analytics />,
    roles: [...allRoles, 'employee', 'client', 'director'],
  },
  {
    path: '/dashboard/finance',
    name: 'Finance',
    element: <Navigate to="/dashboard/analytics" replace />,
    roles: ['superadmin', 'admin'],
  },
  {
    path: '/dashboard/sales',
    name: 'Dashboard',
    element: <Profile />,
  },
  {
    path: '/users',
    name: 'Users',
    element: <Users />,
    roles: ['superadmin', 'admin'],
  },
  {
    path: '/users/create',
    name: 'Create User',
    element: <CreateUser />,
    roles: ['superadmin', 'admin'],
  },
  {
    path: '/users/:userId/edit',
    name: 'Edit User',
    element: <EditUser />,
    roles: ['superadmin', 'admin'],
  },
  {
    path: '/users/login-history',
    name: 'User Login History',
    element: <LoginHistory />,
  },
  {
    path: '/users/password-reset',
    name: 'Password Reset',
    element: <PasswordReset />,
  },
  {
    path: '/users/password-approvals',
    name: 'Password Approvals',
    element: <PasswordApprovals />,
    roles: ['superadmin', 'admin'],
  },
  {
    path: '/health/status',
    name: 'Health Status',
    element: <HealthStatus />,
    roles: ['superadmin'],
  },
  { path: '/hr', name: 'HR Dashboard', element: <Navigate to="/dashboard/analytics" replace />, roles: hrAccessRoles, allowModuleRoleBypass: true },
  { path: '/hr/employees', name: 'Employees', element: <Employees />, roles: hrAccessRoles, allowModuleRoleBypass: true },
  { path: '/hr/employees/:employeeId', name: 'Employee', element: <EmployeeDetail />, roles: hrAccessRoles, allowModuleRoleBypass: true },
  { path: '/hr/employee-overview', name: 'Employee monthly overview', element: <EmployeeOverview />, roles: hrAccessRoles, allowModuleRoleBypass: true },
  { path: '/hr/my-overview', name: 'My dashboard', element: <MyDashboard />, roles: ['employee'], strictRoles: true },
  { path: '/hr/my-profile', name: 'My Profile & Documents', element: <MyEmployeeProfile />, roles: ['employee'], strictRoles: true },
  { path: '/hr/my-attendance', name: 'My Attendance', element: <MyAttendance />, roles: ['employee'], strictRoles: true },
  { path: '/hr/my-id-card', name: 'My ID Card', element: <MyIdCard />, roles: ['employee'], strictRoles: true },
  { path: '/hr/my-payslips', name: 'My Salary Slips', element: <MyPayslips />, roles: ['employee'], strictRoles: true },
  { path: '/hr/upcoming-holidays', name: 'Upcoming Holidays', element: <UpcomingHolidays />, roles: ['employee'], strictRoles: true },
  { path: '/hr/settings/departments', name: 'Departments & Designations', element: <HrOrganization />, roles: hrAccessRoles, allowModuleRoleBypass: true },
  { path: '/hr/settings/designations', name: 'Departments & Designations', element: <HrOrganization />, roles: hrAccessRoles, allowModuleRoleBypass: true },
  { path: '/hr/attendance', name: 'Attendance', element: <Attendance />, roles: hrAccessRoles, allowModuleRoleBypass: true },
  { path: '/hr/attendance/reports', name: 'Attendance reports', element: <Navigate to="/hr/attendance" replace />, roles: hrAccessRoles, allowModuleRoleBypass: true },
  { path: '/hr/settings/holidays', name: 'Holidays', element: <Navigate to="/hr/leave" replace />, roles: hrAccessRoles, allowModuleRoleBypass: true },
  { path: '/hr/leave', name: 'Leave', element: <Leave />, roles: [...hrAccessRoles, 'employee'], allowModuleRoleBypass: true },
  { path: '/hr/leave/approvals', name: 'Leave approvals', element: <Navigate to="/hr/leave" replace />, roles: hrAccessRoles, allowModuleRoleBypass: true },
  { path: '/hr/leave/calendar', name: 'Leave calendar', element: <Navigate to="/hr/leave" replace />, roles: hrAccessRoles, allowModuleRoleBypass: true },
  { path: '/hr/settings/leave-types', name: 'Leave types', element: <Navigate to="/hr/leave" replace />, roles: hrAccessRoles, allowModuleRoleBypass: true },
  { path: '/hr/payroll', name: 'Payroll', element: <Payroll />, roles: hrAccessRoles, allowModuleRoleBypass: true },
  { path: '/hr/payroll/:runId', name: 'Payroll run', element: <PayrollDetail />, roles: hrAccessRoles, allowModuleRoleBypass: true },
  { path: '/hr/payroll/salaries', name: 'Salary structures', element: <Navigate to="/hr/payroll" replace />, roles: hrAccessRoles, allowModuleRoleBypass: true },
  { path: '/hr/payroll/advances', name: 'Advances', element: <Advances />, roles: hrAccessRoles, allowModuleRoleBypass: true },
  { path: '/hr/advances', name: 'Salary advance', element: <MyAdvances />, roles: ['employee'], strictRoles: true },
  { path: '/hr/payroll/settlements', name: 'Settlements', element: <Settlements />, roles: hrAccessRoles, allowModuleRoleBypass: true },
  { path: '/hr/expenses', name: 'Expenses', element: <Expenses />, roles: [...hrAccessRoles, 'employee'], allowModuleRoleBypass: true },
  { path: '/hr/expenses/approvals', name: 'Reimbursement approvals', element: <ExpenseApprovals />, roles: hrAccessRoles, allowModuleRoleBypass: true },
  { path: '/hr/reports', name: 'HR reports', element: <Navigate to="/hr" replace />, roles: hrAccessRoles, allowModuleRoleBypass: true },
  { path: '/clients', name: 'Client Management', element: <ClientManagement />, roles: allRoles, allowModuleRoleBypass: true },
  { path: '/clients/create', name: 'Create Client', element: <CreateClient />, roles: allRoles, moduleAccess: 'manage', allowModuleRoleBypass: true },
  { path: '/clients/:clientId', name: 'Client', element: <ClientOverview />, roles: allRoles, allowModuleRoleBypass: true },
  { path: '/invoices/create', name: 'Create Invoice', element: <CreateInvoice />, roles: allRoles, moduleAccess: 'manage', allowModuleRoleBypass: true },
  { path: '/challans', name: 'Delivery Challans', element: <Challans />, roles: allRoles, allowModuleRoleBypass: true },
  { path: '/challans/create', name: 'Create Delivery Challan', element: <CreateChallan />, roles: allRoles, moduleAccess: 'manage', allowModuleRoleBypass: true },
  { path: '/challans/:challanId/edit', name: 'Update Delivery Challan', element: <CreateChallan />, roles: allRoles, moduleAccess: 'manage', allowModuleRoleBypass: true },
  { path: '/challans/:challanId', name: 'Delivery Challan', element: <ChallanDetail />, roles: allRoles, allowModuleRoleBypass: true },
  {
    path: '/leads',
    name: 'My Leads',
    element: <Navigate to="/leads/mine" replace />,
    roles: leadRoles,
    allowModuleRoleBypass: true,
  },
  {
    path: '/leads/all-leads',
    name: 'My Leads',
    element: <Navigate to="/leads/mine" replace />,
    roles: leadRoles,
    allowModuleRoleBypass: true,
  },
  {
    path: '/leads/mine',
    name: 'My Leads',
    element: <MyLeads />,
    roles: ['sales'],
    allowModuleRoleBypass: true,
  },
  {
    path: '/leads/my-architects',
    name: 'My Architects',
    element: <MyArchitects />,
    roles: leadRoles,
    allowModuleRoleBypass: true,
  },
  {
    path: '/leads/create',
    name: 'Create Lead',
    element: <CreateLead />,
    roles: ['superadmin', 'admin', 'sales'],
    moduleAccess: 'manage',
    allowModuleRoleBypass: true,
  },
  {
    path: '/leads/pending',
    name: 'My Leads',
    element: <Navigate to="/leads/mine" replace />,
    roles: leadRoles,
    allowModuleRoleBypass: true,
  },
  {
    path: '/leads/architect',
    name: 'My Leads',
    element: <Navigate to="/leads/mine" replace />,
    roles: leadRoles,
    allowModuleRoleBypass: true,
  },
  {
    path: '/leads/scheduled',
    name: 'My Scheduled Meetings',
    element: <ScheduledLeads />,
    roles: leadRoles,
    allowModuleRoleBypass: true,
  },
  {
    path: '/leads/closed',
    name: 'My Closed Leads',
    element: <ClosedLeads />,
    roles: leadRoles,
    allowModuleRoleBypass: true,
  },
  {
    path: '/leads/:leadId',
    name: 'Lead Detail',
    element: <LeadDetail />,
    roles: leadRoles,
    allowModuleRoleBypass: true,
  },
  {
    path: '/upcoming/hr-management',
    name: 'HR Management',
    element: <ComingSoon />,
    roles: ['superadmin', 'admin'],
  },
  {
    path: '/upcoming/seo-website',
    name: 'SEO Website',
    element: <ComingSoon />,
    roles: ['superadmin', 'admin'],
  },
  {
    path: '/upcoming/challan-management',
    name: 'Challan Management',
    element: <ComingSoon />,
    roles: ['superadmin', 'admin'],
  },
  {
    path: '/upcoming/sales-bill',
    name: 'Sales Bill',
    element: <ComingSoon />,
    roles: ['superadmin', 'admin'],
  },
  {
    path: '/upcoming/purchase-bill',
    name: 'Purchase Bill',
    element: <ComingSoon />,
    roles: ['superadmin', 'admin'],
  },
]

const appsRoutes: RoutesProps[] = [
  { name: 'Inventory Management', path: '/inventory', element: <Inventory /> },
  { name: 'Add Material', path: '/inventory/add', element: <AddInventoryItem />, moduleAccess: 'manage' },
  { name: 'Update Material', path: '/inventory/:itemId/edit', element: <AddInventoryItem />, moduleAccess: 'manage' },
  { name: 'Material Details', path: '/inventory/:itemId', element: <InventoryMaterialDetail /> },
  { name: 'Purchase History', path: '/inventory/purchases', element: <InventoryPurchases /> },
  { name: 'Suppliers', path: '/inventory/suppliers', element: <InventorySuppliers /> },
  { name: 'Return Management', path: '/returns', element: <Returns /> },
  { name: 'Record Return', path: '/returns/create', element: <CreateReturn />, moduleAccess: 'manage' },
  { name: 'Create Return Transfer', path: '/returns/transfers/create', element: <CreateReturnTransfer />, moduleAccess: 'manage' },
  { name: 'Laser Cut Dashboard', path: '/laser-cut-management', element: <LaserCutDashboard /> },
  { name: 'Laser Cut Current Orders', path: '/laser-cut-management/orders', element: <LaserCutCurrentOrders /> },
  { name: 'Laser Cut Order Details', path: '/laser-cut-management/orders/:orderId', element: <LaserCutOrderDetail /> },
  { name: 'Move Inventory In to Laser Cut', path: '/laser-cut-management/challans/create', element: <CreateLaserCutChallan />, moduleAccess: 'manage' },
  { name: 'Move Laser Cut Products Out', path: '/laser-cut-management/move-out', element: <LaserCutMoveOut />, moduleAccess: 'manage' },
  { name: 'Laser Cut Vendors', path: '/laser-cut-management/vendors', element: <LaserCutVendors /> },
  { name: 'Laser Cut Management unavailable', path: '/laser-cut-management/*', element: <Navigate to="/dashboard/analytics" replace /> },
  { name: 'Powder Coating', path: '/powder-coating-management', element: <PowderCoatingManagement /> },
  { name: 'Powder Coating Orders', path: '/powder-coating-management/orders', element: <PowderCoatingOrders /> },
  { name: 'Powder Coating Order', path: '/powder-coating-management/orders/:orderId', element: <PowderCoatingOrderDetail /> },
  { name: 'Send Powder Coating Order to Site', path: '/powder-coating-management/orders/:orderId/dispatch', element: <PowderCoatingOrderDispatch />, moduleAccess: 'manage' },
  { name: 'Move Inventory In to Powder Coating', path: '/powder-coating-management/challans/create', element: <CreatePowderCoatingOrder />, moduleAccess: 'manage' },
  { name: 'Move Powder-Coated Products Out', path: '/powder-coating-management/move-out', element: <PowderCoatingMoveOut />, moduleAccess: 'manage' },
  { name: 'Powder Coating Vendors', path: '/powder-coating-management/vendors', element: <PowderCoatingVendors /> },
  { name: 'BOQ', path: '/designer/boq', element: <Boq /> },
  { name: 'BOQ Approvals', path: '/designer/boq/approvals', element: <BoqApprovals />, roles: ['director'], strictRoles: true },
  { name: 'BOQ Details', path: '/designer/boq/:documentId', element: <BoqDetail /> },
  { name: 'Site Measurements', path: '/designer/site-measurements', element: <SiteMeasurements /> },
  { name: 'Production Data', path: '/designer/production-data', element: <ProductionData /> },
  { name: 'Drawings', path: '/designer/drawings', element: <Drawings /> },
  { name: 'Drawing Approvals', path: '/designer/drawings/approvals', element: <DrawingApprovals />, roles: ['director'], strictRoles: true },
  { name: 'Drawing Details', path: '/designer/drawings/:documentId', element: <DrawingDetail /> },
  {
    name: 'Products',
    path: '/ecommerce/products',
    element: <EcommerceProducts />,
    roles: adminRoles,
  },
  {
    name: 'Product Details',
    path: '/ecommerce/products/:productId',
    element: <EcommerceProductDetails />,
    roles: adminRoles,
  },
  {
    name: 'Create Product',
    path: '/ecommerce/products/create',
    element: <EcommerceProductCreate />,
    roles: adminRoles,
  },
  {
    name: 'Customers',
    path: '/ecommerce/customers',
    element: <EcommerceCustomers />,
    roles: adminRoles,
  },
  {
    name: 'Sellers',
    path: '/ecommerce/sellers',
    element: <EcommerceSellers />,
    roles: adminRoles,
  },
  {
    name: 'Orders',
    path: '/ecommerce/orders',
    element: <EcommerceOrders />,
    roles: adminRoles,
  },
  {
    name: 'Order Details',
    path: '/ecommerce/orders/:orderId',
    element: <EcommerceOrderDetails />,
    roles: adminRoles,
  },
  {
    name: 'Inventory',
    path: '/ecommerce/inventory',
    element: <EcommerceInventory />,
    roles: adminRoles,
  },
  {
    name: 'Chat',
    path: '/apps/chat',
    element: <Chat />,
    roles: adminRoles,
  },
  {
    name: 'Email',
    path: '/apps/email',
    element: <Email />,
    roles: adminRoles,
  },
  {
    name: 'Todo Management',
    path: '/calendar/schedule',
    element: <Schedule />,
    roles: adminRoles,
  },
  {
    name: 'Create Task',
    path: '/tasks/create',
    element: <CreateTask />,
    moduleAccess: 'manage',
  },
  {
    name: 'Tasks Assigned By Me',
    path: '/tasks/assigned-by-me',
    element: <Todo />,
  },
  {
    name: 'Tasks Assigned To Me',
    path: '/tasks/assigned-to-me',
    element: <Todo />,
    roles: [...teamRoles, 'employee'],
    allowModuleRoleBypass: true,
  },
  {
    name: 'Task Detail',
    path: '/tasks/:taskId',
    element: <TaskDetail />,
    roles: [...teamRoles, 'employee'],
    allowModuleRoleBypass: true,
  },
  {
    name: 'Update Task',
    path: '/tasks/:taskId/edit',
    element: <UpdateTask />,
    roles: [...teamRoles, 'employee'],
    moduleAccess: 'manage',
    allowModuleRoleBypass: true,
  },
  {
    name: 'Integration',
    path: '/calendar/integration',
    element: <Integration />,
    roles: adminRoles,
  },
  {
    name: 'Help',
    path: '/calendar/help',
    element: <Help />,
    roles: adminRoles,
  },
  {
    name: 'Todo',
    path: '/apps/todo',
    element: <Todo />,
  },
  {
    name: 'Notifications',
    path: '/notifications',
    element: <NotificationsPage />,
  },
  {
    name: 'Create Lead',
    path: '/leads/sales-create',
    element: <SalesCreateLead />,
    roles: ['sales'],
    moduleAccess: 'manage',
    allowModuleRoleBypass: true,
  },
  {
    name: 'Social',
    path: '/apps/social',
    element: <Social />,
    roles: adminRoles,
  },
  {
    name: 'Contacts',
    path: '/apps/contacts',
    element: <Contacts />,
    roles: adminRoles,
  },
  {
    name: 'Invoices List',
    path: '/invoices',
    element: <Invoices />,
    roles: allRoles,
    allowModuleRoleBypass: true,
  },
  {
    name: 'Invoices Details',
    path: '/invoices/:invoiceId',
    element: <InvoiceDetails />,
    roles: allRoles,
    allowModuleRoleBypass: true,
  },
]

const customRoutes: RoutesProps[] = [
  {
    name: 'Welcome',
    path: '/pages/welcome',
    element: <Welcome />,
  },
  {
    name: 'FAQs',
    path: '/pages/faqs',
    element: <FAQs />,
  },
  {
    name: 'Profile',
    path: '/pages/profile',
    element: <Profile />,
  },
  {
    name: 'Contact Us',
    path: '/pages/contact-us',
    element: <ContactUs />,
  },
  {
    name: 'About Us',
    path: '/pages/about-us',
    element: <AboutUs />,
  },
  {
    name: 'Our Team',
    path: '/pages/our-team',
    element: <OurTeam />,
  },
  {
    name: 'Timeline',
    path: '/pages/timeline',
    element: <TimelinePage />,
  },
  {
    name: 'Pricing',
    path: '/pages/pricing',
    element: <Pricing />,
  },
  {
    name: 'Error 404 Alt',
    path: '/pages/error-404-alt',
    element: <NotFoundAdmin />,
  },
  {
    name: 'Widgets',
    path: '/widgets',
    element: <Widgets />,
  },
]

const baseUIRoutes: RoutesProps[] = [
  {
    name: 'Accordions',
    path: '/ui/accordions',
    element: <Accordions />,
  },
  {
    name: 'Alerts',
    path: '/ui/alerts',
    element: <Alerts />,
  },
  {
    name: 'Avatars',
    path: '/ui/avatars',
    element: <Avatars />,
  },
  {
    name: 'Badges',
    path: '/ui/badges',
    element: <Badges />,
  },
  {
    name: 'Breadcrumb',
    path: '/ui/breadcrumb',
    element: <Breadcrumb />,
  },
  {
    name: 'Buttons',
    path: '/ui/buttons',
    element: <Buttons />,
  },
  {
    name: 'Cards',
    path: '/ui/cards',
    element: <Cards />,
  },
  {
    name: 'Carousel',
    path: '/ui/carousel',
    element: <Carousel />,
  },
  {
    name: 'Collapse',
    path: '/ui/collapse',
    element: <Collapse />,
  },
  {
    name: 'Dropdowns',
    path: '/ui/dropdowns',
    element: <Dropdowns />,
  },
  {
    name: 'List Group',
    path: '/ui/list-group',
    element: <ListGroup />,
  },
  {
    name: 'Modals',
    path: '/ui/modals',
    element: <Modals />,
  },
  {
    name: 'Tabs',
    path: '/ui/tabs',
    element: <Tabs />,
  },
  {
    name: 'Offcanvas',
    path: '/ui/offcanvas',
    element: <Offcanvas />,
  },
  {
    name: 'Pagination',
    path: '/ui/pagination',
    element: <Pagination />,
  },
  {
    name: 'Placeholders',
    path: '/ui/placeholders',
    element: <Placeholders />,
  },
  {
    name: 'Popovers',
    path: '/ui/popovers',
    element: <Popovers />,
  },
  {
    name: 'Progress',
    path: '/ui/progress',
    element: <Progress />,
  },
  {
    name: 'Spinners',
    path: '/ui/spinners',
    element: <Spinners />,
  },
  {
    name: 'Toasts',
    path: '/ui/toasts',
    element: <Toasts />,
  },
  {
    name: 'Tooltips',
    path: '/ui/tooltips',
    element: <Tooltips />,
  },
]

const advancedUIRoutes: RoutesProps[] = [
  {
    name: 'Ratings',
    path: '/advanced/ratings',
    element: <Ratings />,
  },
  {
    name: 'Sweet Alert',
    path: '/advanced/alert',
    element: <SweetAlerts />,
  },
  {
    name: 'Swiper Slider',
    path: '/advanced/swiper',
    element: <Swiper />,
  },
  {
    name: 'Scrollbar',
    path: '/advanced/scrollbar',
    element: <Scrollbar />,
  },
  {
    name: 'Toastify',
    path: '/advanced/toastify',
    element: <Toastify />,
  },
]

const chartsNMapsRoutes: RoutesProps[] = [
  {
    name: 'Area',
    path: '/charts/area',
    element: <Area />,
  },
  {
    name: 'Bar',
    path: '/charts/bar',
    element: <Bar />,
  },
  {
    name: 'Bubble',
    path: '/charts/bubble',
    element: <Bubble />,
  },
  {
    name: 'Candle Stick',
    path: '/charts/candlestick',
    element: <Candlestick />,
  },
  {
    name: 'Column',
    path: '/charts/column',
    element: <Column />,
  },
  {
    name: 'Heatmap',
    path: '/charts/heatmap',
    element: <Heatmap />,
  },
  {
    name: 'Line',
    path: '/charts/line',
    element: <Line />,
  },
  {
    name: 'Mixed',
    path: '/charts/mixed',
    element: <Mixed />,
  },
  {
    name: 'Timeline',
    path: '/charts/timeline',
    element: <Timeline />,
  },
  {
    name: 'Boxplot',
    path: '/charts/boxplot',
    element: <Boxplot />,
  },
  {
    name: 'Treemap',
    path: '/charts/treemap',
    element: <Treemap />,
  },
  {
    name: 'Pie',
    path: '/charts/pie',
    element: <Pie />,
  },
  {
    name: 'Radar',
    path: '/charts/radar',
    element: <Radar />,
  },
  {
    name: 'Radial Bar',
    path: '/charts/radial-bar',
    element: <RadialBar />,
  },
  {
    name: 'Scatter',
    path: '/charts/scatter',
    element: <Scatter />,
  },
  {
    name: 'Polar Area',
    path: '/charts/polar',
    element: <Polar />,
  },
  {
    name: 'Google',
    path: '/maps/google',
    element: <GoogleMaps />,
  },
  {
    name: 'Vector',
    path: '/maps/vector',
    element: <VectorMaps />,
  },
]

const formsRoutes: RoutesProps[] = [
  {
    name: 'Basic Elements',
    path: '/forms/basic',
    element: <Basic />,
  },
  {
    name: 'Checkbox & Radio',
    path: '/forms/checkbox',
    element: <Checkbox />,
  },
  {
    name: 'Choice Select',
    path: '/forms/select',
    element: <Select />,
  },
  {
    name: 'Clipboard',
    path: '/forms/clipboard',
    element: <Clipboard />,
  },
  {
    name: 'Flat Picker',
    path: '/forms/flat-picker',
    element: <FlatPicker />,
  },
  {
    name: 'Validation',
    path: '/forms/validation',
    element: <Validation />,
  },
  {
    name: 'Wizard',
    path: '/forms/wizard',
    element: <Wizard />,
  },
  {
    name: 'File Uploads',
    path: '/forms/file-uploads',
    element: <FileUploads />,
  },
  {
    name: 'Editors',
    path: '/forms/editors',
    element: <Editors />,
  },
  {
    name: 'Input Mask',
    path: '/forms/input-mask',
    element: <InputMask />,
  },
  {
    name: 'Slider',
    path: '/forms/slider',
    element: <Slider />,
  },
]

const tableRoutes: RoutesProps[] = [
  {
    name: 'Basic Tables',
    path: '/tables/basic',
    element: <BasicTable />,
  },
  {
    name: 'Grid JS',
    path: '/tables/gridjs',
    element: <GridjsTable />,
  },
]

const iconRoutes: RoutesProps[] = [
  {
    name: 'Boxicons',
    path: '/icons/boxicons',
    element: <BoxIcons />,
  },
  {
    name: 'IconaMoon',
    path: '/icons/iconamoon',
    element: <IconaMoonIcons />,
  },
]

export const authRoutes: RoutesProps[] = [
  {
    path: '/auth/sign-in',
    name: 'Sign In',
    element: <AuthSignIn />,
  },
  {
    name: 'Sign In 2',
    path: '/auth/sign-in-2',
    element: <AuthSignIn2 />,
  },
  {
    name: 'Sign Up',
    path: '/auth/sign-up',
    element: <AuthSignUp />,
  },
  {
    name: 'Sign Up 2',
    path: '/auth/sign-up-2',
    element: <AuthSignUp2 />,
  },
  {
    name: 'Setup Superadmin',
    path: '/auth/setup-superadmin',
    element: <SetupSuperadmin />,
  },
  {
    name: 'Reset Password',
    path: '/auth/reset-pass',
    element: <ResetPassword />,
  },
  {
    name: 'Reset Password 2',
    path: '/auth/reset-pass-2',
    element: <ResetPassword2 />,
  },
  {
    name: 'Lock Screen',
    path: '/auth/lock-screen',
    element: <LockScreen />,
  },
  {
    name: 'Lock Screen 2',
    path: '/auth/lock-screen-2',
    element: <LockScreen2 />,
  },
  {
    name: '404 Error',
    path: '/error-404',
    element: <NotFound />,
  },
  {
    name: 'Maintenance',
    path: '/maintenance',
    element: <Maintenance />,
  },
  {
    name: '404 Error 2',
    path: '/error-404-2',
    element: <NotFound2 />,
  },
  {
    name: 'Coming Soon',
    path: '/coming-soon',
    element: <ComingSoon />,
  },
]

export const appRoutes = [
  ...initialRoutes,
  ...generalRoutes,
  ...appsRoutes,
  ...superadminOnly(customRoutes),
  ...superadminOnly(baseUIRoutes),
  ...superadminOnly(advancedUIRoutes),
  ...superadminOnly(chartsNMapsRoutes),
  ...superadminOnly(formsRoutes),
  ...superadminOnly(tableRoutes),
  ...superadminOnly(iconRoutes),
]
