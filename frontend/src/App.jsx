import { Route, Routes } from "react-router-dom";

import ProtectedRoute from "./components/ProtectedRoute.jsx";
import RoleRoute from "./components/RoleRoute.jsx";
import AuthLayout from "./layouts/AuthLayout.jsx";
import MainLayout from "./layouts/MainLayout.jsx";
import UserLayout from "./layouts/UserLayout.jsx";
import AIUpload from "./pages/AIUpload.jsx";
import AIHistory from "./pages/AIHistory.jsx";
import Cameras from "./pages/Cameras.jsx";
import Dashboard from "./pages/Dashboard.jsx";
import Drivers from "./pages/Drivers.jsx";
import Fines from "./pages/Fines.jsx";
import ForgotPassword from "./pages/ForgotPassword.jsx";
import Help from "./pages/Help.jsx";
import Login from "./pages/Login.jsx";
import MapView from "./pages/MapView.jsx";
import NotFound from "./pages/NotFound.jsx";
import Notifications from "./pages/Notifications.jsx";
import OAuthCallback from "./pages/OAuthCallback.jsx";
import Payments from "./pages/Payments.jsx";
import Profile from "./pages/Profile.jsx";
import Register from "./pages/Register.jsx";
import Reports from "./pages/Reports.jsx";
import Settings from "./pages/Settings.jsx";
import UserDashboard from "./pages/UserDashboard.jsx";
import Users from "./pages/Users.jsx";
import Vehicles from "./pages/Vehicles.jsx";
import Violations from "./pages/Violations.jsx";

export default function App() {
  return (
    <Routes>
      {/* ── Public / Auth ── */}
      <Route element={<AuthLayout />}>
        <Route path="/login" element={<Login />} />
        <Route path="/register" element={<Register />} />
        <Route path="/forgot-password" element={<ForgotPassword />} />
        <Route path="/auth/callback/:provider" element={<OAuthCallback />} />
      </Route>

      {/* ── Admin / Officer routes ── */}
      <Route
        element={
          <ProtectedRoute>
            <RoleRoute roles={["admin", "officer"]} redirect="/user">
              <MainLayout />
            </RoleRoute>
          </ProtectedRoute>
        }
      >
        <Route path="/" element={<Dashboard />} />
        <Route path="/ai-upload" element={<AIUpload />} />
        <Route path="/ai-history" element={<AIHistory />} />
        <Route path="/violations" element={<Violations />} />
        <Route path="/fines" element={<Fines />} />
        <Route path="/payments" element={<Payments />} />
        <Route path="/vehicles" element={<Vehicles />} />
        <Route path="/drivers" element={<Drivers />} />
        <Route path="/reports" element={<Reports />} />
        <Route path="/users" element={<Users />} />
        <Route path="/notifications" element={<Notifications />} />
        <Route path="/settings" element={<Settings />} />
        <Route path="/profile" element={<Profile />} />
        <Route path="/help" element={<Help />} />
        <Route path="/cameras" element={<Cameras />} />
        <Route path="/map" element={<MapView />} />
      </Route>

      {/* ── User / Driver routes ── */}
      <Route
        element={
          <ProtectedRoute>
            <RoleRoute roles={["driver"]} redirect="/">
              <UserLayout />
            </RoleRoute>
          </ProtectedRoute>
        }
      >
        <Route path="/user" element={<UserDashboard />} />
        <Route path="/user/violations" element={<Violations />} />
        <Route path="/user/fines" element={<Fines />} />
        <Route path="/user/payments" element={<Payments />} />
        <Route path="/user/notifications" element={<Notifications />} />
        <Route path="/user/settings" element={<Settings />} />
        <Route path="/user/profile" element={<Profile />} />
        <Route path="/user/help" element={<Help />} />
      </Route>

      <Route path="*" element={<NotFound />} />
    </Routes>
  );
}