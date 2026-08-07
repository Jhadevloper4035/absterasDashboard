import type { EmployeeType } from '@/types/hr'

const escapeHtml = (value: string | undefined) => String(value || '').replace(/[&<>'"]/g, (character) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', "'": '&#39;', '"': '&quot;' })[character] || character)

export function generateIdCardPdf(employee: EmployeeType) {
  const card = window.open('', '_blank', 'width=480,height=640')
  if (!card) return
  const photo = employee.photo?.url ? `<img src="${escapeHtml(employee.photo.url)}" alt="${escapeHtml(employee.user.name)}" />` : `<div class="initials">${escapeHtml(employee.user.name.slice(0, 1))}</div>`
  card.document.write(`<title>${escapeHtml(employee.user.name)} ID card</title><main><header><strong>ABSTERAS</strong><span>EMPLOYEE ID CARD</span></header><section>${photo}<h1>${escapeHtml(employee.user.name)}</h1><p class="role">${escapeHtml(employee.designation?.name)}</p><dl><dt>Department</dt><dd>${escapeHtml(employee.department?.name)}</dd><dt>Email</dt><dd>${escapeHtml(employee.user.email)}</dd><dt>Employee ID</dt><dd>${escapeHtml(employee._id.slice(-8).toUpperCase())}</dd></dl></section><footer>ABSTERAS COMPANY CRM</footer></main><style>*{box-sizing:border-box}body{font-family:Arial,sans-serif;background:#f4f1f8;padding:24px}main{width:340px;overflow:hidden;background:#fff;border-radius:18px;box-shadow:0 8px 24px #26064a33}header{background:#26064a;color:#fff;padding:28px 24px 48px}header strong{font-size:24px;display:block}header span{font-size:10px;letter-spacing:1.5px;opacity:.8}section{text-align:center;margin-top:-28px;padding:0 26px 28px}img,.initials{display:flex;width:108px;height:108px;margin:auto;border:5px solid #fff;border-radius:8px;background:#eee;object-fit:cover;align-items:center;justify-content:center;font-size:42px;color:#26064a}.initials{background:#e9d9ff}h1{font-size:22px;margin:16px 0 4px}.role{color:#7228db;font-weight:bold;margin:0 0 20px}dl{text-align:left;border-top:1px solid #eee;padding-top:14px;font-size:12px}dt{color:#777;float:left;clear:left;margin-bottom:9px}dd{text-align:right;margin:0 0 9px;font-weight:bold}footer{background:#26064a;color:#fff;text-align:center;padding:14px;font-size:10px;letter-spacing:1px}</style>`)
  card.document.close()
  card.print()
}
