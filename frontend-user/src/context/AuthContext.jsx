import React, { createContext, useContext, useEffect, useMemo, useState } from "react";
import { flushSync } from "react-dom";

import { fetchProfile, login as loginRequest, logout as logoutRequest } from "../services/authService.js";
import {
  clearAccessToken,
  clearRefreshToken,
  hasStoredAuthCredentials,
  persistAuthTokens,
  primeAccessTokenIfStale,
  setAccessToken,
  setRefreshToken,
  setSessionInvalidatedHandler,
} from "../services/api.js";
import { isAdminPortal } from "../utils/portal.js";

const AuthContext = createContext(null);

function normalizeRole(role) {
  return (role || "").toString().trim().toLowerCase();
}

export const isAdmin = (user) => normalizeRole(user?.role) === "admin";
export const isOfficer = (user) => {
  const role = normalizeRole(user?.role);
  return role === "officer" || role === "admin";
};
export const isDriver = (user) => normalizeRole(user?.role) === "driver";

export const getRoleHomePath = (role) => {
  const r = normalizeRole(role);
  if (r === "admin") return "/admin/dashboard";
  if (r === "officer") return "/dashboard/officer";
  return "/dashboard";
};

const AUTH_LAST_HOME_USER = "auth.last_home.user";
const AUTH_LAST_HOME_ADMIN = "auth.last_home.admin";
const AUTH_LAST_HOME_LEGACY = "auth.last_home";
const AUTH_LAST_PATH = "auth.last_path";
const AUTH_LAST_PATH_ADMIN = "auth.last_path.admin";
const AUTH_LAST_PATH_USER = "auth.last_path.user";
const AUTH_LAST_SURFACE = "auth.last_surface";
const AUTH_SIDEBAR_SNAPSHOT = "auth.sidebar.snapshot.v1";

function persistSidebarSnapshot(user) {
  if (!user || typeof user !== "object") return;
  try {
    const display = user.first_name
      ? `${user.first_name} ${user.last_name || ""}`.trim()
      : (user.username || (user.email && String(user.email).split("@")[0]) || "");
    const initials = (
      (user.first_name?.[0] || "") +
        (user.last_name?.[0] || "") ||
      user.username?.[0] ||
      (user.email && user.email[0]) ||
      "U"
    ).toUpperCase();
    const avatarUrl =
      user.avatar_url != null && String(user.avatar_url).trim() !== ""
        ? String(user.avatar_url).trim()
        : "";
    sessionStorage.setItem(
      AUTH_SIDEBAR_SNAPSHOT,
      JSON.stringify({
        displayName: display,
        roleKey: user.role != null ? String(user.role) : "",
        initials,
        avatarUrl,
      })
    );
  } catch {
    // ignore
  }
}

/** Last known sidebar label from a successful /profile (survives F5 while JWT bootstrap runs). */
export function readCachedSidebarSnapshot() {
  try {
    const raw = sessionStorage.getItem(AUTH_SIDEBAR_SNAPSHOT);
    if (!raw) return null;
    const o = JSON.parse(raw);
    if (!o || typeof o !== "object") return null;
    return {
      displayName: typeof o.displayName === "string" ? o.displayName : "",
      roleKey: typeof o.roleKey === "string" ? o.roleKey : "",
      initials: typeof o.initials === "string" ? o.initials : "U",
      avatarUrl: typeof o.avatarUrl === "string" ? o.avatarUrl : "",
    };
  } catch {
    return null;
  }
}

function readCachedUserHome() {
  try {
    const p = sessionStorage.getItem(AUTH_LAST_HOME_USER);
    if (p && p.startsWith("/dashboard")) return p;
  } catch {
    // ignore
  }
  return null;
}

function readCachedAdminHome() {
  try {
    const p = sessionStorage.getItem(AUTH_LAST_HOME_ADMIN);
    if (p && p.startsWith("/admin")) return p;
  } catch {
    // ignore
  }
  return null;
}

/** Last /dashboard/* home (officer/driver surface). */
export function getCachedUserHomePath() {
  return readCachedUserHome();
}

/** Last /admin/* home. */
export function getCachedAdminHomePath() {
  return readCachedAdminHome();
}

/**
 * When session storage says the last admin home was set, map a user-portal path
 * to the same screen on /admin/* so refreshes don't leave admins on /dashboard/*.
 */
