import {
  ArcElement,
  BarElement,
  CategoryScale,
  Chart as ChartJS,
  Filler,
  Legend,
  LinearScale,
  LineElement,
  PointElement,
  Tooltip,
} from "chart.js";
import { useEffect, useRef, useState } from "react";
import { Bar, Doughnut, Line } from "react-chartjs-2";
import { downloadCSV, downloadPDF, fetchDashboard, fetchMonthly } from "../services/reportService.js";
import { useLanguage } from "../i18n/LanguageContext.jsx";

ChartJS.register(
  CategoryScale, LinearScale,
  BarElement, ArcElement,
  PointElement, LineElement,
  Filler, Tooltip, Legend
);

const PU   = "#7c3aed";
const PA   = (a) => `rgba(124,58,237,${a})`;
const GRID = "rgba(128,128,128,0.08)";

const today     = () => new Date().toISOString().slice(0, 10);
const offsetDay = (n) => { const d = new Date(); d.setDate(d.getDate() + n); return d.toISOString().slice(0, 10); };
const RANGES    = [
  { label: "7D",   from: () => offsetDay(-6),  to: today },
  { label: "30D",  from: () => offsetDay(-29), to: today },
  { label: "90D",  from: () => offsetDay(-89), to: today },
  { label: "All",  from: () => "",             to: () => "" },
];

const SEV_COLORS = {
  critical: "#ef4444", high: "#f97316", medium: "#7c3aed", low: "#3b82f6", warning: "#22c55e",
};
const TYPE_PALETTE = [
  "#7c3aed","#3b82f6","#f97316","#22c55e","#ef4444","#06b6d4","#a855f7","#eab308",
];

/* ─── helpers ─── */
const fmt   = (n) => n != null ? Number(n).toLocaleString() : "—";
const fmtM  = (n) => { if (n == null) return "—"; if (n >= 1000) return `$${(n/1000).toFixed(1)}k`; return `$${n}`; };
const capFirst = (s) => s ? s.charAt(0).toUpperCase() + s.slice(1) : s;

/* ─── KPI Card ─────────────────────────────────────────────────────────────── */
function KpiCard({ icon, label, value, accent, sub, loading }) {
  return (
    <div style={{
      flex: "1 1 180px", minWidth: 0,
      background: "var(--bs-body-bg)",
      border: `1px solid var(--bs-border-color)`,
      borderRadius: 16,
      overflow: "hidden",
      position: "relative",
    }}>
      {/* accent bar */}
      <div style={{ height: 3, background: accent, borderRadius: "16px 16px 0 0" }} />
      <div style={{ padding: "20px 22px 22px" }}>
        {loading ? (
          <>
            <div className="rounded-2 mb-3" style={{ width: 40, height: 40, background: "var(--bs-secondary-bg)", animation: "pulse 1.4s infinite" }} />
            <div className="rounded-2 mb-2" style={{ width: "55%", height: 11, background: "var(--bs-secondary-bg)", animation: "pulse 1.4s infinite" }} />
            <div className="rounded-2" style={{ width: "75%", height: 28, background: "var(--bs-secondary-bg)", animation: "pulse 1.4s infinite" }} />
          </>
        ) : (
          <>
            <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", marginBottom: 14 }}>
              <div style={{
                width: 40, height: 40, borderRadius: 10, display: "flex",
                alignItems: "center", justifyContent: "center",
                background: accent + "18", color: accent, fontSize: "1.15rem", flexShrink: 0,
              }}>
                <i className={`bi ${icon}`} />
              </div>
            </div>
            <div style={{ color: "var(--bs-secondary-color)", fontSize: ".78rem", fontWeight: 600, letterSpacing: ".06em", textTransform: "uppercase", marginBottom: 4 }}>
              {label}
            </div>
            <div style={{ fontSize: "2rem", fontWeight: 800, lineHeight: 1, color: "var(--bs-body-color)", letterSpacing: "-.01em" }}>
              {value}
            </div>
            {sub && (
              <div style={{ fontSize: ".78rem", color: "var(--bs-secondary-color)", marginTop: 6 }}>{sub}</div>
            )}
          </>
        )}
      </div>
    </div>
  );
}

