import crypto from 'crypto';
import { config } from '../config/index.js';

/**
 * Verifies AppSumo webhook HMAC-SHA256 signature and timestamp replay protection.
 *
 * Algorithm per AppSumo Licensing Partner Guide:
 * 1. Read X-Appsumo-Timestamp header.
 * 2. Concatenate: timestamp + raw_request_body.
 * 3. Generate HMAC SHA256 using APPSUMO_API_KEY as the secret.
 * 4. Compare with X-Appsumo-Signature using timing-safe comparison.
 *
 * @param {object} params
 * @param {string} params.rawBody - Raw string body of the request
 * @param {string} params.signature - Value of X-Appsumo-Signature header
 * @param {string|number} params.timestamp - Value of X-Appsumo-Timestamp header
 * @param {string} [params.secretKey] - Optional override key (defaults to config.appsumo.apiKey)
 * @param {number} [params.toleranceSeconds=600] - Replay protection threshold (10 minutes)
 * @returns {{ valid: boolean, error?: string }}
 */
export const verifyAppSumoWebhook = ({
  rawBody,
  signature,
  timestamp,
  secretKey = config.appsumo.apiKey,
  toleranceSeconds = 600,
}) => {
  if (!secretKey) {
    return { valid: false, error: 'APPSUMO_API_KEY is not configured on the server.' };
  }

  if (!signature || typeof signature !== 'string') {
    return { valid: false, error: 'Missing or empty X-Appsumo-Signature header.' };
  }

  if (!timestamp) {
    return { valid: false, error: 'Missing or empty X-Appsumo-Timestamp header.' };
  }

  // 1. Replay attack protection
  // Note: AppSumo timestamps can be in seconds or milliseconds
  const tsNumber = Number(timestamp);
  if (isNaN(tsNumber) || tsNumber <= 0) {
    return { valid: false, error: 'Invalid X-Appsumo-Timestamp header format.' };
  }

  const nowMs = Date.now();
  const eventTimeMs = tsNumber > 1e11 ? tsNumber : tsNumber * 1000;
  const ageSeconds = Math.abs(nowMs - eventTimeMs) / 1000;

  if (toleranceSeconds > 0 && ageSeconds > toleranceSeconds) {
    return {
      valid: false,
      error: `Webhook timestamp expired or out of tolerance (${Math.round(ageSeconds)}s > ${toleranceSeconds}s).`,
    };
  }

  // 2. Concatenate timestamp + raw body
  const payloadToSign = `${timestamp}${rawBody || ''}`;

  // 3. Generate HMAC SHA-256
  const hmac = crypto.createHmac('sha256', secretKey);
  hmac.update(payloadToSign, 'utf8');
  const expectedSignatureHex = hmac.digest('hex');

  // Also support base64 if sent
  const cleanSignature = signature.trim().replace(/^sha256=/i, '');

  try {
    const expectedBuf = Buffer.from(expectedSignatureHex, 'utf8');
    const providedBuf = Buffer.from(cleanSignature, 'utf8');

    if (expectedBuf.length !== providedBuf.length) {
      // Signature length mismatch
      return { valid: false, error: 'Signature length mismatch.' };
    }

    const matches = crypto.timingSafeEqual(expectedBuf, providedBuf);
    if (!matches) {
      return { valid: false, error: 'Invalid HMAC signature.' };
    }

    return { valid: true };
  } catch (err) {
    return { valid: false, error: `Signature comparison error: ${err.message}` };
  }
};
