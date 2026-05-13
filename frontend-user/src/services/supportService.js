import api from "./api.js";

const BASE = "support/reports/";

/** Submit a new issue report (accepts FormData or plain object) */
export const createIssueReport = (data) =>
  api.post(`${BASE}create/`, data).then((r) => r.data);

/** List issue reports (admin sees all, user sees their own) */
export const listIssueReports = (params = {}) =>
  api.get(BASE, { params }).then((r) => r.data);

/** Get a single issue report */
export const getIssueReport = (id) =>
  api.get(`${BASE}${id}/`).then((r) => r.data);
