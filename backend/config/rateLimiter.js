import rateLimit from 'express-rate-limit';

const noopLimiter = (_req, _res, next) => next();

/**
 * Creates a rate limiter or a no-op middleware depending on DISABLE_RATE_LIMIT.
 * Usage: identical to express-rate-limit – pass the same options object.
 */
export function createRateLimiter(opts) {
  if (process.env.DISABLE_RATE_LIMIT === 'true') {
    return noopLimiter;
  }
  return rateLimit(opts);
}
