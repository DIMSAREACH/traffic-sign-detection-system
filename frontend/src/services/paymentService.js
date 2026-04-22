import api from "./api.js";

export async function listPayments(params = {}) {
  const { data } = await api.get("/violations/payments/", { params });
  return data;
}

export async function fetchPayment(id) {
  const { data } = await api.get(`/violations/payments/${id}/`);
  return data;
}

export async function createPayment(payload) {
  const { data } = await api.post("/violations/payments/", payload);
  return data;
}

export async function updatePayment(id, payload) {
  const { data } = await api.patch(`/violations/payments/${id}/`, payload);
  return data;
}

export async function deletePayment(id) {
  const { data } = await api.delete(`/violations/payments/${id}/`);
  return data;
}

export async function fetchPaymentSummary() {
  const { data } = await api.get("/violations/payments/summary/");
  return data;
}
