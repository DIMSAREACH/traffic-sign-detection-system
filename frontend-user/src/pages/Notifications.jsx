import { useCallback, useEffect, useRef, useState } from "react";
import Paginator from "../components/Paginator.jsx";
import { useLanguage } from "../i18n/LanguageContext.jsx";
import {
  clearAll,
  deleteNotification,
  listNotifications,
  markAllRead,
  markRead,
} from "../services/notificationService.js";

const PU = "#7c3aed";
const PA = (a) => `rgba(124,58,237,${a})`;
const getPageSize = () => { try { return parseInt(JSON.parse(localStorage.getItem("settings.pageSize"))) || 10; } catch { return 10; } };

const TYPE_META = {
  violation: { icon: "bi-exclamation-triangle-fill", color: "#f59e0b", bg: "rgba(245,158,11,.1)", labelKey: "notif.violation" },
  fine:      { icon: "bi-receipt",                  color: "#3b82f6", bg: "rgba(59,130,246,.1)",  labelKey: "notif.fine"      },
  system:    { icon: "bi-gear-fill",                color: PU,        bg: PA(".1"),               labelKey: "notif.system"    },
  alert:     { icon: "bi-bell-fill",                color: "#ef4444", bg: "rgba(239,68,68,.1)",   labelKey: "notif.alerts"    },
};
const meta = (type) => TYPE_META[type] || TYPE_META.system;

const FILTER_TYPES_KEYS = [
  { key: "",          labelKey: "notif.all"        },
  { key: "violation", labelKey: "notif.violations" },
  { key: "fine",      labelKey: "notif.fines"      },
  { key: "system",    labelKey: "notif.system"     },
  { key: "alert",     labelKey: "notif.alerts"     },
];

const READ_FILTERS_KEYS = [
  { key: "",      labelKey: "notif.all"    },
  { key: "false", labelKey: "notif.unread" },
  { key: "true",  labelKey: "notif.read"   },
];

/* ── helper: pill button ── */
function Pill({ active, onClick, children }) {
  return (
    <button
      onClick={onClick}
      style={{
        background: active ? PU : "var(--bs-body-bg, #fff)",
        color: active ? "#fff" : "var(--bs-body-color, #333)",
        border: `1px solid ${active ? PU : "var(--bs-border-color, #dee2e6)"}`,
        borderRadius: 999, padding: "5px 14px",
        fontSize: ".85rem", fontWeight: active ? 700 : 500,
        cursor: "pointer", transition: "all .15s",
        whiteSpace: "nowrap",
      }}
    >
      {children}
    </button>
  );
}

