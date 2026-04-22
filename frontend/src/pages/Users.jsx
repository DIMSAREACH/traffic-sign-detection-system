import { useCallback, useEffect, useRef, useState, useMemo } from "react";
import { createPortal } from "react-dom";
import Paginator from "../components/Paginator.jsx";
import { useAuth } from "../context/AuthContext.jsx";
import { useLanguage } from "../i18n/LanguageContext.jsx";
import {
  assignRole, createUser, deleteUser, exportUsersCSV,
  fetchUserStats, listUsers, toggleActive, updateUser,
} from "../services/userService.js";

/* ── theme helpers ─────────────────────────────────────────────────── */
const PU = "#7c3aed";
const PA = (a) => `rgba(124,58,237,${a})`;

/* ── role config ───────────────────────────────────────────────────── */
const ROLES = ["admin", "officer", "driver"];

const ROLE_ICONS = { admin: "bi-shield-fill-check", officer: "bi-person-badge-fill", driver: "bi-car-front-fill" };

function roleStyle(r) {
  if (r === "admin")   return { color: PU,        bg: PA(0.13),   label: "Admin"   };
  if (r === "officer") return { color: "#2563eb",  bg: "rgba(37,99,235,.12)",  label: "Officer" };
  return                      { color: "#16a34a",  bg: "rgba(22,163,74,.12)",  label: "Driver"  };
}

/* ── Custom Role Dropdown ──────────────────────────────────────────── */
function RoleDropdown({ value, onChange, disabled, size = "sm" }) {
  const [open, setOpen] = useState(false);
  const ref = useRef(null);
  const btnRef = useRef(null);
  const [pos, setPos] = useState({ top: 0, left: 0 });

  useEffect(() => {
    const close = (e) => { if (ref.current && !ref.current.contains(e.target) && btnRef.current && !btnRef.current.contains(e.target)) setOpen(false); };
    document.addEventListener("mousedown", close);
    return () => document.removeEventListener("mousedown", close);
  }, []);

  useEffect(() => {
    if (open && btnRef.current) {
      const rect = btnRef.current.getBoundingClientRect();
      setPos({ top: rect.bottom + 4, left: rect.left });
    }
  }, [open]);

  const current = roleStyle(value || "driver");
  const isLg = size === "lg";

  const menu = open && createPortal(
    <div ref={ref} style={{
      position: "fixed", top: pos.top, left: pos.left, zIndex: 9999,
      background: "var(--card-bg, #fff)", borderRadius: 12,
      boxShadow: "0 8px 30px rgba(0,0,0,.18)", border: "1px solid var(--border-color, #e2e8f0)",
      minWidth: isLg ? 180 : 150, overflow: "hidden",
      animation: "fadeIn .12s ease",
    }}>
      {ROLES.map(r => {
        const s = roleStyle(r);
        const isSelected = r === value;
        return (
          <button
            key={r}
            type="button"
            onClick={() => { onChange(r); setOpen(false); }}
            style={{
              display: "flex", alignItems: "center", gap: 10, width: "100%",
              padding: "10px 14px", border: "none", cursor: "pointer",
              background: isSelected ? s.bg : "transparent",
              color: isSelected ? s.color : "var(--text-color, #1e293b)",
              fontSize: ".85rem", fontWeight: isSelected ? 700 : 500,
              transition: "background .1s", textAlign: "left",
            }}
            onMouseEnter={e => { if (!isSelected) e.currentTarget.style.background = "var(--row-hover, rgba(124,58,237,.04))"; }}
            onMouseLeave={e => { if (!isSelected) e.currentTarget.style.background = "transparent"; }}
          >
            <span style={{
              width: 30, height: 30, borderRadius: 8,
              background: s.bg, display: "flex", alignItems: "center", justifyContent: "center",
              flexShrink: 0,
            }}>
              <i className={`bi ${ROLE_ICONS[r]}`} style={{ fontSize: ".85rem", color: s.color }} />
            </span>
            <span>{s.label}</span>
            {isSelected && <i className="bi bi-check2" style={{ marginLeft: "auto", color: s.color, fontSize: "1rem" }} />}
          </button>
        );
      })}
    </div>,
    document.body
  );

  return (
    <div style={{ position: "relative", display: "inline-block" }}>
      <button
        ref={btnRef}
        type="button"
        disabled={disabled}
        onClick={() => setOpen(o => !o)}
        style={{
          display: "inline-flex", alignItems: "center", gap: isLg ? 8 : 5,
          background: current.bg, color: current.color,
          border: `1.5px solid ${current.color}30`,
          borderRadius: isLg ? 10 : 20, padding: isLg ? "9px 14px" : "4px 10px 4px 8px",
          fontSize: isLg ? ".875rem" : ".72rem", fontWeight: 700,
          cursor: disabled ? "not-allowed" : "pointer", outline: "none",
          opacity: disabled ? 0.5 : 1, transition: "all .15s",
          letterSpacing: isLg ? 0 : ".05em", textTransform: isLg ? "none" : "uppercase",
        }}
      >
        <i className={`bi ${ROLE_ICONS[value] || ROLE_ICONS.driver}`} style={{ fontSize: isLg ? ".95rem" : ".7rem" }} />
        {current.label}
        <i className="bi bi-chevron-down" style={{ fontSize: ".6rem", marginLeft: 2, transition: "transform .2s", transform: open ? "rotate(180deg)" : "none" }} />
      </button>
      {menu}
    </div>
  );
}

/* ── small components ──────────────────────────────────────────────── */
function RoleBadge({ role }) {
  const s = roleStyle(role || "officer");
  return (
    <span style={{
      display: "inline-flex", alignItems: "center", gap: 5,
      background: s.bg, color: s.color,
      borderRadius: 20, padding: "3px 11px",
      fontSize: ".72rem", fontWeight: 700, letterSpacing: ".05em",
      textTransform: "uppercase", whiteSpace: "nowrap",
    }}>
      <span style={{ width: 6, height: 6, borderRadius: "50%", background: s.color }} />
      {s.label}
    </span>
  );
}

