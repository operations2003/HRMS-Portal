/**
 * Standardized API Response Utilities
 */

export const sendSuccess = (res, message = 'Success', data = null, meta = null, statusCode = 200) => {
  if (typeof meta === 'number') {
    statusCode = meta;
    meta = null;
  }

  const response = {
    success: true,
    message,
    data,
  };

  if (meta !== null && meta !== undefined) {
    response.meta = meta;
  }

  return res.status(statusCode).json(response);
};

export const sendError = (res, message = 'An error occurred', statusCode = 500, errors = []) => {
  return res.status(statusCode).json({
    success: false,
    message,
    errors: Array.isArray(errors) ? errors : [errors],
  });
};
