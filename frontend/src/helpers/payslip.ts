import { downloadPdf } from './pdf'

export function downloadPayslipPdf(year: number, month: number, token?: string, employee?: string) {
  return downloadPdf(`/hr/payroll/payslip?year=${year}&month=${month}${employee ? `&employee=${employee}` : ''}`, `payslip-${year}-${String(month).padStart(2, '0')}.pdf`, token)
}
