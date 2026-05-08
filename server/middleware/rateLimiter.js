const rateLimit = require('express-rate-limit');

// Rate limiter for complaint submissions: 10 per day per user
const complaintLimiter = rateLimit({
  windowMs: 24 * 60 * 60 * 1000, // 24 hours
  max: 10,
  keyGenerator: (req) => {
    return req.userId ? req.userId.toString() : req.ip;
  },
  message: {
    error: 'Too many complaints submitted today. You can submit up to 10 complaints per day.'
  },
  standardHeaders: true,
  legacyHeaders: false
});

// General rate limiter for auth routes
const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 20,
  message: { error: 'Too many login attempts. Please try again later.' },
  standardHeaders: true,
  legacyHeaders: false
});

module.exports = { complaintLimiter, authLimiter };
