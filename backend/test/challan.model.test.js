import assert from 'node:assert/strict';
import { test } from 'node:test';
import { Challan } from '../src/modules/challans/models/challan.model.js';

test('challan stores delivery details and line items', async () => {
  const challan = new Challan({ challanNumber: '13', client: '507f1f77bcf86cd799439011', challanDate: '2026-07-24', transportType: 'Road', vehicleNumber: 'hr26ab1234', eWayBillNumber: '123', lineItems: [{ description: 'ALUMINIUM EXTRUSION', hsnCode: '7604', quantity: 81, unit: 'NOS', rate: 448, amount: 36288 }], freightCharge: 2000, taxableAmount: 36288, gstAmount: 6891, roundOff: -179, totalAmount: 45000 });
  await challan.validate();
  assert.equal(challan.vehicleNumber, 'HR26AB1234');
  assert.equal(challan.lineItems[0].amount, 36288);
});
