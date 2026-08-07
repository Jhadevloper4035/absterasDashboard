import type { UserType } from './auth'

export type OrganizationItem = { _id: string; name: string; description?: string }
export type EmployeeType = {
  _id: string
  user: UserType
  employeeType: 'office' | 'site'
  department: OrganizationItem
  designation: OrganizationItem
  manager?: Pick<UserType, '_id' | 'name' | 'email'>
  joiningDate: string
  status: 'active' | 'resigned' | 'terminated'
  lastWorkingDate?: string
  photo?: { key: string; contentType: string; originalName?: string; url?: string; attachmentToken?: string }
  salary?: { ctc: number; basic: number; hra: number; allowances?: { name: string; amount: number }[]; effectiveFrom: string }
  documents: { type: string; key: string; originalName?: string; url?: string; attachmentToken?: string; expiresAt?: string }[]
  emergencyContact?: { name?: string; phone?: string; relation?: string }
}
