import crypto from 'crypto';
import { config } from '../config/index.js';

// Derive 32-byte master encryption key from secret
const RAW_KEY = process.env.FIELD_ENCRYPTION_KEY || config.jwt.secret || 'hrms_tasknera_super_secret_field_key_32b';
const MASTER_KEY = crypto.createHash('sha256').update(RAW_KEY).digest();
const ALGORITHM = 'aes-256-gcm';
const IV_LENGTH = 12; // Standard 96-bit IV for GCM
const TAG_LENGTH = 16;

/**
 * Deterministic SHA-256 hash for secure collision checking without decrypting.
 * Normalizes input (trimmed, uppercase) so lookups are case-insensitive.
 *
 * @param {string} value
 * @returns {string|null} 64-char hex hash
 */
export const hashDeterministic = (value) => {
  if (!value || typeof value !== 'string') return null;
  const normalized = value.trim().toUpperCase();
  if (!normalized) return null;
  return crypto.createHash('sha256').update(normalized).digest('hex');
};

/**
 * Encrypt sensitive field value with AES-256-GCM
 *
 * @param {string} plainText
 * @returns {{ ciphertext: string, iv: string, tag: string, algorithm: string, rawEncrypted: string }|null}
 */
export const encryptField = (plainText) => {
  if (!plainText || typeof plainText !== 'string') return null;
  const iv = crypto.randomBytes(IV_LENGTH);
  const cipher = crypto.createCipheriv(ALGORITHM, MASTER_KEY, iv);

  let encrypted = cipher.update(plainText, 'utf8', 'hex');
  encrypted += cipher.final('hex');
  const tag = cipher.getAuthTag();

  const ivHex = iv.toString('hex');
  const tagHex = tag.toString('hex');

  return {
    ciphertext: encrypted,
    iv: ivHex,
    tag: tagHex,
    algorithm: ALGORITHM,
    rawEncrypted: `enc:v1:${ivHex}:${tagHex}:${encrypted}`,
  };
};

/**
 * Decrypt sensitive field value
 *
 * @param {string} encryptedString - Format `enc:v1:<iv>:<tag>:<ciphertext>`
 * @returns {string|null} Plaintext
 */
export const decryptField = (encryptedString) => {
  if (!encryptedString || typeof encryptedString !== 'string') return null;
  if (!encryptedString.startsWith('enc:v1:')) {
    // Return as is if not encrypted in this scheme
    return encryptedString;
  }

  try {
    const parts = encryptedString.split(':');
    if (parts.length !== 5) return null;
    const [, , ivHex, tagHex, ciphertext] = parts;

    const iv = Buffer.from(ivHex, 'hex');
    const tag = Buffer.from(tagHex, 'hex');
    const decipher = crypto.createDecipheriv(ALGORITHM, MASTER_KEY, iv);
    decipher.setAuthTag(tag);

    let decrypted = decipher.update(ciphertext, 'hex', 'utf8');
    decrypted += decipher.final('utf8');
    return decrypted;
  } catch (error) {
    console.error('Failed to decrypt field:', error.message);
    return null;
  }
};

/**
 * Mask National ID (e.g. PAN / Aadhaar / SSN) for safe non-privileged display
 *
 * @param {string} idString
 * @returns {string}
 */
export const maskNationalId = (idString) => {
  if (!idString) return '';
  const clean = idString.toString().trim();
  if (clean.length <= 4) return '****';
  const visible = clean.slice(-4);
  return '*'.repeat(clean.length - 4) + visible;
};

/**
 * Mask Email for safe display
 *
 * @param {string} email
 * @returns {string}
 */
export const maskEmail = (email) => {
  if (!email || !email.includes('@')) return email || '';
  const [local, domain] = email.split('@');
  if (local.length <= 2) return `${local[0]}*@${domain}`;
  const maskedLocal = local[0] + '*'.repeat(local.length - 2) + local[local.length - 1];
  return `${maskedLocal}@${domain}`;
};

