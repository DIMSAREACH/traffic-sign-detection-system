import api from "./api.js";

export async function login(credentials) {
  const { data } = await api.post("/auth/login/", credentials);
  return data;
}

export async function register(payload) {
  const { data } = await api.post("/auth/register/", payload);
  return data;
}

export async function fetchProfile() {
  const { data } = await api.get("/auth/profile/");
  return data;
}

export async function requestPasswordReset(email) {
  const { data } = await api.post("/auth/password-reset/request/", { email });
  return data; // { detail, otp } – otp exposed for demo
}

export async function confirmPasswordReset(payload) {
  // payload: { email, otp, new_password }
  const { data } = await api.post("/auth/password-reset/confirm/", payload);
  return data;
}

export async function updateProfile(payload) {
  const { data } = await api.patch("/auth/profile/", payload);
  return data;
}

export async function uploadAvatar(file) {
  const form = new FormData();
  form.append("avatar", file);
  const { data } = await api.post("/auth/avatar/", form, {
    headers: { "Content-Type": "multipart/form-data" },
  });
  return data; // returns updated user with avatar_url
}

export async function changePassword(payload) {
  // payload: { current_password, new_password }
  const { data } = await api.post("/auth/change-password/", payload);
  return data;
}

export async function deleteAccount(password) {
  const { data } = await api.post("/auth/delete-account/", { password });
  return data;
}

/**
 * Social OAuth login.
 * @param {"google"|"github"|"facebook"|"microsoft"} provider
 * @param {object} payload  - { access_token } for Google
 *                          - { code, redirect_uri } for GitHub/Facebook/Microsoft
 */
export async function socialLogin(provider, payload) {
  const { data } = await api.post(`/auth/social/${provider}/`, payload);
  return data; // { access, refresh, user }
}
