import assert from 'node:assert/strict';
import { test } from 'node:test';
import { generateBankFile, unpaidLeaveDaysForPayroll } from '../src/modules/hr/services/payroll.service.js';

test('bank file safely quotes employee values', () => {
  const csv = generateBankFile({ entries: [{ employee: { _id: 'employee-1', user: { name: 'Ava "A"' } }, netPay: 1234.5 }] });
  assert.equal(csv, 'employee_id,employee_name,net_pay\n"employee-1","Ava ""A""","1234.5"');
});

test('only the first approved medical leave day remains paid', () => {
  const from = new Date('2026-08-01T00:00:00.000Z');
  const to = new Date('2026-09-01T00:00:00.000Z');
  assert.equal(unpaidLeaveDaysForPayroll([
    { days: 1, paidDays: 1, fromDate: '2026-08-04', toDate: '2026-08-04', leaveType: { isPaid: true } },
    { days: 1, paidDays: 0, fromDate: '2026-08-12', toDate: '2026-08-12', leaveType: { isPaid: true } },
  ], from, to), 1);
});

test('HR-paid leave is excluded while HR-unpaid leave is deducted', () => {
  const from = new Date('2026-08-01T00:00:00.000Z');
  const to = new Date('2026-09-01T00:00:00.000Z');
  assert.equal(unpaidLeaveDaysForPayroll([
    { days: 3, paidDays: 3, fromDate: '2026-08-04', toDate: '2026-08-06' },
    { days: 2, paidDays: 0, fromDate: '2026-08-10', toDate: '2026-08-11' },
  ], from, to), 2);
});

test('cross-month leave is deducted only in the period containing each leave date', () => {
  const leave = { days: 3, paidDays: 0, fromDate: '2026-01-30', toDate: '2026-02-02' };
  const holidays = [new Date('2026-01-31T00:00:00.000Z')];
  const january = unpaidLeaveDaysForPayroll([leave], new Date('2026-01-01T00:00:00.000Z'), new Date('2026-02-01T00:00:00.000Z'), holidays);
  const february = unpaidLeaveDaysForPayroll([leave], new Date('2026-02-01T00:00:00.000Z'), new Date('2026-03-01T00:00:00.000Z'), holidays);
  assert.equal(january, 1);
  assert.equal(february, 2);
  assert.equal(january + february, leave.days);
});

test('a paid leave day crossing a month boundary is allocated once', () => {
  const leave = { days: 2, paidDays: 1, fromDate: '2026-01-31', toDate: '2026-02-01' };
  assert.equal(unpaidLeaveDaysForPayroll([leave], new Date('2026-01-01T00:00:00.000Z'), new Date('2026-02-01T00:00:00.000Z')), 0);
  assert.equal(unpaidLeaveDaysForPayroll([leave], new Date('2026-02-01T00:00:00.000Z'), new Date('2026-03-01T00:00:00.000Z')), 1);
});
