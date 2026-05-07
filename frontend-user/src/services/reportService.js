import api from "./api.js";

export async function fetchDashboard(params = {}) {
  const { data } = await api.get("/reports/dashboard/", { params });
  return data;
}

export async function fetchMyDashboard() {
  const { data } = await api.get("/reports/my-dashboard/");
  return data;
}

export async function fetchMonthly(params = {}) {
  const { data } = await api.get("/reports/monthly/", { params });
  return data.monthly ?? data;
}

export async function fetchSystemHealth() {
  const { data } = await api.get("/reports/system-health/");
  return data;
}

export async function downloadCSV(params = {}) {
  const response = await api.get("/reports/export/csv/", {
    params,
    responseType: "blob",
  });
  const url = URL.createObjectURL(new Blob([response.data], { type: "text/csv" }));
  const a = document.createElement("a");
  a.href = url;
  a.download = "violations_export.csv";
  a.click();
  URL.revokeObjectURL(url);
}

export async function downloadPDF(params = {}) {
  const response = await api.get("/reports/export/pdf/", {
    params,
    responseType: "blob",
  });
  const url = URL.createObjectURL(new Blob([response.data], { type: "application/pdf" }));
  const a = document.createElement("a");
  a.href = url;
  a.download = "violations_report.pdf";
  a.click();
  URL.revokeObjectURL(url);
}
