import { useCallback, useEffect, useRef, useState } from "react";
import Paginator from "../components/Paginator.jsx";
import StyledSelect from "../components/StyledSelect.jsx";
import { useAuth } from "../context/AuthContext.jsx";
import { useLanguage } from "../i18n/LanguageContext.jsx";
import {
  listPayments,
  fetchPayment,
  createPayment,
  updatePayment,
  fetchPaymentSummary,
} from "../services/paymentService.js";
import { listFines } from "../services/fineService.js";

const getPageSize = () => {
  try { return parseInt(JSON.parse(localStorage.getItem("settings.pageSize"))) || 10; }
  catch { return 10; }
};

const PU = "#7c3aed";
const PA = (a) => `rgba(124,58,237,${a})`;

const STATUS_MAP = {
  completed: { label: "Completed", bg: "rgba(22,163,74,.12)",  color: "#16a34a", icon: "bi-check-circle-fill" },
  pending:   { label: "Pending",   bg: "rgba(245,158,11,.12)", color: "#d97706", icon: "bi-clock" },
  failed:    { label: "Failed",    bg: "rgba(239,68,68,.12)",  color: "#dc2626", icon: "bi-x-circle-fill" },
  refunded:  { label: "Refunded",  bg: "rgba(99,102,241,.12)", color: "#6366f1", icon: "bi-arrow-counterclockwise" },
};

const METHOD_MAP = {
  cash:            { label: "Cash",            icon: "bi-cash" },
  bank_transfer:   { label: "Bank Transfer",   icon: "bi-bank" },
  credit_card:     { label: "Credit Card",     icon: "bi-credit-card" },
  mobile_payment:  { label: "Mobile Payment",  icon: "bi-phone" },
};

function StatusBadge({ status }) {
  const s = STATUS_MAP[status] ?? STATUS_MAP.pending;
  return (
    <span className="d-inline-flex align-items-center gap-1 px-2 py-1 rounded-2 fw-semibold"
      style={{ background: s.bg, color: s.color, fontSize: ".95rem" }}>
      <i className={`bi ${s.icon}`} style={{ fontSize: ".9rem" }} />{s.label}
    </span>
  );
}

function MethodBadge({ method }) {
  const m = METHOD_MAP[method] ?? { label: method, icon: "bi-question-circle" };
  return (
    <span className="d-inline-flex align-items-center gap-1 px-2 py-1 rounded-2 fw-semibold"
      style={{ background: PA(".08"), color: PU, fontSize: ".92rem" }}>
      <i className={`bi ${m.icon}`} style={{ fontSize: ".85rem" }} />{m.label}
    </span>
  );
}

function InfoRow({ icon, label, value }) {
  return (
    <div className="d-flex align-items-center gap-2" style={{ fontSize: "1rem" }}>
      <i className={`bi ${icon}`} style={{ color: PU, fontSize: "1rem", width: 22, textAlign: "center" }} />
      <span className="fw-semibold" style={{ color: "#64748b", minWidth: 110 }}>{label}</span>
      <span style={{ color: "var(--bs-body-color)" }}>{value ?? "—"}</span>
    </div>
  );
}

