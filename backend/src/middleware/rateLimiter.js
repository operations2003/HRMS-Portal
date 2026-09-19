import { sendError } from '../utils/apiResponse.js';

/**
 * Sliding window in-memory rate limiter
 * Tracks request counts per client IP over a given time window
 */
export const createRateLimiter = (options = {}) => {
  const windowMs = options.windowMs || 15 * 60 * 1000; // default: 15 minutes
  const maxRequests = options.max || 200; // default: 200 requests per window
  const message = options.message || 'Too many requests. Please try again later.';
  
  const ipHits = new Map();

  // Periodic cleanup every 5 minutes to prevent memory leaks
  setInterval(() => {
    const now = Date.now();
    for (const [ip, data] of ipHits.entries()) {
      if (now - data.startTime > windowMs) {
        ipHits.delete(ip);
      }
    }
  }, 5 * 60 * 1000).unref();

  return (req, res, next) => {
    // In test environment, skip rate limiting
    if (process.env.NODE_ENV === 'test') {
      return next();
    }

    const ip = req.ip || req.headers['x-forwarded-for'] || req.socket.remoteAddress || 'unknown-ip';
    const now = Date.now();

    let record = ipHits.get(ip);
    if (!record || now - record.startTime > windowMs) {
      record = { count: 1, startTime: now };
      ipHits.set(ip, record);
    } else {
      record.count += 1;
    }

    res.setHeader('X-RateLimit-Limit', maxRequests);
    res.setHeader('X-RateLimit-Remaining', Math.max(0, maxRequests - record.count));
    res.setHeader('X-RateLimit-Reset', new Date(record.startTime + windowMs).toISOString());

    if (record.count > maxRequests) {
      return sendError(
        res,
        message,
        429,
        [`Rate limit exceeded. Maximum ${maxRequests} requests per ${Math.round(windowMs / 60000)} minutes.`]
      );
    }

    next();
  };
};

export const apiRateLimiter = createRateLimiter({
  windowMs: 15 * 60 * 1000,
  max: 300,
  message: 'API rate limit exceeded. Please throttle your requests.',
});

export const authRateLimiter = createRateLimiter({
  windowMs: 15 * 60 * 1000,
  max: 25,
  message: 'Too many authentication attempts. Please try again after 15 minutes.',
});

