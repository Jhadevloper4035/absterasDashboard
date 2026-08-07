import assert from 'node:assert/strict';
import { afterEach, test } from 'node:test';
import { createArchitect, deleteArchitect } from '../src/modules/leads/controllers/architect.controller.js';
import { Architect } from '../src/modules/leads/models/architect.model.js';

const originalCreate = Architect.create;
const originalFindOneAndDelete = Architect.findOneAndDelete;

function res() {
  return {
    statusCode: 200,
    body: undefined,
    status(code) {
      this.statusCode = code;
      return this;
    },
    json(body) {
      this.body = body;
      return this;
    },
  };
}

afterEach(() => {
  Architect.create = originalCreate;
  Architect.findOneAndDelete = originalFindOneAndDelete;
});

test('creates architect leads with only allowed fields', async () => {
  let saved;
  Architect.create = async (payload) => {
    saved = payload;
    return { _id: 'architect-1', ...payload };
  };

  const response = res();
  await createArchitect(
    {
      body: {
        name: 'Asha Mehta',
        phone: '9876543210',
        email: 'asha@example.com',
        company: 'Build Studio',
        city: 'Mumbai',
        specialty: 'Residential',
        notes: 'Met at expo',
        status: 'inactive',
      },
    },
    response,
  );

  assert.equal(response.statusCode, 201);
  assert.equal(saved.name, 'Asha Mehta');
  assert.equal(saved.status, undefined);
});

test('requires architect name', async () => {
  const response = res();
  await createArchitect({ body: { phone: '9876543210' } }, response);

  assert.equal(response.statusCode, 400);
  assert.equal(response.body.error.message, 'Architect name is required');
});

test('requires architect mobile number', async () => {
  const response = res();
  await createArchitect({ body: { name: 'Asha Mehta' } }, response);

  assert.equal(response.statusCode, 400);
  assert.equal(response.body.error.message, 'Mobile number is required');
});

test('deletes architect leads by id', async () => {
  let query;
  Architect.findOneAndDelete = async (filter) => {
    query = filter;
    return { _id: filter._id };
  };

  const response = res();
  await deleteArchitect({ params: { id: 'architect-1' } }, response);

  assert.equal(response.statusCode, 200);
  assert.deepEqual(query, { _id: 'architect-1' });
});
