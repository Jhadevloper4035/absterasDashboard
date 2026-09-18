import PageMetaData from '@/components/PageTitle'
import DropzoneFormInput from '@/components/form/DropzoneFormInput'
import { apiFetch } from '@/helpers/api'
import { uploadMultipartFiles } from '@/helpers/upload'
import { useAuthStore } from '@/store/authStore'
import { FormEvent, useEffect, useState } from 'react'
import { Alert, Button, Card, CardBody, Col, Form, Row } from 'react-bootstrap'
import { Link, useNavigate, useParams } from 'react-router-dom'

type Field = { key: string; label: string; type: 'string' | 'number' | 'boolean' | 'date'; required: boolean; unit?: string }
type Category = { _id: string; slug: string; label: string; fields: Field[] }
type Supplier = { _id: string; name: string; address?: string }
type Attachment = { key: string; originalName: string; contentType: string; size: number; checksum: string; attachmentToken: string }
type MaterialForm = { sku: string; productCode: string; category: string; name: string; description: string; hsnCode: string; unit: string; materialType: 'SHEET' | 'TUBE' | 'OTHER'; defaultDimensions: { heightFt?: number; widthFt?: number; lengthFt?: number }; quantityInStock: number; minStockLevel: number; location: string; supplier: string; shadeName: string; shadeCode: string; unitCost: number; productImage?: Attachment; shadeImage?: Attachment; specs: Record<string, unknown> }

const units = [['pcs', 'Pieces (PCS)'], ['nos', 'Numbers (NOS)'], ['sheet', 'Sheet'], ['ft', 'Feet (FT)'], ['meter', 'Meter'], ['running_meter', 'Running Meter'], ['sq_ft', 'Square Feet'], ['sq_m', 'Square Meter'], ['kg', 'Kilogram'], ['box', 'Box'], ['set', 'Set'], ['roll', 'Roll'], ['bundle', 'Bundle']]
const hardwareTypes = [['silicone', 'Silicone / Sealant'], ['screw', 'Screw'], ['fastener', 'Fastener'], ['fevicol', 'Fevicol / Adhesive'], ['colour_spray', 'Colour spray'], ['other', 'Other']]
const blank: MaterialForm = { sku: '', productCode: '', category: '', name: '', description: '', hsnCode: '0000', unit: 'pcs', materialType: 'OTHER', defaultDimensions: {}, quantityInStock: 0, minStockLevel: 0, location: '', supplier: '', shadeName: '', shadeCode: '', unitCost: 0, specs: {} }
const materialTypeFor = (category: string): MaterialForm['materialType'] => category === 'sheet' ? 'SHEET' : category === 'tube' ? 'TUBE' : 'OTHER'

