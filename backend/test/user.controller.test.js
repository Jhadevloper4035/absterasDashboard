import assert from 'node:assert/strict';
import { afterEach, test } from 'node:test';
import { createUser, getUser, listLoginHistory, listUsers, logoutAllUsers, logoutUser, updateUser } from '../src/controllers/user.controller.js';
import { AuthSession } from '../src/models/auth-session.model.js';
import { BlockedToken } from '../src/models/blocked-token.model.js';
import { LoginHistory } from '../src/models/login-history.model.js';
import { User } from '../src/models/user.model.js';

const originalAuthSessionFind = AuthSession.find;
const originalAuthSessionUpdateMany = AuthSession.updateMany;
const originalBlockedTokenUpdateOne = BlockedToken.updateOne;
const originalExists = User.exists;
const originalFind = User.find;
const originalCountDocuments = User.countDocuments;
const originalFindById = User.findById;
const originalFindByIdAndUpdate = User.findByIdAndUpdate;
const originalCreate = User.create;
const originalLoginHistoryFind = LoginHistory.find;
const originalLoginHistoryCountDocuments = LoginHistory.countDocuments;
const originalLoginHistoryUpdateMany = LoginHistory.updateMany;

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
  User.countDocuments = originalCountDocuments;
  User.findById = originalFindById;
  User.findByIdAndUpdate = originalFindByIdAndUpdate;
  User.create = originalCreate;
  AuthSession.find = originalAuthSessionFind;
  AuthSession.updateMany = originalAuthSessionUpdateMany;
  BlockedToken.updateOne = originalBlockedTokenUpdateOne;
  LoginHistory.find = originalLoginHistoryFind;
  LoginHistory.countDocuments = originalLoginHistoryCountDocuments;
  LoginHistory.updateMany = originalLoginHistoryUpdateMany;
});

function emptyActiveSessions() {
  AuthSession.find = () => ({
    sort() {
      return this;
    },
    limit() {
      return this;
    },
    populate() {
      return this;
    },
    lean() {
      return Promise.resolve([]);
    },
  });
}

test('cannot create a second admin user', async () => {
  User.exists = async () => ({ _id: 'admin-1' });

  const response = res();
  await createUser(
    {
      body: {
        name: 'Second Admin',
        email: 'admin2@example.com',
        phone: '9876543210',
        password: 'Secret123',
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
        password: 'Secret123',
        role: 'sales',
      },
    },
    response,
  );

  assert.equal(response.statusCode, 400);
  assert.equal(response.body.error.message, 'Mobile number is required');
});

test('user creation rejects weak passwords', async () => {
  const response = res();
  await createUser(
    {
      body: {
        name: 'Sales User',
        email: 'sales@example.com',
        phone: '9876543210',
        password: 'password',
        role: 'sales',
      },
    },
    response,
  );

  assert.equal(response.statusCode, 400);
  assert.match(response.body.error.message, /letters and numbers/);
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
      skip() {
        return this;
      },
      limit() {
        return Promise.resolve([]);
      },
    };
  };
  User.countDocuments = async () => 0;

  const response = res();
  await listUsers({ user: { role: 'admin' }, query: {} }, response);

  assert.deepEqual(filter, { role: { $in: ['sales', 'operations', 'accounts', 'designers'] } });
  assert.deepEqual(response.body.data, []);
});

test('admin login history can include every user role', async () => {
  let filter;
  emptyActiveSessions();
  LoginHistory.find = (value) => {
    filter = value;
    return {
      sort() {
        return this;
      },
      skip() {
        return this;
      },
      limit(value) {
        assert.equal(value, 25);
        return this;
      },
      populate() {
        return this;
      },
      lean() {
        return Promise.resolve([]);
      },
    };
  };
  LoginHistory.countDocuments = async () => 0;

  const response = res();
  await listLoginHistory({ user: { role: 'admin' }, query: {} }, response);

  assert.deepEqual(filter, {});
  assert.deepEqual(response.body.data, []);
});

test('admin can filter privileged user login history', async () => {
  let filter;
  let sessionFilter;
  User.findById = () => ({
    select() {
      return Promise.resolve({ _id: '507f1f77bcf86cd799439011', role: 'admin' });
    },
  });
  LoginHistory.find = (value) => {
    filter = value;
    return {
      sort() {
        return this;
      },
      skip() {
        return this;
      },
      limit() {
        return this;
      },
      populate() {
        return this;
      },
      lean() {
        return Promise.resolve([]);
      },
    };
  };
  LoginHistory.countDocuments = async () => 0;
  AuthSession.find = (value) => {
    sessionFilter = value;
    return {
      sort() {
        return this;
      },
      limit() {
        return this;
      },
      populate() {
        return this;
      },
      lean() {
        return Promise.resolve([]);
      },
    };
  };

  const response = res();
  await listLoginHistory({ user: { role: 'admin' }, query: { userId: '507f1f77bcf86cd799439011' } }, response);

  assert.equal(response.statusCode, 200);
  assert.deepEqual(filter, { user: '507f1f77bcf86cd799439011' });
  assert.equal(String(sessionFilter.user), '507f1f77bcf86cd799439011');
});