function StatusBadge({ active }) {
  const { t } = useLanguage();
  return (
    <span style={{
      display: "inline-flex", alignItems: "center", gap: 5,
      background: active ? "rgba(22,163,74,.12)" : "rgba(239,68,68,.10)",
      color:      active ? "#16a34a"              : "#ef4444",
      borderRadius: 20, padding: "3px 11px",
      fontSize: ".72rem", fontWeight: 700, letterSpacing: ".05em",
    }}>
      <span style={{ width: 6, height: 6, borderRadius: "50%",
        background: active ? "#16a34a" : "#ef4444" }} />
      {active ? t("usr.active") : t("usr.inactive")}
    </span>
  );
}

function Avatar({ user }) {
  const initial = (user.first_name?.[0] || user.username?.[0] || user.email?.[0] || "U").toUpperCase();
  const s = roleStyle(user.role || "officer");
  return (
    <div style={{
      width: 38, height: 38, borderRadius: "50%",
      background: s.bg, border: `2px solid ${s.color}40`,
      display: "flex", alignItems: "center", justifyContent: "center",
      fontWeight: 700, fontSize: ".9rem", color: s.color, flexShrink: 0,
      overflow: "hidden",
    }}>
      {user.avatar_url
        ? <img src={user.avatar_url} alt="" style={{ width: "100%", height: "100%", objectFit: "cover" }} />
        : initial}
    </div>
  );
}

function SkeletonRow() {
  return (
    <tr>
      {[40, 200, 100, 90, 100, 90, 120].map((w, i) => (
        <td key={i} style={{ padding: "14px 16px" }}>
          <div style={{
            width: w, height: 14, borderRadius: 7,
            background: "var(--skeleton-bg, rgba(124,58,237,.08))",
            animation: "pulse 1.5s ease-in-out infinite",
          }} />
        </td>
      ))}
    </tr>
  );
}

/* ── confirm modal ────────────────────────────────────────────────── */
function ConfirmModal({ user, onConfirm, onCancel }) {
  const { t } = useLanguage();
  return (
    <div style={{
      position: "fixed", inset: 0, zIndex: 1000,
      background: "rgba(0,0,0,.55)", backdropFilter: "blur(4px)",
      display: "flex", alignItems: "center", justifyContent: "center",
    }}>
      <div style={{
        background: "var(--card-bg, #fff)", borderRadius: 16,
        padding: "2rem", maxWidth: 400, width: "90%",
        boxShadow: "0 20px 60px rgba(0,0,0,.3)",
        border: "1px solid rgba(239,68,68,.2)",
      }}>
        <div style={{ textAlign: "center", marginBottom: "1.5rem" }}>
          <div style={{
            width: 56, height: 56, borderRadius: "50%",
            background: "rgba(239,68,68,.1)", margin: "0 auto 1rem",
            display: "flex", alignItems: "center", justifyContent: "center",
          }}>
            <i className="bi bi-trash3-fill" style={{ fontSize: "1.4rem", color: "#ef4444" }} />
          </div>
          <h3 style={{ margin: "0 0 .5rem", fontSize: "1.1rem", fontWeight: 700 }}>{t("usr.deleteTitle")}</h3>
          <p style={{ margin: 0, color: "var(--text-muted, #64748b)", fontSize: ".9rem" }}>
            {t("usr.deleteConfirm")} <strong>{user.first_name || user.username}</strong>
          </p>
        </div>
        <div style={{ display: "flex", gap: 10, justifyContent: "center" }}>
          <button onClick={onCancel} style={{
            flex: 1, padding: "10px 20px", borderRadius: 10, border: "1px solid var(--border-color, #e2e8f0)",
            background: "transparent", color: "var(--text-color, #1e293b)",
            fontWeight: 600, cursor: "pointer", fontSize: ".9rem",
          }}>{t("common.cancel")}</button>
          <button onClick={onConfirm} style={{
            flex: 1, padding: "10px 20px", borderRadius: 10, border: "none",
            background: "#ef4444", color: "#fff",
            fontWeight: 600, cursor: "pointer", fontSize: ".9rem",
          }}>{t("usr.delete")}</button>
        </div>
      </div>
    </div>
  );
}

/* ── modal backdrop helper ────────────────────────────────────────── */
const modalBackdrop = {
  position: "fixed", inset: 0, zIndex: 1000,
  background: "rgba(0,0,0,.55)", backdropFilter: "blur(4px)",
  display: "flex", alignItems: "center", justifyContent: "center",
};
const modalCard = {
  background: "var(--card-bg, #fff)", borderRadius: 16,
  padding: "2rem", maxWidth: 520, width: "92%",
  boxShadow: "0 20px 60px rgba(0,0,0,.3)",
  border: `1px solid ${PA(0.15)}`,
  maxHeight: "90vh", overflowY: "auto",
};
const inputStyle = {
  width: "100%", padding: "10px 14px", borderRadius: 10,
  border: "1.5px solid var(--border-color, #e2e8f0)",
  background: "var(--input-bg, #f8faff)", color: "var(--text-color, #1e293b)",
  fontSize: ".875rem", outline: "none", boxSizing: "border-box",
};
const fieldLabel = {
  display: "block", marginBottom: 4, fontSize: ".78rem",
  fontWeight: 600, color: "var(--text-muted, #64748b)",
};

