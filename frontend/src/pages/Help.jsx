import { useCallback, useEffect, useRef, useState } from "react";
import { useSearchParams } from "react-router-dom";
import { useLanguage } from "../i18n/LanguageContext.jsx";
import { createIssueReport } from "../services/supportService.js";
import "./Help.css";

/* ── FAQ data ── */
const FAQ_KEYS = [
  "help.faq1", "help.faq2", "help.faq3", "help.faq4",
  "help.faq5", "help.faq6", "help.faq7", "help.faq8",
];

/* ── Keyboard Shortcuts ── */
const SHORTCUTS = [
  { keys: ["Ctrl", "D"], desc: "help.kbDashboard" },
  { keys: ["Ctrl", "V"], desc: "help.kbViolations" },
  { keys: ["Ctrl", "F"], desc: "help.kbFines" },
  { keys: ["Ctrl", "N"], desc: "help.kbNotifications" },
  { keys: ["Ctrl", "/"], desc: "help.kbSearch" },
  { keys: ["Esc"],       desc: "help.kbCloseModal" },
];

/* ── Quick-start steps ── */
const QUICKSTART_KEYS = [
  { icon: "bi-person-plus-fill",       color: "#7c3aed", key: "help.qs1" },
  { icon: "bi-shield-lock-fill",       color: "#2563eb", key: "help.qs2" },
  { icon: "bi-car-front-fill",         color: "#f59e0b", key: "help.qs3" },
  { icon: "bi-camera-reels-fill",      color: "#16a34a", key: "help.qs4" },
  { icon: "bi-bar-chart-line-fill",    color: "#dc2626", key: "help.qs5" },
];

/* ── Contact / Resource cards ── */
const RESOURCE_CARDS = [
  { icon: "bi-flag-fill",            color: "#f87171", titleKey: "help.reportTitle",    descKey: "help.reportDesc",    action: "report" },
  { icon: "bi-journal-text",         color: "#34d399", titleKey: "help.docsTitle",      descKey: "help.docsDesc",      action: "docs" },
  { icon: "bi-people-fill",          color: "#38bdf8", titleKey: "help.communityTitle", descKey: "help.communityDesc", action: "community" },
  { icon: "bi-envelope-paper-fill",  color: "#a78bfa", titleKey: "help.contactTitle",   descKey: "help.contactDesc",   action: "contact" },
];

