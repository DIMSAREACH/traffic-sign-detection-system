import { useEffect, useMemo, useState } from "react";
import { NavLink } from "react-router-dom";
import {
  Chart as ChartJS,
  CategoryScale, LinearScale,
  BarElement, LineElement, PointElement,
  ArcElement,
  Tooltip, Legend, Filler,
} from "chart.js";
import { Bar, Line, Doughnut } from "react-chartjs-2";
import { useAuth, readCachedSidebarSnapshot } from "../context/AuthContext.jsx";
import { useLanguage } from "../i18n/LanguageContext.jsx";
import { hasStoredAuthCredentials } from "../services/api.js";
import { fetchDashboard, fetchMonthly, fetchSystemHealth } from "../services/reportService.js";

ChartJS.register(
  CategoryScale, LinearScale,
  BarElement, LineElement, PointElement,
  ArcElement,
  Tooltip, Legend, Filler,
);

const PU  = "#7c3aed";
const PU2 = "#6d28d9";
const PA  = (a) => `rgba(124,58,237,${a})`;

/** Survives full page refresh; stale-while-revalidate UX (no skeleton flash). */
const DASH_CACHE_KEY = "admin.dashboard.snapshot.v1";

function readDashboardCache() {
  try {
    const raw = sessionStorage.getItem(DASH_CACHE_KEY);
    if (!raw) return null;
    const o = JSON.parse(raw);
    if (!o || typeof o !== "object") return null;
    return {
      data: o.data ?? null,
      monthly: o.monthly ?? null,
      health: o.health ?? null,
    };
  } catch {
    return null;
  }
}

function writeDashboardCache(data, monthly, health) {
  try {
    sessionStorage.setItem(
      DASH_CACHE_KEY,
      JSON.stringify({ data, monthly, health, savedAt: Date.now() })
    );
  } catch {
    /* quota / private mode */
  }
}

/** Empty API shape so failed first-load does not leave skeletons up forever. */
const EMPTY_DASHBOARD = {
  total_violations: 0,
  paid_fines: 0,
  pending_fines: 0,
  overdue_fines: 0,
  active_cameras: 0,
  total_cameras: 0,
  total_collected: 0,
  prev_total_violations: 0,
  prev_paid_fines: 0,
  prev_pending_fines: 0,
  violations_by_type: [],
  violations_by_location: [],
  violations_by_severity: [],
  status_counts: {},
  daily_trend: [],
  weekly_accuracy: [],
};

const CHART_COLORS = [
  "rgba(124,58,237,.65)",  // purple
  "rgba(59,130,246,.65)",  // blue
  "rgba(14,165,233,.65)",  // cyan
  "rgba(34,197,94,.65)",   // green
  "rgba(245,158,11,.65)",  // amber
  "rgba(239,68,68,.65)",   // red
  "rgba(168,85,247,.65)",  // violet
  "rgba(236,72,153,.65)",  // pink
  "rgba(99,102,241,.65)",  // indigo
  "rgba(20,184,166,.65)",  // teal
];

/* ── Read settings helper ── */
const getSetting = (k, def) => { try { return JSON.parse(localStorage.getItem(k)) ?? def; } catch { return def; } };

/** Admin dashboard hero fallback when first name / email are missing (never use "Officer" here). */
function honorificFromRole(role) {
  const r = String(role || "").trim().toLowerCase();
  if (r === "admin") return "Admin";
  if (r === "officer") return "Officer";
  if (r === "driver") return "Driver";
  return "Admin";
}

