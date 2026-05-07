import api from "./api";

export const listUsers   = (params = {}) =>
  api.get("/auth/users/", { params }).then(r => r.data);

export const getUser     = (id) =>
  api.get(`/auth/users/${id}/`).then(r => r.data);

export const createUser  = (data) =>
  api.post("/auth/users/", data).then(r => r.data);

export const updateUser  = (id, data) =>
  api.patch(`/auth/users/${id}/`, data).then(r => r.data);

export const assignRole  = (id, role) =>
  api.post(`/auth/users/${id}/assign-role/`, { role }).then(r => r.data);

export const toggleActive = (id) =>
  api.post(`/auth/users/${id}/toggle-active/`).then(r => r.data);

export const deleteUser  = (id) =>
  api.delete(`/auth/users/${id}/`).then(r => r.data);

export const fetchUserStats = () =>
  api.get("/auth/users/stats/").then(r => r.data);

export const exportUsersCSV = async () => {
  const response = await api.get("/auth/users/export-csv/", { responseType: "blob" });
  const url = URL.createObjectURL(new Blob([response.data], { type: "text/csv" }));
  const a = document.createElement("a");
  a.href = url;
  a.download = "users.csv";
  a.click();
  URL.revokeObjectURL(url);
};
