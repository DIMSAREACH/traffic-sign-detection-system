import axios from "axios";

import { getJwtExpiryMs } from "../utils/jwt.js";

let accessToken = null;
let refreshToken = null;

const baseURL =
  import.meta.env.VITE_API_URL ||
  (import.meta.env.DEV ? "http://127.0.0.1:8000/api/" : "/api/");
const normalizedBaseURL = baseURL.endsWith("/") ? baseURL : `${baseURL}/`;

const api = axios.create({
  baseURL: normalizedBaseURL,
  withCredentials: true,
});

/** Called when refresh proves the session is dead (401/403). Set from AuthProvider. */
let sessionInvalidatedHandler = null;

export function setSessionInvalidatedHandler(fn) {
  sessionInvalidatedHandler = typeof fn === "function" ? fn : null;
}

function readRefreshFromStorage() {
  try {
    return sessionStorage.getItem("auth.refresh") || localStorage.getItem("auth.refresh");
  } catch {
    return null;
  }
}

/** True when there is any chance of an existing session (skip slow bootstrap otherwise). */
export function hasStoredAuthCredentials() {
  try {
    return Boolean(
      readRefreshFromStorage() ||
        sessionStorage.getItem("auth.access") ||
        localStorage.getItem("auth.access")
    );
  } catch {
    return false;
  }
}

/**
 * If access is missing/expired soon but a refresh token exists, refresh once before /profile/.
 * Avoids an extra 401 round-trip on cold load (new tab, new port with copied storage is still separate origin).
 */
export async function primeAccessTokenIfStale() {
  const r = refreshToken || readRefreshFromStorage();
  if (!r) return;
  const skewMs = 15_000;
  if (accessToken) {
    const expMs = getJwtExpiryMs(accessToken);
    if (expMs && expMs > Date.now() + skewMs) return;
  }
  try {
    const data = await refreshAccessTokenCoordinated();
    applyRefreshedSession(data);
  } catch {
    // Invalid/expired refresh or network — leave tokens; fetchProfile + interceptor decide.
  }
}

// ── Rehydrate (before any requests) ─────────────────────────────────────
try {
  const storedAccess = sessionStorage.getItem("auth.access") || localStorage.getItem("auth.access");
  const storedRefresh = readRefreshFromStorage();
  if (storedAccess) {
    accessToken = storedAccess;
    api.defaults.headers.common.Authorization = `Bearer ${accessToken}`;
  }
  if (storedRefresh) {
    refreshToken = storedRefresh;
  }
} catch {
  // ignore storage errors
}

// Public paths that must NOT send an Authorization header
function isPublicAuthPath(url = "") {
  const normalizedUrl = String(url).replace(/^\/+/, "");
  return [
    "auth/login",
    "auth/register",
    "auth/password-reset",
    "auth/social",
    "auth/token/refresh",
    "auth/email-verification",
  ].some((path) => normalizedUrl.includes(path));
}

export function setAccessToken(token) {
  accessToken = token || null;
  if (accessToken) {
    api.defaults.headers.common.Authorization = `Bearer ${accessToken}`;
  } else {
    delete api.defaults.headers.common.Authorization;
  }
}

export function setRefreshToken(token) {
  refreshToken = token || null;
}

/** Proactive refresh ~90s before access expiry (production SPA pattern). */
let silentRefreshTimer = null;

function cancelSilentAccessRefresh() {
  if (silentRefreshTimer !== null) {
    clearTimeout(silentRefreshTimer);
    silentRefreshTimer = null;
  }
}

const ACCESS_REFRESH_LEAD_MS = 90_000;
/** Do not force a 5s wait when the access token is already expired (avoids sluggish cold start). */
const SILENT_MIN_DELAY_MS = 5_000;
const SILENT_RETRY_DELAY_MS = 30_000;

function scheduleSilentAccessRefresh() {
  cancelSilentAccessRefresh();
  if (!accessToken) return;
  const expMs = getJwtExpiryMs(accessToken);
  if (!expMs) return;
  const target = expMs - ACCESS_REFRESH_LEAD_MS;
  let delay = Math.max(0, target - Date.now());
  if (delay > 0 && delay < SILENT_MIN_DELAY_MS) {
    delay = SILENT_MIN_DELAY_MS;
  }
  const capped = Math.min(delay, 24 * 60 * 60 * 1000);
  silentRefreshTimer = setTimeout(() => {
    silentRefreshTimer = null;
    void runScheduledSilentRefresh();
  }, capped);
}

/**
 * Where the current refresh token is stored (login "Remember me" = local).
 * @returns {"local"|"session"}
 */
function getRefreshTokenStorageKind() {
  try {
    if (localStorage.getItem("auth.refresh")) return "local";
    if (sessionStorage.getItem("auth.refresh")) return "session";
  } catch {
    // ignore
  }
  return "session";
}

/**
 * After login / OAuth — persist and arm the refresh timer.
 * @param {string} access
 * @param {string} refreshTok
 * @param {{ remember?: boolean }} [options] — remember=true → survive browser restart (localStorage)
 */
