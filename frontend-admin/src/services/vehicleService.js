import api from "./api.js";

export async function listVehicles(params = {}) {
  const { data } = await api.get("/vehicles/", { params });
  return data;
}

export async function getVehicle(id) {
  const { data } = await api.get(`/vehicles/${id}/`);
  return data;
}

export async function createVehicle(payload) {
  const { data } = await api.post("/vehicles/", payload);
  return data;
}

export async function updateVehicle(id, payload) {
  const { data } = await api.patch(`/vehicles/${id}/`, payload);
  return data;
}

export async function deleteVehicle(id) {
  await api.delete(`/vehicles/${id}/`);
}
