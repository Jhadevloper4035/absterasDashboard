import PDFDocument from 'pdfkit';

const money = (value) => `AED ${Number(value || 0).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
const date = (value) => value ? new Date(value).toLocaleDateString('en-CA') : '-';

export function createPayslipPdf({ employee, entry, salary, month, year }) {
  return new Promise((resolve, reject) => {
    const pdf = new PDFDocument({ size: 'A4', margin: 45 });
    const chunks = [];
    pdf.on('data', (chunk) => chunks.push(chunk));
    pdf.on('end', () => resolve(Buffer.concat(chunks)));
    pdf.on('error', reject);
    const row = (label, amount) => { pdf.font('Helvetica').fontSize(10).text(label, 50, pdf.y, { width: 350 }); pdf.font('Helvetica').text(money(amount), 420, pdf.y - 12, { width: 120, align: 'right' }); pdf.moveDown(0.7); };
    const info = (label, value, x) => { pdf.font('Helvetica').fontSize(9).text(label, x, pdf.y, { continued: true }).font('Helvetica-Bold').text(`: ${value || '-'}`); };
    pdf.rect(35, 35, 525, 770).lineWidth(3).stroke('#1a1a1a');
    pdf.font('Helvetica-Bold').fontSize(21).text('PAYSLIP', 50, 62, { align: 'center' });
    pdf.font('Helvetica').fontSize(12).text('ABSTERAS COMPANY CRM', 50, 92, { align: 'center' });
    pdf.fontSize(9).fillColor('#555').text('System generated salary slip', 50, 110, { align: 'center' }).fillColor('#1a1a1a');
    pdf.moveTo(50, 135).lineTo(545, 135).stroke(); pdf.y = 150;
    const leftY = pdf.y; info('Date of Joining', date(employee.joiningDate), 50); pdf.moveDown(0.6); info('Pay Period', new Date(Date.UTC(year, month - 1, 1)).toLocaleString('en-US', { month: 'long', year: 'numeric' }), 50); pdf.moveDown(0.6); info('Worked Days', entry.payableDays, 50);
    pdf.y = leftY; info('Employee Name', employee.user?.name, 305); pdf.moveDown(0.6); info('Designation', employee.designation?.name, 305); pdf.moveDown(0.6); info('Department', employee.department?.name, 305);
    pdf.y = 250; pdf.font('Helvetica-Bold').fontSize(14).text('Earnings', 50); pdf.text('Amount', 420, pdf.y - 16, { width: 120, align: 'right' }); pdf.moveTo(50, pdf.y + 5).lineTo(545, pdf.y + 5).stroke(); pdf.moveDown(0.8);
    row('Basic salary', salary?.basic); row('House rent allowance', salary?.hra); for (const allowance of salary?.allowances || []) row(allowance.name, allowance.amount); if (entry.reimbursementPay) row('Reimbursements', entry.reimbursementPay); if (entry.encashmentPay) row('Leave encashment', entry.encashmentPay);
    pdf.font('Helvetica-Bold'); row('Total earnings', entry.grossPay); pdf.moveDown(0.8);
    pdf.font('Helvetica-Bold').fontSize(14).text('Deductions', 50); pdf.text('Amount', 420, pdf.y - 16, { width: 120, align: 'right' }); pdf.moveTo(50, pdf.y + 5).lineTo(545, pdf.y + 5).stroke(); pdf.moveDown(0.8);
    if (entry.unpaidDeduction) row('Unpaid leave / absence', entry.unpaidDeduction); if (entry.advanceDeducted) row('Salary advance', entry.advanceDeducted); if (!entry.unpaidDeduction && !entry.advanceDeducted) row('No deductions', 0);
    pdf.font('Helvetica-Bold'); row('Total deductions', entry.deductions); pdf.moveDown(0.4); pdf.fontSize(13).text('Net Pay', 300, pdf.y, { width: 110, align: 'right' }); pdf.text(money(entry.netPay), 420, pdf.y - 16, { width: 120, align: 'right' });
    pdf.font('Helvetica').fontSize(9).fillColor('#555').text('This is a system generated payslip.', 50, 755, { align: 'center', width: 495 }).fillColor('#1a1a1a');
    pdf.end();
  });
}
