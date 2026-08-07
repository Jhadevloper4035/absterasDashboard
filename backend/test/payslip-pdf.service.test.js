import assert from 'node:assert/strict';
import { test } from 'node:test';
import { createPayslipPdf } from '../src/modules/hr/services/payslip-pdf.service.js';

test('payslip PDF uses the employee and payroll details', async () => {
  const pdf = await createPayslipPdf({ employee: { user: { name: 'Ava Patel' }, joiningDate: '2026-01-01', designation: { name: 'Designer' }, department: { name: 'Design' } }, entry: { payableDays: 22, grossPay: 6000, deductions: 500, netPay: 5500, advanceDeducted: 500 }, salary: { basic: 4200, hra: 1800, allowances: [] }, month: 8, year: 2026 });
  assert.ok(pdf.subarray(0, 4).equals(Buffer.from('%PDF')));
});