/* ── Create User modal ────────────────────────────────────────────── */
function CreateUserModal({ onCreated, onCancel }) {
  const { t } = useLanguage();
  const [form, setForm] = useState({ email: "", username: "", password: "", first_name: "", last_name: "", phone: "", role: "driver" });
  const [saving, setSaving] = useState(false);
  const [error, setError]   = useState("");
  const [showPw, setShowPw] = useState(false);
  const [pwFocus, setPwFocus] = useState(false);
  const set = (k, v) => setForm(f => ({ ...f, [k]: v }));

  /* ── password strength ── */
  const PW_RULES = [
    { key: "len",   test: p => p.length >= 8,          label: t("pwd.ruleLen") },
    { key: "upper", test: p => /[A-Z]/.test(p),        label: t("pwd.ruleUpper") },
    { key: "num",   test: p => /[0-9]/.test(p),        label: t("pwd.ruleNum") },
    { key: "spec",  test: p => /[^A-Za-z0-9]/.test(p), label: t("pwd.ruleSpec") },
  ];
  const pwChecks  = PW_RULES.map(r => ({ ...r, ok: r.test(form.password) }));
  const pwScore   = pwChecks.filter(r => r.ok).length;
  const PW_META   = [
    { label: "",                   color: "#e5e7eb" },
    { label: t("pwd.weak"),        color: "#ef4444" },
    { label: t("pwd.fair"),        color: "#f97316" },
    { label: t("pwd.good"),        color: "#eab308" },
    { label: t("pwd.strong"),      color: "#22c55e" },
  ];
  const pwMeta = PW_META[pwScore];

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!form.email || !form.username || !form.password) {
      setError(t("usr.createRequired"));
      return;
    }
    if (pwScore < 3) {
      setError(t("pwd.tooWeak"));
      return;
    }
    setSaving(true);
    setError("");
    try {
      const user = await createUser(form);
      onCreated(user);
    } catch (err) {
      setError(err?.response?.data?.detail || t("usr.createFailed"));
    } finally {
      setSaving(false);
    }
  };

  return (
    <div style={modalBackdrop}>
      <div style={modalCard}>
        <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: "1.5rem" }}>
          <div style={{
            width: 44, height: 44, borderRadius: 12,
            background: PA(0.1), display: "flex", alignItems: "center", justifyContent: "center",
          }}>
            <i className="bi bi-person-fill-add" style={{ fontSize: "1.2rem", color: PU }} />
          </div>
          <div>
            <h3 style={{ margin: 0, fontSize: "1.1rem", fontWeight: 700 }}>{t("usr.createTitle")}</h3>
            <p style={{ margin: 0, fontSize: ".8rem", color: "var(--text-muted, #64748b)" }}>{t("usr.createSubtitle")}</p>
          </div>
        </div>

        {error && (
          <div style={{ background: "rgba(239,68,68,.1)", color: "#ef4444", borderRadius: 10, padding: "10px 14px", marginBottom: 12, fontSize: ".85rem", fontWeight: 600 }}>
            <i className="bi bi-exclamation-circle-fill me-2" />{error}
          </div>
        )}

        <form onSubmit={handleSubmit}>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12, marginBottom: 12 }}>
            <div>
              <label style={fieldLabel}>{t("usr.fieldFirstName")}</label>
              <input style={inputStyle} value={form.first_name} onChange={e => set("first_name", e.target.value)} />
            </div>
            <div>
              <label style={fieldLabel}>{t("usr.fieldLastName")}</label>
              <input style={inputStyle} value={form.last_name} onChange={e => set("last_name", e.target.value)} />
            </div>
          </div>
          <div style={{ marginBottom: 12 }}>
            <label style={fieldLabel}>{t("usr.colEmail")} *</label>
            <input style={inputStyle} type="email" required value={form.email} onChange={e => set("email", e.target.value)} />
          </div>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12, marginBottom: 12 }}>
            <div>
              <label style={fieldLabel}>{t("usr.fieldUsername")} *</label>
              <input style={inputStyle} required value={form.username} onChange={e => set("username", e.target.value)} />
            </div>
            <div>
              <label style={fieldLabel}>{t("usr.fieldPassword")} *</label>
              <div style={{ position: "relative" }}>
                <input style={{ ...inputStyle, paddingRight: 38 }} type={showPw ? "text" : "password"} required value={form.password} onChange={e => set("password", e.target.value)} onFocus={() => setPwFocus(true)} onBlur={() => setPwFocus(false)} />
                <button
                  type="button"
                  onClick={() => setShowPw(p => !p)}
                  style={{
                    position: "absolute", right: 10, top: "50%", transform: "translateY(-50%)",
                    background: "none", border: "none", cursor: "pointer", padding: 0,
                    color: showPw ? PU : "var(--text-muted, #94a3b8)", fontSize: "1rem",
                    display: "flex", alignItems: "center",
                  }}
                  tabIndex={-1}
                >
                  <i className={`bi ${showPw ? "bi-eye-fill" : "bi-eye-slash-fill"}`} />
                </button>
              </div>
            </div>
          </div>

          {/* password strength bar + checklist */}
          {form.password.length > 0 && (
            <div style={{ marginBottom: 12 }}>
              <div style={{ display: "flex", gap: 4, marginBottom: 4 }}>
                {[1, 2, 3, 4].map(i => (
                  <div key={i} style={{
                    flex: 1, height: 4, borderRadius: 2,
                    background: i <= pwScore ? pwMeta.color : "var(--border-color, #e2e8f0)",
                    transition: "background .2s",
                  }} />
                ))}
              </div>
              {pwMeta.label && (
                <span style={{ fontSize: ".75rem", fontWeight: 600, color: pwMeta.color }}>{pwMeta.label}</span>
              )}
            </div>
          )}
          {(pwFocus || form.password.length > 0) && (
            <ul style={{ listStyle: "none", padding: 0, margin: "0 0 12px", display: "grid", gridTemplateColumns: "1fr 1fr", gap: "2px 8px" }}>
              {pwChecks.map(r => (
                <li key={r.key} style={{
                  fontSize: ".78rem", display: "flex", alignItems: "center", gap: 6,
                  color: r.ok ? "#22c55e" : "var(--text-muted, #94a3b8)",
                  transition: "color .2s",
                }}>
                  <i className={`bi ${r.ok ? "bi-check-circle-fill" : "bi-circle"}`} style={{ fontSize: ".7rem" }} />
                  {r.label}
                </li>
              ))}
            </ul>
          )}

          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12, marginBottom: 16 }}>
            <div>
              <label style={fieldLabel}>{t("usr.fieldPhone")}</label>
              <input style={inputStyle} value={form.phone} onChange={e => set("phone", e.target.value)} />
            </div>
            <div>
              <label style={fieldLabel}>{t("usr.colRole")}</label>
              <RoleDropdown value={form.role} onChange={(r) => set("role", r)} size="lg" />
            </div>
          </div>
          <div style={{ display: "flex", gap: 10 }}>
            <button type="button" onClick={onCancel} style={{
              flex: 1, padding: "10px 20px", borderRadius: 10, border: "1px solid var(--border-color, #e2e8f0)",
              background: "transparent", color: "var(--text-color, #1e293b)",
              fontWeight: 600, cursor: "pointer", fontSize: ".9rem",
            }}>{t("common.cancel")}</button>
            <button type="submit" disabled={saving} style={{
              flex: 1, padding: "10px 20px", borderRadius: 10, border: "none",
              background: PU, color: "#fff", fontWeight: 600, cursor: "pointer", fontSize: ".9rem",
              opacity: saving ? 0.6 : 1,
            }}>{saving ? t("common.saving") : t("usr.createBtn")}</button>
          </div>
        </form>
      </div>
    </div>
  );
}

