import { AuthSession } from '../models/auth-session.model.js';
import { BlockedToken } from '../models/blocked-token.model.js';
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
    ipAddress: req.ip,
    expiresAt,
  });

  return { ...access, refreshToken, refreshTokenExpiresAt: expiresAt };
}

export async function blockAccessToken(claims) {
  if (!claims?.jti || !claims.exp) return;

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
}

export async function isAccessTokenBlocked(claims) {
  return Boolean(claims?.jti && (await BlockedToken.exists({ jti: claims.jti })));
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
      await AuthSession.updateMany({ user: reused.user._id, revokedAt: null }, { revokedAt: new Date() });
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
    ipAddress: req.ip,
    expiresAt,
  });

  return { ...access, refreshToken: newRefreshToken, refreshTokenExpiresAt: expiresAt, user: session.user };
}

export async function revokeSession(refreshToken, claims) {
  if (refreshToken) {
    const session = await AuthSession.findOneAndUpdate(
      { tokenHash: hashRefreshToken(refreshToken), revokedAt: null },
      { revokedAt: new Date() },
      { new: true },
    );
    if (session?.accessTokenJti) {
      await blockAccessToken({ jti: session.accessTokenJti, exp: claims?.exp || Math.floor(Date.now() / 1000) + ACCESS_TOKEN_TTL_SECONDS, sub: session.user });
    }
  }

  await blockAccessToken(claims);
}
