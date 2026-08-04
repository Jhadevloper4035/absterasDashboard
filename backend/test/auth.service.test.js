import assert from 'node:assert/strict';
import { afterEach, test } from 'node:test';
import { AuthSession } from '../src/models/auth-session.model.js';
import { BlockedToken } from '../src/models/blocked-token.model.js';
import { LoginHistory } from '../src/models/login-history.model.js';
import { RateLimit } from '../src/models/rate-limit.model.js';
import { User } from '../src/models/user.model.js';
import { env } from '../src/config/env.js';
import { cleanIpAddress } from '../src/helpers/request-ip.js';
import { allowFirstSuperadminOrUserManager } from '../src/middleware/auth.middleware.js';
import { rateLimit } from '../src/middleware/rate-limit.middleware.js';
import { login, logout } from '../src/controllers/auth.controller.js';
import { createAccessTokenPair, createSession, isAccessTokenBlocked, rotateSession } from '../src/services/auth-session.service.js';
import { hashPassword, verifyPassword } from '../src/services/password.service.js';
import { createAccessToken, hashRefreshToken, verifyAccessToken } from '../src/services/token.service.js';

const testReq = (userAgent = 'node-test', ip = '127.0.0.1') => ({
  ip,
  get: (name) => (String(name).toLowerCase() === 'user-agent' ? userAgent : ''),
});

const originals = {
  authCreate: AuthSession.create,
  authExists: AuthSession.exists,
  authFind: AuthSession.find,
  authFindOne: AuthSession.findOne,
  authFindOneAndUpdate: AuthSession.findOneAndUpdate,
  authUpdateMany: AuthSession.updateMany,
  blockedExists: BlockedToken.exists,
  blockedUpdateOne: BlockedToken.updateOne,
  loginHistoryCreate: LoginHistory.create,
  loginHistoryFindOneAndUpdate: LoginHistory.findOneAndUpdate,
  loginHistoryUpdateMany: LoginHistory.updateMany,
  rateFindOne: RateLimit.findOne,
  rateFindOneAndUpdate: RateLimit.findOneAndUpdate,
  userFindOne: User.findOne,
  userUpdateOne: User.updateOne,
};

afterEach(() => {
  AuthSession.create = originals.authCreate;
  AuthSession.exists = originals.authExists;
  AuthSession.find = originals.authFind;
  AuthSession.findOne = originals.authFindOne;
  AuthSession.findOneAndUpdate = originals.authFindOneAndUpdate;
  AuthSession.updateMany = originals.authUpdateMany;
  BlockedToken.exists = originals.blockedExists;
  BlockedToken.updateOne = originals.blockedUpdateOne;
  LoginHistory.create = originals.loginHistoryCreate;
  LoginHistory.findOneAndUpdate = originals.loginHistoryFindOneAndUpdate;
  LoginHistory.updateMany = originals.loginHistoryUpdateMany;
  RateLimit.findOne = originals.rateFindOne;
  RateLimit.findOneAndUpdate = originals.rateFindOneAndUpdate;
  User.findOne = originals.userFindOne;
  User.updateOne = originals.userUpdateOne;
});

test('password hashing verifies only the original password', async () => {
  const hash = await hashPassword('Secret123');

  assert.equal(await verifyPassword('Secret123', hash), true);
  assert.equal(await verifyPassword('wrong-password', hash), false);
});

test('ip address display removes ipv6 mapped prefix', () => {
  assert.equal(cleanIpAddress('::ffff:172.26.0.1'), '172.26.0.1');
  assert.equal(cleanIpAddress('203.0.113.10, 10.0.0.1'), '203.0.113.10');
});

test('production setup requires a one-time setup token', async () => {
  const originalProduction = env.isProduction;
  const originalSetupToken = env.setupToken;
  User.exists = async () => null;
  env.isProduction = true;
  env.setupToken = 'setup-token-123456789012';

  try {
    let denied;
    await allowFirstSuperadminOrUserManager(
      { body: { role: 'superadmin' }, get: () => 'wrong-token' },
      {},
      (error) => {
        denied = error;
      },
    );

    assert.equal(denied.statusCode, 403);

    let allowed;
    await allowFirstSuperadminOrUserManager(
      { body: { role: 'superadmin' }, get: () => 'setup-token-123456789012' },
      {},
      (error) => {
        allowed = error || true;
      },
    );

    assert.equal(allowed, true);
  } finally {
    env.isProduction = originalProduction;
    env.setupToken = originalSetupToken;
  }
});

test('setup explains when the first user already exists', async () => {
  User.exists = async () => ({ _id: 'existing-user' });

  let denied;
  await allowFirstSuperadminOrUserManager(
    { body: { role: 'superadmin' }, get: () => '' },
    {},
    (error) => {
      denied = error;
    },
  );

  assert.equal(denied.statusCode, 409);
  assert.match(denied.message, /setup is already complete/i);
});

