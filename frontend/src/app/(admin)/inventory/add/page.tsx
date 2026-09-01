import PageMetaData from '@/components/PageTitle'
import { apiFetch } from '@/helpers/api'
import { FormEvent, useEffect, useState } from 'react'
import { Alert, Button, Card, CardBody, Col, Form, Row } from 'react-bootstrap'
import { useNavigate, useParams } from 'react-router-dom'

type Field = { key: string; label: string; type: 'string' | 'number' | 'boolean' | 'date'; required: boolean; unit?: string }
type Category = { _id: string; slug: string; label: string; fields: Field[] }
type Supplier = { _id: string; name: string }
type Attachment = { key: string; originalName: string; contentType: string; size: number; checksum: string; attachmentToken: string }
type MaterialForm = {
  sku: string
  productCode: string
  category: string
  name: string
  description: string
  hsnCode: string
  unit: string
  materialType: 'SHEET' | 'TUBE' | 'OTHER'
  defaultDimensions: { heightFt?: number; widthFt?: number; lengthFt?: number }
  quantityInStock: number
  minStockLevel: number
  location: string
  supplier: string
  shadeName: string
  shadeCode: string
  unitCost: number
  productImage?: Attachment
  shadeImage?: Attachment
  specs: Record<string, unknown>
}
const blank: MaterialForm = {
  sku: '',
  productCode: '',
  category: '',
  name: '',
  description: '',
  hsnCode: '0000',
  unit: 'pcs',
  materialType: 'OTHER',
  defaultDimensions: {},
  quantityInStock: 0,
  minStockLevel: 0,
  location: '',
  supplier: '',
  shadeName: '',
  shadeCode: '',
  unitCost: 0,
  specs: {},
}

