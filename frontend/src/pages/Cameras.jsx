import { useCallback, useEffect, useRef, useState } from "react";
import Paginator from "../components/Paginator.jsx";
import StyledSelect from "../components/StyledSelect.jsx";
import { useAuth } from "../context/AuthContext.jsx";
import { useLanguage } from "../i18n/LanguageContext.jsx";
import {
  listCameras, createCamera, updateCamera, deleteCamera, patchCamera,
  listRoads, createRoad, updateRoad, deleteRoad,
  listSignals, createSignal, updateSignal, deleteSignal,
  listSigns, createSign, updateSign, deleteSign, patchSign,
} from "../services/cameraService.js";
import "./Cameras.css";

const getPageSize = () => { try { return parseInt(JSON.parse(localStorage.getItem("settings.pageSize"))) || 10; } catch { return 10; } };

const PU = "#7c3aed";
const PA = (a) => `rgba(124,58,237,${a})`;

const BACKEND = import.meta.env.VITE_API_URL?.replace(/\/api\/?$/, "") || "http://localhost:8000";

/* ── Sub-tab definitions ── */
const TABS = [
  { key: "cameras", icon: "bi-camera-video-fill", labelKey: "cam.tabCameras" },
  { key: "roads",   icon: "bi-signpost-split-fill", labelKey: "cam.tabRoads" },
  { key: "signals", icon: "bi-stoplights-fill",   labelKey: "cam.tabSignals" },
  { key: "signs",   icon: "bi-sign-stop-fill",    labelKey: "cam.tabSigns" },
];

/* ── Status + type badge maps ── */
const CAM_STATUS = {
  true:  { label: "cam.active",   bg: "rgba(22,163,74,.12)",  color: "#16a34a", icon: "bi-check-circle-fill" },
  false: { label: "cam.inactive", bg: "rgba(239,68,68,.12)",  color: "#dc2626", icon: "bi-x-circle-fill" },
};

const SIGNAL_TYPES = [
  { value: "traffic_light", labelKey: "cam.sigTrafficLight" },
  { value: "speed_camera",  labelKey: "cam.sigSpeedCamera" },
];

const SIGN_TYPES = [
  { value: "speed_limit", labelKey: "cam.signSpeed" },
  { value: "stop",        labelKey: "cam.signStop" },
  { value: "no_entry",    labelKey: "cam.signNoEntry" },
  { value: "yield",       labelKey: "cam.signYield" },
];

const SIGNAL_STATUS = {
  active:   { label: "cam.active",   bg: "rgba(22,163,74,.12)", color: "#16a34a" },
  inactive: { label: "cam.inactive", bg: "rgba(239,68,68,.12)", color: "#dc2626" },
};

/* ── Skeleton row ── */
function SkeletonRow({ cols }) {
  return (
    <tr>{Array.from({ length: cols }, (_, i) => (
      <td key={i} className="py-3 px-3 align-middle">
        <div className="cam-skel" style={{ width: `${60 + Math.random() * 40}%` }} />
      </td>
    ))}</tr>
  );
}

/* ── Modal ── */
function Modal({ open, title, onClose, children }) {
  if (!open) return null;
  return (
    <div className="cam-overlay" onClick={onClose}>
      <div className="cam-modal" onClick={(e) => e.stopPropagation()}>
        <div className="cam-modal-head">
          <h5 className="cam-modal-title">{title}</h5>
          <button className="cam-modal-close" onClick={onClose}><i className="bi bi-x-lg" /></button>
        </div>
        {children}
      </div>
    </div>
  );
}

