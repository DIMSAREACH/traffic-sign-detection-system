import { useMemo, useState } from "react";
import { Link, useNavigate, useSearchParams } from "react-router-dom";

import { otpResetPassword } from "../services/authService.js";
import "./Login.css";

const RULES = [
  { id: "len", test: (p) => p.length >= 8, label: "At least 8 characters" },
  { id: "upper", test: (p) => /[A-Z]/.test(p), label: "One uppercase letter" },
  { id: "lower", test: (p) => /[a-z]/.test(p), label: "One lowercase letter" },
  { id: "num", test: (p) => /[0-9]/.test(p), label: "One number" },
  { id: "spec", test: (p) => /[!@#$%^&*]/.test(p), label: "One special char (!@#$%^&*)" },
];

function strength(p) {
  return RULES.filter((r) => r.test(p)).length;
}

const STRENGTH_LABEL = ["", "Weak", "Fair", "Good", "Strong", "Strong"];
const STRENGTH_CLASS = ["", "str-weak", "str-fair", "str-good", "str-strong", "str-strong"];

export default function ResetPassword() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const token = useMemo(() => (searchParams.get("token") || "").trim(), [searchParams]);

  const [pwd, setPwd] = useState("");
  const [confirm, setConfirm] = useState("");
  const [showPwd, setShowPwd] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);
  const [success, setSuccess] = useState(false);
  const [serverError, setServerError] = useState("");
  const [loading, setLoading] = useState(false);

  const pwdStrength = strength(pwd);
  const pwdMatch = confirm.length > 0 && pwd === confirm;
  const pwdMismatch = confirm.length > 0 && pwd !== confirm;

  const handleReset = async (e) => {
    e.preventDefault();
    if (!token) {
      setServerError("This link is missing a token. Open the link from your email or request a new one.");
      return;
    }
    if (!pwd) {
      setServerError("Please enter a new password.");
      return;
    }
    if (pwdStrength < 5) {
      setServerError("Password does not meet all requirements below.");
      return;
    }
    if (!confirm) {
      setServerError("Please confirm your new password.");
      return;
    }
    if (!pwdMatch) {
      setServerError("Passwords do not match.");
      return;
    }
    setServerError("");
    setLoading(true);
    try {
      await otpResetPassword(token, pwd, confirm);
      setSuccess(true);
      setTimeout(() => navigate("/login"), 3000);
    } catch (err) {
      setServerError(err?.response?.data?.detail ?? "Could not reset password.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="up-page">
      <div className="up-bg" />
      <div className="up-overlay" />

      <div className="up-inner">
        <div className="up-hero">
          <div className="up-badge">
            <i className="bi bi-shield-lock-fill" />
            <span>New password</span>
          </div>
          <h1 className="up-headline">
            Create a<br />
            Strong <em>Password</em>
          </h1>
          <p className="up-tagline">
            Choose a password you don&apos;t use elsewhere. After saving, sign in with your new credentials.
          </p>
          <ul className="up-features">
            {[
              { icon: "bi-key-fill", text: "Secure token from your email" },
              { icon: "bi-shield-check-fill", text: "One-time use reset link" },
              { icon: "bi-lock-fill", text: "Requirements enforced for your safety" },
            ].map(({ icon, text }) => (
              <li key={text}>
                <i className={`bi ${icon}`} />
                {text}
              </li>
            ))}
          </ul>
          <div className="up-footer" style={{ marginTop: "auto", paddingTop: "2rem" }}>
            <span className="up-status-dot" />
            © {new Date().getFullYear()} Traffic Expert System
          </div>
        </div>

        <div className="up-card-wrap">
          <div className="up-card">
            {!token && !success && (
              <>
                <div className="otp-icon-wrap">
                  <div className="otp-shield-icon">
                    <i className="bi bi-link-45deg" />
                  </div>
                </div>
                <h2 className="up-card-title text-center">Invalid or expired link</h2>
                <p className="up-card-sub text-center">
                  Use the <strong>Reset Password</strong> button in your email, or request a new reset link.
                </p>
                <Link to="/forgot-password" className="btn-submit text-center d-block" style={{ textDecoration: "none" }}>
                  <i className="bi bi-envelope-arrow-up" />
                  &nbsp;Forgot password
                </Link>
                <p className="up-register-line mt-3">
                  <Link to="/login">Sign in</Link>
                </p>
              </>
            )}

            {token && !success && (
              <>
                <div className="otp-icon-wrap">
                  <div className="otp-shield-icon">
                    <i className="bi bi-lock-fill" />
                  </div>
                </div>
                <h2 className="up-card-title text-center">Set new password</h2>
                <p className="up-card-sub text-center">Enter and confirm your new password below.</p>

                {serverError && (
                  <div className="err-alert mb-3">
                    <i className="bi bi-exclamation-circle-fill" /> {serverError}
                  </div>
                )}

                <form onSubmit={handleReset} noValidate>
                  <div className="mb-2">
                    <label className="field-label">New password</label>
                    <div className="lf-field">
                      <i className="bi bi-lock lf-icon" />
                      <input
                        type={showPwd ? "text" : "password"}
                        className="lf-input lf-input-pwd"
                        placeholder="••••••••"
                        value={pwd}
                        onChange={(e) => {
                          setPwd(e.target.value);
                          setServerError("");
                        }}
                        autoFocus
                        autoComplete="new-password"
                      />
                      <button
                        type="button"
                        className="lf-eye"
                        onClick={() => setShowPwd((v) => !v)}
                        tabIndex={-1}
                      >
                        <i className={`bi ${showPwd ? "bi-eye-slash" : "bi-eye"}`} />
                      </button>
                    </div>
                  </div>

                  {pwd && (
                    <>
                      <div className="pwd-strength-wrap mb-1">
                        <div className="pwd-strength-bars">
                          {[1, 2, 3, 4, 5].map((i) => (
                            <div
                              key={i}
                              className={`pwd-strength-bar ${pwdStrength >= i ? STRENGTH_CLASS[pwdStrength] : ""}`}
                            />
                          ))}
                        </div>
                        <span className={`pwd-strength-label ${STRENGTH_CLASS[pwdStrength]}`}>
                          {STRENGTH_LABEL[pwdStrength]}
                        </span>
                      </div>
                      <ul className="pwd-req-list mb-3">
                        {RULES.map((r) => (
                          <li key={r.id} className={r.test(pwd) ? "req-ok" : "req-pending"}>
                            <i className={`bi ${r.test(pwd) ? "bi-check-circle-fill" : "bi-circle"}`} />
                            {r.label}
                          </li>
                        ))}
                      </ul>
                    </>
                  )}

                  <div className="mb-4">
                    <label className="field-label">Confirm password</label>
                    <div className={`lf-field ${pwdMatch ? "lf-ok" : ""} ${pwdMismatch ? "lf-err" : ""}`}>
                      <i className="bi bi-shield-lock lf-icon" />
                      <input
                        type={showConfirm ? "text" : "password"}
                        className="lf-input lf-input-pwd"
                        placeholder="••••••••"
                        value={confirm}
                        onChange={(e) => setConfirm(e.target.value)}
                        autoComplete="new-password"
                      />
                      <button
                        type="button"
                        className="lf-eye"
                        onClick={() => setShowConfirm((v) => !v)}
                        tabIndex={-1}
                      >
                        <i className={`bi ${showConfirm ? "bi-eye-slash" : "bi-eye"}`} />
                      </button>
                    </div>
                    {pwdMismatch && <small className="confirm-hint">Passwords do not match</small>}
                    {pwdMatch && <small className="confirm-hint confirm-ok">Passwords match ✓</small>}
                  </div>

                  <button type="submit" className="btn-submit" disabled={loading}>
                    {loading ? (
                      <>
                        <span className="spinner-border spinner-border-sm" />
                        &nbsp;Saving…
                      </>
                    ) : (
                      <>
                        <i className="bi bi-check2-circle" />
                        &nbsp;Save new password
                      </>
                    )}
                  </button>
                </form>

                <p className="up-register-line mt-3">
                  <Link to="/login">Back to sign in</Link>
                </p>
              </>
            )}

            {success && (
              <div className="fp-success">
                <div className="fp-success-icon">
                  <i className="bi bi-patch-check-fill" />
                </div>
                <h2>Password updated</h2>
                <p>Your password has been changed. Redirecting to sign in…</p>
                <Link
                  to="/login"
                  className="btn-submit text-center d-block mt-3"
                  style={{ textDecoration: "none" }}
                >
                  <i className="bi bi-box-arrow-in-right" />
                  &nbsp;Sign in now
                </Link>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
