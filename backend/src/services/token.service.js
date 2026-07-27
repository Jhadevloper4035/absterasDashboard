import { createHmac } from 'node:crypto';
import { env } from '../config/env.js';

const TOKEN_TTL_SECONDS = 60 * 60 * 24;

function encode(value) {
  return Buffer.from(JSON.stringify(value)).toString('base64url');
}

function sign(data) {
  return createHmac('sha256', env.authSecret).update(data).digest('base64url');
}

export function createAccessToken(user) {
  const now = Math.floor(Date.now() / 1000);
  const header = encode({ alg: 'HS256', typ: 'JWT' });
  const payload = encode({
    sub: user.id,
    role: user.role,
    iat: now,
    exp: now + TOKEN_TTL_SECONDS,
  });
  const data = `${header}.${payload}`;

  return `${data}.${sign(data)}`;
}

export function verifyAccessToken(token) {
  try {
    const [header, payload, signature] = token.split('.');
    const data = `${header}.${payload}`;

    if (!header || !payload || !signature || sign(data) !== signature) {
      return null;
    }

    const claims = JSON.parse(Buffer.from(payload, 'base64url').toString('utf8'));

    return claims.exp > Math.floor(Date.now() / 1000) ? claims : null;
  } catch {
    return null;
  }
}
