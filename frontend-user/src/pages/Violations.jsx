import { useCallback, useEffect, useRef, useState } from "react";
import Paginator from "../components/Paginator.jsx";
import StyledSelect from "../components/StyledSelect.jsx";
import { useAuth } from "../context/AuthContext.jsx";
import { useLanguage } from "../i18n/LanguageContext.jsx";
import { listViolations, fetchViolation, createViolation, updateViolation, deleteViolation, updateViolationStatus, bulkUpdateStatus, bulkDeleteViolations } from "../services/violationService.js";

const getPageSize = () => { try { return parseInt(JSON.parse(localStorage.getItem("settings.pageSize"))) || 10; } catch { return 10; } };

const PU = "#7c3aed";
const PA = (a) => `rgba(124,58,237,${a})`;

const STATUS_MAP = {
  pending:  { label: "Pending",  bg: "rgba(245,158,11,.12)",  color: "#d97706", icon: "bi-clock"             },
  verified: { label: "Verified", bg: PA(".1"),                color: PU,        icon: "bi-check-circle"      },
  resolved: { label: "Resolved", bg: "rgba(22,163,74,.12)",   color: "#16a34a", icon: "bi-check-circle-fill" },
  rejected: { label: "Rejected", bg: "rgba(239,68,68,.12)",   color: "#dc2626", icon: "bi-x-circle"          },
};

const SEVERITY_MAP = {
  critical: { label: "Critical", bg: "rgba(239,68,68,.12)",   color: "#dc2626" },
  high:     { label: "High",     bg: "rgba(245,158,11,.12)",  color: "#d97706" },
  medium:   { label: "Medium",   bg: PA(".1"),                color: PU        },
  low:      { label: "Low",      bg: "rgba(59,130,246,.12)",  color: "#2563eb" },
  warning:  { label: "Warning",  bg: "rgba(22,163,74,.12)",   color: "#16a34a" },
};

const FINE_STATUS_MAP = {
  paid:    { label: "Paid",    bg: "rgba(22,163,74,.12)", color: "#16a34a", icon: "bi-check-circle-fill" },
  pending: { label: "Pending", bg: "rgba(245,158,11,.12)", color: "#d97706", icon: "bi-clock" },
  overdue: { label: "Overdue", bg: "rgba(239,68,68,.12)", color: "#dc2626", icon: "bi-exclamation-triangle-fill" },
};

function SeverityBadge({ severity }) {
  const s = SEVERITY_MAP[severity] ?? SEVERITY_MAP.medium;
  return (
    <span className="d-inline-flex align-items-center px-2 py-1 rounded-2 fw-semibold"
      style={{ background: s.bg, color: s.color, fontSize: ".9rem" }}>
      {s.label}
    </span>
  );
}

function StatusBadge({ status }) {
  const s = STATUS_MAP[status] ?? STATUS_MAP.pending;
  return (
    <span className="d-inline-flex align-items-center gap-1 px-2 py-1 rounded-2 fw-semibold"
      style={{ background: s.bg, color: s.color, fontSize: ".95rem" }}>
      <i className={`bi ${s.icon}`} style={{ fontSize: ".9rem" }} />{s.label}
    </span>
  );
}

