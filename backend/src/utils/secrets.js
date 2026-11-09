/**
 * BruClinic — Reversible secret storage
 *
 * The clinic default staff password has to be re-displayable to administrators,
 * so it is sealed with AES-256-GCM (key derived from JWT_SECRET) instead of
 * being stored in clear text. The one-way hash used to create accounts stays in
 * a separate system_config row.
 */

import { createCipheriv, createDecipheriv, createHash, randomBytes } from 'node:crypto';
import { env } from '../config/env.js';

const VERSION = 'v1';

function encryptionKey() {
  return createHash('sha256').update(`bruclinic:default-secret:${env.jwtSecret}`).digest();
}

/** Encrypt a secret into a compact, URL-safe string. */
export function sealSecret(plainText) {
  const iv = randomBytes(12);
  const cipher = createCipheriv('aes-256-gcm', encryptionKey(), iv);
  const encrypted = Buffer.concat([cipher.update(String(plainText), 'utf8'), cipher.final()]);
  const tag = cipher.getAuthTag();
  return [VERSION, iv.toString('base64url'), tag.toString('base64url'), encrypted.toString('base64url')].join('.');
}

/** Decrypt a sealed secret; returns null when the value is missing or unreadable. */
export function openSecret(sealed) {
  if (typeof sealed !== 'string' || !sealed.startsWith(`${VERSION}.`)) return null;
  const [, ivPart, tagPart, dataPart] = sealed.split('.');
  if (!ivPart || !tagPart || !dataPart) return null;
  try {
    const decipher = createDecipheriv('aes-256-gcm', encryptionKey(), Buffer.from(ivPart, 'base64url'));
    decipher.setAuthTag(Buffer.from(tagPart, 'base64url'));
    const decrypted = Buffer.concat([decipher.update(Buffer.from(dataPart, 'base64url')), decipher.final()]);
    return decrypted.toString('utf8');
  } catch {
    return null;
  }
}
