import { useEffect, useRef, useState, useCallback } from "react";
import { NavLink } from "react-router-dom";
import { useLanguage } from "../i18n/LanguageContext.jsx";
import {
  clearAll,
  deleteNotification,
  getUnreadCount,
  listAllNotifications,
  markAllRead,
  markRead,
} from "../services/notificationService.js";

const PU = "#7c3aed";
const PA = (a) => `rgba(124,58,237,${a})`;

const TYPE_META = {
  violation: { icon: "bi-exclamation-triangle-fill", color: "#f59e0b", bg: "rgba(245,158,11,.1)" },
  fine:      { icon: "bi-receipt",                  color: "#3b82f6", bg: "rgba(59,130,246,.1)" },
  system:    { icon: "bi-gear-fill",                color: PU,        bg: PA(".1")              },
  alert:     { icon: "bi-bell-fill",                color: "#ef4444", bg: "rgba(239,68,68,.1)"  },
};

const meta = (type) => TYPE_META[type] || TYPE_META.system;
const POLL_MS = 30_000;

export default function NotificationBell() {
  const { t } = useLanguage();
  const [unread,  setUnread]  = useState(0);
  const [open,    setOpen]    = useState(false);
  const [notifs,  setNotifs]  = useState([]);
  const [loading, setLoading] = useState(false);
  const wrapRef = useRef(null);

  /* ── poll unread count ── */
  const refreshCount = useCallback(async () => {
    try { setUnread(await getUnreadCount()); } catch { /* ignore */ }
  }, []);

  useEffect(() => {
    refreshCount();
    const id = setInterval(refreshCount, POLL_MS);
    return () => clearInterval(id);
  }, [refreshCount]);

  /* ── load full list when dropdown opens ── */
  useEffect(() => {
    if (!open) return;
    setLoading(true);
    listAllNotifications()
      .then(setNotifs)
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [open]);

  /* ── close on outside click ── */
  useEffect(() => {
    if (!open) return;
    const handler = (e) => {
      if (wrapRef.current && !wrapRef.current.contains(e.target)) setOpen(false);
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, [open]);

  /* ── actions ── */
  const handleMarkRead = async (id) => {
    await markRead(id).catch(() => {});
    setNotifs(prev => prev.map(n => n.id === id ? { ...n, is_read: true } : n));
    setUnread(u => Math.max(0, u - 1));
  };

  const handleMarkAll = async () => {
    await markAllRead().catch(() => {});
    setNotifs(prev => prev.map(n => ({ ...n, is_read: true })));
    setUnread(0);
  };

  const handleDelete = async (id) => {
    const wasUnread = notifs.find(n => n.id === id)?.is_read === false;
    await deleteNotification(id).catch(() => {});
    setNotifs(prev => prev.filter(n => n.id !== id));
    if (wasUnread) setUnread(u => Math.max(0, u - 1));
  };

  const handleClearAll = async () => {
    await clearAll().catch(() => {});
    setNotifs([]);
    setUnread(0);
  };

  const toggleOpen = () => setOpen(o => !o);

  return (
    <div ref={wrapRef} style={{ position: "relative" }}>

      {/* ── Bell button ── */}
      <button
        className="header-badge-btn"
        title={t("notif.title")}
        onClick={toggleOpen}
        style={{
          outline: open ? `2px solid ${PU}` : "none",
          outlineOffset: 2,
        }}
      >
        <i className="bi bi-bell" />
        {unread > 0 && (
          <span
            style={{
              position: "absolute", top: 4, right: 4,
              minWidth: 16, height: 16,
              background: "#ef4444", color: "#fff",
              borderRadius: 99, fontSize: ".68rem", fontWeight: 700,
              display: "flex", alignItems: "center", justifyContent: "center",
              lineHeight: 1, padding: "0 3px",
              border: "2px solid var(--bs-body-bg, #fff)",
            }}
          >
            {unread > 99 ? "99+" : unread}
          </span>
        )}
      </button>

      {/* ── Dropdown panel ── */}
      {open && (
        <div
          style={{
            position: "absolute", top: "calc(100% + 8px)", right: 0,
            width: 360, maxHeight: 480,
            background: "var(--bs-body-bg, #fff)",
            border: "1px solid var(--bs-border-color, #e2e8f0)",
            borderRadius: 16,
            boxShadow: "0 8px 32px rgba(0,0,0,.14)",
            zIndex: 1060,
            display: "flex", flexDirection: "column",
            overflow: "hidden",
          }}
        >
          {/* header */}
          <div
            style={{
              padding: "12px 16px",
              borderBottom: "1px solid var(--bs-border-color, #e2e8f0)",
              display: "flex", alignItems: "center", justifyContent: "space-between",
              flexShrink: 0,
            }}
          >
            <span style={{ fontWeight: 700, fontSize: "1rem", color: "var(--bs-body-color)" }}>
              {t("notif.title")}
              {unread > 0 && (
                <span
                  style={{
                    marginLeft: 6,
                    background: PA(".15"), color: PU,
                    borderRadius: 99, fontSize: ".75rem", fontWeight: 700,
                    padding: "1px 7px",
                  }}
                >
                  {unread}
                </span>
              )}
            </span>
            <div style={{ display: "flex", gap: 6 }}>
              {unread > 0 && (
                <button
                  onClick={handleMarkAll}
                  style={{
                    background: "none", border: "none", cursor: "pointer",
                    fontSize: ".8rem", color: PU, fontWeight: 600, padding: "2px 6px",
                  }}
                >
                  {t("notif.markAllRead")}
                </button>
              )}
              {notifs.length > 0 && (
                <button
                  onClick={handleClearAll}
                  style={{
                    background: "none", border: "none", cursor: "pointer",
                    fontSize: ".8rem", color: "#ef4444", fontWeight: 600, padding: "2px 6px",
                  }}
                >
                  {t("notif.clearAll")}
                </button>
              )}
            </div>
          </div>

          {/* list */}
          <div style={{ flex: 1, overflowY: "auto" }}>
            {loading ? (
              <div style={{ padding: 24, textAlign: "center" }}>
                <div className="spinner-border spinner-border-sm" style={{ color: PU }} />
              </div>
            ) : notifs.length === 0 ? (
              <div
                style={{
                  padding: "40px 16px", textAlign: "center",
                  color: "var(--bs-secondary-color, #6c757d)",
                }}
              >
                <i
                  className="bi bi-bell-slash"
                  style={{ fontSize: "2rem", display: "block", marginBottom: 8, opacity: .4 }}
                />
                <div style={{ fontSize: ".9rem" }}>{t("notif.empty")}</div>
              </div>
            ) : (
              notifs.map((n) => {
                const m = meta(n.notif_type);
                return (
                  <div
                    key={n.id}
                    style={{
                      display: "flex", alignItems: "flex-start", gap: 10,
                      padding: "10px 14px",
                      borderBottom: "1px solid var(--bs-border-color, #f1f5f9)",
                      background: n.is_read ? "transparent" : PA(".04"),
                      cursor: "default",
                      transition: "background .15s",
                    }}
                    onMouseEnter={e => e.currentTarget.style.background = "var(--bs-tertiary-bg, #f8f9fa)"}
                    onMouseLeave={e => e.currentTarget.style.background = n.is_read ? "transparent" : PA(".04")}
                  >
                    {/* icon */}
                    <div
                      style={{
                        width: 34, height: 34, borderRadius: 10,
                        background: m.bg, flexShrink: 0,
                        display: "flex", alignItems: "center", justifyContent: "center",
                      }}
                    >
                      <i className={`bi ${m.icon}`} style={{ fontSize: "1rem", color: m.color }} />
                    </div>

                    {/* content */}
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 6 }}>
                        <span
                          style={{
                            fontWeight: n.is_read ? 500 : 700,
                            fontSize: ".9rem",
                            color: "var(--bs-body-color)",
                            whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis",
                          }}
                        >
                          {n.title}
                        </span>
                        <span style={{ fontSize: ".75rem", color: "var(--bs-secondary-color, #6c757d)", flexShrink: 0 }}>
                          {n.time_ago}
                        </span>
                      </div>
                      <div
                        style={{
                          fontSize: ".82rem",
                          color: "var(--bs-secondary-color, #6c757d)",
                          marginTop: 2,
                          lineHeight: 1.4,
                          overflow: "hidden",
                          display: "-webkit-box",
                          WebkitLineClamp: 2,
                          WebkitBoxOrient: "vertical",
                        }}
                      >
                        {n.message}
                      </div>
                    </div>

                    {/* actions */}
                    <div style={{ display: "flex", flexDirection: "column", gap: 4, flexShrink: 0 }}>
                      {!n.is_read && (
                        <button
                          title={t("notif.markRead")}
                          onClick={() => handleMarkRead(n.id)}
                          style={{
                            background: "none", border: "none", cursor: "pointer",
                            color: PU, fontSize: ".85rem", padding: 2, lineHeight: 1,
                          }}
                        >
                          <i className="bi bi-check2" />
                        </button>
                      )}
                      <button
                        title={t("notif.delete")}
                        onClick={() => handleDelete(n.id)}
                        style={{
                          background: "none", border: "none", cursor: "pointer",
                          color: "#94a3b8", fontSize: ".85rem", padding: 2, lineHeight: 1,
                        }}
                      >
                        <i className="bi bi-x" />
                      </button>
                    </div>
                  </div>
                );
              })
            )}
          </div>

          {/* footer */}
          <div
            style={{
              padding: "10px 14px",
              borderTop: "1px solid var(--bs-border-color, #e2e8f0)",
              textAlign: "center",
              flexShrink: 0,
            }}
          >
            <NavLink
              to="/notifications"
              onClick={() => setOpen(false)}
              style={{
                fontSize: ".85rem", fontWeight: 600, color: PU,
                textDecoration: "none",
              }}
            >
              {t("notif.viewAll")}
            </NavLink>
          </div>
        </div>
      )}
    </div>
  );
}
