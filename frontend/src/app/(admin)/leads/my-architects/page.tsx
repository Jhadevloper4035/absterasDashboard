import PageMetaData from '@/components/PageTitle'
import Spinner from '@/components/Spinner'
import ReactTable from '@/components/Table'
import DeleteConfirmModal from '@/components/DeleteConfirmModal'
import IconifyIcon from '@/components/wrappers/IconifyIcon'
import { apiFetch } from '@/helpers/api'
import { useAuthStore } from '@/store/authStore'
import type { ArchitectType } from '@/types/architect'
import type { ColumnDef } from '@tanstack/react-table'
import { FormEvent, useEffect, useMemo, useState } from 'react'
import { Alert, Button, Card, CardBody, Col, Form, Modal, Row } from 'react-bootstrap'
import { toast } from 'react-toastify'

type PageMeta = { page: number; limit: number; total: number; totalPages: number }
const emptyForm = { name: '', phone: '', email: '', company: '', city: '', specialty: '', notes: '' }

const MyArchitectsPage = () => {
  const token = useAuthStore((state) => state.token)
  const [architects, setArchitects] = useState<ArchitectType[]>([])
  const [form, setForm] = useState(emptyForm)
  const [meta, setMeta] = useState<PageMeta>({ page: 1, limit: 25, total: 0, totalPages: 1 })
  const [page, setPage] = useState(1)
  const [showForm, setShowForm] = useState(false)
  const [deleteTarget, setDeleteTarget] = useState<ArchitectType>()
  const [loading, setLoading] = useState(false)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')

  const loadArchitects = async () => {
    if (!token) return
    setLoading(true)
    setError('')
    try {
      const response = await apiFetch<{ data: ArchitectType[]; meta?: PageMeta }>(`/architects?page=${page}&limit=25`, { token })
      setArchitects(response.data)
      setMeta(response.meta || { page, limit: response.data.length, total: response.data.length, totalPages: 1 })
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Unable to load architects')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    loadArchitects()
  }, [page, token])

  const createArchitect = async (event: FormEvent) => {
    event.preventDefault()
    if (!token) return
    setSaving(true)
    setError('')
    try {
      await apiFetch('/architects', { method: 'POST', body: JSON.stringify(form), token })
      setForm(emptyForm)
      setShowForm(false)
      toast.success('Architect added')
      await loadArchitects()
    } catch (e) {
      const message = e instanceof Error ? e.message : 'Unable to add architect'
      setError(message)
      toast.error(message)
    } finally {
      setSaving(false)
    }
  }

  const deleteArchitect = async () => {
    if (!token || !deleteTarget) return
    try {
      await apiFetch(`/architects/${deleteTarget._id}`, { method: 'DELETE', token })
      setArchitects((items) => items.filter((item) => item._id !== deleteTarget._id))
      setMeta((current) => ({ ...current, total: Math.max(current.total - 1, 0) }))
      setDeleteTarget(undefined)
      toast.success('Architect deleted')
    } catch (e) {
      const message = e instanceof Error ? e.message : 'Unable to delete architect'
      setError(message)
      toast.error(message)
    }
  }

  const columns = useMemo<ColumnDef<ArchitectType>[]>(
    () => [
      { header: '#', cell: ({ row }) => row.index + 1 },
      {
        header: 'Name',
        cell: ({ row: { original } }) => (
          <div>
            <div className="fw-medium">{original.name}</div>
            <small className="text-muted">{original.specialty || '-'}</small>
          </div>
        ),
      },
      { header: 'Mobile', accessorKey: 'phone' },
      { header: 'Email', cell: ({ row: { original } }) => original.email || '-' },
      { header: 'Company', cell: ({ row: { original } }) => original.company || '-' },
      { header: 'City', cell: ({ row: { original } }) => original.city || '-' },
      {
        header: 'Action',
        cell: ({ row: { original } }) => (
          <Button size="sm" variant="outline-danger" onClick={() => setDeleteTarget(original)}>
            Delete
          </Button>
        ),
      },
    ],
    [],
  )

  return (
    <>
      <PageMetaData title="My Architects" />
      <div className="d-flex justify-content-between align-items-start gap-3 flex-wrap mb-3">
        <div>
          <h4 className="mb-1">My Architects</h4>
          <p className="text-muted mb-0">Keep the architect contacts you are working with in one private list.</p>
        </div>
        <Button onClick={() => setShowForm(true)}>
          <IconifyIcon icon="bx:plus" className="me-1" />
          Add Architect
        </Button>
      </div>
      <Alert variant="primary" className="d-flex align-items-start gap-2">
        <IconifyIcon icon="bx:lock-alt" className="fs-20 mt-1" />
        <div>
          <strong>Your private list</strong>
          <div className="mt-1">Add architect details here. Only you can see and delete the contacts you add.</div>
        </div>
      </Alert>
      <Card className="border-0 shadow-sm">
        <CardBody>
          <div className="d-flex justify-content-between align-items-center gap-2 mb-3">
            <div>
              <h5 className="mb-0">Architect contacts</h5>
              <small className="text-muted">
                {loading ? 'Loading contacts...' : `${meta.total} contact${meta.total === 1 ? '' : 's'} in your list`}
              </small>
            </div>
          </div>
          {error && <Alert variant="danger">{error}</Alert>}
          {loading ? (
            <div className="text-center py-5">
              <Spinner className="spinner-border-sm me-2" tag="span" />
              Loading...
            </div>
          ) : !architects.length ? (
            <div className="text-center py-5">
              <IconifyIcon icon="bx:user-plus" className="display-5 text-primary" />
              <h5 className="mt-3 mb-1">Start your architect list</h5>
              <p className="text-muted mb-3">Add the first architect contact you are working with.</p>
              <Button onClick={() => setShowForm(true)}>
                <IconifyIcon icon="bx:plus" className="me-1" />
                Add First Architect
              </Button>
            </div>
          ) : (
            <ReactTable columns={columns} data={architects} pageSize={25} tableClass="text-nowrap mb-0" theadClass="bg-light bg-opacity-50" />
          )}
          {meta.totalPages > 1 && (
            <div className="d-flex justify-content-end gap-2 mt-3">
              <Button size="sm" variant="outline-secondary" disabled={loading || page <= 1} onClick={() => setPage((value) => value - 1)}>
                Previous
              </Button>
              <Button
                size="sm"
                variant="outline-secondary"
                disabled={loading || page >= meta.totalPages}
                onClick={() => setPage((value) => value + 1)}>
                Next
              </Button>
            </div>
          )}
        </CardBody>
      </Card>
      <Modal show={showForm} onHide={() => setShowForm(false)} centered>
        <Form onSubmit={createArchitect}>
          <Modal.Header closeButton>
            <div>
              <Modal.Title>Add Architect</Modal.Title>
              <div className="text-muted fs-13 mt-1">This contact will be visible only in your architect list.</div>
            </div>
          </Modal.Header>
          <Modal.Body>
            <Row className="g-3">
              {(
                [
                  ['name', 'Name', true],
                  ['phone', 'Mobile number', true],
                  ['email', 'Email'],
                  ['company', 'Company'],
                  ['city', 'City'],
                  ['specialty', 'Specialty'],
                ] as const
              ).map(([field, label, required]) => (
                <Form.Group as={Col} md={field === 'specialty' ? 12 : 6} key={field}>
                  <Form.Label>{label}</Form.Label>
                  <Form.Control
                    required={required}
                    type={field === 'email' ? 'email' : field === 'phone' ? 'tel' : 'text'}
                    value={form[field]}
                    placeholder={field === 'specialty' ? 'Residential, commercial, hospitality...' : label}
                    onChange={(event) => setForm({ ...form, [field]: event.target.value })}
                  />
                </Form.Group>
              ))}
              <Form.Group as={Col} xs={12}>
                <Form.Label>Notes</Form.Label>
                <Form.Control
                  as="textarea"
                  rows={3}
                  placeholder="Requirements, project details, or next step"
                  value={form.notes}
                  onChange={(event) => setForm({ ...form, notes: event.target.value })}
                />
              </Form.Group>
            </Row>
          </Modal.Body>
          <Modal.Footer>
            <Button variant="light" type="button" onClick={() => setShowForm(false)}>
              Cancel
            </Button>
            <Button type="submit" disabled={saving}>
              {saving ? 'Saving...' : 'Add Architect'}
            </Button>
          </Modal.Footer>
        </Form>
      </Modal>
      <DeleteConfirmModal
        show={!!deleteTarget}
        title="Delete architect?"
        itemName={deleteTarget?.name}
        onCancel={() => setDeleteTarget(undefined)}
        onConfirm={deleteArchitect}
      />
    </>
  )
}

export default MyArchitectsPage
