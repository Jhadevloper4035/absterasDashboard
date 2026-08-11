import assert from 'node:assert/strict';
import { test } from 'node:test';
import { monthlySalary } from '../src/modules/hr/controllers/payroll.controller.js';

test('monthly advance limit uses basic, HRA, and allowances', () => {
  assert.equal(monthlySalary({ basic: 30000, hra: 10000, allowances: [{ amount: 5000 }] }), 45000);
});
