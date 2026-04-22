import axios from "axios";

const api = axios.create({
  baseURL: import.meta.env.VITE_API_URL || "http://localhost:8000/api"
});

// Public paths that must NOT send an Authorization header
const PUBLIC_PATHS = [
  "/auth/login/",
  "/auth/register/",
  "/auth/password-reset/",
  "/auth/social/",
  "/auth/token/refresh/",
];

api.interceptors.request.use((config) => {
  const isPublic = PUBLIC_PATHS.some(p => config.url?.includes(p));
  if (!isPublic) {
    const token = sessionStorage.getItem("access_token");
    if (token) {
      config.headers.Authorization = `Bearer ${token}`;
    }
  }
  return config;
});

// ── JWT token refresh on 401 ──────────────────────────────────────────
let isRefreshing = false;
let failedQueue = [];

const processQueue = (error, token = null) => {
  failedQueue.forEach(({ resolve, reject }) =>
    error ? reject(error) : resolve(token)
  );
  failedQueue = [];
};

api.interceptors.response.use(
  (response) => response,
  async (error) => {
    const originalRequest = error.config;

    // Only attempt refresh for 401s that haven't been retried yet
    if (error?.response?.status === 401 && !originalRequest._retry) {
      const refreshToken = sessionStorage.getItem("refresh_token");

      // If no refresh token or the failing request IS the refresh call, bail out
      if (!refreshToken || originalRequest.url?.includes("/auth/token/refresh/")) {
        sessionStorage.removeItem("access_token");
        sessionStorage.removeItem("refresh_token");
        return Promise.reject(error);
      }

      if (isRefreshing) {
        // Queue this request until the refresh completes
        return new Promise((resolve, reject) => {
          failedQueue.push({ resolve, reject });
        }).then((token) => {
          originalRequest.headers.Authorization = `Bearer ${token}`;
          return api(originalRequest);
        });
      }

      originalRequest._retry = true;
      isRefreshing = true;

      try {
        const { data } = await axios.post(
          `${api.defaults.baseURL}/auth/token/refresh/`,
          { refresh: refreshToken }
        );
        sessionStorage.setItem("access_token", data.access);
        api.defaults.headers.common.Authorization = `Bearer ${data.access}`;
        processQueue(null, data.access);
        originalRequest.headers.Authorization = `Bearer ${data.access}`;
        return api(originalRequest);
      } catch (refreshError) {
        processQueue(refreshError, null);
        sessionStorage.removeItem("access_token");
        sessionStorage.removeItem("refresh_token");
        return Promise.reject(refreshError);
      } finally {
        isRefreshing = false;
      }
    }

    return Promise.reject(error);
  }
);

export default api;
