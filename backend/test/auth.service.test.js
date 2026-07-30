import assert from 'node:assert/strict';
import { afterEach, test } from 'node:test';
import { AuthSession } from '../src/models/auth-session.model.js';
import { BlockedToken } from '../src/models/blocked-token.model.js';
import { RateLimit } from '../src/models/rate-limit.model.js';
import { rateLimit } from '../src/middleware/rate-limit.middleware.js';
import { createAccessTokenPair, isAccessTokenBlocked, rotateSession } from '../src/services/auth-session.service.js';
import { hashPassword, verifyPassword } from '../src/services/password.service.js';
import { createAccessToken, hashRefreshToken, verifyAccessToken } from '../src/services/token.service.js';

const originals = {
  authCreate: AuthSession.create,
  authFindOne: AuthSession.findOne,
  authFindOneAndUpdate: AuthSession.findOneAndUpdate,
  authUpdateMany: AuthSession.updateMany,
  blockedExists: BlockedToken.exists,
  blockedUpdateOne: BlockedToken.updateOne,
  rateFindOne: RateLimit.findOne,
  rateFindOneAndUpdate: RateLimit.findOneAndUpdate,
};

afterEach(() => {
  AuthSession.create = originals.authCreate;
  AuthSession.findOne = originals.authFindOne;
  AuthSession.findOneAndUpdate = originals.authFindOneAndUpdate;
  AuthSession.updateMany = originals.authUpdateMany;
  BlockedToken.exists = originals.blockedExists;
  BlockedToken.updateOne = originals.blockedUpdateOne;
  RateLimit.findOne = originals.rateFindOne;
  RateLimit.findOneAndUpdate = originals.rateFindOneAndUpdate;
});

test('password hashing verifies only the original password', async () => {
  const hash = await hashPassword('secret-password');

  assert.equal(await verifyPassword('secret-password', hash), true);
  assert.equal(await verifyPassword('wrong-password', hash), false);
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

  const rotated = await rotateSession('refresh-token', { get: () => 'test-agent', ip: '127.0.0.1' });

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

  assert.equal(await rotateSession('used-refresh-token', { get: () => '', ip: '127.0.0.1' }), null);
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
