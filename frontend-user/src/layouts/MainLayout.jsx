import { useEffect, useState } from "react";
import { NavLink, useLocation, useNavigate } from "react-router-dom";

import { useAuth, persistLastVisitedPath } from "../context/AuthContext.jsx";
import { useIdleRoutePrefetch } from "../hooks/useIdleRoutePrefetch.js";
import { useLanguage } from "../i18n/LanguageContext.jsx";
import NotificationBell from "../components/NotificationBell.jsx";
import UserMenu from "../components/UserMenu.jsx";
import AnimatedOutlet from "../components/ui/AnimatedOutlet.jsx";
import { hasStoredAuthCredentials } from "../services/api.js";
import { prefetchNavPath } from "../utils/prefetchNav.js";
import "./MainLayout.css";

const NAV = [
  { to: "/admin/dashboard", icon: "bi-grid-fill", labelKey: "nav.dashboard" },
  { to: "/admin/violations", icon: "bi-exclamation-triangle-fill", labelKey: "nav.violations" },
  { to: "/admin/fines", icon: "bi-receipt-cutoff", labelKey: "nav.fines" },
  { to: "/admin/payments", icon: "bi-credit-card-2-front", labelKey: "nav.payments" },
  { to: "/admin/vehicles", icon: "bi-car-front-fill", labelKey: "nav.vehicles" },
  { to: "/admin/drivers", icon: "bi-person-vcard", labelKey: "nav.drivers" },
  { to: "/admin/reports", icon: "bi-bar-chart-fill", labelKey: "nav.reports" },
  { to: "/admin/ai-upload", icon: "bi-cpu-fill", labelKey: "nav.aiDetection" },
  { to: "/admin/ai-history", icon: "bi-clock-history", labelKey: "nav.aiHistory" },
  { to: "/admin/notifications", icon: "bi-bell-fill", labelKey: "nav.notifications" },
  { to: "/admin/cameras", icon: "bi-camera-video-fill", labelKey: "nav.cameras" },
  { to: "/admin/map", icon: "bi-geo-alt-fill", labelKey: "nav.map" },
];

const ACCOUNT_NAV = [
  { to: "/admin/settings", icon: "bi-gear-fill", labelKey: "nav.settings" },
  { to: "/admin/profile", icon: "bi-person-circle", labelKey: "nav.profile" },
];

const PAGE_TITLE_KEYS = {
  "/admin/dashboard": { title: "page.dashboard.title", sub: "page.dashboard.sub" },
  "/admin/violations": { title: "page.violations.title", sub: "page.violations.sub" },
  "/admin/fines": { title: "page.fines.title", sub: "page.fines.sub" },
  "/admin/payments": { title: "page.payments.title", sub: "page.payments.sub" },
  "/admin/vehicles": { title: "page.vehicles.title", sub: "page.vehicles.sub" },
  "/admin/drivers": { title: "page.drivers.title", sub: "page.drivers.sub" },
  "/admin/reports": { title: "page.reports.title", sub: "page.reports.sub" },
  "/admin/ai-upload": { title: "page.aiUpload.title", sub: "page.aiUpload.sub" },
  "/admin/ai-history": { title: "page.aiHistory.title", sub: "page.aiHistory.sub" },
  "/admin/notifications": { title: "page.notifications.title", sub: "page.notifications.sub" },
  "/admin/users": { title: "page.users.title", sub: "page.users.sub" },
  "/admin/settings": { title: "page.settings.title", sub: "page.settings.sub" },
  "/admin/profile": { title: "page.profile.title", sub: "page.profile.sub" },
  "/admin/cameras": { title: "page.cameras.title", sub: "page.cameras.sub" },
  "/admin/map": { title: "page.map.title", sub: "page.map.sub" },
  "/admin/help": { title: "page.help.title", sub: "page.help.sub" },
};

const ADMIN_NAV = [
  { to: "/admin/users", icon: "bi-people-fill", labelKey: "nav.users" },
];

function prefetchAdminPortalChunks() {
  void import("../pages/Dashboard.jsx");
  void import("../pages/Violations.jsx");
  void import("../pages/Fines.jsx");
  void import("../pages/Payments.jsx");
  void import("../pages/Vehicles.jsx");
  void import("../pages/Drivers.jsx");
  void import("../pages/Reports.jsx");
  void import("../pages/AIUpload.jsx");
  void import("../pages/AIHistory.jsx");
  void import("../pages/Notifications.jsx");
  void import("../pages/Cameras.jsx");
  void import("../pages/MapView.jsx");
  void import("../pages/Settings.jsx");
  void import("../pages/Profile.jsx");
  void import("../pages/Help.jsx");
  void import("../pages/Users.jsx");
}

