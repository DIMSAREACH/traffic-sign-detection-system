/** Warm route chunks on sidebar hover for instant client navigations (no full-page reload). */

const ADMIN = {
  "/admin/dashboard": () => import("../pages/Dashboard.jsx"),
  "/admin/violations": () => import("../pages/Violations.jsx"),
  "/admin/fines": () => import("../pages/Fines.jsx"),
  "/admin/payments": () => import("../pages/Payments.jsx"),
  "/admin/vehicles": () => import("../pages/Vehicles.jsx"),
  "/admin/drivers": () => import("../pages/Drivers.jsx"),
  "/admin/reports": () => import("../pages/Reports.jsx"),
  "/admin/ai-upload": () => import("../pages/AIUpload.jsx"),
  "/admin/ai-history": () => import("../pages/AIHistory.jsx"),
  "/admin/notifications": () => import("../pages/Notifications.jsx"),
  "/admin/cameras": () => import("../pages/Cameras.jsx"),
  "/admin/map": () => import("../pages/MapView.jsx"),
  "/admin/settings": () => import("../pages/Settings.jsx"),
  "/admin/profile": () => import("../pages/Profile.jsx"),
  "/admin/help": () => import("../pages/Help.jsx"),
  "/admin/users": () => import("../pages/Users.jsx"),
};

const USER = {
  "/dashboard": () => import("../pages/UserDashboard.jsx"),
  "/dashboard/officer": () => import("../pages/OfficerDashboard.jsx"),
  "/dashboard/violations": () => import("../pages/Violations.jsx"),
  "/dashboard/fines": () => import("../pages/Fines.jsx"),
  "/dashboard/payments": () => import("../pages/Payments.jsx"),
  "/dashboard/vehicles": () => import("../pages/Vehicles.jsx"),
  "/dashboard/notifications": () => import("../pages/Notifications.jsx"),
  "/dashboard/settings": () => import("../pages/Settings.jsx"),
  "/dashboard/profile": () => import("../pages/Profile.jsx"),
  "/dashboard/help": () => import("../pages/Help.jsx"),
};

export function prefetchNavPath(path) {
  const key = typeof path === "string" ? path : "";
  const fn = ADMIN[key] || USER[key];
  if (fn) void fn();
}
