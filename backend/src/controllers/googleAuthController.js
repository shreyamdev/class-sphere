const { OAuth2Client } = require("google-auth-library");
const crypto = require("crypto");
const jwt = require("jsonwebtoken");
const User = require("../models/User");
const { hashValue } = require("../utils/otp");
const { setAuthCookies } = require("../utils/authCookies");

const googleClient = new OAuth2Client(process.env.GOOGLE_CLIENT_ID);

const ALLOWED_ROLES = ["student", "teacher"];

const createAccessToken = (user) =>
  jwt.sign(
    {
      sub: user._id.toString(),
      role: user.role,
      type: "access",
    },
    process.env.JWT_SECRET,
    {
      expiresIn: process.env.ACCESS_TOKEN_EXPIRES_IN || "15m",
    }
  );

const createRefreshToken = (user) =>
  jwt.sign(
    {
      sub: user._id.toString(),
      jti: crypto.randomUUID(),
      type: "refresh",
    },
    process.env.JWT_REFRESH_SECRET,
    {
      expiresIn: process.env.REFRESH_TOKEN_EXPIRES_IN || "7d",
    }
  );

const googleAuth = async (req, res) => {
  try {
    const { idToken, role } = req.body;

    if (!idToken) {
      return res.status(400).json({
        success: false,
        message: "Google ID token is required.",
      });
    }

    if (!ALLOWED_ROLES.includes(role)) {
      return res.status(400).json({
        success: false,
        message: "Please select a valid role: student or teacher.",
        code: "LOGIN_FIELDS_INVALID",
      });
    }

    if (!process.env.GOOGLE_CLIENT_ID) {
      return res.status(500).json({
        success: false,
        message: "Google authentication is not configured.",
      });
    }

    // Verify the Google ID token
    let payload;

    try {
      const ticket = await googleClient.verifyIdToken({
        idToken,
        audience: process.env.GOOGLE_CLIENT_ID,
      });

      payload = ticket.getPayload();
    } catch {
      return res.status(401).json({
        success: false,
        message: "Invalid or expired Google ID token.",
      });
    }

    if (
      !payload?.sub ||
      !payload.email ||
      payload.email_verified !== true
    ) {
      return res.status(401).json({
        success: false,
        message: "Google account could not be verified.",
      });
    }

    const email = payload.email.toLowerCase().trim();

    // Find an existing account by Google ID or email
    let user = await User.findOne({
      $or: [{ googleId: payload.sub }, { email }],
    }).select("+googleId");

    if (user) {
      // Existing accounts must enter through their registered portal.
      // A login request must never silently change an existing user's role.
      if (user.role !== role) {
        return res.status(403).json({
          success: false,
          message: `This account is registered as ${user.role}. Please use the ${user.role} login.`,
          code: "ROLE_MISMATCH",
          registeredRole: user.role,
        });
      }

      if (user.email.toLowerCase() !== email) {
        return res.status(409).json({
          success: false,
          message: "This Google account is linked to a different email.",
        });
      }

      if (user.googleId && user.googleId !== payload.sub) {
        return res.status(409).json({
          success: false,
          message: "This email is linked to another Google account.",
        });
      }

      if (!user.googleId) {
        user.googleId = payload.sub;
      }

      user.isEmailVerified = true;
      await user.save();
    } else {
      user = await User.create({
        name: payload.name || email.split("@")[0],
        email,
        googleId: payload.sub,
        role,
        isEmailVerified: true,
      });
    }

    // Issue ClassSphere access and refresh tokens
    const accessToken = createAccessToken(user);
    const refreshToken = createRefreshToken(user);

    user.refreshTokenHash = hashValue(refreshToken);
    await user.save();

    // Set the same HttpOnly session cookies used by password login.
    setAuthCookies(res, accessToken, refreshToken);

    return res.status(200).json({
      success: true,
      message: "Google authentication successful.",
      data: {
        user: {
          id: user._id,
          name: user.name,
          email: user.email,
          role: user.role,
          isEmailVerified: user.isEmailVerified,
        },
        expiresIn: process.env.ACCESS_TOKEN_EXPIRES_IN || "15m",
      },
    });
  } catch (error) {
    console.error("Google authentication error:", error.message);

    return res.status(500).json({
      success: false,
      message: "Internal server error.",
    });
  }
};

module.exports = { googleAuth };
