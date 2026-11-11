const express = require("express");
const { googleAuth } = require("../controllers/googleAuthController");
const { loginLimiter } = require("../middleware/rateLimiters");

const router = express.Router();
router.post("/", loginLimiter, googleAuth);

module.exports = router;
