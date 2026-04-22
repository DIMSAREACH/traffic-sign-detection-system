import { useState, useMemo } from "react";
import { Link, useNavigate } from "react-router-dom";

import { register } from "../services/authService.js";
import "./Login.css";

const FIELDS = [
  { name: "email",      label: "Email address",  type: "email",    icon: "bi-envelope",    col: 12, required: true  },
  { name: "username",   label: "Username",        type: "text",     icon: "bi-person",      col: 12, required: true  },
  { name: "first_name", label: "First name",      type: "text",     icon: "bi-person-badge",col: 6,  required: false },
  { name: "last_name",  label: "Last name",       type: "text",     icon: "bi-person-badge",col: 6,  required: false },
  { name: "phone",      label: "Phone number",    type: "tel",      icon: "bi-telephone",   col: 12, required: false },
];

const REQUIREMENTS = [
  { key: "len",     label: "At least 8 characters",   test: (p) => p.length >= 8 },
  { key: "upper",   label: "One uppercase letter",     test: (p) => /[A-Z]/.test(p) },
  { key: "number",  label: "One number",               test: (p) => /[0-9]/.test(p) },
  { key: "special", label: "One special character",    test: (p) => /[^A-Za-z0-9]/.test(p) },
];

const STRENGTH_META = [
  { label: "Too short",  color: "#e5e7eb" },
  { label: "Weak",       color: "#ef4444" },
  { label: "Fair",       color: "#f97316" },
  { label: "Good",       color: "#eab308" },
  { label: "Strong",     color: "#22c55e" },
];

function calcStrength(pwd) {
  if (!pwd) return 0;
  return REQUIREMENTS.filter(r => r.test(pwd)).length;
}

