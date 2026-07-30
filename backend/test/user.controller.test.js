import assert from 'node:assert/strict';
import { afterEach, test } from 'node:test';
import { createUser, getUser, listUsers, updateUser } from '../src/controllers/user.controller.js';
import { User } from '../src/models/user.model.js';

const originalExists = User.exists;
const originalFind = User.find;
const originalFindById = User.findById;
const originalFindByIdAndUpdate = User.findByIdAndUpdate;
const originalCreate = User.create;

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
  User.find = originalFind;
  User.findById = originalFindById;
  User.findByIdAndUpdate = originalFindByIdAndUpdate;
  User.create = originalCreate;
});

test('cannot create a second admin user', async () => {
  User.exists = async () => ({ _id: 'admin-1' });

  const response = res();
  await createUser(
    {
      body: {
        name: 'Second Admin',
        email: 'admin2@example.com',
        phone: '9876543210',
        password: 'secret-password',
        role: 'admin',
      },
    },
    response,
  );

  assert.equal(response.statusCode, 400);
  assert.equal(response.body.error.message, 'Only one admin is allowed');
});

test('user creation requires mobile number', async () => {
  const response = res();
  await createUser(
    {
      body: {
        name: 'Sales User',
        email: 'sales@example.com',
        password: 'secret-password',
        role: 'sales',
      },
    },
    response,
  );

  assert.equal(response.statusCode, 400);
  assert.equal(response.body.error.message, 'Mobile number is required');
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

test('admin lists sales users only', async () => {
  let filter;
  User.find = (value) => {
    filter = value;
    return {
      sort() {
        return this;
      },
      limit() {
        return Promise.resolve([]);
      },
    };
  };

  const response = res();
  await listUsers({ user: { role: 'admin' } }, response);

  assert.deepEqual(filter, { role: 'sales' });
  assert.deepEqual(response.body.data, []);
});

test('admin cannot create privileged users', async () => {
  const response = res();
  await createUser(
    {
      user: { role: 'admin' },
      body: {
        name: 'New Admin',
        email: 'admin@example.com',
        phone: '9876543210',
        password: 'secret-password',
        role: 'admin',
      },
    },
    response,
  );

  assert.equal(response.statusCode, 403);
  assert.equal(response.body.error.message, 'Admins can create sales users only');
});

test('admin cannot read another admin profile', async () => {
  User.findById = async () => ({ _id: 'admin-2', role: 'admin' });

  const response = res();
  await getUser({ user: { role: 'admin' }, params: { id: 'admin-2' } }, response);

  assert.equal(response.statusCode, 403);
  assert.equal(response.body.error.message, 'Admins can manage sales users only');
});

test('admin cannot promote a sales user', async () => {
  User.findById = async () => ({ _id: 'sales-1', role: 'sales' });

  const response = res();
  await updateUser(
    {
      user: { role: 'admin' },
      params: { id: 'sales-1' },
      body: { role: 'admin' },
    },
    response,
  );

  assert.equal(response.statusCode, 403);
  assert.equal(response.body.error.message, 'Admins can manage sales users only');
});

test('updates user display name without changing assignment identity', async () => {
  User.findById = async () => ({ _id: 'sales-1', role: 'sales' });
  User.findByIdAndUpdate = async (id, update) => {
    assert.equal(id, 'sales-1');
    assert.deepEqual(update, { name: 'Updated Name' });
    return { _id: id, role: 'sales', name: update.name };
  };

  const response = res();
  await updateUser(
    {
      user: { role: 'admin' },
      params: { id: 'sales-1' },
      body: { name: 'Updated Name' },
    },
    response,
  );

  assert.equal(response.statusCode, 200);
  assert.equal(response.body.data._id, 'sales-1');
  assert.equal(response.body.data.name, 'Updated Name');
});

test('user updates ignore fields outside the editable profile allowlist', async () => {
  User.findById = async () => ({ _id: 'sales-1', role: 'sales' });
  User.findByIdAndUpdate = async (_id, update) => {
    assert.deepEqual(update, { name: 'Sales User' });
    return { _id, role: 'sales', name: update.name };
  };

  const response = res();
  await updateUser(
    {
      user: { role: 'admin' },
      params: { id: 'sales-1' },
      body: { name: 'Sales User', passwordHash: 'bad', permissions: ['superadmin'], tokenVersion: 999 },
    },
    response,
  );

  assert.equal(response.statusCode, 200);
});
