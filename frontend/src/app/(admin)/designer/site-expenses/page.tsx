import PageMetaData from '@/components/PageTitle'
import DropzoneFormInput from '@/components/form/DropzoneFormInput'
import { useAuthContext } from '@/context/useAuthContext'
import { apiFetch } from '@/helpers/api'
import { uploadMultipartFiles } from '@/helpers/upload'
import { canManageModule } from '@/helpers/moduleAccess'
import { useAuthStore } from '@/store/authStore'
import { FormEvent, useEffect, useMemo, useState } from 'react'
import { Alert, Badge, Button, Card, CardBody, Col, Form, Modal, Row, Table } from 'react-bootstrap'
import { toast } from 'react-toastify'

type Screenshot = { key: string; contentType: string; originalName?: string; attachmentToken: string; url?: string }
type Client = { _id: string; name: string }
type Site = { _id: string; name: string; parentClient: string; siteName?: string; siteAddress?: string }
type Category = { _id: string; name: string }
type ExpenseStatus = 'pending' | 'done' | 'canceled'
type SiteExpense = {
  _id: string
  client?: Client
  clientSite?: Site
  category?: string
  status?: ExpenseStatus
  title: string
  remark: string
  amount: number
  paymentScreenshot: Screenshot
  createdBy: { name: string }
  createdAt: string
}

const money = (amount: number) => new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR' }).format(amount)
const SEND_SAMPLE_CATEGORY = 'Send Sample'
const statusVariant = (status: SiteExpense['status']) =>
  ({ pending: 'warning', done: 'success', canceled: 'danger' })[status || 'pending'] || 'secondary'

