export type ArchitectType = {
  _id: string
  name: string
  phone: string
  email?: string
  company?: string
  city?: string
  specialty?: string
  status?: 'active' | 'inactive'
  notes?: string
  createdAt?: string
}
