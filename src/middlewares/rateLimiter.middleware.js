import rateLimit from "express-rate-limit";

const registerLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: 5,
  message: {
    success: false,
    message: "Too many registration attempts, please try again after 1 minute",
    errors: [],
  },
  standardHeaders: true,
  legacyHeaders: false,
  validate: { xForwardedForHeader: false },
});

export { registerLimiter };