export default function AddInventoryItemPage() {
  const navigate = useNavigate()
  const { itemId } = useParams()
  const token = useAuthStore((state) => state.token)
  const [categories, setCategories] = useState<Category[]>([])
  const [suppliers, setSuppliers] = useState<Supplier[]>([])
  const [form, setForm] = useState<MaterialForm>(blank)
  const [error, setError] = useState('')
  const [saving, setSaving] = useState(false)
  const [uploading, setUploading] = useState<'productImage' | 'shadeImage'>()
  const [uploadProgress, setUploadProgress] = useState(0)
  const [creatingHardwareType, setCreatingHardwareType] = useState(false)

  useEffect(() => {
    Promise.all([apiFetch<{ data: Category[] }>('/inventory/item-categories'), ...(itemId ? [apiFetch<{ data: MaterialForm }>(`/inventory/items/${itemId}`)] : [])])
      .then(([categoryResponse, itemResponse]) => {
        setCategories(categoryResponse.data)
        if (itemResponse) {
          setForm({ ...itemResponse.data, materialType: materialTypeFor(itemResponse.data.category) })
        }
      })
      .catch((reason) => setError(reason instanceof Error ? reason.message : 'Unable to load material'))
  }, [itemId])

  useEffect(() => {
    apiFetch<{ data: Supplier[] }>('/inventory/suppliers?serviceType=purchase_material').then((response) => setSuppliers(response.data)).catch(() => {})
  }, [])

  const category = categories.find((item) => item.slug === form.category)
  const selectedVendor = suppliers.find((supplier) => supplier._id === form.supplier)
  const isRawMaterial = materialTypeFor(form.category) !== 'OTHER'
  const showsFinishFields = Boolean(form.category) && !['sheet', 'tube', 'profile', 'hardware'].includes(form.category)
  const categoryFields = category?.fields.filter((field) => !(form.category === 'profile' && ['size', 'code', 'codeOrSize'].includes(field.key)) && (!isRawMaterial || field.key !== 'coating')) || []
  const update = <K extends keyof MaterialForm>(key: K, value: MaterialForm[K]) => setForm({ ...form, [key]: value })

  const upload = async (kind: 'productImage' | 'shadeImage', file?: File) => {
    if (!file) return
    setUploading(kind)
    setError('')
    try {
      const [attachment] = await uploadMultipartFiles<Attachment>([file], token || '', setUploadProgress, '/inventory/uploads')
      setForm((current) => ({ ...current, [kind]: attachment }))
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

  const specInput = (field: Field) => {
    const hardwareType = String(form.specs.hardwareType || '')
    const isCustomHardwareType = creatingHardwareType || Boolean(hardwareType && !hardwareTypes.some(([value]) => value === hardwareType))
    const isAdhesive = form.category === 'hardware' && ['silicone', 'fevicol'].includes(hardwareType)
    const isColourSpray = form.category === 'hardware' && hardwareType === 'colour_spray'
    if (field.key === 'colorName' && !isColourSpray) return null
    if (isColourSpray && ['size', 'length'].includes(field.key)) return null
    if (field.key === 'bottleQuantity' && !isColourSpray) return null
    const label = field.key === 'width' ? 'Height' : isAdhesive && field.key === 'size' ? 'Pack size' : isAdhesive && field.key === 'length' ? 'Net quantity' : field.label
    const unit = isAdhesive && field.key === 'length' ? 'ml / g' : field.unit
    const labelWithUnit = unit && !label.toLowerCase().includes(unit.toLowerCase()) ? `${label} (${unit})` : label
    if (form.category === 'hardware' && field.key === 'hardwareType') return <Col md={6} key={field.key}><Form.Group><Form.Label>Hardware type</Form.Label><Form.Select required value={isCustomHardwareType ? '__custom__' : hardwareType} onChange={(event) => { const value = event.target.value; const specs: Record<string, unknown> = { ...form.specs, hardwareType: value === '__custom__' ? '' : value }; if (value === 'colour_spray') { delete specs.size; delete specs.length; } else { delete specs.colorName; delete specs.bottleQuantity; } setCreatingHardwareType(value === '__custom__'); update('specs', specs) }}><option value="">Select hardware type</option>{hardwareTypes.map(([value, label]) => <option key={value} value={value}>{label}</option>)}<option value="__custom__">Create new type…</option></Form.Select>{isCustomHardwareType && <><Form.Label className="mt-2">New hardware type</Form.Label><Form.Control required value={hardwareType} placeholder="e.g. Wall plug" onChange={(event) => update('specs', { ...form.specs, hardwareType: event.target.value })} /><Form.Text>This type is saved with this material.</Form.Text></>}</Form.Group></Col>
    return <Col md={6} key={field.key}><Form.Group><Form.Label>{labelWithUnit}</Form.Label><Form.Control required={field.required || (form.category === 'hardware' && field.key === 'bottleQuantity' && isColourSpray) || (form.category === 'hardware' && !isColourSpray && ['size', 'length'].includes(field.key)) || (field.key === 'colorName' && isColourSpray)} min={field.key === 'bottleQuantity' ? 0.01 : undefined} step={field.key === 'bottleQuantity' ? 0.01 : undefined} type={field.type === 'number' ? 'number' : field.type === 'date' ? 'date' : 'text'} value={String(form.specs[field.key] ?? '')} onChange={(event) => update('specs', { ...form.specs, [field.key]: field.type === 'number' ? Number(event.target.value) : event.target.value })} /></Form.Group></Col>
  }
  const imageInput = (kind: 'productImage' | 'shadeImage', label: string) => <Col md={6}><Form.Group><Form.Label>{label} <small className="text-muted">(optional)</small></Form.Label><DropzoneFormInput text={`Drop the ${label.toLowerCase()} here, or browse`} showPreview={false} accept={{ 'image/jpeg': ['.jpg', '.jpeg'], 'image/png': ['.png'], 'image/webp': ['.webp'] }} maxFiles={1} disabled={Boolean(uploading)} uploading={uploading === kind} uploadProgress={uploadProgress} onFileUpload={(files) => upload(kind, files[0])} /><Form.Text>{uploading === kind ? 'Uploading…' : form[kind]?.originalName || 'JPG, PNG, or WebP; up to 10 MB.'}</Form.Text></Form.Group></Col>
  const dimensionInput = (key: 'heightFt' | 'widthFt' | 'lengthFt', label: string) => <Col md={4}><Form.Group><Form.Label>{label}</Form.Label><Form.Control required type="number" min="0.01" step="0.01" value={form.defaultDimensions[key] ?? ''} onChange={(event) => update('defaultDimensions', { ...form.defaultDimensions, [key]: event.target.value === '' ? undefined : Number(event.target.value) })} /></Form.Group></Col>

  return <>
    <PageMetaData title={itemId ? 'Update Material' : 'Add Material'} />
    <div className="d-flex justify-content-between align-items-start flex-wrap gap-2 mb-3"><div><h4 className="mb-1">{itemId ? 'Update Material' : 'Add Material'}</h4><p className="text-muted mb-0">Add the material, its specification, supplier, stock, and purchase rate.</p></div><Link className="btn btn-outline-secondary" to="/inventory">All materials</Link></div>
    {error && <Alert variant="danger" dismissible onClose={() => setError('')}>{error}</Alert>}
    <Card><CardBody><Form onSubmit={save}>
      <section><h5 className="mb-1">Basic material details</h5><p className="text-muted small mb-3">Choose the material category, then enter its identifying details.</p><Row className="g-3">
        <Col md={6}><Form.Group><Form.Label>Category <span className="text-danger">*</span></Form.Label><Form.Select required value={form.category} onChange={(event) => { const category = event.target.value; const materialType = materialTypeFor(category); const needsShadeDetails = !['sheet', 'tube', 'profile', 'hardware'].includes(category); setCreatingHardwareType(false); setForm({ ...form, category, materialType, unit: materialType === 'SHEET' ? 'sheet' : materialType === 'TUBE' ? 'pcs' : form.unit, defaultDimensions: {}, specs: {}, shadeName: needsShadeDetails ? form.shadeName : '', shadeCode: needsShadeDetails ? form.shadeCode : '', productImage: needsShadeDetails ? form.productImage : undefined, shadeImage: needsShadeDetails ? form.shadeImage : undefined }) }}><option value="">Select category</option>{categories.map((entry) => <option key={entry._id} value={entry.slug}>{entry.label}</option>)}</Form.Select></Form.Group></Col>
        <Col md={3}><Form.Group><Form.Label>SKU <span className="text-danger">*</span></Form.Label><Form.Control required value={form.sku} placeholder="TUBE-0003" onChange={(event) => update('sku', event.target.value)} /></Form.Group></Col>
        <Col md={3}><Form.Group><Form.Label>Product code <small className="text-muted">(optional)</small></Form.Label><Form.Control value={form.productCode} placeholder="Supplier product code" onChange={(event) => update('productCode', event.target.value)} /></Form.Group></Col>
        <Col md={6}><Form.Group><Form.Label>Material name <span className="text-danger">*</span></Form.Label><Form.Control required value={form.name} placeholder="e.g. Aluminium Tube 25x50" onChange={(event) => update('name', event.target.value)} /></Form.Group></Col>
        <Col md={3}><Form.Group><Form.Label>HSN code</Form.Label><Form.Control value={form.hsnCode} onChange={(event) => update('hsnCode', event.target.value)} /></Form.Group></Col>
        <Col md={3}><Form.Group><Form.Label>Unit</Form.Label><Form.Select value={form.unit} onChange={(event) => update('unit', event.target.value)}>{units.map(([value, label]) => <option key={value} value={value}>{label}</option>)}</Form.Select></Form.Group></Col>
        <Col xs={12}><Form.Group><Form.Label>Description <small className="text-muted">(optional)</small></Form.Label><Form.Control as="textarea" rows={3} value={form.description} placeholder="Optional material notes" onChange={(event) => update('description', event.target.value)} /></Form.Group></Col>
      </Row></section>

      <hr className="my-4" />
      <section><h5 className="mb-1">Specifications</h5><p className="text-muted small mb-3">Enter the size and technical specification for this material.</p><Row className="g-3">
        {form.materialType === 'SHEET' && <>{dimensionInput('heightFt', 'Sheet height (ft)')}{dimensionInput('widthFt', 'Sheet width (ft)')}</>}
        {form.materialType === 'TUBE' && dimensionInput('lengthFt', 'Tube length (ft)')}
        {categoryFields.map(specInput)}
        {!form.category && <Col xs={12}><p className="text-muted small mb-0">Select a category to show its specifications.</p></Col>}
      </Row></section>

      <hr className="my-4" />
      <section><h5 className="mb-1">Vendor, storage and pricing</h5><p className="text-muted small mb-3">Storage location follows the selected vendor address.</p><Row className="g-3">
        <Col md={6}><Form.Group><Form.Label>Purchase material vendor</Form.Label><Form.Select value={form.supplier} onChange={(event) => { const supplier = suppliers.find((entry) => entry._id === event.target.value); setForm({ ...form, supplier: event.target.value, location: supplier?.address || '' }) }}><option value="">No vendor selected</option>{suppliers.map((supplier) => <option key={supplier._id} value={supplier._id}>{supplier.name}</option>)}</Form.Select><Form.Text><Link to="/vendor-management/create">Create vendor</Link> if it is not listed.</Form.Text></Form.Group></Col>
        <Col md={6}><Form.Group><Form.Label>Storage location</Form.Label><Form.Control readOnly value={selectedVendor?.address || form.location} placeholder="Select a vendor to use its address" /><Form.Text>{selectedVendor?.address ? 'Copied from the vendor address.' : 'Add an address to the vendor to use it as the storage location.'}</Form.Text></Form.Group></Col>
        <Col md={4}><Form.Group><Form.Label>Opening quantity</Form.Label><Form.Control required readOnly={Boolean(itemId)} title={itemId ? 'Stock levels can only be changed through + Quantity.' : undefined} type="number" min={0} value={form.quantityInStock} onChange={(event) => update('quantityInStock', Number(event.target.value))} />{itemId && <Form.Text>Use + Quantity to change stock.</Form.Text>}</Form.Group></Col>
        <Col md={4}><Form.Group><Form.Label>Minimum quantity</Form.Label><Form.Control required readOnly={Boolean(itemId)} title={itemId ? 'Stock levels can only be changed through + Quantity.' : undefined} type="number" min={0} value={form.minStockLevel} onChange={(event) => update('minStockLevel', Number(event.target.value))} />{itemId && <Form.Text>Use + Quantity to change stock.</Form.Text>}</Form.Group></Col>
        <Col md={4}><Form.Group><Form.Label>Rate per piece</Form.Label><Form.Control type="number" min={0} step="0.01" value={form.unitCost} placeholder="0.00" onChange={(event) => update('unitCost', Number(event.target.value))} /></Form.Group></Col>
      </Row></section>

      {showsFinishFields && <><hr className="my-4" />
      <section><h5 className="mb-1">Finish and images</h5><p className="text-muted small mb-3">Shade information is required for Powder Coating workflows.</p><Row className="g-3">
        <Col md={6}><Form.Group><Form.Label>Shade name <span className="text-danger">*</span></Form.Label><Form.Control required value={form.shadeName} placeholder="e.g. Powder coat white" onChange={(event) => update('shadeName', event.target.value)} /></Form.Group></Col>
        <Col md={6}><Form.Group><Form.Label>Shade code <span className="text-danger">*</span></Form.Label><Form.Control required value={form.shadeCode} placeholder="e.g. RAL 9016" onChange={(event) => update('shadeCode', event.target.value.toUpperCase())} /></Form.Group></Col>
        {imageInput('productImage', 'Product image')}
        {imageInput('shadeImage', 'Shade image')}
      </Row></section></>}

      <div className="d-flex flex-wrap gap-2 mt-4"><Button type="submit" disabled={saving || Boolean(uploading)}>{saving ? 'Saving…' : itemId ? 'Update material' : 'Save material'}</Button><Button variant="outline-secondary" type="button" onClick={() => navigate('/inventory')}>Cancel</Button></div>
    </Form></CardBody></Card>
  </>
}
