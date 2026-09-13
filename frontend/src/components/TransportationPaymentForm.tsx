import { apiFetch } from '@/helpers/api'
import { uploadMultipartFiles } from '@/helpers/upload'
import { useAuthStore } from '@/store/authStore'
import { FormEvent, useEffect, useState } from 'react'
import { Alert, Button, Form } from 'react-bootstrap'

type Attachment = { key: string; url?: string; originalName?: string; contentType?: string }
type TransportationPaymentFormProps = { cost?: number; screenshot?: Attachment; updatePath: string; uploadPath: string; onSaved: () => void }

export default function TransportationPaymentForm({ cost, screenshot, updatePath, uploadPath, onSaved }: TransportationPaymentFormProps) {
  const token = useAuthStore((state) => state.token)
  const [amount, setAmount] = useState(cost ? String(cost) : '')
  const [file, setFile] = useState<File>()
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  useEffect(() => setAmount(cost ? String(cost) : ''), [cost])

  const save = async (event: FormEvent) => {
    event.preventDefault()
    if (!token) return setError('Please sign in again before saving payment proof')
    if (!(Number(amount) > 0)) return setError('Enter the transportation payment amount')
    if (!file && !screenshot) return setError('Upload the payment screenshot')
    setSaving(true); setError('')
    try {
      const uploaded = file ? (await uploadMultipartFiles<Attachment>([file], token, undefined, uploadPath))[0] : undefined
      await apiFetch(updatePath, { method: 'PATCH', body: JSON.stringify({ transportationCost: Number(amount), ...(uploaded ? { transportationPaymentScreenshot: uploaded } : {}) }) })
      setFile(undefined)
      onSaved()
    } catch (reason) { setError(reason instanceof Error ? reason.message : 'Unable to save transportation payment') } finally { setSaving(false) }
  }

  return <Form className="border-top mt-3 pt-3" onSubmit={save}>
    <div className="fw-semibold mb-2">Transportation payment</div>
    <div className="row g-2 align-items-end">
      <div className="col-md-4"><Form.Label>Paid amount</Form.Label><Form.Control required type="number" min="0.01" step="0.01" value={amount} onChange={(event) => setAmount(event.target.value)} /></div>
      <div className="col-md-5"><Form.Label>Payment screenshot</Form.Label><Form.Control type="file" accept="image/jpeg,image/png,image/webp" onChange={(event) => setFile((event.target as HTMLInputElement).files?.[0])} /><Form.Text>{screenshot?.url ? <a href={screenshot.url} target="_blank" rel="noreferrer">View current proof</a> : 'PNG, JPG, or WEBP'}</Form.Text></div>
      <div className="col-md-3"><Button type="submit" disabled={saving}>{saving ? 'Saving…' : 'Save payment'}</Button></div>
    </div>
    {error && <Alert className="mt-2 mb-0" variant="danger">{error}</Alert>}
  </Form>
}