/* ── Edit User modal ──────────────────────────────────────────────── */
function EditUserModal({ user, onUpdated, onCancel }) {
  const { t } = useLanguage();
  const [form, setForm] = useState({
    first_name: user.first_name || "",
    last_name:  user.last_name  || "",
    phone:      user.phone      || "",
    username:   user.username    || "",
  });
  const [saving, setSaving] = useState(false);
  const [error, setError]   = useState("");
  const set = (k, v) => setForm(f => ({ ...f, [k]: v }));

  const handleSubmit = async (e) => {
    e.preventDefault();
    setSaving(true);
    setError("");
    try {
      const updated = await updateUser(user.id, form);
      onUpdated(updated);
    } catch (err) {
      setError(err?.response?.data?.detail || t("usr.editFailed"));
    } finally {
      setSaving(false);
    }
  };

  return (
    <div style={modalBackdrop}>
      <div style={modalCard}>
        <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: "1.5rem" }}>
          <div style={{
            width: 44, height: 44, borderRadius: 12,
            background: PA(0.1), display: "flex", alignItems: "center", justifyContent: "center",
          }}>
            <i className="bi bi-pencil-square" style={{ fontSize: "1.2rem", color: PU }} />
          </div>
          <div>
            <h3 style={{ margin: 0, fontSize: "1.1rem", fontWeight: 700 }}>{t("usr.editTitle")}</h3>
            <p style={{ margin: 0, fontSize: ".8rem", color: "var(--text-muted, #64748b)" }}>
              {user.email}
            </p>
          </div>
        </div>

        {error && (
          <div style={{ background: "rgba(239,68,68,.1)", color: "#ef4444", borderRadius: 10, padding: "10px 14px", marginBottom: 12, fontSize: ".85rem", fontWeight: 600 }}>
            <i className="bi bi-exclamation-circle-fill me-2" />{error}
          </div>
        )}

        <form onSubmit={handleSubmit}>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12, marginBottom: 12 }}>
            <div>
              <label style={fieldLabel}>{t("usr.fieldFirstName")}</label>
              <input style={inputStyle} value={form.first_name} onChange={e => set("first_name", e.target.value)} />
            </div>
            <div>
              <label style={fieldLabel}>{t("usr.fieldLastName")}</label>
              <input style={inputStyle} value={form.last_name} onChange={e => set("last_name", e.target.value)} />
            </div>
          </div>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12, marginBottom: 12 }}>
            <div>
              <label style={fieldLabel}>{t("usr.fieldUsername")}</label>
              <input style={inputStyle} value={form.username} onChange={e => set("username", e.target.value)} />
            </div>
            <div>
              <label style={fieldLabel}>{t("usr.fieldPhone")}</label>
              <input style={inputStyle} value={form.phone} onChange={e => set("phone", e.target.value)} />
            </div>
          </div>

          {/* Read-only info */}
          <div style={{
            background: "var(--input-bg, #f8faff)", borderRadius: 10,
            padding: "12px 14px", marginBottom: 16,
            border: "1px solid var(--border-color, #e2e8f0)",
          }}>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8, fontSize: ".82rem" }}>
              <div>
                <span style={{ color: "var(--text-muted, #94a3b8)" }}>{t("usr.colRole")}:</span>{" "}
                <strong style={{ color: "var(--text-color)" }}>{(user.role || "driver").charAt(0).toUpperCase() + (user.role || "driver").slice(1)}</strong>
              </div>
              <div>
                <span style={{ color: "var(--text-muted, #94a3b8)" }}>{t("usr.colStatus")}:</span>{" "}
                <strong style={{ color: user.is_active ? "#16a34a" : "#ef4444" }}>{user.is_active ? t("usr.active") : t("usr.inactive")}</strong>
              </div>
              <div>
                <span style={{ color: "var(--text-muted, #94a3b8)" }}>{t("usr.colJoined")}:</span>{" "}
                <span style={{ color: "var(--text-color)" }}>{user.date_joined ? new Date(user.date_joined).toLocaleDateString() : "—"}</span>
              </div>
              <div>
                <span style={{ color: "var(--text-muted, #94a3b8)" }}>{t("usr.colLastLogin")}:</span>{" "}
                <span style={{ color: "var(--text-color)" }}>{user.last_login ? new Date(user.last_login).toLocaleString() : "—"}</span>
              </div>
            </div>
          </div>

          <div style={{ display: "flex", gap: 10 }}>
            <button type="button" onClick={onCancel} style={{
              flex: 1, padding: "10px 20px", borderRadius: 10, border: "1px solid var(--border-color, #e2e8f0)",
              background: "transparent", color: "var(--text-color, #1e293b)",
              fontWeight: 600, cursor: "pointer", fontSize: ".9rem",
            }}>{t("common.cancel")}</button>
            <button type="submit" disabled={saving} style={{
              flex: 1, padding: "10px 20px", borderRadius: 10, border: "none",
              background: PU, color: "#fff", fontWeight: 600, cursor: "pointer", fontSize: ".9rem",
              opacity: saving ? 0.6 : 1,
            }}>{saving ? t("common.saving") : t("usr.saveChanges")}</button>
          </div>
        </form>
      </div>
    </div>
  );
}

