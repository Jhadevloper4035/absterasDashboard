import { FormEvent, useEffect, useMemo, useState } from 'react'
import { Alert, Badge, Button, Card, CardBody, Col, Form, Row, Table } from 'react-bootstrap'
import { toast } from 'react-toastify'

import PageBreadcrumb from '@/components/layout/PageBreadcrumb'
import PageMetaData from '@/components/PageTitle'
import Spinner from '@/components/Spinner'
import IconifyIcon from '@/components/wrappers/IconifyIcon'
import { apiFetch } from '@/helpers/api'
import { defaultTaskWorkTypes, mergeTaskWorkTypes, taskWorkTypeRoles } from '@/helpers/taskWorkTypes'
import { useAuthStore } from '@/store/authStore'

const roleVariant: Record<string, string> = {
  accounts: 'warning',
  admin: 'primary',
  designers: 'secondary',
  operations: 'info',
  sales: 'success',
}

const roleLabel = (role: string) => role.replace(/\b\w/g, (letter) => letter.toUpperCase())

const WorkTypes = () => {
  const token = useAuthStore((state) => state.token)
  const [workTypesByRole, setWorkTypesByRole] = useState(defaultTaskWorkTypes)
  const [form, setForm] = useState({ role: 'sales', name: '' })
  const [loading, setLoading] = useState(false)
  const [saving, setSaving] = useState(false)
  const [deleting, setDeleting] = useState('')
  const [error, setError] = useState('')
  const rows = useMemo(() => Object.entries(workTypesByRole).sort(([a], [b]) => a.localeCompare(b)), [workTypesByRole])

  const load = async () => {
    if (!token) return
    setLoading(true)
    setError('')
    try {
      const response = await apiFetch<{ data: Record<string, string[]> }>('/tasks/work-types', { token })
      setWorkTypesByRole(mergeTaskWorkTypes(response.data, false))
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Unable to load work types')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    load()
  }, [token])

  const createWorkType = async (event: FormEvent) => {
    event.preventDefault()
    if (!token || !form.name.trim()) return

    setSaving(true)
    try {
      await apiFetch('/tasks/work-types', {
        method: 'POST',
        body: JSON.stringify(form),
        token,
      })
      setWorkTypesByRole((current) => mergeTaskWorkTypes({
        ...current,
        [form.role]: [...(current[form.role] || []), form.name.trim()],
      }))
      setForm((value) => ({ ...value, name: '' }))
      toast.success('Work type added')
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Unable to add work type')
    } finally {
      setSaving(false)
    }
  }

  const deleteWorkType = async (role: string, name: string) => {
    if (!token || !window.confirm(`Delete "${name}" from ${roleLabel(role)} work types?`)) return

    setDeleting(`${role}:${name}`)
    try {
      await apiFetch(`/tasks/work-types/${encodeURIComponent(role)}/${encodeURIComponent(name)}`, {
        method: 'DELETE',
        token,
      })
      setWorkTypesByRole((current) => ({
        ...current,
        [role]: (current[role] || []).filter((workType) => workType !== name),
      }))
      toast.success('Work type deleted')
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Unable to delete work type')
    } finally {
      setDeleting('')
    }
  }

  return (
    <>
      <PageBreadcrumb subName="Task Management" title="Work Types" />
      <PageMetaData title="Work Types" />
      <Row>
        <Col>
          <Card>
            <CardBody>
              <h4 className="card-title mb-3">Create Work Type</h4>
              {error && <Alert variant="danger">{error}</Alert>}
              <Form onSubmit={createWorkType} className="d-flex gap-2 flex-wrap">
                <div style={{ flex: '0 1 220px' }}>
                  <Form.Select value={form.role} onChange={(event) => setForm({ ...form, role: event.target.value })} aria-label="Role">
                    {taskWorkTypeRoles.map((role) => (
                      <option key={role} value={role}>
                        {role}
                      </option>
                    ))}
                  </Form.Select>
                </div>
                <div style={{ flex: '1 1 280px' }}>
                  <Form.Control value={form.name} onChange={(event) => setForm({ ...form, name: event.target.value })} placeholder="Work type name" />
                </div>
                <Button type="submit" disabled={saving || !form.name.trim()}>
                  {saving ? 'Saving...' : 'Add Work Type'}
                </Button>
              </Form>
            </CardBody>
          </Card>
          <Card className="overflow-hidden">
            <CardBody className="border-bottom">
              <div className="d-flex align-items-center justify-content-between gap-3 flex-wrap">
                <div>
                  <h4 className="card-title mb-1">All Work Types</h4>
                  <div className="text-muted fs-13">{rows.length} roles configured</div>
                </div>
                <Badge bg="primary-subtle" text="primary" className="fs-13 px-3 py-2">
                  {rows.reduce((total, [, workTypes]) => total + workTypes.length, 0)} options
                </Badge>
              </div>
            </CardBody>
            <CardBody className="p-0">
              {loading ? (
                <div className="p-4">
                  <Spinner className="spinner-border-sm me-2" tag="span" />
                  <span className="text-muted">Loading work types...</span>
                </div>
              ) : (
                <div className="table-responsive">
                  <Table hover className="mb-0 align-middle">
                    <thead className="bg-light bg-opacity-50">
                      <tr>
                        <th className="border-0 ps-4 py-3" style={{ width: 280 }}>Role</th>
                        <th className="border-0 py-3">Work Types</th>
                        <th className="border-0 pe-4 py-3 text-end" style={{ width: 120 }}>Total</th>
                      </tr>
                    </thead>
                    <tbody>
                      {rows.map(([role, workTypes]) => (
                        <tr key={role}>
                          <td className="ps-4">
                            <div className="d-flex align-items-center gap-3">
                              <span className={`avatar-sm rounded bg-${roleVariant[role] || 'primary'}-subtle text-${roleVariant[role] || 'primary'} d-inline-flex align-items-center justify-content-center fw-semibold`}>
                                {role.charAt(0).toUpperCase()}
                              </span>
                              <div>
                                <div className="fw-semibold">{roleLabel(role)}</div>
                                <div className="text-muted fs-13">{workTypes.length} work types</div>
                              </div>
                            </div>
                          </td>
                          <td style={{ whiteSpace: 'normal' }}>
                            <div className="d-flex gap-2 flex-wrap">
                              {workTypes.map((workType) => (
                                <span className="badge bg-light text-dark border px-2 py-1 fs-13 d-inline-flex align-items-center gap-2" key={workType}>
                                  <span>{workType}</span>
                                  <Button
                                    type="button"
                                    variant="link"
                                    className="p-0 lh-1 text-danger"
                                    disabled={deleting === `${role}:${workType}`}
                                    onClick={() => deleteWorkType(role, workType)}
                                    aria-label={`Delete ${workType}`}>
                                    {deleting === `${role}:${workType}` ? (
                                      <Spinner className="spinner-border-sm" tag="span" />
                                    ) : (
                                      <IconifyIcon icon="bx:x" className="fs-16" />
                                    )}
                                  </Button>
                                </span>
                              ))}
                            </div>
                          </td>
                          <td className="pe-4 text-end">
                            <Badge bg={`${roleVariant[role] || 'primary'}-subtle`} text={roleVariant[role] || 'primary'} className="px-2 py-1">
                              {workTypes.length}
                            </Badge>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </Table>
                </div>
              )}
            </CardBody>
          </Card>
        </Col>
      </Row>
    </>
  )
}

export default WorkTypes
