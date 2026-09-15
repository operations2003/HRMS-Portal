import jwt from 'jsonwebtoken';
import { config } from '../config/index.js';

/**
 * Generate a signed JWT token
 * @param {object} payload - User object payload (e.g. id, email, role, permissions)
 * @returns {string} Signed JWT
 */
export const generateToken = (payload) => {
  return jwt.sign(payload, config.jwt.secret, {
    expiresIn: config.jwt.expiresIn,
  });
};

/**
 * Verify and decode a JWT token
 * @param {string} token
 * @returns {object} Decoded payload
 */
export const verifyToken = (token) => {
  return jwt.verify(token, config.jwt.secret);
};