/* ── Stat Card ─────────────────────────────────────────────────── */
function StatCard({ icon, label, value, sub, color, bg }) {
  return (
    <div className="col-6 col-xl-3">
      <div className="card border-0 h-100 rounded-4"
        style={{ boxShadow: "0 2px 12px rgba(124,58,237,.08)", background: "var(--bs-body-bg)" }}>
        <div className="card-body p-3 d-flex flex-column gap-2">
          <div className="d-flex align-items-center justify-content-between">
            <span className="rounded-3 d-flex align-items-center justify-content-center"
              style={{ width: 48, height: 48, background: bg }}>
              <i className={`bi ${icon}`} style={{ color, fontSize: "1.45rem" }} />
            </span>
            {sub && (
              <span className="badge rounded-pill fw-semibold"
                style={{ fontSize: ".8rem",
                  background: sub.up === null ? "rgba(59,130,246,.1)" : sub.up ? "rgba(22,163,74,.1)" : "rgba(239,68,68,.1)",
                  color: sub.up === null ? "#3b82f6" : sub.up ? "#16a34a" : "#dc2626" }}>
                {sub.up !== null && <i className={`bi bi-arrow-${sub.up ? "up" : "down"}-short`} />}{sub.text}
              </span>
            )}
          </div>
          <div>
            <div className="fw-bold" style={{ fontSize: "2.2rem", color: "var(--bs-body-color)", lineHeight: 1 }}>
              {value ?? <span className="placeholder col-4 rounded" />}
            </div>
            <div className="text-secondary mt-1" style={{ fontSize: "1rem" }}>{label}</div>
          </div>
        </div>
      </div>
    </div>
  );
}

/* ── Quick Action Button ───────────────────────────────────────── */
function QAction({ icon, label, to, color, bg }) {
  return (
    <NavLink to={to} className="text-decoration-none">
      <div className="d-flex flex-column align-items-center justify-content-center gap-2 rounded-4 p-3"
        style={{ background: bg, cursor: "pointer", transition: "transform .15s, opacity .15s" }}
        onMouseOver={(e) => e.currentTarget.style.opacity = ".85"}
        onMouseOut={(e)  => e.currentTarget.style.opacity = "1"}>
        <div className="rounded-3 d-flex align-items-center justify-content-center"
          style={{ width: 44, height: 44, background: "#fff" }}>
          <i className={`bi ${icon}`} style={{ color, fontSize: "1.3rem" }} />
        </div>
        <span className="fw-semibold text-center" style={{ fontSize: "1rem", color: "var(--bs-body-color)" }}>{label}</span>
      </div>
    </NavLink>
  );
}

