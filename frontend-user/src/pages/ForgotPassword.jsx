import { useState } from "react";
import { Link } from "react-router-dom";

import { formatApiError, otpRequest } from "../services/authService.js";
import "./Login.css";

function formatLinkExpiry(seconds) {
  if (typeof seconds !== "number" || seconds <= 0) return "a limited time";
  if (seconds >= 3600) {
    const h = Math.round(seconds / 3600);
    return h === 1 ? "1 hour" : `${h} hours`;
  }
  if (seconds >= 60) {
    const m = Math.round(seconds / 60);
    return m === 1 ? "1 minute" : `${m} minutes`;
  }
  return `${seconds} seconds`;
}

export default function ForgotPassword() {
  const [step, setStep] = useState("identifier");
  const [identifier, setIdentifier] = useState("");
  const [maskedEmail, setMaskedEmail] = useState("");
  const [expiresInSeconds, setExpiresInSeconds] = useState(0);
  const [serverError, setServerError] = useState("");
  const [deliveryNotice, setDeliveryNotice] = useState("");
  const [loading, setLoading] = useState(false);

  const sendLink = async () => {
    setServerError("");
    setDeliveryNotice("");
    setLoading(true);
    try {
      const res = await otpRequest(identifier.trim());
      const ttl =
        typeof res.expires_in_seconds === "number" && res.expires_in_seconds > 0
          ? res.expires_in_seconds
          : 3600;
      setExpiresInSeconds(ttl);
      setMaskedEmail(res.masked_email || "your registered email");
      setDeliveryNotice(
        res.otp_delivery === "console"
          ? "Development mode: the reset link is logged on the Django server. Configure Resend or SMTP in backend/.env for real email."
          : ""
      );
      setStep("sent");
    } catch (err) {
      setServerError(formatApiError(err, "Something went wrong. Please try again."));
    } finally {
      setLoading(false);
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!identifier.trim()) {
      setServerError("Please enter your email address or username.");
      return;
    }
    await sendLink();
  };

  const expiryLabel = formatLinkExpiry(expiresInSeconds);

  return (
    <div className="up-page">
      <div className="up-bg" />
      <div className="up-overlay" />

      <div className="up-inner">
        <div className="up-hero">
          <div className="up-badge">
            <i className="bi bi-shield-lock-fill" />
            <span>Account Recovery</span>
          </div>
          <h1 className="up-headline">
            Reset Your<br />
            Password <em>Securely</em>
          </h1>
          <p className="up-tagline">
            Enter your email or username and we&apos;ll send a secure link to choose a new password.
          </p>
          <ul className="up-features">
            {[
              { icon: "bi-person-check-fill", text: "Email or username lookup" },
              { icon: "bi-envelope-check-fill", text: "One-click reset from your inbox" },
              { icon: "bi-lock-fill", text: "Link expires automatically" },
              { icon: "bi-arrow-counterclockwise", text: "Request a new link anytime" },
            ].map(({ icon, text }) => (
              <li key={text}>
                <i className={`bi ${icon}`} />
                {text}
              </li>
            ))}
          </ul>

          <div className="fp-steps" style={{ marginTop: "2rem" }}>
            {["Your account", "Check email"].map((lbl, i) => {
              const done = step === "sent" && i === 0;
              const active = (step === "identifier" && i === 0) || (step === "sent" && i === 1);
              return (
                <div
                  key={lbl}
                  className={`fp-step ${active ? "fp-step-active" : ""} ${done ? "fp-step-done" : ""}`}
                >
                  <span className="fp-step-num">
                    {done ? <i className="bi bi-check2" /> : i + 1}
                  </span>
                  <span>{lbl}</span>
                </div>
              );
            })}
          </div>

          <div className="up-footer" style={{ marginTop: "auto", paddingTop: "2rem" }}>
            <span className="up-status-dot" />
            All systems operational &nbsp;·&nbsp; © {new Date().getFullYear()} Traffic Expert System
          </div>
        </div>

        <div className="up-card-wrap">
          <div className="up-card">
            {step === "identifier" && (
              <>
                <div className="otp-icon-wrap">
                  <div className="otp-shield-icon">
                    <i className="bi bi-person-circle" />
                  </div>
                </div>
                <h2 className="up-card-title text-center">Forgot Password?</h2>
                <p className="up-card-sub text-center">
                  Enter your <strong>email address</strong> or <strong>username</strong>. We&apos;ll email you a
                  button to <strong>Reset Password</strong> that opens this site so you can set a new password.
                </p>

                {serverError && (
                  <div className="err-alert mb-3">
                    <i className="bi bi-exclamation-circle-fill" /> {serverError}
                  </div>
                )}

                <form onSubmit={handleSubmit} noValidate>
                  <div className="mb-4">
                    <label className="field-label">Email address or Username</label>
                    <div className="lf-field">
                      <i className="bi bi-person lf-icon" />
                      <input
                        type="text"
                        className="lf-input"
                        placeholder="you@example.com or your_username"
                        value={identifier}
                        onChange={(e) => {
                          setIdentifier(e.target.value);
                          setServerError("");
                        }}
                        autoFocus
                        autoComplete="username"
                      />
                    </div>
                  </div>
                  <button type="submit" className="btn-submit" disabled={loading}>
                    {loading ? (
                      <>
                        <span className="spinner-border spinner-border-sm" />
                        &nbsp;Sending…
                      </>
                    ) : (
                      <>
                        <i className="bi bi-send-fill" />
                        &nbsp;Send reset link
                      </>
                    )}
                  </button>
                </form>

                <p className="up-register-line mt-3">
                  Remember it? <Link to="/login">Sign in</Link>
                </p>
              </>
            )}

            {step === "sent" && (
              <>
                <div className="otp-icon-wrap">
                  <div className="otp-shield-icon">
                    <i className="bi bi-envelope-check-fill" />
                  </div>
                </div>
                <h2 className="up-card-title text-center">Check your email</h2>
                <p className="up-card-sub text-center">
                  We sent a password reset link to <strong>{maskedEmail}</strong>. Open the email and click{" "}
                  <strong>Reset Password</strong>. The link is valid for about <strong>{expiryLabel}</strong>.
                </p>

                {deliveryNotice && (
                  <div
                    className="mb-3"
                    style={{
                      background: "rgba(14,116,144,.1)",
                      border: "1px solid rgba(14,116,144,.35)",
                      borderRadius: 10,
                      padding: "12px 14px",
                      fontSize: ".85rem",
                      color: "var(--text-color, #0e7490)",
                      lineHeight: 1.45,
                    }}
                  >
                    <i className="bi bi-info-circle-fill me-2" />
                    {deliveryNotice}
                  </div>
                )}

                {serverError && (
                  <div className="err-alert mb-3">
                    <i className="bi bi-exclamation-circle-fill" /> {serverError}
                  </div>
                )}

                <button
                  type="button"
                  className="btn-submit"
                  disabled={loading}
                  onClick={async () => {
                    setServerError("");
                    setLoading(true);
                    try {
                      await sendLink();
                    } finally {
                      setLoading(false);
                    }
                  }}
                >
                  {loading ? (
                    <>
                      <span className="spinner-border spinner-border-sm" />
                      &nbsp;Sending…
                    </>
                  ) : (
                    <>
                      <i className="bi bi-arrow-clockwise" />
                      &nbsp;Resend link
                    </>
                  )}
                </button>

                <p className="up-register-line mt-3">
                  <button
                    type="button"
                    className="otp-back"
                    onClick={() => {
                      setStep("identifier");
                      setServerError("");
                    }}
                  >
                    <i className="bi bi-arrow-left" /> Use a different email or username
                  </button>
                </p>
                <p className="up-register-line">
                  <Link to="/login">Back to sign in</Link>
                </p>
              </>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
