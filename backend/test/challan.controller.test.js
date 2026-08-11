import assert from 'node:assert/strict';
import { afterEach, test } from 'node:test';
import { createChallan } from '../src/modules/challans/controllers/challan.controller.js';
import { Challan } from '../src/modules/challans/models/challan.model.js';

const originalCreate = Challan.create;

afterEach(() => { Challan.create = originalCreate; });

test('creates challans with a generated number', async () => {
  let created;
  Challan.create = async (payload) => { created = payload; return { _id: 'challan-1', ...payload }; };
  const response = { statusCode: 200, status(code) { this.statusCode = code; return this; }, json(body) { this.body = body; return this; } };
  await createChallan({ body: { challanNumber: 'MANUAL-1', client: 'client-1', challanDate: '2026-08-10', taxableAmount: 100, totalAmount: 118 } }, response);
  assert.equal(response.statusCode, 201);
  assert.match(created.challanNumber, /^DC-[A-F0-9]{10}$/);
});
