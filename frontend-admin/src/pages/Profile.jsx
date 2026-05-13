import { useEffect, useRef, useState } from "react";
import { NavLink, useNavigate } from "react-router-dom";
import { useAuth } from "../context/AuthContext.jsx";
import { useLanguage } from "../i18n/LanguageContext.jsx";
import {
  changePassword,
  confirmBackupEmail,
  confirmEmailChange,
  deleteAccount,
  formatApiError,
  removeBackupEmail,
  requestBackupEmail,
  requestEmailChange,
  updateProfile,
  uploadAvatar,
} from "../services/authService.js";
import { listViolations } from "../services/violationService.js";
import { listFines } from "../services/fineService.js";
import { listNotifications } from "../services/notificationService.js";
import { listVehicles } from "../services/vehicleService.js";
import { hasStoredAuthCredentials } from "../services/api.js";
import Skeleton from "../components/ui/Skeleton.jsx";
import "./Profile.css";
import "./Login.css";

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

/** GitHub-style primary email dropdown: trigger + panel with selected address only. */
function PrimaryEmailGithubDropdown({ email }) {
  const [open, setOpen] = useState(false);
  const rootRef = useRef(null);

  useEffect(() => {
    if (!open) return;
    const close = (e) => {
      if (rootRef.current && !rootRef.current.contains(e.target)) setOpen(false);
    };
    document.addEventListener("mousedown", close);
    return () => document.removeEventListener("mousedown", close);
  }, [open]);

  const display = email || "—";

  return (
    <div className={`prof-github-dropdown ${open ? "prof-github-dropdown--open" : ""}`} ref={rootRef}>
      <button
        type="button"
        className="prof-github-dropdown-trigger"
        id="prof-primary-email-trigger"
        aria-haspopup="listbox"
        aria-expanded={open}
        aria-controls="prof-primary-email-listbox"
        onClick={() => setOpen((v) => !v)}
      >
        <span className="prof-github-dropdown-value">{display}</span>
        <span className="prof-github-dropdown-chevron" aria-hidden />
      </button>
      {open && (
        <ul
          className="prof-github-dropdown-menu"
          id="prof-primary-email-listbox"
          role="listbox"
          aria-labelledby="prof-primary-email-trigger"
        >
          <li
            role="option"
            aria-selected="true"
            className="prof-github-dropdown-item prof-github-dropdown-item--selected"
          >
            <span className="prof-github-dropdown-check" aria-hidden>
              ✓
            </span>
            <span>{display}</span>
          </li>
        </ul>
      )}
    </div>
  );
}

