const ACCESS_COOKIE_NAME = "classsphere_access";
const REFRESH_COOKIE_NAME = "classsphere_refresh";

const isProduction = process.env.NODE_ENV === "production";

const baseCookieOptions = {
  httpOnly: true,
  secure: isProduction,
  // The deployed frontend and backend use different domains. Cross-site
  // cookies therefore need SameSite=None in production; localhost stays Lax.
  sameSite: isProduction ? "none" : "lax",
};

const durationToMilliseconds = (value, fallbackMs) => {
  if (typeof value === "number" && Number.isFinite(value) && value > 0) {
    return value * 1000;
  }

  if (typeof value !== "string") return fallbackMs;

  const match = value.trim().match(/^(\d+)\s*(ms|s|m|h|d)$/i);
  if (!match) return fallbackMs;

  const amount = Number(match[1]);
  const unit = match[2].toLowerCase();
  const multipliers = {
    ms: 1,
    s: 1000,
    m: 60 * 1000,
    h: 60 * 60 * 1000,
    d: 24 * 60 * 60 * 1000,
  };

  return amount * multipliers[unit];
};

const setAuthCookies = (res, accessToken, refreshToken) => {
  const accessMaxAge = durationToMilliseconds(
    process.env.ACCESS_TOKEN_EXPIRES_IN || "15m",
    15 * 60 * 1000
  );
  const refreshMaxAge = durationToMilliseconds(
    process.env.REFRESH_TOKEN_EXPIRES_IN || "7d",
    7 * 24 * 60 * 60 * 1000
  );

  res.cookie(ACCESS_COOKIE_NAME, accessToken, {
    ...baseCookieOptions,
    path: "/",
    maxAge: accessMaxAge,
  });

  res.cookie(REFRESH_COOKIE_NAME, refreshToken, {
    ...baseCookieOptions,
    path: "/api/auth",
    maxAge: refreshMaxAge,
  });
};

const clearAuthCookies = (res) => {
  res.clearCookie(ACCESS_COOKIE_NAME, {
    ...baseCookieOptions,
    path: "/",
  });

  res.clearCookie(REFRESH_COOKIE_NAME, {
    ...baseCookieOptions,
    path: "/api/auth",
  });
};

const readCookie = (req, cookieName) => {
  const header = req.headers?.cookie;
  if (typeof header !== "string" || !header) return null;

  for (const part of header.split(";")) {
    const separatorIndex = part.indexOf("=");
    if (separatorIndex < 0) continue;

    const name = part.slice(0, separatorIndex).trim();
    if (name !== cookieName) continue;

    const value = part.slice(separatorIndex + 1).trim();
    try {
      return decodeURIComponent(value);
    } catch {
      return value;
    }
  }

  return null;
};

module.exports = {
  ACCESS_COOKIE_NAME,
  REFRESH_COOKIE_NAME,
  setAuthCookies,
  clearAuthCookies,
  readCookie,
};
