import { useEffect, useState } from "react";
import { Link, useLocation, useNavigate } from "react-router-dom";
import { useGoogleLogin } from "@react-oauth/google";

import { useAuth } from "../context/AuthContext.jsx";
import { socialLogin } from "../services/authService.js";
import "./Login.css";

const ROLES = [
  { key: "admin",   label: "Admin",   icon: "bi-shield-lock-fill" },
  { key: "officer", label: "Officer", icon: "bi-person-badge-fill" },
  { key: "driver",  label: "Driver",  icon: "bi-car-front-fill" },
];

const FEATURES = [
  { icon: "bi-camera-reels-fill", text: "Real-time camera surveillance" },
  { icon: "bi-cpu-fill",          text: "AI-driven violation detection" },
  { icon: "bi-card-text",         text: "Automated licence plate recognition" },
  { icon: "bi-bar-chart-fill",    text: "Analytics & reporting dashboard" },
  { icon: "bi-bell-fill",         text: "Instant violation alerts & fines" },
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
  facebook: (
    `https://www.facebook.com/v19.0/dialog/oauth` +
    `?client_id=${import.meta.env.VITE_FACEBOOK_APP_ID}` +
    `&redirect_uri=${OAUTH_REDIRECT("facebook")}` +
    `&scope=email`
  ),
  microsoft: (
    `https://login.microsoftonline.com/common/oauth2/v2.0/authorize` +
    `?client_id=${import.meta.env.VITE_MICROSOFT_CLIENT_ID}` +
    `&response_type=code` +
    `&redirect_uri=${OAUTH_REDIRECT("microsoft")}` +
    `&scope=openid+email+profile`
  ),
};

