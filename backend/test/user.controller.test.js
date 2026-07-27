import assert from 'node:assert/strict';
import { afterEach, test } from 'node:test';
import { createUser, updateUser } from '../src/controllers/user.controller.js';
import { User } from '../src/models/user.model.js';

const originalExists = User.exists;
const originalFindById = User.findById;

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
  User.exists = originalExists;
  User.findById = originalFindById;
});

test('cannot create a second admin user', async () => {
  User.exists = async () => ({ _id: 'admin-1' });

  const response = res();
  await createUser(
    {
      body: {
        name: 'Second Admin',
        email: 'admin2@example.com',
        password: 'secret-password',
        role: 'admin',
      },
    },
    response,
  );

  assert.equal(response.statusCode, 400);
  assert.equal(response.body.error.message, 'Only one admin is allowed');
});

test('cannot promote a user into a second superadmin', async () => {
  User.findById = async () => ({ _id: 'sales-1', role: 'sales' });
  User.exists = async () => ({ _id: 'superadmin-1' });

  const response = res();
  await updateUser(
    {
      params: { id: 'sales-1' },
      body: { role: 'superadmin' },
    },
    response,
  );

  assert.equal(response.statusCode, 400);
  assert.equal(response.body.error.message, 'Only one superadmin is allowed');
});

test('cannot demote the only superadmin', async () => {
  User.findById = async () => ({ _id: 'superadmin-1', role: 'superadmin' });
  User.exists = async () => null;

  const response = res();
  await updateUser(
    {
      params: { id: 'superadmin-1' },
      body: { role: 'sales' },
    },
    response,
  );

  assert.equal(response.statusCode, 400);
  assert.equal(response.body.error.message, 'One superadmin is required');
});