/* ── Main ──────────────────────────────────────────────────────── */
export default function Dashboard() {
  const snap = useMemo(() => readDashboardCache(), []);
  const { user }         = useAuth();
  const { t }            = useLanguage();
  const [data,    setData]    = useState(snap?.data ?? null);
  const [monthly, setMonthly] = useState(snap?.monthly ?? null);
  const [health,  setHealth]  = useState(snap?.health ?? null);

  /* ── Settings-driven state ── */
  const [showStats,    setShowStats]    = useState(() => getSetting("settings.showStats", true));
  const [chartAnimate, setChartAnimate] = useState(() => getSetting("settings.chartAnimate", true));
  const [autoRefresh,  setAutoRefresh]  = useState(() => getSetting("settings.autoRefresh", "30"));

  /* ── Listen for settings changes ── */
  useEffect(() => {
    const handler = (e) => {
      const { key, value } = e.detail || {};
      if (key === "showStats")    setShowStats(value);
      if (key === "chartAnimate") setChartAnimate(value);
      if (key === "autoRefresh")  setAutoRefresh(String(value));
    };
    window.addEventListener("settings-change", handler);
    return () => window.removeEventListener("settings-change", handler);
  }, []);

  /* ── Fetch data ── */
  const loadData = () => {
    Promise.all([
      fetchDashboard().catch(() => null),
      fetchMonthly().catch(() => null),
      fetchSystemHealth().catch(() => null),
    ]).then(([d, m, h]) => {
      if (d != null) {
        setData(d);
        setMonthly(m);
        setHealth(h);
        writeDashboardCache(d, m, h);
      } else {
        setData((prev) => prev ?? EMPTY_DASHBOARD);
        setMonthly((prev) => (prev != null ? prev : []));
      }
    });
  };

  useEffect(() => { loadData(); }, []);

  /* ── Auto-refresh interval ── */
  useEffect(() => {
    const sec = parseInt(autoRefresh, 10);
    if (!sec || sec <= 0) return;
    const id = setInterval(loadData, sec * 1000);
    return () => clearInterval(id);
  }, [autoRefresh]);

  const sidebarSnap = readCachedSidebarSnapshot();
  const sidebarName = sidebarSnap?.displayName?.trim() || "";
  const sessionPending = !user && hasStoredAuthCredentials();

  const displayName = user?.first_name
    ? `${user.first_name} ${user.last_name || ""}`.trim()
    : user
      ? (user?.username || user?.email?.split("@")[0] || honorificFromRole(user?.role))
      : sessionPending && sidebarName
        ? sidebarName
        : sessionPending
          ? "…"
          : honorificFromRole(sidebarSnap?.roleKey);

  const hour = new Date().getHours();
  const greeting = hour < 12 ? t("dash.goodMorning") : hour < 18 ? t("dash.goodAfternoon") : t("dash.goodEvening");

  /* Short chart motion — default Chart.js ~1s feels like “still loading” after refresh */
  const chartMotion = chartAnimate ? { duration: 220, easing: "easeOutQuad" } : false;

  /* charts */
  const typeColors = (data?.violations_by_type || []).map((_, i) => CHART_COLORS[i % CHART_COLORS.length]);
  const barData = {
    labels: data?.violations_by_type?.map((i) => i.violation_type.replace(/_/g, " ")) ?? [],
    datasets: [{
      label: "Count",
      data: data?.violations_by_type?.map((i) => i.count) ?? [],
      backgroundColor: typeColors.length ? typeColors : PA(".15"),
      // Keep bars clean (no heavy outlines)
      borderColor: "transparent",
      borderWidth: 0,
      hoverBorderWidth: 0,
      borderRadius: 8,
      borderSkipped: false,
    }],
  };
  const barOpts = {
    responsive: true, maintainAspectRatio: false,
    animation: chartMotion,
    plugins: { legend: { display: false } },
    scales: {
      x: { grid: { display: false }, ticks: { font: { size: 13 } } },
      y: { grid: { color: "rgba(0,0,0,.04)" }, ticks: { font: { size: 13 } } },
    },
  };

  const fmtM = (m) => { const d = new Date(m); return isNaN(d) ? m : d.toLocaleString("default", { month: "short" }); };
  const lineData = {
    labels: monthly?.map((i) => fmtM(i.month)) ?? ["Jan","Feb","Mar","Apr","May","Jun"],
    datasets: [{
      label: "Violations",
      data: monthly?.map((i) => i.count) ?? [0,0,0,0,0,0],
      fill: true, tension: 0.4,
      borderColor: PU, borderWidth: 2,
      backgroundColor: PA(".07"),
      pointBackgroundColor: PU, pointRadius: 3,
    }],
  };
  const lineOpts = {
    responsive: true, maintainAspectRatio: false,
    animation: chartMotion,
    plugins: { legend: { display: false } },
    scales: {
      x: { grid: { display: false }, ticks: { font: { size: 13 } } },
      y: { grid: { color: "rgba(0,0,0,.04)" }, ticks: { font: { size: 13 } } },
    },
  };

  /* ── Extra charts ── */
  const doughnutData = {
    labels: [t("common.paid"), t("common.pending"), t("common.overdue")],
    datasets: [{
      data: [data?.paid_fines ?? 0, data?.pending_fines ?? 0, data?.overdue_fines ?? 0],
      backgroundColor: ["rgba(22,163,74,.8)", "rgba(245,158,11,.8)", "rgba(239,68,68,.8)"],
      borderColor: ["#fff", "#fff", "#fff"],
      borderWidth: 3,
      hoverOffset: 10,
    }],
  };
  const doughnutOpts = {
    responsive: true, maintainAspectRatio: false,
    animation: chartMotion,
    plugins: {
      legend: { position: "bottom", labels: { font: { size: 13 }, padding: 14, boxWidth: 16 } },
    },
    cutout: "62%",
  };

  const severityData = {
    labels: [t("viol.critical"), t("viol.high"), t("viol.medium"), t("viol.low"), t("viol.warning")],
    datasets: [{
      label: "Count",
      data: data?.violations_by_severity?.map((i) => i.count) ?? [],
      backgroundColor: [
        "rgba(239,68,68,.8)", "rgba(245,158,11,.8)",
        PA(".7"), "rgba(59,130,246,.8)", "rgba(22,163,74,.8)",
      ],
      borderRadius: 6,
      borderSkipped: false,
    }],
  };
  const severityOpts = {
    indexAxis: "y",
    responsive: true, maintainAspectRatio: false,
    animation: chartMotion,
    plugins: { legend: { display: false } },
    scales: {
      x: { grid: { color: "rgba(0,0,0,.04)" }, ticks: { font: { size: 13 } } },
      y: { grid: { display: false }, ticks: { font: { size: 13 } } },
    },
  };

  const accuracyData = {
    labels: ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"],
    datasets: [{
      label: "Accuracy %",
      data: data?.weekly_accuracy ?? [],
      fill: true, tension: 0.4,
      borderColor: "#3b82f6", borderWidth: 2,
      backgroundColor: "rgba(59,130,246,.07)",
      pointBackgroundColor: "#3b82f6", pointRadius: 3,
    }],
  };
  const accuracyOpts = {
    responsive: true, maintainAspectRatio: false,
    spanGaps: true,
    animation: chartMotion,
    plugins: { legend: { display: false } },
    scales: {
      x: { grid: { display: false }, ticks: { font: { size: 10 } } },
      y: {
        min: 0, max: 100,
        grid: { color: "rgba(0,0,0,.04)" },
        ticks: { font: { size: 13 }, callback: (v) => v + "%" },
      },
    },
  };

  /* ── Percentage change helper ── */
  const pctChange = (cur, prev) => {
    if (cur == null) return null;
    if (prev == null || prev === 0) return cur > 0 ? { text: "New", up: null } : null;
    const diff = ((cur - prev) / prev) * 100;
    if (Math.abs(diff) < 0.5) return null; // no meaningful change
    return { text: `${Math.abs(diff).toFixed(0)}%`, up: diff > 0 };
  };

  const violChange   = data ? pctChange(data.total_violations, data.prev_total_violations) : null;
  const paidChange   = data ? pctChange(data.paid_fines,       data.prev_paid_fines)       : null;
  const pendChange   = data ? pctChange(data.pending_fines,    data.prev_pending_fines)    : null;
  const camPct       = data?.total_cameras > 0 ? Math.round((data.active_cameras / data.total_cameras) * 100) : null;
  const camChange    = camPct != null ? { text: `${camPct}%`, up: camPct >= 80 } : null;

  const showPlaceholders = data == null;

  const CARDS = [
    { icon: "bi-exclamation-triangle-fill", label: t("dash.totalViolations"), value: data?.total_violations, color: PU,        bg: PA(".1"),              sub: violChange ? { text: violChange.text, up: violChange.up } : null },
    { icon: "bi-check-circle-fill",         label: t("dash.paidFines"),       value: data?.paid_fines,       color: "#16a34a", bg: "rgba(22,163,74,.1)",  sub: paidChange ? { text: paidChange.text, up: paidChange.up } : null },
    { icon: "bi-clock-fill",                label: t("dash.pendingFines"),    value: data?.pending_fines,    color: "#f59e0b", bg: "rgba(245,158,11,.1)", sub: pendChange ? { text: pendChange.text, up: pendChange.up === null ? null : !pendChange.up } : null },
    { icon: "bi-camera-video-fill",         label: t("dash.activeCameras"),   value: data?.active_cameras ?? "—", color: "#3b82f6", bg: "rgba(59,130,246,.1)", sub: camChange },
  ];

  return (
    <div className="d-flex flex-column gap-3 p-3" style={{ flex: 1, minHeight: 0, overflow: "hidden" }}>

      {/* ── Welcome banner ── */}
      <div className="rounded-4 d-flex align-items-center justify-content-between px-4 py-3 flex-shrink-0"
        style={{ background: `linear-gradient(135deg, ${PU} 0%, #4c1d95 100%)`,
          boxShadow: "0 4px 20px rgba(124,58,237,.35)" }}>
        <div>
          <div className="fw-bold text-white" style={{ fontSize: "1.55rem" }}>
            {greeting}, {displayName} 👋
          </div>
          <div style={{ fontSize: "1.05rem", color: "rgba(255,255,255,.65)", marginTop: ".15rem" }}>
            {t("dash.welcome")}
          </div>
        </div>
        <div className="d-flex align-items-center gap-2 d-none d-md-flex">
          <div className="rounded-3 d-flex align-items-center justify-content-center"
            style={{ width: 44, height: 44, background: "rgba(255,255,255,.12)" }}>
            <i className="bi bi-camera-video-fill text-white" style={{ fontSize: "1.2rem" }} />
          </div>
          <div className="rounded-3 d-flex align-items-center justify-content-center"
            style={{ width: 44, height: 44, background: "rgba(255,255,255,.12)" }}>
            <i className="bi bi-shield-check text-white" style={{ fontSize: "1.2rem" }} />
          </div>
          <div className="rounded-3 d-flex align-items-center justify-content-center"
            style={{ width: 44, height: 44, background: "rgba(255,255,255,.12)" }}>
            <i className="bi bi-cpu-fill text-white" style={{ fontSize: "1.2rem" }} />
          </div>
        </div>
      </div>

      {/* ── Stat cards ── */}
      {showStats && (
      <div className="row g-3 flex-shrink-0">
        {showPlaceholders
          ? [1,2,3,4].map((k) => (
              <div key={k} className="col-6 col-xl-3">
                <div className="card border-0 rounded-4 placeholder-glow p-3" style={{ height: 96 }}>
                  <span className="placeholder rounded col-8 mb-2" style={{ height: 12 }} />
                  <span className="placeholder rounded col-5" style={{ height: 28 }} />
                </div>
              </div>
            ))
          : CARDS.map((c) => <StatCard key={c.label} {...c} />)
        }
      </div>
      )}

      {/* ── Charts + sidebar ── */}
      <div className="flex-fill overflow-auto no-scrollbar" style={{ minHeight: 0 }}>
      <div className="row g-3 mb-3">

        {/* Bar chart */}
        <div className="col-lg-5 d-flex flex-column" style={{ minHeight: 0 }}>
          <div className="card border-0 rounded-4 flex-fill" style={{ minHeight: 0, overflow: "hidden",
            boxShadow: "0 2px 12px rgba(124,58,237,.07)" }}>
            <div className="card-body p-3 d-flex flex-column" style={{ minHeight: 0 }}>
              <div className="d-flex align-items-center justify-content-between mb-2 flex-shrink-0">
                <div>
                  <div className="fw-bold" style={{ fontSize: "1.2rem", color: "var(--bs-body-color)" }}>{t("dash.byType")}</div>
                  <div className="text-secondary" style={{ fontSize: ".95rem" }}>{t("dash.categoryBreak")}</div>
                </div>
                <span className="badge rounded-pill fw-semibold"
                  style={{ fontSize: ".8rem", background: PA(".1"), color: PU }}>
                  {data?.violations_by_type?.length ?? 0} {t("common.types")}
                </span>
              </div>
              <div className="flex-fill" style={{ minHeight: 0 }}>
                {showPlaceholders
                  ? <div className="placeholder-glow h-100"><span className="placeholder rounded w-100 h-100" /></div>
                  : <Bar data={barData} options={barOpts} />}
              </div>
            </div>
          </div>
        </div>

        {/* Line chart */}
        <div className="col-lg-4 d-flex flex-column" style={{ minHeight: 0 }}>
          <div className="card border-0 rounded-4 flex-fill" style={{ minHeight: 0, overflow: "hidden",
            boxShadow: "0 2px 12px rgba(124,58,237,.07)" }}>
            <div className="card-body p-3 d-flex flex-column" style={{ minHeight: 0 }}>
              <div className="mb-2 flex-shrink-0">
                <div className="fw-bold" style={{ fontSize: "1.2rem", color: "var(--bs-body-color)" }}>{t("dash.monthlyTrend")}</div>
                <div className="text-secondary" style={{ fontSize: ".95rem" }}>{t("dash.overTime")}</div>
              </div>
              <div className="flex-fill" style={{ minHeight: 0 }}>
                {showPlaceholders
                  ? <div className="placeholder-glow h-100"><span className="placeholder rounded w-100 h-100" /></div>
                  : <Line data={lineData} options={lineOpts} />}
              </div>
            </div>
          </div>
        </div>

        {/* Right column: status + quick actions */}
        <div className="col-lg-3 d-flex flex-column gap-3">

          {/* System Status */}
          <div className="card border-0 rounded-4 flex-shrink-0"
            style={{ boxShadow: "0 2px 12px rgba(124,58,237,.07)" }}>
            <div className="card-body p-3">
              <div className="d-flex align-items-center justify-content-between mb-2">
                <span className="fw-bold" style={{ fontSize: "1.15rem", color: "var(--bs-body-color)" }}>{t("dash.systemStatus")}</span>
                {health ? (
                  <span className="badge rounded-pill"
                    style={{ fontSize: ".78rem",
                      background: health.status === "healthy" ? "rgba(22,163,74,.1)" : "rgba(239,68,68,.1)",
                      color: health.status === "healthy" ? "#16a34a" : "#dc2626", fontWeight: 600 }}>
                    <i className="bi bi-circle-fill me-1" style={{ fontSize: ".4rem" }} />
                    {health.status === "healthy" ? t("dash.live") : t("dash.degraded")}
                  </span>
                ) : (
                  <span className="badge rounded-pill placeholder-glow"
                    style={{ fontSize: ".78rem", background: "var(--bs-secondary-bg)" }}>
                    <span className="placeholder rounded col-6" />
                  </span>
                )}
              </div>
              {[
                { key: "ai_engine",      label: t("dash.aiEngine") },
                { key: "camera_network", label: t("dash.cameraNetwork") },
                { key: "database",       label: t("dash.database") },
                { key: "alert_system",   label: t("dash.alertSystem") },
              ].map(({ key, label }) => {
                const ok = health?.services?.[key];
                const unknown = !health;
                return (
                  <div key={key} className="d-flex align-items-center justify-content-between py-1"
                    style={{ borderBottom: "1px solid var(--bs-border-color)", fontSize: "1rem" }}>
                    <span className="text-secondary">{label}</span>
                    {unknown ? (
                      <span className="placeholder rounded" style={{ width: 40, height: 14 }} />
                    ) : (
                      <span className="badge rounded-pill"
                        style={{ fontSize: ".75rem", fontWeight: 600,
                          background: ok ? "rgba(22,163,74,.1)" : "rgba(239,68,68,.1)",
                          color: ok ? "#16a34a" : "#ef4444" }}>
                        {ok ? t("dash.ok") : t("dash.down")}
                      </span>
                    )}
                  </div>
                );
              })}
            </div>
          </div>

          {/* Quick Actions */}
          <div className="card border-0 rounded-4 flex-fill"
            style={{ boxShadow: "0 2px 12px rgba(124,58,237,.07)", overflow: "hidden" }}>
            <div className="card-body p-3 d-flex flex-column" style={{ minHeight: 0 }}>
              <div className="fw-bold mb-2 flex-shrink-0" style={{ fontSize: "1.15rem", color: "var(--bs-body-color)" }}>{t("dash.quickActions")}</div>
              <div className="row g-2">
                {[
                  { icon: "bi-cpu",               label: t("nav.aiDetection"), to: "/admin/ai-upload",  color: PU,        bg: PA(".08") },
                  { icon: "bi-exclamation-circle", label: t("nav.violations"), to: "/admin/violations", color: "#f59e0b", bg: "rgba(245,158,11,.08)" },
                  { icon: "bi-receipt",            label: t("nav.fines"),      to: "/admin/fines",      color: "#3b82f6", bg: "rgba(59,130,246,.08)" },
                  { icon: "bi-bar-chart-line",     label: t("nav.reports"),    to: "/admin/reports",    color: "#16a34a", bg: "rgba(22,163,74,.08)" },
                ].map((q) => (
                  <div key={q.label} className="col-6"><QAction {...q} /></div>
                ))}
              </div>
            </div>
          </div>

        </div>
      </div>

      {/* ── Second row: Doughnut + Severity bar + Accuracy line ── */}
      <div className="row g-3">

        {/* Fine Status Doughnut */}
        <div className="col-lg-4 d-flex flex-column">
          <div className="card border-0 rounded-4 flex-fill"
            style={{ boxShadow: "0 2px 12px rgba(124,58,237,.07)" }}>
            <div className="card-body p-3 d-flex flex-column" style={{ minHeight: 200 }}>
              <div className="mb-2 flex-shrink-0">
                <div className="fw-bold" style={{ fontSize: "1.2rem", color: "var(--bs-body-color)" }}>{t("dash.fineStatus")}</div>
                <div className="text-secondary" style={{ fontSize: ".95rem" }}>{t("dash.paidVsPending")}</div>
              </div>
              <div className="flex-fill d-flex align-items-center justify-content-center" style={{ minHeight: 170 }}>
                {showPlaceholders
                  ? <div className="placeholder-glow w-100 h-100"><span className="placeholder rounded w-100 h-100" /></div>
                  : <Doughnut data={doughnutData} options={doughnutOpts} />}
              </div>
            </div>
          </div>
        </div>

        {/* Violations by Severity horizontal bar */}
        <div className="col-lg-4 d-flex flex-column">
          <div className="card border-0 rounded-4 flex-fill"
            style={{ boxShadow: "0 2px 12px rgba(124,58,237,.07)" }}>
            <div className="card-body p-3 d-flex flex-column" style={{ minHeight: 200 }}>
              <div className="d-flex align-items-center justify-content-between mb-2 flex-shrink-0">
                <div>
                  <div className="fw-bold" style={{ fontSize: "1.2rem", color: "var(--bs-body-color)" }}>{t("dash.bySeverity")}</div>
                  <div className="text-secondary" style={{ fontSize: ".95rem" }}>{t("dash.severitySub")}</div>
                </div>
                <span className="badge rounded-pill fw-semibold"
                  style={{ fontSize: ".8rem", background: "rgba(239,68,68,.1)", color: "#dc2626" }}>
                  <i className="bi bi-exclamation-triangle me-1" />Risk
                </span>
              </div>
              <div className="flex-fill" style={{ minHeight: 170 }}>
                {showPlaceholders
                  ? <div className="placeholder-glow h-100"><span className="placeholder rounded w-100 h-100" /></div>
                  : <Bar data={severityData} options={severityOpts} />}
              </div>
            </div>
          </div>
        </div>

        {/* Weekly Detection Accuracy line */}
        <div className="col-lg-4 d-flex flex-column">
          <div className="card border-0 rounded-4 flex-fill"
            style={{ boxShadow: "0 2px 12px rgba(124,58,237,.07)" }}>
            <div className="card-body p-3 d-flex flex-column" style={{ minHeight: 200 }}>
              <div className="d-flex align-items-center justify-content-between mb-2 flex-shrink-0">
                <div>
                  <div className="fw-bold" style={{ fontSize: "1.2rem", color: "var(--bs-body-color)" }}>{t("dash.aiAccuracy")}</div>
                  <div className="text-secondary" style={{ fontSize: ".95rem" }}>{t("dash.weeklyPerf")}</div>
                </div>
                <span className="badge rounded-pill fw-semibold"
                  style={{ fontSize: ".8rem", background: "rgba(59,130,246,.1)", color: "#3b82f6" }}>
                  <i className="bi bi-cpu me-1" />AI
                </span>
              </div>
              <div className="flex-fill" style={{ minHeight: 170 }}>
                {showPlaceholders
                  ? <div className="placeholder-glow h-100"><span className="placeholder rounded w-100 h-100" /></div>
                  : <Line data={accuracyData} options={accuracyOpts} />}
              </div>
            </div>
          </div>
        </div>

      </div>
      </div>{/* end scrollable charts wrapper */}

    </div>
  );
}
