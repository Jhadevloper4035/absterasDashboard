import type { UserType } from './auth'

export type LeadOwner = Pick<UserType, '_id' | 'name' | 'email' | 'role' | 'status'>

export type LeadAttachment = {
  key: string
  url?: string
  originalName?: string
  contentType?: string
  size?: number
  checksum?: string
  attachmentToken?: string
}

export type LeadDocument = LeadAttachment & { type: 'site_images' | 'psf' | 'boq' | 'estimation' }

export type LeadNote = {
  _id?: string
  text?: string
  attachments?: LeadAttachment[]
  specialSampleRequired?: boolean
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
  campaign?: string
  productInterest?: string
  email?: string
  phone: string
  company?: string
  siteAddress?: string
  googleMapUrl?: string
  territory?: string
  leadCost?: number
  documents?: LeadDocument[]
  status: string
  owner?: string | LeadOwner
  createdBy?: string | LeadOwner
  assignmentException?: boolean
  createdAt?: string
  nextMeeting?: LeadMeeting
  meetingHistory?: LeadMeeting[]
  notes?: LeadNote[]
  assignmentHistory?: LeadAssignment[]
}
