const crypto = require("crypto");
const jwt = require("jsonwebtoken");

const User = require("../models/User");
const { hashPassword, comparePassword } = require("../utils/password");

const {
  generateOtp,
  hashOtp,
  hashValue,
  OTP_EXPIRY_MINUTES,
  OTP_RESEND_COOLDOWN_SECONDS,
  MAX_OTP_ATTEMPTS,
} = require("../utils/otp");

const { sendOtpEmail } = require("../services/emailService");
const {
  REFRESH_COOKIE_NAME,
  setAuthCookies,
  clearAuthCookies,
  readCookie,
} = require("../utils/authCookies");

const ACCESS_TOKEN_EXPIRES_IN =
  process.env.ACCESS_TOKEN_EXPIRES_IN || "15m";

const REFRESH_TOKEN_EXPIRES_IN =
  process.env.REFRESH_TOKEN_EXPIRES_IN || "7d";

const isValidEmail = (email) =>
  /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);

const createAccessToken = (user) =>
  jwt.sign(
    {
      sub: user._id.toString(),
      role: user.role,
      type: "access",
    },
    process.env.JWT_SECRET,
    { expiresIn: ACCESS_TOKEN_EXPIRES_IN }
  );

const createRefreshToken = (user) =>
  jwt.sign(
    {
      sub: user._id.toString(),
      jti: crypto.randomUUID(),
      type: "refresh",
    },
    process.env.JWT_REFRESH_SECRET,
    { expiresIn: REFRESH_TOKEN_EXPIRES_IN }
  );

const sendAuthResponse = (res, user, accessToken, refreshToken) => {
  // Tokens are delivered only as HttpOnly cookies, never in the JSON payload.
  setAuthCookies(res, accessToken, refreshToken);

  return res.status(200).json({
    success: true,
    message: "Authentication successful.",
    data: {
      user: {
        id: user._id,
        name: user.name,
        email: user.email,
        role: user.role,
      },
      expiresIn: ACCESS_TOKEN_EXPIRES_IN,
    },
  });
};

// 1. Register a student or teacher and send verification OTP.
const register = async (req, res) => {
  try {
    const { name, email, password, role = "student" } = req.body;

    if (
      typeof name !== "string" ||
      typeof email !== "string" ||
      typeof password !== "string"
    ) {
      return res.status(400).json({
        success: false,
        message: "Name, email and password are required.",
      });
    }

    // Only student and teacher roles are allowed.
    if (!["student", "teacher"].includes(role)) {
      return res.status(400).json({
        success: false,
        message: "Role must be either student or teacher.",
      });
    }

    const cleanName = name.trim();
    const normalizedEmail = email.trim().toLowerCase();

    if (cleanName.length < 2 || cleanName.length > 80) {
      return res.status(400).json({
        success: false,
        message: "Name must be between 2 and 80 characters.",
      });
    }

    if (
      normalizedEmail.length > 254 ||
      !isValidEmail(normalizedEmail)
    ) {
      return res.status(400).json({
        success: false,
        message: "Please provide a valid email address.",
      });
    }

    // bcrypt accepts at most 72 UTF-8 bytes.
    if (
      password.length < 8 ||
      Buffer.byteLength(password, "utf8") > 72
    ) {
      return res.status(400).json({
        success: false,
        message:
          "Password must be at least 8 characters and at most 72 UTF-8 bytes.",
      });
    }

    const existingUser = await User.findOne({
      email: normalizedEmail,
    });

    if (existingUser) {
      return res.status(409).json({
        success: false,
        message: existingUser.isEmailVerified
          ? "An account with this email already exists."
          : "An unverified account already exists. Request a new OTP.",
      });
    }

    const otp = generateOtp();

    const user = await User.create({
      name: cleanName,
      email: normalizedEmail,
      password: await hashPassword(password),
      role,
      isEmailVerified: false,
      emailVerificationOtpHash: hashOtp(otp),
      emailVerificationOtpExpires: new Date(
        Date.now() + OTP_EXPIRY_MINUTES * 60 * 1000
      ),
      emailVerificationAttempts: 0,
      otpResendAvailableAt: new Date(
        Date.now() + OTP_RESEND_COOLDOWN_SECONDS * 1000
      ),
    });

    let emailSent = true;

    try {
      await sendOtpEmail(user.email, otp);
    } catch (emailError) {
      emailSent = false;
      console.error("Registration email failed:", emailError.message);

      // Keep the account; allow an immediate resend since the email may not have gone out.
      await User.updateOne(
        { _id: user._id },
        { $unset: { otpResendAvailableAt: 1 } }
      );
    }

    console.log(
      `User registered: ${user.email} (id ${user._id}) in db "${User.db.name}", collection "${User.collection.name}"`
    );

    return res.status(201).json({
      success: true,
      message: emailSent
        ? "Registration successful. Verify your email using the OTP sent to you."
        : "Account created, but we couldn't send the OTP. Please use Resend OTP.",
      data: {
        userId: user._id,
        name: user.name,
        email: user.email,
        role: user.role,
        isEmailVerified: false,
        otpExpiresInMinutes: OTP_EXPIRY_MINUTES,
        emailSent,
      },
    });
  } catch (error) {
    if (error.code === 11000) {
      return res.status(409).json({
        success: false,
        message: "An account with this email already exists.",
      });
    }

    console.error("Registration error:", error.message);

    return res.status(500).json({
      success: false,
      message: "Internal server error.",
    });
  }
};

