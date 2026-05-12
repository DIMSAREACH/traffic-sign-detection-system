import api from "./api.js";

export async function listDrivers(params = {}) {
  const { data } = await api.get("drivers/", { params });
  return data;
}

export async function fetchDriver(id) {
  const { data } = await api.get(`/drivers/${id}/`);
  return data;
}

export async function createDriver(payload) {
  const { data } = await api.post("drivers/", payload);
  return data;
}

export async function updateDriver(id, payload) {
  const { data } = await api.patch(`/drivers/${id}/`, payload);
  return data;
}

export async function deleteDriver(id) {
  const { data } = await api.delete(`/drivers/${id}/`);
  return data;
}
