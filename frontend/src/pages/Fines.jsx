import { useCallback, useEffect, useRef, useState } from "react";
import Paginator from "../components/Paginator.jsx";
import { useAuth } from "../context/AuthContext.jsx";
import { useLanguage } from "../i18n/LanguageContext.jsx";
import { listFines, fetchFine, updateFine, payFine, fetchFineSummary } from "../services/fineService.js";

const getPageSize = () => { try { return parseInt(JSON.parse(localStorage.getItem("settings.pageSize"))) || 10; } catch { return 10; } };

const PU = "#7c3aed";
const PA = (a) => `rgba(124,58,237,${a})`;

const FINE_STATUS = {
  paid:    { label: "Paid",    bg: "rgba(22,163,74,.12)",  color: "#16a34a", icon: "bi-check-circle-fill"  },
  pending: { label: "Pending", bg: "rgba(245,158,11,.12)", color: "#d97706", icon: "bi-clock"              },
  overdue: { label: "Overdue", bg: "rgba(239,68,68,.12)",  color: "#dc2626", icon: "bi-exclamation-circle" },
};

function FineBadge({ status }) {
  const s = FINE_STATUS[status] ?? FINE_STATUS.pending;
  return (
    <span className="d-inline-flex align-items-center gap-1 px-2 py-1 rounded-2 fw-semibold"
      style={{ background: s.bg, color: s.color, fontSize: ".95rem" }}>
      <i className={`bi ${s.icon}`} style={{ fontSize: ".9rem" }} />{s.label}
    </span>
  );
}