export default function AddInventoryItemPage() {
  const navigate = useNavigate()
  const { itemId } = useParams()
  const [categories, setCategories] = useState<Category[]>([])
  const [suppliers, setSuppliers] = useState<Supplier[]>([])
  const [form, setForm] = useState<MaterialForm>(blank)
  const [error, setError] = useState('')
  const [saving, setSaving] = useState(false)
  const [uploading, setUploading] = useState<'productImage' | 'shadeImage'>()
  useEffect(() => {
    if (!itemId) return
    document.querySelectorAll<HTMLLabelElement>('label').forEach((label) => {
      if (!['Opening stock', 'Minimum stock'].includes(label.textContent || '')) return
      const input = label.parentElement?.querySelector<HTMLInputElement>('input')
      if (input) {
        input.readOnly = true
        input.title = 'Stock levels can only be changed through + Quantity.'
      }
    })
  }, [itemId])
  useEffect(() => {
    document.querySelector<HTMLInputElement>('input[placeholder="Supplier code"]')?.setAttribute('placeholder', 'Product code')
  }, [])
  useEffect(() => {
    const select = [...document.querySelectorAll<HTMLSelectElement>('select')].find((element) =>
      [...element.options].some((option) => option.value === 'pcs'),
    )
    if (!select) return
    const units = [
      ['pcs', 'Pieces (PCS)'],
      ['nos', 'Numbers (NOS)'],
      ['sheet', 'Sheet'],
      ['ft', 'Feet (FT)'],
      ['meter', 'Meter'],
      ['running_meter', 'Running Meter'],
      ['sq_ft', 'Square Feet'],
      ['sq_m', 'Square Meter'],
      ['kg', 'Kilogram'],
      ['box', 'Box'],
      ['set', 'Set'],
      ['roll', 'Roll'],
      ['bundle', 'Bundle'],
    ]
    select.replaceChildren(...units.map(([value, label]) => new Option(label, value, false, value === form.unit)))
  }, [form.unit])
  useEffect(() => {
    Promise.all([
      apiFetch<{ data: Category[] }>('/inventory/item-categories'),
      ...(itemId ? [apiFetch<{ data: MaterialForm }>(`/inventory/items/${itemId}`)] : []),
    ])
      .then(([categoryResponse, itemResponse]) => {
        setCategories(categoryResponse.data)
        if (itemResponse) setForm(itemResponse.data)
      })
      .catch((reason) => setError(reason instanceof Error ? reason.message : 'Unable to load material'))
  }, [itemId])
  useEffect(() => {
    apiFetch<{ data: Supplier[] }>('/inventory/suppliers?status=active')
      .then((response) => setSuppliers(response.data))
      .catch(() => {})
  }, [])
  const category = categories.find((item) => item.slug === form.category)
  const upload = async (kind: 'productImage' | 'shadeImage', file?: File) => {
    if (!file) return
    setUploading(kind)
    setError('')
    try {
      const body = new FormData()
      body.append('files', file)
      const response = await apiFetch<{ data: Attachment[] }>('/inventory/uploads', { method: 'POST', body })
      setForm((current) => ({ ...current, [kind]: response.data[0] }))
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : 'Unable to upload image')
    } finally {
      setUploading(undefined)
    }
  }
  const save = async (event: FormEvent) => {
    event.preventDefault()
    if (uploading) return
    setSaving(true)
    setError('')
    try {
      await apiFetch(itemId ? `/inventory/items/${itemId}` : '/inventory/items', { method: itemId ? 'PATCH' : 'POST', body: JSON.stringify(form) })
      navigate('/inventory')
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : 'Unable to save material')
    } finally {
      setSaving(false)
    }
  }
  const specInput = (field: Field) => (
    <Col md={6} key={field.key}>
      <Form.Label>
        {field.label}
        {field.unit ? ` (${field.unit})` : ''}
      </Form.Label>
      <Form.Control
        required={field.required}
        type={field.type === 'number' ? 'number' : field.type === 'date' ? 'date' : 'text'}
        value={String(form.specs[field.key] ?? '')}
        onChange={(event) =>
          setForm({ ...form, specs: { ...form.specs, [field.key]: field.type === 'number' ? Number(event.target.value) : event.target.value } })
        }
      />
    </Col>
  )
  const imageInput = (kind: 'productImage' | 'shadeImage', label: string) => (
    <>
      {kind === 'productImage' && (
        <Col md={6}>
          <Form.Label>Supplier</Form.Label>
          <Form.Select value={form.supplier || ''} onChange={(event) => setForm({ ...form, supplier: event.target.value })}>
            <option value="">No supplier selected</option>
            {suppliers.map((supplier) => (
              <option key={supplier._id} value={supplier._id}>
                {supplier.name}
              </option>
            ))}
          </Form.Select>
          <Form.Text>
            <a href="/inventory/suppliers">Add supplier</a>
          </Form.Text>
        </Col>
      )}
      <Col md={6}>
        <Form.Label>
          {label} <small className="text-muted">(optional)</small>
        </Form.Label>
        <Form.Control
          accept="image/jpeg,image/png,image/webp"
          type="file"
          onChange={(event) => upload(kind, (event.currentTarget as HTMLInputElement).files?.[0])}
        />
        <Form.Text>{uploading === kind ? 'Uploading…' : form[kind]?.originalName || 'JPG, PNG, or WebP; up to 10 MB.'}</Form.Text>
      </Col>
    </>
  )
  const dimensionInput = (key: 'heightFt' | 'widthFt' | 'lengthFt', label: string) => (
    <Col md={3}>
      <Form.Label>{label}</Form.Label>
      <Form.Control
        required
        type="number"
        min="0.01"
        step="0.01"
        value={form.defaultDimensions[key] ?? ''}
        onChange={(event) =>
          setForm({
            ...form,
            defaultDimensions: { ...form.defaultDimensions, [key]: event.target.value === '' ? undefined : Number(event.target.value) },
          })
        }
      />
    </Col>
  )
  return (
    <>
      <PageMetaData title={itemId ? 'Update Material' : 'Add Material'} />
      <div className="mb-3">
        <h4 className="mb-1">{itemId ? 'Update Material' : 'Add Material'}</h4>
        <p className="text-muted mb-0">Select a category to load its material fields.</p>
      </div>
      {error && <Alert variant="danger">{error}</Alert>}
      <Card>
        <CardBody>
          <Form onSubmit={save}>
            <Row className="g-3">
              <Col md={6}>
                <Form.Label>Category</Form.Label>
                <Form.Select required value={form.category} onChange={(event) => setForm({ ...form, category: event.target.value, specs: {} })}>
                  <option value="">Select category</option>
                  {categories.map((category) => (
                    <option key={category._id} value={category.slug}>
                      {category.label}
                    </option>
                  ))}
                </Form.Select>
              </Col>
              <Col md={3}>
                <Form.Label>SKU</Form.Label>
                <Form.Control required value={form.sku} onChange={(event) => setForm({ ...form, sku: event.target.value })} placeholder="TUBE-0003" />
              </Col>
              <Col md={3}>
                <Form.Label>
                  Product code <small className="text-muted">(optional)</small>
                </Form.Label>
                <Form.Control
                  value={form.productCode || ''}
                  onChange={(event) => setForm({ ...form, productCode: event.target.value })}
                  placeholder="Supplier code"
                />
              </Col>
              <Col md={6}>
                <Form.Label>Material name</Form.Label>
                <Form.Control required value={form.name} onChange={(event) => setForm({ ...form, name: event.target.value })} />
              </Col>
              <Col md={3}>
                <Form.Label>HSN code</Form.Label>
                <Form.Control value={form.hsnCode || ''} onChange={(event) => setForm({ ...form, hsnCode: event.target.value })} />
              </Col>
              <Col md={3}>
                <Form.Label>Unit</Form.Label>
                <Form.Select value={form.unit} onChange={(event) => setForm({ ...form, unit: event.target.value })}>
                  {['pcs', 'nos', 'sheet', 'ft', 'meter', 'running_meter', 'sq_ft', 'sq_m', 'kg', 'box', 'set', 'roll', 'bundle'].map((unit) => (
                    <option key={unit}>{unit}</option>
                  ))}
                </Form.Select>
              </Col>
              <Col md={3}>
                <Form.Label>Laser-cut material type</Form.Label>
                <Form.Select
                  value={form.materialType}
                  onChange={(event) => {
                    const materialType = event.target.value as MaterialForm['materialType']
                    setForm({ ...form, materialType, unit: materialType === 'SHEET' ? 'sheet' : materialType === 'TUBE' ? 'pcs' : form.unit, defaultDimensions: {} })
                  }}>
                  <option value="OTHER">Other</option>
                  <option value="SHEET">Sheet</option>
                  <option value="TUBE">Tube</option>
                </Form.Select>
              </Col>
              {form.materialType === 'SHEET' && (
                <>
                  {dimensionInput('heightFt', 'Default height (ft)')}
                  {dimensionInput('widthFt', 'Default width (ft)')}
                </>
              )}
              {form.materialType === 'TUBE' && dimensionInput('lengthFt', 'Default length (ft)')}
              <Col md={4}>
                <Form.Label>{form.materialType === 'SHEET' ? 'Opening sheet stock' : form.materialType === 'TUBE' ? 'Opening tube stock' : 'Opening stock'}</Form.Label>
                <Form.Control
                  required
                  type="number"
                  min={0}
                  value={form.quantityInStock}
                  onChange={(event) => setForm({ ...form, quantityInStock: Number(event.target.value) })}
                />
              </Col>
              <Col md={4}>
                <Form.Label>Minimum stock</Form.Label>
                <Form.Control
                  required
                  type="number"
                  min={0}
                  value={form.minStockLevel}
                  onChange={(event) => setForm({ ...form, minStockLevel: Number(event.target.value) })}
                />
              </Col>
              <Col md={4}>
                <Form.Label>Location</Form.Label>
                <Form.Control value={form.location || ''} onChange={(event) => setForm({ ...form, location: event.target.value })} />
              </Col>
              <Col md={4}>
                <Form.Label>Unit cost</Form.Label>
                <Form.Control
                  type="number"
                  min={0}
                  value={form.unitCost}
                  onChange={(event) => setForm({ ...form, unitCost: Number(event.target.value) })}
                />
              </Col>
              <Col md={4}>
                <Form.Label>Shade name</Form.Label>
                <Form.Control required value={form.shadeName || ''} onChange={(event) => setForm({ ...form, shadeName: event.target.value })} placeholder="Powder coat white" />
              </Col>
              <Col md={4}>
                <Form.Label>Shade code</Form.Label>
                <Form.Control required value={form.shadeCode || ''} onChange={(event) => setForm({ ...form, shadeCode: event.target.value.toUpperCase() })} placeholder="RAL 9016" />
              </Col>
              {imageInput('productImage', 'Product image')}
              {imageInput('shadeImage', 'Shade image')}
              <Col xs={12}>
                <Form.Label>Description</Form.Label>
                <Form.Control value={form.description || ''} onChange={(event) => setForm({ ...form, description: event.target.value })} />
              </Col>
              {category?.fields.filter((field) => form.category !== 'sheet' || field.key !== 'size').map(specInput)}
            </Row>
            <div className="d-flex gap-2 mt-4">
              <Button type="submit" disabled={saving || Boolean(uploading)}>
                {saving ? 'Saving…' : itemId ? 'Update material' : 'Save material'}
              </Button>
              <Button variant="outline-secondary" type="button" onClick={() => navigate('/inventory')}>
                Cancel
              </Button>
            </div>
          </Form>
        </CardBody>
      </Card>
    </>
  )
}
