import type { UserType } from './auth'

export type LeadOwner = Pick<UserType, '_id' | 'name' | 'email' | 'role' | 'status'>

export type LeadNote = {
  _id?: string
  text?: string
  createdAt?: string
  createdBy?: string | LeadOwner
}

export type LeadAssignment = {
  previousOwner?: string | LeadOwner
  newOwner?: string | LeadOwner
  reason?: string
  rule?: string
  assignedAt?: string
}

export type LeadMeeting = {
  title?: string
  startsAt?: string
  notes?: string
  scheduledAt?: string
  scheduledBy?: string | LeadOwner
  status?: 'SCHEDULED' | 'CANCELLED'
}

export type LeadType = {
  _id: string
  name: string
  source: string
  sourceType?: string
  productInterest?: string
  email?: string
  phone: string
  company?: string
  status: string
  owner?: string | LeadOwner
  assignmentException?: boolean
  createdAt?: string
  nextMeeting?: LeadMeeting
  meetingHistory?: LeadMeeting[]
  notes?: LeadNote[]
  assignmentHistory?: LeadAssignment[]
}