const SiteExpensesPage = ({ createOnly = false }: { createOnly?: boolean }) => {
  const { user } = useAuthContext()
  const token = useAuthStore((state) => state.token)
  const canManage = canManageModule(user, 'site-expenses')
  const [clients, setClients] = useState<Client[]>([])
  const [sites, setSites] = useState<Site[]>([])
  const [categories, setCategories] = useState<Category[]>([])
  const [expenses, setExpenses] = useState<SiteExpense[]>([])
  const [createClient, setCreateClient] = useState('')
  const [createSite, setCreateSite] = useState('')
  const [category, setCategory] = useState('')
  const [status, setStatus] = useState<ExpenseStatus>('pending')
  const [filterClient, setFilterClient] = useState('')
  const [filterSite, setFilterSite] = useState('')
  const [title, setTitle] = useState('')
  const [remark, setRemark] = useState('')
  const [amount, setAmount] = useState('')
  const [screenshot, setScreenshot] = useState<File>()
  const [saving, setSaving] = useState(false)
  const [uploadProgress, setUploadProgress] = useState(0)
  const [error, setError] = useState('')
  const [editing, setEditing] = useState<SiteExpense>()
  const [editTitle, setEditTitle] = useState('')
  const [editRemark, setEditRemark] = useState('')
  const [editAmount, setEditAmount] = useState('')
  const [editStatus, setEditStatus] = useState<ExpenseStatus>('pending')
  const [editScreenshot, setEditScreenshot] = useState<File>()

  const availableSites = useMemo(() => sites.filter((site) => site.parentClient === createClient), [sites, createClient])
  const filterSites = useMemo(() => sites.filter((site) => site.parentClient === filterClient), [sites, filterClient])
  const isSample = category === SEND_SAMPLE_CATEGORY

  const load = async () => {
    setError('')
    try {
      const query = new URLSearchParams()
      if (filterClient) query.set('client', filterClient)
      if (filterSite) query.set('site', filterSite)
      const [clientSites, response, categoryResponse] = await Promise.all([
        apiFetch<{ data: { clients: Client[]; sites: Site[] } }>('/designer/site-expenses/client-sites'),
        apiFetch<{ data: SiteExpense[] }>(`/designer/site-expenses${query.size ? `?${query}` : ''}`),
        apiFetch<{ data: Category[] }>('/designer/site-expenses/categories'),
      ])
      setClients(clientSites.data.clients)
      setSites(clientSites.data.sites)
      setExpenses(response.data)
      setCategories(categoryResponse.data)
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : 'Unable to load miscellaneous expenses')
    }
  }

  useEffect(() => {
    load()
  }, [])

  const submit = async (event: FormEvent) => {
    event.preventDefault()
    if (!category) return setError('Choose an expense category')
    if ((!isSample && (!createClient || !createSite)) || Boolean(createClient) !== Boolean(createSite))
      return setError('Choose both a client and site address, or leave both blank for Send Sample')
    if (!screenshot) return setError('Choose a payment screenshot')
    setSaving(true)
    setError('')
    try {
      const [paymentScreenshot] = await uploadMultipartFiles<Screenshot>([screenshot], token || '', setUploadProgress, '/designer/site-expenses/uploads')
      await apiFetch('/designer/site-expenses', {
        method: 'POST',
        body: JSON.stringify({
          client: createClient,
          clientSite: createSite,
          category,
          status,
          title,
          remark,
          amount: Number(amount),
          paymentScreenshot,
        }),
      })
      toast.success('Site expense added')
      setTitle('')
      setCategory('')
      setStatus('pending')
      setRemark('')
      setAmount('')
      setScreenshot(undefined)
      setCreateClient('')
      setCreateSite('')
      await load()
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : 'Unable to add site expense')
    } finally {
      setSaving(false)
    }
  }

  const openEdit = (expense: SiteExpense) => {
    setEditing(expense)
    setEditTitle(expense.title)
    setEditRemark(expense.remark)
    setEditAmount(String(expense.amount))
    setEditStatus(expense.status || 'pending')
    setEditScreenshot(undefined)
    setError('')
  }

  const saveEdit = async (event: FormEvent) => {
    event.preventDefault()
    if (!editing) return
    setSaving(true)
    setError('')
    try {
      let paymentScreenshot: Screenshot | undefined
      if (editScreenshot) {
        paymentScreenshot = (await uploadMultipartFiles<Screenshot>([editScreenshot], token || '', setUploadProgress, '/designer/site-expenses/uploads'))[0]
      }
      await apiFetch(`/designer/site-expenses/${editing._id}`, {
        method: 'PATCH',
        body: JSON.stringify({
          title: editTitle,
          remark: editRemark,
          amount: Number(editAmount),
          status: editStatus,
          ...(paymentScreenshot ? { paymentScreenshot } : {}),
        }),
      })
      toast.success('Expense updated')
      setEditing(undefined)
      await load()
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : 'Unable to update expense')
    } finally {
      setSaving(false)
    }
  }

  return (
    <>
      <PageMetaData title={createOnly ? 'Add Expense' : 'Miscellaneous Expenses'} />
      <Card className="mb-3">
        <CardBody>
          <div className="d-flex justify-content-between align-items-start flex-wrap gap-3">
            <div>
              <h4 className="card-title mb-1">{createOnly ? 'Add Expense' : 'Miscellaneous Expenses'}</h4>
              <p className="text-muted mb-0">Record miscellaneous payments made for each client site, with proof of payment.</p>
            </div>
            <Button variant="outline-secondary" onClick={load} disabled={saving}>
              Refresh
            </Button>
          </div>
          {error && (
            <Alert className="mt-3 mb-0" variant="danger">
              {error}
            </Alert>
          )}
        </CardBody>
      </Card>
      {createOnly && (
        <Card className="mb-3">
          <CardBody>
            <h5 className="mb-3">Add expense</h5>
            <Form onSubmit={submit}>
              <Row className="g-3">
                <Col md={6}>
                  <Form.Label htmlFor="expense-client">Client</Form.Label>
                  <Form.Select
                    id="expense-client"
                    required={!isSample}
                    value={createClient}
                    onChange={(event) => {
                      setCreateClient(event.target.value)
                      setCreateSite('')
                    }}>
                    <option value="">{isSample ? 'No client selected' : 'Select client'}</option>
                    {clients.map((client) => (
                      <option key={client._id} value={client._id}>
                        {client.name}
                      </option>
                    ))}
                  </Form.Select>
                  {isSample && <Form.Text>Optional for Send Sample.</Form.Text>}
                </Col>
                <Col md={6}>
                  <Form.Label htmlFor="expense-site">Client address</Form.Label>
                  <Form.Select
                    id="expense-site"
                    required={!isSample || Boolean(createClient)}
                    disabled={!createClient}
                    value={createSite}
                    onChange={(event) => setCreateSite(event.target.value)}>
                    <option value="">Select address</option>
                    {availableSites.map((site) => (
                      <option key={site._id} value={site._id}>
                        {site.siteName || site.name} — {site.siteAddress}
                      </option>
                    ))}
                  </Form.Select>
                </Col>
                <Col md={6}>
                  <Form.Label htmlFor="expense-category">Expense category</Form.Label>
                  <Form.Select id="expense-category" required value={category} onChange={(event) => setCategory(event.target.value)}>
                    <option value="">Select category</option>
                    {categories.map((item) => (
                      <option key={item._id} value={item.name}>
                        {item.name}
                      </option>
                    ))}
                  </Form.Select>
                  <Form.Text>Create Site Helper, Porter, or other categories from the Expense Categories page.</Form.Text>
                </Col>
                <Col md={6}>
                  <Form.Label htmlFor="expense-status">Status</Form.Label>
                  <Form.Select
                    id="expense-status"
                    value={status}
                    onChange={(event) => setStatus(event.target.value as NonNullable<SiteExpense['status']>)}>
                    <option value="pending">Pending</option>
                    <option value="done">Done</option>
                    <option value="canceled">Canceled</option>
                  </Form.Select>
                </Col>
                <Col md={6}>
                  <Form.Label htmlFor="expense-title">Title</Form.Label>
                  <Form.Control
                    id="expense-title"
                    required
                    maxLength={160}
                    value={title}
                    onChange={(event) => setTitle(event.target.value)}
                    placeholder="e.g. Sample courier charge"
                  />
                </Col>
                <Col md={6}>
                  <Form.Label htmlFor="expense-amount">Payment amount</Form.Label>
                  <Form.Control
                    id="expense-amount"
                    required
                    type="number"
                    min="0.01"
                    step="0.01"
                    value={amount}
                    onChange={(event) => setAmount(event.target.value)}
                    placeholder="0.00"
                  />
                </Col>
                <Col xs={12}>
                  <Form.Label htmlFor="expense-remark">Why was this payment made?</Form.Label>
                  <Form.Control
                    id="expense-remark"
                    required
                    as="textarea"
                    rows={3}
                    maxLength={2000}
                    value={remark}
                    onChange={(event) => setRemark(event.target.value)}
                    placeholder="Briefly explain the payment."
                  />
                </Col>
                <Col xs={12}>
                  <DropzoneFormInput label="Payment screenshot" text="Drop the payment screenshot here, or browse" showPreview={false} accept={{ 'image/jpeg': ['.jpg', '.jpeg'], 'image/png': ['.png'], 'image/webp': ['.webp'] }} maxFiles={1} disabled={saving} uploading={saving} uploadProgress={uploadProgress} onFileUpload={(files) => setScreenshot(files[0])} />
                  <Form.Text>JPG, PNG, or WebP, up to 10 MB.</Form.Text>
                </Col>
                <Col xs={12}>
                  <Button type="submit" disabled={saving}>
                    {saving ? 'Saving…' : 'Save expense'}
                  </Button>
                </Col>
              </Row>
            </Form>
          </CardBody>
        </Card>
      )}
      {!createOnly && (
        <Card>
          <CardBody>
            <div className="row g-2 mb-3">
              <div className="col-md-6">
                <Form.Label className="visually-hidden" htmlFor="expense-filter-client">
                  Client
                </Form.Label>
                <Form.Select
                  id="expense-filter-client"
                  value={filterClient}
                  onChange={(event) => {
                    setFilterClient(event.target.value)
                    setFilterSite('')
                  }}>
                  <option value="">All clients</option>
                  {clients.map((client) => (
                    <option key={client._id} value={client._id}>
                      {client.name}
                    </option>
                  ))}
                </Form.Select>
              </div>
              <div className="col-md-6">
                <Form.Label className="visually-hidden" htmlFor="expense-filter-site">
                  Client address
                </Form.Label>
                <Form.Select
                  id="expense-filter-site"
                  disabled={!filterClient}
                  value={filterSite}
                  onChange={(event) => setFilterSite(event.target.value)}>
                  <option value="">All addresses</option>
                  {filterSites.map((site) => (
                    <option key={site._id} value={site._id}>
                      {site.siteName || site.name} — {site.siteAddress}
                    </option>
                  ))}
                </Form.Select>
              </div>
            </div>
            <div className="d-flex justify-content-between align-items-center mb-3">
              <h5 className="mb-0">All miscellaneous expenses</h5>
              <Button size="sm" variant="outline-primary" onClick={load} disabled={saving}>
                Apply filters
              </Button>
            </div>
            <Table responsive hover className="mb-0" style={{ minWidth: 1260 }}>
              <thead>
                <tr>
                  <th>Expense</th>
                  <th>Category</th>
                  <th>Status</th>
                  <th>Client / site</th>
                  <th>Amount</th>
                  <th>Entered by</th>
                  <th>Date</th>
                  <th style={{ minWidth: 190 }} />
                </tr>
              </thead>
              <tbody>
                {expenses.map((expense) => (
                  <tr key={expense._id}>
                    <td style={{ minWidth: 240 }}>
                      <div className="fw-semibold">{expense.title}</div>
                      <small className="text-muted">{expense.remark}</small>
                    </td>
                    <td>
                      <Badge bg={expense.category === SEND_SAMPLE_CATEGORY ? 'warning' : 'secondary'}>{expense.category || 'Uncategorized'}</Badge>
                    </td>
                    <td>
                      <Badge bg={statusVariant(expense.status)}>{expense.status || 'pending'}</Badge>
                    </td>
                    <td>
                      {expense.client ? (
                        <>
                          <div>{expense.client.name}</div>
                          <small className="text-muted">
                            {expense.clientSite?.siteName || expense.clientSite?.name}
                            {expense.clientSite?.siteAddress && ` — ${expense.clientSite.siteAddress}`}
                          </small>
                        </>
                      ) : (
                        <span className="text-muted">No client (sample)</span>
                      )}
                    </td>
                    <td className="text-nowrap">{money(expense.amount)}</td>
                    <td>{expense.createdBy.name}</td>
                    <td className="text-nowrap">{new Date(expense.createdAt).toLocaleDateString()}</td>
                    <td className="text-end">
                      <div className="d-inline-flex align-items-center gap-2 flex-nowrap">
                        {expense.paymentScreenshot.url ? (
                          <a href={expense.paymentScreenshot.url} target="_blank" rel="noreferrer">
                            <Button size="sm" variant="outline-primary" className="text-nowrap">
                              View proof
                            </Button>
                          </a>
                        ) : (
                          'Unavailable'
                        )}
                        {canManage && expense.status !== 'done' && (
                          <Button size="sm" variant="outline-secondary" className="text-nowrap" onClick={() => openEdit(expense)}>
                            Update
                          </Button>
                        )}
                        {expense.status === 'done' && <Badge bg="dark">Locked</Badge>}
                      </div>
                    </td>
                  </tr>
                ))}
                {!expenses.length && (
                  <tr>
                    <td colSpan={8} className="text-center text-muted py-4">
                      No miscellaneous expenses found.
                    </td>
                  </tr>
                )}
              </tbody>
            </Table>
          </CardBody>
        </Card>
      )}
      <Modal show={Boolean(editing)} onHide={() => !saving && setEditing(undefined)} centered>
        <Form onSubmit={saveEdit}>
          <Modal.Header closeButton>
            <Modal.Title>Update payment</Modal.Title>
          </Modal.Header>
          <Modal.Body>
            {error && <Alert variant="danger">{error}</Alert>}
            <Row className="g-3">
              <Col xs={12}>
                <Form.Label htmlFor="edit-expense-title">Title</Form.Label>
                <Form.Control
                  id="edit-expense-title"
                  required
                  maxLength={160}
                  value={editTitle}
                  onChange={(event) => setEditTitle(event.target.value)}
                />
              </Col>
              <Col md={6}>
                <Form.Label htmlFor="edit-expense-amount">Payment amount</Form.Label>
                <Form.Control
                  id="edit-expense-amount"
                  required
                  type="number"
                  min="0.01"
                  step="0.01"
                  value={editAmount}
                  onChange={(event) => setEditAmount(event.target.value)}
                />
              </Col>
              <Col md={6}>
                <Form.Label htmlFor="edit-expense-status">Status</Form.Label>
                <Form.Select id="edit-expense-status" value={editStatus} onChange={(event) => setEditStatus(event.target.value as ExpenseStatus)}>
                  <option value="pending">Pending</option>
                  <option value="done">Done</option>
                  <option value="canceled">Canceled</option>
                </Form.Select>
                <Form.Text>Done locks this expense from further changes.</Form.Text>
              </Col>
              <Col xs={12}>
                <Form.Label htmlFor="edit-expense-remark">Why was this payment made?</Form.Label>
                <Form.Control
                  id="edit-expense-remark"
                  required
                  as="textarea"
                  rows={3}
                  maxLength={2000}
                  value={editRemark}
                  onChange={(event) => setEditRemark(event.target.value)}
                />
              </Col>
              <Col xs={12}>
                <DropzoneFormInput label="Replace payment screenshot" text="Drop a replacement screenshot here, or browse" showPreview={false} accept={{ 'image/jpeg': ['.jpg', '.jpeg'], 'image/png': ['.png'], 'image/webp': ['.webp'] }} maxFiles={1} disabled={saving} uploading={saving} uploadProgress={uploadProgress} onFileUpload={(files) => setEditScreenshot(files[0])} />
                <Form.Text>Leave empty to keep the current screenshot.</Form.Text>
              </Col>
            </Row>
          </Modal.Body>
          <Modal.Footer>
            <Button variant="light" onClick={() => setEditing(undefined)} disabled={saving}>
              Cancel
            </Button>
            <Button type="submit" disabled={saving}>
              {saving ? 'Saving…' : 'Save changes'}
            </Button>
          </Modal.Footer>
        </Form>
      </Modal>
    </>
  )
}

export default SiteExpensesPage