export default function Login() {
  const { login, loginFromData } = useAuth();
  const navigate                 = useNavigate();
  const location                 = useLocation();

  const [form,       setForm]       = useState({ email: "", password: "" });
  const [remember,   setRemember]   = useState(false);
  const [showPass,   setShowPass]   = useState(false);
  const [loading,    setLoading]    = useState(false);
  const [error,      setError]      = useState("");
  const [activeRole, setActiveRole] = useState("admin");
  const [deletedMsg, setDeletedMsg] = useState("");

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
      const userData = await login({ ...form, role: activeRole });
      navigate(userData?.role === "driver" ? "/user" : "/");
    } catch (err) {
      const detail = err?.response?.data?.non_field_errors?.[0]
                  || err?.response?.data?.detail
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
        navigate(u?.role === "driver" ? "/user" : "/");
      } catch {
        setError("Google login failed. Please try again.");
      }
    },
    onError: () => setError("Google login was cancelled or failed."),
  });

  // GitHub / Facebook / Microsoft — redirect flow
  const doRedirect = (provider) => {
    window.location.href = OAUTH_URLS[provider];
  };

  return (
    <div className="auth-page">

      {/* ══ LEFT PANEL ══ */}
      <div className="auth-left">
        <div className="auth-left-inner">

          <div className="brand-badge">
            <i className="bi bi-camera-video-fill" />
            <span className="brand-badge-text">Traffic Expert System</span>
          </div>

          <h1 className="auth-headline">
            Smart City<br />
            <em>Traffic Enforcement</em>
          </h1>
          <p className="auth-tagline">
            AI-powered monitoring platform for real-time violation detection,
            automated fines, and complete city-wide traffic oversight.
          </p>

          <div className="stat-row">
            {[
              { value: "99.2%", label: "Detection Accuracy" },
              { value: "24/7",  label: "Live Monitoring" },
              { value: "<1s",   label: "Alert Response" },
            ].map((s) => (
              <div className="stat-chip" key={s.label}>
                <span className="stat-chip-value">{s.value}</span>
                <span className="stat-chip-label">{s.label}</span>
              </div>
            ))}
          </div>

          <ul className="feat-list">
            {FEATURES.map(({ icon, text }) => (
              <li key={text}>
                <span className="feat-icon"><i className={`bi ${icon}`} /></span>
                {text}
              </li>
            ))}
          </ul>

          <div className="auth-left-foot">
            <span>© {new Date().getFullYear()} Traffic Expert System</span>
            <div className="status-dot-row">
              <span className="status-dot" />
              All systems operational
            </div>
          </div>

        </div>
      </div>

      {/* ══ RIGHT PANEL ══ */}
      <div className="auth-right">
        <div className="login-box">

          <div className="login-heading mb-3">
            <h2>Welcome back 👋</h2>
            <p>Sign in to your Traffic Expert System dashboard</p>
          </div>

          <hr className="thin-hr" />

          <div className="role-tabs">
            {ROLES.map((r) => (
              <button
                key={r.key}
                type="button"
                className={`role-tab ${activeRole === r.key ? "active" : ""}`}
                onClick={() => setActiveRole(r.key)}
              >
                <i className={`bi ${r.icon}`} />
                {r.label}
              </button>
            ))}
          </div>

          {deletedMsg && (
            <div className="deleted-alert">
              <i className="bi bi-check-circle-fill" />
              {deletedMsg}
            </div>
          )}

          {error && (
            <div className="err-alert">
              <i className="bi bi-exclamation-circle-fill" />
              {error}
            </div>
          )}

          <form onSubmit={handleSubmit} noValidate>
            <div className="mb-4">
              <label htmlFor="login-email" className="field-label">Email address</label>
              <div className={`lf-field ${error ? "lf-err" : ""}`}>
                <i className="bi bi-envelope lf-icon" />
                <input
                  id="login-email"
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

            <div className="mb-4">
              <label htmlFor="login-password" className="field-label">Password</label>
              <div className={`lf-field ${error ? "lf-err" : ""}`}>
                <i className="bi bi-lock lf-icon" />
                <input
                  id="login-password"
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

            <div className="extra-row">
              <div className="form-check mb-0">
                <input type="checkbox" id="remember" className="form-check-input"
                  checked={remember} onChange={(e) => setRemember(e.target.checked)} />
                <label className="form-check-label" htmlFor="remember">Remember me</label>
              </div>
              <Link to="/forgot-password" className="forgot-link">Forgot password?</Link>
            </div>

            <button type="submit" className="btn-submit" disabled={loading}>
              {loading ? (
                <><span className="spinner-border spinner-border-sm" />&nbsp;Signing in…</>
              ) : (
                <><i className="bi bi-box-arrow-in-right" />&nbsp;Sign In</>
              )}
            </button>
          </form>

          {/* ── Social login ────────────────────────── */}
          <div className="or-divider"><span>or continue with</span></div>

          <div className="social-grid">
            {/* Google */}
            <button className="social-btn social-google" onClick={() => googleLogin()} type="button">
              <svg width="18" height="18" viewBox="0 0 48 48">
                <path fill="#EA4335" d="M24 9.5c3.54 0 6.71 1.22 9.21 3.6l6.85-6.85C35.9 2.38 30.47 0 24 0 14.62 0 6.51 5.38 2.56 13.22l7.98 6.19C12.43 13.72 17.74 9.5 24 9.5z"/>
                <path fill="#4285F4" d="M46.98 24.55c0-1.57-.15-3.09-.38-4.55H24v9.02h12.94c-.58 2.96-2.26 5.48-4.78 7.18l7.73 6c4.51-4.18 7.09-10.36 7.09-17.65z"/>
                <path fill="#FBBC05" d="M10.53 28.59c-.48-1.45-.76-2.99-.76-4.59s.27-3.14.76-4.59l-7.98-6.19C.92 16.46 0 20.12 0 24c0 3.88.92 7.54 2.56 10.78l7.97-6.19z"/>
                <path fill="#34A853" d="M24 48c6.48 0 11.93-2.13 15.89-5.81l-7.73-6c-2.15 1.45-4.92 2.3-8.16 2.3-6.26 0-11.57-4.22-13.47-9.91l-7.98 6.19C6.51 42.62 14.62 48 24 48z"/>
              </svg>
              Google
            </button>

            {/* GitHub */}
            <button className="social-btn social-github" onClick={() => doRedirect("github")} type="button">
              <svg width="18" height="18" viewBox="0 0 16 16" fill="currentColor">
                <path d="M8 0C3.58 0 0 3.58 0 8c0 3.54 2.29 6.53 5.47 7.59.4.07.55-.17.55-.38 0-.19-.01-.82-.01-1.49-2.01.37-2.53-.49-2.69-.94-.09-.23-.48-.94-.82-1.13-.28-.15-.68-.52-.01-.53.63-.01 1.08.58 1.23.82.72 1.21 1.87.87 2.33.66.07-.52.28-.87.51-1.07-1.78-.2-3.64-.89-3.64-3.95 0-.87.31-1.59.82-2.15-.08-.2-.36-1.02.08-2.12 0 0 .67-.21 2.2.82.64-.18 1.32-.27 2-.27.68 0 1.36.09 2 .27 1.53-1.04 2.2-.82 2.2-.82.44 1.1.16 1.92.08 2.12.51.56.82 1.27.82 2.15 0 3.07-1.87 3.75-3.65 3.95.29.25.54.73.54 1.48 0 1.07-.01 1.93-.01 2.2 0 .21.15.46.55.38A8.013 8.013 0 0016 8c0-4.42-3.58-8-8-8z"/>
              </svg>
              GitHub
            </button>

            {/* Facebook */}
            <button className="social-btn social-facebook" onClick={() => doRedirect("facebook")} type="button">
              <svg width="18" height="18" viewBox="0 0 24 24" fill="#1877F2">
                <path d="M24 12.073c0-6.627-5.373-12-12-12s-12 5.373-12 12c0 5.99 4.388 10.954 10.125 11.854v-8.385H7.078v-3.47h3.047V9.43c0-3.007 1.792-4.669 4.533-4.669 1.312 0 2.686.235 2.686.235v2.953H15.83c-1.491 0-1.956.925-1.956 1.874v2.25h3.328l-.532 3.47h-2.796v8.385C19.612 23.027 24 18.062 24 12.073z"/>
              </svg>
              Facebook
            </button>

            {/* Microsoft */}
            <button className="social-btn social-microsoft" onClick={() => doRedirect("microsoft")} type="button">
              <svg width="18" height="18" viewBox="0 0 21 21">
                <rect x="1"  y="1"  width="9" height="9" fill="#F25022"/>
                <rect x="11" y="1"  width="9" height="9" fill="#7FBA00"/>
                <rect x="1"  y="11" width="9" height="9" fill="#00A4EF"/>
                <rect x="11" y="11" width="9" height="9" fill="#FFB900"/>
              </svg>
              Microsoft
            </button>
          </div>

          <div className="or-row mt-3">or</div>
          <p className="reg-line">
            Don&apos;t have an account?{" "}
            <Link to="/register">Create one</Link>
          </p>

        </div>
      </div>

    </div>
  );
}
