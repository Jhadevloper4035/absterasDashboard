export const defaultTaskWorkTypes: Record<string, string[]> = {
  operations: ['Coating', 'Procurement', 'Laser Cut'],
  designers: ['Drawing', '3D Design', 'Revision'],
  sales: ['Follow Up', 'Meeting', 'Quotation'],
  admin: ['Documentation', 'Approval', 'Coordination'],
  accounts: ['Payment Reminder', 'Salary Slip', 'Ledger Update'],
}

export const taskWorkTypeRoles = Object.keys(defaultTaskWorkTypes)

export const mergeTaskWorkTypes = (incoming?: Record<string, string[]>, includeDefaults = true) => {
  const merged: Record<string, string[]> = includeDefaults ? { ...defaultTaskWorkTypes } : {}

  Object.entries(incoming || {}).forEach(([role, workTypes]) => {
    merged[role] = [...new Set([...(merged[role] || []), ...workTypes.filter(Boolean)])].sort()
  })

  return merged
}