/* ─────────────────────────────────────────────────────────────────── */
export default function Users() {
  const { user: me } = useAuth();
  const { t } = useLanguage();

  const [users,        setUsers]        = useState([]);
  const [loading,      setLoading]      = useState(true);
  const [search,       setSearch]       = useState("");
  const [roleFilter,   setRoleFilter]   = useState("all");
  const [statusFilter, setStatusFilter] = useState("all");
  const [toast,        setToast]        = useState(null);
  const [confirm,      setConfirm]      = useState(null);
  const [busy,         setBusy]         = useState({});
  const [showCreate,   setShowCreate]   = useState(false);
  const [editUser,     setEditUser]     = useState(null);
  const searchTimer = useRef(null);

  const [stats, setStats] = useState({ total: 0, admin: 0, officer: 0, driver: 0, inactive: 0 });
  const [page,  setPage]  = useState(1);
  const [total, setTotal] = useState(0);

  /* ── load stats from backend ───────────────────────────────── */
  const loadStats = useCallback(async () => {
    try {
      const s = await fetchUserStats();
      setStats(s);
    } catch { /* stats are optional */ }
  }, []);

  const load = useCallback(async (q = search, rf = roleFilter, sf = statusFilter, pg = 1) => {
    setLoading(true);
    try {
      const params = { page: pg, page_size: 10 };
      if (q)            params.search = q;
      if (rf !== "all") params.role   = rf;
      if (sf !== "all") params.status = sf;
      const data = await listUsers(params);
      const list = Array.isArray(data) ? data : (data.results ?? []);
      setUsers(list);
      setTotal(Array.isArray(data) ? data.length : (data.count ?? list.length));
    } catch {
      showToast(t("usr.loadFailed"), "error");
    } finally {
      setLoading(false);
    }
  }, []); // eslint-disable-line

  useEffect(() => {
    load("", "all", "all", 1);
    loadStats();
  }, []); // eslint-disable-line

  /* Listen for cross-page sync (e.g. Drivers page mutated data) */
  useEffect(() => {
    const onSync = () => { load(search, roleFilter, statusFilter, page); loadStats(); };
    window.addEventListener("users-changed", onSync);
    return () => window.removeEventListener("users-changed", onSync);
  }); // runs every render to capture latest closures

  const isFirstRender = useRef(true);
  useEffect(() => {
    if (isFirstRender.current) { isFirstRender.current = false; return; }
    setPage(1);
    load(search, roleFilter, statusFilter, 1);
  }, [roleFilter, statusFilter]); // eslint-disable-line

  const prevPage = useRef(1);
  useEffect(() => {
    if (prevPage.current === page) return;
    prevPage.current = page;
    load(search, roleFilter, statusFilter, page);
  }, [page]); // eslint-disable-line

  /* debounced search */
  const handleSearch = (val) => {
    setSearch(val);
    clearTimeout(searchTimer.current);
    searchTimer.current = setTimeout(() => {
      setPage(1);
      load(val, roleFilter, statusFilter, 1);
    }, 350);
  };

  /* ── toast ─────────────────────────────────────────────────── */
  const showToast = (msg, type = "success") => {
    setToast({ msg, type });
    setTimeout(() => setToast(null), 3000);
  };

  /* ── actions ───────────────────────────────────────────────── */
  const handleRoleChange = async (userId, role) => {
    setBusy(b => ({ ...b, [userId]: true }));
    try {
      const updated = await assignRole(userId, role);
      setUsers(u => u.map(x => x.id === userId ? updated : x));
      loadStats();
      showToast(`${t("usr.roleUpdated")} ${role}`);
      window.dispatchEvent(new Event("users-changed"));
    } catch {
      showToast(t("usr.roleFailed"), "error");
    } finally {
      setBusy(b => ({ ...b, [userId]: false }));
    }
  };

  const handleToggleActive = async (userId) => {
    setBusy(b => ({ ...b, [userId]: true }));
    try {
      const updated = await toggleActive(userId);
      setUsers(u => u.map(x => x.id === userId ? updated : x));
      loadStats();
      showToast(updated.is_active ? t("usr.activated") : t("usr.deactivated"));
      window.dispatchEvent(new Event("users-changed"));
    } catch (e) {
      showToast(e?.response?.data?.detail || t("usr.toggleFailed"), "error");
    } finally {
      setBusy(b => ({ ...b, [userId]: false }));
    }
  };

  const handleDelete = async () => {
    if (!confirm) return;
    setBusy(b => ({ ...b, [confirm.id]: true }));
    try {
      await deleteUser(confirm.id);
      const newTotal = total - 1;
      const maxPage = Math.max(1, Math.ceil(newTotal / 10));
      const targetPage = page > maxPage ? maxPage : page;
      setUsers(u => u.filter(x => x.id !== confirm.id));
      setTotal(newTotal);
      if (targetPage !== page) setPage(targetPage);
      else load(search, roleFilter, statusFilter, targetPage);
      loadStats();
      showToast(t("usr.deleted"));
      window.dispatchEvent(new Event("users-changed"));
    } catch {
      showToast(t("usr.deleteFailed"), "error");
    } finally {
      setBusy(b => ({ ...b, [confirm.id]: false }));
      setConfirm(null);
    }
  };

  const handleCreated = (user) => {
    setShowCreate(false);
    showToast(t("usr.created"));
    // Add the new user to the list immediately so it appears without a refresh
    setUsers(prev => [user, ...prev]);
    setTotal(prev => prev + 1);
    // Also refresh stats & list from backend in the background
    loadStats();
    load(search, roleFilter, statusFilter, 1);
    setPage(1);
    window.dispatchEvent(new Event("users-changed"));
  };

  const handleUpdated = (updated) => {
    setEditUser(null);
    setUsers(u => u.map(x => x.id === updated.id ? updated : x));
    showToast(t("usr.editSaved"));
    window.dispatchEvent(new Event("users-changed"));
  };

  const handleExport = async () => {
    try {
      await exportUsersCSV();
      showToast(t("usr.exported"));
    } catch {
      showToast(t("usr.exportFailed"), "error");
    }
  };

  /* ── KPI data ──────────────────────────────────────────────── */
  const kpis = [
    { label: t("usr.totalUsers"),   value: stats.total,    icon: "bi-people-fill",        color: PU,        bg: PA(0.1)              },
    { label: t("usr.admins"),        value: stats.admin,    icon: "bi-shield-fill-check",  color: PU,        bg: PA(0.1)              },
    { label: t("usr.officers"),      value: stats.officer,  icon: "bi-person-badge-fill",  color: "#2563eb", bg: "rgba(37,99,235,.1)" },
    { label: t("usr.drivers"),       value: stats.driver,   icon: "bi-car-front-fill",     color: "#16a34a", bg: "rgba(22,163,74,.1)" },
    { label: t("usr.inactiveLabel"), value: stats.inactive, icon: "bi-person-fill-slash",  color: "#ef4444", bg: "rgba(239,68,68,.1)" },
  ];

  const ROLE_FILTERS = [
    { key: "all",     label: t("usr.all") },
    { key: "admin",   label: t("usr.admins") },
    { key: "officer", label: t("usr.officers") },
    { key: "driver",  label: t("usr.drivers") },
  ];

  const STATUS_FILTERS = [
    { key: "all",      label: t("usr.all") },
    { key: "active",   label: t("usr.active") },
    { key: "inactive", label: t("usr.inactive") },
  ];

  return (
    <div style={{ minHeight: "100vh", background: "var(--page-bg, #f8faff)" }}>

      {/* ── Hero banner ─────────────────────────────────────────── */}
      <div style={{
        background: "linear-gradient(135deg, #1e0a40 0%, #3b1080 60%, #5b21b6 100%)",
        borderRadius: "0 0 28px 28px",
        padding: "2rem 2rem 2.5rem",
        marginBottom: "2rem",
        position: "relative", overflow: "hidden",
      }}>
        {[["-60px", "-60px", 220], ["60%", "-80px", 300], ["80%", "20px", 150]].map(([l, t, s], i) => (
          <div key={i} style={{
            position: "absolute", left: l, top: t,
            width: s, height: s, borderRadius: "50%",
            background: "rgba(255,255,255,.04)", pointerEvents: "none",
          }} />
        ))}

        <div style={{ position: "relative", zIndex: 1, display: "flex", alignItems: "flex-start", justifyContent: "space-between", flexWrap: "wrap", gap: "1rem" }}>
          <div>
            <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 6 }}>
              <div style={{
                width: 44, height: 44, borderRadius: 14,
                background: PA(0.25), border: `1.5px solid ${PA(0.5)}`,
                display: "flex", alignItems: "center", justifyContent: "center",
              }}>
                <i className="bi bi-people-fill" style={{ fontSize: "1.3rem", color: "#c4b5fd" }} />
              </div>
              <div>
                <h1 style={{ margin: 0, fontSize: "1.5rem", fontWeight: 800, color: "#fff" }}>
                  {t("usr.title")}
                </h1>
                <p style={{ margin: 0, color: "rgba(255,255,255,.6)", fontSize: ".85rem" }}>
                  {t("usr.subtitle")}
                </p>
              </div>
            </div>
          </div>
          <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
            <button onClick={handleExport} style={{
              display: "flex", alignItems: "center", gap: 8,
              background: PA(0.2), border: `1px solid ${PA(0.5)}`,
              color: "#c4b5fd", borderRadius: 10, padding: "9px 18px",
              fontWeight: 600, cursor: "pointer", fontSize: ".85rem",
            }}>
              <i className="bi bi-download" /> {t("usr.export")}
            </button>
            <button onClick={() => setShowCreate(true)} style={{
              display: "flex", alignItems: "center", gap: 8,
              background: "#fff", border: "none",
              color: PU, borderRadius: 10, padding: "9px 18px",
              fontWeight: 700, cursor: "pointer", fontSize: ".85rem",
            }}>
              <i className="bi bi-person-fill-add" /> {t("usr.addUser")}
            </button>
            <button
              onClick={() => { load(search, roleFilter, statusFilter, page); loadStats(); }}
              style={{
                display: "flex", alignItems: "center", gap: 8,
                background: PA(0.2), border: `1px solid ${PA(0.5)}`,
                color: "#c4b5fd", borderRadius: 10, padding: "9px 18px",
                fontWeight: 600, cursor: "pointer", fontSize: ".85rem",
              }}
            >
              <i className="bi bi-arrow-clockwise" /> {t("usr.refresh")}
            </button>
          </div>
        </div>
      </div>

      <div style={{ padding: "0 2rem 2rem" }}>

        {/* ── KPI cards ─────────────────────────────────────────── */}
        <div style={{
          display: "grid",
          gridTemplateColumns: "repeat(auto-fit, minmax(160px, 1fr))",
          gap: "1rem", marginBottom: "1.5rem",
        }}>
          {kpis.map(k => (
            <div key={k.label} style={{
              background: "var(--card-bg, #fff)",
              borderRadius: 14, padding: "1.2rem 1rem",
              boxShadow: "0 2px 12px rgba(0,0,0,.06)",
              border: "1px solid var(--border-color, #f1f5f9)",
              borderTop: `3px solid ${k.color}`,
              display: "flex", alignItems: "center", gap: 14,
            }}>
              <div style={{
                width: 44, height: 44, borderRadius: 12,
                background: k.bg, flexShrink: 0,
                display: "flex", alignItems: "center", justifyContent: "center",
              }}>
                <i className={`bi ${k.icon}`} style={{ fontSize: "1.25rem", color: k.color }} />
              </div>
              <div>
                <div style={{ fontSize: "1.6rem", fontWeight: 800, lineHeight: 1, color: "var(--text-color, #1e293b)" }}>
                  {k.value}
                </div>
                <div style={{ fontSize: ".75rem", color: "var(--text-muted, #64748b)", marginTop: 2 }}>
                  {k.label}
                </div>
              </div>
            </div>
          ))}
        </div>

        {/* ── Filters ────────────────────────────────────────────── */}
        <div style={{
          background: "var(--card-bg, #fff)",
          borderRadius: 14, padding: "1rem 1.25rem",
          boxShadow: "0 2px 12px rgba(0,0,0,.06)",
          border: "1px solid var(--border-color, #f1f5f9)",
          marginBottom: "1rem",
          display: "flex", alignItems: "center", flexWrap: "wrap", gap: "1rem",
        }}>
          {/* search */}
          <div style={{ position: "relative", flex: "1 1 220px", minWidth: 200 }}>
            <i className="bi bi-search" style={{
              position: "absolute", left: 12, top: "50%", transform: "translateY(-50%)",
              color: "var(--text-muted, #94a3b8)", fontSize: ".9rem",
            }} />
            <input
              type="text"
              placeholder={t("usr.searchPlaceholder")}
              value={search}
              onChange={e => handleSearch(e.target.value)}
              style={{
                width: "100%", padding: "9px 12px 9px 36px",
                borderRadius: 10, border: "1.5px solid var(--border-color, #e2e8f0)",
                background: "var(--input-bg, #f8faff)",
                color: "var(--text-color, #1e293b)",
                fontSize: ".875rem", outline: "none", boxSizing: "border-box",
              }}
            />
          </div>

          {/* role pills */}
          <div style={{ display: "flex", gap: 6 }}>
            {ROLE_FILTERS.map(f => (
              <button
                key={f.key}
                onClick={() => setRoleFilter(f.key)}
                style={{
                  padding: "7px 16px", borderRadius: 20,
                  border: `1.5px solid ${roleFilter === f.key ? PU : "var(--border-color, #e2e8f0)"}`,
                  background: roleFilter === f.key ? PA(0.1) : "transparent",
                  color: roleFilter === f.key ? PU : "var(--text-muted, #64748b)",
                  fontWeight: 600, cursor: "pointer", fontSize: ".825rem",
                  transition: "all .15s",
                }}
              >
                {f.label}
              </button>
            ))}
          </div>

          {/* status pills */}
          <div style={{ display: "flex", gap: 6 }}>
            {STATUS_FILTERS.map(f => {
              const isActive = statusFilter === f.key;
              const dotColor = f.key === "active" ? "#16a34a" : f.key === "inactive" ? "#ef4444" : "var(--text-muted, #94a3b8)";
              return (
                <button
                  key={f.key}
                  onClick={() => setStatusFilter(f.key)}
                  style={{
                    padding: "7px 14px", borderRadius: 20,
                    border: `1.5px solid ${isActive ? dotColor : "var(--border-color, #e2e8f0)"}`,
                    background: isActive ? (f.key === "active" ? "rgba(22,163,74,.1)" : f.key === "inactive" ? "rgba(239,68,68,.1)" : PA(0.1)) : "transparent",
                    color: isActive ? dotColor : "var(--text-muted, #64748b)",
                    fontWeight: 600, cursor: "pointer", fontSize: ".825rem",
                    display: "flex", alignItems: "center", gap: 5,
                    transition: "all .15s",
                  }}
                >
                  {f.key !== "all" && <span style={{ width: 6, height: 6, borderRadius: "50%", background: dotColor }} />}
                  {f.label}
                </button>
              );
            })}
          </div>
        </div>

        {/* ── Table card ────────────────────────────────────────── */}
        <div style={{
          background: "var(--card-bg, #fff)",
          borderRadius: 16,
          boxShadow: "0 2px 16px rgba(0,0,0,.07)",
          border: "1px solid var(--border-color, #f1f5f9)",
          overflow: "hidden",
        }}>
          <div style={{ overflowX: "auto" }}>
            <table style={{ width: "100%", borderCollapse: "collapse", minWidth: 860 }}>
              <thead>
                <tr style={{ background: "var(--table-head-bg, #f8faff)" }}>
                  {[t("usr.colUser"), t("usr.colEmail"), t("usr.colRole"), t("usr.colStatus"), t("usr.colJoined"), t("usr.colLastLogin"), t("usr.colActions")].map(h => (
                    <th key={h} style={{
                      padding: "12px 16px", textAlign: "left",
                      fontSize: ".72rem", fontWeight: 700, letterSpacing: ".08em",
                      textTransform: "uppercase", color: "var(--text-muted, #64748b)",
                      borderBottom: "1.5px solid var(--border-color, #f1f5f9)",
                    }}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {loading
                  ? (
                    <tr>
                      <td colSpan={7} style={{ padding: "3rem", textAlign: "center" }}>
                        <div className="spinner-border" style={{ color: PU, width: 40, height: 40 }} role="status">
                          <span className="visually-hidden">Loading...</span>
                        </div>
                      </td>
                    </tr>
                  )
                  : users.length === 0
                    ? (
                      <tr>
                        <td colSpan={7} style={{ padding: "3rem", textAlign: "center", color: "var(--text-muted, #94a3b8)" }}>
                          <i className="bi bi-people" style={{ fontSize: "2rem", display: "block", marginBottom: 8 }} />
                          {t("usr.noResults")}
                        </td>
                      </tr>
                    )
                    : users.map(u => {
                      const isBusy = !!busy[u.id];
                      const isSelf = u.id === me?.id;

                      return (
                        <tr key={u.id} style={{
                          borderBottom: "1px solid var(--border-color, #f1f5f9)",
                          transition: "background .15s",
                          opacity: isBusy ? 0.6 : 1,
                        }}
                          onMouseEnter={e => e.currentTarget.style.background = "var(--row-hover, rgba(124,58,237,.03))"}
                          onMouseLeave={e => e.currentTarget.style.background = ""}
                        >
                          {/* user */}
                          <td style={{ padding: "12px 16px" }}>
                            <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                              <Avatar user={u} />
                              <div>
                                <div style={{ fontWeight: 600, fontSize: ".9rem", color: "var(--text-color, #1e293b)" }}>
                                  {u.first_name ? `${u.first_name} ${u.last_name || ""}`.trim() : u.username}
                                  {isSelf && (
                                    <span style={{ marginLeft: 6, fontSize: ".65rem", background: PA(0.12), color: PU, borderRadius: 6, padding: "1px 6px", fontWeight: 700 }}>
                                      {t("usr.you")}
                                    </span>
                                  )}
                                </div>
                                <div style={{ fontSize: ".8rem", color: "var(--text-muted, #94a3b8)" }}>@{u.username}</div>
                              </div>
                            </div>
                          </td>

                          {/* email */}
                          <td style={{ padding: "12px 16px", fontSize: ".875rem", color: "var(--text-muted, #64748b)" }}>
                            {u.email}
                          </td>

                          {/* role — custom dropdown */}
                          <td style={{ padding: "12px 16px" }}>
                            {isSelf
                              ? <RoleBadge role={u.role} />
                              : <RoleDropdown value={u.role || "driver"} disabled={isBusy} onChange={(r) => handleRoleChange(u.id, r)} />
                            }
                          </td>

                          {/* status */}
                          <td style={{ padding: "12px 16px" }}>
                            <StatusBadge active={u.is_active} />
                          </td>

                          {/* joined */}
                          <td style={{ padding: "12px 16px", fontSize: ".85rem", color: "var(--text-muted, #64748b)", whiteSpace: "nowrap" }}>
                            {u.date_joined
                              ? new Date(u.date_joined).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })
                              : "—"}
                          </td>

                          {/* last login */}
                          <td style={{ padding: "12px 16px", fontSize: ".82rem", color: "var(--text-muted, #64748b)", whiteSpace: "nowrap" }}>
                            {u.last_login
                              ? new Date(u.last_login).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })
                              : <span style={{ opacity: 0.5 }}>—</span>}
                          </td>

                          {/* actions */}
                          <td style={{ padding: "12px 16px" }}>
                            <div style={{ display: "flex", alignItems: "center", gap: 6, flexWrap: "nowrap" }}>
                              {/* edit */}
                              <button
                                onClick={() => setEditUser(u)}
                                title={t("usr.editUser")}
                                style={{
                                  padding: "6px 10px", borderRadius: 8,
                                  border: `1px solid ${PA(0.3)}`,
                                  background: PA(0.07), color: PU,
                                  cursor: "pointer", fontSize: ".8rem", fontWeight: 600,
                                  display: "flex", alignItems: "center", gap: 4,
                                }}
                              >
                                <i className="bi bi-pencil-square" />
                              </button>

                              {/* toggle active */}
                              {!isSelf && (
                                <button
                                  disabled={isBusy}
                                  onClick={() => handleToggleActive(u.id)}
                                  title={u.is_active ? t("usr.deactivate") : t("usr.activate")}
                                  style={{
                                    padding: "6px 10px", borderRadius: 8,
                                    border: `1px solid ${u.is_active ? "rgba(239,68,68,.3)" : "rgba(22,163,74,.3)"}`,
                                    background: u.is_active ? "rgba(239,68,68,.07)" : "rgba(22,163,74,.07)",
                                    color: u.is_active ? "#ef4444" : "#16a34a",
                                    cursor: "pointer", fontSize: ".8rem", fontWeight: 600,
                                    display: "flex", alignItems: "center", gap: 4,
                                  }}
                                >
                                  <i className={`bi ${u.is_active ? "bi-person-fill-slash" : "bi-person-fill-check"}`} />
                                </button>
                              )}

                              {/* delete */}
                              {!isSelf && (
                                <button
                                  disabled={isBusy}
                                  onClick={() => setConfirm(u)}
                                  title={t("usr.deleteUser")}
                                  style={{
                                    padding: "6px 10px", borderRadius: 8,
                                    border: "1px solid rgba(239,68,68,.3)",
                                    background: "rgba(239,68,68,.07)",
                                    color: "#ef4444",
                                    cursor: "pointer", fontSize: ".8rem", fontWeight: 600,
                                    display: "flex", alignItems: "center", gap: 4,
                                  }}
                                >
                                  <i className="bi bi-trash3" />
                                </button>
                              )}

                              {isSelf && (
                                <span style={{ fontSize: ".78rem", color: "var(--text-muted, #94a3b8)", fontStyle: "italic" }}>
                                  {t("usr.currentSession")}
                                </span>
                              )}
                            </div>
                          </td>
                        </tr>
                      );
                    })}
              </tbody>
            </table>
          </div>

          {!loading && users.length > 0 && (
            <Paginator
              page={page}
              total={total}
              pageSize={10}
              onChange={setPage}
              loading={loading}
            />
          )}
        </div>
      </div>

      {/* ── Modals ──────────────────────────────────────────────── */}
      {confirm && (
        <ConfirmModal user={confirm} onConfirm={handleDelete} onCancel={() => setConfirm(null)} />
      )}
      {showCreate && (
        <CreateUserModal onCreated={handleCreated} onCancel={() => setShowCreate(false)} />
      )}
      {editUser && (
        <EditUserModal user={editUser} onUpdated={handleUpdated} onCancel={() => setEditUser(null)} />
      )}

      {/* ── Toast ───────────────────────────────────────────────── */}
      {toast && (
        <div style={{
          position: "fixed", bottom: 28, right: 28, zIndex: 2000,
          background: toast.type === "error" ? "#ef4444" : "#22c55e",
          color: "#fff", borderRadius: 12, padding: "12px 20px",
          boxShadow: "0 8px 30px rgba(0,0,0,.2)",
          display: "flex", alignItems: "center", gap: 10,
          fontSize: ".9rem", fontWeight: 600,
          animation: "slideUp .3s ease",
        }}>
          <i className={`bi ${toast.type === "error" ? "bi-x-circle-fill" : "bi-check-circle-fill"}`} />
          {toast.msg}
        </div>
      )}

      <style>{`
        @keyframes pulse { 0%,100%{opacity:.6} 50%{opacity:1} }
        @keyframes slideUp { from{opacity:0;transform:translateY(20px)} to{opacity:1;transform:translateY(0)} }
        @keyframes fadeIn { from{opacity:0;transform:translateY(-4px)} to{opacity:1;transform:translateY(0)} }
      `}</style>
    </div>
  );
}
