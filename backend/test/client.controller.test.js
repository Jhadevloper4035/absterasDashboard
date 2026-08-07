import assert from 'node:assert/strict';
import { afterEach, test } from 'node:test';
import { createClient, updateClient } from '../src/modules/clients/controllers/client.controller.js';
import { Client } from '../src/modules/clients/models/client.model.js';

const originalCreate = Client.create;
const originalFindById = Client.findById;

function res() {
  return { statusCode: 200, body: undefined, status(code) { this.statusCode = code; return this; }, json(body) { this.body = body; return this; } };
}

afterEach(() => {
  Client.create = originalCreate;
  Client.findById = originalFindById;
});

test('creates and updates only documented client fields', async () => {
  let created;
  Client.create = async (payload) => { created = payload; return { _id: 'client-1', ...payload }; };
  const createResponse = res();
  await createClient({ body: { name: 'Acme', siteName: 'Tower A', untrusted: true } }, createResponse);
  assert.equal(createResponse.statusCode, 201);
  assert.equal(created.untrusted, undefined);

  const client = { _id: 'client-1', name: 'Acme', save: async () => {} };
  Client.findById = async () => client;
  const updateResponse = res();
  await updateClient({ params: { id: 'client-1' }, body: { status: 'completed', untrusted: true } }, updateResponse);
  assert.equal(client.status, 'completed');
  assert.equal(client.untrusted, undefined);
});