// 2. Verify email OTP.
const verifyOtp = async (req, res) => {
  try {
    const { email, otp } = req.body;

    if (
      typeof email !== "string" ||
      typeof otp !== "string" ||
      !isValidEmail(email.trim()) ||
      !/^\d{6}$/.test(otp)
    ) {
      return res.status(400).json({
        success: false,
        message: "Valid email and 6-digit OTP are required.",
      });
    }

    const user = await User.findOne({
      email: email.trim().toLowerCase(),
    }).select(
      "+emailVerificationOtpHash +emailVerificationOtpExpires +emailVerificationAttempts"
    );

    if (!user) {
      return res.status(404).json({
        success: false,
        message: "Account not found.",
      });
    }

    if (user.isEmailVerified) {
      return res.status(400).json({
        success: false,
        message: "Email is already verified.",
      });
    }

    if (user.emailVerificationAttempts >= MAX_OTP_ATTEMPTS) {
      return res.status(429).json({
        success: false,
        message:
          "Maximum OTP attempts reached. Request a new OTP after cooldown.",
      });
    }

    if (
      !user.emailVerificationOtpHash ||
      !user.emailVerificationOtpExpires
    ) {
      return res.status(400).json({
        success: false,
        message: "No active OTP. Please request a new one.",
      });
    }

    if (user.emailVerificationOtpExpires.getTime() <= Date.now()) {
      user.emailVerificationOtpHash = undefined;
      user.emailVerificationOtpExpires = undefined;
      await user.save();

      return res.status(400).json({
        success: false,
        message: "OTP expired. Please request a new one.",
      });
    }

    if (hashOtp(otp) !== user.emailVerificationOtpHash) {
      user.emailVerificationAttempts += 1;
      await user.save();

      return res.status(400).json({
        success: false,
        message: "Invalid OTP.",
        attemptsRemaining: Math.max(
          0,
          MAX_OTP_ATTEMPTS - user.emailVerificationAttempts
        ),
      });
    }

    user.isEmailVerified = true;
    user.emailVerificationOtpHash = undefined;
    user.emailVerificationOtpExpires = undefined;
    user.emailVerificationAttempts = 0;
    user.otpResendAvailableAt = undefined;

    await user.save();

    return res.status(200).json({
      success: true,
      message: "Email verified successfully. You can now log in.",
    });
  } catch (error) {
    console.error("OTP verification error:", error.message);

    return res.status(500).json({
      success: false,
      message: "Internal server error.",
    });
  }
};

// 3. Send a fresh OTP after the cooldown.
const resendOtp = async (req, res) => {
  try {
    const { email } = req.body;

    if (
      typeof email !== "string" ||
      !isValidEmail(email.trim())
    ) {
      return res.status(400).json({
        success: false,
        message: "A valid email is required.",
      });
    }

    const user = await User.findOne({
      email: email.trim().toLowerCase(),
    }).select(
      "+emailVerificationOtpHash +emailVerificationOtpExpires +emailVerificationAttempts +otpResendAvailableAt"
    );

    if (!user) {
      return res.status(404).json({
        success: false,
        message: "Account not found.",
      });
    }

    if (user.isEmailVerified) {
      return res.status(400).json({
        success: false,
        message: "Email is already verified.",
      });
    }

    if (
      user.otpResendAvailableAt &&
      user.otpResendAvailableAt.getTime() > Date.now()
    ) {
      return res.status(429).json({
        success: false,
        message: "Please wait before requesting another OTP.",
        retryAfterSeconds: Math.ceil(
          (user.otpResendAvailableAt.getTime() - Date.now()) / 1000
        ),
      });
    }

    const otp = generateOtp();

    user.emailVerificationOtpHash = hashOtp(otp);
    user.emailVerificationOtpExpires = new Date(
      Date.now() + OTP_EXPIRY_MINUTES * 60 * 1000
    );
    user.emailVerificationAttempts = 0;
    user.otpResendAvailableAt = new Date(
      Date.now() + OTP_RESEND_COOLDOWN_SECONDS * 1000
    );

    await user.save();

    try {
      await sendOtpEmail(user.email, otp);
    } catch (emailError) {
      user.emailVerificationOtpHash = undefined;
      user.emailVerificationOtpExpires = undefined;
      user.otpResendAvailableAt = undefined;
      await user.save();

      console.error("Resend OTP email failed:", emailError.message);

      return res.status(502).json({
        success: false,
        message: "Unable to send OTP email. Please try again.",
      });
    }

    return res.status(200).json({
      success: true,
      message: "A new OTP has been sent to your email.",
      data: {
        email: user.email,
        expiresInMinutes: OTP_EXPIRY_MINUTES,
        resendCooldownSeconds: OTP_RESEND_COOLDOWN_SECONDS,
      },
    });
  } catch (error) {
    console.error("Resend OTP error:", error.message);

    return res.status(500).json({
      success: false,
      message: "Internal server error.",
    });
  }
};

