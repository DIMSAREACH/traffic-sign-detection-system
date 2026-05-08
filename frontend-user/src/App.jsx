import React, { lazy, Suspense } from "react";
import { Navigate, Outlet, Route, Routes, useLocation } from "react-router-dom";
import { Analytics } from "@vercel/analytics/react";

import ProtectedRoute from "./components/ProtectedRoute.jsx";
import RoleRoute from "./components/RoleRoute.jsx";
import {
  useAuth,
  getRoleHomePath,
  getBootstrapRedirectPath,
  getCachedUserHomePath,
  getCachedAdminHomePath,
  getLastPortalSurface,
  mapUserPortalPathToAdminPath,
} from "./context/AuthContext.jsx";
import { hasStoredAuthCredentials } from "./services/api.js";
import { isAdminPortal, isStrictAdminSurface, isUserPortalPath } from "./utils/portal.js";
import AuthLayout from "./layouts/AuthLayout.jsx";
import MainLayout from "./layouts/MainLayout.jsx";
import UserLayout from "./layouts/UserLayout.jsx";
import Dashboard from "./pages/Dashboard.jsx";
import Profile from "./pages/Profile.jsx";
import SettingsPage from "./pages/Settings.jsx";
import Violations from "./pages/Violations.jsx";

const AIUpload = lazy(() => import("./pages/AIUpload.jsx"));
const AIHistory = lazy(() => import("./pages/AIHistory.jsx"));
const Cameras = lazy(() => import("./pages/Cameras.jsx"));
const Drivers = lazy(() => import("./pages/Drivers.jsx"));
const Fines = lazy(() => import("./pages/Fines.jsx"));
const ForgotPassword = lazy(() => import("./pages/ForgotPassword.jsx"));
const ResetPassword = lazy(() => import("./pages/ResetPassword.jsx"));
const Help = lazy(() => import("./pages/Help.jsx"));
const Login = lazy(() => import("./pages/Login.jsx"));
const MapView = lazy(() => import("./pages/MapView.jsx"));
const NotFound = lazy(() => import("./pages/NotFound.jsx"));
const Notifications = lazy(() => import("./pages/Notifications.jsx"));
const OAuthCallback = lazy(() => import("./pages/OAuthCallback.jsx"));
const OfficerDashboard = lazy(() => import("./pages/OfficerDashboard.jsx"));
const Payments = lazy(() => import("./pages/Payments.jsx"));
const Register = lazy(() => import("./pages/Register.jsx"));
const Reports = lazy(() => import("./pages/Reports.jsx"));
const UserDashboard = lazy(() => import("./pages/UserDashboard.jsx"));
const Users = lazy(() => import("./pages/Users.jsx"));
const Vehicles = lazy(() => import("./pages/Vehicles.jsx"));
/**
 * Admin dev server (port 5174) must only use /admin/* routes. Without this, legacy
 * redirects and bookmarks to /dashboard/* show the driver/officer shell on the wrong port.
 */
function DedicatedAdminSurfaceEnforcer() {
  const location = useLocation();
  if (isAdminPortal() && isUserPortalPath(location.pathname)) {
    const to = mapUserPortalPathToAdminPath(location.pathname);
    return <Navigate to={`${to}${location.search}${location.hash}`} replace />;
  }
  return <Outlet />;
}

function PortalShortcutRedirect({ dashboardTo, adminTo }) {
  return <Navigate to={isAdminPortal() ? adminTo : dashboardTo} replace />;
}

function UserLandingRedirect() {
  return <Navigate to={isAdminPortal() ? "/admin/dashboard" : "/dashboard"} replace />;
}

function RootRedirect() {
  const { user, loading, isAdmin } = useAuth();

  if (loading && hasStoredAuthCredentials()) {
    return <Navigate to={getBootstrapRedirectPath()} replace />;
  }

  if (loading) {
    return null;
  }

  if (!user) {
    if (!hasStoredAuthCredentials()) {
      return <Navigate to="/login" replace />;
    }
    return <Navigate to={getBootstrapRedirectPath()} replace />;
  }

  if (isAdminPortal() && !isAdmin(user)) {
    return <Navigate to="/login" replace />;
  }

  return <Navigate to={getRoleHomePath(user.role)} replace />;
}

function DashboardIndex() {
  const { user, loading } = useAuth();
  const { pathname } = useLocation();

  const adminHomeCached = Boolean(getCachedAdminHomePath() && !getCachedUserHomePath());
  const useAdminBootstrapShell =
    getLastPortalSurface() !== "user" || adminHomeCached;

  const redirectIfBootstrapSaysAdmin = () => {
    if (!useAdminBootstrapShell) return null;
    const boot = getBootstrapRedirectPath();
    if (boot.startsWith("/admin")) {
      return <Navigate to={boot} replace />;
    }
    return null;
  };

  if (loading && hasStoredAuthCredentials()) {
    if (!isAdminPortal()) {
      const userH = getCachedUserHomePath();
      if (userH === "/dashboard/officer") {
        return <Navigate to="/dashboard/officer" replace />;
      }
      if (useAdminBootstrapShell) {
        const adminH = getCachedAdminHomePath();
        if (adminH) {
          return <Navigate to={adminH} replace />;
        }
        const adminRedirect = redirectIfBootstrapSaysAdmin();
        if (adminRedirect) return adminRedirect;
      }
    }
    return <UserDashboard />;
  }
  if (!loading && !user && hasStoredAuthCredentials()) {
    if (useAdminBootstrapShell) {
      const adminRedirect = redirectIfBootstrapSaysAdmin();
      if (adminRedirect) return adminRedirect;
    }
    return <UserDashboard />;
  }
  if (loading) return null;
  const role = (user?.role || "").toString().trim().toLowerCase();
  // Officer portal has a dedicated dashboard route; driver uses the index dashboard page.
  if (role === "officer") return <Navigate to="/dashboard/officer" replace />;
  if (role === "admin" && !isStrictAdminSurface(pathname)) {
    return <Navigate to="/admin/dashboard" replace />;
  }
  return <UserDashboard />;
}

