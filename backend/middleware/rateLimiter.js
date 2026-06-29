const rateLimit = require("express-rate-limit");

const passthrough = (req, res, next) => next();

if (process.env.NODE_ENV === "test") {
  module.exports = { authLimiter: passthrough, forgotLimiter: passthrough };
  return;
}

const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 10,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: "Too many attempts, please try again later." },
});

const forgotLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 5,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: "Too many attempts, please try again later." },
});

module.exports = { authLimiter, forgotLimiter };
