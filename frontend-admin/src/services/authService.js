import api from "./api.js";

/** Human-readable message from DRF validation (400) or generic axios errors. */
export function formatApiError(err, fallback = "Something went wrong. Please try again.") {
  const data = err?.response?.data;
  if (!data || typeof data !== "object") {
    return err?.message || fallback;
  }
  if (Array.isArray(data.non_field_errors) && data.non_field_errors.length) {
    return String(data.non_field_errors[0]);
  }
  if (typeof data.detail === "string") return data.detail;
  for (const [key, val] of Object.entries(data)) {
    if (Array.isArray(val) && val.length) return `${key}: ${val[0]}`;
    if (typeof val === "string") return `${key}: ${val}`;
  }
  return err?.message || fallback;
}

export async function login(credentials) {
  const body = { ...credentials };
  delete body.remember;
  const { data } = await api.post("auth/login/", body);
  return data;
}

export async function register(payload) {
  const { data } = await api.post("auth/register/", payload);
  return data;
}

export async function fetchProfile() {
  const { data } = await api.get("auth/profile/");
  return data;
}

export async function logout() {
  const { data } = await api.post("auth/logout/");
  return data;
}

export async function requestPasswordReset(email) {
  const { data } = await api.post("auth/password-reset/request/", { email });
  return data;
}

export async function confirmPasswordReset(payload) {
  // payload: { email, otp, new_password }
  const { data } = await api.post("auth/password-reset/confirm/", payload);
  return data;
}

// ── Backup / recovery email ───────────────────────────────────────────────────

/**
 * Initiate backup email verification.
 * Sends a 6-digit OTP to `backup_email`.
 */
export async function requestBackupEmail(backup_email) {
  const { data } = await api.post("auth/backup-email/", { backup_email });
  return data; // { success, masked_email, expires_in_seconds }
}

/**
 * Confirm backup email with the OTP received.
 */
export async function confirmBackupEmail(otp_code) {
  const { data } = await api.post("auth/backup-email/confirm/", { otp_code });
  return data; // { success, backup_email, backup_email_verified }
}

/**
 * Remove the backup / recovery email.
 */
export async function removeBackupEmail() {
  const { data } = await api.delete("auth/backup-email/");
  return data; // { success, message }
}

/**
 * Forgot password — request a reset link emailed to the user (magic link; no numeric code).
 * @param {string} identifier  email address OR username
 * @returns {{ success, message, masked_email, expires_in_seconds, otp_delivery?: 'resend'|'smtp'|'console' }}
 */
export async function otpRequest(identifier) {
  const { data } = await api.post("auth/otp/request/", { identifier });
  return data;
}

/**
 * Legacy: verify a 6-digit OTP and obtain a short-lived reset_token (optional; link flow uses token in URL).
 * @param {string} identifier
 * @param {string} otp_code
 * @returns {{ success, reset_token, expires_in_minutes }}
 */
export async function otpVerify(identifier, otp_code) {
  const { data } = await api.post("auth/otp/verify/", { identifier, otp_code });
  return data;
}

/**
 * Set a new password using the reset token from the email link (or from otpVerify).
 * @param {string} reset_token
 * @param {string} new_password
 * @param {string} confirm_password
 * @returns {{ success, message }}
 */
export async function otpResetPassword(reset_token, new_password, confirm_password) {
  const { data } = await api.post("auth/otp/reset-password/", {
    reset_token,
    new_password,
    confirm_password,
  });
  return data;
}

export async function updateProfile(payload) {
  const { data } = await api.patch("auth/profile/", payload);
  return data;
}

export async function uploadAvatar(file) {
  const form = new FormData();
  form.append("avatar", file);
  // Let axios set Content-Type with boundary (manual "multipart/form-data" breaks uploads).
  const { data } = await api.post("auth/avatar/", form);
  return data; // returns updated user with avatar_url
}

export async function changePassword(payload) {
  // payload: { current_password, new_password }
  const { data } = await api.post("auth/change-password/", payload);
  return data;
}

export async function deleteAccount(password) {
  const { data } = await api.post("auth/delete-account/", { password });
  return data;
}

export async function requestEmailChange(new_email) {
  const { data } = await api.post("auth/change-email/request/", { new_email });
  return data; // { detail, otp } – otp exposed for demo
}

export async function confirmEmailChange(otp) {
  const { data } = await api.post("auth/change-email/confirm/", { otp });
  return data; // returns updated user
}

/**
 * Social OAuth login.
 * @param {"google"|"github"|"facebook"|"microsoft"} provider
 * @param {object} payload  - { access_token } for Google
 *                          - { code, redirect_uri } for GitHub/Facebook/Microsoft
 */
export async function socialLogin(provider, payload) {
  const { data } = await api.post(`auth/social/${provider}/`, payload);
  return data; // { access, refresh, user }
}
