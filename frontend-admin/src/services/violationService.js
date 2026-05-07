import api from "./api.js";

export async function listViolations(params = {}) {
  const { data } = await api.get("/violations/", { params });
  return data;
}

export async function fetchViolation(id) {
  const { data } = await api.get(`/violations/${id}/`);
  return data;
}

export async function createViolation(payload) {
  const { data } = await api.post("/violations/", payload);
  return data;
}

export async function updateViolation(id, payload) {
  const { data } = await api.patch(`/violations/${id}/`, payload);
  return data;
}

export async function deleteViolation(id) {
  await api.delete(`/violations/${id}/`);
}

export async function updateViolationStatus(id, status) {
  const { data } = await api.put(`/violations/${id}/status/`, { status });
  return data;
}

export async function bulkUpdateStatus(ids, status) {
  const { data } = await api.post("/violations/bulk-status/", { ids, status });
  return data;
}

export async function bulkDeleteViolations(ids) {
  const { data } = await api.post("/violations/bulk-delete/", { ids });
  return data;
}
