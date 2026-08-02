import { lazy } from 'react'
import { Navigate, type RouteProps } from 'react-router-dom'
import { useAuthStore } from '@/store/authStore'
import type { UserType } from '@/types/auth'

// Dashboard Routes
const Analytics = lazy(() => import('@/app/(admin)/dashboard/analytics/page'))
const Sales = lazy(() => import('@/app/(admin)/dashboard/sales/page'))
const Users = lazy(() => import('@/app/(admin)/users/page'))
const CreateUser = lazy(() => import('@/app/(admin)/users/create/page'))
const Leads = lazy(() => import('@/app/(admin)/leads/page'))
const CreateLead = lazy(() => import('@/app/(admin)/leads/create/page'))
const PendingLeads = lazy(() => import('@/app/(admin)/leads/pending/page'))
const ArchitectLeads = lazy(() => import('@/app/(admin)/leads/architect/page'))
const ScheduledLeads = lazy(() => import('@/app/(admin)/leads/scheduled/page'))
const WonLeads = lazy(() => import('@/app/(admin)/leads/won/page'))
const LeadDetail = lazy(() => import('@/app/(admin)/leads/[leadId]/page'))
const CreateTask = lazy(() => import('@/app/(admin)/tasks/create/page'))
const WorkTypes = lazy(() => import('@/app/(admin)/tasks/work-types/page'))
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

const dashboardPath = (role?: string) => (['sales', 'operations', 'accounts', 'designers'].includes(role || '') ? '/dashboard/sales' : '/dashboard/analytics')

const DashboardRedirect = () => {
  const role = useAuthStore((state) => state.user?.role)
  return <Navigate to={dashboardPath(role)} replace />
}

export type RoutesProps = {
  path: RouteProps['path']
  name: string
  element: RouteProps['element']
  roles?: UserType['role'][]
  exact?: boolean
}

const adminRoles: UserType['role'][] = ['superadmin', 'admin']
const teamRoles: UserType['role'][] = ['sales', 'operations', 'accounts', 'designers']
const superadminRoles: UserType['role'][] = ['superadmin']
const superadminOnly = (routes: RoutesProps[]) => routes.map((route) => ({ ...route, roles: route.roles ?? superadminRoles }))

const initialRoutes: RoutesProps[] = [
  {
    path: '/',
    name: 'root',
    element: <DashboardRedirect />,
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
    roles: ['superadmin', 'admin'],
  },
  {
    path: '/dashboard/finance',
    name: 'Finance',
    element: <Navigate to="/dashboard/analytics" replace />,
    roles: ['superadmin', 'admin'],
  },
  {
    path: '/dashboard/sales',
    name: 'Team Profile Dashboard',
    element: <Sales />,
    roles: teamRoles,
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
    path: '/leads',
    name: 'Leads',
    element: <Leads />,
  },
  {
    path: '/leads/create',
    name: 'Create Lead',
    element: <CreateLead />,
    roles: ['superadmin', 'admin'],
  },
  {
    path: '/leads/pending',
    name: 'Pending Lead Assignment',
    element: <PendingLeads />,
    roles: ['superadmin', 'admin'],
  },
  {
    path: '/leads/architect',
    name: 'Architect Leads',
    element: <ArchitectLeads />,
    roles: ['superadmin', 'admin'],
  },
  {
    path: '/leads/scheduled',
    name: 'Meeting Scheduled Leads',
    element: <ScheduledLeads />,
  },
  {
    path: '/leads/won',
    name: 'Won Leads',
    element: <WonLeads />,
  },
  {
    path: '/leads/:leadId',
    name: 'Lead Detail',
    element: <LeadDetail />,
  },
  {
    path: '/upcoming/events-management',
    name: 'Events Management',
    element: <ComingSoon />,
    roles: ['superadmin', 'admin'],
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
  {
    path: '/upcoming/client-management',
    name: 'Client Management',
    element: <ComingSoon />,
    roles: ['superadmin', 'admin'],
  },
]

const appsRoutes: RoutesProps[] = [
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
    roles: ['superadmin', 'admin'],
  },
  {
    name: 'All Tasks',
    path: '/tasks/all',
    element: <Todo />,
    roles: [...adminRoles, ...teamRoles],
  },
  {
    name: 'Pending Tasks',
    path: '/tasks/pending',
    element: <Todo />,
    roles: ['superadmin', 'admin'],
  },
  {
    name: 'Exceeded Deadline Tasks',
    path: '/tasks/exceeded-deadline',
    element: <Todo />,
    roles: ['superadmin', 'admin'],
  },
  {
    name: 'Work Types',
    path: '/tasks/work-types',
    element: <WorkTypes />,
    roles: ['superadmin', 'admin'],
  },
  {
    name: 'Task Detail',
    path: '/tasks/:taskId',
    element: <TaskDetail />,
    roles: [...adminRoles, ...teamRoles],
  },
  {
    name: 'Update Task',
    path: '/tasks/:taskId/edit',
    element: <UpdateTask />,
    roles: [...adminRoles, ...teamRoles],
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
    roles: [...adminRoles, ...teamRoles],
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
    roles: adminRoles,
  },
  {
    name: 'Invoices Details',
    path: '/invoices/:invoiceId',
    element: <InvoiceDetails />,
    roles: adminRoles,
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
