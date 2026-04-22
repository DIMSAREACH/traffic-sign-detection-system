import { useCallback, useEffect, useRef, useState } from "react";
import Paginator from "../components/Paginator.jsx";
import { useAuth } from "../context/AuthContext.jsx";
import { useLanguage } from "../i18n/LanguageContext.jsx";
import { listDetectionLogs, deleteDetectionLog } from "../services/aiService.js";

const getPageSize = () => { try { return parseInt(JSON.parse(localStorage.getItem("settings.pageSize"))) || 10; } catch { return 10; } };

const PU = "#7c3aed";
const PA = (a) => `rgba(124,58,237,${a})`;

/* ── small helper badges ── */
function ConfBadge({ score }) {
  const pct = Math.round(score * 100);
  const color = pct >= 80 ? "#16a34a" : pct >= 50 ? "#d97706" : "#dc2626";
  const bg    = pct >= 80 ? "rgba(22,163,74,.12)" : pct >= 50 ? "rgba(245,158,11,.12)" : "rgba(239,68,68,.12)";
  return (
    <span className="d-inline-flex align-items-center gap-1 px-2 py-1 rounded-2 fw-semibold"
      style={{ background: bg, color, fontSize: ".9rem" }}>
      <i className="bi bi-bullseye" style={{ fontSize: ".8rem" }} />{pct}%
    </span>
  );
}

function ProcessedBadge({ processed, t }) {
  return processed
    ? <span className="d-inline-flex align-items-center gap-1 px-2 py-1 rounded-2 fw-semibold"
        style={{ background: "rgba(22,163,74,.12)", color: "#16a34a", fontSize: ".9rem" }}>
        <i className="bi bi-check-circle-fill" style={{ fontSize: ".8rem" }} />{t("aiH.yes")}
      </span>
    : <span className="d-inline-flex align-items-center gap-1 px-2 py-1 rounded-2 fw-semibold"
        style={{ background: "rgba(148,163,184,.12)", color: "#64748b", fontSize: ".9rem" }}>
        <i className="bi bi-dash-circle" style={{ fontSize: ".8rem" }} />{t("aiH.no")}
      </span>;
}

