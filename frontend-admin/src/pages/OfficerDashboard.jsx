import { useEffect, useState } from "react";
import { NavLink } from "react-router-dom";
import { useLanguage } from "../i18n/LanguageContext.jsx";
import { fetchDashboard } from "../services/reportService.js";

const CY = "#0ea5e9";

function Stat({ icon, label, value, color, bg }) {
  return (
    <div className="col-6 col-xl-3">
      <div className="card border-0 h-100 rounded-4" style={{ background: "var(--bs-body-bg)", boxShadow: "0 2px 12px rgba(2,132,199,.10)" }}>
        <div className="card-body p-3 d-flex flex-column gap-2">
          <span className="rounded-3 d-flex align-items-center justify-content-center" style={{ width: 48, height: 48, background: bg }}>
            <i className={`bi ${icon}`} style={{ color, fontSize: "1.4rem" }} />
          </span>
          <div>
            <div className="fw-bold" style={{ fontSize: "2rem", color: "var(--bs-body-color)", lineHeight: 1 }}>
              {value ?? "—"}
            </div>
            <div className="text-secondary mt-1" style={{ fontSize: ".92rem" }}>{label}</div>
          </div>
        </div>
      </div>
    </div>
  );
}

function Action({ icon, label, to, color, bg }) {
  return (
    <NavLink to={to} className="text-decoration-none">
      <div className="d-flex flex-column align-items-center justify-content-center gap-2 rounded-4 p-3"
        style={{ background: bg, cursor: "pointer", transition: "transform .15s, opacity .15s" }}
        onMouseOver={(e) => (e.currentTarget.style.opacity = ".85")}
        onMouseOut={(e)  => (e.currentTarget.style.opacity = "1")}
      >
        <div className="rounded-3 d-flex align-items-center justify-content-center" style={{ width: 44, height: 44, background: "#fff" }}>
          <i className={`bi ${icon}`} style={{ color, fontSize: "1.3rem" }} />
        </div>
        <span className="fw-semibold text-center" style={{ fontSize: ".92rem", color: "var(--bs-body-color)" }}>{label}</span>
      </div>
    </NavLink>
  );
}

