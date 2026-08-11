import { downloadPdf } from './pdf'

export async function downloadIdCardPdf(employeeId: string, token?: string) {
  return downloadPdf(`/hr/employees/${employeeId}/id-card`, 'employee-id-card.pdf', token)
}
