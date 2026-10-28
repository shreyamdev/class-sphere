import axios from "axios";
import { tokenStorage, AUTH_EXPIRED_EVENT } from "./tokenStorage";

const ROOT = (
  import.meta.env.VITE_API_URL || "https://class-sphere-u1n7.onrender.com"
).replace(/\/+$/, "");
export const API_URL = `${ROOT}/api`;

const api = axios.create({
  baseURL: API_URL,
  timeout: 60000,
});

api.interceptors.request.use((config) => {
  const tokens = tokenStorage.get();
  if (tokens?.accessToken) {
    config.headers.Authorization = "Bearer " + tokens.accessToken;
  }
  return config;
});

let refreshPromise = null;

function refreshTokens() {
  if (!refreshPromise) {
    const current = tokenStorage.get();

    refreshPromise = axios
      .post(`${API_URL}/auth/refresh`, { refreshToken: current?.refreshToken })
      .then((response) => {
        const payload = response.data?.data ?? response.data;
        const next = {
          accessToken: payload.accessToken,
          refreshToken: payload.refreshToken,
        };
        tokenStorage.set(next);
        return next;
      })
      .finally(() => {
        refreshPromise = null;
      });
  }
  return refreshPromise;
}

const isAuthCall = (url = "") =>
  /\/auth\/(login|register|verify-otp|resend-otp|google|refresh)/.test(url);

api.interceptors.response.use(
  (response) => response,
  async (error) => {
    const original = error.config;
    const hasRefreshToken = Boolean(tokenStorage.get()?.refreshToken);

    const shouldRefresh =
      error.response?.status === 401 &&
      original &&
      !original._retry &&
      !isAuthCall(original.url) &&
      hasRefreshToken;

    if (!shouldRefresh) return Promise.reject(error);

    original._retry = true;
    try {
      const tokens = await refreshTokens();
      original.headers.Authorization = "Bearer " + tokens.accessToken;
      return api(original);
    } catch (refreshError) {
      tokenStorage.clear();
      window.dispatchEvent(new Event(AUTH_EXPIRED_EVENT));
      return Promise.reject(refreshError);
    }
  }
);

export default api;
