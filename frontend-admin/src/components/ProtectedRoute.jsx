import React from "react";
import { Navigate, Outlet, useLocation } from "react-router-dom";

import { useAuth } from "../context/AuthContext.jsx";
import { hasStoredAuthCredentials } from "../services/api.js";

export default function ProtectedRoute({ children, redirectTo = "/login" }) {
  const { user, loading, isLoading } = useAuth();
  const location = useLocation();

  if (loading || isLoading) {
    // Keep layout + current URL visible while /profile/ loads after F5 (no blank flash).
    if (hasStoredAuthCredentials()) {
      return children ? <>{children}</> : <Outlet />;
    }
    return children ? <>{children}</> : <Outlet />;
  }

  if (!user) {
    if (hasStoredAuthCredentials()) {
      return children ? <>{children}</> : <Outlet />;
    }
    return <Navigate to={redirectTo} replace state={{ from: location }} />;
  }

  return children ? <>{children}</> : <Outlet />;
}
