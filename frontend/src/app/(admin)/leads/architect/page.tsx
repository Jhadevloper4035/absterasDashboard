import PageMetaData from '@/components/PageTitle'
import Spinner from '@/components/Spinner'
import ReactTable from '@/components/Table'
import DeleteConfirmModal from '@/components/DeleteConfirmModal'
import { apiFetch } from '@/helpers/api'
import { useAuthStore } from '@/store/authStore'
import type { ArchitectType } from '@/types/architect'
import type { ColumnDef } from '@tanstack/react-table'
import { useEffect, useMemo, useState } from 'react'
import { Alert, Badge, Button, Card, CardBody, Modal } from 'react-bootstrap'
import { toast } from 'react-toastify'

type PageMeta = { page: number; limit: number; total: number; totalPages: number }

const ArchitectLeadsPage = () => {
  const token = useAuthStore((state) => state.token)
  const [architects, setArchitects] = useState<ArchitectType[]>([])
  const [meta, setMeta] = useState<PageMeta>({ page: 1, limit: 25, total: 0, totalPages: 1 })
  const [page, setPage] = useState(1)
  const [selectedArchitect, setSelectedArchitect] = useState<ArchitectType>()
  const [deleteTarget, setDeleteTarget] = useState<ArchitectType>()
  const [loading, setLoading] = useState(false)
  const [deleting, setDeleting] = useState(false)
  const [error, setError] = useState('')

  const deleteArchitect = async () => {
    if (!token || !deleteTarget) return

    setDeleting(true)
    try {
      await apiFetch(`/architects/${deleteTarget._id}`, { method: 'DELETE', token })
      setArchitects((items) => items.filter((item) => item._id !== deleteTarget._id))
      if (selectedArchitect?._id === deleteTarget._id) setSelectedArchitect(undefined)
      setDeleteTarget(undefined)
      toast.success('Architect lead deleted')
    } catch (e) {
      const message = e instanceof Error ? e.message : 'Unable to delete architect lead'
      setError(message)
      toast.error(message)
    } finally {
      setDeleting(false)
    }
  }

  useEffect(() => {
    if (!token) return

    const load = async () => {
      setLoading(true)
      setError('')
      try {
        const res = await apiFetch<{ data: ArchitectType[]; meta?: PageMeta }>(`/architects?page=${page}&limit=25`, { token })
        setArchitects(res.data)
        setMeta(res.meta || { page, limit: res.data.length, total: res.data.length, totalPages: 1 })
      } catch (e) {
        setError(e instanceof Error ? e.message : 'Unable to load architects')
      } finally {
        setLoading(false)
      }
    }

    load()
  }, [page, token])

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
          <div className="d-flex justify-content-end gap-2">
            <Button size="sm" variant="outline-primary" className="text-nowrap" onClick={() => setSelectedArchitect(original)}>
              View
            </Button>
            <Button size="sm" variant="outline-danger" className="text-nowrap" onClick={() => setDeleteTarget(original)}>
              Delete
            </Button>
          </div>
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
              {loading ? 'Loading' : `${meta.total} architects`}
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
            <ReactTable<ArchitectType> columns={columns} data={architects} pageSize={25} tableClass="text-nowrap mb-0" theadClass="bg-light bg-opacity-50" />
          )}
          <div className="d-flex justify-content-between align-items-center gap-2 flex-wrap mt-3">
            <span className="text-muted fs-13">
              Showing page {meta.page} of {meta.totalPages}
            </span>
            <div className="d-flex gap-2">
              <Button size="sm" variant="outline-secondary" disabled={loading || page <= 1} onClick={() => setPage((value) => Math.max(value - 1, 1))}>
                Previous
              </Button>
              <Button size="sm" variant="outline-secondary" disabled={loading || page >= meta.totalPages} onClick={() => setPage((value) => value + 1)}>
                Next
              </Button>
            </div>
          </div>
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
        <Modal.Footer>
          {selectedArchitect && (
            <Button variant="outline-danger" onClick={() => setDeleteTarget(selectedArchitect)}>
              Delete architect lead
            </Button>
          )}
        </Modal.Footer>
      </Modal>
      <DeleteConfirmModal
        show={!!deleteTarget}
        title="Delete architect lead?"
        itemName={deleteTarget?.name}
        confirming={deleting}
        onCancel={() => setDeleteTarget(undefined)}
        onConfirm={deleteArchitect}
      />
    </>
  )
}

export default ArchitectLeadsPage
