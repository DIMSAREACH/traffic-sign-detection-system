import api from "./api.js";

const BASE = "cameras/";

/* ── Cameras ── */
export const listCameras   = (params = {}) => api.get(`${BASE}cameras/`, { params }).then(r => r.data);
export const getCamera     = (id)          => api.get(`${BASE}cameras/${id}/`).then(r => r.data);
export const createCamera  = (data)        => api.post(`${BASE}cameras/`, data).then(r => r.data);
export const updateCamera  = (id, data)    => api.put(`${BASE}cameras/${id}/`, data).then(r => r.data);
export const patchCamera   = (id, data)    => api.patch(`${BASE}cameras/${id}/`, data).then(r => r.data);
export const deleteCamera  = (id)          => api.delete(`${BASE}cameras/${id}/`);

/* ── Roads ── */
export const listRoads     = (params = {}) => api.get(`${BASE}roads/`, { params }).then(r => r.data);
export const getRoad       = (id)          => api.get(`${BASE}roads/${id}/`).then(r => r.data);
export const createRoad    = (data)        => api.post(`${BASE}roads/`, data).then(r => r.data);
export const updateRoad    = (id, data)    => api.put(`${BASE}roads/${id}/`, data).then(r => r.data);
export const deleteRoad    = (id)          => api.delete(`${BASE}roads/${id}/`);

/* ── Traffic Signals ── */
export const listSignals   = (params = {}) => api.get(`${BASE}signals/`, { params }).then(r => r.data);
export const createSignal  = (data)        => api.post(`${BASE}signals/`, data).then(r => r.data);
export const updateSignal  = (id, data)    => api.put(`${BASE}signals/${id}/`, data).then(r => r.data);
export const deleteSignal  = (id)          => api.delete(`${BASE}signals/${id}/`);

/* ── Traffic Signs ── */
export const listSigns     = (params = {}) => api.get(`${BASE}signs/`, { params }).then(r => r.data);
export const createSign    = (data)        => api.post(`${BASE}signs/`, data, data instanceof FormData ? { headers: { "Content-Type": "multipart/form-data" } } : {}).then(r => r.data);
export const updateSign    = (id, data)    => api.put(`${BASE}signs/${id}/`, data, data instanceof FormData ? { headers: { "Content-Type": "multipart/form-data" } } : {}).then(r => r.data);
export const patchSign     = (id, data)    => api.patch(`${BASE}signs/${id}/`, data, data instanceof FormData ? { headers: { "Content-Type": "multipart/form-data" } } : {}).then(r => r.data);
export const deleteSign    = (id)          => api.delete(`${BASE}signs/${id}/`);