export default function App() {
  return (
    <>
      <Routes>
        <Route element={<DedicatedAdminSurfaceEnforcer />}>
          <Route path="/" element={<RootRedirect />} />

        <Route element={<AuthLayout />}>
          <Route path="/login" element={<Login />} />
          {!isAdminPortal() && <Route path="/register" element={<Register />} />}
          <Route path="/forgot-password" element={<ForgotPassword />} />
          <Route path="/reset-password" element={<ResetPassword />} />
          <Route path="/auth/callback/:provider" element={<OAuthCallback />} />
        </Route>

        {/* Block register page in admin portal */}
        {isAdminPortal() && <Route path="/register" element={<Navigate to="/login" replace />} />}

        <Route path="/user" element={<UserLandingRedirect />} />
        <Route path="/user/*" element={<UserLandingRedirect />} />

        <Route
          path="/admin"
          element={
            <ProtectedRoute>
              <RoleRoute roles={["admin"]} redirect={isAdminPortal() ? "/login" : "/dashboard"}>
                <MainLayout />
              </RoleRoute>
            </ProtectedRoute>
          }
        >
          <Route index element={<Navigate to="/admin/dashboard" replace />} />
          <Route path="dashboard" element={<Dashboard />} />
          <Route path="ai-upload" element={<AIUpload />} />
          <Route path="ai-history" element={<AIHistory />} />
          <Route path="violations" element={<Violations />} />
          <Route path="fines" element={<Fines />} />
          <Route path="payments" element={<Payments />} />
          <Route path="vehicles" element={<Vehicles />} />
          <Route path="drivers" element={<Drivers />} />
          <Route path="reports" element={<Reports />} />
          <Route path="users" element={<Users />} />
          <Route path="notifications" element={<Notifications />} />
          <Route path="settings" element={<SettingsPage />} />
          <Route path="profile" element={<Profile />} />
          <Route path="help" element={<Help />} />
          <Route path="cameras" element={<Cameras />} />
          <Route path="map" element={<MapView />} />
        </Route>

        <Route
          path="/dashboard"
          element={
            <ProtectedRoute>
              {/* Admin accounts should use the admin portal (/admin/*). */}
              <RoleRoute roles={["officer", "driver"]} redirect="/admin/dashboard">
                <UserLayout />
              </RoleRoute>
            </ProtectedRoute>
          }
        >
          <Route index element={<DashboardIndex />} />
          <Route path="officer" element={<OfficerDashboard />} />
          <Route path="violations" element={<Violations />} />
          <Route path="fines" element={<Fines />} />
          <Route path="payments" element={<Payments />} />
          <Route path="vehicles" element={<Vehicles />} />
          <Route path="notifications" element={<Notifications />} />
          <Route path="settings" element={<SettingsPage />} />
          <Route path="profile" element={<Profile />} />
          <Route path="help" element={<Help />} />
        </Route>

        {/* Backwards-compatible shortcuts — admin port (5174) must target /admin/* */}
        <Route
          path="/violations"
          element={<PortalShortcutRedirect dashboardTo="/dashboard/violations" adminTo="/admin/violations" />}
        />
        <Route
          path="/fines"
          element={<PortalShortcutRedirect dashboardTo="/dashboard/fines" adminTo="/admin/fines" />}
        />
        <Route
          path="/payments"
          element={<PortalShortcutRedirect dashboardTo="/dashboard/payments" adminTo="/admin/payments" />}
        />
        <Route
          path="/vehicles"
          element={<PortalShortcutRedirect dashboardTo="/dashboard/vehicles" adminTo="/admin/vehicles" />}
        />
        <Route
          path="/notifications"
          element={<PortalShortcutRedirect dashboardTo="/dashboard/notifications" adminTo="/admin/notifications" />}
        />
        <Route
          path="/settings"
          element={<PortalShortcutRedirect dashboardTo="/dashboard/settings" adminTo="/admin/settings" />}
        />
        <Route
          path="/profile"
          element={<PortalShortcutRedirect dashboardTo="/dashboard/profile" adminTo="/admin/profile" />}
        />
        <Route
          path="/help"
          element={<PortalShortcutRedirect dashboardTo="/dashboard/help" adminTo="/admin/help" />}
        />

        <Route
          path="*"
          element={
            <Suspense fallback={null}>
              <NotFound />
            </Suspense>
          }
        />
      </Route>
    </Routes>
    <Analytics />
    </>
  );
}
