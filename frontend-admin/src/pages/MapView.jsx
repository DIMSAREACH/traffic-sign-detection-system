import { useCallback, useEffect, useRef, useState } from "react";
import { useLanguage } from "../i18n/LanguageContext.jsx";
import { listCameras } from "../services/cameraService.js";
import { useToast } from "../components/ui/ToastProvider.jsx";

const PU = "#7c3aed";
const PA = (a) => `rgba(124,58,237,${a})`;

/* Default center: Phnom Penh */
const DEFAULT_CENTER = [11.5564, 104.9282];
const DEFAULT_ZOOM = 13;

export default function MapView() {
  const { t } = useLanguage();
  const { push: pushToast } = useToast();
  const mapRef = useRef(null);
  const mapInstance = useRef(null);
  const markersRef = useRef([]);

  const [cameras, setCameras] = useState([]);
  const [loading, setLoading] = useState(true);
  const [leafletReady, setLeafletReady] = useState(false);
  const [selected, setSelected] = useState(null);
  const [error, setError] = useState("");

  const invalidateMapSize = useCallback(() => {
    const map = mapInstance.current;
    if (!map) return;
    // Leaflet needs a tick after DOM/layout changes.
    window.setTimeout(() => {
      try {
        map.invalidateSize({ pan: false, debounceMoveend: true });
      } catch {
        // ignore
      }
    }, 50);
  }, []);

  /* Load Leaflet CSS + JS dynamically */
  useEffect(() => {
    if (window.L) { setLeafletReady(true); return; }
    const css = document.createElement("link");
    css.rel = "stylesheet";
    css.href = "https://unpkg.com/leaflet@1.9.4/dist/leaflet.css";
    css.integrity = "sha256-p4NxAoJBhIIN+hmNHrzRCf9tD/miZyoHS5obTRR9BMY=";
    css.crossOrigin = "";
    document.head.appendChild(css);

    const js = document.createElement("script");
    js.src = "https://unpkg.com/leaflet@1.9.4/dist/leaflet.js";
    js.integrity = "sha256-20nQCchB9co0qIjJZRGuk2/Z9VM+kNiyxNV1lvTlZBo=";
    js.crossOrigin = "";
    js.onload = () => setLeafletReady(true);
    document.head.appendChild(js);

    return () => {
      document.head.removeChild(css);
      document.head.removeChild(js);
    };
  }, []);

  /* Load cameras */
  useEffect(() => {
    setLoading(true);
    setError("");
    listCameras({ page_size: 200 })
      .then((d) => setCameras(d.results ?? d ?? []))
      .catch((err) => {
        const msg =
          err?.response?.data?.detail ||
          err?.message ||
          "Failed to load cameras.";
        setError(msg);
        pushToast?.({ variant: "danger", title: "Map", message: msg });
        setCameras([]);
      })
      .finally(() => setLoading(false));
  }, []);

  /* Initialize map */
  useEffect(() => {
    if (!leafletReady || !mapRef.current || mapInstance.current) return;
    const L = window.L;
    const map = L.map(mapRef.current).setView(DEFAULT_CENTER, DEFAULT_ZOOM);
    L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
      attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors',
      maxZoom: 19,
    }).addTo(map);
    mapInstance.current = map;
    invalidateMapSize();

    return () => {
      map.remove();
      mapInstance.current = null;
    };
  }, [leafletReady, invalidateMapSize]);

  /* Place camera markers */
  useEffect(() => {
    if (!mapInstance.current || !leafletReady) return;
    const L = window.L;
    const map = mapInstance.current;

    // Clear old markers
    markersRef.current.forEach((m) => map.removeLayer(m));
    markersRef.current = [];

    const withCoords = cameras.filter((c) => c.latitude && c.longitude);
    withCoords.forEach((cam) => {
      const icon = L.divIcon({
        className: "",
        html: `<div style="
          background:${cam.active ? PU : "#94a3b8"};
          width:32px;height:32px;border-radius:50%;
          display:flex;align-items:center;justify-content:center;
          box-shadow:0 2px 8px rgba(0,0,0,.25);border:2px solid #fff;
        "><i class="bi bi-camera-video-fill" style="color:#fff;font-size:14px"></i></div>`,
        iconSize: [32, 32],
        iconAnchor: [16, 16],
      });
      const marker = L.marker([cam.latitude, cam.longitude], { icon })
        .addTo(map)
        .on("click", () => setSelected(cam));
      marker.bindTooltip(cam.name, { direction: "top", offset: [0, -18] });
      markersRef.current.push(marker);
    });

    // Fit bounds if there are markers
    if (withCoords.length > 1) {
      const bounds = L.latLngBounds(withCoords.map((c) => [c.latitude, c.longitude]));
      map.fitBounds(bounds, { padding: [50, 50] });
    } else if (withCoords.length === 1) {
      map.setView([withCoords[0].latitude, withCoords[0].longitude], 15);
    }
    invalidateMapSize();
  }, [cameras, leafletReady]);

  // Keep Leaflet tiles aligned on viewport/layout changes.
  useEffect(() => {
    const onResize = () => invalidateMapSize();
    window.addEventListener("resize", onResize);
    return () => window.removeEventListener("resize", onResize);
  }, [invalidateMapSize]);

  const activeCams = cameras.filter((c) => c.active).length;
  const locatedCams = cameras.filter((c) => c.latitude && c.longitude).length;

  return (
    <div className="d-flex flex-column gap-3 p-3" style={{ flex: 1, minHeight: 0, overflow: "hidden" }}>

      {/* Header */}
      <div className="d-flex align-items-center justify-content-between flex-shrink-0">
        <div>
          <h5 className="fw-bold mb-0" style={{ color: "var(--bs-body-color)", fontSize: "1.5rem" }}>
            <i className="bi bi-geo-alt-fill me-2" style={{ color: PU }} />
            {t("map.title")}
          </h5>
          <p className="mb-0 text-secondary" style={{ fontSize: "1rem" }}>{t("map.subtitle")}</p>
        </div>
      </div>

      {/* Stats */}
      <div className="row g-3 flex-shrink-0">
        {[
          { label: t("map.totalCameras"),  value: cameras.length, icon: "bi-camera-video-fill", color: PU,        bg: PA(".1") },
          { label: t("map.activeCameras"), value: activeCams,     icon: "bi-check-circle-fill",  color: "#16a34a", bg: "rgba(22,163,74,.1)" },
          { label: t("map.locatedCameras"),value: locatedCams,    icon: "bi-geo-alt-fill",       color: "#3b82f6", bg: "rgba(59,130,246,.1)" },
        ].map(({ label, value, icon, color, bg }) => (
          <div key={label} className="col-6 col-md-4">
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

      {/* Map */}
      <div className="card border-0 rounded-4 d-flex flex-column flex-fill"
        style={{ minHeight: 0, overflow: "hidden", boxShadow: "0 2px 16px rgba(124,58,237,.09)" }}>
        <div className="flex-fill position-relative" style={{ minHeight: 400 }}>
          {loading && (
            <div className="position-absolute top-0 start-0 w-100 h-100 d-flex align-items-center justify-content-center"
              style={{ zIndex: 500, background: "var(--bs-body-bg)", opacity: .85 }}>
              <div className="spinner-border" style={{ color: PU, width: 48, height: 48 }} />
            </div>
          )}
          {!loading && error && (
            <div className="position-absolute top-0 start-0 w-100 h-100 d-flex align-items-center justify-content-center p-3"
              style={{ zIndex: 400, background: "var(--bs-body-bg)", opacity: .95 }}>
              <div className="text-center" style={{ maxWidth: 420 }}>
                <div className="rounded-circle d-inline-flex align-items-center justify-content-center mb-3"
                  style={{ width: 54, height: 54, background: PA(".12") }}>
                  <i className="bi bi-exclamation-triangle-fill" style={{ color: PU, fontSize: "1.35rem" }} />
                </div>
                <div className="fw-bold mb-1" style={{ fontSize: "1.05rem" }}>Unable to load cameras</div>
                <div className="text-secondary" style={{ fontSize: ".95rem" }}>{error}</div>
              </div>
            </div>
          )}
          <div ref={mapRef} style={{ width: "100%", height: "100%", borderRadius: "1rem" }} />
        </div>
      </div>

      {/* Camera info panel */}
      {selected && (
        <div className="position-fixed top-0 start-0 w-100 h-100 d-flex align-items-center justify-content-center"
          style={{ zIndex: 1060, background: "rgba(30,20,60,.45)", backdropFilter: "blur(4px)" }}
          onClick={() => setSelected(null)}>
          <div className="card border-0 rounded-4 shadow-lg position-relative"
            style={{ width: "95%", maxWidth: 440, animation: "fadeIn .18s ease" }}
            onClick={(e) => e.stopPropagation()}>
            <button className="btn btn-sm position-absolute"
              style={{ top: 14, right: 14, zIndex: 10, background: PA(".08"), border: "none", borderRadius: "50%", width: 36, height: 36 }}
              onClick={() => setSelected(null)}>
              <i className="bi bi-x-lg" style={{ color: PU, fontSize: "1.1rem" }} />
            </button>
            <div className="card-body py-4 px-4">
              <h6 className="fw-bold d-flex align-items-center gap-2 mb-3" style={{ color: "var(--bs-body-color)", fontSize: "1.2rem" }}>
                <div className="rounded-3 d-flex align-items-center justify-content-center flex-shrink-0"
                  style={{ width: 40, height: 40, background: PA(".1") }}>
                  <i className="bi bi-camera-video-fill" style={{ color: PU, fontSize: "1.1rem" }} />
                </div>
                {selected.name}
              </h6>
              <div className="d-flex flex-column gap-2">
                <div className="d-flex align-items-center gap-2">
                  <i className="bi bi-geo-alt" style={{ color: PU }} />
                  <span className="text-secondary fw-semibold" style={{ minWidth: 80 }}>{t("map.location")}</span>
                  <span>{selected.location || "—"}</span>
                </div>
                <div className="d-flex align-items-center gap-2">
                  <i className="bi bi-wifi" style={{ color: PU }} />
                  <span className="text-secondary fw-semibold" style={{ minWidth: 80 }}>{t("map.ipAddress")}</span>
                  <span>{selected.ip_address || "—"}</span>
                </div>
                <div className="d-flex align-items-center gap-2">
                  <i className="bi bi-circle-fill" style={{ color: selected.active ? "#16a34a" : "#94a3b8", fontSize: ".7rem" }} />
                  <span className="text-secondary fw-semibold" style={{ minWidth: 80 }}>{t("map.status")}</span>
                  <span className="fw-semibold" style={{ color: selected.active ? "#16a34a" : "#94a3b8" }}>
                    {selected.active ? t("map.active") : t("map.inactive")}
                  </span>
                </div>
                {selected.latitude && selected.longitude && (
                  <div className="d-flex align-items-center gap-2">
                    <i className="bi bi-pin-map" style={{ color: PU }} />
                    <span className="text-secondary fw-semibold" style={{ minWidth: 80 }}>{t("map.coords")}</span>
                    <span>{selected.latitude.toFixed(5)}, {selected.longitude.toFixed(5)}</span>
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
