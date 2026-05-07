import { useEffect, useState } from "react";
import { useNavigate, useParams, useSearchParams } from "react-router-dom";

import { useAuth, getRoleHomePath } from "../context/AuthContext.jsx";
import { socialLogin } from "../services/authService.js";

/** Dev Strict Mode runs effects twice; OAuth codes are single-use — dedupe exchange. */
const _oauthInflight = new Map();

/**
 * Handles the redirect callback from GitHub / Facebook / Microsoft OAuth.
 * URL pattern:  /auth/callback/:provider?code=...
 */
export default function OAuthCallback() {
  const { provider }            = useParams();
  const [searchParams]          = useSearchParams();
  const navigate                = useNavigate();
  const { loginFromData }       = useAuth();
  const [errorMsg, setErrorMsg] = useState("");

  useEffect(() => {
    const code      = searchParams.get("code");
    const oauthErr  = searchParams.get("error");

    if (oauthErr) {
      setErrorMsg("Authorization was denied by the provider.");
      setTimeout(() => navigate("/login"), 2500);
      return;
    }

    if (!code || !provider) {
      navigate("/login");
      return;
    }

    // The redirect_uri sent to the provider must match exactly what we register
    const redirectUri = `${window.location.origin}/auth/callback/${provider}`;

    const dedupeKey = `${provider}:${code}`;
    let entry = _oauthInflight.get(dedupeKey);
    if (!entry) {
      entry = {
        promise: socialLogin(provider, { code, redirect_uri: redirectUri }),
        settled: false,
      };
      _oauthInflight.set(dedupeKey, entry);
    }

    entry.promise
      .then((data) => {
        if (entry.settled) return;
        entry.settled = true;
        const u = loginFromData(data);
        navigate(u?.role === "driver" ? "/user" : getRoleHomePath(u?.role), { replace: true });
      })
      .catch((err) => {
        if (entry.settled) return;
        entry.settled = true;
        const msg = err?.response?.data?.detail ?? "Social login failed. Please try again.";
        setErrorMsg(msg);
        setTimeout(() => navigate("/login"), 2500);
      });
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  return (
    <div
      style={{
        minHeight: "100vh",
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        justifyContent: "center",
        gap: "1rem",
        background: "#0f0b1a",
        color: "#c4b5fd",
        fontFamily: "Inter, sans-serif",
      }}
    >
      {errorMsg ? (
        <>
          <i className="bi bi-exclamation-circle-fill" style={{ fontSize: "2.5rem", color: "#f87171" }} />
          <p style={{ color: "#f87171", maxWidth: "360px", textAlign: "center" }}>{errorMsg}</p>
          <p style={{ fontSize: ".85rem", opacity: .6 }}>Redirecting to login…</p>
        </>
      ) : (
        <>
          <div
            style={{
              width: "3rem", height: "3rem",
              border: "3px solid rgba(124,58,237,.35)",
              borderTop: "3px solid #7c3aed",
              borderRadius: "50%",
              animation: "spin 0.8s linear infinite",
            }}
          />
          <style>{`@keyframes spin{to{transform:rotate(360deg)}}`}</style>
          <p style={{ opacity: .8, textTransform: "capitalize" }}>
            Signing in with {provider}…
          </p>
        </>
      )}
    </div>
  );
}