export function mapUserPortalPathToAdminPath(pathname) {
  if (!pathname || typeof pathname !== "string") return "/admin/dashboard";
  if (pathname.startsWith("/admin")) return pathname;
  const adminDefault = readCachedAdminHome() || "/admin/dashboard";
  if (!pathname.startsWith("/dashboard")) return adminDefault;
  if (pathname === "/dashboard" || pathname.startsWith("/dashboard/officer")) {
    return adminDefault;
  }
  const rest = pathname.slice("/dashboard".length);
  return `/admin${rest}`;
}

/** @deprecated Prefer getCachedUserHomePath — name kept for older imports. */
export function getCachedRoleHomePath() {
  return readCachedUserHome();
}

function isStorablePath(pathname) {
  if (!pathname || !pathname.startsWith("/")) return false;
  return !(
    pathname.startsWith("/login") ||
    pathname.startsWith("/auth/") ||
    pathname.startsWith("/register") ||
    pathname.startsWith("/forgot-password") ||
    pathname.startsWith("/reset-password")
  );
}

function migrateLegacyLastPath() {
  try {
    const legacy = sessionStorage.getItem(AUTH_LAST_PATH);
    if (!legacy || !isStorablePath(legacy)) return;
    const hasSplit =
      sessionStorage.getItem(AUTH_LAST_PATH_ADMIN) || sessionStorage.getItem(AUTH_LAST_PATH_USER);
    if (hasSplit) {
      sessionStorage.removeItem(AUTH_LAST_PATH);
      return;
    }
    if (legacy.startsWith("/admin")) sessionStorage.setItem(AUTH_LAST_PATH_ADMIN, legacy);
    else if (legacy.startsWith("/dashboard")) sessionStorage.setItem(AUTH_LAST_PATH_USER, legacy);
    sessionStorage.removeItem(AUTH_LAST_PATH);
  } catch {
    // ignore
  }
}

function readAdminLastPath() {
  try {
    const p = sessionStorage.getItem(AUTH_LAST_PATH_ADMIN);
    if (p && isStorablePath(p) && p.startsWith("/admin")) return p;
  } catch {
    // ignore
  }
  return null;
}

function readUserLastPath() {
  try {
    const p = sessionStorage.getItem(AUTH_LAST_PATH_USER);
    if (p && isStorablePath(p) && p.startsWith("/dashboard")) return p;
  } catch {
    // ignore
  }
  return null;
}

function readSurface() {
  try {
    const s = sessionStorage.getItem(AUTH_LAST_SURFACE);
    if (s === "admin" || s === "user") return s;
  } catch {
    // ignore
  }
  return null;
}

/** Which portal the user last used on this origin (`admin` | `user` | null). */
export function getLastPortalSurface() {
  migrateLegacyLastPath();
  return readSurface();
}

/** Call from layouts on route change so F5 on `/` can return to the last real screen. */
export function persistLastVisitedPath(pathname) {
  if (!pathname || pathname === "/") return;
  if (!isStorablePath(pathname)) return;
  try {
    migrateLegacyLastPath();
    if (pathname.startsWith("/admin")) {
      sessionStorage.setItem(AUTH_LAST_PATH_ADMIN, pathname);
      sessionStorage.setItem(AUTH_LAST_SURFACE, "admin");
    } else if (pathname.startsWith("/dashboard")) {
      sessionStorage.setItem(AUTH_LAST_PATH_USER, pathname);
      sessionStorage.setItem(AUTH_LAST_SURFACE, "user");
    }
  } catch {
    // ignore
  }
}

/**
 * Where to send `/` while /profile/ is still loading.
 * Admin and user portals use separate stored paths so one origin (e.g. localhost:5173) does not mix them.
 */
export function getBootstrapRedirectPath() {
  migrateLegacyLastPath();

  if (isAdminPortal()) {
    const lastA = readAdminLastPath();
    if (lastA) return lastA;
    return readCachedAdminHome() || "/admin/dashboard";
  }

  const u = readCachedUserHome();
  const a = readCachedAdminHome();
  const lastU = readUserLastPath();
  const lastA = readAdminLastPath();
  const surface = readSurface();

  // Home caches come from the last successful /profile — trust them over a stale auth.last_surface.
  if (a && !u) {
    if (lastA) return lastA;
    return a;
  }
  if (u && !a) {
    if (surface === "user") {
      if (lastU) return lastU;
      return u;
    }
    if (lastU) return lastU;
    return u;
  }

  if (surface === "admin" && a) {
    if (lastA) return lastA;
    return a;
  }

  if (surface === "user") {
    if (lastU) return lastU;
    if (u) return u;
    return "/dashboard";
  }

  if (lastU) return lastU;
  if (u) return u;
  if (a) return a;
  return "/dashboard";
}

