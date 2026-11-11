const jwt = require("jsonwebtoken");
const User = require("../models/User");
const { ACCESS_COOKIE_NAME, readCookie } = require("../utils/authCookies");

const protect = async (req, res, next) => {
  try {
    // Access JWTs are read only from the HttpOnly cookie, not from a
    // JavaScript-readable JSON response or localStorage Authorization header.
    const token = readCookie(req, ACCESS_COOKIE_NAME);

    if (!token) {
      return res.status(401).json({
        success: false,
        message: "Authentication session required. Please log in.",
      });
    }

    let decoded;

    try {
      decoded = jwt.verify(token, process.env.JWT_SECRET);
    } catch {
      return res.status(401).json({
        success: false,
        message: "Session expired or invalid. Please refresh your session.",
      });
    }

    if (decoded.type !== "access" || !decoded.sub) {
      return res.status(401).json({
        success: false,
        message: "Invalid access session.",
      });
    }

    const user = await User.findById(decoded.sub);

    if (!user || !user.isEmailVerified) {
      return res.status(401).json({
        success: false,
        message: "User not found or email is not verified.",
      });
    }

    req.user = user;
    return next();
  } catch (error) {
    console.error("Authentication error:", error.message);

    return res.status(500).json({
      success: false,
      message: "Internal server error.",
    });
  }
};

// Restrict routes by role stored in MongoDB, not by client-supplied role data.
const authorizeRoles = (...allowedRoles) => {
  return (req, res, next) => {
    if (!req.user || !allowedRoles.includes(req.user.role)) {
      return res.status(403).json({
        success: false,
        message: "You do not have permission to access this resource.",
      });
    }

    return next();
  };
};

module.exports = {
  protect,
  authorizeRoles,
};
