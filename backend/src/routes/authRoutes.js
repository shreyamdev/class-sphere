const express = require("express");

const {
  register,
  verifyOtp,
  resendOtp,
  login,
  refresh,
  logout,
  me,
} = require("../controllers/authController");

const { protect } = require("../middleware/authMiddleware");
const {
  registerLimiter,
  loginLimiter,
  verifyOtpLimiter,
  resendOtpLimiter,
  refreshLimiter,
  logoutLimiter,
} = require("../middleware/rateLimiters");

const router = express.Router();

router.post("/register", registerLimiter, register);
router.post("/verify-otp", verifyOtpLimiter, verifyOtp);
router.post("/resend-otp", resendOtpLimiter, resendOtp);
router.post("/login", loginLimiter, login);
router.post("/refresh", refreshLimiter, refresh);
router.post("/logout", logoutLimiter, logout);
router.get("/me", protect, me);

module.exports = router;
