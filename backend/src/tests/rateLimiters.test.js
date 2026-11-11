const test = require("node:test");
const assert = require("node:assert/strict");
const limiters = require("../middleware/rateLimiters");

test("exports distinct limiters for account, OTP, and classroom-join endpoints", () => {
  for (const name of [
    "registerLimiter",
    "loginLimiter",
    "verifyOtpLimiter",
    "resendOtpLimiter",
    "refreshLimiter",
    "logoutLimiter",
    "classroomJoinLimiter",
  ]) {
    assert.equal(typeof limiters[name], "function", `${name} should be a middleware`);
  }
});
