import React from "react";
import { Navigate, Outlet, useLocation } from "react-router-dom";
import {
  useAuth,
  getCachedAdminHomePath,
  getCachedUserHomePath,
  getLastPortalSurface,
  mapUserPortalPathToAdminPath,
} from "../context/AuthContext.jsx";
import { hasStoredAuthCredentials } from "../services/api.js";

function normalizeRole(role) {
  return (role || "").toString().trim().toLowerCase();
}

/**
 * Route guard that restricts access based on user role.
 * Accepts either `roles` or `allowedRoles` for compatibility across apps.
 */
export default function RoleRoute({ children, roles, allowedRoles = [], redirect = "/login" }) {
  const { user, loading, isLoading } = useAuth();
  const location = useLocation();

  const nextRoles = Array.isArray(roles) && roles.length > 0 ? roles : allowedRoles;
  const normalizedRoles = nextRoles.map((role) => normalizeRole(role));
  const currentRole = normalizeRole(user?.role);

  const adminHome = getCachedAdminHomePath();
  const userHome = getCachedUserHomePath();
  const shouldUseAdminSurface =
    String(redirect).startsWith("/admin") &&
    Boolean(adminHome) &&
    (getLastPortalSurface() !== "user" || !userHome);

  if (loading || isLoading) {
    if (hasStoredAuthCredentials()) {
      if (shouldUseAdminSurface) {
        const to = mapUserPortalPathToAdminPath(location.pathname);
        const nextFull = `${to}${location.search}${location.hash}`;
        const hereFull = `${location.pathname}${location.search}${location.hash}`;
        if (nextFull !== hereFull) {
          return <Navigate to={nextFull} replace />;
        }
      }
      return children ? <>{children}</> : <Outlet />;
    }
    return children ? <>{children}</> : <Outlet />;
  }

  if (!user) {
    if (hasStoredAuthCredentials()) {
      if (shouldUseAdminSurface) {
        const to = mapUserPortalPathToAdminPath(location.pathname);
        const nextFull = `${to}${location.search}${location.hash}`;
        const hereFull = `${location.pathname}${location.search}${location.hash}`;
        if (nextFull !== hereFull) {
          return <Navigate to={nextFull} replace />;
        }
      }
      return children ? <>{children}</> : <Outlet />;
    }
    return <Navigate to={redirect} replace state={{ from: location }} />;
  }

  if (normalizedRoles.length > 0 && !normalizedRoles.includes(currentRole)) {
    return <Navigate to={redirect} replace state={{ from: location }} />;
  }

  return children ? <>{children}</> : <Outlet />;
}
