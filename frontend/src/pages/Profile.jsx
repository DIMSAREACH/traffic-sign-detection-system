import { useEffect, useRef, useState } from "react";
import { NavLink, useNavigate } from "react-router-dom";
import { useAuth } from "../context/AuthContext.jsx";
import { useLanguage } from "../i18n/LanguageContext.jsx";
import {
  changePassword,
  deleteAccount,
  updateProfile,
  uploadAvatar,
} from "../services/authService.js";
import { listViolations } from "../services/violationService.js";
import { listFines } from "../services/fineService.js";
import { listNotifications } from "../services/notificationService.js";
import { listVehicles } from "../services/vehicleService.js";
import "./Profile.css";

/* ── helpers ── */
function fmtDate(iso) {
  if (!iso) return "—";
  return new Date(iso).toLocaleDateString(undefined, {
    year: "numeric",
    month: "short",
    day: "numeric",
  });
}

function pwStrength(pw) {
  if (!pw) return { level: 0, label: "", cls: "" };
  let s = 0;
  if (pw.length >= 8) s++;
  if (pw.length >= 12) s++;
  if (/[A-Z]/.test(pw) && /[a-z]/.test(pw)) s++;
  if (/\d/.test(pw)) s++;
  if (/[^A-Za-z0-9]/.test(pw)) s++;
  if (s <= 1) return { level: 1, labelKey: "prof.pwWeak", cls: "weak" };
  if (s <= 2) return { level: 2, labelKey: "prof.pwFair", cls: "fair" };
  if (s <= 3) return { level: 3, labelKey: "prof.pwGood", cls: "good" };
  return { level: 4, labelKey: "prof.pwStrong", cls: "strong" };
}

const CLS_MAP = { weak: "#dc2626", fair: "#f59e0b", good: "#2563eb", strong: "#16a34a" };