test('login history closes duplicate current rows for the same user', async () => {
  const user = { _id: 'user-1', name: 'Harpreet', email: 'harpreet@absteras.com', role: 'sales', status: 'active' };
  const newestLogin = new Date('2026-08-02T14:49:38.000Z');
  const oldLogin = new Date('2026-08-01T12:59:07.000Z');
  let closedHistoryFilter;

  AuthSession.find = () => ({
    sort() {
      return this;
    },
    skip() {
      return this;
    },
    limit() {
      return this;
    },
    populate() {
      return this;
    },
    lean() {
      return Promise.resolve([{ _id: 'session-1', user, createdAt: newestLogin, ipAddress: '127.0.0.1', userAgent: 'Chrome' }]);
    },
  });
  LoginHistory.countDocuments = async () => 2;
  AuthSession.updateMany = async () => {};
  LoginHistory.find = () => ({
    sort() {
      return this;
    },
    skip() {
      return this;
    },
    limit() {
      return this;
    },
    populate() {
      return this;
    },
    lean() {
      return Promise.resolve([
        { _id: 'history-new', user, email: user.email, role: user.role, loggedInAt: newestLogin, ipAddress: '127.0.0.1', userAgent: 'Chrome' },
        { _id: 'history-old', user, email: user.email, role: user.role, loggedInAt: oldLogin, ipAddress: '127.0.0.1', userAgent: 'Chrome' },
      ]);
    },
  });
  LoginHistory.updateMany = async (filter) => {
    closedHistoryFilter = filter;
  };

  const response = res();
  await listLoginHistory({ user: { role: 'admin' }, query: {} }, response);

  assert.deepEqual(closedHistoryFilter, { _id: { $in: ['history-old'] } });
  assert.equal(response.body.data.filter((item) => !item.logoutAt).length, 1);
  assert.equal(response.body.data.find((item) => item._id === 'history-old').logoutReason, 'new_login');
});

test('admin can logout an active user from login history', async () => {
  let sessionUpdate;
  let historyUpdate;
  const userId = '507f1f77bcf86cd799439011';

  User.findById = (id) => ({
    select(field) {
      assert.equal(id, userId);
      assert.equal(field, 'role status');
      return Promise.resolve({ _id: userId, role: 'sales', status: 'active' });
    },
  });
  AuthSession.find = (filter) => {
    assert.equal(filter.user, userId);
    return {
      select() {
        return this;
      },
      lean() {
        return Promise.resolve([{ accessTokenJti: 'access-1' }]);
      },
    };
  };
  AuthSession.updateMany = async (filter, update) => {
    sessionUpdate = { filter, update };
  };
  BlockedToken.updateOne = async () => {};
  LoginHistory.updateMany = async (filter, update) => {
    historyUpdate = { filter, update };
  };

  const response = res();
  await logoutUser({ user: { _id: 'admin-1', role: 'admin' }, params: { id: userId }, get: () => '', ip: '127.0.0.1' }, response);

  assert.equal(response.body.data.ok, true);
  assert.deepEqual(sessionUpdate.filter, { user: userId, revokedAt: null });
  assert.deepEqual(historyUpdate.filter, { user: userId, logoutAt: null });
  assert.ok(historyUpdate.update.$set.logoutAt instanceof Date);
  assert.equal(historyUpdate.update.$set.logoutReason, 'logout');
});

test('admin can logout all active users', async () => {
  let sessionUpdate;
  let historyUpdate;

  AuthSession.find = (filter) => {
    assert.equal(filter.revokedAt, null);
    return {
      select(field) {
        assert.equal(field, 'accessTokenJti user');
        return this;
      },
      lean() {
        return Promise.resolve([
          { accessTokenJti: 'access-1', user: 'user-1' },
          { accessTokenJti: 'access-2', user: 'user-2' },
        ]);
      },
    };
  };
  AuthSession.updateMany = async (filter, update) => {
    sessionUpdate = { filter, update };
  };
  const blockedTokens = [];
  BlockedToken.updateOne = async (filter, update) => {
    blockedTokens.push({ filter, update });
  };
  LoginHistory.updateMany = async (filter, update) => {
    historyUpdate = { filter, update };
  };

  const response = res();
  await logoutAllUsers({ user: { _id: 'admin-1', role: 'admin' }, get: () => '', ip: '127.0.0.1' }, response);

  assert.equal(response.body.data.ok, true);
  assert.equal(response.body.data.revokedSessions, 2);
  assert.deepEqual(sessionUpdate.filter, { revokedAt: null });
  assert.equal(blockedTokens.length, 2);
  assert.deepEqual(historyUpdate.filter, { logoutAt: null });
  assert.ok(historyUpdate.update.$set.logoutAt instanceof Date);
  assert.equal(historyUpdate.update.$set.logoutReason, 'logout');
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
        password: 'Secret123',
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
        password: 'Secret123',
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
