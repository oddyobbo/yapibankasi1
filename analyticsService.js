import { getSB, ready } from "./supabaseClient.js";
import { ensureVisitorId } from "./uiHelpers.js";

const emptyAnalytics = (products = []) => ({
  viewsByProduct: {},
  favByProduct: {},
  totals: { views: 0, favorites: 0, uniqueVisitors: 0 },
  products,
});

const ALLOWED_EVENTS = new Set([
  "product_view",
  "brand_view",
  "save_to_favorites",
  "add_to_moodboard",
  "download_file",
  "request_quote",
  "request_sample",
  "contact_brand",
]);

const PRODUCT_VIEW_DEDUPE_MS = 30 * 60 * 1000;

const productViewCacheKey = (productId, sessionId) => `ag:pv:${sessionId}:${productId}`;

const recentlyTrackedProductView = (productId, sessionId) => {
  if (!productId || !sessionId || typeof localStorage === "undefined") return false;
  try {
    const key = productViewCacheKey(productId, sessionId);
    const last = Number(localStorage.getItem(key) || 0);
    if (last && Date.now() - last < PRODUCT_VIEW_DEDUPE_MS) return true;
    localStorage.setItem(key, String(Date.now()));
  } catch (_) {}
  return false;
};

export const createAnalyticsService = ({ getProducts }) => {
  const trackEvent = async (event) => {
    await ready;
    const sb = getSB();
    if (!sb || !event) return null;

    const eventType = event.eventType || event.event_type;
    if (!eventType || !ALLOWED_EVENTS.has(eventType)) return null;
    const sessionId = event.sessionId || ensureVisitorId();

    if (eventType === "product_view" && event.productId) {
      if (recentlyTrackedProductView(event.productId, sessionId)) return null;
      const sinceIso = new Date(Date.now() - PRODUCT_VIEW_DEDUPE_MS).toISOString();
      const { data: existing } = await sb
        .from("analytics_events")
        .select("id")
        .eq("event_type", eventType)
        .eq("product_id", event.productId)
        .eq("session_id", sessionId)
        .gte("created_at", sinceIso)
        .limit(1);
      if (existing && existing.length) return existing[0];
    }

    const payload = {
      event_type: eventType,
      product_id: event.productId || null,
      brand_id: event.brandId || null,
      architect_id: event.architectId || null,
      session_id: sessionId,
      metadata: event.metadata || {},
    };

    const { data, error } = await sb.from("analytics_events").insert(payload).select("*").single();
    if (error) throw error;
    return data;
  };

  const getAnalyticsFromEvents = async (sb, products, ids, brandId, sinceIso) => {
    let q = sb
      .from("analytics_events")
      .select("event_type, product_id, architect_id, session_id, created_at")
      .in("product_id", ids);
    if (sinceIso) q = q.gte("created_at", sinceIso);
    if (brandId) q = q.eq("brand_id", brandId);

    const { data, error } = await q;
    if (error || !data) return null;

    const viewsByProduct = {};
    const favByProduct = {};
    const uniq = new Set();

    data.forEach((row) => {
      if (row.event_type === "product_view") {
        viewsByProduct[row.product_id] = (viewsByProduct[row.product_id] || 0) + 1;
        uniq.add(row.architect_id ? `u:${row.architect_id}` : `s:${row.session_id || "?"}`);
      }
      if (row.event_type === "save_to_favorites" || row.event_type === "add_to_moodboard") {
        favByProduct[row.product_id] = (favByProduct[row.product_id] || 0) + 1;
      }
    });

    return {
      viewsByProduct,
      favByProduct,
      totals: {
        views: data.filter((row) => row.event_type === "product_view").length,
        favorites: data.filter((row) => (
          row.event_type === "save_to_favorites" || row.event_type === "add_to_moodboard"
        )).length,
        uniqueVisitors: uniq.size,
      },
      products,
    };
  };

  const getAnalyticsFromLegacyTables = async (sb, products, ids, sinceIso) => {
    let vq = sb.from("product_view_log").select("product_id, visitor_id, user_id, created_at").in("product_id", ids);
    if (sinceIso) vq = vq.gte("created_at", sinceIso);
    const { data: vrows, error: ve } = await vq;
    if (ve) return emptyAnalytics(products);

    let fq = sb.from("product_favorites").select("product_id, user_id, created_at").in("product_id", ids);
    if (sinceIso) fq = fq.gte("created_at", sinceIso);
    const { data: frows, error: fe } = await fq;
    if (fe) return emptyAnalytics(products);

    const viewsByProduct = {};
    const favByProduct = {};
    const uniq = new Set();

    (vrows || []).forEach((row) => {
      viewsByProduct[row.product_id] = (viewsByProduct[row.product_id] || 0) + 1;
      uniq.add(row.user_id ? `u:${row.user_id}` : `v:${row.visitor_id || "?"}`);
    });
    (frows || []).forEach((row) => {
      favByProduct[row.product_id] = (favByProduct[row.product_id] || 0) + 1;
    });

    return {
      viewsByProduct,
      favByProduct,
      totals: {
        views: (vrows || []).length,
        favorites: (frows || []).length,
        uniqueVisitors: uniq.size,
      },
      products,
    };
  };

  const getBrandProductAnalytics = async (brandId, rangeDays = null, productsIn = null) => {
    await ready;
    const sb = getSB();
    if (!sb || !brandId) return emptyAnalytics();

    const products = productsIn || await getProducts({ brandId });
    const ids = products.map((p) => p.id).filter(Boolean);
    if (!ids.length) return emptyAnalytics(products);

    const sinceIso = rangeDays != null && rangeDays > 0
      ? new Date(Date.now() - rangeDays * 86400000).toISOString()
      : null;

    const eventsAnalytics = await getAnalyticsFromEvents(sb, products, ids, brandId, sinceIso);
    if (eventsAnalytics) return eventsAnalytics;
    return getAnalyticsFromLegacyTables(sb, products, ids, sinceIso);
  };

  const getVisits = async () => {
    await ready;
    const sb = getSB();
    if (!sb) return [];
    const { data } = await sb.from("visits").select("*").order("created_at", { ascending: false }).limit(2500);
    return data || [];
  };

  const trackVisit = async () => {
    await ready;
    const sb = getSB();
    if (!sb) return;
    const entry = {
      visitor_id: ensureVisitorId(),
      page: location.pathname || "/",
      referrer: document.referrer || "(direct)",
      ts: Date.now(),
    };
    try {
      const res = await fetch("https://ipapi.co/json/", { credentials: "omit" });
      if (res.ok) {
        const geo = await res.json();
        entry.city = geo.city || null;
        entry.region = geo.region || null;
        entry.country = geo.country_name || null;
        entry.ip = geo.ip || null;
      }
    } catch {}
    try {
      await sb.from("visits").insert(entry);
    } catch {}
  };

  return {
    getBrandProductAnalytics,
    getVisits,
    trackVisit,
    trackEvent,
  };
};
