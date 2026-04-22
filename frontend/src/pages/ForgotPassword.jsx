import { useState, useEffect, useRef } from "react";
import { Link, useNavigate } from "react-router-dom";

import {
  requestPasswordReset,
  confirmPasswordReset,
} from "../services/authService.js";
import "./Login.css"; // reuses .otp-digit, .lf-field, .pwd-strength-bar, etc.

// ── password-strength helpers ────────────────────────────────────────────────
const RULES = [
  { id: "len",   test: (p) => p.length >= 8,          label: "At least 8 characters" },
  { id: "upper", test: (p) => /[A-Z]/.test(p),        label: "One uppercase letter" },
  { id: "num",   test: (p) => /[0-9]/.test(p),        label: "One number" },
  { id: "spec",  test: (p) => /[^A-Za-z0-9]/.test(p), label: "One special character" },
];
function strength(p) { return RULES.filter((r) => r.test(p)).length; }
const STRENGTH_LABEL = ["", "Weak", "Fair", "Good", "Strong"];
const STRENGTH_CLASS = ["", "str-weak", "str-fair", "str-good", "str-strong"];

const OTP_LEN = 6;
const OTP_TTL = 60; // countdown seconds

// ── component ────────────────────────────────────────────────────────────────
export default function ForgotPassword() {
  const navigate = useNavigate();

  /* shared */
  const [step,    setStep]    = useState("email"); // "email" | "otp" | "reset"
  const [email,   setEmail]   = useState("");
  const [serverError, setServerError] = useState("");
  const [loading, setLoading] = useState(false);

  /* step 1 */
  const [demoOtp, setDemoOtp] = useState(""); // backend echoes OTP for demo

  /* step 2 – OTP */
  const [digits,    setDigits]    = useState(Array(OTP_LEN).fill(""));
  const [otpError,  setOtpError]  = useState("");
  const [timer,     setTimer]     = useState(OTP_TTL);
  const digitRefs = useRef([]);

  /* step 3 – new password */
  const [pwd,         setPwd]         = useState("");
  const [confirm,     setConfirm]     = useState("");
  const [showPwd,     setShowPwd]     = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);
  const [success,     setSuccess]     = useState(false);

  const pwdStrength = strength(pwd);
  const pwdMatch    = confirm.length > 0 && pwd === confirm;
  const pwdMismatch = confirm.length > 0 && pwd !== confirm;

  /* countdown timer (active only during OTP step) */
  useEffect(() => {
    if (step !== "otp") return;
    setTimer(OTP_TTL);
    const id = setInterval(() => setTimer((t) => (t > 0 ? t - 1 : 0)), 1000);
    return () => clearInterval(id);
  }, [step]);

  // ── handlers ──────────────────────────────────────────────────────────────

  /* Step 1: request OTP */
  const handleRequestOtp = async (e) => {
    e.preventDefault();
    setServerError("");
    setLoading(true);
    try {
      const res = await requestPasswordReset(email.trim().toLowerCase());
      setDemoOtp(res.otp ?? "");
      setDigits(Array(OTP_LEN).fill(""));
      setStep("otp");
      setTimeout(() => digitRefs.current[0]?.focus(), 50);
    } catch (err) {
      setServerError(err?.response?.data?.detail ?? "Something went wrong.");
    } finally {
      setLoading(false);
    }
  };

  /* Step 1: resend OTP (re-uses same handler) */
  const handleResend = async () => {
    if (timer > 0) return;
    setServerError("");
    setOtpError("");
    setLoading(true);
    try {
      const res = await requestPasswordReset(email.trim().toLowerCase());
      setDemoOtp(res.otp ?? "");
      setDigits(Array(OTP_LEN).fill(""));
      setTimer(OTP_TTL);
      setTimeout(() => digitRefs.current[0]?.focus(), 50);
    } catch (err) {
      setServerError(err?.response?.data?.detail ?? "Could not resend OTP.");
    } finally {
      setLoading(false);
    }
  };

  /* Step 2: OTP digit input */
  const handleDigit = (idx, value) => {
    const ch = value.replace(/\D/g, "").slice(-1);
    const next = [...digits];
    next[idx] = ch;
    setDigits(next);
    setOtpError("");
    if (ch && idx < OTP_LEN - 1) digitRefs.current[idx + 1]?.focus();
  };

  const handleDigitKey = (idx, e) => {
    if (e.key === "Backspace" && !digits[idx] && idx > 0)
      digitRefs.current[idx - 1]?.focus();
    if (e.key === "ArrowLeft"  && idx > 0)       digitRefs.current[idx - 1]?.focus();
    if (e.key === "ArrowRight" && idx < OTP_LEN - 1) digitRefs.current[idx + 1]?.focus();
  };

  const handleDigitPaste = (e) => {
    e.preventDefault();
    const pasted = e.clipboardData.getData("text").replace(/\D/g, "").slice(0, OTP_LEN);
    const next = [...digits];
    for (let i = 0; i < pasted.length; i++) next[i] = pasted[i];
    setDigits(next);
    digitRefs.current[Math.min(pasted.length, OTP_LEN - 1)]?.focus();
  };

  /* Step 2: verify OTP (client-side check vs demoOtp) */
  const handleVerifyOtp = (e) => {
    e.preventDefault();
    const entered = digits.join("");
    if (entered.length < OTP_LEN) { setOtpError("Please fill all 6 digits."); return; }
    if (entered !== demoOtp) { setOtpError("Incorrect OTP. Please try again."); return; }
    setOtpError("");
    setPwd(""); setConfirm("");
    setStep("reset");
  };

  /* Step 3: reset password */
  const handleReset = async (e) => {
    e.preventDefault();
    if (pwdStrength < 3) { setServerError("Password is too weak."); return; }
    if (!pwdMatch)       { setServerError("Passwords do not match."); return; }
    setServerError("");
    setLoading(true);
    try {
      await confirmPasswordReset({ email, otp: demoOtp, new_password: pwd });
      setSuccess(true);
      setTimeout(() => navigate("/login"), 2500);
    } catch (err) {
      setServerError(err?.response?.data?.detail ?? "Could not reset password.");
    } finally {
      setLoading(false);
    }
  };

  // ── render ─────────────────────────────────────────────────────────────────
  return (
    <div className="auth-page">

      {/* LEFT PANEL */}
      <div className="auth-left">
        <div className="auth-left-inner">
          <div className="brand-badge">
            <i className="bi bi-camera-video-fill" />
            <span className="brand-badge-text">Traffic Expert System</span>
          </div>

          <h1 className="auth-headline">
            Account<br />
            <em>Recovery</em>
          </h1>
          <p className="auth-tagline">
            Securely reset your password in three simple steps. Your access to
            the city-wide enforcement dashboard will be restored instantly.
          </p>

          <ul className="feat-list">
            {[
              { icon: "bi-shield-check-fill", text: "Secure OTP verification" },
              { icon: "bi-lock-fill",          text: "End-to-end encrypted reset" },
              { icon: "bi-clock-fill",         text: "OTP valid for 5 minutes" },
              { icon: "bi-arrow-counterclockwise", text: "Instant access restoration" },
            ].map(({ icon, text }) => (
              <li key={text}>
                <span className="feat-icon"><i className={`bi ${icon}`} /></span>
                {text}
              </li>
            ))}
          </ul>

          {/* step indicator */}
          <div className="fp-steps">
            {["Email", "Verify OTP", "New Password"].map((lbl, i) => {
              const stepKey = ["email", "otp", "reset"][i];
              const done    = ["email", "otp", "reset"].indexOf(step) > i;
              const active  = step === stepKey;
              return (
                <div key={lbl} className={`fp-step ${active ? "fp-step-active" : ""} ${done ? "fp-step-done" : ""}`}>
                  <span className="fp-step-num">{done ? <i className="bi bi-check2" /> : i + 1}</span>
                  <span className="fp-step-lbl">{lbl}</span>
                </div>
              );
            })}
          </div>

          <div className="auth-left-foot">
            <span>© {new Date().getFullYear()} Traffic Expert System</span>
            <div className="status-dot-row">
              <span className="status-dot" />All systems operational
            </div>
          </div>
        </div>
      </div>

      {/* RIGHT PANEL */}
      <div className="auth-right">
        <div className="login-box">

          {/* ── STEP 1: EMAIL ───────────────────────────────────────── */}
          {step === "email" && (
            <>
              <div className="login-heading mb-3">
                <h2>Forgot Password?</h2>
                <p>Enter your email and we'll send you a verification code.</p>
              </div>
              <hr className="thin-hr" />

              {serverError && (
                <div className="err-alert">
                  <i className="bi bi-exclamation-circle-fill" /> {serverError}
                </div>
              )}

              <form onSubmit={handleRequestOtp} noValidate>
                <div className="mb-4">
                  <label className="field-label">Email address</label>
                  <div className="lf-field">
                    <i className="bi bi-envelope lf-icon" />
                    <input
                      type="email"
                      className="lf-input"
                      placeholder="you@example.com"
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      required
                      autoFocus
                    />
                  </div>
                </div>

                <button type="submit" className="btn-submit" disabled={loading || !email.trim()}>
                  {loading
                    ? <><span className="spinner-border spinner-border-sm" />&nbsp;Sending…</>
                    : <><i className="bi bi-send-fill" />&nbsp;Send OTP</>}
                </button>
              </form>

              <div className="or-row">or</div>
              <p className="reg-line">
                Remember it? <Link to="/login">Sign in</Link>
              </p>
            </>
          )}

          {/* ── STEP 2: OTP ─────────────────────────────────────────── */}
          {step === "otp" && (
            <>
              <div className="login-heading mb-3">
                <h2>Enter OTP</h2>
                <p>
                  A 6-digit code was sent to <strong>{email}</strong>.<br />
                  {demoOtp && <span className="otp-demo-banner">Demo — your code: <b>{demoOtp}</b></span>}
                </p>
              </div>
              <hr className="thin-hr" />

              {(serverError || otpError) && (
                <div className="err-alert">
                  <i className="bi bi-exclamation-circle-fill" /> {serverError || otpError}
                </div>
              )}

              <form onSubmit={handleVerifyOtp} noValidate>
                <div className="otp-digits-row mb-4">
                  {digits.map((d, i) => (
                    <input
                      key={i}
                      ref={(el) => (digitRefs.current[i] = el)}
                      className={`otp-digit ${otpError ? "otp-digit-err" : ""}`}
                      type="text"
                      inputMode="numeric"
                      maxLength={1}
                      value={d}
                      onChange={(e) => handleDigit(i, e.target.value)}
                      onKeyDown={(e) => handleDigitKey(i, e)}
                      onPaste={handleDigitPaste}
                    />
                  ))}
                </div>

                <div className="otp-timer-row">
                  {timer > 0 ? (
                    <span className="otp-timer-text">
                      <i className="bi bi-clock" /> Code expires in {timer}s
                    </span>
                  ) : (
                    <span className="otp-timer-text otp-expired">Code expired</span>
                  )}
                  <button
                    type="button"
                    className="otp-resend"
                    disabled={timer > 0 || loading}
                    onClick={handleResend}
                  >
                    <i className="bi bi-arrow-clockwise" /> Resend
                  </button>
                </div>

                <button type="submit" className="btn-submit">
                  <i className="bi bi-patch-check-fill" />&nbsp;Verify Code
                </button>
              </form>

              <p className="reg-line mt-3">
                <button
                  type="button"
                  className="otp-back"
                  onClick={() => { setStep("email"); setServerError(""); }}
                >
                  <i className="bi bi-arrow-left" /> Back to email
                </button>
              </p>
            </>
          )}

          {/* ── STEP 3: NEW PASSWORD ─────────────────────────────────── */}
          {step === "reset" && !success && (
            <>
              <div className="login-heading mb-3">
                <h2>Set New Password</h2>
                <p>Choose a strong password for your account.</p>
              </div>
              <hr className="thin-hr" />

              {serverError && (
                <div className="err-alert">
                  <i className="bi bi-exclamation-circle-fill" /> {serverError}
                </div>
              )}

              <form onSubmit={handleReset} noValidate>
                {/* new password */}
                <div className="mb-2">
                  <label className="field-label">New Password</label>
                  <div className="lf-field">
                    <i className="bi bi-lock lf-icon" />
                    <input
                      type={showPwd ? "text" : "password"}
                      className="lf-input lf-input-pwd"
                      placeholder="••••••••"
                      value={pwd}
                      onChange={(e) => setPwd(e.target.value)}
                      required
                      autoFocus
                    />
                    <button type="button" className="lf-eye" onClick={() => setShowPwd(v => !v)} tabIndex={-1}>
                      <i className={`bi ${showPwd ? "bi-eye-slash" : "bi-eye"}`} />
                    </button>
                  </div>
                </div>

                {/* strength meter */}
                {pwd && (
                  <div className="pwd-strength mb-2">
                    <div className="pwd-strength-bars">
                      {[1, 2, 3, 4].map((i) => (
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
                )}

                {/* requirements */}
                {pwd && (
                  <ul className="pwd-req-list mb-3">
                    {RULES.map((r) => (
                      <li key={r.id} className={r.test(pwd) ? "req-ok" : "req-no"}>
                        <i className={`bi ${r.test(pwd) ? "bi-check-circle-fill" : "bi-circle"}`} />
                        {r.label}
                      </li>
                    ))}
                  </ul>
                )}

                {/* confirm password */}
                <div className="mb-4">
                  <label className="field-label">Confirm Password</label>
                  <div className={`lf-field ${pwdMatch ? "lf-ok" : ""} ${pwdMismatch ? "lf-err" : ""}`}>
                    <i className="bi bi-shield-lock lf-icon" />
                    <input
                      type={showConfirm ? "text" : "password"}
                      className="lf-input lf-input-pwd"
                      placeholder="••••••••"
                      value={confirm}
                      onChange={(e) => setConfirm(e.target.value)}
                      required
                    />
                    <button type="button" className="lf-eye" onClick={() => setShowConfirm(v => !v)} tabIndex={-1}>
                      <i className={`bi ${showConfirm ? "bi-eye-slash" : "bi-eye"}`} />
                    </button>
                    {pwdMatch    && <i className="bi bi-check-circle-fill lf-match-icon" />}
                    {pwdMismatch && <i className="bi bi-x-circle-fill lf-mismatch-icon" />}
                  </div>
                  {pwdMismatch && <small className="conf-hint conf-no">Passwords do not match</small>}
                  {pwdMatch    && <small className="conf-hint conf-ok">Passwords match</small>}
                </div>

                <button
                  type="submit"
                  className="btn-submit"
                  disabled={loading || pwdStrength < 3 || !pwdMatch}
                >
                  {loading
                    ? <><span className="spinner-border spinner-border-sm" />&nbsp;Saving…</>
                    : <><i className="bi bi-check2-circle" />&nbsp;Reset Password</>}
                </button>
              </form>
            </>
          )}

          {/* ── SUCCESS ─────────────────────────────────────────────── */}
          {success && (
            <div className="fp-success">
              <div className="fp-success-icon"><i className="bi bi-patch-check-fill" /></div>
              <h2>Password Reset!</h2>
              <p>Your password has been changed successfully. Redirecting to sign in…</p>
              <Link to="/login" className="btn-submit text-center d-block mt-3">
                <i className="bi bi-box-arrow-in-right" />&nbsp;Sign In Now
              </Link>
            </div>
          )}

        </div>
      </div>
    </div>
  );
}
