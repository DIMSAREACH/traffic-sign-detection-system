import { useEffect, useRef, useState } from "react";
import { NavLink, useNavigate } from "react-router-dom";
import { useAuth, readCachedSidebarSnapshot } from "../context/AuthContext.jsx";
import { useLanguage } from "../i18n/LanguageContext.jsx";
import { hasStoredAuthCredentials } from "../services/api.js";
import "./UserMenu.css";

const MENU_ITEMS = [
  { to: "/settings",      icon: "bi-gear-fill",                 labelKey: "nav.settings",       color: "#a78bfa" },
  { to: "/violations",    icon: "bi-exclamation-triangle-fill", labelKey: "nav.violations",     color: "#f59e0b" },
  { to: "/notifications", icon: "bi-bell-fill",                 labelKey: "nav.notifications",  color: "#38bdf8" },
];

const HELP_ITEMS = [
  { icon: "bi-flag-fill",            labelKey: "menu.reportIssue",   action: "report",    color: "#f87171" },
  { icon: "bi-question-circle-fill", labelKey: "menu.faq",           action: "faq",       color: "#a78bfa" },
  { icon: "bi-journal-text",         labelKey: "menu.documentation", action: "docs",      color: "#34d399" },
  { icon: "bi-people-fill",          labelKey: "menu.community",     action: "community", color: "#38bdf8" },
];

