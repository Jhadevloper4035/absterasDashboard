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

test('updating a privileged user can keep the same role', async () => {
  User.findById = async () => ({ _id: 'admin-1', role: 'admin' });
  User.exists = async () => ({ _id: 'admin-2' });
  User.findByIdAndUpdate = async (id, update) => {
    assert.equal(id, 'admin-1');
    assert.deepEqual(update, { name: 'Admin Updated', role: 'admin' });
    return { _id: id, ...update };
  };

  const response = res();
  await updateUser(
    {
      user: { role: 'superadmin' },
      params: { id: 'admin-1' },
      body: { name: 'Admin Updated', role: 'admin' },
    },
    response,
  );

  assert.equal(response.statusCode, 200);
  assert.equal(response.body.data.name, 'Admin Updated');
});

test('admin lists team users only', async () => {
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

  assert.deepEqual(filter, { role: { $in: ['sales', 'operations', 'accounts', 'designers'] } });
  assert.deepEqual(response.body.data, []);
});

test('admin can create operations users', async () => {
  User.exists = async () => null;
  User.create = async (user) => ({ _id: 'operations-1', role: user.role, email: user.email });

  const response = res();
  await createUser(
    {
      user: { role: 'admin' },
      body: {
        name: 'Operations User',
        email: 'operations@example.com',
        phone: '9876543210',
        password: 'secret-password',
        role: 'operations',
      },
    },
    response,
  );

  assert.equal(response.statusCode, 201);
  assert.equal(response.body.data.role, 'operations');
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
  assert.equal(response.body.error.message, 'Admins can create team users only');
});

test('admin cannot read another admin profile', async () => {
  User.findById = async () => ({ _id: 'admin-2', role: 'admin' });

  const response = res();
  await getUser({ user: { role: 'admin' }, params: { id: 'admin-2' } }, response);

  assert.equal(response.statusCode, 403);
  assert.equal(response.body.error.message, 'Admins can manage team users only');
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
  assert.equal(response.body.error.message, 'Admins can manage team users only');
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

test('updates extended user profile fields from the User model', async () => {
  User.findById = async () => ({ _id: 'sales-1', role: 'sales' });
  User.findByIdAndUpdate = async (id, update, options) => {
    assert.equal(id, 'sales-1');
    assert.deepEqual(update, {
      whatsappNumber: '+971500000001',
      territories: ['Dubai', 'Abu Dhabi'],
      notificationPreferences: {
        inApp: true,
        whatsapp: true,
        morningSummary: { enabled: true, time: '08:30' },
      },
    });
    assert.equal(options.runValidators, true);
    return { _id: id, role: 'sales', ...update };
  };

  const response = res();
  await updateUser(
    {
      user: { role: 'admin' },
      params: { id: 'sales-1' },
      body: {
        whatsappNumber: '+971500000001',
        territories: 'Dubai, Abu Dhabi, ',
        notificationPreferences: {
          inApp: true,
          whatsapp: true,
          morningSummary: { enabled: true, time: '08:30' },
        },
      },
    },
    response,
  );

  assert.equal(response.statusCode, 200);
  assert.deepEqual(response.body.data.territories, ['Dubai', 'Abu Dhabi']);
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
