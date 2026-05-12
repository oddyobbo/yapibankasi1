export const CATEGORIES = ["Akustik", "Aydınlatma", "Dış Cephe", "Zemin", "Tavan Sistemleri", "Mobilya"];

export const LS_PROJECTS_KEY = "ag_projects_v1";
export const LS_ARCHITECT_SESSION_KEY = "ag_architect_session_v1";
export const LS_BRAND_SESSION_KEY = "ag_brand_session_v1";

export const lsRead = (key, fallback) => {
  try {
    const raw = localStorage.getItem(key);
    return raw ? JSON.parse(raw) : fallback;
  } catch {
    return fallback;
  }
};

export const lsWrite = (key, value) => {
  try {
    localStorage.setItem(key, JSON.stringify(value));
  } catch {}
};

export const setCookie = (name, val, days = 365) => {
  const d = new Date();
  d.setTime(d.getTime() + days * 86400000);
  document.cookie = `${name}=${encodeURIComponent(val)};expires=${d.toUTCString()};path=/;SameSite=Lax`;
};

export const getCookie = (name) => {
  const m = document.cookie.match(new RegExp(`(?:^|; )${name}=([^;]*)`));
  return m ? decodeURIComponent(m[1]) : null;
};

export const normalizeStringArray = (value) => {
  if (Array.isArray(value)) return value.map((x) => String(x).trim()).filter(Boolean);
  if (value == null || value === "") return [];
  if (typeof value === "string") {
    const t = value.trim();
    if (!t) return [];
    if ((t.startsWith("[") && t.endsWith("]")) || (t.startsWith("{") && t.endsWith("}"))) {
      try {
        const parsed = JSON.parse(t);
        return normalizeStringArray(parsed);
      } catch {}
    }
    return t.split(/[,|]/).map((s) => s.trim()).filter(Boolean);
  }
  return [];
};

export const ensureVisitorId = () => {
  let id = getCookie("ag_visitor_id") || lsRead("ag_visitor_id_v1", null);
  if (!id) {
    id = `v-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
    lsWrite("ag_visitor_id_v1", id);
    setCookie("ag_visitor_id", id);
  }
  return id;
};

export const nsKey = (suffix, architectId) => `ag_architect_${suffix}_${architectId}`;
