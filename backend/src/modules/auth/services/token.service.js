import { createHmac, randomBytes, randomUUID, timingSafeEqual } from 'node:crypto';
import { env } from '../../../config/env.js';

export const ACCESS_TOKEN_TTL_SECONDS = 15 * 60;
export const REFRESH_TOKEN_TTL_SECONDS = 60 * 60 * 24 * 14;

function encode(value) {
  return Buffer.from(JSON.stringify(value)).toString('base64url');
}

function sign(data) {
  return createHmac('sha256', env.authSecret).update(data).digest('base64url');
}

function safeEqual(left, right) {
  const leftBuffer = Buffer.from(left);
  const rightBuffer = Buffer.from(right);
  return leftBuffer.length === rightBuffer.length && timingSafeEqual(leftBuffer, rightBuffer);
}

export function createAccessToken(user, { jti = randomUUID(), expiresInSeconds = ACCESS_TOKEN_TTL_SECONDS } = {}) {
  const now = Math.floor(Date.now() / 1000);
  const header = encode({ alg: 'HS256', typ: 'JWT' });
  const payload = encode({
    sub: user.id || user._id,
    role: user.role,
    type: 'access',
    jti,
    iat: now,
    exp: now + expiresInSeconds,
  });
  const data = `${header}.${payload}`;

  return `${data}.${sign(data)}`;
}

export function verifyAccessToken(token) {
  try {
    const [header, payload, signature] = token.split('.');
    const data = `${header}.${payload}`;

    if (!header || !payload || !signature || !safeEqual(sign(data), signature)) {
      return null;
    }

    const decodedHeader = JSON.parse(Buffer.from(header, 'base64url').toString('utf8'));
    const claims = JSON.parse(Buffer.from(payload, 'base64url').toString('utf8'));

    return decodedHeader.alg === 'HS256' && claims.type === 'access' && claims.exp > Math.floor(Date.now() / 1000) ? claims : null;
  } catch {
    return null;
  }
}

export function createRefreshToken() {
  return randomBytes(48).toString('base64url');
}

export function hashRefreshToken(token) {
  return createHmac('sha256', env.authSecret).update(token).digest('hex');
}
