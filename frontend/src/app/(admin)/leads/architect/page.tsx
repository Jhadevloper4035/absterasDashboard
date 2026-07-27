import PageMetaData from '@/components/PageTitle'
import Spinner from '@/components/Spinner'
import ReactTable from '@/components/Table'
import { apiFetch } from '@/helpers/api'
import { useAuthStore } from '@/store/authStore'
import type { ArchitectType } from '@/types/architect'
import type { ColumnDef } from '@tanstack/react-table'
import { useEffect, useMemo, useState } from 'react'
import { Alert, Badge, Button, Card, CardBody, Modal } from 'react-bootstrap'

const ArchitectLeadsPage = () => {
  const token = useAuthStore((state) => state.token)
  const [architects, setArchitects] = useState<ArchitectType[]>([])
  const [selectedArchitect, setSelectedArchitect] = useState<ArchitectType>()
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  useEffect(() => {
    if (!token) return

    const load = async () => {
      setLoading(true)
      setError('')
      try {
        const res = await apiFetch<{ data: ArchitectType[] }>('/architects?limit=10', { token })
        setArchitects(res.data)
      } catch (e) {
        setError(e instanceof Error ? e.message : 'Unable to load architects')
      } finally {
        setLoading(false)
      }
    }

    load()
  }, [token])

  const columns = useMemo<ColumnDef<ArchitectType>[]>(
    () => [
      {
        header: '#',
        cell: ({ row }) => row.index + 1,
      },
      {
        header: 'Name',
        cell: ({ row: { original } }) => (
          <div>
            <div className="fw-medium">{original.name}</div>
            <div className="text-muted fs-13">{original.specialty || '-'}</div>
          </div>
        ),
      },
      {
        header: 'Mobile',
        accessorKey: 'phone',
        cell: ({ row: { original } }) => original.phone || '-',
      },
      {
        header: 'Email',
        accessorKey: 'email',
        cell: ({ row: { original } }) => original.email || '-',
      },
      {
        header: 'Company',
        accessorKey: 'company',
        cell: ({ row: { original } }) => original.company || '-',
      },
      {
        header: 'City',
        accessorKey: 'city',
        cell: ({ row: { original } }) => original.city || '-',
      },
      {
        header: 'Status',
        cell: ({ row: { original } }) => <Badge bg={original.status === 'inactive' ? 'secondary' : 'success'}>{original.status || 'active'}</Badge>,
      },
      {
        header: 'Action',
        cell: ({ row: { original } }) => (
          <Button size="sm" variant="outline-primary" className="text-nowrap" onClick={() => setSelectedArchitect(original)}>
            View
          </Button>
        ),
      },
    ],
    [],
  )

  return (
    <>
      <PageMetaData title="Architect List" />
      <Card>
        <CardBody>
          <div className="d-flex align-items-center justify-content-between mb-3">
            <h4 className="card-title mb-0">Architect List</h4>
            <Badge bg="light" text="dark">
              {loading ? 'Loading' : `${architects.length} architects`}
            </Badge>
          </div>
          {error && <Alert variant="danger">{error}</Alert>}
          {!architects.length && !loading ? <Alert variant="info">No architects found</Alert> : null}
          {loading && !architects.length ? (
            <div className="text-center py-5">
              <Spinner className="spinner-border-sm me-2" tag="span" />
              <span className="text-muted">Loading data...</span>
            </div>
          ) : (
            <ReactTable<ArchitectType> columns={columns} data={architects} rowsPerPageList={[10, 25, 50]} pageSize={10} tableClass="text-nowrap mb-0" theadClass="bg-light bg-opacity-50" showPagination />
          )}
        </CardBody>
      </Card>
      <Modal show={!!selectedArchitect} onHide={() => setSelectedArchitect(undefined)} centered>
        <Modal.Header closeButton>
          <Modal.Title>{selectedArchitect?.name}</Modal.Title>
        </Modal.Header>
        <Modal.Body>
          <div className="mb-2">
            <div className="text-muted fs-13">Company</div>
            <div className="fw-medium">{selectedArchitect?.company || '-'}</div>
          </div>
          <div className="mb-2">
            <div className="text-muted fs-13">Mobile</div>
            <div className="fw-medium">{selectedArchitect?.phone || '-'}</div>
          </div>
          <div className="mb-2">
            <div className="text-muted fs-13">Email</div>
            <div className="fw-medium">{selectedArchitect?.email || '-'}</div>
          </div>
          <div className="mb-2">
            <div className="text-muted fs-13">City</div>
            <div className="fw-medium">{selectedArchitect?.city || '-'}</div>
          </div>
          <div>
            <div className="text-muted fs-13">Notes</div>
            <div className="fw-medium">{selectedArchitect?.notes || '-'}</div>
          </div>
        </Modal.Body>
      </Modal>
    </>
  )
}

export default ArchitectLeadsPage