export default function AIHistory() {
  const { user } = useAuth();
  const { t } = useLanguage();
  const admin = user?.role === "admin";

  const [logs,       setLogs]       = useState([]);
  const [loading,    setLoading]    = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [search,     setSearch]     = useState("");
  const [filter,     setFilter]     = useState("all");   // all | processed | unprocessed
  const [page,       setPage]       = useState(1);
  const [total,      setTotal]      = useState(0);
  const searchTimer = useRef(null);
  const [debouncedSearch, setDebouncedSearch] = useState("");

  /* ── Detail modal ── */
  const [detail,     setDetail]     = useState(null);
  const [photoZoom,  setPhotoZoom]  = useState(false);

  /* ── Delete confirmation ── */
  const [deleteTarget, setDeleteTarget] = useState(null);
  const [deleting,     setDeleting]     = useState(false);

  /* ── Load data ── */
  const load = useCallback((pg = page, q = debouncedSearch, f = filter, isRefresh = false) => {
    if (isRefresh) setRefreshing(true);
    else           setLoading(true);
    const params = { page: pg, page_size: getPageSize() };
    if (f === "processed")   params.processed = "true";
    if (f === "unprocessed") params.processed = "false";
    if (q) params.search = q;
    listDetectionLogs(params)
      .then((d) => {
        setLogs(d.results ?? d ?? []);
        setTotal(d.count ?? (d.results?.length ?? (Array.isArray(d) ? d.length : 0)));
      })
      .catch(() => {})
      .finally(() => { setLoading(false); setRefreshing(false); });
  }, []); // eslint-disable-line

  useEffect(() => { load(1, "", "all"); }, []); // eslint-disable-line

  useEffect(() => {
    clearTimeout(searchTimer.current);
    searchTimer.current = setTimeout(() => setDebouncedSearch(search), 350);
    return () => clearTimeout(searchTimer.current);
  }, [search]);

  const isFirstRender = useRef(true);
  useEffect(() => {
    if (isFirstRender.current) { isFirstRender.current = false; return; }
    setPage(1);
    load(1, debouncedSearch, filter);
  }, [filter, debouncedSearch]); // eslint-disable-line

  const prevPage = useRef(1);
  useEffect(() => {
    if (prevPage.current === page) return;
    prevPage.current = page;
    load(page, debouncedSearch, filter, true);
  }, [page]); // eslint-disable-line

  /* ── Delete handler ── */
  const handleDelete = async () => {
    if (!deleteTarget) return;
    setDeleting(true);
    try {
      await deleteDetectionLog(deleteTarget.id);
      setDeleteTarget(null);
      if (detail?.id === deleteTarget.id) { setDetail(null); }
      load(page, debouncedSearch, filter, true);
    } catch { /* keep dialog */ }
    finally { setDeleting(false); }
  };

  const FILTERS = [
    { key: "all",         label: t("aiH.all"),         color: PU        },
    { key: "processed",   label: t("aiH.processed"),   color: "#16a34a" },
    { key: "unprocessed", label: t("aiH.unprocessed"), color: "#d97706" },
  ];

  return (
    <div className="d-flex flex-column gap-3 p-3" style={{ flex: 1, minHeight: 0, overflow: "hidden" }}>

      {/* ── Page header ── */}
      <div className="d-flex align-items-center justify-content-between flex-shrink-0">
        <div>
          <h5 className="fw-bold mb-0" style={{ color: "var(--bs-body-color)", fontSize: "1.5rem" }}>
            <i className="bi bi-clock-history me-2" style={{ color: PU }} />
            {t("aiH.title")}
          </h5>
          <p className="mb-0 text-secondary" style={{ fontSize: "1rem" }}>{t("aiH.subtitle")}</p>
        </div>
        <button className="btn rounded-3 d-flex align-items-center gap-2 fw-semibold"
          style={{ background: PA(".1"), color: PU, border: "none", fontSize: "1.05rem",
            opacity: refreshing ? .7 : 1, transition: "opacity .2s, transform .12s" }}
          disabled={refreshing}
          onMouseDown={(e) => { if (!refreshing) e.currentTarget.style.transform = "scale(.93)"; }}
          onMouseUp={(e)   => e.currentTarget.style.transform = "scale(1)"}
          onMouseLeave={(e) => e.currentTarget.style.transform = "scale(1)"}
          onClick={() => load(page, debouncedSearch, filter, true)}>
          <i className="bi bi-arrow-clockwise"
            style={refreshing ? { display: "inline-block", animation: "spin .65s linear infinite" } : {}} />
          {refreshing ? t("aiH.refreshing") : t("aiH.refresh")}
        </button>
      </div>

      {/* ── Filters + search ── */}
      <div className="d-flex align-items-center gap-2 flex-wrap flex-shrink-0">
        {FILTERS.map(({ key, label, color }) => (
          <button key={key} onClick={() => setFilter(key)}
            className="btn d-flex align-items-center gap-2 rounded-3 fw-semibold"
            onMouseDown={(e) => e.currentTarget.style.transform = "scale(.95)"}
            onMouseUp={(e)   => e.currentTarget.style.transform = "scale(1)"}
            onMouseLeave={(e) => e.currentTarget.style.transform = "scale(1)"}
            style={{
              padding: ".45rem 1rem", fontSize: "1rem",
              background: filter === key ? color : "var(--bs-body-bg)",
              color:      filter === key ? "#fff" : "var(--bs-secondary-color)",
              border:     `1.5px solid ${filter === key ? color : "var(--bs-border-color)"}`,
              transition: "all .15s",
            }}>
            {label}
          </button>
        ))}
        <div className="ms-auto input-group rounded-3 overflow-hidden"
          style={{ maxWidth: 280, border: "1.5px solid #e4dcf8", boxShadow: "none" }}>
          <span className="input-group-text bg-transparent border-0">
            <i className="bi bi-search" style={{ color: PU, fontSize: "1.05rem" }} />
          </span>
          <input type="text" className="form-control border-0 shadow-none"
            placeholder={t("aiH.search")} value={search}
            onChange={(e) => setSearch(e.target.value)}
            style={{ fontSize: "1.05rem" }} />
        </div>
      </div>

      {/* ── Table card ── */}
      <div className="card border-0 rounded-4 d-flex flex-column flex-fill"
        style={{ minHeight: 0, overflow: "hidden", boxShadow: "0 2px 16px rgba(124,58,237,.09)" }}>

        <div className="flex-fill overflow-auto no-scrollbar" style={{ minHeight: 0 }}>
          <table className="table mb-0" style={{ fontSize: "1.07rem" }}>
            <thead style={{ position: "sticky", top: 0, zIndex: 2 }}>
              <tr style={{ background: "#f8f5ff", borderBottom: `2px solid ${PA(".12")}` }}>
                <th className="px-4 py-3 fw-semibold" style={{ color: PU, width: 70 }}>#</th>
                <th className="px-4 py-3 fw-semibold" style={{ color: PU }}>{t("aiH.object")}</th>
                <th className="px-4 py-3 fw-semibold" style={{ color: PU }}>{t("aiH.confidence")}</th>
                <th className="px-4 py-3 fw-semibold" style={{ color: PU }}>{t("aiH.camera")}</th>
                <th className="px-4 py-3 fw-semibold" style={{ color: PU }}>{t("aiH.processedCol")}</th>
                <th className="px-4 py-3 fw-semibold" style={{ color: PU }}>{t("aiH.detectedAt")}</th>
                <th className="px-4 py-3 fw-semibold text-end" style={{ color: PU }}>{t("aiH.actions")}</th>
              </tr>
            </thead>

            <tbody style={{ opacity: refreshing ? .55 : 1, transition: "opacity .3s" }}>
              {/* loading */}
              {loading && (
                <tr>
                  <td colSpan={7} className="text-center py-5">
                    <div className="spinner-border" style={{ color: PU, width: 40, height: 40 }} role="status">
                      <span className="visually-hidden">Loading...</span>
                    </div>
                  </td>
                </tr>
              )}

              {/* empty */}
              {!loading && logs.length === 0 && (
                <tr>
                  <td colSpan={7} className="text-center py-5">
                    <div className="d-flex flex-column align-items-center gap-2">
                      <div className="rounded-circle d-flex align-items-center justify-content-center"
                        style={{ width: 64, height: 64, background: PA(".08") }}>
                        <i className="bi bi-inbox" style={{ fontSize: "1.8rem", color: PU }} />
                      </div>
                      <span className="fw-semibold" style={{ color: "var(--bs-body-color)", fontSize: "1.15rem" }}>{t("aiH.noResults")}</span>
                      <span className="text-secondary" style={{ fontSize: "1rem" }}>{t("aiH.noResultsSub")}</span>
                    </div>
                  </td>
                </tr>
              )}

              {/* rows */}
              {!loading && logs.map((item) => (
                <tr key={item.id}
                  style={{ borderBottom: "1px solid #f3f0ff", transition: "background .15s" }}
                  onMouseOver={(e) => e.currentTarget.style.background = "#faf8ff"}
                  onMouseOut={(e)  => e.currentTarget.style.background = ""}>
                  <td className="px-4 py-3 fw-bold" style={{ color: PU }}>#{item.id}</td>
                  <td className="px-4 py-3 fw-semibold" style={{ color: "var(--bs-body-color)", textTransform: "capitalize" }}>
                    {(item.detected_object || "—").replace(/_/g, " ")}
                  </td>
                  <td className="px-4 py-3"><ConfBadge score={item.confidence_score} /></td>
                  <td className="px-4 py-3 text-secondary">{item.camera_name || "—"}</td>
                  <td className="px-4 py-3"><ProcessedBadge processed={item.processed} t={t} /></td>
                  <td className="px-4 py-3 text-secondary">
                    {item.detected_at ? new Date(item.detected_at).toLocaleString() : "—"}
                  </td>
                  <td className="px-4 py-3 text-end d-flex align-items-center justify-content-end gap-2">
                    <button
                      className="btn btn-sm rounded-2 d-inline-flex align-items-center gap-1 fw-semibold"
                      style={{ background: "rgba(59,130,246,.1)", color: "#3b82f6", border: "none", fontSize: "1rem",
                        transition: "transform .12s" }}
                      onMouseDown={(e) => e.currentTarget.style.transform = "scale(.93)"}
                      onMouseUp={(e)   => e.currentTarget.style.transform = "scale(1)"}
                      onMouseLeave={(e) => e.currentTarget.style.transform = "scale(1)"}
                      onClick={() => { setDetail(item); setPhotoZoom(false); }}>
                      <i className="bi bi-eye" />{t("aiH.view")}
                    </button>
                    {admin && (
                      <button
                        className="btn btn-sm rounded-2 d-inline-flex align-items-center gap-1 fw-semibold"
                        style={{ background: "rgba(239,68,68,.08)", color: "#dc2626", border: "none", fontSize: "1rem",
                          transition: "transform .12s" }}
                        onMouseDown={(e) => e.currentTarget.style.transform = "scale(.93)"}
                        onMouseUp={(e)   => e.currentTarget.style.transform = "scale(1)"}
                        onMouseLeave={(e) => e.currentTarget.style.transform = "scale(1)"}
                        onClick={() => setDeleteTarget(item)}>
                        <i className="bi bi-trash3" />
                      </button>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {/* paginator */}
        <Paginator
          page={page}
          total={total}
          pageSize={getPageSize()}
          onChange={setPage}
          loading={loading || refreshing}
        />
      </div>

      {/* ═══════════════ Detail Modal ═══════════════ */}
      {detail && (
        <div
          onClick={() => setDetail(null)}
          style={{
            position: "fixed", inset: 0, zIndex: 1050,
            background: "rgba(0,0,0,.45)", display: "flex",
            alignItems: "center", justifyContent: "center",
            animation: "fadeIn .18s ease",
          }}>
          <div
            onClick={(e) => e.stopPropagation()}
            style={{
              background: "var(--bs-body-bg, #fff)", borderRadius: 20,
              width: "min(94vw, 620px)", maxHeight: "90vh",
              display: "flex", flexDirection: "column",
              boxShadow: "0 12px 48px rgba(124,58,237,.18)",
              animation: "slideUp .22s ease", overflow: "hidden",
            }}>

            {/* Header */}
            <div style={{
              padding: "20px 28px 16px", borderBottom: `1px solid ${PA(".1")}`,
              display: "flex", alignItems: "center", justifyContent: "space-between",
            }}>
              <div className="d-flex align-items-center gap-2">
                <div style={{
                  width: 38, height: 38, borderRadius: 10, background: PA(".1"),
                  display: "flex", alignItems: "center", justifyContent: "center",
                }}>
                  <i className="bi bi-cpu-fill" style={{ color: PU, fontSize: "1.1rem" }} />
                </div>
                <div>
                  <h6 className="fw-bold mb-0" style={{ color: PU, fontSize: "1.15rem" }}>
                    {t("aiH.detailTitle")} #{detail.id}
                  </h6>
                  <span className="text-secondary" style={{ fontSize: ".85rem" }}>{t("aiH.detailSub")}</span>
                </div>
              </div>
              <button className="btn btn-sm p-1" onClick={() => setDetail(null)}
                style={{ background: "none", border: "none", fontSize: "1.3rem", color: "#94a3b8", lineHeight: 1 }}>
                <i className="bi bi-x-lg" />
              </button>
            </div>

            {/* Body */}
            <div style={{ flex: 1, overflowY: "auto", padding: "20px 28px 24px" }}>
              {/* Evidence image */}
              {detail.image_url && (
                <div style={{ marginBottom: 20 }}>
                  <label className="fw-semibold d-block mb-1" style={{ color: PU, fontSize: ".92rem" }}>
                    <i className="bi bi-image-fill me-1" />{t("aiH.image")}
                  </label>
                  <div style={{
                    position: "relative", borderRadius: 14, overflow: "hidden",
                    border: `1.5px solid ${PA(".12")}`, background: "#f8f5ff", cursor: "pointer",
                  }}
                    onClick={() => setPhotoZoom(!photoZoom)}>
                    <img src={detail.image_url} alt="Detection"
                      style={{
                        width: "100%", display: "block",
                        maxHeight: photoZoom ? "none" : 220,
                        objectFit: photoZoom ? "contain" : "cover",
                        transition: "max-height .3s ease",
                      }}
                      onError={(e) => { e.target.style.display = "none"; }} />
                    <div style={{
                      position: "absolute", bottom: 8, right: 8,
                      background: "rgba(0,0,0,.5)", color: "#fff",
                      borderRadius: 8, padding: "2px 8px", fontSize: ".78rem",
                    }}>
                      <i className={`bi ${photoZoom ? "bi-arrows-angle-contract" : "bi-arrows-angle-expand"}`} />
                    </div>
                  </div>
                </div>
              )}

              {/* Info grid */}
              <div className="row g-3">
                <div className="col-sm-6">
                  <label className="fw-semibold mb-1" style={{ color: "#64748b", fontSize: ".85rem" }}>{t("aiH.object")}</label>
                  <div className="fw-semibold" style={{ fontSize: "1.02rem", textTransform: "capitalize" }}>
                    {(detail.detected_object || "—").replace(/_/g, " ")}
                  </div>
                </div>
                <div className="col-sm-6">
                  <label className="fw-semibold mb-1" style={{ color: "#64748b", fontSize: ".85rem" }}>{t("aiH.confidence")}</label>
                  <div><ConfBadge score={detail.confidence_score} /></div>
                </div>
                <div className="col-sm-6">
                  <label className="fw-semibold mb-1" style={{ color: "#64748b", fontSize: ".85rem" }}>{t("aiH.camera")}</label>
                  <div className="fw-semibold d-flex align-items-center gap-1" style={{ fontSize: "1.02rem" }}>
                    <i className="bi bi-camera-video-fill" style={{ color: PU }} />
                    {detail.camera_name || "—"}
                  </div>
                </div>
                <div className="col-sm-6">
                  <label className="fw-semibold mb-1" style={{ color: "#64748b", fontSize: ".85rem" }}>{t("aiH.processedCol")}</label>
                  <div><ProcessedBadge processed={detail.processed} t={t} /></div>
                </div>
                <div className="col-sm-6">
                  <label className="fw-semibold mb-1" style={{ color: "#64748b", fontSize: ".85rem" }}>{t("aiH.detectedAt")}</label>
                  <div className="fw-semibold" style={{ fontSize: "1.02rem" }}>
                    {detail.detected_at ? new Date(detail.detected_at).toLocaleString() : "—"}
                  </div>
                </div>
                {detail.created_violation && (
                  <div className="col-sm-6">
                    <label className="fw-semibold mb-1" style={{ color: "#64748b", fontSize: ".85rem" }}>{t("aiH.violation")}</label>
                    <div className="fw-semibold d-flex align-items-center gap-1" style={{ fontSize: "1.02rem" }}>
                      <i className="bi bi-exclamation-triangle-fill" style={{ color: PU }} />
                      #{detail.created_violation}
                      {detail.violation_type && (
                        <span className="text-secondary" style={{ textTransform: "capitalize" }}>
                          — {detail.violation_type.replace(/_/g, " ")}
                        </span>
                      )}
                    </div>
                  </div>
                )}
              </div>
            </div>

            {/* Footer */}
            <div style={{
              padding: "14px 28px 18px", borderTop: `1px solid ${PA(".08")}`,
              display: "flex", alignItems: "center", justifyContent: "space-between",
            }}>
              <div>
                {admin && (
                  <button className="btn rounded-3 fw-semibold d-flex align-items-center gap-1"
                    style={{ background: "rgba(239,68,68,.08)", color: "#dc2626", border: "none",
                      fontSize: ".95rem", padding: ".4rem 1rem", transition: "transform .12s" }}
                    onMouseDown={(e) => e.currentTarget.style.transform = "scale(.95)"}
                    onMouseUp={(e)   => e.currentTarget.style.transform = "scale(1)"}
                    onMouseLeave={(e) => e.currentTarget.style.transform = "scale(1)"}
                    onClick={() => { setDetail(null); setDeleteTarget(detail); }}>
                    <i className="bi bi-trash3" />{t("aiH.delete")}
                  </button>
                )}
              </div>
              <button className="btn rounded-3 fw-semibold"
                style={{ border: "1.5px solid #dce3ed", color: "#64748b", fontSize: "1rem", padding: ".45rem 1.2rem" }}
                onClick={() => setDetail(null)}>
                {t("aiH.close")}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ═══════════════ Delete Confirmation ═══════════════ */}
      {deleteTarget && (
        <div
          onClick={() => { if (!deleting) setDeleteTarget(null); }}
          style={{
            position: "fixed", inset: 0, zIndex: 1070,
            background: "rgba(0,0,0,.5)", display: "flex",
            alignItems: "center", justifyContent: "center",
            animation: "fadeIn .15s ease",
          }}>
          <div
            onClick={(e) => e.stopPropagation()}
            style={{
              background: "var(--bs-body-bg, #fff)", borderRadius: 18,
              width: "min(92vw, 420px)", padding: "28px 30px",
              boxShadow: "0 12px 48px rgba(220,38,38,.15)",
              animation: "slideUp .2s ease", textAlign: "center",
            }}>
            <div className="d-flex justify-content-center mb-3">
              <div style={{
                width: 56, height: 56, borderRadius: 14,
                background: "rgba(239,68,68,.1)",
                display: "flex", alignItems: "center", justifyContent: "center",
              }}>
                <i className="bi bi-exclamation-triangle-fill" style={{ color: "#dc2626", fontSize: "1.5rem" }} />
              </div>
            </div>
            <h6 className="fw-bold mb-1" style={{ color: "var(--bs-body-color)", fontSize: "1.15rem" }}>{t("aiH.deleteTitle")}</h6>
            <p className="text-secondary mb-3" style={{ fontSize: ".95rem" }}>
              {t("aiH.deleteMsg")} <strong className="fw-bold" style={{ color: PU }}>#{deleteTarget.id}</strong>
              {" — "}{(deleteTarget.detected_object || "").replace(/_/g, " ")}?
            </p>
            <div className="d-flex justify-content-center gap-2">
              <button className="btn rounded-3 fw-semibold"
                style={{ border: "1.5px solid #dce3ed", color: "#64748b", fontSize: "1rem", padding: ".45rem 1.4rem" }}
                onClick={() => setDeleteTarget(null)} disabled={deleting}>
                {t("aiH.cancel")}
              </button>
              <button className="btn rounded-3 fw-semibold d-flex align-items-center gap-2"
                style={{
                  background: "#dc2626", color: "#fff", border: "none",
                  fontSize: "1rem", padding: ".45rem 1.4rem",
                  opacity: deleting ? .6 : 1, transition: "opacity .15s, transform .12s",
                }}
                disabled={deleting}
                onMouseDown={(e) => e.currentTarget.style.transform = "scale(.95)"}
                onMouseUp={(e)   => e.currentTarget.style.transform = "scale(1)"}
                onMouseLeave={(e) => e.currentTarget.style.transform = "scale(1)"}
                onClick={handleDelete}>
                {deleting
                  ? <span className="spinner-border spinner-border-sm" />
                  : <><i className="bi bi-trash3" />{t("aiH.confirmDelete")}</>}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* modal animations */}
      <style>{`
        @keyframes fadeIn  { from { opacity: 0 } to { opacity: 1 } }
        @keyframes slideUp { from { opacity: 0; transform: translateY(32px) } to { opacity: 1; transform: translateY(0) } }
      `}</style>

    </div>
  );
}
