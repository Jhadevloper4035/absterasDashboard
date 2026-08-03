import assert from 'node:assert/strict';
import { test } from 'node:test';

test('test environment uses safe defaults for missing secrets', async () => {
  const originalNodeEnv = process.env.NODE_ENV;
  const originalAuthSecret = process.env.AUTH_SECRET;
  const originalMongoUri = process.env.MONGODB_URI;

  delete process.env.AUTH_SECRET;
  delete process.env.MONGODB_URI;
  process.env.NODE_ENV = 'test';

  try {
    const { env } = await import('../src/config/env.js');

    assert.equal(env.nodeEnv, 'test');
    assert.equal(env.authSecret, 'test-secret-012345678901234567890123');
    assert.equal(env.mongoUri, 'mongodb://127.0.0.1:27017/absteras_test');
  } finally {
    if (originalNodeEnv === undefined) delete process.env.NODE_ENV;
    else process.env.NODE_ENV = originalNodeEnv;

    if (originalAuthSecret === undefined) delete process.env.AUTH_SECRET;
    else process.env.AUTH_SECRET = originalAuthSecret;

    if (originalMongoUri === undefined) delete process.env.MONGODB_URI;
    else process.env.MONGODB_URI = originalMongoUri;
  }
});
