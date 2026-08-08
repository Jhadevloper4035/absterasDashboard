import Redis from 'ioredis';
import { env } from '../config/env.js';

const TTL_SECONDS = 30;
let redis;

function client() {
  if (!env.redis.url) return null;
  if (!redis || redis.status === 'end') {
    redis = new Redis(env.redis.url, { lazyConnect: true, enableOfflineQueue: false, connectTimeout: 500, maxRetriesPerRequest: 1 });
    redis.on('error', () => {});
  }
  return redis;
}

async function safely(work) {
  try {
    const connection = client();
    if (!connection) return undefined;
    if (connection.status === 'wait') await connection.connect();
    return await work(connection);
  } catch {
    return undefined;
  }
}

export async function redisCommand(work) {
  return safely(work);
}

export async function cachedJson(namespace, key, load, fresh = false) {
  if (fresh) return load();
  const version = (await safely((connection) => connection.get(`cache:version:${namespace}`))) || '0';
  const cacheKey = `cache:${namespace}:${version}:${key}`;
  const cached = await safely((connection) => connection.get(cacheKey));
  if (cached) {
    try {
      return JSON.parse(cached);
    } catch {
      // Invalid cache values are ignored and replaced below.
    }
  }
  const data = await load();
  await safely((connection) => connection.set(cacheKey, JSON.stringify(data), 'EX', TTL_SECONDS));
  return data;
}

export async function invalidateCache(namespace) {
  await safely((connection) => connection.incr(`cache:version:${namespace}`));
}
