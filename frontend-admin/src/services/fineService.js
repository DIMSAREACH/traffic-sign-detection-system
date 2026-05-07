import api from "./api.js";

export async function listFines(params = {}) {
  const { data } = await api.get("/violations/fines/", { params });
  return data;
}

export async function fetchFine(id) {
  const { data } = await api.get(`/violations/fines/${id}/`);
  return data;
}

export async function fetchFineSummary() {
  const { data } = await api.get("/violations/fines/summary/");
  return data;
}

export async function updateFine(id, payload) {
  const { data } = await api.patch(`/violations/fines/${id}/`, payload);
  return data;
}

export async function payFine(id) {
  const { data } = await api.post(`/violations/fines/${id}/pay/`);
  return data;
}

/** @deprecated Use payFine() instead */
export async function markFinePaid(id) {
  return payFine(id);
}
