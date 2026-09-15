import { FormEvent, useEffect, useMemo, useState } from 'react'
import { Alert, Badge, Button, Card, CardBody, Form } from 'react-bootstrap'
import { toast } from 'react-toastify'

import PageBreadcrumb from '@/components/layout/PageBreadcrumb'
import PageMetaData from '@/components/PageTitle'
import Spinner from '@/components/Spinner'
import { apiFetch } from '@/helpers/api'
import { useAuthStore } from '@/store/authStore'

const WorkTypes = () => {
  const token = useAuthStore((state) => state.token)
  const [workTypes, setWorkTypes] = useState<string[]>([])
  const [name, setName] = useState('')
  const [search, setSearch] = useState('')
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')

  const load = async () => {
    if (!token) return
    setLoading(true)
    setError('')
    try {
      const response = await apiFetch<{ data: Record<string, string[]> }>('/tasks/work-types', { token })
      setWorkTypes(response.data.general || [])
    } catch (requestError) {
      setError(requestError instanceof Error ? requestError.message : 'Unable to load work types')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    void load()
  }, [token])

  const createWorkType = async (event: FormEvent) => {
    event.preventDefault()
    const cleanName = name.trim()
    if (!token || !cleanName) return

    setSaving(true)
    setError('')
    try {
      await apiFetch('/tasks/work-types', { method: 'POST', token, body: JSON.stringify({ name: cleanName }) })
      setName('')
      toast.success('Work type saved')
      await load()
    } catch (requestError) {
      const message = requestError instanceof Error ? requestError.message : 'Unable to save work type'
      setError(message)
      toast.error(message)
    } finally {
      setSaving(false)
    }
  }

  const visibleWorkTypes = useMemo(() => workTypes.filter((workType) => workType.toLowerCase().includes(search.toLowerCase())), [search, workTypes])

  return (
    <>
      <PageBreadcrumb subName="Task Management" title="Work Types" />
      <PageMetaData title="Task Work Types" />
      <Card className="mb-4">
        <CardBody>
          <h4 className="card-title mb-1">Task work types</h4>
          <p className="text-muted">Add a work type available for every task.</p>
          {error && <Alert variant="danger">{error}</Alert>}
          <Form className="row g-3" onSubmit={createWorkType}>
            <div className="col-md-9"><Form.Label>Work type name</Form.Label><Form.Control required value={name} maxLength={60} onChange={(event) => setName(event.target.value)} placeholder="e.g. Site Visit" /></div>
            <div className="col-md-3 d-flex align-items-start pt-md-4"><Button className="w-100" type="submit" disabled={saving}>{saving ? 'Saving...' : 'Add Work Type'}</Button></div>
          </Form>
        </CardBody>
      </Card>
      <Card>
        <CardBody>
          <div className="d-flex justify-content-between align-items-center flex-wrap gap-2 mb-3"><div><h4 className="card-title mb-1">Your work types</h4><p className="text-muted mb-0">These choices appear for every task assignment.</p></div><Badge bg="light" text="dark">{workTypes.length} work types</Badge></div>
          <Form.Control className="mb-3" placeholder="Search work types" value={search} onChange={(event) => setSearch(event.target.value)} />
          {loading ? <div className="text-center py-4"><Spinner className="spinner-border-sm me-2" tag="span" />Loading work types...</div> : <div className="row g-3">{visibleWorkTypes.map((workType) => <div className="col-md-6 col-xl-4" key={workType}><Card className="h-100 border"><CardBody><h5 className="mb-0">{workType}</h5></CardBody></Card></div>)}{!visibleWorkTypes.length && <div className="col-12 text-center text-muted py-4">No matching work types found.</div>}</div>}
        </CardBody>
      </Card>
    </>
  )
}

export default WorkTypes
