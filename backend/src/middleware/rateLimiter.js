/**
 * Rate Limiting Middleware (Disabled)
 * Request limits have been removed to allow unlimited requests.
 */
export const createRateLimiter = () => {
  return (req, res, next) => next();
};

export const apiRateLimiter = (req, res, next) => next();

export const authRateLimiter = (req, res, next) => next();

