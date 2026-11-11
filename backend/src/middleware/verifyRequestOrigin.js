const { isAllowedOrigin } = require("../config/allowedOrigins");

// HttpOnly cookies are sent automatically by browsers. Check the browser
// Origin on state-changing requests so another website cannot submit actions
// using a logged-in user's cookies. Requests without Origin (for example,
// Postman or server-to-server calls) remain usable.
const verifyRequestOrigin = (req, res, next) => {
  const origin = req.get("origin");
  const isStateChanging = ["POST", "PUT", "PATCH", "DELETE"].includes(
    req.method
  );

  if (!isStateChanging || !origin) return next();

  if (!isAllowedOrigin(origin)) {
    return res.status(403).json({
      success: false,
      message: "Request origin is not allowed.",
    });
  }

  return next();
};

module.exports = verifyRequestOrigin;
