import { useEffect, useState } from "react";
import { NavLink } from "react-router-dom";
import { useAuth } from "../context/AuthContext.jsx";
import { useLanguage } from "../i18n/LanguageContext.jsx";
import { fetchMyDashboard } from "../services/reportService.js";

const PU  = "#7c3aed";
const PA  = (a) => `rgba(124,58,237,${a})`;

/* ── Greeting helper ── */
function greeting(t) {
  const h = new Date().getHours();
  if (h < 12) return t("dash.goodMorning");
  if (h < 18) return t("dash.goodAfternoon");
  return t("dash.goodEvening");
}

/* ── Stat Card ── */
function StatCard({ icon, label, value, color, bg }) {
  return (
    <div className="col-6 col-lg-3">
      <div className="card border-0 h-100 rounded-4"
        style={{ boxShadow: "0 2px 12px rgba(124,58,237,.08)", background: "var(--bs-body-bg)" }}>
        <div className="card-body p-3 d-flex flex-column gap-2">
          <span className="rounded-3 d-flex align-items-center justify-content-center"
            style={{ width: 48, height: 48, background: bg }}>
            <i className={`bi ${icon}`} style={{ color, fontSize: "1.4rem" }} />
          </span>
          <div>
            <div className="fw-bold" style={{ fontSize: "2rem", color: "var(--bs-body-color)", lineHeight: 1 }}>
              {value ?? <span className="placeholder col-4 rounded" />}
            </div>
            <div className="text-secondary mt-1" style={{ fontSize: ".92rem" }}>{label}</div>
          </div>
        </div>
      </div>
    </div>
  );
}

/* ── Quick Action ── */
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
        <span className="fw-semibold text-center" style={{ fontSize: ".92rem", color: "var(--bs-body-color)" }}>{label}</span>
      </div>
    </NavLink>
  );
}

