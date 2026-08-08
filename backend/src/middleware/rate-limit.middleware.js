import { RateLimit } from '../models/rate-limit.model.js';
import { redisCommand } from '../services/redis-cache.service.js';

function clientKey(req, scope) {
  const email = String(req.body?.email || '').toLowerCase().trim();
  return `${scope}:${req.ip}:${email}`;
}

export function rateLimit({ scope, limit, windowMs }) {
  return async (req, res, next) => {
    const key = clientKey(req, scope);
    const redisHit = await redisCommand(async (connection) => {
      const values = await connection.eval(
        'local count=redis.call("INCR", KEYS[1]); if count==1 then redis.call("PEXPIRE", KEYS[1], ARGV[1]); end; return {count, redis.call("PTTL", KEYS[1])}',
        1,
        `rate-limit:${key}`,
        windowMs,
      );
      return { count: Number(values[0]), retryAfter: Math.max(1, Math.ceil(Number(values[1]) / 1000)) };
    });

    if (redisHit) {
      if (redisHit.count > limit) {
        res.set('Retry-After', String(redisHit.retryAfter));
        return res.status(429).json({ error: { message: 'Too many attempts. Try again later.' } });
      }
      return next();
    }

    const now = new Date();
    const windowExpiresAt = new Date(Date.now() + windowMs);
    const hit = await RateLimit.findOneAndUpdate(
      { key },
      [
        {
          $set: {
            key,
            count: {
              $cond: [{ $gt: ['$windowExpiresAt', now] }, { $add: [{ $ifNull: ['$count', 0] }, 1] }, 1],
            },
            windowExpiresAt: {
              $cond: [{ $gt: ['$windowExpiresAt', now] }, '$windowExpiresAt', windowExpiresAt],
            },
          },
        },
      ],
      { upsert: true, returnDocument: 'after', setDefaultsOnInsert: true, updatePipeline: true },
    );

    if (hit.count > limit) {
      res.set('Retry-After', String(Math.ceil((hit.windowExpiresAt.getTime() - Date.now()) / 1000)));
      return res.status(429).json({ error: { message: 'Too many attempts. Try again later.' } });
    }

    return next();
  };
}
