import api from "./api.js";

/** Relative to axios `baseURL` (must not start with `/` or some clients resolve against the site origin). */
const BASE = "notifications/";

/** Paginated list for the Notifications page */
export const listNotifications  = (params = {}) => api.get(BASE, { params }).then(r => r.data);
/** Unpaginated list for the bell dropdown */
export const listAllNotifications = ()     => api.get(BASE, { params: { all: 1 } }).then(r => r.data);
export const getUnreadCount     = ()     => api.get(`${BASE}unread-count/`).then(r => r.data.count);
export const markRead           = (id)   => api.post(`${BASE}${id}/mark-read/`).then(r => r.data);
export const markAllRead        = ()     => api.post(`${BASE}mark-all-read/`).then(r => r.data);
export const deleteNotification = (id)   => api.delete(`${BASE}${id}/`).then(r => r.data);
export const clearAll           = ()     => api.delete(`${BASE}clear-all/`);
