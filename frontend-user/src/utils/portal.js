export function getAdminHostname() {
  return (import.meta.env.VITE_ADMIN_HOSTNAME || "admin.localhost").toString().trim().toLowerCase();
}

export function getAdminPort() {
  const raw = (import.meta.env.VITE_ADMIN_PORT || "").toString().trim();
  const parsed = Number.parseInt(raw, 10);
  return Number.isFinite(parsed) ? parsed : null;
}

export function getPortalSurfaceOverride() {
  const raw = (import.meta.env.VITE_PORTAL_SURFACE || "").toString().trim().toLowerCase();
  if (raw === "admin" || raw === "user") return raw;
  return null;
}

export function isAdminPortal() {
  if (typeof window === "undefined") {
    return false;
  }
  const forced = getPortalSurfaceOverride();
  if (forced) return forced === "admin";
  const host = (window.location.hostname || "").toString().trim().toLowerCase();
  if (host === getAdminHostname()) {
    return true;
  }

  const adminPort = getAdminPort();
  if (adminPort && Number(window.location.port) === adminPort) {
    return true;
  }

  return false;
}

/** Same dev server can serve `/admin/*` and `/dashboard/*` — path defines admin UI. */
export function isAdminPath(pathname) {
  if (!pathname || typeof pathname !== "string") return false;
  return pathname === "/admin" || pathname.startsWith("/admin/");
}

export function isUserPortalPath(pathname) {
  if (!pathname || typeof pathname !== "string") return false;
  return pathname === "/dashboard" || pathname.startsWith("/dashboard/");
}

/**
 * Dedicated admin host/port OR browsing `/admin/*` on a shared origin (e.g. localhost:5173).
 */
export function isStrictAdminSurface(pathname) {
  if (typeof window === "undefined") return false;
  const p = pathname != null ? pathname : window.location.pathname || "/";
  return isAdminPortal() || isAdminPath(p);
}

