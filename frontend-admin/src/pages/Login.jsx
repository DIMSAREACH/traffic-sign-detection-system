import { useEffect, useState } from "react";
import { Link, useLocation, useNavigate } from "react-router-dom";
import { useGoogleLogin } from "@react-oauth/google";

import { useAuth, getRoleHomePath } from "../context/AuthContext.jsx";
import { socialLogin } from "../services/authService.js";
import { getAdminPort, isAdminPortal } from "../utils/portal.js";
import "./Login.css";

const FEATURES = [
  { icon: "bi-camera-reels-fill", text: "Real-time camera surveillance" },
  { icon: "bi-cpu-fill",          text: "AI-driven violation detection" },
  { icon: "bi-card-text",         text: "Automated licence plate recognition" },
  { icon: "bi-bar-chart-fill",    text: "Analytics & reporting dashboard" },
  { icon: "bi-bell-fill",         text: "Instant violation alerts & fines" },
];

const ADMIN_FEATURES = [
  { icon: "bi-people-fill",       text: "User, role & access management" },
  { icon: "bi-camera-reels-fill", text: "Camera fleet & enforcement policy" },
  { icon: "bi-shield-check",      text: "Audit trails & compliance oversight" },
  { icon: "bi-graph-up-arrow",    text: "City-wide analytics & reporting" },
];

const ORIGIN  = window.location.origin;
const CB_BASE = `${ORIGIN}/auth/callback`;

// OAuth redirect URLs – must match what you register in each provider’s console
const OAUTH_REDIRECT = (provider) => encodeURIComponent(`${CB_BASE}/${provider}`);

const OAUTH_URLS = {
  github: (
    `https://github.com/login/oauth/authorize` +
    `?client_id=${import.meta.env.VITE_GITHUB_CLIENT_ID}` +
    `&redirect_uri=${OAUTH_REDIRECT("github")}` +
    `&scope=user:email`
  ),
};

