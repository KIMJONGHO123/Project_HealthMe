const API_BASE_URL = process.env.REACT_APP_API_URL;

const trimTrailingSlash = (value) => value.replace(/\/+$/, "");
const ensureLeadingSlash = (value) => value.startsWith("/") ? value : `/${value}`;

export const API_BASE = trimTrailingSlash(API_BASE_URL);
export const HEALTHME_API_BASE = `${API_BASE}/healthme`;

export const apiUrl = (path) => `${API_BASE}${ensureLeadingSlash(path)}`;
export const healthmeApiUrl = (path) => `${HEALTHME_API_BASE}${ensureLeadingSlash(path)}`;