export default function Cameras() {
  const { user } = useAuth();
  const { t } = useLanguage();
  const isAdmin = user?.role === "admin";

  /* Tab */
  const [tab, setTab] = useState("cameras");

  /* Data */
  const [items, setItems] = useState([]);
  const [roads, setRoads] = useState([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [page, setPage] = useState(1);
  const [total, setTotal] = useState(0);

  /* Search + filter */
  const [search, setSearch] = useState("");
  const [debouncedSearch, setDebouncedSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const searchTimer = useRef(null);

  /* Modal */
  const [modal, setModal] = useState(null);        // null | { mode: "add"|"edit", data }
  const [formData, setFormData] = useState({});
  const [saving, setSaving] = useState(false);
  const [deleting, setDeleting] = useState(null);

  /* Detail view */
  const [detailItem, setDetailItem] = useState(null);

  /* Image preview / lightbox */
  const [previewImg, setPreviewImg] = useState(null);   // URL string for lightbox
  const [imageFile, setImageFile] = useState(null);      // File object for upload
  const [imagePreview, setImagePreview] = useState(null); // local preview data-url
  const fileRef = useRef(null);

  /* ── Load roads for dropdowns ── */
  useEffect(() => {
    listRoads({ page_size: 1000 }).then((d) => setRoads(d.results ?? d ?? [])).catch(() => {});
  }, []);

  /* ── Main data loader ── */
  const load = useCallback((tb = tab, pg = 1, q = "", sf = "all", isRefresh = false) => {
    isRefresh ? setRefreshing(true) : setLoading(true);
    const params = { page: pg, page_size: getPageSize() };
    if (q) params.search = q;

    let fetcher;
    switch (tb) {
      case "cameras":
        if (sf !== "all") params.active = sf === "active";
        fetcher = listCameras(params);
        break;
      case "roads":
        fetcher = listRoads(params);
        break;
      case "signals":
        if (sf !== "all") params.status = sf;
        fetcher = listSignals(params);
        break;
      case "signs":
        fetcher = listSigns(params);
        break;
      default:
        fetcher = listCameras(params);
    }

    fetcher
      .then((d) => {
        setItems(d.results ?? d ?? []);
        setTotal(d.count ?? (Array.isArray(d) ? d.length : 0));
      })
      .catch(() => { setItems([]); setTotal(0); })
      .finally(() => { setLoading(false); setRefreshing(false); });
  }, [tab]);

  /* Initial load */
  useEffect(() => { load(tab, 1, "", "all"); }, [tab]); // eslint-disable-line

  /* Debounce search */
  useEffect(() => {
    clearTimeout(searchTimer.current);
    searchTimer.current = setTimeout(() => setDebouncedSearch(search), 300);
    return () => clearTimeout(searchTimer.current);
  }, [search]);

  /* Search / filter change → reset to page 1 */
  const isFirst = useRef(true);
  useEffect(() => {
    if (isFirst.current) { isFirst.current = false; return; }
    setPage(1);
    load(tab, 1, debouncedSearch, statusFilter);
  }, [debouncedSearch, statusFilter]); // eslint-disable-line

  /* Page change */
  const prevPage = useRef(1);
  useEffect(() => {
    if (prevPage.current === page) return;
    prevPage.current = page;
    load(tab, page, debouncedSearch, statusFilter, true);
  }, [page]); // eslint-disable-line

  /* Tab change → reset everything */
  const handleTabChange = (key) => {
    setTab(key);
    setItems([]);
    setTotal(0);
    setLoading(true);
    setSearch("");
    setDebouncedSearch("");
    setStatusFilter("all");
    setPage(1);
    prevPage.current = 1;
    isFirst.current = true;
  };

  const handleRefresh = () => load(tab, page, debouncedSearch, statusFilter, true);

  /* ── Detail modal ── */
  const openDetail = (item) => setDetailItem(item);
  const closeDetail = () => setDetailItem(null);

  /* ── Modal helpers ── */
  const openAdd = () => {
    const init = tab === "cameras" ? { name: "", ip_address: "", location: "", road: "", active: true }
      : tab === "roads"   ? { name: "", code: "", location: "" }
      : tab === "signals" ? { signal_type: "traffic_light", location: "", road: "", status: "active" }
      :                     { sign_type: "speed_limit", description: "", location: "", road: "", speed_limit: "" };
    setFormData(init);
    setImageFile(null);
    setImagePreview(null);
    setModal({ mode: "add" });
  };

  const openEdit = (item) => {
    if (tab === "cameras")      setFormData({ name: item.name, ip_address: item.ip_address || "", location: item.location || "", road: item.road || "", active: item.active });
    else if (tab === "roads")   setFormData({ name: item.name, code: item.code || "", location: item.location || "" });
    else if (tab === "signals") setFormData({ signal_type: item.signal_type, location: item.location || "", road: item.road || "", status: item.status || "active" });
    else                        setFormData({ sign_type: item.sign_type, description: item.description || "", location: item.location || "", road: item.road || "", speed_limit: item.speed_limit ?? "" });
    setImageFile(null);
    setImagePreview(item.image ? (item.image.startsWith("http") ? item.image : `${BACKEND}${item.image}`) : null);
    setModal({ mode: "edit", data: item });
  };

  const closeModal = () => { if (!saving) { setModal(null); setImageFile(null); setImagePreview(null); } };

  const handleSave = async (e) => {
    e.preventDefault();
    setSaving(true);
    try {
      const payload = { ...formData };
      if (payload.road === "") payload.road = null;
      if (payload.speed_limit === "") payload.speed_limit = null;

      if (modal.mode === "add") {
        if (tab === "cameras")      await createCamera(payload);
        else if (tab === "roads")   await createRoad(payload);
        else if (tab === "signals") await createSignal(payload);
        else {
          const fd = new FormData();
          Object.entries(payload).forEach(([k, v]) => { if (v !== null && v !== undefined) fd.append(k, v); });
          if (imageFile) fd.append("image", imageFile);
          await createSign(fd);
        }
      } else {
        const id = modal.data.id;
        if (tab === "cameras")      await updateCamera(id, payload);
        else if (tab === "roads")   await updateRoad(id, payload);
        else if (tab === "signals") await updateSignal(id, payload);
        else {
          const fd = new FormData();
          Object.entries(payload).forEach(([k, v]) => { if (v !== null && v !== undefined) fd.append(k, v); });
          if (imageFile) fd.append("image", imageFile);
          else if (imagePreview === null && modal.data.image) fd.append("image", "");  // clear image
          await updateSign(id, fd);
        }
      }
      setModal(null);
      setImageFile(null);
      setImagePreview(null);
      load(tab, page, debouncedSearch, statusFilter, true);
    } catch { /* keep modal open on error */ }
    finally { setSaving(false); }
  };

  const handleDelete = async (id) => {
    setDeleting(id);
    try {
      if (tab === "cameras")      await deleteCamera(id);
      else if (tab === "roads")   await deleteRoad(id);
      else if (tab === "signals") await deleteSignal(id);
      else                        await deleteSign(id);
      load(tab, page, debouncedSearch, statusFilter, true);
    } catch { /* noop */ }
    finally { setDeleting(null); }
  };

  const handleToggleActive = async (item) => {
    setDeleting(item.id);
    try {
      await patchCamera(item.id, { active: !item.active });
      load(tab, page, debouncedSearch, statusFilter, true);
    } catch { /* noop */ }
    finally { setDeleting(null); }
  };

  /* ── Render helpers ── */
  const roadName = (rid) => roads.find((r) => r.id === rid)?.name || "—";

  /* ── Status filter options ── */
  const statusFilters = tab === "cameras"
    ? [{ key: "all", label: t("cam.all") }, { key: "active", label: t("cam.active") }, { key: "inactive", label: t("cam.inactive") }]
    : tab === "signals"
    ? [{ key: "all", label: t("cam.all") }, { key: "active", label: t("cam.active") }, { key: "inactive", label: t("cam.inactive") }]
    : null;

  /* ── Table columns per tab ── */
  const renderHead = () => {
    switch (tab) {
      case "cameras": return (
        <tr>
          <th className="cam-th">#</th>
          <th className="cam-th">{t("cam.name")}</th>
          <th className="cam-th">{t("cam.ip")}</th>
          <th className="cam-th">{t("cam.location")}</th>
          <th className="cam-th">{t("cam.road")}</th>
          <th className="cam-th">{t("cam.status")}</th>
          <th className="cam-th text-end">{t("cam.actions")}</th>
        </tr>
      );
      case "roads": return (
        <tr>
          <th className="cam-th">#</th>
          <th className="cam-th">{t("cam.name")}</th>
          <th className="cam-th">{t("cam.code")}</th>
          <th className="cam-th">{t("cam.location")}</th>
          <th className="cam-th text-end">{t("cam.actions")}</th>
        </tr>
      );
      case "signals": return (
        <tr>
          <th className="cam-th">#</th>
          <th className="cam-th">{t("cam.type")}</th>
          <th className="cam-th">{t("cam.location")}</th>
          <th className="cam-th">{t("cam.road")}</th>
          <th className="cam-th">{t("cam.status")}</th>
          <th className="cam-th text-end">{t("cam.actions")}</th>
        </tr>
      );
      case "signs": return (
        <tr>
          <th className="cam-th">#</th>
          <th className="cam-th">{t("cam.image")}</th>
          <th className="cam-th">{t("cam.type")}</th>
          <th className="cam-th">{t("cam.description")}</th>
          <th className="cam-th">{t("cam.location")}</th>
          <th className="cam-th">{t("cam.road")}</th>
          <th className="cam-th">{t("cam.speedLimit")}</th>
          <th className="cam-th text-end">{t("cam.actions")}</th>
        </tr>
      );
      default: return null;
    }
  };

  const colCount = tab === "cameras" ? 7
    : tab === "roads" ? 5
    : tab === "signals" ? 6
    : 8;

  const renderRow = (item, idx) => {
    const num = (page - 1) * getPageSize() + idx + 1;
    const isDeleting = deleting === item.id;

    switch (tab) {
      case "cameras": {
        const st = CAM_STATUS[item.active] ?? CAM_STATUS[false];
        return (
          <tr key={item.id} style={{ opacity: isDeleting ? .5 : 1 }}>
            <td className="cam-td text-secondary">{num}</td>
            <td className="cam-td">
              <span className="d-flex align-items-center gap-2">
                <span className="cam-avatar"><i className="bi bi-camera-video-fill" /></span>
                <span className="fw-semibold">{item.name}</span>
              </span>
            </td>
            <td className="cam-td">
              <code className="cam-ip">{item.ip_address || "—"}</code>
            </td>
            <td className="cam-td text-secondary">{item.location || "—"}</td>
            <td className="cam-td text-secondary">{roadName(item.road)}</td>
            <td className="cam-td">
              <button
                className="cam-status-badge"
                style={{ background: st.bg, color: st.color, cursor: isAdmin ? "pointer" : "default" }}
                onClick={() => isAdmin && handleToggleActive(item)}
                disabled={!isAdmin || isDeleting}
                title={isAdmin ? t("cam.toggleStatus") : ""}
              >
                <i className={`bi ${st.icon}`} />
                {t(st.label)}
              </button>
            </td>
            <td className="cam-td text-end">
              <div className="cam-actions">
                <button className="cam-act-btn cam-act-view" onClick={() => openDetail(item)} title={t("cam.viewDetail")}>
                  <i className="bi bi-eye-fill" />
                </button>
                {isAdmin && <>
                  <button className="cam-act-btn cam-act-edit" onClick={() => openEdit(item)} title={t("cam.edit")}>
                    <i className="bi bi-pencil-fill" />
                  </button>
                  <button className="cam-act-btn cam-act-del" onClick={() => handleDelete(item.id)} disabled={isDeleting} title={t("cam.delete")}>
                    <i className="bi bi-trash3-fill" />
                  </button>
                </>}
              </div>
            </td>
          </tr>
        );
      }
      case "roads": return (
        <tr key={item.id} style={{ opacity: isDeleting ? .5 : 1 }}>
          <td className="cam-td text-secondary">{num}</td>
          <td className="cam-td">
            <span className="d-flex align-items-center gap-2">
              <span className="cam-avatar cam-avatar--road"><i className="bi bi-signpost-split-fill" /></span>
              <span className="fw-semibold">{item.name}</span>
            </span>
          </td>
          <td className="cam-td"><code className="cam-ip">{item.code || "—"}</code></td>
          <td className="cam-td text-secondary">{item.location || "—"}</td>
          <td className="cam-td text-end">
            <div className="cam-actions">
              <button className="cam-act-btn cam-act-view" onClick={() => openDetail(item)} title={t("cam.viewDetail")}>
                <i className="bi bi-eye-fill" />
              </button>
              {isAdmin && <>
                <button className="cam-act-btn cam-act-edit" onClick={() => openEdit(item)}><i className="bi bi-pencil-fill" /></button>
                <button className="cam-act-btn cam-act-del" onClick={() => handleDelete(item.id)} disabled={isDeleting}><i className="bi bi-trash3-fill" /></button>
              </>}
            </div>
          </td>
        </tr>
      );
      case "signals": {
        const ss = SIGNAL_STATUS[item.status] ?? SIGNAL_STATUS.active;
        return (
          <tr key={item.id} style={{ opacity: isDeleting ? .5 : 1 }}>
            <td className="cam-td text-secondary">{num}</td>
            <td className="cam-td">
              <span className="d-flex align-items-center gap-2">
                <span className="cam-avatar cam-avatar--signal"><i className="bi bi-stoplights-fill" /></span>
                <span className="fw-semibold">{t(SIGNAL_TYPES.find(s => s.value === item.signal_type)?.labelKey || "cam.sigTrafficLight")}</span>
              </span>
            </td>
            <td className="cam-td text-secondary">{item.location || "—"}</td>
            <td className="cam-td text-secondary">{roadName(item.road)}</td>
            <td className="cam-td">
              <span className="cam-status-badge" style={{ background: ss.bg, color: ss.color }}>{t(ss.label)}</span>
            </td>
            <td className="cam-td text-end">
              <div className="cam-actions">
                <button className="cam-act-btn cam-act-view" onClick={() => openDetail(item)} title={t("cam.viewDetail")}>
                  <i className="bi bi-eye-fill" />
                </button>
                {isAdmin && <>
                  <button className="cam-act-btn cam-act-edit" onClick={() => openEdit(item)}><i className="bi bi-pencil-fill" /></button>
                  <button className="cam-act-btn cam-act-del" onClick={() => handleDelete(item.id)} disabled={isDeleting}><i className="bi bi-trash3-fill" /></button>
                </>}
              </div>
            </td>
          </tr>
        );
      }
      case "signs": return (
        <tr key={item.id} style={{ opacity: isDeleting ? .5 : 1 }}>
          <td className="cam-td text-secondary">{num}</td>
          <td className="cam-td">
            {item.image ? (
              <button
                className="cam-sign-thumb-btn"
                onClick={() => setPreviewImg(item.image.startsWith("http") ? item.image : `${BACKEND}${item.image}`)}
                title={t("cam.viewImage")}
              >
                <img
                  src={item.image.startsWith("http") ? item.image : `${BACKEND}${item.image}`}
                  alt={item.sign_type}
                  className="cam-sign-thumb"
                />
              </button>
            ) : (
              <span className="cam-avatar cam-avatar--sign"><i className="bi bi-sign-stop-fill" /></span>
            )}
          </td>
          <td className="cam-td">
            <span className="fw-semibold">{t(SIGN_TYPES.find(s => s.value === item.sign_type)?.labelKey || "cam.signSpeed")}</span>
          </td>
          <td className="cam-td text-secondary">{item.description || "—"}</td>
          <td className="cam-td text-secondary">{item.location || "—"}</td>
          <td className="cam-td text-secondary">{roadName(item.road)}</td>
          <td className="cam-td">
            {item.speed_limit ? (
              <span className="cam-speed">{item.speed_limit} km/h</span>
            ) : "—"}
          </td>
          <td className="cam-td text-end">
            <div className="cam-actions">
              <button className="cam-act-btn cam-act-view" onClick={() => openDetail(item)} title={t("cam.viewDetail")}>
                <i className="bi bi-eye-fill" />
              </button>
              {isAdmin && <>
                <button className="cam-act-btn cam-act-edit" onClick={() => openEdit(item)}><i className="bi bi-pencil-fill" /></button>
                <button className="cam-act-btn cam-act-del" onClick={() => handleDelete(item.id)} disabled={isDeleting}><i className="bi bi-trash3-fill" /></button>
              </>}
            </div>
          </td>
        </tr>
      );
      default: return null;
    }
  };

  /* ── Form fields per tab ── */
  const renderFormFields = () => {
    switch (tab) {
      case "cameras": return (<>
        <div className="cam-form-field">
          <label>{t("cam.name")}</label>
          <input className="cam-form-input" value={formData.name || ""} onChange={(e) => setFormData(f => ({ ...f, name: e.target.value }))} required />
        </div>
        <div className="cam-form-field">
          <label>{t("cam.ip")}</label>
          <input className="cam-form-input" value={formData.ip_address || ""} onChange={(e) => setFormData(f => ({ ...f, ip_address: e.target.value }))} placeholder="192.168.1.1" />
        </div>
        <div className="cam-form-field">
          <label>{t("cam.location")}</label>
          <input className="cam-form-input" value={formData.location || ""} onChange={(e) => setFormData(f => ({ ...f, location: e.target.value }))} />
        </div>
        <div className="cam-form-field">
          <label>{t("cam.road")}</label>
          <StyledSelect
            value={formData.road || ""}
            onChange={(v) => setFormData(f => ({ ...f, road: v ? Number(v) : "" }))}
            placeholder={`— ${t("cam.noRoad")} —`}
            icon="bi-signpost-split"
            options={[
              { value: "", label: `— ${t("cam.noRoad")} —` },
              ...roads.map(r => ({ value: r.id, label: r.name, icon: "bi-geo-alt" })),
            ]}
          />
        </div>
        <div className="cam-form-field cam-form-check-row">
          <label className="cam-form-toggle">
            <input type="checkbox" checked={formData.active ?? true} onChange={(e) => setFormData(f => ({ ...f, active: e.target.checked }))} />
            <span className="cam-toggle-track"><span className="cam-toggle-thumb" /></span>
            <span>{t("cam.active")}</span>
          </label>
        </div>
      </>);
      case "roads": return (<>
        <div className="cam-form-field">
          <label>{t("cam.name")}</label>
          <input className="cam-form-input" value={formData.name || ""} onChange={(e) => setFormData(f => ({ ...f, name: e.target.value }))} required />
        </div>
        <div className="cam-form-field">
          <label>{t("cam.code")}</label>
          <input className="cam-form-input" value={formData.code || ""} onChange={(e) => setFormData(f => ({ ...f, code: e.target.value }))} required />
        </div>
        <div className="cam-form-field">
          <label>{t("cam.location")}</label>
          <input className="cam-form-input" value={formData.location || ""} onChange={(e) => setFormData(f => ({ ...f, location: e.target.value }))} />
        </div>
      </>);
      case "signals": return (<>
        <div className="cam-form-field">
          <label>{t("cam.type")}</label>
          <StyledSelect
            value={formData.signal_type || "traffic_light"}
            onChange={(v) => setFormData(f => ({ ...f, signal_type: v }))}
            options={SIGNAL_TYPES.map(s => ({ value: s.value, label: t(s.labelKey), icon: s.value === "traffic_light" ? "bi-stoplights" : "bi-speedometer2" }))}
          />
        </div>
        <div className="cam-form-field">
          <label>{t("cam.location")}</label>
          <input className="cam-form-input" value={formData.location || ""} onChange={(e) => setFormData(f => ({ ...f, location: e.target.value }))} />
        </div>
        <div className="cam-form-field">
          <label>{t("cam.road")}</label>
          <StyledSelect
            value={formData.road || ""}
            onChange={(v) => setFormData(f => ({ ...f, road: v ? Number(v) : "" }))}
            placeholder={`— ${t("cam.noRoad")} —`}
            icon="bi-signpost-split"
            options={[
              { value: "", label: `— ${t("cam.noRoad")} —` },
              ...roads.map(r => ({ value: r.id, label: r.name, icon: "bi-geo-alt" })),
            ]}
          />
        </div>
        <div className="cam-form-field">
          <label>{t("cam.status")}</label>
          <StyledSelect
            value={formData.status || "active"}
            onChange={(v) => setFormData(f => ({ ...f, status: v }))}
            options={[
              { value: "active", label: t("cam.active"), icon: "bi-check-circle-fill", color: "#16a34a", bg: "rgba(22,163,74,.12)" },
              { value: "inactive", label: t("cam.inactive"), icon: "bi-x-circle-fill", color: "#dc2626", bg: "rgba(239,68,68,.12)" },
            ]}
          />
        </div>
      </>);
      case "signs": return (<>
        <div className="cam-form-field">
          <label>{t("cam.type")}</label>
          <StyledSelect
            value={formData.sign_type || "speed_limit"}
            onChange={(v) => setFormData(f => ({ ...f, sign_type: v }))}
            options={SIGN_TYPES.map(s => ({ value: s.value, label: t(s.labelKey), icon: "bi-sign-stop" }))}
          />
        </div>
        <div className="cam-form-field">
          <label>{t("cam.description")}</label>
          <input className="cam-form-input" value={formData.description || ""} onChange={(e) => setFormData(f => ({ ...f, description: e.target.value }))} />
        </div>
        <div className="cam-form-field">
          <label>{t("cam.location")}</label>
          <input className="cam-form-input" value={formData.location || ""} onChange={(e) => setFormData(f => ({ ...f, location: e.target.value }))} />
        </div>
        <div className="cam-form-field">
          <label>{t("cam.road")}</label>
          <StyledSelect
            value={formData.road || ""}
            onChange={(v) => setFormData(f => ({ ...f, road: v ? Number(v) : "" }))}
            placeholder={`— ${t("cam.noRoad")} —`}
            icon="bi-signpost-split"
            options={[
              { value: "", label: `— ${t("cam.noRoad")} —` },
              ...roads.map(r => ({ value: r.id, label: r.name, icon: "bi-geo-alt" })),
            ]}
          />
        </div>
        <div className="cam-form-field">
          <label>{t("cam.speedLimit")}</label>
          <input className="cam-form-input" type="number" min="0" value={formData.speed_limit ?? ""} onChange={(e) => setFormData(f => ({ ...f, speed_limit: e.target.value }))} placeholder="km/h" />
        </div>
        <div className="cam-form-field">
          <label>{t("cam.image")}</label>
          <div className="cam-image-upload">
            {imagePreview && (
              <div className="cam-image-upload-preview">
                <img src={imagePreview} alt="sign" />
                <button type="button" className="cam-image-remove" onClick={() => { setImageFile(null); setImagePreview(null); if (fileRef.current) fileRef.current.value = ""; }}>
                  <i className="bi bi-x-circle-fill" />
                </button>
              </div>
            )}
            <label className="cam-image-drop" htmlFor="sign-image-input">
              <i className="bi bi-cloud-arrow-up" />
              <span>{t("cam.uploadHint")}</span>
            </label>
            <input
              ref={fileRef}
              id="sign-image-input"
              type="file"
              accept="image/*"
              style={{ display: "none" }}
              onChange={(e) => {
                const file = e.target.files?.[0];
                if (file) {
                  setImageFile(file);
                  const reader = new FileReader();
                  reader.onload = (ev) => setImagePreview(ev.target.result);
                  reader.readAsDataURL(file);
                }
              }}
            />
          </div>
        </div>
      </>);
      default: return null;
    }
  };

  /* ── KPI cards ── */
  const stats = [
    { icon: "bi-camera-video-fill", label: t("cam.totalCameras"),  value: tab === "cameras" ? total : "—", color: PU,        bg: PA(".1") },
    { icon: "bi-signpost-split-fill", label: t("cam.totalRoads"),  value: tab === "roads" ? total : "—",   color: "#2563eb", bg: "rgba(59,130,246,.1)" },
    { icon: "bi-stoplights-fill",   label: t("cam.totalSignals"),  value: tab === "signals" ? total : "—", color: "#f59e0b", bg: "rgba(245,158,11,.1)" },
    { icon: "bi-sign-stop-fill",    label: t("cam.totalSigns"),    value: tab === "signs" ? total : "—",   color: "#dc2626", bg: "rgba(239,68,68,.1)" },
  ];

  return (
    <div className="cam-page">
      {/* ── Header ── */}
      <div className="cam-header">
        <div>
          <h5 className="cam-page-title">
            <i className="bi bi-camera-video-fill" style={{ color: PU }} />
            {t("cam.title")}
          </h5>
          <p className="cam-page-sub">{t("cam.subtitle")}</p>
        </div>
        <div className="cam-header-actions">
          {isAdmin && (
            <button className="cam-btn cam-btn--add" onClick={openAdd}>
              <i className="bi bi-plus-lg" /> {t("cam.add")}
            </button>
          )}
          <button
            className="cam-btn cam-btn--refresh"
            disabled={refreshing}
            onClick={handleRefresh}
          >
            <i className={`bi bi-arrow-clockwise ${refreshing ? "cam-spin" : ""}`} />
            {refreshing ? t("cam.refreshing") : t("cam.refresh")}
          </button>
        </div>
      </div>

      {/* ── KPI Row ── */}
      <div className="cam-stats">
        {stats.map((s) => (
          <div key={s.label} className="cam-stat-card">
            <div className="cam-stat-icon" style={{ background: s.bg }}>
              <i className={`bi ${s.icon}`} style={{ color: s.color }} />
            </div>
            <div>
              <div className="cam-stat-value">{s.value}</div>
              <div className="cam-stat-label">{s.label}</div>
            </div>
          </div>
        ))}
      </div>

      {/* ── Tabs + Filters ── */}
      <div className="cam-toolbar">
        <div className="cam-tabs">
          {TABS.map((t_) => (
            <button
              key={t_.key}
              className={`cam-tab ${tab === t_.key ? "active" : ""}`}
              onClick={() => handleTabChange(t_.key)}
            >
              <i className={`bi ${t_.icon}`} />
              {t(t_.labelKey)}
            </button>
          ))}
        </div>

        <div className="cam-filters">
          {statusFilters?.map(({ key, label }) => (
            <button
              key={key}
              className={`cam-filter ${statusFilter === key ? "active" : ""}`}
              onClick={() => setStatusFilter(key)}
            >
              {label}
            </button>
          ))}

          <div className="cam-search">
            <i className="bi bi-search" />
            <input
              type="text"
              placeholder={t("cam.searchPh")}
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
            {search && (
              <button className="cam-search-clear" onClick={() => setSearch("")}>
                <i className="bi bi-x" />
              </button>
            )}
          </div>
        </div>
      </div>

      {/* ── Table ── */}
      <div className="cam-table-wrap" style={{ opacity: refreshing ? .6 : 1 }}>
        <table className="cam-table">
          <thead>{renderHead()}</thead>
          <tbody>
            {loading
              ? (
                  <tr>
                    <td colSpan={colCount} className="cam-empty">
                      <div className="spinner-border" style={{ color: "#7c3aed", width: 40, height: 40 }} role="status">
                        <span className="visually-hidden">Loading...</span>
                      </div>
                    </td>
                  </tr>
                )
              : items.length === 0
                ? (
                  <tr>
                    <td colSpan={colCount} className="cam-empty">
                      <i className="bi bi-camera-video" />
                      <span>{t("cam.noResults")}</span>
                    </td>
                  </tr>
                )
                : items.map((item, i) => renderRow(item, i))
            }
          </tbody>
        </table>
      </div>

      {/* ── Paginator ── */}
      <Paginator page={page} total={total} pageSize={getPageSize()} onChange={setPage} loading={loading || refreshing} />

      {/* ── Add/Edit Modal ── */}
      <Modal
        open={!!modal}
        title={modal?.mode === "add" ? t("cam.addTitle") : t("cam.editTitle")}
        onClose={closeModal}
      >
        <form className="cam-form" onSubmit={handleSave}>
          {renderFormFields()}
          <div className="cam-form-actions">
            <button type="button" className="cam-btn cam-btn--cancel" onClick={closeModal}>{t("cam.cancel")}</button>
            <button type="submit" className="cam-btn cam-btn--save" disabled={saving}>
              {saving ? <><i className="bi bi-arrow-repeat cam-spin" /> {t("cam.saving")}</> : <><i className="bi bi-check-lg" /> {t("cam.save")}</>}
            </button>
          </div>
        </form>
      </Modal>

      {/* ── Detail Modal ── */}
      <Modal open={!!detailItem} title={t("cam.detailTitle")} onClose={closeDetail}>
        {detailItem && (
          <div className="cam-detail">
            {/* Sign image (if signs tab and has image) */}
            {tab === "signs" && detailItem.image && (
              <div className="cam-detail-image">
                <img
                  src={detailItem.image.startsWith("http") ? detailItem.image : `${BACKEND}${detailItem.image}`}
                  alt={detailItem.sign_type}
                  onClick={() => { closeDetail(); setPreviewImg(detailItem.image.startsWith("http") ? detailItem.image : `${BACKEND}${detailItem.image}`); }}
                />
              </div>
            )}

            {tab === "cameras" && <>
              <div className="cam-detail-row">
                <span className="cam-detail-label">{t("cam.name")}</span>
                <span className="cam-detail-value">{detailItem.name}</span>
              </div>
              <div className="cam-detail-row">
                <span className="cam-detail-label">{t("cam.ip")}</span>
                <span className="cam-detail-value"><code className="cam-ip">{detailItem.ip_address || "—"}</code></span>
              </div>
              <div className="cam-detail-row">
                <span className="cam-detail-label">{t("cam.location")}</span>
                <span className="cam-detail-value">{detailItem.location || "—"}</span>
              </div>
              <div className="cam-detail-row">
                <span className="cam-detail-label">{t("cam.road")}</span>
                <span className="cam-detail-value">{roadName(detailItem.road)}</span>
              </div>
              <div className="cam-detail-row">
                <span className="cam-detail-label">{t("cam.status")}</span>
                <span className="cam-detail-value">
                  {(() => { const st = CAM_STATUS[detailItem.active] ?? CAM_STATUS[false]; return (
                    <span className="cam-status-badge" style={{ background: st.bg, color: st.color }}>
                      <i className={`bi ${st.icon}`} /> {t(st.label)}
                    </span>
                  ); })()}
                </span>
              </div>
              <div className="cam-detail-row">
                <span className="cam-detail-label">ID</span>
                <span className="cam-detail-value text-secondary">#{detailItem.id}</span>
              </div>
            </>}

            {tab === "roads" && <>
              <div className="cam-detail-row">
                <span className="cam-detail-label">{t("cam.name")}</span>
                <span className="cam-detail-value">{detailItem.name}</span>
              </div>
              <div className="cam-detail-row">
                <span className="cam-detail-label">{t("cam.code")}</span>
                <span className="cam-detail-value"><code className="cam-ip">{detailItem.code || "—"}</code></span>
              </div>
              <div className="cam-detail-row">
                <span className="cam-detail-label">{t("cam.location")}</span>
                <span className="cam-detail-value">{detailItem.location || "—"}</span>
              </div>
              <div className="cam-detail-row">
                <span className="cam-detail-label">ID</span>
                <span className="cam-detail-value text-secondary">#{detailItem.id}</span>
              </div>
            </>}

            {tab === "signals" && <>
              <div className="cam-detail-row">
                <span className="cam-detail-label">{t("cam.type")}</span>
                <span className="cam-detail-value fw-semibold">{t(SIGNAL_TYPES.find(s => s.value === detailItem.signal_type)?.labelKey || "cam.sigTrafficLight")}</span>
              </div>
              <div className="cam-detail-row">
                <span className="cam-detail-label">{t("cam.location")}</span>
                <span className="cam-detail-value">{detailItem.location || "—"}</span>
              </div>
              <div className="cam-detail-row">
                <span className="cam-detail-label">{t("cam.road")}</span>
                <span className="cam-detail-value">{roadName(detailItem.road)}</span>
              </div>
              <div className="cam-detail-row">
                <span className="cam-detail-label">{t("cam.status")}</span>
                <span className="cam-detail-value">
                  {(() => { const ss = SIGNAL_STATUS[detailItem.status] ?? SIGNAL_STATUS.active; return (
                    <span className="cam-status-badge" style={{ background: ss.bg, color: ss.color }}>{t(ss.label)}</span>
                  ); })()}
                </span>
              </div>
              <div className="cam-detail-row">
                <span className="cam-detail-label">ID</span>
                <span className="cam-detail-value text-secondary">#{detailItem.id}</span>
              </div>
            </>}

            {tab === "signs" && <>
              <div className="cam-detail-row">
                <span className="cam-detail-label">{t("cam.type")}</span>
                <span className="cam-detail-value fw-semibold">{t(SIGN_TYPES.find(s => s.value === detailItem.sign_type)?.labelKey || "cam.signSpeed")}</span>
              </div>
              <div className="cam-detail-row">
                <span className="cam-detail-label">{t("cam.description")}</span>
                <span className="cam-detail-value">{detailItem.description || "—"}</span>
              </div>
              <div className="cam-detail-row">
                <span className="cam-detail-label">{t("cam.location")}</span>
                <span className="cam-detail-value">{detailItem.location || "—"}</span>
              </div>
              <div className="cam-detail-row">
                <span className="cam-detail-label">{t("cam.road")}</span>
                <span className="cam-detail-value">{roadName(detailItem.road)}</span>
              </div>
              {detailItem.speed_limit && (
                <div className="cam-detail-row">
                  <span className="cam-detail-label">{t("cam.speedLimit")}</span>
                  <span className="cam-detail-value"><span className="cam-speed">{detailItem.speed_limit} km/h</span></span>
                </div>
              )}
              <div className="cam-detail-row">
                <span className="cam-detail-label">ID</span>
                <span className="cam-detail-value text-secondary">#{detailItem.id}</span>
              </div>
            </>}

            <div className="cam-detail-actions">
              {isAdmin && (
                <button className="cam-btn cam-btn--add" onClick={() => { closeDetail(); openEdit(detailItem); }}>
                  <i className="bi bi-pencil-fill" /> {t("cam.edit")}
                </button>
              )}
              <button className="cam-btn cam-btn--cancel" onClick={closeDetail}>{t("cam.close")}</button>
            </div>
          </div>
        )}
      </Modal>

      {/* ── Image Lightbox ── */}
      {previewImg && (
        <div className="cam-lightbox" onClick={() => setPreviewImg(null)}>
          <button className="cam-lightbox-close" onClick={() => setPreviewImg(null)}>
            <i className="bi bi-x-lg" />
          </button>
          <img src={previewImg} alt="Sign" className="cam-lightbox-img" onClick={(e) => e.stopPropagation()} />
        </div>
      )}
    </div>
  );
}