export function persistAuthTokens(access, refreshTok, options = {}) {
  const remember = Boolean(options?.remember);
  if (access) setAccessToken(access);
  if (refreshTok) setRefreshToken(refreshTok);
  try {
    if (remember) {
      if (access) localStorage.setItem("auth.access", access);
      if (refreshTok) localStorage.setItem("auth.refresh", refreshTok);
      sessionStorage.removeItem("auth.access");
      sessionStorage.removeItem("auth.refresh");
    } else {
      if (access) sessionStorage.setItem("auth.access", access);
      if (refreshTok) sessionStorage.setItem("auth.refresh", refreshTok);
      localStorage.removeItem("auth.access");
      localStorage.removeItem("auth.refresh");
    }
  } catch {
    // ignore storage errors
  }
  scheduleSilentAccessRefresh();
}

export function clearAccessToken() {
  cancelSilentAccessRefresh();
  setAccessToken(null);
}

export function clearRefreshToken() {
  setRefreshToken(null);
}

// ── Single-flight refresh (interceptor + proactive + tab focus) ─────────
let inFlightRefresh = null;

async function postRefreshWithRetry(refreshValue) {
  let data;
  for (let rAttempt = 0; rAttempt < 4; rAttempt++) {
    if (rAttempt > 0) {
      await new Promise((res) => setTimeout(res, 450 * rAttempt));
    }
    try {
      const resp = await axios.post(
        `${normalizedBaseURL}auth/token/refresh/`,
        { refresh: refreshValue },
        { withCredentials: true }
      );
      data = resp.data;
      break;
    } catch (re) {
      if (re?.response?.status === 429 && rAttempt < 3) continue;
      throw re;
    }
  }
  return data;
}

async function refreshAccessTokenCoordinated() {
  if (inFlightRefresh) return inFlightRefresh;

  const stored = refreshToken || readRefreshFromStorage();
  if (!stored) {
    throw new Error("No refresh token");
  }

  inFlightRefresh = (async () => {
    try {
      const data = await postRefreshWithRetry(stored);
      if (!data?.access) throw new Error("Invalid refresh response");
      return data;
    } finally {
      inFlightRefresh = null;
    }
  })();

  return inFlightRefresh;
}

function applyRefreshedSession(data) {
  setAccessToken(data.access);
  if (data.refresh) setRefreshToken(data.refresh);
  try {
    const kind = getRefreshTokenStorageKind();
    if (kind === "local") {
      localStorage.setItem("auth.access", data.access);
      if (data.refresh) localStorage.setItem("auth.refresh", data.refresh);
    } else {
      sessionStorage.setItem("auth.access", data.access);
      if (data.refresh) {
        sessionStorage.setItem("auth.refresh", data.refresh);
      }
    }
  } catch {
    // ignore storage errors
  }
  scheduleSilentAccessRefresh();
}

async function runScheduledSilentRefresh() {
  const stored = refreshToken || readRefreshFromStorage();
  if (!stored) return;
  try {
    const data = await refreshAccessTokenCoordinated();
    applyRefreshedSession(data);
  } catch (e) {
    const s = e?.response?.status;
    if (s === 401 || s === 403) {
      sessionInvalidatedHandler?.();
      return;
    }
    cancelSilentAccessRefresh();
    silentRefreshTimer = setTimeout(() => {
      silentRefreshTimer = null;
      void runScheduledSilentRefresh();
    }, SILENT_RETRY_DELAY_MS);
  }
}

function maybeRefreshOnTabVisible() {
  if (!accessToken) return;
  const expMs = getJwtExpiryMs(accessToken);
  if (!expMs) return;
  if (expMs - Date.now() > 120_000) return;
  void (async () => {
    const stored = refreshToken || readRefreshFromStorage();
    if (!stored) return;
    try {
      const data = await refreshAccessTokenCoordinated();
      applyRefreshedSession(data);
    } catch (e) {
      const s = e?.response?.status;
      if (s === 401 || s === 403) sessionInvalidatedHandler?.();
    }
  })();
}

if (typeof document !== "undefined") {
  document.addEventListener("visibilitychange", () => {
    if (document.visibilityState === "visible") maybeRefreshOnTabVisible();
  });
}

if (accessToken) {
  scheduleSilentAccessRefresh();
}

api.interceptors.request.use((config) => {
  if (!isPublicAuthPath(config.url)) {
    if (accessToken) {
      config.headers = config.headers || {};
      config.headers.Authorization = `Bearer ${accessToken}`;
    }
  }
  return config;
});

// ── JWT: refresh on 401 ─────────────────────────────────────────────────
let isRefreshing = false;
let failedQueue = [];

const processQueue = (error, token = null) => {
  failedQueue.forEach(({ resolve, reject }) => (error ? reject(error) : resolve(token)));
  failedQueue = [];
};

api.interceptors.response.use(
  (response) => response,
  async (error) => {
    const originalRequest = error.config;
    if (!originalRequest) return Promise.reject(error);

    if (error?.response?.status === 401 && !originalRequest._retry) {
      if (originalRequest.url?.includes("/auth/token/refresh/")) {
        clearAccessToken();
        return Promise.reject(error);
      }

      if (isRefreshing) {
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
        const data = await refreshAccessTokenCoordinated();
        applyRefreshedSession(data);
        processQueue(null, data.access);
        originalRequest.headers = originalRequest.headers || {};
        originalRequest.headers.Authorization = `Bearer ${data.access}`;
        return api(originalRequest);
      } catch (refreshError) {
        processQueue(refreshError, null);
        clearAccessToken();
        return Promise.reject(refreshError);
      } finally {
        isRefreshing = false;
      }
    }

    return Promise.reject(error);
  }
);

export default api;