export default function Payments() {
  const { user, isAdmin } = useAuth();
  const { t } = useLanguage();
  const admin = isAdmin(user);

  const [payments, setPayments] = useState([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [search, setSearch] = useState("");
  const [filter, setFilter] = useState("all");
  const [page, setPage] = useState(1);
  const [total, setTotal] = useState(0);
  const [summary, setSummary] = useState(null);
  const searchTimer = useRef(null);
  const [debouncedSearch, setDebouncedSearch] = useState("");

  /* Detail modal */
  const [modalOpen, setModalOpen] = useState(false);
  const [detail, setDetail] = useState(null);
  const [detailLoad, setDetailLoad] = useState(false);
  const [detailErr, setDetailErr] = useState(false);

  /* New payment modal */
  const [addOpen, setAddOpen] = useState(false);
  const [addForm, setAddForm] = useState({ violation: "", amount: "", method: "cash", reference: "", notes: "" });
  const [creating, setCreating] = useState(false);
  const [finesList, setFinesList] = useState([]);

  const fmt = (n) => Number(n).toLocaleString("en-US", { style: "currency", currency: "USD" });

  const load = useCallback((pg = page, q = debouncedSearch, f = filter, isRefresh = false) => {
    if (isRefresh) setRefreshing(true);
    else setLoading(true);
    const params = { page: pg, page_size: getPageSize() };
    if (f !== "all") params.status = f;
    if (q) params.search = q;
    Promise.all([listPayments(params), fetchPaymentSummary()])
      .then(([d, sum]) => {
        setPayments(d.results ?? d ?? []);
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

  /* Detail */
  const openDetail = async (id) => {
    setModalOpen(true); setDetailLoad(true); setDetailErr(false); setDetail(null);
    try { setDetail(await fetchPayment(id)); }
    catch { setDetailErr(true); }
    finally { setDetailLoad(false); }
  };
  const closeModal = () => { setModalOpen(false); setDetail(null); };

  /* New payment */
  const openAdd = async () => {
    setAddForm({ violation: "", amount: "", method: "cash", reference: "", notes: "" });
    setAddOpen(true);
    try { const d = await listFines({ status: "pending", page_size: 100 }); setFinesList(d.results ?? d ?? []); }
    catch { setFinesList([]); }
  };

  const handleCreate = async () => {
    if (!addForm.violation || !addForm.amount) return;
    setCreating(true);
    try {
      await createPayment({ ...addForm, status: "completed" });
      setAddOpen(false);
      load(page, debouncedSearch, filter, true);
    } catch { /* noop */ }
    finally { setCreating(false); }
  };

  const totalCount = summary?.total_count ?? total;
  const completedAmt = summary?.completed_amount ?? 0;
  const pendingAmt = summary?.pending_amount ?? 0;
  const completedCount = summary?.completed_count ?? 0;

  const FILTERS = [
    { key: "all",       label: t("pay.all"),       color: PU },
    { key: "pending",   label: t("pay.pending"),   color: "#d97706" },
    { key: "completed", label: t("pay.completed"), color: "#16a34a" },
    { key: "failed",    label: t("pay.failed"),    color: "#dc2626" },
    { key: "refunded",  label: t("pay.refunded"),  color: "#6366f1" },
  ];

  return (
    <div className="d-flex flex-column gap-3 p-3" style={{ flex: 1, minHeight: 0, overflow: "hidden" }}>

      {/* Page header */}
      <div className="d-flex align-items-center justify-content-between flex-shrink-0">
        <div>
          <h5 className="fw-bold mb-0" style={{ color: "var(--bs-body-color)", fontSize: "1.5rem" }}>
            <i className="bi bi-credit-card-2-front me-2" style={{ color: PU }} />
            {t("pay.title")}
          </h5>
          <p className="mb-0 text-secondary" style={{ fontSize: "1rem" }}>{t("pay.subtitle")}</p>
        </div>
        <div className="d-flex gap-2">
          {admin && (
            <button className="btn rounded-3 d-flex align-items-center gap-2 fw-semibold"
              style={{ background: PU, color: "#fff", border: "none", fontSize: "1.05rem" }}
              onClick={openAdd}>
              <i className="bi bi-plus-lg" />{t("pay.record")}
            </button>
          )}
          <button className="btn rounded-3 d-flex align-items-center gap-2 fw-semibold"
            style={{ background: PA(".1"), color: PU, border: "none", fontSize: "1.05rem",
              opacity: refreshing ? .7 : 1, transition: "opacity .2s" }}
            disabled={refreshing}
            onClick={() => load(page, debouncedSearch, filter, true)}>
            <i className="bi bi-arrow-clockwise"
              style={refreshing ? { display: "inline-block", animation: "spin .65s linear infinite" } : {}} />
            {refreshing ? t("pay.refreshing") : t("pay.refresh")}
          </button>
        </div>
      </div>

      {/* Summary cards */}
      <div className="row g-3 flex-shrink-0">
        {[
          { label: t("pay.totalPayments"), value: totalCount,       icon: "bi-receipt",          color: PU,        bg: PA(".1") },
          { label: t("pay.completedAmt"),  value: fmt(completedAmt), icon: "bi-check-circle-fill", color: "#16a34a", bg: "rgba(22,163,74,.1)" },
          { label: t("pay.pendingAmt"),    value: fmt(pendingAmt),   icon: "bi-clock",            color: "#d97706", bg: "rgba(245,158,11,.1)" },
          { label: t("pay.completedCount"), value: completedCount,   icon: "bi-cash-stack",       color: "#3b82f6", bg: "rgba(59,130,246,.1)" },
        ].map(({ label, value, icon, color, bg }) => (
          <div key={label} className="col-6 col-md-3">
            <div className="card border-0 rounded-4 h-100" style={{ boxShadow: "0 2px 12px rgba(124,58,237,.08)" }}>
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

      {/* Filter chips + search */}
      <div className="d-flex align-items-center gap-2 flex-wrap flex-shrink-0">
        {FILTERS.map(({ key, label, color }) => (
          <button key={key} onClick={() => setFilter(key)}
            className="btn d-flex align-items-center gap-2 rounded-3 fw-semibold"
            style={{
              padding: ".45rem 1rem", fontSize: "1rem",
              background: filter === key ? color : "var(--bs-body-bg)",
              color: filter === key ? "#fff" : "var(--bs-secondary-color)",
              border: `1.5px solid ${filter === key ? color : "var(--bs-border-color)"}`,
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
            placeholder={t("pay.search")} value={search}
            onChange={(e) => setSearch(e.target.value)}
            style={{ fontSize: "1.05rem" }} />
        </div>
      </div>

      {/* Table */}
      <div className="card border-0 rounded-4 d-flex flex-column flex-fill"
        style={{ minHeight: 0, overflow: "hidden", boxShadow: "0 2px 16px rgba(124,58,237,.09)" }}>

        <div className="flex-fill overflow-auto no-scrollbar" style={{ minHeight: 0 }}>
          <table className="table mb-0" style={{ fontSize: "1.07rem" }}>
            <thead style={{ position: "sticky", top: 0, zIndex: 2 }}>
              <tr style={{ background: "#f8f5ff", borderBottom: `2px solid ${PA(".12")}` }}>
                <th className="px-4 py-3 fw-semibold" style={{ color: PU, width: 70 }}>#</th>
                <th className="px-4 py-3 fw-semibold" style={{ color: PU }}>{t("pay.amount")}</th>
                <th className="px-4 py-3 fw-semibold" style={{ color: PU }}>{t("pay.method")}</th>
                <th className="px-4 py-3 fw-semibold" style={{ color: PU }}>{t("pay.status")}</th>
                <th className="px-4 py-3 fw-semibold" style={{ color: PU }}>{t("pay.reference")}</th>
                <th className="px-4 py-3 fw-semibold" style={{ color: PU }}>{t("pay.date")}</th>
                <th className="px-4 py-3 fw-semibold text-end" style={{ color: PU }}>{t("pay.actions")}</th>
              </tr>
            </thead>
            <tbody style={{ opacity: refreshing ? .55 : 1, transition: "opacity .3s" }}>
              {loading && (
                <tr>
                  <td colSpan={7} className="text-center py-5">
                    <div className="spinner-border" style={{ color: PU, width: 40, height: 40 }} role="status">
                      <span className="visually-hidden">Loading...</span>
                    </div>
                  </td>
                </tr>
              )}
              {!loading && payments.length === 0 && (
                <tr>
                  <td colSpan={7} className="text-center py-5">
                    <div className="d-flex flex-column align-items-center gap-2">
                      <div className="rounded-circle d-flex align-items-center justify-content-center"
                        style={{ width: 64, height: 64, background: PA(".08") }}>
                        <i className="bi bi-inbox" style={{ fontSize: "1.8rem", color: PU }} />
                      </div>
                      <span className="fw-semibold" style={{ color: "var(--bs-body-color)", fontSize: "1.15rem" }}>{t("pay.noResults")}</span>
                    </div>
                  </td>
                </tr>
              )}
              {!loading && payments.map((item) => (
                <tr key={item.id}
                  style={{ borderBottom: "1px solid #f3f0ff", transition: "background .15s" }}
                  onMouseOver={(e) => e.currentTarget.style.background = "#faf8ff"}
                  onMouseOut={(e) => e.currentTarget.style.background = ""}>
                  <td className="px-4 py-3 fw-bold" style={{ color: PU }}>#{item.id}</td>
                  <td className="px-4 py-3 fw-bold" style={{ color: "var(--bs-body-color)" }}>{fmt(item.amount)}</td>
                  <td className="px-4 py-3"><MethodBadge method={item.method} /></td>
                  <td className="px-4 py-3"><StatusBadge status={item.status} /></td>
                  <td className="px-4 py-3 text-secondary">{item.reference || "—"}</td>
                  <td className="px-4 py-3 text-secondary">
                    {item.created_at ? new Date(item.created_at).toLocaleDateString() : "—"}
                  </td>
                  <td className="px-4 py-3 text-end">
                    <button
                      className="btn btn-sm rounded-2 d-inline-flex align-items-center gap-1 fw-semibold"
                      style={{ background: PA(".1"), color: PU, border: "none", fontSize: "1rem" }}
                      onClick={() => openDetail(item.id)}>
                      <i className="bi bi-eye" />{t("pay.view")}
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        <Paginator page={page} total={total} pageSize={getPageSize()} onChange={setPage} loading={loading || refreshing} />
      </div>

      {/* ── Detail Modal ── */}
      {modalOpen && (
        <div className="position-fixed top-0 start-0 w-100 h-100 d-flex align-items-center justify-content-center"
          style={{ zIndex: 1060, background: "rgba(30,20,60,.45)", backdropFilter: "blur(4px)" }}
          onClick={closeModal}>
          <div className="card border-0 rounded-4 shadow-lg position-relative"
            style={{ width: "95%", maxWidth: 560, maxHeight: "90vh", overflow: "hidden", animation: "fadeIn .18s ease" }}
            onClick={(e) => e.stopPropagation()}>
            <button className="btn btn-sm position-absolute"
              style={{ top: 14, right: 14, zIndex: 10, background: PA(".08"), border: "none", borderRadius: "50%", width: 36, height: 36 }}
              onClick={closeModal}>
              <i className="bi bi-x-lg" style={{ color: PU, fontSize: "1.1rem" }} />
            </button>
            <div className="px-4 pt-4 pb-2">
              <h5 className="fw-bold mb-0 d-flex align-items-center gap-2" style={{ color: "var(--bs-body-color)", fontSize: "1.3rem" }}>
                <div className="rounded-3 d-flex align-items-center justify-content-center flex-shrink-0"
                  style={{ width: 42, height: 42, background: PA(".1") }}>
                  <i className="bi bi-credit-card-2-front" style={{ color: PU, fontSize: "1.2rem" }} />
                </div>
                {t("pay.detailTitle")}
                {detail && <span className="badge rounded-pill" style={{ background: PA(".1"), color: PU, fontSize: ".85rem" }}>#{detail.id}</span>}
              </h5>
              <p className="text-secondary mb-0 mt-1" style={{ fontSize: ".95rem" }}>{t("pay.detailSub")}</p>
            </div>
            <div className="overflow-auto px-4 pb-4" style={{ maxHeight: "calc(90vh - 160px)" }}>
              {detailLoad && (
                <div className="text-center py-5">
                  <div className="spinner-border" style={{ color: PU, width: 48, height: 48 }} />
                </div>
              )}
              {detailErr && (
                <div className="alert d-flex align-items-center gap-2 rounded-3 mt-2"
                  style={{ background: "rgba(239,68,68,.08)", color: "#dc2626", border: "1px solid rgba(239,68,68,.18)" }}>
                  <i className="bi bi-exclamation-triangle-fill" />{t("pay.detailError")}
                </div>
              )}
              {detail && !detailLoad && (
                <div className="d-flex flex-column gap-3 mt-2">
                  <div className="d-flex align-items-center gap-3">
                    <StatusBadge status={detail.status} />
                    <MethodBadge method={detail.method} />
                  </div>
                  <div className="card border-0 rounded-3" style={{ background: "#faf8ff" }}>
                    <div className="card-body d-flex flex-column gap-2">
                      <InfoRow icon="bi-cash-stack" label={t("pay.amount")} value={fmt(detail.amount)} />
                      <InfoRow icon="bi-hash" label={t("pay.reference")} value={detail.reference || "—"} />
                      <InfoRow icon="bi-calendar3" label={t("pay.date")} value={detail.created_at ? new Date(detail.created_at).toLocaleString() : "—"} />
                      <InfoRow icon="bi-card-text" label={t("pay.notes")} value={detail.notes || "—"} />
                    </div>
                  </div>
                  {detail.violation_type && (
                    <div className="card border-0 rounded-3" style={{ background: "#f3f0ff" }}>
                      <div className="card-body">
                        <h6 className="fw-bold d-flex align-items-center gap-2 mb-3" style={{ color: PU, fontSize: "1.05rem" }}>
                          <i className="bi bi-link-45deg" />{t("pay.violationInfo")}
                        </h6>
                        <InfoRow icon="bi-exclamation-triangle" label={t("pay.violationType")} value={detail.violation_type} />
                        <InfoRow icon="bi-person" label={t("pay.driver")} value={detail.driver_display || "—"} />
                        <InfoRow icon="bi-car-front" label={t("pay.vehicle")} value={detail.vehicle_display || "—"} />
                      </div>
                    </div>
                  )}
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* ── New Payment Modal ── */}
      {addOpen && (
        <div className="position-fixed top-0 start-0 w-100 h-100 d-flex align-items-center justify-content-center"
          style={{ zIndex: 1060, background: "rgba(30,20,60,.45)", backdropFilter: "blur(4px)" }}
          onClick={() => setAddOpen(false)}>
          <div className="card border-0 rounded-4 shadow-lg position-relative"
            style={{ width: "95%", maxWidth: 520, animation: "fadeIn .18s ease" }}
            onClick={(e) => e.stopPropagation()}>
            <button className="btn btn-sm position-absolute"
              style={{ top: 14, right: 14, zIndex: 10, background: PA(".08"), border: "none", borderRadius: "50%", width: 36, height: 36 }}
              onClick={() => setAddOpen(false)}>
              <i className="bi bi-x-lg" style={{ color: PU, fontSize: "1.1rem" }} />
            </button>
            <div className="px-4 pt-4 pb-2">
              <h5 className="fw-bold mb-0 d-flex align-items-center gap-2" style={{ color: "var(--bs-body-color)", fontSize: "1.3rem" }}>
                <div className="rounded-3 d-flex align-items-center justify-content-center flex-shrink-0"
                  style={{ width: 42, height: 42, background: PA(".1") }}>
                  <i className="bi bi-plus-circle" style={{ color: PU, fontSize: "1.2rem" }} />
                </div>
                {t("pay.addTitle")}
              </h5>
              <p className="text-secondary mb-0 mt-1" style={{ fontSize: ".95rem" }}>{t("pay.addSub")}</p>
            </div>
            <div className="px-4 pb-4 d-flex flex-column gap-3">
              <div>
                <label className="form-label fw-semibold mb-1" style={{ color: PU, fontSize: ".95rem" }}>
                  {t("pay.violation")}
                </label>
                <StyledSelect
                  value={addForm.violation}
                  onChange={(v) => {
                    setAddForm((p) => ({ ...p, violation: v }));
                    const fine = finesList.find((f) => String(f.violation) === String(v));
                    if (fine) setAddForm((p) => ({ ...p, violation: v, amount: String(fine.amount) }));
                  }}
                  placeholder={t("pay.selectViolation")}
                  icon="bi-exclamation-triangle"
                  options={finesList.map((f) => ({
                    value: f.violation,
                    label: `Violation #${f.violation} — ${fmt(f.amount)}`,
                    icon: "bi-receipt",
                  }))}
                />
              </div>
              <div>
                <label className="form-label fw-semibold mb-1" style={{ color: PU, fontSize: ".95rem" }}>
                  {t("pay.amount")}
                </label>
                <input type="number" step="0.01" min="0" className="form-control rounded-2"
                  style={{ borderColor: "#e4dcf8" }}
                  value={addForm.amount}
                  onChange={(e) => setAddForm((p) => ({ ...p, amount: e.target.value }))} />
              </div>
              <div>
                <label className="form-label fw-semibold mb-1" style={{ color: PU, fontSize: ".95rem" }}>
                  {t("pay.method")}
                </label>
                <StyledSelect
                  value={addForm.method}
                  onChange={(v) => setAddForm((p) => ({ ...p, method: v }))}
                  options={[
                    { value: "cash",           label: "Cash",           icon: "bi-cash-stack",   color: "#16a34a" },
                    { value: "bank_transfer",  label: "Bank Transfer",  icon: "bi-bank",         color: "#2563eb" },
                    { value: "credit_card",    label: "Credit Card",    icon: "bi-credit-card",  color: "#7c3aed" },
                    { value: "mobile_payment", label: "Mobile Payment", icon: "bi-phone",        color: "#d97706" },
                  ]}
                />
              </div>
              <div>
                <label className="form-label fw-semibold mb-1" style={{ color: PU, fontSize: ".95rem" }}>
                  {t("pay.reference")}
                </label>
                <input type="text" className="form-control rounded-2" style={{ borderColor: "#e4dcf8" }}
                  value={addForm.reference}
                  onChange={(e) => setAddForm((p) => ({ ...p, reference: e.target.value }))} />
              </div>
              <div>
                <label className="form-label fw-semibold mb-1" style={{ color: PU, fontSize: ".95rem" }}>
                  {t("pay.notes")}
                </label>
                <textarea className="form-control rounded-2" rows={2} style={{ borderColor: "#e4dcf8" }}
                  value={addForm.notes}
                  onChange={(e) => setAddForm((p) => ({ ...p, notes: e.target.value }))} />
              </div>
              <div className="d-flex justify-content-end gap-2 pt-2">
                <button className="btn rounded-3 fw-semibold" style={{ border: `1.5px solid #dce3ed`, color: "#64748b" }}
                  onClick={() => setAddOpen(false)}>{t("pay.cancel")}</button>
                <button className="btn rounded-3 fw-semibold"
                  style={{ background: PU, color: "#fff", border: "none" }}
                  disabled={creating || !addForm.violation || !addForm.amount}
                  onClick={handleCreate}>
                  {creating ? <span className="spinner-border spinner-border-sm" /> : <><i className="bi bi-check-lg me-1" />{t("pay.create")}</>}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
