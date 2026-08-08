import Redis from 'ioredis';
import { env } from '../../../config/env.js';

export const MAX_LOGIN_ATTEMPTS = 3;
export const LOGIN_ATTEMPT_WINDOW_SECONDS = 60 * 60;

let redis;
let storeForTest;

function key(userId) {
  return `auth:failed-login:${userId}`;
}

function client() {
  if (!env.redis.url) throw new Error('Login protection requires REDIS_URL');
  redis ||= new Redis(env.redis.url, { maxRetriesPerRequest: 1 });
  return redis;
}

export function setLoginAttemptStoreForTest(store) {
  storeForTest = store;
}

export async function recordFailedLoginAttempt(userId) {
  if (storeForTest) return storeForTest.increment(key(userId));
  const attempts = Number(await client().incr(key(userId)));
  if (attempts === 1) await client().expire(key(userId), LOGIN_ATTEMPT_WINDOW_SECONDS);
  return attempts;
}

export async function clearFailedLoginAttempts(userId) {
  if (!userId) return;
  if (storeForTest) return storeForTest.delete(key(userId));
  return client().del(key(userId));
}