test('login updates lastLoginAt without revalidating legacy user fields', async () => {
  const passwordHash = await hashPassword('CodexAdmin123!');
  const user = {
    _id: 'user-1',
    id: 'user-1',
    email: 'codex.superadmin@example.com',
    role: 'superadmin',
    status: 'active',
    passwordHash,
  };
  let lastLoginUpdate;
  let loginHistory;

  User.findOne = (filter) => {
    assert.deepEqual(filter, { email: 'codex.superadmin@example.com' });
    return {
      select(field) {
        assert.equal(field, '+passwordHash');
        return Promise.resolve(user);
      },
    };
  };
  User.updateOne = async (filter, update) => {
    assert.deepEqual(filter, { _id: 'user-1' });
    lastLoginUpdate = update.$set.lastLoginAt;
  };
  AuthSession.find = () => ({
    select() {
      return this;
    },
    lean() {
      return Promise.resolve([]);
    },
  });
  AuthSession.updateMany = async () => ({ modifiedCount: 0 });
  AuthSession.create = async () => ({});
  LoginHistory.updateMany = async () => ({ modifiedCount: 0 });
  LoginHistory.create = async (body) => {
    loginHistory = body;
    return body;
  };

  const response = {
    statusCode: 200,
    cookies: {},
    cookie(name, value) {
      this.cookies[name] = value;
    },
    status(code) {
      this.statusCode = code;
      return this;
    },
    json(body) {
      this.body = body;
      return this;
    },
  };

  await login(
    {
      body: { email: 'codex.superadmin@example.com', password: 'CodexAdmin123!' },
      ...testReq(),
    },
    response,
  );

  assert.equal(response.statusCode, 200);
  assert.equal(response.body.data.user, user);
  assert.ok(lastLoginUpdate instanceof Date);
  assert.equal(loginHistory.user, 'user-1');
  assert.equal(loginHistory.email, 'codex.superadmin@example.com');
  assert.equal(loginHistory.role, 'superadmin');
  assert.equal(loginHistory.ipAddress, '127.0.0.1');
  assert.equal(loginHistory.userAgent, 'node-test');
  assert.equal(loginHistory.loggedInAt, lastLoginUpdate);
  assert.ok(response.cookies.sales_crm_refresh);
});

test('login revokes an existing active session instead of blocking the user', async () => {
  const passwordHash = await hashPassword('CodexAdmin123!');
  const user = {
    _id: 'user-1',
    id: 'user-1',
    email: 'codex.sales@example.com',
    role: 'sales',
    status: 'active',
    passwordHash,
  };

  User.findOne = () => ({ select: () => Promise.resolve(user) });
  User.updateOne = async () => {};
  AuthSession.find = () => ({
    select() {
      return this;
    },
    lean() {
      return Promise.resolve([{ accessTokenJti: 'access-1' }]);
    },
  });
  let revokedFilter;
  AuthSession.updateMany = async (filter) => {
    revokedFilter = filter;
  };
  AuthSession.create = async () => ({});
  BlockedToken.updateOne = async () => {};
  LoginHistory.updateMany = async () => ({ modifiedCount: 1 });
  LoginHistory.create = async () => ({});

  const response = {
    statusCode: 200,
    cookies: {},
    cookie(name, value) {
      this.cookies[name] = value;
    },
    status(code) {
      this.statusCode = code;
      return this;
    },
    json(body) {
      this.body = body;
      return this;
    },
  };

  await login(
    {
      body: { email: 'codex.sales@example.com', password: 'CodexAdmin123!' },
      ...testReq(),
    },
    response,
  );

  assert.equal(response.statusCode, 200);
  assert.deepEqual(revokedFilter, { user: 'user-1', revokedAt: null });
  assert.ok(response.cookies.sales_crm_refresh);
});

test('logout closes the current login history row', async () => {
  const token = createAccessToken({ id: 'user-1', role: 'admin' });
  let logoutUpdate;

  LoginHistory.findOneAndUpdate = async (filter, update, options) => {
    assert.deepEqual(filter, { user: 'user-1', logoutAt: null });
    assert.deepEqual(options, { sort: { loggedInAt: -1 } });
    logoutUpdate = update.$set;
  };
  AuthSession.findOneAndUpdate = async () => null;
  BlockedToken.updateOne = async () => {};

  const response = {
    cookies: {},
    clearCookie(name) {
      this.cookies[name] = '';
    },
    json(body) {
      this.body = body;
      return this;
    },
  };

  await logout(
    {
      body: {},
      headers: {},
      get: (name) => (name === 'authorization' ? `Bearer ${token}` : name === 'user-agent' ? 'node-test' : ''),
    },
    response,
  );

  assert.ok(logoutUpdate.logoutAt instanceof Date);
  assert.equal(logoutUpdate.logoutReason, 'logout');
  assert.equal(response.body.data.ok, true);
});