export default function Violations() {
  const { user, isAdmin } = useAuth();
  const { t } = useLanguage();
  const admin = isAdmin(user);

  const [violations, setViolations] = useState([]);
  const [loading,    setLoading]    = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [search,     setSearch]     = useState("");
  const [filter,     setFilter]     = useState("all");
  const [updating,   setUpdating]   = useState(null);
  const [page,       setPage]       = useState(1);
  const [total,      setTotal]      = useState(0);
  const searchTimer = useRef(null);
  const [debouncedSearch, setDebouncedSearch] = useState("");

  /* ── Detail / Edit modal state ── */
  const [modalOpen,    setModalOpen]    = useState(false);
  const [detail,       setDetail]       = useState(null);
  const [detailLoad,   setDetailLoad]   = useState(false);
  const [editForm,     setEditForm]     = useState({});
  const [saving,       setSaving]       = useState(false);
  const [photoZoom,    setPhotoZoom]    = useState(false);

  /* ── Create modal state ── */
  const [createOpen,   setCreateOpen]   = useState(false);
  const [createForm,   setCreateForm]   = useState({ violation_type: "", severity: "medium", location: "", evidence_photo_url: "" });
  const [creating,     setCreating]     = useState(false);

  /* ── Delete confirmation state ── */
  const [deleteTarget, setDeleteTarget] = useState(null);
  const [deleting,     setDeleting]     = useState(false);

  /* ── Bulk selection state ── */
  const [selected,       setSelected]       = useState(new Set());
  const [bulkAction,     setBulkAction]     = useState(false);   // loading flag
  const [bulkDeleteOpen, setBulkDeleteOpen] = useState(false);   // confirm modal

  const openDetail = async (id) => {
    setModalOpen(true);
    setDetailLoad(true);
    setPhotoZoom(false);
    try {
      const d = await fetchViolation(id);
      setDetail(d);
      setEditForm({
        violation_type: d.violation_type ?? "",
        severity: d.severity ?? "medium",
        location: d.location ?? "",
        evidence_photo_url: d.evidence_photo_url ?? "",
      });
    } catch { setDetail(null); }
    finally { setDetailLoad(false); }
  };

  const closeDetail = () => { setModalOpen(false); setDetail(null); setEditForm({}); setPhotoZoom(false); };

  const handleSave = async () => {
    if (!detail) return;
    setSaving(true);
    try {
      await updateViolation(detail.id, editForm);
      load(page, debouncedSearch, filter, true);
      closeDetail();
    } catch { /* keep modal open on error */ }
    finally { setSaving(false); }
  };

  const formDirty = detail && (
    editForm.violation_type !== (detail.violation_type ?? "") ||
    editForm.severity !== (detail.severity ?? "medium") ||
    editForm.location !== (detail.location ?? "") ||
    editForm.evidence_photo_url !== (detail.evidence_photo_url ?? "")
  );

  /* ── Create handler ── */
  const handleCreate = async () => {
    if (!createForm.violation_type.trim()) return;
    setCreating(true);
    try {
      await createViolation(createForm);
      setCreateOpen(false);
      setCreateForm({ violation_type: "", severity: "medium", location: "", evidence_photo_url: "" });
      load(1, debouncedSearch, filter, true);
      setPage(1);
    } catch { /* keep modal open */ }
    finally { setCreating(false); }
  };

  const createValid = createForm.violation_type.trim().length > 0;

  /* ── Delete handler ── */
  const handleDelete = async () => {
    if (!deleteTarget) return;
    setDeleting(true);
    try {
      await deleteViolation(deleteTarget.id);
      setDeleteTarget(null);
      // close detail modal if this item was open
      if (detail?.id === deleteTarget.id) closeDetail();
      load(page, debouncedSearch, filter, true);
    } catch { /* keep dialog */ }
    finally { setDeleting(false); }
  };

  /* ── Bulk selection helpers ── */
  const toggleSelect = (id) => setSelected((prev) => {
    const next = new Set(prev);
    next.has(id) ? next.delete(id) : next.add(id);
    return next;
  });
  const allOnPage = violations.map((v) => v.id);
  const allSelected = allOnPage.length > 0 && allOnPage.every((id) => selected.has(id));
  const toggleAll = () => {
    if (allSelected) setSelected(new Set());
    else setSelected(new Set(allOnPage));
  };

  /* ── Bulk status update ── */
  const handleBulkStatus = async (st) => {
    if (selected.size === 0) return;
    setBulkAction(true);
    try {
      await bulkUpdateStatus([...selected], st);
      setSelected(new Set());
      load(page, debouncedSearch, filter, true);
    } catch { /* toast / ignore */ }
    finally { setBulkAction(false); }
  };

  /* ── Bulk delete ── */
  const handleBulkDelete = async () => {
    if (selected.size === 0) return;
    setBulkAction(true);
    try {
      await bulkDeleteViolations([...selected]);
      setSelected(new Set());
      setBulkDeleteOpen(false);
      load(page, debouncedSearch, filter, true);
    } catch { /* keep dialog */ }
    finally { setBulkAction(false); }
  };

  const load = useCallback((pg = page, q = debouncedSearch, f = filter, isRefresh = false) => {
    if (isRefresh) setRefreshing(true);
    else           setLoading(true);
    const params = { page: pg, page_size: getPageSize() };
    if (f && f !== "all")   params.status = f;
    if (q)                  params.search = q;
    listViolations(params)
      .then((d) => {
        setViolations(d.results ?? d ?? []);
        setTotal(d.count ?? (d.results?.length ?? (Array.isArray(d) ? d.length : 0)));
      })
      .catch(() => {})
      .finally(() => { setLoading(false); setRefreshing(false); });
  }, []); // eslint-disable-line

  // Initial load
  useEffect(() => { load(1, "", "all"); }, []); // eslint-disable-line

  // Debounce search input
  useEffect(() => {
    clearTimeout(searchTimer.current);
    searchTimer.current = setTimeout(() => setDebouncedSearch(search), 350);
    return () => clearTimeout(searchTimer.current);
  }, [search]);

  // When filter or debounced search changes → reset to page 1 and reload
  const isFirstRender = useRef(true);
  useEffect(() => {
    if (isFirstRender.current) { isFirstRender.current = false; return; }
    setPage(1);
    setSelected(new Set());
    load(1, debouncedSearch, filter);
  }, [filter, debouncedSearch]); // eslint-disable-line

  // When page changes (and it's not a reset) → reload
  const prevPage = useRef(1);
  useEffect(() => {
    if (prevPage.current === page) return;
    prevPage.current = page;
    load(page, debouncedSearch, filter, true);
  }, [page]); // eslint-disable-line

  const handleStatus = async (id, st) => {
    setUpdating(id);
    try { await updateViolationStatus(id, st); load(page, debouncedSearch, filter, true); }
    finally { setUpdating(null); }
  };

  const FILTERS = [
    { key: "all",      label: t("viol.all"),      color: PU        },
    { key: "pending",  label: t("viol.pending"),  color: "#d97706" },
    { key: "verified", label: t("viol.verified"), color: PU        },
    { key: "resolved", label: t("viol.resolved"), color: "#16a34a" },
    { key: "rejected", label: t("viol.rejected"), color: "#dc2626" },
  ];

  return (
    <div className="d-flex flex-column gap-3 p-3" style={{ flex: 1, minHeight: 0, overflow: "hidden" }}>

      {/* ── Page header ── */}
      <div className="d-flex align-items-center justify-content-between flex-shrink-0">
        <div>
          <h5 className="fw-bold mb-0" style={{ color: "var(--bs-body-color)", fontSize: "1.5rem" }}>
            <i className="bi bi-exclamation-triangle-fill me-2" style={{ color: PU }} />
            {t("viol.title")}
          </h5>
          <p className="mb-0 text-secondary" style={{ fontSize: "1rem" }}>
            {t("viol.subtitle")}
          </p>
        </div>
        <div className="d-flex align-items-center gap-2">
          {admin && (
            <button className="btn rounded-3 d-flex align-items-center gap-2 fw-semibold"
              style={{ background: PU, color: "#fff", border: "none", fontSize: "1.05rem",
                transition: "transform .12s" }}
              onMouseDown={(e) => e.currentTarget.style.transform = "scale(.93)"}
              onMouseUp={(e)   => e.currentTarget.style.transform = "scale(1)"}
              onMouseLeave={(e) => e.currentTarget.style.transform = "scale(1)"}
              onClick={() => setCreateOpen(true)}>
              <i className="bi bi-plus-lg" />{t("viol.add")}
            </button>
          )}
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
            {refreshing ? t("viol.refreshing") : t("viol.refresh")}
          </button>
        </div>
      </div>

      {/* ── Summary chips + search ── */}
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
            placeholder={t("viol.search")} value={search}
            onChange={(e) => setSearch(e.target.value)}
            style={{ fontSize: "1.05rem" }} />
        </div>
      </div>

      {/* ── Table card ── */}
      <div className="card border-0 rounded-4 d-flex flex-column flex-fill"
        style={{ minHeight: 0, overflow: "hidden", boxShadow: "0 2px 16px rgba(124,58,237,.09)" }}>

        {/* ── Bulk action toolbar ── */}
        {admin && selected.size > 0 && (
          <div className="d-flex align-items-center gap-2 flex-wrap px-4 py-2"
            style={{ background: PA(".06"), borderBottom: `1.5px solid ${PA(".12")}` }}>
            <span className="fw-semibold" style={{ color: PU, fontSize: ".95rem" }}>
              <i className="bi bi-check2-square me-1" />
              {selected.size} {t("viol.bulkSelected")}
            </span>
            <div className="vr mx-1" style={{ borderColor: PA(".18") }} />
            {/* status buttons */}
            {["verified","resolved","rejected"].map((st) => {
              const sm = STATUS_MAP[st];
              return (
                <button key={st} className="btn btn-sm rounded-2 d-inline-flex align-items-center gap-1 fw-semibold"
                  style={{ background: sm.bg, color: sm.color, border: "none", fontSize: ".9rem",
                    opacity: bulkAction ? .55 : 1, transition: "transform .12s, opacity .15s" }}
                  disabled={bulkAction}
                  onMouseDown={(e) => e.currentTarget.style.transform = "scale(.93)"}
                  onMouseUp={(e)   => e.currentTarget.style.transform = "scale(1)"}
                  onMouseLeave={(e) => e.currentTarget.style.transform = "scale(1)"}
                  onClick={() => handleBulkStatus(st)}>
                  {bulkAction ? <span className="spinner-border spinner-border-sm" />
                    : <><i className={`bi ${sm.icon}`} />{sm.label}</>}
                </button>
              );
            })}
            <div className="vr mx-1" style={{ borderColor: PA(".18") }} />
            <button className="btn btn-sm rounded-2 d-inline-flex align-items-center gap-1 fw-semibold"
              style={{ background: "rgba(239,68,68,.1)", color: "#dc2626", border: "none", fontSize: ".9rem",
                opacity: bulkAction ? .55 : 1, transition: "transform .12s, opacity .15s" }}
              disabled={bulkAction}
              onMouseDown={(e) => e.currentTarget.style.transform = "scale(.93)"}
              onMouseUp={(e)   => e.currentTarget.style.transform = "scale(1)"}
              onMouseLeave={(e) => e.currentTarget.style.transform = "scale(1)"}
              onClick={() => setBulkDeleteOpen(true)}>
              <i className="bi bi-trash3" />{t("viol.bulkDelete")}
            </button>
            <button className="btn btn-sm rounded-2 fw-semibold ms-auto"
              style={{ background: "transparent", color: "#64748b", border: "1px solid #dce3ed", fontSize: ".85rem" }}
              onClick={() => setSelected(new Set())}>
              {t("viol.bulkDeselect")}
            </button>
          </div>
        )}

        <div className="flex-fill overflow-auto no-scrollbar" style={{ minHeight: 0 }}>
          <table className="table mb-0" style={{ fontSize: "1.07rem" }}>
            <thead style={{ position: "sticky", top: 0, zIndex: 2 }}>
              <tr style={{ background: "#f8f5ff", borderBottom: `2px solid ${PA(".12")}` }}>
                {admin && (
                  <th className="px-3 py-3" style={{ width: 44 }}>
                    <input type="checkbox" className="form-check-input" style={{ cursor: "pointer", accentColor: PU }}
                      checked={allSelected} onChange={toggleAll} />
                  </th>
                )}
                <th className="px-4 py-3 fw-semibold" style={{ color: PU, width: 70 }}>#</th>
                <th className="px-4 py-3 fw-semibold" style={{ color: PU }}>{t("viol.type")}</th>
                <th className="px-4 py-3 fw-semibold" style={{ color: PU }}>{t("viol.severityLabel")}</th>
                <th className="px-4 py-3 fw-semibold" style={{ color: PU }}>{t("viol.status")}</th>
                <th className="px-4 py-3 fw-semibold" style={{ color: PU }}>{t("viol.locationLabel")}</th>
                <th className="px-4 py-3 fw-semibold" style={{ color: PU }}>{t("viol.date")}</th>
                <th className="px-4 py-3 fw-semibold text-end" style={{ color: PU }}>{t("viol.actions")}</th>
              </tr>
            </thead>
            <tbody style={{ opacity: refreshing ? .55 : 1, transition: "opacity .3s" }}>
              {loading && (
                <tr>
                  <td colSpan={admin ? 8 : 7} className="text-center py-5">
                    <div className="spinner-border" style={{ color: PU, width: 40, height: 40 }} role="status">
                      <span className="visually-hidden">Loading...</span>
                    </div>
                  </td>
                </tr>
              )}
              {!loading && violations.length === 0 && (
                <tr>
                  <td colSpan={admin ? 8 : 7} className="text-center py-5">
                    <div className="d-flex flex-column align-items-center gap-2">
                      <div className="rounded-circle d-flex align-items-center justify-content-center"
                        style={{ width: 64, height: 64, background: PA(".08") }}>
                        <i className="bi bi-inbox" style={{ fontSize: "1.8rem", color: PU }} />
                      </div>
                      <span className="fw-semibold" style={{ color: "var(--bs-body-color)", fontSize: "1.15rem" }}>{t("viol.noResults")}</span>
                      <span className="text-secondary" style={{ fontSize: "1rem" }}>Try adjusting your filters</span>
                    </div>
                  </td>
                </tr>
              )}
              {!loading && violations.map((item) => (
                <tr key={item.id}
                  style={{
                    borderBottom: "1px solid #f3f0ff",
                    opacity: updating === item.id ? 0.45 : 1,
                    transition: "background .15s, opacity .25s",
                    background: selected.has(item.id) ? PA(".04") : "",
                  }}
                  onMouseOver={(e) => { if (updating !== item.id) e.currentTarget.style.background = selected.has(item.id) ? PA(".06") : "#faf8ff"; }}
                  onMouseOut={(e)  => e.currentTarget.style.background = selected.has(item.id) ? PA(".04") : ""}>
                  {admin && (
                    <td className="px-3 py-3">
                      <input type="checkbox" className="form-check-input" style={{ cursor: "pointer", accentColor: PU }}
                        checked={selected.has(item.id)} onChange={() => toggleSelect(item.id)} />
                    </td>
                  )}
                  <td className="px-4 py-3 fw-bold" style={{ color: PU }}>#{item.id}</td>
                  <td className="px-4 py-3 fw-semibold" style={{ color: "var(--bs-body-color)", textTransform: "capitalize" }}>
                    {(item.violation_type || "—").replace(/_/g, " ")}
                  </td>
                  <td className="px-4 py-3"><SeverityBadge severity={item.severity} /></td>
                  <td className="px-4 py-3"><StatusBadge status={item.status} /></td>
                  <td className="px-4 py-3 text-secondary">{item.location || "—"}</td>
                  <td className="px-4 py-3 text-secondary">
                    {item.date ? new Date(item.date).toLocaleDateString() : "—"}
                  </td>
                  <td className="px-4 py-3 text-end d-flex align-items-center justify-content-end gap-2">
                    {/* View detail */}
                    <button
                      className="btn btn-sm rounded-2 d-inline-flex align-items-center gap-1 fw-semibold"
                      style={{ background: "rgba(59,130,246,.1)", color: "#3b82f6", border: "none", fontSize: "1rem",
                        transition: "transform .12s", transform: "scale(1)" }}
                      onMouseDown={(e) => e.currentTarget.style.transform = "scale(.93)"}
                      onMouseUp={(e)   => e.currentTarget.style.transform = "scale(1)"}
                      onMouseLeave={(e) => e.currentTarget.style.transform = "scale(1)"}
                      onClick={() => openDetail(item.id)}>
                      <i className="bi bi-eye" />{t("viol.view")}
                    </button>
                    {admin && item.status === "pending" && (
                      <button
                        className="btn btn-sm rounded-2 d-inline-flex align-items-center gap-1 fw-semibold"
                        style={{ background: PA(".1"), color: PU, border: "none", fontSize: "1rem",
                          transition: "transform .12s, opacity .12s", transform: "scale(1)" }}
                        disabled={updating === item.id}
                        onMouseDown={(e) => e.currentTarget.style.transform = "scale(.93)"}
                        onMouseUp={(e)   => e.currentTarget.style.transform = "scale(1)"}
                        onMouseLeave={(e) => e.currentTarget.style.transform = "scale(1)"}
                        onClick={() => handleStatus(item.id, "verified")}>
                        {updating === item.id
                          ? <span className="spinner-border spinner-border-sm" />
                          : <><i className="bi bi-check-circle" />Verify</>}
                      </button>
                    )}
                    {admin && item.status === "pending" && (
                      <button
                        className="btn btn-sm rounded-2 d-inline-flex align-items-center gap-1 fw-semibold"
                        style={{ background: "rgba(239,68,68,.1)", color: "#dc2626", border: "none", fontSize: "1rem",
                          transition: "transform .12s, opacity .12s", transform: "scale(1)" }}
                        disabled={updating === item.id}
                        onMouseDown={(e) => e.currentTarget.style.transform = "scale(.93)"}
                        onMouseUp={(e)   => e.currentTarget.style.transform = "scale(1)"}
                        onMouseLeave={(e) => e.currentTarget.style.transform = "scale(1)"}
                        onClick={() => handleStatus(item.id, "rejected")}>
                        {updating === item.id
                          ? <span className="spinner-border spinner-border-sm" />
                          : <><i className="bi bi-x-circle" />Reject</>}
                      </button>
                    )}
                    {admin && !['resolved', 'rejected'].includes(item.status) && (
                      <button
                        className="btn btn-sm rounded-2 d-inline-flex align-items-center gap-1 fw-semibold"
                        style={{ background: "rgba(22,163,74,.1)", color: "#16a34a", border: "none", fontSize: "1rem",
                          transition: "transform .12s, opacity .12s", transform: "scale(1)" }}
                        disabled={updating === item.id}
                        onMouseDown={(e) => e.currentTarget.style.transform = "scale(.93)"}
                        onMouseUp={(e)   => e.currentTarget.style.transform = "scale(1)"}
                        onMouseLeave={(e) => e.currentTarget.style.transform = "scale(1)"}
                        onClick={() => handleStatus(item.id, "resolved")}>
                        {updating === item.id
                          ? <span className="spinner-border spinner-border-sm" />
                          : <><i className="bi bi-check2-all" />Resolve</>}
                      </button>
                    )}
                    {admin && (
                      <button
                        className="btn btn-sm rounded-2 d-inline-flex align-items-center gap-1 fw-semibold"
                        style={{ background: "rgba(239,68,68,.08)", color: "#dc2626", border: "none", fontSize: "1rem",
                          transition: "transform .12s", transform: "scale(1)" }}
                        onMouseDown={(e) => e.currentTarget.style.transform = "scale(.93)"}
                        onMouseUp={(e)   => e.currentTarget.style.transform = "scale(1)"}
                        onMouseLeave={(e) => e.currentTarget.style.transform = "scale(1)"}
                        onClick={() => setDeleteTarget(item)}>
                        <i className="bi bi-trash3" />
                      </button>
                    )}
                    {!admin && (
                      <span className="text-secondary" style={{ fontSize: ".85rem", fontStyle: "italic" }}>View only</span>
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

      {/* ═══════════════ Detail / Edit Modal ═══════════════ */}
      {modalOpen && (
        <div
          onClick={closeDetail}
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
              width: "min(94vw, 720px)", maxHeight: "90vh",
              display: "flex", flexDirection: "column",
              boxShadow: "0 12px 48px rgba(124,58,237,.18)",
              animation: "slideUp .22s ease",
              overflow: "hidden",
            }}>

            {/* ── Header ── */}
            <div style={{
              padding: "20px 28px 16px", borderBottom: `1px solid ${PA(".1")}`,
              display: "flex", alignItems: "center", justifyContent: "space-between",
            }}>
              <div className="d-flex align-items-center gap-2">
                <div style={{
                  width: 38, height: 38, borderRadius: 10, background: PA(".1"),
                  display: "flex", alignItems: "center", justifyContent: "center",
                }}>
                  <i className="bi bi-exclamation-triangle-fill" style={{ color: PU, fontSize: "1.1rem" }} />
                </div>
                <div>
                  <h6 className="fw-bold mb-0" style={{ color: PU, fontSize: "1.15rem" }}>
                    {detail ? `${t("viol.detailTitle")} #${detail.id}` : t("viol.detailTitle")}
                  </h6>
                  <span className="text-secondary" style={{ fontSize: ".85rem" }}>{t("viol.detailSub")}</span>
                </div>
              </div>
              <button className="btn btn-sm p-1" onClick={closeDetail}
                style={{ background: "none", border: "none", fontSize: "1.3rem", color: "#94a3b8", lineHeight: 1 }}>
                <i className="bi bi-x-lg" />
              </button>
            </div>

            {/* ── Body ── */}
            <div style={{ flex: 1, overflowY: "auto", padding: "20px 28px 24px" }}>
              {detailLoad ? (
                <div className="d-flex justify-content-center py-5">
                  <div className="spinner-border" style={{ color: PU, width: 40, height: 40 }} />
                </div>
              ) : !detail ? (
                <p className="text-center text-secondary py-5">{t("viol.detailError")}</p>
              ) : (
                <>
                  {/* ── Evidence photo ── */}
                  {(detail.evidence_photo_url || editForm.evidence_photo_url) && (
                    <div style={{ marginBottom: 20 }}>
                      <label className="fw-semibold d-block mb-1" style={{ color: PU, fontSize: ".92rem" }}>
                        <i className="bi bi-camera-fill me-1" />{t("viol.evidence")}
                      </label>
                      <div style={{
                        position: "relative", borderRadius: 14, overflow: "hidden",
                        border: `1.5px solid ${PA(".12")}`, background: "#f8f5ff",
                        cursor: "pointer",
                      }}
                        onClick={() => setPhotoZoom(!photoZoom)}>
                        <img
                          src={editForm.evidence_photo_url || detail.evidence_photo_url}
                          alt="Evidence"
                          style={{
                            width: "100%", display: "block",
                            maxHeight: photoZoom ? "none" : 220,
                            objectFit: photoZoom ? "contain" : "cover",
                            transition: "max-height .3s ease",
                          }}
                          onError={(e) => { e.target.style.display = "none"; }}
                        />
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

                  {/* ── Info row (read-only) ── */}
                  <div className="row g-3 mb-3">
                    <div className="col-sm-6">
                      <label className="fw-semibold mb-1" style={{ color: "#64748b", fontSize: ".85rem" }}>{t("viol.status")}</label>
                      <div><StatusBadge status={detail.status} /></div>
                    </div>
                    <div className="col-sm-6">
                      <label className="fw-semibold mb-1" style={{ color: "#64748b", fontSize: ".85rem" }}>{t("viol.date")}</label>
                      <div className="fw-semibold" style={{ fontSize: "1.02rem" }}>
                        {detail.date ? new Date(detail.date).toLocaleString() : "—"}
                      </div>
                    </div>
                    {detail.vehicle_display && (
                      <div className="col-sm-6">
                        <label className="fw-semibold mb-1" style={{ color: "#64748b", fontSize: ".85rem" }}>{t("viol.vehicle")}</label>
                        <div className="fw-semibold d-flex align-items-center gap-1" style={{ fontSize: "1.02rem" }}>
                          <i className="bi bi-car-front-fill" style={{ color: PU }} />{detail.vehicle_display}
                        </div>
                      </div>
                    )}
                    {detail.driver_display && (
                      <div className="col-sm-6">
                        <label className="fw-semibold mb-1" style={{ color: "#64748b", fontSize: ".85rem" }}>{t("viol.driver")}</label>
                        <div className="fw-semibold d-flex align-items-center gap-1" style={{ fontSize: "1.02rem" }}>
                          <i className="bi bi-person-fill" style={{ color: PU }} />{detail.driver_display}
                        </div>
                      </div>
                    )}
                    {detail.camera_display && (
                      <div className="col-sm-6">
                        <label className="fw-semibold mb-1" style={{ color: "#64748b", fontSize: ".85rem" }}>{t("viol.camera")}</label>
                        <div className="fw-semibold d-flex align-items-center gap-1" style={{ fontSize: "1.02rem" }}>
                          <i className="bi bi-camera-video-fill" style={{ color: PU }} />{detail.camera_display}
                        </div>
                      </div>
                    )}
                    {detail.sign_display && (
                      <div className="col-sm-6">
                        <label className="fw-semibold mb-1" style={{ color: "#64748b", fontSize: ".85rem" }}>{t("viol.sign")}</label>
                        <div className="fw-semibold d-flex align-items-center gap-1" style={{ fontSize: "1.02rem", textTransform: "capitalize" }}>
                          <i className="bi bi-sign-stop-fill" style={{ color: PU }} />{(detail.sign_display || "").replace(/_/g, " ")}
                        </div>
                      </div>
                    )}
                  </div>

                  {/* ── Editable fields (admin only) ── */}
                  <div className="row g-3 mb-3">
                    <div className="col-12">
                      <label className="fw-semibold mb-1" style={{ color: "#64748b", fontSize: ".85rem" }}>{t("viol.type")}</label>
                      {admin ? (
                        <input className="form-control rounded-3" value={editForm.violation_type}
                          onChange={(e) => setEditForm({ ...editForm, violation_type: e.target.value })}
                          style={{ borderColor: PA(".25"), fontSize: "1rem" }} />
                      ) : (
                        <div className="fw-semibold" style={{ fontSize: "1.02rem", textTransform: "capitalize" }}>
                          {(detail.violation_type || "—").replace(/_/g, " ")}
                        </div>
                      )}
                    </div>
                    <div className="col-sm-6">
                      <label className="fw-semibold mb-1" style={{ color: "#64748b", fontSize: ".85rem" }}>{t("viol.severityLabel")}</label>
                      {admin ? (
                        <StyledSelect
                          value={editForm.severity}
                          onChange={(v) => setEditForm({ ...editForm, severity: v })}
                          options={Object.entries(SEVERITY_MAP).map(([k, v]) => ({ value: k, label: v.label, color: v.color, bg: v.bg }))}
                        />
                      ) : (
                        <div><SeverityBadge severity={detail.severity} /></div>
                      )}
                    </div>
                    <div className="col-sm-6">
                      <label className="fw-semibold mb-1" style={{ color: "#64748b", fontSize: ".85rem" }}>{t("viol.locationLabel")}</label>
                      {admin ? (
                        <input className="form-control rounded-3" value={editForm.location}
                          onChange={(e) => setEditForm({ ...editForm, location: e.target.value })}
                          style={{ borderColor: PA(".25"), fontSize: "1rem" }} />
                      ) : (
                        <div className="fw-semibold" style={{ fontSize: "1.02rem" }}>{detail.location || "—"}</div>
                      )}
                    </div>
                    {admin && (
                      <div className="col-12">
                        <label className="fw-semibold mb-1" style={{ color: "#64748b", fontSize: ".85rem" }}>{t("viol.evidenceUrl")}</label>
                        <input className="form-control rounded-3" value={editForm.evidence_photo_url}
                          onChange={(e) => setEditForm({ ...editForm, evidence_photo_url: e.target.value })}
                          placeholder="https://..."
                          style={{ borderColor: PA(".25"), fontSize: "1rem" }} />
                      </div>
                    )}
                  </div>

                  {/* ── Linked Fine card ── */}
                  {detail.fine && (() => {
                    const f = detail.fine;
                    const fs = FINE_STATUS_MAP[f.status] ?? FINE_STATUS_MAP.pending;
                    return (
                      <div style={{
                        background: PA(".04"), border: `1.5px solid ${PA(".12")}`,
                        borderRadius: 14, padding: "16px 20px",
                      }}>
                        <div className="d-flex align-items-center gap-2 mb-2">
                          <i className="bi bi-cash-coin" style={{ color: PU, fontSize: "1.15rem" }} />
                          <span className="fw-bold" style={{ color: PU, fontSize: "1.05rem" }}>{t("viol.linkedFine")}</span>
                        </div>
                        <div className="row g-2">
                          <div className="col-sm-3">
                            <span className="text-secondary" style={{ fontSize: ".82rem" }}>{t("viol.fineAmount")}</span>
                            <div className="fw-bold" style={{ fontSize: "1.1rem", color: "var(--bs-body-color)" }}>
                              ${parseFloat(f.amount).toLocaleString(undefined, { minimumFractionDigits: 2 })}
                            </div>
                          </div>
                          <div className="col-sm-3">
                            <span className="text-secondary" style={{ fontSize: ".82rem" }}>{t("viol.fineStatus")}</span>
                            <div>
                              <span className="d-inline-flex align-items-center gap-1 px-2 py-1 rounded-2 fw-semibold"
                                style={{ background: fs.bg, color: fs.color, fontSize: ".9rem" }}>
                                <i className={`bi ${fs.icon}`} style={{ fontSize: ".85rem" }} />{fs.label}
                              </span>
                            </div>
                          </div>
                          <div className="col-sm-3">
                            <span className="text-secondary" style={{ fontSize: ".82rem" }}>{t("viol.fineDue")}</span>
                            <div className="fw-semibold" style={{ fontSize: ".98rem" }}>
                              {f.due_date ? new Date(f.due_date).toLocaleDateString() : "—"}
                            </div>
                          </div>
                          <div className="col-sm-3">
                            <span className="text-secondary" style={{ fontSize: ".82rem" }}>{t("viol.finePaid")}</span>
                            <div className="fw-semibold" style={{ fontSize: ".98rem" }}>
                              {f.payment_date ? new Date(f.payment_date).toLocaleDateString() : "—"}
                            </div>
                          </div>
                        </div>
                      </div>
                    );
                  })()}
                  {detail && !detail.fine && (
                    <div style={{
                      background: "rgba(148,163,184,.06)", border: "1.5px dashed #cbd5e1",
                      borderRadius: 14, padding: "18px 20px", textAlign: "center",
                    }}>
                      <i className="bi bi-cash-coin text-secondary" style={{ fontSize: "1.3rem" }} />
                      <div className="text-secondary fw-semibold" style={{ fontSize: ".95rem" }}>{t("viol.noFine")}</div>
                    </div>
                  )}
                </>
              )}
            </div>

            {/* ── Footer ── */}
            {detail && (
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
                      onClick={() => { closeDetail(); setDeleteTarget(detail); }}>
                      <i className="bi bi-trash3" />{t("viol.delete")}
                    </button>
                  )}
                </div>
                <div className="d-flex align-items-center gap-2">
                  <button className="btn rounded-3 fw-semibold"
                    style={{ border: "1.5px solid #dce3ed", color: "#64748b", fontSize: "1rem", padding: ".45rem 1.2rem" }}
                    onClick={closeDetail}>
                    {t("viol.close")}
                  </button>
                  {admin && (
                    <button className="btn rounded-3 fw-semibold d-flex align-items-center gap-2"
                      style={{
                        background: PU, color: "#fff", border: "none",
                        fontSize: "1rem", padding: ".45rem 1.4rem",
                        opacity: (!formDirty || saving) ? .55 : 1,
                        transition: "opacity .15s, transform .12s",
                      }}
                      disabled={!formDirty || saving}
                      onMouseDown={(e) => { if (formDirty) e.currentTarget.style.transform = "scale(.95)"; }}
                      onMouseUp={(e)   => e.currentTarget.style.transform = "scale(1)"}
                      onMouseLeave={(e) => e.currentTarget.style.transform = "scale(1)"}
                      onClick={handleSave}>
                      {saving
                        ? <span className="spinner-border spinner-border-sm" />
                        : <><i className="bi bi-check2" />{t("viol.save")}</>}
                    </button>
                  )}
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {/* ═══════════════ Create Violation Modal ═══════════════ */}
      {createOpen && (
        <div
          onClick={() => { if (!creating) setCreateOpen(false); }}
          style={{
            position: "fixed", inset: 0, zIndex: 1060,
            background: "rgba(0,0,0,.45)", display: "flex",
            alignItems: "center", justifyContent: "center",
            animation: "fadeIn .18s ease",
          }}>
          <div
            onClick={(e) => e.stopPropagation()}
            style={{
              background: "var(--bs-body-bg, #fff)", borderRadius: 20,
              width: "min(94vw, 540px)", display: "flex", flexDirection: "column",
              boxShadow: "0 12px 48px rgba(124,58,237,.18)",
              animation: "slideUp .22s ease", overflow: "hidden",
            }}>
            {/* Header */}
            <div style={{
              padding: "20px 28px 16px", borderBottom: `1px solid ${PA(".1")}`,
              display: "flex", alignItems: "center", justifyContent: "space-between",
            }}>
              <div className="d-flex align-items-center gap-2">
                <div style={{ width: 38, height: 38, borderRadius: 10, background: PA(".1"),
                  display: "flex", alignItems: "center", justifyContent: "center" }}>
                  <i className="bi bi-plus-circle-fill" style={{ color: PU, fontSize: "1.1rem" }} />
                </div>
                <div>
                  <h6 className="fw-bold mb-0" style={{ color: PU, fontSize: "1.15rem" }}>{t("viol.addTitle")}</h6>
                  <span className="text-secondary" style={{ fontSize: ".85rem" }}>{t("viol.addSub")}</span>
                </div>
              </div>
              <button className="btn btn-sm p-1" onClick={() => setCreateOpen(false)}
                style={{ background: "none", border: "none", fontSize: "1.3rem", color: "#94a3b8", lineHeight: 1 }}>
                <i className="bi bi-x-lg" />
              </button>
            </div>
            {/* Body */}
            <div style={{ padding: "20px 28px 24px" }}>
              <div className="row g-3">
                <div className="col-12">
                  <label className="fw-semibold mb-1" style={{ color: "#64748b", fontSize: ".85rem" }}>{t("viol.type")} *</label>
                  <input className="form-control rounded-3" value={createForm.violation_type}
                    onChange={(e) => setCreateForm({ ...createForm, violation_type: e.target.value })}
                    placeholder={t("viol.typePlaceholder")}
                    style={{ borderColor: PA(".25"), fontSize: "1rem" }} />
                </div>
                <div className="col-sm-6">
                  <label className="fw-semibold mb-1" style={{ color: "#64748b", fontSize: ".85rem" }}>{t("viol.severityLabel")}</label>
                  <StyledSelect
                    value={createForm.severity}
                    onChange={(v) => setCreateForm({ ...createForm, severity: v })}
                    options={Object.entries(SEVERITY_MAP).map(([k, v]) => ({ value: k, label: v.label, color: v.color, bg: v.bg }))}
                  />
                </div>
                <div className="col-sm-6">
                  <label className="fw-semibold mb-1" style={{ color: "#64748b", fontSize: ".85rem" }}>{t("viol.locationLabel")}</label>
                  <input className="form-control rounded-3" value={createForm.location}
                    onChange={(e) => setCreateForm({ ...createForm, location: e.target.value })}
                    placeholder={t("viol.locationPlaceholder")}
                    style={{ borderColor: PA(".25"), fontSize: "1rem" }} />
                </div>
                <div className="col-12">
                  <label className="fw-semibold mb-1" style={{ color: "#64748b", fontSize: ".85rem" }}>{t("viol.evidenceUrl")}</label>
                  <input className="form-control rounded-3" value={createForm.evidence_photo_url}
                    onChange={(e) => setCreateForm({ ...createForm, evidence_photo_url: e.target.value })}
                    placeholder="https://..."
                    style={{ borderColor: PA(".25"), fontSize: "1rem" }} />
                </div>
              </div>
            </div>
            {/* Footer */}
            <div style={{
              padding: "14px 28px 18px", borderTop: `1px solid ${PA(".08")}`,
              display: "flex", justifyContent: "flex-end", gap: 10,
            }}>
              <button className="btn rounded-3 fw-semibold"
                style={{ border: "1.5px solid #dce3ed", color: "#64748b", fontSize: "1rem", padding: ".45rem 1.2rem" }}
                onClick={() => setCreateOpen(false)} disabled={creating}>
                {t("viol.cancel")}
              </button>
              <button className="btn rounded-3 fw-semibold d-flex align-items-center gap-2"
                style={{
                  background: PU, color: "#fff", border: "none",
                  fontSize: "1rem", padding: ".45rem 1.4rem",
                  opacity: (!createValid || creating) ? .55 : 1,
                  transition: "opacity .15s, transform .12s",
                }}
                disabled={!createValid || creating}
                onMouseDown={(e) => { if (createValid) e.currentTarget.style.transform = "scale(.95)"; }}
                onMouseUp={(e)   => e.currentTarget.style.transform = "scale(1)"}
                onMouseLeave={(e) => e.currentTarget.style.transform = "scale(1)"}
                onClick={handleCreate}>
                {creating
                  ? <span className="spinner-border spinner-border-sm" />
                  : <><i className="bi bi-plus-lg" />{t("viol.create")}</>}
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
            <h6 className="fw-bold mb-1" style={{ color: "var(--bs-body-color)", fontSize: "1.15rem" }}>{t("viol.deleteTitle")}</h6>
            <p className="text-secondary mb-3" style={{ fontSize: ".95rem" }}>
              {t("viol.deleteMsg")} <strong className="fw-bold" style={{ color: PU }}>
                #{deleteTarget.id}
              </strong> — {(deleteTarget.violation_type || "").replace(/_/g, " ")}?
            </p>
            <div className="d-flex justify-content-center gap-2">
              <button className="btn rounded-3 fw-semibold"
                style={{ border: "1.5px solid #dce3ed", color: "#64748b", fontSize: "1rem", padding: ".45rem 1.4rem" }}
                onClick={() => setDeleteTarget(null)} disabled={deleting}>
                {t("viol.cancel")}
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
                  : <><i className="bi bi-trash3" />{t("viol.confirmDelete")}</>}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ═══════════════ Bulk Delete Confirmation ═══════════════ */}
      {bulkDeleteOpen && (
        <div
          onClick={() => { if (!bulkAction) setBulkDeleteOpen(false); }}
          style={{
            position: "fixed", inset: 0, zIndex: 1080,
            background: "rgba(0,0,0,.5)", display: "flex",
            alignItems: "center", justifyContent: "center",
            animation: "fadeIn .15s ease",
          }}>
          <div
            onClick={(e) => e.stopPropagation()}
            style={{
              background: "var(--bs-body-bg, #fff)", borderRadius: 18,
              width: "min(92vw, 440px)", padding: "28px 30px",
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
            <h6 className="fw-bold mb-1" style={{ color: "var(--bs-body-color)", fontSize: "1.15rem" }}>{t("viol.bulkDeleteTitle")}</h6>
            <p className="text-secondary mb-3" style={{ fontSize: ".95rem" }}>
              {t("viol.bulkDeleteMsg").replace("{n}", selected.size)}
            </p>
            <div className="d-flex justify-content-center gap-2">
              <button className="btn rounded-3 fw-semibold"
                style={{ border: "1.5px solid #dce3ed", color: "#64748b", fontSize: "1rem", padding: ".45rem 1.4rem" }}
                onClick={() => setBulkDeleteOpen(false)} disabled={bulkAction}>
                {t("viol.cancel")}
              </button>
              <button className="btn rounded-3 fw-semibold d-flex align-items-center gap-2"
                style={{
                  background: "#dc2626", color: "#fff", border: "none",
                  fontSize: "1rem", padding: ".45rem 1.4rem",
                  opacity: bulkAction ? .6 : 1, transition: "opacity .15s, transform .12s",
                }}
                disabled={bulkAction}
                onMouseDown={(e) => e.currentTarget.style.transform = "scale(.95)"}
                onMouseUp={(e)   => e.currentTarget.style.transform = "scale(1)"}
                onMouseLeave={(e) => e.currentTarget.style.transform = "scale(1)"}
                onClick={handleBulkDelete}>
                {bulkAction
                  ? <span className="spinner-border spinner-border-sm" />
                  : <><i className="bi bi-trash3" />{t("viol.confirmDelete")}</>}
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
