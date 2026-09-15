import { sendError } from '../utils/apiResponse.js';
import { config } from '../config/index.js';

/**
 * Centralized Error Handling Middleware
 */
export const errorHandler = (err, req, res, next) => {
  console.error('💥 Unhandled Error:', err);

  let statusCode = err.statusCode || err.status || 500;
  let message = err.message || 'Internal server error occurred.';

  // Handle Express body-parser malformed JSON errors
  if (err instanceof SyntaxError && err.status === 400 && 'body' in err) {
    statusCode = 400;
    message = 'Invalid JSON syntax in request body.';
  }

  // Handle PostgreSQL data exceptions if not caught in service layer
  if (err.code === '22001') {
    statusCode = 400;
    message = 'One or more text fields exceed the maximum allowed length.';
  } else if (err.code === '22003') {
    statusCode = 400;
    message = 'Numeric value is out of allowable range.';
  } else if (err.code === '22007') {
    statusCode = 400;
    message = 'Invalid date format or calendar date is out of range.';
  } else if (err.code === '22P02') {
    statusCode = 400;
    message = 'Invalid input syntax for data type.';
  }

  const errors = [];
  if (config.nodeEnv === 'development' && err.stack) {
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
