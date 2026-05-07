import { useRef, useState, useMemo, useEffect, useCallback } from "react";
import { processImage, uploadVideo } from "../services/aiService.js";
import { listCameras } from "../services/cameraService.js";
import { useLanguage } from "../i18n/LanguageContext.jsx";
import StyledSelect from "../components/StyledSelect.jsx";
import { useToast } from "../components/ui/ToastProvider.jsx";

const PU = "#7c3aed";

/* ── colour palette for bounding boxes (matches backend) ─────── */
const BOX_COLORS = [
  "#7c3aed", "#ef4444", "#f59e0b", "#16a34a",
  "#3b82f6", "#a855f7", "#f97316", "#14b8a6",
  "#ec4899", "#6366f1", "#eab308", "#06b6d4",
];
function colorFor(label) {
  let h = 0;
  for (let i = 0; i < label.length; i++) h = ((h << 5) - h + label.charCodeAt(i)) | 0;
  return BOX_COLORS[Math.abs(h) % BOX_COLORS.length];
}

/* ── BBoxOverlay: renders interactive bounding boxes over image ── */
function BBoxOverlay({ src, detections, highlightIdx, onHover, onClick }) {
  const { t } = useLanguage();
  const containerRef = useRef(null);
  const imgRef = useRef(null);
  const [imgNat, setImgNat] = useState({ w: 1, h: 1 });
  const [imgRect, setImgRect] = useState({ x: 0, y: 0, w: 1, h: 1 });

  const recalc = useCallback(() => {
    const img = imgRef.current;
    const cont = containerRef.current;
    if (!img || !cont) return;
    const cr = cont.getBoundingClientRect();
    const ir = img.getBoundingClientRect();
    setImgRect({
      x: ir.left - cr.left,
      y: ir.top - cr.top,
      w: ir.width,
      h: ir.height,
    });
  }, []);

  useEffect(() => {
    recalc();
    window.addEventListener("resize", recalc);
    return () => window.removeEventListener("resize", recalc);
  }, [recalc, src, detections]);

  const scaleX = imgRect.w / imgNat.w;
  const scaleY = imgRect.h / imgNat.h;

  return (
    <div ref={containerRef} className="position-relative rounded-3 overflow-hidden"
      style={{ background: "#0a0a0a", border: "1px solid #e4dcf8" }}>
      <img
        ref={imgRef}
        src={src}
        alt="Detection"
        onLoad={(e) => {
          setImgNat({ w: e.target.naturalWidth, h: e.target.naturalHeight });
          setTimeout(recalc, 50);
        }}
        style={{ width: "100%", maxHeight: 400, objectFit: "contain", display: "block" }}
      />
      {/* SVG overlay for bboxes */}
      <svg
        style={{
          position: "absolute",
          left: imgRect.x,
          top: imgRect.y,
          width: imgRect.w,
          height: imgRect.h,
          pointerEvents: "none",
        }}
      >
        {detections?.map((det, i) => {
          if (!det.box) return null;
          const [x1, y1, x2, y2] = det.box;
          const sx = x1 * scaleX, sy = y1 * scaleY;
          const sw = (x2 - x1) * scaleX, sh = (y2 - y1) * scaleY;
          const c = colorFor(det.label);
          const active = highlightIdx === i;
          return (
            <g key={i} style={{ pointerEvents: "all", cursor: "pointer" }}
              onMouseEnter={() => onHover?.(i)}
              onMouseLeave={() => onHover?.(null)}
              onClick={() => onClick?.(i)}>
              {/* box rect */}
              <rect x={sx} y={sy} width={sw} height={sh}
                fill={active ? `${c}22` : "transparent"}
                stroke={c}
                strokeWidth={active ? 3 : 2}
                rx={3}
                style={{ transition: "all .15s" }}
              />
              {/* label bg */}
              <rect x={sx} y={Math.max(0, sy - 20)} width={Math.max(sw, 60)} height={20}
                fill={c} rx={3} opacity={active ? 1 : 0.85}
              />
              {/* label text */}
              <text x={sx + 4} y={Math.max(0, sy - 20) + 14}
                fill="#fff" fontSize={11} fontWeight={600}
                style={{ textTransform: "capitalize", userSelect: "none" }}>
                {det.label?.replace(/_/g, " ")} {det.confidence}%
              </text>
            </g>
          );
        })}
      </svg>
      {/* detection count overlay */}
      <div className="position-absolute top-0 end-0 m-2">
        <span className="badge rounded-pill fw-semibold"
          style={{ fontSize: ".78rem", background: "rgba(0,0,0,.6)", color: "#fff", backdropFilter: "blur(4px)" }}>
          <i className="bi bi-bounding-box me-1" />{detections?.length ?? 0} {t("ai.objects")}
        </span>
      </div>
    </div>
  );
}

