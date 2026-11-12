import axios from "axios";
import { tokenStorage } from "./tokenStorage";

const ROOT = (
  import.meta.env.VITE_BACKEND_URL || "https://class-sphere-u1n7.onrender.com"
).replace(/\/+$/, "");
export const API_URL = `${ROOT}/api`;

const api = axios.create({
  baseURL: API_URL,
  timeout: 60000,
  withCredentials: true,
});

api.interceptors.request.use((config) => {
  const accessToken = tokenStorage.get()?.accessToken;
  if (accessToken) {
    config.headers.Authorization = `Bearer ${accessToken}`;
  }
  return config;
});

let refreshPromise = null;

function refreshTokens() {
  if (!refreshPromise) {
    const refreshToken = tokenStorage.get()?.refreshToken;
    const request = refreshToken
      ? api.post("/auth/refresh", { refreshToken })
      : api.post("/auth/refresh");

    refreshPromise = request
      .then((response) => {
        const payload = response.data?.data ?? response.data;
        const tokenPayload = payload?.tokens ?? payload?.session?.tokens ?? payload;
        const accessToken =
          tokenPayload?.accessToken ??
          tokenPayload?.access_token ??
          tokenPayload?.token;
        const nextRefreshToken =
          tokenPayload?.refreshToken ?? tokenPayload?.refresh_token ?? refreshToken;

        if (accessToken) {
          tokenStorage.set({ accessToken, refreshToken: nextRefreshToken });
        } else if (refreshToken) {
          throw new Error("Session refresh succeeded without returning an access token.");
        }

        return response;
      })
      .finally(() => {
        refreshPromise = null;
      });
  }
  return refreshPromise;
}

const noRefreshFor = [
  "/auth/login",
  "/auth/google",
  "/auth/register",
  "/auth/verify-otp",
  "/auth/resend-otp",
  "/auth/refresh",
  "/auth/logout",
];

api.interceptors.response.use(
  (response) => response,
  async (error) => {
    const original = error.config;
    const url = original?.url?.split("?")[0] ?? "";
    const isAuthRequest = noRefreshFor.some((path) => url.endsWith(path));

    const shouldRefresh =
      error.response?.status === 401 &&
      original &&
      !original._retry &&
      !isAuthRequest;

    if (!shouldRefresh) return Promise.reject(error);

    original._retry = true;
    try {
      await refreshTokens();
      return api(original);
    } catch (refreshError) {
      if (!url.endsWith("/auth/me")) {
        tokenStorage.clear();
        window.dispatchEvent(new Event("classesphere:session-expired"));
      }
      return Promise.reject(refreshError);
    }
  }
);

export default api;
