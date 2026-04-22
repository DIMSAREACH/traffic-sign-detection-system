import { useEffect, useState } from "react";
import { NavLink, Outlet, useLocation, useNavigate } from "react-router-dom";

import { useAuth } from "../context/AuthContext.jsx";
import { useLanguage } from "../i18n/LanguageContext.jsx";
import NotificationBell from "../components/NotificationBell.jsx";
import UserMenu from "../components/UserMenu.jsx";
import "./MainLayout.css";

const NAV = [
  { to: "/",           icon: "bi-grid-fill",                 labelKey: "nav.dashboard"     },
  { to: "/violations", icon: "bi-exclamation-triangle-fill", labelKey: "nav.violations"    },
  { to: "/fines",      icon: "bi-receipt-cutoff",           labelKey: "nav.fines"         },
  { to: "/payments",   icon: "bi-credit-card-2-front",     labelKey: "nav.payments"      },
  { to: "/vehicles",   icon: "bi-car-front-fill",           labelKey: "nav.vehicles"      },
  { to: "/drivers",    icon: "bi-person-vcard",             labelKey: "nav.drivers"       },
  { to: "/reports",    icon: "bi-bar-chart-fill",            labelKey: "nav.reports"       },
  { to: "/ai-upload",  icon: "bi-cpu-fill",                 labelKey: "nav.aiDetection"   },
  { to: "/ai-history", icon: "bi-clock-history",            labelKey: "nav.aiHistory"     },
  { to: "/notifications", icon: "bi-bell-fill",             labelKey: "nav.notifications" },
  { to: "/cameras",    icon: "bi-camera-video-fill",        labelKey: "nav.cameras"       },
  { to: "/map",        icon: "bi-geo-alt-fill",             labelKey: "nav.map"           },
];

const ACCOUNT_NAV = [
  { to: "/settings", icon: "bi-gear-fill",    labelKey: "nav.settings" },
  { to: "/profile",  icon: "bi-person-circle", labelKey: "nav.profile"  },
];

const PAGE_TITLE_KEYS = {
  "/":           { title: "page.dashboard.title",    sub: "page.dashboard.sub" },
  "/violations": { title: "page.violations.title",   sub: "page.violations.sub" },
  "/fines":      { title: "page.fines.title",        sub: "page.fines.sub" },
  "/payments":   { title: "page.payments.title",     sub: "page.payments.sub" },
  "/vehicles":   { title: "page.vehicles.title",     sub: "page.vehicles.sub" },
  "/drivers":    { title: "page.drivers.title",      sub: "page.drivers.sub" },
  "/reports":    { title: "page.reports.title",       sub: "page.reports.sub" },
  "/ai-upload":      { title: "page.aiUpload.title",     sub: "page.aiUpload.sub" },
  "/ai-history":      { title: "page.aiHistory.title",    sub: "page.aiHistory.sub" },
  "/notifications":  { title: "page.notifications.title", sub: "page.notifications.sub" },
  "/users":          { title: "page.users.title",         sub: "page.users.sub" },
  "/settings":       { title: "page.settings.title",      sub: "page.settings.sub" },
  "/profile":    { title: "page.profile.title",      sub: "page.profile.sub" },
  "/cameras":    { title: "page.cameras.title",     sub: "page.cameras.sub" },
  "/map":        { title: "page.map.title",         sub: "page.map.sub" },
  "/help":       { title: "page.help.title",        sub: "page.help.sub" },
};

const ADMIN_NAV = [
  { to: "/users", icon: "bi-people-fill", labelKey: "nav.users" },
];

