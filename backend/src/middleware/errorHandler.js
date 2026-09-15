import { sendError } from '../utils/apiResponse.js';
import { config } from '../config/index.js';

/**
 * Centralized Error Handling Middleware
 */
export const errorHandler = (err, req, res, next) => {
  console.error('💥 Unhandled Error:', err);

  const statusCode = err.statusCode || err.status || 500;
  const message = err.message || 'Internal server error occurred.';

  const errors = [];
  if (config.nodeEnv === 'development' && err.stack) {
    // Only in development do we record error detail in a clean error object
    errors.push(err.message);
  }

  return sendError(res, message, statusCode, errors);
};

/**
 * 404 Not Found Middleware
 */
export const notFoundHandler = (req, res) => {
  return sendError(res, `API route '${req.originalUrl}' not found.`, 404);
};