function cacheRoleHome(role) {
  const p = getRoleHomePath(role);
  try {
    if (p.startsWith("/admin")) {
      sessionStorage.setItem(AUTH_LAST_HOME_ADMIN, p);
      sessionStorage.removeItem(AUTH_LAST_HOME_USER);
      sessionStorage.setItem(AUTH_LAST_SURFACE, "admin");
    } else {
      sessionStorage.setItem(AUTH_LAST_HOME_USER, p);
      sessionStorage.removeItem(AUTH_LAST_HOME_ADMIN);
      sessionStorage.setItem(AUTH_LAST_SURFACE, "user");
    }
    sessionStorage.removeItem(AUTH_LAST_HOME_LEGACY);
  } catch {
    // ignore
  }
}

function clearAuth() {
  clearAccessToken();
  clearRefreshToken();
  try {
    sessionStorage.removeItem("auth.access");
    sessionStorage.removeItem("auth.refresh");
    sessionStorage.removeItem(AUTH_LAST_HOME_USER);
    sessionStorage.removeItem(AUTH_LAST_HOME_ADMIN);
    sessionStorage.removeItem(AUTH_LAST_HOME_LEGACY);
    sessionStorage.removeItem(AUTH_LAST_PATH);
    sessionStorage.removeItem(AUTH_LAST_PATH_ADMIN);
    sessionStorage.removeItem(AUTH_LAST_PATH_USER);
    sessionStorage.removeItem(AUTH_LAST_SURFACE);
    sessionStorage.removeItem(AUTH_SIDEBAR_SNAPSHOT);
    localStorage.removeItem("auth.access");
    localStorage.removeItem("auth.refresh");
  } catch {
    // ignore storage errors
  }
}

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(() => hasStoredAuthCredentials());

  useEffect(() => {
    setSessionInvalidatedHandler(() => {
      clearAuth();
      setUser(null);
    });
    return () => setSessionInvalidatedHandler(null);
  }, []);

  useEffect(() => {
    if (user) persistSidebarSnapshot(user);
  }, [user]);

  useEffect(() => {
    let active = true;

    try {
      const legacy = sessionStorage.getItem(AUTH_LAST_HOME_LEGACY);
      const hasNew =
        sessionStorage.getItem(AUTH_LAST_HOME_USER) || sessionStorage.getItem(AUTH_LAST_HOME_ADMIN);
      if (legacy && !hasNew) {
        if (legacy.startsWith("/admin")) sessionStorage.setItem(AUTH_LAST_HOME_ADMIN, legacy);
        else if (legacy.startsWith("/dashboard")) sessionStorage.setItem(AUTH_LAST_HOME_USER, legacy);
        sessionStorage.removeItem(AUTH_LAST_HOME_LEGACY);
      }
    } catch {
      // ignore
    }

    migrateLegacyLastPath();

    // Rehydrate tokens for page reloads (dev UX + stable dashboards)
    try {
      const a = sessionStorage.getItem("auth.access") || localStorage.getItem("auth.access");
      const r = sessionStorage.getItem("auth.refresh") || localStorage.getItem("auth.refresh");
      if (a) setAccessToken(a);
      if (r) setRefreshToken(r);
    } catch {
      // ignore storage errors
    }

    // No tokens (e.g. first open on this origin / other port) — skip /profile/ and retries.
    if (!hasStoredAuthCredentials()) {
      if (active) setLoading(false);
      return () => {
        active = false;
      };
    }

    // Bootstrap session. Prime refresh when access is stale to avoid an extra 401 hop.
    const runBootstrap = async () => {
      await primeAccessTokenIfStale();
      if (!active) return;

      const maxAttempts = 4;
      for (let attempt = 0; attempt < maxAttempts; attempt++) {
        if (!active) return;
        try {
          const profile = await fetchProfile();
          if (!active) return;
          if (isAdminPortal() && normalizeRole(profile?.role) !== "admin") {
            clearAuth();
            setUser(null);
            return;
          }
          if (profile?.role) cacheRoleHome(profile.role);
          setUser(profile);
          return;
        } catch (err) {
          if (!active) return;
          const status = err?.response?.status;
          if (status === 401 || status === 403) {
            clearAuth();
            setUser(null);
            return;
          }
          const isNetworkish = Boolean(err?.request) && !err?.response;
          const transient =
            status === 429 ||
            (Number(status) >= 500 && Number(status) < 600) ||
            err?.code === "ECONNABORTED" ||
            err?.code === "ERR_NETWORK" ||
            isNetworkish;
          if (!transient) {
            setUser(null);
            return;
          }
          if (attempt === maxAttempts - 1) {
            return;
          }
          await new Promise((r) => setTimeout(r, 250 * (attempt + 1)));
        }
      }
    };

    runBootstrap().finally(() => {
      if (active) setLoading(false);
    });

    return () => {
      active = false;
    };
  }, []);

  useEffect(() => {
    if (loading || user || !hasStoredAuthCredentials()) return undefined;

    let cancelled = false;
    const recover = async () => {
      try {
        await primeAccessTokenIfStale();
        const profile = await fetchProfile();
        if (cancelled) return;
        if (isAdminPortal() && normalizeRole(profile?.role) !== "admin") {
          clearAuth();
          setUser(null);
          return;
        }
        if (profile?.role) cacheRoleHome(profile.role);
        setUser(profile);
      } catch (err) {
        if (cancelled) return;
        const status = err?.response?.status;
        if (status === 401 || status === 403) {
          clearAuth();
          setUser(null);
        }
      }
    };

    const t0 = window.setTimeout(recover, 400);
    const t1 = window.setTimeout(recover, 2500);
    const t2 = window.setTimeout(recover, 8000);

    return () => {
      cancelled = true;
      clearTimeout(t0);
      clearTimeout(t1);
      clearTimeout(t2);
    };
  }, [loading, user]);

  const login = async (credentials) => {
    const remember = Boolean(credentials?.remember);
    const data = await loginRequest(credentials);
    persistAuthTokens(data.access, data?.refresh, { remember });
    const nextUser = data.user;
    if (isAdminPortal() && normalizeRole(nextUser?.role) !== "admin") {
      clearAuth();
      flushSync(() => setUser(null));
      throw new Error("This portal is restricted to administrator accounts.");
    }
    flushSync(() => {
      if (nextUser?.role) cacheRoleHome(nextUser.role);
      try {
        sessionStorage.removeItem(AUTH_LAST_PATH);
        sessionStorage.removeItem(AUTH_LAST_PATH_ADMIN);
        sessionStorage.removeItem(AUTH_LAST_PATH_USER);
        sessionStorage.removeItem(AUTH_LAST_SURFACE);
      } catch {
        // ignore
      }
      setUser(nextUser);
    });
    return data.user;
  };

  const loginFromData = (data) => {
    if (data?.access) persistAuthTokens(data.access, data?.refresh);
    const nextUser = data?.user;
    if (isAdminPortal() && normalizeRole(nextUser?.role) !== "admin") {
      clearAuth();
      flushSync(() => setUser(null));
      throw new Error("This portal is restricted to administrator accounts.");
    }
    flushSync(() => {
      if (nextUser?.role) cacheRoleHome(nextUser.role);
      try {
        sessionStorage.removeItem(AUTH_LAST_PATH);
        sessionStorage.removeItem(AUTH_LAST_PATH_ADMIN);
        sessionStorage.removeItem(AUTH_LAST_PATH_USER);
        sessionStorage.removeItem(AUTH_LAST_SURFACE);
      } catch {
        // ignore
      }
      setUser(nextUser);
    });
    return data.user;
  };

  const logout = () => {
    clearAuth();
    setUser(null);
    // best-effort server-side cookie clearing
    logoutRequest().catch(() => {});
  };

  const refreshUser = async () => {
    const profile = await fetchProfile();
    if (profile?.role) cacheRoleHome(profile.role);
    setUser(profile);
    return profile;
  };

  const updateUser = (patch) => {
    setUser((prev) => (prev ? { ...prev, ...patch } : patch));
  };

  const value = useMemo(
    () => ({
      user,
      loading,
      isLoading: loading,
      login,
      loginFromData,
      logout,
      refreshUser,
      updateUser,
      isAdmin,
      isOfficer,
      isDriver,
      isAuthenticated: Boolean(user),
      getRoleHomePath,
    }),
    [user, loading]
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (context === null) {
    throw new Error("useAuth must be used within an AuthProvider");
  }
  return context;
}
