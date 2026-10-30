import crypto from 'node:crypto';
import { env } from '../config/env.js';

function getSecret() {
  if (!env.jwtSecret || env.jwtSecret === 'replace-with-a-long-random-secret') {
    throw new Error('JWT_SECRET must be configured before authentication is enabled');
  }
  return env.jwtSecret;
}

const PASSWORD_ITERATIONS = 120_000;

export function hashPassword(password) {
  const salt = crypto.randomBytes(16).toString('hex');
  const hash = crypto.pbkdf2Sync(password, salt, PASSWORD_ITERATIONS, 64, 'sha512').toString('hex');
  return `${salt}:${hash}`;
}

export function verifyPassword(password, storedHash) {
  if (!storedHash || !storedHash.includes(':')) return false;
  const [salt, originalHash] = storedHash.split(':');
  const expected = Buffer.from(originalHash, 'hex');
  return [PASSWORD_ITERATIONS, 1000].some(iterations => {
    const hash = crypto.pbkdf2Sync(password, salt, iterations, 64, 'sha512').toString('hex');
    const actual = Buffer.from(hash, 'hex');
    return expected.length === actual.length && crypto.timingSafeEqual(expected, actual);
  });
}

export function generateToken(user, { ttlSeconds = 8 * 60 * 60 } = {}) {
  const issuedAt = Math.floor(Date.now() / 1000);
  const payload = {
    id: user.id,
    username: user.username,
    role: user.role,
    name: user.name,
    iat: issuedAt,
    exp: issuedAt + Math.max(300, Number(ttlSeconds) || 8 * 60 * 60),
    iss: 'bruclinic-api',
    aud: 'bruclinic-web',
  };
  const str = Buffer.from(JSON.stringify(payload)).toString('base64url');
  const signature = crypto.createHmac('sha256', getSecret()).update(str).digest('base64url');
  return `${str}.${signature}`;
}

export function verifyToken(token) {
  if (!token) return null;
  let secret;
  try { secret = getSecret(); } catch { return null; }
  const parts = token.split('.');
  if (parts.length !== 2) return null;
  const [str, sig] = parts;
  const expectedSig = crypto.createHmac('sha256', secret).update(str).digest('base64url');
  const supplied = Buffer.from(sig);
  const expected = Buffer.from(expectedSig);
  if (supplied.length !== expected.length || !crypto.timingSafeEqual(supplied, expected)) return null;
  try {
    const payload = JSON.parse(Buffer.from(str, 'base64url').toString('utf8'));
    const now = Math.floor(Date.now() / 1000);
    const expiry = Number(payload.exp);
    if (!payload.id || !payload.role || !payload.username) return null;
    if (payload.exp && (expiry > 1e12 ? Date.now() : now) > expiry) return null;
    if (payload.iss && payload.iss !== 'bruclinic-api') return null;
    if (payload.aud && payload.aud !== 'bruclinic-web') return null;
    return payload;
  } catch {
    return null;
  }
}
