import assert from 'node:assert/strict';
import { test } from 'node:test';
import { createChallanPdf } from '../src/modules/challans/services/challan-pdf.service.js';

test('creates a PDF delivery challan', async () => {
  const pdf = await createChallanPdf({ challanNumber: '13', challanDate: '2026-07-24', client: { name: 'Acme', state: 'Uttar Pradesh', stateCode: '09' }, lineItems: [{ description: 'ALUMINIUM EXTRUSION', quantity: 1, rate: 448, amount: 448 }], freightCharge: 0, taxableAmount: 448, gstAmount: 80.64, roundOff: 0, totalAmount: 528.64 });
  assert.equal(pdf.subarray(0, 4).toString(), '%PDF');
});
