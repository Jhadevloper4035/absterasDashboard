export const defaultTaskWorkTypes: Record<string, string[]> = {
  general: ['Coating', 'Procurement', 'Laser Cut', 'Drawing', '3D Design', 'Revision', 'Follow Up', 'Meeting', 'Quotation', 'Documentation', 'Approval', 'Coordination', 'Payment Reminder', 'Salary Slip', 'Ledger Update'],
}

export const taskWorkTypeRoles = Object.keys(defaultTaskWorkTypes)

export const mergeTaskWorkTypes = (incoming?: Record<string, string[]>, includeDefaults = true) => {
  const merged: Record<string, string[]> = includeDefaults ? { ...defaultTaskWorkTypes } : {}

  Object.entries(incoming || {}).forEach(([role, workTypes]) => {
    merged[role] = [...new Set([...(merged[role] || []), ...workTypes.filter(Boolean)])].sort()
  })

  return merged
}