// 4. Login verified users and issue tokens.
const login = async (req, res) => {
  try {
    const { email, password, role } = req.body;

    // Login forms must declare which portal the user is trying to enter.
    // The requested role is only compared with the stored role; it is never used
    // to change the user's role or to create a token with a client-supplied role.
    if (
      typeof email !== "string" ||
      typeof password !== "string" ||
      !email.trim() ||
      !["student", "teacher"].includes(role)
    ) {
      return res.status(400).json({
        success: false,
        message: "Email, password, and a valid role (student or teacher) are required.",
        code: "LOGIN_FIELDS_INVALID",
      });
    }

    const user = await User.findOne({
      email: email.trim().toLowerCase(),
    }).select("+password +refreshTokenHash");

    if (
      !user ||
      !user.password ||
      !(await comparePassword(password, user.password))
    ) {
      return res.status(401).json({
        success: false,
        message: "Invalid email or password.",
      });
    }

    if (!user.isEmailVerified) {
      return res.status(403).json({
        success: false,
        message: "Please verify your email before logging in.",
        code: "EMAIL_NOT_VERIFIED",
      });
    }

    if (role !== user.role) {
      return res.status(403).json({
        success: false,
        message: `This account is registered as ${user.role}. Please use the ${user.role} login.`,
        code: "ROLE_MISMATCH",
        registeredRole: user.role,
      });
    }

    const accessToken = createAccessToken(user);
    const refreshToken = createRefreshToken(user);

    user.refreshTokenHash = hashValue(refreshToken);
    await user.save();

    return sendAuthResponse(res, user, accessToken, refreshToken);
  } catch (error) {
    console.error("Login error:", error.message);

    return res.status(500).json({
      success: false,
      message: "Internal server error.",
    });
  }
};

// 5. Rotate refresh token and issue a new access token.
const refresh = async (req, res) => {
  try {
    const refreshToken = readCookie(req, REFRESH_COOKIE_NAME);

    if (!refreshToken) {
      clearAuthCookies(res);
      return res.status(401).json({
        success: false,
        message: "Refresh session is missing. Please log in again.",
      });
    }

    let decoded;

    try {
      decoded = jwt.verify(
        refreshToken,
        process.env.JWT_REFRESH_SECRET
      );
    } catch {
      clearAuthCookies(res);
      return res.status(401).json({
        success: false,
        message: "Invalid or expired session. Please log in again.",
      });
    }

    if (decoded.type !== "refresh" || !decoded.sub) {
      clearAuthCookies(res);
      return res.status(401).json({
        success: false,
        message: "Invalid refresh session.",
      });
    }

    const user = await User.findById(decoded.sub).select(
      "+refreshTokenHash"
    );

    if (
      !user ||
      !user.refreshTokenHash ||
      hashValue(refreshToken) !== user.refreshTokenHash
    ) {
      clearAuthCookies(res);
      return res.status(401).json({
        success: false,
        message: "Refresh session has expired or been revoked. Please log in again.",
      });
    }

    const newAccessToken = createAccessToken(user);
    const newRefreshToken = createRefreshToken(user);

    user.refreshTokenHash = hashValue(newRefreshToken);
    await user.save();

    return sendAuthResponse(
      res,
      user,
      newAccessToken,
      newRefreshToken
    );
  } catch (error) {
    console.error("Refresh token error:", error.message);

    return res.status(500).json({
      success: false,
      message: "Internal server error.",
    });
  }
};

// 6. Revoke the stored refresh token.
const logout = async (req, res) => {
  try {
    const refreshToken = readCookie(req, REFRESH_COOKIE_NAME);

    if (refreshToken) {
      try {
        const decoded = jwt.verify(
          refreshToken,
          process.env.JWT_REFRESH_SECRET
        );

        if (decoded.type === "refresh" && decoded.sub) {
          const user = await User.findById(decoded.sub).select(
            "+refreshTokenHash"
          );

          if (
            user &&
            user.refreshTokenHash === hashValue(refreshToken)
          ) {
            user.refreshTokenHash = undefined;
            await user.save();
          }
        }
      } catch {
        // Even an invalid/expired session should be cleared in the browser.
      }
    }

    clearAuthCookies(res);

    return res.status(200).json({
      success: true,
      message: "Logged out successfully.",
    });
  } catch (error) {
    console.error("Logout error:", error.message);

    return res.status(500).json({
      success: false,
      message: "Internal server error.",
    });
  }
};

// 7. Return the authenticated user's profile.
const me = async (req, res) => {
  return res.status(200).json({
    success: true,
    data: {
      user: {
        id: req.user._id,
        name: req.user.name,
        email: req.user.email,
        role: req.user.role,
      },
    },
  });
};

module.exports = {
  register,
  verifyOtp,
  resendOtp,
  login,
  refresh,
  logout,
  me,
};