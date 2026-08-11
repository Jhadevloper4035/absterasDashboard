import type { ReactNode } from 'react'
import { useState } from 'react'
import { Button, Spinner, type ButtonProps } from 'react-bootstrap'

type PdfActionButtonProps = ButtonProps & { action: () => Promise<unknown>; children: ReactNode }

const PdfActionButton = ({ action, children, disabled, ...props }: PdfActionButtonProps) => {
  const [loading, setLoading] = useState(false)
  return <Button {...props} disabled={disabled || loading} onClick={() => { setLoading(true); action().catch(() => {}).finally(() => setLoading(false)) }}>{loading && <Spinner animation="border" size="sm" className="me-2" />} {loading ? 'Generating PDF…' : children}</Button>
}

export default PdfActionButton