export default function Register() {
  const navigate = useNavigate();
  const [showPwd,    setShowPwd]    = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);
  const [confirm,     setConfirm]     = useState("");
  const [errMsg,      setErrMsg]      = useState("");
  const [loading,     setLoading]     = useState(false);
  const [shake,       setShake]       = useState(false);
  const [pwdFocus,    setPwdFocus]    = useState(false);
  const [form,        setForm]        = useState({
    email: "", username: "", password: "", first_name: "", last_name: "", phone: "",
  });

  const strength = useMemo(() => calcStrength(form.password), [form.password]);
  const meta     = STRENGTH_META[strength];
  const reqs     = useMemo(() => REQUIREMENTS.map(r => ({ ...r, ok: r.test(form.password) })), [form.password]);
  const pwdMatch = confirm.length > 0 && form.password === confirm;

  const set = (name, val) => setForm((p) => ({ ...p, [name]: val }));

  const triggerShake = () => {
    setShake(true);
    setTimeout(() => setShake(false), 500);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (strength < 3) {
      setErrMsg("Please choose a stronger password before continuing.");
      triggerShake();
      return;
    }
    if (form.password !== confirm) {
      setErrMsg("Passwords do not match. Please try again.");
      triggerShake();
      return;
    }
    setErrMsg("");
    setLoading(true);
    try {
      await register(form);
      navigate("/login");
    } catch (err) {
      const msg =
        err?.response?.data?.email?.[0] ||
        err?.response?.data?.username?.[0] ||
        err?.response?.data?.detail ||
        "Registration failed. Please try again.";
      setErrMsg(msg);
      triggerShake();
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="auth-page">
      {/* left panel */}
      <div className="auth-left">
        <div className="auth-left-inner">

          {/* brand badge */}
          <div className="brand-badge">
            <i className="bi bi-camera-video-fill" />
            <span className="brand-badge-text">Traffic Expert System</span>
          </div>

          {/* hero */}
          <div className="auth-hero">
            <h2>Join the<br /><em>Platform</em></h2>
            <p>Create an account to access the Traffic Violation Expert System and manage road safety city-wide.</p>
          </div>

          {/* features */}
          <div className="auth-features">
            {[
              { icon: "bi-shield-lock-fill",  text: "Secure role-based access" },
              { icon: "bi-camera-reels-fill",  text: "Real-time AI detection"   },
              { icon: "bi-bar-chart-fill",     text: "Analytics & reporting"    },
              { icon: "bi-bell-fill",          text: "Instant violation alerts"  },
            ].map(({ icon, text }) => (
              <div key={text} className="feature-item">
                <span className="feature-icon"><i className={`bi ${icon}`} /></span>
                <span>{text}</span>
              </div>
            ))}
          </div>

          {/* footer */}
          <div className="auth-left-foot">
            <span>© {new Date().getFullYear()} Traffic Expert System</span>
            <div className="status-dot-row">
              <span className="status-dot" />
              All systems operational
            </div>
          </div>

        </div>
      </div>

      {/* right panel */}
      <div className="auth-right">
        <div className="login-box auth-form-wrap">
          <div className="form-header">
            <h3 className="form-title">Create account</h3>
            <p className="form-subtitle">Fill in the details below to get started</p>
          </div>

          {errMsg && (
            <div className={`err-alert d-flex align-items-center gap-2 ${shake ? "shake" : ""}`}>
              <i className="bi bi-exclamation-circle" />{errMsg}
            </div>
          )}

          <form onSubmit={handleSubmit} noValidate>
            <div className="row g-3">
              {FIELDS.map(({ name, label, type, icon, col, required }) => (
                <div key={name} className={`col-${col}`}>
                  <label className="field-label">{label}{required && <span style={{ color: "var(--auth-purple)" }}> *</span>}</label>
                  <div className="input-field">
                    <i className={`bi ${icon} field-icon`} />
                    <input
                      type={type}
                      className="field-input"
                      placeholder={label}
                      value={form[name]}
                      onChange={(e) => set(name, e.target.value)}
                      required={required}
                    />
                  </div>
                </div>
              ))}

              {/* password */}
              <div className="col-12">
                <label className="field-label">Password <span style={{ color: "var(--auth-purple)" }}>*</span></label>
                <div className={`input-field${strength > 0 && strength < 3 ? " pwd-weak" : ""}`}>
                  <i className="bi bi-lock field-icon" />
                  <input
                    type={showPwd ? "text" : "password"}
                    className="field-input"
                    placeholder="Create a strong password"
                    value={form.password}
                    onChange={(e) => set("password", e.target.value)}
                    onFocus={() => setPwdFocus(true)}
                    onBlur={() => setPwdFocus(false)}
                    required
                  />
                  <button type="button" className="pwd-toggle" onClick={() => setShowPwd(!showPwd)}>
                    <i className={`bi ${showPwd ? "bi-eye-slash" : "bi-eye"}`} />
                  </button>
                </div>

                {/* strength bar */}
                {form.password.length > 0 && (
                  <div className="pwd-strength-wrap">
                    <div className="pwd-strength-bars">
                      {[1, 2, 3, 4].map(i => (
                        <div
                          key={i}
                          className="pwd-strength-bar"
                          style={{ background: i <= strength ? meta.color : "#e8e0ff" }}
                        />
                      ))}
                    </div>
                    <span className="pwd-strength-label" style={{ color: meta.color }}>
                      {meta.label}
                    </span>
                  </div>
                )}

                {/* requirements checklist */}
                {(pwdFocus || form.password.length > 0) && (
                  <ul className="pwd-req-list">
                    {reqs.map(r => (
                      <li key={r.key} className={r.ok ? "req-ok" : "req-pending"}>
                        <i className={`bi ${r.ok ? "bi-check-circle-fill" : "bi-circle"}`} />
                        {r.label}
                      </li>
                    ))}
                  </ul>
                )}
              </div>

              {/* confirm password */}
              <div className="col-12">
                <label className="field-label">Confirm password <span style={{ color: "var(--auth-purple)" }}>*</span></label>
                <div className={`input-field${
                  confirm.length > 0 ? (pwdMatch ? " pwd-match" : " pwd-mismatch") : ""
                }`}>
                  <i className="bi bi-lock-fill field-icon" />
                  <input
                    type={showConfirm ? "text" : "password"}
                    className="field-input"
                    placeholder="Re-enter your password"
                    value={confirm}
                    onChange={(e) => setConfirm(e.target.value)}
                    required
                  />
                  <button type="button" className="pwd-toggle" onClick={() => setShowConfirm(v => !v)}>
                    <i className={`bi ${showConfirm ? "bi-eye-slash" : "bi-eye"}`} />
                  </button>
                  {confirm.length > 0 && (
                    <span className="confirm-badge">
                      <i className={`bi ${pwdMatch ? "bi-check-circle-fill" : "bi-x-circle-fill"}`} />
                    </span>
                  )}
                </div>
                {confirm.length > 0 && !pwdMatch && (
                  <p className="confirm-hint">Passwords do not match</p>
                )}
                {pwdMatch && (
                  <p className="confirm-hint confirm-ok">Passwords match ✓</p>
                )}
              </div>
            </div>

            <button type="submit" className="btn-submit mt-4" disabled={loading || strength < 3 || !pwdMatch}>
              {loading
                ? <><span className="spinner-border spinner-border-sm me-2" />Creating account…</>
                : <><i className="bi bi-person-plus me-2" />Create Account</>}
            </button>
          </form>

          <p className="reg-line mt-3">
            Already have an account?{" "}
            <Link to="/login">Sign in</Link>
          </p>
        </div>
      </div>
    </div>
  );
}
