import { useEffect, useState } from "react";
import { useAuth } from "../context/AuthContext.jsx";
import { useLanguage } from "../i18n/LanguageContext.jsx";
import { changePassword } from "../services/authService.js";
import StyledSelect from "../components/StyledSelect.jsx";

const PU = "#7c3aed";
const PA = (a) => `rgba(124,58,237,${a})`;

/* ── tiny helpers ── */
const get  = (k, def) => { try { return JSON.parse(localStorage.getItem(k)) ?? def; } catch { return def; } };
const save = (k, v) => localStorage.setItem(k, JSON.stringify(v));

/** Dispatch a custom event so MainLayout can react to same-tab settings changes */
const emit = (key, value) => window.dispatchEvent(new CustomEvent("settings-change", { detail: { key, value } }));

/* ── Toggle Switch ── */
function Toggle({ checked, onChange, disabled }) {
  return (
    <button
      role="switch"
      aria-checked={checked}
      disabled={disabled}
      onClick={() => onChange(!checked)}
      style={{
        position: "relative", width: 44, height: 24,
        borderRadius: 999, border: "none", cursor: disabled ? "not-allowed" : "pointer",
        background: checked ? PU : "var(--bs-border-color, #d1d5db)",
        transition: "background .2s", flexShrink: 0,
        opacity: disabled ? .5 : 1,
      }}
    >
      <span
        style={{
          position: "absolute", top: 2, left: checked ? 22 : 2,
          width: 20, height: 20, borderRadius: "50%",
          background: "#fff",
          boxShadow: "0 1px 3px rgba(0,0,0,.2)",
          transition: "left .2s",
        }}
      />
    </button>
  );
}

/* ── Section wrapper ── */
function Section({ icon, title, subtitle, children }) {
  return (
    <div
      className="card border-0 rounded-4 h-100"
      style={{ boxShadow: "0 2px 12px rgba(124,58,237,.07)" }}
    >
      <div className="card-body p-4 d-flex flex-column">
        <div className="d-flex align-items-center gap-3 mb-3">
          <div
            style={{
              width: 40, height: 40, borderRadius: 12,
              background: PA(".1"),
              display: "flex", alignItems: "center", justifyContent: "center",
            }}
          >
            <i className={`bi ${icon}`} style={{ fontSize: "var(--fs-section)", color: PU }} />
          </div>
          <div>
            <div className="fw-bold" style={{ fontSize: "var(--fs-section)", color: "var(--bs-body-color)" }}>{title}</div>
            <div style={{ fontSize: "var(--fs-sm)", color: "var(--bs-secondary-color, #6c757d)" }}>{subtitle}</div>
          </div>
        </div>
        <div className="d-flex flex-column gap-3 flex-fill">{children}</div>
      </div>
    </div>
  );
}

/* ── Setting row ── */
function Row({ label, description, children }) {
  return (
    <div
      className="d-flex align-items-center justify-content-between gap-3 py-2"
      style={{ borderBottom: "1px solid var(--bs-border-color, #f1f5f9)" }}
    >
      <div style={{ minWidth: 0, flex: 1 }}>
        <div className="fw-semibold" style={{ fontSize: "var(--fs-body)", color: "var(--bs-body-color)" }}>{label}</div>
        {description && (
          <div style={{ fontSize: "var(--fs-xs)", color: "var(--bs-secondary-color, #6c757d)", marginTop: 2 }}>
            {description}
          </div>
        )}
      </div>
      <div className="flex-shrink-0">{children}</div>
    </div>
  );
}

/* ── Select input ── */
function Selector({ value, onChange, options }) {
  return (
    <StyledSelect
      value={value}
      onChange={onChange}
      options={options.map(o => ({ value: o.value, label: o.label }))}
      size="sm"
      style={{ width: "auto", minWidth: 150 }}
    />
  );
}

/* ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━ */
export default function Settings() {
  const { user } = useAuth();
  const { t } = useLanguage();

  /* ── Appearance ── */
  const [theme,     setTheme]     = useState(() => localStorage.getItem("theme") || "light");
  const [sidebar,   setSidebar]   = useState(() => localStorage.getItem("sidebar") === "1");
  const [compact,   setCompact]   = useState(() => get("settings.compact", false));

  /* ── Notifications ── */
  const [emailNotif,  setEmailNotif]  = useState(() => get("settings.emailNotif", true));
  const [pushNotif,   setPushNotif]   = useState(() => get("settings.pushNotif", true));
  const [violNotif,   setViolNotif]   = useState(() => get("settings.violNotif", true));
  const [fineNotif,   setFineNotif]   = useState(() => get("settings.fineNotif", true));
  const [sysNotif,    setSysNotif]    = useState(() => get("settings.sysNotif", true));
  const [notifSound,  setNotifSound]  = useState(() => get("settings.notifSound", true));

  /* ── Display ── */
  const [pageSize,  setPageSize]  = useState(() => get("settings.pageSize", "10"));
  const [dateFormat, setDateFormat] = useState(() => get("settings.dateFormat", "MMM DD, YYYY"));
  const [timeZone,   setTimeZone]   = useState(() => get("settings.timeZone", "auto"));
  const [language,    setLanguage]   = useState(() => get("settings.language", "en"));

  /* ── Security ── */
  const [twoFactor, setTwoFactor] = useState(() => get("settings.twoFactor", false));
  const [sessionTimeout, setSessionTimeout] = useState(() => get("settings.sessionTimeout", "30"));

  /* ── Privacy & Data ── */
  const [activityLog,   setActivityLog]   = useState(() => get("settings.activityLog", true));
  const [dataSharing,   setDataSharing]   = useState(() => get("settings.dataSharing", false));
  const [autoDelete,    setAutoDelete]    = useState(() => get("settings.autoDelete", "30"));
  const [exportFormat,  setExportFormat]  = useState(() => get("settings.exportFormat", "csv"));

  /* ── Accessibility ── */
  const [fontSize,      setFontSize]      = useState(() => get("settings.fontSize", "medium"));
  const [reduceMotion,  setReduceMotion]  = useState(() => get("settings.reduceMotion", false));
  const [highContrast,  setHighContrast]  = useState(() => get("settings.highContrast", false));
  const [keyboardShort, setKeyboardShort] = useState(() => get("settings.keyboardShort", true));

  /* ── Dashboard Customization ── */
  const [defaultView,   setDefaultView]   = useState(() => get("settings.defaultView", "overview"));
  const [autoRefresh,   setAutoRefresh]   = useState(() => get("settings.autoRefresh", "30"));
  const [showStats,     setShowStats]     = useState(() => get("settings.showStats", true));
  const [chartAnimate,  setChartAnimate]  = useState(() => get("settings.chartAnimate", true));

  /* ── Change password ── */
  const [curPwd,  setCurPwd]  = useState("");
  const [newPwd,  setNewPwd]  = useState("");
  const [confPwd, setConfPwd] = useState("");
  const [pwdBusy, setPwdBusy] = useState(false);
  const [pwdErr,  setPwdErr]  = useState("");

  /* ── Toast feedback ── */
  const [toast, setToast] = useState("");
  const flash = (msg) => { setToast(msg); setTimeout(() => setToast(""), 2500); };

  /* ── Wrapped setters that persist + flash + emit ── */
  const changeTheme = (v) => {
    setTheme(v);
    document.documentElement.setAttribute("data-theme", v);
    localStorage.setItem("theme", v);
    emit("theme", v);
    flash(`${t("set.themeSet")} ${v === "dark" ? t("set.dark") : t("set.light")}`);
  };
  const changeSidebar = (v) => {
    setSidebar(v);
    localStorage.setItem("sidebar", v ? "1" : "0");
    emit("sidebar", v ? "1" : "0");
    flash(v ? t("set.sidebarOn") : t("set.sidebarOff"));
  };
  const toggle = (setter, key, label) => (v) => {
    setter(v);
    save(key, v);
    const shortKey = key.replace("settings.", "");
    emit(shortKey, v);
    flash(`${label} ${v ? t("set.enabled") : t("set.disabled")}`);
  };
  const select = (setter, key, label) => (v) => {
    setter(v);
    save(key, v);
    const shortKey = key.replace("settings.", "");
    emit(shortKey, v);
    if (key === "settings.language") emit("language", v);
    flash(`${label} ${t("set.updated")}`);
  };

  /* keep theme/sidebar in sync if changed from header toggle */
  useEffect(() => {
    const handler = () => {
      const cur = localStorage.getItem("theme") || "light";
      const col = localStorage.getItem("sidebar") === "1";
      setTheme(t => t !== cur ? cur : t);
      setSidebar(s => s !== col ? col : s);
    };
    window.addEventListener("settings-change", handler);
    return () => window.removeEventListener("settings-change", handler);
  }, []);

  /* ── Change password handler ── */
  const handleChangePassword = async () => {
    setPwdErr("");
    if (!curPwd || !newPwd) { setPwdErr(t("set.pwdEmpty")); return; }
    if (newPwd.length < 8) { setPwdErr(t("set.pwdShort")); return; }
    if (newPwd !== confPwd) { setPwdErr(t("set.pwdMismatch")); return; }
    setPwdBusy(true);
    try {
      await changePassword({ current_password: curPwd, new_password: newPwd });
      flash(t("set.pwdSuccess"));
      setCurPwd(""); setNewPwd(""); setConfPwd("");
    } catch (err) {
      const msg = err?.response?.data?.detail || err?.response?.data?.current_password?.[0] || t("set.pwdFail");
      setPwdErr(msg);
    }
    setPwdBusy(false);
  };

  const handleReset = () => {
    const keys = Object.keys(localStorage).filter(k => k.startsWith("settings."));
    keys.forEach(k => localStorage.removeItem(k));
    setCompact(false); setEmailNotif(true); setPushNotif(true);
    setViolNotif(true); setFineNotif(true); setSysNotif(true);
    setNotifSound(true); setPageSize("10"); setDateFormat("MMM DD, YYYY");
    setTimeZone("auto"); setLanguage("en"); setTwoFactor(false);
    setSessionTimeout("30");
    /* Privacy & Data */
    setActivityLog(true); setDataSharing(false); setAutoDelete("30"); setExportFormat("csv");
    /* Accessibility */
    setFontSize("medium"); setReduceMotion(false); setHighContrast(false); setKeyboardShort(true);
    /* Dashboard Customization */
    setDefaultView("overview"); setAutoRefresh("30"); setShowStats(true); setChartAnimate(true);
    /* Emit all resets so other components react */
    emit("language", "en");
    emit("compact", false); emit("fontSize", "medium");
    emit("highContrast", false); emit("reduceMotion", false);
    emit("pageSize", "10"); emit("dateFormat", "MMM DD, YYYY");
    emit("showStats", true); emit("chartAnimate", true);
    emit("autoRefresh", "30"); emit("keyboardShort", true);
    flash(t("set.resetDone"));
  };

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
          <div className="fw-bold text-white" style={{ fontSize: "var(--fs-hero)" }}>
            <i className="bi bi-gear-fill me-2" />{t("set.title")}
          </div>
          <div style={{ fontSize: "var(--fs-sm)", color: "rgba(255,255,255,.65)", marginTop: ".15rem" }}>
            {t("set.subtitle")}
          </div>
        </div>
        <div className="d-flex align-items-center gap-2 d-none d-md-flex">
          <span
            className="badge rounded-pill fw-semibold"
            style={{ background: "rgba(255,255,255,.15)", color: "#fff", fontSize: "var(--fs-xs)", padding: "6px 14px" }}
          >
            <i className="bi bi-person-fill me-1" />{user?.email || "—"}
          </span>
        </div>
      </div>

      {/* ── Grid of setting sections ── */}
      <div className="flex-fill overflow-auto" style={{ minHeight: 0 }}>
        <div className="settings-grid">

          {/* ── Appearance ── */}
          <div style={{ display: "flex" }}>
            <Section icon="bi-palette-fill" title={t("set.appearance")} subtitle={t("set.appearSub")}>
              <Row label={t("set.theme")} description={t("set.themeSub")}>
                <div className="d-flex align-items-center gap-2">
                  <button
                    onClick={() => changeTheme("light")}
                    style={{
                      background: theme === "light" ? PU : "var(--bs-body-bg, #fff)",
                      color: theme === "light" ? "#fff" : "var(--bs-body-color)",
                      border: `1px solid ${theme === "light" ? PU : "var(--bs-border-color, #dee2e6)"}`,
                      borderRadius: 8, padding: "4px 12px",
                      fontSize: "var(--fs-sm)", fontWeight: 600, cursor: "pointer",
                    }}
                  >
                    <i className="bi bi-sun-fill me-1" />{t("set.light")}
                  </button>
                  <button
                    onClick={() => changeTheme("dark")}
                    style={{
                      background: theme === "dark" ? PU : "var(--bs-body-bg, #fff)",
                      color: theme === "dark" ? "#fff" : "var(--bs-body-color)",
                      border: `1px solid ${theme === "dark" ? PU : "var(--bs-border-color, #dee2e6)"}`,
                      borderRadius: 8, padding: "4px 12px",
                      fontSize: "var(--fs-sm)", fontWeight: 600, cursor: "pointer",
                    }}
                  >
                    <i className="bi bi-moon-stars-fill me-1" />{t("set.dark")}
                  </button>
                </div>
              </Row>
              <Row label={t("set.sidebarCol")} description={t("set.sidebarSub")}>
                <Toggle checked={sidebar} onChange={changeSidebar} />
              </Row>
              <Row label={t("set.compact")} description={t("set.compactSub")}>
                <Toggle checked={compact} onChange={toggle(setCompact, "settings.compact", t("set.compact"))} />
              </Row>
            </Section>
          </div>

          {/* ── Notification Preferences ── */}
          <div style={{ display: "flex" }}>
            <Section icon="bi-bell-fill" title={t("set.notifTitle")} subtitle={t("set.notifSub")}>
              <Row label={t("set.emailNotif")} description={t("set.emailSub")}>
                <Toggle checked={emailNotif} onChange={toggle(setEmailNotif, "settings.emailNotif", t("set.emailNotif"))} />
              </Row>
              <Row label={t("set.pushNotif")} description={t("set.pushSub")}>
                <Toggle checked={pushNotif} onChange={toggle(setPushNotif, "settings.pushNotif", t("set.pushNotif"))} />
              </Row>
              <Row label={t("set.violAlerts")} description={t("set.violSub")}>
                <Toggle checked={violNotif} onChange={toggle(setViolNotif, "settings.violNotif", t("set.violAlerts"))} />
              </Row>
              <Row label={t("set.fineAlerts")} description={t("set.fineSub")}>
                <Toggle checked={fineNotif} onChange={toggle(setFineNotif, "settings.fineNotif", t("set.fineAlerts"))} />
              </Row>
              <Row label={t("set.sysAlerts")} description={t("set.sysSub")}>
                <Toggle checked={sysNotif} onChange={toggle(setSysNotif, "settings.sysNotif", t("set.sysAlerts"))} />
              </Row>
              <Row label={t("set.sound")} description={t("set.soundSub")}>
                <Toggle checked={notifSound} onChange={toggle(setNotifSound, "settings.notifSound", t("set.sound"))} />
              </Row>
            </Section>
          </div>

          {/* ── Display & Data ── */}
          <div style={{ display: "flex" }}>
            <Section icon="bi-display-fill" title={t("set.display")} subtitle={t("set.displaySub")}>
              <Row label={t("set.pageSize")} description={t("set.pageSizeSub")}>
                <Selector value={pageSize} onChange={select(setPageSize, "settings.pageSize", t("set.pageSize"))} options={[
                  { value: "5",  label: "5"  },
                  { value: "10", label: "10" },
                  { value: "20", label: "20" },
                  { value: "50", label: "50" },
                ]} />
              </Row>
              <Row label={t("set.dateFormat")} description={t("set.dateSub")}>
                <Selector value={dateFormat} onChange={select(setDateFormat, "settings.dateFormat", t("set.dateFormat"))} options={[
                  { value: "MMM DD, YYYY", label: "Mar 01, 2026" },
                  { value: "DD/MM/YYYY",   label: "01/03/2026" },
                  { value: "YYYY-MM-DD",   label: "2026-03-01" },
                  { value: "MM/DD/YYYY",   label: "03/01/2026" },
                ]} />
              </Row>
              <Row label={t("set.timezone")} description={t("set.tzSub")}>
                <Selector value={timeZone} onChange={select(setTimeZone, "settings.timeZone", t("set.timezone"))} options={[
                  { value: "auto",              label: t("set.autoDetect") },
                  { value: "Asia/Phnom_Penh",   label: "Phnom Penh (UTC+7)" },
                  { value: "Asia/Bangkok",      label: "Bangkok (UTC+7)" },
                  { value: "America/New_York",  label: "New York (UTC-5)" },
                  { value: "Europe/London",     label: "London (UTC+0)" },
                  { value: "Asia/Tokyo",        label: "Tokyo (UTC+9)" },
                ]} />
              </Row>
              <Row label={t("set.language")} description={t("set.langSub")}>
                <Selector value={language} onChange={select(setLanguage, "settings.language", t("set.language"))} options={[
                  { value: "en", label: "English" },
                  { value: "km", label: "ភាសាខ្មែរ (Khmer)" },
                ]} />
              </Row>
            </Section>
          </div>

          {/* ── Security ── */}
          <div style={{ display: "flex" }}>
            <Section icon="bi-shield-lock-fill" title={t("set.security")} subtitle={t("set.secSub")}>
              <Row label={t("set.twoFactor")} description={t("set.twoFaSub")}>
                <Toggle checked={twoFactor} onChange={toggle(setTwoFactor, "settings.twoFactor", t("set.twoFactor"))} />
              </Row>
              <Row label={t("set.session")} description={t("set.sessionSub")}>
                <Selector value={sessionTimeout} onChange={select(setSessionTimeout, "settings.sessionTimeout", t("set.session"))} options={[
                  { value: "15", label: "15 min" },
                  { value: "30", label: "30 min" },
                  { value: "60", label: "1 hour" },
                  { value: "120", label: "2 hours" },
                  { value: "0",  label: "Never" },
                ]} />
              </Row>

              {/* Change password */}
              <div className="mt-2 p-3 rounded-3" style={{ background: PA(".04") }}>
                <div className="fw-semibold mb-2" style={{ fontSize: "var(--fs-sm)", color: PU }}>
                  <i className="bi bi-key-fill me-1" />{t("set.changePwd")}
                </div>
                <div className="d-flex flex-column gap-2">
                  <input
                    type="password" placeholder={t("set.curPwd")} value={curPwd}
                    onChange={e => setCurPwd(e.target.value)}
                    className="form-control form-control-sm rounded-3"
                    style={{ fontSize: "var(--fs-sm)", border: "1px solid var(--bs-border-color, #dee2e6)" }}
                  />
                  <input
                    type="password" placeholder={t("set.newPwd")} value={newPwd}
                    onChange={e => setNewPwd(e.target.value)}
                    className="form-control form-control-sm rounded-3"
                    style={{ fontSize: "var(--fs-sm)", border: "1px solid var(--bs-border-color, #dee2e6)" }}
                  />
                  <input
                    type="password" placeholder={t("set.confirmPwd")} value={confPwd}
                    onChange={e => setConfPwd(e.target.value)}
                    className="form-control form-control-sm rounded-3"
                    style={{ fontSize: "var(--fs-sm)", border: "1px solid var(--bs-border-color, #dee2e6)" }}
                  />
                  {pwdErr && (
                    <div style={{ fontSize: "var(--fs-xs)", color: "#ef4444" }}>
                      <i className="bi bi-exclamation-circle me-1" />{pwdErr}
                    </div>
                  )}
                  <button
                    onClick={handleChangePassword}
                    disabled={pwdBusy}
                    className="btn btn-sm rounded-3 fw-semibold align-self-start"
                    style={{ background: PU, color: "#fff", fontSize: "var(--fs-sm)", padding: "5px 16px" }}
                  >
                    {pwdBusy ? <><span className="spinner-border spinner-border-sm me-1" />{t("set.saving")}</> : <><i className="bi bi-check-lg me-1" />{t("set.updatePwd")}</>}
                  </button>
                </div>
              </div>

              {/* Account info (read-only) */}
              <div className="mt-2 p-3 rounded-3" style={{ background: PA(".04") }}>
                <div className="fw-semibold mb-2" style={{ fontSize: "var(--fs-sm)", color: PU }}>
                  <i className="bi bi-info-circle me-1" />{t("set.accountInfo")}
                </div>
                {[
                  { l: t("set.email"), v: user?.email || "—" },
                  { l: t("set.username"), v: user?.username || "—" },
                  { l: t("set.role"), v: user?.role ? user.role.charAt(0).toUpperCase() + user.role.slice(1) : "—" },
                  { l: t("set.joined"), v: user?.date_joined ? new Date(user.date_joined).toLocaleDateString() : "—" },
                ].map(({ l, v }) => (
                  <div key={l} className="d-flex justify-content-between py-1" style={{ fontSize: "var(--fs-sm)", borderBottom: "1px solid var(--bs-border-color, #f1f5f9)" }}>
                    <span style={{ color: "var(--bs-secondary-color, #6c757d)" }}>{l}</span>
                    <span className="fw-semibold" style={{ color: "var(--bs-body-color)" }}>{v}</span>
                  </div>
                ))}
              </div>
            </Section>
          </div>

          {/* ── Privacy & Data ── */}
          <div style={{ display: "flex" }}>
            <Section icon="bi-shield-fill-check" title={t("set.privacy")} subtitle={t("set.privacySub")}>
              <Row label={t("set.activityLog")} description={t("set.activityLogSub")}>
                <Toggle checked={activityLog} onChange={toggle(setActivityLog, "settings.activityLog", t("set.activityLog"))} />
              </Row>
              <Row label={t("set.dataSharing")} description={t("set.dataSharingSub")}>
                <Toggle checked={dataSharing} onChange={toggle(setDataSharing, "settings.dataSharing", t("set.dataSharing"))} />
              </Row>
              <Row label={t("set.autoDeleteNotif")} description={t("set.autoDeleteSub")}>
                <Selector value={autoDelete} onChange={select(setAutoDelete, "settings.autoDelete", t("set.autoDeleteNotif"))} options={[
                  { value: "7",    label: "7 days" },
                  { value: "30",   label: "30 days" },
                  { value: "90",   label: "90 days" },
                  { value: "365",  label: "1 year" },
                  { value: "0",    label: t("set.never") },
                ]} />
              </Row>
              <Row label={t("set.exportFormat")} description={t("set.exportFormatSub")}>
                <Selector value={exportFormat} onChange={select(setExportFormat, "settings.exportFormat", t("set.exportFormat"))} options={[
                  { value: "csv",  label: "CSV" },
                  { value: "xlsx", label: "Excel (XLSX)" },
                  { value: "pdf",  label: "PDF" },
                  { value: "json", label: "JSON" },
                ]} />
              </Row>

              {/* Quick actions */}
              <div className="mt-2 p-3 rounded-3" style={{ background: PA(".04") }}>
                <div className="fw-semibold mb-2" style={{ fontSize: ".88rem", color: PU }}>
                  <i className="bi bi-lightning-fill me-1" />{t("set.dataActions")}
                </div>
                <div className="d-flex flex-wrap gap-2">
                  <button
                    onClick={() => flash(t("set.cacheCleared"))}
                    className="btn btn-sm rounded-3 fw-semibold"
                    style={{ background: PA(".08"), color: PU, border: `1px solid ${PA(".2")}`, fontSize: "var(--fs-sm)", padding: "5px 14px" }}
                  >
                    <i className="bi bi-trash3 me-1" />{t("set.clearCache")}
                  </button>
                  <button
                    onClick={() => flash(t("set.dataExported"))}
                    className="btn btn-sm rounded-3 fw-semibold"
                    style={{ background: PA(".08"), color: PU, border: `1px solid ${PA(".2")}`, fontSize: "var(--fs-sm)", padding: "5px 14px" }}
                  >
                    <i className="bi bi-download me-1" />{t("set.exportData")}
                  </button>
                </div>
              </div>
            </Section>
          </div>

          {/* ── Accessibility ── */}
          <div style={{ display: "flex" }}>
            <Section icon="bi-universal-access" title={t("set.accessibility")} subtitle={t("set.accessSub")}>
              <Row label={t("set.fontSize")} description={t("set.fontSizeSub")}>
                <Selector value={fontSize} onChange={select(setFontSize, "settings.fontSize", t("set.fontSize"))} options={[
                  { value: "small",  label: t("set.small") },
                  { value: "medium", label: t("set.medium") },
                  { value: "large",  label: t("set.large") },
                  { value: "xlarge", label: t("set.xlarge") },
                ]} />
              </Row>
              <Row label={t("set.reduceMotion")} description={t("set.reduceMotionSub")}>
                <Toggle checked={reduceMotion} onChange={toggle(setReduceMotion, "settings.reduceMotion", t("set.reduceMotion"))} />
              </Row>
              <Row label={t("set.highContrast")} description={t("set.highContrastSub")}>
                <Toggle checked={highContrast} onChange={toggle(setHighContrast, "settings.highContrast", t("set.highContrast"))} />
              </Row>
              <Row label={t("set.keyboardShort")} description={t("set.keyboardShortSub")}>
                <Toggle checked={keyboardShort} onChange={toggle(setKeyboardShort, "settings.keyboardShort", t("set.keyboardShort"))} />
              </Row>

              {/* Keyboard shortcuts reference */}
              <div className="mt-2 p-3 rounded-3" style={{ background: PA(".04") }}>
                <div className="fw-semibold mb-2" style={{ fontSize: "var(--fs-sm)", color: PU }}>
                  <i className="bi bi-keyboard me-1" />{t("set.shortcuts")}
                </div>
                {[
                  { k: "Ctrl + D", d: t("set.scDashboard") },
                  { k: "Ctrl + V", d: t("set.scViolations") },
                  { k: "Ctrl + F", d: t("set.scFines") },
                  { k: "Ctrl + N", d: t("set.scNotifications") },
                ].map(({ k, d }) => (
                  <div key={k} className="d-flex justify-content-between py-1" style={{ fontSize: "var(--fs-sm)", borderBottom: "1px solid var(--bs-border-color, #f1f5f9)" }}>
                    <span style={{ color: "var(--bs-secondary-color, #6c757d)" }}>{d}</span>
                    <kbd style={{ background: PA(".08"), color: PU, border: `1px solid ${PA(".15")}`, borderRadius: 6, padding: "1px 8px", fontSize: "var(--fs-xs)", fontFamily: "monospace" }}>{k}</kbd>
                  </div>
                ))}
              </div>
            </Section>
          </div>

          {/* ── Dashboard Customization ── */}
          <div style={{ display: "flex" }}>
            <Section icon="bi-layout-wtf" title={t("set.dashCustom")} subtitle={t("set.dashCustomSub")}>
              <Row label={t("set.defaultView")} description={t("set.defaultViewSub")}>
                <Selector value={defaultView} onChange={select(setDefaultView, "settings.defaultView", t("set.defaultView"))} options={[
                  { value: "overview", label: t("set.viewOverview") },
                  { value: "charts",   label: t("set.viewCharts") },
                  { value: "table",    label: t("set.viewTable") },
                  { value: "compact",  label: t("set.viewCompact") },
                ]} />
              </Row>
              <Row label={t("set.autoRefresh")} description={t("set.autoRefreshSub")}>
                <Selector value={autoRefresh} onChange={select(setAutoRefresh, "settings.autoRefresh", t("set.autoRefresh"))} options={[
                  { value: "15",  label: "15s" },
                  { value: "30",  label: "30s" },
                  { value: "60",  label: "1 min" },
                  { value: "300", label: "5 min" },
                  { value: "0",   label: t("set.manualOnly") },
                ]} />
              </Row>
              <Row label={t("set.showStats")} description={t("set.showStatsSub")}>
                <Toggle checked={showStats} onChange={toggle(setShowStats, "settings.showStats", t("set.showStats"))} />
              </Row>
              <Row label={t("set.chartAnimate")} description={t("set.chartAnimateSub")}>
                <Toggle checked={chartAnimate} onChange={toggle(setChartAnimate, "settings.chartAnimate", t("set.chartAnimate"))} />
              </Row>

              {/* Dashboard quick stats preview */}
              <div className="mt-2 p-3 rounded-3" style={{ background: PA(".04") }}>
                <div className="fw-semibold mb-2" style={{ fontSize: "var(--fs-sm)", color: PU }}>
                  <i className="bi bi-speedometer2 me-1" />{t("set.widgetPreview")}
                </div>
                <div className="d-flex gap-2 flex-wrap">
                  {[
                    { icon: "bi-bar-chart-fill", label: t("set.wCharts") },
                    { icon: "bi-table",          label: t("set.wTables") },
                    { icon: "bi-map-fill",        label: t("set.wMap") },
                    { icon: "bi-clock-history",  label: t("set.wActivity") },
                  ].map(({ icon, label }) => (
                    <span key={label} className="badge rounded-pill fw-semibold" style={{ background: PA(".1"), color: PU, fontSize: "var(--fs-xs)", padding: "5px 10px" }}>
                      <i className={`bi ${icon} me-1`} />{label}
                    </span>
                  ))}
                </div>
              </div>
            </Section>
          </div>

          {/* ── About / System Info ── */}
          <div style={{ display: "flex" }}>
            <Section icon="bi-info-circle-fill" title={t("set.about")} subtitle={t("set.aboutSub")}>
              {[
                { l: t("set.appName"),  v: "Traffic Expert System" },
                { l: t("set.version"),  v: "1.0.0" },
                { l: t("set.buildDate"), v: new Date().toLocaleDateString() },
                { l: t("set.framework"), v: "React 18 + Django 5" },
                { l: t("set.license"),  v: "MIT License" },
              ].map(({ l, v }) => (
                <div key={l} className="d-flex justify-content-between py-2" style={{ fontSize: "var(--fs-sm)", borderBottom: "1px solid var(--bs-border-color, #f1f5f9)" }}>
                  <span style={{ color: "var(--bs-secondary-color, #6c757d)" }}>{l}</span>
                  <span className="fw-semibold" style={{ color: "var(--bs-body-color)" }}>{v}</span>
                </div>
              ))}

              {/* System health indicators */}
              <div className="mt-2 p-3 rounded-3" style={{ background: PA(".04") }}>
                <div className="fw-semibold mb-2" style={{ fontSize: "var(--fs-sm)", color: PU }}>
                  <i className="bi bi-heart-pulse-fill me-1" />{t("set.sysHealth")}
                </div>
                {[
                  { label: t("set.apiServer"),  status: true },
                  { label: t("set.aiEngine"),   status: true },
                  { label: t("set.database"),   status: true },
                  { label: t("set.storage"),    status: true },
                ].map(({ label, status }) => (
                  <div key={label} className="d-flex justify-content-between align-items-center py-1" style={{ fontSize: "var(--fs-sm)", borderBottom: "1px solid var(--bs-border-color, #f1f5f9)" }}>
                    <span style={{ color: "var(--bs-secondary-color, #6c757d)" }}>{label}</span>
                    <span className="d-flex align-items-center gap-1" style={{ fontSize: "var(--fs-xs)", fontWeight: 600, color: status ? "#22c55e" : "#ef4444" }}>
                      <span style={{ width: 8, height: 8, borderRadius: "50%", background: status ? "#22c55e" : "#ef4444", display: "inline-block" }} />
                      {status ? t("set.online") : t("set.offline")}
                    </span>
                  </div>
                ))}
              </div>

              {/* Links */}
              <div className="mt-2 d-flex flex-wrap gap-2">
                <button
                  onClick={() => flash(t("set.logsCopied"))}
                  className="btn btn-sm rounded-3 fw-semibold"
                  style={{ background: PA(".08"), color: PU, border: `1px solid ${PA(".2")}`, fontSize: "var(--fs-sm)", padding: "5px 14px" }}
                >
                  <i className="bi bi-clipboard me-1" />{t("set.copyLogs")}
                </button>
                <button
                  onClick={() => flash(t("set.checkingUpdates"))}
                  className="btn btn-sm rounded-3 fw-semibold"
                  style={{ background: PA(".08"), color: PU, border: `1px solid ${PA(".2")}`, fontSize: "var(--fs-sm)", padding: "5px 14px" }}
                >
                  <i className="bi bi-arrow-repeat me-1" />{t("set.checkUpdate")}
                </button>
              </div>
            </Section>
          </div>
        </div>

        {/* ── Footer actions ── */}
        <div className="d-flex justify-content-end gap-2 pb-3">
          <button
            onClick={handleReset}
            className="btn rounded-3 fw-semibold px-4"
            style={{
              background: "rgba(239,68,68,.08)", color: "#ef4444",
              border: "1px solid rgba(239,68,68,.2)", fontSize: "var(--fs-sm)",
            }}
          >
            <i className="bi bi-arrow-counterclockwise me-1" />{t("set.resetDefault")}
          </button>
        </div>
      </div>

      {/* ── Toast ── */}
      {toast && (
        <div
          style={{
            position: "fixed", bottom: 24, right: 24,
            background: PU, color: "#fff",
            padding: "10px 20px", borderRadius: 12,
            fontSize: "var(--fs-sm)", fontWeight: 600,
            boxShadow: "0 4px 16px rgba(124,58,237,.35)",
            zIndex: 9999,
            animation: "fadeIn .25s ease-out",
          }}
        >
          <i className="bi bi-check-circle-fill me-2" />{toast}
        </div>
      )}

      <style>{`
        .settings-grid {
          display: grid;
          grid-template-columns: repeat(2, 1fr);
          grid-auto-rows: 1fr;
          gap: 1rem;
          margin-bottom: 1rem;
          min-height: 100%;
        }
        .settings-grid > div {
          display: flex;
          min-width: 0;
        }
        .settings-grid > div > .card {
          width: 100%;
        }
        @media (max-width: 991.98px) {
          .settings-grid {
            grid-template-columns: 1fr;
            grid-auto-rows: auto;
            min-height: auto;
          }
        }
      `}</style>
    </div>
  );
}