export default function MainLayout() {
  const { user, logout } = useAuth();
  const { t, lang } = useLanguage();
  const { pathname } = useLocation();
  const navigate = useNavigate();
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

  /* ── Sync when Settings page changes any setting ── */
  useEffect(() => {
    const d = document.documentElement;
    const handler = (e) => {
      const { key, value } = e.detail || {};
      if (key === "theme")        setDark(value === "dark");
      if (key === "sidebar")      setCollapsed(value === "1");
      if (key === "compact")      d.setAttribute("data-compact", String(!!value));
      if (key === "fontSize")     d.setAttribute("data-fontsize", String(value));
      if (key === "highContrast") d.setAttribute("data-contrast", String(!!value));
      if (key === "reduceMotion") d.setAttribute("data-reduce-motion", String(!!value));
    };
    window.addEventListener("settings-change", handler);
    return () => window.removeEventListener("settings-change", handler);
  }, []);

  /* ── Close mobile drawer on resize above 768px ── */
  useEffect(() => {
    const h = () => { if (window.innerWidth > 768) setMobileOpen(false); };
    window.addEventListener("resize", h);
    return () => window.removeEventListener("resize", h);
  }, []);

  /* ── Global keyboard shortcuts (Ctrl+D/V/F/N) ── */
  useEffect(() => {
    const getSetting = (k, def) => { try { return JSON.parse(localStorage.getItem(k)) ?? def; } catch { return def; } };
    const handler = (e) => {
      if (!getSetting("settings.keyboardShort", true)) return;
      if (!e.ctrlKey && !e.metaKey) return;
      if (e.target.tagName === "INPUT" || e.target.tagName === "TEXTAREA" || e.target.tagName === "SELECT") return;
      const routes = { d: "/", v: "/violations", f: "/fines", n: "/notifications" };
      const route = routes[e.key.toLowerCase()];
      if (route) { e.preventDefault(); navigate(route); }
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [navigate]);

  /** Helpers that also emit so the Settings page stays in sync */
  const toggleDark = () => {
    setDark(d => {
      const next = !d;
      window.dispatchEvent(new CustomEvent("settings-change", { detail: { key: "theme", value: next ? "dark" : "light" } }));
      return next;
    });
  };
  const toggleSidebar = () => {
    setCollapsed(c => {
      const next = !c;
      window.dispatchEvent(new CustomEvent("settings-change", { detail: { key: "sidebar", value: next ? "1" : "0" } }));
      return next;
    });
    setMobileOpen(false);
  };
  const toggleMobile = () => setMobileOpen(m => !m);
  const closeMobile = () => setMobileOpen(false);

  return (
    <div className="app-shell">

      {/* ══ MOBILE OVERLAY ══ */}
      <div
        className={`sidebar-overlay${mobileOpen ? " sidebar-overlay--visible" : ""}`}
        onClick={closeMobile}
      />

      {/* ══ SIDEBAR ══ */}
      <aside className={`sidebar${collapsed ? " sidebar-collapsed" : ""}${mobileOpen ? " sidebar-mobile-open" : ""}`}>
        <div className="sidebar-inner">

          {/* logo + toggle */}
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
              <NavLink to="/" className="sidebar-logo">
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

          {/* main nav */}
          <div className="sidebar-section-label"><span>{t("nav.sectionMain")}</span></div>
          <nav className="sidebar-nav">
            {NAV.map(({ to, icon, labelKey }) => (
              <NavLink
                key={to}
                to={to}
                end={to === "/"}
                className={({ isActive }) =>
                  `sidebar-link${isActive ? " active" : ""}`
                }
                title={collapsed ? t(labelKey) : undefined}
                onClick={closeMobile}
              >
                <span className="sidebar-link-icon"><i className={`bi ${icon}`} /></span>
                <span className="sidebar-link-label">{t(labelKey)}</span>
              </NavLink>
            ))}
          </nav>

          {/* admin nav */}
          {user?.role === "admin" && (
            <>
              <div className="sidebar-section-label"><span>{t("nav.sectionAdmin")}</span></div>
              <nav className="sidebar-nav">
                {ADMIN_NAV.map(({ to, icon, labelKey }) => (
                  <NavLink
                    key={to}
                    to={to}
                    className={({ isActive }) =>
                      `sidebar-link${isActive ? " active" : ""}`
                    }
                    title={collapsed ? t(labelKey) : undefined}
                    onClick={closeMobile}
                  >
                    <span className="sidebar-link-icon"><i className={`bi ${icon}`} /></span>
                    <span className="sidebar-link-label">{t(labelKey)}</span>
                  </NavLink>
                ))}
              </nav>
            </>
          )}

          {/* account nav */}
          <div className="sidebar-section-label sidebar-section-label--bottom"><span>{t("nav.sectionAccount")}</span></div>
          <nav className="sidebar-nav">
            {ACCOUNT_NAV.map(({ to, icon, labelKey }) => (
              <NavLink
                key={to}
                to={to}
                className={({ isActive }) =>
                  `sidebar-link${isActive ? " active" : ""}`
                }
                title={collapsed ? t(labelKey) : undefined}
                onClick={closeMobile}
              >
                <span className="sidebar-link-icon"><i className={`bi ${icon}`} /></span>
                <span className="sidebar-link-label">{t(labelKey)}</span>
              </NavLink>
            ))}
          </nav>

          {/* user menu popup */}
          <UserMenu collapsed={collapsed} />

        </div>
      </aside>

      {/* ══ MAIN ══ */}
      <div className={`main-content${collapsed ? " main-collapsed" : ""}`}>

        {/* top header */}
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
              {new Date().toLocaleDateString(lang === "km" ? "km-KH" : "en-US", { weekday: "short", month: "short", day: "numeric", year: "numeric" })}
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

        {/* page content */}
        <main className="page-area">
          <Outlet />
        </main>

      </div>
    </div>
  );
}

