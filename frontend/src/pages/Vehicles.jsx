import { useCallback, useEffect, useRef, useState } from "react";
import Paginator from "../components/Paginator.jsx";
import StyledSelect from "../components/StyledSelect.jsx";
import { useAuth } from "../context/AuthContext.jsx";
import { useLanguage } from "../i18n/LanguageContext.jsx";
import {
  listVehicles, createVehicle, updateVehicle, deleteVehicle,
} from "../services/vehicleService.js";
import api from "../services/api.js";
import "./Vehicles.css";

const getPageSize = () => { try { return parseInt(JSON.parse(localStorage.getItem("settings.pageSize"))) || 10; } catch { return 10; } };

const PU = "#7c3aed";
const PA = (a) => `rgba(124,58,237,${a})`;

/* ── Type definitions ── */
const VEHICLE_TYPES = [
  { value: "car",       labelKey: "veh.car",       icon: "bi-car-front-fill",   bg: PA(".11"),                color: PU },
  { value: "motorbike", labelKey: "veh.motorbike",  icon: "bi-bicycle",          bg: "rgba(59,130,246,.12)",   color: "#2563eb" },
  { value: "truck",     labelKey: "veh.truck",      icon: "bi-truck-front-fill", bg: "rgba(245,158,11,.12)",   color: "#d97706" },
  { value: "bus",       labelKey: "veh.bus",        icon: "bi-bus-front-fill",   bg: "rgba(22,163,74,.12)",    color: "#16a34a" },
];

const TYPE_MAP = Object.fromEntries(VEHICLE_TYPES.map((t) => [t.value, t]));

/* ── Type filters ── */
const TYPE_FILTERS = [
  { key: "all", labelKey: "veh.all" },
  ...VEHICLE_TYPES.map((t) => ({ key: t.value, labelKey: t.labelKey })),
];

/* ── TypeBadge ── */
function TypeBadge({ type, t }) {
  const def = TYPE_MAP[type?.toLowerCase()];
  const label = def ? t(def.labelKey) : (type || "—");
  const icon  = def?.icon  || "bi-car-front";
  const bg    = def?.bg    || "var(--bs-secondary-bg)";
  const color = def?.color || "var(--bs-secondary)";
  return (
    <span className="veh-type-badge" style={{ background: bg, color }}>
      <i className={`bi ${icon}`} style={{ fontSize: ".85rem" }} /> {label}
    </span>
  );
}

/* ── Violation count badge ── */
function ViolationCountBadge({ count }) {
  if (count === 0) return <span className="veh-violation-badge" style={{ background: "var(--bs-secondary-bg)", color: "var(--bs-secondary)" }}>0</span>;
  const bg    = count >= 5 ? "rgba(239,68,68,.12)" : count >= 2 ? "rgba(245,158,11,.12)" : PA(".1");
  const color = count >= 5 ? "#dc2626"             : count >= 2 ? "#d97706"               : PU;
  return <span className="veh-violation-badge" style={{ background: bg, color }}>{count}</span>;
}

/* ── Skeleton row ── */
function SkeletonRow({ cols }) {
  return (
    <tr>{Array.from({ length: cols }, (_, i) => (
      <td key={i} className="veh-td">
        <div className="veh-skel" style={{ width: `${50 + Math.random() * 40}%` }} />
      </td>
    ))}</tr>
  );
}

/* ── Reusable Modal ── */
function Modal({ open, title, onClose, children }) {
  if (!open) return null;
  return (
    <div className="veh-overlay" onClick={onClose}>
      <div className="veh-modal" onClick={(e) => e.stopPropagation()}>
        <div className="veh-modal-head">
          <h5 className="veh-modal-title">{title}</h5>
          <button className="veh-modal-close" onClick={onClose}><i className="bi bi-x-lg" /></button>
        </div>
        {children}
      </div>
    </div>
  );
}