export default function UserMenu({ collapsed, basePath = "" }) {
  const { user, logout } = useAuth();
  const { t } = useLanguage();
  const navigate = useNavigate();
  const [open, setOpen] = useState(false);
  const [helpOpen, setHelpOpen] = useState(false);
  const menuRef = useRef(null);

  const sessionPending = !user && hasStoredAuthCredentials();
  const isAdminMenuShell = basePath === "/admin";
  const snap = readCachedSidebarSnapshot();
  const snapName = snap?.displayName?.trim() || "";
  const avatarSrc =
    (user?.avatar_url && String(user.avatar_url).trim()) ||
    (sessionPending && snap?.avatarUrl ? String(snap.avatarUrl).trim() : "") ||
    "";

  const initials = user
    ? ((user.first_name?.[0] || "") + (user.last_name?.[0] || "") || user.username?.[0] || user.email?.[0] || "U").toUpperCase()
    : sessionPending && snap?.initials
      ? snap.initials
      : sessionPending
        ? "…"
        : "U";
  const displayName = user?.first_name
    ? `${user.first_name} ${user.last_name || ""}`.trim()
    : user
      ? (user?.username || user?.email?.split("@")[0] || "User")
      : sessionPending && snapName
        ? snapName
        : sessionPending
          ? "…"
          : "User";
  const roleKey =
    (user?.role && String(user.role)) ||
    (sessionPending && snap?.roleKey ? String(snap.roleKey) : "") ||
    (sessionPending ? "" : isAdminMenuShell ? "" : "driver");
  const roleLabel = roleKey
    ? roleKey.charAt(0).toUpperCase() + roleKey.slice(1).toLowerCase()
    : sessionPending
      ? "…"
      : isAdminMenuShell
        ? "…"
        : "Driver";

  /* close on outside click */
  useEffect(() => {
    if (!open) return;
    const handler = (e) => {
      if (menuRef.current && !menuRef.current.contains(e.target)) {
        setOpen(false);
        setHelpOpen(false);
      }
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, [open]);

  /* close on Escape */
  useEffect(() => {
    if (!open) return;
    const handler = (e) => {
      if (e.key === "Escape") { setOpen(false); setHelpOpen(false); }
    };
    document.addEventListener("keydown", handler);
    return () => document.removeEventListener("keydown", handler);
  }, [open]);

  const handleHelpAction = (action) => {
    setOpen(false);
    setHelpOpen(false);
    if (action === "report") {
      navigate(`${basePath}/help?tab=resources&action=report`);
    } else {
      const tabMap = { faq: "faq", docs: "resources", community: "resources" };
      navigate(`${basePath}/help?tab=${tabMap[action] || "faq"}`);
    }
  };

  return (
    <div className="usermenu-wrapper" ref={menuRef}>
      {/* Popup */}
      {open && (
        <div className={`usermenu-popup ${helpOpen ? "usermenu-popup--help" : ""}`}>
          {!helpOpen ? (
            /* ── Main menu ── */
            <div className="usermenu-main">
              {MENU_ITEMS.map(({ to, icon, labelKey, color }) => (
                <NavLink
                  key={to}
                  to={`${basePath}${to}`}
                  className="usermenu-item"
                  style={{
                    "--item-bg": `${color}18`,
                    "--item-icon-bg": `${color}1a`,
                    "--item-icon-bg-hover": `${color}30`,
                  }}
                  onClick={() => { setOpen(false); }}
                >
                  <i className={`bi ${icon}`} style={{ color }} />
                  <span>{t(labelKey)}</span>
                </NavLink>
              ))}

              {/* Help with submenu arrow */}
              <button
                className="usermenu-item usermenu-item--has-sub"
                style={{
                  "--item-bg": "rgba(251,191,36,.09)",
                  "--item-icon-bg": "rgba(251,191,36,.1)",
                  "--item-icon-bg-hover": "rgba(251,191,36,.19)",
                }}
                onClick={() => setHelpOpen(true)}
              >
                <i className="bi bi-question-circle-fill" style={{ color: "#fbbf24" }} />
                <span>{t("menu.help")}</span>
                <i className="bi bi-chevron-right usermenu-chevron" />
              </button>

              <div className="usermenu-divider" />

              <NavLink
                to={`${basePath}/profile`}
                className="usermenu-item"
                style={{
                  "--item-bg": "rgba(167,139,250,.09)",
                  "--item-icon-bg": "rgba(167,139,250,.1)",
                  "--item-icon-bg-hover": "rgba(167,139,250,.19)",
                }}
                onClick={() => setOpen(false)}
              >
                <i className="bi bi-person-circle" style={{ color: "#a78bfa" }} />
                <span>{t("menu.profile")}</span>
              </NavLink>

              <button
                className="usermenu-item usermenu-item--danger"
                onClick={() => { setOpen(false); logout(); }}
              >
                <i className="bi bi-box-arrow-right" />
                <span>{t("menu.signOut")}</span>
              </button>

              {/* user card at bottom */}
              <div className="usermenu-divider" />
              <div className="usermenu-user-card" onClick={() => { setOpen(false); navigate(`${basePath}/profile`); }}>
                <div className="usermenu-avatar">
                  {avatarSrc ? (
                    <img src={avatarSrc} alt="" />
                  ) : (
                    initials
                  )}
                </div>
                <div className="usermenu-user-info">
                  <div className="usermenu-user-name">{displayName}</div>
                  <div className="usermenu-user-role">{roleLabel}</div>
                </div>
              </div>
            </div>
          ) : (
            /* ── Help submenu ── */
            <div className="usermenu-submenu">
              <button
                className="usermenu-item usermenu-back"
                onClick={() => setHelpOpen(false)}
              >
                <i className="bi bi-chevron-left" />
                <span>{t("menu.help")}</span>
              </button>
              <div className="usermenu-divider" />
              {HELP_ITEMS.map(({ icon, labelKey, action, color }) => (
                <button
                  key={action}
                  className="usermenu-item"
                  style={{
                    "--item-bg": `${color}18`,
                    "--item-icon-bg": `${color}1a`,
                    "--item-icon-bg-hover": `${color}30`,
                  }}
                  onClick={() => handleHelpAction(action)}
                >
                  <i className={`bi ${icon}`} style={{ color }} />
                  <span>{t(labelKey)}</span>
                </button>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Trigger — avatar button at bottom of sidebar */}
      <button
        className="usermenu-trigger"
        onClick={() => { setOpen((v) => !v); setHelpOpen(false); }}
        title={collapsed ? displayName : undefined}
      >
        <div className="usermenu-trigger-avatar">
          {avatarSrc ? (
            <img src={avatarSrc} alt="" />
          ) : (
            initials
          )}
          <span className="usermenu-online-dot" />
        </div>
        {!collapsed && (
          <div className="usermenu-trigger-info">
            <div className="usermenu-trigger-name">{displayName}</div>
            <span className="usermenu-role-badge" data-role={roleKey}>
              {roleLabel}
            </span>
          </div>
        )}
        {!collapsed && (
          <i className={`bi bi-chevron-up usermenu-dots ${open ? "usermenu-dots--open" : ""}`} />
        )}
      </button>
    </div>
  );
}
