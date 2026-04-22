import { useCallback, useEffect, useRef, useState } from "react";
import Paginator from "../components/Paginator.jsx";
import { useAuth } from "../context/AuthContext.jsx";
import { useLanguage } from "../i18n/LanguageContext.jsx";
import { listUsers, getUser, createUser, updateUser, deleteUser } from "../services/userService.js";

const getPageSize = () => {
  try { return parseInt(JSON.parse(localStorage.getItem("settings.pageSize"))) || 10; }
  catch { return 10; }
};

const PU = "#7c3aed";
const PA = (a) => `rgba(124,58,237,${a})`;

function InfoRow({ icon, label, value }) {
  return (
    <div className="d-flex align-items-center gap-2" style={{ fontSize: "1rem" }}>
      <i className={`bi ${icon}`} style={{ color: PU, fontSize: "1rem", width: 22, textAlign: "center" }} />
      <span className="fw-semibold" style={{ color: "#64748b", minWidth: 120 }}>{label}</span>
      <span style={{ color: "var(--bs-body-color)" }}>{value ?? "—"}</span>
    </div>
  );
}

export default function Drivers() {
  const { user } = useAuth();
  const { t } = useLanguage();
  const admin = user?.role === "admin";

  const [drivers, setDrivers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [search, setSearch] = useState("");
  const [page, setPage] = useState(1);
  const [total, setTotal] = useState(0);
  const searchTimer = useRef(null);
  const [debouncedSearch, setDebouncedSearch] = useState("");

  /* Detail modal */
  const [modalOpen, setModalOpen] = useState(false);
  const [detail, setDetail] = useState(null);
  const [detailLoad, setDetailLoad] = useState(false);
  const [detailErr, setDetailErr] = useState(false);

  /* Delete confirm */
  const [deleteId, setDeleteId] = useState(null);
  const [deleting, setDeleting] = useState(false);

  /* Edit modal */
  const [editDriver, setEditDriver] = useState(null);

  /* Create modal */
  const [showCreate, setShowCreate] = useState(false);

  const load = useCallback((pg = page, q = debouncedSearch, isRefresh = false) => {
    if (isRefresh) setRefreshing(true);
    else setLoading(true);
    const params = { page: pg, page_size: getPageSize(), role: "driver" };
    if (q) params.search = q;
    listUsers(params)
      .then((d) => {
        setDrivers(d.results ?? d ?? []);
        setTotal(d.count ?? (Array.isArray(d) ? d.length : 0));
      })
      .catch(() => {})
      .finally(() => { setLoading(false); setRefreshing(false); });
  }, []); // eslint-disable-line

  useEffect(() => { load(1, ""); }, []); // eslint-disable-line

  /* Listen for cross-page sync */
  useEffect(() => {
    const onSync = () => load(page, debouncedSearch, true);
    window.addEventListener("users-changed", onSync);
    return () => window.removeEventListener("users-changed", onSync);
  }); // runs every render to capture latest page/search

  useEffect(() => {
    clearTimeout(searchTimer.current);
    searchTimer.current = setTimeout(() => setDebouncedSearch(search), 350);
    return () => clearTimeout(searchTimer.current);
  }, [search]);

  const isFirstRender = useRef(true);
  useEffect(() => {
    if (isFirstRender.current) { isFirstRender.current = false; return; }
    setPage(1);
    load(1, debouncedSearch);
  }, [debouncedSearch]); // eslint-disable-line

  const prevPage = useRef(1);
  useEffect(() => {
    if (prevPage.current === page) return;
    prevPage.current = page;
    load(page, debouncedSearch, true);
  }, [page]); // eslint-disable-line

  /* Detail */
  const openDetail = async (id) => {
    setModalOpen(true); setDetailLoad(true); setDetailErr(false); setDetail(null);
    try { setDetail(await getUser(id)); }
    catch { setDetailErr(true); }
    finally { setDetailLoad(false); }
  };
  const closeModal = () => { setModalOpen(false); setDetail(null); };

  /* Delete */
  const handleDelete = async () => {
    if (!deleteId) return;
    setDeleting(true);
    try {
      await deleteUser(deleteId);
      setDeleteId(null);
      load(page, debouncedSearch, true);
      window.dispatchEvent(new Event("users-changed"));
    }
    catch { /* noop */ }
    finally { setDeleting(false); }
  };

  const userName = (d) => {
    if (!d) return "—";
    const name = `${d.first_name || ""} ${d.last_name || ""}`.trim();
    return name || d.email;
  };

  /* hide auto-generated placeholders */
  const displayField = (v) => {
    if (!v) return "—";
    if (/^(DRV-|NID-|OFF-)[a-f0-9]{8}$/i.test(v)) return "—";
    return v;
  };

  return (
    <div className="d-flex flex-column gap-3 p-3" style={{ flex: 1, minHeight: 0, overflow: "hidden" }}>

      {/* Header */}
      <div className="d-flex align-items-center justify-content-between flex-shrink-0">
        <div>
          <h5 className="fw-bold mb-0" style={{ color: "var(--bs-body-color)", fontSize: "1.5rem" }}>
            <i className="bi bi-person-vcard me-2" style={{ color: PU }} />
            {t("drv.title")}
          </h5>
          <p className="mb-0 text-secondary" style={{ fontSize: "1rem" }}>{t("drv.subtitle")}</p>
        </div>
        <div className="d-flex align-items-center gap-2">
          {admin && (
            <button className="btn rounded-3 d-flex align-items-center gap-2 fw-semibold"
              style={{ background: PU, color: "#fff", border: "none", fontSize: "1.05rem" }}
              onClick={() => setShowCreate(true)}>
              <i className="bi bi-plus-lg" />{t("drv.addDriver")}
            </button>
          )}
          <button className="btn rounded-3 d-flex align-items-center gap-2 fw-semibold"
            style={{ background: PA(".1"), color: PU, border: "none", fontSize: "1.05rem",
              opacity: refreshing ? .7 : 1, transition: "opacity .2s" }}
            disabled={refreshing}
            onClick={() => load(page, debouncedSearch, true)}>
            <i className="bi bi-arrow-clockwise"
              style={refreshing ? { display: "inline-block", animation: "spin .65s linear infinite" } : {}} />
            {refreshing ? t("drv.refreshing") : t("drv.refresh")}
          </button>
        </div>
      </div>

      {/* Stats */}
      <div className="row g-3 flex-shrink-0">
        <div className="col-6 col-md-3">
          <div className="card border-0 rounded-4 h-100" style={{ boxShadow: "0 2px 12px rgba(124,58,237,.08)" }}>
            <div className="card-body d-flex align-items-center gap-3 py-3 px-3">
              <div className="rounded-3 d-flex align-items-center justify-content-center flex-shrink-0"
                style={{ width: 48, height: 48, background: PA(".1") }}>
                <i className="bi bi-people-fill" style={{ color: PU, fontSize: "1.35rem" }} />
              </div>
              <div>
                <div className="fw-bold" style={{ fontSize: "1.3rem", color: "var(--bs-body-color)" }}>{total}</div>
                <div className="text-secondary" style={{ fontSize: ".95rem" }}>{t("drv.totalDrivers")}</div>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Search */}
      <div className="d-flex align-items-center gap-2 flex-wrap flex-shrink-0">
        <div className="ms-auto input-group rounded-3 overflow-hidden"
          style={{ maxWidth: 320, border: "1.5px solid #e4dcf8" }}>
          <span className="input-group-text bg-transparent border-0">
            <i className="bi bi-search" style={{ color: PU, fontSize: "1.05rem" }} />
          </span>
          <input type="text" className="form-control border-0 shadow-none"
            placeholder={t("drv.search")} value={search}
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
                <th className="px-4 py-3 fw-semibold" style={{ color: PU }}>{t("drv.name")}</th>
                <th className="px-4 py-3 fw-semibold" style={{ color: PU }}>{t("drv.license")}</th>
                <th className="px-4 py-3 fw-semibold" style={{ color: PU }}>{t("drv.nationalId")}</th>
                <th className="px-4 py-3 fw-semibold" style={{ color: PU }}>{t("drv.address")}</th>
                <th className="px-4 py-3 fw-semibold" style={{ color: PU }}>{t("drv.dob")}</th>
                <th className="px-4 py-3 fw-semibold text-end" style={{ color: PU }}>{t("drv.actions")}</th>
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
              {!loading && drivers.length === 0 && (
                <tr>
                  <td colSpan={7} className="text-center py-5">
                    <div className="d-flex flex-column align-items-center gap-2">
                      <div className="rounded-circle d-flex align-items-center justify-content-center"
                        style={{ width: 64, height: 64, background: PA(".08") }}>
                        <i className="bi bi-inbox" style={{ fontSize: "1.8rem", color: PU }} />
                      </div>
                      <span className="fw-semibold" style={{ color: "var(--bs-body-color)", fontSize: "1.15rem" }}>{t("drv.noResults")}</span>
                    </div>
                  </td>
                </tr>
              )}
              {!loading && drivers.map((item) => (
                <tr key={item.id}
                  style={{ borderBottom: "1px solid #f3f0ff", transition: "background .15s" }}
                  onMouseOver={(e) => e.currentTarget.style.background = "#faf8ff"}
                  onMouseOut={(e) => e.currentTarget.style.background = ""}>
                  <td className="px-4 py-3 fw-bold" style={{ color: PU }}>#{item.id}</td>
                  <td className="px-4 py-3 fw-semibold" style={{ color: "var(--bs-body-color)" }}>{userName(item)}</td>
                  <td className="px-4 py-3 text-secondary">{displayField(item.driver_profile?.license_number)}</td>
                  <td className="px-4 py-3 text-secondary">{displayField(item.driver_profile?.national_id)}</td>
                  <td className="px-4 py-3 text-secondary">{item.driver_profile?.address || "—"}</td>
                  <td className="px-4 py-3 text-secondary">
                    {item.driver_profile?.date_of_birth ? new Date(item.driver_profile.date_of_birth).toLocaleDateString() : "—"}
                  </td>
                  <td className="px-4 py-3 text-end d-flex align-items-center justify-content-end gap-2">
                    <button
                      className="btn btn-sm rounded-2 d-inline-flex align-items-center gap-1 fw-semibold"
                      style={{ background: PA(".1"), color: PU, border: "none", fontSize: "1rem" }}
                      onClick={() => openDetail(item.id)}>
                      <i className="bi bi-eye" />{t("drv.view")}
                    </button>
                    {admin && (
                      <button
                        className="btn btn-sm rounded-2 d-inline-flex align-items-center gap-1 fw-semibold"
                        style={{ background: "rgba(34,197,94,.1)", color: "#16a34a", border: "none", fontSize: "1rem" }}
                        onClick={() => setEditDriver(item)}>
                        <i className="bi bi-pencil-square" />{t("drv.edit")}
                      </button>
                    )}
                    {admin && (
                      <button
                        className="btn btn-sm rounded-2 d-inline-flex align-items-center gap-1 fw-semibold"
                        style={{ background: "rgba(239,68,68,.1)", color: "#dc2626", border: "none", fontSize: "1rem" }}
                        onClick={() => setDeleteId(item.id)}>
                        <i className="bi bi-trash3" />
                      </button>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        <Paginator page={page} total={total} pageSize={getPageSize()} onChange={setPage} loading={loading || refreshing} />
      </div>

      {/* Detail Modal */}
      {modalOpen && (
        <div className="position-fixed top-0 start-0 w-100 h-100 d-flex align-items-center justify-content-center"
          style={{ zIndex: 1060, background: "rgba(30,20,60,.45)", backdropFilter: "blur(4px)" }}
          onClick={closeModal}>
          <div className="card border-0 rounded-4 shadow-lg position-relative"
            style={{ width: "95%", maxWidth: 540, maxHeight: "90vh", overflow: "hidden", animation: "fadeIn .18s ease" }}
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
                  <i className="bi bi-person-vcard" style={{ color: PU, fontSize: "1.2rem" }} />
                </div>
                {t("drv.detailTitle")}
                {detail && <span className="badge rounded-pill" style={{ background: PA(".1"), color: PU, fontSize: ".85rem" }}>#{detail.id}</span>}
              </h5>
            </div>
            <div className="overflow-auto px-4 pb-4" style={{ maxHeight: "calc(90vh - 140px)" }}>
              {detailLoad && (
                <div className="text-center py-5">
                  <div className="spinner-border" style={{ color: PU, width: 48, height: 48 }} />
                </div>
              )}
              {detailErr && (
                <div className="alert d-flex align-items-center gap-2 rounded-3 mt-2"
                  style={{ background: "rgba(239,68,68,.08)", color: "#dc2626", border: "1px solid rgba(239,68,68,.18)" }}>
                  <i className="bi bi-exclamation-triangle-fill" />{t("drv.detailError")}
                </div>
              )}
              {detail && !detailLoad && (
                <div className="d-flex flex-column gap-3 mt-2">
                  <div className="card border-0 rounded-3" style={{ background: "#faf8ff" }}>
                    <div className="card-body d-flex flex-column gap-2">
                      <InfoRow icon="bi-person" label={t("drv.name")} value={userName(detail)} />
                      <InfoRow icon="bi-envelope" label={t("drv.email")} value={detail.email} />
                      <InfoRow icon="bi-telephone" label={t("drv.phone")} value={detail.phone || "—"} />
                      <InfoRow icon="bi-card-text" label={t("drv.license")} value={displayField(detail.driver_profile?.license_number)} />
                      <InfoRow icon="bi-person-badge" label={t("drv.nationalId")} value={displayField(detail.driver_profile?.national_id)} />
                      <InfoRow icon="bi-geo-alt" label={t("drv.address")} value={detail.driver_profile?.address || "—"} />
                      <InfoRow icon="bi-calendar" label={t("drv.dob")} value={detail.driver_profile?.date_of_birth ? new Date(detail.driver_profile.date_of_birth).toLocaleDateString() : "—"} />
                    </div>
                  </div>
                  {admin && (
                    <button className="btn rounded-3 fw-semibold d-flex align-items-center justify-content-center gap-2"
                      style={{ background: PA(".08"), color: PU, border: "none", fontSize: "1rem", padding: "10px 0" }}
                      onClick={() => { closeModal(); setEditDriver(detail); }}>
                      <i className="bi bi-pencil-square" />{t("drv.edit")}
                    </button>
                  )}
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Delete confirmation */}
      {deleteId && (
        <div className="position-fixed top-0 start-0 w-100 h-100 d-flex align-items-center justify-content-center"
          style={{ zIndex: 1070, background: "rgba(30,20,60,.45)", backdropFilter: "blur(4px)" }}
          onClick={() => setDeleteId(null)}>
          <div className="card border-0 rounded-4 shadow-lg" style={{ width: "95%", maxWidth: 400, animation: "fadeIn .18s ease" }}
            onClick={(e) => e.stopPropagation()}>
            <div className="card-body text-center py-4 px-4">
              <div className="rounded-circle d-inline-flex align-items-center justify-content-center mb-3"
                style={{ width: 56, height: 56, background: "rgba(239,68,68,.1)" }}>
                <i className="bi bi-exclamation-triangle-fill" style={{ fontSize: "1.6rem", color: "#dc2626" }} />
              </div>
              <h6 className="fw-bold mb-2" style={{ fontSize: "1.15rem" }}>{t("drv.deleteTitle")}</h6>
              <p className="text-secondary">{t("drv.deleteMsg")} #{deleteId}?</p>
              <div className="d-flex justify-content-center gap-2 mt-3">
                <button className="btn rounded-3 fw-semibold" style={{ border: "1.5px solid #dce3ed", color: "#64748b" }}
                  onClick={() => setDeleteId(null)}>{t("drv.cancel")}</button>
                <button className="btn rounded-3 fw-semibold"
                  style={{ background: "#dc2626", color: "#fff", border: "none" }}
                  disabled={deleting} onClick={handleDelete}>
                  {deleting ? <span className="spinner-border spinner-border-sm" /> : t("drv.confirmDelete")}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Edit Driver Modal */}
      {editDriver && (
        <EditDriverModal
          driver={editDriver}
          onUpdated={(updated) => {
            setEditDriver(null);
            setDrivers(prev => prev.map(d => d.id === updated.id ? updated : d));
            window.dispatchEvent(new Event("users-changed"));
          }}
          onCancel={() => setEditDriver(null)}
        />
      )}

      {/* Create Driver Modal */}
      {showCreate && (
        <CreateDriverModal
          onCreated={() => {
            setShowCreate(false);
            load(1, debouncedSearch, true);
            setPage(1);
            window.dispatchEvent(new Event("users-changed"));
          }}
          onCancel={() => setShowCreate(false)}
        />
      )}
    </div>
  );
}

/* ── Edit Driver Modal ────────────────────────────────────────────── */
const modalBackdrop = {
  position: "fixed", inset: 0, zIndex: 1070,
  background: "rgba(30,20,60,.45)", backdropFilter: "blur(4px)",
  display: "flex", alignItems: "center", justifyContent: "center",
};
const modalCard = {
  width: "95%", maxWidth: 520, borderRadius: 18,
  background: "var(--card-bg, #fff)", boxShadow: "0 8px 40px rgba(124,58,237,.18)",
  padding: "1.5rem 1.8rem", animation: "fadeIn .18s ease",
  maxHeight: "90vh", overflowY: "auto",
};
const fieldLabel = { fontSize: ".82rem", fontWeight: 600, marginBottom: 4, color: "var(--text-muted, #64748b)" };
const inputStyle = {
  width: "100%", padding: "9px 13px", borderRadius: 10,
  border: "1.5px solid var(--border-color, #e2e8f0)",
  background: "var(--input-bg, #f8fafc)", fontSize: ".95rem",
  outline: "none", transition: "border .15s",
  color: "var(--text-color, #1e293b)",
};

function EditDriverModal({ driver, onUpdated, onCancel }) {
  const { t } = useLanguage();
  const dp = driver.driver_profile || {};
  const clean = (v) => /^(DRV-|NID-|OFF-)[a-f0-9]{8}$/i.test(v) ? "" : (v || "");

  const [form, setForm] = useState({
    first_name: driver.first_name || "",
    last_name: driver.last_name || "",
    phone: driver.phone || "",
    license_number: clean(dp.license_number),
    national_id: clean(dp.national_id),
    address: dp.address || "",
    date_of_birth: dp.date_of_birth || "",
  });
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const set = (k, v) => setForm(f => ({ ...f, [k]: v }));

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!form.license_number.trim()) { setError(t("drv.errLicense")); return; }
    if (!form.national_id.trim()) { setError(t("drv.errNationalId")); return; }
    setSaving(true); setError("");
    try {
      const updated = await updateUser(driver.id, {
        first_name: form.first_name,
        last_name: form.last_name,
        phone: form.phone,
        driver_profile: {
          license_number: form.license_number,
          national_id: form.national_id,
          address: form.address,
          date_of_birth: form.date_of_birth || null,
        },
      });
      onUpdated(updated);
    } catch (err) {
      const d = err?.response?.data;
      const msg = d?.detail || d?.license_number?.[0] || d?.national_id?.[0] || t("drv.editFailed");
      setError(msg);
    } finally {
      setSaving(false);
    }
  };

  return (
    <div style={modalBackdrop} onClick={onCancel}>
      <div style={modalCard} onClick={e => e.stopPropagation()}>
        <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: "1.5rem" }}>
          <div style={{
            width: 44, height: 44, borderRadius: 12,
            background: PA(0.1), display: "flex", alignItems: "center", justifyContent: "center",
          }}>
            <i className="bi bi-pencil-square" style={{ fontSize: "1.2rem", color: PU }} />
          </div>
          <div>
            <h3 style={{ margin: 0, fontSize: "1.1rem", fontWeight: 700 }}>{t("drv.editTitle")}</h3>
            <p style={{ margin: 0, fontSize: ".8rem", color: "var(--text-muted, #64748b)" }}>
              {driver.email}
            </p>
          </div>
        </div>

        {error && (
          <div style={{ background: "rgba(239,68,68,.1)", color: "#ef4444", borderRadius: 10, padding: "10px 14px", marginBottom: 12, fontSize: ".85rem", fontWeight: 600 }}>
            <i className="bi bi-exclamation-circle-fill me-2" />{error}
          </div>
        )}

        <form onSubmit={handleSubmit}>
          {/* Name fields */}
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12, marginBottom: 12 }}>
            <div>
              <label style={fieldLabel}>{t("drv.firstName")}</label>
              <input style={inputStyle} value={form.first_name}
                placeholder={t("drv.phFirstName")}
                onChange={e => set("first_name", e.target.value)} />
            </div>
            <div>
              <label style={fieldLabel}>{t("drv.lastName")}</label>
              <input style={inputStyle} value={form.last_name}
                placeholder={t("drv.phLastName")}
                onChange={e => set("last_name", e.target.value)} />
            </div>
          </div>
          <div style={{ marginBottom: 12 }}>
            <label style={fieldLabel}>{t("drv.phone")}</label>
            <input style={inputStyle} value={form.phone}
              placeholder={t("drv.phPhone")}
              onChange={e => set("phone", e.target.value)} />
          </div>
          {/* Driver profile fields */}
          <div style={{ borderTop: "1px solid var(--border-color, #e2e8f0)", paddingTop: 12, marginBottom: 12 }}>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
              <div>
                <label style={fieldLabel}>{t("drv.license")} *</label>
                <input style={inputStyle} required value={form.license_number}
                  placeholder={t("drv.phLicense")}
                  onChange={e => set("license_number", e.target.value)} />
              </div>
              <div>
                <label style={fieldLabel}>{t("drv.nationalId")} *</label>
                <input style={inputStyle} required value={form.national_id}
                  placeholder={t("drv.phNationalId")}
                  onChange={e => set("national_id", e.target.value)} />
              </div>
            </div>
          </div>
          <div style={{ marginBottom: 12 }}>
            <label style={fieldLabel}>{t("drv.address")}</label>
            <input style={inputStyle} value={form.address}
              placeholder={t("drv.phAddress")}
              onChange={e => set("address", e.target.value)} />
          </div>
          <div style={{ marginBottom: 16 }}>
            <label style={fieldLabel}>{t("drv.dob")}</label>
            <input style={inputStyle} type="date" value={form.date_of_birth}
              onChange={e => set("date_of_birth", e.target.value)} />
          </div>
          <div style={{ display: "flex", gap: 10 }}>
            <button type="button" onClick={onCancel} style={{
              flex: 1, padding: "10px 20px", borderRadius: 10,
              border: "1px solid var(--border-color, #e2e8f0)",
              background: "transparent", color: "var(--text-color, #1e293b)",
              fontWeight: 600, cursor: "pointer", fontSize: ".9rem",
            }}>{t("drv.cancel")}</button>
            <button type="submit" disabled={saving} style={{
              flex: 1, padding: "10px 20px", borderRadius: 10, border: "none",
              background: PU, color: "#fff", fontWeight: 600,
              cursor: "pointer", fontSize: ".9rem",
              opacity: saving ? 0.6 : 1,
            }}>{saving ? t("common.saving") : t("drv.saveChanges")}</button>
          </div>
        </form>
      </div>
    </div>
  );
}

/* ── Create Driver Modal ──────────────────────────────────────────── */
const PW_RULES = [
  { key: "len",   re: /.{8,}/,        label: "pwd.ruleLen" },
  { key: "upper", re: /[A-Z]/,        label: "pwd.ruleUpper" },
  { key: "num",   re: /[0-9]/,        label: "pwd.ruleNum" },
  { key: "spec",  re: /[^A-Za-z0-9]/, label: "pwd.ruleSpec" },
];
const PW_META = [
  { min: 0, color: "#ef4444", label: "pwd.weak" },
  { min: 1, color: "#f59e0b", label: "pwd.fair" },
  { min: 2, color: "#f59e0b", label: "pwd.fair" },
  { min: 3, color: "#22c55e", label: "pwd.good" },
  { min: 4, color: "#16a34a", label: "pwd.strong" },
];

function CreateDriverModal({ onCreated, onCancel }) {
  const { t } = useLanguage();
  const [form, setForm] = useState({
    email: "", username: "", password: "",
    first_name: "", last_name: "", phone: "",
    license_number: "", national_id: "",
    address: "", date_of_birth: "",
  });
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [showPw, setShowPw] = useState(false);
  const [pwFocus, setPwFocus] = useState(false);
  const set = (k, v) => setForm(f => ({ ...f, [k]: v }));

  const pwChecks = PW_RULES.map(r => r.re.test(form.password));
  const pwScore = pwChecks.filter(Boolean).length;
  const meta = PW_META[pwScore];

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!form.email.trim() || !form.username.trim() || !form.password) {
      setError("Email, username, and password are required."); return;
    }
    if (!form.license_number.trim()) { setError(t("drv.errLicense")); return; }
    if (!form.national_id.trim()) { setError(t("drv.errNationalId")); return; }
    if (pwScore < 3) { setError(t("pwd.tooWeak")); return; }
    setSaving(true); setError("");
    try {
      await createUser({ ...form, role: "driver" });
      onCreated();
    } catch (err) {
      const d = err?.response?.data;
      const msg = d?.detail || d?.license_number?.[0] || d?.national_id?.[0] || d?.email?.[0] || t("drv.addFailed");
      setError(msg);
    } finally { setSaving(false); }
  };

  return (
    <div style={modalBackdrop} onClick={onCancel}>
      <div style={{ ...modalCard, maxWidth: 580 }} onClick={e => e.stopPropagation()}>
        <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: "1.5rem" }}>
          <div style={{
            width: 44, height: 44, borderRadius: 12,
            background: PA(0.1), display: "flex", alignItems: "center", justifyContent: "center",
          }}>
            <i className="bi bi-person-plus-fill" style={{ fontSize: "1.2rem", color: PU }} />
          </div>
          <div>
            <h3 style={{ margin: 0, fontSize: "1.1rem", fontWeight: 700 }}>{t("drv.addTitle")}</h3>
            <p style={{ margin: 0, fontSize: ".8rem", color: "var(--text-muted, #64748b)" }}>{t("drv.addSubtitle")}</p>
          </div>
        </div>

        {error && (
          <div style={{ background: "rgba(239,68,68,.1)", color: "#ef4444", borderRadius: 10, padding: "10px 14px", marginBottom: 12, fontSize: ".85rem", fontWeight: 600 }}>
            <i className="bi bi-exclamation-circle-fill me-2" />{error}
          </div>
        )}

        <form onSubmit={handleSubmit}>
          {/* Account fields */}
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12, marginBottom: 12 }}>
            <div>
              <label style={fieldLabel}>{t("drv.email")} *</label>
              <input style={inputStyle} type="email" required value={form.email}
                placeholder={t("drv.phEmail")} onChange={e => set("email", e.target.value)} />
            </div>
            <div>
              <label style={fieldLabel}>{t("drv.username")} *</label>
              <input style={inputStyle} required value={form.username}
                placeholder={t("drv.phUsername")} onChange={e => set("username", e.target.value)} />
            </div>
          </div>

          <div style={{ marginBottom: 12, position: "relative" }}>
            <label style={fieldLabel}>{t("drv.password")} *</label>
            <div style={{ position: "relative" }}>
              <input style={{ ...inputStyle, paddingRight: 42 }}
                type={showPw ? "text" : "password"} required value={form.password}
                onFocus={() => setPwFocus(true)} onBlur={() => setPwFocus(false)}
                onChange={e => set("password", e.target.value)} />
              <button type="button" onClick={() => setShowPw(p => !p)}
                style={{ position: "absolute", right: 8, top: "50%", transform: "translateY(-50%)",
                  background: "none", border: "none", cursor: "pointer", padding: 4 }}>
                <i className={`bi ${showPw ? "bi-eye-slash" : "bi-eye"}`} style={{ color: "#64748b" }} />
              </button>
            </div>
            {(pwFocus || form.password) && (
              <div style={{ marginTop: 6 }}>
                <div style={{ display: "flex", gap: 4, marginBottom: 4 }}>
                  {[0,1,2,3].map(i => (
                    <div key={i} style={{ flex: 1, height: 4, borderRadius: 2,
                      background: i < pwScore ? meta.color : "#e2e8f0", transition: "background .2s" }} />
                  ))}
                </div>
                <span style={{ fontSize: ".75rem", fontWeight: 600, color: meta.color }}>{t(meta.label)}</span>
                <ul style={{ listStyle: "none", padding: 0, margin: "4px 0 0", fontSize: ".78rem" }}>
                  {PW_RULES.map((r, i) => (
                    <li key={r.key} style={{ color: pwChecks[i] ? "#22c55e" : "#94a3b8" }}>
                      <i className={`bi ${pwChecks[i] ? "bi-check-circle-fill" : "bi-circle"} me-1`} />
                      {t(r.label)}
                    </li>
                  ))}
                </ul>
              </div>
            )}
          </div>

          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12, marginBottom: 12 }}>
            <div>
              <label style={fieldLabel}>{t("drv.firstName")}</label>
              <input style={inputStyle} value={form.first_name}
                placeholder={t("drv.phFirstName")} onChange={e => set("first_name", e.target.value)} />
            </div>
            <div>
              <label style={fieldLabel}>{t("drv.lastName")}</label>
              <input style={inputStyle} value={form.last_name}
                placeholder={t("drv.phLastName")} onChange={e => set("last_name", e.target.value)} />
            </div>
          </div>

          <div style={{ marginBottom: 12 }}>
            <label style={fieldLabel}>{t("drv.phone")}</label>
            <input style={inputStyle} value={form.phone}
              placeholder={t("drv.phPhone")} onChange={e => set("phone", e.target.value)} />
          </div>

          {/* Driver profile fields */}
          <div style={{ borderTop: "1px solid var(--border-color, #e2e8f0)", paddingTop: 12, marginBottom: 12 }}>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
              <div>
                <label style={fieldLabel}>{t("drv.license")} *</label>
                <input style={inputStyle} required value={form.license_number}
                  placeholder={t("drv.phLicense")} onChange={e => set("license_number", e.target.value)} />
              </div>
              <div>
                <label style={fieldLabel}>{t("drv.nationalId")} *</label>
                <input style={inputStyle} required value={form.national_id}
                  placeholder={t("drv.phNationalId")} onChange={e => set("national_id", e.target.value)} />
              </div>
            </div>
          </div>

          <div style={{ marginBottom: 12 }}>
            <label style={fieldLabel}>{t("drv.address")}</label>
            <input style={inputStyle} value={form.address}
              placeholder={t("drv.phAddress")} onChange={e => set("address", e.target.value)} />
          </div>

          <div style={{ marginBottom: 16 }}>
            <label style={fieldLabel}>{t("drv.dob")}</label>
            <input style={inputStyle} type="date" value={form.date_of_birth}
              onChange={e => set("date_of_birth", e.target.value)} />
          </div>

          <div style={{ display: "flex", gap: 10 }}>
            <button type="button" onClick={onCancel} style={{
              flex: 1, padding: "10px 20px", borderRadius: 10,
              border: "1px solid var(--border-color, #e2e8f0)",
              background: "transparent", color: "var(--text-color, #1e293b)",
              fontWeight: 600, cursor: "pointer", fontSize: ".9rem",
            }}>{t("drv.cancel")}</button>
            <button type="submit" disabled={saving} style={{
              flex: 1, padding: "10px 20px", borderRadius: 10, border: "none",
              background: PU, color: "#fff", fontWeight: 600,
              cursor: "pointer", fontSize: ".9rem",
              opacity: saving ? 0.6 : 1,
            }}>{saving ? t("common.saving") : t("drv.createDriver")}</button>
          </div>
        </form>
      </div>
    </div>
  );
}
