import { useEffect, useState } from "react";
import { NavLink, useLocation, useNavigate } from "react-router-dom";

import { useAuth, persistLastVisitedPath } from "../context/AuthContext.jsx";
import { useIdleRoutePrefetch } from "../hooks/useIdleRoutePrefetch.js";
import { useLanguage } from "../i18n/LanguageContext.jsx";
import NotificationBell from "../components/NotificationBell.jsx";
import UserMenu from "../components/UserMenu.jsx";
import AnimatedOutlet from "../components/ui/AnimatedOutlet.jsx";
import { prefetchNavPath } from "../utils/prefetchNav.js";
import "./MainLayout.css";

const NAV = [
  { to: "/dashboard", icon: "bi-grid-fill", labelKey: "nav.dashboard" },
  { to: "/dashboard/violations", icon: "bi-exclamation-triangle-fill", labelKey: "nav.myViolations" },
  { to: "/dashboard/fines", icon: "bi-receipt-cutoff", labelKey: "nav.myFines" },
  { to: "/dashboard/payments", icon: "bi-credit-card-2-front", labelKey: "nav.myPayments" },
  { to: "/dashboard/vehicles", icon: "bi-car-front-fill", labelKey: "nav.vehicles" },
  { to: "/dashboard/notifications", icon: "bi-bell-fill", labelKey: "nav.notifications" },
];

const ACCOUNT_NAV = [
  { to: "/dashboard/settings", icon: "bi-gear-fill", labelKey: "nav.settings" },
  { to: "/dashboard/profile", icon: "bi-person-circle", labelKey: "nav.profile" },
];

const PAGE_TITLE_KEYS = {
  "/dashboard": { title: "page.userDashboard.title", sub: "page.userDashboard.sub" },
  "/dashboard/violations": { title: "page.violations.title", sub: "page.violations.sub" },
  "/dashboard/fines": { title: "page.fines.title", sub: "page.fines.sub" },
  "/dashboard/payments": { title: "page.payments.title", sub: "page.payments.sub" },
  "/dashboard/vehicles": { title: "page.vehicles.title", sub: "page.vehicles.sub" },
  "/dashboard/notifications": { title: "page.notifications.title", sub: "page.notifications.sub" },
  "/dashboard/settings": { title: "page.settings.title", sub: "page.settings.sub" },
  "/dashboard/profile": { title: "page.profile.title", sub: "page.profile.sub" },
  "/dashboard/help": { title: "page.help.title", sub: "page.help.sub" },
};

function warmNavTarget(to) {
  prefetchNavPath(to);
}

function prefetchUserPortalChunks() {
  void import("../pages/Violations.jsx");
  void import("../pages/Fines.jsx");
  void import("../pages/Payments.jsx");
  void import("../pages/Vehicles.jsx");
  void import("../pages/Notifications.jsx");
  void import("../pages/Settings.jsx");
  void import("../pages/Profile.jsx");
  void import("../pages/Help.jsx");
  void import("../pages/UserDashboard.jsx");
  void import("../pages/OfficerDashboard.jsx");
}

export default function UserLayout() {
  useIdleRoutePrefetch(prefetchUserPortalChunks);
  const { t, lang } = useLanguage();
  const { user, refreshUser, getRoleHomePath } = useAuth();
  const { pathname } = useLocation();
  const navigate = useNavigate();

  useEffect(() => {
    prefetchUserPortalChunks();
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

  // If an admin changes this user's role, keep the UI in sync (interval + debounced window focus).
  useEffect(() => {
    let timer = null;
    let lastFocusSync = 0;
    const FOCUS_DEBOUNCE_MS = 8000;
    const sync = async () => {
      try {
        await refreshUser();
      } catch {
        // ignore
      }
    };

    const onFocus = () => {
      const now = Date.now();
      if (now - lastFocusSync < FOCUS_DEBOUNCE_MS) return;
      lastFocusSync = now;
      void sync();
    };
    window.addEventListener("focus", onFocus);
    timer = window.setInterval(sync, 30000);

    return () => {
      window.removeEventListener("focus", onFocus);
      if (timer) window.clearInterval(timer);
    };
  }, [refreshUser]);

  // Redirect to the correct dashboard when role changes (driver vs officer).
  useEffect(() => {
    if (!user?.role) return;
    const home = getRoleHomePath(user.role);
    if (!pathname.startsWith("/dashboard")) return;
    if (home === "/dashboard" && pathname.startsWith("/dashboard/officer")) {
      navigate("/dashboard", { replace: true });
    } else if (home === "/dashboard/officer" && pathname === "/dashboard") {
      navigate("/dashboard/officer", { replace: true });
    }
  }, [user?.role, pathname, navigate, getRoleHomePath]);

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
      const routes = { d: "/dashboard", v: "/dashboard/violations", f: "/dashboard/fines", n: "/dashboard/notifications" };
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
      window.dispatchEvent(
        new CustomEvent("settings-change", { detail: { key: "theme", value: next ? "dark" : "light" } })
      );
      return next;
    });
  };

  const toggleSidebar = () => {
    setCollapsed((c) => {
      const next = !c;
      window.dispatchEvent(
        new CustomEvent("settings-change", { detail: { key: "sidebar", value: next ? "1" : "0" } })
      );
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
                to="/dashboard"
                className="sidebar-logo"
                onMouseEnter={() => warmNavTarget("/dashboard")}
                onMouseDown={() => warmNavTarget("/dashboard")}
              >
                <div className="sidebar-logo-icon">
                  <i className="bi bi-camera-video-fill" />
                </div>
                <div className="sidebar-logo-text">
                  {t("nav.brand1")}
                  <small>{user?.role === "officer" ? "Officer Portal" : t("nav.userBrand2")}</small>
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
                end={to === "/dashboard"}
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

          <UserMenu collapsed={collapsed} basePath="/dashboard" />
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