/* ─── Section card ─────────────────────────────────────────────────────────── */
function Card({ title, icon, badge, children, style, bodyStyle }) {
  return (
    <div style={{
      background: "var(--bs-body-bg)", border: "1px solid var(--bs-border-color)",
      borderRadius: 16, overflow: "hidden", ...style,
    }}>
      <div style={{
        padding: "16px 22px", borderBottom: "1px solid var(--bs-border-color)",
        display: "flex", alignItems: "center", gap: 10,
      }}>
        <div style={{
          width: 32, height: 32, borderRadius: 8, background: PA(".12"),
          display: "flex", alignItems: "center", justifyContent: "center",
          color: PU, fontSize: ".95rem", flexShrink: 0,
        }}>
          <i className={`bi ${icon}`} />
        </div>
        <span style={{ fontWeight: 700, fontSize: ".95rem", color: "var(--bs-body-color)", flex: 1 }}>{title}</span>
        {badge && (
          <span style={{ background: PA(".1"), color: PU, fontSize: ".75rem", fontWeight: 700,
            padding: "3px 10px", borderRadius: 20, letterSpacing: ".04em" }}>
            {badge}
          </span>
        )}
      </div>
      <div style={{ padding: "20px 22px", ...bodyStyle }}>
        {children}
      </div>
    </div>
  );
}

/* ─── Skeleton pulse bar ────────────────────────────────────────────────────── */
function Skel({ w = "100%", h = 14, mb = 0 }) {
  return <div style={{ width: w, height: h, marginBottom: mb, borderRadius: 6, background: "var(--bs-secondary-bg)", animation: "pulse 1.4s infinite" }} />;
}

/* ─── Chart options factory ─────────────────────────────────────────────────── */
const lineOpts = (tickColor) => ({
  responsive: true, maintainAspectRatio: false,
  interaction: { mode: "index", intersect: false },
  plugins: {
    legend: { display: false },
    tooltip: {
      backgroundColor: "#1e1340", titleColor: "#e2d9f8", bodyColor: "#c4b5fd",
      padding: 10, cornerRadius: 8, borderColor: PA(".3"), borderWidth: 1,
    },
  },
  scales: {
    x: { grid: { color: GRID, drawBorder: false }, ticks: { color: tickColor || "var(--bs-secondary-color)", font: { size: 11 } } },
    y: { grid: { color: GRID, drawBorder: false }, ticks: { color: tickColor || "var(--bs-secondary-color)", font: { size: 11 } }, beginAtZero: true },
  },
});
const barOpts = (horizontal = false) => ({
  ...lineOpts(),
  indexAxis: horizontal ? "y" : "x",
  plugins: {
    ...lineOpts().plugins,
    legend: { display: false },
  },
});
const doughnutOpts = {
  responsive: true, maintainAspectRatio: false,
  cutout: "68%",
  plugins: {
    legend: {
      position: "bottom",
      labels: { color: "var(--bs-body-color)", padding: 12, boxWidth: 12, font: { size: 11 } },
    },
    tooltip: {
      backgroundColor: "#1e1340", titleColor: "#e2d9f8", bodyColor: "#c4b5fd",
      padding: 10, cornerRadius: 8,
    },
  },
};