export default function OfficerDashboard() {
  const { t } = useLanguage();
  const [stats, setStats] = useState(null);
  const [err, setErr] = useState("");

  useEffect(() => {
    fetchDashboard()
      .then(setStats)
      .catch(() => setErr("Failed to load dashboard data."));
  }, []);

  const fmtMoney = (n) => Number(n || 0).toLocaleString("en-US", { style: "currency", currency: "USD" });
  const topTypes = Array.isArray(stats?.violations_by_type) ? stats.violations_by_type.slice(0, 5) : [];
  const topLocs = Array.isArray(stats?.violations_by_location) ? stats.violations_by_location.slice(0, 5) : [];

  return (
    <div className="d-flex flex-column gap-3 p-3" style={{ flex: 1, minHeight: 0, overflow: "hidden" }}>
      <div className="flex-fill overflow-auto no-scrollbar" style={{ minHeight: 0 }}>
        <div className="card border-0 rounded-4 mb-3" style={{ background: `linear-gradient(135deg, ${CY} 0%, #075985 100%)`, color: "#fff" }}>
          <div className="card-body p-4">
            <h4 className="mb-1 fw-bold">Officer overview</h4>
            <p className="mb-0 opacity-75" style={{ fontSize: ".95rem" }}>
              Monitor city activity and review violations. Admin-only actions stay in the admin console.
            </p>
          </div>
        </div>

        {err && (
          <div className="alert alert-danger rounded-3 py-2 d-flex align-items-center gap-2">
            <i className="bi bi-exclamation-triangle-fill" />{err}
          </div>
        )}

        <div className="row g-3 mb-3">
          <Stat icon="bi-exclamation-triangle-fill" label="Total violations"
            value={stats?.total_violations} color="#ef4444" bg="rgba(239,68,68,.10)" />
          <Stat icon="bi-receipt-cutoff" label="Pending fines"
            value={stats?.pending_fines} color="#f59e0b" bg="rgba(245,158,11,.10)" />
          <Stat icon="bi-credit-card-2-front" label="Paid fines"
            value={stats?.paid_fines} color="#22c55e" bg="rgba(34,197,94,.10)" />
          <Stat icon="bi-camera-reels-fill" label="Active cameras"
            value={stats?.active_cameras} color={CY} bg="rgba(14,165,233,.12)" />
        </div>

        {/* ── Insights ── */}
        <div className="row g-3 mb-3">
          <div className="col-12 col-lg-6">
            <div className="card border-0 rounded-4 h-100" style={{ background: "var(--bs-body-bg)", boxShadow: "0 2px 12px rgba(2,132,199,.08)" }}>
              <div className="card-body p-3">
                <div className="d-flex align-items-center justify-content-between mb-2">
                  <h6 className="fw-bold mb-0" style={{ color: "var(--bs-body-color)" }}>
                    <i className="bi bi-list-check me-2" style={{ color: CY }} />
                    Top violation types
                  </h6>
                  <span className="badge rounded-pill fw-semibold" style={{ background: "rgba(14,165,233,.10)", color: CY }}>
                    {stats?.violations_by_type?.length ?? 0}
                  </span>
                </div>
                {topTypes.length ? (
                  <div className="d-flex flex-column gap-2">
                    {topTypes.map((it) => (
                      <div key={it.violation_type} className="d-flex align-items-center justify-content-between">
                        <div className="text-secondary" style={{ fontSize: ".95rem" }}>
                          {String(it.violation_type || "").replace(/_/g, " ")}
                        </div>
                        <span className="badge rounded-pill fw-semibold" style={{ background: "rgba(124,58,237,.10)", color: "#7c3aed" }}>
                          {it.count}
                        </span>
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="text-center text-secondary py-4">
                    <i className="bi bi-inbox" style={{ fontSize: "2.2rem", opacity: .25 }} />
                    <div className="mt-2">No data yet</div>
                  </div>
                )}
              </div>
            </div>
          </div>

          <div className="col-12 col-lg-6">
            <div className="card border-0 rounded-4 h-100" style={{ background: "var(--bs-body-bg)", boxShadow: "0 2px 12px rgba(2,132,199,.08)" }}>
              <div className="card-body p-3">
                <div className="d-flex align-items-center justify-content-between mb-2">
                  <h6 className="fw-bold mb-0" style={{ color: "var(--bs-body-color)" }}>
                    <i className="bi bi-geo-alt-fill me-2" style={{ color: CY }} />
                    Top locations
                  </h6>
                  <span className="badge rounded-pill fw-semibold" style={{ background: "rgba(14,165,233,.10)", color: CY }}>
                    {stats?.violations_by_location?.length ?? 0}
                  </span>
                </div>
                {topLocs.length ? (
                  <div className="d-flex flex-column gap-2">
                    {topLocs.map((it, idx) => (
                      <div key={`${it.location}-${idx}`} className="d-flex align-items-center justify-content-between gap-2">
                        <div className="text-secondary text-truncate" style={{ fontSize: ".95rem", maxWidth: "70%" }}>
                          {it.location || "Unknown"}
                        </div>
                        <span className="badge rounded-pill fw-semibold" style={{ background: "rgba(124,58,237,.10)", color: "#7c3aed" }}>
                          {it.count}
                        </span>
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="text-center text-secondary py-4">
                    <i className="bi bi-inbox" style={{ fontSize: "2.2rem", opacity: .25 }} />
                    <div className="mt-2">No data yet</div>
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>

        {/* ── Collection summary ── */}
        <div className="card border-0 rounded-4 mb-3" style={{ background: "var(--bs-body-bg)", boxShadow: "0 2px 12px rgba(2,132,199,.08)" }}>
          <div className="card-body p-3 d-flex align-items-center justify-content-between flex-wrap gap-2">
            <div className="d-flex align-items-center gap-2">
              <span className="rounded-3 d-flex align-items-center justify-content-center"
                style={{ width: 44, height: 44, background: "rgba(22,163,74,.10)" }}>
                <i className="bi bi-cash-coin" style={{ color: "#16a34a", fontSize: "1.35rem" }} />
              </span>
              <div>
                <div className="fw-bold" style={{ fontSize: "1.05rem" }}>Total collected</div>
                <div className="text-secondary" style={{ fontSize: ".9rem" }}>Paid fines across the system</div>
              </div>
            </div>
            <div className="fw-bold" style={{ fontSize: "1.35rem", color: "var(--bs-body-color)" }}>
              {stats ? fmtMoney(stats.total_collected) : "—"}
            </div>
          </div>
        </div>

        <div className="card border-0 rounded-4" style={{ background: "var(--bs-body-bg)", boxShadow: "0 2px 12px rgba(2,132,199,.08)" }}>
          <div className="card-body p-3">
            <h6 className="fw-bold mb-3" style={{ color: "var(--bs-body-color)" }}>
              <i className="bi bi-lightning-charge-fill me-2" style={{ color: CY }} />
              Quick actions
            </h6>
            <div className="row g-2">
              <div className="col-6 col-md-3">
                <Action icon="bi-exclamation-triangle-fill" label="Violations" to="/dashboard/violations" color="#ef4444" bg="rgba(239,68,68,.06)" />
              </div>
              <div className="col-6 col-md-3">
                <Action icon="bi-receipt-cutoff" label="Fines" to="/dashboard/fines" color="#f59e0b" bg="rgba(245,158,11,.06)" />
              </div>
              <div className="col-6 col-md-3">
                <Action icon="bi-bell-fill" label={t("nav.notifications")} to="/dashboard/notifications" color={CY} bg="rgba(14,165,233,.08)" />
              </div>
              <div className="col-6 col-md-3">
                <Action icon="bi-person-circle" label={t("nav.profile")} to="/dashboard/profile" color="#a78bfa" bg="rgba(167,139,250,.06)" />
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

