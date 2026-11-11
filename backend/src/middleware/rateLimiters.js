const rateLimit = require("express-rate-limit");

const createLimiter = ({ limit, windowMs = 15 * 60 * 1000, message }) =>
  rateLimit({
    windowMs,
    limit,
    standardHeaders: "draft-8",
    legacyHeaders: false,
    message: {
      success: false,
      message,
    },
  });

const registerLimiter = createLimiter({
  limit: 5,
  message: "Too many registration attempts. Please try again later.",
});

const loginLimiter = createLimiter({
  limit: 10,
  message: "Too many login attempts. Please try again later.",
});

const verifyOtpLimiter = createLimiter({
  limit: 10,
  message: "Too many OTP verification attempts. Please try again later.",
});

const resendOtpLimiter = createLimiter({
  limit: 5,
  message: "Too many OTP requests. Please try again later.",
});

const refreshLimiter = createLimiter({
  limit: 30,
  message: "Too many session refresh requests. Please log in again.",
});

const logoutLimiter = createLimiter({
  limit: 30,
  message: "Too many logout requests. Please try again later.",
});

const classroomJoinLimiter = createLimiter({
  limit: 5,
  message: "Too many classroom join attempts. Please try again later.",
});

module.exports = {
  registerLimiter,
  loginLimiter,
  verifyOtpLimiter,
  resendOtpLimiter,
  refreshLimiter,
  logoutLimiter,
  classroomJoinLimiter,
};