/* ════════════════════════════════════════════════════════ */
export default function Profile() {
  const { user, updateUser, logout } = useAuth();
  const { t } = useLanguage();
  const navigate = useNavigate();
  const fileRef = useRef(null);
  const formSyncedForUserId = useRef(null);

  /* ── Avatar state ── */
  const [preview, setPreview] = useState(null);
  const [uploadingAv, setUploadingAv] = useState(false);
  const [avErr, setAvErr] = useState("");
  const [avatarHover, setAvatarHover] = useState(false);
  const [dragOver, setDragOver] = useState(false);
  const [avatarLoadFailed, setAvatarLoadFailed] = useState(false);

  useEffect(() => {
    setAvatarLoadFailed(false);
  }, [user?.id, user?.avatar_url, preview]);

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
      .catch((e) => {
        setAvErr(formatApiError(e, t("prof.avatarUploadErr")));
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
    allow_backup_password_reset: user?.allow_backup_password_reset ?? true,
  });
  const [saving, setSaving] = useState(false);
  const [saveOk, setSaveOk] = useState(false);
  const [saveErr, setSaveErr] = useState("");

  useEffect(() => {
    if (!user?.id) {
      formSyncedForUserId.current = null;
      return;
    }
    if (formSyncedForUserId.current === user.id) return;
    formSyncedForUserId.current = user.id;
    setForm({
      first_name: user.first_name || "",
      last_name: user.last_name || "",
      username: user.username || "",
      phone: user.phone || "",
      allow_backup_password_reset: user.allow_backup_password_reset ?? true,
    });
  }, [user]);

  /* ── Email change modal ── */
  const [emailModalOpen, setEmailModalOpen] = useState(false);
  const [emailStep, setEmailStep] = useState(1); // 1=new email, 2=otp
  const [newEmail, setNewEmail] = useState("");
  const [emailOtp, setEmailOtp] = useState("");
  const [emailOtpHint, setEmailOtpHint] = useState("");
  const [emailBusy, setEmailBusy] = useState(false);
  const [emailErr, setEmailErr] = useState("");
  const [emailOk, setEmailOk] = useState(false);

  const openEmailModal = () => {
    setEmailModalOpen(true);
    setEmailStep(1);
    setNewEmail("");
    setEmailOtp("");
    setEmailOtpHint("");
    setEmailErr("");
    setEmailOk(false);
    setEmailBusy(false);
  };
  const closeEmailModal = () => setEmailModalOpen(false);

  const handleEmailChange = async () => {
    setEmailErr("");
    setEmailOk(false);
    setEmailBusy(true);
    try {
      if (emailStep === 1) {
        const v = newEmail.trim().toLowerCase();
        if (!v) throw new Error("New email is required.");
        if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v)) throw new Error("Enter a valid email address.");
        const resp = await requestEmailChange(v);
        setEmailOtpHint("");
        setEmailStep(2);
      } else {
        if (!emailOtp.trim()) throw new Error("OTP is required.");
        const updated = await confirmEmailChange(emailOtp.trim());
        updateUser(updated);
        setEmailOk(true);
        setTimeout(() => { setEmailModalOpen(false); }, 800);
      }
    } catch (e) {
      setEmailErr(e?.response?.data?.detail || e?.message || "Failed to change email.");
    } finally {
      setEmailBusy(false);
    }
  };

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

  /* ── Backup email modal ── */
  const [backupModalOpen,   setBackupModalOpen]   = useState(false);
  const [backupStep,        setBackupStep]        = useState(1); // 1=enter email, 2=enter OTP
  const [backupEmail,       setBackupEmail]       = useState("");
  const [backupMasked,      setBackupMasked]      = useState("");
  const [backupOtpDigits,   setBackupOtpDigits]   = useState(["","","","","",""]);
  const [backupBusy,        setBackupBusy]        = useState(false);
  const [backupErr,         setBackupErr]         = useState("");
  const [backupOk,          setBackupOk]          = useState(false);
  const [removingBackup,    setRemovingBackup]    = useState(false);
  const [emailSettingsErr,  setEmailSettingsErr]  = useState("");
  const backupDigitRefs = [useRef(null),useRef(null),useRef(null),useRef(null),useRef(null),useRef(null)];

  const openBackupModal = () => {
    setBackupStep(1); setBackupEmail(""); setBackupMasked("");
    setBackupOtpDigits(["","","","","",""]); setBackupErr(""); setBackupOk(false);
    setBackupBusy(false); setBackupModalOpen(true);
  };
  const closeBackupModal = () => setBackupModalOpen(false);

  const handleBackupRequest = async () => {
    setBackupErr(""); setBackupBusy(true);
    try {
      const emailRe = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
      if (!backupEmail.trim()) throw new Error("Recovery email is required.");
      if (!emailRe.test(backupEmail.trim())) throw new Error("Enter a valid email address.");
      const res = await requestBackupEmail(backupEmail.trim().toLowerCase());
      setBackupMasked(res.masked_email || backupEmail);
      setBackupOtpDigits(["","","","","",""]);
      setBackupStep(2);
      setTimeout(() => backupDigitRefs[0]?.current?.focus(), 80);
    } catch (e) {
      setBackupErr(e?.response?.data?.detail || e?.message || "Failed to send code.");
    } finally {
      setBackupBusy(false);
    }
  };

  const handleBackupOtpDigit = (idx, val) => {
    const ch = val.replace(/\D/g,"").slice(-1);
    const next = [...backupOtpDigits]; next[idx] = ch;
    setBackupOtpDigits(next); setBackupErr("");
    if (ch && idx < 5) backupDigitRefs[idx+1]?.current?.focus();
  };

  const handleBackupOtpKey = (idx, e) => {
    if (e.key === "Backspace" && !backupOtpDigits[idx] && idx > 0) backupDigitRefs[idx - 1]?.current?.focus();
    if (e.key === "ArrowLeft" && idx > 0) backupDigitRefs[idx - 1]?.current?.focus();
    if (e.key === "ArrowRight" && idx < 5) backupDigitRefs[idx + 1]?.current?.focus();
  };

  const handleBackupOtpPaste = (e) => {
    e.preventDefault();
    const pasted = e.clipboardData.getData("text").replace(/\D/g, "").slice(0, 6);
    const next = [...backupOtpDigits];
    for (let i = 0; i < pasted.length; i++) next[i] = pasted[i];
    setBackupOtpDigits(next);
    setBackupErr("");
    backupDigitRefs[Math.min(pasted.length, 5)]?.current?.focus();
  };

  const handleBackupConfirm = async () => {
    const code = backupOtpDigits.join("");
    if (code.length < 6) { setBackupErr("Please fill in all 6 digits."); return; }
    setBackupErr(""); setBackupBusy(true);
    try {
      const res = await confirmBackupEmail(code);
      updateUser({ ...user, backup_email: res.backup_email, backup_email_verified: true, allow_backup_password_reset: true });
      setForm((f) => ({ ...f, allow_backup_password_reset: true }));
      setBackupOk(true);
      setTimeout(closeBackupModal, 1200);
    } catch (e) {
      setBackupErr(e?.response?.data?.detail || "Verification failed.");
    } finally {
      setBackupBusy(false);
    }
  };

  const handleRemoveBackup = async () => {
    if (!window.confirm("Remove your recovery email?")) return;
    setRemovingBackup(true);
    try {
      await removeBackupEmail();
      updateUser({ ...user, backup_email: null, backup_email_verified: false, allow_backup_password_reset: false });
      setForm((f) => ({ ...f, allow_backup_password_reset: false }));
    } catch (e) {
      alert(e?.response?.data?.detail || "Failed to remove recovery email.");
    } finally {
      setRemovingBackup(false);
    }
  };

  const patchEmailSettings = async (partial) => {
    setEmailSettingsErr("");
    const prev = user ? { ...user } : null;
    if (user) updateUser({ ...user, ...partial });
    try {
      const updated = await updateProfile(partial);
      updateUser(updated);
      if (updated.allow_backup_password_reset != null) {
        setForm((f) => ({ ...f, allow_backup_password_reset: updated.allow_backup_password_reset }));
      }
    } catch (e) {
      if (prev) updateUser(prev);
      const d = e?.response?.data?.detail;
      const msg = Array.isArray(d) ? d[0] : typeof d === "string" ? d : "Could not save email settings.";
      setEmailSettingsErr(msg);
    }
  };

  const handleBackupResetPolicy = (enabled) =>
    patchEmailSettings({ allow_backup_password_reset: enabled });

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

  const roleNames = (() => {
    if (!user) return [];
    const fromRelations = user.roles?.map((r) => r.role?.name).filter(Boolean) ?? [];
    if (fromRelations.length) return fromRelations;
    if (user.role) return [user.role];
    return [];
  })();

  const awaitingUser = !user && hasStoredAuthCredentials();

  /* ════════════════════════════ RENDER ════════════════════════════ */
  if (awaitingUser) {
    return (
      <div className="prof-page prof-page--session-loading" aria-busy="true">
        <div className="prof-header">
          <h4>
            <i className="bi bi-person-circle me-2" />
            {t("prof.title")}
          </h4>
          <Skeleton className="mt-2 h-4 max-w-md" style={{ width: "min(66%, 20rem)" }} />
        </div>
        <div className="prof-grid">
          <div className="d-flex flex-column gap-4">
            <Skeleton className="h-72 w-full rounded-2xl" />
            <Skeleton className="h-48 w-full rounded-2xl" />
          </div>
          <div className="d-flex flex-column gap-4">
            <Skeleton className="h-14 w-full rounded-xl" />
            <Skeleton className="min-h-[28rem] w-full rounded-2xl" />
          </div>
        </div>
      </div>
    );
  }

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
                  {(preview || user?.avatar_url) && !avatarLoadFailed ? (
                    <img
                      src={preview || user.avatar_url}
                      alt=""
                      onError={() => setAvatarLoadFailed(true)}
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
                {roleNames.length > 0 ? (
                  roleNames.map((r, i) => (
                    <span key={i} className="prof-role-badge">{r}</span>
                  ))
                ) : (
                  <span className="prof-role-badge prof-role-badge--muted">…</span>
                )}
              </div>

              <div className="prof-stats">
                <div className="prof-stat">
                  <div className="prof-stat-value">
                    {user?.is_active ? t("prof.active") : t("prof.inactive")}
                  </div>
                  <div className="prof-stat-label">{t("prof.status")}</div>
                </div>
                <div className="prof-stat">
                  <div className="prof-stat-value">
                    {roleNames.length > 0 ? roleNames.length : "—"}
                  </div>
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
                  <div className="ms-auto">
                    <button
                      type="button"
                      className="btn btn-sm rounded-pill"
                      style={{ border: "1px solid var(--border)", color: "#7c3aed", background: "#fff" }}
                      onClick={openEmailModal}
                    >
                      <i className="bi bi-pencil-square me-1" />Change
                    </button>
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

          {/* ── Email Settings Card ── */}
          <div className="prof-card prof-email-card">
            <div className="prof-card-body">
              <div className="prof-card-header">
                <div className="prof-card-icon" style={{ background: "rgba(5,150,105,.1)", color: "#059669" }}>
                  <i className="bi bi-envelope-check-fill" />
                </div>
                <div className="prof-card-header-text">
                  <h6>Emails</h6>
                  <p>Manage your primary email, recovery email, and OTP password-reset destinations.</p>
                </div>
              </div>

              {!user?.backup_email_verified && (
                <div className="prof-email-warning">
                  <i className="bi bi-exclamation-triangle-fill" />
                  <span>
                    You have a single verified email associated with your account.
                    Add and verify a recovery email in case you lose access to your primary email.
                  </span>
                </div>
              )}

              <div className="prof-email-list">
                <div className="prof-email-row">
                  <div className="prof-email-icon prof-email-icon--primary">
                    <i className="bi bi-envelope-fill" />
                  </div>
                  <div className="prof-email-main">
                    <div className="prof-email-address">
                      {user?.email || "—"}
                      <span className="prof-email-badge prof-email-badge--primary">Primary</span>
                      <span className="prof-email-badge prof-email-badge--verified">Verified</span>
                      <span className="prof-email-badge prof-email-badge--muted">Private</span>
                    </div>
                    <p>This email is used for sign-in, account notifications, and password reset.</p>
                  </div>
                  <button className="prof-email-action" type="button" onClick={openEmailModal}>
                    <i className="bi bi-pencil-square" /> Change
                  </button>
                </div>

                <div className="prof-email-row">
                  <div className={`prof-email-icon ${user?.backup_email_verified ? "prof-email-icon--verified" : ""}`}>
                    <i className={`bi ${user?.backup_email_verified ? "bi-envelope-check-fill" : "bi-envelope-plus"}`} />
                  </div>
                  <div className="prof-email-main">
                    <div className="prof-email-address">
                      {user?.backup_email || "No recovery email added"}
                      {user?.backup_email_verified && (
                        <span className="prof-email-badge prof-email-badge--verified">Verified Backup</span>
                      )}
                      {user?.backup_email && !user?.backup_email_verified && (
                        <span className="prof-email-badge prof-email-badge--pending">Unverified</span>
                      )}
                    </div>
                    <p>A verified recovery email can receive password-reset OTP codes.</p>
                  </div>
                  <div className="prof-email-actions">
                    <button className="prof-email-action" type="button" onClick={openBackupModal}>
                      <i className="bi bi-plus-circle" /> {user?.backup_email ? "Change" : "Add"}
                    </button>
                    {user?.backup_email && (
                      <button
                        className="prof-email-action prof-email-action--danger"
                        type="button"
                        onClick={handleRemoveBackup}
                        disabled={removingBackup}
                      >
                        {removingBackup ? <span className="spinner-border spinner-border-sm" /> : <i className="bi bi-trash3" />}
                        Remove
                      </button>
                    )}
                  </div>
                </div>
              </div>

              <div className="prof-email-setting">
                <div>
                  <h6>Primary email address</h6>
                  <p>
                    Select an email for account notifications and password-reset codes (when sent to your primary
                    address).
                  </p>
                </div>
                <PrimaryEmailGithubDropdown email={user?.email} />
              </div>

              <div className="prof-email-setting">
                <div>
                  <h6>Backup email address</h6>
                  <p>Choose whether verified backup email can receive OTP password resets.</p>
                </div>
                <div className="prof-email-setting__controls">
                  <div className="prof-email-select-wrap">
                    <select
                      value={(user?.allow_backup_password_reset ?? true) ? "all" : "primary"}
                      onChange={(e) => handleBackupResetPolicy(e.target.value === "all")}
                    >
                      <option value="all">Allow all verified emails</option>
                      <option value="primary">Only primary email</option>
                    </select>
                  </div>
                </div>
              </div>

              <div className="prof-email-setting prof-email-setting--compact">
                <div>
                  <h6>Keep email addresses private</h6>
                  <p>When on, other users see a masked address in shared lists (admins always see the full email).</p>
                </div>
                <div className="prof-email-switch-wrap">
                  <span
                    className={`prof-email-switch-text ${(user?.keep_email_private ?? true) ? "" : "prof-email-switch-text--off"}`}
                    aria-hidden
                  >
                    {(user?.keep_email_private ?? true) ? "On" : "Off"}
                  </span>
                  <button
                    type="button"
                    className="prof-email-switch"
                    role="switch"
                    aria-checked={user?.keep_email_private ?? true}
                    aria-label="Keep email addresses private"
                    onClick={() =>
                      patchEmailSettings({ keep_email_private: !(user?.keep_email_private ?? true) })
                    }
                  >
                    <span className="prof-email-switch-thumb" />
                  </button>
                </div>
              </div>

              <div className="prof-email-setting prof-email-setting--compact">
                <div>
                  <h6>Block unverified email resets</h6>
                  <p>
                    When on, password-reset codes are not sent to your primary email until it is verified. Recovery email
                    still works if verified.
                  </p>
                </div>
                <div className="prof-email-switch-wrap">
                  <span
                    className={`prof-email-switch-text ${(user?.block_unverified_email_reset ?? true) ? "" : "prof-email-switch-text--off"}`}
                    aria-hidden
                  >
                    {(user?.block_unverified_email_reset ?? true) ? "On" : "Off"}
                  </span>
                  <button
                    type="button"
                    className="prof-email-switch"
                    role="switch"
                    aria-checked={user?.block_unverified_email_reset ?? true}
                    aria-label="Block unverified primary email password resets"
                    onClick={() =>
                      patchEmailSettings({
                        block_unverified_email_reset: !(user?.block_unverified_email_reset ?? true),
                      })
                    }
                  >
                    <span className="prof-email-switch-thumb" />
                  </button>
                </div>
              </div>

              {emailSettingsErr && (
                <div className="prof-email-note prof-email-note--error">
                  <i className="bi bi-exclamation-circle-fill" />
                  {emailSettingsErr}
                </div>
              )}
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

        {/* ── Change email modal ── */}
        {emailModalOpen && (
          <div
            onClick={closeEmailModal}
            style={{
              position: "fixed",
              inset: 0,
              background: "rgba(15, 23, 42, .55)",
              backdropFilter: "blur(6px)",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              zIndex: 2000,
              padding: "1rem",
            }}
          >
            <div
              onClick={(e) => e.stopPropagation()}
              style={{
                width: "min(520px, 100%)",
                background: "var(--bs-body-bg)",
                border: "1px solid var(--border)",
                borderRadius: 18,
                boxShadow: "0 18px 60px rgba(2,6,23,.25)",
                overflow: "hidden",
              }}
            >
              <div
                className="d-flex align-items-center justify-content-between px-3 py-3"
                style={{ borderBottom: "1px solid var(--border)" }}
              >
                <h5 className="m-0 fw-bold" style={{ fontSize: "1.05rem" }}>Change email</h5>
                <button className="btn btn-sm" type="button" onClick={closeEmailModal} aria-label="Close">
                  <i className="bi bi-x-lg" />
                </button>
              </div>
              <div className="p-3">
                {emailErr && (
                  <div className="alert alert-danger py-2 d-flex align-items-center gap-2">
                    <i className="bi bi-exclamation-triangle-fill" />{emailErr}
                  </div>
                )}
                {emailOk && (
                  <div className="alert alert-success py-2 d-flex align-items-center gap-2">
                    <i className="bi bi-check-circle-fill" />Email updated.
                  </div>
                )}

                {emailStep === 1 ? (
                  <>
                    <div className="mb-2 text-secondary" style={{ fontSize: ".92rem" }}>
                      We’ll send an OTP to verify your new email.
                    </div>
                    <label className="field-label">New email</label>
                    <input
                      className="form-control"
                      value={newEmail}
                      onChange={(e) => setNewEmail(e.target.value)}
                      placeholder="name@example.com"
                      autoComplete="email"
                    />
                  </>
                ) : (
                  <>
                    <div className="mb-2 text-secondary" style={{ fontSize: ".92rem" }}>
                      Enter the OTP to confirm your new email.
                    </div>
                    <label className="field-label">OTP</label>
                    <input
                      className="form-control"
                      value={emailOtp}
                      onChange={(e) => setEmailOtp(e.target.value)}
                      placeholder="6-digit code"
                      inputMode="numeric"
                    />
                    {emailOtpHint && (
                      <div className="mt-2 text-secondary" style={{ fontSize: ".9rem" }}>
                        {emailOtpHint}
                      </div>
                    )}
                  </>
                )}

                <div className="d-flex gap-2 mt-3">
                  <button className="btn btn-secondary" type="button" onClick={closeEmailModal} disabled={emailBusy}>
                    Cancel
                  </button>
                  <button className="btn btn-primary" type="button" onClick={handleEmailChange} disabled={emailBusy}>
                    {emailBusy ? "Please wait…" : emailStep === 1 ? "Send OTP" : "Confirm"}
                  </button>
                </div>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* ═══════ Backup Email Modal ═══════ */}
      {backupModalOpen && (
        <div
          onClick={closeBackupModal}
          style={{
            position: "fixed", inset: 0,
            background: "rgba(15,23,42,.55)", backdropFilter: "blur(6px)",
            display: "flex", alignItems: "center", justifyContent: "center",
            zIndex: 2000, padding: "1rem",
          }}
        >
          <div
            onClick={(e) => e.stopPropagation()}
            className="prof-backup-modal"
            style={{
              width: "min(480px, 100%)", background: "var(--bs-body-bg)",
              border: "1px solid var(--border)", borderRadius: 18,
              boxShadow: "0 18px 60px rgba(2,6,23,.25)", overflow: "hidden",
            }}
          >
            {/* Header */}
            <div className="d-flex align-items-center justify-content-between px-3 py-3"
              style={{ borderBottom: "1px solid var(--border)" }}>
              <h5 className="m-0 fw-bold" style={{ fontSize: "1.05rem" }}>
                <i className="bi bi-envelope-check-fill me-2" style={{ color: "#059669" }} />
                {user?.backup_email ? "Change" : "Add"} Recovery Email
              </h5>
              <button className="btn btn-sm" type="button" onClick={closeBackupModal}><i className="bi bi-x-lg" /></button>
            </div>

            {/* Body */}
            <div className="p-3">
              {backupErr && (
                <div className="alert alert-danger py-2 d-flex align-items-center gap-2 mb-3">
                  <i className="bi bi-exclamation-triangle-fill" />{backupErr}
                </div>
              )}
              {backupOk && (
                <div className="alert alert-success py-2 d-flex align-items-center gap-2 mb-3">
                  <i className="bi bi-check-circle-fill" />Recovery email verified!
                </div>
              )}

              {/* Step 1 — enter email */}
              {backupStep === 1 && (
                <>
                  <p className="text-secondary mb-3" style={{ fontSize: ".92rem" }}>
                    Enter the email you want to use as a recovery address.
                    We&apos;ll send a 6-digit code there to verify it.
                  </p>
                  <label className="field-label">Recovery Email</label>
                  <input
                    className="form-control mb-3"
                    type="email"
                    placeholder="recovery@gmail.com"
                    value={backupEmail}
                    onChange={(e) => setBackupEmail(e.target.value)}
                    autoFocus
                  />
                  <div className="d-flex gap-2">
                    <button className="btn btn-secondary" type="button" onClick={closeBackupModal} disabled={backupBusy}>Cancel</button>
                    <button className="btn btn-success" type="button" onClick={handleBackupRequest} disabled={backupBusy}>
                      {backupBusy ? "Sending…" : <><i className="bi bi-send-fill me-1" />Send Code</>}
                    </button>
                  </div>
                </>
              )}

              {/* Step 2 — enter OTP */}
              {backupStep === 2 && (
                <>
                  <p className="text-secondary mb-3" style={{ fontSize: ".92rem" }}>
                    A 6-digit code was sent to <strong>{backupMasked}</strong>.
                    Enter it below to verify your recovery email.
                  </p>
                  <div className="otp-digits-row prof-backup-otp-row mb-3" role="group" aria-label="6-digit verification code">
                    {backupOtpDigits.map((d, i) => (
                      <input
                        key={i}
                        ref={backupDigitRefs[i]}
                        className={`otp-digit ${backupErr ? "otp-digit-err" : d ? "otp-digit-filled" : ""}`}
                        type="text" inputMode="numeric" maxLength={1}
                        autoComplete={i === 0 ? "one-time-code" : "off"}
                        value={d}
                        onChange={(e) => handleBackupOtpDigit(i, e.target.value)}
                        onKeyDown={(e) => handleBackupOtpKey(i, e)}
                        onPaste={handleBackupOtpPaste}
                      />
                    ))}
                  </div>
                  <div className="d-flex gap-2">
                    <button className="btn btn-secondary" type="button"
                      onClick={() => { setBackupStep(1); setBackupErr(""); }} disabled={backupBusy}>
                      <i className="bi bi-arrow-left me-1" />Back
                    </button>
                    <button className="btn btn-success" type="button" onClick={handleBackupConfirm} disabled={backupBusy}>
                      {backupBusy ? "Verifying…" : <><i className="bi bi-patch-check-fill me-1" />Verify</>}
                    </button>
                  </div>
                </>
              )}
            </div>
          </div>
        </div>
      )}

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
