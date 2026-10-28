import api from "./api";
import { toApiError } from "./apiError";

const AUTH_REQUEST_TIMEOUT = 120_000;

const unwrap = (response) => response.data?.data ?? response.data;

async function call(request) {
  try {
    return await request();
  } catch (error) {
    throw toApiError(error);
  }
}

function normalizeUser(raw = {}) {
  return {
    id: raw.id ?? raw._id,
    name: raw.name ?? raw.fullName ?? "",
    email: raw.email ?? "",
    role: String(raw.role ?? "student").toLowerCase(),
  };
}

function normalizeSession(payload) {
  const tokenPayload = payload.tokens ?? payload.session?.tokens ?? payload;
  const accessToken =
    tokenPayload.accessToken ?? tokenPayload.access_token ?? tokenPayload.token;
  const refreshToken =
    tokenPayload.refreshToken ?? tokenPayload.refresh_token;

  if (!accessToken) {
    throw new Error("Login succeeded, but the server did not return an access token.");
  }

  return {
    user: normalizeUser(payload.user ?? payload.data?.user ?? payload),
    tokens: {
      accessToken,
      refreshToken,
    },
  };
}

export async function registerRequest({ name, email, password, role }) {
  const response = await call(() =>
    api.post("/auth/register", { name, email, password, role }, { timeout: AUTH_REQUEST_TIMEOUT })
  );
  return { message: response.data?.message };
}

export async function verifyOtpRequest({ email, otp }) {
  const response = await call(() =>
    api.post("/auth/verify-otp", { email, otp }, { timeout: AUTH_REQUEST_TIMEOUT })
  );
  return { message: response.data?.message };
}

export async function resendOtpRequest({ email }) {
  const response = await call(() =>
    api.post("/auth/resend-otp", { email }, { timeout: AUTH_REQUEST_TIMEOUT })
  );
  return { message: response.data?.message };
}

export async function loginRequest({ email, password, role }) {
  const response = await call(() => api.post("/auth/login", { email, password, role }));
  return normalizeSession(unwrap(response));
}

export async function googleAuthRequest(idToken, role) {
  const response = await call(() => api.post("/auth/google", { idToken, role }));
  return normalizeSession(unwrap(response));
}

export async function fetchMe() {
  const response = await call(() => api.get("/auth/me"));
  const payload = unwrap(response);
  return normalizeUser(payload.user ?? payload);
}

export async function logoutRequest(refreshToken) {
  await call(() => api.post("/auth/logout", { refreshToken }));
}