/* ── DropZone ───────────────────────────────────────────────────── */
function DropZone({ accept, file, onChange, icon, hint, subHint }) {
  const ref = useRef();
  const [drag, setDrag] = useState(false);
  const preview = useMemo(() => {
    if (!file) return null;
    if (file.type?.startsWith("image/")) return URL.createObjectURL(file);
    if (file.type?.startsWith("video/")) return URL.createObjectURL(file);
    return null;
  }, [file]);

  return (
    <div
      onClick={() => !file && ref.current.click()}
      onDragOver={(e) => { e.preventDefault(); setDrag(true); }}
      onDragLeave={() => setDrag(false)}
      onDrop={(e) => {
        e.preventDefault(); setDrag(false);
        const f = e.dataTransfer.files[0]; if (f) onChange(f);
      }}
      className="flex-fill d-flex flex-column align-items-center justify-content-center text-center rounded-3 position-relative"
      style={{
        border: `2px dashed ${drag ? PU : file ? PU : "#dce3ed"}`,
        cursor: file ? "default" : "pointer", transition: "all .2s",
        // Use a neutral surface instead of pure black to avoid harsh letterboxing.
        background: drag ? "rgba(124,58,237,.05)" : file ? "#0b1220" : "#fafbfd",
        minHeight: 0, overflow: "hidden", padding: file ? 0 : "1rem",
      }}
    >
      <input ref={ref} type="file" accept={accept} className="d-none"
        onChange={(e) => { onChange(e.target.files[0]); e.target.value = ""; }} />

      {/* file preview */}
      {file && preview && file.type?.startsWith("image/") && (
        <div
          className="w-100 h-100 d-flex align-items-center justify-content-center"
          style={{ background: "#0b1220" }}
        >
          <img
            src={preview}
            alt="preview"
            style={{
              width: "auto",
              height: "auto",
              maxWidth: "100%",
              maxHeight: 320,
              objectFit: "contain",
              objectPosition: "center",
              display: "block",
            }}
          />
        </div>
      )}
      {file && preview && file.type?.startsWith("video/") && (
        <div
          className="w-100 h-100 d-flex align-items-center justify-content-center"
          style={{ background: "#0b1220" }}
        >
          <video
            src={preview}
            controls
            muted
            style={{
              width: "auto",
              height: "auto",
              maxWidth: "100%",
              maxHeight: 320,
              objectFit: "contain",
              display: "block",
            }}
          />
        </div>
      )}

      {/* placeholder */}
      {!file && (
        <>
          <i className={`bi ${icon} mb-2`} style={{ fontSize: "2.2rem", color: "#b0bec5" }} />
          <p className="mb-0 fw-semibold" style={{ fontSize: ".95rem", color: "#64748b" }}>{hint}</p>
          <p className="mb-0 text-secondary" style={{ fontSize: ".85rem", marginTop: ".2rem" }}>{subHint}</p>
        </>
      )}

      {/* file name overlay */}
      {file && (
        <div className="position-absolute bottom-0 start-0 end-0 px-2 py-1"
          style={{ background: "rgba(0,0,0,.55)", backdropFilter: "blur(4px)" }}>
          <span className="text-white fw-semibold" style={{ fontSize: ".82rem" }}>
            <i className="bi bi-file-earmark-check me-1" />{file.name}
          </span>
        </div>
      )}
    </div>
  );
}

const TABS = [
  { key: "image", labelKey: "ai.imageDetection", icon: "bi-image",       accept: "image/*", field: "image",
    hintKey: "ai.imageHint",
    descKey: "ai.imageDesc" },
  { key: "video", labelKey: "ai.videoAnalysis",  icon: "bi-camera-video", accept: "video/*", field: "video",
    hintKey: "ai.videoHint",
    descKey: "ai.videoDesc" },
];