export default function Notifications() {
  const { t } = useLanguage();
  const [notifs,  setNotifs]  = useState([]);
  const [total,   setTotal]   = useState(0);
  const [page,    setPage]    = useState(1);
  const [loading, setLoading] = useState(true);
  const [search,  setSearch]  = useState("");
  const [typeF,   setTypeF]   = useState("");
  const [readF,   setReadF]   = useState("");
  const debounce = useRef(null);

  /* ── fetch ── */
  const load = useCallback(async (p, s, t, r) => {
    setLoading(true);
    try {
      const params = { page: p, page_size: getPageSize() };
      if (s) params.search = s;
      if (t) params.type = t;
      if (r) params.is_read = r;
      const res = await listNotifications(params);
      setNotifs(res.results ?? res);
      setTotal(res.count ?? (res.results ?? res).length);
    } catch { /* ignore */ }
    setLoading(false);
  }, []);

  useEffect(() => { load(page, search, typeF, readF); }, [page, typeF, readF, load]);

  /* debounced search */
  const onSearch = (val) => {
    setSearch(val);
    clearTimeout(debounce.current);
    debounce.current = setTimeout(() => { setPage(1); load(1, val, typeF, readF); }, 350);
  };

  /* ── actions ── */
  const handleMarkRead = async (id) => {
    await markRead(id).catch(() => {});
    setNotifs(prev => prev.map(n => n.id === id ? { ...n, is_read: true } : n));
  };

  const handleMarkAll = async () => {
    await markAllRead().catch(() => {});
    setNotifs(prev => prev.map(n => ({ ...n, is_read: true })));
  };

  const handleDelete = async (id) => {
    await deleteNotification(id).catch(() => {});
    setNotifs(prev => prev.filter(n => n.id !== id));
    setTotal(t => Math.max(0, t - 1));
    // reload if page becomes empty
    if (notifs.length === 1 && page > 1) {
      const np = page - 1;
      setPage(np);
      load(np, search, typeF, readF);
    }
  };

  const handleClearAll = async () => {
    await clearAll().catch(() => {});
    setNotifs([]);
    setTotal(0);
    setPage(1);
  };

  const unreadCount = notifs.filter(n => !n.is_read).length;

  return (
    <div className="d-flex flex-column gap-3 p-3" style={{ flex: 1, minHeight: 0, overflow: "hidden" }}>

      {/* ── Hero banner ── */}
      <div
        className="rounded-4 d-flex align-items-center justify-content-between px-4 py-3 flex-shrink-0"
        style={{
          background: `linear-gradient(135deg, ${PU} 0%, #4c1d95 100%)`,
          boxShadow: "0 4px 20px rgba(124,58,237,.35)",
        }}
      >
        <div>
          <div className="fw-bold text-white" style={{ fontSize: "1.5rem" }}>
            <i className="bi bi-bell-fill me-2" />{t("notif.title")}
          </div>
          <div style={{ fontSize: "1rem", color: "rgba(255,255,255,.65)", marginTop: ".15rem" }}>
            {t("notif.subtitle")}
          </div>
        </div>
        <div className="d-flex align-items-center gap-2 d-none d-md-flex">
          {unreadCount > 0 && (
            <button
              onClick={handleMarkAll}
              className="btn btn-sm text-white fw-semibold"
              style={{ background: "rgba(255,255,255,.15)", borderRadius: 10, fontSize: ".85rem" }}
            >
              <i className="bi bi-check2-all me-1" />{t("notif.markAllRead")}
            </button>
          )}
          {total > 0 && (
            <button
              onClick={handleClearAll}
              className="btn btn-sm text-white fw-semibold"
              style={{ background: "rgba(255,255,255,.15)", borderRadius: 10, fontSize: ".85rem" }}
            >
              <i className="bi bi-trash3 me-1" />{t("notif.clearAll")}
            </button>
          )}
        </div>
      </div>

      {/* ── Filters row ── */}
      <div className="d-flex flex-wrap align-items-center gap-2 flex-shrink-0">
        {/* search */}
        <div style={{ position: "relative", flex: "1 1 220px", maxWidth: 340 }}>
          <i
            className="bi bi-search"
            style={{ position: "absolute", left: 12, top: "50%", transform: "translateY(-50%)", color: "#94a3b8", fontSize: ".95rem" }}
          />
          <input
            type="text"
            placeholder={t("notif.search")}
            value={search}
            onChange={e => onSearch(e.target.value)}
            className="form-control"
            style={{
              paddingLeft: 36, borderRadius: 12, fontSize: ".95rem",
              border: "1px solid var(--bs-border-color, #dee2e6)",
            }}
          />
        </div>
        {/* type pills */}
        <div className="d-flex gap-1 flex-wrap">
          {FILTER_TYPES_KEYS.map(f => (
            <Pill key={f.key} active={typeF === f.key} onClick={() => { setTypeF(f.key); setPage(1); }}>
              {t(f.labelKey)}
            </Pill>
          ))}
        </div>
        {/* read status pills */}
        <div className="d-flex gap-1 flex-wrap ms-auto">
          {READ_FILTERS_KEYS.map(f => (
            <Pill key={f.key} active={readF === f.key} onClick={() => { setReadF(f.key); setPage(1); }}>
              {t(f.labelKey)}
            </Pill>
          ))}
        </div>
      </div>

      {/* ── Notification list ── */}
      <div className="flex-fill overflow-auto" style={{ minHeight: 0 }}>
        <div className="card border-0 rounded-4" style={{ boxShadow: "0 2px 12px rgba(124,58,237,.07)" }}>
          {loading ? (
            <div className="card-body text-center py-5">
              <div className="spinner-border" style={{ color: PU, width: 28, height: 28 }} />
            </div>
          ) : notifs.length === 0 ? (
            <div className="card-body text-center py-5">
              <i className="bi bi-bell-slash" style={{ fontSize: "2.5rem", color: "#d1d5db" }} />
              <div className="mt-2" style={{ color: "#94a3b8", fontSize: ".95rem" }}>
                {search || typeF || readF ? t("notif.noMatch") : t("notif.empty")}
              </div>
            </div>
          ) : (
            <div className="list-group list-group-flush rounded-4">
              {notifs.map((n) => {
                const m = meta(n.notif_type);
                return (
                  <div
                    key={n.id}
                    className="list-group-item border-0"
                    style={{
                      display: "flex", alignItems: "flex-start", gap: 14,
                      padding: "14px 20px",
                      borderBottom: "1px solid var(--bs-border-color, #f1f5f9)",
                      background: n.is_read ? "transparent" : PA(".03"),
                      transition: "background .15s",
                    }}
                  >
                    {/* icon */}
                    <div
                      style={{
                        width: 40, height: 40, borderRadius: 12,
                        background: m.bg, flexShrink: 0,
                        display: "flex", alignItems: "center", justifyContent: "center",
                      }}
                    >
                      <i className={`bi ${m.icon}`} style={{ fontSize: "1.1rem", color: m.color }} />
                    </div>

                    {/* body */}
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div className="d-flex align-items-center justify-content-between gap-2">
                        <div className="d-flex align-items-center gap-2" style={{ minWidth: 0 }}>
                          <span
                            style={{
                              fontWeight: n.is_read ? 500 : 700,
                              fontSize: ".95rem",
                              color: "var(--bs-body-color)",
                              whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis",
                            }}
                          >
                            {n.title}
                          </span>
                          {!n.is_read && (
                            <span
                              style={{
                                width: 8, height: 8, borderRadius: "50%",
                                background: PU, flexShrink: 0,
                              }}
                            />
                          )}
                        </div>
                        <div className="d-flex align-items-center gap-2 flex-shrink-0">
                          <span
                            className="badge rounded-pill"
                            style={{
                              background: m.bg, color: m.color,
                              fontWeight: 600, fontSize: ".72rem",
                            }}
                          >
                            {t(m.labelKey)}
                          </span>
                          <span style={{ fontSize: ".78rem", color: "var(--bs-secondary-color, #6c757d)" }}>
                            {n.time_ago}
                          </span>
                        </div>
                      </div>
                      <div
                        style={{
                          fontSize: ".88rem",
                          color: "var(--bs-secondary-color, #6c757d)",
                          marginTop: 3, lineHeight: 1.45,
                        }}
                      >
                        {n.message}
                      </div>
                    </div>

                    {/* actions */}
                    <div className="d-flex align-items-center gap-1 flex-shrink-0">
                      {!n.is_read && (
                        <button
                          title={t("notif.markRead")}
                          onClick={() => handleMarkRead(n.id)}
                          className="btn btn-sm"
                          style={{
                            background: PA(".08"), color: PU,
                            borderRadius: 8, fontSize: ".8rem", padding: "3px 8px",
                          }}
                        >
                          <i className="bi bi-check2" />
                        </button>
                      )}
                      <button
                        title={t("notif.delete")}
                        onClick={() => handleDelete(n.id)}
                        className="btn btn-sm"
                        style={{
                          background: "rgba(239,68,68,.08)", color: "#ef4444",
                          borderRadius: 8, fontSize: ".8rem", padding: "3px 8px",
                        }}
                      >
                        <i className="bi bi-trash3" />
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          )}

          {/* paginator */}
          {total > getPageSize() && (
            <div className="card-footer bg-transparent border-0 p-3">
              <Paginator
                page={page}
                total={total}
                pageSize={getPageSize()}
                onChange={setPage}
                loading={loading}
              />
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