/* ═══════════════════════════════════════════════════════════════════════════ */
export default function Reports() {
  const { t } = useLanguage();
  const [data,       setData]       = useState(null);
  const [monthly,    setMonthly]    = useState([]);
  const [loading,    setLoading]    = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [exporting,  setExporting]  = useState(false);
  const [exportingPDF, setExportingPDF] = useState(false);
  const [rangeIdx,   setRangeIdx]   = useState(1);
  const [custom,     setCustom]     = useState({ from: "", to: "" });
  const [useCustom,  setUseCustom]  = useState(false);
  const isFirst = useRef(true);

  const getParams = () => {
    if (useCustom) {
      const p = {};
      if (custom.from) p.date_from = custom.from;
      if (custom.to)   p.date_to   = custom.to;
      return p;
    }
    const r = RANGES[rangeIdx];
    const p = {};
    const f = r.from(); const to = r.to();
    if (f)  p.date_from = f;
    if (to) p.date_to   = to;
    return p;
  };

  const load = (hasData = false) => {
    if (hasData) setRefreshing(true); else setLoading(true);
    const params = getParams();
    Promise.all([fetchDashboard(params), fetchMonthly(params)])
      .then(([d, m]) => { setData(d); setMonthly(m); })
      .catch(() => {})
      .finally(() => { setLoading(false); setRefreshing(false); });
  };

  useEffect(() => { load(false); }, []); // eslint-disable-line
  useEffect(() => {
    if (isFirst.current) { isFirst.current = false; return; }
    load(!!data);
  }, [rangeIdx, useCustom, custom]); // eslint-disable-line

  const handleExport = async () => {
    setExporting(true);
    try { await downloadCSV(getParams()); } finally { setExporting(false); }
  };

  const handleExportPDF = async () => {
    setExportingPDF(true);
    try { await downloadPDF(getParams()); } finally { setExportingPDF(false); }
  };

  /* ── Chart data ── */
  const typeChart = data ? {
    labels: (data.violations_by_type || []).map((r) =>
      (r.violation_type || t("rep.unknown")).replace(/_/g, " ").replace(/\b\w/g, (c) => c.toUpperCase())
    ),
    datasets: [{
      data: (data.violations_by_type || []).map((r) => r.count),
      backgroundColor: TYPE_PALETTE,
      borderWidth: 0, hoverOffset: 8,
    }],
  } : null;

  const sevChart = data ? {
    labels: (data.violations_by_severity || []).map((r) => capFirst(r.severity)),
    datasets: [{
      label: t("rep.violations"),
      data: (data.violations_by_severity || []).map((r) => r.count),
      backgroundColor: (data.violations_by_severity || []).map((r) => SEV_COLORS[r.severity] || PU),
      borderRadius: 6, barThickness: 18,
    }],
  } : null;

  const dailyChart = data ? (() => {
    const map = Object.fromEntries((data.daily_trend || []).map((r) => [r.day?.slice(0, 10), r.count]));
    const labels = [], counts = [];
    for (let i = 29; i >= 0; i--) {
      const d = new Date(); d.setDate(d.getDate() - i);
      labels.push(d.toLocaleDateString("en-GB", { day: "2-digit", month: "short" }));
      counts.push(map[d.toISOString().slice(0, 10)] ?? 0);
    }
    return {
      labels,
      datasets: [{
        label: t("rep.violations"),
        data: counts,
        borderColor: PU,
        backgroundColor: PA("0.1"),
        fill: true, tension: 0.4,
        pointRadius: 2, pointHoverRadius: 5,
        pointBackgroundColor: PU,
        borderWidth: 2,
      }],
    };
  })() : null;

  const monthlyChart = monthly.length ? {
    labels: monthly.map((r) => new Date(r.month).toLocaleDateString("en-GB", { month: "short", year: "2-digit" })),
    datasets: [{
      label: t("rep.violations"),
      data: monthly.map((r) => r.count),
      borderColor: "#3b82f6",
      backgroundColor: "rgba(59,130,246,0.08)",
      fill: true, tension: 0.4,
      pointRadius: 3, pointHoverRadius: 6,
      pointBackgroundColor: "#3b82f6",
      borderWidth: 2,
    }],
  } : null;

  const statusEntries = [
    { key: "pending",  label: t("rep.pending"),  color: "#f97316", icon: "bi-clock-fill" },
    { key: "verified", label: t("rep.verified"), color: PU,        icon: "bi-check-circle-fill" },
    { key: "resolved", label: t("rep.resolved"), color: "#22c55e", icon: "bi-shield-check" },
    { key: "rejected", label: t("rep.rejected"), color: "#ef4444", icon: "bi-x-circle-fill" },
  ];

  const rangeLabel = useCustom
    ? (custom.from && custom.to ? `${custom.from} → ${custom.to}` : t("rep.customRange"))
    : RANGES[rangeIdx].label === "All" ? t("rep.allTime") : RANGES[rangeIdx].label;

  /* ════════════════════ RENDER ════════════════════ */
  return (
    <div style={{ flex: 1, minHeight: 0, overflowY: "auto", padding: "0 4px 24px" }}>

      {/* ══ HERO BANNER ══ */}
      <div style={{
        background: `linear-gradient(135deg, #1e0a40 0%, #3b1080 50%, #1e0a40 100%)`,
        borderRadius: "0 0 24px 24px",
        padding: "32px 28px 36px",
        marginBottom: 28,
        position: "relative",
        overflow: "hidden",
      }}>
        {/* decorative circles */}
        {[[-60,-60,220], [80,-40,160], [-20, 60, 100]].map(([x, y, size], i) => (
          <div key={i} style={{
            position: "absolute", right: `${x + 60}px`, top: `${y + 60}px`,
            width: size, height: size, borderRadius: "50%",
            background: "rgba(167,139,250,0.07)", pointerEvents: "none",
          }} />
        ))}

        <div style={{ position: "relative", zIndex: 1 }}>
          {/* top row */}
          <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: 16, flexWrap: "wrap", marginBottom: 24 }}>
            <div>
              <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 8 }}>
                <div style={{ width: 36, height: 36, borderRadius: 10, background: PA(".3"),
                  display: "flex", alignItems: "center", justifyContent: "center" }}>
                  <i className="bi bi-bar-chart-fill" style={{ color: "#c4b5fd", fontSize: "1rem" }} />
                </div>
                <span style={{ color: "#c4b5fd", fontWeight: 700, fontSize: ".8rem", letterSpacing: ".1em", textTransform: "uppercase" }}>
                  {t("rep.analyticsReports")}
                </span>
              </div>
              <h2 style={{ color: "#fff", fontWeight: 800, fontSize: "1.65rem", margin: 0, letterSpacing: "-.02em" }}>
                {t("rep.violationReport")}
              </h2>
              <p style={{ color: "#a78bfa", margin: "6px 0 0", fontSize: ".9rem" }}>
                {t("rep.period")}: <strong style={{ color: "#e2d9f8" }}>{rangeLabel}</strong>
                {" "}· {t("rep.generated")} {new Date().toLocaleDateString("en-GB", { day: "2-digit", month: "short", year: "numeric" })}
              </p>
            </div>

            {/* Action buttons */}
            <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
              <button
                style={{
                  background: "rgba(255,255,255,0.1)", color: "#e2d9f8",
                  border: "1px solid rgba(255,255,255,0.18)", borderRadius: 10,
                  padding: "9px 18px", fontWeight: 600, fontSize: ".88rem",
                  cursor: refreshing ? "not-allowed" : "pointer",
                  opacity: refreshing ? .6 : 1, display: "flex", alignItems: "center", gap: 7,
                  transition: "background .15s, transform .12s",
                }}
                disabled={refreshing}
                onMouseEnter={(e) => e.currentTarget.style.background = "rgba(255,255,255,0.18)"}
                onMouseLeave={(e) => e.currentTarget.style.background = "rgba(255,255,255,0.10)"}
                onMouseDown={(e)  => { if (!refreshing) e.currentTarget.style.transform = "scale(.94)"; }}
                onMouseUp={(e)    => e.currentTarget.style.transform = "scale(1)"}
                onClick={() => load(true)}>
                <i className="bi bi-arrow-clockwise"
                  style={refreshing ? { animation: "spin .65s linear infinite", display: "inline-block" } : {}} />
                {refreshing ? t("rep.refreshing") : t("rep.refresh")}
              </button>
              <button
                style={{
                  background: "#22c55e", color: "#fff",
                  border: "none", borderRadius: 10,
                  padding: "9px 18px", fontWeight: 700, fontSize: ".88rem",
                  cursor: exporting ? "not-allowed" : "pointer",
                  opacity: exporting ? .7 : 1, display: "flex", alignItems: "center", gap: 7,
                  transition: "background .15s, transform .12s",
                }}
                disabled={exporting}
                onMouseEnter={(e) => e.currentTarget.style.background = "#16a34a"}
                onMouseLeave={(e) => e.currentTarget.style.background = "#22c55e"}
                onMouseDown={(e)  => { if (!exporting) e.currentTarget.style.transform = "scale(.94)"; }}
                onMouseUp={(e)    => e.currentTarget.style.transform = "scale(1)"}
                onClick={handleExport}>
                <i className="bi bi-download" />
                {exporting ? t("rep.exporting") : t("rep.exportCSV")}
              </button>
              <button
                style={{
                  background: "#dc2626", color: "#fff",
                  border: "none", borderRadius: 10,
                  padding: "9px 18px", fontWeight: 700, fontSize: ".88rem",
                  cursor: exportingPDF ? "not-allowed" : "pointer",
                  opacity: exportingPDF ? .7 : 1, display: "flex", alignItems: "center", gap: 7,
                  transition: "background .15s, transform .12s",
                }}
                disabled={exportingPDF}
                onMouseEnter={(e) => e.currentTarget.style.background = "#b91c1c"}
                onMouseLeave={(e) => e.currentTarget.style.background = "#dc2626"}
                onMouseDown={(e)  => { if (!exportingPDF) e.currentTarget.style.transform = "scale(.94)"; }}
                onMouseUp={(e)    => e.currentTarget.style.transform = "scale(1)"}
                onClick={handleExportPDF}>
                <i className="bi bi-file-earmark-pdf" />
                {exportingPDF ? t("rep.exportingPDF") : t("rep.exportPDF")}
              </button>
            </div>
          </div>

          {/* Date range pills */}
          <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
            <span style={{ color: "#a78bfa", fontSize: ".78rem", fontWeight: 600, letterSpacing: ".06em", textTransform: "uppercase", marginRight: 4 }}>
              {t("rep.period")}
            </span>
            {RANGES.map((r, i) => {
              const act = !useCustom && rangeIdx === i;
              return (
                <button key={r.label}
                  style={{
                    background: act ? "rgba(167,139,250,0.35)" : "rgba(255,255,255,0.08)",
                    color: act ? "#e2d9f8" : "#a78bfa",
                    border: act ? "1px solid rgba(167,139,250,0.5)" : "1px solid rgba(255,255,255,0.1)",
                    borderRadius: 8, padding: "5px 14px", fontSize: ".82rem", fontWeight: 600,
                    cursor: "pointer", transition: "all .15s",
                  }}
                  onMouseDown={(e) => e.currentTarget.style.transform = "scale(.94)"}
                  onMouseUp={(e)   => e.currentTarget.style.transform = "scale(1)"}
                  onMouseLeave={(e) => e.currentTarget.style.transform = "scale(1)"}
                  onClick={() => { setUseCustom(false); setRangeIdx(i); }}>
                  {r.label === "All" ? t("rep.allTime") : `${t("rep.last")} ${r.label}`}
                </button>
              );
            })}
            <span style={{ width: 1, height: 18, background: "rgba(255,255,255,0.15)", margin: "0 4px" }} />
            <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
              <input type="date" value={custom.from}
                onChange={(e) => { setCustom((p) => ({ ...p, from: e.target.value })); setUseCustom(true); }}
                style={{
                  background: "rgba(255,255,255,0.08)", border: "1px solid rgba(255,255,255,0.15)",
                  color: "#e2d9f8", borderRadius: 8, padding: "5px 10px", fontSize: ".82rem",
                  colorScheme: "dark",
                }} />
              <span style={{ color: "#a78bfa", fontSize: ".82rem" }}>→</span>
              <input type="date" value={custom.to}
                onChange={(e) => { setCustom((p) => ({ ...p, to: e.target.value })); setUseCustom(true); }}
                style={{
                  background: "rgba(255,255,255,0.08)", border: "1px solid rgba(255,255,255,0.15)",
                  color: "#e2d9f8", borderRadius: 8, padding: "5px 10px", fontSize: ".82rem",
                  colorScheme: "dark",
                }} />
            </div>
          </div>
        </div>
      </div>

      {/* ══ CONTENT ══ */}
      <div style={{ padding: "0 4px", display: "flex", flexDirection: "column", gap: 24 }}>

        {/* ── KPI row ── */}
        <div style={{ display: "flex", gap: 16, flexWrap: "wrap" }}>
          <KpiCard loading={loading} icon="bi-exclamation-triangle-fill"  label={t("rep.totalViolations")}  value={fmt(data?.total_violations)}  accent={PU}       />
          <KpiCard loading={loading} icon="bi-cash-coin"                  label={t("rep.finesCollected")}   value={fmtM(data?.total_collected)}  accent="#22c55e"  sub={`${fmt(data?.paid_fines)} ${t("rep.paidInvoices")}`} />
          <KpiCard loading={loading} icon="bi-hourglass-split"            label={t("rep.pendingFines")}     value={fmt(data?.pending_fines)}     accent="#f97316"  />
          <KpiCard loading={loading} icon="bi-exclamation-octagon-fill"   label={t("rep.overdueFines")}     value={fmt(data?.overdue_fines)}     accent="#ef4444"  />
          <KpiCard loading={loading} icon="bi-camera-video-fill"          label={t("rep.activeCameras")}    value={fmt(data?.active_cameras)}    accent="#06b6d4"  />
        </div>

        {/* ── Status breakdown ── */}
        <div style={{ display: "flex", gap: 12, flexWrap: "wrap" }}>
          {statusEntries.map(({ key, label, color, icon }) => {
            const count = data?.status_counts?.[key] ?? 0;
            const total = data?.total_violations || 1;
            const pct   = Math.round((count / total) * 100);
            return (
              <div key={key} style={{
                flex: "1 1 140px", minWidth: 0,
                background: "var(--bs-body-bg)", border: `1px solid var(--bs-border-color)`,
                borderRadius: 12, padding: "14px 18px",
              }}>
                {loading ? (
                  <><Skel w="40%" h={10} mb={8} /><Skel w="60%" h={20} /></>
                ) : (
                  <>
                    <div style={{ display: "flex", alignItems: "center", gap: 7, marginBottom: 8 }}>
                      <i className={`bi ${icon}`} style={{ color, fontSize: ".9rem" }} />
                      <span style={{ color, fontSize: ".78rem", fontWeight: 700, letterSpacing: ".05em", textTransform: "uppercase" }}>{label}</span>
                    </div>
                    <div style={{ fontSize: "1.5rem", fontWeight: 800, color: "var(--bs-body-color)", lineHeight: 1, marginBottom: 8 }}>{fmt(count)}</div>
                    <div style={{ height: 4, background: "var(--bs-secondary-bg)", borderRadius: 4, overflow: "hidden" }}>
                      <div style={{ width: `${pct}%`, height: "100%", background: color, borderRadius: 4, transition: "width .5s ease" }} />
                    </div>
                    <div style={{ fontSize: ".75rem", color: "var(--bs-secondary-color)", marginTop: 5 }}>{pct}% {t("rep.ofTotal")}</div>
                  </>
                )}
              </div>
            );
          })}
        </div>

        {/* ── Charts row 1: Daily trend (wide) + Doughnut ── */}
        <div style={{ display: "flex", gap: 20, flexWrap: "wrap" }}>

          <Card title={t("rep.dailyTrend")} icon="bi-graph-up-arrow" badge={t("rep.last30Days")}
            style={{ flex: "2 1 400px", minWidth: 0 }}>
            {loading
              ? <div style={{ height: 210 }}><Skel w="100%" h={210} /></div>
              : dailyChart
                ? <div style={{ height: 210 }}><Line data={dailyChart} options={lineOpts()} /></div>
                : <Empty />
            }
          </Card>

          <Card title={t("rep.byType")} icon="bi-pie-chart-fill"
            style={{ flex: "1 1 260px", minWidth: 0 }}>
            {loading
              ? <div style={{ height: 210 }}><Skel w="100%" h={210} /></div>
              : typeChart
                ? <div style={{ height: 210 }}><Doughnut data={typeChart} options={doughnutOpts} /></div>
                : <Empty />
            }
          </Card>
        </div>

        {/* ── Charts row 2: Severity bar + Monthly trend ── */}
        <div style={{ display: "flex", gap: 20, flexWrap: "wrap" }}>

          <Card title={t("rep.bySeverity")} icon="bi-bar-chart-steps"
            style={{ flex: "1 1 280px", minWidth: 0 }}>
            {loading
              ? <div style={{ height: 210 }}><Skel w="100%" h={210} /></div>
              : sevChart
                ? <div style={{ height: 210 }}><Bar data={sevChart} options={barOpts(true)} /></div>
                : <Empty />
            }
          </Card>

          <Card title={t("rep.monthlyTrend")} icon="bi-calendar3" badge={t("rep.allMonths")}
            style={{ flex: "2 1 360px", minWidth: 0 }}>
            {loading
              ? <div style={{ height: 210 }}><Skel w="100%" h={210} /></div>
              : monthlyChart
                ? <div style={{ height: 210 }}><Line data={monthlyChart} options={lineOpts()} /></div>
                : <Empty />
            }
          </Card>
        </div>

        {/* ── Top locations ── */}
        <Card title={t("rep.topLocations")} icon="bi-geo-alt-fill"
          badge={`${t("rep.top")} ${Math.min(5, (data?.violations_by_location || []).length)}`}
          bodyStyle={{ padding: 0 }}>
          <table style={{ width: "100%", borderCollapse: "collapse", fontSize: ".9rem" }}>
            <thead>
              <tr style={{ borderBottom: "1px solid var(--bs-border-color)" }}>
                {["#", t("rep.thLocation"), t("rep.thViolations"), t("rep.thShare"), t("rep.thBar")].map((h, i) => (
                  <th key={h} style={{
                    padding: "11px 20px", textAlign: i >= 2 ? "center" : "left",
                    color: "var(--bs-secondary-color)", fontSize: ".75rem",
                    fontWeight: 700, letterSpacing: ".06em", textTransform: "uppercase",
                    background: "var(--bs-secondary-bg)",
                  }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {loading ? (
                [0,1,2,3,4].map((i) => (
                  <tr key={i} style={{ borderBottom: "1px solid var(--bs-border-color)" }}>
                    {[16,60,20,20,80].map((w, j) => (
                      <td key={j} style={{ padding: "14px 20px" }}>
                        <Skel w={w} h={12} />
                      </td>
                    ))}
                  </tr>
                ))
              ) : !(data?.violations_by_location?.length) ? (
                <tr><td colSpan={5} style={{ padding: 32, textAlign: "center", color: "var(--bs-secondary-color)" }}>{t("rep.noData")}</td></tr>
              ) : (() => {
                const locs = data.violations_by_location;
                const max  = locs[0]?.count || 1;
                return locs.map((row, idx) => (
                  <tr key={idx} style={{ borderBottom: "1px solid var(--bs-border-color)", transition: "background .12s" }}
                    onMouseEnter={(e) => e.currentTarget.style.background = "var(--bs-secondary-bg)"}
                    onMouseLeave={(e) => e.currentTarget.style.background = "transparent"}>
                    <td style={{ padding: "13px 20px" }}>
                      <span style={{
                        width: 24, height: 24, borderRadius: 6, display: "inline-flex",
                        alignItems: "center", justifyContent: "center", fontSize: ".75rem",
                        fontWeight: 800, background: idx === 0 ? PU : "var(--bs-secondary-bg)",
                        color: idx === 0 ? "#fff" : "var(--bs-secondary-color)",
                      }}>{idx + 1}</span>
                    </td>
                    <td style={{ padding: "13px 20px", fontWeight: 600, color: "var(--bs-body-color)" }}>
                      <i className="bi bi-geo-alt me-2" style={{ color: PU, fontSize: ".85rem" }} />
                      {row.location || t("rep.unknown")}
                    </td>
                    <td style={{ padding: "13px 20px", textAlign: "center" }}>
                      <span style={{
                        fontWeight: 800, fontSize: "1rem",
                        color: idx === 0 ? PU : "var(--bs-body-color)",
                      }}>{row.count}</span>
                    </td>
                    <td style={{ padding: "13px 20px", textAlign: "center" }}>
                      <span style={{
                        background: PA(".1"), color: PU,
                        borderRadius: 20, padding: "2px 10px",
                        fontSize: ".78rem", fontWeight: 700,
                      }}>
                        {Math.round((row.count / (data.total_violations || 1)) * 100)}%
                      </span>
                    </td>
                    <td style={{ padding: "13px 20px", minWidth: 120 }}>
                      <div style={{ height: 6, background: "var(--bs-secondary-bg)", borderRadius: 6, overflow: "hidden" }}>
                        <div style={{
                          width: `${(row.count / max) * 100}%`, height: "100%",
                          background: `linear-gradient(90deg, ${PU}, #a855f7)`,
                          borderRadius: 6, transition: "width .5s ease",
                        }} />
                      </div>
                    </td>
                  </tr>
                ));
              })()}
            </tbody>
          </table>
        </Card>

      </div>{/* /content */}

      <style>{`
        @keyframes pulse { 0%,100%{opacity:1} 50%{opacity:.4} }
        @keyframes spin  { to{transform:rotate(360deg)} }
      `}</style>
    </div>
  );
}

function Empty() {
  const { t } = useLanguage();
  return (
    <div style={{ height: 210, display: "flex", flexDirection: "column",
      alignItems: "center", justifyContent: "center", gap: 8,
      color: "var(--bs-secondary-color)" }}>
      <i className="bi bi-bar-chart" style={{ fontSize: "2rem", opacity: .4 }} />
      <span style={{ fontSize: ".85rem" }}>{t("rep.noData")}</span>
    </div>
  );
}

