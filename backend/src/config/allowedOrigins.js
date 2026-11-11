const defaultOrigins = [
  "http://localhost:5173",
  "https://class-sphere-one.vercel.app",
];

const configuredOrigins = [
  ...(process.env.FRONTEND_URL ? [process.env.FRONTEND_URL] : []),
  ...(process.env.FRONTEND_URLS
    ? process.env.FRONTEND_URLS.split(",")
    : []),
];

const normalizeOrigin = (value) => {
  if (typeof value !== "string" || !value.trim()) return null;

  try {
    return new URL(value.trim()).origin;
  } catch {
    return null;
  }
};

const allowedOrigins = new Set(
  [...defaultOrigins, ...configuredOrigins]
    .map(normalizeOrigin)
    .filter(Boolean)
);

const isAllowedOrigin = (origin) => {
  const normalized = normalizeOrigin(origin);
  return Boolean(normalized && allowedOrigins.has(normalized));
};

module.exports = { allowedOrigins, isAllowedOrigin };
