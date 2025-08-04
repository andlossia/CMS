const { RateLimiterMemory } = require('rate-limiter-flexible');
const { adminDB } = require('../database');

const AuthModel = () => adminDB().collection('authentications');

const limiter = new RateLimiterMemory({
  points: 5,
  duration: 15 * 60, 
  blockDuration: 2 * 60 
});

const rateLimiter = (keyResolver = (req) => req.body.identifier || req.ip) => {
  return async (req, res, next) => {
    const key = keyResolver(req);
    const now = new Date();

    const account = await AuthModel().findOne({ identifier: key });
    if (account?.penalty?.level && account.penalty.expiresAt > now) {
      return res.status(403).json({
        success: false,
        code: `PENALTY_${account.penalty.level.toUpperCase()}`,
        message: `⛔ Access denied. ${account.penalty.level} card active until ${account.penalty.expiresAt.toISOString()}`
      });
    }

    try {
      await limiter.consume(key);
      next();
    } catch (rejRes) {
      const attempts = rejRes.consumedPoints || 0;
      const expiresAt = new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000);

      let penalty = null;
      if (attempts >= 20) {
        penalty = { level: 'black', expiresAt, notes: 'Permanent ban (system)' };
      } else if (attempts >= 15) {
        penalty = { level: 'red', expiresAt, notes: '1-year ban for repeated abuse' };
      } else if (attempts >= 10) {
        penalty = { level: 'yellow', expiresAt, notes: 'Suspicious behavior warning' };
      }

      if (penalty && account) {
        await AuthModel().updateOne({ _id: account._id }, { $set: { penalty } });
      }

      return res.tooManyRequests({
        success: false,
        code: 'RATE_LIMIT_EXCEEDED',
        message: 'Too many requests. Please wait before trying again.',
        retryAfter: Math.ceil(rejRes.msBeforeNext / 1000)
      });
    }
  };
};

module.exports = rateLimiter;