function warmNavTarget(to) {
  prefetchNavPath(to);
}

export default function MainLayout() {
  useIdleRoutePrefetch(prefetchAdminPortalChunks);
  const { user, logout, loading } = useAuth();
  const { t, lang } = useLanguage();
  const { pathname } = useLocation();
  const navigate = useNavigate();

  const showAdminSection =
    String(user?.role || "").toLowerCase() === "admin" ||
    (hasStoredAuthCredentials() && (loading || !user));

  useEffect(() => {
    prefetchAdminPortalChunks();
  }, []);

  useEffect(() => {
    prefetchNavPath(pathname);
  }, [pathname]);

  useEffect(() => {
    persistLastVisitedPath(pathname);
  }, [pathname]);

  const pageKeys = PAGE_TITLE_KEYS[pathname] || { title: "nav.dashboard", sub: "" };
  const page = { title: t(pageKeys.title), sub: t(pageKeys.sub) };

  const [dark, setDark] = useState(() => localStorage.getItem("theme") === "dark");
  const [collapsed, setCollapsed] = useState(() => localStorage.getItem("sidebar") === "1");
  const [mobileOpen, setMobileOpen] = useState(false);

  useEffect(() => {
    document.documentElement.setAttribute("data-theme", dark ? "dark" : "light");
    localStorage.setItem("theme", dark ? "dark" : "light");
  }, [dark]);

  useEffect(() => {
    localStorage.setItem("sidebar", collapsed ? "1" : "0");
  }, [collapsed]);

  useEffect(() => {
    const d = document.documentElement;
    const handler = (e) => {
      const { key, value } = e.detail || {};
      if (key === "theme") setDark(value === "dark");
      if (key === "sidebar") setCollapsed(value === "1");
      if (key === "compact") d.setAttribute("data-compact", String(!!value));
      if (key === "fontSize") d.setAttribute("data-fontsize", String(value));
      if (key === "highContrast") d.setAttribute("data-contrast", String(!!value));
      if (key === "reduceMotion") d.setAttribute("data-reduce-motion", String(!!value));
    };
    window.addEventListener("settings-change", handler);
    return () => window.removeEventListener("settings-change", handler);
  }, []);

  useEffect(() => {
    const h = () => {
      if (window.innerWidth > 768) setMobileOpen(false);
    };
    window.addEventListener("resize", h);
    return () => window.removeEventListener("resize", h);
  }, []);

  useEffect(() => {
    const getSetting = (k, def) => {
      try {
        return JSON.parse(localStorage.getItem(k)) ?? def;
      } catch {
        return def;
      }
    };
    const handler = (e) => {
      if (!getSetting("settings.keyboardShort", true)) return;
      if (!e.ctrlKey && !e.metaKey) return;
      if (e.target.tagName === "INPUT" || e.target.tagName === "TEXTAREA" || e.target.tagName === "SELECT") return;
      const routes = { d: "/admin/dashboard", v: "/admin/violations", f: "/admin/fines", n: "/admin/notifications" };
      const route = routes[e.key.toLowerCase()];
      if (route) {
        e.preventDefault();
        navigate(route);
      }
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [navigate]);

  const toggleDark = () => {
    setDark((d) => {
      const next = !d;
      window.dispatchEvent(new CustomEvent("settings-change", { detail: { key: "theme", value: next ? "dark" : "light" } }));
      return next;
    });
  };

  const toggleSidebar = () => {
    setCollapsed((c) => {
      const next = !c;
      window.dispatchEvent(new CustomEvent("settings-change", { detail: { key: "sidebar", value: next ? "1" : "0" } }));
      return next;
    });
    setMobileOpen(false);
  };

  const toggleMobile = () => setMobileOpen((m) => !m);
  const closeMobile = () => setMobileOpen(false);

  return (
    <div className="app-shell">
      <div
        className={`sidebar-overlay${mobileOpen ? " sidebar-overlay--visible" : ""}`}
        onClick={closeMobile}
      />

      <aside className={`sidebar${collapsed ? " sidebar-collapsed" : ""}${mobileOpen ? " sidebar-mobile-open" : ""}`}>
        <div className="sidebar-inner">
          <div className="sidebar-logo-row">
            {collapsed ? (
              <button
                className="sidebar-logo-icon sidebar-logo-icon--btn"
                onClick={toggleSidebar}
                aria-label={t("header.expand")}
              >
                <i className="bi bi-camera-video-fill" />
              </button>
            ) : (
              <NavLink
                to="/admin/dashboard"
                className="sidebar-logo"
                onMouseEnter={() => warmNavTarget("/admin/dashboard")}
                onMouseDown={() => warmNavTarget("/admin/dashboard")}
              >
                <div className="sidebar-logo-icon">
                  <i className="bi bi-camera-video-fill" />
                </div>
                <div className="sidebar-logo-text">
                  {t("nav.brand1")}
                  <small>{t("nav.brand2")}</small>
                </div>
              </NavLink>
            )}
            <button
              className="sidebar-toggle-btn"
              onClick={toggleSidebar}
              aria-label={collapsed ? t("header.expand") : t("header.collapse")}
            >
              <i className={`bi ${collapsed ? "bi-layout-sidebar-inset" : "bi-layout-sidebar"}`} />
            </button>
          </div>

          <div className="sidebar-section-label"><span>{t("nav.sectionMain")}</span></div>
          <nav className="sidebar-nav">
            {NAV.map(({ to, icon, labelKey }) => (
              <NavLink
                key={to}
                to={to}
                className={({ isActive }) => `sidebar-link${isActive ? " active" : ""}`}
                title={collapsed ? t(labelKey) : undefined}
                onMouseEnter={() => warmNavTarget(to)}
                onMouseDown={() => warmNavTarget(to)}
                onFocus={() => warmNavTarget(to)}
                onClick={closeMobile}
              >
                <span className="sidebar-link-icon"><i className={`bi ${icon}`} /></span>
                <span className="sidebar-link-label">{t(labelKey)}</span>
              </NavLink>
            ))}
          </nav>

          {showAdminSection && (
            <>
              <div className="sidebar-section-label"><span>{t("nav.sectionAdmin")}</span></div>
              <nav className="sidebar-nav">
                {ADMIN_NAV.map(({ to, icon, labelKey }) => (
                  <NavLink
                    key={to}
                    to={to}
                    className={({ isActive }) => `sidebar-link${isActive ? " active" : ""}`}
                    title={collapsed ? t(labelKey) : undefined}
                    onMouseEnter={() => warmNavTarget(to)}
                    onMouseDown={() => warmNavTarget(to)}
                    onFocus={() => warmNavTarget(to)}
                    onClick={closeMobile}
                  >
                    <span className="sidebar-link-icon"><i className={`bi ${icon}`} /></span>
                    <span className="sidebar-link-label">{t(labelKey)}</span>
                  </NavLink>
                ))}
              </nav>
            </>
          )}

          <div className="sidebar-section-label sidebar-section-label--bottom"><span>{t("nav.sectionAccount")}</span></div>
          <nav className="sidebar-nav">
            {ACCOUNT_NAV.map(({ to, icon, labelKey }) => (
              <NavLink
                key={to}
                to={to}
                className={({ isActive }) => `sidebar-link${isActive ? " active" : ""}`}
                title={collapsed ? t(labelKey) : undefined}
                onMouseEnter={() => warmNavTarget(to)}
                onMouseDown={() => warmNavTarget(to)}
                onFocus={() => warmNavTarget(to)}
                onClick={closeMobile}
              >
                <span className="sidebar-link-icon"><i className={`bi ${icon}`} /></span>
                <span className="sidebar-link-label">{t(labelKey)}</span>
              </NavLink>
            ))}
          </nav>

          <UserMenu collapsed={collapsed} basePath="/admin" />
        </div>
      </aside>

      <div className={`main-content${collapsed ? " main-collapsed" : ""}`}>
        <header className="top-header">
          <div className="top-header-left">
            <button
              className="header-sidebar-toggle d-md-none"
              onClick={toggleMobile}
              aria-label={mobileOpen ? t("header.collapse") : t("header.expand")}
            >
              <i className={`bi ${mobileOpen ? "bi-x-lg" : "bi-list"}`} />
            </button>
            <div>
              <div className="top-header-title">{page.title}</div>
              <div className="top-header-subtitle">{page.sub}</div>
            </div>
          </div>
          <div className="header-actions">
            <div className="header-date">
              <i className="bi bi-calendar3" />
              {new Date().toLocaleDateString(lang === "km" ? "km-KH" : "en-US", {
                weekday: "short",
                month: "short",
                day: "numeric",
                year: "numeric",
              })}
            </div>
            <button
              className="theme-toggle"
              onClick={toggleDark}
              title={dark ? t("header.lightMode") : t("header.darkMode")}
            >
              <i className={`bi ${dark ? "bi-sun-fill" : "bi-moon-stars-fill"}`} />
            </button>
            <NotificationBell />
          </div>
        </header>

        <main className="page-area">
          <AnimatedOutlet />
        </main>
      </div>
    </div>
  );
}
