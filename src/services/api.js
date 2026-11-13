import axios from "axios";

const ROOT = (
  import.meta.env.VITE_BACKEND_URL || "https://class-sphere-u1n7.onrender.com"
).replace(/\/+$/, "");
export const API_URL = `${ROOT}/api`;

const api = axios.create({
  baseURL: API_URL,
  timeout: 60000,
  withCredentials: true,
});

let refreshPromise = null;

function refreshSession() {
  if (!refreshPromise) {
    refreshPromise = api
      .post("/auth/refresh")
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
      await refreshSession();
      return api(original);
    } catch (refreshError) {
      if (!url.endsWith("/auth/me") && typeof window !== "undefined") {
        window.dispatchEvent(new Event("classesphere:session-expired"));
      }
      return Promise.reject(refreshError);
    }
  }
);

export default api;
