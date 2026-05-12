import { getSB, ready } from "./supabaseClient.js";
import { ensureVisitorId } from "./uiHelpers.js";

export const createAnalyticsService = ({ getProducts }) => {
  const getBrandProductAnalytics = async (brandId, rangeDays = null, productsIn = null) => {
    await ready;
    const sb = getSB();
    const empty = {
      viewsByProduct: {},
      favByProduct: {},
      totals: { views: 0, favorites: 0, uniqueVisitors: 0 },
    };
    if (!sb || !brandId) return empty;

    const products = productsIn || await getProducts({ brandId });
    const ids = products.map((p) => p.id).filter(Boolean);
    if (!ids.length) return { ...empty, products };

    const sinceIso = rangeDays != null && rangeDays > 0
      ? new Date(Date.now() - rangeDays * 86400000).toISOString()
      : null;

    let vq = sb.from("product_view_log").select("product_id, visitor_id, user_id, created_at").in("product_id", ids);
    if (sinceIso) vq = vq.gte("created_at", sinceIso);
    const { data: vrows, error: ve } = await vq;
    if (ve) return { ...empty, products };

    let fq = sb.from("product_favorites").select("product_id, user_id, created_at").in("product_id", ids);
    if (sinceIso) fq = fq.gte("created_at", sinceIso);
    const { data: frows, error: fe } = await fq;
    if (fe) return { ...empty, products };

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
  };
};
