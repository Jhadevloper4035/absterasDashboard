import PageMetaData from '@/components/PageTitle'
import ReactTable from '@/components/Table'
import { apiFetch } from '@/helpers/api'
import type { EmployeeType } from '@/types/hr'
import type { ColumnDef } from '@tanstack/react-table'
import { useEffect, useMemo, useState } from 'react'
import { Alert, Badge, Button, Card, CardBody, Form } from 'react-bootstrap'
import { Link } from 'react-router-dom'

const EmployeesPage = () => {
  const [employees, setEmployees] = useState<EmployeeType[]>([])
  const [query, setQuery] = useState('')
  const [filters, setFilters] = useState({ department: '', employeeType: '', status: '' })
  const [error, setError] = useState('')
  useEffect(() => { apiFetch<{ data: EmployeeType[] }>('/hr/employees?limit=100').then((response) => setEmployees(response.data)).catch((reason) => setError(reason instanceof Error ? reason.message : 'Unable to load employees')) }, [])
  const columns = useMemo<ColumnDef<EmployeeType>[]>(() => [
    { header: 'Employee', cell: ({ row }) => <><div className="fw-medium">{row.original.user.name}</div><small className="text-muted">{row.original.user.email}</small></> },
    { header: 'Department', cell: ({ row }) => row.original.department?.name || '-' },
    { header: 'Designation', cell: ({ row }) => row.original.designation?.name || '-' },
    { header: 'Type', accessorKey: 'employeeType' },
    { header: 'Status', cell: ({ row }) => <Badge bg={row.original.status === 'active' ? 'success' : 'secondary'}>{row.original.status}</Badge> },
    { header: 'Action', cell: ({ row }) => <Link to={`/hr/employees/${row.original._id}`}><Button size="sm" variant="outline-primary">View</Button></Link> },
  ], [])
  const departments = useMemo(() => [...new Map(employees.filter((employee) => employee.department).map((employee) => [employee.department._id, employee.department.name])).entries()], [employees])
  const visible = employees.filter((employee) => `${employee.user.name} ${employee.user.email} ${employee.department?.name || ''} ${employee.designation?.name || ''}`.toLowerCase().includes(query.toLowerCase()) && (!filters.department || employee.department?._id === filters.department) && (!filters.employeeType || employee.employeeType === filters.employeeType) && (!filters.status || employee.status === filters.status))
  return <><PageMetaData title="Employees" /><Card><CardBody><div className="d-flex justify-content-between gap-2 flex-wrap mb-3"><div><h4 className="card-title mb-1">All Employees</h4><p className="text-muted mb-0">Search and filter employees by department, type, or status.</p></div><Badge bg="light" text="dark">{visible.length} employees</Badge></div>{error && <Alert variant="danger">{error}</Alert>}<div className="d-flex flex-wrap gap-2 mb-3"><Form.Control style={{ flex: '1 1 240px' }} placeholder="Search name, email, or designation" value={query} onChange={(event) => setQuery(event.target.value)} /><Form.Select style={{ flex: '1 1 170px' }} value={filters.department} onChange={(event) => setFilters({ ...filters, department: event.target.value })}><option value="">All departments</option>{departments.map(([id, name]) => <option key={id} value={id}>{name}</option>)}</Form.Select><Form.Select style={{ flex: '1 1 140px' }} value={filters.employeeType} onChange={(event) => setFilters({ ...filters, employeeType: event.target.value })}><option value="">All types</option><option value="office">Office</option><option value="site">Site</option></Form.Select><Form.Select style={{ flex: '1 1 140px' }} value={filters.status} onChange={(event) => setFilters({ ...filters, status: event.target.value })}><option value="">All statuses</option><option value="active">Active</option><option value="resigned">Resigned</option><option value="terminated">Terminated</option></Form.Select><Button variant="light" onClick={() => { setQuery(''); setFilters({ department: '', employeeType: '', status: '' }) }}>Clear</Button></div><ReactTable columns={columns} data={visible} pageSize={25} tableClass="text-nowrap mb-0" theadClass="bg-light bg-opacity-50" /></CardBody></Card></>
}
export default EmployeesPage