export default function Fines() {
  const { user } = useAuth();
  const { t } = useLanguage();
  const admin = user?.role === "admin";

  const [fines,      setFines]      = useState([]);
  const [loading,    setLoading]    = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [search,     setSearch]     = useState("");
  const [filter,     setFilter]     = useState("all");
  const [updating,   setUpdating]   = useState(null);
  const [page,       setPage]       = useState(1);
  const [total,      setTotal]      = useState(0);
  const [summary,    setSummary]    = useState(null);
  const searchTimer = useRef(null);
  const [debouncedSearch, setDebouncedSearch] = useState("");

  /* ── Detail modal state ── */
  const [modalOpen,  setModalOpen]  = useState(false);
  const [detail,     setDetail]     = useState(null);
  const [detailLoad, setDetailLoad] = useState(false);
  const [detailErr,  setDetailErr]  = useState(false);
  const [editForm,   setEditForm]   = useState({ amount: "", due_date: "" });
  const [saving,     setSaving]     = useState(false);
  const [paying,     setPaying]     = useState(false);

  const fmt = (n) => Number(n).toLocaleString("en-US", { style: "currency", currency: "USD" });
  const isOverdue = (f) => f.status !== "paid" && f.due_date && new Date(f.due_date) < new Date();

  const load = useCallback((pg = page, q = debouncedSearch, f = filter, isRefresh = false) => {
    if (isRefresh) setRefreshing(true);
    else           setLoading(true);
    const params = { page: pg, page_size: getPageSize() };
    // "overdue" is a frontend concept: fetch pending and compute client-side
    const serverStatus = f === "overdue" ? "pending" : f !== "all" ? f : undefined;
    if (serverStatus) params.status = serverStatus;
    if (q) params.search = q;
    Promise.all([
      listFines(params),
      fetchFineSummary(),
    ])
      .then(([d, sum]) => {
        const raw = d.results ?? d ?? [];
        const enriched = raw.map((fi) => ({ ...fi, status: isOverdue(fi) ? "overdue" : fi.status }));
        setFines(f === "overdue" ? enriched.filter((fi) => fi.status === "overdue") : enriched);
        setTotal(d.count ?? (Array.isArray(d) ? d.length : 0));
        setSummary(sum);
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

  const handlePaid = async (id) => {
    setUpdating(id);
    try { await payFine(id); load(page, debouncedSearch, filter, true); }
    finally { setUpdating(null); }
  };

  /* ── Detail modal helpers ── */
  const openDetail = async (id) => {
    setModalOpen(true); setDetailLoad(true); setDetailErr(false); setDetail(null);
    try {
      const d = await fetchFine(id);
      setDetail(d);
      setEditForm({ amount: d.amount ?? "", due_date: d.due_date ?? "" });
    } catch { setDetailErr(true); }
    finally { setDetailLoad(false); }
  };

  const closeModal = () => { setModalOpen(false); setDetail(null); setDetailErr(false); };

  const handleSave = async () => {
    if (!detail) return;
    setSaving(true);
    try {
      const payload = {};
      if (editForm.amount !== String(detail.amount)) payload.amount = editForm.amount;
      if (editForm.due_date !== (detail.due_date ?? "")) payload.due_date = editForm.due_date;
      if (Object.keys(payload).length) {
        const updated = await updateFine(detail.id, payload);
        setDetail((prev) => ({ ...prev, ...updated }));
      }
      load(page, debouncedSearch, filter, true);
    } finally { setSaving(false); }
  };

  const handlePayInModal = async () => {
    if (!detail) return;
    setPaying(true);
    try {
      await payFine(detail.id);
      const refreshed = await fetchFine(detail.id);
      setDetail(refreshed);
      load(page, debouncedSearch, filter, true);
    } finally { setPaying(false); }
  };

  /* ── Use server aggregates for stat cards ── */
  const totalCount   = summary?.total_count   ?? total;
  const totalAmount  = summary?.total_amount  ?? 0;
  const unpaidAmount = summary?.unpaid_amount ?? 0;
  const paidCount    = summary?.paid_count    ?? 0;

  const FILTERS = [
    { key: "all",     label: t("fine.all"),     color: PU       },
    { key: "pending", label: t("fine.pending"), color: "#d97706" },
    { key: "overdue", label: t("fine.overdue"), color: "#dc2626" },
    { key: "paid",    label: t("fine.paid"),    color: "#16a34a" },
  ];

  return (
    <div className="d-flex flex-column gap-3 p-3" style={{ flex: 1, minHeight: 0, overflow: "hidden" }}>

      {/* ── Page header ── */}
      <div className="d-flex align-items-center justify-content-between flex-shrink-0">
        <div>
          <h5 className="fw-bold mb-0" style={{ color: "var(--bs-body-color)", fontSize: "1.5rem" }}>
            <i className="bi bi-receipt-cutoff me-2" style={{ color: PU }} />
            Fines Management
          </h5>
          <p className="mb-0 text-secondary" style={{ fontSize: "1rem" }}>{t("fine.subtitle")}</p>
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
          {refreshing ? t("fine.refreshing") : t("fine.refresh")}
        </button>
      </div>

      {/* ── Summary stat cards ── */}
      <div className="row g-3 flex-shrink-0">
        {[
          { label: t("fine.totalFines"),   value: totalCount,          icon: "bi-receipt",              color: PU,        bg: PA(".1")               },
          { label: t("fine.totalAmount"),  value: fmt(totalAmount),     icon: "bi-cash-stack",            color: "#3b82f6", bg: "rgba(59,130,246,.1)"  },
          { label: t("fine.unpaidAmt"), value: fmt(unpaidAmount),    icon: "bi-exclamation-triangle",  color: "#f59e0b", bg: "rgba(245,158,11,.1)"  },
          { label: t("fine.paidCount"),    value: paidCount,            icon: "bi-check-circle-fill",     color: "#16a34a", bg: "rgba(22,163,74,.1)"   },
        ].map(({ label, value, icon, color, bg }) => (
          <div key={label} className="col-6 col-md-3">
            <div className="card border-0 rounded-4 h-100"
              style={{ boxShadow: "0 2px 12px rgba(124,58,237,.08)" }}>
              <div className="card-body d-flex align-items-center gap-3 py-3 px-3">
                <div className="rounded-3 d-flex align-items-center justify-content-center flex-shrink-0"
                  style={{ width: 48, height: 48, background: bg }}>
                  <i className={`bi ${icon}`} style={{ color, fontSize: "1.35rem" }} />
                </div>
                <div>
                  <div className="fw-bold" style={{ fontSize: "1.3rem", color: "var(--bs-body-color)" }}>{value}</div>
                  <div className="text-secondary" style={{ fontSize: ".95rem" }}>{label}</div>
                </div>
              </div>
            </div>
          </div>
        ))}
      </div>

      {/* ── Filter chips + search ── */}
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
          style={{ maxWidth: 280, border: "1.5px solid #e4dcf8" }}>
          <span className="input-group-text bg-transparent border-0">
            <i className="bi bi-search" style={{ color: PU, fontSize: "1.05rem" }} />
          </span>
          <input type="text" className="form-control border-0 shadow-none"
            placeholder={t("fine.search")} value={search}
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
                <th className="px-4 py-3 fw-semibold" style={{ color: PU }}>Amount</th>
                <th className="px-4 py-3 fw-semibold" style={{ color: PU }}>Status</th>
                <th className="px-4 py-3 fw-semibold" style={{ color: PU }}>Due Date</th>
                <th className="px-4 py-3 fw-semibold" style={{ color: PU }}>Issued</th>
                <th className="px-4 py-3 fw-semibold text-end" style={{ color: PU }}>Actions</th>
              </tr>
            </thead>
            <tbody style={{ opacity: refreshing ? .55 : 1, transition: "opacity .3s" }}>
              {loading && (
                <tr>
                  <td colSpan={6} className="text-center py-5">
                    <div className="spinner-border" style={{ color: PU, width: 40, height: 40 }} role="status">
                      <span className="visually-hidden">Loading...</span>
                    </div>
                  </td>
                </tr>
              )}
              {!loading && fines.length === 0 && (
                <tr>
                  <td colSpan={6} className="text-center py-5">
                    <div className="d-flex flex-column align-items-center gap-2">
                      <div className="rounded-circle d-flex align-items-center justify-content-center"
                        style={{ width: 64, height: 64, background: PA(".08") }}>
                        <i className="bi bi-inbox" style={{ fontSize: "1.8rem", color: PU }} />
                      </div>
                      <span className="fw-semibold" style={{ color: "var(--bs-body-color)", fontSize: "1.15rem" }}>{t("fine.noResults")}</span>
                      <span className="text-secondary" style={{ fontSize: "1rem" }}>Try adjusting your filters</span>
                    </div>
                  </td>
                </tr>
              )}
              {!loading && fines.map((item) => (
                <tr key={item.id}
                  style={{
                    borderBottom: "1px solid #f3f0ff",
                    opacity: updating === item.id ? 0.45 : 1,
                    transition: "background .15s, opacity .25s",
                  }}
                  onMouseOver={(e) => { if (updating !== item.id) e.currentTarget.style.background = "#faf8ff"; }}
                  onMouseOut={(e)  => e.currentTarget.style.background = ""}>
                  <td className="px-4 py-3 fw-bold" style={{ color: PU }}>#{item.id}</td>
                  <td className="px-4 py-3 fw-bold" style={{ color: "var(--bs-body-color)" }}>{fmt(item.amount)}</td>
                  <td className="px-4 py-3"><FineBadge status={item.status} /></td>
                  <td className="px-4 py-3 text-secondary">
                    {item.due_date ? new Date(item.due_date).toLocaleDateString() : "—"}
                  </td>
                  <td className="px-4 py-3 text-secondary">
                    {item.created_at ? new Date(item.created_at).toLocaleDateString() : "—"}
                  </td>
                  <td className="px-4 py-3 text-end d-flex align-items-center justify-content-end gap-2">
                    {/* View button */}
                    <button
                      className="btn btn-sm rounded-2 d-inline-flex align-items-center gap-1 fw-semibold"
                      style={{ background: PA(".1"), color: PU, border: "none", fontSize: "1rem",
                        transition: "transform .12s" }}
                      onMouseDown={(e) => e.currentTarget.style.transform = "scale(.93)"}
                      onMouseUp={(e)   => e.currentTarget.style.transform = "scale(1)"}
                      onMouseLeave={(e) => e.currentTarget.style.transform = "scale(1)"}
                      onClick={() => openDetail(item.id)}>
                      <i className="bi bi-eye" />{t("fine.view")}
                    </button>
                    {/* Mark Paid button */}
                    {item.status !== "paid" && (
                      admin ? (
                        <button
                          className="btn btn-sm rounded-2 d-inline-flex align-items-center gap-1 fw-semibold"
                          style={{ background: "rgba(22,163,74,.1)", color: "#16a34a", border: "none", fontSize: "1rem",
                            transition: "transform .12s, opacity .12s", transform: "scale(1)" }}
                          disabled={updating === item.id}
                          onMouseDown={(e) => e.currentTarget.style.transform = "scale(.93)"}
                          onMouseUp={(e)   => e.currentTarget.style.transform = "scale(1)"}
                          onMouseLeave={(e) => e.currentTarget.style.transform = "scale(1)"}
                          onClick={() => handlePaid(item.id)}>
                          {updating === item.id
                            ? <span className="spinner-border spinner-border-sm" />
                            : <><i className="bi bi-check-circle" />Mark Paid</>}
                        </button>
                      ) : (
                        <span className="text-secondary" style={{ fontSize: ".85rem", fontStyle: "italic" }}>View only</span>
                      )
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

      {/* ═══════════════════════════════════════════
          Detail / Edit Modal
         ═══════════════════════════════════════════ */}
      {modalOpen && (
        <div className="position-fixed top-0 start-0 w-100 h-100 d-flex align-items-center justify-content-center"
          style={{ zIndex: 1060, background: "rgba(30,20,60,.45)", backdropFilter: "blur(4px)" }}
          onClick={closeModal}>
          <div className="card border-0 rounded-4 shadow-lg position-relative"
            style={{ width: "95%", maxWidth: 620, maxHeight: "90vh", overflow: "hidden", animation: "fadeIn .18s ease" }}
            onClick={(e) => e.stopPropagation()}>

            {/* Close button */}
            <button className="btn btn-sm position-absolute"
              style={{ top: 14, right: 14, zIndex: 10, background: PA(".08"), border: "none", borderRadius: "50%", width: 36, height: 36 }}
              onClick={closeModal}>
              <i className="bi bi-x-lg" style={{ color: PU, fontSize: "1.1rem" }} />
            </button>

            {/* Header */}
            <div className="px-4 pt-4 pb-2" style={{ paddingRight: 60 }}>
              <h5 className="fw-bold mb-0 d-flex align-items-center gap-2" style={{ color: "var(--bs-body-color)", fontSize: "1.3rem" }}>
                <div className="rounded-3 d-flex align-items-center justify-content-center flex-shrink-0" style={{ width: 42, height: 42, background: PA(".1") }}>
                  <i className="bi bi-receipt-cutoff" style={{ color: PU, fontSize: "1.2rem" }} />
                </div>
                {t("fine.detailTitle")}
                {detail && <span className="badge rounded-pill" style={{ background: PA(".1"), color: PU, fontSize: ".85rem" }}>#{detail.id}</span>}
              </h5>
              <p className="text-secondary mb-0 mt-1" style={{ fontSize: ".95rem" }}>{t("fine.detailSub")}</p>
            </div>

            <div className="overflow-auto px-4 pb-4" style={{ maxHeight: "calc(90vh - 180px)" }}>
              {/* Loading */}
              {detailLoad && (
                <div className="text-center py-5">
                  <div className="spinner-border" style={{ color: PU, width: 48, height: 48 }} />
                </div>
              )}

              {/* Error */}
              {detailErr && (
                <div className="alert d-flex align-items-center gap-2 rounded-3 mt-2"
                  style={{ background: "rgba(239,68,68,.08)", color: "#dc2626", border: "1px solid rgba(239,68,68,.18)" }}>
                  <i className="bi bi-exclamation-triangle-fill" />
                  {t("fine.detailError")}
                </div>
              )}

              {/* Detail content */}
              {detail && !detailLoad && (
                <div className="d-flex flex-column gap-3 mt-2">

                  {/* Status badge */}
                  <div className="d-flex align-items-center gap-2">
                    <FineBadge status={detail.status} />
                    {detail.payment_date && (
                      <span className="text-secondary" style={{ fontSize: ".9rem" }}>
                        <i className="bi bi-calendar-check me-1" />
                        {t("fine.paymentDate")}: {new Date(detail.payment_date).toLocaleDateString()}
                      </span>
                    )}
                  </div>

                  {/* ── Editable fields (admin only) ── */}
                  {admin ? (
                    <div className="card border-0 rounded-3" style={{ background: "#faf8ff" }}>
                      <div className="card-body d-flex flex-column gap-3">
                        <div>
                          <label className="form-label fw-semibold mb-1" style={{ color: PU, fontSize: ".95rem" }}>
                            <i className="bi bi-cash-stack me-1" />{t("fine.amountLabel")}
                          </label>
                          <input type="number" step="0.01" min="0" className="form-control rounded-2"
                            style={{ borderColor: "#e4dcf8", fontSize: "1.05rem" }}
                            value={editForm.amount}
                            onChange={(e) => setEditForm((p) => ({ ...p, amount: e.target.value }))} />
                        </div>
                        <div>
                          <label className="form-label fw-semibold mb-1" style={{ color: PU, fontSize: ".95rem" }}>
                            <i className="bi bi-calendar-event me-1" />{t("fine.dueDateLabel")}
                          </label>
                          <input type="date" className="form-control rounded-2"
                            style={{ borderColor: "#e4dcf8", fontSize: "1.05rem" }}
                            value={editForm.due_date}
                            onChange={(e) => setEditForm((p) => ({ ...p, due_date: e.target.value }))} />
                        </div>
                      </div>
                    </div>
                  ) : (
                    <div className="card border-0 rounded-3" style={{ background: "#faf8ff" }}>
                      <div className="card-body d-flex flex-column gap-2">
                        <InfoRow icon="bi-cash-stack"     label={t("fine.amountLabel")}  value={fmt(detail.amount)} />
                        <InfoRow icon="bi-calendar-event" label={t("fine.dueDateLabel")} value={detail.due_date ? new Date(detail.due_date).toLocaleDateString() : "—"} />
                      </div>
                    </div>
                  )}

                  {/* ── Linked violation info ── */}
                  {detail.violation_type && (
                    <div className="card border-0 rounded-3" style={{ background: "#f3f0ff" }}>
                      <div className="card-body">
                        <h6 className="fw-bold d-flex align-items-center gap-2 mb-3" style={{ color: PU, fontSize: "1.05rem" }}>
                          <i className="bi bi-link-45deg" />{t("fine.violationInfo")}
                        </h6>
                        <div className="d-flex flex-column gap-2">
                          <InfoRow icon="bi-exclamation-triangle" label={t("fine.violationType")} value={detail.violation_type} />
                          <InfoRow icon="bi-speedometer2" label={t("fine.severity")} value={detail.violation_severity} />
                          <InfoRow icon="bi-geo-alt" label={t("fine.location")} value={detail.violation_location ?? "—"} />
                          <InfoRow icon="bi-person" label={t("fine.driver")} value={detail.driver_display ?? "—"} />
                          <InfoRow icon="bi-car-front" label={t("fine.vehicle")} value={detail.vehicle_display ?? "—"} />
                        </div>
                      </div>
                    </div>
                  )}
                </div>
              )}
            </div>

            {/* ── Footer ── */}
            {detail && !detailLoad && (
              <div className="px-4 py-3 d-flex align-items-center gap-2 border-top" style={{ borderColor: "#f3f0ff" }}>
                {/* Pay button (admin, non-paid) */}
                {admin && detail.status !== "paid" && (
                  <button className="btn rounded-3 d-inline-flex align-items-center gap-2 fw-semibold"
                    style={{ background: "rgba(22,163,74,.1)", color: "#16a34a", border: "none", fontSize: "1rem" }}
                    disabled={paying}
                    onClick={handlePayInModal}>
                    {paying
                      ? <><span className="spinner-border spinner-border-sm" />{t("fine.paying")}</>
                      : <><i className="bi bi-check-circle" />{t("fine.payAction")}</>}
                  </button>
                )}
                <div className="flex-grow-1" />
                <button className="btn rounded-3 fw-semibold"
                  style={{ border: "1.5px solid #dce3ed", color: "#64748b", fontSize: "1rem" }}
                  onClick={closeModal}>
                  {t("fine.close")}
                </button>
                {admin && (
                  <button className="btn rounded-3 fw-semibold text-white d-inline-flex align-items-center gap-2"
                    style={{ background: PU, border: "none", fontSize: "1rem" }}
                    disabled={saving}
                    onClick={handleSave}>
                    {saving
                      ? <><span className="spinner-border spinner-border-sm" />{t("fine.saving")}</>
                      : <><i className="bi bi-check2" />{t("fine.save")}</>}
                  </button>
                )}
              </div>
            )}
          </div>
        </div>
      )}

    </div>
  );
}

/* ── helper row for read-only info ── */
function InfoRow({ icon, label, value }) {
  return (
    <div className="d-flex align-items-center gap-2" style={{ fontSize: ".98rem" }}>
      <i className={`bi ${icon}`} style={{ color: "#7c3aed", fontSize: ".95rem", width: 20, textAlign: "center" }} />
      <span className="text-secondary" style={{ minWidth: 110 }}>{label}</span>
      <span className="fw-semibold" style={{ color: "var(--bs-body-color)" }}>{value}</span>
    </div>
  );
}