/* ── main component ─────────────────────────────────────────────── */
export default function AIUpload() {
  const { t } = useLanguage();
  const { push: pushToast } = useToast();
  const [tab,     setTab]     = useState("image");
  const [imgFile, setImgFile] = useState(null);
  const [vidFile, setVidFile] = useState(null);
  const [loading, setLoading] = useState(false);
  const [result,  setResult]  = useState(null);
  const [error,   setError]   = useState("");
  const [showAnnotated, setShowAnnotated] = useState("bbox");
  const [selectedFrame, setSelectedFrame] = useState(null);
  const [hoveredDet, setHoveredDet] = useState(null);
  const [cameras, setCameras] = useState([]);
  const [cameraId, setCameraId] = useState("");
  const [recentRuns, setRecentRuns] = useState(() => {
    try {
      const raw = localStorage.getItem("ai.recentRuns");
      const parsed = raw ? JSON.parse(raw) : [];
      return Array.isArray(parsed) ? parsed : [];
    } catch {
      return [];
    }
  });

  const saveRecentRuns = useCallback((next) => {
    setRecentRuns(next);
    try {
      localStorage.setItem("ai.recentRuns", JSON.stringify(next));
    } catch {
      // ignore storage quota / private mode
    }
  }, []);

  /* fetch cameras once */
  useEffect(() => {
    listCameras({ page_size: 200 })
      .then((d) => setCameras(d.results ?? d ?? []))
      .catch(() => {});
  }, []);

  const tabInfo = TABS.find((tb) => tb.key === tab);
  const current = tab === "image" ? imgFile : vidFile;
  const setFile  = tab === "image" ? setImgFile : setVidFile;

  const handleSubmit = async () => {
    if (!current) return;
    setLoading(true); setResult(null); setError("");
    try {
      const fd = new FormData();
      fd.append(tabInfo.field, current);
      if (cameraId) fd.append("camera_id", cameraId);
      const data = tab === "image" ? await processImage(fd) : await uploadVideo(fd);
      setResult(data);
      const cam = cameras.find((c) => String(c.id) === String(cameraId));
      const now = new Date();
      const objects = Array.isArray(data?.detected_objects) ? data.detected_objects.length : undefined;
      const violations = Array.isArray(data?.violations) ? data.violations.length : undefined;
      const entry = {
        ts: now.toISOString(),
        type: tab,
        fileName: current?.name || "",
        cameraName: cam?.name || (cameraId ? `Camera #${cameraId}` : "Manual upload"),
        objects,
        violations,
        ok: true,
      };
      const next = [entry, ...(recentRuns || [])].slice(0, 6);
      saveRecentRuns(next);
    } catch {
      const msg = t("ai.error");
      setError(msg);
      pushToast?.({ variant: "danger", title: "AI Detection", message: msg });
      const now = new Date();
      const entry = {
        ts: now.toISOString(),
        type: tab,
        fileName: current?.name || "",
        cameraName: cameraId ? `Camera #${cameraId}` : "Manual upload",
        ok: false,
      };
      const next = [entry, ...(recentRuns || [])].slice(0, 6);
      saveRecentRuns(next);
    } finally {
      setLoading(false);
    }
  };

  const reset = () => { setImgFile(null); setVidFile(null); setResult(null); setError(""); setShowAnnotated("bbox"); setSelectedFrame(null); setHoveredDet(null); setCameraId(""); };

  return (
    <div className="d-flex flex-column w-100" style={{ flex: 1, minHeight: 0, padding: "1rem", boxSizing: "border-box" }}>
      <div className="row g-3 flex-fill align-items-stretch" style={{ margin: 0, minHeight: 0 }}>

        {/* ══ LEFT: upload panel ══ */}
        <div className="col-12 col-lg-6 d-flex" style={{ minHeight: 0 }}>
          <div
            className="card border-0 rounded-4 d-flex flex-column flex-fill"
            style={{ boxShadow: "0 1px 3px rgba(0,0,0,.06),0 8px 24px rgba(124,58,237,.07)", overflow: "hidden", minHeight: 0 }}
          >
            <div className="card-body d-flex flex-column gap-2 p-3" style={{ minHeight: 0 }}>

            {/* tab pills */}
            <div className="d-flex gap-2">
              {TABS.map((tb) => (
                <button key={tb.key}
                  onClick={() => { setTab(tb.key); setResult(null); setError(""); }}
                  className="btn btn-sm d-flex align-items-center gap-1 rounded-pill fw-semibold"
                  style={{
                    fontSize: ".96rem",
                    background: tab === tb.key ? "#7c3aed" : "#f3f0ff",
                    color:      tab === tb.key ? "#fff"    : "#7c3aed",
                    border: "none",
                  }}
                >
                  <i className={`bi ${tb.icon}`} />{t(tb.labelKey)}
                </button>
              ))}
            </div>

            {/* section header */}
            <div>
              <div className="d-flex align-items-center gap-2 mb-1">
                <span className="rounded-2 d-flex align-items-center justify-content-center flex-shrink-0"
                  style={{ width: 28, height: 28, background: "#f3f0ff" }}>
                  <i className={`bi ${tabInfo.icon}`} style={{ color: "#7c3aed", fontSize: "1.05rem" }} />
                </span>
                <span className="fw-bold" style={{ fontSize: "1.15rem", color: "var(--bs-body-color)" }}>{t(tabInfo.labelKey)}</span>
              </div>
              <p className="mb-0" style={{ fontSize: ".9rem", color: "#8a97a8", paddingLeft: "2.2rem" }}>{t(tabInfo.descKey)}</p>
            </div>

            {/* camera selector */}
            <div className="d-flex align-items-center gap-2">
              <div className="flex-fill">
                <StyledSelect
                  value={cameraId}
                  onChange={(v) => setCameraId(v)}
                  placeholder={t("ai.noCamera")}
                  icon="bi-camera-video-fill"
                  options={[
                    { value: "", label: t("ai.noCamera") },
                    ...cameras.map((c) => ({
                      value: c.id,
                      label: `${c.name}${c.location ? ` — ${c.location}` : ""}`,
                      icon: "bi-camera-video",
                    })),
                  ]}
                />
              </div>
            </div>

            {/* drop zone (fills remaining height to match right card) */}
            <div className="flex-fill d-flex" style={{ minHeight: 0 }}>
              <DropZone
                accept={tabInfo.accept} file={current} onChange={setFile}
                icon={tab === "image" ? "bi-image" : "bi-camera-video"} hint={t("ai.dropHint")} subHint={t(tabInfo.hintKey)}
              />
            </div>

            {/* error */}
            {error && (
              <div className="d-flex align-items-center gap-2 rounded-3 px-3 py-2"
                style={{ background: "rgba(239,68,68,.08)", color: "#dc2626", fontSize: ".92rem" }}>
                <i className="bi bi-exclamation-circle" />{error}
              </div>
            )}

            {/* action buttons */}
            <div className="d-flex gap-2 mt-auto">
              <button
                onClick={handleSubmit} disabled={!current || loading}
                className="btn flex-fill d-flex align-items-center justify-content-center gap-2 fw-semibold rounded-3"
                style={{
                  fontSize: "1rem",
                  background: current && !loading ? "#7c3aed" : "#e2d9f3",
                  color: current && !loading ? "#fff" : "#a78bfa",
                  border: "none",
                }}
              >
                {loading
                  ? <><span className="spinner-border spinner-border-sm" />{t("ai.analyzing")}</>
                  : <><i className="bi bi-cpu" />{tab === "image" ? t("ai.analyzeImage") : t("ai.analyzeVideo")}</>}
              </button>
              {current && (
                <button onClick={reset}
                  className="btn d-flex align-items-center gap-1 fw-medium rounded-3"
                  style={{ fontSize: "1rem", border: "1.5px solid #e4dcf8", color: "#7c3aed", background: "#fff" }}>
                  <i className="bi bi-x-circle" />{t("ai.clear")}
                </button>
              )}
            </div>

            </div>
          </div>
        </div>

        {/* ══ RIGHT: results panel ══ */}
        <div className="col-12 col-lg-6 d-flex" style={{ minHeight: 0 }}>
          <div
            className="card border-0 rounded-4 d-flex flex-column flex-fill"
            style={{ boxShadow: "0 1px 3px rgba(0,0,0,.06),0 8px 24px rgba(124,58,237,.07)", overflow: "hidden", minHeight: 0 }}
          >
            <div className="card-body d-flex flex-column p-3" style={{ minHeight: 0 }}>

            {/* header */}
            <div className="d-flex align-items-center gap-2 mb-2 flex-shrink-0">
              <span className="rounded-2 d-flex align-items-center justify-content-center flex-shrink-0"
                style={{ width: 28, height: 28, background: "#f3f0ff" }}>
                <i className="bi bi-clipboard-data" style={{ color: PU, fontSize: "1.05rem" }} />
              </span>
              <span className="fw-bold" style={{ fontSize: "1.15rem", color: "var(--bs-body-color)" }}>{t("ai.detectionResults")}</span>
              {result && (
                <span className="ms-auto badge rounded-pill fw-semibold"
                  style={{ fontSize: ".85rem", background: "#f0fdf4", color: "#16a34a", border: "1px solid #bbf7d0" }}>
                  <i className="bi bi-check-circle-fill me-1" />{t("ai.complete")}
                </span>
              )}
            </div>

            {/* scrollable body */}
            <div className="flex-fill overflow-auto no-scrollbar" style={{ minHeight: 0 }}>

              {/* empty state */}
              {!result && !loading && (
                <div className="h-100 d-flex flex-column align-items-center justify-content-center gap-2 text-center">
                  <div className="rounded-circle d-flex align-items-center justify-content-center"
                    style={{ width: 64, height: 64, background: "#f3f0ff" }}>
                    <i className="bi bi-cpu-fill" style={{ fontSize: "1.7rem", color: "#c4b5fd" }} />
                  </div>
                  <p className="mb-0 fw-semibold" style={{ fontSize: "1.05rem", color: "#8a6fca" }}>{t("ai.noResults")}</p>
                  <p className="mb-0" style={{ fontSize: ".9rem", color: "#b0a0d8", maxWidth: 200 }}>
                    {t("ai.noResultsDesc")}
                  </p>
                </div>
              )}

              {/* loading */}
              {loading && (
                <div className="h-100 d-flex flex-column align-items-center justify-content-center gap-3">
                  <div className="rounded-circle d-flex align-items-center justify-content-center"
                    style={{ width: 52, height: 52, background: "#f3f0ff" }}>
                    <span className="spinner-border" style={{ color: PU, width: "1.8rem", height: "1.8rem" }} />
                  </div>
                  <p className="mb-0 fw-semibold" style={{ fontSize: "1rem", color: PU }}>{t("ai.analyzing")}</p>
                </div>
              )}

              {/* ════════ IMAGE RESULTS ════════ */}
              {result && tab === "image" && Array.isArray(result?.violations) && (
                <>
                  {/* annotated image viewer with interactive bounding boxes */}
                  {(result.annotated_image || result.original_image) && (
                    <div className="mb-3">
                      <div className="d-flex align-items-center justify-content-between mb-2">
                        <div className="fw-semibold" style={{ fontSize: ".9rem", color: "#64748b", textTransform: "uppercase", letterSpacing: ".05em" }}>
                          <i className="bi bi-eye me-1" />{t("ai.visualDetection")}
                        </div>
                        <div className="d-flex gap-1">
                          {result.annotated_image && result.original_image && (
                            <>
                              <button
                                className="btn btn-sm rounded-pill px-2 py-0"
                                style={{ fontSize: ".78rem", background: showAnnotated === "bbox" ? PU : "#f3f0ff", color: showAnnotated === "bbox" ? "#fff" : PU, border: "none" }}
                                onClick={() => setShowAnnotated("bbox")}>
                                <i className="bi bi-bounding-box me-1" />{t("ai.interactive")}
                              </button>
                              <button
                                className="btn btn-sm rounded-pill px-2 py-0"
                                style={{ fontSize: ".78rem", background: showAnnotated === "annotated" ? PU : "#f3f0ff", color: showAnnotated === "annotated" ? "#fff" : PU, border: "none" }}
                                onClick={() => setShowAnnotated("annotated")}>
                                <i className="bi bi-image-fill me-1" />{t("ai.aiRendered")}
                              </button>
                              <button
                                className="btn btn-sm rounded-pill px-2 py-0"
                                style={{ fontSize: ".78rem", background: showAnnotated === "original" ? PU : "#f3f0ff", color: showAnnotated === "original" ? "#fff" : PU, border: "none" }}
                                onClick={() => setShowAnnotated("original")}>
                                <i className="bi bi-image me-1" />{t("ai.original")}
                              </button>
                            </>
                          )}
                        </div>
                      </div>

                      {/* Interactive bbox overlay (default) */}
                      {showAnnotated === "bbox" && result.original_image && (
                        <BBoxOverlay
                          src={result.original_image}
                          detections={result.detected_objects}
                          highlightIdx={hoveredDet}
                          onHover={setHoveredDet}
                          onClick={(i) => setHoveredDet(hoveredDet === i ? null : i)}
                        />
                      )}

                      {/* Server-rendered annotated image */}
                      {showAnnotated === "annotated" && (
                        <div className="rounded-3 overflow-hidden position-relative"
                          style={{ background: "#0a0a0a", border: "1px solid #e4dcf8" }}>
                          <img
                            src={result.annotated_image}
                            alt="Annotated"
                            style={{ width: "100%", maxHeight: 400, objectFit: "contain", display: "block" }}
                          />
                          <div className="position-absolute top-0 end-0 m-2">
                            <span className="badge rounded-pill fw-semibold"
                              style={{ fontSize: ".78rem", background: "rgba(0,0,0,.6)", color: "#fff", backdropFilter: "blur(4px)" }}>
                              <i className="bi bi-bounding-box me-1" />{result.total_detections} {t("ai.objects")}
                            </span>
                          </div>
                        </div>
                      )}

                      {/* Original image */}
                      {showAnnotated === "original" && (
                        <div className="rounded-3 overflow-hidden"
                          style={{ background: "#0a0a0a", border: "1px solid #e4dcf8" }}>
                          <img
                            src={result.original_image}
                            alt="Original"
                            style={{ width: "100%", maxHeight: 400, objectFit: "contain", display: "block" }}
                          />
                        </div>
                      )}
                    </div>
                  )}

                  {/* summary stats */}
                  <div className="row g-2 mb-3">
                    {[
                      { label: t("ai.violationsFound"),    value: result.violations.length,        icon: "bi-exclamation-triangle-fill", color: "#f59e0b", bg: "#fffbeb" },
                      { label: t("ai.objectsDetected"),    value: result.total_detections ?? 0,    icon: "bi-eye-fill",                  color: PU, bg: "#f5f3ff" },
                    ].map(({ label, value, icon, color, bg }) => (
                      <div key={label} className="col-6">
                        <div className="rounded-3 p-2 text-center" style={{ background: bg, border: `1px solid ${color}22` }}>
                          <i className={`bi ${icon} d-block mb-1`} style={{ color, fontSize: "1.4rem" }} />
                          <div className="fw-bold" style={{ fontSize: "1.6rem", color }}>{value}</div>
                          <div style={{ fontSize: ".88rem", color: "#64748b" }}>{label}</div>
                        </div>
                      </div>
                    ))}
                  </div>

                  {/* no violations */}
                  {result.violations.length === 0 && (
                    <div className="d-flex align-items-center gap-2 rounded-3 px-3 py-2 mb-3"
                      style={{ background: "#f0fdf4", color: "#16a34a", fontSize: ".96rem" }}>
                      <i className="bi bi-check-circle-fill" />{t("ai.noViolationsImage")}
                    </div>
                  )}

                  {/* violation cards */}
                  {result.violations.length > 0 && (
                    <div className="mb-3">
                      <div className="fw-semibold mb-2" style={{ fontSize: ".9rem", color: "#64748b", textTransform: "uppercase", letterSpacing: ".05em" }}>{t("ai.violations")}</div>
                      <ul className="list-unstyled mb-0 d-flex flex-column gap-2">
                        {result.violations.map((v, i) => {
                          const sevColor = { critical: "#ef4444", high: "#f97316", medium: "#f59e0b", low: "#3b82f6", warning: "#8b5cf6" }[v.severity] ?? "#64748b";
                          const sevBg    = { critical: "#fef2f2", high: "#fff7ed", medium: "#fffbeb", low: "#eff6ff",  warning: "#f5f3ff" }[v.severity] ?? "#f8fafc";
                          return (
                            <li key={v.id ?? i} className="rounded-3 p-2"
                              style={{ background: "#fafbfd", border: "1px solid #e4dcf8" }}>
                              <div className="d-flex align-items-center gap-2 mb-1">
                                <span className="rounded-pill px-2 py-0 fw-bold"
                                  style={{ fontSize: ".75rem", background: sevBg, color: sevColor, border: `1px solid ${sevColor}33`, textTransform: "capitalize" }}>
                                  {v.severity}
                                </span>
                                <span className="fw-semibold" style={{ fontSize: ".94rem", color: "var(--bs-body-color)", textTransform: "capitalize" }}>
                                  {v.type?.replace(/_/g, " ")}
                                </span>
                                <span className="ms-auto badge rounded-pill"
                                  style={{ fontSize: ".78rem", background: "#f3f4f6", color: "#6b7280", textTransform: "capitalize" }}>
                                  {v.status}
                                </span>
                              </div>
                              <div className="d-flex align-items-center gap-3" style={{ fontSize: ".84rem", color: "#64748b" }}>
                                <span><i className="bi bi-geo-alt me-1" />{v.location}</span>
                                {v.fine_amount && <span><i className="bi bi-cash me-1" />${v.fine_amount}</span>}
                              </div>
                            </li>
                          );
                        })}
                      </ul>
                    </div>
                  )}

                  {/* detected objects (interactive — synced with bbox overlay) */}
                  {result.detected_objects?.length > 0 && (
                    <div>
                      <div className="fw-semibold mb-2" style={{ fontSize: ".9rem", color: "#64748b", textTransform: "uppercase", letterSpacing: ".05em" }}>{t("ai.allDetectedObjects")}</div>
                      <ul className="list-unstyled mb-0 d-flex flex-column gap-1">
                        {result.detected_objects.map((obj, i) => {
                          const c = colorFor(obj.label);
                          const active = hoveredDet === i;
                          return (
                            <li key={i}
                              className="d-flex align-items-center gap-2 py-1 rounded-2 px-2"
                              style={{
                                borderBottom: "1px solid #f0f4f8",
                                background: active ? `${c}12` : "transparent",
                                cursor: "pointer",
                                transition: "background .15s",
                              }}
                              onMouseEnter={() => setHoveredDet(i)}
                              onMouseLeave={() => setHoveredDet(null)}
                              onClick={() => { setShowAnnotated("bbox"); setHoveredDet(hoveredDet === i ? null : i); }}>
                              <span className="rounded-circle flex-shrink-0" style={{ width: 10, height: 10, background: c }} />
                              <span style={{ fontSize: ".88rem", color: active ? c : "#334155", fontWeight: active ? 600 : 400, textTransform: "capitalize", minWidth: 110, transition: "color .15s" }}>
                                {obj.label?.replace(/_/g, " ")}
                              </span>
                              <div className="flex-fill rounded-pill overflow-hidden" style={{ height: 6, background: "#e4dcf8" }}>
                                <div className="rounded-pill" style={{ height: "100%", width: `${obj.confidence}%`, background: `linear-gradient(90deg,${c},${c}aa)`, transition: "width .5s" }} />
                              </div>
                              <span style={{ fontSize: ".82rem", color: c, fontWeight: 600, minWidth: 42, textAlign: "right" }}>{obj.confidence}%</span>
                            </li>
                          );
                        })}
                      </ul>
                    </div>
                  )}
                </>
              )}

              {/* ════════ VIDEO RESULTS ════════ */}
              {result && tab === "video" && (
                <>
                  {/* video stats */}
                  <div className="row g-2 mb-3">
                    {[
                      { label: t("ai.framesAnalysed"), value: result.frames_analysed ?? 0, icon: "bi-film",                      color: PU, bg: "#f5f3ff" },
                      { label: t("ai.violationsFound"), value: result.violations?.length ?? 0, icon: "bi-exclamation-triangle-fill", color: "#f59e0b", bg: "#fffbeb" },
                      { label: t("ai.objectsDetected"),  value: result.total_detections ?? 0, icon: "bi-eye-fill",                 color: "#3b82f6", bg: "#eff6ff" },
                      { label: t("ai.duration"),           value: `${result.video_duration ?? 0}s`, icon: "bi-clock-fill",          color: "#16a34a", bg: "#f0fdf4" },
                    ].map(({ label, value, icon, color, bg }) => (
                      <div key={label} className="col-6">
                        <div className="rounded-3 p-2 text-center" style={{ background: bg, border: `1px solid ${color}22` }}>
                          <i className={`bi ${icon} d-block mb-1`} style={{ color, fontSize: "1.2rem" }} />
                          <div className="fw-bold" style={{ fontSize: "1.35rem", color }}>{value}</div>
                          <div style={{ fontSize: ".82rem", color: "#64748b" }}>{label}</div>
                        </div>
                      </div>
                    ))}
                  </div>

                  {/* ── annotated frame viewer (click a frame to enlarge) ── */}
                  {result.frame_results?.length > 0 && (
                    <div className="mb-3">
                      <div className="fw-semibold mb-2" style={{ fontSize: ".9rem", color: "#64748b", textTransform: "uppercase", letterSpacing: ".05em" }}>
                        <i className="bi bi-film me-1" />{t("ai.analysedFrames")} ({result.frame_results.length})
                      </div>

                      {/* selected frame enlarged */}
                      {selectedFrame && selectedFrame.thumbnail && (
                        <div className="rounded-3 overflow-hidden mb-2 position-relative"
                          style={{ background: "#0a0a0a", border: `2px solid ${PU}` }}>
                          <img src={selectedFrame.thumbnail} alt={`Frame ${selectedFrame.frame}`}
                            style={{ width: "100%", maxHeight: 280, objectFit: "contain", display: "block" }} />
                          <div className="position-absolute top-0 start-0 m-2 d-flex gap-1">
                            <span className="badge rounded-pill fw-semibold"
                              style={{ fontSize: ".75rem", background: "rgba(0,0,0,.6)", color: "#fff" }}>
                              Frame {selectedFrame.frame}
                            </span>
                            <span className="badge rounded-pill fw-semibold"
                              style={{ fontSize: ".75rem", background: "rgba(124,58,237,.8)", color: "#fff" }}>
                              {selectedFrame.timestamp}s
                            </span>
                          </div>
                          <div className="position-absolute bottom-0 start-0 end-0 px-2 py-1 d-flex flex-wrap gap-1"
                            style={{ background: "rgba(0,0,0,.55)", backdropFilter: "blur(4px)" }}>
                            {selectedFrame.detections.map((d, j) => (
                              <span key={j} className="badge rounded-pill"
                                style={{ fontSize: ".72rem", background: "rgba(124,58,237,.7)", color: "#fff", textTransform: "capitalize" }}>
                                {d.label?.replace(/_/g, " ")} {d.confidence}%
                              </span>
                            ))}
                          </div>
                        </div>
                      )}

                      {/* frame thumbnail strip */}
                      <div className="d-flex gap-2 overflow-auto pb-1 no-scrollbar">
                        {result.frame_results.map((fr, i) => (
                          <div key={i}
                            onClick={() => setSelectedFrame(fr)}
                            className="flex-shrink-0 rounded-3 overflow-hidden position-relative"
                            style={{
                              width: 120, height: 80, cursor: "pointer",
                              border: selectedFrame?.frame === fr.frame ? `2px solid ${PU}` : "2px solid #e4dcf8",
                              background: "#0a0a0a", transition: "border .2s",
                            }}>
                            {fr.thumbnail ? (
                              <img src={fr.thumbnail} alt={`Frame ${fr.frame}`}
                                style={{ width: "100%", height: "100%", objectFit: "cover" }} />
                            ) : (
                              <div className="w-100 h-100 d-flex align-items-center justify-content-center">
                                <i className="bi bi-film" style={{ color: "#64748b" }} />
                              </div>
                            )}
                            <div className="position-absolute bottom-0 start-0 end-0 text-center"
                              style={{ background: "rgba(0,0,0,.6)", fontSize: ".68rem", color: "#fff", padding: "1px 0" }}>
                              {fr.timestamp}s · {fr.detections.length} {t("ai.obj")}
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* no violations */}
                  {(!result.violations || result.violations.length === 0) && (
                    <div className="d-flex align-items-center gap-2 rounded-3 px-3 py-2 mb-3"
                      style={{ background: "#f0fdf4", color: "#16a34a", fontSize: ".96rem" }}>
                      <i className="bi bi-check-circle-fill" />{t("ai.noViolationsVideo")}
                    </div>
                  )}

                  {/* violation cards */}
                  {result.violations?.length > 0 && (
                    <div className="mb-3">
                      <div className="fw-semibold mb-2" style={{ fontSize: ".9rem", color: "#64748b", textTransform: "uppercase", letterSpacing: ".05em" }}>{t("ai.violations")}</div>
                      <ul className="list-unstyled mb-0 d-flex flex-column gap-2">
                        {result.violations.map((v, i) => {
                          const sevColor = { critical: "#ef4444", high: "#f97316", medium: "#f59e0b", low: "#3b82f6", warning: "#8b5cf6" }[v.severity] ?? "#64748b";
                          const sevBg    = { critical: "#fef2f2", high: "#fff7ed", medium: "#fffbeb", low: "#eff6ff",  warning: "#f5f3ff" }[v.severity] ?? "#f8fafc";
                          return (
                            <li key={v.id ?? i} className="rounded-3 p-2"
                              style={{ background: "#fafbfd", border: "1px solid #e4dcf8" }}>
                              <div className="d-flex align-items-center gap-2 mb-1">
                                <span className="rounded-pill px-2 py-0 fw-bold"
                                  style={{ fontSize: ".75rem", background: sevBg, color: sevColor, border: `1px solid ${sevColor}33`, textTransform: "capitalize" }}>
                                  {v.severity}
                                </span>
                                <span className="fw-semibold" style={{ fontSize: ".94rem", color: "var(--bs-body-color)", textTransform: "capitalize" }}>
                                  {v.type?.replace(/_/g, " ")}
                                </span>
                                <span className="ms-auto badge rounded-pill"
                                  style={{ fontSize: ".78rem", background: "#f3f4f6", color: "#6b7280", textTransform: "capitalize" }}>
                                  {v.status}
                                </span>
                              </div>
                              <div className="d-flex align-items-center gap-3" style={{ fontSize: ".84rem", color: "#64748b" }}>
                                <span><i className="bi bi-geo-alt me-1" />{v.location}</span>
                                {v.fine_amount && <span><i className="bi bi-cash me-1" />${v.fine_amount}</span>}
                              </div>
                            </li>
                          );
                        })}
                      </ul>
                    </div>
                  )}

                  {/* detected objects (aggregated) */}
                  {result.detected_objects?.length > 0 && (
                    <div className="mb-3">
                      <div className="fw-semibold mb-2" style={{ fontSize: ".9rem", color: "#64748b", textTransform: "uppercase", letterSpacing: ".05em" }}>{t("ai.detectedObjects")}</div>
                      <ul className="list-unstyled mb-0 d-flex flex-column gap-1">
                        {result.detected_objects.map((obj, i) => (
                          <li key={i} className="d-flex align-items-center gap-2 py-1"
                            style={{ borderBottom: "1px solid #f0f4f8" }}>
                            <span style={{ fontSize: ".88rem", color: "#334155", textTransform: "capitalize", minWidth: 110 }}>
                              {obj.label?.replace(/_/g, " ")}
                            </span>
                            <div className="flex-fill rounded-pill overflow-hidden" style={{ height: 6, background: "#e4dcf8" }}>
                              <div className="rounded-pill" style={{ height: "100%", width: `${obj.confidence}%`, background: `linear-gradient(90deg,${PU},#a855f7)`, transition: "width .5s" }} />
                            </div>
                            <span style={{ fontSize: ".82rem", color: PU, fontWeight: 600, minWidth: 42, textAlign: "right" }}>{obj.confidence}%</span>
                            {obj.count > 1 && (
                              <span className="badge rounded-pill" style={{ fontSize: ".72rem", background: "#f3f0ff", color: PU }}>×{obj.count}</span>
                            )}
                          </li>
                        ))}
                      </ul>
                    </div>
                  )}
                </>
              )}

            </div>
            </div>
          </div>
        </div>

      </div>

      {/* ══ Bottom: fill space with useful content ══ */}
      <div className="row g-3 mt-3" style={{ margin: 0 }}>
        {/* Recent activity */}
        <div className="col-12 col-lg-6">
          <div className="card border-0 rounded-4 h-100"
            style={{ boxShadow: "0 1px 3px rgba(0,0,0,.06),0 8px 24px rgba(124,58,237,.07)" }}>
            <div className="card-body p-3">
              <div className="d-flex align-items-center gap-2 mb-2">
                <span className="rounded-2 d-flex align-items-center justify-content-center flex-shrink-0"
                  style={{ width: 28, height: 28, background: "#f3f0ff" }}>
                  <i className="bi bi-clock-history" style={{ color: PU, fontSize: "1.05rem" }} />
                </span>
                <div className="fw-bold" style={{ fontSize: "1.05rem" }}>Recent activity</div>
                <button
                  className="btn btn-sm ms-auto rounded-pill px-2 py-0"
                  style={{ fontSize: ".78rem", background: "#f3f0ff", color: PU, border: "none" }}
                  onClick={() => saveRecentRuns([])}
                  disabled={!recentRuns?.length}
                >
                  <i className="bi bi-trash3 me-1" />Clear
                </button>
              </div>

              {recentRuns?.length ? (
                <div className="d-flex flex-column gap-2">
                  {recentRuns.map((r, idx) => (
                    <div key={`${r.ts}-${idx}`} className="d-flex align-items-start gap-2 rounded-3 px-2 py-2"
                      style={{ border: "1px solid #efe9ff", background: "#fff" }}>
                      <div className="flex-shrink-0 mt-1">
                        <span className="badge rounded-pill fw-semibold"
                          style={{
                            fontSize: ".75rem",
                            background: r.ok ? "rgba(22,163,74,.12)" : "rgba(239,68,68,.12)",
                            color: r.ok ? "#16a34a" : "#dc2626",
                            border: `1px solid ${r.ok ? "rgba(22,163,74,.25)" : "rgba(239,68,68,.25)"}`,
                          }}>
                          {r.ok ? "OK" : "ERR"}
                        </span>
                      </div>
                      <div className="flex-fill" style={{ minWidth: 0 }}>
                        <div className="d-flex align-items-center gap-2">
                          <span className="fw-semibold text-truncate" style={{ fontSize: ".92rem" }}>
                            {r.fileName || (r.type === "video" ? "Video upload" : "Image upload")}
                          </span>
                          <span className="text-secondary ms-auto" style={{ fontSize: ".78rem", whiteSpace: "nowrap" }}>
                            {new Date(r.ts).toLocaleString()}
                          </span>
                        </div>
                        <div className="text-secondary" style={{ fontSize: ".82rem" }}>
                          <i className="bi bi-camera-video me-1" />
                          {r.cameraName}
                          {typeof r.objects === "number" && (
                            <span className="ms-2">
                              <i className="bi bi-bounding-box me-1" />
                              {r.objects} objects
                            </span>
                          )}
                          {typeof r.violations === "number" && (
                            <span className="ms-2">
                              <i className="bi bi-exclamation-triangle me-1" />
                              {r.violations} violations
                            </span>
                          )}
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="text-center py-4">
                  <div className="fw-semibold mb-1" style={{ color: "#6b5aa7" }}>No activity yet</div>
                  <div className="text-secondary" style={{ fontSize: ".9rem" }}>
                    Run an analysis and your recent detections will appear here.
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Tips + Status */}
        <div className="col-12 col-lg-6">
          <div className="row g-3" style={{ margin: 0 }}>
            <div className="col-12">
              <div className="card border-0 rounded-4"
                style={{ boxShadow: "0 1px 3px rgba(0,0,0,.06),0 8px 24px rgba(124,58,237,.07)" }}>
                <div className="card-body p-3">
                  <div className="d-flex align-items-center gap-2 mb-2">
                    <span className="rounded-2 d-flex align-items-center justify-content-center flex-shrink-0"
                      style={{ width: 28, height: 28, background: "#f3f0ff" }}>
                      <i className="bi bi-lightbulb" style={{ color: PU, fontSize: "1.05rem" }} />
                    </span>
                    <div className="fw-bold" style={{ fontSize: "1.05rem" }}>Quick tips</div>
                  </div>
                  <ul className="mb-0" style={{ paddingLeft: "1.1rem", color: "#64748b", fontSize: ".92rem" }}>
                    <li>Use clear daylight images for best accuracy (avoid heavy blur).</li>
                    <li>Select a camera to attach location context to the analysis.</li>
                    <li>For plates/violations, upload a close frame where the vehicle is visible.</li>
                  </ul>
                </div>
              </div>
            </div>

            <div className="col-12">
              <div className="card border-0 rounded-4"
                style={{ boxShadow: "0 1px 3px rgba(0,0,0,.06),0 8px 24px rgba(124,58,237,.07)" }}>
                <div className="card-body p-3">
                  <div className="d-flex align-items-center gap-2 mb-2">
                    <span className="rounded-2 d-flex align-items-center justify-content-center flex-shrink-0"
                      style={{ width: 28, height: 28, background: "#f3f0ff" }}>
                      <i className="bi bi-activity" style={{ color: PU, fontSize: "1.05rem" }} />
                    </span>
                    <div className="fw-bold" style={{ fontSize: "1.05rem" }}>System status</div>
                    <span className="ms-auto badge rounded-pill fw-semibold"
                      style={{
                        fontSize: ".78rem",
                        background: loading ? "rgba(245,158,11,.12)" : "rgba(22,163,74,.12)",
                        color: loading ? "#d97706" : "#16a34a",
                        border: `1px solid ${loading ? "rgba(245,158,11,.25)" : "rgba(22,163,74,.25)"}`,
                      }}>
                      {loading ? "Analyzing…" : "Ready"}
                    </span>
                  </div>
                  <div className="d-flex flex-wrap gap-2">
                    <span className="badge rounded-pill fw-semibold"
                      style={{ fontSize: ".78rem", background: "#f3f0ff", color: PU, border: "1px solid #e4dcf8" }}>
                      <i className="bi bi-cpu me-1" />AI Detection
                    </span>
                    <span className="badge rounded-pill fw-semibold"
                      style={{ fontSize: ".78rem", background: "#f3f0ff", color: PU, border: "1px solid #e4dcf8" }}>
                      <i className="bi bi-image me-1" />Images
                    </span>
                    <span className="badge rounded-pill fw-semibold"
                      style={{ fontSize: ".78rem", background: "#f3f0ff", color: PU, border: "1px solid #e4dcf8" }}>
                      <i className="bi bi-camera-video me-1" />Videos
                    </span>
                    <span className="badge rounded-pill fw-semibold"
                      style={{
                        fontSize: ".78rem",
                        background: error ? "rgba(239,68,68,.12)" : "#f0fdf4",
                        color: error ? "#dc2626" : "#16a34a",
                        border: `1px solid ${error ? "rgba(239,68,68,.25)" : "#bbf7d0"}`,
                      }}>
                      <i className={`bi ${error ? "bi-x-circle-fill" : "bi-check-circle-fill"} me-1`} />
                      {error ? "Last run failed" : "Healthy"}
                    </span>
                  </div>
                  <div className="text-secondary mt-2" style={{ fontSize: ".86rem" }}>
                    Your results are kept in this session; use “Recent activity” to revisit what you ran.
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}