/* ═══════════════════════════════════════════════════════════
   Main Component
═══════════════════════════════════════════════════════════ */
export default function Vehicles() {
  const { user } = useAuth();
  const { t } = useLanguage();
  const isAdmin = user?.role === "admin";

  /* ── Data ── */
  const [vehicles,   setVehicles]   = useState([]);
  const [loading,    setLoading]    = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [page,       setPage]       = useState(1);
  const [total,      setTotal]      = useState(0);

  /* ── Search + filter ── */
  const [search,     setSearch]     = useState("");
  const [typeFilter, setTypeFilter] = useState("all");
  const [debouncedSearch, setDebouncedSearch] = useState("");
  const searchTimer = useRef(null);

  /* ── Modal ── */
  const [modal,     setModal]     = useState(null);    // null | { mode: "add"|"edit", data }
  const [formData,  setFormData]  = useState({});
  const [saving,    setSaving]    = useState(false);

  /* ── Detail ── */
  const [detailItem, setDetailItem] = useState(null);

  /* ── Delete confirm ── */
  const [delTarget,  setDelTarget]  = useState(null);
  const [deleting,   setDeleting]   = useState(false);

  /* ── Drivers for dropdown ── */
  const [drivers, setDrivers] = useState([]);

  /* ── KPI stats ── */
  const [stats, setStats] = useState({ total: 0, car: 0, motorbike: 0, truck: 0, bus: 0 });

  /* ────────────────────────────────────────
     Load drivers for the form dropdown
  ──────────────────────────────────────── */
  useEffect(() => {
    api.get("/drivers/", { params: { page_size: 1000 } })
      .then((r) => setDrivers(r.data.results ?? r.data ?? []))
      .catch(() => {});
  }, []);

  /* ────────────────────────────────────────
     Data loader
  ──────────────────────────────────────── */
  const load = useCallback((pg = 1, q = debouncedSearch, tf = typeFilter, hasData = false) => {
    if (hasData) setRefreshing(true); else setLoading(true);
    const params = { page: pg, page_size: getPageSize() };
    if (q)            params.search       = q;
    if (tf !== "all") params.vehicle_type = tf;
    listVehicles(params)
      .then((d) => {
        const items = d.results ?? d ?? [];
        setVehicles(items);
        setTotal(d.count ?? (Array.isArray(d) ? d.length : 0));
      })
      .catch(() => {})
      .finally(() => { setLoading(false); setRefreshing(false); });
  }, []); // eslint-disable-line

  /* ── Load stats (all vehicles, no filter) ── */
  const loadStats = useCallback(() => {
    listVehicles({ page_size: 1 })
      .then((d) => {
        const tot = d.count ?? 0;
        setStats((prev) => ({ ...prev, total: tot }));
      })
      .catch(() => {});
    for (const vt of ["car", "motorbike", "truck", "bus"]) {
      listVehicles({ page_size: 1, vehicle_type: vt })
        .then((d) => {
          setStats((prev) => ({ ...prev, [vt]: d.count ?? 0 }));
        })
        .catch(() => {});
    }
  }, []);

  useEffect(() => { load(1, "", "all"); loadStats(); }, []); // eslint-disable-line

  /* ── Debounce search ── */
  useEffect(() => {
    clearTimeout(searchTimer.current);
    searchTimer.current = setTimeout(() => setDebouncedSearch(search), 300);
    return () => clearTimeout(searchTimer.current);
  }, [search]);

  /* ── Re-load on filter/search change ── */
  const isFirst = useRef(true);
  useEffect(() => {
    if (isFirst.current) { isFirst.current = false; return; }
    setPage(1);
    load(1, debouncedSearch, typeFilter);
  }, [debouncedSearch, typeFilter]); // eslint-disable-line

  /* ── Re-load on page change ── */
  const prevPage = useRef(1);
  useEffect(() => {
    if (prevPage.current === page) return;
    prevPage.current = page;
    load(page, debouncedSearch, typeFilter, true);
  }, [page]); // eslint-disable-line

  /* ────────────────────────────────────────
     Handlers
  ──────────────────────────────────────── */
  const handleRefresh = () => { load(page, debouncedSearch, typeFilter, true); loadStats(); };

  const openAdd = () => {
    setFormData({ plate_number: "", vehicle_type: "car", make: "", model: "", color: "", year: "", driver: "" });
    setModal({ mode: "add" });
  };

  const openEdit = (v) => {
    setFormData({
      plate_number: v.plate_number ?? "",
      vehicle_type: v.vehicle_type ?? "car",
      make: v.make ?? "",
      model: v.model ?? "",
      color: v.color ?? "",
      year: v.year ?? "",
      driver: v.driver ?? "",
    });
    setModal({ mode: "edit", data: v });
  };

  const openDetail = (v) => setDetailItem(v);
  const closeDetail = () => setDetailItem(null);

  const openDelete = (v) => setDelTarget(v);
  const closeDelete = () => { setDelTarget(null); setDeleting(false); };

  const setField = (k, v) => setFormData((p) => ({ ...p, [k]: v }));

  const handleSave = async () => {
    setSaving(true);
    try {
      const payload = { ...formData };
      payload.year = payload.year ? parseInt(payload.year, 10) : null;
      payload.driver = payload.driver ? parseInt(payload.driver, 10) : null;

      if (modal.mode === "add") {
        await createVehicle(payload);
      } else {
        await updateVehicle(modal.data.id, payload);
      }
      setModal(null);
      load(modal.mode === "add" ? 1 : page, debouncedSearch, typeFilter, true);
      if (modal.mode === "add") setPage(1);
      loadStats();
    } catch (err) {
      console.error("Save vehicle failed:", err);
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async () => {
    setDeleting(true);
    try {
      await deleteVehicle(delTarget.id);
      closeDelete();
      load(page, debouncedSearch, typeFilter, true);
      loadStats();
    } catch (err) {
      console.error("Delete vehicle failed:", err);
    } finally {
      setDeleting(false);
    }
  };

  /* ── Helper: driver display name ── */
  const driverDisplayName = (v) => {
    if (v.driver_name) return v.driver_name;
    if (!v.driver) return null;
    const d = drivers.find((dr) => dr.id === v.driver);
    if (d?.user) {
      const full = `${d.user.first_name ?? ""} ${d.user.last_name ?? ""}`.trim();
      return full || d.user.username || d.user.email;
    }
    return null;
  };

  const colCount = 8;

  /* ── KPI definitions ── */
  const kpis = [
    { icon: "bi-car-front-fill",   bg: PA(".12"),                color: PU,        value: stats.total,     label: t("veh.totalVehicles") },
    { icon: "bi-car-front-fill",   bg: PA(".12"),                color: PU,        value: stats.car,       label: t("veh.car") },
    { icon: "bi-bicycle",          bg: "rgba(59,130,246,.12)",   color: "#2563eb", value: stats.motorbike, label: t("veh.motorbike") },
    { icon: "bi-truck-front-fill", bg: "rgba(245,158,11,.12)",   color: "#d97706", value: stats.truck + stats.bus, label: t("veh.truckBus") },
  ];

  /* ════════════════════════════════════════
     RENDER
  ════════════════════════════════════════ */
  return (
    <div className="veh-page">

      {/* ── Header ── */}
      <div className="veh-header">
        <div>
          <h5 className="veh-page-title">
            <i className="bi bi-car-front-fill" style={{ color: PU }} />
            {t("veh.title")}
          </h5>
          <p className="veh-page-sub">{t("veh.subtitle")}</p>
        </div>
        <div className="veh-header-actions">
          <button className="veh-btn veh-btn--refresh" disabled={refreshing} onClick={handleRefresh}>
            <i className={`bi bi-arrow-clockwise${refreshing ? " veh-spin" : ""}`} />
            {refreshing ? t("veh.refreshing") : t("veh.refresh")}
          </button>
          {isAdmin && (
            <button className="veh-btn veh-btn--add" onClick={openAdd}>
              <i className="bi bi-plus-lg" /> {t("veh.addVehicle")}
            </button>
          )}
        </div>
      </div>

      {/* ── KPI Cards ── */}
      <div className="veh-stats">
        {kpis.map((k, i) => (
          <div key={i} className="veh-stat-card">
            <div className="veh-stat-icon" style={{ background: k.bg, color: k.color }}>
              <i className={`bi ${k.icon}`} />
            </div>
            <div>
              <div className="veh-stat-value">{loading ? "—" : k.value}</div>
              <div className="veh-stat-label">{k.label}</div>
            </div>
          </div>
        ))}
      </div>

      {/* ── Toolbar ── */}
      <div className="veh-toolbar">
        {TYPE_FILTERS.map(({ key, labelKey }) => (
          <button key={key}
            className={`veh-filter${typeFilter === key ? " active" : ""}`}
            onClick={() => setTypeFilter(key)}>
            {t(labelKey)}
          </button>
        ))}
        <div className="veh-search">
          <i className="bi bi-search" />
          <input
            placeholder={t("veh.search")}
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
          {search && (
            <button className="veh-search-clear" onClick={() => setSearch("")}>
              <i className="bi bi-x" />
            </button>
          )}
        </div>
      </div>

      {/* ── Table ── */}
      <div className="veh-table-wrap" style={{ opacity: refreshing ? .6 : 1 }}>
        <table className="veh-table">
          <thead>
            <tr>
              <th className="veh-th">{t("veh.plate")}</th>
              <th className="veh-th">{t("veh.type")}</th>
              <th className="veh-th">{t("veh.makeModel")}</th>
              <th className="veh-th">{t("veh.color")}</th>
              <th className="veh-th">{t("veh.year")}</th>
              <th className="veh-th">{t("veh.owner")}</th>
              <th className="veh-th" style={{ textAlign: "center" }}>{t("veh.violations")}</th>
              <th className="veh-th" style={{ textAlign: "right" }}>{t("veh.actions")}</th>
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr>
                <td colSpan={colCount} className="veh-empty">
                  <div className="spinner-border" style={{ color: "#7c3aed", width: 40, height: 40 }} role="status">
                    <span className="visually-hidden">Loading...</span>
                  </div>
                </td>
              </tr>
            ) : vehicles.length === 0 ? (
              <tr>
                <td colSpan={colCount} className="veh-empty">
                  <i className="bi bi-car-front" />
                  {debouncedSearch || typeFilter !== "all" ? t("veh.noResults") : t("veh.empty")}
                </td>
              </tr>
            ) : (
              vehicles.map((v) => {
                const name = driverDisplayName(v);
                return (
                  <tr key={v.id}>
                    <td className="veh-td"><span className="veh-plate">{v.plate_number}</span></td>
                    <td className="veh-td"><TypeBadge type={v.vehicle_type} t={t} /></td>
                    <td className="veh-td">
                      <span className="fw-semibold" style={{ color: "var(--bs-body-color)" }}>{v.make || "—"}</span>
                      {v.model && <span className="text-secondary ms-1">{v.model}</span>}
                    </td>
                    <td className="veh-td">
                      <span className="d-inline-flex align-items-center gap-2">
                        {v.color && <span className="veh-color-swatch" style={{ background: v.color.toLowerCase() }} />}
                        <span className="text-secondary" style={{ textTransform: "capitalize" }}>{v.color || "—"}</span>
                      </span>
                    </td>
                    <td className="veh-td text-secondary">{v.year || "—"}</td>
                    <td className="veh-td">
                      {name ? (
                        <span className="d-inline-flex align-items-center gap-2">
                          <span className="veh-owner-avatar">{name[0].toUpperCase()}</span>
                          {name}
                        </span>
                      ) : (
                        <span className="text-secondary fst-italic" style={{ fontSize: ".9rem" }}>{t("veh.unassigned")}</span>
                      )}
                    </td>
                    <td className="veh-td text-center"><ViolationCountBadge count={v.violation_count ?? 0} /></td>
                    <td className="veh-td">
                      <div className="veh-actions">
                        <button className="veh-act-btn veh-act-view" title={t("veh.viewDetail")} onClick={() => openDetail(v)}>
                          <i className="bi bi-eye-fill" />
                        </button>
                        {isAdmin && (
                          <>
                            <button className="veh-act-btn veh-act-edit" title={t("veh.edit")} onClick={() => openEdit(v)}>
                              <i className="bi bi-pencil-fill" />
                            </button>
                            <button className="veh-act-btn veh-act-del" title={t("veh.delete")} onClick={() => openDelete(v)}>
                              <i className="bi bi-trash3-fill" />
                            </button>
                          </>
                        )}
                      </div>
                    </td>
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </div>

      {/* ── Paginator ── */}
      <Paginator page={page} total={total} pageSize={getPageSize()} onChange={setPage} loading={loading || refreshing} />

      {/* ══════════════════════════════════════
           Add / Edit Modal
      ══════════════════════════════════════ */}
      <Modal
        open={!!modal}
        title={modal?.mode === "add" ? t("veh.addVehicle") : t("veh.editVehicle")}
        onClose={() => !saving && setModal(null)}>
        <div className="veh-form">
          <div className="veh-form-field">
            <label>{t("veh.plate")}</label>
            <input className="veh-form-input" value={formData.plate_number ?? ""}
              onChange={(e) => setField("plate_number", e.target.value)} placeholder={t("veh.platePh")} />
          </div>
          <div className="veh-form-field">
            <label>{t("veh.type")}</label>
            <StyledSelect
              value={formData.vehicle_type ?? "car"}
              onChange={(v) => setField("vehicle_type", v)}
              options={VEHICLE_TYPES.map((vt) => ({ value: vt.value, label: t(vt.labelKey), icon: vt.icon, color: vt.color, bg: vt.bg }))}
            />
          </div>
          <div className="veh-form-field">
            <label>{t("veh.make")}</label>
            <input className="veh-form-input" value={formData.make ?? ""}
              onChange={(e) => setField("make", e.target.value)} placeholder={t("veh.makePh")} />
          </div>
          <div className="veh-form-field">
            <label>{t("veh.model")}</label>
            <input className="veh-form-input" value={formData.model ?? ""}
              onChange={(e) => setField("model", e.target.value)} placeholder={t("veh.modelPh")} />
          </div>
          <div className="veh-form-field">
            <label>{t("veh.color")}</label>
            <input className="veh-form-input" value={formData.color ?? ""}
              onChange={(e) => setField("color", e.target.value)} placeholder={t("veh.colorPh")} />
          </div>
          <div className="veh-form-field">
            <label>{t("veh.year")}</label>
            <input className="veh-form-input" type="number" value={formData.year ?? ""}
              onChange={(e) => setField("year", e.target.value)} placeholder={t("veh.yearPh")} min="1900" max="2099" />
          </div>
          <div className="veh-form-field">
            <label>{t("veh.driver")}</label>
            <StyledSelect
              value={formData.driver ?? ""}
              onChange={(v) => setField("driver", v)}
              placeholder={t("veh.noDriver")}
              icon="bi-person"
              options={[
                { value: "", label: t("veh.noDriver") },
                ...drivers.map((d) => {
                  const nm = d.user
                    ? (`${d.user.first_name ?? ""} ${d.user.last_name ?? ""}`.trim() || d.user.username || d.user.email)
                    : `Driver #${d.id}`;
                  return { value: d.id, label: `${nm} — ${d.license_number}`, icon: "bi-person-badge" };
                }),
              ]}
            />
          </div>
          <div className="veh-form-actions">
            <button className="veh-btn veh-btn--cancel" onClick={() => setModal(null)} disabled={saving}>
              {t("veh.cancel")}
            </button>
            <button className="veh-btn veh-btn--save" onClick={handleSave}
              disabled={saving || !formData.plate_number?.trim()}>
              {saving && <i className="bi bi-arrow-clockwise veh-spin" />}
              {modal?.mode === "add" ? t("veh.create") : t("veh.save")}
            </button>
          </div>
        </div>
      </Modal>

      {/* ══════════════════════════════════════
           Detail Modal
      ══════════════════════════════════════ */}
      <Modal open={!!detailItem} title={t("veh.detailTitle")} onClose={closeDetail}>
        {detailItem && (
          <div className="veh-detail">
            <div className="veh-detail-row">
              <span className="veh-detail-label">{t("veh.plate")}</span>
              <span className="veh-detail-value"><span className="veh-plate">{detailItem.plate_number}</span></span>
            </div>
            <div className="veh-detail-row">
              <span className="veh-detail-label">{t("veh.type")}</span>
              <span className="veh-detail-value"><TypeBadge type={detailItem.vehicle_type} t={t} /></span>
            </div>
            <div className="veh-detail-row">
              <span className="veh-detail-label">{t("veh.make")}</span>
              <span className="veh-detail-value">{detailItem.make || "—"}</span>
            </div>
            <div className="veh-detail-row">
              <span className="veh-detail-label">{t("veh.model")}</span>
              <span className="veh-detail-value">{detailItem.model || "—"}</span>
            </div>
            <div className="veh-detail-row">
              <span className="veh-detail-label">{t("veh.color")}</span>
              <span className="veh-detail-value">
                {detailItem.color ? (
                  <span className="d-inline-flex align-items-center gap-2">
                    <span className="veh-color-swatch" style={{ background: detailItem.color.toLowerCase() }} />
                    <span style={{ textTransform: "capitalize" }}>{detailItem.color}</span>
                  </span>
                ) : "—"}
              </span>
            </div>
            <div className="veh-detail-row">
              <span className="veh-detail-label">{t("veh.year")}</span>
              <span className="veh-detail-value">{detailItem.year || "—"}</span>
            </div>
            <div className="veh-detail-row">
              <span className="veh-detail-label">{t("veh.owner")}</span>
              <span className="veh-detail-value">{driverDisplayName(detailItem) || t("veh.unassigned")}</span>
            </div>
            <div className="veh-detail-row">
              <span className="veh-detail-label">{t("veh.violations")}</span>
              <span className="veh-detail-value"><ViolationCountBadge count={detailItem.violation_count ?? 0} /></span>
            </div>
            <div className="veh-detail-row">
              <span className="veh-detail-label">{t("veh.registered")}</span>
              <span className="veh-detail-value">
                {detailItem.registered_at ? new Date(detailItem.registered_at).toLocaleDateString() : "—"}
              </span>
            </div>
            <div className="veh-detail-row">
              <span className="veh-detail-label">ID</span>
              <span className="veh-detail-value" style={{ fontFamily: "monospace", color: "#64748b" }}>#{detailItem.id}</span>
            </div>
            <div className="veh-detail-actions">
              {isAdmin && (
                <button className="veh-btn veh-btn--save" onClick={() => { closeDetail(); openEdit(detailItem); }}>
                  <i className="bi bi-pencil-fill" /> {t("veh.edit")}
                </button>
              )}
              <button className="veh-btn veh-btn--cancel" onClick={closeDetail}>{t("veh.close")}</button>
            </div>
          </div>
        )}
      </Modal>

      {/* ══════════════════════════════════════
           Delete Confirmation Modal
      ══════════════════════════════════════ */}
      <Modal open={!!delTarget} title={t("veh.deleteConfirmTitle")} onClose={() => !deleting && closeDelete()}>
        {delTarget && (
          <div className="veh-del-body">
            <i className="bi bi-exclamation-triangle-fill veh-del-icon" />
            <p className="veh-del-text">
              {t("veh.deleteConfirmMsg")} <span className="veh-del-plate">{delTarget.plate_number}</span>?
            </p>
            <div className="veh-del-actions">
              <button className="veh-btn veh-btn--cancel" onClick={closeDelete} disabled={deleting}>
                {t("veh.cancel")}
              </button>
              <button className="veh-btn veh-btn--danger" onClick={handleDelete} disabled={deleting}>
                {deleting && <i className="bi bi-arrow-clockwise veh-spin" />}
                {t("veh.delete")}
              </button>
            </div>
          </div>
        )}
      </Modal>
    </div>
  );
}