test('access token contains user id and role', () => {
  const token = createAccessToken({ id: 'user-1', role: 'superadmin' });
  const claims = verifyAccessToken(token);

  assert.equal(claims.sub, 'user-1');
  assert.equal(claims.role, 'superadmin');
  assert.equal(claims.type, 'access');
  assert.ok(claims.jti);
  assert.ok(claims.exp > claims.iat);
});

test('access token verification rejects tampered tokens', () => {
  const token = createAccessToken({ id: 'user-1', role: 'superadmin' });
  const [header, payload] = token.split('.');

  assert.equal(verifyAccessToken(`${header}.${payload}.bad-signature`), null);
});

test('refresh rotation revokes old session and blocks old access token id', async () => {
  const user = { _id: 'user-1', id: 'user-1', role: 'admin', status: 'active' };
  const oldAccess = createAccessTokenPair(user);
  let createdSession;
  let blockedJti;
  let atomicFilter;
  let atomicUpdate;
  const session = {
    user,
    accessTokenJti: oldAccess.accessTokenJti,
    expiresAt: new Date(Date.now() + 1000),
    revokedAt: null,
  };

  AuthSession.findOneAndUpdate = (filter, update) => {
    atomicFilter = filter;
    atomicUpdate = update;
    session.revokedAt = update.revokedAt;
    session.replacedBy = update.replacedBy;
    return { populate: async () => session };
  };
  AuthSession.create = async (body) => {
    createdSession = body;
    return body;
  };
  BlockedToken.updateOne = async (filter) => {
    blockedJti = filter.jti;
  };

  const rotated = await rotateSession('refresh-token', testReq('test-agent'));

  assert.ok(rotated.accessToken);
  assert.ok(rotated.refreshToken);
  assert.equal(atomicFilter.tokenHash, hashRefreshToken('refresh-token'));
  assert.equal(atomicFilter.revokedAt, null);
  assert.ok(atomicFilter.expiresAt.$gt instanceof Date);
  assert.equal(session.revokedAt instanceof Date, true);
  assert.equal(session.replacedBy, atomicUpdate.replacedBy);
  assert.equal(blockedJti, oldAccess.accessTokenJti);
  assert.equal(createdSession.user, 'user-1');
});

test('createSession creates one session without revoking existing sessions', async () => {
  const user = { _id: 'user-1', id: 'user-1', role: 'sales', status: 'active' };
  let createdSession;

  AuthSession.updateMany = async () => {
    throw new Error('createSession should not revoke sessions');
  };
  AuthSession.create = async (body) => {
    createdSession = body;
    return body;
  };

  await createSession(user, testReq());

  assert.equal(createdSession.user, 'user-1');
});

test('refresh token reuse revokes active user sessions', async () => {
  const user = { _id: 'user-1', id: 'user-1', role: 'admin', status: 'active' };
  let revokeFilter;
  const session = {
    user,
    expiresAt: new Date(Date.now() + 1000),
    revokedAt: new Date(),
  };

  AuthSession.findOneAndUpdate = () => ({ populate: async () => null });
  AuthSession.findOne = () => ({ populate: async () => session });
  AuthSession.updateMany = async (filter) => {
    revokeFilter = filter;
  };

  assert.equal(await rotateSession('used-refresh-token', testReq('')), null);
  assert.deepEqual(revokeFilter, { user: 'user-1', revokedAt: null });
});

test('blocked access token ids are rejected by lookup', async () => {
  BlockedToken.exists = async () => ({ _id: 'blocked-1' });

  assert.equal(await isAccessTokenBlocked({ jti: 'token-1' }), true);
});

test('rate limiter blocks after the configured attempt count', async () => {
  const hit = {
    count: 3,
    windowExpiresAt: new Date(Date.now() + 60_000),
  };
  let update;
  RateLimit.findOneAndUpdate = async (filter, body, options) => {
    update = body;
    assert.equal(filter.key, 'login:127.0.0.1:admin@example.com');
    assert.equal(options.updatePipeline, true);
    return hit;
  };

  const req = { ip: '127.0.0.1', body: { email: 'admin@example.com' } };
  const res = {
    statusCode: 200,
    headers: {},
    set(name, value) {
      this.headers[name] = value;
    },
    status(code) {
      this.statusCode = code;
      return this;
    },
    json(body) {
      this.body = body;
      return this;
    },
  };

  await rateLimit({ scope: 'login', limit: 2, windowMs: 60_000 })(req, res, () => {
    throw new Error('next should not run');
  });

  assert.ok(Array.isArray(update));
  assert.equal(res.statusCode, 429);
  assert.equal(res.body.error.message, 'Too many attempts. Try again later.');
});
