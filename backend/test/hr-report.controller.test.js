import assert from 'node:assert/strict';
import { test } from 'node:test';
import { headcountAttritionReport, payrollCostReport } from '../src/modules/hr/controllers/reports.controller.js';
import { Employee } from '../src/modules/hr/models/employee.model.js';
import { PayrollRun } from '../src/modules/hr/models/payroll-run.model.js';

test('headcount report returns a zero-safe attrition rate', async () => {
  const originalFind = Employee.find;
  Employee.find = () => ({ select: async () => [] });
  const response = { body: null, json(body) { this.body = body; } };
  await headcountAttritionReport({ query: { from: '2026-01-01', to: '2026-01-31' } }, response);
  Employee.find = originalFind;
  assert.deepEqual(response.body.data, { active: 0, joined: 0, exited: 0, attritionRate: 0 });
});

test('payroll cost report applies department filtering to payroll entries', async () => {
  const originalEmployeeFind = Employee.find;
  const originalPayrollFind = PayrollRun.find;
  Employee.find = () => ({ select: async () => [{ _id: 'engineering-employee' }] });
  PayrollRun.find = async () => [{ status: 'processed', month: 1, year: 2026, entries: [{ employee: 'engineering-employee', grossPay: 100, deductions: 10, netPay: 90, reimbursementPay: 5 }, { employee: 'other-employee', grossPay: 200, deductions: 20, netPay: 180, reimbursementPay: 10 }] }];
  const response = { body: null, json(body) { this.body = body; } };

  await payrollCostReport({ query: { from: '2026-01-01', to: '2026-01-31', department: 'engineering' } }, response);

  Employee.find = originalEmployeeFind;
  PayrollRun.find = originalPayrollFind;
  assert.deepEqual(response.body.data.totals, { grossPay: 100, deductions: 10, netPay: 90, reimbursements: 5 });
});