/* ══ Main ════════════════════════════════════════════════════════ */
export default function UserDashboard() {
  const { user } = useAuth();
  const { t } = useLanguage();
  const [stats, setStats] = useState(null);
  const [err, setErr]     = useState("");

  useEffect(() => {
    fetchMyDashboard()
      .then(setStats)
      .catch(() => setErr(t("udash.loadFailed")));
  }, []);

  const displayName = user?.first_name
    ? `${user.first_name} ${user.last_name || ""}`.trim()
    : user?.username || "User";

  return (
    <div className="d-flex flex-column gap-3 p-3" style={{ flex: 1, minHeight: 0, overflow: "hidden" }}>
      <div className="flex-fill overflow-auto" style={{ minHeight: 0 }}>

        {/* ── Welcome ── */}
        <div className="card border-0 rounded-4 mb-3"
          style={{ background: `linear-gradient(135deg, ${PU} 0%, #4c1d95 100%)`, color: "#fff" }}>
          <div className="card-body p-4">
            <div className="d-flex align-items-center gap-3">
              <div className="rounded-circle d-flex align-items-center justify-content-center"
                style={{ width: 56, height: 56, background: "rgba(255,255,255,.15)", fontSize: "1.5rem", fontWeight: 700 }}>
                {user?.avatar_url
                  ? <img src={user.avatar_url} alt="" className="rounded-circle" style={{ width: 56, height: 56, objectFit: "cover" }} />
                  : (user?.first_name?.[0] || user?.username?.[0] || "U").toUpperCase()}
              </div>
              <div>
                <h4 className="mb-1 fw-bold">{greeting(t)}, {displayName}!</h4>
                <p className="mb-0 opacity-75" style={{ fontSize: ".95rem" }}>{t("udash.welcome")}</p>
              </div>
            </div>
          </div>
        </div>

        {/* ── Stats ── */}
        {err && (
          <div className="alert alert-danger rounded-3 py-2 d-flex align-items-center gap-2">
            <i className="bi bi-exclamation-triangle-fill" />{err}
          </div>
        )}

        <div className="row g-3 mb-3">
          <StatCard icon="bi-exclamation-triangle-fill" label={t("udash.myViolations")}
            value={stats?.total_violations ?? "—"} color="#ef4444" bg="rgba(239,68,68,.1)" />
          <StatCard icon="bi-receipt-cutoff" label={t("udash.unpaidFines")}
            value={stats?.pending_fines ?? "—"} color="#f59e0b" bg="rgba(245,158,11,.1)" />
          <StatCard icon="bi-credit-card-2-front" label={t("udash.totalPaid")}
            value={stats?.paid_fines ?? "—"} color="#22c55e" bg="rgba(34,197,94,.1)" />
          <StatCard icon="bi-bell-fill" label={t("udash.recentAlerts")}
            value={stats?.recent_notifications ?? "—"} color="#3b82f6" bg="rgba(59,130,246,.1)" />
        </div>

        {/* ── Quick Actions ── */}
        <div className="card border-0 rounded-4 mb-3" style={{ background: "var(--bs-body-bg)", boxShadow: "0 2px 12px rgba(124,58,237,.06)" }}>
          <div className="card-body p-3">
            <h6 className="fw-bold mb-3" style={{ color: "var(--bs-body-color)" }}>
              <i className="bi bi-lightning-charge-fill me-2" style={{ color: PU }} />
              {t("udash.quickActions")}
            </h6>
            <div className="row g-2">
              <div className="col-6 col-md-3">
                <QAction icon="bi-exclamation-triangle-fill" label={t("nav.myViolations")}
                  to="/user/violations" color="#ef4444" bg="rgba(239,68,68,.06)" />
              </div>
              <div className="col-6 col-md-3">
                <QAction icon="bi-receipt-cutoff" label={t("nav.myFines")}
                  to="/user/fines" color="#f59e0b" bg="rgba(245,158,11,.06)" />
              </div>
              <div className="col-6 col-md-3">
                <QAction icon="bi-credit-card-2-front" label={t("nav.myPayments")}
                  to="/user/payments" color="#22c55e" bg="rgba(34,197,94,.06)" />
              </div>
              <div className="col-6 col-md-3">
                <QAction icon="bi-person-circle" label={t("nav.profile")}
                  to="/user/profile" color={PU} bg={PA(.06)} />
              </div>
            </div>
          </div>
        </div>

        {/* ── Recent Activity ── */}
        <div className="card border-0 rounded-4" style={{ background: "var(--bs-body-bg)", boxShadow: "0 2px 12px rgba(124,58,237,.06)" }}>
          <div className="card-body p-3">
            <h6 className="fw-bold mb-3" style={{ color: "var(--bs-body-color)" }}>
              <i className="bi bi-clock-history me-2" style={{ color: PU }} />
              {t("udash.recentActivity")}
            </h6>
            {stats?.recent_violations?.length > 0 ? (
              <div className="list-group list-group-flush">
                {stats.recent_violations.map((v) => (
                  <div key={v.id} className="list-group-item border-0 px-0 d-flex justify-content-between align-items-center"
                    style={{ background: "transparent" }}>
                    <div>
                      <span className="fw-semibold" style={{ color: "var(--bs-body-color)" }}>{v.violation_type}</span>
                      <small className="d-block text-secondary">{v.location} &middot; {new Date(v.date).toLocaleDateString()}</small>
                    </div>
                    <span className={`badge rounded-pill bg-${v.severity === "high" ? "danger" : v.severity === "medium" ? "warning" : "info"}`}>
                      {v.severity}
                    </span>
                  </div>
                ))}
              </div>
            ) : (
              <div className="text-center text-secondary py-4">
                <i className="bi bi-inbox" style={{ fontSize: "2.5rem", opacity: .3 }} />
                <p className="mt-2 mb-0" style={{ fontSize: ".92rem" }}>{t("udash.noActivity")}</p>
              </div>
            )}
          </div>
        </div>

      </div>
    </div>
  );
}