export default function Login() {
  const { login, loginFromData } = useAuth();
  const navigate                 = useNavigate();
  const location                 = useLocation();
  const adminPortal              = isAdminPortal();

  const [form,       setForm]       = useState({ email: "", password: "" });
  const [remember,   setRemember]   = useState(false);
  const [showPass,   setShowPass]   = useState(false);
  const [loading,    setLoading]    = useState(false);
  const [error,      setError]      = useState("");
  const [deletedMsg, setDeletedMsg] = useState("");
  const [activeRole, setActiveRole] = useState("officer");

  useEffect(() => {
    document.title = adminPortal ? "Admin sign-in · Traffic Expert System" : "Sign in · Traffic Expert System";
  }, [adminPortal]);

  /* Show account-deleted banner if redirected from Profile */
  useEffect(() => {
    if (location.state?.deleted) {
      setDeletedMsg("Your account has been permanently deleted.");
      // Clear the state so refreshing won't show it again
      window.history.replaceState({}, "");
    }
  }, [location.state]);

  const handleChange = (e) =>
    setForm((prev) => ({ ...prev, [e.target.name]: e.target.value }));

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError("");

    // ── Client-side validation ──
    if (!form.email.trim()) {
      setError("Please enter your email address.");
      return;
    }
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(form.email.trim())) {
      setError("Please enter a valid email address.");
      return;
    }
    if (!form.password) {
      setError("Please enter your password.");
      return;
    }
    if (form.password.length < 8) {
      setError("Password must be at least 8 characters.");
      return;
    }

    setLoading(true);
    try {
      const role = adminPortal ? "admin" : activeRole;
      const credentials = { ...form, role, remember };
      const userData = await login(credentials);
      // If an admin signs into the public portal, route them to the admin console URL.
      if (!adminPortal && userData?.role === "admin" && adminDevUrl) {
        window.location.assign(adminDevUrl);
        return;
      }
      navigate(
        userData?.role === "driver" ? "/user" : getRoleHomePath(userData?.role),
        { replace: true }
      );
    } catch (err) {
      const detail = err?.response?.data?.non_field_errors?.[0]
                  || err?.response?.data?.detail
                  || err?.message
                  || "Invalid email or password. Please try again.";
      setError(detail);
    } finally {
      setLoading(false);
    }
  };

  // Google — popup flow via @react-oauth/google
  const googleLogin = useGoogleLogin({
    onSuccess: async (tokenResp) => {
      try {
        setError("");
        const data = await socialLogin("google", { access_token: tokenResp.access_token });
        const u = loginFromData(data);
        if (!adminPortal && u?.role === "admin" && adminDevUrl) {
          window.location.assign(adminDevUrl);
          return;
        }
        navigate(u?.role === "driver" ? "/user" : getRoleHomePath(u?.role), { replace: true });
      } catch {
        setError(adminPortal ? "Admin portal only supports administrator accounts." : "Google login failed. Please try again.");
      }
    },
    onError: () => setError("Google login was cancelled or failed."),
  });

  // GitHub — redirect flow
  const doRedirect = (provider) => {
    const url = OAUTH_URLS[provider];
    if (!url || url.includes("undefined") || url.includes("null")) {
      setError("This social login provider is not configured yet. Please set the required environment variables.");
      return;
    }
    window.location.href = url;
  };

  const googleConfigured =
    Boolean(import.meta.env.VITE_GOOGLE_CLIENT_ID) &&
    !String(import.meta.env.VITE_GOOGLE_CLIENT_ID).includes("your-google-client-id");

  const adminPort = getAdminPort();
  const adminDevUrl =
    !adminPortal && adminPort && typeof window !== "undefined"
      ? `${window.location.protocol}//${window.location.hostname}:${adminPort}`
      : null;

  /* ── shared form fields ── */
  const formFields = (idPrefix, submitLabel) => (
    <>
      {deletedMsg && (
        <div className="deleted-alert mb-3">
          <i className="bi bi-check-circle-fill" />
          {deletedMsg}
        </div>
      )}
      {error && (
        <div className="err-alert mb-3">
          <i className="bi bi-exclamation-circle-fill" />
          {error}
        </div>
      )}

      <form onSubmit={handleSubmit} noValidate>
        <div className="mb-3">
          <label htmlFor={`${idPrefix}-email`} className="field-label">Email address</label>
          <div className={`lf-field ${error ? "lf-err" : ""}`}>
            <i className="bi bi-envelope lf-icon" />
            <input
              id={`${idPrefix}-email`}
              type="email"
              name="email"
              className="lf-input"
              placeholder="you@example.com"
              value={form.email}
              onChange={handleChange}
              autoComplete="email"
              required
            />
          </div>
        </div>

        <div className="mb-3">
          <div className="pw-label-row">
            <label htmlFor={`${idPrefix}-password`} className="field-label mb-0">Password</label>
            <Link to="/forgot-password" className="forgot-link" style={{ fontSize: ".85rem" }}>Forgot password?</Link>
          </div>
          <div className={`lf-field ${error ? "lf-err" : ""}`}>
            <i className="bi bi-lock lf-icon" />
            <input
              id={`${idPrefix}-password`}
              type={showPass ? "text" : "password"}
              name="password"
              className="lf-input lf-input-pwd"
              placeholder="••••••••"
              value={form.password}
              onChange={handleChange}
              autoComplete="current-password"
              required
            />
            <button type="button" className="lf-eye" onClick={() => setShowPass(v => !v)} tabIndex={-1}>
              <i className={`bi ${showPass ? "bi-eye-slash" : "bi-eye"}`} />
            </button>
          </div>
        </div>

        {/* ── Remember me ── */}
        <div className="remember-row">
          <label className="remember-label">
            <input
              type="checkbox"
              className="remember-check"
              checked={remember}
              onChange={(e) => setRemember(e.target.checked)}
            />
            <span className="remember-box">
              {remember && <i className="bi bi-check2" />}
            </span>
            Remember me
          </label>
        </div>

        <button type="submit" className={`btn-submit ${adminPortal ? "btn-submit--admin" : ""}`} disabled={loading} style={{ marginTop: ".5rem" }}>
          {loading ? (
            <><span className="spinner-border spinner-border-sm" />&nbsp;Signing in…</>
          ) : (
            <><i className="bi bi-box-arrow-in-right" />&nbsp;{submitLabel}</>
          )}
        </button>
      </form>
    </>
  );

  /* ══════════════════════════════════════════
     ADMIN PORTAL — city-background, teal theme
  ══════════════════════════════════════════ */
  if (adminPortal) {
    return (
      <div className="up-page ap-page">
        <div className="up-bg ap-bg" />
        <div className="up-overlay ap-overlay" />

        <div className="up-inner">
          {/* ── Left hero ── */}
          <div className="up-hero">
            <div className="up-badge ap-badge">
              <i className="bi bi-shield-lock-fill" />
              <span>Administrator Portal</span>
            </div>
            <h1 className="up-headline ap-headline">
              Traffic<br />
              <em>Governance</em><br />
              <em>Console</em>
            </h1>
            <p className="up-tagline ap-tagline">
              Restricted access for city administrators: manage the enforcement
              network, review violations and fines, and keep the public portal
              separate from staff tools.
            </p>

            {/* stat chips */}
            <div className="ap-stat-row">
              {[
                { value: "RBAC",  label: "Role-based access" },
                { value: "Audit", label: "Action logging"    },
                { value: "Live",  label: "Operations desk"   },
              ].map((s) => (
                <div className="ap-stat-chip" key={s.label}>
                  <span className="ap-stat-value">{s.value}</span>
                  <span className="ap-stat-label">{s.label}</span>
                </div>
              ))}
            </div>

            <ul className="up-features ap-features">
              {ADMIN_FEATURES.map(({ icon, text }) => (
                <li key={text}><i className={`bi ${icon}`} />{text}</li>
              ))}
            </ul>

            <div className="up-footer ap-footer">
              <span className="ap-status-dot" />
              All systems operational &nbsp;·&nbsp; © {new Date().getFullYear()} Traffic Expert System
            </div>
          </div>

          {/* ── Floating card ── */}
          <div className="up-card-wrap">
            <div className="up-card ap-card">
              <div className="ap-card-header">
                <div className="ap-card-icon">
                  <i className="bi bi-shield-lock-fill" />
                </div>
                <h2 className="ap-card-title">Administrator sign-in</h2>
                <p className="ap-card-sub">
                  Use credentials issued by your city IT team.<br />
                  Public self-registration is not available here.
                </p>
              </div>
              <hr className="ap-divider" />
              {formFields("admin", "Sign In")}
            </div>
          </div>
        </div>
      </div>
    );
  }

  /* ══════════════════════════════════════════
     USER PORTAL — full-background city design
  ══════════════════════════════════════════ */
  return (
    <div className="up-page">
      {/* city-night background */}
      <div className="up-bg" />
      <div className="up-overlay" />

      <div className="up-inner">
        {/* ── LEFT: hero text ── */}
        <div className="up-hero">
          <div className="up-badge">
            <i className="bi bi-camera-reels-fill" />
            <span>Traffic Expert System</span>
          </div>

          <h1 className="up-headline">
            Manage Your<br />
            Traffic <em>Cases</em><br />
            <em>Seamlessly</em>
          </h1>
          <p className="up-tagline">
            Access violations, pay fines, and track your cases in one unified platform.
            Designed for both drivers and enforcement officers.
          </p>

          <ul className="up-features">
            {FEATURES.map(({ icon, text }) => (
              <li key={text}>
                <i className={`bi ${icon}`} />
                {text}
              </li>
            ))}
          </ul>

          <div className="up-footer">
            <span className="up-status-dot" />
            All systems operational &nbsp;·&nbsp; © {new Date().getFullYear()} Traffic Expert System
          </div>
        </div>

        {/* ── RIGHT: floating login card ── */}
        <div className="up-card-wrap">
          <div className="up-card">
            {/* Officer / Driver tab switcher */}
            <div className="up-tabs">
              <button
                type="button"
                className={`up-tab ${activeRole === "officer" ? "up-tab--active" : ""}`}
                onClick={() => { setActiveRole("officer"); setError(""); }}
              >
                <i className="bi bi-person-badge" />
                Officer
              </button>
              <button
                type="button"
                className={`up-tab ${activeRole === "driver" ? "up-tab--active" : ""}`}
                onClick={() => { setActiveRole("driver"); setError(""); }}
              >
                <i className="bi bi-car-front" />
                Driver
              </button>
            </div>

            <h2 className="up-card-title">
              {activeRole === "officer" ? "Officer Access" : "Driver Access"}
            </h2>
            <p className="up-card-sub">
              {activeRole === "officer"
                ? "Enter your credentials to access the enforcement portal."
                : "Enter your credentials to access the driver portal."}
            </p>

            {formFields(activeRole, `Login as ${activeRole === "officer" ? "Officer" : "Driver"} →`)}

            {/* Social login */}
            <div className="or-divider" style={{ margin: ".9rem 0 .75rem" }}>
              <span>or continue with</span>
            </div>
            <div className="social-grid">
              <button
                className="social-btn social-google"
                onClick={() => {
                  if (!googleConfigured) {
                    setError("Google login is not configured. Set VITE_GOOGLE_CLIENT_ID.");
                    return;
                  }
                  googleLogin();
                }}
                type="button"
                disabled={!googleConfigured}
                title={!googleConfigured ? "Set VITE_GOOGLE_CLIENT_ID in frontend/.env" : undefined}
              >
                <svg width="16" height="16" viewBox="0 0 48 48">
                  <path fill="#EA4335" d="M24 9.5c3.54 0 6.71 1.22 9.21 3.6l6.85-6.85C35.9 2.38 30.47 0 24 0 14.62 0 6.51 5.38 2.56 13.22l7.98 6.19C12.43 13.72 17.74 9.5 24 9.5z"/>
                  <path fill="#4285F4" d="M46.98 24.55c0-1.57-.15-3.09-.38-4.55H24v9.02h12.94c-.58 2.96-2.26 5.48-4.78 7.18l7.73 6c4.51-4.18 7.09-10.36 7.09-17.65z"/>
                  <path fill="#FBBC05" d="M10.53 28.59c-.48-1.45-.76-2.99-.76-4.59s.27-3.14.76-4.59l-7.98-6.19C.92 16.46 0 20.12 0 24c0 3.88.92 7.54 2.56 10.78l7.97-6.19z"/>
                  <path fill="#34A853" d="M24 48c6.48 0 11.93-2.13 15.89-5.81l-7.73-6c-2.15 1.45-4.92 2.3-8.16 2.3-6.26 0-11.57-4.22-13.47-9.91l-7.98 6.19C6.51 42.62 14.62 48 24 48z"/>
                </svg>
                Google
              </button>
              <button className="social-btn social-github" onClick={() => doRedirect("github")} type="button">
                <svg width="16" height="16" viewBox="0 0 16 16" fill="currentColor">
                  <path d="M8 0C3.58 0 0 3.58 0 8c0 3.54 2.29 6.53 5.47 7.59.4.07.55-.17.55-.38 0-.19-.01-.82-.01-1.49-2.01.37-2.53-.49-2.69-.94-.09-.23-.48-.94-.82-1.13-.28-.15-.68-.52-.01-.53.63-.01 1.08.58 1.23.82.72 1.21 1.87.87 2.33.66.07-.52.28-.87.51-1.07-1.78-.2-3.64-.89-3.64-3.95 0-.87.31-1.59.82-2.15-.08-.2-.36-1.02.08-2.12 0 0 .67-.21 2.2.82.64-.18 1.32-.27 2-.27.68 0 1.36.09 2 .27 1.53-1.04 2.2-.82 2.2-.82.44 1.1.16 1.92.08 2.12.51.56.82 1.27.82 2.15 0 3.07-1.87 3.75-3.65 3.95.29.25.54.73.54 1.48 0 1.07-.01 1.93-.01 2.2 0 .21.15.46.55.38A8.013 8.013 0 0016 8c0-4.42-3.58-8-8-8z"/>
                </svg>
                GitHub
              </button>
            </div>

            <p className="up-register-line">
              First time here?{" "}
              <Link to="/register">Create an account</Link>
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
