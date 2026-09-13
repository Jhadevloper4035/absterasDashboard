import PageMetaData from '@/components/PageTitle'
import { useAuthContext } from '@/context/useAuthContext'
import { apiFetch } from '@/helpers/api'
import { canManageModule } from '@/helpers/moduleAccess'
import { FormEvent, useEffect, useState } from 'react'
import { Alert, Button, Card, CardBody, Form, Table } from 'react-bootstrap'
import { toast } from 'react-toastify'

type Category = { _id: string; name: string; createdAt?: string; builtIn?: boolean }

const ExpenseCategoriesPage = () => {
  const { user } = useAuthContext()
  const canManage = canManageModule(user, 'site-expenses')
  const [categories, setCategories] = useState<Category[]>([])
  const [name, setName] = useState('')
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')

  const load = async () => {
    setError('')
    try {
      const response = await apiFetch<{ data: Category[] }>('/designer/site-expenses/categories')
      setCategories(response.data)
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : 'Unable to load expense categories')
    }
  }

  useEffect(() => { load() }, [])

  const submit = async (event: FormEvent) => {
    event.preventDefault()
    setSaving(true)
    setError('')
    try {
      await apiFetch('/designer/site-expenses/categories', { method: 'POST', body: JSON.stringify({ name }) })
      setName('')
      toast.success('Expense category added')
      await load()
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : 'Unable to add expense category')
    } finally {
      setSaving(false)
    }
  }

  return <>
    <PageMetaData title="Expense Categories" />
    <Card className="mb-3"><CardBody><h4 className="card-title mb-1">Expense Categories</h4><p className="text-muted mb-0">Send Sample is included for payments made before a client is finalised. Create other categories as needed.</p>{error && <Alert className="mt-3 mb-0" variant="danger">{error}</Alert>}</CardBody></Card>
    {canManage && <Card className="mb-3"><CardBody><Form onSubmit={submit}><Form.Label htmlFor="expense-category-name">Category name</Form.Label><div className="d-flex gap-2"><Form.Control id="expense-category-name" required maxLength={80} value={name} onChange={(event) => setName(event.target.value)} placeholder="e.g. Local travel" /><Button type="submit" disabled={saving} className="text-nowrap">{saving ? 'Saving…' : 'Add category'}</Button></div></Form></CardBody></Card>}
    <Card><CardBody><div className="d-flex justify-content-between align-items-center mb-3"><h5 className="mb-0">Categories</h5><Button size="sm" variant="outline-primary" onClick={load} disabled={saving}>Refresh</Button></div><Table responsive hover className="align-middle mb-0"><thead><tr><th>Category</th><th>Created</th></tr></thead><tbody>{categories.map((category) => <tr key={category._id}><td className="fw-semibold">{category.name}</td><td>{category.builtIn ? 'Built in' : category.createdAt ? new Date(category.createdAt).toLocaleDateString() : '—'}</td></tr>)}{!categories.length && <tr><td colSpan={2} className="text-center text-muted py-4">No expense categories found.</td></tr>}</tbody></Table></CardBody></Card>
  </>
}

export default ExpenseCategoriesPage
