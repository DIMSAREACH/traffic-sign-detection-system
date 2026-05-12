import api from "./api.js";

export async function processImage(formData) {
  const { data } = await api.post("ai/process-image/", formData, {
    headers: { "Content-Type": "multipart/form-data" }
  });
  return data;
}

export async function uploadVideo(formData) {
  const { data } = await api.post("ai/upload-video/", formData, {
    headers: { "Content-Type": "multipart/form-data" }
  });
  return data;
}

export async function listDetectionLogs(params = {}) {
  const { data } = await api.get("ai/logs/", { params });
  return data;
}

export async function fetchDetectionLog(id) {
  const { data } = await api.get(`/ai/logs/${id}/`);
  return data;
}

export async function deleteDetectionLog(id) {
  await api.delete(`/ai/logs/${id}/`);
}
