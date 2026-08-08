import { AuthSession } from '../models/auth-session.model.js';
import { BlockedToken } from '../models/blocked-token.model.js';
import { requestIp } from '../../../helpers/request-ip.js';
import { redisCommand } from '../../../services/redis-cache.service.js';
import { ACCESS_TOKEN_TTL_SECONDS, createAccessToken, createRefreshToken, hashRefreshToken } from './token.service.js';

export function createAccessTokenPair(user) {
  const accessToken = createAccessToken(user);
  const [, payload] = accessToken.split('.');
  const claims = JSON.parse(Buffer.from(payload, 'base64url').toString('utf8'));
  return {
    accessToken,
    accessTokenJti: claims.jti,
    accessTokenExpiresAt: new Date(claims.exp * 1000),
  };
}

export async function revokeActiveUserSessions(userId) {
  const now = new Date();
  const sessions = await AuthSession.find({ user: userId, revokedAt: null, expiresAt: { $gt: now } }).select('accessTokenJti').lean();
  await AuthSession.updateMany({ user: userId, revokedAt: null }, { revokedAt: now });
  await Promise.all(
    sessions
      .filter((session) => session.accessTokenJti)
      .map((session) => blockAccessToken({ jti: session.accessTokenJti, exp: Math.floor(Date.now() / 1000) + ACCESS_TOKEN_TTL_SECONDS, sub: userId })),
  );
}

export async function revokeAllActiveSessions() {
  const now = new Date();
  const sessions = await AuthSession.find({ revokedAt: null, expiresAt: { $gt: now } }).select('accessTokenJti user').lean();
  await AuthSession.updateMany({ revokedAt: null }, { revokedAt: now });
  await Promise.all(
    sessions
      .filter((session) => session.accessTokenJti)
      .map((session) => blockAccessToken({ jti: session.accessTokenJti, exp: Math.floor(Date.now() / 1000) + ACCESS_TOKEN_TTL_SECONDS, sub: session.user })),
  );
  return sessions.length;
}

export async function hasActiveUserSession(userId) {
  return Boolean(await AuthSession.exists({ user: userId, revokedAt: null, expiresAt: { $gt: new Date() } }));
}

export async function createSession(user, req) {
  const refreshToken = createRefreshToken();
  const tokenHash = hashRefreshToken(refreshToken);
  const access = createAccessTokenPair(user);
  const expiresAt = new Date(Date.now() + 14 * 24 * 60 * 60 * 1000);

  await AuthSession.create({
    user: user._id,
    tokenHash,
    accessTokenJti: access.accessTokenJti,
    userAgent: String(req.get('user-agent') || '').slice(0, 300),
    ipAddress: requestIp(req),
    expiresAt,
  });

  return { ...access, refreshToken, refreshTokenExpiresAt: expiresAt };
}

export async function blockAccessToken(claims) {
  if (!claims?.jti || !claims.exp) return;

  const expiresIn = Math.max(1, claims.exp - Math.floor(Date.now() / 1000));

  await BlockedToken.updateOne(
    { jti: claims.jti },
    {
      $setOnInsert: {
        jti: claims.jti,
        user: claims.sub,
        expiresAt: new Date(claims.exp * 1000),
      },
    },
    { upsert: true },
  );
  await redisCommand((connection) => connection.set(`auth:blocked-token:${claims.jti}`, '1', 'EX', expiresIn));
}

export async function isAccessTokenBlocked(claims) {
  if (!claims?.jti) return false;
  const expiresIn = Math.max(1, Number(claims.exp || 0) - Math.floor(Date.now() / 1000));
  const cached = await redisCommand((connection) => connection.get(`auth:blocked-token:${claims.jti}`));
  if (cached !== undefined) return cached === '1';

  const blocked = Boolean(await BlockedToken.exists({ jti: claims.jti }));
  await redisCommand((connection) => connection.set(`auth:blocked-token:${claims.jti}`, blocked ? '1' : '0', 'EX', expiresIn));
  return blocked;
}

export async function rotateSession(refreshToken, req) {
  if (!refreshToken) return null;

  const now = new Date();
  const tokenHash = hashRefreshToken(refreshToken);
  const newRefreshToken = createRefreshToken();
  const newTokenHash = hashRefreshToken(newRefreshToken);
  const session = await AuthSession.findOneAndUpdate(
    { tokenHash, revokedAt: null, expiresAt: { $gt: now } },
    { revokedAt: now, replacedBy: newTokenHash },
    { new: true },
  ).populate('user');

  if (!session) {
    const reused = await AuthSession.findOne({ tokenHash }).populate('user');
    if (reused?.revokedAt && reused.user?._id) {
      await revokeActiveUserSessions(reused.user._id);
    }
    return null;
  }

  if (session.user?.status !== 'active') {
    return null;
  }

  const access = createAccessTokenPair(session.user);
  const expiresAt = new Date(Date.now() + 14 * 24 * 60 * 60 * 1000);

  await blockAccessToken({ jti: session.accessTokenJti, exp: Math.floor(Date.now() / 1000) + ACCESS_TOKEN_TTL_SECONDS, sub: session.user._id });

  await AuthSession.create({
    user: session.user._id,
    tokenHash: newTokenHash,
    accessTokenJti: access.accessTokenJti,
    userAgent: String(req.get('user-agent') || '').slice(0, 300),
    ipAddress: requestIp(req),
    expiresAt,
  });

  return { ...access, refreshToken: newRefreshToken, refreshTokenExpiresAt: expiresAt, user: session.user };
}

export async function revokeSession(refreshToken, claims) {
  let revokedSession = null;

  if (refreshToken) {
    revokedSession = await AuthSession.findOneAndUpdate(
      { tokenHash: hashRefreshToken(refreshToken), revokedAt: null },
      { revokedAt: new Date() },
      { new: true },
    );
    if (revokedSession?.accessTokenJti) {
      await blockAccessToken({ jti: revokedSession.accessTokenJti, exp: claims?.exp || Math.floor(Date.now() / 1000) + ACCESS_TOKEN_TTL_SECONDS, sub: revokedSession.user });
    }
  }

  await blockAccessToken(claims);
  return revokedSession;
}