export default function Help() {
  const { t } = useLanguage();
  const [searchParams] = useSearchParams();
  const [search, setSearch] = useState("");
  const [openFaq, setOpenFaq] = useState(null);
  const validTabs = ["faq", "quickstart", "shortcuts", "resources"];
  const initialTab = validTabs.includes(searchParams.get("tab")) ? searchParams.get("tab") : "faq";
  const [activeTab, setActiveTab] = useState(initialTab);

  const tabsRef = useRef(null);
  const [canScrollL, setCanScrollL] = useState(false);
  const [canScrollR, setCanScrollR] = useState(false);

  /* ── Report-Issue modal state ── */
  const [showReport, setShowReport] = useState(false);
  const [reportForm, setReportForm] = useState({ type: "bug", priority: "medium", subject: "", description: "" });
  const [reportFile, setReportFile] = useState(null);
  const [reportPreview, setReportPreview] = useState(null);
  const [reportLoading, setReportLoading] = useState(false);
  const [reportMsg, setReportMsg] = useState(null);   // { ok: bool, text }
  const fileRef = useRef(null);

  const checkScroll = useCallback(() => {
    const el = tabsRef.current;
    if (!el) return;
    setCanScrollL(el.scrollLeft > 2);
    setCanScrollR(el.scrollLeft + el.clientWidth < el.scrollWidth - 2);
  }, []);

  useEffect(() => {
    const el = tabsRef.current;
    if (!el) return;
    checkScroll();
    el.addEventListener("scroll", checkScroll, { passive: true });
    const ro = new ResizeObserver(checkScroll);
    ro.observe(el);
    return () => { el.removeEventListener("scroll", checkScroll); ro.disconnect(); };
  }, [checkScroll]);

  const scrollTabs = (dir) => {
    const el = tabsRef.current;
    if (!el) return;
    el.scrollBy({ left: dir * 160, behavior: "smooth" });
  };

  /* filter FAQ by search */
  const filteredFaq = FAQ_KEYS.filter((k) => {
    if (!search.trim()) return true;
    const q = t(`${k}Q`).toLowerCase();
    const a = t(`${k}A`).toLowerCase();
    return q.includes(search.toLowerCase()) || a.includes(search.toLowerCase());
  });

  /* ── Report‑Issue helpers ── */
  const openReportModal = () => {
    setReportForm({ type: "bug", priority: "medium", subject: "", description: "" });
    setReportFile(null);
    setReportPreview(null);
    setReportMsg(null);
    setShowReport(true);
  };

  /* Auto-open report modal when ?action=report */
  useEffect(() => {
    if (searchParams.get("action") === "report") {
      setActiveTab("resources");
      openReportModal();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const closeReportModal = () => {
    if (reportLoading) return;
    setShowReport(false);
  };

  const handleReportField = (key, value) => setReportForm((f) => ({ ...f, [key]: value }));

  const handleScreenshot = (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setReportFile(file);
    const reader = new FileReader();
    reader.onload = () => setReportPreview(reader.result);
    reader.readAsDataURL(file);
  };

  const removeScreenshot = () => {
    setReportFile(null);
    setReportPreview(null);
    if (fileRef.current) fileRef.current.value = "";
  };

  const handleReportSubmit = async (e) => {
    e.preventDefault();
    setReportLoading(true);
    setReportMsg(null);
    try {
      const fd = new FormData();
      fd.append("type", reportForm.type);
      fd.append("priority", reportForm.priority);
      fd.append("subject", reportForm.subject);
      fd.append("description", reportForm.description);
      if (reportFile) fd.append("screenshot", reportFile);
      await createIssueReport(fd);
      setReportMsg({ ok: true, text: t("report.success") });
      setTimeout(() => setShowReport(false), 1800);
    } catch {
      setReportMsg({ ok: false, text: t("report.error") });
    } finally {
      setReportLoading(false);
    }
  };

  /* Resource card click dispatcher */
  const handleResourceClick = (action) => {
    if (action === "report") openReportModal();
    if (action === "docs") window.open("https://docs.example.com", "_blank");
    if (action === "community") window.open("https://community.example.com", "_blank");
    if (action === "contact") window.location.href = "mailto:support@trafficsystem.com";
  };

  return (
    <div className="help-page">
      {/* ── Header ── */}
      <div className="help-hero">
        <div className="help-hero-icon">
          <i className="bi bi-life-preserver" />
        </div>
        <h2 className="help-hero-title">{t("help.title")}</h2>
        <p className="help-hero-sub">{t("help.subtitle")}</p>

        {/* Search */}
        <div className="help-search">
          <i className="bi bi-search help-search-icon" />
          <input
            type="text"
            placeholder={t("help.searchPlaceholder")}
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
          {search && (
            <button className="help-search-clear" onClick={() => setSearch("")}>
              <i className="bi bi-x-lg" />
            </button>
          )}
        </div>
      </div>

      {/* ── Tabs ── */}
      <div className="help-tabs-wrapper">
        <button
          className={`help-tabs-arrow help-tabs-arrow--left ${canScrollL ? "" : "hidden"}`}
          onClick={() => scrollTabs(-1)}
          aria-label="Scroll left"
        >
          <i className="bi bi-chevron-left" />
        </button>

        <div className="help-tabs" ref={tabsRef}>
          {[
            { key: "faq",        icon: "bi-question-circle-fill", label: t("help.tabFaq") },
            { key: "quickstart", icon: "bi-rocket-takeoff-fill",  label: t("help.tabQuickstart") },
            { key: "shortcuts",  icon: "bi-keyboard-fill",        label: t("help.tabShortcuts") },
            { key: "resources",  icon: "bi-box-fill",             label: t("help.tabResources") },
          ].map((tab) => (
            <button
              key={tab.key}
              className={`help-tab ${activeTab === tab.key ? "active" : ""}`}
              onClick={() => setActiveTab(tab.key)}
            >
              <i className={`bi ${tab.icon}`} />
              {tab.label}
            </button>
          ))}
        </div>

        <button
          className={`help-tabs-arrow help-tabs-arrow--right ${canScrollR ? "" : "hidden"}`}
          onClick={() => scrollTabs(1)}
          aria-label="Scroll right"
        >
          <i className="bi bi-chevron-right" />
        </button>
      </div>

      {/* ── Tab content ── */}
      <div className="help-content">

        {/* ─── FAQ ─── */}
        {activeTab === "faq" && (
          <div className="help-faq-section">
            {filteredFaq.length === 0 ? (
              <div className="help-empty">
                <i className="bi bi-search" />
                <p>{t("help.noResults")}</p>
              </div>
            ) : (
              filteredFaq.map((k, i) => (
                <div
                  key={k}
                  className={`help-faq-item ${openFaq === i ? "open" : ""}`}
                >
                  <button
                    className="help-faq-q"
                    onClick={() => setOpenFaq(openFaq === i ? null : i)}
                  >
                    <div className="help-faq-num">{String(i + 1).padStart(2, "0")}</div>
                    <span>{t(`${k}Q`)}</span>
                    <i className={`bi bi-chevron-down help-faq-arrow ${openFaq === i ? "open" : ""}`} />
                  </button>
                  {openFaq === i && (
                    <div className="help-faq-a">
                      <p>{t(`${k}A`)}</p>
                    </div>
                  )}
                </div>
              ))
            )}
          </div>
        )}

        {/* ─── Quick Start ─── */}
        {activeTab === "quickstart" && (
          <div className="help-qs-section">
            <div className="help-qs-timeline">
              {QUICKSTART_KEYS.map(({ icon, color, key }, i) => (
                <div key={key} className="help-qs-step">
                  <div className="help-qs-marker" style={{ background: color }}>
                    <i className={`bi ${icon}`} />
                  </div>
                  <div className="help-qs-body">
                    <div className="help-qs-label">{t("help.step")} {i + 1}</div>
                    <h6 className="help-qs-title">{t(`${key}T`)}</h6>
                    <p className="help-qs-desc">{t(`${key}D`)}</p>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* ─── Keyboard Shortcuts ─── */}
        {activeTab === "shortcuts" && (
          <div className="help-kb-section">
            <div className="help-kb-grid">
              {SHORTCUTS.map(({ keys, desc }) => (
                <div key={desc} className="help-kb-item">
                  <div className="help-kb-keys">
                    {keys.map((k, i) => (
                      <span key={i}>
                        <kbd>{k}</kbd>
                        {i < keys.length - 1 && <span className="help-kb-plus">+</span>}
                      </span>
                    ))}
                  </div>
                  <span className="help-kb-desc">{t(desc)}</span>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* ─── Resources ─── */}
        {activeTab === "resources" && (
          <div className="help-res-section">
            <div className="help-res-grid">
              {RESOURCE_CARDS.map(({ icon, color, titleKey, descKey, action }) => (
                <button
                  key={titleKey}
                  className="help-res-card"
                  onClick={() => handleResourceClick(action)}
                >
                  <div className="help-res-icon" style={{ background: `${color}15`, color }}>
                    <i className={`bi ${icon}`} />
                  </div>
                  <h6 className="help-res-title">{t(titleKey)}</h6>
                  <p className="help-res-desc">{t(descKey)}</p>
                </button>
              ))}
            </div>
          </div>
        )}
      </div>

      {/* ── Report Issue Modal ── */}
      {showReport && (
        <div className="rpt-overlay" onClick={closeReportModal}>
          <div className="rpt-modal" onClick={(e) => e.stopPropagation()}>
            {/* Header */}
            <div className="rpt-header">
              <div className="rpt-header-icon">
                <i className="bi bi-flag-fill" />
              </div>
              <div>
                <h5 className="rpt-title">{t("report.modalTitle")}</h5>
                <p className="rpt-subtitle">{t("report.modalSub")}</p>
              </div>
              <button className="rpt-close" onClick={closeReportModal}>
                <i className="bi bi-x-lg" />
              </button>
            </div>

            {/* Success / error banner */}
            {reportMsg && (
              <div className={`rpt-banner ${reportMsg.ok ? "rpt-banner--ok" : "rpt-banner--err"}`}>
                <i className={`bi ${reportMsg.ok ? "bi-check-circle-fill" : "bi-exclamation-circle-fill"}`} />
                {reportMsg.text}
              </div>
            )}

            {/* Form */}
            {!reportMsg?.ok && (
              <form className="rpt-form" onSubmit={handleReportSubmit}>
                {/* Type + Priority row */}
                <div className="rpt-row">
                  <div className="rpt-field">
                    <label>{t("report.type")}</label>
                    <div className="rpt-chips">
                      {[
                        { val: "bug",     label: t("report.typeBug"),     icon: "bi-bug-fill",              color: "#ef4444" },
                        { val: "feature", label: t("report.typeFeature"), icon: "bi-lightbulb-fill",        color: "#f59e0b" },
                        { val: "ui",      label: t("report.typeUi"),      icon: "bi-palette-fill",          color: "#3b82f6" },
                        { val: "other",   label: t("report.typeOther"),   icon: "bi-three-dots",            color: "#64748b" },
                      ].map(({ val, label, icon, color }) => (
                        <button
                          type="button"
                          key={val}
                          className={`rpt-chip ${reportForm.type === val ? "active" : ""}`}
                          style={reportForm.type === val ? { background: `${color}15`, borderColor: color, color } : {}}
                          onClick={() => handleReportField("type", val)}
                        >
                          <i className={`bi ${icon}`} />
                          {label}
                        </button>
                      ))}
                    </div>
                  </div>
                  <div className="rpt-field">
                    <label>{t("report.priority")}</label>
                    <div className="rpt-chips">
                      {[
                        { val: "low",    label: t("report.prioLow"),    color: "#22c55e" },
                        { val: "medium", label: t("report.prioMedium"), color: "#f59e0b" },
                        { val: "high",   label: t("report.prioHigh"),   color: "#ef4444" },
                      ].map(({ val, label, color }) => (
                        <button
                          type="button"
                          key={val}
                          className={`rpt-chip ${reportForm.priority === val ? "active" : ""}`}
                          style={reportForm.priority === val ? { background: `${color}15`, borderColor: color, color } : {}}
                          onClick={() => handleReportField("priority", val)}
                        >
                          {label}
                        </button>
                      ))}
                    </div>
                  </div>
                </div>

                {/* Subject */}
                <div className="rpt-field">
                  <label>{t("report.subject")}</label>
                  <input
                    type="text"
                    className="rpt-input"
                    placeholder={t("report.subjectPh")}
                    value={reportForm.subject}
                    onChange={(e) => handleReportField("subject", e.target.value)}
                    required
                    maxLength={255}
                  />
                </div>

                {/* Description */}
                <div className="rpt-field">
                  <label>{t("report.description")}</label>
                  <textarea
                    className="rpt-textarea"
                    placeholder={t("report.descriptionPh")}
                    value={reportForm.description}
                    onChange={(e) => handleReportField("description", e.target.value)}
                    required
                    rows={5}
                    maxLength={2000}
                  />
                  <span className="rpt-charcount">
                    {reportForm.description.length}/2000 {t("report.charCount")}
                  </span>
                </div>

                {/* Screenshot upload */}
                <div className="rpt-field">
                  <label>{t("report.screenshot")}</label>
                  {reportPreview ? (
                    <div className="rpt-preview">
                      <img src={reportPreview} alt="preview" />
                      <button type="button" className="rpt-preview-rm" onClick={removeScreenshot}>
                        <i className="bi bi-x-lg" />
                      </button>
                    </div>
                  ) : (
                    <div className="rpt-drop" onClick={() => fileRef.current?.click()}>
                      <i className="bi bi-cloud-arrow-up" />
                      <span>{t("report.screenshotHint")}</span>
                    </div>
                  )}
                  <input
                    ref={fileRef}
                    type="file"
                    accept="image/*"
                    style={{ display: "none" }}
                    onChange={handleScreenshot}
                  />
                </div>

                {/* Actions */}
                <div className="rpt-actions">
                  <button type="button" className="rpt-btn rpt-btn--cancel" onClick={closeReportModal}>
                    {t("report.cancel")}
                  </button>
                  <button
                    type="submit"
                    className="rpt-btn rpt-btn--submit"
                    disabled={reportLoading || !reportForm.subject.trim() || !reportForm.description.trim()}
                  >
                    {reportLoading ? (
                      <><i className="bi bi-arrow-repeat rpt-spin" /> {t("report.submitting")}</>
                    ) : (
                      <><i className="bi bi-send-fill" /> {t("report.submit")}</>
                    )}
                  </button>
                </div>
              </form>
            )}
          </div>
        </div>
      )}

      {/* ── Version footer ── */}
      <div className="help-footer">
        <span>{t("help.version")}</span>
        <span>•</span>
        <span>{t("help.lastUpdated")}</span>
      </div>
    </div>
  );
}
