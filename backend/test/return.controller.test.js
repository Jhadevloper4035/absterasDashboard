import assert from 'node:assert/strict';
import { afterEach, test } from 'node:test';
import { createReturnTransfer } from '../src/modules/returns/controllers/return.controller.js';
import { Challan } from '../src/modules/challans/models/challan.model.js';
import { Client } from '../src/modules/clients/models/client.model.js';
import { ReturnProduct } from '../src/modules/returns/models/return-product.model.js';

const originalCreate = Challan.create;
const originalExists = Client.exists;
const originalFindOne = Client.findOne;
const originalFind = ReturnProduct.find;
const originalFindOneAndUpdate = ReturnProduct.findOneAndUpdate;
const originalFindByIdAndUpdate = ReturnProduct.findByIdAndUpdate;

const id = (value) => value.padEnd(24, '0');

function res() {
  return {
    statusCode: 200,
    status(code) { this.statusCode = code; return this; },
    json(body) { this.body = body; return this; },
  };
}

afterEach(() => {
  Challan.create = originalCreate;
  Client.exists = originalExists;
  Client.findOne = originalFindOne;
  ReturnProduct.find = originalFind;
  ReturnProduct.findOneAndUpdate = originalFindOneAndUpdate;
  ReturnProduct.findByIdAndUpdate = originalFindByIdAndUpdate;
});

test('creates a cross-client return transfer challan before deducting return storage', async () => {
  const sourceClient = id('1');
  const destinationClient = id('7');
  const sourceSite = id('2');
  const destinationSite = id('3');
  const productId = id('4');
  const updates = [];
  let challanPayload;

  Client.findOne = (query) => ({ select: () => ({ lean: async () => ({ parentClient: query._id === sourceSite ? sourceClient : destinationClient }) }) });
  ReturnProduct.find = () => ({ lean: async () => [{ _id: productId, client: sourceClient, sourceSite, name: 'Wall panel', quantity: 5, unit: 'pcs' }] });
  Challan.create = async (payload) => {
    challanPayload = payload;
    return { _id: id('5'), ...payload, deleteOne: async () => {}, toObject: () => payload };
  };
  ReturnProduct.findOneAndUpdate = async (filter, update) => {
    updates.push({ filter, update });
    return { _id: productId, quantity: 3 };
  };

  const response = res();
  await createReturnTransfer({ body: { sourceSite, destinationSite, challanDate: '2026-08-30', eWayBillNumber: '123', items: [{ returnProduct: productId, quantity: 2 }, { name: 'Manual trim', quantity: 3, unit: 'pcs' }] }, user: { _id: id('6') } }, response);

  assert.equal(response.statusCode, 201);
  assert.equal(challanPayload.client, destinationClient);
  assert.equal(challanPayload.sourceSite, sourceSite);
  assert.equal(challanPayload.eWayBillNumber, '123');
  assert.equal(challanPayload.transferType, 'return_transfer');
  assert.deepEqual(challanPayload.returnProducts, [{ product: productId, quantity: 2 }]);
  assert.deepEqual(challanPayload.lineItems, [{ description: 'Wall panel', quantity: 2, unit: 'pcs' }, { description: 'Manual trim', quantity: 3, unit: 'pcs' }]);
  assert.equal(updates.length, 1);
  assert.deepEqual(updates[0].update, { $inc: { quantity: -2 } });
});
