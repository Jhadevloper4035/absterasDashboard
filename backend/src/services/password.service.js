import { randomBytes, scrypt, timingSafeEqual } from 'node:crypto';
import { promisify } from 'node:util';

const scryptAsync = promisify(scrypt);

export async function hashPassword(password) {
  const salt = randomBytes(16).toString('hex');
  const hash = await scryptAsync(password, salt, 64);

  return `scrypt:${salt}:${hash.toString('hex')}`;
}

export async function verifyPassword(password, passwordHash) {
  if (!passwordHash) {
    return false;
  }

  const [method, salt, stored] = passwordHash.split(':');

  if (method !== 'scrypt' || !salt || !stored) {
    return false;
  }

  const hash = await scryptAsync(password, salt, 64);
  const storedHash = Buffer.from(stored, 'hex');

  return storedHash.length === hash.length && timingSafeEqual(storedHash, hash);
}