/* ════════════════════════════════════════════════════════ */
export default function Profile() {
  const { user, updateUser, logout } = useAuth();
  const { t } = useLanguage();
  const navigate = useNavigate();
  const fileRef = useRef(null);

  /* ── Avatar state ── */
  const [preview, setPreview] = useState(null);
  const [uploadingAv, setUploadingAv] = useState(false);
  const [avErr, setAvErr] = useState("");
  const [avatarHover, setAvatarHover] = useState(false);
  const [dragOver, setDragOver] = useState(false);

  const processFile = (file) => {
    if (!file) return;
    if (!file.type.startsWith("image/")) {
      setAvErr(t("prof.avatarTypeErr"));
      return;
    }
    if (file.size > 5 * 1024 * 1024) {
      setAvErr(t("prof.avatarSizeErr"));
      return;
    }
    setAvErr("");
    setPreview(URL.createObjectURL(file));
    setUploadingAv(true);
    uploadAvatar(file)
      .then((updated) => {
        updateUser(updated);
        setPreview(null);
      })
      .catch(() => {
        setAvErr(t("prof.avatarUploadErr"));
        setPreview(null);
      })
      .finally(() => setUploadingAv(false));
  };

  /* ── Profile form ── */
  const [form, setForm] = useState({
    first_name: user?.first_name || "",
    last_name: user?.last_name || "",
    username: user?.username || "",
    phone: user?.phone || "",
  });
  const [saving, setSaving] = useState(false);
  const [saveOk, setSaveOk] = useState(false);
  const [saveErr, setSaveErr] = useState("");

  const handleSave = async () => {
    setSaving(true);
    setSaveOk(false);
    setSaveErr("");
    try {
      const updated = await updateProfile(form);
      updateUser(updated);
      setSaveOk(true);
      setTimeout(() => setSaveOk(false), 3000);
    } catch (e) {
      setSaveErr(
        e?.response?.data?.detail || t("prof.savedFail")
      );
    } finally {
      setSaving(false);
    }
  };

  /* ── Password form ── */
  const [pw, setPw] = useState({
    current_password: "",
    new_password: "",
    confirm: "",
  });
  const [savingPw, setSavingPw] = useState(false);
  const [pwOk, setPwOk] = useState(false);
  const [pwErr, setPwErr] = useState("");
  const strength = pwStrength(pw.new_password);

  const handlePw = async () => {
    setPwErr("");
    setPwOk(false);
    if (pw.new_password !== pw.confirm) {
      setPwErr(t("prof.pwMismatch"));
      return;
    }
    if (pw.new_password.length < 8) {
      setPwErr(t("prof.pwMin8"));
      return;
    }
    setSavingPw(true);
    try {
      await changePassword({
        current_password: pw.current_password,
        new_password: pw.new_password,
      });
      setPwOk(true);
      setPw({ current_password: "", new_password: "", confirm: "" });
      setTimeout(() => setPwOk(false), 3000);
    } catch (e) {
      setPwErr(e?.response?.data?.detail || t("prof.pwFail"));
    } finally {
      setSavingPw(false);
    }
  };

  /* ── Activity counts ── */
  /* ── Deactivate modal state ── */
  const [showDeactModal, setShowDeactModal] = useState(false);
  const [deactStep, setDeactStep] = useState(1);       // 1 = email, 2 = password
  const [deactEmail, setDeactEmail] = useState("");
  const [deactPw, setDeactPw] = useState("");
  const [deacting, setDeacting] = useState(false);
  const [deactErr, setDeactErr] = useState("");

  const openDeactModal = () => {
    setDeactStep(1); setDeactEmail(""); setDeactPw(""); setDeactErr(""); setDeacting(false);
    setShowDeactModal(true);
  };
  const closeDeactModal = () => setShowDeactModal(false);

  const handleDeactivate = async () => {
    if (deactStep === 1) {
      if (deactEmail.toLowerCase() !== (user?.email || "").toLowerCase()) {
        setDeactErr(t("prof.deactEmailMismatch"));
        return;
      }
      setDeactErr("");
      setDeactStep(2);
      return;
    }
    // step 2
    setDeacting(true); setDeactErr("");
    try {
      await deleteAccount(deactPw);
      // Navigate FIRST with state, then clear auth tokens.
      // If we call logout() first, ProtectedRoute redirects to /login
      // without the deleted state before navigate() can run.
      navigate("/login", { state: { deleted: true }, replace: true });
      logout();
    } catch (e) {
      setDeactErr(e?.response?.data?.detail || e?.response?.data?.password?.[0] || t("prof.deactFail"));
    } finally {
      setDeacting(false);
    }
  };

  const [counts, setCounts] = useState({
    violations: 0,
    fines: 0,
    notifications: 0,
    vehicles: 0,
  });

  useEffect(() => {
    let active = true;
    Promise.allSettled([
      listViolations({ page: 1, page_size: 1 }),
      listFines({ page: 1, page_size: 1 }),
      listNotifications({ page: 1, page_size: 1 }),
      listVehicles({ page: 1, page_size: 1 }),
    ]).then(([v, f, n, vh]) => {
      if (!active) return;
      setCounts({
        violations: v.status === "fulfilled" ? (v.value?.count ?? 0) : 0,
        fines: f.status === "fulfilled" ? (f.value?.count ?? 0) : 0,
        notifications: n.status === "fulfilled" ? (n.value?.count ?? 0) : 0,
        vehicles: vh.status === "fulfilled" ? (vh.value?.count ?? 0) : 0,
      });
    });
    return () => { active = false; };
  }, []);

  /* ── Derived display values ── */
  const initials = user
    ? (
        (user.first_name?.[0] || "") +
          (user.last_name?.[0] || "") ||
        user.username?.[0] ||
        user.email?.[0] ||
        "U"
      ).toUpperCase()
    : "U";

  const displayName = user?.first_name
    ? `${user.first_name} ${user.last_name || ""}`.trim()
    : user?.username || user?.email?.split("@")[0] || "User";

  const roleNames = user?.roles?.map((r) => r.role?.name).filter(Boolean) || [];
  if (!roleNames.length) roleNames.push("driver");

  /* ════════════════════════════ RENDER ════════════════════════════ */
  return (
    <div className="prof-page">
      {/* ── Page Header ── */}
      <div className="prof-header">
        <h4>
          <i className="bi bi-person-circle me-2" />
          {t("prof.title")}
        </h4>
        <p>{t("prof.subtitle")}</p>
      </div>

      <div className="prof-grid">
        {/* ════════════════ LEFT COLUMN ════════════════ */}
        <div className="d-flex flex-column gap-4">
          {/* ── Avatar Card ── */}
          <div className="prof-card">
            <div className="prof-card-body prof-avatar-card">
              {/* Avatar */}
              <input
                ref={fileRef}
                type="file"
                accept="image/*"
                style={{ display: "none" }}
                onChange={(e) => processFile(e.target.files?.[0])}
              />
              <div
                className={`prof-avatar-ring ${uploadingAv ? "uploading" : ""} ${dragOver ? "drag-over" : ""}`}
                onClick={() => !uploadingAv && fileRef.current?.click()}
                onMouseEnter={() => setAvatarHover(true)}
                onMouseLeave={() => setAvatarHover(false)}
                onDragOver={(e) => { e.preventDefault(); setDragOver(true); }}
                onDragLeave={() => setDragOver(false)}
                onDrop={(e) => { e.preventDefault(); setDragOver(false); processFile(e.dataTransfer.files?.[0]); }}
                title="Click or drag an image to change photo"
              >
                <div className="prof-avatar-border" />
                <div className="prof-avatar-inner">
                  {(preview || user?.avatar_url) ? (
                    <img
                      src={preview || user.avatar_url}
                      alt="Profile"
                      style={{ opacity: uploadingAv ? 0.35 : (avatarHover ? 0.6 : 1) }}
                    />
                  ) : (
                    <div
                      className="prof-avatar-initials"
                      style={{ opacity: uploadingAv ? 0.35 : 1 }}
                    >
                      {initials}
                    </div>
                  )}
                  <div className="prof-avatar-overlay">
                    {uploadingAv ? (
                      <span
                        className="spinner-border text-white"
                        style={{ width: 28, height: 28, borderWidth: 3 }}
                      />
                    ) : (
                      <>
                        <i className="bi bi-camera-fill text-white" style={{ fontSize: "1.3rem" }} />
                        <span className="prof-avatar-overlay-label">
                          {dragOver ? t("prof.dropHere") : t("prof.change")}
                        </span>
                      </>
                    )}
                  </div>
                </div>
                <button
                  className="prof-avatar-edit"
                  onClick={(e) => { e.stopPropagation(); if (!uploadingAv) fileRef.current?.click(); }}
                  disabled={uploadingAv}
                  title="Change photo"
                >
                  <i className="bi bi-camera-fill" />
                </button>
              </div>

              {avErr && (
                <div className="prof-alert prof-alert--error mb-2" style={{ maxWidth: 220, margin: "0 auto .5rem" }}>
                  <i className="bi bi-exclamation-circle-fill" />{avErr}
                </div>
              )}

              <p className="prof-name">{displayName}</p>
              {user?.email && user.email !== displayName && (
                <p className="prof-email-hint">{user.email}</p>
              )}

              <div className="prof-role-badges">
                {roleNames.map((r, i) => (
                  <span key={i} className="prof-role-badge">{r}</span>
                ))}
              </div>

              <div className="prof-stats">
                <div className="prof-stat">
                  <div className="prof-stat-value">
                    {user?.is_active ? t("prof.active") : t("prof.inactive")}
                  </div>
                  <div className="prof-stat-label">{t("prof.status")}</div>
                </div>
                <div className="prof-stat">
                  <div className="prof-stat-value">{roleNames.length}</div>
                  <div className="prof-stat-label">
                    {roleNames.length !== 1 ? t("prof.roles") : t("prof.role")}
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* ── Account Information Card ── */}
          <div className="prof-card">
            <div className="prof-card-body">
              <div className="prof-card-header">
                <div className="prof-card-icon" style={{ background: "rgba(37,99,235,.1)", color: "#2563eb" }}>
                  <i className="bi bi-info-circle-fill" />
                </div>
                <div className="prof-card-header-text">
                  <h6>{t("prof.accountInfo")}</h6>
                  <p>{t("prof.accountInfoSub")}</p>
                </div>
              </div>

              <div className="prof-info-grid prof-info-grid--single">
                <div className="prof-info-item">
                  <div className="prof-info-icon" style={{ background: "rgba(124,58,237,.08)", color: "#7c3aed" }}>
                    <i className="bi bi-envelope-fill" />
                  </div>
                  <div className="prof-info-text">
                    <div className="prof-info-label">{t("prof.email")}</div>
                    <div className="prof-info-value">{user?.email || "—"}</div>
                  </div>
                </div>
                <div className="prof-info-item">
                  <div className="prof-info-icon" style={{ background: "rgba(22,163,74,.08)", color: "#16a34a" }}>
                    <i className="bi bi-person-badge-fill" />
                  </div>
                  <div className="prof-info-text">
                    <div className="prof-info-label">{t("prof.username")}</div>
                    <div className="prof-info-value">{user?.username || "—"}</div>
                  </div>
                </div>
                <div className="prof-info-item">
                  <div className="prof-info-icon" style={{ background: "rgba(245,158,11,.08)", color: "#f59e0b" }}>
                    <i className="bi bi-calendar-event-fill" />
                  </div>
                  <div className="prof-info-text">
                    <div className="prof-info-label">{t("prof.joined")}</div>
                    <div className="prof-info-value">{fmtDate(user?.date_joined)}</div>
                  </div>
                </div>
                <div className="prof-info-item">
                  <div className="prof-info-icon" style={{ background: "rgba(239,68,68,.08)", color: "#dc2626" }}>
                    <i className="bi bi-clock-fill" />
                  </div>
                  <div className="prof-info-text">
                    <div className="prof-info-label">{t("prof.lastLogin")}</div>
                    <div className="prof-info-value">{fmtDate(user?.last_login)}</div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* ════════════════ RIGHT COLUMN ════════════════ */}
        <div className="d-flex flex-column gap-4">

          {/* ── Activity Overview Card ── */}
          <div className="prof-card">
            <div className="prof-card-body">
              <div className="prof-card-header">
                <div className="prof-card-icon" style={{ background: "rgba(124,58,237,.1)", color: "#7c3aed" }}>
                  <i className="bi bi-bar-chart-fill" />
                </div>
                <div className="prof-card-header-text">
                  <h6>{t("prof.activityTitle")}</h6>
                  <p>{t("prof.activitySub")}</p>
                </div>
              </div>

              <div className="prof-activity-grid">
                <NavLink to="/violations" className="prof-activity-item" style={{ background: "rgba(239,68,68,.06)" }}>
                  <div className="prof-activity-icon" style={{ background: "rgba(239,68,68,.12)", color: "#dc2626" }}>
                    <i className="bi bi-exclamation-triangle-fill" />
                  </div>
                  <div className="prof-activity-count" style={{ color: "#dc2626" }}>
                    {counts.violations}
                  </div>
                  <div className="prof-activity-label">{t("prof.violations")}</div>
                </NavLink>

                <NavLink to="/fines" className="prof-activity-item" style={{ background: "rgba(245,158,11,.06)" }}>
                  <div className="prof-activity-icon" style={{ background: "rgba(245,158,11,.12)", color: "#f59e0b" }}>
                    <i className="bi bi-cash-stack" />
                  </div>
                  <div className="prof-activity-count" style={{ color: "#f59e0b" }}>
                    {counts.fines}
                  </div>
                  <div className="prof-activity-label">{t("prof.fines")}</div>
                </NavLink>

                <NavLink to="/notifications" className="prof-activity-item" style={{ background: "rgba(37,99,235,.06)" }}>
                  <div className="prof-activity-icon" style={{ background: "rgba(37,99,235,.12)", color: "#2563eb" }}>
                    <i className="bi bi-bell-fill" />
                  </div>
                  <div className="prof-activity-count" style={{ color: "#2563eb" }}>
                    {counts.notifications}
                  </div>
                  <div className="prof-activity-label">{t("prof.notifications")}</div>
                </NavLink>

                <NavLink to="/vehicles" className="prof-activity-item" style={{ background: "rgba(22,163,74,.06)" }}>
                  <div className="prof-activity-icon" style={{ background: "rgba(22,163,74,.12)", color: "#16a34a" }}>
                    <i className="bi bi-truck-front-fill" />
                  </div>
                  <div className="prof-activity-count" style={{ color: "#16a34a" }}>
                    {counts.vehicles}
                  </div>
                  <div className="prof-activity-label">{t("prof.vehicles")}</div>
                </NavLink>
              </div>
            </div>
          </div>

          {/* ── Edit Profile Card ── */}
          <div className="prof-card">
            <div className="prof-card-body">
              <div className="prof-card-header">
                <div className="prof-card-icon" style={{ background: "rgba(124,58,237,.1)", color: "#7c3aed" }}>
                  <i className="bi bi-pencil-fill" />
                </div>
                <div className="prof-card-header-text">
                  <h6>{t("prof.edit")}</h6>
                  <p>{t("prof.editSub")}</p>
                </div>
              </div>

              <div className="row g-3">
                <div className="col-12 col-sm-6">
                  <div className="prof-field">
                    <label><i className="bi bi-person" />{t("prof.firstName")}</label>
                    <input
                      value={form.first_name}
                      onChange={(e) => setForm((f) => ({ ...f, first_name: e.target.value }))}
                      placeholder={t("prof.firstName")}
                    />
                  </div>
                </div>
                <div className="col-12 col-sm-6">
                  <div className="prof-field">
                    <label><i className="bi bi-person" />{t("prof.lastName")}</label>
                    <input
                      value={form.last_name}
                      onChange={(e) => setForm((f) => ({ ...f, last_name: e.target.value }))}
                      placeholder={t("prof.lastName")}
                    />
                  </div>
                </div>
                <div className="col-12 col-sm-6">
                  <div className="prof-field">
                    <label><i className="bi bi-at" />{t("prof.username")}</label>
                    <input
                      value={form.username}
                      onChange={(e) => setForm((f) => ({ ...f, username: e.target.value }))}
                      placeholder={t("prof.username")}
                    />
                  </div>
                </div>
                <div className="col-12 col-sm-6">
                  <div className="prof-field">
                    <label><i className="bi bi-telephone" />{t("prof.phone")}</label>
                    <input
                      value={form.phone}
                      onChange={(e) => setForm((f) => ({ ...f, phone: e.target.value }))}
                      placeholder="+855 12 345 678"
                    />
                  </div>
                </div>
                <div className="col-12">
                  <div className="prof-field">
                    <label><i className="bi bi-envelope" />{t("prof.email")}</label>
                    <input value={user?.email || ""} readOnly />
                  </div>
                </div>
              </div>

              {saveErr && (
                <div className="prof-alert prof-alert--error mt-3">
                  <i className="bi bi-exclamation-circle-fill" />{saveErr}
                </div>
              )}
              {saveOk && (
                <div className="prof-alert prof-alert--success mt-3">
                  <i className="bi bi-check-circle-fill" />{t("prof.savedOk")}
                </div>
              )}

              <div className="mt-3">
                <button className="prof-save-btn" onClick={handleSave} disabled={saving}>
                  {saving ? (
                    <><span className="spinner-border spinner-border-sm" /> {t("prof.saving")}</>
                  ) : (
                    <><i className="bi bi-check-lg" /> {t("prof.saveChanges")}</>
                  )}
                </button>
              </div>
            </div>
          </div>

          {/* ── Change Password Card ── */}
          <div className="prof-card">
            <div className="prof-card-body">
              <div className="prof-card-header">
                <div className="prof-card-icon" style={{ background: "rgba(239,68,68,.08)", color: "#dc2626" }}>
                  <i className="bi bi-shield-lock-fill" />
                </div>
                <div className="prof-card-header-text">
                  <h6>{t("prof.changePw")}</h6>
                  <p>{t("prof.changePwSub")}</p>
                </div>
              </div>

              <div className="row g-3">
                <div className="col-12">
                  <div className="prof-field">
                    <label><i className="bi bi-lock" />{t("prof.currentPw")}</label>
                    <input
                      type="password"
                      value={pw.current_password}
                      onChange={(e) => setPw((p) => ({ ...p, current_password: e.target.value }))}
                      placeholder={t("prof.currentPw")}
                    />
                  </div>
                </div>
                <div className="col-12 col-sm-6">
                  <div className="prof-field">
                    <label><i className="bi bi-lock-fill" />{t("prof.newPw")}</label>
                    <input
                      type="password"
                      value={pw.new_password}
                      onChange={(e) => setPw((p) => ({ ...p, new_password: e.target.value }))}
                      placeholder={t("prof.newPw")}
                    />
                    {/* strength meter */}
                    {pw.new_password && (
                      <>
                        <div className="prof-pw-strength">
                          {[1, 2, 3, 4].map((i) => (
                            <div
                              key={i}
                              className={`prof-pw-bar ${i <= strength.level ? strength.cls : ""}`}
                            />
                          ))}
                        </div>
                        <div
                          className="prof-pw-text"
                          style={{ color: CLS_MAP[strength.cls] || "#94a3b8" }}
                        >
                          {strength.labelKey ? t(strength.labelKey) : ""}
                        </div>
                      </>
                    )}
                  </div>
                </div>
                <div className="col-12 col-sm-6">
                  <div className="prof-field">
                    <label><i className="bi bi-lock-fill" />{t("prof.confirmPw")}</label>
                    <input
                      type="password"
                      value={pw.confirm}
                      onChange={(e) => setPw((p) => ({ ...p, confirm: e.target.value }))}
                      placeholder={t("prof.confirmPw")}
                    />
                  </div>
                </div>
              </div>

              {pwErr && (
                <div className="prof-alert prof-alert--error mt-3">
                  <i className="bi bi-exclamation-circle-fill" />{pwErr}
                </div>
              )}
              {pwOk && (
                <div className="prof-alert prof-alert--success mt-3">
                  <i className="bi bi-check-circle-fill" />{t("prof.pwOk")}
                </div>
              )}

              <div className="mt-3">
                <button className="prof-save-btn" onClick={handlePw} disabled={savingPw}>
                  {savingPw ? (
                    <><span className="spinner-border spinner-border-sm" /> {t("prof.saving")}</>
                  ) : (
                    <><i className="bi bi-shield-check" /> {t("prof.updatePw")}</>
                  )}
                </button>
              </div>
            </div>
          </div>

          {/* ── Security Card ── */}
          <div className="prof-card">
            <div className="prof-card-body">
              <div className="prof-card-header">
                <div className="prof-card-icon" style={{ background: "rgba(37,99,235,.1)", color: "#2563eb" }}>
                  <i className="bi bi-fingerprint" />
                </div>
                <div className="prof-card-header-text">
                  <h6>{t("prof.securityTitle")}</h6>
                  <p>{t("prof.securitySub")}</p>
                </div>
              </div>

              <div className="prof-info-grid">
                <div className="prof-info-item">
                  <div className="prof-info-icon" style={{ background: "rgba(22,163,74,.08)", color: "#16a34a" }}>
                    <i className="bi bi-shield-fill-check" />
                  </div>
                  <div className="prof-info-text">
                    <div className="prof-info-label">{t("prof.status")}</div>
                    <div className="prof-info-value" style={{ color: user?.is_active ? "#16a34a" : "#dc2626" }}>
                      {user?.is_active ? t("prof.active") : t("prof.inactive")}
                    </div>
                  </div>
                </div>
                <div className="prof-info-item">
                  <div className="prof-info-icon" style={{ background: "rgba(124,58,237,.08)", color: "#7c3aed" }}>
                    <i className="bi bi-person-fill-gear" />
                  </div>
                  <div className="prof-info-text">
                    <div className="prof-info-label">{t("prof.roles")}</div>
                    <div className="prof-info-value" style={{ textTransform: "capitalize" }}>
                      {roleNames.join(", ")}
                    </div>
                  </div>
                </div>
                <div className="prof-info-item">
                  <div className="prof-info-icon" style={{ background: "rgba(245,158,11,.08)", color: "#f59e0b" }}>
                    <i className="bi bi-clock-history" />
                  </div>
                  <div className="prof-info-text">
                    <div className="prof-info-label">{t("prof.lastLogin")}</div>
                    <div className="prof-info-value">{fmtDate(user?.last_login)}</div>
                  </div>
                </div>
                <div className="prof-info-item">
                  <div className="prof-info-icon" style={{ background: "rgba(37,99,235,.08)", color: "#2563eb" }}>
                    <i className="bi bi-calendar3" />
                  </div>
                  <div className="prof-info-text">
                    <div className="prof-info-label">{t("prof.joined")}</div>
                    <div className="prof-info-value">{fmtDate(user?.date_joined)}</div>
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* ── Danger Zone Card ── */}
          <div className="prof-card" style={{ borderColor: "rgba(239,68,68,.15)" }}>
            <div className="prof-card-body">
              <div className="prof-card-header">
                <div className="prof-card-icon" style={{ background: "rgba(239,68,68,.08)", color: "#dc2626" }}>
                  <i className="bi bi-exclamation-octagon-fill" />
                </div>
                <div className="prof-card-header-text">
                  <h6 style={{ color: "#dc2626" }}>{t("prof.dangerTitle")}</h6>
                  <p>{t("prof.dangerSub")}</p>
                </div>
              </div>

              <div className="d-flex align-items-center justify-content-between flex-wrap gap-3">
                <div>
                  <div style={{ fontWeight: 600, fontSize: ".95rem" }}>{t("prof.deleteAcc")}</div>
                  <div style={{ fontSize: ".85rem", color: "#94a3b8" }}>{t("prof.deleteAccDesc")}</div>
                </div>
                <button className="prof-danger-btn" onClick={openDeactModal}>
                  <i className="bi bi-trash3" />
                  {t("prof.deleteAcc")}
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* ═══════ Deactivation Confirmation Modal ═══════ */}
      {showDeactModal && (
        <div className="prof-modal-backdrop" onClick={closeDeactModal}>
          <div className="prof-modal" onClick={(e) => e.stopPropagation()}>
            {/* header */}
            <div className="prof-modal-header">
              <div className="prof-modal-icon">
                <i className="bi bi-exclamation-triangle-fill" />
              </div>
              <h5 className="prof-modal-title">{t("prof.deactModalTitle")}</h5>
              <button className="prof-modal-close" onClick={closeDeactModal}>
                <i className="bi bi-x-lg" />
              </button>
            </div>

            {/* body */}
            <div className="prof-modal-body">
              <p className="prof-modal-desc">{t("prof.deactModalDesc")}</p>

              {/* step indicator */}
              <div className="prof-modal-steps">
                <div className={`prof-modal-step ${deactStep >= 1 ? "active" : ""}`}>1</div>
                <div className="prof-modal-step-line" />
                <div className={`prof-modal-step ${deactStep >= 2 ? "active" : ""}`}>2</div>
              </div>

              {deactStep === 1 ? (
                <div className="prof-modal-field">
                  <label>{t("prof.deactTypeEmail")}</label>
                  <input
                    type="email"
                    value={deactEmail}
                    onChange={(e) => { setDeactEmail(e.target.value); setDeactErr(""); }}
                    placeholder={user?.email}
                    autoFocus
                  />
                </div>
              ) : (
                <div className="prof-modal-field">
                  <label>{t("prof.deactPassword")}</label>
                  <input
                    type="password"
                    value={deactPw}
                    onChange={(e) => { setDeactPw(e.target.value); setDeactErr(""); }}
                    placeholder="••••••••"
                    autoFocus
                  />
                </div>
              )}

              {deactErr && (
                <div className="prof-modal-err">
                  <i className="bi bi-exclamation-circle" /> {deactErr}
                </div>
              )}
            </div>

            {/* footer */}
            <div className="prof-modal-footer">
              <button className="prof-modal-cancel" onClick={closeDeactModal}>
                {t("prof.deactCancel")}
              </button>
              <button
                className="prof-modal-confirm"
                disabled={
                  deacting ||
                  (deactStep === 1 && !deactEmail.trim()) ||
                  (deactStep === 2 && !deactPw.trim())
                }
                onClick={handleDeactivate}
              >
                {deacting ? (
                  <span className="prof-modal-spinner" />
                ) : (
                  <>
                    <i className="bi bi-x-octagon" />
                    {deactStep === 1 ? t("prof.deleteAcc") : t("prof.deactConfirm")}
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
