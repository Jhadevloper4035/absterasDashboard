import { RateLimit } from '../../../models/rate-limit.model.js';

export const MAX_LOGIN_ATTEMPTS = 3;
export const LOGIN_ATTEMPT_WINDOW_SECONDS = 60 * 60;

let storeForTest;

function key(userId) {
  return `auth:failed-login:${userId}`;
}

export function setLoginAttemptStoreForTest(store) {
  storeForTest = store;
}

export async function recordFailedLoginAttempt(userId) {
  if (storeForTest) return storeForTest.increment(key(userId));
  const now = new Date();
  const hit = await RateLimit.findOneAndUpdate(
    { key: key(userId) },
    [{ $set: {
      key: key(userId),
      count: { $cond: [{ $gt: ['$windowExpiresAt', now] }, { $add: [{ $ifNull: ['$count', 0] }, 1] }, 1] },
      windowExpiresAt: { $cond: [{ $gt: ['$windowExpiresAt', now] }, '$windowExpiresAt', new Date(Date.now() + LOGIN_ATTEMPT_WINDOW_SECONDS * 1000)] },
    } }],
    { upsert: true, returnDocument: 'after', setDefaultsOnInsert: true, updatePipeline: true },
  );
  return hit.count;
}

export async function clearFailedLoginAttempts(userId) {
  if (!userId) return;
  if (storeForTest) return storeForTest.delete(key(userId));
  return RateLimit.deleteOne({ key: key(userId) });
}
